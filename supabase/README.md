# Supabase — reservado para bloques posteriores

Esta carpeta define únicamente la estructura esperada. El Bloque 0 no crea tablas, buckets, políticas RLS ni funciones desplegables porque esos contratos requieren revisión en el Bloque 1.

- `migrations/`: migraciones versionadas a partir del Bloque 1.
- `functions/`: Edge Functions a partir de la ingesta y el tutor real.
- `tests/`: pruebas de aislamiento, políticas RLS y Storage.

No se deben añadir claves, tokens ni archivos `.env` al repositorio.
