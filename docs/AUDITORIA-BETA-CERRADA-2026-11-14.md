# Auditoría para beta cerrada — Fontex 0.8.1

Fecha: **14 de noviembre de 2026**. Repositorio revisado: `f3636e0f93cd4f51937ce2d3d912caff057993ee`.

**Seguimiento:** las correcciones locales posteriores se documentan en [Preparación de beta cerrada](beta-cerrada.md). Este informe conserva la evidencia y el estado previo a esas correcciones; no acredita el estado de producción.

## Dictamen

**El proyecto tiene una base técnica sólida para pruebas internas, pero recomiendo condicionar la apertura de la beta a cerrar los controles de acceso, consumo de IA y publicación descritos aquí.** Pasar las pruebas actuales no cubre esas condiciones de operación.

Identifiqué **10 hallazgos: 5 de prioridad P1 y 5 de prioridad P2**. Incluyen errores funcionales reproducidos, riesgos demostrados con un proveedor simulado y carencias comprobables en la configuración. No identifiqué un fallo P0 de acceso a datos ajenos en lo revisado; esto no equivale a una certificación de seguridad del servicio publicado.

- **P1:** resolver antes de habilitar la función afectada para participantes de la beta.
- **P2:** corregir durante la preparación o primera iteración, con seguimiento explícito.
- **Reproducido:** comprobado ejecutando código local. **Revisión estática:** demostrado por el flujo del código/configuración, sin explotar el servicio remoto.

La auditoría no cambia funcionalidades ni aplica correcciones. El entregable es este informe.

## Alcance y resultados ejecutados

Se revisaron las rutas activas, autenticación, aulas, créditos, sincronización de escenas, validación matemática, biblioteca PDF, funciones de IA, migraciones, dependencias y workflows. Se contrastó la documentación histórica con el contrato activo de primitivas v2.

| Comprobación | Resultado de esta auditoría |
|---|---|
| `npm run lint` | Pasa |
| `npm run typecheck` | Pasa |
| `npm test -- --reporter=dot` | **347 pasan, 7 omitidas**; 44 archivos pasan y 4 se omiten |
| `npm run build` | Pasa; avisos de anotaciones de Zod durante el empaquetado, sin fallo |
| `npm audit --json` | **0 vulnerabilidades conocidas reportadas**, para el árbol npm auditado |
| `deno check` | Pasan los 8 endpoints, incluidos upload y delete |
| Pruebas Deno | **28 pasan**: 13 de primitivas/créditos, 13 de tutor documental y 2 de escenas antiguas |
| `deno lint supabase/functions` | Pasa, 21 archivos |
| Migraciones desde cero | **18 aplicadas** en PostgreSQL temporal aislado |
| `supabase test db --local`, sobre esa base temporal | **207 pruebas pasan, 10 archivos** |
| `supabase db advisors --local --type all --level warn --fail-on error` | Sin incidencias en los niveles revisados |
| Reproducciones adicionales de interfaz/matemáticas | 2 comprobaciones confirman B-05 y B-06 |
| Reproducciones adicionales de consumo | 30 llamadas al agente antiguo y 20 al chat actual, todas con proveedor simulado |

Las reproducciones adicionales utilizaron un archivo temporal de Vitest y un script Deno; no se incorporaron a la suite permanente. Sus resultados describen defectos existentes, no correcciones.

**Límites de la verificación:** no se ejecutaron las 7 integraciones remotas, consultas pagadas de IA, altas reales, envío de correos, despliegues ni pruebas visuales en navegadores reales. Tampoco se verificaron configuración efectiva de Auth, funciones desplegadas, protecciones de rama, backups o permisos del proyecto alojado. Los resultados históricos de otros documentos no sustituyen esa comprobación actual. La revisión de secretos fue de archivos actuales, no de todo el historial Git; no aparecieron claves privadas con los patrones examinados. La clave publicable del workflow es configuración pública, no un secreto de servidor.

## Hallazgos prioritarios

| ID | Prioridad | Hallazgo | Evidencia |
|---|---|---|---|
| B-01 | P1 | El agente antiguo permite consumo de IA sin créditos ni cuota | Reproducido con proveedor simulado |
| B-02 | P1 | Chat sin control de concurrencia, presupuesto de entrada ni tope de salida | Reproducido con proveedor simulado |
| B-03 | P1 | El repositorio no implementa acceso por invitación a la beta | Revisión estática; servicio alojado pendiente |
| B-04 | P1 | Publicación de Pages independiente de los controles de backend | Revisión de workflows |
| B-05 | P2 | Respuestas tardías mezclan detalles de aulas en la interfaz | Reproducido |
| B-06 | P2 | Se muestran como cero números pequeños que no son cero | Reproducido |
| B-07 | P1 | El límite real de páginas PDF se comprueba después de extraerlas | Revisión estática; afecta a biblioteca activa |
| B-08 | P2 | La carga multipart confía en `Content-Length` antes de leer el cuerpo | Revisión estática |
| B-09 | P2 | `document-delete` falla con un cuerpo JSON `null` | Revisión estática |
| B-10 | P2 | Sincronización de biblioteca completa y sin cuotas de escenas | Revisión estática; impacto de carga pendiente |

### B-01 — Agente antiguo fuera del sistema de créditos

**Ubicación:** [scene-agent/handler.ts](../supabase/functions/scene-agent/handler.ts#L38), [scene-agent/index.ts](../supabase/functions/scene-agent/index.ts), [config.toml](../supabase/config.toml#L484).

El endpoint autentica al usuario, pero llama directamente al proveedor sin reservar créditos, comprobar cuota o limitar concurrencia. Tampoco configura `max_output_tokens`. Sigue presente en el repositorio, en configuración y en CI, aunque el editor activo usa primitivas v2.

**Prueba:** 30 peticiones concurrentes con el mismo usuario produjeron 30 llamadas al proveedor simulado y 30 respuestas `200`. No intervino ninguna cartera. Su formato v1 no sirve como propuesta del editor actual, pero el consumo del proveedor sí ocurre.

**Impacto:** si está desplegado y accesible, ofrece una vía de gasto al margen de los controles nuevos. La disponibilidad remota de esta función no se comprobó.

**Corrección:** retirar o desactivar la ruta antes de consultar al proveedor, o incorporarla al mismo control de consumo. Comprobar también el endpoint ya desplegado; retirar únicamente su botón no resuelve el problema.

**Aceptación:** una llamada directa autenticada a la ruta retirada se rechaza sin invocar IA.

### B-02 — El chat gratuito carece de protecciones contra abuso

**Ubicación:** [primitive-handler.ts](../supabase/functions/studio-agent/primitive-handler.ts#L150), [política vigente](politica-uso-ia.md).

Solo `task: "build"` reserva créditos. El chat llama al proveedor sin límite propio de consultas o concurrencia. El payload tiene un límite de bytes, pero no existe un presupuesto de contexto para IA; ambas modalidades carecen de `max_output_tokens`. El timeout de 50 segundos no sustituye esos controles.

**Prueba:** 20 chats simultáneos del mismo usuario completaron con proveedor simulado, con **0 llamadas al sistema de créditos**. Una escena válida con 80 bloques de texto de 10.000 caracteres produjo una petición al proveedor de **843.149 bytes**. Esto acredita el tamaño enviado y la ausencia del control; no mide tokens, coste o aceptación por un modelo real.

**Impacto:** una cuenta puede provocar llamadas paralelas y repetidas, contextos costosos o rechazos por tamaño. Cinco créditos de generación no acotan el gasto total.

**Corrección:** conservar el chat sin cobro si esa es la política, añadiendo reservas atómicas de concurrencia, frecuencia por cuenta, presupuesto global, interruptor de emergencia y límites de entrada/salida por modalidad. Resumir o seleccionar el contexto de la escena.

**Aceptación:** superar los límites devuelve `429`/`503` antes de llamar al proveedor; entradas excesivas se rechazan o reducen y toda petición tiene tope explícito de salida. La ausencia de cuota es deliberada según la política actual: este hallazgo es un riesgo operativo, no un cobro incorrecto.

### B-03 — Falta una barrera de beta cerrada en servidor

**Ubicación:** [AuthProvider.tsx](../src/features/auth/AuthProvider.tsx), [config.toml](../supabase/config.toml#L177), [migración de créditos](../supabase/migrations/20261114162513_agent_generation_credits.sql).

El registro está habilitado, la interfaz permite crear cuentas y no hay una lista de participantes que se compruebe antes de habilitar las funciones remotas. Cada alta recibe cinco créditos. Las invitaciones de aula controlan matrícula académica; no restringen el registro ni el chat del lienzo.

**Impacto:** si el servicio alojado coincide con el repositorio, conocer el enlace basta para intentar entrar y obtener recursos. No es todavía una beta cerrada por diseño del servidor.

**Corrección:** altas administradas o invitaciones de un solo uso, con pertenencia a la beta vinculada al UUID y comprobada en servidor. Mantener separado el acceso público al lienzo local si se desea. Supabase ofrece un [hook previo a crear usuarios](https://supabase.com/docs/guides/auth/auth-hooks/before-user-created-hook) que permite rechazar altas según la política elegida.

**Aceptación:** una cuenta no invitada no puede usar servicios remotos de la beta ni obtener créditos útiles mediante llamadas directas. Verificar la configuración alojada, además de `config.toml`.

### B-04 — Pages puede publicarse sin esperar la validación del backend

**Ubicación:** [deploy-pages.yml](../.github/workflows/deploy-pages.yml#L17), [ci.yml](../.github/workflows/ci.yml), [remote-checks.yml](../.github/workflows/remote-checks.yml).

El workflow de publicación ejecuta controles de frontend. Las pruebas SQL y de Edge Functions viven en otro workflow, sin una dependencia de publicación declarada respecto a sus resultados. Las integraciones remotas son manuales. Publicar el frontend tampoco aplica las migraciones o funciones de las que depende.

**Impacto:** el flujo declarado admite publicar una interfaz cuyo backend falle o no esté actualizado. Protecciones de rama externas podrían reducir este riesgo, pero no se inspeccionaron.

**Corrección:** condicionar la publicación al éxito de frontend, SQL y Edge para el mismo commit, y comprobar compatibilidad con el backend destino. Eliminar el respaldo automático al proyecto piloto en entornos que deban estar aislados: las variables ausentes deben producir un fallo explícito.

**Aceptación:** un fallo deliberado de SQL/Edge impide publicar; el release registra commit, migraciones y funciones efectivamente verificadas.

### B-05 — Carrera al cambiar de aula

**Ubicación:** [WorkspaceProvider.tsx](../src/features/workspace/WorkspaceProvider.tsx#L115).

`loadDetails` actualiza miembros, grupos y pertenencias cuando termina, sin comprobar que el aula solicitada siga activa ni invalidar respuestas anteriores. `refresh` y `selectClassroom` pueden disparar lecturas solapadas.

**Reproducción:** entrar en A, seleccionar B con respuesta retrasada, volver a A y completar finalmente la petición de B. La prueba terminó con `activeClassroom.id === "A"` y miembros de B.

**Impacto:** nombres, roles y opciones de grupos incoherentes con el aula visible. Puede inducir acciones sobre el contexto equivocado. No se demostró una evasión de RLS ni acceso a un aula no autorizada.

**Corrección:** identificar cada carga con una secuencia o contexto vigente, descartar respuestas obsoletas y limpiar detalles al iniciar el cambio. Incluir la identidad de usuario en la invalidación.

**Aceptación:** respuestas en orden inverso nunca cambian los detalles del aula que ya dejó de estar activa.

### B-06 — Un número no nulo puede presentarse como cero exacto

**Ubicación:** [math.ts](../src/core/primitives/math.ts#L83), [AdvancedVisual.tsx](../src/features/primitives/AdvancedVisual.tsx).

`displayNumber` convierte cualquier valor con magnitud menor que `1e-12` en el texto `0`.

**Reproducción:** la matriz `[[1e-7, 0], [0, 1e-7]]` tiene determinante aproximadamente `1e-14` e inversa válida. El formateador muestra `det(m) = 0` mientras la interfaz puede mostrar también su inversa.

**Impacto:** contradicción matemática visible en un producto educativo. La aproximación numérica declarada no justifica mostrar un cero exacto sin indicarlo.

**Corrección:** usar notación científica para números pequeños no nulos; distinguir cero exacto, redondeo y tolerancia numérica.

**Aceptación:** el ejemplo muestra un determinante no nulo; valores positivos y negativos pequeños conservan magnitud y signo en texto, tablas y matrices.

### B-07 — Validación tardía del número real de páginas PDF

**Ubicación:** [document-process/index.ts](../supabase/functions/document-process/index.ts#L58), [document-upload/index.ts](../supabase/functions/document-upload/index.ts).

`extractPages` obtiene `pdf.numPages` y recorre todas las páginas. La comparación con `expected_pages` ocurre después de la extracción. El número declarado al reservar la carga viene del cliente; el upload verifica tamaño, hash y firma básica, pero no el número real de páginas.

**Impacto posible:** un cliente directo puede declarar pocas páginas y subir un PDF de muchas páginas ligeras. Páginas vacías consumen trabajo sin agotar pronto el límite de caracteres. El rechazo llega después del procesamiento excesivo. No se ejecutó un ataque de carga.

**Corrección:** comparar `pdf.numPages` con lo declarado y con el máximo permitido antes del bucle; añadir un presupuesto de procesamiento y limpieza garantizada.

**Aceptación:** un archivo que exceda 100 páginas se rechaza antes de llamar a `getTextContent` sobre ellas. Este bloqueo aplica si se habilita la biblioteca durante la beta.

### B-08 — Límite de carga basado en una cabecera opcional

**Ubicación:** [document-upload/index.ts](../supabase/functions/document-upload/index.ts#L43).

Si falta `Content-Length`, se usa cero y se ejecuta `request.formData()` sin contar los bytes recibidos. El tamaño de `file` se comprueba después del parseo completo. Los campos adicionales también pueden aumentar el cuerpo.

**Impacto posible:** consumir memoria por encima del límite previsto por la aplicación, hasta el límite que imponga la plataforma. No se midieron los límites efectivos del gateway.

**Corrección:** limitar los bytes realmente leídos y el multipart completo, aun sin esa cabecera; mantener la comprobación posterior del archivo.

**Aceptación:** un multipart que exceda el presupuesto se corta con `413`, con y sin `Content-Length`, antes de materializar todo el contenido.

### B-09 — Un JSON `null` provoca una excepción en borrado

**Ubicación:** [document-delete/index.ts](../supabase/functions/document-delete/index.ts#L20).

El cast `await request.json() as DeleteRequest` no valida el valor. Un cuerpo `null` es JSON válido y sale del `try`, pero `body.documentId` lanza una excepción fuera del manejo de errores.

**Impacto:** una entrada inválida acaba en error no controlado en lugar de `400`. No se demostró borrado indebido.

**Corrección:** validar el cuerpo como objeto no nulo mediante un esquema antes de leer propiedades, con límite de lectura compartido.

**Aceptación:** `null`, arrays, valores escalares y UUID inválidos reciben un error `400` estable sin llegar a Storage o a escrituras de base de datos.

### B-10 — Crecimiento y sincronización de escenas sin presupuesto global

**Ubicación:** [usePrimitiveStore.ts](../src/features/primitives/usePrimitiveStore.ts#L136), [tabla visual_scenes](../supabase/migrations/20261113205822_promote_general_scenes.sql), [PrimitiveCanvas.tsx](../src/features/primitives/PrimitiveCanvas.tsx#L1172).

La sincronización descarga el JSON completo de todas las escenas devueltas, las valida y calcula sus hashes. Se repite al editar y cada 20 segundos mientras la página está visible. No pagina. El límite de 1 MiB es por escena: no existe una cuota de número/tamaño acumulado por usuario en esta tabla ni una operación de borrar lienzos en la interfaz actual.

**Impacto posible:** transferencia y CPU crecientes, bloqueo de la copia local al agotar almacenamiento del navegador y biblioteca parcial al superar el límite de filas del API. Los PDFs sí tienen cuotas; las escenas no tienen ese control equivalente. No se hizo una prueba de carga para cuantificar el umbral.

**Corrección:** listar metadatos paginados, cargar contenido bajo demanda, consultar cambios por revisión, fijar cuotas acumuladas y ofrecer borrado con política de sincronización. Evitar serializar la biblioteca completa en cada movimiento.

**Aceptación:** una biblioteca de prueba que exceda el límite de una página del API se recupera completa; escenas sin cambios no se retransfieren; alcanzar cuota genera una respuesta explicada y no un falso estado de guardado.

## Desfase encontrado en el entorno local

La primera ejecución SQL sobre la base habitual falló porque faltaban `visual_scenes`, `studio_workspaces` y `fontex_ai.admins`. `migration list --local` mostró **9 migraciones del repositorio pendientes**, más una entrada aplicada `20261111223857` sin archivo equivalente actual.

Esto es un hallazgo del entorno local, no prueba de un defecto de las migraciones ni de un fallo en producción. Para distinguirlo se creó otro proyecto temporal, se aplicaron las 18 migraciones y pasaron las 207 pruebas. No se reseteó ni se migró la base habitual. Conviene reconciliar su historial antes de usarla como referencia de desarrollo.

El proyecto temporal `fontex-beta-audit-20261114` quedó detenido, conservando un respaldo local de sus datos de prueba. La revisión automática bloqueó su eliminación; no se borraron volúmenes de la base habitual.

## Mejoras recomendadas para operar la beta

1. **Recuperar propuestas generadas.** El servidor liquida el crédito antes de entregar el resultado y el cliente descarta la propuesta si cambió la escena durante la generación. La política lo permite, pero el trabajo no queda recuperable en un historial de propuestas. Guardar una propuesta privada por ID de solicitud permitiría recuperarla sin una nueva generación. Mostrar el coste y la condición antes de construir.
2. **Contener y diagnosticar fallos de interfaz.** Añadir un límite de errores de React con recuperación y exportación del trabajo, más registros estructurados con versión, ruta e ID de solicitud. No registrar por defecto preguntas, documentos ni contenido de escenas. Actualmente no aparece un mecanismo global de recuperación ni seguimiento de errores del frontend.
3. **Cerrar la experiencia de participantes.** Incorporar un botón para reportar problemas, instrucciones breves de inicio, alcance de la beta y explicación visible de qué datos se guardan, se envían a IA y cómo solicitar su eliminación. El repositorio no muestra una política de privacidad accesible desde registro/landing; esto requiere definición del producto, no se presenta aquí como conclusión legal.
4. **Proteger administración y cuentas.** Alinear el mínimo de contraseña del servidor, actualmente 6, con los 8 caracteres que exige la interfaz. Exigir un nivel de sesión reforzado para asignar créditos, preparar un administrador de recuperación y verificar entrega de correos. SMTP no está configurado en el archivo y `email_sent` vale 2/h; verificar los valores alojados antes de invitar una cohorte.
5. **Verificar el recorrido real.** Incorporar pruebas de navegador para ingreso/recuperación, edición, guardado y reapertura, dos pestañas/dispositivos, importación/exportación, móvil, impresión PDF y recuperación tras cortes de red. Los mocks de `ResizeObserver`, media queries y DOM no acreditan el comportamiento visual real.
6. **Medir con datos representativos.** Registrar latencia, errores, rechazos por cuota, generaciones válidas, recuperación del guardado y transferencias por sesión. El build contiene aproximadamente 415 KB de JS principal, 223 KB del chunk Supabase y un worker PDF de 1,26 MB sin comprimir; el worker se carga bajo demanda. Medir en un móvil de gama media antes de ampliar funcionalidades.
7. **Simplificar mantenimiento.** Etiquetar código y documentos retirados, actualizar `docs/README.md` —todavía habla de nueve primitivas— y mantener una única guía de release. Conservar respaldos recuperables sin presentarlos como rutas activas. Mantener la CLI fijada hasta planificar una actualización: el [cambio de Supabase CLI v3](https://supabase.com/changelog/supabase-cli-v3) afecta comandos y comportamiento sobre entornos alojados.

## Orden de trabajo propuesto

| Etapa | Trabajo | Condición de salida |
|---|---|---|
| Antes de abrir acceso | B-01, B-02 y B-03 | Invitados autorizados, rutas retiradas cerradas, gasto acotado en servidor |
| Preparar release | B-04 y verificación del backend destino | Mismo commit validado en frontend, funciones y esquema; correos y recuperación comprobados |
| Preparar funciones de biblioteca | B-07 y B-08 | PDFs fuera de límites rechazados antes de trabajo excesivo |
| Corregir errores funcionales | B-05, B-06 y B-09 | Regresiones cubiertas y comportamiento corregido |
| Primera iteración de beta | B-10, recuperación, soporte y observabilidad | Guardado medible, propuestas recuperables e incidencias trazables |

Para una primera cohorte, sugiero empezar con **20–30 cuentas invitadas**, limitar las funciones remotas a las que hayan pasado su recorrido real y ampliar después de revisar incidencias. Es una propuesta de alcance, no una capacidad medida del sistema.

## Criterios para autorizar la apertura

- [ ] Las 5 incidencias P1 están resueltas, o la funcionalidad afectada está deshabilitada en servidor.
- [ ] Usuarios no invitados y llamadas directas no acceden a recursos remotos de la beta.
- [ ] Frecuencia, concurrencia, contexto, salida y presupuesto global de IA tienen límites comprobados.
- [ ] El release verifica la misma revisión de frontend, funciones y migraciones del entorno destino.
- [ ] Se repiten allí las integraciones pertinentes; las omitidas se registran como pendientes, no aprobadas.
- [ ] Registro/invitación, confirmación de correo y recuperación funcionan con correos reales.
- [ ] Guardar, recargar, cambiar de cuenta y resolver conflictos conserva el trabajo y el aislamiento.
- [ ] Los casos B-05 y B-06 están corregidos o el área afectada queda fuera de la cohorte inicial.
- [ ] Existe un canal de incidencias, un responsable de atención y una forma de pausar IA sin publicar otra versión.
- [ ] Se ha comprobado una restauración de datos y un retorno de versión en un entorno de pruebas.

## Controles existentes que conviene conservar

RLS por propietario y ámbito académico, revisiones para evitar sobrescrituras, conservación de copias en conflictos, carteras con reserva/reembolso/idempotencia, administración por UUID en esquema privado, validación de acciones antes de aplicarlas y ausencia de ejecución de código generado. Markdown desactiva HTML y KaTeX usa `trust: false`. Las migraciones y pruebas SQL proporcionan una base reproducible.

Estos controles explican por qué la recomendación es reforzar acceso, operación y casos concretos, sin plantear una reescritura del producto.
