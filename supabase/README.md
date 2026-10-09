# Supabase — Bloques 1 y 2, y tutor `v0.3.0`

Esta carpeta contiene la infraestructura versionada de identidad, aulas, grupos, biblioteca PDF privada y seguridad RLS de Fontex.

## Contenido

- `migrations/`: esquema aditivo y funciones controladas del Bloque 1.
- `tests/database/`: pruebas pgTAP de estructura, privilegios, aislamiento y revocación.
- `functions/tutor-chat/`: endpoint autenticado del tutor, con dependencias Deno fijadas y llamada server-side a OpenAI Responses API.
- `functions/document-upload/`: valida firma, hash y reserva antes de escribir en Storage.
- `functions/document-delete/`: elimina el objeto físico y después sus metadatos y permisos.

## Modelo actual

- `profiles`: perfil mínimo asociado a `auth.users` mediante trigger.
- `organizations`: contenedor institucional creado por un usuario autenticado.
- `classrooms` y `class_members`: aulas privadas, matrícula y roles `teacher`/`student`.
- `classroom_invitations`: tokens de un solo uso almacenados únicamente como hash.
- `study_groups` y `group_members`: grupos privados dentro de un aula.
- `documents`, `document_shares` y `document_limits`: metadatos, acceso explícito y cuotas documentales.
- `fontex-documents`: bucket privado limitado a PDF de 5 MiB.

Todas las tablas expuestas tienen RLS. `anon` no recibe privilegios de tabla. Los cambios de rol, aceptación de invitaciones, retiro de miembros y reservas documentales pasan por funciones que validan al usuario. Las ayudas `SECURITY DEFINER` internas residen en `private`, usan `search_path = ''` y tienen ejecución restringida. Storage solo concede lectura autenticada cuando la política documental confirma acceso actual; las escrituras pasan por Edge Functions.

## Límites

No existen todavía chunks, embeddings ni conversaciones persistentes. `tutor-chat` ofrece orientación general y rechaza afirmar que consultó fuentes; la extracción e indexación pertenecen al futuro Bloque 3.

`OPENAI_API_KEY` debe existir solo como secreto del proyecto. No se deben añadir tokens, contraseñas, claves `service_role`, claves `sb_secret_…` ni archivos `.env` al repositorio.
