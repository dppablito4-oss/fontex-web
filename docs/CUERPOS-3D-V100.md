# Fontex 1.0: Cuerpo 3D

Desarrollado en `feature/v1.0-solid-3d` e integrado mediante el PR #6. Respaldo del main anterior:
`backup/main-v0.9.5-2026-11-20`, commit
`05c12332d9d03ecd602d64a652fa78c6d9882643`. El repositorio indicaba v0.9.5; el
respaldo conserva exactamente ese estado. La integración en main fue autorizada
el 21 de noviembre de 2026.

## Uso

En **Elementos → Cuerpo 3D** se crea un cuerpo independiente del plano 2D. En
propiedades se elige cubo, prisma rectangular, pirámide recta de base
rectangular, esfera, cilindro o cono. Las medidas admiten expresiones y
variables. El alumno cambia solamente los campos o variables habilitados por el
docente.

Se arrastra con el dedo o el ratón para girar. Las flechas del teclado y los
botones permiten orientar y acercar. El autor guarda la orientación y el zoom en
el JSON. Los lectores y alumnos pueden explorar la cámara localmente, sin
cambiar la geometría ni la cámara del documento original.

El cuerpo se encuadra automáticamente según sus dimensiones; el zoom se aplica
sobre ese encuadre. El PDF representa la orientación y zoom guardados del autor
como imagen estática e incluye las medidas visibles. La interacción permanece en
el lienzo, también al abrirlo por enlace público.

## Contrato

La primitiva `solid_3d` usa los campos comunes de los elementos y estos datos:

| Campo                       | Uso                                                                    |
| --------------------------- | ---------------------------------------------------------------------- |
| `solid`                     | `cube`, `cuboid`, `pyramid`, `sphere`, `cylinder`, `cone`              |
| `widthExpr`                 | Arista del cubo; ancho del prisma o base de la pirámide                |
| `depthExpr`                 | Profundidad del prisma o base de la pirámide                           |
| `heightExpr`                | Altura del prisma, pirámide, cilindro o cono                           |
| `radiusExpr`                | Radio de esfera, cilindro o cono                                       |
| `unit`                      | `u`, `mm`, `cm`, `m`, `km`                                             |
| `camera`                    | `yaw` entre −180 y 180, `pitch` entre −85 y 85, `zoom` entre 0.4 y 2.5 |
| `showEdges`, `showMeasures` | Visibilidad de aristas y medidas/resultados                            |
| `areaName`, `volumeName`    | Nombres únicos para usar área total y volumen en textos y tablas       |

Todos los campos se completan; las expresiones no utilizadas pueden ser `"1"`.
Las dimensiones activas deben estar entre 0.0001 y 10000. Los nombres calculados
no coinciden con variables, funciones, matrices ni otros resultados. El motor
resuelve dependencias entre sólidos y áreas sin depender del orden de dibujo,
con un número acotado de pasadas. Se rechazan referencias ausentes o circulares.

## Representación y límites

Cada cuerpo tiene vértices XYZ y caras cerradas, rotación espacial, proyección
en perspectiva, iluminación y ordenación por profundidad. La salida es SVG; no
necesita WebGL ni bibliotecas adicionales. La esfera utiliza una malla de 512
caras. Las áreas y volúmenes se calculan con fórmulas geométricas, no con la
aproximación visual de la malla.

No incluye física, cortes interactivos, superficies arbitrarias ni edición de
vértices 3D. Los antiguos `geometric_shape` de prismas/cilindros conservan sus
esquemas compatibles; un pedido tridimensional nuevo debe usar `solid_3d`. No se
añaden ejercicios incrustados ni cambios de PostgreSQL.

## Publicación

La versión del paquete es 1.0.0. El agente anuncia `primitive-agent-v7`; se
conserva `closed-beta-v4` en SQL. Antes de publicar un frontend con este contrato,
hay que desplegar `studio-agent`, `classroom-agent` y `classroom-api` con sus
dependencias compartidas actualizadas. El chequeo de publicación del frontend
rechaza un agente antiguo. Las tres funciones se actualizaron al integrar la 1.0.

Las pruebas del generador usan respuestas simuladas del proveedor. Los tests
comprueban cierre de mallas, volumen, cámara, dependencias y permisos. Los del
navegador comprueban creación manual, giro con ratón/táctil, persistencia,
medidas vinculadas y contenido real del PDF, sin llamadas pagadas a IA.
