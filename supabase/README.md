# Supabase de Fontex

Guía vigente: 22 de noviembre de 2026, Fontex 1.0. La [guía anterior](../docs/archive/supabase-pre-v1.md) es histórica. El proyecto puede compartir infraestructura con otras aplicaciones: no se deben borrar esquemas ajenos ni migraciones aplicadas durante una limpieza de código.

## Datos y permisos

| Área | Recursos |
| --- | --- |
| Identidad y aulas | `profiles`, organizaciones, aulas, membresías, grupos e invitaciones |
| Lienzos | `visual_scenes`, revisiones, sincronización privada y enlaces de lectura pública |
| Biblioteca | PDF en `fontex-documents`, permisos, metadatos y compartidos |
| RAG | Trabajos de procesamiento, fragmentos, búsqueda autorizada y límites |
| Tutor documental | Conversaciones, mensajes, citas y reservas de uso |
| Participación temporal | Tokens de invitación, invitados, vinculación y créditos |
| Clases | Actividades, adjuntos, entregas, revisión y cola de avisos |
| Control interno | Esquemas privados de créditos, beta y autorización |

Los clientes usan la sesión y la clave pública. Las tablas expuestas usan RLS; las RPC privilegiadas comprueban propietario, membresía, rol, token o permisos de servidor según su función. Las funciones `SECURITY DEFINER` son puntos de API que requieren revisión individual: no se deben revocar sus permisos indiscriminadamente, porque algunos flujos públicos por token dependen de ellas.

## Funciones Edge

| Función | Uso | Acceso |
| --- | --- | --- |
| `studio-agent` | Chat y construcción validada del lienzo | Cuenta verificada y controles de uso |
| `classroom-agent` | Mismo motor para un participante temporal | Token de invitado validado por el handler |
| `classroom-api` | Publicación, entrega y avisos de clase | JWT o token, con autorización por operación |
| `tutor-chat` | Tutor documental con RAG y citas | Cuenta, aula y fuentes autorizadas |
| `practice-tutor` | Tutor del catálogo Aprender | Cuenta y cuota |
| `document-upload` | Carga reservada, firma PDF y metadatos | Cuenta y propietario |
| `document-delete` | Borrado del documento permitido | Cuenta y propietario |
| `document-process` | Extracción, fragmentos y embeddings | Cuenta, propietario y reserva |
| `document-search` | Búsqueda híbrida de diagnóstico | Cuenta y permisos documentales |
| `scene-agent` | Respuesta de retirada para clientes v1 | 410 autenticado; nunca genera IA |

`classroom-api` y `classroom-agent` tienen `verify_jwt=false` porque admiten invitados sin una sesión de Supabase; sus handlers validan la identidad y el token. No es un permiso para ejecutar operaciones arbitrarias sin autorización.

## Configuración

| Variable o recurso | Alcance |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Cliente, valores públicos |
| `OPENAI_API_KEY` | Secreto de funciones; opcional en Vite solo para desarrollo del tutor de práctica |
| `FONTEX_AGENT_MODEL` | Construcción; Terra 6.1 por defecto y sustitución del valor anterior Sol |
| `FONTEX_CHAT_MODEL` | Conversación del lienzo; Luna por defecto |
| `OPENAI_MODEL` | Override explícito de `tutor-chat` |
| `tutor_limits.default_model` | Modelo documental; esta rama traduce defaults antiguos Astra/Sol a Terra |
| `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` | Por defecto `text-embedding-3-small`, 1536; deben coincidir con el índice |
| `FONTEX_SMTP_USER`, `FONTEX_SMTP_HOST`, `FONTEX_SMTP_PASSWORD` | Avisos de clase mediante SMTP; usuario/host tienen valores de respaldo en el código |
| Vault `fontex_smtp_password` | Alternativa al secreto SMTP; RPC accesible solo a `service_role` |

La contraseña SMTP de Auth no se expone automáticamente a las funciones. Los avisos de clases tienen su propia configuración. La cola conserva pendientes y permite reintentar; verificar el código no acredita la entrega de un correo real.

Nunca pongas credenciales administrativas, claves privadas o contraseñas en variables `VITE_*`. Los secretos reales no forman parte del repositorio ni de los ejemplos de documentación.

## Desarrollo y pruebas locales

El CLI está fijado en `package-lock.json`. Comprueba `npx supabase --help` y la ayuda del subcomando antes de usar flags de otra versión. Docker debe estar disponible.

Para reproducir las comprobaciones SQL de CI:

```bash
npm ci
npx supabase db start
npx supabase test db --local
node scripts/check-database-restore.mjs
npx supabase stop --no-backup
```

Para servir funciones usa el runtime local de Supabase, con sus servicios preparados y un archivo de secretos ignorado por Git:

```bash
npx supabase functions serve --env-file .env.local
```

Estas operaciones locales no equivalen a `db push` ni a aplicar migraciones en el proyecto remoto. Las pruebas remotas necesitan variables `SUPABASE_TEST_*` y crean/eliminan recursos de QA; no deben ejecutarse accidentalmente contra producción.

## Despliegue

Las funciones importan validadores fuera de `supabase/functions`, por lo que el paquete debe contener sus dependencias relativas del repositorio. Los cambios de contrato del lienzo requieren actualizar conjuntamente `studio-agent`, `classroom-agent` y `classroom-api` antes de publicar el frontend.

El agente anuncia `primitive-agent-v7`. `get_release_contract` devuelve `closed-beta-v4` después de verificaciones dinámicas; no se debe reemplazar por una constante para pasar el despliegue. `class_learning_contract` acredita `classroom-learning-v092`. El workflow de Pages comprueba compatibilidad y diez rutas protegidas antes de publicar.

La corrección del modelo documental en esta rama necesita desplegar `tutor-chat`; fusionar código o publicar Pages no actualiza por sí solo las funciones Edge.

## Respaldo y restauración

Una rama de Git respalda código, no la base de datos ni los objetos de Storage.

- `scripts/backup-canvas-data.mjs` crea un respaldo acotado de datos de lienzos en `ops.local/backups`, con checksum y ensayo de restauración. Está ligado al proyecto declarado en el script. No incluye credenciales de Auth ni objetos PDF.
- `scripts/check-database-restore.mjs` ensaya respaldo/restauración en la base aislada de CI. No restaura producción.
- Para recuperación completa se requiere además una estrategia de respaldo de PostgreSQL y de los PDF del bucket. No borres archivos o tablas antiguas basándote solo en que la interfaz ya no los muestra.

## Estado de la revisión

Se retiró código desconectado, sin cambiar migraciones ni datos. Las observaciones de seguridad y rendimiento, incluidas las que pertenecen a un proyecto compartido, están separadas en [la auditoría del 22 de noviembre](../docs/AUDITORIA-2026-11-22.md). Los avisos automáticos no sustituyen revisar autorización ni medir consultas.
