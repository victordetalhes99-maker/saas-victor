import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Users,
  CalendarRange,
  Package,
  Wallet,
  ArrowRight,
  Inbox,
  Sparkles,
  Clock,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHomePage,
});

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  in_progress: "Em andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function AdminHomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-home-overview"],
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const [clients, apptsTotal, apptsToday, plans, subsActive, recentAppts] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("appointments").select("id", { count: "exact", head: true }),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .gte("scheduled_at", todayStart.toISOString())
          .lte("scheduled_at", todayEnd.toISOString()),
        supabase.from("plans").select("id", { count: "exact", head: true }).eq("active", true),
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "trialing"]),
        supabase
          .from("appointments")
          .select("id, scheduled_at, status, profiles(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      return {
        clients: clients.count ?? 0,
        appointments: apptsTotal.count ?? 0,
        appointmentsToday: apptsToday.count ?? 0,
        plans: plans.count ?? 0,
        activeSubs: subsActive.count ?? 0,
        recent: (recentAppts.data ?? []) as Array<{
          id: string;
          scheduled_at: string;
          status: string;
          profiles: { full_name: string | null; email: string | null } | null;
        }>,
      };
    },
  });

  return (
    <div className="anim-rise space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary/80">
          Admin
        </p>
        <h1 className="text-display text-2xl text-foreground sm:text-3xl">Visão geral</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Acompanhe clientes, agenda e assinaturas em tempo real.
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Clientes"
          value={data?.clients}
          loading={isLoading}
          to="/admin/clientes"
        />
        <StatCard
          icon={CalendarRange}
          label="Agendamentos hoje"
          value={data?.appointmentsToday}
          loading={isLoading}
          to="/admin/agenda"
        />
        <StatCard
          icon={TrendingUp}
          label="Assinaturas ativas"
          value={data?.activeSubs}
          loading={isLoading}
          to="/admin/planos"
        />
        <StatCard
          icon={Package}
          label="Planos ativos"
          value={data?.plans}
          loading={isLoading}
          to="/admin/planos"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {/* Recent activity */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              Agendamentos recentes
            </h2>
            <Link
              to="/admin/agenda"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
            >
              Ver agenda
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-white/[0.03]" />
              ))}
            </div>
          ) : data && data.recent.length > 0 ? (
            <ul className="space-y-2">
              {data.recent.map((appt) => (
                <li
                  key={appt.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-3.5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {appt.profiles?.full_name || appt.profiles?.email || "Cliente"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(appt.scheduled_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {STATUS_LABEL[appt.status] ?? appt.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 py-10 text-center">
              <CalendarRange className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Nenhum agendamento ainda.</p>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Acesso rápido
          </h2>
          <div className="space-y-2">
            <QuickAction to="/admin/clientes" icon={Users} label="Gestão de clientes" />
            <QuickAction to="/admin/solicitacoes" icon={Inbox} label="Solicitações pendentes" />
            <QuickAction to="/admin/agenda" icon={CalendarRange} label="Abrir agenda" />
            <QuickAction to="/admin/pagamentos" icon={Wallet} label="Pagamentos" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  to,
}: {
  icon: any;
  label: string;
  value: number | undefined;
  loading: boolean;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-all hover:border-primary/25 hover:bg-white/[0.05]"
    >
      <div className="flex items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-semibold text-foreground">
        {loading ? (
          <span className="inline-block h-7 w-10 animate-pulse rounded bg-white/10 align-middle" />
        ) : (
          (value ?? 0)
        )}
      </div>
    </Link>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3 text-sm text-foreground/90 transition-all hover:border-primary/25 hover:bg-white/[0.05]"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-muted-foreground group-hover:text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}
