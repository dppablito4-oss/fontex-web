# Fontex

**Acompañamiento académico con evidencia documental.**

Fontex combina un editor de materiales matemáticos, **Fontex Studio**, con un aula de práctica y una plataforma de consulta de PDF con tutor documental. Su principio es *fuentes puestas en contexto*.

Estado revisado el **11 de noviembre de 2026**, sobre `main` en `3a26911` y las correcciones locales posteriores. La versión declarada en `package.json` es `0.6.0`. Los diez hallazgos de la [auditoría](docs/AUDITORIA.md) están corregidos y verificados localmente; su publicación requiere desplegar los cambios de frontend, funciones y migraciones.

## Qué incluye

| Área | Capacidades actuales | Dónde se guardan los datos |
|---|---|---|
| Studio | Fracciones en barras/círculos, suma y resta guiadas, texto, sucesiones aritméticas, arrastre, inspector, historial y presentación | `localStorage`, separado por usuario o invitado |
| Materiales de Studio | Crear desde plantillas, abrir, duplicar objetos, importar y exportar `.fontex.json` | En este navegador; exportación manual entre equipos |
| Aula de práctica | Fracciones, decimales, proporciones y funciones; teoría, ejercicios y consultas | Progreso en `localStorage`; PDF añadidos en IndexedDB |
| Identidad y aulas | Registro, confirmación de correo, sesión, perfiles, invitaciones, roles y grupos | Supabase Auth y PostgreSQL con RLS |
| Biblioteca | PDF privados, visor, compartición por aula/grupo, extracción e indexación | Supabase Storage privado y PostgreSQL |
| Tutor documental | Recuperación híbrida, modo estricto/comparativo, tutoría guiada, conversaciones y citas con página | Edge Functions y PostgreSQL |
| Tutor de práctica | Chat, estudio con fragmentos y búsqueda en dominios educativos permitidos | Endpoint local de Vite o Edge Function `practice-tutor` |

**Iniciar sesión no sube los materiales de Studio a Supabase.** El invitado y cada cuenta tienen espacios locales distintos; no hay migración automática entre ellos. Exporta un JSON antes de cambiar de equipo, de perfil del navegador o de borrar sus datos.

## Ejecutar localmente

Requisitos: **Node.js 22 y npm 10**, usados por el proyecto y CI.

```powershell
npm ci
npm run dev
```

Abre `http://localhost:5173/#/`. Studio funciona sin configurar Supabase ni OpenAI. El laboratorio y el aula de práctica también tienen funciones locales; las cuentas, la biblioteca remota y el tutor documental requieren backend.

### Configurar cuentas y servicios remotos

```powershell
Copy-Item .env.example .env.local
```

Completa `.env.local` con los valores públicos de tu proyecto:

```dotenv
VITE_BASE_PATH=/
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La plantilla contiene la URL del proyecto piloto. Para usar otro proyecto, cambia **URL y clave**. Si falta cualquiera de las dos, el cliente queda sin configurar. `VITE_SUPABASE_ANON_KEY` se admite como alternativa de compatibilidad.

El alta puede requerir confirmación de correo. Configura en Supabase las URLs de retorno de tu entorno; el código vuelve al origen y ruta base, sin añadir un fragmento que interfiera con el callback de Auth.

Las claves publicables se incluyen en el navegador y requieren permisos SQL y RLS correctos. `service_role`, `sb_secret_*` y credenciales de base de datos deben permanecer en el servidor.

### IA opcional para el aula de práctica local

Puedes añadir `OPENAI_API_KEY` a `.env.local` y reiniciar Vite. El plugin del servidor habilita `/api/fontex-tutor` para peticiones desde localhost. La clave carece de prefijo `VITE_` y no se entrega al cliente. Las consultas consumen la API del proveedor.

Ese endpoint existe al ejecutar el servidor de Vite; GitHub Pages sirve archivos estáticos. Para el aula de práctica publicada se utiliza `practice-tutor` con sesión de usuario. El tutor documental usa otro endpoint, `tutor-chat`, y requiere un aula y documentos indexados.

Consulta la [guía del backend](supabase/README.md) para migraciones, funciones y configuración local completa.

## Rutas

Las rutas se escriben después de `#` para admitir recargas en GitHub Pages.

| Ruta | Vista | Acceso |
|---|---|---|
| `/#/`, `/#/lienzo` | Fontex Studio | Invitado o cuenta |
| `/#/fracciones` | Laboratorio original de fracciones | Público |
| `/#/demo` | Aula de práctica de Matemática | Funciones locales públicas; IA remota con sesión |
| `/#/ingresar`, `/#/crear-cuenta` | Acceso y registro | Requiere Supabase configurado |
| `/#/ingresar-tutor` | Acceso con retorno al aula de práctica | Requiere Supabase configurado |
| `/#/inicio`, `/#/aula`, `/#/grupo` | Espacio académico | Sesión cuando Supabase está configurado |
| `/#/biblioteca`, `/#/tutor`, `/#/administracion` | Biblioteca, tutor documental y ajustes | Sesión y permisos del backend para operaciones reales |

Sin configuración de Supabase, las rutas académicas conservan componentes de demostración. `WorkspaceProvider` coordina el aula activa; los permisos se aplican en PostgreSQL y las funciones. El registro público no concede por sí solo permiso para crear el primer espacio institucional.

## Calidad y auditoría

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
```

Resultado de la revisión del 11 de noviembre de 2026:

- Lint, TypeScript y compilación: correctos.
- Vitest: **141 pruebas aprobadas y 7 omitidas**, en 27 archivos aprobados y 4 omitidos. Las omitidas requieren configuración de integración remota.
- Deno: seis Edge Functions comprobadas, 13 regresiones de backend aprobadas y lint de `supabase/functions` correcto.
- PostgreSQL local: **138 pruebas aprobadas**; migraciones locales actualizadas y advisors/lint sin incidencias.
- `npm audit`: **0 vulnerabilidades** después de actualizar las resoluciones afectadas.

El [informe de auditoría](docs/AUDITORIA.md) detalla las correcciones, evidencias y comprobaciones pendientes. Estos resultados no certifican el despliegue remoto ni equivalen a pruebas E2E.

## Despliegue en GitHub Pages

El workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) valida y publica `dist/` cuando cambia `main`, o mediante ejecución manual. Configura Pages para usar GitHub Actions.

Variables del repositorio utilizadas al compilar:

| Variable | Uso |
|---|---|
| `VITE_BASE_PATH` | `/` para el dominio personalizado; `/fontex-web/` para el dominio estándar del repositorio |
| `VITE_SUPABASE_URL` | URL pública del backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública del cliente |

El workflow actual usa valores públicos del proyecto piloto como respaldo si faltan las variables de Supabase. No debe asumirse que omitirlas desconecta el backend publicado. Pages despliega el frontend; las migraciones y Edge Functions tienen su propio proceso.

Para publicar las correcciones del tutor, aplica primero la migración `20261111223857_harden_tutor_exchange_persistence.sql` y después despliega `tutor-chat`. La [guía de Supabase](supabase/README.md) describe la revisión previa. El guardado de preguntas, respuestas y citas ahora depende de una RPC transaccional del servidor.

Para comprobar una compilación con la base del repositorio desde PowerShell:

```powershell
$env:VITE_BASE_PATH = '/fontex-web/'
npm run build
Remove-Item Env:VITE_BASE_PATH
```

## Estructura y documentación

```text
src/app/                 Rutas y layouts
src/core/                Esquema de materiales, motor matemático y catálogo de objetos
src/features/studio/     Editor y persistencia local
src/features/demo/       Aula de práctica y PDF locales
src/features/            Auth, aulas, grupos, biblioteca, tutor y temas
supabase/migrations/     Esquema y permisos versionados
supabase/functions/      Servicios autenticados y lógica compartida
supabase/tests/          Pruebas pgTAP
docs/                    Guías, decisiones e historial
```

- [Índice de documentación](docs/README.md)
- [Arquitectura actual](docs/architecture/overview.md)
- [Fontex Studio: formato, límites y persistencia](docs/architecture/studio.md)
- [Backend Supabase](supabase/README.md)
- [Sistema de diseño](docs/design/DESIGN_SYSTEM.md)
- [Dependencias](docs/decisions/DEPENDENCIES.md)
- [Auditoría y pendientes](docs/AUDITORIA.md)
- [Reportes históricos](docs/REPORTES.md)

## Límites actuales

Studio usa un lienzo de 1600 × 1100, hasta 80 objetos y 40 cambios de historial. Importa documentos versión 1 de hasta 1 MiB. No incluye sincronización remota de materiales, edición colaborativa, varias páginas ni exportación PDF integrada.

La biblioteca remota acepta PDF de hasta 5 MiB y 100 páginas con texto seleccionable; no implementa OCR. El tutor estricto exige una salida estructurada y citas de los fragmentos enviados al modelo; si faltan o son inválidas, se abstiene. Esa validación no certifica por sí sola la exactitud de cada afirmación. El renderizador académico admite un subconjunto de Markdown y sustituciones matemáticas, incluidos exponentes numéricos completos; no es un motor LaTeX completo.

Studio, Fracciones, Práctica y las vistas académicas comparten los temas claro y oscuro. El selector de luna/sol conserva la elección al navegar; sin elección manual se usa la preferencia del sistema. Los dibujos matemáticos también adaptan sus colores. El guardado local sigue usando una instantánea atómica por cuenta, sin sincronización entre equipos. La revisión visual en navegador, las pruebas E2E y la verificación del despliegue remoto siguen pendientes.
