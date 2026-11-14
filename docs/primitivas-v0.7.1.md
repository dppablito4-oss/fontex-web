# Fontex v0.7.1 — Consolidación de primitivas

Esta versión integra [el plan aportado](plans/v0.7.1-consolidacion-propuesta.md) sobre `ef2f460`. No añade familias por tema: mantiene nueve primitivas y amplía sus combinaciones a 25 plantillas.

## Interacción y ejemplos

- **Rotación directa:** selecciona un elemento de escritorio y arrastra su manija circular superior. Shift ajusta el ángulo a múltiplos de 15°. Respeta el bloqueo, el zoom, el historial y el guardado. La manija se dibuja sobre el panel contextual para que éste no intercepte el gesto. En móvil se conserva el flujo vertical sin rotaciones visuales ni manijas de arrastre.
- **Saltos sobre una recta:** `vector_segment.data.arcHeight` es opcional y admite 0–120 unidades visuales. Ausente, null o 0 conserva el segmento recto. En `number_line`, un valor positivo dibuja una Bézier sobre el eje, con flecha y desplazamiento firmado. No cambia los cálculos ni la estructura v2 existente.
- **Saltos en la recta numérica:** dos desplazamientos vinculados a a y b permiten sumar y restar mediante el inverso aditivo.
- **Círculo unitario interactivo:** radio de longitud 1, escala igual en ambos ejes, proyección y control de θ en grados. Texto reactivo con seno, coseno y tangente; en 90°/270° indica «No definido».
- **Pitágoras dinámico:** vértices ligados a a y b, catetos, hipotenusa y ángulos agudos. El plano usa `equalScale: true` para que las medidas se dibujen con la misma escala horizontal y vertical; el campo es opcional y conserva las escenas v2 existentes. El helper escalar `atan2(y,x)` devuelve radianes; `deg(...)` los convierte a grados. No es una nueva función diferenciable del parser de curvas.

El plan usa el nombre conceptual `vector_angle`; la familia existente y conservada en el contrato se llama `vector_segment`.

## Limpieza del editor anterior

Se retiran `src/features/studio`, el esquema `src/core/document-schema`, el registro de objetos v1, el protocolo/agente Studio antiguo y sus pruebas exclusivas. Se conserva el decodificador SSE compartido, el tipo de conversación usado por el laboratorio de expresiones y los motores matemáticos independientes. La prueba del landing verifica ahora que no cambie la caché v2. Ninguna ruta activa depende del editor retirado.

El código eliminado se recupera desde `respaldo/pre-primitivas-2026-11-14` (`930dcb9`). La reducción del número total de pruebas se debe a retirar las pruebas del editor v1; se mantienen las del editor actual y se añaden regresiones del nuevo comportamiento.

## Consolidación de base de datos

La migración `consolidate_primitive_scene_v071` copia únicamente las filas cuyo formato/versión no es `primitive-scene`/2 a `fontex_archive.visual_scenes_pre_v071`, las retira de la tabla activa y valida `primitive_scene_shape`, todo en una transacción. No elimina escenas v2 ni cuentas, documentos o aulas.

El archivo queda en un esquema privado sin permisos de uso para anon/authenticated, con RLS y sin permisos de lectura desde la API. Es una copia de recuperación administrativa, no una biblioteca del usuario. No se cambia la RLS de `visual_scenes`.

La prueba local sembró una escena antigua y una v2: la antigua quedó archivada, la v2 permaneció activa y el constraint quedó validado. Las 28 comprobaciones SQL de formato, propietario, revisiones y archivo pasaron. Aplicada al piloto como `20261114144028_consolidate_primitive_scene_v071`: cero escenas antiguas activas, cuatro archivadas y `primitive_scene_shape` validado. Se verificó que authenticated no tiene acceso al esquema ni a la tabla de archivo.

## Pruebas remotas y coste

La batería nueva contra `/studio-agent/primitives` se ejecutó con el proveedor real el 14 de noviembre de 2026. Pasó con cuatro peticiones: chat sin acciones; creación y variable; actualización y eliminación; apertura explícita de plantilla. Verificó las cinco acciones `upsert_variable`, `add_primitive`, `update_primitive`, `delete_primitive` y `load_template`, más texto SSE. No escribió escenas en la base de datos y cerró únicamente su sesión de prueba.

Para repetirla, configura variables de servidor (nunca con prefijo VITE):

```bash
# SUPABASE_TEST_URL, SUPABASE_TEST_PUBLISHABLE_KEY,
# FONTEX_TEST_EMAIL, FONTEX_TEST_PASSWORD
FONTEX_RUN_PAID_AGENT_TESTS=1 npm run test:agent:remote
```

Requiere Node 22 con `--experimental-strip-types` (el script npm ya incluye el flag), una cuenta de prueba confirmada y la función desplegada con proveedor configurado. Hace cuatro consultas facturables; no se repite automáticamente en cada push. No guarda contraseñas, tokens ni respuestas privadas en el repositorio.

### Las siete integraciones académicas

No son pruebas pendientes del editor de primitivas. Se mantienen condicionales en `npm test` y ahora tienen comando explícito y workflow manual. Requieren las tres variables `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY` y `SUPABASE_TEST_SERVICE_ROLE_KEY` de un proyecto de pruebas. El comando dedicado falla si faltan, en lugar de dar una ejecución omitida por válida.

| Archivo | Casos | Servicios necesarios |
|---|---:|---|
| `src/test/block1.remote.test.ts` | 1 | Auth Admin, aulas, invitaciones y grupos con RLS |
| `src/test/block2.remote.test.ts` | 1 | Auth Admin, Storage privado y `document-upload` |
| `src/test/block3.remote.test.ts` | 1 | PDF, `document-process`, extracción, índices y permisos |
| `src/test/block4.remote.test.ts` | 4 | Tutor documental real con citas, abstención y aislamiento |

Ejecutar `npm run test:remote`. Crean usuarios, aulas y documentos temporales y los limpian; los bloques de procesamiento/tutor pueden consumir API. La clave administrativa no está disponible en este entorno, así que estos siete casos no se ejecutaron aquí. Las pruebas SQL de RLS sí se ejecutaron localmente; no sustituyen estas integraciones completas.

El workflow **Manual remote integrations** permite elegir cada batería con `workflow_dispatch`. Usa secretos del entorno GitHub `remote-tests`; el secreto administrativo sólo se expone al job académico. No se habilitan peticiones pagadas ni credenciales administrativas en CI de cada push.

## Validación de interfaz

Chrome a 1440 y 390 píxeles: saltos y signo negativo, círculo redondo, valores reactivos de Pitágoras, ausencia de desbordamiento horizontal, presentación y PDF. En escritorio también se ejecutaron el giro real con Shift y deshacer. Son pruebas de navegador con viewport móvil, no una prueba en hardware físico.
