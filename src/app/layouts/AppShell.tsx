import {
  BookOpenText,
  Bot,
  ChevronDown,
  GraduationCap,
  House,
  Menu,
  Settings2,
  UsersRound,
  X,
} from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

import { BrandMark } from "../../components/BrandMark";
import { DemoNotice } from "../../components/feedback/DemoNotice";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

const navigation = [
  { to: "/", label: "Inicio", icon: House, end: true },
  { to: "/aula", label: "Aula", icon: GraduationCap },
  { to: "/grupo", label: "Mi grupo", icon: UsersRound },
  { to: "/biblioteca", label: "Biblioteca", icon: BookOpenText },
  { to: "/tutor", label: "Tutor", icon: Bot },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false,
  );
  const mainContentRef = useRef<HTMLElement>(null);
  const openMenuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationAvailable = isDesktop || mobileOpen;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const updateViewport = (event: MediaQueryListEvent) => setIsDesktop(event.matches);

    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  function openMobileMenu() {
    setMobileOpen(true);
    window.requestAnimationFrame(() => closeMenuButtonRef.current?.focus());
  }

  function closeMobileMenu({ restoreFocus = true } = {}) {
    setMobileOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => openMenuButtonRef.current?.focus());
    }
  }

  function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    mainContentRef.current?.focus();
  }

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <a className="skip-link" href="#contenido-principal" onClick={skipToContent}>
        Saltar al contenido
      </a>

      {mobileOpen && (
        <button
          className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px] lg:hidden"
          aria-label="Cerrar navegación"
          onClick={() => closeMobileMenu()}
        />
      )}

      <aside
        id="navegacion-lateral"
        aria-label="Navegación lateral"
        aria-hidden={!navigationAvailable}
        inert={!navigationAvailable ? true : undefined}
        onKeyDown={(event) => {
          if (event.key === "Escape" && mobileOpen) closeMobileMenu();
        }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[17.5rem] -translate-x-full flex-col border-r border-line bg-[#f8f6f0] px-4 py-5 transition-transform duration-300 lg:translate-x-0",
          mobileOpen && "translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-2">
          <BrandMark />
          <Button
            ref={closeMenuButtonRef}
            className="lg:hidden"
            variant="ghost"
            size="icon"
            aria-label="Cerrar menú"
            onClick={() => closeMobileMenu()}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-white/70 p-3">
          <p className="eyebrow">Aula activa</p>
          <button className="mt-2 flex w-full items-center justify-between text-left">
            <span>
              <strong className="block text-sm">Fundamentos de investigación</strong>
              <span className="mt-0.5 block text-xs text-muted">Ciclo 2026-II</span>
            </span>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </div>

        <nav className="mt-7 space-y-1" aria-label="Navegación principal">
          {navigation.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => closeMobileMenu({ restoreFocus: false })}
              className={({ isActive }) =>
                cn("nav-item", isActive && "nav-item-active")
              }
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <NavLink
            to="/administracion"
            className={({ isActive }) =>
              cn("nav-item", isActive && "nav-item-active")
            }
            onClick={() => closeMobileMenu({ restoreFocus: false })}
          >
            <Settings2 className="size-[18px]" />
            Administración
          </NavLink>
          <div className="flex items-center gap-3 border-t border-line px-2 pt-4">
            <span className="grid size-9 place-items-center rounded-full bg-[#d9e6de] text-xs font-bold text-forest">
              AM
            </span>
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm">Ana Mendoza</strong>
              <span className="block truncate text-xs text-muted">Estudiante</span>
            </span>
            <span className="size-2 rounded-full bg-[#57a276]" title="En línea" />
          </div>
        </div>
      </aside>

      <div className="lg:pl-[17.5rem]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line/80 bg-paper/90 px-4 backdrop-blur-md sm:px-7 lg:px-10">
          <div className="flex items-center gap-3">
            <Button
              ref={openMenuButtonRef}
              className="lg:hidden"
              variant="secondary"
              size="icon"
              aria-label="Abrir menú"
              aria-controls="navegacion-lateral"
              aria-expanded={mobileOpen}
              onClick={openMobileMenu}
            >
              <Menu className="size-5" />
            </Button>
            <div className="lg:hidden">
              <BrandMark />
            </div>
            <div className="hidden lg:block">
              <DemoNotice />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">Fuentes puestas en contexto</span>
            <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
            <span className="status-dot" />
            <span className="text-xs font-semibold">Entorno local</span>
          </div>
        </header>

        <main
          ref={mainContentRef}
          id="contenido-principal"
          tabIndex={-1}
          className="min-h-[calc(100dvh-4rem)] outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
