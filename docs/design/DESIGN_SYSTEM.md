# Sistema de diseño de Fontex

**Revisión documental:** 14 de noviembre de 2026; paleta verde/naranja y oscuro AMOLED, aplicación `0.8.1`.

**Estado:** Temas claro/oscuro compartidos por Studio, Fracciones, Práctica y las vistas académicas.

## Principios

La interfaz expresa la idea de *fuentes puestas en contexto* con superficies sobrias, jerarquía legible y acentos geométricos. El verde identifica acciones y estados positivos, el naranja destaca presentación y fracciones, y los errores conservan su rojo semántico.

Los componentes nuevos deben consumir tokens. La portada, el lienzo, el laboratorio, Fracciones y Práctica usan alias `--lp-*`, `--pc-*`, `--gc-*`, `--fc-*` y `--fd-*` que referencian las variables globales; las superficies y los controles cambian de tema sin paletas independientes.

## Superficies actuales

| Experiencia | Hoja de estilos | Temas |
|---|---|---|
| Espacio académico y autenticación | `src/styles/globals.css` | Claro y oscuro mediante `ThemeProvider` |
| Aula de práctica | `src/features/demo/demo.css` | Claro y oscuro, con alias de los tokens globales |
| Lienzo de primitivas | `src/features/primitives/primitives.css` | Claro y oscuro, incluidos tablero, pestañas, menús y panel derecho |
| Fracciones | `src/features/canvas/canvas.css` | Claro y oscuro, incluidas figuras y notas |

El lienzo usa pestañas de documentos sobre la barra de herramientas. Archivo, Elementos, Plantillas y Variables se despliegan desde arriba. El panel derecho reserva su espacio al chat y alterna a propiedades al seleccionar un objeto; no añade una segunda columna de inspección. El saldo se pliega, los iconos de herramientas comparten estilo y las etiquetas permanecen visibles. Véase [Organización del lienzo](../interfaz-lienzo.md).

Los SVG comparten `--ui-math-primary`, `--ui-math-secondary` y `--ui-math-empty`, con valores para ambos temas. Las pruebas comprueban contraste mínimo 3:1 de piezas coloreadas frente a la tarjeta y a las piezas vacías. Texto, formularios, errores y foco conservan sus tokens semánticos.

Fontex Agent ocupa el panel derecho, con conversación y compositor propios. Su nivel permanece junto al mensaje y la creación con IA se distingue del botón que abre un lienzo vacío. La gestión JSON vive en Archivo. Las ayudas de formulario utilizan nombres accesibles; el foco de los menús se restaura al cerrarlos con Escape.

El editor adapta el zoom al ancho disponible y permite controlarlo desde la barra inferior. Los objetos conservan sus controles de tamaño, movimiento y giro, y los planos tienen su propia navegación. En móvil se apilan las representaciones. La reorganización de controles no modifica las dimensiones de los documentos guardados.

## Paleta oficial

| Elemento | Claro | Oscuro |
|---|---:|---:|
| Fondo principal y lienzo | `#FAFAFA` | `#000000` |
| Paneles y navegación | `#FFFFFF` | `#0D0E12` |
| Bordes y separadores | `#E4E4E7` | `#1C1E26` |
| Texto principal | `#0F172A` | `#F3F4F6` |
| Texto secundario | `#475569` | `#9CA3AF` |
| Verde: chat, envío, derivadas y áreas | `#15803D` | `#22C55E` |
| Naranja: presentar, fracciones y destacados | `#EA580C` | `#F97316` |

Los fondos tenues y los estados de interacción se derivan de esta paleta. Los errores conservan un rojo semántico. Los botones verdes usan texto blanco en claro y negro en oscuro; los botones naranjas usan `#0F172A` para mantener la lectura. La marca y el favicon utilizan verde/naranja sobre su soporte negro.

## Tokens semánticos

Los valores viven en `src/styles/globals.css`. Tailwind CSS v4 los expone mediante `@theme inline`, por lo que utilidades como `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary` y `text-primary-foreground` responden dinámicamente a `data-theme`.

| Token | Claro | Oscuro | Propósito |
|---|---:|---:|---|
| `background` | `#FAFAFA` | `#000000` | Fondo global |
| `surface` | `#FFFFFF` | `#0D0E12` | Tarjetas, formularios y mensajes |
| `sidebar` | `#FFFFFF` | `#0D0E12` | Navegación y panel contextual |
| `foreground` | `#0F172A` | `#F3F4F6` | Texto principal |
| `muted-foreground` | `#475569` | `#9CA3AF` | Texto secundario |
| `border` | `#E4E4E7` | `#1C1E26` | Separadores y contenedores |
| `control-border` | `#71717A` | `#60646F` | Límites de campos y controles |
| `primary` | `#15803D` | `#22C55E` | Acción principal y selección |
| `primary-foreground` | `#FFFFFF` | `#000000` | Contenido sobre acción principal |
| `accent` | `#EA580C` | `#F97316` | Presentar y fracciones |
| `accent-foreground` | `#0F172A` | `#0F172A` | Contenido sobre naranja |
| `info` | `#15803D` | `#22C55E` | Identificación informativa |

`control-border` es deliberadamente más oscuro que el borde base propuesto. La variación permite superar una relación 3:1 frente al fondo y distinguir campos sin depender únicamente del foco.

Los grupos `success`, `warning`, `error` e `info` disponen de tokens separados para primer plano, superficie y borde. Las etiquetas del tutor consumen estos tokens y responden al selector `data-theme`, sin depender de una clase `dark` diferente.

Los colores predeterminados de los diagramas se resuelven al renderizar mediante `visual-colors.ts`; el documento guardado y los colores personalizados permanecen intactos. Los PDF conservan sus propios colores. La impresión utiliza papel blanco y tinta legible, independientemente del tema de pantalla.

## Comportamiento de los temas

- `ThemeProvider` administra únicamente `light` y `dark`.
- Sin elección manual, el tema sigue `prefers-color-scheme` y responde a sus cambios.
- Una elección manual se conserva bajo `fontex-theme` en `localStorage`.
- Si el almacenamiento está bloqueado, la preferencia continúa funcionando durante la sesión.
- `data-theme` y `color-scheme` se aplican al elemento `<html>`.
- Un script mínimo en `index.html` resuelve el tema antes del arranque de React para evitar un destello significativo.
- El botón muestra luna cuando activa oscuro y sol cuando activa claro, con etiqueta accesible descriptiva. Está disponible en Studio, Fracciones, Práctica y las vistas académicas.

## Reglas para componentes

1. Elegir tokens por función, no por parecido visual.
2. Usar `surface` para contenido elevado y `background` para el plano general.
3. Reservar `primary` para acciones y estados seleccionados; usar `accent` con moderación.
4. Aplicar `control-border` a campos interactivos y `border` a divisores decorativos.
5. Mantener foco visible mediante `--ui-focus` y un contorno que no dependa solo del cambio de color.
6. Conservar estados `disabled`, `hover`, `selected`, error y éxito distinguibles por forma, texto o icono además del color.
7. Usar negro absoluto en el plano principal AMOLED y `surface` para distinguir paneles.
8. Respetar `prefers-reduced-motion`; no añadir animaciones que ignoren su regla global.

## Tutor académico

La conversación usa `background` como plano de lectura, `surface` para respuestas del tutor, `primary` para mensajes y envío del estudiante, y `sidebar` para las fuentes activas. El degradado del compositor, sus bordes y los controles se derivan de tokens para impedir superficies claras residuales en modo oscuro.

## Biblioteca documental

Las tarjetas de documento usan `surface`, bordes semánticos y badges textuales para distinguir alcance privado, de grupo o de aula sin depender solo del color. La carga y la compartición se presentan en paneles delimitados; el visor PDF ocupa un diálogo responsive con controles de página accesibles, ancho adaptable y cierre explícito. Los estados vacío, cargando, error y confirmación deben conservarse en ambos temas y en anchos móviles.

Los estados de índice se expresan además con texto: `Sin indexar`, `Indexando`, `Índice listo` e `Índice fallido`. El panel diagnóstico RAG presenta documento, página y fragmento. El tutor documental ya consume recuperación autorizada mediante su propio endpoint; el diagnóstico de Biblioteca es una herramienta aparte. La puntuación queda como metadato secundario, nunca como sustituto de la fuente.

## Accesibilidad y verificación

Las pruebas de `src/features/theme/contrast.test.ts` leen los valores reales de la hoja de estilos. Verifican un mínimo de 4.5:1 para texto normal y 3:1 para bordes de controles e indicadores de foco. Las pruebas del proveedor cubren preferencia del sistema, persistencia, alternancia, errores de almacenamiento y actualización de `data-theme`.

Al crear o modificar un token se deben ejecutar las pruebas relevantes y revisar las vistas afectadas en ambos temas y en móvil, tablet y escritorio. Las pruebas actuales cubren selección y persistencia del tema desde las distintas experiencias, además del contraste. En la actualización del 14 de noviembre pasaron las 363 pruebas del frontend (7 integraciones remotas omitidas), lint y tipos. Las 32 pruebas de tema/contraste pasan con los colores reales de la hoja de estilos. La revisión visual se interrumpió con la tecla física Escape; no se presenta como completada una prueba visual, móvil o de lector de pantalla.

## Identidad gráfica

`BrandMark.tsx` combina el identificador tipográfico con `public/brand/fontex-mark.svg`. El símbolo conserva su geometría y aplica la paleta verde, blanco y naranja solicitada. El contenedor negro preserva el contraste del trazo blanco en temas claro y oscuro.

Cuando estén disponibles los vectores aprobados, la ruta prevista es:

```text
public/brand/fontex-mark.svg
public/brand/fontex-wordmark.svg
```

Los SVG deben ofrecer variantes o colores compatibles con fondos claros y oscuros, conservar sus proporciones oficiales y evitar reemplazos con emojis o formas aproximadas.
