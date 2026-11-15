# Lienzos personales, PDF y lectura pública

Los JSON de las cuentas autorizadas continúan sincronizándose en `visual_scenes` con RLS y control de revisiones. Las pestañas representan los documentos cargados y abiertos; cerrar una pestaña no elimina un documento guardado. Archivo → Abrir mis lienzos y Biblioteca → Mis lienzos personales permiten volver a abrirlo por título.

Al cerrar se puede guardar, cancelar o descartar los cambios desde la versión abierta/guardada manualmente. Descartar un lienzo nuevo elimina su borrador. Sin conexión o ante un fallo de guardado, una cuenta conserva la pestaña abierta. Los invitados guardan sólo en el navegador.

Una construcción que conserva un título genérico recibe el primer encabezado generado, o un nombre derivado del pedido. Archivo permite editarlo manualmente; los títulos personales se conservan.

PDF genera el archivo en el navegador con jsPDF, captura del contenido matemático renderizado y paginación A4. El contenido del lienzo se rasteriza; se preservan las fórmulas y dibujos visualmente, pero su texto no es seleccionable. El encabezado contiene el símbolo y nombre Fontex, título y dominio; el QR final lleva el símbolo incrustado con corrección H. Las dependencias de exportación se cargan al descargar.

«Compartir este lienzo mediante el QR» es opcional y requiere cuenta. Guarda una copia explícita en `canvas_public_shares` omitiendo la conversación y los identificadores de solicitudes IA. El enlace usa un UUID aleatorio y abre `#/compartido/:token` sin autenticación, en solo lectura. Una nueva exportación compartida actualiza la copia y conserva el enlace. Archivo → Desactivar enlace público lo revoca; eliminar el documento también elimina su copia pública.

El RPC público de lectura sólo devuelve una copia si conoce su token. No se concede a anónimos lectura de tablas ni listados de enlaces. El publicador verifica identidad, pertenencia a beta y propiedad del documento. La excepción de la barrera beta se limita a `rpc/read_public_canvas`. Las funciones definer son intencionales para permitir este acceso puntual; los avisos del asesor sobre su ejecución corresponden a este contrato.

Verificación: pruebas del almacén (cerrar, reabrir, descartar), nombre automático, vista pública, pruebas de navegador en escritorio claro/oscuro y móvil con descarga real sin `window.print`, y doce comprobaciones SQL de propiedad, privacidad del chat, acceso anónimo por token y revocación.
