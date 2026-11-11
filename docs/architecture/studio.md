# Fontex Studio — primer incremento

**Revisión documental:** 11 de noviembre de 2026, código base `3a26911`. La versión declarada de la aplicación sigue siendo `0.6.0`.

Fontex permite construir una explicación matemática con objetos independientes. Fracciones y sucesiones usan el mismo lienzo, inspector, historial y guardado. La prioridad es preparar y presentar materiales durante clases presenciales.

## Implementación

| Componente          | Ubicación                                     | Responsabilidad                                                             |
| ------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| StudioShell         | `src/features/studio/StudioShell.tsx`         | Materiales, herramientas, selección, importación/exportación y presentación |
| CanvasViewport      | `src/features/studio/CanvasViewport.tsx`      | Arrastre con captura del puntero, zoom y movimiento por teclado             |
| MathObjectRenderer  | `src/features/studio/MathObjectRenderer.tsx`  | Fracciones SVG, operación por etapas, texto y sucesiones                    |
| PropertiesInspector | `src/features/studio/PropertiesInspector.tsx` | Formularios y validación antes de aplicar cambios                           |
| ObjectRegistry      | `src/core/object-registry/registry.ts`        | Catálogo, valores iniciales y plantillas                                    |
| MathEngine          | `src/core/math-engine/`                       | Operaciones exactas de fracciones y términos de sucesiones                  |
| DocumentSchema      | `src/core/document-schema/document.ts`        | Unión discriminada, límites y validación de JSON                            |
| DocumentStore       | `src/features/studio/document-store.ts`       | Documentos e índice de materiales por propietario en localStorage           |
| Historial           | `src/features/studio/useStudioDocument.ts`    | Hasta 40 cambios, recuperación, guardado y manejo de fallos                 |

El motor original de fracciones se trasladó a `core/math-engine`; su ruta anterior reexporta las funciones para mantener el laboratorio y sus pruebas. No se añadieron dependencias.

## Documento versión 1

Un documento contiene `schemaVersion`, `id`, `title`, `updatedAt` y una colección `objects`. Cada objeto tiene `id`, `type`, `label`, `x`, `y`, `width`, `height` y `data` específico:

- `fraction`: numerador, denominador y representación.
- `operation`: expresión, etapa y representación.
- `text`: contenido y tamaño de letra.
- `sequence`: primer término, diferencia y cantidad de términos.

El formato inicial usa un solo lienzo de 1600 × 1100. Los objetos se mantienen completamente dentro de sus límites. Importar otro formato o una futura versión exige una migración explícita; no se interpreta código del documento. React presenta el texto como contenido literal.

La validación rechaza tipos de objeto desconocidos, identificadores repetidos, denominadores cero, datos no finitos, operaciones no admitidas, dimensiones fuera de rango y colecciones mayores de 80 objetos. La interfaz limita archivos importados a 1 MiB (1.048.576 bytes) y crea una nueva identidad al importar para evitar sobrescribir otro material. El parser selecciona los campos superiores admitidos, pero copia `data` conservando posibles propiedades adicionales; no es una normalización estricta de todas las claves del JSON.

Límites matemáticos actuales:

| Objeto | Valores admitidos |
|---|---|
| Fracción | Numerador entero no negativo; denominador 1–24; hasta 3 unidades |
| Operación guiada | Dos fracciones con suma/resta; denominadores 1–24; denominador común hasta 60; resultado no negativo |
| Texto | Hasta 5.000 caracteres; tamaño entero de 14–48 |
| Sucesión aritmética | Inicio entero entre −1.000 y 1.000; diferencia entera entre −100 y 100; 2–8 términos |

El documento admite título de hasta 160 caracteres y etiquetas de hasta 120. Cada objeto mide al menos 240 × 160 y se ajusta al tablero. No hay páginas adicionales, colaboración ni exportación PDF integrada.

## Persistencia

El almacén actual usa la clave `fontex-studio-v2:<usuario o guest>` para una instantánea con `version: 2`, documentos completos y `activeId`. El formato de cada documento continúa siendo `schemaVersion: 1`; la versión del almacén es independiente. Esta separación organiza las cuentas en el navegador; no sustituye el almacenamiento remoto ni las políticas RLS. Todas las personas que usen el mismo invitado en el mismo perfil del navegador comparten ese espacio. Iniciar sesión no migra automáticamente materiales del invitado ni los sube al servidor.

Cada cambio aplicado intenta guardarse inmediatamente. El arrastre mantiene una previsualización en memoria y registra un solo cambio al soltar. Deshacer y rehacer también intentan guardar el documento resultante. Al cambiar de material se intenta guardar el actual primero; si ese primer guardado falla, se mantiene abierto y se recomienda exportar.

La instantánea se reemplaza con un único `localStorage.setItem`: si falla, permanece íntegro el estado persistido anterior. Las claves heredadas `fontex-studio-v1:<propietario>:` se leen sin modificarlas y se limpian después de una escritura v2 correcta. Si no hay espacio para la primera migración, los datos anteriores se conservan y se informa el fallo. `replace` solo cambia el historial cuando también logra guardar el material nuevo. Las pruebas cubren migración, fallo de escritura, limpieza fallida y corrupción de ambos formatos.

Exportar JSON sigue siendo la copia portátil disponible; borrar datos del navegador puede eliminar los materiales locales. No hay coordinación de ediciones simultáneas entre varias pestañas.

Este incremento de Studio no añade tablas, políticas RLS ni funciones de Supabase. Las cuentas usan el flujo existente. Studio se abre en `/#/` o `/#/lienzo`; el laboratorio anterior queda en `/#/fracciones` y las rutas académicas siguen disponibles.

## Presentación y controles

El zoom de edición va del 20 % al 150 %. El botón de ajuste calcula una escala para el tablero; presentar intenta usar Fullscreen API y conserva una vista de presentación si no está disponible. El botón de salida y Esc desactivan esa vista.

Los objetos se arrastran desde su encabezado. Con el foco en ese control, las flechas mueven 10 unidades o 50 con Shift; Supr/Retroceso eliminan el objeto. Los pasos de las operaciones siguen siendo interactivos durante la presentación y sus cambios se intentan guardar. Studio utiliza su propio CSS con apariencia clara, separado del tema académico.

## Verificación

Comandos: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

Las pruebas automatizadas incluyen:

- Roundtrip de los cuatro tipos y rechazo de documentos inválidos.
- Conservación de textos, posiciones y datos matemáticos al recuperar.
- Separación de cuentas e invitados y errores de almacenamiento.
- Crear, editar, duplicar, eliminar, deshacer y rehacer.
- Homogeneizar `2/3 + 3/6` y obtener `7/6`.
- Crear y editar una sucesión en el mismo editor.
- Importación como copia, rechazo de archivos inválidos y presentación sin Fullscreen API.
- Los flujos existentes de autenticación y del laboratorio original.

Las pruebas remotas requieren su configuración de integración; no se consideran ejecutadas si Vitest las omite.

Tras las correcciones del 11 de noviembre, la suite completa de frontend obtuvo 136 pruebas aprobadas y 7 omitidas; lint, TypeScript y build pasaron. No se ejecutó la siguiente prueba manual en navegador durante esa revisión. El [informe de auditoría](../AUDITORIA.md) centraliza los resultados y sus límites.

Prueba manual para clase:

1. Abrir el editor, homogeneizar y resolver el ejemplo de fracciones.
2. Añadir una fracción, cambiar a círculos, duplicarla y moverla.
3. Editar un texto, guardar y recargar: verificar texto y posiciones.
4. Crear un material de sucesiones, cambiar la diferencia y comprobar los términos.
5. Volver a abrir el primer material desde la lista.
6. Exportar, importar la copia y presentar; salir con el botón o Esc.

## Próximos incrementos

Guardar en Supabase con políticas por propietario; incorporar nuevas familias de objetos (recta numérica, funciones, ecuaciones); generación de documentos estructurados mediante IA, siempre validada con el mismo esquema; caché de la aplicación para garantizar reapertura sin internet. Ninguno de esos puntos se anuncia como implementado en este incremento.
