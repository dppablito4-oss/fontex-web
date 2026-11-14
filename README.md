# Fontex 0.7.0

**Un lienzo matemático componible y acompañamiento académico con fuentes documentales.**

El editor principal en `/#/lienzo` combina nueve familias de elementos: planos, funciones y regiones, vectores, pictogramas, texto matemático, controles, figuras, gráficos de datos y anotaciones. Las 22 plantillas son escenas editables hechas con esas primitivas. La IA propone JSON validado; el motor calcula localmente y no ejecuta código generado.

Una variable compartida puede actualizar a la vez una figura, una curva y su explicación. El editor ofrece selección, movimiento y tamaño en escritorio, edición contextual, historial, presentación por pasos y PDF. En móvil conserva una lectura vertical legible y un botón flotante de chat. Fontex AI transmite sus respuestas y permite pasar de conversar a construir mediante el botón **Crear en el lienzo**.

Consulta [el alcance y los límites de las primitivas](docs/primitivas-v0.7.md). La versión anterior del código está en `respaldo/pre-primitivas-2026-11-14` (`930dcb9`). El editor nuevo comienza con escenas v2 independientes; no importa los documentos v1. El borrado físico de los registros anteriores quedó pendiente por la confirmación caducada del conector.

## Capacidades

| Área | Estado |
|---|---|
| Lienzo | Nueve familias componibles, 22 plantillas, variables compartidas, historial y presentación |
| Matemática local | AST acotado, grados/radianes, funciones reales de x, derivadas, tangentes, raíces reales hasta grado 4 e integración numérica aproximada |
| Geometría y datos | Figuras regulares/irregulares simples, unidades, fracciones circulares, conteo, tablas, gráficos y regresión |
| Diagramas físicos | Representaciones esquemáticas de cuerpos; no simulación dinámica ni cálculo 3D |
| Guardado | Escenas privadas v2 y conversación en `visual_scenes`, copia local por cuenta, revisiones y conservación de copias en conflictos |
| Aula de práctica | 19 guías introductorias, 38 páginas y 54 ejercicios; contenido independiente del motor del lienzo |
| Biblioteca académica | PDF privados, extracción/indexación y tutor con citas por página |
| Identidad y aulas | Registro, recuperación de contraseña, perfiles, invitaciones, roles y grupos |

Hasta 80 primitivas, 24 variables, 80 turnos y 1 MiB por escena. Los invitados usan una biblioteca local separada de las cuentas. JSON permite descargar y abrir una copia portátil. No hay colaboración simultánea ni reapertura offline desde cero garantizada.

Las curvas, raíces e integrales son aproximaciones numéricas. La integración distingue signo y área geométrica, estima error y rechaza algunos casos no definidos o sin convergencia; no garantiza detectar todas las discontinuidades. No incluye raíces complejas, integración simbólica, curvas paramétricas generales ni superficies multivariables. Las explicaciones libres de IA pueden contener errores.

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

La Edge Function `studio-agent` utiliza `OPENAI_API_KEY` en el servidor. `FONTEX_CHAT_MODEL` configura conversación y `FONTEX_AGENT_MODEL` construcción; los modelos deben admitir Responses y Structured Outputs. El chat del editor usa la ruta `studio-agent/primitives`. Las operaciones se validan de nuevo en el navegador antes de aplicarse.

El tutor del aula de práctica local admite `OPENAI_API_KEY` en `.env.local`, sin prefijo `VITE_`, para su endpoint de Vite. En GitHub Pages utiliza `practice-tutor`. El tutor documental usa `tutor-chat` y necesita aulas y documentos indexados. Son flujos independientes del editor.

## Rutas

Las rutas van después de `#` para admitir recargas en GitHub Pages.

| Ruta | Vista |
|---|---|
| `/#/` | Presentación pública |
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

Los workflows comprueban frontend, handlers de Edge Functions y SQL/RLS. Los handlers se prueban con proveedor simulado; la verificación del proveedor real se registra por separado. Las siete integraciones remotas de Vitest requieren configuración y se omiten cuando falta.

El workflow `deploy-pages.yml` publica `dist/` al subir `main`. Variables de compilación: `VITE_BASE_PATH`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Usa `/` para el dominio personalizado o `/fontex-web/` para el dominio estándar. El workflow incluye valores públicos del piloto como respaldo.

La migración `replace_test_canvas_with_primitives` bloquea nuevas escrituras de formatos retirados y admite escenas v2. Conserva RLS por propietario y compare-and-set. No modifica Auth, la biblioteca PDF ni los datos académicos. Las cachés antiguas del editor se retiran al abrir la nueva aplicación. Publicar frontend, desplegar funciones y aplicar SQL son pasos independientes.

- [Primitivas v0.7](docs/primitivas-v0.7.md)
- [Propuesta original](docs/plans/v0.7-primitivas-propuesta.md)
- [Decisiones de integración](docs/plans/v0.7-primitivas-integracion.md)
- [Documentación](docs/README.md)
- [Backend Supabase](supabase/README.md)

Las auditorías y documentos del editor v0.6 conservan sus resultados históricos; no describen el contrato activo de primitivas.
