# Auditoría y limpieza de Fontex 1.0

Fecha: 22 de noviembre de 2026. Base: main `2317aaf2c3a65055ed2a758546ffad34c63851b8`. Trabajo en `chore/audit-cleanup-v1.0`; sin publicar sobre main ni modificar producción.

## Alcance y método

Se inventariaron los 452 archivos versionados de la base y se trazaron imports de TypeScript/JavaScript desde la entrada del navegador, los índices de Edge Functions y las herramientas de Vite/scripts. Se revisaron manualmente rutas, persistencia, generación/recuperación, configuración del proveedor, límites, tutores, publicación de aulas, validación de expresiones y documentación.

El análisis incluye imports de tipos y dinámicos con ruta literal. Un resultado «sin uso» es un candidato revisado, no una orden de borrado automática. No demuestra ausencia de errores en todas las ramas posibles ni sustituye pruebas con usuarios y servicios reales.

Se consultaron los avisos de Supabase en modo lectura y las vulnerabilidades conocidas de dependencias de producción. No se enviaron correos ni peticiones pagadas a OpenAI.

## Corregido en esta rama

| Hallazgo | Acción y evidencia |
| --- | --- |
| Dos editores desconectados de las rutas | Retirados `src/features/canvas` y `src/features/general-canvas`, sus estilos y pruebas de módulos retirados. `App.tsx` ya dirigía sus enlaces al editor de primitivas |
| Motor y documento v1 sostenidos solo por pruebas | Retirados el parser de documento v1 y sus auxiliares matemáticos sin consumidores. Se conservan el parser de expresiones, la normalización de potencias y los discriminadores usados por el editor vigente |
| Chat assistant-ui anterior al tutor actual | Retirados `ChatThread`, `FontexRuntimeProvider`, `tutorRuntime`, sus pruebas, CSS `.aui-*` y la dependencia `@assistant-ui/react` |
| Componente `FileRow` sin consumidores | Retirado; las listas activas usan sus propios componentes |
| Documentación que presentaba Studio 0.6/v1 como actual | Actualizados README raíz, Supabase, índice y arquitectura. Los textos anteriores se conservan en `docs/archive` |
| Respaldo de modelo documental aún en Astra | `tutor-chat` traduce los defaults antiguos Astra/Sol a Terra. Un `OPENAI_MODEL` explícito conserva prioridad y un modelo personalizado almacenado se respeta. La salud y la solicitud al proveedor usan la misma resolución |

En total: **34 archivos retirados** y **85 paquetes transitivos eliminados del lockfile**, sin cambiar las versiones de los paquetes que permanecen. Se eliminan 35 casos de prueba asociados a componentes ya retirados; no se presenta esta reducción como cobertura nueva del producto.

La dependencia assistant-ui y los editores antiguos ya estaban fuera del grafo del navegador. El beneficio principal es reducir instalación, mantenimiento y ambigüedad del código; no se atribuye una mejora de rendimiento del lienzo sin medirla.

## Conservado por compatibilidad o uso real

- Las doce primitivas, las 40 plantillas, el catálogo Aprender y sus PDF: tienen consumidores activos.
- `/laboratorio`, `/fracciones` y `/lienzo-clasico`: enlaces compatibles al editor actual, con nueva prueba E2E.
- `scene-agent`: respuesta de retirada 410, con autenticación y pruebas; no genera IA. Borrarlo como si fuera un motor activo eliminaría una protección de clientes antiguos.
- Migraciones, pruebas SQL, avisos de licencia y formatos discriminadores: no se retiran por antigüedad.
- Datos locales y remotos: no se ejecutó limpieza de localStorage, tablas, usuarios, Storage o archivos personales.

El inventario reproducible `npm run audit:modules` queda sin candidatos pendientes de módulos completos desconectados. No busca todos los exports individuales no utilizados ni sustituye revisar usos externos de una API.

## Observaciones de Supabase

El proyecto incluye recursos compartidos de otras aplicaciones; sus avisos no se tratan automáticamente como problemas de Fontex.

| Observación del analizador | Interpretación y acción |
| --- | --- |
| Protección de contraseñas filtradas desactivada | Ajuste real pendiente de revisar en Auth. No se cambió desde esta limpieza. [Documentación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) |
| 8 exposiciones anon y 26 authenticated de funciones SECURITY DEFINER | Son observaciones de privilegios, no 34 vulnerabilidades demostradas. Incluyen enlaces públicos, invitaciones y RPC de aula que necesitan validar token/propietario/rol. Se revisaron los flujos principales y se conservan sus pruebas; no se revocan permisos a ciegas. [Analizador](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) |
| 18 tablas con RLS y sin políticas | El acceso puede estar denegado deliberadamente, especialmente en archivos o esquemas privados. No se añaden políticas permisivas para silenciar el aviso |
| 19 claves foráneas sin índice, 9 índices sin uso y un archivo sin PK | Incluyen recursos de otras aplicaciones y datos archivados. Requieren filtrar por esquema y medir consultas antes de añadir/eliminar índices. No justifican borrar datos. [Rendimiento](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) |

Las fuentes de las RPC críticas revisadas comprueban sesión/propietario, rol de aula o token. Por ejemplo, `claim_document_processing` exige usuario autenticado y documento propio listo; `class_smtp_password` está restringida a `service_role`. Esta revisión no certifica todos los usos externos del proyecto compartido.

## Qué falta o requiere una decisión posterior

1. **Entrega a producción:** esta rama requiere revisión/fusión. El cambio del tutor documental necesita desplegar `tutor-chat`; Pages no despliega funciones por sí solo.
2. **Límites de material e IA:** un JSON válido de 1 MiB no cabe necesariamente en el contexto de IA de 48000 bytes ni en el origen de recibos de 64 KiB. Hoy se rechaza el exceso; conviene mejorar el trabajo por selección/secciones antes de ampliar presupuestos o costes.
3. **Documentos v1:** se preservan datos, pero no existe un convertidor general al formato actual. Solo sería necesario si se decide recuperar trabajos antiguos de ese formato.
4. **Offline completo:** la edición cargada calcula localmente, pero no hay PWA/service worker para abrir toda la aplicación desde cero sin red.
5. **Comprobaciones de servicio:** SMTP, Auth y generación real con proveedor se deben probar en un entorno de QA con autorización y presupuesto. No se consumió saldo para certificar esos servicios durante esta limpieza.

No se incluye calificación automática universal, física 3D ni superficies arbitrarias; no son fallos de limpieza ni capacidades que el motor actual prometa.

## Verificación ejecutada

- TypeScript, ESLint y compilación de producción correctos.
- Suite de aplicación: **482 pruebas aprobadas y 7 remotas omitidas**.
- Tutor documental: **14 pruebas Deno aprobadas**, incluyendo modelo del payload real simulado, salud y configuración explícita.
- Agente del lienzo: **29 pruebas Deno aprobadas** y lint de funciones correcto.
- Compatibilidad de rutas antiguas: **3 pruebas E2E aprobadas** en escritorio claro, oscuro y móvil.
- `npm audit --omit=dev`: **0 vulnerabilidades conocidas** en dependencias de producción al consultar el registro.
- Inventario de módulos: ningún candidato restante desconectado de las entradas incluidas.

CI del PR añade las comprobaciones de funciones restantes, el navegador completo, las aulas y SQL/RLS/restauración aislada. Estos resultados no equivalen a una auditoría de seguridad externa ni a pruebas pagadas contra el proveedor.
