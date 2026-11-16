# Fontex v0.9.2: clases, actividades e invitados

## Preparar y publicar una clase

1. En **Aula**, crea un lienzo o selecciona una tarjeta de tu biblioteca. También puedes publicar desde **Archivo → Publicar en un aula** dentro del lienzo.
2. Habilita únicamente los valores solicitados por el ejercicio desde las propiedades del elemento. «Respuesta del alumno» siempre permite responder; las definiciones permanecen fijas.
3. Elige un aula donde seas docente, título, tema, fecha, semana e instrucciones. Puedes añadir fecha de entrega, hasta cinco PDF de 10 MB y una ficha generada a partir del lienzo con respuestas en blanco.
4. Publica. El aula recibe una copia independiente: editar el original no cambia una actividad ya publicada. Las clases se ordenan por semana y fecha.
5. Los estudiantes abren los materiales en Fontex, practican, guardan borradores y entregan. El docente abre las respuestas y deja una devolución.

## Participación temporal y créditos

Cada aula dispone de su propio enlace/código. La invitación dura siete días; cada participación anónima dura como máximo ocho horas y recibe cinco créditos para construir con IA. El chat conserva los mismos límites temporales del servicio. Un invitado tiene acceso a las clases, PDF, actividades y entregas de esa aula, con rol de estudiante.

Al vincular y confirmar un correo se conserva la matrícula, las entregas y el saldo restante. Se concede un bono de cinco créditos por cuenta, una sola vez. Para cuentas nuevas los cinco créditos iniciales representan ese bono: no se duplican. La confirmación desde otro dispositivo también traspasa las actividades y el saldo. Los lienzos locales se importan y suben a la cuenta desde el navegador original mediante «Conservar mis lienzos y mi matrícula».

Renovar/desactivar una invitación finaliza los accesos temporales anteriores. Los participantes ya matriculados conservan su cuenta. Las comprobaciones de rol y aula se realizan en el servidor; cambiar la URL no concede acceso a otra clase. Las entregas se reconstruyen a partir de los campos habilitados y rechazan cambios en definiciones, estructura, permisos o resultados protegidos.

## Avisos por correo

`classroom-api` utiliza Gmail SMTP (`smtp.gmail.com:465`, TLS) y el remitente configurado para Fontex. La contraseña se obtiene de `FONTEX_SMTP_PASSWORD` o de la entrada cifrada `fontex_smtp_password` de Supabase Vault. El RPC que la consulta permite únicamente `service_role`; ningún navegador recibe la clave. El repositorio contiene solo la integración y los nombres de configuración.

Los destinatarios son integrantes con correo confirmado. Los avisos enlazan a la clase y sus materiales privados; no convierten los PDF en archivos públicos. La cola conserva los avisos pendientes o fallidos y el docente puede reintentarlos desde la clase. Cada petición procesa hasta 50 destinatarios. No se avisa a invitados sin correo ni a matrículas retiradas.

La conexión y autenticación con Gmail se verificaron desde Supabase sin enviar mensajes de prueba. La entrega real depende de Gmail y del destinatario; el estado de envío se registra por aviso.

## Despliegue y comprobaciones

- Migración `20261116132502_classroom_learning_v092.sql`; tablas privadas con RLS y acceso mediante RPC específicos.
- `classroom-api`: valida JWT de Auth o token de invitado; guarda entregas comprobadas, firma accesos breves a materiales y envía avisos.
- `classroom-agent`: valida el token temporal y reutiliza el mismo motor de primitivas; sus créditos, reservas, reembolsos y recibos se contabilizan en servidor. Comparte el presupuesto global de IA con las cuentas registradas.
- Ambas funciones tienen `verify_jwt=false` porque aceptan tokens temporales propios. La autenticación y autorización se comprueban en cada acción.
- `scripts/check-backend-release.mjs` exige el contrato de actividades y las dos funciones antes de publicar el frontend.
- Pruebas SQL de aislamiento, publicación, créditos, reembolsos y confirmación; pruebas de envíos protegidos en las once primitivas; pruebas de interfaz de práctica y publicación en móvil y escritorio.

El administrador dispone de una tabla de cuentas con búsqueda, paginación, saldo, asignaciones e historial. Los controles de acceso a la beta y el diagnóstico están separados en secciones desplegables; las operaciones administrativas conservan el requisito de MFA.
