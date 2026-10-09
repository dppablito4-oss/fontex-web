import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider, useTheme } from "./ThemeProvider";
import { ThemeToggle } from "./ThemeToggle";
import { THEME_STORAGE_KEY } from "./theme";

type MediaController = {
  setDark: (matches: boolean) => void;
};

function useMockSystemTheme(initialDark: boolean): MediaController {
  let matches = initialDark;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
      listeners.add(listener as (event: MediaQueryListEvent) => void),
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) =>
      listeners.delete(listener as (event: MediaQueryListEvent) => void),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return {
    setDark(nextMatches) {
      matches = nextMatches;
      const event = { matches } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggleTheme} type="button">Alternar</button>
    </div>
  );
}

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
  vi.restoreAllMocks();
});

describe("Fontex theme provider", () => {
  it("uses the operating-system preference when no choice is stored", () => {
    useMockSystemTheme(true);
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("gives a stored choice priority over the operating system", () => {
    useMockSystemTheme(true);
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    expect(screen.getByTestId("theme-value")).toHaveTextContent("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("toggles and persists the manual choice across mounts", () => {
    useMockSystemTheme(false);
    const firstRender = render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    fireEvent.click(screen.getByRole("button", { name: "Alternar" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    firstRender.unmount();
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
  });

  it("keeps working when browser storage is unavailable", () => {
    useMockSystemTheme(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked");
    });

    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Alternar" }));

    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("follows system changes while there is no manual choice", () => {
    const system = useMockSystemTheme(false);
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    act(() => system.setDark(true));
    expect(screen.getByTestId("theme-value")).toHaveTextContent("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("exposes an accessible action describing the theme it will activate", () => {
    useMockSystemTheme(false);
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

    const toggle = screen.getByRole("button", { name: "Activar tema oscuro" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Activar tema claro" })).toBeInTheDocument();
  });
});
