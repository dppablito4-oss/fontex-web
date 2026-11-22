# Fontex 1.0

Lienzo matemático interactivo para crear, explicar y practicar, con aulas y biblioteca documental. La web es una SPA de React, TypeScript y Vite; el motor calcula en el navegador. La IA propone JSON validado, sin ejecutar código generado.

## Qué incluye

- **Lienzo:** doce primitivas componibles y 40 plantillas, variables compartidas, edición, historial, pestañas, presentación, JSON y descarga directa de PDF.
- **Cuerpos 3D:** cubo, prisma rectangular, pirámide, esfera, cilindro y cono; giro táctil/ratón, zoom, medidas dinámicas, área y volumen. El PDF conserva la vista guardada. [Alcance 3D](docs/CUERPOS-3D-V100.md).
- **Práctica:** respuestas y valores que habilita el docente. Las definiciones y resultados calculados permanecen protegidos; las respuestas abiertas no se califican automáticamente.
- **Aulas:** invitaciones, participación temporal, clases por tema/fecha/semana, publicación de lienzos con adjuntos y revisión de trabajos. [Aulas](docs/AULAS-V092.md).
- **Biblioteca:** lienzos personales, PDF privados y compartidos, visor y búsqueda documental con permisos.
- **Tutor documental:** conversaciones por aula, selección de fuentes y citas verificadas. Es distinto del asistente que construye el lienzo.
- **Aprender:** catálogo de actividades y PDF locales, progreso y tutor de práctica.

El editor funciona sin IA y permite trabajo local sin cuenta. La sincronización, las aulas y los servicios de IA requieren su configuración y permisos. El funcionamiento local no implica que la aplicación pueda abrirse desde cero sin conexión: no hay instalación PWA ni caché offline completa.

## Desarrollo local

Requisitos: Node.js 22 o superior y npm. Docker y Deno se necesitan para las comprobaciones de backend.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell usa `Copy-Item .env.example .env.local`. Sin URL y clave pública de Supabase puedes explorar el editor local. Para conectar tu proyecto configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.

Las variables `VITE_*` se publican en el cliente. Las claves de OpenAI, SMTP y administración pertenecen al servidor; no las pongas en variables públicas. El plugin de Vite admite `OPENAI_API_KEY` solo para el tutor de práctica en desarrollo local. [Configuración de backend y secretos](supabase/README.md).

## Rutas

Se usa `HashRouter`, por lo que las rutas empiezan por `/#/`.

| Ruta | Uso |
| --- | --- |
| `/` | Presentación |
| `/lienzo` | Editor actual |
| `/laboratorio`, `/fracciones`, `/lienzo-clasico` | Enlaces anteriores que abren el mismo editor |
| `/compartido/:token` | Lectura pública de un lienzo compartido |
| `/demo` | Catálogo Aprender; admite `?nivel=inicial`, `primaria`, `secundaria`, `universidad` |
| `/unirse`, `/aula`, `/clase/:id` | Invitaciones y aprendizaje de aula, con acceso según sesión o invitación |
| `/inicio`, `/grupo`, `/biblioteca`, `/tutor` | Espacio académico autenticado |
| `/administracion` | Administración autorizada y acciones protegidas por MFA |
| `/ingresar`, `/crear-cuenta`, `/ingresar-tutor` | Acceso y registro |
| `/recuperar-contrasena`, `/nueva-contrasena` | Recuperación de contraseña |
| `/beta` | Información de acceso y datos |

## IA y costes

El chat del lienzo usa Luna; la construcción y el tutor de práctica usan Terra 6.1 por defecto. En esta rama, el tutor documental también sustituye los valores de respaldo antiguos Astra/Sol por Terra, respetando un `OPENAI_MODEL` explícito. Cada servicio tiene sus cuotas: [política de IA](docs/politica-uso-ia.md) y [agente actual](docs/architecture/fontex-agent.md).

Un crédito de Fontex es una unidad interna de construcción, no un crédito monetario del proveedor. Un fallo puede devolver el crédito interno aunque la API ya haya procesado tokens. Los tests ordinarios simulan el proveedor y no consumen tu saldo de OpenAI.

## Comprobaciones

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:e2e:classrooms
npm run audit:modules
```

Para E2E instala Chromium con `npx playwright install --with-deps chromium`. CI comprueba frontend, funciones Deno, SQL/RLS, restauración de un respaldo aislado y los flujos de navegador. Las siete pruebas remotas requieren variables `SUPABASE_TEST_*` y no sustituyen los tests locales. `npm run test:remote` crea y elimina datos de QA en el proyecto elegido; los scripts `test:agent:*` pueden consumir proveedor real. No los ejecutes contra producción como parte de una limpieza ordinaria.

## Publicación y recuperación

GitHub Pages publica `dist/` cuando se actualiza `main`, después de CI y del chequeo de compatibilidad del backend. Configura las variables de repositorio `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` y, si corresponde, `VITE_BASE_PATH`.

Las funciones Edge se despliegan por separado con todos sus imports relativos. El contrato actual es `primitive-agent-v7`; SQL mantiene `closed-beta-v4`. El frontend no se publica si el agente anunciado es incompatible. [Guía de Supabase](supabase/README.md).

El main anterior a la integración 3D se conserva en `backup/main-v0.9.5-2026-11-20`, commit `05c1233`. Una rama respalda código; el respaldo de datos es un proceso distinto. [Scripts y restauración](supabase/README.md#respaldo-y-restauración).

## Documentación

- [Índice vigente e historial](docs/README.md)
- [Arquitectura](docs/architecture/overview.md)
- [Editor y persistencia](docs/architecture/studio.md)
- [Generación de JSON, créditos y límites](docs/architecture/fontex-agent.md)
- [Auditoría y limpieza del 22 de noviembre](docs/AUDITORIA-2026-11-22.md)

Los documentos fechados y `docs/archive/` describen estados históricos. No son instrucciones de despliegue actuales. Las migraciones y los adaptadores de compatibilidad no deben borrarse solo por su antigüedad.
