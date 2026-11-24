# Administración de cuentas de Fontex

El panel de administración exige una cuenta incluida en `fontex_ai.admins`, acceso activo y segundo factor verificado (AAL2). No confía en los roles enviados en metadatos del usuario. Los administradores están protegidos contra suspensión, bloqueo y eliminación desde este panel.

La tabla permite buscar por nombre o correo y ver saldo, rol y estado. Al seleccionar una cuenta se puede asignar crédito, consultar movimientos y administrar su acceso:

| Acción | Efecto en Fontex |
| --- | --- |
| Suspender | Deniega acceso hasta una fecha. Se levanta automáticamente al vencer el plazo, sin depender de una tarea programada. |
| Bloquear | Deniega acceso hasta que un administrador reactive la cuenta. |
| Reactivar | Retira bloqueo y suspensión, conservando los créditos. No revierte una eliminación terminada. |
| Eliminar de Fontex | Bloquea primero la cuenta y retira PDF de Storage, lienzos (incluidos los enlaces públicos y el archivo antiguo), conversaciones y respuestas personales. Anonimiza el perfil de Fontex. |

Cada operación requiere un motivo y deja un historial privado de administración. Las solicitudes se identifican por UUID para poder reintentar sin duplicar la operación. Las asignaciones de créditos mantienen su historial y su idempotencia existentes.

## Alcance de la eliminación

La identidad de Supabase Auth se comparte con otra aplicación: **no se elimina ni se bloquea globalmente**. Los datos y las sesiones de esa otra aplicación no se modifican. La denegación en Fontex se verifica en el servidor, RLS y Storage, también con un JWT emitido anteriormente. Se conservan la marca de cuenta eliminada y la auditoría mínima de administración, créditos y uso; no se vuelve a emitir el crédito de bienvenida.

Antes de eliminar, el administrador debe escribir el correo de la cuenta. Los espacios personales sin otros participantes se retiran junto al contenido. No se permite eliminar a una persona que aún sea propietaria de aulas, organizaciones o grupos compartidos, o que conserve clases publicadas: esas titularidades deben resolverse primero. También se espera a que termine una generación activa. No se eliminan aulas ni materiales de otras personas para satisfacer una baja.

El borrado de PDF se hace mediante la API de Storage, nunca mediante SQL sobre `storage.objects`. Si falla, la cuenta queda bloqueada y la operación pendiente puede reintentarse. Los metadatos se retiran únicamente después de retirar los archivos. Los escritores de contenido se serializan con el borrado para impedir que una petición atrasada vuelva a crear datos personales. Las copias descargadas y las copias locales del navegador no se retiran de forma remota.

## Despliegue

Aplicar `20261124154306_account_lifecycle_controls.sql`, desplegar `account-admin` con JWT activado y después publicar el frontend. Las funciones internas validan al administrador y AAL2; la finalización del borrado solo está disponible para el servicio, tras la limpieza de Storage. Las pruebas de base de datos usan cuentas sintéticas y rollback; las pruebas del endpoint usan Storage simulado. No requieren borrar cuentas reales ni consultar IA.
