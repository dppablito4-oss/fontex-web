# Primitivas y expresiones v0.9.5

La construcción podía devolver JSON completo y fallar al validarlo porque el
compilador de curvas interpretaba `floor` como variable. Los campos escalares
ya admitían ese helper; el lenguaje de las curvas era más limitado.

Se comparten ahora las operaciones numéricas y sus límites entre ambos caminos:
`abs`, `floor`, `ceil`, `round`, `min`, `max`, `atan2`, `gcd` y `lcm` funcionan en
curvas, medidas, pictogramas, tablas e interpolaciones. Admiten anidación y
parámetros; `min/max` aceptan hasta 32 argumentos. Se mantienen los límites de
longitud, tokens y profundidad, y la evaluación no ejecuta JavaScript.
Los helpers discretos o por tramos no ofrecen derivada simbólica.

Las expresiones aceptan `sen`, `log`, `π` y `θ` como alias de `sin`, `ln`, `pi` y
`theta`. El parámetro se declara con el nombre ASCII `theta`; no se cambia la
convención de radianes/grados existente.

Capacidades generales añadidas:

- Polígonos regulares: `sidesExpr` controla entre 3 y 24 lados y `rotationExpr`
  el ángulo inicial en grados. La longitud se conserva en `sideExpr`. Sin los
  campos nuevos se mantiene la geometría anterior.
- Tablas y gráficos: `chartType: "line"` conecta los datos en el orden de las filas.
- Nodos: `formula` opcional muestra Markdown/LaTeX con interpolaciones dinámicas.

Se retira el reconocimiento por huella de la petición de cinemática y su plantilla
integrada. Todas las peticiones de construcción vuelven al generador habitual;
no hay ejercicios nuevos incrustados ni cambios de PostgreSQL. Las fixtures de
prueba se usan exclusivamente en pruebas, nunca como respuestas de producción.

Las pruebas cubren los once tipos de primitivas, curvas y escalares con las mismas
operaciones, alias, áreas entre curvas y cambios de radio, lados y ángulo, además
de la actualización de líneas y fórmulas de nodos en la interfaz. No llaman al
proveedor de IA. Esto comprueba el motor, sin garantizar que toda futura respuesta
del modelo sea válida.

El contrato del agente pasa a `primitive-agent-v6`, manteniendo el contrato SQL v4
y Terra 6.1 para construir.
