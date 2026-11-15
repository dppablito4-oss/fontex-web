# Auditoría de origin/main — 15 de noviembre de 2026

Commit auditado: `aedf80fb8a64d4c78f01d22d53cb4207f3dc57a6`.

**Seguimiento:** los cuatro hallazgos se corrigieron posteriormente en el repositorio. Consulta [las correcciones, pruebas y requisitos de publicación](CORRECCIONES-AUDITORIA-2026-11-15.md). El resto de este informe conserva el diagnóstico y los resultados anteriores a esas correcciones.

La rama local `main` se sincronizó con `origin/main` mediante fast-forward desde `228faa2`. Se incorporaron cuatro commits, con 44 archivos afectados. El árbol de trabajo estaba limpio antes de sincronizar. Esta auditoría añade únicamente este informe; no aplica correcciones ni publica cambios.

## Dictamen

La compilación y las pruebas existentes pasan, con la salvedad del lint del directorio operativo local descrita abajo. Se confirmaron **cuatro hallazgos: dos P1 y dos P2**. Recomiendo corregir los P1 antes de utilizar «Cerrar sin guardar cambios» con documentos importantes y completar la verificación del backend antes de publicar estas novedades.

P1 significa prioridad alta por pérdida de trabajo. P2 significa prioridad media por comportamiento funcional o compatibilidad. Los hallazgos se reprodujeron localmente con almacenamiento/proveedor HTTP simulado; no se modificaron datos de usuarios en producción.

## Alcance y comprobaciones

Se revisaron especialmente los cambios incorporados: pestañas y biblioteca personal, guardado y descarte, exportación PDF, lectura pública por token, práctica con permisos y conversiones angulares. También se comprobaron los controles automatizados de frontend, agentes, tutor, límites de peticiones y publicación.

| Comprobación | Resultado |
|---|---|
| Dependencias | `npm ci --no-fund`: 535 paquetes instalados; auditoría npm de 536 paquetes, **0 vulnerabilidades conocidas reportadas** |
| TypeScript | `npm run typecheck`: pasa |
| ESLint normal | `npm run lint`: falla por `ops.local/production-playwright.config.ts`, archivo local ignorado por Git y ajeno a los proyectos TypeScript |
| ESLint del código del repositorio | `npm run lint -- --ignore-pattern 'ops.local/**'`: pasa |
| Suite Vitest existente | **429 pasan y 7 se omiten**; 62 archivos pasan y 4 se omiten |
| Compilación | `npm run build`: pasa |
| Navegador | `npm run test:e2e -- --workers=2`: **28 pasan y 2 se omiten**, en escritorio oscuro/claro y móvil |
| Funciones Edge | `deno check --frozen`: pasan los ocho endpoints configurados |
| Pruebas Deno | **43 pasan**: 7 compartidas, 21 de primitivas/créditos/uso, 13 del tutor y 2 del agente retirado |
| Lint Edge | `deno lint supabase/functions`: pasa, 29 archivos |
| Reproducciones adicionales | Cuatro aserciones de comportamiento esperado fallan y confirman H-01 a H-04 |
| SQL/RLS y restauración local | No ejecutadas: el daemon de Docker no estaba activo |

La suite de navegador verifica descarga real de PDF, guardado/reapertura local, cierre/cancelación, fracciones, práctica y edición de respuestas. Se inspeccionaron también las capturas de móvil y escritorio claro. No acredita el guardado autenticado ni la publicación real de enlaces en el proyecto alojado.

La compilación emite avisos de anotaciones de Zod que Rollup retira; las pruebas PDF.js avisan de `standardFontDataUrl`. No impidieron completar las comprobaciones.

Las siete pruebas remotas se omiten por falta de su configuración. No se ejecutaron generaciones pagadas de IA, altas, envío de correos, despliegues, migraciones ni restauraciones de producción. No se verificaron los permisos y la configuración efectivos del backend alojado. La revisión de patrones de secretos se limitó a archivos actuales seleccionados, sin examinar todo el historial Git; no aparecieron claves privadas con esos patrones.

## Hallazgos

### H-01 · P1 · Cerrar sin guardar puede eliminar una conversación ya guardada

**Código:** [inicialización de checkpoints](../src/features/primitives/usePrimitiveStore.ts#L71), [cierre y eliminación](../src/features/primitives/usePrimitiveStore.ts#L566).

Al restaurar la caché, el almacén considera nuevo cualquier lienzo que no tenga primitivas: registra `null` como checkpoint aunque el documento ya exista en la cuenta y contenga una conversación guardada. La sincronización no sustituye ese `null` porque la entrada ya existe en el mapa. «Cerrar sin guardar cambios» sigue entonces la rama que elimina documentos nuevos y llama a `remove(id)`.

**Reproducción:** precargar en caché y nube simulada un documento con título y conversación, sin primitivas; abrirlo, esperar `saved` y cerrarlo sin guardar. `close()` devuelve `true`, pero el documento desaparece de la nube simulada. No se necesita editarlo previamente.

**Impacto:** se elimina una conversación persistida cuando el usuario sólo solicita cerrar su pestaña y descartar cambios. El mismo criterio también confunde documentos guardados que aún no contienen figuras.

**Corrección propuesta:** distinguir la procedencia y el estado de persistencia del documento de la cantidad de primitivas. Registrar como baseline los documentos existentes, incluidos los que sólo contienen chat, y reservar `null` para documentos creados durante la sesión que todavía sean descartables como nuevos.

**Aceptación:** tras recargar una conversación guardada, cerrar sin guardar conserva su documento, título y conversación; un documento nuevo sigue pudiendo descartarse.

### H-02 · P1 · Descartar cambios puede sobrescribir trabajo recibido de otro dispositivo

**Código:** [checkpoint al leer](../src/features/primitives/usePrimitiveStore.ts#L316), [aceptación de cambios remotos](../src/features/primitives/usePrimitiveStore.ts#L373), [restauración al descartar](../src/features/primitives/usePrimitiveStore.ts#L572).

El checkpoint se establece al abrir y no se actualiza cuando se acepta una revisión remota posterior sobre un documento local sin cambios. Al descartar una edición local, el almacén restaura el checkpoint antiguo y lo sincroniza usando la revisión remota actual. La comparación de revisiones permite esa escritura y no se conserva una copia del trabajo remoto sustituido.

**Reproducción:** abrir la revisión 1 con el texto `Original derivation`; simular que otro dispositivo guarda la revisión 2 con `New derivation from device B`; esperar que la interfaz reciba esa revisión; editar localmente el título y cerrar sin guardar. La nube simulada termina otra vez con `Original derivation`.

**Impacto:** al descartar un cambio local de título también se deshace contenido ajeno que ya se había sincronizado. La documentación describe restaurar la versión abierta, pero esa operación no advierte de la sustitución de revisiones posteriores ni preserva una copia recuperable.

**Corrección propuesta:** asociar el checkpoint a una revisión y actualizarlo al aceptar limpiamente cambios remotos. Si se desea restaurar una versión antigua después de cambios externos, tratarlo como una restauración explícita y conservar una copia antes de escribirla.

**Aceptación:** con dos dispositivos, descartar una edición local conserva la última revisión externa aceptada o mantiene una copia recuperable antes de sustituirla.

### H-03 · P2 · Se rechazan expresiones válidas cuyo dominio no incluye cinco puntos fijos

**Código:** [validación de respuestas](../src/core/primitives/practice.ts#L83).

Las respuestas de tipo expresión que contienen `x` se aceptan únicamente si su evaluación es finita para algún punto de `[-2, -1, 0, 1, 2]`. Que esos cinco puntos estén fuera del dominio no hace inválida una expresión.

**Reproducción:** `compile('sqrt(x-10)', {}).value(11)` devuelve `1`; guardar esa misma expresión con `applyPracticeValue()` lanza `La expresión no tiene valores definidos.`

**Impacto:** un alumno no puede guardar respuestas correctas en ejercicios sobre dominios desplazados. No es un error sintáctico ni una limitación del parser.

**Corrección propuesta:** validar sintaxis y símbolos sin convertir una muestra fija en prueba de inexistencia de dominio. Si el ejercicio exige evaluación numérica, utilizar su dominio declarado y distinguir «no definido en los puntos comprobados» de «expresión inválida».

**Aceptación:** `sqrt(x-10)` se guarda como respuesta; símbolos no admitidos y expresiones mal formadas siguen rechazándose.

### H-04 · P2 · El control de publicación no exige las nuevas capacidades del backend

**Código:** [comprobación de release](../scripts/check-backend-release.mjs#L8), [workflow Pages](../.github/workflows/deploy-pages.yml#L40), [contrato v2 anterior](../supabase/migrations/20261115013301_durable_canvas_generations_and_admin_mfa.sql#L154), [nueva migración de enlaces](../supabase/migrations/20261115161823_canvas_public_shares.sql).

El script sólo exige `closed-beta-v2`, preflight y rechazo de peticiones sin sesión en ocho endpoints existentes. La migración de enlaces públicos no incrementa ese contrato. Tampoco hay una comprobación de capacidad para `answer_field` y `interaction` en el agente desplegado.

**Reproducción:** un backend simulado devuelve el contrato v2, OPTIONS `204` y POST sin sesión `401` para esas ocho funciones; devuelve `404` para cualquier otra ruta, incluidos los RPC de enlaces públicos. El script finaliza correctamente y anuncia compatibilidad.

**Impacto:** Pages puede publicar este frontend sobre un backend anterior: fallarán compartir/abrir enlaces y un agente con el validador anterior rechazará escenas con los nuevos campos. Esto demuestra una carencia del control de publicación; no demuestra que el backend de producción esté desactualizado.

**Corrección propuesta:** versionar el contrato para estas capacidades y comprobar la presencia de los RPC y la versión funcional del agente. Añadir una prueba del control que rechace el backend anterior antes de publicar.

**Aceptación:** el backend simulado anterior se rechaza y uno con las capacidades nuevas pasa una verificación sin consumo de IA.

## Revisión de privacidad de los enlaces

La nueva migración habilita RLS, revoca el listado anónimo de tablas, restringe la publicación a un propietario autorizado por beta y excluye conversación e identificadores de generación del JSON compartido. La lectura pública se limita al RPC por token UUID; la eliminación del documento elimina su copia pública mediante la clave foránea. Son observaciones del SQL revisado, no resultados de una prueba remota o de la ejecución local de RLS en esta sesión.

Se contrastaron los criterios de permisos con la documentación oficial de [funciones de base de datos](https://supabase.com/docs/guides/database/functions) y [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), además del [changelog de Supabase](https://supabase.com/changelog).

## Evidencia local

Las reproducciones y su salida se conservaron en `ops.local/audit-20261115/`, directorio ignorado por Git. Se archivaron con extensión `.txt` para que no alteren futuras ejecuciones de Vitest o ESLint. Los cuatro fallos pertenecen a comprobaciones adicionales de auditoría; no son fallos de la suite existente de 429 pruebas.

Este informe es el único archivo nuevo fuera de los directorios ignorados. No se modificó código de aplicación ni se crearon commits de corrección.
