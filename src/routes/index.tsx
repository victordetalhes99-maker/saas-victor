import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import hero from "@/assets/car-hero.png";
import { Logo } from "@/components/club/Logo";
import { useAuth } from "@/hooks/use-auth";
import {
  CalendarRange,
  Car,
  Package,
  ShieldCheck,
  Sparkles,
  Check,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Clube Detail — Assinatura de estética automotiva" },
      {
        name: "description",
        content:
          "Lavagem e estética automotiva por assinatura. Agende em segundos, acompanhe seu veículo e nunca mais se preocupe com a agenda.",
      },
    ],
  }),
});

const BENEFITS = [
  { icon: CalendarRange, label: "Agendamento em segundos, sem ligação" },
  { icon: Sparkles, label: "Lavagens e serviços inclusos por assinatura" },
  { icon: Car, label: "Histórico completo do seu veículo" },
  { icon: ShieldCheck, label: "Prioridade na agenda para assinantes" },
];

function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  // Usuários já autenticados vão direto para a área deles.
  // Visitantes sem sessão veem a landing normalmente (nada a redirecionar).
  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  }, [isAdmin, loading, navigate, user]);

  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background text-muted-foreground">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,oklch(0.10_0.02_200)_0%,oklch(0.13_0.015_250)_45%,oklch(0.16_0.03_170)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_75%_10%,oklch(0.85_0.22_145/0.12),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_5%_95%,oklch(0.55_0.15_210/0.10),transparent_70%)]" />
      </div>

      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            to="/cadastro"
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.85_0.22_145/0.5)] transition hover:brightness-110"
          >
            Criar conta
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-16">
        <div className="anim-rise space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" />
            Assinatura de estética automotiva
          </span>
          <h1 className="text-display text-[38px] leading-[1.05] sm:text-[52px]">
            Seu carro sempre impecável, <span className="text-gradient">sem esforço nenhum.</span>
          </h1>
          <p className="max-w-lg text-base text-muted-foreground sm:text-lg">
            Assine o Clube Detail e tenha lavagens e serviços de estética inclusos todo mês, com
            agendamento em segundos e prioridade na agenda.
          </p>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2.5 text-sm text-foreground/85">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              to="/cadastro"
              className="group inline-flex items-center gap-2 rounded-full bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_10px_30px_-10px_oklch(0.85_0.22_145/0.6)] transition hover:brightness-110"
            >
              Assinar agora
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
            >
              Já sou assinante
            </Link>
          </div>

          <p className="flex items-center gap-1.5 pt-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" />
            Cancele quando quiser, sem multa.
          </p>
        </div>

        <div className="anim-rise anim-rise-1 relative">
          <div className="pointer-events-none absolute -inset-6 rounded-[36px] bg-primary/10 blur-3xl" />
          <img
            src={hero}
            alt="Carro detalhado pelo Clube Detail"
            className="relative h-72 w-full rounded-[28px] border border-white/10 object-cover shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] sm:h-96"
          />
        </div>
      </section>

      {/* Plans teaser */}
      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="anim-rise anim-rise-2 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                <Package className="h-3.5 w-3.5" />
                Planos flexíveis
              </span>
              <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
                Escolha o plano que combina com sua rotina
              </h2>
            </div>
            <Link
              to="/cadastro"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
            >
              Ver planos
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-5 py-6 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <span>© 2026 Clube Detail</span>
          <div className="flex gap-4">
            <Link to="/termos" className="hover:text-foreground">
              Termos
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <Link to="/admin-login" className="hover:text-foreground">
              Acesso administrativo
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
