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
