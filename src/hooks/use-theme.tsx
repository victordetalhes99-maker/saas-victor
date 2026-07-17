import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "clube-detail:theme";

type ThemeCtx = {
  theme: ThemeMode;
  resolved: ResolvedTheme;
  setTheme: (t: ThemeMode) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  resolved: "dark",
  setTheme: () => {},
  toggle: () => {},
});

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* noop */
  }
  return "dark";
}

function applyDom(mode: ThemeMode): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  const root = document.documentElement;
  const resolved: ResolvedTheme =
    mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => readStored());
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
  );

  useEffect(() => {
    // Clear the boot flag so transitions can kick in after first paint.
    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        document.documentElement.removeAttribute("data-theme-boot");
      });
    }
  }, []);

  useEffect(() => {
    setResolved(applyDom(theme));
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  // React to OS scheme change only when in system mode.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyDom("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Sync across tabs.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = (e.newValue as ThemeMode) || "dark";
      if (next === "light" || next === "dark" || next === "system") setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggle = useCallback(
    () =>
      setThemeState((prev) => {
        const current: ResolvedTheme =
          prev === "system" ? (systemPrefersDark() ? "dark" : "light") : prev;
        return current === "dark" ? "light" : "dark";
      }),
    [],
  );

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
