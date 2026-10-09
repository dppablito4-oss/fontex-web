# Fontex

**Fuentes puestas en contexto.**

Fontex es un entorno académico que prepara una experiencia de consulta documental con trazabilidad. El nombre reúne **FONT**es (latín: fuentes o manantial de información) y **TEX**tus (texto o contexto): ninguna respuesta debería presentarse aislada de las fuentes autorizadas que la sostienen.

Este repositorio contiene los **Bloques 0 y 1** del plan maestro, más la conexión anticipada del tutor en `v0.3.0`: frontend responsive, navegación estática, identidad con Supabase Auth, modelo protegido por RLS y una Edge Function autenticada que consulta OpenAI. Biblioteca, documentos, Storage y RAG permanecen fuera de alcance.

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

El repositorio está vinculado al proyecto `goegjuglstapjwcckawp` (`fintex.back`). La migración del Bloque 1 se aplica con revisión previa:

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

El tutor real se ejecuta exclusivamente en `tutor-chat`. Requiere `OPENAI_API_KEY` en los secretos del proyecto y se despliega con JWT obligatorio:

```bash
npx supabase functions deploy tutor-chat --project-ref goegjuglstapjwcckawp --use-api
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
- Pruebas pgTAP y de integración remota con múltiples identidades ficticias.
- CI y despliegue estático a GitHub Pages.
- OpenAI Responses API desde una Edge Function autenticada; la clave privada permanece en Supabase.
- Sin RAG todavía: el tutor declara `0 fuentes` y tiene prohibido inventar citas o acceso documental.

Consulta [los reportes versionados](docs/REPORTES.md), [la arquitectura](docs/architecture/overview.md), [el sistema de diseño](docs/design/DESIGN_SYSTEM.md) y [el registro de dependencias](docs/decisions/DEPENDENCIES.md) para conocer el historial y las decisiones del prototipo.

## Estado

Prototipo académico en desarrollo. Identidad, aulas, grupos y tutor de orientación general operan con servicios reales en producción. Biblioteca, documentos, recuperación vectorial y citas trazables continúan pendientes.
