# Documentación de Fontex

Actualizada el **22 de noviembre de 2026** para la serie 1.0. El editor vigente usa doce primitivas y escenas v2; los antiguos editores Studio, FractionCanvas y GeneralCanvas no son la arquitectura actual.

## Guías vigentes

| Documento | Alcance |
| --- | --- |
| [README principal](../README.md) | Capacidades, instalación, rutas, pruebas y publicación |
| [Arquitectura](architecture/overview.md) | Entradas activas, componentes y fronteras de datos |
| [Editor de primitivas](architecture/studio.md) | Escenas v2, persistencia, interacción, recuperación y PDF |
| [Agente del lienzo](architecture/fontex-agent.md) | Chat/construcción, JSON, límites, modelos y créditos |
| [Supabase](../supabase/README.md) | Funciones, permisos, secretos, pruebas y respaldos |
| [Cuerpos 3D](CUERPOS-3D-V100.md) | Contrato, cámara, cálculos y límites de los sólidos |
| [Auditoría del 22 de noviembre](AUDITORIA-2026-11-22.md) | Limpieza, evidencias, observaciones y trabajo pendiente |
| [Política de IA](politica-uso-ia.md) | Conversación, construcciones y créditos |
| [Aulas y actividades](AULAS-V092.md) | Publicación, adjuntos, participación temporal y SMTP |
| [Práctica en el lienzo](PRACTICA-EN-LIENZO.md) | Respuestas y campos habilitados por el docente |
| [Lienzos y PDF](LIENZOS-Y-PDF.md) | Cierre, guardado, enlaces públicos y descarga |
| [Sistema de diseño](design/DESIGN_SYSTEM.md) | Tokens y componentes visuales |

## Historial

Los reportes fechados, planes y documentos de versiones 0.x conservan lo observado en su fecha. Cuando contradicen el comportamiento actual, prevalecen el código y las guías vigentes. No debe aplicarse una migración, retirar una tabla o desplegar un endpoint siguiendo un reporte antiguo sin revisar su estado actual.

- [Arquitectura anterior a 1.0](archive/overview-pre-v1.md)
- [Studio anterior](archive/studio-pre-v1.md)
- [Agente anterior](archive/fontex-agent-pre-v1.md)
- [Integración anterior de Mathigon](archive/mathigon-modules-pre-v1.md)
- [Guía anterior de Supabase](archive/supabase-pre-v1.md)
- [Reportes](REPORTES.md), auditorías fechadas y [beta cerrada](beta-cerrada.md)
- Contratos históricos: [v0.7](primitivas-v0.7.md), [v0.7.1](primitivas-v0.7.1.md), [v0.8](primitivas-v0.8.md)

## Mantenimiento

Comprueba rutas en `src/app/App.tsx`, formato en `src/core/primitives/schema.ts`, versiones en `package.json`, funciones en `supabase/functions` y reglas de publicación en `.github/workflows`. `npm run audit:modules` genera un inventario de módulos sin consumidores activos; no borra nada automáticamente ni sustituye la revisión de compatibilidad.

Una rama de Git no es un respaldo de datos. Una compilación correcta no acredita despliegue de funciones, aplicación de migraciones, entrega de correos ni una respuesta real del proveedor de IA. Registra qué comprobaciones se ejecutaron y cuáles requieren un entorno específico.
