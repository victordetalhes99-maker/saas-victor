import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/club/Logo";
import { Button } from "@/components/ui/button";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit.functions";
import { MailCheck, ShieldCheck, Loader2, ArrowRight, RotateCw } from "lucide-react";

const searchSchema = z.object({
  email: z.string().optional(),
});

export const Route = createFileRoute("/confirmar-email")({
  component: ConfirmEmailPage,
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Confirme seu e-mail — Clube Detail" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const RESEND_COOLDOWN = 60;

function ConfirmEmailPage() {
  const { email: emailParam } = useSearch({ from: "/confirmar-email" });
  const navigate = useNavigate();
  const [email] = useState(emailParam ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isCoolingDown = cooldown > 0;
  useEffect(() => {
    if (!isCoolingDown) return;
    timerRef.current = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isCoolingDown]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email) {
      setError("Não sabemos qual e-mail confirmar. Volte e faça o cadastro novamente.");
      return;
    }
    if (code.trim().length !== 6) {
      setError("Digite o código de 6 dígitos que enviamos por e-mail.");
      return;
    }
    setBusy(true);
    try {
      const { data, error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: "signup",
      });
      if (otpError || !data.session) {
        throw otpError ?? new Error("Código inválido ou expirado.");
      }
      toast.success("E-mail confirmado!");
      // O guard da área autenticada decide o próximo passo (aprovação
      // pendente, assinatura pendente, ou dashboard) — só navegamos.
      void navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg =
        err instanceof Error && /expired|invalid/i.test(err.message)
          ? "Código inválido ou expirado. Solicite um novo código."
          : "Não foi possível confirmar. Tente novamente.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!email || cooldown > 0) return;
    setBusy(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const limit = await checkRateLimit({
        data: { action: "email_confirm_resend", email: normalizedEmail },
      });
      if (!limit.ok) {
        toast.error(limit.message);
        return;
      }
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });
      void recordAttempt({
        data: { action: "email_confirm_resend", email: normalizedEmail, success: !resendError },
      });
      // Mensagem sempre genérica — não revela se o e-mail existe ou não.
      toast.success("Caso o endereço informado seja válido, um novo código será enviado.");
      setCooldown(RESEND_COOLDOWN);
    } catch {
      toast.success("Caso o endereço informado seja válido, um novo código será enviado.");
      setCooldown(RESEND_COOLDOWN);
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
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              <ShieldCheck className="h-3 w-3" /> Verificação
            </span>
          </div>

          <div className="mb-6 space-y-2 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
              <MailCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Confirme seu e-mail
            </h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um código de confirmação para o seu e-mail
              {email && (
                <>
                  {" "}
                  <span className="text-foreground">{email}</span>
                </>
              )}
              . Ele expira em 10 minutos.
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="code"
                className="block text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
              >
                Código de 6 dígitos
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                placeholder="000000"
                className="h-14 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] text-center text-2xl font-semibold tracking-[0.5em] text-foreground outline-none transition-all duration-200 placeholder:text-muted-foreground/30 hover:border-white/[0.14] focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_oklch(0.85_0.22_145/0.12)]"
              />
            </div>

            {error && (
              <div className="anim-rise flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={busy || code.length !== 6}
              className="group relative h-12 w-full overflow-hidden rounded-xl bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.85_0.22_145/0.6)] transition-all duration-200 hover:brightness-110 active:scale-[0.985] disabled:opacity-50"
            >
              <span className="relative flex items-center justify-center gap-2">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirmando...
                  </>
                ) : (
                  <>
                    Confirmar e-mail
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </Button>

            <button
              type="button"
              onClick={resend}
              disabled={busy || cooldown > 0}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {cooldown > 0 ? `Reenviar código (${cooldown}s)` : "Reenviar código"}
            </button>

            <p className="text-center text-sm text-muted-foreground">
              <Link to="/login" className="font-medium text-primary hover:text-primary/80">
                Voltar ao login
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
