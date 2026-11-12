# Catálogo ampliado de Fontex Studio

Implementación: 12 de noviembre de 2026. Los ocho temas solicitados se resuelven en nueve tipos nuevos de objeto, porque ángulos y círculos tienen representaciones distintas. El registro suma 19 objetos, incluido Texto. Todos participan en el esquema estricto del agente, inspector, lienzo, recorrido, modos de aprendizaje, persistencia JSON e impresión/PDF.

| Tema / tipo | Cobertura y límites | Consulta de ejemplo |
| --- | --- | --- |
| Porcentajes y proporciones / `percentage` | Razón part/whole con enteros hasta 100, cantidad de 0 a 10000. Parte, descuento restante o proporcionalidad directa. Las razones directas pueden superar 1; los descuentos no superan el total | Calcula un descuento del 25 % sobre 200 y explica cuánto queda |
| Divisibilidad / `divisibility` | MCD y MCM de dos enteros de 2 a 360, factores con multiplicidad y comprobación exacta | Explica el MCD y MCM de 12 y 18 |
| Ángulos / `angle` | Giro antihorario entero 0–360°, transportador de vuelta completa con marcas de 1°; distingue nulo, agudo, recto, obtuso, llano, cóncavo y completo | Crea un ángulo de 120 grados y clasifícalo |
| Círculos / `circle` | Radio entero 1–100; área o longitud, resultado simbólico exacto con π y aproximación decimal indicada como tal | Explica el área de un círculo de radio 3 |
| Estadística / `statistics` | De 1 a 24 enteros de 0 a 100; frecuencias, media racional exacta, mediana y todas las modas empatadas. Si ningún dato se repite, se define sin moda | Representa 1, 2, 2, 4, 6 y explica su media |
| Probabilidad / `probability` | Moneda de 2 resultados, dado de 6 o ruleta de 2–12 sectores iguales. Evento: primeros k resultados favorables. De 10 a 200 ensayos pseudorrandom reproducibles. Probabilidad teórica y frecuencia observada separadas | Simula 60 lanzamientos de un dado: son favorables el 1 y el 2 |
| Álgebra / `algebra-tiles` | ax+b=cx+d, a/c de 0 a 8, b/d de −20 a 20. Piezas con signo, soluciones racionales y casos sin solución o infinitos | Explica 2x + 3 = 11 usando piezas |
| Potencias y raíces / `powers-roots` | Base entera 0–12, exponentes 1–3. Raíces cuadradas principales y cúbicas exactas; radicando = base^exponent. No representa raíces irracionales como exactas | Muestra 4 al cubo por capas y explica la raíz cúbica de 64 |
| Medidas / `measurement` | Cantidad entera de entrada 0–10000; mm/cm/m/km, mm²/cm²/m², mL/L y s/min/h. Solo conversiones de la misma magnitud. Resultados racionales exactos | Convierte 90 segundos en minutos y explica por qué es 3/2 |

## Exactitud, práctica y niveles

Los cálculos compatibles se hacen en el motor y se añaden al contexto del agente. La práctica no utiliza IA y oculta las etiquetas que revelan el resultado; se ofrecen pregunta, estrategia y comprobación progresivas. Se admiten enteros, fracciones y decimales exactos hasta seis cifras decimales. Las comparaciones racionales usan BigInt para las conversiones grandes. Los círculos aceptan respuestas como `9π`, `9*pi` y `18/2*pi`; las modas se introducen separadas por comas o como `sin moda`.

Las figuras y gráficas son SVG deterministas. Las potencias cúbicas usan capas cuadradas; no se representa un cubo mediante una mera suma de tres dibujos. Las simulaciones guardan su semilla para que la consulta del agente, el documento y el PDF usen los mismos resultados. El inspector permite repetir la simulación guardada.

El nivel cambia el acompañamiento, pero un tema avanzado no se vuelve apropiado para inicial solo por cambiar la etiqueta. El agente recibe instrucciones de priorizar conteo y figuras en inicial, usar piezas y unidades en primaria y justificar propiedades en niveles superiores.

## Acciones del agente

- **Más sencillo:** solicita una actualización del módulo seleccionado conservando ID y tipo. El servidor rechaza modificaciones de otros objetos.
- **Otro ejemplo:** solicita un objeto del mismo tipo con ID y datos distintos; se conservan los originales. El servidor permite solo creaciones del tipo seleccionado y textos auxiliares.
- **Practicar esto:** activa el modo Practicar sobre el módulo seleccionado sin cambiar sus datos ni consumir IA. El modo es una preferencia del editor, no un nuevo objeto persistido.
- **Explicar paso:** selecciona un número de paso y devuelve solo su explicación calculada, sin acciones ni llamada al proveedor. Funciona sin sesión y sin conexión.

Las dos primeras acciones requieren sesión y proveedor configurado. Las pruebas del proveedor usan simulaciones; no acreditan todavía la calidad pedagógica ni la generación real de cada tipo con una sesión autenticada. El PDF conserva el material completo con sus explicaciones; no se promete una hoja de ejercicios sin soluciones a partir de textos libres que ya contienen respuestas.

## Procedencia

Se amplía el adaptador MIT de Mathigon con `gcd`/`lcm` de Fermat `src/number-theory.ts`, media y mediana equivalentes al método predeterminado de Fermat `src/statistics.ts`, conversiones angulares de Euclid `src/angle.ts` y fórmulas de Euclid `src/circle.ts`. Se conservan los avisos de copyright en el adaptador y en `public/notices/mathigon.txt`. Los esquemas, validaciones, simulador, gráficos, pasos y acciones son código de Fontex.

Commits de referencia: Fermat `73f927442c4c3780b99a06857218021d852d0f1d`, Euclid `f9ff4d7949df300b387ddff134bd176cfa51c6d1`. No se incorporan los cursos de Mathigon Textbooks ni los SDK de Excalidraw o tldraw en esta ampliación.
