import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Palette, Moon, Sun, Monitor, Check, Loader2, Save, Cloud } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { updateAppearancePrefs, type AppearancePrefs } from "@/lib/config.functions";

export const Route = createFileRoute("/admin/configuracoes/aparencia")({
  component: AparenciaPage,
});

const KEY = "clube-detail:appearance";
const DEFAULT: AppearancePrefs = { theme: "dark", density: "comfortable", reduceMotion: false };

function loadLocal(): AppearancePrefs {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<AppearancePrefs>) };
  } catch {
    return DEFAULT;
  }
}
function applyPrefs(p: AppearancePrefs) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    p.theme === "dark" ||
    (p.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
  root.dataset.density = p.density;
  root.dataset.reduceMotion = p.reduceMotion ? "true" : "false";
}

function AparenciaPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const save = useServerFn(updateAppearancePrefs);
  const [prefs, setPrefs] = useState<AppearancePrefs>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { data: remote, isLoading } = useQuery({
    enabled: !!user,
    queryKey: ["appearance-prefs", user?.id],
    queryFn: async (): Promise<AppearancePrefs> => {
      if (!user) return DEFAULT;
      const { data } = await supabase
        .from("profiles")
        .select("appearance_prefs")
        .eq("id", user.id)
        .maybeSingle();
      const raw = (data?.appearance_prefs ?? {}) as Partial<AppearancePrefs>;
      return { ...DEFAULT, ...raw };
    },
  });

  // First mount: hydrate from local then override with remote when available.
  useEffect(() => {
    const local = loadLocal();
    setPrefs(local);
    applyPrefs(local);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !remote) return;
    setPrefs(remote);
    localStorage.setItem(KEY, JSON.stringify(remote));
    applyPrefs(remote);
  }, [remote, mounted]);

  const update = (patch: Partial<AppearancePrefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      applyPrefs(next);
      return next;
    });
  };

  const persist = async () => {
    if (!user) {
      toast.error("Sessão inválida.");
      return;
    }
    setSaving(true);
    try {
      await save({ data: prefs });
      toast.success("Aparência sincronizada nos seus dispositivos.");
      qc.invalidateQueries({ queryKey: ["appearance-prefs", user.id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar.");
    } finally {
      setSaving(false);
    }
  };

  const themes: {
    v: AppearancePrefs["theme"];
    label: string;
    icon: typeof Sun;
    description: string;
  }[] = [
    { v: "dark", label: "Escuro", icon: Moon, description: "Padrão premium." },
    { v: "light", label: "Claro", icon: Sun, description: "Alta luminosidade." },
    { v: "system", label: "Sistema", icon: Monitor, description: "Segue o dispositivo." },
  ];

  const dirty = JSON.stringify(prefs) !== JSON.stringify(remote ?? DEFAULT);

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
            <Palette className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Aparência</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aplicada imediatamente neste dispositivo. Sincronize para usar as mesmas preferências
              em outros aparelhos.
            </p>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tema
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {themes.map((t) => {
                const active = prefs.theme === t.v;
                return (
                  <button
                    key={t.v}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ theme: t.v })}
                    className={`relative flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-primary/40 bg-primary/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${active ? "border-primary/40 bg-primary/20 text-primary" : "border-white/10 bg-white/[0.03] text-muted-foreground"}`}
                    >
                      <t.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">{t.label}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {t.description}
                      </div>
                    </div>
                    {active && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Cor principal
            </p>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <div className="h-8 w-8 rounded-lg bg-primary shadow-[0_0_18px_-2px_var(--primary)]" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Verde Clube Detail</p>
                <p className="text-[11px] text-muted-foreground">
                  Cor da marca — personalização abrirá em versões futuras.
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Densidade
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["comfortable", "compact"] as const).map((d) => {
                const active = prefs.density === d;
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={active}
                    onClick={() => update({ density: d })}
                    className={`rounded-2xl border p-4 text-left transition ${active ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                  >
                    <div className="text-sm font-medium">
                      {d === "comfortable" ? "Confortável" : "Compacta"}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {d === "comfortable"
                        ? "Espaçamento generoso, ideal para telas grandes."
                        : "Mais informação por tela, ideal para operação."}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div>
              <p className="text-sm font-medium">Reduzir animações</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Desativa transições e movimentos suaves.
              </p>
            </div>
            <Switch
              checked={prefs.reduceMotion}
              onCheckedChange={(v) => update({ reduceMotion: v })}
            />
          </div>
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/80 p-3 backdrop-blur-xl">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Cloud className="h-3.5 w-3.5" />
          {dirty
            ? "Alterações aplicadas neste dispositivo — sincronize para os demais."
            : "Sincronizado com sua conta."}
        </p>
        <Button
          onClick={persist}
          disabled={!dirty || saving}
          className="rounded-full bg-primary text-primary-foreground"
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Sincronizar
        </Button>
      </div>
    </div>
  );
}
