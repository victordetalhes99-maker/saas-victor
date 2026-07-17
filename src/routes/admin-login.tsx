import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/club/Logo";
import { toast } from "sonner";
import {
  Shield,
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Users,
  CalendarRange,
  Wallet,
  Package,
  Car,
  FileBarChart,
  Activity,
  Check,
  ShieldCheck,
} from "lucide-react";
import { STAFF_ROLES, hasAnyRole } from "@/lib/rbac";

export const Route = createFileRoute("/admin-login")({
  component: AdminLoginPage,
  head: () => ({
    meta: [
      { title: "Painel Administrativo — Clube Detail" },
      { name: "description", content: "Acesso restrito ao painel administrativo do Clube Detail." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
});

const FEATURES = [
  { icon: Users, label: "Gestão de clientes" },
  { icon: CalendarRange, label: "Agenda inteligente" },
  { icon: Wallet, label: "Financeiro" },
  { icon: Package, label: "Assinaturas" },
  { icon: Car, label: "Controle de veículos" },
  { icon: FileBarChart, label: "Relatórios" },
  { icon: Activity, label: "Segurança em tempo real" },
];

function AdminLoginPage() {
  const nav = useNavigate();
  const { user, isAdmin, loading, backendConfigured, backendMessage } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && isAdmin) nav({ to: "/admin", replace: true });
  }, [user, isAdmin, loading, nav]);

  useEffect(() => {
    try {
      const msg = sessionStorage.getItem("admin_login_error");
      if (msg) {
        setError(msg);
        toast.error(msg);
        sessionStorage.removeItem("admin_login_error");
      }
    } catch {
      /* noop */
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!backendConfigured) {
      toast.error(backendMessage ?? "Configuração do backend indisponível.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error || !data.user) throw error ?? new Error("auth");

      const { data: roles, error: roleError } = await (supabase as any).rpc("list_user_roles", {
        _user_id: data.user.id,
      });

      if (roleError) {
        await supabase.auth.signOut();
        throw new Error(roleError.message);
      }

      if (
        !hasAnyRole(
          ((roles ?? []) as Array<{ role: string }>).map((r) => r.role),
          STAFF_ROLES,
        )
      ) {
        await supabase.auth.signOut();
        setError("Esta conta não tem acesso de administrador.");
        toast.error("Esta conta não tem acesso de administrador.");
        return;
      }

      toast.success("Bem-vindo, administrador.");
      nav({ to: "/admin", replace: true });
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "E-mail ou senha inválidos.";
      setError(msg === "auth" ? "E-mail ou senha inválidos." : msg);
      toast.error(msg === "auth" ? "E-mail ou senha inválidos." : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      {/* Background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,oklch(0.10_0.02_200)_0%,oklch(0.13_0.015_250)_45%,oklch(0.16_0.03_170)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_70%_40%,oklch(0.85_0.22_145/0.14),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(50%_45%_at_15%_85%,oklch(0.55_0.15_210/0.12),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1_0_0/0.35) 1px, transparent 1px), linear-gradient(90deg, oklch(1_0_0/0.35) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 85%)",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="grid min-h-screen lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* LEFT — Institutional */}
        <aside className="relative hidden flex-col justify-between border-r border-white/[0.06] bg-[linear-gradient(180deg,oklch(0.14_0.018_220/0.7),oklch(0.11_0.012_250/0.5))] px-10 py-12 backdrop-blur-xl lg:flex xl:px-14">
          <div className="anim-rise anim-rise-1 flex items-center justify-between">
            <Logo />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
              <Lock className="h-3 w-3" /> Área Administrativa
            </span>
          </div>

          <div className="space-y-8">
            <div className="anim-rise anim-rise-2 space-y-4">
              <h1 className="text-display text-4xl leading-[1.05] text-gradient xl:text-5xl">
                Painel Administrativo
              </h1>
              <p className="max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Acesse o centro de gerenciamento do Clube Detail. Controle clientes, assinaturas,
                veículos, pagamentos, relatórios e toda a operação em um único ambiente seguro.
              </p>
            </div>

            <ul className="anim-rise anim-rise-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-foreground/85">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate">{label}</span>
                  <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-primary/70" />
                </li>
              ))}
            </ul>
          </div>

          <div className="anim-rise anim-rise-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  Proteção ativa
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Todos os acessos são autenticados, registrados e protegidos.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT — Form */}
        <section className="relative flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="anim-rise anim-rise-2 w-full max-w-[460px]">
            {/* Card */}
            <div
              className="relative rounded-3xl border border-white/[0.08] bg-[linear-gradient(180deg,oklch(1_0_0/0.05),oklch(1_0_0/0.02))] p-7 backdrop-blur-2xl sm:p-9"
              style={{
                boxShadow:
                  "0 30px 80px -30px oklch(0 0 0 / 0.7), 0 0 0 1px oklch(1 0 0 / 0.02) inset, 0 0 60px -20px oklch(0.85 0.22 145 / 0.25)",
              }}
            >
              {/* Glow ring */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-3xl opacity-60"
                style={{
                  background:
                    "linear-gradient(180deg, oklch(0.85 0.22 145 / 0.25), transparent 40%)",
                  mask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                  WebkitMask: "linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)",
                  padding: 1,
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />

              {/* Header */}
              <div className="mb-7 space-y-4">
                <div className="flex items-center justify-between">
                  <Logo />
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-primary shadow-[0_0_20px_-4px_var(--primary)]">
                    <Shield className="h-3 w-3" /> Admin
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                    Entrar no Painel
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Acesso exclusivo para administradores autorizados.
                  </p>
                </div>
              </div>

              {!backendConfigured && (
                <div className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-100">
                  {backendMessage ?? "Configuração do backend indisponível."}
                </div>
              )}

              <form onSubmit={submit} className="space-y-4">
                <FieldInput
                  id="email"
                  type="email"
                  label="E-mail"
                  icon={Mail}
                  value={email}
                  onChange={(v) => {
                    setEmail(v);
                    setError(null);
                  }}
                  placeholder="admin@seudominio.com"
                  autoComplete="username"
                  required
                />

                <FieldInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  label="Senha"
                  icon={Lock}
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    setError(null);
                  }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />

                {error && (
                  <div className="anim-rise flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={busy || !backendConfigured}
                  className="group relative h-12 w-full overflow-hidden rounded-xl bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] text-[15px] font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.85_0.22_145/0.6),inset_0_1px_0_oklch(1_0_0/0.25)] transition-all duration-200 hover:brightness-110 active:scale-[0.985]"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full bg-[linear-gradient(90deg,transparent,oklch(1_0_0/0.35),transparent)] transition-transform duration-700 group-hover:translate-x-full"
                  />
                  <span className="relative flex items-center justify-center gap-2">
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Autenticando...
                      </>
                    ) : (
                      <>
                        Entrar no painel
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </span>
                </Button>

                <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-muted-foreground/80">
                  <span className="flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-primary/70" /> Ambiente protegido
                  </span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <span>Sessão criptografada</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                  <span>Auth segura</span>
                </div>
              </form>

              <div className="mt-6 border-t border-white/[0.06] pt-5">
                <Link
                  to="/login"
                  className="group flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  Acessar área do cliente
                </Link>
              </div>
            </div>

            {/* Footer */}
            <footer className="mt-6 flex flex-col items-center gap-1 text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50">
              <div className="flex items-center gap-2">
                <span>Clube Detail</span>
                <span className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                <span>v1.0</span>
              </div>
              <div>© 2026 Clube Detail</div>
            </footer>
          </div>
        </section>
      </div>
    </main>
  );
}

function FieldInput({
  id,
  type,
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  trailing,
}: {
  id: string;
  type: string;
  label: string;
  icon: any;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  trailing?: React.ReactNode;
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
          <Icon className="h-4 w-4" />
        </span>
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.03] pl-10 pr-11 text-[15px] text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-200 hover:border-white/[0.14] hover:bg-white/[0.05] focus:border-primary/50 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_oklch(0.85_0.22_145/0.12),0_0_28px_-8px_oklch(0.85_0.22_145/0.5)]"
        />
        {trailing && <div className="absolute right-2 top-1/2 -translate-y-1/2">{trailing}</div>}
      </div>
    </div>
  );
}
