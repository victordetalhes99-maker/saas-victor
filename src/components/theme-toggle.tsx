import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className={"relative rounded-full hover:bg-accent " + (className ?? "")}
    >
      <Sun
        className={
          "h-4 w-4 transition-all duration-300 " +
          (isDark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")
        }
      />
      <Moon
        className={
          "absolute h-4 w-4 transition-all duration-300 " +
          (isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0")
        }
      />
    </Button>
  );
}
