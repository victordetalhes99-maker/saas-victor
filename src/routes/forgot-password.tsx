import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/club/Logo";
import { Button } from "@/components/ui/button";
import { checkRateLimit, recordAttempt } from "@/lib/rate-limit.functions";
import { KeyRound, Mail, Loader2, ArrowLeft, ArrowRight, MailCheck } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Recuperar senha — Clube Detail" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      const limit = await checkRateLimit({
        data: { action: "forgot_password", email: normalizedEmail },
      });
      if (!limit.ok) {
        toast.error(limit.message);
        return;
      }

      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });
      void recordAttempt({
        data: { action: "forgot_password", email: normalizedEmail, success: !error },
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao enviar e-mail.");
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

          {sent ? (
            <div className="anim-rise space-y-5 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <MailCheck className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-semibold text-foreground">Verifique seu e-mail</h2>
                <p className="text-sm text-muted-foreground">
                  Se existir uma conta para <span className="text-foreground">{email}</span>,
                  enviamos um link para redefinir a senha.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6 space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Recuperar acesso
                </h2>
                <p className="text-sm text-muted-foreground">
                  Enviaremos um link de redefinição para o seu e-mail.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"
                  >
                    E-mail
                  </label>
                  <div className="group relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@email.com"
                      autoComplete="username"
                      required
                      className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-4 text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_oklch(0.85_0.22_145/0.12),0_0_28px_-8px_oklch(0.85_0.22_145/0.5)]"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="group relative h-12 w-full overflow-hidden rounded-xl bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.85_0.22_145/0.6)] transition-all duration-200 hover:brightness-110 active:scale-[0.985]"
                >
                  <span className="relative flex items-center justify-center gap-2">
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar link
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </span>
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link to="/login" className="font-medium text-primary hover:text-primary/80">
                    Voltar ao login
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
