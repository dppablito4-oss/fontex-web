# Fontex Studio — primer incremento

**Revisión documental:** 11 de noviembre de 2026, Fontex Agent integrado en `main` desde `feat/fontex-agent`. La versión declarada de la aplicación sigue siendo `0.6.0`.

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
- `collection`: lista de enteros con multiplicidades; cantidad, suma, extremos y media racional.
- `number-line`: extremos, paso entero y puntos enteros dentro del rango.
- `linear-equation`: coeficientes de `ax + b = cx + d` y etapa de explicación.

El formato inicial usa un solo lienzo de 1600 × 1100. Los objetos se mantienen completamente dentro de sus límites. Importar otro formato o una futura versión exige una migración explícita; no se interpreta código del documento. React presenta el texto como contenido literal.

La validación rechaza tipos de objeto desconocidos, identificadores repetidos, denominadores cero, datos no finitos, operaciones no admitidas, dimensiones fuera de rango y colecciones mayores de 80 objetos. La interfaz limita archivos importados a 1 MiB (1.048.576 bytes) y crea una nueva identidad al importar para evitar sobrescribir otro material. El parser selecciona los campos superiores admitidos, pero copia `data` conservando posibles propiedades adicionales; no es una normalización estricta de todas las claves del JSON.

Límites matemáticos actuales:

| Objeto | Valores admitidos |
|---|---|
| Fracción | Numerador entero no negativo; denominador 1–24; hasta 3 unidades |
| Operación guiada | Dos fracciones con suma/resta; denominadores 1–24; denominador común hasta 60; resultado no negativo |
| Texto | Hasta 5.000 caracteres; tamaño entero de 14–48 |
| Sucesión aritmética | Inicio entero entre −1.000 y 1.000; diferencia entera entre −100 y 100; 2–8 términos |
| Colección numérica | 1–24 enteros entre −1.000 y 1.000; conserva repetidos |
| Recta numérica | Extremos enteros −100–100; paso 1–50; rango divisible por el paso; máximo 40 marcas y 12 puntos distintos |
| Ecuación lineal | Coeficientes enteros −1.000–1.000; dominio real; solución racional única, ninguna o infinitas; tres etapas |

El documento admite título de hasta 160 caracteres y etiquetas de hasta 120. Cada objeto mide al menos 240 × 160 y se ajusta al tablero. No hay páginas adicionales, colaboración ni exportación PDF integrada.

## Persistencia

El almacén actual usa la clave `fontex-studio-v2:<usuario o guest>` para una instantánea con `version: 2`, documentos completos y `activeId`. El formato de cada documento continúa siendo `schemaVersion: 1`; la versión del almacén es independiente. Esta separación organiza las cuentas en el navegador; no sustituye el almacenamiento remoto ni las políticas RLS. Todas las personas que usen el mismo invitado en el mismo perfil del navegador comparten ese espacio. Iniciar sesión no migra automáticamente materiales del invitado ni los sube al servidor.

Cada cambio aplicado intenta guardarse inmediatamente. El arrastre mantiene una previsualización en memoria y registra un solo cambio al soltar. Deshacer y rehacer también intentan guardar el documento resultante. Al cambiar de material se intenta guardar el actual primero; si ese primer guardado falla, se mantiene abierto y se recomienda exportar.

La instantánea se reemplaza con un único `localStorage.setItem`: si falla, permanece íntegro el estado persistido anterior. Las claves heredadas `fontex-studio-v1:<propietario>:` se leen sin modificarlas y se limpian después de una escritura v2 correcta. Si no hay espacio para la primera migración, los datos anteriores se conservan y se informa el fallo. `replace` solo cambia el historial cuando también logra guardar el material nuevo. Las pruebas cubren migración, fallo de escritura, limpieza fallida y corrupción de ambos formatos.

Exportar JSON sigue siendo la copia portátil disponible; borrar datos del navegador puede eliminar los materiales locales. No hay coordinación de ediciones simultáneas entre varias pestañas.

Agent no añade tablas ni políticas RLS; añade una función de propuestas, sin sincronizar los documentos locales. Las cuentas usan el flujo existente. Studio se abre en `/#/` o `/#/lienzo`; el laboratorio anterior queda en `/#/fracciones` y las rutas académicas siguen disponibles.

El esquema sigue en versión 1 con una extensión de tipos: el lector actual abre documentos anteriores sin migrarlos. Los clientes antiguos no reconocen los tres tipos nuevos. Las listas anidadas se copian en profundidad al validar y crear objetos. El formato de almacenamiento y la separación por cuenta no cambian. Los lotes del agente se validan completos, se revisan con una instantánea y se aplican/deshacen atómicamente. Véase [Fontex Agent](fontex-agent.md).

## Presentación y controles

El zoom de edición va del 20 % al 150 %. Empieza al 100 % en escritorio y 65 % en móvil; el control «100 %» restablece una escala legible. El botón de ajuste calcula una escala para el tablero; presentar intenta usar Fullscreen API y conserva una vista de presentación si no está disponible. El botón de salida y Esc desactivan esa vista.

Los objetos se arrastran desde su encabezado. Con el foco en ese control, las flechas mueven 10 unidades o 50 con Shift; Supr/Retroceso eliminan el objeto. Los pasos de las operaciones siguen siendo interactivos durante la presentación y sus cambios se intentan guardar. Studio usa los temas claro/oscuro globales, incluido el lienzo, las figuras, el inspector, el diálogo de materiales y la presentación. El selector de luna/sol está en la cabecera.

La cabecera concentra materiales, guardado, historial y presentación. La paleta ofrece objetos, importación/exportación y accesos a Práctica y Fracciones. Se retiraron los lemas, notas repetidas de almacenamiento y mensajes estáticos de guardado. Los errores siguen visibles y los detalles del almacenamiento permanecen en la documentación.

La paleta crea módulos con tamaños iniciales más amplios (fracción 440 × 340, texto 560 × 360, operación 900 × 600); no se reescriben dimensiones de materiales existentes ni de propuestas ya guardadas. La esquina inferior derecha permite redimensionar con puntero; se previsualiza el gesto y se confirma un solo cambio al soltar. Cancelar descarta la previsualización. Con el foco en ese control, las flechas cambian 20 unidades, o 100 con Shift. El ancla no se mueve y los límites del lienzo se respetan.

Cada módulo tiene un botón de ampliación; también se abre con doble clic en el encabezado. El diálogo nativo muestra el mismo renderizador sin la reducción de zoom del lienzo, con figuras más grandes y pasos interactivos. Ampliar no cambia posiciones ni tamaños guardados; los pasos matemáticos sí pasan por el historial habitual. En móvil, los operandos ampliados se apilan. El diálogo conserva el foco y cierre nativos; todavía requiere revisión visual y de accesibilidad manual.

## Verificación

Comandos: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

Las pruebas automatizadas incluyen:

- Roundtrip de los siete tipos, compatibilidad con los cuatro originales y rechazo de documentos inválidos.
- Conservación de textos, posiciones y datos matemáticos al recuperar.
- Separación de cuentas e invitados y errores de almacenamiento.
- Crear, editar, duplicar, eliminar, deshacer y rehacer.
- Homogeneizar `2/3 + 3/6` y obtener `7/6`.
- Crear y editar una sucesión en el mismo editor.
- Importación como copia, rechazo de archivos inválidos y presentación sin Fullscreen API.
- Los flujos existentes de autenticación y del laboratorio original.

Las pruebas remotas requieren su configuración de integración; no se consideran ejecutadas si Vitest las omite.

Tras la mejora de tamaño de módulos, la suite completa obtuvo 214 pruebas aprobadas y 7 omitidas; lint, TypeScript y build pasaron. Incluye nuevos tipos, exactitud racional, pistas, ejecutor, ampliación, resize con zoom/cancelación, límites e historial. El handler del agente conserva sus siete regresiones Deno aprobadas y pasa check. La revisión visual continúa pendiente tras el bloqueo previo de la herramienta de navegador; no se ejecutó la siguiente prueba manual. El [registro del agente](fontex-agent.md) y la [auditoría](../AUDITORIA.md) distinguen resultados locales de verificaciones remotas.

Prueba manual para clase:

1. Abrir el editor, homogeneizar y resolver el ejemplo de fracciones.
2. Añadir una fracción, cambiar a círculos, duplicarla y moverla.
3. Editar un texto, guardar y recargar: verificar texto y posiciones.
4. Crear un material de sucesiones, cambiar la diferencia y comprobar los términos.
5. Volver a abrir el primer material desde la lista.
6. Exportar, importar la copia y presentar; salir con el botón o Esc.

## Próximos incrementos

Guardar en Supabase con políticas por propietario, funciones generales, caché de aplicación para reapertura sin red y ampliar cobertura pedagógica son trabajo futuro. La recta, las ecuaciones lineales y las propuestas estructuradas del agente ya están implementadas localmente con el alcance acotado descrito arriba; su integración remota aún requiere revisión y despliegue separados.

### Actualización: agente autónomo y material imprimible

- El agente aplica por defecto cada lote validado como una sola transacción reversible. La opción «Aplicar cambios automáticamente» permite volver a la revisión manual. Si el documento cambia durante la consulta, el lote se descarta y se solicita una nueva consulta.
- Los objetos nuevos del agente se colocan debajo del contenido existente con separación. El lienzo conserva 1600 px de ancho y crece según su contenido; se admite una coordenada vertical de hasta un millón de píxeles y 80 objetos. El tamaño de cada tarjeta sigue acotado para mantener su edición legible.
- El nivel del agente también controla las explicaciones del material: primaria usa lenguaje de piezas y conteo; secundaria introduce propiedades y notación formal. Las sucesiones ocultan la fórmula general en inicial/primaria. El nivel adapta la explicación; no cambia silenciosamente los datos matemáticos existentes.
- Cada familia matemática incluye una explicación ordenada calculada desde sus datos. Fracciones separa unidad, denominador, numerador, equivalencia y comprobación; operaciones separa las dos equivalencias, cálculo y simplificación. Multiplicación muestra una cuadrícula de intersección para fracciones propias con hasta 144 celdas. Colecciones añade puntos para cantidades de 0 a 20.
- Geometría añade rectángulos y triángulos rectángulos con base y altura perpendicular enteras de 1 a 100, representación proporcional y área exacta, sin inferir perímetros de triángulos a partir de medidas insuficientes.
- «Exportar PDF» abre la impresión de un documento separado con todos los objetos ordenados por posición vertical y sus explicaciones completas, independientemente del zoom y tamaño de tarjeta. Elegir «Guardar como PDF». El JSON continúa disponible para conservar el material editable.
- Validación: 219 pruebas frontend y 7 pruebas del handler con Node y transformación TypeScript; lint y build correctos. No se pudo completar la comprobación visual en Chromium local porque el entorno deniega la creación de sockets del navegador. La salida HTML del PDF y el contenido fuera de pantalla tienen cobertura de pruebas.
