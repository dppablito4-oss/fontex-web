import { BookOpen, LayoutDashboard, PenTool, ArrowUpRight, LogOut } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "../features/theme/ThemeToggle";
import { useAuth } from "../features/auth/AuthProvider";
import "./product-navigation.css";

type Area = "lienzo" | "aprender" | "espacio";
const areas = [
  { id: "lienzo", href: "#/lienzo", label: "Lienzo", icon: PenTool },
  { id: "aprender", href: "#/demo", label: "Aprender", icon: BookOpen },
  { id: "espacio", href: "#/inicio", label: "Mi espacio", icon: LayoutDashboard },
] as const;
export function ProductLinks({ current }: { current?: Area }) {
  return <nav className="fx-product-links" aria-label="Áreas de Fontex">{areas.map(({ id, href, label, icon: Icon }) => <a key={id} href={href} aria-current={id === current ? "page" : undefined}><Icon size={16} aria-hidden="true" />{label}</a>)}</nav>;
}
export function SiteHeader({ current, onNavigate, onSignOut }: { current?: Area; onNavigate?: () => boolean; onSignOut?: () => Promise<void> }) {
  const { status, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function leaveAccount() {
    if (pending) return;
    setPending(true); setError("");
    try { await (onSignOut ?? signOut)(); }
    catch { setError("No fue posible cerrar sesión. Inténtalo de nuevo."); }
    finally { setPending(false); }
  }
  return <header className="fx-site-header" onClickCapture={event => {
    if ((event.target as HTMLElement).closest("a") && onNavigate && !onNavigate()) event.preventDefault();
  }}>
    <a href="#/" className="fx-home-link" aria-label="Fontex, presentación"><BrandMark /></a>
    <ProductLinks current={current} />
    <div className="fx-site-actions"><ThemeToggle /><a className="fx-account" href={status === "authenticated" ? "#/inicio" : "#/ingresar"}>{status === "authenticated" ? "Mi cuenta" : "Entrar"}<ArrowUpRight size={15} aria-hidden="true" /></a>{status === "authenticated" && <button type="button" className="fx-sign-out" aria-label="Cerrar sesión" title="Cerrar sesión" disabled={pending} onClick={() => void leaveAccount()}><LogOut size={17} aria-hidden="true" /></button>}</div>
    {error && <p className="fx-header-error" role="alert">{error}</p>}
  </header>;
}
