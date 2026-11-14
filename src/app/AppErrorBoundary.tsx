import { Component, type ReactNode } from "react";
import { useAuth } from "../features/auth/AuthProvider";
class RecoveryBoundary extends Component<
  { children: ReactNode; owner: string },
  { failed: boolean; notice: string }
> {
  state = { failed: false, notice: "" };
  static getDerivedStateFromError() {
    return { failed: true, notice: "" };
  }
  componentDidCatch(error: Error) {
    console.error(
      JSON.stringify({ event: "frontend_render_failed", name: error.name }),
    );
  }
  backup = () => {
    try {
      const raw = localStorage.getItem(
        `fontex-primitives-v2:${this.props.owner}`,
      );
      if (!raw) {
        this.setState({
          notice: "No se encontró una copia local para esta cuenta.",
        });
        return;
      }
      const url = URL.createObjectURL(
          new Blob([raw], { type: "application/json" }),
        ),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "fontex-recuperacion.json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      this.setState({
        notice:
          "No se pudo leer la copia local. Conserva esta pestaña mientras contactas con soporte.",
      });
    }
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="page-wrap space-y-4">
        <h1 className="text-2xl font-bold">No pudimos mostrar esta vista</h1>
        <p>
          Descarga la copia local antes de recargar si necesitas conservar tu
          trabajo.
        </p>
        <button className="text-primary underline" onClick={this.backup}>
          Descargar copia local
        </button>
        <button
          className="ml-4 text-primary underline"
          onClick={() => window.location.reload()}
        >
          Recargar Fontex
        </button>
        {this.state.notice && <p role="status">{this.state.notice}</p>}
      </main>
    );
  }
}
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const owner = user?.id ?? "guest";
  return (
    <RecoveryBoundary key={owner} owner={owner}>{children}</RecoveryBoundary>
  );
}
