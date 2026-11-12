# Fontex Agent — desarrollo incremental

Base revisada: `main` / `origin/main` en `1d627cc`, sin cambios locales. Rama: `feat/fontex-agent`. No se publica ni despliega esta intervención.

## Estado de partida

Studio, Fracciones, Práctica, autenticación y las vistas académicas permanecen disponibles. Se reutilizan ObjectRegistry, MathEngine, document-schema, useStudioDocument y el cliente/servicios de Supabase. La base pasó lint, typecheck, 141 pruebas (7 remotas omitidas) y build el 11 de noviembre de 2026.

## Fase 1 — acciones locales

`src/core/agent/actions.ts` define una lista cerrada: `create`, `update`, `delete`. Crear/modificar recibe un objeto completo validado; modificar conserva identidad y tipo. El lote se limita a 20 acciones y el documento mantiene su límite de 80 objetos. Se rechazan campos desconocidos, geometría inválida y datos matemáticos fuera del esquema. No hay intérprete, eval, código dinámico ni carga de herramientas externas.

El ejecutor es puro: trabaja sobre una copia y valida el documento final antes de devolverlo. Un fallo no modifica parcialmente el material. `useStudioDocument.execute` registra todo el lote en un único paso de historial y conserva el guardado local existente. El historial usa una referencia actualizada para no perder cambios consecutivos en el mismo evento. Si falla el almacenamiento, el material sigue en memoria y se muestra el error habitual.

El panel desplegable de Studio permite leer el contexto, preparar un ejemplo, revisar JSON y aplicar una vista previa explícitamente. La aplicación compara el documento completo con la instantánea revisada, además de comprobar la identidad, y rechaza propuestas obsoletas. El contexto incluye selección y resultados exactos derivados por MathEngine; el texto del documento es datos, nunca instrucciones ejecutables.

Compatibilidad: se conserva `schemaVersion: 1`, el formato local v2 y los cuatro tipos existentes. Los imports explícitos `.ts` del núcleo permiten compartir validadores con Deno sin duplicarlos.

Validación de la fase 1: lint, typecheck y build correctos; 155 pruebas aprobadas y 7 remotas omitidas. Se comprobaron CRUD, rollback, datos inválidos, límites, copia aislada del contexto, propuestas obsoletas y deshacer/rehacer con persistencia de un lote. Los tests originales de Studio siguen aprobados. Durante la verificación se corrigieron una aserción de tipos redundante y una etiqueta accesible que había alterado innecesariamente el contrato existente. La fase 2 comienza después de este resultado.

## Fases siguientes

2. Orquestador backend autenticado, cuotas existentes, secreto solo servidor, respuesta estructurada y modos aprender/practicar/resolver con pistas graduadas.
3. Colecciones numéricas, recta numérica y ecuaciones lineales: esquemas acotados, motor exacto, renderizadores, inspector y regresiones de compatibilidad.

La cobertura será introductoria y acotada; no se promete un currículo completo. Studio debe seguir funcionando sin IA. La reapertura de toda la aplicación desde cero sin red exige una estrategia de caché adicional; no se debe confundir edición local con instalación offline.

## Fase 2 — orquestación y pedagogía

`studio-agent` usa el mismo middleware `withSupabase({ auth: "user" })` del tutor existente. La identidad proviene de la sesión verificada, nunca del cuerpo. Reutiliza `take_practice_tutor_quota` (10/hora y 25/día UTC, compartidas con Práctica), sin nuevas tablas ni permisos. La función falla de forma cerrada si no puede reservar cuota. No escribe documentos remotos ni guarda conversaciones.

`OPENAI_API_KEY` solo se lee en el servidor. `FONTEX_AGENT_MODEL` permite configurar un modelo compatible con Responses y Structured Outputs; por defecto se reutiliza `tutorModels.study.id`. No se añade un proveedor directo en Vite. El navegador invoca el cliente Supabase existente y vuelve a validar la respuesta.

Aprender pide relacionar representación, idea y pregunta; Resolver pide pasos justificados y comprobación. El backend construye el contexto con MathEngine, solicita JSON Schema estricto, y vuelve a comprobar acciones y documento final. No ofrece herramientas de ejecución, navegación ni llamadas arbitrarias. La entrada se limita a 256 KiB, la consulta/intento a 1.200 caracteres, la salida a 4.500 tokens y 20 acciones, con timeout de 30 segundos. Respuestas incompletas, rechazo del proveedor y acciones inválidas no alteran Studio.

Practicar usa una ruta determinista compartida en cliente y servidor. No llama al modelo: evita revelar accidentalmente la solución o consumir cuota por pistas locales. Para el objeto seleccionado ofrece pregunta, estrategia y comprobación (niveles 0/1/2), con comparación exacta de enteros/fracciones equivalentes. Texto libre no se evalúa. Esta práctica funciona sin sesión, conexión o claves. La adaptación de nivel cambia el acompañamiento; no amplía por sí sola la cobertura matemática.

Las respuestas de IA son propuestas y sus explicaciones libres pueden equivocarse. La comprobación con MathEngine valida únicamente los resultados de objetos compatibles, no certifica toda la prosa generada. La vista previa muestra valores propuestos; aplicar y deshacer siguen usando el ejecutor de la fase 1. Los datos del material se envían al proveedor solo al consultar Aprender/Resolver; no se envían durante la edición normal ni la práctica local.

Verificación de fase 2: lint, typecheck y build correctos; 170 pruebas frontend aprobadas, 7 remotas omitidas, y 7 pruebas Deno nuevas aprobadas. Deno check del adaptador y lint del endpoint correctos. Se probaron aprendizaje/resolución con vista previa, práctica sin sesión ni red, pistas graduadas, equivalencias, errores de auth/cuota/proveedor, JSON estricto y rechazo de instrucciones ejecutables. No se invocó un proveedor real ni se desplegó la función; las pruebas del backend usan dependencias simuladas. Se corrigió la ruta compartida de imports al verificar Deno y una copia de array señalada por ESLint. La fase 3 empieza después de este resultado.

Fuentes consultadas para la implementación: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas) y [autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth-legacy-jwt). Se conserva el patrón y las versiones ya fijadas en el proyecto.
