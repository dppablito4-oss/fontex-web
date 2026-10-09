import { Moon, Sun } from "lucide-react";

import { Button } from "../../components/ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const activatesLight = theme === "dark";
  const label = activatesLight ? "Activar tema claro" : "Activar tema oscuro";
  const Icon = activatesLight ? Sun : Moon;

  return (
    <Button
      aria-label={label}
      className={className}
      onClick={toggleTheme}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden="true" className="size-[18px]" />
    </Button>
  );
}
