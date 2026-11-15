# Correcciones de la auditoría — 15 de noviembre de 2026

Los cuatro hallazgos de [la auditoría de `aedf80f`](AUDITORIA-2026-11-15.md) están corregidos en el repositorio. Los cambios se verificaron localmente, incluida una base PostgreSQL aislada. Su activación en producción requiere el despliegue descrito al final.

## Cambios

| Hallazgo | Corrección | Regresión cubierta |
|---|---|---|
| H-01 · Eliminación de conversaciones guardadas | La referencia para descartar se obtiene de la procedencia del documento, sin depender de que tenga figuras. Los documentos restaurados conservan su título y conversación. | Reapertura y descarte en cuenta e invitado; un borrador creado durante la sesión sigue pudiendo descartarse después del autoguardado. |
| H-02 · Sustitución de cambios de otro dispositivo | Aceptar una revisión remota actualiza la referencia para descartar. Las referencias se confirman junto con la reconciliación; un intento abandonado no las adelanta. Las copias creadas por conflicto se conservan. | Cambios remotos de contenido seguidos de una edición local descartada; autoguardado local sin alterar la referencia; cierre de una copia de conflicto. |
| H-03 · Respuestas válidas rechazadas | Las expresiones con `x` se validan mediante el parser, sin inferir su dominio a partir de cinco puntos fijos. | `sqrt(x-10)`, `ln(x-100)` y un dominio estrecho se aceptan; símbolos y sintaxis no admitidos se rechazan. |
| H-04 · Backend anterior admitido al publicar | El control exige `closed-beta-v3`, prueba el RPC público con un token nulo y comprueba `primitive-agent-v3` en el preflight del agente desplegado. | Se rechazan contratos anteriores, RPC ausentes o bloqueados por beta y agentes sin el contrato nuevo. |

También se excluye `ops.local` de ESLint, de forma coherente con su uso como directorio operativo ignorado por Git. El comando normal `npm run lint` vuelve a pasar sin parámetros adicionales.

La migración [canvas_release_contract_v3](../supabase/migrations/20261115221512_canvas_release_contract_v3.sql) se generó con Supabase CLI desde el cambio probado en la base aislada. El contrato SQL sólo anuncia v3 si existen la tabla de enlaces con RLS y ambos RPC con los permisos previstos. No añade permisos sobre documentos a usuarios anónimos.

El agente añade su versión al preflight existente, conservando la autenticación y las respuestas de generación transmitidas. El control de publicación no crea cuentas, publica lienzos ni consume IA: `read_public_canvas(null)` no puede coincidir con ningún token ni leer contenido de usuarios.

## Verificación final

| Comprobación | Resultado |
|---|---|
| `npm run lint` | Pasa |
| `npm run typecheck` y compilación TypeScript de producción | Pasan |
| `npm test -- --reporter=dot` | **448 pasan**, 7 integraciones remotas omitidas por configuración ausente |
| `npm run build` | Pasa |
| `npm run test:e2e -- --workers=2` | **28 pasan**, 2 gestos exclusivos de escritorio omitidos en móvil |
| Pruebas Deno | **45 pasan**: 23 de agente/créditos/uso/contrato, 7 compartidas, 13 del tutor y 2 del agente retirado |
| Tipos del endpoint modificado y `deno lint supabase/functions` | Pasan; lint de 31 archivos |
| Migraciones desde cero | **24 aplicadas** en el proyecto local aislado `fontex-audit-fixes` |
| SQL/RLS, incluida la nueva migración | **289 pasan** en 14 archivos |
| Asesores de seguridad/rendimiento | Sin incidencias en niveles warn/error revisados |
| Ensayo de backup/restauración | Pasa con 24 migraciones; conserva funciones y RLS de recibos de generación |
| `git diff --check` | Pasa |

Las cifras suman **810 pruebas superadas**. La corrección de lint en el archivo de pruebas se verificó después con sus 18 casos de guardado. No se ejecutaron generaciones pagadas ni pruebas autenticadas contra producción. Los avisos existentes de anotaciones de Zod y fuentes estándar de PDF.js siguen siendo avisos sin fallo.

La base de verificación se creó en un proyecto local separado y con puertos diferentes. El ensayo de restauración utilizó exclusivamente su contenedor y una base desechable. La base local habitual de Fontex y los datos alojados no se modificaron.

## Orden de publicación

1. Aplicar en el backend destino las migraciones pendientes, incluida `20261115221512_canvas_release_contract_v3.sql`.
2. Desplegar `studio-agent` desde esta misma versión del repositorio, incluidos `release.ts`, el esquema y las dependencias compartidas.
3. Ejecutar `node scripts/check-backend-release.mjs` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` del destino. Debe acreditar SQL v3, lectura pública y agente v3, además de los ocho endpoints protegidos.
4. Publicar el frontend. Pages ejecuta también este control y rechaza un backend incompleto.

Estos cambios están preparados y probados en el repositorio. No se aplicaron migraciones ni se desplegaron funciones o frontend en producción durante esta corrección.
