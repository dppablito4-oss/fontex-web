# Organización del editor de lienzos

Actualización del 14 de noviembre de 2026. El editor conserva la paleta clara y oscura AMOLED y organiza sus herramientas para reservar espacio al lienzo y a la conversación.

- **Pestañas superiores:** muestran los lienzos guardados; el botón `+` crea uno vacío. Se desplazan horizontalmente cuando no caben. Guardar o renombrar no cambia el orden de las pestañas. Flechas izquierda/derecha, Inicio y Fin permiten recorrerlas con el teclado.
- **Archivo:** título, nuevo lienzo, importar/exportar JSON, PDF y eliminación con confirmación. La eliminación conserva las comprobaciones de guardado y de revisión del servidor.
- **Elementos, Plantillas y Variables:** opciones desplegables bajo la barra superior, con iconos y nombres. Se cierra un menú al elegir una herramienta, pulsar Escape o salir de él; Escape devuelve el foco al botón que lo abrió.
- **Panel derecho:** conversación con Fontex y su compositor, sin la biblioteca de archivos ni pestañas de herramientas. El saldo y su explicación se agrupan en un desplegable. Seleccionar un elemento abre sus propiedades en ese mismo panel; Chat y Propiedades permiten alternar sin añadir otra columna. La conversación y el borrador se conservan.
- **Presentación:** acceso directo naranja; archivos y herramientas quedan fuera de la vista presentada y de la impresión.
- **Móvil:** pestañas desplazables, herramientas agrupadas y panel derecho superpuesto que puede cerrarse. El lienzo mantiene su representación móvil y sus controles actuales.

Crear un lienzo o abrir otro reinicia selección e historial de deshacer del editor. El contenido de los demás lienzos se conserva. Cada pestaña mantiene su propio borrador de chat durante la sesión; los mensajes aún no enviados no se guardan como conversación. Las pestañas usan el catálogo existente y cargan los documentos remotos con el mismo mecanismo de sincronización; no se modifica el formato de escenas ni la estructura de Supabase.

Las pruebas de interacción comprueban navegación con teclado, orden estable, cierre de desplegables, conservación de borradores y cambio de lienzo sin mezclar contenido ni historial. La revisión visual en el navegador compartido quedó pendiente al detectar actividad manual; las pruebas de DOM no se presentan como capturas visuales ni como comprobación de geometría responsive.
