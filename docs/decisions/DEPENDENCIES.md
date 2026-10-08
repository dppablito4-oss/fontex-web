# Registro de dependencias

Registro inicial del Bloque 0. Las versiones exactas instaladas quedan fijadas en `package-lock.json`.

| Dependencia | Finalidad | Licencia declarada por el paquete | Decisión |
|---|---|---|---|
| React / React DOM | Renderizado de interfaz | MIT | Base de la aplicación |
| Vite | Desarrollo y build estático | MIT | Compatible con GitHub Pages |
| TypeScript | Comprobación estática estricta | Apache-2.0 | Reduce errores de contrato |
| Tailwind CSS + plugin Vite | Sistema de estilos | MIT | Estilos compilados sin runtime |
| React Router DOM | Navegación cliente | MIT | `HashRouter` evita reescrituras del servidor |
| assistant-ui React | Primitivas y runtime de conversación | MIT | Aprobado para el spike local; backend real pendiente |
| Radix Slot | Composición accesible para botones/enlaces | MIT | Dependencia puntual de los componentes UI |
| class-variance-authority, clsx, tailwind-merge | Variantes y combinación de clases | Apache-2.0 / MIT | Patrón utilizado por shadcn/ui |
| lucide-react | Iconografía | ISC | Iconos consistentes y reemplazables |
| Vitest + Testing Library + jsdom | Pruebas del frontend | MIT | Prueba básica del shell y futuras unitarias |
| ESLint + typescript-eslint | Calidad estática | MIT / BSD-2-Clause | CI sin advertencias |

## shadcn/ui

shadcn/ui es una distribución de componentes copiables, no una dependencia de runtime central. En este bloque se adoptan sus convenciones (`components.json`, `cn`, variantes y componentes locales) y se mantienen solo `Button`, `Badge` y `Card`, adaptados a la identidad visual de Fontex.

## Fuentes web

El prototipo carga Manrope, Newsreader y DM Mono desde Google Fonts en `index.html`. Esto realiza una solicitud externa al abrir la aplicación. Antes de un piloto real se debe decidir si se autoalojan para reducir dependencia y exposición de metadatos.

## Política

Antes de copiar código adicional se comprobarán la licencia y la versión exacta. Los servicios de datos o IA no se incorporarán al cliente. Las auditorías automáticas de paquetes complementan, pero no sustituyen, la revisión de licencias y dependencias transitivas.
