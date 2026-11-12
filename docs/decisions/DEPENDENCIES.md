# Registro de dependencias

**Revisión:** 11 de noviembre de 2026. Las versiones de esta tabla son las observadas en `node_modules` durante la auditoría; `package-lock.json` conserva las resoluciones reproducibles de npm. `package.json` contiene rangos para muchos paquetes, por lo que se recomienda `npm ci`.

## Paquetes principales

| Dependencia | Versión observada | Finalidad actual | Licencia declarada |
|---|---|---|---|
| React / React DOM | 19.3.0 | Renderizado de las tres experiencias | MIT |
| Vite | 7.3.7 | Desarrollo, plugin local del tutor y build estático | MIT |
| TypeScript | 5.9.3 | Contratos estrictos y comprobación de frontend/configuración | Apache-2.0 |
| Tailwind CSS | 4.3.3 | Estilos compilados de las vistas académicas | MIT |
| React Router DOM | 7.18.4 | HashRouter y rutas compatibles con Pages | MIT |
| `@supabase/supabase-js` | 2.117.3 | Auth, datos, Storage y llamadas a funciones con sesión | MIT |
| Supabase CLI | 2.120.0 | Migraciones, configuración y pruebas locales; solo desarrollo | MIT |
| `pdfjs-dist` | 6.4.299 | Validación, extracción y visualización de PDF | Apache-2.0 |
| `@assistant-ui/react` | 0.15.25 | Runtime anterior conservado en componentes auxiliares; la ruta actual de tutor usa ChatArea/useTutor | MIT |
| Radix Slot | 1.4.0 | Composición de primitivas locales de UI | MIT |
| class-variance-authority | 0.7.1 | Variantes de componentes | Apache-2.0 |
| clsx / tailwind-merge | 2.1.1 / 3.7.0 | Combinación de clases | MIT |
| lucide-react | 0.553.0 | Iconografía | ISC |
| Vitest | 4.1.12 | Pruebas locales e integración remota opcional | MIT |
| ESLint / typescript-eslint | 10.12.0 / 8.71.1 | Calidad estática con información de tipos | MIT |

Las licencias anteriores se leyeron de los paquetes instalados. No constituyen una revisión legal de todas las dependencias transitivas. Testing Library y jsdom completan el entorno de pruebas; las resoluciones restantes están en el lockfile.

## Backend y servicios

- Las Edge Functions importan `@supabase/server` `1.9.1` mediante sus mapas de importación Deno. Las siete funciones, incluida `studio-agent`, incluyen `deno.lock`; el handler documental fija además `@supabase/supabase-js` `2.117.3` en su mapa de importación para tipos y pruebas.
- pgTAP comprueba esquema, RLS, cuotas y aislamiento en PostgreSQL local.
- pgvector proporciona `vector(1536)` y distancia por coseno. El esquema actual usa búsqueda exacta, no un índice HNSW.
- Responses API y Embeddings API se invocan por HTTP desde el servidor. Los nombres de modelo del código son configuración, no garantía de disponibilidad, precio o cuota.
- El motor de Studio, los gráficos SVG, el esquema JSON y el almacén local son código del proyecto; el incremento de Studio no introdujo paquetes nuevos.
- Fontex Agent reutiliza esos módulos y el cliente Supabase. No añade dependencias npm, SDK de IA ni librerías para interpretar código. El endpoint comparte validadores TypeScript con el frontend y solicita JSON Schema por HTTP.

`OPENAI_API_KEY` se utiliza en Edge Functions o en el plugin local de Vite. `VITE_SUPABASE_URL` y la clave publicable son configuración pública del navegador. Los servicios privados de IA y las claves administrativas no deben incorporarse a variables `VITE_*`.

## Resultado de seguridad de npm

El 11 de noviembre de 2026:

| Comando | Resultado |
|---|---|
| `npm audit --json` | 0 vulnerabilidades |
| `npm audit --omit=dev --json` | 0 vulnerabilidades |
| `npm ls zod minimatch vitest` | `zod@4.6.7`, `minimatch@11.0.1`, `vitest@4.1.12` |

La auditoría inicial reportó 13 alertas, incluidas las propagadas a dependientes. La corrección actualiza Vitest dentro de la rama 4 y fija mediante `overrides` las resoluciones transitivas de Zod y minimatch. El override de minimatch cruza de la rama 10 a la 11 porque la corrección del aviso está en esa rama; se verificaron sus exportaciones compatibles y se ejecutaron lint, tipos, pruebas y build. Se debe revisar al actualizar ESLint/typescript-eslint para retirarlo cuando sus rangos incorporen la versión corregida.

`package-lock.json` incluye las resoluciones completas y `npm ci` se comprobó con Node.js 22/npm 10. El [hallazgo A-10](../AUDITORIA.md) está corregido localmente. Cero alertas conocidas en esta fecha no garantiza ausencia de fallos futuros. Los componentes de assistant-ui que permanecen sin montar siguen siendo un punto de mantenimiento, aunque ya no arrastran la resolución vulnerable de Zod.

## Componentes y tipografías

shadcn/ui es una distribución de componentes copiables. Fontex mantiene `Button`, `Badge` y `Card` locales con convenciones de variantes y `cn`; no depende de un runtime central de shadcn/ui.

`index.html` solicita Manrope, Newsreader y DM Mono a Google Fonts. Studio, Fracciones y Práctica usan las familias globales mediante `--font-sans` y `--font-display`. El autoalojamiento es una decisión pendiente. La solicitud a Google Fonts implica una dependencia externa al abrir la aplicación. La actualización de interfaz no añadió dependencias.

## Mantenimiento

Antes de actualizar, comprobar versión, licencia y compatibilidad con Node.js 22 y los checks del repositorio. Revisar cambios del lockfile y repetir auditoría después de una actualización. La CLI de Supabase está fijada en v2; una migración a v3 requiere revisar los cambios de comandos y CI, según su [changelog oficial](https://supabase.com/changelog/supabase-cli-v3).
