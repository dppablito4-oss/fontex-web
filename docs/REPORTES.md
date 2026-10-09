# Reportes de desarrollo de Fontex

Este archivo es el registro versionado de las intervenciones realizadas en el proyecto. Cada nueva acción de desarrollo debe añadir una versión al inicio del historial, sin borrar reportes anteriores.

## Convención de versiones

- **Mayor (`X.0.0`)**: cambio de arquitectura o etapa principal incompatible.
- **Menor (`0.X.0`)**: bloque funcional o capacidad nueva.
- **Parche (`0.0.X`)**: corrección, ajuste visual, documentación o mantenimiento.

Cada reporte incluye alcance, cambios, archivos relevantes, validaciones reales, limitaciones y siguiente paso permitido.

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
