# Supabase — Bloque 1

Esta carpeta contiene la infraestructura versionada de identidad, aulas, grupos y seguridad RLS de Fontex.

## Contenido

- `migrations/`: esquema aditivo y funciones controladas del Bloque 1.
- `tests/database/`: pruebas pgTAP de estructura, privilegios, aislamiento y revocación.
- `functions/`: reservado para ingesta y tutor en bloques posteriores.

## Modelo actual

- `profiles`: perfil mínimo asociado a `auth.users` mediante trigger.
- `organizations`: contenedor institucional creado por un usuario autenticado.
- `classrooms` y `class_members`: aulas privadas, matrícula y roles `teacher`/`student`.
- `classroom_invitations`: tokens de un solo uso almacenados únicamente como hash.
- `study_groups` y `group_members`: grupos privados dentro de un aula.

Todas las tablas expuestas tienen RLS. `anon` no recibe privilegios de tabla. Los cambios de rol, aceptación de invitaciones y retiro de miembros pasan por funciones que validan al usuario. Las ayudas `SECURITY DEFINER` internas residen en `private`, usan `search_path = ''` y tienen ejecución restringida.

## Límites

No existen todavía tablas de documentos, buckets, embeddings, conversaciones ni Edge Functions. No se deben añadir tokens, contraseñas, claves `service_role` o archivos `.env` al repositorio.
