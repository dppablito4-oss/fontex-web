# Fontex Studio — primer incremento

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

La validación rechaza tipos desconocidos, identificadores repetidos, denominadores cero, datos no finitos, operaciones no admitidas, dimensiones fuera de rango y colecciones mayores de 80 objetos. La interfaz limita archivos importados a 1 MB y crea una nueva identidad al importar para evitar sobrescribir otro material.

## Persistencia

Las claves tienen el prefijo `fontex-studio-v1:<usuario o guest>:`. Se guardan documentos completos, un índice y la identidad del último material abierto. Esta separación organiza las cuentas en el navegador; no sustituye el almacenamiento remoto ni las políticas RLS.

Cada cambio aplicado se guarda inmediatamente. El arrastre mantiene una previsualización en memoria y registra un solo cambio al soltar. Deshacer y rehacer también guardan el documento resultante. Al cambiar de material se intenta guardar el actual primero; si falla, se mantiene abierto y se recomienda exportar.

No se modificaron tablas, políticas RLS ni funciones de Supabase. Las cuentas usan el flujo existente. El laboratorio anterior queda en `/#/fracciones`; las rutas de aula y tutor siguen disponibles.

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

Prueba manual para clase:

1. Abrir el editor, homogeneizar y resolver el ejemplo de fracciones.
2. Añadir una fracción, cambiar a círculos, duplicarla y moverla.
3. Editar un texto, guardar y recargar: verificar texto y posiciones.
4. Crear un material de sucesiones, cambiar la diferencia y comprobar los términos.
5. Volver a abrir el primer material desde la lista.
6. Exportar, importar la copia y presentar; salir con el botón o Esc.

## Próximos incrementos

Guardar en Supabase con políticas por propietario; incorporar nuevas familias de objetos (recta numérica, funciones, ecuaciones); generación de documentos estructurados mediante IA, siempre validada con el mismo esquema; caché de la aplicación para garantizar reapertura sin internet. Ninguno de esos puntos se anuncia como implementado en este incremento.
