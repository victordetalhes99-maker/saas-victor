import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowUpRight,
  Droplets,
  Car,
  History,
  Crown,
  Check,
  PlusCircle,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import carHero from "@/assets/car-hero.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function statusInfo(s?: string) {
  if (s === "active")
    return { label: "Ativo", icon: CheckCircle2, dot: "bg-primary", text: "text-primary" };
  if (s === "expired")
    return { label: "Vencido", icon: AlertCircle, dot: "bg-amber-400", text: "text-amber-300" };
  if (s === "cancelled")
    return {
      label: "Cancelado",
      icon: XCircle,
      dot: "bg-muted-foreground",
      text: "text-muted-foreground",
    };
  return {
    label: "Sem plano",
    icon: AlertCircle,
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  };
}

function greet() {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function Dashboard() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: sub } = useQuery({
    queryKey: ["sub", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*, plans(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: vehicle } = useQuery({
    queryKey: ["primary-vehicle", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id, brand, model, color, plate, image_url")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: nextAppt } = useQuery({
    queryKey: ["nextAppt", user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, estimated_minutes")
        .eq("user_id", user!.id)
        .in("status", ["scheduled", "confirmed", "in_progress"])
        .gte("scheduled_at", today.toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["dashHistory", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("id, scheduled_at, status, vehicles(brand, model, plate)")
        .eq("user_id", user!.id)
        .order("scheduled_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const { data: topPlan } = useQuery({
    queryKey: ["topPlan"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("id, monthly_price")
        .eq("active", true)
        .order("monthly_price", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const total = sub?.plans?.washes_per_month ?? 0;
  const used = sub?.washes_used ?? 0;
  const remaining = Math.max(0, total - used);
  const status = statusInfo(sub?.status);
  const isActive = sub?.status === "active";
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const firstName = profile?.full_name?.trim().split(" ")[0] || "cliente";
  const benefits: string[] = sub?.plans?.benefits ?? [];
  const isTopPlan = !!(isActive && topPlan && sub?.plans?.id === topPlan.id);

  return (
    <div className="space-y-8 pb-8">
      {/* 1. HERO PREMIUM */}
      <header className="anim-rise relative overflow-hidden rounded-3xl border border-white/[0.06] bg-[var(--gradient-hero)] p-6 shadow-[var(--shadow-float)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-[oklch(0.55_0.18_220)]/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground/80">
              {greet()}
            </p>
            <h1 className="text-display mt-1 text-[32px] leading-[1.05] sm:text-[44px]">
              <span className="text-gradient">{firstName}</span>{" "}
              <span className="text-white/70">👋</span>
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
              {isActive
                ? vehicle
                  ? `Seu ${vehicle.brand} ${vehicle.model} está pronto para o próximo cuidado.`
                  : "Bem-vindo ao Clube Detail. Seu veículo está pronto para o próximo cuidado."
                : "Que tal liberar o potencial total do seu carro? Escolha um plano e entre para o Clube."}
            </p>
          </div>
          <Link to="/perfil" aria-label="Meu perfil" className="relative shrink-0">
            <div className="pointer-events-none absolute inset-0 -m-1 rounded-full bg-primary/30 blur-xl" />
            <Avatar className="relative h-14 w-14 ring-2 ring-white/15 ring-offset-2 ring-offset-transparent transition-transform hover:scale-105">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={firstName} />
              <AvatarFallback className="bg-primary/20 text-sm font-semibold text-primary">
                {firstName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
        </div>
      </header>

      {/* 2. GARAGEM DIGITAL */}
      <section className="anim-rise anim-rise-1">
        {vehicle ? (
          <Card className="relative overflow-hidden rounded-3xl border-white/[0.06] p-0 shadow-[var(--shadow-float)]">
            <div className="relative aspect-[16/11] sm:aspect-[16/8]">
              {vehicle.image_url ? (
                <img
                  src={vehicle.image_url}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--gradient-hero)]">
                  <img src={carHero} alt="" className="h-3/5 opacity-30 blur-[1px]" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
              <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />

              {/* Top badge */}
              <div className="absolute inset-x-5 top-5 flex items-start justify-between">
                <span className="text-[10px] uppercase tracking-[0.32em] text-white/60">
                  Garagem · Clube Detail
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/40 px-2.5 py-1 backdrop-blur-md">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${status.dot} ${isActive ? "animate-pulse" : ""}`}
                  />
                  <span
                    className={`text-[10px] font-medium uppercase tracking-wider ${status.text}`}
                  >
                    {status.label}
                  </span>
                </span>
              </div>

              {/* Bottom */}
              <div className="absolute inset-x-5 bottom-5 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                    {vehicle.color || "—"} {sub?.plans?.name ? `· Plano ${sub.plans.name}` : ""}
                  </div>
                  <h2 className="text-display mt-0.5 text-2xl leading-tight text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.6)] sm:text-3xl">
                    {vehicle.brand} <span className="text-white/80">{vehicle.model}</span>
                  </h2>
                </div>
                <div className="rounded-xl border border-white/20 bg-white/[0.08] px-4 py-1.5 font-mono text-[15px] tracking-[0.4em] text-white backdrop-blur-md inline-block">
                  {vehicle.plate}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
              {isActive ? (
                <Link to="/agendar">
                  <Button className="h-12 w-full gap-2 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90">
                    <Calendar className="h-4 w-4" /> Agendar lavagem
                  </Button>
                </Link>
              ) : (
                <Link to="/planos">
                  <Button className="h-12 w-full gap-2 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90">
                    <Crown className="h-4 w-4" /> Escolher plano
                  </Button>
                </Link>
              )}
              <Link to="/veiculos">
                <Button
                  variant="outline"
                  className="h-12 w-full gap-2 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10"
                >
                  <Car className="h-4 w-4" /> Meu veículo
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="glass relative overflow-hidden rounded-3xl p-8 text-center">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              <Car className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-display mt-4 text-2xl">Sua garagem ainda está vazia</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Cadastre seu veículo para desbloquear a experiência completa do Clube Detail.
            </p>
            <Link to="/veiculos" className="mt-5 inline-block">
              <Button className="h-12 gap-2 rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)] hover:bg-primary/90">
                <PlusCircle className="h-4 w-4" /> Cadastrar veículo
              </Button>
            </Link>
          </Card>
        )}
      </section>

      {/* 3. STATUS DO PLANO — só quando ativo */}
      {isActive && (
        <section className="anim-rise anim-rise-2">
          <Card className="relative overflow-hidden rounded-3xl border-white/[0.06] bg-[var(--gradient-hero)] p-6 shadow-[var(--shadow-float)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/25 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                    Membership
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <span className="text-display text-2xl">{sub?.plans?.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Benefícios liberados</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                    Ativo
                  </span>
                </span>
              </div>

              {total > 0 && (
                <div className="mt-5">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-display text-5xl text-gradient">{remaining}</span>
                        <span className="text-sm text-muted-foreground">/ {total}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <Droplets className="h-3 w-3" /> Lavagens disponíveis
                      </div>
                    </div>
                    {sub?.next_due_date && (
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Renova em
                        </div>
                        <div className="text-sm font-medium">
                          {format(new Date(sub.next_due_date), "dd MMM yyyy", { locale: ptBR })}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-[oklch(0.78_0.2_160)] shadow-[var(--shadow-glow-soft)] transition-all duration-700"
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>
              )}

              <Link to="/planos" className="mt-5 inline-block">
                <Button
                  variant="outline"
                  className="h-11 gap-2 rounded-2xl border-white/10 bg-white/5 hover:bg-white/10"
                >
                  Ver plano <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Card>
        </section>
      )}

      {/* 4. PRÓXIMO AGENDAMENTO */}
      <section className="anim-rise anim-rise-3">
        <Card className="glass group relative overflow-hidden rounded-3xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                Próximo atendimento
              </div>
              {nextAppt ? (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="truncate text-base font-semibold tracking-tight">
                      {format(new Date(nextAppt.scheduled_at), "EEEE, dd/MM 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <ApptStatusBadge status={nextAppt.status} />
                    {nextAppt.estimated_minutes != null && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <Clock className="h-3 w-3" /> {nextAppt.estimated_minutes} min
                      </span>
                    )}
                    {vehicle && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        <Car className="h-3 w-3" /> {vehicle.brand} {vehicle.model}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/historico">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full border-white/10 bg-white/5 hover:bg-white/10"
                      >
                        Ver atendimento
                      </Button>
                    </Link>
                    <Link to="/agendar">
                      <Button size="sm" variant="ghost" className="rounded-full">
                        Remarcar
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">Nenhum atendimento agendado.</p>
                  {isActive && (
                    <Link to="/agendar" className="mt-3 inline-block">
                      <Button
                        size="sm"
                        className="h-10 gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <Calendar className="h-4 w-4" /> Agendar agora
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </div>
            {isActive && nextAppt && (
              <Link
                to="/agendar"
                aria-label="Agendar nova lavagem"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-foreground transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[var(--shadow-glow-soft)]"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </Card>
      </section>

      {/* 5. AÇÕES RÁPIDAS */}
      <section className="anim-rise anim-rise-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Ações rápidas
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction to="/agendar" icon={Calendar} label="Agendar lavagem" disabled={!isActive} />
          <QuickAction to="/veiculos" icon={Car} label="Meu veículo" />
          <QuickAction to="/historico" icon={History} label="Histórico" />
        </div>
      </section>

      {/* 6. BENEFÍCIOS DO PLANO */}
      {isActive && benefits.length > 0 && (
        <section className="anim-rise anim-rise-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Benefícios inclusos
            </h3>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Plano {sub?.plans?.name}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="glass flex items-center gap-3 rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Check className="h-4 w-4" />
                </div>
                <span className="text-sm text-foreground/90">{b}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 7. HISTÓRICO */}
      {history && history.length > 0 && (
        <section className="anim-rise anim-rise-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Últimos atendimentos
            </h3>
            <Link to="/historico" className="text-xs text-primary hover:underline">
              Ver histórico completo
            </Link>
          </div>
          <div className="space-y-2">
            {history.map((h: any) => (
              <Card
                key={h.id}
                className="glass flex items-center gap-3 rounded-2xl p-3 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/5 ring-1 ring-white/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {h.vehicles ? `${h.vehicles.brand} ${h.vehicles.model}` : "Lavagem"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(h.scheduled_at), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <ApptStatusBadge status={h.status} />
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* 8. UPGRADE CTA — final da Home */}
      <section className="anim-rise anim-rise-6">
        <Card
          className="relative overflow-hidden rounded-3xl border-white/[0.06] p-5 shadow-[var(--shadow-float)] sm:p-6"
          style={{
            backgroundImage:
              "radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--primary) 22%, transparent) 0%, transparent 55%), radial-gradient(90% 80% at 0% 100%, oklch(0.55 0.18 220 / 0.18) 0%, transparent 60%), linear-gradient(180deg, oklch(0.16 0.02 260) 0%, oklch(0.11 0.02 260) 100%)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />

          {isTopPlan ? (
            <div className="relative flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-display text-lg leading-tight sm:text-xl">
                    Você já possui o plano mais completo
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Aproveite todos os benefícios exclusivos do topo da oferta.
                  </p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                  Plano Máximo
                </span>
              </span>
            </div>
          ) : (
            <div className="relative">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-display text-lg leading-tight sm:text-xl">
                  {isActive ? "Leve seu plano para outro nível" : "Desbloqueie o Clube Detail"}
                </h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  "Mais lavagens todo mês",
                  "Prioridade no agendamento",
                  "Serviços premium exclusivos",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2.5 text-foreground/90">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/20 text-primary ring-1 ring-primary/40">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
              <Link to="/planos" className="mt-5 inline-block">
                <Button
                  className="group relative h-12 gap-2 overflow-hidden rounded-2xl px-6 text-primary-foreground shadow-[var(--shadow-glow-soft)] transition-all hover:shadow-[0_0_32px_-4px_var(--primary)]"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, var(--primary) 0%, oklch(0.78 0.2 160) 100%)",
                  }}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  <Crown className="relative h-4 w-4" />
                  <span className="relative">Fazer Upgrade</span>
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
  disabled,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      className={`glass group relative flex h-full flex-col items-center justify-center gap-3 rounded-2xl p-5 text-center transition-all duration-300 ${
        disabled ? "opacity-50" : "hover:-translate-y-1 hover:shadow-[var(--shadow-glow-soft)]"
      }`}
    >
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -m-2 rounded-full bg-primary/40 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        />
        <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary ring-1 ring-primary/30 transition-transform duration-300 group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-[13px] font-semibold tracking-tight text-foreground/95">{label}</div>
    </div>
  );
  if (disabled) return <div aria-disabled>{content}</div>;
  return <Link to={to}>{content}</Link>;
}

function ApptStatusBadge({ status }: { status: string | null | undefined }) {
  const map: Record<string, { label: string; cls: string }> = {
    scheduled: { label: "Agendado", cls: "border-white/15 bg-white/[0.04] text-muted-foreground" },
    confirmed: { label: "Confirmado", cls: "border-primary/40 bg-primary/15 text-primary" },
    in_progress: {
      label: "Em execução",
      cls: "border-amber-400/40 bg-amber-400/15 text-amber-200",
    },
    completed: {
      label: "Finalizado",
      cls: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    },
    cancelled: { label: "Cancelado", cls: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
  };
  const m = map[status ?? ""] ?? map.scheduled;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
