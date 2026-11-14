# Lienzo de primitivas componibles — Fontex 0.7.0

El editor principal usa un documento declarativo con nueve familias de primitivas. Las plantillas son combinaciones editables de esos elementos, no componentes programados por tema. `/#/lienzo` es la entrada principal; las rutas anteriores de los laboratorios y del lienzo clásico abren el mismo editor.

## Elementos y alcance

| Primitiva | Representación disponible |
|---|---|
| Plano y cuadrícula | Plano cartesiano, cuadrícula radial/polar, círculo unidad, recta numérica y cuadrícula vacía |
| Función y área | Curvas reales de x, puntos, derivada, tangente, sombreado e integral numérica entre límites o entre dos curvas |
| Vector y segmento | Extremos vinculados a expresiones, flechas, marcas, longitud y ángulo; coordenadas de un plano o píxeles libres |
| Pictogramas | Conteo, arreglos de filas/columnas, elementos activos y grupos; hasta 400 símbolos |
| Texto y fórmula | Markdown, KaTeX y valores reactivos mediante `{{expresión}}`, con fondo transparente o anotaciones |
| Control de variable | Deslizador, incrementos y animación de una variable compartida |
| Figura geométrica | Polígonos regulares e irregulares simples, triángulos, fracciones circulares y sectores; medidas y unidades |
| Tabla y gráfico | Tablas, barras, histogramas, proporciones, dispersión y regresión lineal |
| Trazo y anotación | Dibujo libre, resaltado y notas; puntos simplificados antes de guardar |

Prismas, cilindros, planos inclinados y bloques se muestran como diagramas esquemáticos. No se anuncian como simulación física ni como cálculo 3D. La cuadrícula polar es un escenario radial; las funciones se evalúan como f(x), no como curvas paramétricas ni superficies multivariables.

Hay 22 plantillas iniciales, desde conteo y fracciones hasta trigonometría, ecuaciones, derivadas, integrales y un ejemplo de posición en movimiento rectilíneo uniforme. Sirven para comenzar una escena; no equivalen a cubrir todo un currículo ni a un curso completo de física.

## Edición y presentación

La paleta lateral reúne Chat, Elementos, Plantillas y Variables. Seleccionar un elemento abre sus campos dentro del área del lienzo. Permite modificar expresiones, medidas, colores, posición, tamaño, rotación y paso de presentación. Los textos se escriben sobre el propio lienzo. El alto automático reorganiza los objetos inferiores y el tamaño manual permanece configurable.

En escritorio se puede arrastrar y redimensionar. En móvil se mantiene un flujo vertical legible, sin reducir toda la hoja a una miniatura; la posición, el tamaño y la rotación se conservan en los datos y vuelven a mostrarse al abrir el editor de escritorio. El acceso flotante al chat permanece disponible en móvil.

Presentar oculta las herramientas y revela los elementos por su paso. Flechas izquierda/derecha recorren los pasos; Escape sale. Los controles de variables siguen siendo interactivos. El PDF utiliza un flujo de bloques, incluye todas las explicaciones y permite dividir textos y tablas largos. Es una composición para lectura; no reproduce exactamente cada posición absoluta de la edición.

## Variables y motor local

Las variables tienen nombre, valor, mínimo, máximo, paso y unidad. Se validan nombres reservados, rangos y cantidades finitas. Un control, una figura y un texto pueden leer el mismo nombre sin consultar IA.

Ejemplo: una función `a*x^2`, un deslizador de `a`, una región entre 0 y 2 con resultado `area`, y el texto `Integral aproximada: {{round(area,3)}}`. Al cambiar a, se recalculan la curva, la integral y el texto. Las funciones con nombre también se evalúan en etiquetas, por ejemplo `{{f(2)}}`.

Se reutiliza el parser de AST acotado: aritmética, potencias, pi/e y sin/cos/tan/ln/exp/sqrt. Los contextos añaden variables como `theta` o `x_0`. Los escalares/textos admiten round, abs, min/max, floor/ceil, deg/rad, gcd/lcm; `{{factors(n)}}` muestra factores primos de enteros entre 2 y 1000000. No se ejecutan cadenas JavaScript ni HTML.

La derivada respeta grados/radianes. Las raíces son reales, aproximadas y hasta grado 4. La integración numérica usa Simpson con refinamientos de 200 a 1600 intervalos y devuelve un estado y error estimado. Distingue integral con signo y área geométrica. Puede rechazar valores no definidos, fuera de escala o sin convergencia. Su detección de discontinuidades es limitada: no constituye una demostración del dominio ni garantiza detectar toda singularidad. Las curvas se muestrean; una frecuencia extrema puede ocultar detalle.

## Contrato, IA y guardado

El contrato compartido está en `src/core/primitives/schema.ts`, con Zod como dependencia directa fijada. Un documento tiene `schemaVersion: 2`, `format: primitive-scene`, identidad, título, nivel, variables, primitivas y conversación. Admite hasta 80 primitivas, 24 variables, 80 turnos y 1 MiB por escena.

`studio-agent` sirve el nuevo contrato, incluida la ruta `/studio-agent/primitives`. Chat y construcción usan modelos configurables (`FONTEX_CHAT_MODEL` y `FONTEX_AGENT_MODEL`); la interfaz no muestra nombres de proveedor como texto de relleno. El chat transmite el texto conforme llega. El botón Crear en el lienzo solicita un parche sobre la versión actual.

Las acciones son `upsert_variable`, `add_primitive`, `update_primitive`, `delete_primitive` y `load_template`. Esta última sustituye el contenido y se reserva a peticiones explícitas o escenas vacías. Todo lote se aplica a una copia y se valida completo antes de guardarlo; los errores no dejan acciones parciales. Se comprueban referencias a planos, nombres únicos, límites y expresiones. La IA propone estructuras; el motor local calcula. Las explicaciones libres de la IA pueden contener errores.

Cada escena es una fila privada de `visual_scenes`, con RLS por propietario y revisión compare-and-set. La caché por cuenta usa `fontex-primitives-v2:*`. Los conflictos conservan una copia local. Invitados y cuentas tienen bibliotecas separadas; JSON es el formato portátil. No hay colaboración simultánea ni reapertura offline desde cero garantizada.

## Reinicio del piloto

La migración `replace_test_canvas_with_primitives` retira lógicamente los formatos anteriores y exige escenas v2 en todas las escrituras nuevas. El conector no ejecutó el borrado físico porque su confirmación caducó; los registros históricos quedan fuera de la biblioteca nueva. No importa documentos v1 al nuevo editor. Los clientes antiguos ya no pueden volver a guardar esos sobres en `visual_scenes`. La restricción se añade con `NOT VALID` para conservar los registros existentes, mientras protege todas las nuevas inserciones y actualizaciones.

La aplicación elimina las cachés retiradas del lienzo al iniciar. No modifica sesiones de Auth, cuentas, preferencias de tema, documentos de la biblioteca ni datos académicos. Los lectores y renderers del editor anterior se conservan como código histórico y pruebas, pero no forman parte de la ruta ni del agente activos del lienzo.

Respaldo del código anterior: `respaldo/pre-primitivas-2026-11-14`, commit `930dcb9`. La propuesta original está en [el plan aportado](plans/v0.7-primitivas-propuesta.md).

## Validación

Ejecutar lint, TypeScript, Vitest y build del frontend. Las pruebas del núcleo contrastan áreas e integrales con resultados conocidos, revisan discontinuidades, polígonos cruzados/cóncavos, variables y parches atómicos. El handler se prueba con proveedor simulado, incluidos streaming, autenticación y rechazo de referencias inválidas. Las pruebas SQL verifican propietario, revisiones, rechazo de formatos retirados, límites y aislamiento.

Las pruebas de navegador cubren creación de las nueve familias, actualización de integral/texto con un control, deshacer, recarga, presentación y PDF en vistas de escritorio y móvil. Una prueba simulada del handler no acredita por sí sola el funcionamiento del proveedor real; esa verificación debe registrarse por separado.
