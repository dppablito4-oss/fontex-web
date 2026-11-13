# Fontex

**Acompañamiento académico con evidencia documental.**

Fontex combina un editor de materiales matemáticos, **Fontex Studio**, con un aula de práctica y una plataforma de consulta de PDF con tutor documental. Su principio es *fuentes puestas en contexto*.

El aula de práctica incluye **19 guías introductorias, 38 páginas y 54 ejercicios**, con filtros para inicial (3–5 años), cada grado de primaria y secundaria e ingreso universitario. No cubre el currículo completo de cada grado. Los PDF, lecturas y ejercicios comparten una fuente de contenido. Consulta el [catálogo y su publicación coordinada](docs/architecture/practice-catalog.md).

Estado revisado el **11 de noviembre de 2026**: Fontex Agent se integró en `main` desde `feat/fontex-agent` tras verificar sus tres fases. El `main` anterior (`1d627cc`) se conserva en `backup/main-before-fontex-agent-20261111`. El frontend se publica mediante el workflow de Pages al subir `main`; el endpoint nuevo de IA requiere despliegue separado. La versión declarada en `package.json` sigue siendo `0.6.0`. Se conservan las correcciones de la [auditoría](docs/AUDITORIA.md) y todas las experiencias existentes.

## Qué incluye

| Área | Capacidades actuales | Dónde se guardan los datos |
|---|---|---|
| Studio | 19 módulos con edición directa en el lienzo; catálogo por temas, historial, presentación y PDF | `localStorage`, separado por usuario o invitado |
| Fontex Agent | Acciones estructuradas con vista previa y deshacer atómico; aprender/resolver con IA opcional y práctica local con pistas graduadas | Materiales locales; contexto enviado al backend solo al consultar IA |
| Materiales de Studio | Crear desde plantillas, abrir, duplicar objetos, importar y exportar `.fontex.json` | En este navegador; exportación manual entre equipos |
| Aula de práctica | 19 guías por nivel y grado; teoría, ejercicios, PDF y consultas | Progreso en `localStorage`; PDF añadidos en IndexedDB |
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

Abre `http://localhost:5173/#/` para la presentación, o `http://localhost:5173/#/lienzo` para el editor. Studio funciona sin configurar Supabase ni OpenAI. El laboratorio y el aula de práctica también tienen funciones locales; las cuentas, la biblioteca remota y el tutor documental requieren backend.

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

### Fontex Agent en Studio

Abre **Fontex Agent** en el panel derecho. Aprender y Resolver requieren sesión y la Edge Function `studio-agent` configurada con `OPENAI_API_KEY` en el servidor. No usan el plugin local de Vite ni una clave del navegador. El modelo se puede configurar con `FONTEX_AGENT_MODEL`; debe admitir Responses y Structured Outputs. Se reutiliza la cuota existente del tutor de práctica.

Selecciona un objeto y elige Practicar para recibir pregunta, estrategia y comprobación progresivas. Esa ruta usa MathEngine, funciona sin sesión ni red y no consume IA. Para los demás modos, revisa los valores propuestos antes de aplicar: el lote completo se deshace en un paso. Si el material cambió, debes preparar otra propuesta. Las acciones locales y la lectura del contexto permanecen disponibles sin backend.

Los niveles Inicial, Primaria, Secundaria y Universidad introductoria ajustan el acompañamiento, sin representar currículos completos. Las explicaciones libres de IA pueden equivocarse; la comprobación del motor solo cubre los objetos y operaciones admitidos. Studio conserva documentos anteriores y guardado local. Una sesión cargada permite editar sin red; no se añadió caché/PWA para garantizar reapertura desde cero sin internet. Contratos, límites, fases y resultados en [Fontex Agent](docs/architecture/fontex-agent.md).

## Rutas

Las rutas se escriben después de `#` para admitir recargas en GitHub Pages.

| Ruta | Vista | Acceso |
|---|---|---|
| `/#/` | Presentación pública con ejemplo interactivo | Público |
| `/#/lienzo` | Fontex Studio | Invitado o cuenta |
| `/#/fracciones` | Laboratorio original de fracciones | Público |
| `/#/demo` (opcional `?nivel=inicial`, `primaria`, `secundaria` o `universidad`) | Aula de práctica de Matemática | Funciones locales públicas; IA remota con sesión |
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
- Vitest: **214 pruebas aprobadas y 7 omitidas**, en 35 archivos aprobados y 4 omitidos. Las omitidas requieren configuración de integración remota.
- Deno: siete Edge Functions comprobadas; **20 pruebas** de handlers (13 existentes y 7 del agente) aprobadas; lint de `supabase/functions` correcto.
- PostgreSQL local: **138 pruebas aprobadas**, incluidas cuotas reutilizadas; diez migraciones alineadas con los archivos del repositorio. Agent no añade migraciones ni permisos.
- No se añadieron dependencias npm. La auditoría previa registró 0 vulnerabilidades.

El [informe de auditoría](docs/AUDITORIA.md) y el [registro de Agent](docs/architecture/fontex-agent.md) detallan evidencias y límites. No se probó una llamada real al proveedor ni el nuevo endpoint desplegado. Revisión visual, accesibilidad manual y E2E siguen pendientes; estas pruebas no certifican producción.

## Despliegue en GitHub Pages

El workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) valida y publica `dist/` cuando cambia `main`, o mediante ejecución manual. Configura Pages para usar GitHub Actions.

Variables del repositorio utilizadas al compilar:

| Variable | Uso |
|---|---|
| `VITE_BASE_PATH` | `/` para el dominio personalizado; `/fontex-web/` para el dominio estándar del repositorio |
| `VITE_SUPABASE_URL` | URL pública del backend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave pública del cliente |

El workflow actual usa valores públicos del proyecto piloto como respaldo si faltan las variables de Supabase. No debe asumirse que omitirlas desconecta el backend publicado. Pages despliega el frontend; las migraciones y Edge Functions tienen su propio proceso.

Para publicar las correcciones del tutor, aplica primero la migración `20261113000212_harden_tutor_exchange_persistence.sql` y después despliega `tutor-chat`. La [guía de Supabase](supabase/README.md) describe la revisión previa. El guardado de preguntas, respuestas y citas ahora depende de una RPC transaccional del servidor.

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

Studio usa un lienzo de 1600 de ancho que crece verticalmente desde 1100, hasta 80 objetos y 40 cambios de historial. Importa documentos versión 1 de hasta 1 MiB. Exporta el material completo a PDF. No incluye sincronización remota de materiales, edición colaborativa ni varias páginas de lienzo.

La biblioteca remota acepta PDF de hasta 5 MiB y 100 páginas con texto seleccionable; no implementa OCR. El tutor estricto exige una salida estructurada y citas de los fragmentos enviados al modelo; si faltan o son inválidas, se abstiene. Esa validación no certifica por sí sola la exactitud de cada afirmación. Los tutores comparten un renderizador de Markdown y fórmulas compatibles con KaTeX, incluidas fracciones, raíces y exponentes. No ejecuta HTML de los mensajes ni comandos confiables de KaTeX.

Studio, Fracciones, Práctica y las vistas académicas comparten los temas claro y oscuro. El selector de luna/sol conserva la elección al navegar; sin elección manual se usa la preferencia del sistema. Los dibujos matemáticos también adaptan sus colores. El guardado local sigue usando una instantánea atómica por cuenta, sin sincronización entre equipos. La presentación, el editor y las guías se verifican también en Chromium con tamaños de móvil, tableta y escritorio. La navegación común distingue Lienzo, Aprender y Mi espacio; el asistente del editor se abre a petición.

### Catálogo ampliado de Studio

Studio incluye porcentajes/proporciones, MCD/MCM, ángulos, círculos, estadística visual, probabilidad, álgebra con piezas, potencias/raíces y conversiones de unidades. Se pueden buscar en la biblioteca de objetos y crear mediante el agente. El panel incorpora «Más sencillo», «Otro ejemplo», «Practicar esto» y «Explicar paso». Ver [cobertura, ejemplos y límites](docs/architecture/learning-catalog.md).
