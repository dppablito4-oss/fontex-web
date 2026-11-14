# Fontex

**Exploración matemática y acompañamiento académico con fuentes documentales.**

El lienzo libre es el editor principal en `/#/lienzo`, con módulos editables, movimiento y tamaño de objetos, presentación y la IA en un panel lateral. El laboratorio de expresiones permanece en `/#/laboratorio`: una misma expresión alimenta la evaluación, la derivada simbólica, las tangentes y las raíces reales de polinomios hasta grado cuatro.

La IA lateral y la paleta del lienzo libre también pueden crear **gráficas reales de funciones**: seno, coseno, tangente, polinomios y las demás expresiones admitidas. La categoría **Funciones** permite editar la expresión, grados/radianes, ventana, parámetros y puntos; sus alturas y derivadas se calculan con el motor. Por ejemplo: «Grafica el seno en grados, de 0 a 360, con puntos en 0, 90, 180, 270 y 360». Consulta [funciones en el lienzo](docs/studio-function-graphs.md).

Los polinomios muestran un recuadro de coeficientes A, B, C… ampliable hasta grado 8, con cambio entre función y ecuación igualada a cero. Las raíces reales se calculan hasta grado 4 en escalas admitidas. El lienzo ajusta la altura al contenido al crecer y al reducirse, conserva los tamaños manuales y muestra potencias con superíndices. Se mantienen tipos de objetos registrados; la IA configura esos tipos y sus expresiones, no genera componentes ejecutables nuevos.

En PC, cada idea se distribuye en horizontal: las funciones dedican dos tercios a la gráfica y el tercio derecho a datos, tabla y explicación. El recorrido y la vista ampliada usan un marco 16:9 centrado; en teléfonos mantienen una lectura vertical. Se revisaron los 21 tipos de módulo en Aprender y Resolver. Consulta [presentación y distribución adaptable](docs/studio-responsive-presentation.md).

El aula de práctica mantiene 19 guías introductorias, 38 páginas y 54 ejercicios. La biblioteca académica permite consultar PDF privados con un tutor documental y citas por página. Estas experiencias tienen almacenes y endpoints distintos.

## Estado del 13 de noviembre de 2026

Se corrigieron los conflictos de sincronización que podían sobrescribir la versión de otro dispositivo, las raíces dependientes de la escala numérica, los exponentes paramétricos en cero y el límite incompatible de importación/exportación. Los títulos admiten 160 caracteres y cada escena, incluido su JSON exportado, tiene un límite de 1 MiB.

Los materiales anteriores eran de prueba y se retiran sin migrarlos. La eliminación de datos conserva las herramientas del lienzo y su IA lateral. Los materiales nuevos y el chat usan `visual_scenes` con un formato de espacio de lienzo y cachés nuevas `fontex-canvas-*`. `studio_workspaces` sigue vacío y sin acceso del cliente. `/#/lienzo-clasico` abre también el lienzo libre.

La versión del paquete sigue siendo `0.6.0`. La [corrección de auditoría](docs/AUDITORIA-2026-11-13.md) registra las pruebas y el estado real de aplicación del SQL. Publicar el frontend, desplegar funciones y aplicar migraciones son pasos independientes.

## Capacidades y guardado

| Área | Capacidades | Datos |
|---|---|---|
| Lienzo libre | Módulos editables, arrastre, tamaño, historial, presentación, PDF e IA lateral | Caché nueva por cuenta; materiales y chat en `visual_scenes` |
| Laboratorio de expresiones | Parámetros a/b/c, gráficas, derivadas, tablas y raíces reales | Copia local por cuenta; escenas autenticadas en `visual_scenes` |
| Generación de escenas | Descripciones con IA y validación del JSON propuesto | `scene-agent`, con sesión; el motor calcula localmente |
| Escenas portátiles | Abrir y exportar JSON de hasta 1 MiB | Archivo descargado por el usuario |
| Aula de práctica | Guías, teoría, ejercicios, PDF y consultas | Progreso local y PDF añadidos en IndexedDB |
| Identidad y aulas | Registro, recuperación de contraseña, perfiles, invitaciones, roles y grupos | Supabase Auth y PostgreSQL con RLS |
| Biblioteca | PDF privados, visor, compartición, extracción e indexación | Supabase Storage privado y PostgreSQL |
| Tutor documental | Recuperación híbrida, modos estricto/comparativo, historial y citas | Edge Functions y PostgreSQL |
| Tutor de práctica | Chat, estudio con fuentes y búsqueda en dominios permitidos | Endpoint local de Vite o `practice-tutor` autenticado |

Los invitados permanecen en un espacio local independiente. Iniciar sesión no importa automáticamente escenas del invitado ni materiales del editor retirado. Las escenas de una cuenta se sincronizan con su propietario y revisiones; los conflictos conservan una copia local. JSON sigue siendo la copia portátil para invitados y cuentas.

## Ejecutar localmente

Requisitos: Node.js 22 y npm 10.

```powershell
npm ci
npm run dev
```

Abre `http://localhost:5173/#/` para la presentación o `http://localhost:5173/#/lienzo` para el editor. Las expresiones y los cálculos funcionan sin configurar Supabase ni OpenAI.

Para cuentas y servicios remotos:

```powershell
Copy-Item .env.example .env.local
```

Configura URL y clave públicas del mismo proyecto:

```dotenv
VITE_BASE_PATH=/
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

La plantilla contiene la URL del piloto. Si cambias de proyecto, sustituye URL y clave. Si falta una, el cliente queda sin configurar. `VITE_SUPABASE_ANON_KEY` se acepta por compatibilidad. Las credenciales `service_role`, `sb_secret_*` y de base de datos pertenecen al servidor y no deben llevar prefijo `VITE_`.

Supabase Auth debe permitir las URLs de retorno del entorno. El registro puede requerir confirmar el correo. La [guía de Supabase](supabase/README.md) documenta configuración, migraciones, funciones y pruebas SQL.

### IA opcional

La IA lateral del lienzo usa `studio-agent` con sesión; conserva conversación, selección de objetos, modos de aprender/resolver/practicar y aplicación de acciones validadas. El laboratorio usa `scene-agent` para generar escenas de expresiones. Ambos mantienen `OPENAI_API_KEY` en el servidor. El modelo se configura con `FONTEX_AGENT_MODEL`; debe admitir Responses y Structured Outputs. Las explicaciones libres pueden contener errores.

El tutor de práctica local admite `OPENAI_API_KEY` en `.env.local` y habilita `/api/fontex-tutor` desde localhost al reiniciar Vite. Esa clave carece de prefijo `VITE_`. GitHub Pages sirve archivos estáticos, por lo que la versión publicada usa `practice-tutor`. El tutor documental utiliza `tutor-chat` y requiere aulas y documentos indexados.

## Rutas

Las rutas van después de `#` para admitir recargas en GitHub Pages.

| Ruta | Vista |
|---|---|
| `/#/` | Presentación pública |
| `/#/lienzo`, `/#/lienzo-clasico` | Lienzo libre con IA lateral, invitado o cuenta |
| `/#/laboratorio` | Laboratorio de expresiones, gráficos y derivadas |
| `/#/fracciones` | Laboratorio original de fracciones |
| `/#/demo` | Aula de práctica; acepta `?nivel=inicial`, `primaria`, `secundaria` o `universidad` |
| `/#/ingresar`, `/#/crear-cuenta`, `/#/ingresar-tutor` | Acceso y registro |
| `/#/recuperar-contrasena`, `/#/nueva-contrasena` | Recuperación y cambio de contraseña |
| `/#/inicio`, `/#/aula`, `/#/grupo` | Espacio académico |
| `/#/biblioteca`, `/#/tutor`, `/#/administracion` | Biblioteca, tutor y ajustes |

Las operaciones remotas requieren sesión y permisos del backend. Sin configuración, las vistas académicas conservan componentes de demostración.

## Validación

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm audit
```

El [informe del 13 de noviembre](docs/AUDITORIA-2026-11-13.md) distingue la suite existente, las nuevas regresiones, las pruebas omitidas y la verificación remota. Las pruebas de los handlers usan proveedores simulados; no acreditan una llamada real a IA.

## Publicación

El workflow [deploy-pages.yml](.github/workflows/deploy-pages.yml) valida y publica `dist/` al subir `main`, o al ejecutarlo manualmente. Pages debe usar GitHub Actions.

Variables de compilación: `VITE_BASE_PATH`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. Usa `/` para el dominio personalizado o `/fontex-web/` para el dominio estándar del repositorio. El workflow incluye valores públicos del piloto como respaldo; omitir las variables de Supabase no desconecta el backend publicado.

Aplica las migraciones revisadas antes de publicar un frontend que dependa de ellas. Las Edge Functions se despliegan por separado. La versión nueva limpia las cachés antiguas cuando el usuario la abre; una publicación anterior no incorpora esa limpieza.

## Límites y documentación

El lienzo libre conserva hasta 80 objetos y 40 pasos de historial. El espacio SQL nuevo reúne materiales y conversación en un registro privado de hasta 2 MiB, con revisiones y conservación de copias ante conflictos. Usa la misma tabla actual, sin recuperar el almacén de pruebas retirado.

El motor del laboratorio admite números, x/a/b/c, pi/e, aritmética, potencias, multiplicación implícita, una igualdad, sin/cos/tan/ln/exp/sqrt. La trigonometría usa radianes. Las gráficas y raíces son aproximaciones numéricas; los casos de escala extrema pueden rechazarse. No incluye raíces complejas, integrales, funciones multivariables generales ni 3D.

Cada escena admite hasta ocho expresiones y 256 elementos en el formato, con límites adicionales de composición en la interfaz. No hay colaboración simultánea ni reapertura offline garantizada desde cero. Las escenas guardadas por una cuenta tienen una copia local y sincronización al recuperar conexión.

La biblioteca remota acepta PDF de hasta 5 MiB y 100 páginas con texto seleccionable; no incluye OCR. El tutor estricto se abstiene cuando no recibe citas válidas de las fuentes enviadas. Esa validación comprueba procedencia, no la verdad de cada afirmación.

- [Lienzo general](docs/general-canvas-prototype.md)
- [Índice de documentación](docs/README.md)
- [Backend Supabase](supabase/README.md)
- [Auditoría del 13 de noviembre](docs/AUDITORIA-2026-11-13.md)
- [Catálogo de práctica](docs/architecture/practice-catalog.md)
- [Historial de auditoría](docs/AUDITORIA.md)

Los documentos de arquitectura de Studio y Fontex Agent describen las herramientas del lienzo libre. Su persistencia actual es la indicada aquí: cachés nuevas y `visual_scenes`, sin migración automática de datos retirados.
