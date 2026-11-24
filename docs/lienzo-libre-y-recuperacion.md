# Lienzo libre y preparación de beta

Implementación iniciada el 14 de noviembre de 2026. Complementa la corrección de streaming y no reinicia los documentos existentes.

## Uso del lienzo

Los marcos de los elementos quedan transparentes; la selección conserva un contorno y sus controles. El espacio se desplaza con clic derecho, botón central o Espacio y arrastre. La cámara es local: moverla no altera coordenadas de las figuras ni crea entradas de historial. La rueda y el arrastre recorren el contenido con los límites del desplazamiento nativo, sin perderlo fuera de pantalla. «Ajustar ancho» vuelve al inicio y encuadra el ancho. Los botones del pie y Ctrl/Cmd + rueda amplían o reducen todo el lienzo (10–300 %), conservando el punto observado. Con el foco dentro del lienzo también funcionan Ctrl/Cmd + +, − y 0 (100 %). Los botones del plano mantienen su ventana matemática independiente. Al abrir un documento se omite el margen vacío anterior al primer elemento, sin modificar sus coordenadas guardadas; al moverlo, el encuadre inicial permanece fijo. Los objetos pueden desplazarse horizontalmente más allá del antiguo ancho de 1200, dentro de los límites del contrato.

El plano utiliza todo el ancho de las plantillas. Las definiciones y controles de una exploración con un único plano y un único paso pueden mostrarse en su desplegable. Si la explicación tiene pasos distintos, sus textos siguen visibles en el flujo de lectura antes de sus modelos, también en móvil y PDF. Las etiquetas fijas o interpoladas de segmentos se dibujan con el color del segmento; los saltos de recta numérica conservan su desplazamiento con signo. Las figuras ancladas se editan sobre su plano, incluidas sus unidades. Esto no convierte píxeles en centímetros físicos de la pantalla.

## Secuencias de explicación

El generador distingue una introducción general, un caso concreto y una petición de desarrollar subtemas. Cada etapa combina una explicación de qué se observa, una representación que señala esa parte y la razón del paso siguiente. Para geometría se reutilizan figuras vinculadas a segmentos de color y etiquetas: la apotema une centro y punto medio de un lado; el radio une centro y vértice. Se conserva la misma escala y figura entre etapas y se evita acumular todas las marcas en un solo plano. La regla se extiende a fracciones, funciones, vectores, cantidades, tablas, relaciones y sólidos con las capacidades existentes de cada primitiva.

Estas son instrucciones generales de generación; no incorporan ejercicios predeterminados ni garantizan todas las decisiones de un modelo externo. Las pruebas locales validan contrato, lectura por pasos, etiquetas, interacción y navegación sin llamadas de pago. Para cambiar la generación publicada hay que desplegar `studio-agent` y el frontend de esta revisión; no requiere migración de datos ni cambio de contrato.

En el chat, Enter envía desde un ordenador con puntero; Shift + Enter conserva el salto de línea. En pantalla táctil Enter sigue insertando una línea. No se muestra una leyenda de teclado y no se envía durante composición IME ni con una tecla mantenida.

## Recuperación y crédito

Cada construcción nueva lleva un UUID estable y un recibo privado en `fontex_ai.canvas_builds`. La reserva y el recibo inicial se crean en una transacción; la propuesta validada y la liquidación del crédito se confirman juntas antes del resultado SSE. Reenviar un UUID existente no consulta al proveedor ni vuelve a reservar crédito.

El editor consulta los recibos de la escena al abrirla, al recuperar conexión y periódicamente durante la sesión. Aplica una propuesta pendiente solo si coinciden primitivas y variables de partida. Conserva un máximo de cien IDs aplicados en el documento para evitar duplicación después de recargar. Si hay ediciones posteriores, ofrece recuperar en otro documento. La confirmación operativa de aplicación espera a que el documento se haya sincronizado.

Los resultados son recuperables durante siete días. La siguiente construcción admitida limpia recibos vencidos; no se presenta como borrado físico programado exactamente al séptimo día. Se conservan como máximo cien recibos por cuenta, con límites de bytes para origen y propuesta. Una petición interrumpida antes de completar se reembolsa según la reserva existente; no se promete completar en segundo plano una petición cancelada al cerrar la pestaña. Las solicitudes anteriores a esta implementación no disponen de recibo retroactivo.

La tabla no se expone por REST ni permite lectura directa a participantes. Las funciones de recuperación verifican UUID de propietario y membresía activa. El borrado de una cuenta elimina sus recibos por cascada. El contrato de publicación pasa a `closed-beta-v2`.

## Administración y diagnóstico

El panel administrativo exige enrolar/verificar un autenticador TOTP. El guard central de servidor exige `aal2`, también para invitaciones, saldo de otras cuentas y pausa de IA. La configuración del autenticador del propietario se completa por él desde la interfaz; esta intervención no registra factores en su nombre. El operador de base de datos conserva el procedimiento de recuperación si se pierde el dispositivo.

Los registros estructurados del agente incluyen ID de solicitud, modalidad, tiempo y resultado, sin preguntas ni escenas. El panel resume las últimas 24 horas: solicitudes, completadas, reembolsadas, pendientes, duración media y resultados sin confirmación de aplicación. Los recibos privados sí contienen el contexto necesario para recuperar la propuesta, conforme a la página pública de ayuda.

## Copias y verificación

`node scripts/backup-canvas-data.mjs` guarda una instantánea privada de los lienzos del proyecto enlazado en `ops.local/backups`, con SHA-256. `node scripts/backup-canvas-data.mjs --rehearse <copia.json>` comprueba el hash, restaura en una tabla temporal, compara las filas y revierte la transacción. No restaura Auth, PDF ni Storage; no sustituye el respaldo completo del servicio.

El CI prueba además `pg_dump`/`pg_restore` en una base desechable y verifica historial, funciones privadas y RLS. Los datos y archivos de producción no se envían a ese ensayo. Docker local no pudo iniciar por recursos insuficientes; la validación SQL se ejecuta en el runner aislado de GitHub.

Verificaciones realizadas durante la implementación: 380 pruebas frontend más tres regresiones de confirmación de recuperación, tipos, lint y build; regresiones Deno de persistencia previa a entrega, duplicados y fallo de almacenamiento; 269 comprobaciones SQL. Chromium ejecutó diez recorridos correctos en escritorio claro/oscuro y móvil, con dos recorridos de ratón omitidos en móvil. Se creó una copia del lienzo alojado y se comprobó su restauración temporal idéntica. Supabase aceptó el correo de recuperación al destinatario autorizado y este confirmó su recepción. La prueba no cambia la contraseña del propietario.

La migración `20261115013301` se aplicó al proyecto alojado tras pasar sus 269 pruebas SQL y el ensayo de restauración completa en CI. El asesor de seguridad conserva los nueve avisos anteriores y no añade ninguno.

La comprobación alojada generó una propuesta real, confirmó su recibo y un saldo de cuatro créditos, rechazó su UUID duplicado y abrió el editor en Chromium sin aplicar la respuesta original. El editor recuperó y guardó cinco elementos; recargar mantuvo los cinco y el mismo saldo. La misma cuenta temporal comprobó denegación de administración a AAL1, enrolamiento TOTP desde la interfaz y carga del panel tras verificar el código. No hubo errores de página sin capturar; sus sesiones, cuenta e invitación se limpiaron.

También se comprobó entrega real de confirmación a una cuenta nueva mediante un alias temporal del Gmail autorizado. El destinatario confirmó recepción y regreso a Fontex; Auth acreditó `email_confirmed_at` y `last_sign_in_at`. Se eliminaron únicamente sus sesiones, cuenta temporal e invitación. La cuenta habitual y su contraseña permanecen intactas.

## Zoom y espaciado en celular (24 de noviembre de 2026)

La lectura adaptable del celular también admite el zoom del lienzo completo: botones +/−, Ajustar ancho y pellizco con dos dedos dentro del lienzo. Con un dedo se mantiene el desplazamiento. La interfaz exterior no cambia de tamaño y el gesto no edita las posiciones guardadas ni consume IA. Cuando se está dibujando sobre un trazo activo, los botones permiten ampliar sin iniciar un gesto de dibujo accidental.

La vista móvil mide la altura real de la lección antes de escalarla. Los textos se ajustan al contenido, sin reservar la altura de un encabezado oculto; las etapas y modelos conservan separaciones compactas. Escritorio mantiene rueda, arrastre, zoom y edición de valores, y el PDF conserva su flujo independiente.
