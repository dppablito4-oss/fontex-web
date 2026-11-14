# Preparación y operación de la beta cerrada

Cambios del 14 de noviembre de 2026, a partir de la [auditoría](AUDITORIA-BETA-CERRADA-2026-11-14.md). El backend de producción `goegjuglstapjwcckawp` ya incorpora los controles de esta beta. El resultado de la publicación se registra en [el acta de despliegue](DESPLIEGUE-BETA-2026-11-14.md).

## Cambios implementados

| Hallazgo | Corrección en el repositorio |
|---|---|
| B-01 | `scene-agent` devuelve `410` a usuarios autenticados sin consultar IA |
| B-02 | Reserva atómica de uso en chat y construcción, presupuestos de contexto/salida, límite global y pausa de IA |
| B-03 | Registro por invitación de correo, acceso por UUID, revocación, protección del API/Storage/RLS y panel administrativo |
| B-04 | Pages depende del workflow reutilizable de frontend, SQL y Edge; exige configuración explícita y contrato del backend |
| B-05 | Las cargas de aulas descartan respuestas obsoletas y limpian los detalles al cambiar de aula o cuenta |
| B-06 | El formateador conserva números pequeños no nulos en notación científica |
| B-07 | Se comprueban páginas reales y declaradas antes de extraer texto; extracción con presupuesto temporal y limpieza |
| B-08 | El multipart se limita contando bytes recibidos, también sin `Content-Length` y con campos extra |
| B-09 | Borrado valida un objeto JSON no nulo y acota la lectura del cuerpo |
| B-10 | Catálogo paginado, contenido bajo demanda, sincronización por revisión, cuotas acumuladas y eliminación con control de revisión |

Se añadió recuperación ante errores de renderizado, copia de seguridad local y la página pública `/#/beta` con ayuda, uso de datos y contacto para incidencias. El contacto abre el correo del participante; no transmite automáticamente documentos ni conversaciones.

## Participantes e invitaciones

La migración `20261114190450_closed_beta_controls.sql` conserva como cohorte inicial las cuentas ya verificadas del piloto y los administradores existentes. Revisa esa lista antes de abrir la beta. Las cuentas futuras requieren una invitación por correo. `user_metadata` no concede acceso ni administración.

Producción comparte Auth con la aplicación `forma`. Las migraciones `20261114220000` y `20261114221500` mantienen su API y sus datos separados de las restricciones de Fontex. Por decisión explícita del operador, **el registro de todo el proyecto compartido requiere invitación**, incluida esa aplicación. Tener una cuenta o un token no sustituye la membresía activa de Fontex. El guard usa el perfil correspondiente al método HTTP; un encabezado de lectura no puede eludir las restricciones de escritura y viceversa.

Desde `/#/administracion`, un administrador puede autorizar un correo, ver participantes, revocar acceso y pausar nuevas peticiones de IA. La invitación de registro dura 30 días y se consume al crear la cuenta. La persona invitada debe confirmar su correo conforme a Auth. Autorizar una cuenta ya existente habilita su UUID. El panel no envía correos de invitación: comparte el enlace `/#/crear-cuenta` por tu canal habitual.

La revocación se consulta en servidor en cada petición y no depende de que el usuario cierre sesión o renueve su JWT. La interfaz puede tardar hasta 30 segundos en refrescar su estado; el servidor ya deniega el acceso. No se retira una copia de un archivo descargado previamente.

### Proyecto nuevo sin administrador

En un proyecto vacío no se promueve automáticamente al primer usuario. El operador de base de datos debe autorizar explícitamente su correo:

```sql
insert into fontex_beta.invitations(email) values ('responsable@example.com');
```

Tras registrar y confirmar esa cuenta, el operador puede asignar el rol al UUID verificado:

```sql
insert into fontex_ai.admins(user_id)
select id from auth.users
where lower(email)='responsable@example.com' and email_confirmed_at is not null
on conflict do nothing;
```

Estos ejemplos son tareas del operador, no se ejecutan desde el navegador. La autorización para crear la primera aula sigue su política académica independiente; revisa `private.workspace_bootstrap_authorizations` si el proyecto comienza vacío.

## Límites iniciales

| Control | Valor |
|---|---|
| Chat y construcción por cuenta | 20 solicitudes / hora y 60 / 24 horas móviles, contando ambos modos |
| Concurrencia | Una petición por cuenta y cuatro globales |
| Solicitudes globales | 300 / 24 horas móviles |
| Presupuesto global conservador | 2.000.000 unidades reservadas / 24 horas móviles |
| Contexto de pregunta/escena | 48.000 bytes UTF-8 |
| Payload completo del proveedor | 131.072 bytes UTF-8 |
| Salida máxima | 2.048 tokens en chat; 8.000 en construcción |
| Reserva de uso interrumpida | Libera su plaza al vencer a los 90 segundos |
| Biblioteca de escenas | 100 lienzos / 20 MiB por cuenta; 1 MiB por escena |
| Catálogo de escenas | Páginas de 25; el contenido se obtiene al abrir una escena o cambiar su revisión |
| Multipart PDF | 5 MiB de archivo + 256 KiB de sobre, medidos sobre bytes recibidos |
| Extracción PDF | Máximo 100 páginas; presupuesto de 20 segundos para carga/extracción |

La reserva global usa los bytes del payload completo más el máximo de salida como cota conservadora. No es un tokenizer, una medición de coste monetario ni la cuota del proveedor. Los intentos admitidos siguen contando ante errores para evitar reintentos ilimitados. Finalizar una petición libera concurrencia, sin reiniciar frecuencia o presupuesto. Las reservas de uso son independientes de los cinco créditos de generación y sus reembolsos.

`fontex_beta.runtime_limits` contiene los controles operativos. Solo el operador de base de datos puede cambiar sus valores; el administrador de aplicación puede pausar/reanudar IA mediante RPC. La pausa afecta nuevas solicitudes en los cinco flujos que consultan al proveedor: lienzo, tutor documental, práctica, búsqueda y procesamiento documental. No cancela una llamada ya admitida.

Los tutores académicos conservan además sus cuotas anteriores. El sistema no registra preguntas ni escenas en los eventos de cuota. El proveedor recibe el contexto necesario y se solicita `store:false` donde ya corresponde; la conservación efectiva de terceros debe revisarse por separado.

## Activación en el entorno destino

1. Identificar el proyecto de Supabase y guardar un respaldo recuperable. La política restrictiva cubre las tablas de Fontex en `public` y su bucket de documentos. La tabla ajena `forma_connection_checks` y el esquema `forma` conservan sus propias políticas.
2. Revisar el plan de migraciones del destino. No usar `db reset` sobre el proyecto habitual ni reparar el historial a ciegas. La auditoría detectó un desfase en la base local habitual.
3. Aplicar las migraciones revisadas **antes** de publicar este frontend. Si ya existe otro `pgrst.db_pre_request`, la migración se detiene: el operador debe componer los controles en lugar de sustituir el hook existente. El guard se complementa con RLS para Storage/Realtime, conforme a la [guía de Supabase](https://supabase.com/docs/guides/api/securing-your-api).
4. Desplegar las ocho funciones del repositorio, incluida la respuesta de retirada de `scene-agent`. Mantener JWT habilitado. Desplegar desde la raíz para incluir los imports compartidos de `src/core`.
5. Configurar explícitamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en GitHub Pages, además de la base de la URL. Ya no hay un proyecto piloto usado como respaldo automático.
6. Ejecutar la comprobación de contrato y rutas sin sesión, que no llama al proveedor:

   ```powershell
   node scripts/check-backend-release.mjs
   ```

7. Comprobar con cuentas de prueba invitadas: confirmación, ingreso, recuperación, acceso revocado, lectura privada, créditos, guardado y reapertura, carga/descarga de PDF y una consulta real cuando se autorice su consumo. Registrar el commit y las versiones desplegadas. El script anterior acredita contrato SQL y rutas protegidas, no el código exacto ni la disponibilidad real del proveedor.
8. Verificar SMTP, límites de correo efectivos y URLs de retorno alojadas. `config.toml` no demuestra su aplicación remota. Revisar la cohorte del piloto, la conservación de datos y el responsable de soporte antes de invitar más personas.

El workflow de Pages llama al mismo CI que los pull requests y espera sus tres jobs. Un fallo de SQL o Edge impide publicar. El contrato esperado es `closed-beta-v1`. No hay despliegue automático de funciones ni migraciones desde Pages.

Para volver a una versión previa, conserva un frontend compatible con escenas v2 y estos controles del servidor. No restaures funciones antiguas que vuelvan a permitir consumo sin límite. La base habitual y sus datos no se resetean como mecanismo de retorno.

## Validación y pendientes

Resultado local al cerrar esta intervención:

| Control | Resultado |
|---|---|
| Lint, tipos y compilación | Correctos |
| Vitest (frontend y gate de publicación) | 363 pruebas correctas; 7 integraciones remotas omitidas |
| Handlers y utilidades Deno | 38 pruebas correctas; ocho endpoints comprueban tipos y lint |
| SQL | Base inicial de 19 migraciones probada desde cero; actualización a 21 migraciones y 243 pruebas correctas en 11 suites |
| Asesores SQL, nivel warning/error | Sin incidencias |
| Concurrencia con ocho conexiones reales | Una reserva por cuenta y cuatro globales, sin excederlas |
| Gate de publicación | Casos simulados de backend incompatible, configuración ausente y rutas inseguras rechazados |

Las pruebas locales verifican propiedad/RLS, membresía, registro no invitado, revocación, cuotas, presupuestos, pausa, límites de PDF/HTTP, carreras de aulas y sincronización. También se probaron ocho conexiones PostgreSQL simultáneas: una reserva admitida para la misma cuenta; cuatro para ocho cuentas distintas, respetando el límite global.

La verificación alojada y las limitaciones vigentes se registran en el acta de despliegue. La recuperación duradera de propuestas después de perder la conexión, MFA administrativo con enrolamiento/verificación y telemetría operativa más completa siguen siendo mejoras posteriores; no se consideran implementadas.
