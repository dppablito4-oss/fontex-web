# Arquitectura del Bloque 0

## Objetivo

El Bloque 0 establece la interfaz y las fronteras técnicas de Fontex sin conectar todavía datos privados ni modelos generativos. El resultado es un sitio estático que se puede compilar y publicar en GitHub Pages.

## Capas actuales

```text
Navegador
├── React Router (HashRouter)
├── Shell responsive y páginas por funcionalidad
├── Componentes UI locales
└── assistant-ui LocalRuntime
    └── Adaptador de demostración, sin red ni secretos
```

- `src/app`: enrutamiento y layout transversal.
- `src/features`: páginas y comportamiento agrupados por funcionalidad.
- `src/components`: componentes compartidos y primitivas UI.
- `src/lib`: utilidades sin conocimiento de la interfaz.
- `supabase`: marcadores para migraciones, funciones y pruebas futuras; no contiene un esquema inventado.

## Navegación estática

Se utiliza `HashRouter` porque GitHub Pages no ofrece reglas de reescritura para una SPA. La URL conserva el documento estático y expresa la ruta después de `#`, de modo que una recarga no produce un error 404.

Vite configura `/fontex-web/` como `base` durante GitHub Actions y `/` en desarrollo local. Si cambia el nombre del repositorio, debe actualizarse `vite.config.ts`.

## Evaluación de assistant-ui

La prueba usa `@assistant-ui/react` con `useLocalRuntime` y un `ChatModelAdapter` local. La biblioteca funciona con Vite y no necesita Next.js para administrar el estado de una conversación en memoria.

Resultado del spike:

- Es compatible con el frontend estático para componentes, estado local y experiencia conversacional.
- Una respuesta real **sí requiere** un backend seguro. En bloques posteriores, el adaptador deberá invocar una Supabase Edge Function autenticada.
- La clave del proveedor de IA nunca se incluirá en variables `VITE_*` ni en el bundle.
- Persistencia, citas verificadas, streaming remoto y permisos quedan fuera del Bloque 0.

## Frontera futura

El frontend podrá utilizar el SDK público de Supabase bajo políticas RLS. Las operaciones con secretos, recuperación autorizada y proveedores de IA residirán en Edge Functions. El contrato del adaptador conversacional permite reemplazar la simulación sin rehacer la vista.

## Accesibilidad y responsive

El shell incluye enlace de salto, navegación semántica, controles etiquetados, foco visible y soporte para reducción de movimiento. El menú lateral se transforma en panel móvil. Las verificaciones automáticas de accesibilidad en navegador quedan como tarea del Bloque 5; no se declaran como completadas en esta fase.
