# Política de IA del lienzo — Fontex 0.8.1

## Uso y saldo

Cada cuenta invitada recibe **5 créditos iniciales de generación**. Es una asignación única, sin renovación diaria o mensual; las cuentas existentes también reciben el saldo al activar esta política. El chat del lienzo no consume créditos. Durante la beta, chat y construcción comparten límites de frecuencia, concurrencia y presupuesto: inicialmente 20 solicitudes/hora, 60/24 horas móviles y una solicitud simultánea por cuenta. Los tutores del aula de práctica y documental conservan además sus propias cuotas. Consulta [la guía de beta](beta-cerrada.md) para los límites globales, invitaciones y activación.

Una solicitud de **Crear lienzo / Crear en el lienzo** consume un crédito cuando el servidor termina y valida una propuesta. Una propuesta válida completada cuenta aunque luego el usuario cambie de documento, decida no utilizarla o pierda la conexión después de completarse. Conversar, editar, usar plantillas, presentar y exportar PDF no consumen saldo.

Si el proveedor falla, la respuesta queda incompleta o la propuesta no supera la validación, se devuelve el crédito reservado. Una interrupción anterior a completar la generación también libera su reserva. Si el servidor se corta antes de poder confirmarla, la reserva vence a los dos minutos y se recupera al consultar el saldo o iniciar otra generación. La interfaz actualiza el saldo al terminar, al recuperar el foco y periódicamente mientras está visible.

Con cero créditos se puede seguir conversando y usar todas las herramientas locales. Los botones de generación se desactivan; el servidor rechaza también las llamadas directas sin saldo, antes de consultar al proveedor. El modelo de chat sigue configurado con `FONTEX_CHAT_MODEL` (por defecto gpt-6-luna); la construcción con `FONTEX_AGENT_MODEL` (por defecto gpt-6.1-sol). Cambiar el nombre de modelo no evita el cobro del modo build ni permite realizar acciones mediante el modo chat.

## Administración desde la interfaz

La cuenta existente y verificada `pabloclsa87@gmail.com` queda autorizada al aplicar la migración. El permiso se vincula a su UUID real de Auth en una tabla privada; no se decide mediante el correo del navegador, `user_metadata` ni un campo editable de perfil. Cambiar metadata no permite ser administrador. Un registro futuro con el mismo correo no recibe automáticamente este permiso si se elimina la cuenta original.

Desde **Administrar créditos** en el chat, o `/#/administracion`, el administrador puede:

1. Buscar cuentas por correo o nombre y recorrer páginas de 25 resultados.
2. Seleccionar una cuenta, incluida la propia.
3. Añadir entre 1 y 1000 créditos por operación, con un motivo opcional.
4. Consultar sus últimos movimientos y el saldo resultante.

Las asignaciones usan una clave de solicitud: reintentar tras perder la respuesta no duplica el abono. El saldo máximo es un millón de créditos, incluyendo una reserva pendiente; no hay cobros ni venta de créditos en este cambio. El administrador también empieza con cinco créditos y puede añadir saldo a su cuenta desde la misma GUI.

Los usuarios normales sólo pueden consultar su propio estado. No pueden listar cuentas, asignar saldo, editar tablas de créditos ni invocar las operaciones internas de reserva/devolución. Las autorizaciones administrativas se comprueban en cada llamada a la base de datos.

## Implementación y auditoría

La migración `agent_generation_credits` crea `fontex_ai`, un esquema de almacenamiento privado. Sus tablas tienen RLS y no tienen permisos directos para anon/authenticated. Los wrappers expuestos son `SECURITY INVOKER`; sus cuerpos privilegiados están en funciones privadas con `search_path` vacío y comprobaciones de identidad. El servicio Edge es el único autorizado a reservar y confirmar generaciones. La clave administrativa de Supabase nunca se envía al navegador.

El saldo se reserva dentro de una transacción y bajo bloqueo de la cartera. Se admite una generación pendiente por cuenta. Confirmaciones y devoluciones son idempotentes; un resultado ya completado no puede devolverse después ni una devolución repetirse. El historial registra el crédito inicial, asignaciones administrativas, reservas, finalizaciones y devoluciones. Este registro tiene el mismo aislamiento privado.

Si falla la contabilidad de créditos, el modo build no consulta al proveedor. El chat no reserva créditos y sigue disponible con saldo cero, pero ambos modos deben reservar uso en servidor antes de consultar al proveedor. Si falla esa comprobación, se alcanza un límite o el administrador pausa IA, se rechaza la consulta antes de llamar al proveedor. Las reglas del proveedor y su disponibilidad siguen siendo externas a esta política.

## Validación

La batería SQL contrasta alta con cinco créditos, agotamiento tras cinco generaciones, denegación de la sexta, ausencia de renovación diaria, separación por usuario, reembolsos, vencimientos, idempotencia de asignaciones y devoluciones, denegaciones de RLS/permisos y rechazo de metadata manipulada. Una prueba local con ocho conexiones simultáneas dejó sólo una reserva activa, con saldo cuatro, y restituyó exactamente uno al cancelarla.

Los tests de Edge comprueban que no hay llamada al proveedor al agotar saldo, que el chat no consulta carteras y que las respuestas inválidas/fallidas devuelven la reserva. Los tests de interfaz cubren selección de cuenta y asignación, reintento sin duplicar y chat habilitado con saldo cero. Las pruebas SQL y los proveedores simulados no acreditan por sí solos una petición real; la prueba de despliegue se realiza por separado y no requiere gastar cinco llamadas reales.

La verificación de despliegue pasó con dos peticiones reales: chat mantuvo 5 créditos y una generación válida dejó 4. Una cuenta normal recibió denegación al listar usuarios y al intentar reservar directamente por RPC. La comprobación de base confirmó un único administrador, correspondiente a la cuenta autorizada. Las escenas de esta prueba se mantuvieron en memoria.
