# Agente del lienzo

Revisión: 22 de noviembre de 2026. El antiguo protocolo de objetos Studio v1 está en [el archivo histórico](../archive/fontex-agent-pre-v1.md).

## Flujo actual

`src/features/primitives/agent.ts` envía la pregunta, escena validada, nivel y selección a `studio-agent/primitives`. El endpoint autentica la cuenta, comprueba acceso, cuotas y créditos, y solicita JSON estructurado al proveedor. `classroom-agent` usa el mismo handler con un token de participación temporal validado en servidor.

La edición manual y las plantillas no necesitan IA. El asistente tiene dos tareas:

- **Chat:** explica y propone; sus acciones deben estar vacías y no modifica el lienzo.
- **Build:** construye o edita mediante un lote validado. No anuncia éxito antes de validar los elementos y completar su recibo.

En una escena vacía, el contrato del proveedor separa `variables` y `primitives` y exige al menos un elemento. Después se transforma al contrato normal de acciones. En una escena existente se usan `add_primitive`, `update_primitive`, `delete_primitive`, `upsert_variable` o la carga explícita de una plantilla. El navegador vuelve a validar antes de aplicar.

## Límites

La fuente ejecutable es `src/core/agent/generation-limits.ts`.

| Tarea | Salida máxima solicitada | Límite servidor | Límite cliente |
| --- | --- | --- | --- |
| Chat | 2048 tokens | 75 s | 85 s |
| Construir | 32000 tokens | 125 s | 140 s |

Los contratos de uso y créditos permiten recuperar/cerrar reservas con una ventana mayor. Las escenas admiten 80 primitivas y 24 variables. Un lote admite 64 acciones; la creación inicial hasta 40 primitivas. El tamaño del JSON y las expresiones también se limita. Una generación extensa sigue dependiendo del proveedor; ampliar tokens no corrige una expresión inválida.

El contexto enviado al proveedor está limitado a 48000 bytes tras recortar historial y trazos. No equivale al límite de archivo de 1 MiB. Los recibos de construcción limitan la escena de origen a 64 KiB y la respuesta a 256 KiB. El servidor rechaza el exceso de contexto antes de llamar al proveedor.

El transporte SSE comunica estado y texto, con recuperación de recibos. Los errores, cancelaciones y respuestas incompletas no se aplican como un éxito parcial.

## Modelos y créditos

`FONTEX_CHAT_MODEL` usa Luna por defecto. `FONTEX_AGENT_MODEL` usa Terra 6.1 y redirige la configuración anterior Sol 6.1 a Terra. Los modelos configurados deben admitir Responses y Structured Outputs. [Política de uso](../politica-uso-ia.md).

Crear consume un crédito interno cuando se completa la construcción. El servidor reserva y liquida ese crédito; el cliente no decide su saldo. El reembolso interno no devuelve automáticamente el coste de tokens ya procesados por el proveedor. Las cuotas de conversación y los presupuestos globales también se verifican en servidor.

## Primitivas y verificación semántica

El esquema de las doce familias se comparte con el servidor. El motor valida referencias, nombres, rangos, dimensiones, matrices, circuitos y cantidades. Los resultados de áreas y sólidos se resuelven con pasadas acotadas y pueden alimentar textos, tablas u otros campos. No se ejecuta HTML/SVG ni JavaScript proporcionado por el modelo.

Para sólidos, el generador debe usar `solid_3d`, no sustituir una esfera por un círculo ni una pirámide por un triángulo. La interpretación pedagógica y la prosa de la IA pueden contener errores: validar JSON y cálculos admitidos no certifica toda la explicación.

No hay reconocimiento especial de prompts ni actividades completas incrustadas como respuestas del agente.

## Otros tutores

`practice-tutor` sirve al catálogo Aprender y tiene sus propios límites. `tutor-chat` es el tutor documental del aula, con RAG, selección de fuentes, citas y reservas. No se deben tratar sus cuotas o modelos como si fueran el asistente del lienzo. En esta rama, el tutor documental usa Terra al encontrar un respaldo histórico Astra/Sol y conserva la prioridad de `OPENAI_MODEL` explícito.

## Despliegue y pruebas

El contrato del agente es `primitive-agent-v7`; el SQL conserva `closed-beta-v4`. Los validadores se importan desde el repositorio completo y deben acompañar los despliegues de `studio-agent`, `classroom-agent` y `classroom-api`. CI prueba los handlers con proveedor simulado. Las comprobaciones con API real se registran aparte y pueden consumir saldo.

`scene-agent` permanece como respuesta de retirada sin generación. Sus clientes antiguos reciben 410 tras autenticarse; no es una segunda implementación vigente del agente.
