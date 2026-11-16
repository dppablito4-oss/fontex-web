# Construcción de lienzos v0.9.4

Nota: v0.9.5 retira la plantilla integrada y la reutilización de peticiones descritas
aquí. Véase [Primitivas v0.9.5](PRIMITIVAS-V095.md) para el comportamiento vigente.

La petición completa de cinemática podía terminar con acciones que solo creaban
variables y dejaban el lienzo vacío. El intento reportado falló a los 23,6 segundos;
ampliar tokens y tiempo en v0.9.3 no solucionaba esa respuesta incompleta.

## Correcciones

- Al construir sobre un lienzo vacío, el contrato del proveedor exige al menos una
  primitiva y separa objetos de variables. Se convierte a las acciones habituales
  antes de validar, aplicar y cobrar. Editar una composición existente conserva el
  contrato de acciones.
- La validación utiliza el mismo ámbito calculado que el renderizador: un vector,
  una tabla o un texto pueden referenciar el resultado de un área definida antes.
- `min` y `max` admiten entre uno y 32 argumentos. Los parámetros pueden llamarse
  `T`; los nombres reservados siguen protegidos sin distinguir mayúsculas.
- El límite de 64 acciones permite combinar las 40 primitivas y 24 variables
  admitidas por la construcción inicial. No se amplía el límite de la escena.
- Los registros incluyen cantidades de objetos y tokens del proveedor para
  distinguir respuestas incompletas, problemas matemáticos y límites de ejecución.

## Composición de cinemática revisada

`Plantillas → Cinemática: área y movimiento` abre 27 objetos vinculados y tres
controles, sin usar IA. Con velocidad inicial 4, aceleración 2 y tiempo 5, muestra
velocidad 14 y desplazamiento 45. Incluye plano, área, móvil, vectores, tabla,
barras, texto, diagrama y espacio de respuesta/trazo.

La petición original completa también reutiliza esa composición sin reservar
créditos ni llamar al proveedor. Se reconoce por la huella de su texto normalizado
únicamente sobre un lienzo intacto. Las peticiones distintas y las ediciones
siguen pasando por el generador. Esta reutilización se comunica en la respuesta;
no demuestra que el modelo pueda resolver siempre cualquier petición equivalente.

Los enlaces no tienen colores condicionales y las respuestas del alumno no se
califican automáticamente; la composición lo indica expresamente.

## Validación

Pruebas de contrato para construcción inicial, rechazo de respuestas vacías,
reutilización sin proveedor/cobro y preservación de peticiones personalizadas.
Pruebas matemáticas de parámetros `T`, nombres reservados, extremos variádicos y
referencias al área calculada. Pruebas de navegador para la composición y su
apertura desde Plantillas en móvil, escritorio claro y escritorio oscuro.

El contrato público del agente pasa a `primitive-agent-v5`; el contrato SQL
`closed-beta-v4` mantiene sus verificaciones dinámicas. No requiere migración SQL.
