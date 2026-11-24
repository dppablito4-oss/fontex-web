import { SiteHeader } from "../../components/ProductNavigation";
import { Card } from "../../components/ui/card";
export function BetaInfoPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader />
      <main className="page-wrap space-y-6">
        <header>
          <p className="eyebrow">Participantes de Fontex</p>
          <h1 className="mt-2 text-3xl font-bold">
            Ayuda y datos durante la beta
          </h1>
          <p className="mt-3 text-muted-foreground">
            El registro de Fontex está abierto. Guarda una copia de
            los materiales que necesites conservar y cuéntanos si algo falla.
          </p>
        </header>
        <Card className="p-5 sm:p-7 space-y-3">
          <h2 className="text-xl font-semibold">Crear una cuenta</h2>
          <p>
            El lienzo y las plantillas se pueden usar sin cuenta. Para guardar
            en tu cuenta, usar aulas, documentos o IA, crea una cuenta con
            tu correo. No necesitas una invitación.
          </p>
          <p>
            Regístrate y confirma el enlace recibido. Cada cuenta nueva recibe
            5 créditos iniciales de IA. Si tu acceso fue revocado,
            consulta al administrador.
          </p>
          <a className="text-primary underline" href="#/lienzo">
            Abrir el lienzo local
          </a>
        </Card>
        <Card className="p-5 sm:p-7 space-y-3">
          <h2 className="text-xl font-semibold">
            Qué se guarda y qué se envía
          </h2>
          <p>
            Sin cuenta, tus lienzos se guardan en este navegador. Borrar sus
            datos, usar navegación privada o agotar su almacenamiento puede
            impedir recuperarlos.
          </p>
          <p>
            Con una cuenta confirmada, se guardan tu cuenta, perfil, matrícula,
            materiales y conversaciones en los servicios de Fontex. Los lienzos
            de tu cuenta son privados. Los PDF pueden compartirse con grupos o
            aulas cuando autorizas ese acceso.
          </p>
          <p>
            Al consultar IA se envían la pregunta y el contexto necesario al
            proveedor: partes del lienzo, conversación o fragmentos de texto de
            tus documentos. Para indexar un PDF se envía su texto extraído al
            servicio de embeddings. Evita subir información confidencial que no
            necesites para la actividad.
          </p>
          <p>
            Para recuperar una construcción tras una desconexión, se conserva
            una copia privada de su pregunta, escena de partida y propuesta.
            Puedes recuperarla durante siete días, sin repetir el crédito.
            Las copias vencidas se limpian cuando se admiten nuevas construcciones.
            Se conservan hasta cien solicitudes recuperables por cuenta.
          </p>
          <p>
            La interfaz carga tipografías desde Google Fonts. Las condiciones de
            los servicios externos y la configuración de conservación deben
            revisarse antes de ampliar la beta.
          </p>
        </Card>
        <Card className="p-5 sm:p-7 space-y-3">
          <h2 className="text-xl font-semibold">
            Créditos, límites y exactitud
          </h2>
          <p>
            Recibes cinco créditos iniciales, sin renovación automática. Una
            construcción válida completada consume un crédito; las plantillas y
            la edición manual siguen libres. El chat no consume créditos.
          </p>
          <p>
            Chat y construcción comparten límites temporales: hasta 20
            solicitudes por hora y 60 por cada 24 horas, una en curso por
            cuenta. Hay además límites globales y una pausa temporal de IA que
            puede activar el administrador.
          </p>
          <p>
            Tu cuenta admite hasta 100 lienzos y 20 MiB de escenas. Cada PDF
            admite hasta 5 MiB y 100 páginas con texto seleccionable. Las
            respuestas de IA pueden contener errores y los cálculos numéricos
            pueden ser aproximados.
          </p>
        </Card>
        <Card className="p-5 sm:p-7 space-y-3">
          <h2 className="text-xl font-semibold">
            Conservar tu trabajo y reportar problemas
          </h2>
          <p>
            Usa Guardar JSON para descargar una copia antes de borrar un lienzo
            o cerrar una pestaña con un aviso de guardado pendiente. Puedes
            abrir esa copia desde Abrir JSON.
          </p>
          <p>
            Para reportar un problema, indica qué intentabas hacer, los pasos y
            el mensaje recibido. Adjunta materiales solo si decides
            compartirlos. El enlace de contacto no adjunta automáticamente
            documentos ni conversaciones.
          </p>
          <a
            className="text-primary underline"
            href="mailto:pabloclsa87@gmail.com?subject=Incidencia%20beta%20Fontex"
          >
            Reportar un problema
          </a>
          <p>
            Para solicitar la eliminación de tu cuenta o consultar la
            conservación de tus datos, contacta con el administrador por el
            mismo canal.
          </p>
        </Card>
      </main>
    </div>
  );
}
