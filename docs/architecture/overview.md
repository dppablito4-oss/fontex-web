# Arquitectura de los Bloques 0 y 1

## Objetivo

El Bloque 0 estableció la interfaz y las fronteras técnicas de Fontex. El Bloque 1 incorpora identidad, aulas y grupos con autorización en PostgreSQL, manteniendo el frontend como sitio estático para GitHub Pages. Los documentos privados y modelos generativos siguen sin conectarse.

## Capas actuales

```text
Navegador
├── React Router (HashRouter)
├── Supabase Auth + cliente público bajo RLS
├── Contextos de identidad y espacio de trabajo
├── Shell responsive y páginas por funcionalidad
├── Componentes UI locales
└── assistant-ui LocalRuntime
    └── Adaptador de demostración, sin red ni secretos
```

- `src/app`: enrutamiento y layout transversal.
- `src/features`: páginas y comportamiento agrupados por funcionalidad.
- `src/components`: componentes compartidos y primitivas UI.
- `src/lib`: utilidades sin conocimiento de la interfaz.
- `supabase/migrations`: esquema versionado de identidad, aulas, invitaciones y grupos.
- `supabase/tests`: pruebas pgTAP de aislamiento con múltiples identidades.

## Identidad y autorización

`AuthProvider` administra la sesión y el perfil. `WorkspaceProvider` consulta exclusivamente mediante el token del usuario; no usa claves privadas ni decide autorizaciones. Si faltan las variables públicas, la aplicación conserva un modo demostrativo explícito y no simula escrituras.

El esquema aplica dos capas:

1. Privilegios SQL mínimos para `authenticated` y ninguno para `anon` sobre las tablas del Bloque 1.
2. RLS para filtrar perfiles, organizaciones, aulas, matrículas, invitaciones y grupos.

Los roles pertenecen a `class_members`, no a `raw_user_meta_data`. Las invitaciones vinculan correo, rol y aula; el token se devuelve una vez y solo se conserva su SHA-256. El propietario del aula no puede ser retirado y solo él puede cambiar roles de miembros existentes. Retirar una matrícula elimina también las asignaciones grupales y corta el acceso futuro.

Las funciones auxiliares que deben leer membresías sin recursión RLS viven en el esquema no expuesto `private`, usan `SECURITY DEFINER`, fijan `search_path = ''` y califican todas las relaciones. Las funciones públicas de mutación verifican `auth.uid()`, correo y rol antes de escribir y limitan su ejecución a `authenticated`.

## Navegación estática

Se utiliza `HashRouter` porque GitHub Pages no ofrece reglas de reescritura para una SPA. La URL conserva el documento estático y expresa la ruta después de `#`, de modo que una recarga no produce un error 404.

Vite obtiene su `base` de compilación desde `VITE_BASE_PATH`. El valor predeterminado es `/`, necesario para publicar desde la raíz del dominio personalizado `fontex.sypablitodp.site`. El workflow de Pages utiliza la variable de repositorio del mismo nombre y también adopta `/` cuando no está definida. Para usar el dominio estándar de GitHub Pages se puede asignar `/fontex-web/`, sin detecciones de dominio en tiempo de ejecución.

El shell conserva las rutas internas en el fragmento mediante `HashRouter`. El salto accesible al contenido cancela la navegación del enlace y mueve el foco al elemento `main`, por lo que no reemplaza el fragmento de ruta. En pantallas móviles, el panel lateral cerrado utiliza `inert` y `aria-hidden`; sus controles quedan fuera de la navegación por teclado hasta abrir el menú.

## Evaluación de assistant-ui

La prueba usa `@assistant-ui/react` con `useLocalRuntime` y un `ChatModelAdapter` local. La biblioteca funciona con Vite y no necesita Next.js para administrar el estado de una conversación en memoria.

Resultado del spike:

- Es compatible con el frontend estático para componentes, estado local y experiencia conversacional.
- Una respuesta real **sí requiere** un backend seguro. En bloques posteriores, el adaptador deberá invocar una Supabase Edge Function autenticada.
- La clave del proveedor de IA nunca se incluirá en variables `VITE_*` ni en el bundle.
- Persistencia, citas verificadas, streaming remoto y permisos quedan fuera del Bloque 0.

## Frontera futura

El frontend ya utiliza el SDK público de Supabase bajo RLS para el Bloque 1. Las operaciones con secretos, documentos, recuperación autorizada y proveedores de IA residirán en Storage y Edge Functions a partir de los bloques siguientes. El contrato del adaptador conversacional permite reemplazar la simulación sin rehacer la vista.

## Accesibilidad y responsive

El shell incluye enlace de salto, navegación semántica, controles etiquetados, foco visible y soporte para reducción de movimiento. El menú lateral se transforma en panel móvil. Las verificaciones automáticas de accesibilidad en navegador quedan como tarea del Bloque 5; no se declaran como completadas en esta fase.
