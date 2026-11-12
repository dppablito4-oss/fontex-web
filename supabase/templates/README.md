# Correos de Fontex

Configuración aplicada el 12 de noviembre de 2026 al proyecto `fintex.back` (`goegjuglstapjwcckawp`).

## Envío remoto

- Remitente: **Fontex <pabloclsa87@gmail.com>**.
- SMTP: `smtp.gmail.com`, puerto `465`, conexión TLS.
- Usuario SMTP: el mismo correo del remitente.
- Límite configurado en Supabase: 30 correos por hora; se conserva la espera entre solicitudes existente.
- Confirmación de registro obligatoria y confirmación de cambios de correo conservadas.
- La contraseña de aplicación se entregó directamente a la configuración remota. No está en este directorio, en el frontend ni en variables `VITE_*`.

La CLI autenticada permitió aplicar una actualización limitada de Auth mediante la Management API. No se ejecutó `config push` con toda la configuración local, para evitar cambiar otros ajustes remotos. La configuración se volvió a consultar y se verificaron los 39 campos no secretos actualizados. Gmail aceptó la autenticación SMTP sobre TLS. Eso no verifica la recepción en una bandeja de entrada.

## Plantillas

`catalog.json` define los asuntos y los archivos. Hay seis plantillas de autenticación:

- `confirmation.html`: bienvenida y confirmación del registro en un mismo mensaje.
- `magic_link.html`: enlace de inicio de sesión, cuando una aplicación solicita ese flujo.
- `recovery.html`: recuperación de contraseña.
- `invite.html`: invitación de cuenta de Supabase Auth; es distinta de una invitación a un aula mediante RPC.
- `email_change.html`: confirmación del cambio de correo.
- `reauthentication.html`: código para una operación que requiere verificar otra vez la identidad.

Las siete plantillas `*_notification.html` notifican cambios de contraseña, correo, teléfono, factores MFA y proveedores de acceso vinculados o desvinculados. Sus notificaciones están habilitadas en el proyecto. Solo se envían cuando ocurre el evento correspondiente; habilitarlas no activa nuevos proveedores ni funcionalidades de teléfono.

La bienvenida se incluye en el correo de confirmación. No se añadió un segundo envío independiente después de confirmar. Tampoco se envía un aviso por cada inicio de sesión con contraseña: la plantilla `magic_link` corresponde al flujo de acceso por enlace, no a una notificación de cada acceso. La interfaz actual continúa usando contraseña.

## Enlaces y recuperación

Se conservaron `site_url=https://fontex.sypablitodp.site` y las URLs de retorno del proyecto. Los botones usan `{{ .ConfirmationURL }}`; no construyen ni exponen un token de sesión propio. La reautenticación usa `{{ .Token }}`. No se colocan credenciales SMTP en ninguna plantilla.

El frontend añade:

- `/#/recuperar-contrasena`: solicitud de recuperación con respuesta que no revela si el correo existe.
- `/#/nueva-contrasena`: formulario de nueva contraseña, disponible con sesión autenticada.
- Manejo de `PASSWORD_RECOVERY` para abrir el formulario después de consumir el callback de Supabase.

La solicitud envía un `redirectTo` al origen y ruta base sin fragmento, porque Supabase usa el fragmento del callback. La ruta de nueva contraseña se establece después del evento de recuperación y funciona al recargar. Las modificaciones de frontend requieren publicar el build correspondiente para estar disponibles en la web alojada.

## Desarrollo local y mantenimiento

`supabase/config.toml` referencia estas mismas plantillas para el servidor de correo local. No activa Gmail ni guarda su contraseña; los entornos locales conservan su capturador de correo.

Al cambiar archivos o asuntos, actualizar también los correspondientes campos `mailer_templates_*_content` y `mailer_subjects_*` del proyecto alojado, mediante el dashboard o la Management API. Editar un HTML en este repositorio no actualiza por sí solo el correo remoto. No publicar todo `config.toml` sin revisar las diferencias del destino.

Ver [SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp), [plantillas de correo](https://supabase.com/docs/guides/auth/auth-email-templates) y [recuperación de contraseña](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
