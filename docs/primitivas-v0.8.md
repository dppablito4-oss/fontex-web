# Fontex v0.8.0 — Base matemática para probar el MVP

Integra la parte II del [roadmap aportado](plans/v0.8.0-roadmap-propuesto.md). La consolidación v0.7.1 ya estaba en `f74f2cc`: no se repite la limpieza ni se vuelven a borrar datos. Respaldo estable: `respaldo/pre-v0.8.0-2026-11-14`.

El catálogo pasa de nueve a **diez familias**, con la única incorporación `node_graph`. Hay **36 plantillas**: las 25 existentes más once composiciones de ejemplo. No son módulos cerrados ni una afirmación de cobertura porcentual de un currículo.

## Curvas paramétricas y polares

`function_region` conserva el modo cartesiano por defecto. Los campos nuevos son opcionales para mantener las escenas v2 anteriores:

- `curveMode: cartesian | parametric | polar`.
- Paramétricas: `xExpr`, `yExpr`, con parámetro local `t`.
- Polares: `rExpr`, con parámetro local `theta`. Un radio negativo coloca el punto en la dirección opuesta.
- `parameterFromExpr`, `parameterToExpr` delimitan el intervalo; `parameterValueExpr` permite un punto móvil vinculado a una variable compartida.
- `angleUnit` gobierna las funciones trigonométricas y la conversión del parámetro polar. Los ejemplos usan radianes, salvo elección explícita.

El muestreo compila las expresiones una vez por curva y está acotado. Divide segmentos ante valores no finitos y saltos detectados, y recorta mediante SVG. No garantiza detectar cualquier discontinuidad o detalle de frecuencia extrema. La derivada, tangente y área actuales permanecen limitadas al modo cartesiano; el validador rechaza activarlas en los modos nuevos en vez de mostrar un área con significado incorrecto.

Las composiciones incluyen elipse, hipérbola con dos ramas, rosa polar y trayectoria de proyectil. El tiro es un modelo ideal sin rozamiento y con parámetros explícitos, no un simulador físico general. Los controles actualizan dibujo y explicaciones sin peticiones IA adicionales.

## Conjuntos, proposiciones y circuitos

El parser de `logic.ts` admite `!`, `&&`, `||`, `->`, `<->` y sus equivalentes ¬, ∧, ∨, →, ↔. La implicación se agrupa a la derecha. Hay precedencia de conectivos, paréntesis y límites de 300 caracteres, 96 tokens, profundidad acotada y cuatro proposiciones. No ejecuta JavaScript.

- `control_slider.controlType = toggle` trabaja con variables de valor 0/1, mínimo 0, máximo 1 y paso 1. Convertir un control desde sus campos ajusta ese rango de forma atómica.
- `data_chart.chartType = truth_table` usa `logicVariables` y `logicExpression`. Genera hasta 16 filas y destaca la combinación de los controles. Puede usarse como tabla estática sin declarar variables de usuario; en ese caso no hay fila activa.
- `geometric_shape.shape = venn_2 | venn_3` reutiliza la expresión y nombres lógicos, con `setLabels`. El sombreado es el conjunto de combinaciones verdaderas, incluida la región exterior para complementos. Un punto marca la combinación actual cuando hay variables declaradas.
- `node_graph` contiene nodos y conexiones, con modo `relations` o `logic`. Permite árboles y relaciones generales; en lógica admite entradas, AND, OR, NOT y salida. Las entradas pueden pulsarse y comparten estado con los interruptores y tablas.

Los circuitos lógicos son acíclicos. AND/OR necesitan de dos a cuatro entradas; NOT/salida necesitan una. Cada entrada requiere una variable booleana. Se validan identidades, referencias y conexiones duplicadas. Hay hasta 32 nodos y 64 conexiones por diagrama. La altura fija de un objeto actúa como mínimo cuando el contenido necesita más espacio: el editor amplía el marco y desplaza los objetos inferiores, evitando que una tabla tape un diagrama. En móvil se conserva el flujo natural. El editor de nodos aplica sus cambios como un lote validado, permitiendo preparar varias conexiones antes de guardarlas.

Las aristas muestran señales de origen activas; AND representa conexión ideal en serie y OR, en paralelo. No calcula voltaje, corriente ni comportamiento electrónico temporal. Las etiquetas de probabilidades en árboles son explicativas; no se normalizan ni multiplican automáticamente.

## Matrices y transformaciones

`data_chart.chartType = matrix` usa `matrixName`, `matrixCells` y `showInverse`. Soporta matrices cuadradas numéricas 2×2 y 3×3. Las celdas pueden leer variables compartidas; no hay dependencias entre matrices ni celdas que dependan de resultados de integrales.

- `det(m)` devuelve el determinante.
- `inv(m,fila,columna)` devuelve una entrada de la inversa, con índices desde 1.
- `{{inv(m)}}` muestra la inversa completa en un texto.
- El motor numérico también expone `inverse(matrix)` como matriz completa. Detecta singularidad o pivotes numéricamente inestables y devuelve ausencia de inversa.

Vectores, polígonos y triángulos pueden enlazar `transformMatrixId` a una matriz 2×2; `transformInverse` selecciona la inversa. El plano puede usar `equalScale` para conservar la escala entre ejes. La transformación directa puede colapsar una figura si el determinante es cero; se sigue mostrando sin inventar una inversa. Al eliminar una matriz se retiran sus enlaces de transformación. Una matriz 3×3 sirve para cálculo de álgebra lineal, no se interpreta como transformación afín homogénea del plano.

Los cálculos usan números de punto flotante, no un CAS simbólico. El ejemplo 3×3 muestra un sistema concreto por multiplicación con la inversa; no promete resolver todo tipo de sistemas o demostrar resultados simbólicamente.

## Presentación

La barra muestra progreso por grupos de `presentationStep` realmente usados, sin recorrer números vacíos. Flechas izquierda/derecha avanzan o retroceden, Home/End van al primer/último grupo y Escape sale. Los hijos de un plano esperan a que su padre sea visible; los cálculos siguen utilizando la escena completa, aunque una matriz todavía no se haya revelado visualmente. Se ocultan edición y manijas, conservando controles interactivos.

## Persistencia y agente

Se mantiene `schemaVersion: 2`, `format: primitive-scene`, 80 primitivas, 24 variables, 80 turnos y **1 MiB por escena**. Nodos, tablas, matrices y curvas se guardan dentro del mismo JSON privado en `visual_scenes`. No hizo falta alterar la base ni sus permisos: siguen vigentes la RLS por propietario y las revisiones de guardado. No hay colaboración simultánea.

El agente recibe el contrato extendido y las reglas de cada modo. Las propuestas se validan y aplican de forma atómica en servidor y cliente. La IA no genera código ejecutable. Sus explicaciones libres siguen necesitando revisión, y una estructura válida no demuestra que toda explicación sea matemáticamente correcta.

## Validación y beta

La batería local comprueba precedencia y equivalencia lógica, las 16 combinaciones de cuatro proposiciones, concordancia de circuitos con tablas, rechazo de ciclos, determinantes/inversas conocidos, recuperación de puntos transformados, casos singulares, extremos de curvas, radios negativos, discontinuidades muestreadas y navegación de pasos salteados. Se conservan los casos anteriores y los roundtrips de las 36 plantillas.

Chrome a 1440/390 píxeles comprueba curvas y marcador móvil, Venn, tabla/circuito/interruptores coherentes, matriz reactiva y caso singular, tabla de 16 filas, teclado en presentación, PDF y ausencia de desbordamiento horizontal. Es una prueba de viewport móvil, no una prueba en hardware físico.

La batería de proveedor real pasó el 14 de noviembre de 2026 generando las tres escenas sin atajos de plantilla. `npm run test:agent:beta` hace **tres consultas pagadas** con consentimiento `FONTEX_RUN_PAID_AGENT_TESTS=1`. Genera estructuras nuevas (sin cargar plantillas): paramétrica/polar, Venn/tabla/circuito y matriz con figura enlazada. Conserva las escenas sólo en memoria salvo que se configure una carpeta de artefactos de QA. Usa las mismas credenciales de prueba documentadas en v0.7.1, cierra su sesión local y tiene una opción separada en el workflow manual de integraciones remotas.

Las siete integraciones académicas de aulas/PDF/tutor siguen requiriendo una clave administrativa de pruebas y no se habilitan con secretos en cada push. Su alcance y requisitos están en [v0.7.1](primitivas-v0.7.1.md).

Esta versión prepara el MVP técnico para evaluación. No cambia por sí sola la inscripción pública por un sistema de invitaciones ni envía invitaciones a testers. La beta cerrada puede usar cuentas de prueba confirmadas y un grupo definido por el propietario; su acceso se configura por separado. El material debe evaluarse con docentes/estudiantes antes de afirmar cobertura curricular o calidad pedagógica global.
