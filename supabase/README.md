# Supabase de Fontex

**Revisión:** 11 de noviembre de 2026 · CLI del repositorio: `2.120.0`.

Este backend cubre identidad, aulas/grupos, PDF privados, indexación RAG, tutor documental y cuotas del tutor de práctica. Los materiales de Studio y los PDF del aula de práctica siguen siendo locales al navegador.

## Modelo versionado

| Área | Tablas o recursos |
|---|---|
| Identidad | `profiles`, `organizations` |
| Aulas | `classrooms`, `class_members`, `classroom_invitations` |
| Grupos | `study_groups`, `group_members` |
| Biblioteca | `documents`, `document_shares`, `document_limits`, bucket privado `fontex-documents` |
| RAG | `rag_limits`, `document_processing_jobs`, `document_chunks`, `rag_search_events` |
| Tutor documental | `tutor_limits`, `tutor_conversations`, `tutor_messages`, `tutor_message_citations`, `tutor_usage_events` |
| Tutor de práctica | `practice_tutor_quota` |
| Administración interna | Esquema `private`, incluidas autorizaciones de creación de workspace |

Las tablas públicas creadas por estas migraciones habilitan RLS. La lectura del tutor se limita al propietario; las funciones internas de recuperación vuelven a aplicar acceso documental. La migración `20261111223857_harden_tutor_exchange_persistence.sql` elimina privilegios heredados y reserva la escritura de mensajes/citas al servidor, con guardado transaccional mediante `internal_store_tutor_exchange`. El navegador conserva la gestión de conversaciones y la lectura de su propio historial.

## Edge Functions

| Función | Responsabilidad |
|---|---|
| `document-upload` | Verificar reserva, propietario, firma PDF, tamaño y SHA-256; escribir el objeto |
| `document-delete` | Verificar propietario y eliminar objeto/metadatos |
| `document-process` | Descargar, extraer texto, fragmentar y generar embeddings por lotes |
| `document-search` | Recuperación híbrida autorizada para diagnóstico |
| `tutor-chat` | Tutor documental, modos estricto/comparativo, conversaciones, citas y cuotas |
| `practice-tutor` | Chat/estudio/web del aula de Matemática con cuota por cuenta |

Todos los endpoints se diseñan para usuario autenticado. `withSupabase({ auth: 'user' })` valida al llamante. El cliente administrativo solo debe usarse después de validar identidad y alcance; sus consultas no quedan protegidas por RLS del usuario.

## Preparar el entorno local

Requisitos: Node.js 22, npm 10 y Docker operativo. Instala con `npm ci` y utiliza `npx supabase` para ejecutar la versión fijada por el repositorio. La CLI v3 cambia comportamientos; esta guía describe v2.120.0.

Para arrancar Auth, API, Storage y PostgreSQL locales:

```powershell
npx supabase start
```

Copia `.env.example` a `.env.local` y sustituye URL y clave por las públicas del stack local. La URL de la plantilla apunta al piloto remoto; arrancar contenedores no cambia automáticamente el destino del frontend.

Para ejecutar solo las pruebas SQL se puede iniciar PostgreSQL aislado:

```powershell
npx supabase db start
npx supabase test db --local
npx supabase db lint --local --schema public,private --fail-on warning
```

Si el stack existente está atrasado, revisa las migraciones y aplica las pendientes al entorno **local** antes de repetir pruebas:

```powershell
npx supabase migration up --local
```

La revisión inicial encontró pendientes `20261010010000_tutor_conversations_user_id_default.sql` y `20261106175025_practice_tutor_quota.sql`. Durante las correcciones se aplicaron ambas y la migración de endurecimiento al entorno local, conservando los datos y sin reiniciar el stack. El historial local quedó alineado con los diez archivos de migración. Esto no acredita el estado del proyecto remoto.

`supabase test db` ejecuta las suites transaccionales con reversión. No uses `db reset` para resolver un desfase sin considerar los datos existentes. Para detener un stack que hayas iniciado, `npx supabase stop` conserva una copia; `--no-backup` elimina volúmenes y solo corresponde a entornos desechables como CI.

## Variables y secretos

| Variable | Dónde se usa | Observaciones |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Pública, compilada por Vite |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Pública; requiere RLS y privilegios mínimos |
| `OPENAI_API_KEY` | Edge Functions o plugin local | Privada; sin prefijo `VITE_` |
| `OPENAI_MODEL` | `tutor-chat` | Sobrescribe el modelo de `tutor_limits` |
| `EMBEDDING_MODEL` | Funciones RAG | Respaldo `text-embedding-3-small`; debe coincidir con el índice |
| `EMBEDDING_DIMENSIONS` | Funciones RAG | Respaldo `1536`; el esquema usa `vector(1536)` |

Los clientes administrativos de las funciones reciben su configuración desde el runtime del servidor. No copies `service_role`, `sb_secret_*`, tokens ni contraseñas a variables `VITE_*` o archivos versionados.

Para servir las funciones localmente con un archivo de secretos ignorado por Git:

```powershell
npx supabase functions serve --env-file .env.local
```

El archivo debe contener las variables privadas requeridas por las funciones que vayas a probar. El runtime local proporciona sus propias variables de Supabase. El endpoint de Vite `/api/fontex-tutor` no sustituye `tutor-chat` ni la infraestructura documental.

## Revisión y despliegue remoto

El proyecto piloto referenciado en la configuración del frontend es `goegjuglstapjwcckawp`. Una referencia en el repositorio no demuestra que el esquema remoto esté actualizado. Revisa el proyecto destino y las migraciones antes de escribir:

```powershell
npx supabase db push --linked --dry-run --skip-vault
```

Después de revisar el plan, la aplicación de migraciones al proyecto vinculado es:

```powershell
npx supabase db push --linked --skip-vault
```

Configura `OPENAI_API_KEY` en los secretos del proyecto. Mantén modelo y dimensiones de embeddings compatibles con los documentos indexados. El despliegue de funciones, para el proyecto destino seleccionado, se realiza por separado de Pages.

Para esta corrección, aplica las migraciones revisadas **antes** de desplegar `tutor-chat`: su nueva escritura depende de `internal_store_tutor_exchange`. Despliega después las funciones y el frontend. Ningún cambio de esta intervención se ha aplicado a producción.

```powershell
npx supabase functions deploy document-upload document-delete document-process document-search tutor-chat practice-tutor --project-ref TU_PROJECT_REF --use-api
```

Conserva la verificación de JWT del usuario. Configura Auth con el dominio publicado y los retornos locales; `config.toml` no demuestra que los mismos valores estén aplicados en el servicio alojado.

## Límites y salud

- Biblioteca: 5 MiB y 100 páginas por PDF; texto seleccionable, sin OCR.
- RAG: modelo/dimensión compatibles y trabajo completo antes de buscar.
- Tutor documental: defaults SQL de 30 consultas/hora, 150/24 h por usuario, 2.000/24 h globales, una consulta concurrente, 5 chunks y 1.500 tokens máximos de salida. La entrada se acota a su presupuesto de 8.000 mediante bytes UTF-8 y margen de formato: una estimación conservadora, no un tokenizer del modelo. Si no caben pregunta e instrucciones, la consulta se rechaza.
- Tutor de práctica: 10 consultas por hora UTC y 25 por día UTC; reserva antes de llamar al proveedor y sin devolución automática si falla.
- `health` indica configuración del servidor; no consulta al proveedor ni acredita disponibilidad real del modelo. GET y POST rechazan el servicio si falla la lectura de límites o está pausado.

La reserva del tutor documental se completa tanto en éxito como en error; su confirmación es idempotente y se reintenta una vez. Si ambos intentos fallan, la función devuelve error explícito. Las reservas comparten bloqueo sobre la configuración global para evitar exceder el cupo mediante llamadas concurrentes de distintas cuentas. PostgreSQL guarda cada intercambio completo en una sola transacción, ordena los mensajes por conversación y deriva documento/páginas de las citas a partir de los chunks autorizados.

Son valores iniciales del código/esquema. No representan cuotas comerciales del proveedor, costes garantizados ni los valores efectivos del proyecto remoto.

## Verificación

Las pruebas de `tests/database` cubren RLS, cuotas, reservas, compartición y revocación. Tras las correcciones, las **138 pruebas SQL** pasan en la base local actualizada; advisors y lint no reportan incidencias. La suite incluye historial de siete intercambios, finalización idempotente, rechazo de escrituras del cliente y referencias privadas, y ausencia de mensajes parciales ante fallo de citas.

Las **13 pruebas Deno** del handler usan un proveedor y API de base simulados; verifican errores del proveedor, guardado fallido, liquidación de cuota, abstención, presupuesto y salud. No consumen la API de IA:

```powershell
deno test --allow-env --config supabase/functions/tutor-chat/deno.json supabase/functions/tutor-chat/handler_test.ts
```

Las suites `src/test/block*.remote.test.ts` requieren `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY` y `SUPABASE_TEST_SERVICE_ROLE_KEY` en el proceso. Crean identidades y recursos de prueba; ejecútalas en un proyecto destinado a integración. No se ejecutaron en esta auditoría.

Los resultados de Deno, frontend, dependencias y defectos conocidos se centralizan en [AUDITORIA.md](../docs/AUDITORIA.md).
