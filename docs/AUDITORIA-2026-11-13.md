# Corrección de auditoría y retiro de materiales de prueba

Fecha: 13 de noviembre de 2026. Base: `main` en `5b802f3`, más los cambios locales descritos aquí.

## Correcciones

| Problema reproducido | Resultado |
|---|---|
| Una edición durante el cálculo asíncrono de un conflicto avanzaba la base aunque se descartara la mezcla; el siguiente intento sobrescribía el remoto | La base se copia por intento y solo se confirma si la versión local sigue vigente. Una prueba con el hash suspendido verifica que se guardan ambas versiones |
| El límite de título de 120 caracteres rechazaba materiales válidos de 121–160 y una sola fila inválida bloqueaba la biblioteca | Títulos de hasta 160 caracteres; cada fila remota se valida por separado. Los materiales del editor anterior se retiran, sin migrarlos |
| `1e-11*(x^2+1)` producía una raíz real inexistente | Los coeficientes se normalizan antes de resolver y la tolerancia depende del error de evaluación. Se conservan coeficientes pequeños y raíces cercanas distintas |
| `x^a`, con `a=2`, devolvía una derivada indefinida en cero | Se usa la regla de potencia para exponentes independientes de x; el lienzo sustituye los parámetros antes de derivar. Se prueban exponentes 0, 1, 2 y 3 |
| Escenas válidas exportadas por encima de 300 KB no podían abrirse | Importador, exportador y validador comparten un límite de 1 MiB medido en UTF-8. Se prueba un archivo real de más de 300 KB mediante el input del lienzo |
| KaTeX transitivo quedaba en 0.16.47 aunque la dependencia directa fuera 0.19.1 | El override reutiliza la versión directa fijada; `rehype-katex` y `micromark-extension-math` usan 0.19.1. La auditoría npm queda sin alertas |

El lienzo admite únicamente elementos nativos de fórmula, gráfico, tabla y texto. Se elimina la compatibilidad `legacy`, el importador de materiales de Studio y la lectura del prototipo anterior. La ruta `/#/lienzo-clasico` redirige al lienzo general. La implementación anterior se conserva en el historial y el código histórico del repositorio.

La limpieza del navegador elimina los almacenes retirados de Studio y del prototipo, además de las escenas `import-*` o con elementos `legacy`. Conserva escenas nativas, sesiones de cuenta y preferencias. Se ejecuta al abrir el frontend corregido.

## SQL aplicado al proyecto conectado

Proyecto: `fintex.back` (`goegjuglstapjwcckawp`), identificado tanto por la configuración del repositorio como por la lista de proyectos conectados.

Migración aplicada: [20261113215111_retire_studio_test_materials.sql](../supabase/migrations/20261113215111_retire_studio_test_materials.sql). El archivo local usa la versión registrada por Supabase.

| Recurso | Antes | Después verificado |
|---|---:|---:|
| Espacios de Studio anterior | 2 | 0 |
| Materiales dentro de esos espacios | 17 | 0 |
| Escenas importadas del editor anterior | 16 | 0 |
| Escenas nativas existentes | 0 | 0 |

La migración conserva la tabla histórica `studio_workspaces` sin contenido y revoca su acceso a clientes. El nuevo lienzo escribe directamente en `visual_scenes`, con RLS por propietario y revisiones incrementales. Una restricción rechaza identificadores `import-*` y elementos `legacy`, incluso si una pestaña antigua intenta restaurarlos. La limpieza se limita al editor anterior; no modifica cuentas, aulas, biblioteca PDF ni conversaciones del tutor documental.

## Validación ejecutada

Entorno: Windows/PowerShell, Node.js 22.14.0, npm 10.9.2 y Deno 2.9.7.

| Comprobación | Resultado |
|---|---|
| `npm ci` | Correcto; lockfile instalado |
| `npm run lint` | Correcto, sin advertencias |
| `npm run typecheck` | Correcto |
| `npm run test` | 470 aprobadas, 7 omitidas; 54 archivos aprobados y 4 omitidos |
| `npm run build` | Correcto; bundle principal por debajo del aviso de 500 KB |
| `npm audit --json` | 0 vulnerabilidades conocidas |
| `npm ls katex` | 0.19.1 en la dependencia directa y en ambos consumidores transitivos |
| Deno: scene-agent / studio-agent / tutor-chat | 2 + 15 + 13 pruebas aprobadas, con proveedor simulado |
| `deno check` | Ocho puntos de entrada comprobados |
| `deno lint supabase/functions` | Correcto, 22 archivos |
| SQL: retiro de materiales | 5 pruebas pgTAP aprobadas contra el proyecto conectado |
| SQL: escenas nativas | 15 pruebas pgTAP aprobadas: propietario, revisiones, aislamiento, privilegios y rechazo del formato retirado |

Las pruebas SQL se ejecutaron dentro de transacciones revertidas. Se confirmó después que no quedaron cuentas de prueba, escenas de prueba ni la extensión pgTAP instalada por la prueba. La migración de eliminación sí quedó aplicada permanentemente, conforme a la solicitud de retirar el material de prueba.

## Límites y avisos externos

Las siete pruebas de integración remota de Vitest siguen omitidas por falta de su configuración. No se realizaron llamadas pagadas a IA ni revisión visual manual para esta corrección. Docker estaba detenido; se verificaron las dos suites SQL afectadas en el proyecto conectado con reversión, no la suite completa en un stack local.

La publicación del frontend se realiza al subir estos cambios a `main` mediante el workflow [Deploy to GitHub Pages](https://github.com/dppablito4-oss/fontex-web/actions/workflows/deploy-pages.yml). La función `scene-agent` requiere desplegar también su validador compartido; la migración SQL ya estaba aplicada antes de esta publicación.

Los advisors posteriores al cambio conservan avisos ajenos a las tablas modificadas: ocho RPC `SECURITY DEFINER` accesibles a usuarios autenticados y protección de contraseñas filtradas desactivada. Son avisos para revisión de configuración, no alertas nuevas de npm ni fallos de las pruebas del lienzo. Consultar las guías de [RPC privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) y [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). También se registran avisos informativos de [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [claves foráneas sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) e [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
