# Catálogo de guías y respuestas matemáticas

Actualizado: 12 de noviembre de 2026.

Fontex ofrece material **introductorio**, organizado con la estructura de niveles y grados utilizada en Perú. No es una cobertura completa ni una certificación de alineación con el currículo nacional. Las lecturas y ejercicios son originales de Fontex; no se atribuyen al Minedu ni a los proveedores enlazados por el tutor.

| Nivel | Etapas | Guías |
| --- | --- | --- |
| Inicial | 3, 4 y 5 años | Conteo; clasificación y comparación; patrones y cantidades |
| Primaria | 1.º a 6.º | Suma/resta; valor posicional; multiplicación/división; fracciones/área; porcentajes; estadística |
| Secundaria | 1.º a 5.º | Enteros/ecuaciones; sistemas; cuadráticas; triángulos rectángulos; probabilidad y crecimiento compuesto |
| Universidad introductoria | Ingreso | Tasa de cambio media y derivada de x² |
| Guías conservadas | Primaria 5.º–6.º y secundaria 1.º–3.º | Fracciones equivalentes, decimales, proporcionalidad directa y funciones afines |

Son **19 guías, 38 páginas y 54 ejercicios**. Cambiar el nivel o el grado filtra el catálogo y la guía destacada. La selección anterior y sus resultados siguen disponibles al volver a ese tema. Los IDs de las cuatro guías anteriores se conservan para mantener el progreso y los PDF añadidos en IndexedDB.

## Una fuente de contenido

`supabase/functions/_shared/practice/lessons.json` alimenta la teoría, los ejercicios, el contexto del tutor y el generador de PDF. Cada pregunta indica su página de referencia y una explicación para cada distractor. Las guías de inicial están dirigidas a una persona adulta acompañante y no exigen lectura autónoma.

Los PDF incluyen las mismas lecturas y los ejercicios de cada página. Se regeneran con:

```sh
python -m pip install -r scripts/requirements-pdf.txt
python scripts/generate-practice-pdfs.py
```

Se necesita DejaVu Sans. En sistemas donde sus fuentes no estén en `/usr/share/fonts/truetype/dejavu`, define `FONTEX_FONT_DIR` con la carpeta que contiene `DejaVuSans.ttf` y `DejaVuSans-Bold.ttf`. Los archivos generados son deterministas. No añaden llamadas a IA ni requieren claves.

## Markdown y fórmulas

Los tutores de práctica y documental comparten `AcademicMarkdown`: `react-markdown`, `remark-math`, `rehype-katex` y KaTeX. Admiten Markdown, enlaces y notación matemática compatible con KaTeX, con delimitadores `$…$`, `$$…$$`, `\(…\)` y `\[…\]`. También se normalizan delimitadores y comandos escapados dos veces dentro de fórmulas. El código entre comillas invertidas conserva su texto.

No se interpreta HTML del mensaje ni se habilitan comandos confiables de KaTeX. Los enlaces utilizan la validación de protocolos de react-markdown y `noopener noreferrer`; las imágenes remotas no se cargan. MathML aporta la representación matemática accesible. Las fórmulas largas tienen desplazamiento horizontal dentro del mensaje.

## Publicación coordinada

El catálogo también se carga en `practice-tutor`. Publica esa función con el JSON actualizado **antes** de publicar el frontend, para que reconozca los nuevos temas. Las cuatro guías previas siguen siendo compatibles. No hace falta cambiar modelo ni aumentar cuotas.

Para actualizar `tutor-chat`, aplica primero `20261111223857_harden_tutor_exchange_persistence.sql`, verifica sus permisos y despliega la función junto con `handler.ts`, `protocol.ts`, `deno.json` y sus dependencias relativas. Esta actualización guarda pregunta, respuesta y citas en una transacción. Conserva `verify_jwt = true`, los secretos existentes y las cuotas configuradas. No modifica SMTP.

## Verificación

- Las pruebas del catálogo abren los 19 PDF con PDF.js y comprueban cantidad de páginas, texto, preguntas y compatibilidad con el tutor.
- Las pruebas de interfaz cubren filtros por grado, los cuatro niveles y conservación del progreso anterior.
- Las pruebas de formato cubren fracciones, exponentes, delimitadores TeX, bloques de código, listas, enlaces y contenido no confiable.
- La revisión en Chromium abrió ambas páginas de cada PDF y completó los 54 ejercicios. Se revisaron fórmulas y catálogo en móvil y en tema oscuro.
- La migración y las cinco suites SQL se ejecutaron en PostgreSQL 17 local con pgvector y pgTAP, usando esquemas de Auth y Storage de prueba. Esto no sustituye una prueba contra los servicios hospedados completos.

El despliegue remoto y su prueba posterior deben registrarse por separado: las pruebas locales no acreditan que producción se haya actualizado.
