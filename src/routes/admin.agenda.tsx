import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  format,
  startOfDay,
  endOfDay,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  isAfter,
  isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Ban,
  CalendarRange,
  CheckCircle2,
  Clock3,
  RefreshCw,
  RotateCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/agenda")({
  component: AgendaPage,
});

type Appointment = {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  subscription_id: string | null;
  scheduled_at: string;
  status: string;
  notes: string | null;
  profile?: { full_name: string; email: string | null; phone: string | null } | null;
  vehicle?: { brand: string; model: string; plate: string; color: string | null } | null;
};

type RangeKey = "today" | "tomorrow" | "week" | "month" | "upcoming" | "past" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "tomorrow", label: "Amanhã" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mês" },
  { key: "upcoming", label: "Próximos" },
  { key: "past", label: "Histórico" },
  { key: "all", label: "Todos" },
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  scheduled: { label: "Agendado", cls: "border-primary/30 bg-primary/10 text-primary" },
  completed: {
    label: "Concluído",
    cls: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  },
  cancelled: { label: "Cancelado", cls: "border-rose-400/25 bg-rose-400/10 text-rose-200" },
  no_show: { label: "Não compareceu", cls: "border-amber-400/25 bg-amber-400/10 text-amber-200" },
};

function statusBadge(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status,
      cls: "border-white/10 bg-white/[0.03] text-muted-foreground",
    }
  );
}

function toLocalDateTimeValue(dateIso: string) {
  const d = new Date(dateIso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AgendaPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<RangeKey>("today");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [blockDialog, setBlockDialog] = useState(false);

  const agendaQuery = useQuery({
    queryKey: ["admin-agenda-all"],
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, user_id, vehicle_id, subscription_id, scheduled_at, status, notes")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;

      const list = (data ?? []) as Appointment[];
      const userIds = [...new Set(list.map((a) => a.user_id).filter(Boolean))];
      const vehicleIds = [...new Set(list.map((a) => a.vehicle_id).filter(Boolean))] as string[];

      const [profilesRes, vehiclesRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        vehicleIds.length
          ? supabase.from("vehicles").select("id, brand, model, plate, color").in("id", vehicleIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (vehiclesRes.error) throw vehiclesRes.error;

      const profiles = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const vehicles = new Map((vehiclesRes.data ?? []).map((v: any) => [v.id, v]));

      return list.map((a) => ({
        ...a,
        profile: profiles.get(a.user_id) ?? null,
        vehicle: a.vehicle_id ? (vehicles.get(a.vehicle_id) ?? null) : null,
      }));
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-agenda-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "appointments" }, () => {
        invalidate();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "blocked_slots" }, () => {
        invalidate();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const all = agendaQuery.data ?? [];

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekStart = startOfWeek(now, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const inRange = (iso: string): boolean => {
    const d = new Date(iso);
    switch (range) {
      case "today":
        return d >= todayStart && d <= todayEnd;
      case "tomorrow":
        return d >= tomorrowStart && d <= tomorrowEnd;
      case "week":
        return d >= weekStart && d <= weekEnd;
      case "month":
        return d >= monthStart && d <= monthEnd;
      case "upcoming":
        return isAfter(d, now);
      case "past":
        return isBefore(d, todayStart);
      case "all":
      default:
        return true;
    }
  };

  const filtered = all.filter((a) => {
    if (!inRange(a.scheduled_at)) return false;
    if (status !== "all" && a.status !== status) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const hay = [
        a.profile?.full_name,
        a.profile?.email,
        a.profile?.phone,
        a.vehicle?.plate,
        a.vehicle?.brand,
        a.vehicle?.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // KPIs
  const kpis = useMemo(() => {
    const isActive = (a: Appointment) => a.status !== "cancelled";
    const today = all.filter((a) => isActive(a) && isSameDay(new Date(a.scheduled_at), now)).length;
    const tomorrow = all.filter(
      (a) => isActive(a) && isSameDay(new Date(a.scheduled_at), addDays(now, 1)),
    ).length;
    const week = all.filter((a) => {
      const d = new Date(a.scheduled_at);
      return isActive(a) && d >= weekStart && d <= weekEnd;
    }).length;
    const month = all.filter((a) => {
      const d = new Date(a.scheduled_at);
      return isActive(a) && d >= monthStart && d <= monthEnd;
    }).length;
    return { today, tomorrow, week, month };
  }, [all]);

  // Group filtered by day
  const groups = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of filtered) {
      const key = format(new Date(a.scheduled_at), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(a);
      map.set(key, arr);
    }
    const entries = [...map.entries()].sort(([a], [b]) =>
      range === "past" ? b.localeCompare(a) : a.localeCompare(b),
    );
    return entries;
  }, [filtered, range]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-agenda-all"] });

  const friendlyApptError = (err: { code?: string; message?: string } | null) => {
    if (!err) return "Erro desconhecido.";
    if (err.code === "23505") return "Já existe um agendamento ativo neste horário.";
    if (err.message?.includes("Horário bloqueado")) return "Horário bloqueado pelo administrador.";
    return err.message ?? "Erro ao atualizar agendamento.";
  };

  const setApptStatus = async (id: string, st: "completed" | "cancelled" | "scheduled") => {
    const { error } = await supabase.from("appointments").update({ status: st }).eq("id", id);
    if (error) return toast.error(friendlyApptError(error));
    toast.success(
      st === "completed"
        ? "Lavagem concluída"
        : st === "cancelled"
          ? "Agendamento cancelado"
          : "Reativado",
    );
    setSelectedAppt(null);
    invalidate();
  };

  const moveAppointment = async (id: string, value: string) => {
    if (!value) return toast.error("Escolha uma nova data e horário.");
    const newDate = new Date(value);
    if (isNaN(newDate.getTime())) return toast.error("Data/hora inválida.");
    if (newDate.getTime() < Date.now() - 60_000)
      return toast.error("Não é possível remarcar para o passado.");
    const { error } = await supabase
      .from("appointments")
      .update({ scheduled_at: newDate.toISOString(), status: "scheduled" })
      .eq("id", id);
    if (error) return toast.error(friendlyApptError(error));
    toast.success("Agendamento remarcado");
    setSelectedAppt(null);
    invalidate();
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
            Operação · Agendamentos
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos os agendamentos dos clientes em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-full border-white/10 bg-white/[0.03]"
            onClick={() => agendaQuery.refetch()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" /> Atualizar
          </Button>
          <BlockSlotDialog open={blockDialog} onOpenChange={setBlockDialog} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <KpiCard label="Hoje" value={kpis.today} accent="primary" />
        <KpiCard label="Amanhã" value={kpis.tomorrow} accent="emerald" />
        <KpiCard label="Esta semana" value={kpis.week} accent="violet" />
        <KpiCard label="Este mês" value={kpis.month} accent="amber" />
      </div>

      {/* Filters */}
      <Card className="rounded-[24px] border-white/10 bg-card p-3.5 space-y-3">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium tracking-wide transition-all ${
                  active
                    ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow-soft)]"
                    : "border border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, telefone, placa, modelo..."
              className="h-10 rounded-2xl border-white/10 bg-white/[0.03] pl-9"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {[
              { k: "all", l: "Todos" },
              { k: "scheduled", l: "Agendados" },
              { k: "completed", l: "Concluídos" },
              { k: "cancelled", l: "Cancelados" },
            ].map((o) => {
              const active = status === o.k;
              return (
                <button
                  key={o.k}
                  onClick={() => setStatus(o.k)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-all ${
                    active
                      ? "border border-primary/40 bg-primary/15 text-primary"
                      : "border border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.l}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {agendaQuery.isError && (
        <Alert className="rounded-[22px] border-rose-400/25 bg-rose-400/[0.06] text-rose-100">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar a agenda</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{agendaQuery.error.message}</span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-white/10 bg-white/[0.04]"
              onClick={() => agendaQuery.refetch()}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {agendaQuery.isLoading ? (
        <ListSkeleton />
      ) : groups.length === 0 ? (
        <Card className="rounded-[24px] border-white/10 bg-white/[0.02] p-10 text-center">
          <CalendarRange className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Nenhum agendamento encontrado para este filtro.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(([dayKey, items]) => {
            const dayDate = new Date(dayKey + "T12:00:00");
            const isToday = isSameDay(dayDate, now);
            return (
              <div key={dayKey} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${
                        isToday
                          ? "bg-primary/15 text-primary"
                          : "border border-white/10 bg-white/[0.03] text-muted-foreground"
                      }`}
                    >
                      <CalendarRange className="h-3 w-3" />
                      {format(dayDate, "EEEE, dd 'de' MMM", { locale: ptBR })}
                    </span>
                    {isToday && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-primary">
                        Hoje
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {items.length} ag.
                  </span>
                </div>

                <div className="space-y-2">
                  {items.map((appt) => {
                    const badge = statusBadge(appt.status);
                    return (
                      <button
                        key={appt.id}
                        onClick={() => setSelectedAppt(appt)}
                        className="group flex w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-3 text-left transition-all hover:border-primary/30 hover:bg-white/[0.05] active:scale-[0.995]"
                      >
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                          <div className="text-center leading-tight">
                            <div className="text-[15px] font-semibold">
                              {format(new Date(appt.scheduled_at), "HH:mm")}
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold tracking-tight">
                            {appt.profile?.full_name || appt.profile?.email || "Cliente"}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {appt.vehicle
                              ? `${appt.vehicle.brand} ${appt.vehicle.model} · ${appt.vehicle.plate}`
                              : "Sem veículo vinculado"}
                          </div>
                          {appt.profile?.phone && (
                            <div className="truncate text-[11px] text-muted-foreground/80">
                              {appt.profile.phone}
                            </div>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AppointmentDialog
        appointment={selectedAppt}
        onOpenChange={(open) => !open && setSelectedAppt(null)}
        onStatus={setApptStatus}
        onMove={moveAppointment}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "primary" | "emerald" | "violet" | "amber";
}) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/0 border-primary/25 text-primary",
    emerald: "from-emerald-400/15 to-emerald-400/0 border-emerald-400/25 text-emerald-200",
    violet: "from-violet-400/15 to-violet-400/0 border-violet-400/25 text-violet-200",
    amber: "from-amber-400/15 to-amber-400/0 border-amber-400/25 text-amber-200",
  };
  return (
    <Card className={`rounded-[22px] border bg-gradient-to-b p-3.5 ${tones[accent]}`}>
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] opacity-80">{label}</div>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.02] p-3"
        >
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5 rounded-full" />
            <Skeleton className="h-3 w-3/5 rounded-full" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function BlockSlotDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [when, setWhen] = useState("");
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!when) return toast.error("Escolha data e horário.");
    const dt = new Date(when);
    if (isNaN(dt.getTime())) return toast.error("Data/hora inválida.");
    const { error } = await supabase.from("blocked_slots").insert({
      blocked_at: dt.toISOString(),
      reason: reason.trim() || null,
    });
    if (error) {
      if (error.code === "23505") return toast.error("Este horário já está bloqueado.");
      return toast.error(error.message);
    }
    toast.success("Horário bloqueado");
    setWhen("");
    setReason("");
    qc.invalidateQueries({ queryKey: ["admin-agenda-all"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-full border-rose-400/30 bg-rose-400/10 text-rose-200 hover:bg-rose-400/15"
        >
          <Ban className="mr-2 h-3.5 w-3.5" /> Bloquear horário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-[28px] border-white/10 bg-background p-5">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Bloquear horário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Data e hora</Label>
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="rounded-2xl border-white/10 bg-white/[0.03]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Motivo (opcional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: almoço, manutenção..."
              className="rounded-2xl border-white/10 bg-white/[0.03]"
            />
          </div>
          <Button
            className="w-full rounded-2xl bg-rose-500 text-white hover:bg-rose-500/90"
            onClick={submit}
          >
            Bloquear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentDialog({
  appointment,
  onOpenChange,
  onStatus,
  onMove,
}: {
  appointment: Appointment | null;
  onOpenChange: (open: boolean) => void;
  onStatus: (id: string, status: "completed" | "cancelled" | "scheduled") => void;
  onMove: (id: string, value: string) => void;
}) {
  const [moveTo, setMoveTo] = useState("");

  if (!appointment) return null;
  const badge = statusBadge(appointment.status);

  return (
    <Dialog open={!!appointment} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[28px] border-white/10 bg-background p-5">
        <DialogHeader>
          <DialogTitle className="tracking-tight">Detalhes do agendamento</DialogTitle>
        </DialogHeader>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                Horário
              </div>
              <div className="mt-1 text-xl font-semibold tracking-tight">
                {format(new Date(appointment.scheduled_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
          <div className="mt-3 space-y-0.5">
            <div className="text-sm font-medium">
              {appointment.profile?.full_name || appointment.profile?.email || "Cliente"}
            </div>
            {appointment.profile?.phone && (
              <div className="text-xs text-muted-foreground">{appointment.profile.phone}</div>
            )}
            <div className="text-xs text-muted-foreground">
              {appointment.vehicle
                ? `${appointment.vehicle.brand} ${appointment.vehicle.model} · ${appointment.vehicle.plate}`
                : "Veículo não informado"}
            </div>
            {appointment.notes && (
              <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-xs text-muted-foreground">
                {appointment.notes}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Remarcar para</Label>
          <Input
            type="datetime-local"
            defaultValue={toLocalDateTimeValue(appointment.scheduled_at)}
            onChange={(e) => setMoveTo(e.target.value)}
            className="rounded-2xl border-white/10 bg-white/[0.03]"
          />
          <Button
            className="w-full rounded-2xl bg-primary text-primary-foreground"
            onClick={() =>
              onMove(appointment.id, moveTo || toLocalDateTimeValue(appointment.scheduled_at))
            }
          >
            <RotateCw className="mr-2 h-4 w-4" /> Remarcar
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="rounded-2xl border-white/10 bg-white/[0.03]"
            onClick={() => onStatus(appointment.id, "completed")}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir
          </Button>
          <Button
            variant="ghost"
            className="rounded-2xl text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
            onClick={() => onStatus(appointment.id, "cancelled")}
          >
            <X className="mr-2 h-4 w-4" /> Cancelar
          </Button>
        </div>
        {appointment.status === "cancelled" && (
          <Button
            variant="outline"
            className="w-full rounded-2xl border-white/10 bg-white/[0.03]"
            onClick={() => onStatus(appointment.id, "scheduled")}
          >
            <Clock3 className="mr-2 h-4 w-4" /> Reativar
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
