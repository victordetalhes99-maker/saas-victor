import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import hero from "@/assets/car-hero.png";
import { Logo } from "@/components/club/Logo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  CalendarRange,
  Car,
  Package,
  ShieldCheck,
  Sparkles,
  Check,
  ArrowRight,
  History,
  LogIn,
  Crown,
  RefreshCw,
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
  { icon: CalendarRange, label: "Agendamento rápido" },
  { icon: ShieldCheck, label: "Prioridade na agenda" },
  { icon: History, label: "Histórico completo" },
  { icon: Sparkles, label: "Serviços inclusos" },
];

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type PublicPlan = {
  id: string;
  name: string;
  monthly_price: number;
  washes_per_month: number;
  benefits: string[];
};

function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  // Usuários já autenticados vão direto para a área deles.
  // Visitantes sem sessão veem a landing normalmente (nada a redirecionar).
  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  }, [isAdmin, loading, navigate, user]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const {
    data: plansData,
    isLoading: plansLoading,
    isError: plansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["public-home-plans"],
    queryFn: async () => {
      const [plansRes, statsRes] = await Promise.all([
        supabase
          .from("plans")
          .select("id, name, monthly_price, washes_per_month, benefits")
          .eq("active", true)
          .order("monthly_price", { ascending: true })
          .limit(3),
        supabase.rpc("get_public_plan_stats"),
      ]);
      if (plansRes.error) throw plansRes.error;

      const plans = (plansRes.data ?? []) as PublicPlan[];
      const stats = (statsRes.data ?? []) as Array<{
        plan_id: string;
        subscriber_count: number;
      }>;
      const countByPlan = new Map(stats.map((s) => [s.plan_id, Number(s.subscriber_count)]));

      let featuredId: string | null = null;
      let hasRealSignal = false;
      const topCount = Math.max(0, ...plans.map((p) => countByPlan.get(p.id) ?? 0));
      if (topCount > 0) {
        const top = plans.find((p) => (countByPlan.get(p.id) ?? 0) === topCount);
        if (top) {
          featuredId = top.id;
          hasRealSignal = true;
        }
      } else if (plans.length >= 3) {
        featuredId = plans[Math.floor(plans.length / 2)].id;
      }

      return { plans, featuredId, hasRealSignal };
    },
  });

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
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#020303_0%,#050807_68%,#090d0a_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_78%_35%,oklch(0.85_0.22_145/0.14),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_10%_90%,oklch(0.55_0.15_210/0.10),transparent_70%)]" />
      </div>

      {/* Header — transparente no topo, escurece com blur ao rolar */}
      <header
        className={`sticky top-0 z-30 transition-all duration-300 ${
          scrolled
            ? "border-b border-white/[0.06] bg-background/75 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-5 sm:px-8">
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
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto flex min-h-[calc(100svh-76px)] max-w-[1400px] flex-col justify-center gap-10 px-5 pb-16 pt-6 sm:px-8 lg:grid lg:grid-cols-[1.05fr_1.15fr] lg:items-center lg:gap-4">
        <div className="anim-rise relative z-10 space-y-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-3 w-3" />
            Assinatura automotiva premium
          </span>
          <h1 className="text-display leading-[0.92] tracking-[-0.03em] text-[clamp(2.75rem,6vw,5rem)]">
            Seu carro sempre
            <br />
            <span className="text-gradient">impecável.</span>
            <br />
            <span className="text-foreground/90">Sem esforço nenhum.</span>
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            Lavagens, cuidados e prioridade na agenda em uma única assinatura. Você nunca mais
            precisa se preocupar com o estado do seu carro.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link
              to="/cadastro"
              className="group inline-flex h-[54px] items-center gap-2 rounded-full bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] px-7 text-[15px] font-semibold text-primary-foreground shadow-[0_14px_36px_-12px_oklch(0.85_0.22_145/0.55)] transition-all hover:brightness-110 hover:shadow-[0_18px_42px_-10px_oklch(0.85_0.22_145/0.6)] active:scale-[0.98]"
            >
              Ver planos disponíveis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex h-[54px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-7 text-[15px] font-medium text-foreground transition hover:bg-white/[0.06]"
            >
              <LogIn className="h-4 w-4" />
              Já sou assinante
            </Link>
          </div>

          <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" />
            Cancele quando quiser, sem multa.
          </p>

          {/* Faixa de benefícios integrada ao hero */}
          <ul className="flex flex-wrap gap-x-6 gap-y-2 border-t border-white/[0.06] pt-5">
            {BENEFITS.map(({ icon: Icon, label }, i) => (
              <li key={label} className="flex items-center gap-2 text-xs text-foreground/70">
                {i > 0 && (
                  <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" aria-hidden />
                )}
                <Icon className="h-3.5 w-3.5 text-primary/80" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="anim-rise anim-rise-1 relative mx-auto w-full max-w-xl lg:max-w-none">
          {/* Halo/estúdio de luz atrás do carro — só CSS, sem asset novo */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 -z-10 bg-[radial-gradient(50%_50%_at_60%_45%,oklch(0.85_0.22_145/0.18),transparent_65%)] blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-[radial-gradient(60%_100%_at_50%_100%,oklch(0.85_0.22_145/0.12),transparent_75%)]"
          />
          <img
            src={hero}
            alt="Carro detalhado pelo Clube Detail"
            fetchPriority="high"
            loading="eager"
            decoding="async"
            className="relative h-80 w-full rounded-[28px] border border-white/10 object-cover shadow-[0_40px_90px_-30px_rgba(0,0,0,0.75)] sm:h-[26rem] lg:h-[30rem]"
          />

          {/* Microcard flutuante */}
          <div className="anim-rise anim-rise-3 absolute -bottom-5 left-4 hidden max-w-[220px] rounded-2xl border border-white/10 bg-[oklch(0.13_0.012_255/0.9)] p-3.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:block">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">Prioridade na agenda</p>
                <p className="text-[11px] text-muted-foreground">Horários reservados</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Plans showcase — dados reais, continuação natural do hero */}
      <section className="relative mx-auto -mt-4 max-w-[1400px] rounded-t-[32px] border-t border-white/[0.06] bg-white/[0.015] px-5 pb-20 pt-14 sm:px-8 lg:-mt-10">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <Package className="h-3 w-3" />
            Planos flexíveis
          </span>
          <h2 className="text-display mt-3 text-3xl leading-tight sm:text-4xl">
            Escolha o plano que combina com a sua rotina
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Tenha seu carro sempre cuidado com uma assinatura simples, flexível e sem complicação.
          </p>
        </div>

        <div className="mt-10">
          {plansLoading && (
            <div className="grid gap-5 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-[380px] animate-pulse rounded-[26px] bg-white/[0.03]" />
              ))}
            </div>
          )}

          {!plansLoading && plansError && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-[26px] border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Não foi possível carregar os planos agora.
              </p>
              <button
                onClick={() => refetchPlans()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-foreground transition hover:bg-white/[0.06]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </button>
            </div>
          )}

          {!plansLoading && !plansError && (!plansData || plansData.plans.length === 0) && (
            <div className="mx-auto max-w-md rounded-[26px] border border-white/10 bg-white/[0.02] p-10 text-center">
              <p className="text-sm text-muted-foreground">
                Novos planos estarão disponíveis em breve.
              </p>
            </div>
          )}

          {!plansLoading && !plansError && plansData && plansData.plans.length > 0 && (
            <>
              <div
                className={`mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3 ${
                  plansData.plans.length < 3 ? "lg:max-w-3xl" : ""
                }`}
              >
                {plansData.plans.map((plan, i) => {
                  const isFeatured = plan.id === plansData.featuredId;
                  return (
                    <div
                      key={plan.id}
                      className={`anim-rise group relative flex flex-col rounded-[26px] border p-6 transition-all duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 ${
                        isFeatured
                          ? "-translate-y-3 border-primary/35 bg-[linear-gradient(145deg,oklch(1_0_0/0.06),oklch(1_0_0/0.015)_60%,#0b0e0d)] shadow-[0_28px_80px_rgba(0,0,0,0.38),0_0_45px_oklch(0.85_0.22_145/0.08)]"
                          : "border-white/[0.075] bg-[linear-gradient(145deg,oklch(1_0_0/0.045),oklch(1_0_0/0.012)_60%,#0b0e0d)] shadow-[0_24px_60px_rgba(0,0,0,0.28)] hover:border-white/[0.14]"
                      }`}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      {isFeatured && plansData.hasRealSignal && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-[0_8px_20px_-6px_oklch(0.85_0.22_145/0.6)]">
                          Mais escolhido
                        </span>
                      )}
                      <span
                        className={`grid h-10 w-10 place-items-center rounded-xl border ${
                          isFeatured
                            ? "border-primary/30 bg-primary/15 text-primary"
                            : "border-white/10 bg-white/[0.04] text-muted-foreground"
                        }`}
                      >
                        {isFeatured ? (
                          <Crown className="h-4.5 w-4.5" />
                        ) : (
                          <Car className="h-4.5 w-4.5" />
                        )}
                      </span>
                      <h3 className="mt-4 text-lg font-semibold text-foreground">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">
                          {fmtMoney(Number(plan.monthly_price))}
                        </span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {plan.washes_per_month} lavagens por mês
                      </p>

                      {plan.benefits?.length > 0 && (
                        <ul className="mt-5 space-y-2.5 border-t border-white/[0.06] pt-5">
                          {plan.benefits.slice(0, 5).map((b) => (
                            <li
                              key={b}
                              className="flex items-start gap-2 text-sm text-foreground/85"
                            >
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              {b}
                            </li>
                          ))}
                          {plan.benefits.length > 5 && (
                            <li className="text-xs text-muted-foreground">
                              + {plan.benefits.length - 5} benefícios incluídos
                            </li>
                          )}
                        </ul>
                      )}

                      <Link
                        to="/cadastro"
                        onClick={() => {
                          try {
                            localStorage.setItem("clube_detail_intended_plan", plan.id);
                          } catch {
                            // Armazenamento indisponível (modo privado, etc.) — segue sem lembrar a escolha.
                          }
                        }}
                        className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all active:scale-[0.98] ${
                          isFeatured
                            ? "bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] text-primary-foreground shadow-[0_10px_28px_-10px_oklch(0.85_0.22_145/0.55)] hover:brightness-110"
                            : "border border-white/10 bg-white/[0.03] text-foreground hover:bg-white/[0.06]"
                        }`}
                      >
                        Assinar este plano
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 text-center">
                <Link
                  to="/cadastro"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
                >
                  Ver todos os detalhes dos planos
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] px-5 py-6 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-2 sm:flex-row sm:justify-between">
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
