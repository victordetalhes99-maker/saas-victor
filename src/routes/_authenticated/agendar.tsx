import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  endOfMonth,
  format,
  isSameDay,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createClientAppointment } from "@/lib/appointments.functions";
import { toast } from "sonner";
import { MonthCalendar, type DayMeta } from "@/components/club/MonthCalendar";
import { Check, Clock, AlertCircle, Sparkles, Plus, ArrowRight, X, Crown, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/agendar")({
  component: Agendar,
});

const HOURS = [9, 10, 11, 13, 14, 15, 16, 17];

type ExtraService = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  benefits: string[];
  price_cents: number;
  duration_minutes: number;
  sort_order: number;
};

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDuration = (min: number) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

function Agendar() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [day, setDay] = useState<Date>(startOfDay(addDays(new Date(), 1)));
  const [picked, setPicked] = useState<Date | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());
  const [booking, setBooking] = useState(false);

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => startOfDay(addDays(new Date(), i + 1))),
    [],
  );

  const { data: sub } = useQuery({
    queryKey: ["sub-active", user?.id],
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

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles", user?.id],
    queryFn: async () =>
      (await supabase.from("vehicles").select("*").eq("user_id", user!.id)).data ?? [],
  });

  const { data: extras } = useQuery({
    queryKey: ["extra-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("extra_services")
        .select("id, slug, name, description, benefits, price_cents, duration_minutes, sort_order")
        .eq("active", true)
        .order("sort_order", { ascending: true });
      return (data ?? []) as ExtraService[];
    },
  });

  const { data: allPlans } = useQuery({
    queryKey: ["plans-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("id, name, benefits, monthly_price, washes_per_month")
        .eq("active", true)
        .order("monthly_price");
      return data ?? [];
    },
  });

  const monthKey = `${day.getFullYear()}-${day.getMonth()}`;
  const { data: monthBusy } = useQuery({
    queryKey: ["month-busy", monthKey],
    queryFn: async () => {
      const start = startOfMonth(day).toISOString();
      const end = endOfMonth(day).toISOString();
      const [appts, blocks] = await Promise.all([
        supabase.rpc("get_taken_slots", { _start: start, _end: end }),
        supabase
          .from("blocked_slots")
          .select("blocked_at")
          .gte("blocked_at", start)
          .lte("blocked_at", end),
      ]);
      const slots = new Set<string>();
      const blocked = new Set<string>();
      (appts.data as { scheduled_at: string }[] | null)?.forEach((a) =>
        slots.add(new Date(a.scheduled_at).toISOString()),
      );
      blocks.data?.forEach((b) => {
        const iso = new Date(b.blocked_at).toISOString();
        slots.add(iso);
        blocked.add(iso);
      });
      return { slots, blocked };
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("client-agenda-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        void qc.invalidateQueries({ queryKey: ["month-busy", monthKey] });
        void qc.invalidateQueries({ queryKey: ["sub-active", user?.id] });
        void qc.invalidateQueries({ queryKey: ["vehicles", user?.id] });
        void qc.invalidateQueries({ queryKey: ["extra-services"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_slots" }, () => {
        void qc.invalidateQueries({ queryKey: ["month-busy", monthKey] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [monthKey, qc, user?.id]);

  const taken = monthBusy?.slots;

  const getDayMeta = (d: Date): DayMeta => {
    if (!monthBusy) return {};
    let used = 0;
    let blocked = false;
    for (const h of HOURS) {
      const iso = setMinutes(setHours(d, h), 0).toISOString();
      if (monthBusy.slots.has(iso)) used += 1;
      if (monthBusy.blocked.has(iso)) blocked = true;
    }
    return {
      available: used > 0 && used < HOURS.length,
      full: used >= HOURS.length,
      blocked,
      count: used,
    };
  };

  const remaining = (sub?.plans?.washes_per_month ?? 0) - (sub?.washes_used ?? 0);
  const canBook = sub?.status === "active" && remaining > 0;

  const planDuration =
    (sub?.plans as { default_duration_minutes?: number } | null)?.default_duration_minutes ?? 30;
  const currentPlanBenefits: string[] = (sub?.plans?.benefits as string[] | null) ?? [];
  const selectedExtrasList = (extras ?? []).filter((e) => selectedExtras.has(e.id));
  const availableExtras = (extras ?? []).filter((e) => !selectedExtras.has(e.id));
  const extrasTotalCents = selectedExtrasList.reduce((s, e) => s + e.price_cents, 0);
  const extrasMinutes = selectedExtrasList.reduce((s, e) => s + e.duration_minutes, 0);
  const totalMinutes = planDuration + extrasMinutes;

  const currentPlanPrice = Number(sub?.plans?.monthly_price ?? 0);
  const higherPlan = (allPlans ?? []).find(
    (p) =>
      Number(p.monthly_price) > currentPlanPrice &&
      extrasTotalCents / 100 >= Number(p.monthly_price) * 0.6,
  );

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const book = async () => {
    if (!picked || !sub || booking) return;
    if (!canBook) {
      toast.error("Plano inativo ou sem lavagens restantes.");
      return;
    }

    setBooking(true);
    try {
      await createClientAppointment({
        data: {
          scheduledAt: picked.toISOString(),
          vehicleId: vehicles?.[0]?.id ?? null,
          extraServiceIds: selectedExtrasList.map((extra) => extra.id),
        },
      });

      toast.success("Agendamento confirmado!");
      await qc.invalidateQueries();
      void nav({ to: "/dashboard" });
    } catch (error) {
      if (error instanceof Response) {
        const payload = (await error.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        const isSlotTaken = error.status === 409 || payload?.error === "slot_conflict";
        toast.error(
          payload?.message ??
            (isSlotTaken ? "Este horÃ¡rio nÃ£o estÃ¡ mais disponÃ­vel." : "Erro ao agendar."),
        );
        if (isSlotTaken) {
          setPicked(null);
          await qc.invalidateQueries({ queryKey: ["month-busy", monthKey] });
        }
        return;
      }

      toast.error(error instanceof Error ? error.message : "Erro ao agendar.");
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="space-y-6 pb-40">
      <header className="anim-rise pt-4">
        <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80">Reservar</p>
        <h1 className="text-display mt-1 text-[34px] leading-[1.05] sm:text-[42px] text-gradient">
          Agendar lavagem
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {sub
            ? `${sub.plans?.name} Â· ${remaining} lavagem(ns) restantes`
            : "VocÃª ainda nÃ£o tem um plano ativo."}
        </p>
      </header>

      {!canBook && (
        <div className="anim-rise anim-rise-1 glass rounded-2xl border-destructive/30 p-4 text-sm text-destructive">
          {sub?.status !== "active"
            ? "Sua assinatura nÃ£o estÃ¡ ativa. Procure o admin ou renove o plano."
            : "VocÃª usou todas as lavagens do mÃªs."}
        </div>
      )}

      <Card className="anim-rise anim-rise-1 glass relative overflow-hidden rounded-3xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Escolha o dia
          </div>
        </div>
        <div className="mb-4">
          <MonthCalendar
            selected={day}
            onSelect={(d) => {
              setDay(d);
              setPicked(null);
            }}
            getMeta={getDayMeta}
            minDate={startOfDay(addDays(new Date(), 1))}
          />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {days.map((d) => {
            const active = isSameDay(d, day);
            return (
              <button
                key={d.toISOString()}
                onClick={() => {
                  setDay(d);
                  setPicked(null);
                }}
                className={`relative flex min-w-[64px] flex-col items-center gap-0.5 rounded-2xl px-3 py-2.5 text-xs transition-all duration-300 active:scale-[0.97] ${active ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]" : "border border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"}`}
              >
                <span className="text-[9px] font-medium uppercase tracking-wider opacity-80">
                  {format(d, "EEE", { locale: ptBR })}
                </span>
                <span className="text-display text-xl">{format(d, "dd")}</span>
                <span className="text-[9px] uppercase tracking-wider opacity-70">
                  {format(d, "MMM", { locale: ptBR })}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="anim-rise anim-rise-2 glass relative overflow-hidden rounded-3xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            HorÃ¡rios disponÃ­veis
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {format(day, "EEEE, dd MMM", { locale: ptBR })}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {HOURS.map((h) => {
            const slot = setMinutes(setHours(day, h), 0);
            const isTaken = taken?.has(slot.toISOString());
            const isPicked = picked && picked.getTime() === slot.getTime();
            return (
              <button
                key={h}
                disabled={!!isTaken}
                onClick={() => setPicked(slot)}
                className={`group relative overflow-hidden rounded-2xl py-4 text-sm font-medium tracking-tight transition-all duration-300 active:scale-[0.97] ${isTaken ? "cursor-not-allowed border border-white/5 bg-white/[0.02] text-muted-foreground/40 line-through" : isPicked ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]" : "border border-white/8 bg-white/[0.03] text-foreground hover:bg-white/[0.07]"}`}
              >
                <span className="relative z-10">{String(h).padStart(2, "0")}:00</span>
              </button>
            );
          })}
        </div>
      </Card>

      {selectedExtrasList.length > 0 && (
        <Card className="anim-rise glass relative overflow-hidden rounded-3xl border-primary/30 p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-primary">
                  Extras escolhidos
                </span>
              </div>
              <h2 className="mt-1 text-base font-semibold tracking-tight">
                {selectedExtrasList.length} adicionado{selectedExtrasList.length > 1 ? "s" : ""}
              </h2>
            </div>
          </div>
          <div className="space-y-2">
            {selectedExtrasList.map((e) => (
              <div
                key={e.id}
                className="anim-rise flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/[0.08] p-3"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]">
                  <Check className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {e.price_cents > 0 ? `+ ${fmtBRL(e.price_cents)}` : "PreÃ§o a definir"}
                    {e.duration_minutes ? ` Â· +${e.duration_minutes} min` : ""}
                  </div>
                </div>
                <button
                  onClick={() => toggleExtra(e.id)}
                  aria-label="Remover"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {availableExtras.length > 0 && (
        <Card className="anim-rise anim-rise-2 glass relative overflow-hidden rounded-3xl px-5 py-2">
          <Accordion type="single" collapsible>
            <AccordionItem value="extras" className="border-b-0">
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="text-left">
                  <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
                    Opcional
                  </div>
                  <h2 className="mt-1 text-base font-semibold tracking-tight">
                    Adicionar serviÃ§os
                    <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                      ({availableExtras.length} disponÃ­veis)
                    </span>
                  </h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
                  {availableExtras.map((e) => (
                    <div
                      key={e.id}
                      className="group flex flex-col justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-all duration-300 hover:border-white/15 hover:bg-white/[0.05]"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold tracking-tight">{e.name}</div>
                          <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                            {e.price_cents > 0 ? fmtBRL(e.price_cents) : "sob consulta"}
                          </div>
                        </div>
                        {e.description && (
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
                            {e.description}
                          </p>
                        )}
                        {e.benefits?.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {e.benefits.slice(0, 2).map((b, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-1.5 text-[11.5px] text-foreground/75"
                              >
                                <Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground/80">
                          {e.duration_minutes ? `+${e.duration_minutes} min` : ""}
                        </span>
                        <button
                          onClick={() => toggleExtra(e.id)}
                          className="group/btn inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/15 hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5 transition-transform group-hover/btn:rotate-90" />
                          Adicionar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {(currentPlanBenefits.length > 0 || selectedExtrasList.length > 0) && (
        <Card className="anim-rise anim-rise-3 glass rounded-3xl p-5">
          <div className="mb-4 text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
            Resumo do atendimento
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
              <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Seu plano inclui
              </div>
              <ul className="space-y-1.5">
                {(currentPlanBenefits.length ? currentPlanBenefits : ["Lavagem completa"]).map(
                  (b, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13px] text-foreground/85">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>{b}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary">
                <Sparkles className="h-3 w-3" /> Extras adicionados
              </div>
              {selectedExtrasList.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">Nenhum extra selecionado ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {selectedExtrasList.map((e) => (
                    <li
                      key={e.id}
                      className="flex items-start justify-between gap-2 text-[13px] text-foreground/90"
                    >
                      <span className="flex items-start gap-2">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        {e.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        +{e.duration_minutes}min Â· {fmtBRL(e.price_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Plano
              </div>
              <div className="mt-0.5 text-sm font-semibold">Incluso</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Extras
              </div>
              <div className="mt-0.5 text-sm font-semibold">{fmtBRL(extrasTotalCents)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Tempo
              </div>
              <div className="mt-0.5 text-sm font-semibold">{fmtDuration(totalMinutes)}</div>
            </div>
          </div>
        </Card>
      )}

      {higherPlan && (
        <Card className="anim-rise relative overflow-hidden rounded-3xl border-primary/40 bg-[linear-gradient(135deg,oklch(0.22_0.03_155),oklch(0.18_0.02_150))] p-5">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
              <Crown className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-primary/90">
                VocÃª pode economizar
              </div>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">
                Migre para o plano {higherPlan.name}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                Os adicionais escolhidos jÃ¡ representam um valor prÃ³ximo do plano{" "}
                {higherPlan.name}. Com ele, muitos benefÃ­cios estÃ£o inclusos:
              </p>
              <ul className="mt-2 space-y-1">
                {((higherPlan.benefits as string[] | null) ?? []).slice(0, 4).map((b, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-foreground/80">
                    <Zap className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/planos"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/15 px-3.5 py-2 text-[12.5px] font-medium text-primary transition hover:bg-primary/25"
              >
                Conhecer plano {higherPlan.name} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      )}

      {picked && (
        <div className="anim-rise glass flex items-start gap-2 rounded-2xl border-white/10 p-3 text-[12px] text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            TolerÃ¢ncia de <strong className="text-foreground">15 minutos</strong> apÃ³s o horÃ¡rio
            marcado. ApÃ³s esse tempo o agendamento poderÃ¡ ser cancelado pela equipe.
          </p>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-[oklch(0.13_0.01_155/0.85)] backdrop-blur-xl md:left-64">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="hidden flex-1 grid-cols-4 gap-3 sm:grid">
              <SummaryCell label="Plano" value={sub?.plans?.name ?? "â€”"} />
              <SummaryCell
                label="Extras"
                value={`${selectedExtrasList.length} selecionado${selectedExtrasList.length === 1 ? "" : "s"}`}
              />
              <SummaryCell label="Tempo total" value={fmtDuration(totalMinutes)} />
              <SummaryCell label="Valor adicional" value={fmtBRL(extrasTotalCents)} highlight />
            </div>
            <div className="flex flex-1 items-center justify-between gap-3 sm:hidden">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Total extras
                </div>
                <div className="text-sm font-semibold">
                  {fmtBRL(extrasTotalCents)} Â· {fmtDuration(totalMinutes)}
                </div>
              </div>
            </div>
            <Button
              onClick={book}
              disabled={!picked || !canBook || booking}
              className="h-12 shrink-0 rounded-2xl bg-primary px-5 text-sm font-semibold tracking-tight text-primary-foreground shadow-[var(--shadow-glow-soft)] transition-all duration-300 hover:bg-primary/90 disabled:opacity-40 disabled:shadow-none"
            >
              {booking ? (
                <span className="inline-flex items-center gap-2">
                  <Clock className="h-4 w-4 animate-spin" /> Reservando...
                </span>
              ) : picked ? (
                <span className="inline-flex items-center gap-2">
                  Continuar agendamento <ArrowRight className="h-4 w-4" />
                </span>
              ) : (
                "Selecione um horÃ¡rio"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div
        className={`mt-0.5 truncate text-sm font-semibold tracking-tight ${highlight ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
