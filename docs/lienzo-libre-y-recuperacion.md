# Lienzo libre y preparación de beta

Implementación iniciada el 14 de noviembre de 2026. Complementa la corrección de streaming y no reinicia los documentos existentes.

## Uso del lienzo

Los marcos de los elementos quedan transparentes; la selección conserva un contorno y sus controles. El espacio se desplaza con clic derecho, botón central o Espacio y arrastre. La cámara es local: moverla no altera coordenadas de las figuras ni crea entradas de historial. La rueda recorre el espacio; «Ajustar ancho» centra de nuevo su vista. Los objetos pueden desplazarse horizontalmente más allá del antiguo ancho de 1200, dentro de los límites del contrato.

El plano utiliza todo el ancho de las plantillas. Las definiciones y controles de una lección con un único plano se muestran encima, en un desplegable. Siguen existiendo en el JSON; las lecciones con varios planos o visualizaciones mantienen sus bloques independientes. Las figuras ancladas se editan sobre su plano, incluidas sus unidades. Esto no convierte píxeles en centímetros físicos de la pantalla.

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

Verificaciones realizadas durante la implementación: 380 pruebas frontend, tipos, lint y build; regresiones Deno de persistencia previa a entrega, duplicados y fallo de almacenamiento; 269 comprobaciones SQL. Chromium ejecutó diez recorridos correctos en escritorio claro/oscuro y móvil, con dos recorridos de ratón omitidos en móvil. Se creó una copia del lienzo alojado y se comprobó su restauración temporal idéntica. Supabase aceptó el correo de recuperación al destinatario autorizado y este confirmó su recepción. La prueba no cambia la contraseña del propietario.

El despliegue y las comprobaciones alojadas se registrarán al completar esta publicación. La entrega real de confirmación a una cuenta nueva se distingue de la recepción ya confirmada del correo de recuperación.
