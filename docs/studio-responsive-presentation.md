# Presentación y distribución adaptable

El recorrido del material y la vista ampliada se centran explícitamente en la pantalla. En escritorio, el marco conserva una proporción 16:9, limitada por el ancho y el alto disponibles. Cabecera y navegación permanecen visibles; el contenido largo se puede desplazar. Se elimina la dependencia del margen nativo de `<dialog>`, que el reset global había anulado.

En funciones, la fórmula y una leyenda encabezan el bloque. La gráfica ocupa dos tercios y los coeficientes, la tabla y la explicación comparten el tercio derecho. La explicación conserva los pasos interactivos. Los ajustes de expresión, ventana y puntos se agrupan en **Ajustes de la gráfica**. La tabla admite desplazamiento para listas largas; las tablas de cinco puntos del ejemplo se ven completas en las pantallas comprobadas.

Los otros módulos sitúan la representación a la izquierda y la explicación a la derecha a partir de 900 px de ancho de contenido. Estadística agrupa media, mediana y moda en una fila; factores primos compacta sus divisiones; los diagramas se ajustan al alto disponible de la presentación. Las resoluciones extensas se desplazan dentro de su panel conservando la representación al lado. El lienzo sigue admitiendo movimiento, tamaño y guardado de objetos.

En contenedores estrechos las partes vuelven a una columna. En teléfonos, el recorrido aprovecha el alto de la pantalla y mantiene un único flujo vertical para las explicaciones. La impresión y el PDF conservan la gráfica, sus datos y pasos sin limitar la altura de las tablas.

La jerarquía visual distingue la acción principal, los controles secundarios y los datos matemáticos: Presentar y avanzar usan un acento violeta, Módulos tiene un fondo tintado, el modo activo se distingue de los demás y las tarjetas tienen borde y superficie propios. Los colores matemáticos de función y derivada se conservan y se identifican con una leyenda.

## Comprobación

- 503 pruebas frontend aprobadas; 7 integraciones remotas omitidas. Lint, TypeScript y compilación de producción comprobados.
- Chrome real, con contextos de prueba aislados y sin sesión de cuenta: 1920×1080 en oscuro, 1366×768 en claro y 430×900 para teléfono.
- Recorrido de los 21 tipos de módulo en Aprender y Resolver en ambas pantallas de escritorio: 84 vistas comprobadas. Sin desbordamiento horizontal ni desbordamiento vertical del marco principal para los datos predeterminados; las explicaciones largas tienen desplazamiento propio.
- Proporción 2:1 entre área de gráfica y panel de datos; gráfica y cinco filas de puntos dentro del área visible. Marco de 1800×1012,5 en la pantalla grande y 1308×736 en portátil, centrado y con navegación visible.
- Vista ampliada y presentación a pantalla completa comprobadas. En teléfono se verificaron orden vertical y ausencia de desbordamiento horizontal. Capturas revisadas y sin errores de JavaScript.
- Prueba de componente para conservar tabla y explicación interactiva en el mismo panel de función; exportación PDF sin controles editables.

Este cambio modifica la interfaz y la composición visual. No cambia el contrato matemático, la base de datos ni los datos guardados por cuenta; no necesita despliegues de funciones del backend.
