# Editor de primitivas y persistencia

Revisión: 22 de noviembre de 2026. Se conserva el nombre de este archivo para no romper enlaces. La descripción de Studio v1 está en [el archivo histórico](../archive/studio-pre-v1.md).

## Contrato actual

`src/core/primitives/schema.ts` valida escenas `primitive-scene`, `schemaVersion: 2`. Cada elemento tiene identidad, posición, tamaño, estilo, paso de presentación e interacción autorizada, además de sus datos específicos.

| Familia | Uso |
| --- | --- |
| `coordinate_canvas` | Planos, cuadrículas y rectas |
| `function_region` | Curvas cartesianas, paramétricas/polares y áreas cartesianas |
| `vector_segment` | Vectores y segmentos |
| `stamp_grid` | Pictogramas y agrupación |
| `math_block` | Markdown/LaTeX e interpolaciones |
| `control_slider` | Variables y controles |
| `geometric_shape` | Figuras 2D y fracciones |
| `solid_3d` | Cuerpos XYZ, cámara y medidas |
| `data_chart` | Tablas, gráficos, matrices y tablas de verdad |
| `node_graph` | Relaciones y circuitos lógicos |
| `annotation_stroke` | Trazos y notas |
| `answer_field` | Respuestas del alumno |

La escena admite 80 elementos, 24 variables y hasta 1 MiB. Una respuesta del agente admite 64 acciones; una construcción inicial puede contener 40 elementos y 24 variables. Los valores calculados se obtienen localmente; las expresiones no ejecutan JavaScript.

El parser compartido está en `src/core/scene/expression.ts`. El motor de primitivas incorpora escalares, trigonometría, derivadas admitidas, integración numérica y cantidades geométricas. Los helpers discretos o por tramos no ofrecen derivada simbólica. Los cuerpos 3D tienen fórmulas de área y volumen, sin simulación física. [Contrato 3D](../CUERPOS-3D-V100.md).

## Edición y práctica

`PrimitiveCanvas` coordina selección, propiedades, pestañas, historial y presentación. `PrimitiveVisual` representa las familias; `PrimitiveFields` y los campos avanzados editan el contrato. El texto se edita en Propiedades con vista de fórmulas. En móvil, los paneles se cierran al pulsar fuera.

`interaction.fields` habilita únicamente entradas concretas del problema. Las consignas, estilos, estructura y resultados calculados no son respuestas editables. `validatePracticeAttempt` reconstruye la entrega desde el original y rechaza cambios no autorizados. La cámara 3D del lector es local y no modifica el documento del docente.

## Guardado

`usePrimitiveStore` mantiene el espacio bajo `fontex-primitives-v2:<propietario>`, donde el propietario es una cuenta o el invitado local. Las pestañas cerradas se recuerdan por separado. Las escenas conservan identidad propia, versión de esquema y fecha.

Con sesión y backend configurados se sincroniza `visual_scenes`. Se comparan revisiones mediante RPC; un conflicto no debe sobrescribir silenciosamente el trabajo ajeno o una versión más reciente. Los tests comprueban paginación, guardados, cierres, reinicios, aislamiento y conservación de copias ante conflictos.

Las escenas de formatos retirados no se interpretan como primitivas. Retirar el código de sus editores no elimina los datos que aún existan. No hay un convertidor general de documentos Studio v1 a primitivas v2.

## Construcciones y recuperación

Las llamadas de construcción tienen identidad y recibo. `useBuildRecovery` recupera resultados pendientes y los aplica contra el estado de origen; si la escena cambió, puede crear una copia recuperada. `appliedBuildIds` evita aplicar el mismo resultado repetidamente. [Agente y créditos](fontex-agent.md).

## Presentación, enlaces y PDF

La secuencia pedagógica comparte orden entre editor, móvil, presentación y PDF. `exportCanvasPdf` usa jsPDF y una lectura clara de la escena: descarga el archivo sin abrir la impresión del navegador. Incluye marca, título, URL y QR; si hay enlace compartido, el QR abre esa lectura pública.

La publicación pública usa un token y una instantánea. No convierte todos los lienzos de la cuenta en públicos. El PDF representa vistas fijas; las variables y la interacción 3D se exploran en Fontex.
