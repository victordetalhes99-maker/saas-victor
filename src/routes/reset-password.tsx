import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/club/Logo";
import { Button } from "@/components/ui/button";
import { KeyRound, Lock, Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Clube Detail" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      toast.success("Senha atualizada.");
      void navigate({ to: "/login", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao atualizar senha.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,oklch(0.10_0.02_200)_0%,oklch(0.13_0.015_250)_45%,oklch(0.16_0.03_170)_100%)]" />
        <div className="absolute left-1/2 top-1/2 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="anim-rise w-full max-w-[440px]">
        <div
          className="relative rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,oklch(1_0_0/0.05),oklch(1_0_0/0.02))] p-7 backdrop-blur-2xl sm:p-9"
          style={{
            boxShadow:
              "0 30px 80px -30px oklch(0 0 0 / 0.7), 0 0 0 1px oklch(1 0 0 / 0.02) inset, 0 0 60px -20px oklch(0.85 0.22 145 / 0.25)",
          }}
        >
          <div className="mb-7 flex items-center justify-between">
            <Logo />
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              <KeyRound className="h-3 w-3" /> Senha
            </span>
          </div>

          <div className="mb-6 space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Definir nova senha
            </h2>
            <p className="text-sm text-muted-foreground">
              Use este formulário após abrir o link de recuperação enviado por e-mail.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <PasswordField
              id="password"
              label="Nova senha"
              value={password}
              onChange={(v) => {
                setPassword(v);
                setError(null);
              }}
              show={showPassword}
              onToggleShow={() => setShowPassword((v) => !v)}
              autoComplete="new-password"
            />
            <PasswordField
              id="confirm"
              label="Confirmar senha"
              value={confirm}
              onChange={(v) => {
                setConfirm(v);
                setError(null);
              }}
              show={showPassword}
              autoComplete="new-password"
            />

            {error && (
              <div className="anim-rise flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy}
              className="group relative h-12 w-full overflow-hidden rounded-xl bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.85_0.22_145/0.6)] transition-all duration-200 hover:brightness-110 active:scale-[0.985]"
            >
              <span className="relative flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Salvar senha
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:text-primary/80">
                Ir para o login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow?: () => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
          <Lock className="h-4 w-4" />
        </span>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
          required
          minLength={6}
          className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-11 text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_oklch(0.85_0.22_145/0.12),0_0_28px_-8px_oklch(0.85_0.22_145/0.5)]"
        />
        {onToggleShow && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}
