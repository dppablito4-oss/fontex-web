# Generaciones extensas — v0.9.3

El ejercicio de cinemática con controles, área bajo la curva, móvil, vectores, tabla, barras, nodos, respuestas y trazos excedía el plazo anterior. Las generaciones tenían un máximo de 8.000 tokens de salida, 75 segundos en servidor y 85 segundos en el navegador.

Las construcciones disponen ahora de 32.000 tokens de salida, 125 segundos en servidor y 140 segundos en el navegador. Las reservas de uso y de crédito duran 180 segundos, también para invitados. Son plazos separados: consultar el saldo durante una construcción extensa no debe devolver prematuramente su crédito. Los fallos y las reservas abandonadas siguen teniendo reembolso idempotente.

El chat mantiene 2.048 tokens de salida y sus plazos anteriores. Las cuotas de créditos, concurrencia y uso diario se conservan. El presupuesto de entrada usa una estimación conservadora de tokens en lugar de contar cada byte del JSON como un token.

La conexión SSE recibe comentarios de mantenimiento cada diez segundos, incluso mientras el modelo genera acciones después del mensaje introductorio. La interfaz muestra «generando y validando» hasta recibir y aplicar la propuesta completa; el texto parcial del modelo no puede afirmar que el dibujo ya está listo.

No es un plazo ilimitado: el trabajador gratuito de Supabase tiene un máximo de 150 segundos. El margen del servidor permite validar la escena y conservar su resultado antes de ese corte. Véanse los [límites de Edge Functions](https://supabase.com/docs/guides/functions/limits).

La solicitud de cinemática se completó en una prueba real en 80,21 segundos, con 30 acciones y 27 primitivas. La comprobación en navegador cambia los controles al caso v0=4, a=2, T=5 y verifica v(T)=14 y desplazamiento=45. Las tablas admiten tres encabezados para mostrar etiqueta, xExpr y valueExpr; así la velocidad no se pierde al mostrar también tiempo y desplazamiento. El caso se conserva en `e2e/fixtures/kinematics-scene.json`.

Los enlaces de grafos con colores condicionales y la calificación automática de las respuestas siguen fuera del contrato del editor. El agente comunica esas limitaciones y no promete una simulación física ni una evaluación automática inexistentes.

Pruebas de regresión: transporte activo después del plazo anterior, mensaje de construcción confirmado solo al aplicar objetos, reservas que permanecen activas a los 130 segundos, reembolso posterior al abandono, tabla vinculada de tres columnas y lectura del ejercicio completo en móvil y escritorio.
