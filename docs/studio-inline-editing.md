# Edición directa en Fontex Studio

Los valores de entrada se editan en su representación en el lienzo y en la vista ampliada. No hay que seleccionar un objeto ni pulsar «Aplicar cambios». Los resultados, los gráficos y la explicación se calculan desde el mismo `MathObject`. El panel lateral queda para el asistente.

- Aprender y Resolver permiten editar; Practicar y Presentar conservan la representación de solo lectura. El reproductor de lecciones y la exportación PDF tampoco incluyen controles.
- Cada valor válido se guarda inmediatamente con el almacenamiento existente. Los borradores incompletos o inválidos permanecen solo en el campo, muestran un aviso y no modifican el documento. Al salir de un campo inválido se recupera el último valor válido.
- Enter termina una edición; Escape restaura el documento anterior a enfocar el campo. En texto multilínea, Enter añade una línea y Ctrl/Cmd+Enter termina. Deshacer/Rehacer agrupan los cambios realizados durante un mismo enfoque. Una acción externa, como una propuesta del asistente, termina el grupo y conserva su propio paso de historial; Escape no la elimina.
- Nombre, datos y opciones se editan dentro del objeto. Posición y tamaño siguen disponibles mediante arrastre y sus controles de teclado.
- Las unidades cambian juntas cuando se cambia de magnitud. Moneda/dado fijan dos/seis resultados; ruleta permite editarlos. Una raíz acepta solo radicandos con resultado entero dentro de los límites del motor.

## Añadir un módulo o parámetro

1. Declarar el dato y su validación en el esquema y el motor matemático.
2. Añadir su contrato en `inline-fields.ts`. El tipo `Contracts` exige una entrada por cada módulo y dato (excepto `stage`, que se recorre con los pasos de la lección).
3. Colocar `InlineValue` donde se representa la entrada, usando el nombre de su campo y un valor de solo lectura. `InlineEquation` y `InlineSvgValue` cubren expresiones y medidas sobre SVG. Reservar `InlineOnly` para opciones adicionales sin equivalente en la salida impresa. No hacer editables resultados calculados.
4. Incluir un caso de edición y recuperación en `InlineEditing.test.tsx`. La comprobación del contrato recorre automáticamente todos los módulos y exige que sus campos se ofrezcan en el lienzo.

El proveedor de edición pertenece al lienzo, no al motor ni al renderizador de lectura. Al no existir ese proveedor, los componentes imprimen texto/SVG normales. El documento JSON y los materiales guardados conservan el mismo esquema; no se necesita migración de datos ni una llamada de IA para editar.
