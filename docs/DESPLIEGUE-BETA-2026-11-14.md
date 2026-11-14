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

El [despliegue de `91c55be`](https://github.com/dppablito4-oss/fontex-web/actions/runs/43642930697) terminó correctamente: calidad, SQL, Deno, comprobación del backend, compilación y publicación en Pages. Se corrigió el primer fallo del runner limpio: las pruebas compartidas de Deno ya no dependen de un `node_modules` instalado previamente. Las 7 pruebas afectadas se verificaron en una copia limpia.

Se descargó el artefacto de esa ejecución y se comparó por SHA-256 con el dominio HTTPS: el HTML y los 16 archivos JavaScript/CSS publicados coinciden y responden 200. Los chunks incluyen la URL y la clave publicable del proyecto previsto; no se encontró el patrón de clave secreta `sb_secret_`. También se comprobó el contrato REST desde el origen real de Pages. Esta comprobación de archivos y API no sustituye una prueba visual.

Comprobaciones ejecutadas contra el backend alojado:

- Contrato `closed-beta-v1`, CORS y rechazo 401 sin sesión en las 8 rutas.
- Cuenta temporal invitada, ingreso con contraseña, membresía y créditos; creación, lectura, actualización con revisión y borrado de escena.
- Entradas inválidas rechazadas en los handlers comprobados; retirada autenticada de `scene-agent` con 410.
- Revocación efectiva usando el mismo JWT: bloquea tablas, RPC de créditos y Edge.
- Una petición real de IA: SSE completado, propuesta validada y conversación sin acciones de edición.
- Tras cerrar el registro global, una segunda ejecución de 25 comprobaciones confirmó rechazo del alta no invitada, alta invitada, revocación y conservación de acceso a la API `forma` según sus propias políticas. Encabezados de perfil contradictorios no eluden el guard público.
- PDF temporal real de una página: reserva, carga privada, extracción de texto, embeddings, estado `ready`, descarga con hash idéntico y eliminación. También se limpiaron su aula e institución temporales. La ejecución completa de ese recorrido pasó 37 comprobaciones antes de eliminar las dos cuentas temporales.
- 243 pruebas SQL en 11 suites. El CI del despliegue correcto aplicó y probó las 21 migraciones desde cero; también pasaron lint, tipos, pruebas del frontend y comprobaciones de las ocho funciones.

## Límites pendientes

La prueba autenticada usó cuentas confirmadas por el API administrativo y no envió correos: **no acredita entrega SMTP, confirmación por correo ni recuperación de contraseña**. Tampoco cubre todos los tutores con consumo real. El host de acceso al navegador no estuvo disponible y el control nativo devolvió errores de canal; no se completó la verificación visual en escritorio o móvil.

Los asesores alojados conservaron 9 avisos previos: 8 RPC `SECURITY DEFINER` accesibles al rol autenticado y protección de contraseñas filtradas desactivada. Los RPC conservan sus controles de rol/propiedad y ahora también membresía; la advertencia por privilegios intencionales sigue visible. Debe revisarse su traslado a helpers privados y la disponibilidad de protección de contraseñas filtradas. [Guía del asesor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Siguen pendientes MFA administrativo, recuperación duradera de propuestas tras desconexión, mayor telemetría y prueba de restauración. La auditoría histórica y esta acta distinguen lo probado de lo pendiente; no equivalen a una certificación de ausencia de fallos.
