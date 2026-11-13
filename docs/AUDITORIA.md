# Auditoría de código y correcciones

**Fecha:** 11 de noviembre de 2026.

**Base:** `main` en `3a26911`, más las correcciones locales descritas aquí. `package.json` mantiene la versión `0.6.0`.

**Estado:** los **10 hallazgos de la auditoría están corregidos y verificados localmente**. El frontend, la función del tutor y la migración nueva todavía deben publicarse para que las correcciones lleguen al servicio remoto.

La revisión inicial encontró dos defectos P1 y ocho P2, 13 alertas de dependencias y dos migraciones sin aplicar en la base local. El historial de esa revisión permanece en [REPORTES.md](REPORTES.md). Este documento describe el estado posterior a la corrección.

**Incremento posterior:** se revisó `main`/`origin/main` en `1d627cc`, limpio y sincronizado, antes de crear `feat/fontex-agent`. El [registro de Fontex Agent](architecture/fontex-agent.md) documenta acciones atómicas, backend y familias nuevas, implementadas en tres fases verificadas. La suite actual suma 199 pruebas frontend aprobadas (7 remotas omitidas), 20 Deno y 138 SQL locales; lint, typecheck, build y check de siete funciones correctos. Se conservan las diez correcciones de esta auditoría. Agent no introduce dependencias npm, migraciones ni permisos nuevos. Por solicitud posterior del usuario se integró en `main`, preservando la base en `backup/main-before-fontex-agent-20261111`, para publicar el frontend. El endpoint nuevo sigue pendiente de despliegue separado; conexión real con proveedor/Auth/runtime, revisión visual y E2E no se acreditan con estas pruebas.

## Correcciones y evidencia

| ID | Prioridad original | Corrección | Evidencia |
|---|---|---|---|
| A-01 | P1 | Todos los caminos posteriores a una reserva completan su evento; la liquidación es idempotente y se reintenta una vez | Regresiones Deno de HTTP 429/500, respuesta vacía, creación, recuperación y persistencia fallidas; pgTAP de liquidación repetida |
| A-02 | P1 | PostgreSQL asigna índices únicos y crecientes por conversación, con bloqueo breve y guardado transaccional de cada par | pgTAP reabre siete intercambios y compara el orden completo |
| A-03 | P2 | Se revocan privilegios heredados de las cinco tablas del tutor y se conceden solo los usados | pgTAP comprueba ausencia de privilegios de anon/PUBLIC y de TRUNCATE del cliente; advisors sin incidencias |
| A-04 | P2 | Mensajes y citas se escriben exclusivamente desde el servidor; la RPC deriva metadatos y valida acceso al chunk | pgTAP rechaza mensajes/citas fabricados y referencias a documentos privados ajenos |
| A-05 | P2 | Se presupuesta el contexto completo: instrucciones, pregunta, fuentes e historial | Vitest con texto multibyte/contexto extenso; Deno comprueba rechazo antes de generar y liberación de cuota |
| A-06 | P2 | Se cancelan e ignoran solicitudes obsoletas al cambiar de conversación/aula, eliminar la activa o desmontar el hook | Vitest con respuestas diferidas, cambio de aula, conversación creada por servidor y selección de la vista activa |
| A-07 | P2 | La respuesta estricta exige JSON válido y citas del contexto efectivamente enviado; en otro caso se abstiene | Parser y handler probados con texto libre, lista vacía e IDs inventados |
| A-08 | P2 | Studio guarda una instantánea atómica por propietario y solo cambia de material tras persistirlo | Pruebas de migración v1/v2, cuota agotada, limpieza fallida y recuperación de datos corruptos |
| A-09 | P2 | Los exponentes numéricos conservan todos sus dígitos y signo; la sintaxis no admitida permanece literal | Vitest para 0, 1, 4, 10, exponentes entre llaves y negativos |
| A-10 | P2 | Se actualizan resoluciones vulnerables y se incorpora el lockfile de práctica | `npm ci` correcto, `npm audit` sin alertas y seis lockfiles Deno |

## Tutor: cuotas, historial y trazabilidad

El endpoint se divide en [index.ts](../supabase/functions/tutor-chat/index.ts), que conserva la autenticación de usuario, [handler.ts](../supabase/functions/tutor-chat/handler.ts), que coordina la consulta, y [protocol.ts](../supabase/functions/tutor-chat/protocol.ts), que valida contratos y prepara el contexto.

Una reserva obtenida pasa siempre por su finalización después de procesar éxito o fallo. La confirmación se reintenta una vez; si ambos intentos fallan, la función devuelve `QUOTA_COMPLETION_FAILED` en lugar de comunicar éxito. Una caída persistente de la base puede impedir confirmar la liberación; la ventana de concurrencia sigue siendo la definida por el esquema.

La migración [20261113000212_harden_tutor_exchange_persistence.sql](../supabase/migrations/20261113000212_harden_tutor_exchange_persistence.sql):

- Revoca privilegios sobrantes y elimina las políticas de escritura de mensajes/citas desde el navegador.
- Mantiene creación, actualización y eliminación de conversaciones propias y lectura del historial bajo RLS.
- Reordena índices heredados por fecha de creación y agrega unicidad por conversación/posición.
- Crea `internal_store_tutor_exchange`, ejecutable solo por `service_role`: valida identidad/aula, bloquea la conversación, escribe ambos mensajes y las citas en una transacción, y deriva títulos/páginas/versiones de las tablas autorizadas.
- Serializa la reserva del presupuesto global mediante la fila de configuración, además del bloqueo por usuario.
- Hace idempotente la confirmación repetida del mismo resultado y optimiza la evaluación de identidad en las políticas restantes.

Un fallo al guardar una cita no deja preguntas o respuestas parciales. Los errores de persistencia se devuelven al cliente. La apertura de referencias continúa descargando el PDF con los permisos actuales del usuario.

El modo estricto se abstiene si no hay fuentes, si la respuesta incumple el contrato o si carece de citas válidas. Los IDs se validan contra los fragmentos enviados, no contra una lista más amplia recuperada antes de recortar el contexto. Esta validación acredita procedencia y permisos; no evalúa automáticamente la verdad de cada afirmación.

El presupuesto de entrada usa bytes UTF-8 más margen por mensajes e instrucciones como estimación conservadora. Selecciona fuentes completas y después historial reciente, manteniendo la pregunta actual. No es un tokenizer específico del modelo y puede enviar menos contexto del que cabría en el límite nominal. Si las instrucciones y pregunta no caben, rechaza la petición y liquida la reserva como fallida.

GET y POST de salud rechazan el servicio cuando falla consultar los límites. La salud verifica configuración, no disponibilidad real del proveedor. El panel de Biblioteca ahora se identifica como diagnóstico de recuperación.

## Studio y notación matemática

[document-store.ts](../src/features/studio/document-store.ts) reemplaza una instantánea en `fontex-studio-v2:<propietario>`. Un único `setItem` cambia documentos y material activo juntos. Las claves anteriores se leen sin alterarlas y solo se limpian después de confirmar v2; un fallo de limpieza no invalida la instantánea ya escrita.

[useStudioDocument.ts](../src/features/studio/useStudioDocument.ts) conserva el documento abierto si no puede persistir el siguiente. El formato exportado de los materiales sigue siendo versión 1. La migración no añade sincronización remota ni coordinación de ediciones entre pestañas. JSON continúa siendo la copia portátil disponible.

[AcademicMarkdown.tsx](../src/features/tutor/components/AcademicMarkdown.tsx) convierte exponentes numéricos completos y conserva expresiones no admitidas. Sigue siendo un renderizador limitado de Markdown y sustituciones matemáticas.

## Dependencias

El lockfile de npm fija `vitest@4.1.12`; los overrides fijan `zod@4.6.7` y `minimatch@11.0.1`. El cambio de minimatch a la rama 11 se verificó mediante sus exportaciones y los checks del proyecto. Debe revisarse cuando ESLint/typescript-eslint actualicen sus rangos para retirar el override si deja de ser necesario.

`practice-tutor/deno.lock` queda incluido junto con los de las otras cinco funciones. Los mapas de importación siguen fijando las dependencias de Supabase. [DEPENDENCIES.md](decisions/DEPENDENCIES.md) conserva el detalle de uso y licencias.

La auditoría de npm pasó de 13 alertas a **0 vulnerabilidades conocidas**. Es un resultado en esta fecha y no una garantía de ausencia de fallos futuros.

## Validación local

Entorno: Windows/PowerShell, Node.js `22.14.0`, npm `10.9.2`, Deno `2.9.7`, Supabase CLI `2.120.0` y PostgreSQL local existente.

| Comprobación | Resultado posterior a la corrección |
|---|---|
| `npm ci` | Correcto con el lockfile actualizado |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test` | 136 pruebas aprobadas y 7 omitidas; 27 archivos aprobados y 4 omitidos |
| `npm run build` | Correcto |
| `deno check` | Seis Edge Functions comprobadas |
| `deno test --allow-env --config supabase/functions/tutor-chat/deno.json supabase/functions/tutor-chat/handler_test.ts` | 13 pruebas aprobadas con proveedor/API de datos simulados |
| `deno lint supabase/functions` | Correcto, 13 archivos |
| `supabase test db --local` | 138 pruebas aprobadas en 5 archivos |
| `supabase db lint --local --schema public,private --fail-on warning` | Sin errores |
| `supabase db advisors --local --type all --level warn` | Sin incidencias |
| `supabase migration list --local` | Diez migraciones alineadas con el esquema local |
| `npm audit --json` y `npm audit --omit=dev --json` | 0 vulnerabilidades |

Las pruebas SQL se revierten al terminar. Las migraciones de corrección sí quedaron aplicadas permanentemente al entorno local, conservando sus datos y sin reiniciar el stack. No se realizaron llamadas pagadas de IA ni cambios en producción.

## Publicación y verificaciones pendientes

Para llevar esta corrección al servicio alojado, revisar el destino y el plan de migraciones, aplicar primero el esquema, desplegar después `tutor-chat` y publicar el frontend. La [guía de Supabase](../supabase/README.md) contiene los comandos y el [README](../README.md) explica Pages.

Las siete pruebas omitidas requieren configuración de integración remota. No se ejecutaron E2E, una revisión visual en navegador, lector de pantalla ni pruebas de carga. Tampoco se verificaron secretos, Auth o el esquema del proyecto remoto. Estas comprobaciones de despliegue quedan pendientes; los diez defectos descritos están cubiertos por las correcciones y verificaciones locales anteriores.
