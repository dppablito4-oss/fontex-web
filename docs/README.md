# Documentación de Fontex

Actualizada el **11 de noviembre de 2026**: Fontex Agent integrado en `main`; base anterior `1d627cc` conservada en `backup/main-before-fontex-agent-20261111`. Pages publica el frontend desde `main`; el endpoint del agente sigue pendiente de despliegue separado.

| Documento | Qué resuelve |
|---|---|
| [README principal](../README.md) | Instalación, capacidades, rutas y despliegue del frontend |
| [Arquitectura](architecture/overview.md) | Componentes, flujos y separación entre datos locales y remotos |
| [Fontex Studio](architecture/studio.md) | Objetos matemáticos, JSON versión 1, guardado y límites del editor |
| [Fontex Agent](architecture/fontex-agent.md) | Tres fases, acciones, backend, pedagogía, pruebas y límites reales |
| [Supabase](../supabase/README.md) | Migraciones, tablas, funciones, secretos y pruebas de backend |
| [Sistema de diseño](design/DESIGN_SYSTEM.md) | Tokens, temas y estilos propios de Studio |
| [Dependencias](decisions/DEPENDENCIES.md) | Uso de paquetes, herramientas y estado de auditoría |
| [Auditoría actual](AUDITORIA.md) | Estado de las diez correcciones, pruebas y requisitos de despliegue |
| [Reportes](REPORTES.md) | Historial de intervenciones; sus resultados corresponden a cada fecha |

La implementación actual convive con tres experiencias: Studio, el aula de práctica de Matemática y el espacio académico con biblioteca/tutor documental. Sus almacenes y endpoints son distintos. La arquitectura y el README describen el presente; los reportes conservan el contexto histórico.

Para mantener esta documentación, comprueba primero `src/app/App.tsx`, `package.json`, las migraciones y los workflows. Registra resultados ejecutados y distingue pruebas omitidas, revisión estática y comprobaciones remotas. Una compilación correcta no demuestra que una migración esté aplicada en un proyecto desplegado.
