# Módulos adaptados de Mathigon para Fontex Agent

Integración: 12 de noviembre de 2026.

## Procedencia y licencia

Se adaptan funciones matemáticas pequeñas y sin dependencias de dos repositorios públicos con licencia MIT, no los cursos ni el contenido gráfico de Mathigon Textbooks/Polypad:

- Euclid.js: `Polygon.signedArea` y `Polygon.circumference`, en [src/polygon.ts](https://github.com/mathigon/euclid.js/blob/f9ff4d7949df300b387ddff134bd176cfa51c6d1/src/polygon.ts), commit `f9ff4d7949df300b387ddff134bd176cfa51c6d1`.
- Fermat.js: `isPrime` y `primeFactorisation`, en [src/number-theory.ts](https://github.com/mathigon/fermat.js/blob/73f927442c4c3780b99a06857218021d852d0f1d/src/number-theory.ts), commit `73f927442c4c3780b99a06857218021d852d0f1d`.

Copyright (c) Mathigon. La licencia completa se conserva en `public/notices/mathigon.txt` y en el encabezado legal del adaptador `src/core/vendor/mathigon.ts`. El menú del editor enlaza a los créditos. El archivo público se incluye en la distribución de producción. No se agregan paquetes ni llamadas a servicios externos.

Adaptaciones: funciones puras sobre vértices de datos, acceso de arrays compatible con TypeScript estricto, sustitución de `Point.distance` por `Math.hypot` y límites educativos en un envoltorio propio. La comprobación de polígonos simples, los pasos didácticos, la práctica, el esquema del agente y los componentes SVG son implementaciones de Fontex.

## Módulos

### `polygon`

Datos: `vertices: {x: number, y: number}[]`, de 3 a 8 puntos distintos y ordenados, con coordenadas enteras de 0 a 20. Se rechazan área cero, lados cruzados, contactos entre lados no vecinos y solapamientos. Admite polígonos convexos y cóncavos simples, sin huecos.

La cuadrícula conserva la proporción geométrica, identifica vértices y diferencia contorno/superficie. El área es exacta para este dominio entero (incluidas medias unidades); el perímetro usa longitudes euclídeas y se etiqueta como aproximación a tres decimales. Inicial/primaria se explica con cuadrados y descomposición; secundaria introduce las coordenadas y la fórmula del área. En práctica se pide el área y se ocultan las mediciones.

Ejemplo de consulta: «Crea un polígono en forma de L y explica su área».

### `factorization`

Datos: `number`, entero de 2 a 360. Calcula factores primos con multiplicidad y divisiones exactas hasta 1. Aprender revela una división por paso; Resolver expone el procedimiento completo. Practicar acepta productos en cualquier orden y potencias, incluidos `2^2` y `2²`, y rechaza productos que conservan el valor pero contienen factores compuestos. No ejecuta expresiones como código.

Ejemplo de consulta: «Descompón 36 en factores primos y explícame cada división».

## Integración

Ambos tipos participan en el registro de objetos, validación de JSON, creación/actualización/eliminación por acciones del agente, contexto con resultados calculados, inspector, guardado/importación, historial reversible, lienzo, recorrido didáctico y PDF. Se mantiene `schemaVersion: 1`; los documentos anteriores siguen siendo válidos. El servidor del agente recibe los nuevos tipos mediante el mismo esquema estricto y vuelve a verificar las acciones.

La práctica, los cálculos y la representación se ejecutan localmente. La creación por lenguaje natural utiliza el proveedor configurado del agente. La validación comprueba los objetos y resultados compatibles, no certifica toda la redacción libre producida por IA.

## Validación

Pruebas del dominio completo de factores 2–360; áreas en ambas orientaciones, medias unidades y concavidad; rechazo de polígonos inválidos; serialización y transacciones del agente; práctica sin revelar resultados; inspector y PDF. Los tests del handler usan respuestas de proveedor simuladas, no certifican todavía la generación real de estos nuevos tipos con una sesión autenticada.

Excalidraw y tldraw no se incorporan como dependencias de esta integración. Sus interfaces y ejemplos siguen siendo referencias para una futura ampliación del lienzo.
