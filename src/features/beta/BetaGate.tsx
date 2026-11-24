import type { ReactNode } from "react";
import { useBetaAccess } from "./useBetaAccess";
import { useAuth } from "../auth/AuthProvider";
export function BetaGate({ children }: { children: ReactNode }) {
  const access = useBetaAccess(), { signOut } = useAuth();
  if (access.status === "allowed" || access.status === "local") return children;
  return (
    <main className="page-wrap space-y-5">
      <h1 className="text-2xl font-bold">Acceso a Fontex</h1>
      <p role="status">
        {access.status === "loading"
          ? "Verificando tu cuenta…"
          : access.status === "denied"
          ? "Esta cuenta todavía no tiene acceso. Confirma tu correo; si ya lo confirmaste, consulta al administrador."
          : "No se pudo verificar tu cuenta. Intenta de nuevo."}
      </p>
      <p>
        Puedes seguir creando con las plantillas y las herramientas locales.
      </p>
      <a className="text-primary underline" href="#/lienzo">
        Continuar al lienzo local
      </a>
      <button
        className="ml-4 text-primary underline"
        onClick={() => void access.refresh()}
      >
        Reintentar acceso
      </button>
      <button
        className="ml-4 text-primary underline"
        onClick={() => {
          void signOut().catch(() => {});
        }}
      >
        Cambiar de cuenta
      </button>
    </main>
  );
}
