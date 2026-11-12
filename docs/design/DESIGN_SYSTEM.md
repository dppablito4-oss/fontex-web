# Sistema de diseño de Fontex

**Revisión documental:** 11 de noviembre de 2026; aplicación `0.6.0` con Studio incorporado.

**Estado:** Temas claro/oscuro compartidos por Studio, Fracciones, Práctica y las vistas académicas.

## Principios

La interfaz expresa la idea de *fuentes puestas en contexto* con superficies sobrias, jerarquía legible y acentos geométricos. Los colores de marca identifican acciones y contexto, pero los estados de éxito, advertencia y error conservan colores semánticos independientes.

Los componentes nuevos deben consumir tokens. Studio, Fracciones y Práctica usan alias `--st-*`, `--fc-*` y `--fd-*` que referencian las variables globales; las superficies y los controles cambian de tema sin paletas independientes.

## Superficies actuales

| Experiencia | Hoja de estilos | Temas |
|---|---|---|
| Espacio académico y autenticación | `src/styles/globals.css` | Claro y oscuro mediante `ThemeProvider` |
| Aula de práctica | `src/features/demo/demo.css` | Claro y oscuro, con alias de los tokens globales |
| Studio | `src/features/studio/studio.css` | Claro y oscuro, incluidos tablero, SVG, inspector y diálogos |
| Fracciones | `src/features/canvas/canvas.css` | Claro y oscuro, incluidas figuras y notas |

Studio usa una cabecera compacta, paleta de objetos, tablero e inspector. En tablet el inspector pasa debajo del lienzo; en móvil las herramientas se distribuyen horizontalmente. Materiales, guardado, historial, presentación y selector de tema se concentran en la cabecera. Se retiraron lemas, notas persistentes sobre almacenamiento y metadatos técnicos sin una acción asociada.

Los SVG comparten `--ui-math-primary`, `--ui-math-secondary` y `--ui-math-empty`, con valores para ambos temas. Las pruebas comprueban contraste mínimo 3:1 de piezas coloreadas frente a la tarjeta y a las piezas vacías. Texto, formularios, errores y foco conservan sus tokens semánticos.

Fontex Agent ocupa un panel desplegable dentro del inspector, conservando el editor y sus rutas. Agrupa modo/nivel, orientación y vista previa de acciones; el JSON local y el contexto quedan bajo controles avanzados. No aplica cambios automáticamente. Las figuras de colecciones, rectas y ecuaciones usan los mismos tokens; los puntos demasiado próximos se identifican en una lista para evitar etiquetas superpuestas. Las nuevas ayudas de formulario usan `aria-describedby`, separadas del nombre del campo. La revisión visual de estos controles sigue pendiente.

Los módulos se editan al 100 % por defecto en escritorio, con tamaños iniciales más amplios, tirador de redimensionado y vista ampliada en diálogo nativo. El diálogo elimina la reducción de escala del lienzo sin modificar el documento; mantiene el tema y usa gráficos más grandes. Sus operandos se apilan en móvil. Redimensionar conserva los límites y se confirma como un único paso de historial. Las dimensiones de documentos previos no se migran automáticamente.

## Paleta oficial

| Color | HEX | Uso |
|---|---:|---|
| Cian Fontex | `#06F0FC` | Acentos y elementos destacados sobre fondos controlados |
| Azul cielo | `#81C5FE` | Información y acción principal del tema oscuro |
| Índigo Fontex | `#1800AD` | Acción principal del tema claro e identidad |
| Negro | `#000000` | Recurso de marca; no se usa como gran superficie oscura |

El hero utiliza `brand-deep` (`#14008C`) con texto blanco y acentos cian. Es una variación del índigo oficial pensada para conservar contraste estable en ambos temas.

## Tokens semánticos

Los valores viven en `src/styles/globals.css`. Tailwind CSS v4 los expone mediante `@theme inline`, por lo que utilidades como `bg-background`, `bg-surface`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary` y `text-primary-foreground` responden dinámicamente a `data-theme`.

| Token | Claro | Oscuro | Propósito |
|---|---:|---:|---|
| `background` | `#F7F9FC` | `#0B1020` | Fondo global |
| `surface` | `#FFFFFF` | `#141C30` | Tarjetas, formularios y mensajes |
| `sidebar` | `#EEF3F9` | `#11182A` | Navegación y panel contextual |
| `foreground` | `#101722` | `#EEF6FF` | Texto principal |
| `muted-foreground` | `#536579` | `#A8B6D1` | Texto secundario |
| `border` | `#DCE4F0` | `#2B3550` | Separadores y contenedores |
| `control-border` | `#718096` | `#73809D` | Límites de campos y controles |
| `primary` | `#1800AD` | `#81C5FE` | Acción principal y selección |
| `primary-foreground` | `#FFFFFF` | `#081226` | Contenido sobre acción principal |
| `accent` | `#06F0FC` | `#06F0FC` | Acento de marca |
| `accent-foreground` | `#081226` | `#081226` | Contenido sobre cian |
| `info` | `#81C5FE` | `#81C5FE` | Identificación informativa |

`control-border` es deliberadamente más oscuro que el borde base propuesto. La variación permite superar una relación 3:1 frente al fondo y distinguir campos sin depender únicamente del foco.

Los grupos `success`, `warning`, `error` e `info` disponen de tokens separados para primer plano, superficie y borde. No deben reemplazarse por azul de marca.

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
7. Evitar negro absoluto en grandes superficies del tema oscuro.
8. Respetar `prefers-reduced-motion`; no añadir animaciones que ignoren su regla global.

## Tutor académico

La conversación usa `background` como plano de lectura, `surface` para respuestas del tutor, `primary` para mensajes y envío del estudiante, y `sidebar` para las fuentes activas. El degradado del compositor, sus bordes y los controles se derivan de tokens para impedir superficies claras residuales en modo oscuro.

## Biblioteca documental

Las tarjetas de documento usan `surface`, bordes semánticos y badges textuales para distinguir alcance privado, de grupo o de aula sin depender solo del color. La carga y la compartición se presentan en paneles delimitados; el visor PDF ocupa un diálogo responsive con controles de página accesibles, ancho adaptable y cierre explícito. Los estados vacío, cargando, error y confirmación deben conservarse en ambos temas y en anchos móviles.

Los estados de índice se expresan además con texto: `Sin indexar`, `Indexando`, `Índice listo` e `Índice fallido`. El panel diagnóstico RAG presenta documento, página y fragmento. El tutor documental ya consume recuperación autorizada mediante su propio endpoint; el diagnóstico de Biblioteca es una herramienta aparte. La puntuación queda como metadato secundario, nunca como sustituto de la fuente.

## Accesibilidad y verificación

Las pruebas de `src/features/theme/contrast.test.ts` leen los valores reales de la hoja de estilos. Verifican un mínimo de 4.5:1 para texto normal y 3:1 para bordes de controles e indicadores de foco. Las pruebas del proveedor cubren preferencia del sistema, persistencia, alternancia, errores de almacenamiento y actualización de `data-theme`.

Al crear o modificar un token se deben ejecutar las pruebas relevantes y revisar las vistas afectadas en ambos temas y en móvil, tablet y escritorio. Las pruebas actuales cubren selección y persistencia del tema desde las tres experiencias, además del contraste. La herramienta de navegador bloqueó la revisión visual del 11 de noviembre porque no pudo verificar la URL de Windows; no se completó revisión visual, E2E ni de lector de pantalla.

## Identidad gráfica

`BrandMark.tsx` combina el identificador tipográfico con `public/brand/fontex-mark.svg`, una versión vectorial determinista del símbolo cian, blanco e índigo entregado por el propietario. El contenedor negro preserva el contraste del trazo blanco en temas claro y oscuro.

Cuando estén disponibles los vectores aprobados, la ruta prevista es:

```text
public/brand/fontex-mark.svg
public/brand/fontex-wordmark.svg
```

Los SVG deben ofrecer variantes o colores compatibles con fondos claros y oscuros, conservar sus proporciones oficiales y evitar reemplazos con emojis o formas aproximadas.
