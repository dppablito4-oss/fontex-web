# Documentación de Fontex

Actualizada el **14 de noviembre de 2026**: el editor principal utiliza nueve primitivas componibles, variables compartidas y escenas v2. La biblioteca académica y el aula de práctica mantienen sus flujos propios.

| Documento | Qué resuelve |
|---|---|
| [README principal](../README.md) | Instalación, capacidades, rutas y despliegue del frontend |
| [Primitivas v0.7](primitivas-v0.7.md) | Contrato, editor, IA, guardado, alcance y límites del lienzo actual |
| [Laboratorio anterior](general-canvas-prototype.md) | Expresiones, escenas privadas, sincronización, formato y límites actuales |
| [Corrección del 13 de noviembre](AUDITORIA-2026-11-13.md) | Regresiones de sincronización y matemáticas, dependencias y retiro de datos de prueba |
| [Arquitectura](architecture/overview.md) | Componentes, flujos y separación entre datos locales y remotos |
| [Fontex Studio](architecture/studio.md) | Objetos matemáticos, JSON versión 1, guardado y límites del editor |
| [Fontex Agent](architecture/fontex-agent.md) | Tres fases, acciones, backend, pedagogía, pruebas y límites reales |
| [Supabase](../supabase/README.md) | Migraciones, tablas, funciones, secretos y pruebas de backend |
| [Sistema de diseño](design/DESIGN_SYSTEM.md) | Tokens, temas y estilos propios de Studio |
| [Dependencias](decisions/DEPENDENCIES.md) | Uso de paquetes, herramientas y estado de auditoría |
| [Preparación de primitivas v0.7](plans/v0.7-primitivas-integracion.md) | Revisión de la propuesta, compatibilidad con el lienzo actual y orden de integración |
| [Auditoría actual](AUDITORIA.md) | Estado de las diez correcciones, pruebas y requisitos de despliegue |
| [Reportes](REPORTES.md) | Historial de intervenciones; sus resultados corresponden a cada fecha |

La implementación actual incluye el lienzo libre con IA lateral, el laboratorio de expresiones, el aula de práctica y el espacio académico con biblioteca/tutor documental. Los reportes distinguen el retiro de datos de la conservación de las herramientas de Studio.

Para mantener esta documentación, comprueba primero `src/app/App.tsx`, `package.json`, las migraciones y los workflows. Registra resultados ejecutados y distingue pruebas omitidas, revisión estática y comprobaciones remotas. Una compilación correcta no demuestra que una migración esté aplicada en un proyecto desplegado.
