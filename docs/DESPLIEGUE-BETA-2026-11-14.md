# Integración de la beta en producción — 14 de noviembre de 2026

Destino: [Fontex](https://fontex.sypablitodp.site), GitHub Pages del repositorio `dppablito4-oss/fontex-web` y Supabase `goegjuglstapjwcckawp` (`fintex.back`). Parte del código auditado en `9fd02b7`; este commit añade la corrección del runner limpio y la configuración elegida para el proyecto compartido.

## Backend y datos

- Historial remoto actualizado hasta `20261114221500`: 21 versiones de estructura. Se revisó el plan antes de aplicar; no se ejecutó un reset remoto ni se convirtió contenido antiguo.
- Registro de **todo el proyecto compartido** limitado a correos invitados, por decisión expresa del operador. Las cuentas existentes se conservaron. La API y los datos de `forma` mantienen sus propias políticas.
- Cohorte inicial: 9 miembros activos; 10 cuentas de Auth en total, incluidas las que no tenían correo verificado. La membresía requiere correo verificado.
- Eliminadas únicamente las 3 escenas antiguas de `public.visual_scenes`, verificando identidad, revisión y contenido contra una copia previa. Resultado: 0 escenas remotas. Las copias locales de los navegadores no se borraron.
- Se conservaron los 4 documentos, los 18 objetos de Storage y los 538 mensajes de la otra aplicación. Las cuentas temporales de prueba, sus sesiones y sus invitaciones se limpiaron.
- Copia de las escenas: `ops.local/scenes-before-beta-20261114.json`, excluida de Git. SHA-256: `3EEF444838B2ABC698D82D75596BA30C59B36F17F82F59089EAF672A05951F51`. También se guardaron las definiciones de funciones y la configuración anterior en `ops.local/`. Son copias locales; falta ensayar una restauración.
- Contraseña mínima alojada: 8 caracteres. Se conservaron confirmación de correo, URLs de retorno y demás configuración remota. No se cambiaron claves ni secretos del proveedor.

Las ocho funciones se desplegaron desde la raíz, con JWT habilitado y estado `ACTIVE`:

| Función | Versión |
|---|---:|
| `studio-agent` | 23 |
| `scene-agent` (retirada, respuesta 410 autenticada) | 6 |
| `tutor-chat` | 8 |
| `practice-tutor` | 3 |
| `document-upload` | 7 |
| `document-delete` | 6 |
| `document-process` | 5 |
| `document-search` | 5 |

Las funciones ajenas `chat-stream` e `image-generate` se conservaron.

## Pages y comprobaciones

GitHub dispone de variables explícitas para URL, clave **publicable** de Supabase y base `/`. No se publicaron claves privilegiadas. El dominio configurado en Pages es `fontex.sypablitodp.site`.

El [workflow de publicación](https://github.com/dppablito4-oss/fontex-web/actions/workflows/deploy-pages.yml) ejecuta calidad, SQL y Deno antes del gate del backend y del despliegue. Sus ejecuciones asociadas a cada commit son la evidencia del resultado de Pages. Se corrigió el primer fallo del runner limpio: las pruebas compartidas de Deno ya no dependen de un `node_modules` instalado previamente. Las 7 pruebas afectadas se verificaron en una copia limpia.

Comprobaciones ejecutadas contra el backend alojado:

- Contrato `closed-beta-v1`, CORS y rechazo 401 sin sesión en las 8 rutas.
- Cuenta temporal invitada, ingreso con contraseña, membresía y créditos; creación, lectura, actualización con revisión y borrado de escena.
- Entradas inválidas rechazadas en los handlers comprobados; retirada autenticada de `scene-agent` con 410.
- Revocación efectiva usando el mismo JWT: bloquea tablas, RPC de créditos y Edge.
- Una petición real de IA: SSE completado, propuesta validada y conversación sin acciones de edición.
- Tras cerrar el registro global, una segunda ejecución de 25 comprobaciones confirmó rechazo del alta no invitada, alta invitada, revocación y conservación de acceso a la API `forma` según sus propias políticas. Encabezados de perfil contradictorios no eluden el guard público.
- 243 pruebas SQL locales en 11 suites tras las actualizaciones. El CI vuelve a comprobar todas las migraciones desde cero.

## Límites pendientes

La prueba autenticada usó cuentas confirmadas por el API administrativo y no envió correos: **no acredita entrega SMTP, confirmación por correo ni recuperación de contraseña**. Tampoco prueba carga y extracción de un PDF real alojado ni todos los tutores con consumo real.

Los asesores alojados conservaron 9 avisos previos: 8 RPC `SECURITY DEFINER` accesibles al rol autenticado y protección de contraseñas filtradas desactivada. Los RPC conservan sus controles de rol/propiedad y ahora también membresía; la advertencia por privilegios intencionales sigue visible. Debe revisarse su traslado a helpers privados y la disponibilidad de protección de contraseñas filtradas. [Guía del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Siguen pendientes MFA administrativo, recuperación duradera de propuestas tras desconexión, mayor telemetría y prueba de restauración. La auditoría histórica y esta acta distinguen lo probado de lo pendiente; no equivalen a una certificación de ausencia de fallos.
