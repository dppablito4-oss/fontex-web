# Sistema de diseño de Fontex

**Versión:** 0.2.2

**Estado:** Implementado para temas claro y oscuro

## Principios

La interfaz expresa la idea de *fuentes puestas en contexto* con superficies sobrias, jerarquía legible y acentos geométricos. Los colores de marca identifican acciones y contexto, pero los estados de éxito, advertencia y error conservan colores semánticos independientes.

Todo componente nuevo debe consumir tokens; no debe incluir valores HEX ni nombres ligados a la paleta anterior dentro de clases JSX.

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
- El botón muestra luna cuando activa oscuro y sol cuando activa claro, con etiqueta accesible descriptiva.

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

## Accesibilidad y verificación

Las pruebas de `src/features/theme/contrast.test.ts` leen los valores reales de la hoja de estilos. Verifican un mínimo de 4.5:1 para texto normal y 3:1 para bordes de controles e indicadores de foco. Las pruebas del proveedor cubren preferencia del sistema, persistencia, alternancia, errores de almacenamiento y actualización de `data-theme`.

Al crear o modificar un token se deben volver a ejecutar `npm run test`, revisar las seis páginas en ambos temas y comprobar móvil, tablet y escritorio.

## Identidad gráfica

`BrandMark.tsx` conserva temporalmente el identificador tipográfico existente, ahora adaptado a índigo, cian y los tokens de primer plano. No intenta reconstruir el símbolo oficial.

Cuando estén disponibles los vectores aprobados, la ruta prevista es:

```text
public/brand/fontex-mark.svg
public/brand/fontex-wordmark.svg
```

Los SVG deben ofrecer variantes o colores compatibles con fondos claros y oscuros, conservar sus proporciones oficiales y evitar reemplazos con emojis o formas aproximadas.
