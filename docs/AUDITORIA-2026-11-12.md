# Auditoría del repositorio — 12 de noviembre de 2026

Base revisada: `d37b3a9`. Revisión local de arquitectura, persistencia, flujos asíncronos, autenticación, funciones y workflows. No se modificó código de producto ni se hicieron llamadas pagadas de IA o cambios remotos.

## Evaluación

Fontex tiene una base razonable para seguir desarrollándose: separación del motor matemático y la interfaz, validación de documentos, acciones del agente verificadas y reversibles, carga diferida parcial, pruebas frontend y controles SQL versionados. La siguiente inversión debería ser fiabilidad y validación del producto completo. Añadir más módulos antes de resolver los conflictos de guardado y el cambio de aula aumenta el coste de mantenerlo.

Esta revisión encuentra tres defectos reproducidos y dos riesgos de configuración verificables. No acredita la seguridad del despliegue remoto ni una revisión exhaustiva de todas las políticas SQL.

## Hallazgos priorizados

### 1. Alta: dos pestañas pueden perder cambios del mismo material sin avisar

Evidencia: `src/features/studio/useStudioDocument.ts:72` y `src/features/studio/document-store.ts:83`.

Cada editor conserva su propia copia del documento. Al guardar, se sustituye por completo el documento con ese ID, sin comprobar si otra pestaña ya escribió una revisión más reciente. La escritura atómica protege contra una instantánea parcial, pero no contra sobrescribir cambios ajenos.

Reproducción ejecutada con dos instancias del hook y el mismo almacenamiento: A cambia el título; B elimina un objeto desde su copia anterior; el título de A desaparece del almacenamiento. B informa `saved=true`, sin error. No requiere escrituras simultáneas.

Mejora: versión de revisión y detección de conflictos, junto con coordinación entre pestañas. Como primera medida puede bloquearse la edición concurrente del mismo material y ofrecer recarga o copia. Un evento `storage` por sí solo no resuelve las escrituras concurrentes. Añadir prueba de regresión con dos editores.

### 2. Media: un material v2 dañado bloquea todos los materiales de esa cuenta

Evidencia: `src/features/studio/document-store.ts:30`, `:65`, `:71` y `:89`.

La lectura de la instantánea valida todos los documentos mediante `map(parseDocument)`. Si falla uno, no se puede listar ni abrir otro válido. La eliminación tampoco permite rescatar el almacén v2: el argumento que excluye un ID solo se utiliza en la lectura del formato legado.

Reproducción ejecutada: una instantánea JSON válida con un material sano y otro con un objeto inválido hace fallar listado, apertura del sano y eliminación del dañado. Es un escenario de recuperación; esta revisión no demostró que las operaciones normales generen esa corrupción.

Mejora: conservar una copia del contenido original, validar cada material por separado y ofrecer recuperación/exportación de los válidos y aislamiento del inválido. Mantener protección ante fallos de escritura.

### 3. Media: resultados de un aula anterior pueden reemplazar la biblioteca del aula actual

Evidencia: `src/features/library/hooks/useDocuments.ts:35–61`.

Cambiar `classroomId` programa otra carga, pero no invalida la petición anterior. El cleanup solo cancela el temporizador si todavía no se ejecutó. Una petición en curso conserva permiso para llamar a `setDocuments` y `setLimits`.

Reproducción ejecutada con promesas controladas: se inicia A, se cambia a B, responde B y después A. La biblioteca termina mostrando A aunque la selección actual es B. Esto acredita mezcla de contexto en la interfaz, no evasión de RLS.

Mejora: identificador de generación o cancelación de peticiones y comprobación del contexto antes de actualizar estado. Limpiar también visor y mensajes al cambiar de aula. Revisar el patrón equivalente de `loadDetails` en `src/features/workspace/WorkspaceProvider.ts:115` y `:242`, que tampoco descarta respuestas antiguas; ese segundo flujo se inspeccionó, sin reproducción independiente.

### 4. Media: Pages se publica sin esperar las comprobaciones del backend

Evidencia: `.github/workflows/ci.yml` y `.github/workflows/deploy-pages.yml`.

Son workflows independientes disparados por cambios en `main`. Pages repite los checks frontend y su job de despliegue solo depende de su propio build. Por tanto, un fallo en `database-security` o `edge-functions` no bloquea ese despliegue. No se verificaron las reglas de protección de GitHub; podrían reducir el riesgo antes de integrar cambios.

Mejora: reutilizar el workflow de calidad y hacer que la publicación dependa de todos sus resultados para el mismo commit. Añadir comprobación de `document-upload` y `document-delete`, ausentes de los pasos `deno check` actuales, y una prueba mínima del contrato entre frontend, funciones y esquema desplegados.

### 5. Media: una configuración incompleta conecta Pages al backend piloto

Evidencia: `.github/workflows/deploy-pages.yml:35–36`.

URL y clave pública tienen valores de respaldo del proyecto piloto. Si faltan variables en una copia del repositorio, la web sigue conectándose a ese proyecto; si falta solo una, puede combinar valores de proyectos distintos. La clave publicable no se trata aquí como secreto expuesto.

Mejora: exigir URL y clave como pareja para una publicación con servicios remotos. Si se desea modo local, activarlo explícitamente y mostrar su estado. Eliminar el destino piloto implícito.

## Mejoras de producto y mantenimiento

- **Recuperación de contraseña.** `AuthPage.tsx:9` solo contempla ingreso y registro; no se encontró un flujo `resetPasswordForEmail` ni manejo de `PASSWORD_RECOVERY`. Añadir solicitud de recuperación, retorno desde correo y formulario de nueva contraseña, con mensajes claros ante enlaces vencidos.
- **Respaldo de Studio.** Los materiales siguen ligados al navegador. Priorizar copia portable visible, recuperación al cambiar de cuenta y, si es un requisito del producto, sincronización remota con conflictos resueltos. No confundir iniciar sesión con tener una copia en la nube.
- **Pruebas de usuario.** Añadir E2E para crear/recargar/exportar/importar material, cambiar de aula durante una carga y consultar una cita. Comprobar teclado, foco en diálogos, impresión y móvil en navegador real. jsdom no verifica por sí solo esas experiencias.
- **Rendimiento.** El build advierte un chunk principal de 535,95 kB minificado, 166,49 kB gzip; el chunk Supabase añade 223,40 kB, 58,51 kB gzip. Studio y varias vistas académicas se importan estáticamente en `src/app/App.tsx`; Tutor y Práctica sí usan `lazy`. Separar primero las rutas poco usadas y medir carga inicial en un móvil antes de optimizar más. El worker PDF de 1,26 MB es otro recurso: no debe sumarse automáticamente como descarga inicial de todas las rutas.
- **Recuperación de errores.** No se encontró un Error Boundary de aplicación. Añadir una pantalla que permita recuperarse de errores de renderizado y un registro mínimo de fallos, sin incluir contenido privado ni credenciales.
- **Mantenimiento.** `DemoPage.tsx`, `StudioShell.tsx` y el catálogo matemático concentran bastantes responsabilidades. Extraer componentes y separar módulos por familia cuando se modifiquen esas áreas, manteniendo contratos y pruebas; no se propone una reescritura general.
- **Documentación.** README declara 214 pruebas frontend aprobadas y la suite actual devuelve 293. Actualizar resultados, capacidades de PDF y límites descritos para que correspondan a la versión actual. Preferir resultados de CI enlazados al commit sobre cifras copiadas en varios documentos.

## Verificación ejecutada

- Dependencias instaladas desde el lockfile mediante `npm ci --ignore-scripts`; no se modificaron manifiesto ni lockfile.
- Entorno de esta revisión: Node.js 24.12.0 y npm 11.6.2. CI declara Node.js 22; los resultados locales no sustituyen la ejecución en esa versión.
- `npm run lint`: correcto.
- `npm run typecheck`: correcto.
- `npm run test`: 293 aprobadas y 7 omitidas; 42 archivos aprobados y 4 omitidos.
- `npm run build`: correcto, con advertencia por tamaño del chunk principal.
- Tres pruebas temporales adicionales reprodujeron los hallazgos 1, 2 y 3. Las tres pasaron al comprobar el comportamiento defectuoso actual; no significan que esté corregido. Se retiró el archivo temporal después de la comprobación.
- `npm audit --json`: 0 vulnerabilidades conocidas.

No se ejecutaron Deno ni PostgreSQL/pgTAP: no se encontraron los comandos Deno y Docker en el PATH del entorno. Las pruebas remotas permanecieron omitidas por falta de su configuración. No se verificaron producción, proveedor real, E2E, accesibilidad manual ni tiempos de carga en navegador.

Para contrastar el modelo de permisos se consultaron la documentación oficial de [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y el [changelog de Supabase](https://supabase.com/changelog.md). Las conclusiones concretas anteriores proceden del código y las pruebas locales.

## Orden sugerido

1. Evitar sobrescrituras entre pestañas y añadir recuperación del almacén local.
2. Corregir las cargas obsoletas al cambiar de aula.
3. Vincular publicación a todos los checks y exigir configuración explícita del backend.
4. Incorporar recuperación de contraseña y E2E de los recorridos principales.
5. Medir carga móvil, dividir rutas y después continuar ampliando el catálogo.
