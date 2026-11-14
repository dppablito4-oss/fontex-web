# Funciones reales en el lienzo libre

La petición mostrada en las capturas terminaba en una tarjeta de texto porque el contrato de Studio solo admitía sus módulos anteriores. El motor de expresiones existía en el laboratorio, pero el lienzo libre y su IA lateral todavía no tenían un objeto para dibujarlo.

El nuevo objeto `function-graph` usa ese mismo parser, evaluador y derivador. Se crea desde **Módulos → Funciones → Gráfica de función**, o mediante la IA lateral:

> Grafica el seno en grados entre 0 y 360, con los puntos 0, 90, 180, 270 y 360. Añade una explicación breve.

La gráfica, sus parámetros y sus puntos permanecen editables dentro del lienzo. Se conservan el movimiento, tamaño, deshacer, guardado por cuenta en `visual_scenes` e importación/exportación JSON. La exportación a PDF incorpora el SVG de la curva y sus puntos, además de la tabla y los pasos.

## Datos y unidades

| Campo | Función |
|---|---|
| `source` | Expresión real de x, hasta 500 caracteres, con el vocabulario del laboratorio |
| `angleUnit` | `degrees` o `radians`, aplicado a los argumentos de sin/cos/tan |
| `xMin`, `xMax`, `yMin`, `yMax` | Ventana entre −10000 y 10000, con intervalos de al menos 0,001 |
| `a`, `b`, `c` | Parámetros entre −5 y 5 |
| `pointXs` | Hasta 24 abscisas distintas; el motor calcula las ordenadas |
| `showDerivative` | Muestra la derivada respecto a la x de esa unidad |

Para el seno en grados, la expresión es `sin(x)` y `angleUnit` vale `degrees`. El motor introduce π/180 dentro de cada argumento trigonométrico; no se debe añadir una segunda conversión en la expresión. La derivada usa el mismo árbol convertido y, por tanto, incluye el factor de cadena correcto. Las alturas trigonométricas son adimensionales.

Los puntos del ejemplo se calculan como (0°, 0), (90°, 1), (180°, 0), (270°, −1) y (360°, 0). El formato visible redondea residuos de coma flotante próximos a cero. Los valores no definidos se marcan explícitamente, no se sustituyen por alturas inventadas.

## Generación y límites

`studio-agent` anuncia el nuevo tipo tanto al conversar como al crear, con todos sus campos en el esquema. El contrato de generación usa objetos y campos obligatorios conforme a [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas); los límites matemáticos y de longitud vuelven a validarse en servidor y navegador. Las limitaciones antiguas que figuren en el historial no sustituyen el catálogo actual.

Una petición clara de gráfica, incluida la orden de crear lo acordado tras solicitarla en el historial, no se acepta como cumplida si devuelve únicamente una tarjeta de texto. Se solicita una corrección al proveedor; si vuelve a incumplir, no se aplica el lote. Las solicitudes explícitas de texto continúan permitidas.

El trazado usa 720 intervalos de muestreo y separa valores no definidos, saltos y asíntotas visibles de la tangente. Es una aproximación numérica: una ventana demasiado amplia o una frecuencia elevada puede ocultar detalles. No equivale a un análisis completo del dominio ni a una representación exacta de todos los puntos. En modo práctica se ofrece exploración y comparación de valores; no se califican automáticamente respuestas exactas de estas funciones.

## Verificación

- 495 pruebas frontend aprobadas y 7 integraciones remotas omitidas; lint, TypeScript y compilación comprobados.
- 19 pruebas del handler de Studio, con proveedor simulado, incluidas creación de seno en grados, contexto con una limitación antigua, rechazo de texto como gráfica y rechazo de código ejecutable.
- Comprobaciones numéricas del seno/coseno en grados y radianes, derivadas comparadas con diferencias finitas, dominio de ln y separación de las ramas de tan.
- Pruebas de la paleta real, puntos SVG, edición, deshacer, reapertura y SVG exportado a PDF.
- No se realizó una llamada pagada al proveedor ni una inspección visual manual de esta ampliación.

Esta ampliación no copia, elimina ni modifica materiales anteriores mediante SQL. La IA solo cambia el documento cuando el usuario solicita crear o editar y se valida el lote completo.
