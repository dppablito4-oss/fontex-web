# Fontex 1.0 · rama de desarrollo

**Un lienzo matemático componible y acompañamiento académico con fuentes documentales.**

El editor principal en `/#/lienzo` combina doce familias de elementos: planos, funciones y regiones, vectores, pictogramas, texto matemático, controles, figuras 2D, cuerpos 3D, gráficos de datos, anotaciones, nodos/circuitos y respuestas del alumno. Las 40 plantillas son escenas editables hechas con esas primitivas. La IA propone JSON validado; el motor calcula localmente y no ejecuta código generado.

**Cuerpo 3D** permite crear y girar cubos, prismas rectangulares, pirámides, esferas, cilindros y conos, con medidas dinámicas, área total y volumen. La vista guardada se exporta a PDF. Consulta [el contrato y los límites de la 1.0](docs/CUERPOS-3D-V100.md). Este trabajo permanece en `feature/v1.0-solid-3d`; el respaldo del main original es `backup/main-v0.9.5-2026-11-20`.

Una variable compartida puede actualizar a la vez una figura, una curva y su explicación. El editor ofrece selección, movimiento, giro por arrastre y tamaño en escritorio, edición contextual, historial, presentación por pasos y PDF. En móvil conserva una lectura vertical legible y un botón flotante de chat. Fontex AI transmite sus respuestas y permite pasar de conversar a construir mediante el botón **Crear en el lienzo**.

Las plantillas distribuyen la gráfica y los controles en columnas, con notas al lado y la explicación debajo. **Organizar lienzo** aplica esta distribución a una escena existente; los elementos siguen siendo movibles y editables. Las propiedades se abren en un panel lateral (inferior en móvil).

Las lecciones pueden alternar una explicación breve y sus pictogramas antes de continuar con el siguiente paso. **Organizar lienzo** mantiene cada bloque junto a sus modelos y coloca la conclusión después del dibujo que la justifica. Móvil y PDF conservan esa misma secuencia; la plantilla **Sumar fracciones** ofrece un ejemplo interactivo.

Las medidas se pueden escribir directamente: confirma con **Enter** o al salir de la casilla; **Escape** cancela la edición. Se aceptan decimales con punto o coma y, si el valor supera el rango del deslizador, el rango se amplía cuando la escena admite la medida. El plano ajusta automáticamente la vista a las figuras y vectores vinculados y cambia los intervalos de la cuadrícula según la escala. Sus botones de zoom, **Ctrl + rueda**, la herramienta de mano y **Ajustar** permiten explorar y volver al encuadre automático. El zoom del lienzo completo es independiente. Las funciones cartesianas conservan su ventana de referencia porque no tienen una extensión finita que se pueda encuadrar completa.

Consulta [el alcance y los límites de las primitivas](docs/primitivas-v0.7.md) y [la consolidación v0.7.1](docs/primitivas-v0.7.1.md) y [las capacidades de v0.8.0](docs/primitivas-v0.8.md). La versión anterior del código está en `respaldo/pre-primitivas-2026-11-14` (`930dcb9`). El editor nuevo comienza con escenas v2 independientes; no importa los documentos v1. La consolidación v0.7.1 retiró las cuatro escenas anteriores de la tabla activa, conservó una copia administrativa privada y validó la restricción de formato.

Cada cuenta tiene **5 créditos iniciales** para generar con IA, sin renovación automática. El chat del lienzo no consume créditos; las plantillas y la edición manual siguen libres. El administrador puede asignar más desde `/#/administracion`. Consulta [la política de uso y administración](docs/politica-uso-ia.md).

La preparación de **beta cerrada** añade invitaciones verificadas en servidor, revocación, límites de uso compartidos por chat/construcción y pausa de IA. Las cuentas ya verificadas del piloto se conservan como cohorte inicial. El acceso local sigue disponible sin cuenta. Consulta [activación, límites y comprobaciones pendientes](docs/beta-cerrada.md); estos cambios requieren aplicar la nueva migración y desplegar las funciones antes de publicar el frontend.

## Capacidades

| Área | Estado |
|---|---|
| Lienzo | Diez familias componibles, 36 plantillas, variables compartidas, historial y presentación |
| Matemática local | Curvas cartesianas/paramétricas/polares, AST acotado, grados/radianes, funciones reales de x, derivadas, tangentes, raíces reales hasta grado 4 e integración numérica aproximada |
| Geometría y datos | Figuras regulares/irregulares simples, unidades, fracciones circulares, conteo, tablas, gráficos y regresión |
| Conjuntos y lógica | Venn de 2/3 conjuntos, tablas de hasta 16 filas, interruptores y circuitos ideales AND/OR/NOT |
| Álgebra lineal | Matrices 2×2/3×3, determinante, inversa y transformación 2D de vectores/polígonos |
| Diagramas físicos | Representaciones esquemáticas de cuerpos; no simulación dinámica ni cálculo 3D |
| Guardado | Escenas privadas v2 y conversación en `visual_scenes`, copia local por cuenta, revisiones y conservación de copias en conflictos |
| Aula de práctica | 19 guías introductorias, 38 páginas y 54 ejercicios; contenido independiente del motor del lienzo |
| Biblioteca académica | PDF privados, extracción/indexación y tutor con citas por página |
| Identidad y aulas | Registro, recuperación de contraseña, perfiles, invitaciones, roles y grupos |

Hasta 80 primitivas, 24 variables, 80 turnos y 1 MiB por escena. Los invitados usan una biblioteca local separada de las cuentas. JSON permite descargar y abrir una copia portátil. No hay colaboración simultánea ni reapertura offline desde cero garantizada.

Las curvas, raíces e integrales son aproximaciones numéricas. La integración distingue signo y área geométrica, estima error y rechaza algunos casos no definidos o sin convergencia; no garantiza detectar todas las discontinuidades. No incluye raíces complejas, integración simbólica ni superficies multivariables. Las nuevas curvas paramétricas/polares se dibujan numéricamente; no amplían todavía el cálculo de áreas ni las derivadas a esos modos. Las explicaciones libres de IA pueden contener errores.

## Desarrollo local

Requisitos: Node.js 22 y npm 10. `.nvmrc` fija la rama 22.

```bash
npm ci
npm run dev
```

Abre `http://localhost:5173/#/lienzo`. Plantillas, elementos y cálculos locales funcionan sin claves ni IA.

Para cuentas y servicios remotos, copia `.env.example` a `.env.local` y configura URL y clave públicas del mismo proyecto:

```dotenv
VITE_BASE_PATH=/
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La plantilla contiene la URL del piloto. Las credenciales de servidor, `service_role`, `sb_secret_*` y base de datos nunca deben llevar prefijo `VITE_`. `VITE_SUPABASE_ANON_KEY` sigue aceptándose por compatibilidad. Auth debe permitir las URLs de retorno del entorno y puede requerir confirmar el correo.

La Edge Function `studio-agent` utiliza `OPENAI_API_KEY` en el servidor. `FONTEX_CHAT_MODEL` configura conversación (Luna) y `FONTEX_AGENT_MODEL` construcción (Terra 6.1); los modelos deben admitir Responses y Structured Outputs. La configuración anterior de Sol 6.1 se redirige a Terra. El chat del editor usa la ruta `studio-agent/primitives`. Las operaciones se validan de nuevo en el navegador antes de aplicarse.

El tutor del aula de práctica local admite `OPENAI_API_KEY` en `.env.local`, sin prefijo `VITE_`, para su endpoint de Vite. En GitHub Pages utiliza `practice-tutor`. El tutor documental usa `tutor-chat` y necesita aulas y documentos indexados. Son flujos independientes del editor.

## Rutas

Las rutas van después de `#` para admitir recargas en GitHub Pages.

| Ruta | Vista |
|---|---|
| `/#/` | Presentación pública |
| `/#/beta` | Ayuda de participantes, datos, límites y contacto para incidencias |
| `/#/lienzo` | Editor de primitivas y chat lateral |
| `/#/lienzo-clasico`, `/#/laboratorio`, `/#/fracciones` | Alias del editor actual |
| `/#/demo` | Aula de práctica; admite `?nivel=inicial`, `primaria`, `secundaria` o `universidad` |
| `/#/ingresar`, `/#/crear-cuenta`, `/#/ingresar-tutor` | Acceso y registro |
| `/#/recuperar-contrasena`, `/#/nueva-contrasena` | Recuperación y cambio de contraseña |
| `/#/inicio`, `/#/aula`, `/#/grupo` | Espacio académico |
| `/#/biblioteca`, `/#/tutor`, `/#/administracion` | Biblioteca, tutor y ajustes |

## Validación y publicación

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Los workflows comprueban frontend, handlers de Edge Functions y SQL/RLS. Los handlers se prueban con proveedor simulado; la verificación del proveedor real se registra por separado. Las siete integraciones remotas de Vitest requieren configuración y se omiten cuando falta. `npm run test:remote` exige esa configuración explícitamente; `npm run test:agent:remote` verifica el agente real con cuatro consultas pagadas y consentimiento por variable de entorno. La batería `npm run test:agent:beta` añade tres generaciones reales para los modos v0.8. El workflow manual y los requisitos se documentan en v0.7.1/v0.8.

El workflow `deploy-pages.yml` publica `dist/` al subir `main` después de validar frontend, SQL y Edge con el workflow reutilizable de CI. Exige `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` explícitos y comprueba el contrato `closed-beta-v3`, la lectura pública por RPC y el contrato `primitive-agent-v3` del agente desplegado; no usa valores del piloto como respaldo. Configura también `VITE_BASE_PATH`: `/` para el dominio personalizado o `/fontex-web/` para el dominio estándar. Antes de publicar, aplica las migraciones y despliega `studio-agent` desde esta misma versión. Esta publicación no despliega SQL ni funciones.

La migración `replace_test_canvas_with_primitives` bloquea nuevas escrituras de formatos retirados y admite escenas v2. Conserva RLS por propietario y compare-and-set. No modifica Auth, la biblioteca PDF ni los datos académicos. Las cachés antiguas del editor se retiran al abrir la nueva aplicación. Publicar frontend, desplegar funciones y aplicar SQL son pasos independientes.

- [Primitivas v0.8](docs/primitivas-v0.8.md)
- [Primitivas v0.7](docs/primitivas-v0.7.md)
- [Propuesta original](docs/plans/v0.7-primitivas-propuesta.md)
- [Decisiones de integración](docs/plans/v0.7-primitivas-integracion.md)
- [Documentación](docs/README.md)
- [Backend Supabase](supabase/README.md)

Las auditorías y documentos del editor v0.6 conservan sus resultados históricos; no describen el contrato activo de primitivas.
