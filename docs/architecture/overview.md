# Arquitectura de los Bloques 0, 1 y 2

## Objetivo

El Bloque 0 estableció la interfaz y las fronteras técnicas de Fontex. El Bloque 1 incorporó identidad, aulas y grupos con autorización en PostgreSQL. El Bloque 2 añade una biblioteca PDF real con metadatos protegidos, Storage privado, cuotas transaccionales y visor PDF.js, manteniendo el frontend como sitio estático para GitHub Pages. La indexación y el RAG siguen sin conectarse.

## Capas actuales

```text
Navegador
├── React Router (HashRouter)
├── Supabase Auth + cliente público bajo RLS
├── Contextos de identidad y espacio de trabajo
├── Biblioteca documental y visor PDF.js bajo demanda
├── Shell responsive y páginas por funcionalidad
├── Componentes UI locales
└── assistant-ui LocalRuntime
    └── Adaptador a tutor-chat, todavía sin documentos ni RAG
```

- `src/app`: enrutamiento y layout transversal.
- `src/features`: páginas y comportamiento agrupados por funcionalidad.
- `src/components`: componentes compartidos y primitivas UI.
- `src/lib`: utilidades sin conocimiento de la interfaz.
- `supabase/migrations`: esquema versionado de identidad, aulas, invitaciones y grupos.
- `supabase/tests`: pruebas pgTAP de aislamiento con múltiples identidades.
- `supabase/functions/document-upload`: validación confiable y carga coordinada.
- `supabase/functions/document-delete`: eliminación física antes de retirar metadatos y permisos.

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

## Cuotas del piloto

`document_limits` permite configuración administrativa. Los valores iniciales son 5 MiB y 100 páginas por PDF, 10 documentos y 50 MiB por usuario, 500 MiB por aula y 750 MiB globales. El tope global deja margen frente al cupo publicado de 1 GB del plan Free; no depende de que la organización tenga un plan superior. Los conteos incluyen reservas y cargas en curso para no exceder límites mediante concurrencia.

## Navegación estática

Se utiliza `HashRouter` porque GitHub Pages no ofrece reglas de reescritura para una SPA. La URL conserva el documento estático y expresa la ruta después de `#`, de modo que una recarga no produce un error 404.

Vite obtiene su `base` de compilación desde `VITE_BASE_PATH`. El valor predeterminado es `/`, necesario para publicar desde la raíz del dominio personalizado `fontex.sypablitodp.site`. El workflow de Pages utiliza la variable de repositorio del mismo nombre y también adopta `/` cuando no está definida. Para usar el dominio estándar de GitHub Pages se puede asignar `/fontex-web/`, sin detecciones de dominio en tiempo de ejecución.

El shell conserva las rutas internas en el fragmento mediante `HashRouter`. El salto accesible al contenido cancela la navegación del enlace y mueve el foco al elemento `main`, por lo que no reemplaza el fragmento de ruta. En pantallas móviles, el panel lateral cerrado utiliza `inert` y `aria-hidden`; sus controles quedan fuera de la navegación por teclado hasta abrir el menú.

## Evaluación de assistant-ui

El tutor usa `@assistant-ui/react` con `useLocalRuntime`. Cuando existe configuración pública de Supabase, su `ChatModelAdapter` invoca la Edge Function autenticada `tutor-chat`; sin esa configuración conserva una demostración local explícita. La clave de OpenAI reside únicamente en Supabase y nunca se entrega al navegador.

La versión `v0.3.0` todavía no implementa recuperación documental: `tutor-chat` llama a Responses API con instrucciones para no inventar citas ni afirmar acceso a archivos. La selección, fragmentación, búsqueda vectorial y trazabilidad de fuentes pertenecen a la fase RAG posterior.

Resultado del spike:

- Es compatible con el frontend estático para componentes, estado local y experiencia conversacional.
- Una respuesta real **sí requiere** un backend seguro. En bloques posteriores, el adaptador deberá invocar una Supabase Edge Function autenticada.
- La clave del proveedor de IA nunca se incluirá en variables `VITE_*` ni en el bundle.
- Persistencia, citas verificadas, streaming remoto y permisos quedan fuera del Bloque 0.

## Frontera futura

El frontend utiliza el SDK público de Supabase bajo RLS para identidad, biblioteca y descargas. Las operaciones documentales privilegiadas residen en Edge Functions. El siguiente bloque podrá leer únicamente documentos `ready` que ya superaron esta frontera de autorización, pero deberá diseñar nuevas políticas para texto, fragmentos y recuperación. `tutor-chat` no recibe todavía archivos ni contenido PDF.

## Accesibilidad y responsive

El shell incluye enlace de salto, navegación semántica, controles etiquetados, foco visible y soporte para reducción de movimiento. El menú lateral se transforma en panel móvil. Las verificaciones automáticas de accesibilidad en navegador quedan como tarea del Bloque 5; no se declaran como completadas en esta fase.
