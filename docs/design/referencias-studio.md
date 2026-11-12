# Referencias de producto e interfaz para Fontex Studio

Revisión de documentación y repositorios públicos: 12 de noviembre de 2026. No es una prueba comparativa de usabilidad ni una auditoría completa de los proyectos.

## Herramientas educativas

| Referencia | Funciones verificadas | Aplicación propuesta a Fontex |
| --- | --- | --- |
| [Polypad](https://polypad.amplify.com/p) | Manipulativos de fracciones, números, geometría, álgebra, probabilidad y datos; herramientas de autoría y asignación | Biblioteca visual de piezas con categorías claras y menos texto alrededor del dibujo |
| [GeoGebra Resources](https://help.geogebra.org/hc/en-us/articles/10449584308125-Get-started-with-GeoGebra-Resources) | Actividades que combinan matemáticas dinámicas y medios; libros que agrupan actividades | Agrupar módulos de una lección con un orden visible y reutilizable |

Polypad tiene una cobertura de manipulativos considerablemente mayor que los módulos actuales de Fontex. GeoGebra cubre más áreas matemáticas. Esto no establece que sean mejores para todas las necesidades del usuario. El enfoque propuesto de Fontex es crear material matemático visual a partir de una petición, editarlo y enseñarlo mediante pasos guiados en español.

## Repositorios públicos consultados

| Repositorio | Qué estudiar | Condiciones observadas |
| --- | --- | --- |
| [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | Jerarquía de herramientas, selección, zoom, desplazamiento, guardado local y exportación | README declara licencia MIT. Ofrece componente integrable en React |
| [tldraw/tldraw](https://github.com/tldraw/tldraw) | Motor de lienzo extensible, interfaz contextual y ejemplo de agente que lee y modifica el lienzo | SDK con código público y licencia comercial; no es software de código abierto según su FAQ. Algunos starter kits se declaran MIT, pero eso no cambia la licencia del SDK |
| [mathigon/textbooks](https://github.com/mathigon/textbooks) | Cursos con contenido, interacciones TypeScript y pistas por capítulo | Código y contenido públicos; el README conserva derechos reservados. No asumir reutilización libre de sus materiales |

Fuentes primarias adicionales:

- [README de Excalidraw](https://raw.githubusercontent.com/excalidraw/excalidraw/master/README.md)
- [FAQ oficial de tldraw](https://tldraw.dev/faq)
- [README de Mathigon Textbooks](https://github.com/mathigon/textbooks/blob/master/README.md)

No se copiaron componentes, ilustraciones ni código de estos proyectos en esta intervención, ni se sustituyó el motor actual del lienzo.

## Decisiones de esta intervención

Se mantiene React 19, TypeScript y Vite, junto con la biblioteca de iconos Lucide y los componentes de UI existentes. La apariencia no exige cambiar de framework.

Se conserva el fondo negro AMOLED del lienzo. Los controles del tema oscuro usan superficies gris grafito, campos gris oscuro, bordes visibles y acciones principales en gris claro. Las pestañas activas tienen relleno y borde distintos. Los pictogramas e iconos matemáticos conservan los acentos por categoría. Los cambios de gris están acotados a Studio en tema oscuro.

## Próximos pasos propuestos, aún no implementados aquí

1. Hacer visible el recorrido de crear, editar y enseñar, con una acción principal clara en cada etapa.
2. Mostrar un índice o miniaturas de los módulos para saltar a una parte de la lección sin buscar en el lienzo.
3. Añadir plantillas didácticas con objetivo, representación, pregunta y comprobación; validar su legibilidad con docentes y alumnos en PC y móvil.

Verificación del cambio visual: lint, TypeScript y compilación de producción. El navegador remoto devolvió «Site Unavailable» al abrir el dominio del usuario y al recargar una vez; esto impidió comprobar visualmente la publicación desde ese navegador. No se concluye que el sitio no funcione en el navegador del usuario.
