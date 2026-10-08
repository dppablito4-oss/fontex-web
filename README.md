# Fontex

**Fuentes puestas en contexto.**

Fontex es un entorno académico que prepara una experiencia de consulta documental con trazabilidad. El nombre reúne **FONT**es (latín: fuentes o manantial de información) y **TEX**tus (texto o contexto): ninguna respuesta debería presentarse aislada de las fuentes autorizadas que la sostienen.

Este repositorio contiene el **Bloque 0** del plan maestro: un frontend responsive con datos ficticios, navegación compatible con hosting estático y una prueba local de `assistant-ui`. Todavía no conecta autenticación, documentos privados, Supabase ni una API de IA real.

## Ejecutar localmente

Requisitos: Node.js 22 y npm 10 o versiones compatibles.

```bash
npm install
npm run dev
```

La aplicación se abre normalmente en `http://localhost:5173`. Las rutas usan hash (`#/tutor`, `#/biblioteca`) para funcionar al recargar desde GitHub Pages.

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
- `assistant-ui` con `LocalRuntime` y adaptador simulado en el navegador.
- Base de carpetas para futuras migraciones y Edge Functions de Supabase.
- CI y despliegue estático a GitHub Pages.
- Sin secretos, servicios externos ni datos reales.

Consulta [los reportes versionados](docs/REPORTES.md), [la arquitectura](docs/architecture/overview.md) y [el registro de dependencias](docs/decisions/DEPENDENCIES.md) para conocer el historial y las decisiones del prototipo.

## Estado

Prototipo académico en desarrollo. Todo el contenido visible en esta fase es demostrativo.
