export const THEME_STORAGE_KEY = "fontex-theme";

export type Theme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

export function getSystemTheme(mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")): Theme {
  return mediaQuery.matches ? "dark" : "light";
}

export function readStoredTheme(storage?: Pick<Storage, "getItem">): Theme | null {
  try {
    const storedTheme = (storage ?? window.localStorage).getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

export function writeStoredTheme(
  theme: Theme,
  storage?: Pick<Storage, "setItem">,
) {
  try {
    (storage ?? window.localStorage).setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be disabled or unavailable; the in-memory preference still works.
  }
}

export function applyTheme(theme: Theme, root = document.documentElement) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute("content", theme === "dark" ? "#0B1020" : "#F7F9FC");
}
