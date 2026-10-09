# Arquitectura de los Bloques 0, 1, 2 y 3

## Objetivo

El Bloque 0 estableció la interfaz y las fronteras técnicas de Fontex. El Bloque 1 incorporó identidad, aulas y grupos; el Bloque 2 añadió la biblioteca PDF privada. El Bloque 3 incorpora extracción server-side, indexación vectorial y recuperación híbrida autorizada, manteniendo el frontend como sitio estático para GitHub Pages. El tutor continúa deliberadamente separado del motor RAG.

## Capas actuales

```text
Navegador
├── React Router (HashRouter)
├── Supabase Auth + cliente público bajo RLS
├── Contextos de identidad y espacio de trabajo
├── Biblioteca documental, visor PDF.js y diagnóstico RAG
├── Shell responsive y páginas por funcionalidad
├── Componentes UI locales
└── assistant-ui LocalRuntime
    └── Adaptador a tutor-chat, todavía sin contexto documental
```

- `src/app`: enrutamiento y layout transversal.
- `src/features`: páginas y comportamiento agrupados por funcionalidad.
- `src/components`: componentes compartidos y primitivas UI.
- `src/lib`: utilidades sin conocimiento de la interfaz.
- `supabase/migrations`: esquema versionado de identidad, aulas, invitaciones y grupos.
- `supabase/tests`: pruebas pgTAP de aislamiento con múltiples identidades.
- `supabase/functions/document-upload`: validación confiable y carga coordinada.
- `supabase/functions/document-delete`: eliminación física antes de retirar metadatos y permisos.
- `supabase/functions/document-process`: extracción PDF e indexación reanudable por lotes.
- `supabase/functions/document-search`: embedding de consulta y recuperación híbrida protegida.
- `supabase/functions/_shared/rag`: normalización, fragmentación y cliente mínimo de embeddings.

## Identidad y autorización

`AuthProvider` administra la sesión y el perfil. `WorkspaceProvider` consulta exclusivamente mediante el token del usuario; no usa claves privadas ni decide autorizaciones. Si faltan las variables públicas, la aplicación conserva un modo demostrativo explícito y no simula escrituras.

El esquema aplica dos capas:

1. Privilegios SQL mínimos para `authenticated` y ninguno para `anon` sobre las tablas del Bloque 1.
2. RLS para filtrar perfiles, organizaciones, aulas, matrículas, invitaciones y grupos.

Los roles pertenecen a `class_members`, no a `raw_user_meta_data`. Las invitaciones vinculan correo, rol y aula; el token se devuelve una vez y solo se conserva su SHA-256. El propietario del aula no puede ser retirado y solo él puede cambiar roles de miembros existentes. Retirar una matrícula elimina también las asignaciones grupales y corta el acceso futuro.

Las funciones auxiliares que deben leer membresías sin recursión RLS viven en el esquema no expuesto `private`, usan `SECURITY DEFINER`, fijan `search_path = ''` y califican todas las relaciones. Las funciones públicas de mutación verifican `auth.uid()`, correo y rol antes de escribir y limitan su ejecución a `authenticated`.

La creación del primer workspace ya no pertenece automáticamente a la primera cuenta pública. `private.workspace_bootstrap_authorizations` conserva autorizaciones administrativas de un solo uso; la migración autoriza al único usuario preexistente del proyecto piloto y las altas posteriores requieren una concesión explícita.

## Biblioteca documental segura

`documents` conserva una referencia estable por PDF, propietario derivado de `auth.uid()`, aula, hash SHA-256, tamaño, páginas, ruta aleatoria y estado. `document_shares` usa llaves foráneas separadas para aula y grupo, junto con un `check` y un trigger que impiden asociar un documento con otro contexto. No se creó versionado porque el MVP no reemplaza objetos: una nueva versión se carga como un documento nuevo.

El flujo de carga separa reserva y archivo sin declarar disponibilidad prematura:

1. PDF.js comprueba en el navegador extensión, MIME, parseo, páginas y presencia de texto seleccionable.
2. `reserve_document_upload` verifica matrícula y cuotas dentro de una transacción. Advisory locks global, de aula y de usuario evitan carreras; la función genera ID y ruta aleatorios.
3. `document-upload` exige JWT, vuelve a comprobar propietario, vencimiento, tamaño, MIME, nombre, firma `%PDF-`/`%%EOF` y SHA-256.
4. Solo la función usa el cliente administrativo para escribir el objeto; los usuarios no reciben políticas `INSERT`, `UPDATE` o `DELETE` sobre Storage.
5. El estado cambia a `ready` únicamente después de la subida. Si la confirmación falla, la función elimina el objeto; los fallos quedan visibles pero nunca descargables.

La descarga usa `storage.from('fontex-documents').download(path)` con el JWT del usuario, un `cacheNonce` nuevo y caché `no-store`. La única política `SELECT` del bucket consulta `private.can_download_document_object` y no existen políticas directas de escritura. Un propietario puede leer su documento; una compartición de aula exige matrícula activa, y una de grupo exige simultáneamente matrícula y pertenencia actual al grupo. El docente no obtiene acceso implícito a documentos privados de estudiantes. No se crean URLs firmadas ni públicas.

`document-delete` verifica propietario con el cliente sometido a RLS, elimina el objeto mediante Storage API y después borra el documento; el `ON DELETE CASCADE` retira sus comparticiones. Las sustituciones directas y cambios de ruta están denegados.

## Indexación y recuperación RAG

`document_processing_jobs` conserva estado, fase, lease, versión del chunker, modelo, dimensión, progreso, tokens y fallos. `document_chunks` conserva contenido normalizado, hash, página, embedding `vector(1536)` y un `tsvector` español/simple. Un índice incompleto nunca participa en búsquedas: la RPC exige trabajo `ready`, fase `complete` y todos los vectores presentes.

El propietario inicia `document-process`. La función vuelve a descargar el objeto privado y verifica SHA-256 y páginas reales antes de confiar en el texto. PDF.js extrae página por página; el chunker determinista apunta cada fragmento a su página y aplica objetivos de 600 tokens con solape de 100. La primera llamada persiste chunks y embebe hasta 16; llamadas sucesivas reclaman un lease y continúan sólo los vectores nulos. Los límites iniciales son 400.000 caracteres, 240 chunks y 100.000 tokens de embedding por documento, una tarea concurrente por usuario y tres fallos.

`document-search` crea un embedding por consulta y delega la recuperación a una RPC concedida sólo a `service_role`. La RPC recibe la identidad ya autenticada por Edge, vuelve a aplicar permisos actuales mediante `private.can_user_access_document`, filtra alcance y estado, y combina vecinos por coseno con texto completo mediante Reciprocal Rank Fusion. El cliente no puede leer `document_chunks`, invocar la RPC interna ni convertir un ID conocido en autorización. Las revocaciones y bajas de matrícula afectan la siguiente consulta.

El piloto usa búsqueda vectorial exacta porque el máximo documental vigente mantiene acotado el conjunto. Con 240 chunks por documento, 100 documentos representarían como máximo 24.000 vectores; HNSW se evaluará al aproximarse a 100.000 chunks globales o si la latencia p95 supera 300 ms. Evitarlo ahora reduce mantenimiento y no debilita exactitud. `rag_search_events` registra volumen, tokens y latencia sin almacenar la consulta ni el contenido.

La referencia publicada para `text-embedding-3-small` equivale a USD 0,02 por millón de tokens de entrada. Por tanto, el presupuesto extremo de 100.000 tokens cuesta aproximadamente USD 0,002 por documento, USD 0,02 por diez documentos o USD 0,20 por cien; no incluye impuestos ni futuros cambios de tarifa. Una consulta de 500 caracteres se estima en unos 125 tokens: incluso 60 consultas consumen cerca de 7.500 tokens, aproximadamente USD 0,00015. Cada `vector(1536)` ocupa alrededor de 6 KiB antes de índices y overhead; 24.000 vectores rondan 141 MiB sólo en valores vectoriales. Fuentes de referencia: [guía de embeddings de OpenAI](https://developers.openai.com/api/docs/guides/embeddings) y [documentación de índices vectoriales de Supabase](https://supabase.com/docs/guides/ai/vector-indexes).

## Cuotas del piloto

`document_limits` permite configuración administrativa. Los valores iniciales son 5 MiB y 100 páginas por PDF, 10 documentos y 50 MiB por usuario, 500 MiB por aula y 750 MiB globales. El tope global deja margen frente al cupo publicado de 1 GB del plan Free; no depende de que la organización tenga un plan superior. Los conteos incluyen reservas y cargas en curso para no exceder límites mediante concurrencia.

## Navegación estática

Se utiliza `HashRouter` porque GitHub Pages no ofrece reglas de reescritura para una SPA. La URL conserva el documento estático y expresa la ruta después de `#`, de modo que una recarga no produce un error 404.

Vite obtiene su `base` de compilación desde `VITE_BASE_PATH`. El valor predeterminado es `/`, necesario para publicar desde la raíz del dominio personalizado `fontex.sypablitodp.site`. El workflow de Pages utiliza la variable de repositorio del mismo nombre y también adopta `/` cuando no está definida. Para usar el dominio estándar de GitHub Pages se puede asignar `/fontex-web/`, sin detecciones de dominio en tiempo de ejecución.

El shell conserva las rutas internas en el fragmento mediante `HashRouter`. El salto accesible al contenido cancela la navegación del enlace y mueve el foco al elemento `main`, por lo que no reemplaza el fragmento de ruta. En pantallas móviles, el panel lateral cerrado utiliza `inert` y `aria-hidden`; sus controles quedan fuera de la navegación por teclado hasta abrir el menú.

## Evaluación de assistant-ui

El tutor usa `@assistant-ui/react` con `useLocalRuntime`. Cuando existe configuración pública de Supabase, su `ChatModelAdapter` invoca la Edge Function autenticada `tutor-chat`; sin esa configuración conserva una demostración local explícita. La clave de OpenAI reside únicamente en Supabase y nunca se entrega al navegador.

Aunque `v0.5.0` ya ofrece recuperación documental diagnóstica, `tutor-chat` conserva exactamente el comportamiento de `v0.3.0`: llama a Responses API con instrucciones para no inventar citas ni afirmar acceso a archivos. La selección de fuentes, citas y composición del contexto pertenecen al Bloque 4.

Resultado del spike:

- Es compatible con el frontend estático para componentes, estado local y experiencia conversacional.
- Una respuesta real **sí requiere** un backend seguro. En bloques posteriores, el adaptador deberá invocar una Supabase Edge Function autenticada.
- La clave del proveedor de IA nunca se incluirá en variables `VITE_*` ni en el bundle.
- Persistencia, citas verificadas, streaming remoto y permisos quedan fuera del Bloque 0.

## Frontera futura

El frontend utiliza el SDK público bajo RLS para identidad, biblioteca y descargas. Las operaciones documentales privilegiadas residen en Edge Functions. El Bloque 4 podrá consumir sólo la salida autorizada del motor de recuperación, añadir citas y construir contexto acotado; no deberá consultar chunks directamente ni aceptar IDs o permisos decididos por el navegador. `tutor-chat` no recibe todavía archivos ni contenido PDF.

## Accesibilidad y responsive

El shell incluye enlace de salto, navegación semántica, controles etiquetados, foco visible y soporte para reducción de movimiento. El menú lateral se transforma en panel móvil. Las verificaciones automáticas de accesibilidad en navegador quedan como tarea del Bloque 5; no se declaran como completadas en esta fase.
