# Fontex

## Fontex Studio: editor de materiales matemáticos

La ruta principal `/#/` (también `/#/lienzo`) abre el editor sin exigir una cuenta. Permite mezclar **fracciones pictóricas, operaciones guiadas, textos y sucesiones aritméticas** en un mismo documento.

- Añadir, seleccionar, arrastrar, duplicar y eliminar objetos independientes.
- Editar propiedades, posición y tamaño desde un inspector común.
- Mover con las flechas al enfocar el encabezado del objeto (10 unidades; Shift + flecha, 50).
- Deshacer y rehacer hasta 40 cambios; un arrastre es un único cambio.
- Recorrer la representación, homogeneización y resolución de una operación en el propio lienzo.
- Crear materiales en blanco o partir de las plantillas de fracciones y sucesiones.
- Guardar automáticamente los cambios aplicados, abrir otros materiales y recuperar el último al recargar.
- Exportar e importar documentos `.fontex.json`, con validación de esquema y datos matemáticos.
- Presentar sin paneles de edición, con pantalla completa cuando el navegador la admite y salida mediante Esc.

**Guardado:** los documentos completos se conservan en este navegador, separados por cuenta e invitado. Incluyen valores, figuras, textos, posiciones, tamaños y pasos. No se sincronizan con Supabase ni entre dispositivos. Exporta una copia JSON para trasladarlos; borrar los datos del navegador elimina las copias locales. Si falla el almacenamiento, se mantiene el documento en memoria, se muestra el error y se permite exportarlo.

**Alcance:** un lienzo por documento de hasta 80 objetos, esquema versión 1. Las sucesiones admiten 2–8 términos, inicio entre −1000 y 1000 y diferencia entera entre −100 y 100; los valores entre 0 y 30 se representan con puntos. Las operaciones conservan los límites del laboratorio de fracciones. Funciones, ecuaciones, generación de materiales mediante IA, versiones remotas y apertura garantizada sin internet siguen pendientes. Los cálculos del editor no requieren IA; una página ya cargada puede seguir editándose sin conexión.

La arquitectura y la guía de prueba están en [docs/architecture/studio.md](docs/architecture/studio.md).

## Laboratorio visual de fracciones

El laboratorio original sigue disponible en `/#/fracciones` sin iniciar sesión. Escribe una suma o resta como `2/3 + 3/6`: representa cada fracción, homogeneiza con el mínimo común múltiplo y muestra el resultado con figuras y explicación textual. Permite barras o círculos, mover tarjetas por su encabezado, cambiar el zoom y añadir una observación. La última operación válida se conserva en este navegador; las notas y posiciones duran la sesión abierta.

Alcance del prototipo: dos fracciones no negativas, suma o resta con resultado no negativo; denominadores de 1 a 24, hasta 3 unidades por operando y denominador común de hasta 60 para mantener el dibujo legible. Los cálculos y las explicaciones son deterministas y funcionan sin API ni conexión a IA.

La versión anterior completa se conserva en la rama `respaldo/aula-virtual-2026-11-11` (commit `6210aafa87e5a55cfa5adb25960a36edc25cc307`). El aula anterior sigue accesible desde `/#/inicio` y el tutor de práctica desde `/#/demo`.

Ejecuta `npm ci`, `npm run dev`. Comprueba con `npm run test` y `npm run build`.

## Crear cuenta e iniciar sesión

El lienzo ofrece acceso desde `/#/ingresar` y registro desde `/#/crear-cuenta`. Al entrar, vuelve al lienzo; el acceso específico del tutor (`/#/ingresar-tutor`) conserva su retorno al tutor. Crear cuenta solicita nombre, correo y contraseña confirmada. Si Supabase exige verificar el correo, el formulario explica el paso pendiente y permite reenviar el enlace con una espera de 60 segundos. La dirección de retorno utiliza el origen y la ruta de la aplicación, sin el fragmento reservado para los tokens de Supabase.

Un error `email_not_confirmed` significa que hay que abrir el enlace recibido antes de iniciar sesión. No se desactiva la confirmación de correo. Los errores se muestran en español, el login admite contraseñas existentes sin imponer el mínimo del registro y la recuperación de sesión maneja fallos de red y respuestas tardías. El lienzo muestra la cuenta activa y permite cerrar sesión. Si faltan las variables de Supabase, el formulario informa que el acceso no está disponible y mantiene el lienzo abierto para invitados.

Validación: pruebas de interfaz y proveedor cubren registro pendiente de confirmación, reenvío, login, cierre y restauración de sesión, errores de red y carreras de inicialización. Se comprobaron en la API real el rechazo de credenciales inexistentes y de un registro inválido, sin crear cuentas de prueba. El registro real observado en los logs fue exitoso y el login posterior falló por correo sin confirmar; la apertura de enlaces en una bandeja de correo no forma parte de las pruebas automatizadas.

## Tutor personal de Matemática

Ejecuta `npm ci` y `npm run dev`. Abre `/#/demo` en la dirección de Vite. El alumno elige un tema de primaria o secundaria, lee la teoría y practica. Cada error muestra una explicación para esa respuesta y la página de la guía que conviene repasar.

La demo incluye cuatro temas, nueve ejercicios y una guía PDF por tema. Se puede añadir un PDF con texto seleccionable por tema (hasta 5 MiB y 100 páginas). El avance, el historial y los PDF se guardan en el navegador, separados por cuenta o por sesión de invitado.

### Activar los modelos

En la web, inicia sesión en Fontex desde `/#/demo`. La función Supabase `practice-tutor` consulta OpenAI desde el servidor. Requiere la migración de cuotas y el secreto `OPENAI_API_KEY` en Supabase. Limita las solicitudes de IA a 10 por hora y 25 por día por cuenta, con ventanas en UTC.

En desarrollo también puedes añadir `OPENAI_API_KEY` a `.env.local` y reiniciar `npm run dev`. El servidor de Vite la lee exclusivamente en localhost.

| Modo                                            | Modelo                      | Fuente                                                              |
| ----------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| Chat general                                    | GPT-6 Luna (`gpt-6-luna`)   | Conversación reciente                                               |
| Corrección de ejercicios y estudio con archivos | GPT-6.1 Sol (`gpt-6.1-sol`) | Guía del tema o fragmento recuperado del PDF seleccionado           |
| Estudio web                                     | GPT-6.1 Sol (`gpt-6.1-sol`) | Búsqueda en MINEDU, Khan Academy y OpenStax, con citas verificables |

Para publicar la demo estática, ejecuta `npm run build -- --mode demo`. Ese modo ofrece teoría, corrección preparada por alternativa y búsqueda local por página. Con una sesión válida y la función Supabase configurada, la compilación estática también habilita el chat generativo y la búsqueda web.

**Fuentes puestas en contexto.**

Fontex es un entorno académico que prepara una experiencia de consulta documental con trazabilidad. El nombre reúne **FONT**es (latín: fuentes o manantial de información) y **TEX**tus (texto o contexto): ninguna respuesta debería presentarse aislada de las fuentes autorizadas que la sostienen.

Este repositorio contiene los **Bloques 0, 1, 2 y 3** del plan maestro, más la conexión anticipada del tutor en `v0.3.0`: frontend responsive, identidad con Supabase Auth, biblioteca PDF privada y un motor RAG autorizado con diagnóstico independiente. La recuperación todavía no alimenta `tutor-chat`.

## Ejecutar localmente

Requisitos: Node.js 22 y npm 10 o versiones compatibles.

```bash
npm install
npx supabase db start
npm run dev
```

La aplicación se abre normalmente en `http://localhost:5173`. Las rutas usan hash (`#/tutor`, `#/biblioteca`) para funcionar al recargar desde GitHub Pages.

Para activar Auth y los datos reales, copia `.env.example` como `.env.local` y completa la clave **publicable** del proyecto:

```powershell
Copy-Item .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=https://goegjuglstapjwcckawp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La clave publicable está diseñada para el navegador y solo es segura junto con RLS. Nunca uses `service_role`, claves secretas nuevas ni credenciales de PostgreSQL en variables `VITE_*`.

## Supabase

El repositorio está vinculado al proyecto `goegjuglstapjwcckawp` (`fintex.back`). Las migraciones de los Bloques 1, 2 y 3 se aplican con revisión previa:

```bash
npx supabase db push --dry-run
npx supabase db push --linked --skip-vault
```

Las pruebas de políticas se ejecutan sobre una base local aislada y se revierten al terminar:

```bash
npx supabase db start
npx supabase test db --local
npx supabase db stop
```

El tutor de aulas se ejecuta en `tutor-chat`. Requiere `OPENAI_API_KEY` en los secretos del proyecto y se despliega con JWT obligatorio:

```bash
npx supabase functions deploy tutor-chat --project-ref goegjuglstapjwcckawp --use-api
```

La biblioteca coordina sus escrituras mediante dos funciones autenticadas. Ninguna usa secretos en el navegador:

```bash
npx supabase functions deploy document-upload document-delete --project-ref goegjuglstapjwcckawp --use-api
```

La extracción/indexación y la búsqueda diagnóstica usan funciones separadas y el mismo secreto server-side. Su configuración estable debe conservar modelo y dimensión compatibles con la migración:

```powershell
npx supabase secrets set EMBEDDING_MODEL=text-embedding-3-small EMBEDDING_DIMENSIONS=1536 --project-ref goegjuglstapjwcckawp
npx supabase functions deploy document-process document-search --project-ref goegjuglstapjwcckawp --use-api
```

No se debe definir `OPENAI_API_KEY` en variables `VITE_*`, archivos del frontend ni GitHub Pages.

## Ruta base de despliegue

Vite publica en `/` de forma predeterminada, que es la configuración usada por el dominio personalizado `https://fontex.sypablitodp.site`.

La ruta puede seleccionarse explícitamente al compilar:

```bash
VITE_BASE_PATH=/fontex-web/ npm run build
```

En GitHub Actions, el workflow de Pages lee `VITE_BASE_PATH`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como variables del repositorio. Si no existen las dos variables públicas de Supabase, utiliza como respaldo la URL y la clave `sb_publishable_…` del proyecto vinculado; esta clave es pública por diseño y no sustituye RLS. La base utiliza `/` si no está definida. Para volver al dominio estándar `https://dppablito4-oss.github.io/fontex-web/`, se debe configurar `VITE_BASE_PATH=/fontex-web/` antes de publicar.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Alcance implementado

- Vite, React y TypeScript estricto.
- Tailwind CSS y componentes locales con convenciones de shadcn/ui.
- Shell mobile-first y seis páginas mínimas.
- `assistant-ui` con adaptador real a `tutor-chat` y demo local solo cuando Supabase no está configurado.
- Supabase Auth para registro, confirmación e inicio/cierre de sesión.
- Perfiles, organizaciones, aulas, invitaciones de un solo uso, roles y grupos.
- RLS y privilegios mínimos sobre todas las tablas expuestas del Bloque 1.
- PDF privados en `fontex-documents`, metadatos RLS, cuotas transaccionales y deduplicación SHA-256.
- Compartición explícita por grupo o aula con revocación inmediata y sin URLs públicas.
- Visor PDF.js responsive con navegación de páginas y descarga autenticada.
- Extracción PDF server-side con hash y páginas verificadas, chunks versionados y procesamiento reanudable.
- Embeddings `text-embedding-3-small` de 1536 dimensiones y almacenamiento pgvector con presupuesto de tokens.
- Recuperación híbrida por coseno, texto completo y RRF, siempre filtrada por permisos vigentes.
- Panel diagnóstico en Biblioteca con documento, páginas y fragmento recuperado.
- Pruebas pgTAP y de integración remota con múltiples identidades ficticias.
- CI y despliegue estático a GitHub Pages.
- OpenAI Responses API desde una Edge Function autenticada; la clave privada permanece en Supabase.
- Motor RAG disponible sólo para diagnóstico: el tutor mantiene `0 fuentes` y tiene prohibido inventar citas o acceso documental.

Consulta [los reportes versionados](docs/REPORTES.md), [la arquitectura](docs/architecture/overview.md), [el sistema de diseño](docs/design/DESIGN_SYSTEM.md) y [el registro de dependencias](docs/decisions/DEPENDENCIES.md) para conocer el historial y las decisiones del prototipo.

## Estado

Prototipo académico en desarrollo. Identidad, aulas, grupos, biblioteca PDF, indexación y recuperación diagnóstica operan con servicios reales. Las citas trazables y la conexión documental del tutor corresponden al Bloque 4 y continúan pendientes.
