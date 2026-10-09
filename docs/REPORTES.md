# Reportes de desarrollo de Fontex

Este archivo es el registro versionado de las intervenciones realizadas en el proyecto. Cada nueva acción de desarrollo debe añadir una versión al inicio del historial, sin borrar reportes anteriores.

## Convención de versiones

- **Mayor (`X.0.0`)**: cambio de arquitectura o etapa principal incompatible.
- **Menor (`0.X.0`)**: bloque funcional o capacidad nueva.
- **Parche (`0.0.X`)**: corrección, ajuste visual, documentación o mantenimiento.

Cada reporte incluye alcance, cambios, archivos relevantes, validaciones reales, limitaciones y siguiente paso permitido.

---

## v0.5.0 — Motor de extracción, indexación y recuperación RAG

**Fecha:** 9 de octubre de 2026
**Bloque:** 3 — Extracción, indexación y motor RAG
**Estado:** Implementado, validado y publicado

### Objetivo autorizado

Convertir los PDF privados del Bloque 2 en una base documental recuperable: extracción server-side con referencia de página, fragmentación reproducible, embeddings versionados, búsqueda híbrida autorizada y una interfaz diagnóstica en Biblioteca. Los resultados no se conectarán todavía con `tutor-chat` y no se modificarán su modelo, prompt ni parámetros.

### Registro de acciones

1. **Auditoría integral previa.** Se leyó la orden completa del Bloque 3 y se revisaron plan maestro, arquitectura, dependencias, sistema visual, reporte vigente, migraciones, pruebas RLS, tipos de base de datos, servicios y componentes documentales, funciones Edge y workflows de CI/Pages.
2. **Estado local y remoto.** `main` comenzó limpio en `76fa127`, sincronizado con `origin/main`. Las cuatro migraciones locales coinciden con las remotas; `tutor-chat` v1, `document-upload` v2 y `document-delete` v1 permanecen activas. Se verificó por nombre y huella que `OPENAI_API_KEY` existe sin leer ni registrar su valor.
3. **Capacidad vectorial.** El proyecto remoto ofrece pgvector 0.8.2, aún no instalado. Se comprobó que `pdfjs-dist@6.4.299` puede importarse desde Deno y expone `getDocument`, por lo que la extracción puede reutilizar la dependencia ya auditada sin sumar otro parser.
4. **Decisión de recuperación.** Se adopta `text-embedding-3-small` con dimensión estándar 1536, `vector(1536)`, similitud coseno, texto completo y fusión Reciprocal Rank Fusion. El piloto usará búsqueda vectorial exacta; HNSW queda condicionado a volumen y métricas reales.
5. **Decisión de procesamiento.** La indexación será reanudable y por lotes: extracción y chunks se persisten una vez; las invocaciones posteriores completan embeddings pendientes bajo un lease exclusivo. Ningún fragmento parcial será recuperable hasta que el trabajo completo alcance `ready`.
6. **Límite de confianza.** Sólo el propietario podrá iniciar o reintentar el procesamiento. La búsqueda se ejecutará mediante una RPC autenticada que aplica `private.can_access_document`, estado listo, versión de modelo y alcance; no habrá lectura directa de chunks desde el navegador ni confianza en filtros enviados por el cliente.
7. **Contrato SQL y aislamiento.** La migración aditiva `20261009230000_block3_rag_indexing_and_retrieval.sql` habilita pgvector, límites, trabajos con lease, chunks con página y versión, métricas de búsqueda, guardado transaccional de lotes y recuperación híbrida. Las tablas nuevas tienen RLS; los chunks y RPC internas no conceden acceso directo a `authenticated`.
8. **Matriz pgTAP.** Se añadió `block3_rag_rls.test.sql` para probar propietario, usuario ajeno, acceso privado/grupo/aula, revocación, exclusión de índices parciales, bloqueo de escrituras y bloqueo de la RPC interna. La matriz detectó que el scope `private` incluía documentos propios compartidos; se corrigió para coincidir con la clasificación visual. La reconstrucción desde cero y 91 pruebas acumuladas aprobaron.
9. **Procesamiento Edge reanudable.** `document-process` descarga el PDF privado, confirma SHA-256 y páginas reales, extrae texto con PDF.js en servidor, normaliza, fragmenta con página, aplica presupuestos y embebe lotes de 16. Cada lote se confirma bajo lease; sólo el último cambia el trabajo a `ready`. Fallos quedan tipificados sin registrar contenido.
10. **Recuperación Edge protegida.** `document-search` valida consulta, alcance y cantidad, genera un solo embedding y llama como servicio a la RPC que filtra primero por identidad, permisos actuales, índice listo, modelo y scope. Se registran tokens, latencia y cantidad devuelta; el límite inicial es 60 búsquedas por hora y 10 resultados.
11. **Biblioteca diagnóstica.** La carga intenta indexar automáticamente y conserva el PDF si el índice falla. Las tarjetas muestran estado y progreso, permiten reintentar al propietario y el panel RAG presenta fragmentos, documento, páginas y score RRF, marcado explícitamente como no conectado al tutor.
12. **Calidad de código inicial.** Ambas funciones pasan `deno check` y `deno lint`; el fragmentador pasó 3 pruebas específicas. TypeScript y ESLint finalizaron sin errores; Vitest aprobó 65 pruebas activas en 12 archivos, con 2 suites remotas omitidas por configuración. `npm audit` reportó 0 vulnerabilidades.
13. **Presupuesto y coste.** Con la referencia de USD 0,02 por millón de tokens, el tope de 100.000 tokens equivale aproximadamente a USD 0,002 por documento, USD 0,02 por diez documentos y USD 0,20 por cien. Cien documentos al máximo de 240 chunks producirían 24.000 vectores y cerca de 141 MiB de valores vectoriales antes de overhead. HNSW se evaluará cerca de 100.000 chunks o p95 superior a 300 ms.
14. **Preflight de producción.** Se generó un respaldo de esquema de 60.609 bytes en el directorio temporal. La instancia tenía 0 organizaciones, aulas, documentos y objetos, y una cuenta original. El primer `dry-run` propuso exclusivamente la migración principal del Bloque 3.
15. **Migración y despliegue remotos.** Se aplicaron `20261009230000_block3_rag_indexing_and_retrieval.sql` y la corrección explícita `20261009233500_align_rag_metric_constraints.sql`; las seis migraciones locales/remotas coinciden. Se fijaron `EMBEDDING_MODEL` y `EMBEDDING_DIMENSIONS` como secretos y se desplegaron `document-process` v1 y `document-search` v1 con JWT obligatorio.
16. **Funciones anteriores preservadas.** No se modificó ni desplegó código de `tutor-chat`, `document-upload` o `document-delete`. La propagación de secretos de Supabase incrementó sus números de revisión de plataforma, pero sus hashes, rutas y fechas de código permanecen iguales.
17. **E2E remoto real.** Un arnés temporal cargó un PDF seleccionable, verificó extracción y página, creó un embedding OpenAI real, confirmó un job completo con tokens, recuperó como propietario, devolvió cero al ajeno, habilitó búsqueda al compartir con un grupo, la retiró inmediatamente al revocar y comprobó cascada tras borrar. La primera pasada detectó que el propietario ficticio no pertenecía al grupo —requisito correcto del Bloque 2—; se corrigió el arnés. Las dos pasadas funcionales finales aprobaron en 15,7 s y 16,1 s.
18. **Limpieza remota.** Tras cada pasada se eliminaron objeto, documento, chunks, job, métricas, grupo, aula, organización y cuatro cuentas temporales. La consulta independiente final devolvió 0 filas/objetos de prueba y únicamente la cuenta original.
19. **CI ampliado.** El workflow incorpora un job Deno separado que comprueba y lintea ambas funciones RAG y sus módulos compartidos. La pasada local equivalente aprobó los cuatro archivos.
20. **Validación final local.** `npm ci` instaló 385 paquetes, la auditoría quedó en 0 vulnerabilidades, TypeScript y ESLint aprobaron, Vitest aprobó 66 pruebas activas en 13 archivos, el build de producción terminó correctamente y las 93 pruebas pgTAP aprobaron tras reconstruir seis migraciones desde cero. Los lint SQL local y remoto no reportaron observaciones.
21. **Commit funcional.** Los 31 archivos del Bloque 3 se registraron en `c7846ce` con el mensaje `feat(rag): implement secure document indexing and retrieval`; el commit contiene 2.917 inserciones y no incluye secretos ni cambios al código del tutor.
22. **Publicación Git.** El reporte de validación se registró en `cf281a8` y `main` se publicó desde `76fa127` hasta ese commit.
23. **GitHub Actions.** CI `37998822580` aprobó los jobs `quality`, `database-security` y el nuevo `edge-functions`. Pages `37998822663` aprobó build y deploy sobre `cf281a8`.
24. **Dominio público.** `https://fontex.sypablitodp.site/` respondió HTTP 200 con el título oficial. Su bundle publicado contiene el panel `Diagnóstico de recuperación RAG`, llamadas a `document-process`/`document-search` y la advertencia `No conectado al tutor`.

### Arquitectura decidida antes de implementar

- Una migración aditiva habilitará `vector`, trabajos de procesamiento, chunks con rango de páginas y metadatos de modelo, límites RAG y contabilidad de búsquedas.
- Los límites cubrirán caracteres extraídos, chunks, tokens por documento, tamaño de lote, concurrencia, reintentos, resultados máximos y consultas por hora.
- La Edge Function de procesamiento volverá a descargar el objeto privado, verificará hash y número real de páginas, normalizará texto y conservará trazabilidad por página.
- La Edge Function de búsqueda generará un único embedding de consulta y delegará en PostgreSQL la recuperación híbrida ya filtrada por permisos.
- Biblioteca mostrará estados reales de indexación y un panel diagnóstico protegido; el tutor no consumirá estos resultados en v0.5.0.

### Validación acumulada

| Verificación | Estado |
|---|---|
| Árbol Git inicial | Limpio y sincronizado |
| Migraciones local/remoto | 6/6 coincidentes |
| Funciones remotas | 5 activas con JWT; dos RAG nuevas y hashes previos preservados |
| Configuración OpenAI | Secreto presente, valor no expuesto |
| pgvector remoto | 0.8.2 instalado por migración |
| PDF.js en Deno | Importación 6.4.299 correcta |
| Base local desde cero | 6 migraciones aplicadas; 93 pruebas pgTAP aprobadas |
| Deno | `document-process` y `document-search` pasan check/lint |
| Frontend | TypeScript, ESLint, 66 pruebas y build aprobados |
| Dependencias npm | 0 vulnerabilidades reportadas |
| E2E remoto | Extracción, OpenAI, permisos, revocación y cascada aprobados |
| Estado remoto final | 0 datos/objetos de prueba; 1 cuenta original |
| GitHub Actions | CI `37998822580` y Pages `37998822663` en `success` |
| Dominio | HTTP 200 y bundle v0.5.0 verificado |

### Pendiente inmediato

El Bloque 3 queda cerrado. La conexión de resultados con el tutor, composición de contexto y citas corresponde al Bloque 4 y requiere una orden explícita posterior.

---

## v0.4.0 — Biblioteca documental y almacenamiento privado

**Fecha:** 9 de octubre de 2026
**Bloque:** 2 — Biblioteca documental segura
**Estado:** Implementado, validado y publicado

### Objetivo autorizado

Sustituir la biblioteca demostrativa por un módulo real para PDF con metadatos en PostgreSQL, archivos en Supabase Storage privado, permisos por propietario, grupo y aula, cuotas confiables, visualización con PDF.js y pruebas de aislamiento. El tutor existente conserva su comportamiento general y el motor RAG permanece fuera de alcance.

### Registro de acciones

1. **Auditoría integral previa.** Se leyeron el plan maestro completo, el historial versionado, la arquitectura, el sistema visual, las dependencias, todas las migraciones y pruebas RLS vigentes, y los módulos de Auth, espacios de trabajo, grupos, biblioteca y tutor.
2. **Protección del trabajo existente.** `main` está limpio y sincronizado con `origin/main` en `6240bc2`; contiene los cierres posteriores al commit funcional `v0.3.0` y no presenta cambios locales que deban sobrescribirse.
3. **Hallazgos iniciales.** La biblioteca sigue siendo enteramente ficticia; no existen tablas documentales ni bucket. Las políticas de grupos no exponen documentos porque aún no existen, pero la futura autorización deberá exigir simultáneamente matrícula activa y pertenencia al grupo. La RPC `create_workspace` permite el bootstrap a la primera cuenta autenticada cuando no hay organizaciones, condición insegura para un registro público que se endurecerá con configuración administrativa explícita.
4. **Preflight remoto de solo lectura.** El proyecto enlazado `goegjuglstapjwcckawp` está saludable sobre PostgreSQL 17 y conserva exactamente las dos migraciones versionadas. La consulta remota encontró 0 organizaciones, 0 aulas, 0 buckets, 0 bytes almacenados y 1 cuenta; no existen objetos documentales que puedan colisionar con la migración.
5. **Límites y documentación vigentes.** Se revisaron Storage privado, RLS, restricciones nativas de buckets, descarga autenticada, límites de Edge Functions y novedades recientes de Supabase. La cuota publicada del plan Free es 1 GB; como el CLI no expone el plan de facturación de la organización, el diseño adopta un límite global conservador de 750 MiB, además de 5 MiB por PDF, 100 páginas, límites por usuario y aula. `pdfjs-dist` 6.4.299 es la versión vigente comprobada y declara Apache-2.0.
6. **Migración y pruebas de base iniciales.** Se creó mediante Supabase CLI la migración aditiva `20261009203710_block2_secure_document_library.sql`: incorpora `documents`, `document_shares`, `document_limits`, RLS, helpers privados, reserva transaccional con advisory locks, deduplicación SHA-256, bucket privado y política de descarga autenticada. También endurece el primer workspace con una autorización administrativa de un solo uso y añade una matriz pgTAP específica del Bloque 2.
7. **Reconstrucción local de Supabase.** Docker Desktop se inició sin interacción después de detectar que estaba detenido. La primera reconstrucción señaló un alias SQL reservado; se corrigió y la segunda aplicó las tres migraciones desde cero. `supabase test db --local` aprobó 75 pruebas en 2 archivos; `db lint` y `db advisors` locales finalizaron sin observaciones.
8. **Edge Functions documentales.** `document-upload` valida JWT, reserva, propietario, vencimiento, tamaño, MIME, nombre, firma PDF básica y SHA-256 antes de subir sin `upsert`; solo marca `ready` tras confirmar Storage y limpia el objeto si falla la finalización. `document-delete` verifica propietario, elimina primero el objeto y luego los metadatos con sus comparticiones. Ambas aprobaron `deno check` y `deno lint`.
9. **Biblioteca y visor reales.** La vista ficticia se sustituyó por servicios, hook y componentes para carga confirmada, búsqueda, filtros, orden, estados, descarga, apertura, borrado, compartición y revocación. PDF.js 6.4.299 se carga bajo demanda, valida hasta 100 páginas y texto seleccionable, renderiza ajustado al ancho y libera worker, tareas y URLs temporales.
10. **Integración local de extremo a extremo.** El stack completo de Supabase ejecutó la suite con cinco usuarios, dos grupos y un PDF físico. Se comprobaron carga mediante Edge Function, descarga privada real, denegación a otro grupo/docente/ajeno/anónimo, compartir y revocar, pérdida de acceso al retirar matrícula, bloqueo de subida directa, fallo de firma sin objeto disponible, bucket no público y eliminación física con limpieza. La suite finalizó correctamente y eliminó usuarios, filas y objetos de prueba.
11. **Calidad de frontend acumulada.** TypeScript y ESLint pasan. Vitest cubre validación de archivos, alcance visual, ausencia de contadores ficticios y un PDF seleccionable real abierto con PDF.js, además de conservar las pruebas anteriores. La suite remota se mantiene condicionada a credenciales y reutiliza la misma matriz probada localmente.
12. **Preflight de producción.** La instancia remota continúa con las dos migraciones anteriores, sin organizaciones, aulas, buckets ni bytes almacenados. No ofrece PITR ni snapshots físicos listables, por lo que se generó un respaldo de esquema previo de 37.798 bytes en el directorio temporal del sistema. El `db push --dry-run --skip-vault` detectó exclusivamente `20261009203710_block2_secure_document_library.sql`; la revisión no encontró `DROP`, `TRUNCATE` ni eliminación de datos existentes. `tutor-chat` sigue activo en versión 1 y no será redeployado.

13. **Migración y funciones remotas.** La migración principal se aplicó al proyecto enlazado y se desplegaron exclusivamente `document-upload` y `document-delete`, ambas activas con verificación JWT. `tutor-chat` permanece intacta en su versión 1.
14. **Compatibilidad de descarga hospedada.** El primer E2E remoto confirmó que el objeto se almacenaba y era legible con rol administrador, pero la lectura del propietario devolvía `NoSuchKey`: el marcador interno `storage.allow_only_operation` no coincidía en el servicio hospedado aunque funcionaba localmente. Se creó la migración aditiva `20261009211357_fix_document_download_policy.sql`, que conserva la autorización por bucket, documento listo, propietario, aula/grupo y matrícula, y elimina únicamente ese filtro auxiliar. La reconstrucción local y las 75 pruebas pgTAP volvieron a aprobar.
15. **Revocación sin caché.** El E2E remoto posterior permitió la descarga autorizada y bloqueó accesos iniciales, pero una descarga ya autorizada permanecía servible desde caché después de revocar el grupo, pese a que RLS ocultaba inmediatamente la metadata. `document-upload` pasa a guardar PDFs privados con `cacheControl: "0"` y el cliente usa `cacheNonce` junto con `cache: "no-store"`, obligando a que cada solicitud posterior vuelva a evaluar la política vigente.
16. **E2E remoto aprobado.** Tras las dos correcciones de compatibilidad, la suite remota completó en 25,32 s la carga, descargas autorizadas, bloqueos, compartición, revocación, expulsión, rechazo de firma falsa, eliminación física y limpieza. La pasada acumulada posterior detectó únicamente un acceso diagnóstico a una propiedad no declarada por el tipo `StorageError`; se simplificó el mensaje para mantener TypeScript estricto sin alterar el escenario.
17. **Coherencia del producto y documentación.** La revisión final contra la orden eliminó dos mensajes heredados que aún presentaban Biblioteca/Storage como demostración o pendiente, actualizó la descripción exacta de descarga sin caché y extendió el sistema de diseño con los patrones del módulo documental.
18. **Revisión visual autenticada.** Se creó un docente y un aula exclusivamente en el Supabase local, se abrió Biblioteca con Edge automatizado a 1440 × 900 y 390 × 844 en temas claro y oscuro, y se comprobó título, CTA, estado vacío y ausencia de desbordamiento horizontal. Las cuatro capturas se inspeccionaron visualmente; la cuenta, aula y archivos auxiliares fueron eliminados y sus conteos terminaron en cero.
19. **Commit funcional.** La implementación completa se registró en `2fe4b78` con el mensaje `feat(library): implement secure PDF library`; incluye 37 archivos y no contiene secretos ni artefactos del arnés visual.
20. **Publicación automatizada.** `main` se publicó hasta `99f5a7c`. GitHub Actions aprobó CI `37993604561` y Pages `37993604458`; el dominio respondió HTTP 200 y su bundle contiene `document-upload`, `fontex-documents`, el worker de PDF.js y el estado vacío real del Bloque 2.
21. **Flujo público real.** En `https://fontex.sypablitodp.site/` una cuenta docente temporal inició sesión, cargó un PDF seleccionable mediante la interfaz publicada, lo vio aparecer como privado, lo abrió en el visor PDF.js y lo eliminó. La captura final confirmó el mensaje de eliminación; el bloque `finally` limpió Storage, metadata, aula, organización y usuario. La comprobación posterior devolvió 0 filas/objetos de prueba y únicamente la cuenta original.

### Arquitectura entregada

- `documents` conserva propietario derivado de sesión, aula, nombre, MIME, tamaño, páginas, SHA-256, ruta aleatoria, estado y vencimiento de reserva.
- `document_shares` representa permisos explícitos de grupo o aula; restricciones, FKs y trigger impiden asociaciones cruzadas.
- `document_limits` centraliza 5 MiB y 100 páginas por PDF, 10 documentos y 50 MiB por usuario, 500 MiB por aula y 750 MiB globales.
- `reserve_document_upload` aplica matrícula, deduplicación y cuotas bajo advisory locks antes de emitir una ruta UUID no predecible.
- El bucket `fontex-documents` es privado, acepta sólo `application/pdf` hasta 5 MiB y no concede escrituras directas al navegador.
- `document-upload` y `document-delete` coordinan Storage y metadata con JWT; la descarga sigue sometida a RLS en cada solicitud y no usa URLs públicas ni firmadas.
- La interfaz separa servicios, hook, tarjetas, carga, compartición y visor PDF.js; no envía texto ni archivos al tutor.

### Seguridad y políticas

- `anon` no recibe acceso a tablas documentales ni objetos.
- El propietario accede a su documento; grupo exige matrícula y pertenencia activas; aula exige matrícula activa.
- El docente puede publicar para su aula, pero no adquiere lectura implícita de documentos privados de estudiantes.
- No existen políticas Storage de `INSERT`, `UPDATE` o `DELETE` para usuarios; una ruta o UUID conocidos no sustituyen autorización.
- El bootstrap del primer workspace requiere autorización privada de un solo uso; la cuenta piloto ya existente quedó autorizada por la migración.
- Los avisos remotos por RPC `SECURITY DEFINER` son intencionales: cada función valida JWT, rol y contexto y fija `search_path`. Sigue abierto el aviso de plataforma por protección de contraseñas filtradas deshabilitada.

### Estado de validación

| Validación | Resultado real |
|---|---|
| `npm ci` / `npm audit --omit=dev` | 385 paquetes; 0 vulnerabilidades |
| ESLint / TypeScript | Correctos, sin advertencias ni errores |
| Vitest local | 11 archivos y 62 pruebas aprobadas; 2 suites remotas omitidas sin variables |
| Build Vite | Correcto; PDF.js y worker quedan en chunks diferidos |
| Base local desde cero | 4 migraciones aplicadas; 75 pruebas pgTAP aprobadas |
| Supabase lint/advisors local | Sin errores ni observaciones |
| Deno | `check` y `lint` correctos para ambas funciones documentales |
| E2E Storage local | Flujo físico completo aprobado con cinco identidades y limpieza |
| E2E Storage remoto | Flujo físico completo aprobado en 25,32 s y limpieza confirmada |
| Estado remoto final | 0 organizaciones, aulas, documentos, shares y objetos de prueba; 1 cuenta original |
| Migraciones remotas | Las 4 migraciones locales y remotas coinciden |
| Edge Functions | `document-upload` v2 y `document-delete` v1 activas con JWT; `tutor-chat` v1 intacta |
| Revisión visual | Escritorio/móvil y claro/oscuro aprobados en Edge autenticado |

### Riesgos y límites abiertos

- La firma `%PDF-`/`%%EOF`, el hash y PDF.js reducen archivos inválidos, pero no constituyen análisis antivirus ni garantizan que un PDF sea inocuo.
- OCR, otros formatos, versionado de contenido, extracción, chunks, embeddings, recuperación y citas pertenecen al Bloque 3 o fases posteriores.
- Supabase mantiene deshabilitada la protección contra contraseñas filtradas; es una configuración de Auth del proyecto que debe activarse desde la plataforma cuando el plan y la política operativa lo permitan.

### Entregables y publicación

- Commit funcional: `2fe4b78` (`feat(library): implement secure PDF library`).
- Commit de reporte previo al despliegue: `99f5a7c` (`docs(report): record block 2 validation`).
- GitHub Actions: CI `37993604561` y Pages `37993604458`, ambos `success`.
- Dominio público: flujo autenticado de carga, listado, visor y eliminación aprobado en `https://fontex.sypablitodp.site/`.

### Límite vigente

No se implementarán extracción, fragmentación, embeddings, `pgvector`, recuperación semántica ni conexión documental con `tutor-chat`.

### Cierre y siguiente bloque permitido

El Bloque 2 cumple sus criterios de aceptación y queda cerrado. El siguiente trabajo permitido es el Bloque 3 — extracción, indexación y RAG sobre documentos autorizados — únicamente bajo una nueva orden explícita.

---

## v0.3.0 — Tutor con IA real y logotipo Fontex

**Fecha:** 8 de octubre de 2026
**Tipo:** Capacidad funcional e identidad de marca
**Estado:** Implementado, verificado y publicado

### Objetivo autorizado

Conectar el tutor del frontend con OpenAI exclusivamente a través de una Supabase Edge Function autenticada e incorporar al producto el símbolo de Fontex entregado por el propietario. La clave privada nunca debe llegar al navegador ni al repositorio.

### Registro de acciones

1. **Cierre de la publicación visual `v0.2.2`.** Los workflows remotos `CI` y `Deploy to GitHub Pages` concluyeron correctamente para el commit `ef3de35`.
2. **Auditoría segura de Supabase.** El proyecto vinculado `goegjuglstapjwcckawp` contiene el secreto `OPENAI_API_KEY`; solo se comprobó su nombre, sin leer ni imprimir su valor.
3. **Verificación del backend declarado.** `supabase functions list` devolvió `0` funciones desplegadas. El secreto estaba configurado, pero todavía no existía una Edge Function que pudiera atender al tutor.
4. **Contrato técnico actualizado.** La documentación vigente confirma el uso de `supabase.functions.invoke` desde el cliente autenticado y de Responses API desde el servidor. El resolvedor oficial de modelos devolvió `gpt-6-astra` como modelo vigente para una integración nueva.
5. **Tratamiento del logotipo.** El adjunto visual no apareció como archivo binario recuperable en el workspace. Para evitar una reinterpretación generativa de la marca, se implementará como SVG determinista basado en la geometría y colores entregados, sujeto a sustitución directa si posteriormente se aporta el original vectorial.
6. **Implementación del backend.** Se creó `tutor-chat` con `@supabase/server@1.9.1`, autenticación `user`, CORS automático, límites de historial y tamaño, Responses API, `store: false` y errores públicos sin datos sensibles. El modelo predeterminado es `gpt-6-astra` y puede cambiarse mediante `OPENAI_MODEL` en Supabase.
7. **Implementación del cliente.** `assistant-ui` invoca la función con la sesión y permite cancelar o agotar la solicitud. Sin configuración de Supabase conserva una demo explícita; en producción muestra `IA real conectada`.
8. **Honestidad del alcance.** Se retiraron las tres fuentes ficticias. La interfaz muestra `0 fuentes` y `Motor RAG pendiente`; las instrucciones del servidor prohíben inventar documentos, citas o páginas.
9. **Despliegue y prueba real.** La versión 1 de `tutor-chat` está `ACTIVE` con `verify_jwt: true`. CORS respondió `204`, una llamada no autenticada fue rechazada con `401` y una llamada autenticada temporal devolvió texto de `gpt-6-astra`. El usuario de prueba fue eliminado.
10. **Identidad publicada en el producto.** `public/brand/fontex-mark.svg` reproduce de forma determinista el símbolo cian, blanco e índigo recibido; se usa en `BrandMark` y como favicon. La revisión visual confirmó legibilidad y contraste en la pantalla de acceso de producción.
11. **Configuración de Pages.** El build usa las variables públicas del repositorio cuando existen y, en su ausencia, la URL y clave publicable del proyecto vinculado. Ninguna clave secreta se incorporó al bundle.
12. **Publicación comprobada.** CI `37876110840` y Pages `37876110796` terminaron correctamente sobre `ad1bcda`. El dominio público entrega el logo con HTTP 200 y sus chunks contienen el project ref, `tutor-chat`, `IA real conectada` y `Motor RAG pendiente`, sin las fuentes ficticias retiradas.

### Seguridad confirmada hasta este punto

- `OPENAI_API_KEY` permanece en los secretos de Supabase.
- No se añadieron claves privadas a archivos, comandos, reportes ni salida de consola.
- La aplicación web usará únicamente URL y clave publicable de Supabase, protegidas por Auth/RLS y aptas para cliente público.

### Validaciones completadas

| Validación | Resultado |
|---|---|
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test` | 8 archivos y 53 pruebas aprobadas; 1 integración de RLS omitida sin variables locales |
| `npm run build` | Correcto |
| Build Pages con Supabase | Correcto; contiene el project ref y el modo de IA real |
| `deno check` / `deno lint` | Correcto para `tutor-chat` |
| Edge Function | `ACTIVE`, versión 1, `verify_jwt: true` |
| CORS / acceso anónimo | `204` para preflight; `401` sin sesión |
| Invocación autenticada | Respuesta no vacía de `gpt-6-astra`; usuario temporal eliminado |
| Revisión visual | Logo y pantalla de Auth revisados en Chrome headless a 1440 × 900 |
| GitHub Actions | CI `37876110840` y Pages `37876110796`: `success` |
| Sitio público | Bundle Supabase/IA real y SVG confirmados en `https://fontex.sypablitodp.site/` |

### Entregables y commit principal

- Edge Function: `tutor-chat`, versión remota 1, desplegada en `goegjuglstapjwcckawp`.
- Activo visual: `public/brand/fontex-mark.svg`.
- Commit funcional: `a8c673e` (`feat(tutor): connect real AI and add Fontex logo`).

### Cierre y siguiente paso

La versión queda cerrada. Ya puede iniciarse la siguiente fase funcional por orden explícita; el siguiente avance natural del tutor es conectar documentos autorizados, recuperación y citas trazables sin deshacer la integración server-side actual.

---

## v0.2.2 — Identidad visual Fontex y temas claro/oscuro

**Fecha:** 8 de octubre de 2026
**Tipo:** Refactorización visual controlada
**Estado:** Implementado, verificado y publicado
**Nota de versión:** la solicitud proponía `v0.1.6`, pero se usa `v0.2.2` para continuar la secuencia vigente sin retroceder desde `v0.2.1`.

### Problema y objetivo

La interfaz mezclaba la paleta crema, verde y coral con valores HEX incrustados en páginas, componentes y estilos de `assistant-ui`. El objetivo es adoptar la identidad oficial cian, azul cielo, índigo y negro mediante tokens semánticos y ofrecer temas claro y oscuro persistentes, sin cambiar arquitectura, navegación ni funcionalidades educativas.

### Decisiones visuales

- El índigo `#1800AD` es la acción principal del tema claro y el azul cielo `#81C5FE` cumple esa función en oscuro.
- El cian `#06F0FC` se reserva para acentos sobre fondos con contraste controlado.
- El hero usa índigo profundo con texto claro en ambos temas para conservar identidad y legibilidad.
- Éxito, advertencia, error e información mantienen paletas semánticas independientes.
- `control-border` es más oscuro que el borde decorativo base para superar 3:1 frente al fondo.
- No se reconstruyó un logotipo aproximado: `BrandMark` conserva el identificador tipográfico y queda documentada la futura ruta `public/brand/` para los SVG oficiales.

### Implementación

- `globals.css` define los temas en `:root` y `:root[data-theme="dark"]` y los conecta con Tailwind CSS v4 mediante `@theme inline`.
- Se eliminaron de JSX los tokens `paper`, `forest`, `sage`, `coral` y los colores HEX de la paleta anterior.
- `ThemeProvider` detecta el sistema, observa cambios, persiste elecciones en `fontex-theme`, tolera fallos de almacenamiento y actualiza `data-theme`, `color-scheme` y el color del navegador.
- Un script previo a React evita el destello significativo del tema incorrecto.
- El selector accesible se incorporó al header, al flujo móvil y a la pantalla de autenticación.
- Inicio, Aula, Mi grupo, Biblioteca, Tutor y Administración consumen los nuevos tokens, incluidos formularios, badges, tarjetas, estados y controles.
- El tutor conserva su adaptador simulado y ahora tematiza conversación, mensajes, compositor, envío y panel de fuentes.

### Pruebas incorporadas

- Preferencia inicial del sistema y preferencia guardada.
- Alternancia, persistencia entre montajes y actualización de `data-theme`.
- Cambios del sistema sin selección manual y manejo de `localStorage` bloqueado.
- Etiqueta accesible del selector y persistencia durante navegación con `HashRouter`.
- Contraste calculado desde los valores reales de CSS para texto, controles y foco en ambos temas.
- Las pruebas existentes continúan cubriendo páginas principales y tutor simulado.

### Archivos principales

- `src/features/theme/ThemeProvider.tsx`
- `src/features/theme/ThemeToggle.tsx`
- `src/features/theme/theme.ts`
- `src/features/theme/ThemeProvider.test.tsx`
- `src/features/theme/contrast.test.ts`
- `src/styles/globals.css`
- `src/app/layouts/AppShell.tsx`
- `docs/design/DESIGN_SYSTEM.md`

### Límites respetados

- No se modificaron Supabase, migraciones, Auth, RLS, RAG ni el tutor simulado.
- No se añadieron dependencias.
- El logotipo vectorial oficial continúa pendiente de recibir sus archivos aprobados.

### Validaciones y publicación

| Validación | Resultado |
|---|---|
| `npm ci` | Correcto; 383 paquetes auditados y 0 vulnerabilidades |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test -- --run` | 7 archivos y 51 pruebas aprobadas; 1 integración remota omitida sin credenciales |
| Contraste automatizado | 24 comprobaciones aprobadas en claro y oscuro: texto ≥ 4.5:1; controles y foco ≥ 3:1 |
| `npm run build` | Correcto; sin incremento material de los chunks existentes |
| `VITE_BASE_PATH=/ npm run build` | Correcto; assets desde `/assets/` y bootstrap del tema anterior al entrypoint |
| Revisión visual en navegador | 36 capturas: 6 páginas × 2 temas × móvil, tablet y escritorio |
| Diagnóstico de navegador | Tema, encabezado y selector correctos; 0 excepciones y 0 desbordamientos horizontales en las 36 combinaciones |
| Auditoría de color en JSX/TSX | Sin tokens de la paleta anterior ni clases con colores HEX incrustados |

Las capturas comparativas se generaron como artefactos temporales fuera del repositorio para evitar incorporar binarios de validación al producto.

### Commit principal

- Commit: `663d27f`.
- Mensaje: `feat(ui): implement Fontex brand themes`.
- Alcance: tokens, temas, selector, adaptación completa, accesibilidad, pruebas y documentación del sistema de diseño.

### Siguiente paso permitido

Revisar el diff final, publicar y verificar CI y Pages. No iniciar el Bloque 2 antes de cerrar esta intervención.

---

## v0.2.1 — Corrección del cierre de PostgreSQL en CI

**Fecha:** 8 de octubre de 2026
**Estado:** Completado, publicado y verificado

### Diagnóstico

- La ejecución `37869420686` aprobó el job `quality` y las 34 pruebas de esquema/RLS del job `database-security`.
- El job terminó en fallo porque el paso de limpieza usaba `supabase db stop`, subcomando que no existe en Supabase CLI `2.120.0`.
- El despliegue de Pages `37869420684` sí terminó correctamente para `ddc3e8a`.

### Corrección

- El cleanup ahora usa el comando válido `supabase stop --no-backup` y permanece protegido por `if: always()`.
- No se cambiaron el esquema remoto, las políticas RLS ni el frontend.

### Validación local

- `npx supabase stop --no-backup`: correcto.
- `npx supabase db start`: reconstruyó ambas migraciones correctamente.
- `npx supabase test db --local`: 34 pruebas pgTAP aprobadas.
- `npx supabase stop --no-backup`: cleanup final correcto.

### Validación remota y pública

- Commit de corrección: `fd2c4fd` (`fix: use valid Supabase cleanup command in CI`).
- CI `37869690042`: completado correctamente; calidad y seguridad de base de datos aprobadas.
- GitHub Pages `37869690053`: completado correctamente.
- `https://fontex.sypablitodp.site/`: HTTP 200; JavaScript, chunk de Supabase y CSS responden HTTP 200 con tipos MIME correctos.
- El bundle público todavía no contiene la URL ni la clave publicable de Supabase y muestra el modo demostración, coherente con las variables de repositorio pendientes.

### Siguiente paso

Configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como variables de GitHub y verificar registro, confirmación e inicio de sesión en el dominio. No iniciar el Bloque 2 sin una orden explícita.

---

## v0.2.0 — Identidad, aulas, grupos y seguridad RLS

**Fecha:** 8 de octubre de 2026
**Bloque:** 1 — Identidad, aulas y grupos
**Estado:** Implementado y verificado local/remotamente; activación en GitHub Pages pendiente de variables públicas

### Objetivo

Implementar exclusivamente el Bloque 1 del plan maestro: Supabase Auth, perfiles, organizaciones, aulas, matrícula por invitación, roles, grupos y políticas RLS probadas con identidades diferentes.

### Base de datos y seguridad

- Se crearon dos migraciones aditivas: la primera incorpora `profiles`, `organizations`, `classrooms`, `class_members`, `classroom_invitations`, `study_groups` y `group_members`; la segunda endurece permisos y añade índices para claves foráneas.
- Todas las tablas expuestas tienen RLS y privilegios SQL explícitos; `anon` no puede operar sobre ellas.
- Un trigger crea el perfil mínimo al registrar un usuario en Supabase Auth.
- El propietario de un aula se registra automáticamente como docente.
- Las invitaciones se vinculan a correo, aula, rol y vencimiento; el token se muestra una sola vez y en PostgreSQL solo se conserva SHA-256.
- Un correo diferente no puede consumir la invitación.
- Los estudiantes no tienen privilegio SQL para editar matrículas y no pueden autoasignarse el rol docente.
- La creación inicial de organización y aula se realiza mediante una RPC atómica; después del primer espacio, solo un docente activo puede crear otro.
- Solo el propietario puede cambiar roles; ningún docente puede retirar al propietario.
- Los grupos solo admiten integrantes activos del aula y únicamente docentes pueden crear grupos o modificar asignaciones.
- Retirar una matrícula elimina las asignaciones grupales y revoca inmediatamente el acceso al aula.
- Las ayudas internas `SECURITY DEFINER` viven en `private`. Las RPC públicas necesarias están limitadas a `authenticated`, fijan `search_path = ''` y verifican identidad y permisos dentro de cada operación.

### Frontend

- Se integró `@supabase/supabase-js` con URL y clave publicable; no se admite `service_role` en variables `VITE_*`.
- La configuración del navegador rechaza claves nuevas `sb_secret_*`, exige HTTPS fuera de `localhost`/`127.0.0.1` y conserva compatibilidad con Supabase local.
- Se añadió registro, confirmación, inicio/cierre de sesión y edición del nombre visible.
- Se implementaron creación de organización/aula, aceptación y generación de invitaciones, listado de matrícula y gestión controlada de roles.
- Se implementaron creación de grupos, asignación y remoción de integrantes.
- El shell muestra identidad, rol y aula reales cuando existe sesión.
- Sin variables públicas, Fontex permanece en modo demostración claramente identificado y no simula escrituras.
- Biblioteca, Storage, documentos y tutor real permanecen fuera de alcance.

### Cambios remotos realizados

- Proyecto: `fintex.back` (`goegjuglstapjwcckawp`).
- Se aplicó `20261009003000_block1_identity_classrooms_groups.sql` mediante Supabase CLI.
- Se aplicó `20261009011231_harden_block1_permissions_and_indexes.sql` para cerrar la creación directa de espacios, completar índices de claves foráneas y retirar la ejecución API del trigger alojado `rls_auto_enable`.
- `site_url` de Auth quedó en `https://fontex.sypablitodp.site`.
- Se autorizaron retornos a `https://fontex.sypablitodp.site/**` y `http://localhost:5173/**`.
- Se conservaron los ajustes remotos más estrictos de confirmación de correo, OTP de 8 dígitos y MFA TOTP.
- No se modificaron Storage, pooler, Apple OAuth, SMS ni secretos.

### Validaciones reales

| Validación | Resultado |
|---|---|
| `npx supabase db reset --local` | Las dos migraciones reconstruyen la base correctamente |
| `npx supabase db push --linked --dry-run --skip-vault` | Solo la migración de endurecimiento pendiente fue detectada |
| `npx supabase db push --linked --skip-vault` | Segunda migración aplicada correctamente |
| `npx supabase migration list --linked` | Las dos versiones coinciden local y remotamente |
| `npx supabase db lint --local` | Sin errores |
| `npx supabase db lint --linked` | Sin errores |
| `npx supabase db advisors --local` | Sin observaciones |
| `npx supabase db advisors --linked` | Seis avisos revisados y esperados para RPC públicas `SECURITY DEFINER` con validación interna |
| `npx supabase test db --local` | 34 pruebas pgTAP aprobadas |
| Integración contra Supabase remoto | Aprobada con docente, estudiante y usuario ajeno |
| Limpieza posterior | Consulta real: las siete tablas remotas quedaron con 0 filas |
| `npm ci` | Correcto; 0 vulnerabilidades reportadas |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test -- --run` | 4 archivos y 19 pruebas aprobadas; 1 archivo remoto omitido sin credenciales |
| `npm run build` | Correcto; SDK de Supabase separado en un chunk de 223 kB |

La integración remota creó usuarios y registros con identificadores únicos, verificó invitación, aislamiento, bloqueo de autoascenso, asignación/remoción grupal y revocación de matrícula, y eliminó los datos al finalizar. Las claves necesarias existieron únicamente como variables temporales del proceso.

### CI y despliegue

- CI incorpora un job separado que inicia PostgreSQL de Supabase, aplica migraciones y ejecuta pgTAP.
- Pages acepta `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` como variables de repositorio.
- GitHub CLI no tiene una sesión autenticada en este entorno; por eso esas dos variables aún no se configuraron remotamente.
- Hasta configurarlas, el sitio público seguirá mostrando el modo demostración aunque el backend del Bloque 1 ya esté desplegado.

### Archivos principales

- `supabase/migrations/20261009003000_block1_identity_classrooms_groups.sql`
- `supabase/migrations/20261009011231_harden_block1_permissions_and_indexes.sql`
- `supabase/tests/database/block1_rls.test.sql`
- `src/features/auth/`
- `src/features/workspace/WorkspaceProvider.tsx`
- `src/features/classrooms/ClassroomPage.tsx`
- `src/features/groups/GroupPage.tsx`
- `src/lib/supabase/`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy-pages.yml`

### Commit principal

- Commit: `3ccd2f4`.
- Mensaje: `feat: implement Fontex block 1 identity and RLS`.
- Alcance: frontend autenticado, modelo de aulas y grupos, dos migraciones, RLS, pruebas locales/remotas, CI y preparación de Pages.

### Siguiente paso permitido

Publicar los commits, configurar las dos variables públicas de Pages y verificar el flujo Auth en el dominio. El Bloque 2 no debe iniciarse hasta cerrar esas tareas y recibir una orden explícita.

---

## v0.1.5 — Vinculación segura con Supabase

**Fecha:** 8 de octubre de 2026
**Estado:** Completado y verificado

### Acción solicitada

Conectar el entorno local de Fontex con el proyecto remoto de Supabase indicado por el usuario.

### Cambios realizados

- Se instaló Supabase CLI `2.120.0` como dependencia de desarrollo del repositorio.
- Se inicializó la configuración local en `supabase/config.toml`.
- Se vinculó el repositorio con el Project Ref `goegjuglstapjwcckawp`.
- La información temporal de la sesión y del enlace permanece excluida mediante `supabase/.gitignore`.
- No se añadieron tokens, contraseñas, claves de API ni otros secretos al repositorio.

### Proyecto remoto verificado

- Nombre: `fintex.back`.
- Región: `us-east-1`.
- Estado observado: `ACTIVE_HEALTHY`.
- El comando `npx supabase projects list` confirmó que el proyecto aparece como enlazado.

### Archivos afectados

- `package.json`
- `package-lock.json`
- `supabase/.gitignore`
- `supabase/config.toml`
- `docs/REPORTES.md`

### Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `npx supabase --version` | `2.120.0` |
| `npx supabase projects list` | Proyecto correcto marcado como enlazado |
| `git diff --check` | Correcto |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test -- --run` | 2 archivos y 12 pruebas aprobadas |
| `npm run build` | Correcto |

### Commit principal

- Commit: `15323f6`.
- Mensaje: `chore: link Fontex Supabase project`.
- Alcance: instalación del CLI, configuración local segura, vinculación verificada y reporte inicial.

### Límites respetados

- No se consultaron ni modificaron tablas, registros, usuarios, Storage o funciones.
- No se aplicaron migraciones ni cambios de esquema.
- No se inició el Bloque 1.
- La autenticación del CLI permanece en el almacén local de credenciales y no forma parte del commit.

### Siguiente paso permitido

Revisar el estado remoto de solo lectura o iniciar el Bloque 1 únicamente mediante una orden explícita.

---

## v0.1.4 — Estabilización y verificación del despliegue

**Fecha:** 8 de octubre de 2026
**Estado:** Completado y verificado públicamente

### Objetivo

Cerrar técnicamente el Bloque 0 corrigiendo la ruta base del dominio personalizado, estabilizando la navegación accesible, ampliando pruebas y verificando el sitio público más allá del resultado del workflow.

### Problemas identificados

- El build publicado en `fontex.sypablitodp.site` utilizaba `/fontex-web/` como base por detectar GitHub Actions.
- El documento HTML público respondía `200`, pero sus archivos JavaScript y CSS en `/fontex-web/assets/` respondían `404`; por tanto, la aplicación pública no era funcional.
- El enlace «Saltar al contenido» apuntaba a `#contenido-principal` y podía reemplazar la ruta administrada por `HashRouter`.
- El panel móvil cerrado permanecía en el DOM sin `inert`, permitiendo alcanzar controles ocultos mediante tabulación.
- La prueba existente solo comprobaba la portada y no ejercitaba rutas, menú, tutor ni configuración de assets.

### Cambios realizados

- `VITE_BASE_PATH` controla explícitamente la base de compilación.
- La base predeterminada es `/` para el dominio personalizado.
- El valor `/fontex-web/` sigue disponible para el dominio estándar de GitHub Pages.
- El workflow de Pages toma `vars.VITE_BASE_PATH` y utiliza `/` cuando la variable no está definida.
- El salto accesible cancela la navegación del enlace y enfoca el elemento `main`, que ahora acepta foco programático.
- El menú móvil declara `aria-expanded`, `aria-controls`, `aria-hidden` e `inert`, gestiona foco y permite cierre con `Escape`.
- `Button` reenvía referencias para la gestión de foco.
- Se añadieron pruebas pequeñas para las rutas, `HashRouter`, salto al contenido, menú móvil, tutor simulado, datos ficticios y normalización de la base.
- Se documentaron ambas modalidades de publicación en el README y la arquitectura.

### Archivos modificados

- `.github/workflows/deploy-pages.yml`
- `README.md`
- `docs/REPORTES.md`
- `docs/architecture/overview.md`
- `src/app/App.test.tsx`
- `src/app/layouts/AppShell.tsx`
- `src/components/ui/button.tsx`
- `src/lib/base-path.ts`
- `src/lib/base-path.test.ts`
- `src/test/setup.ts`
- `vite.config.ts`

### Resultados locales verificados

| Validación | Resultado |
|---|---|
| `npm ci` | Correcto; 0 vulnerabilidades reportadas |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test` | 2 archivos y 12 pruebas aprobadas |
| `VITE_BASE_PATH=/ npm run build` | Correcto; assets generados en `/assets/` |
| `VITE_BASE_PATH=/fontex-web/ npm run build` | Correcto; assets generados en `/fontex-web/assets/` |
| `npm run dev` | HTTP 200 en el servidor local |
| Chrome headless local | Tutor renderizado visualmente con identificación «Simulación local» |

### Estado del despliegue público antes de la corrección

- DNS: `fontex.sypablitodp.site` resuelve mediante CNAME a `dppablito4-oss.github.io` y a las direcciones de GitHub Pages.
- HTTPS: certificado válido para `fontex.sypablitodp.site`, emitido por Let's Encrypt y observado con vigencia hasta el 6 de enero de 2027.
- Documento raíz: HTTP 200.
- JavaScript y CSS referenciados: HTTP 404 por la base `/fontex-web/` incorrecta.
- Rutas con hash: el documento HTML respondía, pero la aplicación no podía iniciar al faltar sus assets.

### Nota histórica sobre v0.1.3

El bloqueo registrado en `v0.1.3` fue superado posteriormente: para el commit `a303332`, CI (`37856269768`) y Deploy to GitHub Pages (`37856269736`) terminaron satisfactoriamente. La verificación de esta intervención demostró, sin embargo, que ese despliegue exitoso todavía contenía rutas de assets incorrectas para el dominio personalizado.

### Commit correspondiente

- Implementación: `dccbfd9e23b29115dee5cbd12009a021261264ae`
- Mensaje: `fix: stabilize Fontex GitHub Pages deployment`
- CI: ejecución `37857789505`, completada correctamente.
- GitHub Pages: ejecución `37857789570`, completada correctamente.

### Estado del despliegue público después de la corrección

- Dirección verificada: `https://fontex.sypablitodp.site/`.
- El documento HTML responde HTTP 200 y referencia assets desde `/assets/`.
- JavaScript responde HTTP 200 con `application/javascript`.
- CSS responde HTTP 200 con `text/css`.
- Chrome renderizó Inicio, Aula, Grupo, Biblioteca, Tutor y Administración con sus encabezados esperados.
- No se observaron errores de consola `SEVERE`, `Uncaught`, `ReferenceError` o `TypeError` durante esas seis cargas.
- El tutor público conserva la etiqueta «Simulación local» y el mensaje que indica que no envía información a servicios externos.
- Las recargas conservan el documento estático porque las rutas de la aplicación permanecen después de `#`.

### Limitaciones pendientes

- La API pública de configuración de Pages responde `404` sin autenticación; la verificación se realizó mediante DNS, certificado TLS, contenido servido, navegador real y ejecuciones públicas de Actions.
- No se ejecutó una auditoría E2E completa con tecnologías de asistencia; esa actividad continúa reservada para el Bloque 5.

### Siguiente paso permitido

El Bloque 0 puede cerrarse. El Bloque 1 solo podrá iniciarse mediante una orden explícita posterior.

---

## v0.1.3 — Preparación de publicación en GitHub Pages

**Fecha:** 8 de octubre de 2026
**Estado:** Bloqueado por activación administrativa de GitHub Pages

### Acción solicitada

Actualizar el commit y publicar Fontex mediante GitHub Pages.

### Diagnóstico remoto

- `origin/main` ya contiene el commit `4f20d7a` del Bloque 0.
- El workflow `CI` terminó correctamente para ese commit.
- El workflow `Deploy to GitHub Pages` compiló, validó tipos, ejecutó pruebas y generó el build correctamente.
- La ejecución falló en `actions/configure-pages@v5` antes de subir el artefacto.
- La API pública de Pages devuelve `404`, lo que confirma que el sitio todavía no está habilitado en la configuración del repositorio.
- La CLI de GitHub instalada en el entorno no posee una sesión autenticada para realizar la activación administrativa.

### Ejecución revisada

- Workflow: `Deploy to GitHub Pages`
- Run: `37855100916`
- Resultado del job `build`: fallo únicamente en `Configure GitHub Pages`.
- Job `deploy`: omitido como consecuencia del fallo anterior.

### Acción manual requerida

En GitHub, abrir `Settings → Pages` y seleccionar **GitHub Actions** como fuente en **Build and deployment**. Esta activación requiere permisos de administración o mantenimiento del repositorio.

### Continuación prevista

Una vez habilitado Pages:

1. Actualizar esta entrada a estado completado.
2. Crear el commit de actualización.
3. Subir `main` para disparar nuevamente el workflow.
4. Esperar su finalización y comprobar la URL pública.

---

## v0.1.2 — Consolidación del Bloque 0 en Git

**Fecha:** 8 de octubre de 2026
**Estado:** Completado

### Acción solicitada

Registrar en Git todos los cambios de la fundación técnica, la identidad Fontex y el sistema de reportes.

### Cambios consolidados

- Aplicación Vite, React y TypeScript del Bloque 0.
- Sistema visual responsive y páginas demostrativas.
- Prototipo local del tutor con `assistant-ui`.
- Configuración de CI y despliegue a GitHub Pages.
- Estructura reservada para Supabase.
- Plan maestro renombrado y actualizado con la identidad Fontex.
- Documentación técnica y reportes versionados.

### Verificaciones previas al commit

- El repositorio no incluye `node_modules/` ni `dist/`.
- `git diff --check` no detectó errores de espacios o conflictos.
- Las validaciones funcionales del Bloque 0 permanecen registradas en `v0.1.0`.

### Commit

- Mensaje previsto: `feat: establish Fontex block 0 foundation`

---

## v0.1.1 — Registro versionado de intervenciones

**Fecha:** 8 de octubre de 2026
**Estado:** Completado

### Acción solicitada

Crear un archivo Markdown persistente donde se reporte y versione cada acción realizada sobre Fontex.

### Cambios realizados

- Se creó `docs/REPORTES.md` como bitácora acumulativa del desarrollo.
- Se definió una convención de versiones mayores, menores y de parche.
- Se registró retrospectivamente la implementación del Bloque 0 en la versión `v0.1.0`.
- Se añadió acceso al reporte desde el `README.md`.

### Archivos afectados

- `docs/REPORTES.md`
- `README.md`

### Validación

- Se comprobó que el reporte diferencia resultados verificados, limitaciones y trabajo pendiente.
- No se modificó código funcional de la aplicación.

### Pendientes

- Continuar agregando una nueva entrada a este archivo después de cada intervención futura.

---

## v0.1.0 — Fundación técnica e identidad Fontex

**Fecha:** 8 de octubre de 2026
**Bloque:** 0 — Fundación técnica
**Estado:** Implementación local completada; despliegue público pendiente

### Acción solicitada

Leer el plan maestro, ejecutar exclusivamente su primera orden concreta y sustituir la identidad AulaIA por Fontex.

### Resultado

- Se renombró el plan maestro como `Fontex_Plan_Maestro_Arquitectura_v1.md`.
- Se incorporó el significado de **FONT**es + **TEX**tus: *fuentes puestas en contexto*.
- Se creó una aplicación Vite, React y TypeScript con configuración estricta.
- Se implementó una interfaz responsive con páginas de inicio, aula, grupo, biblioteca, tutor y administración.
- Se adoptaron Tailwind CSS y componentes locales basados en las convenciones de shadcn/ui.
- Se configuró `HashRouter` para navegación compatible con hosting estático.
- Se evaluó `assistant-ui` mediante `LocalRuntime` y un adaptador completamente simulado.
- Se creó la estructura reservada para Supabase sin añadir esquemas, políticas o funciones prematuras.
- Se añadieron workflows de CI y despliegue a GitHub Pages.
- Se documentaron arquitectura, dependencias, límites y ejecución local.
- Se separó el tutor en una carga diferida para reducir el paquete inicial.

### Archivos y áreas principales

- `src/app/`: rutas y shell de la aplicación.
- `src/features/`: páginas organizadas por funcionalidad.
- `src/components/`: identidad y componentes compartidos.
- `src/styles/globals.css`: sistema visual responsive.
- `supabase/`: estructura vacía para etapas posteriores.
- `.github/workflows/`: CI y despliegue.
- `docs/architecture/overview.md`: decisiones arquitectónicas.
- `docs/decisions/DEPENDENCIES.md`: dependencias y licencias declaradas.
- `README.md`: instrucciones y alcance.

### Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `npm ci` | Correcto |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test` | 1 prueba aprobada |
| `npm run build` | Correcto |
| Auditoría de npm | 0 vulnerabilidades reportadas |

El build generó un paquete inicial aproximado de 324 kB y un paquete diferido del tutor aproximado de 424 kB, antes de compresión.

### Límites respetados

- No se conectó una API de IA real.
- No se añadieron claves privadas al cliente.
- No se implementó autenticación ni base de datos.
- No se crearon tablas, políticas RLS o buckets de Storage.
- Todos los datos visibles son ficticios y están identificados como demostración.
- No se inició el Bloque 1.

### Riesgos y pendientes

- El despliegue público debe verificarse después de integrar los cambios en `main` y habilitar GitHub Pages.
- Las fuentes tipográficas todavía se solicitan a Google Fonts; la decisión de autoalojarlas está documentada.
- Las pruebas E2E, auditorías de accesibilidad y seguridad corresponden a bloques posteriores.
- El tutor real requerirá una Supabase Edge Function autenticada y recuperación documental autorizada.

### Siguiente paso permitido

Publicar y comprobar el Bloque 0 o, bajo una orden explícita, comenzar el Bloque 1 de identidad, aulas, grupos y RLS.
