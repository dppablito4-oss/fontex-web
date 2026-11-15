# Práctica dentro del lienzo

El editor conserva las diez familias anteriores y añade `answer_field` (Respuesta del alumno). El botón **Practicar** crea un JSON con identidad nueva en la biblioteca del usuario, borra respuestas previas del nuevo intento y conserva la escena de origen. Finalizar práctica vuelve al editor de esa copia; se puede volver al original desde su pestaña.

El docente configura **Propiedades → Valores que puede cambiar el alumno**. Cada primitiva guarda opcionalmente `interaction.fields`, una lista de rutas de campos. No hay campos habilitados implícitamente salvo la respuesta del alumno. El catálogo de campos editables controla tanto la interfaz como la aplicación de cambios; rechaza rutas arbitrarias y valida la escena completa antes de guardar.

- Plano: límites de los ejes.
- Función: expresión, parámetro, punto de tangencia e intervalo cuando corresponda.
- Vector: coordenadas de inicio y final.
- Pictogramas: filas, columnas y cantidad.
- Texto: sólo variables interpoladas habilitadas; la definición Markdown permanece fija.
- Control: valor de su variable, con rango e incrementos.
- Figura: medidas, vértices o numerador/denominador según la figura.
- Tabla/gráfico: celdas numéricas o expresiones; matriz original editable por celda. Inversa, resultados y cabeceras permanecen fijos.
- Nodos: entradas booleanas o pesos numéricos habilitados; topología y rótulos permanecen fijos.
- Trazo: dibujo cuando se autoriza `points`; el texto de la nota permanece fijo.
- Respuesta: texto/desarrollo, número o expresión; la consigna es fija.

Los cambios se aplican con Enter o ✓. Escape y tocar fuera cancelan el borrador. Los valores inválidos muestran un mensaje y conservan el estado válido. Las respuestas se guardan para revisión: no existe todavía calificación automática ni entrega vinculada a las sesiones del aula. La copia personal usa el guardado privado existente; el modo de práctica no sustituye la autorización de futuras actividades de aula en el servidor.

Hay cuatro plantillas de práctica guiada: recta, fracción, tabla y grados/radianes. Las nuevas propuestas del agente reciben instrucciones para habilitar sólo lo pedido y añadir un bloque de respuesta cuando corresponde. Escenas antiguas sin permisos permanecen fijas hasta que el autor habilite sus valores.

## Unidades angulares

`rad(x)` y `deg(x)` se admiten en el parser de expresiones, el evaluador escalar, las curvas y las derivadas. En `angleUnit: deg`, `sin(x)` interpreta x en grados. En radianes, `sin(rad(x))` convierte x explícitamente. Las conversiones explícitas a radianes en el argumento de una función trigonométrica no reciben una segunda conversión automática. El parámetro de una curva polar conserva la convención `angleUnit`.

Verificación: permisos y rechazo de modificaciones a consignas en todas las familias; fracciones con denominadores inválidos; celdas y matrices; entradas lógicas; conservación del original; conversiones y derivadas; curvas paramétricas y polares; pruebas de navegador en móvil y escritorio con respuestas y edición inline.
