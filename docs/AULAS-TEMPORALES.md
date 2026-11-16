# Invitaciones y participación temporal

En **Mi espacio → Aula**, un docente puede generar un enlace y un código compartidos. La invitación dura siete días. Generar otra o desactivarla termina los accesos temporales asociados; conserva las matrículas permanentes. El enlace y el código se muestran al generarlos y se almacenan como hashes en el servidor.

Una persona con sesión iniciada se incorpora directamente como estudiante al abrir el enlace o introducir el código en `#/unirse`. El acceso también está disponible desde la pantalla de ingreso. Las invitaciones individuales por correo conservan su aceptación y su rol originales.

Sin sesión, solo se pide el nombre. El servidor registra una participación de hasta ocho horas y entrega una credencial aleatoria para ese navegador. El docente ve los participantes temporales. La persona puede abrir su lienzo y usar las herramientas locales, las plantillas y las exportaciones. Su participación no abre las bibliotecas privadas, los grupos ni los servicios de IA de otros usuarios.

**Guardar y permanecer en el aula** solicita correo y contraseña, o permite ingresar a una cuenta existente. Una cuenta nueva necesita confirmar el correo. La confirmación completa la matrícula incluso si se abre en otro dispositivo. Para trasladar los lienzos temporales hay que volver al navegador donde se trabajó y pulsar **Conservar mis lienzos y mi matrícula**. Se copian a la cuenta con identificadores nuevos y se sincronizan; se mantiene la copia local de recuperación. La confirmación y la recuperación de una cuenta que ya inició el registro tienen un margen de ocho días desde el ingreso temporal. Una invitación desactivada no permite completar una incorporación pendiente.

Las credenciales temporales no son sesiones de Supabase Auth. Los registros y sus nombres permanecen en un esquema privado con RLS y sin lectura directa desde clientes. Solo una credencial válida autoriza el registro; campos editables como nombre, rol o aula no conceden permisos. Las invitaciones de clase no reactivan cuentas revocadas ni matrículas retiradas. Los visitantes no pueden crear invitaciones ni consultar el listado temporal.

## Lienzo adaptable

Hasta 900 px, los elementos siguen la secuencia de lectura con ancho disponible. Hasta 1100 px, el asistente se abre sobre el lienzo y comienza cerrado. En pantallas mayores conserva el panel lateral ajustable. Los controles se compactan en teléfonos y las pantallas de poca altura mantienen una zona de trabajo desplazable. No se cambian las posiciones guardadas del lienzo de escritorio ni el orden del PDF.

## Verificación de esta entrega

- Pruebas SQL sobre invitaciones, roles, credenciales falsas, correo sin confirmar, confirmación en otro dispositivo, reutilización, acceso privado y revocación.
- Pruebas de interfaz para ingreso con nombre, incorporación de cuentas existentes e invitaciones vencidas; copia de los lienzos a una cuenta sin sobrescribir documentos existentes.
- Navegador en 320×480, 390×844, 768×1024, 1024×768, 1280×720, 1920×1080 y 844×390.
- Recorrido completo contra Supabase local aislado, incluido el correo real de confirmación capturado por el servidor de correo local, la matrícula y la lectura del lienzo guardado en la base de datos. No utiliza IA ni envía mensajes a destinatarios externos.
- La publicación comprueba que los RPC de invitación estén instalados antes de servir el nuevo frontend.
