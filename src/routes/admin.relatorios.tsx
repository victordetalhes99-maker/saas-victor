import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  CalendarCheck2,
  XCircle,
  TrendingUp,
  Wallet,
  Receipt,
  Scale,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/relatorios")({
  component: RelatoriosPage,
});

type RangeKey = "today" | "7d" | "30d" | "month" | "last_month";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "month", label: "Mês atual" },
  { key: "last_month", label: "Mês anterior" },
];

function getRange(key: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (key) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "7d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "30d": {
      const start = new Date(now);
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "month": {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end: lastEnd };
    }
  }
}

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function RelatoriosPage() {
  const [range, setRange] = useState<RangeKey>("30d");
  const { start, end } = useMemo(() => getRange(range), [range]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-reports", range],
    queryFn: async () => {
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const [newClients, appts, payments, expenses] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startISO)
          .lte("created_at", endISO),
        supabase
          .from("appointments")
          .select("id, status, scheduled_at")
          .gte("scheduled_at", startISO)
          .lte("scheduled_at", endISO),
        supabase
          .from("payments")
          .select("amount, status, created_at")
          .gte("created_at", startISO)
          .lte("created_at", endISO),
        supabase
          .from("expenses")
          .select("amount")
          .gte("expense_date", startISO.slice(0, 10))
          .lte("expense_date", endISO.slice(0, 10)),
      ]);

      if (appts.error) throw appts.error;
      if (payments.error) throw payments.error;
      if (expenses.error) throw expenses.error;

      const apptRows = appts.data ?? [];
      const completed = apptRows.filter((a) => a.status === "completed").length;
      const cancelled = apptRows.filter((a) => a.status === "cancelled").length;
      const attendanceRate = apptRows.length ? Math.round((completed / apptRows.length) * 100) : 0;

      const paymentRows = payments.data ?? [];
      const paid = paymentRows.filter((p) => p.status === "paid");
      const grossRevenue = paid.reduce((s, p) => s + Number(p.amount), 0);
      const pendingRevenue = paymentRows
        .filter((p) => p.status === "pending")
        .reduce((s, p) => s + Number(p.amount), 0);
      const avgTicket = paid.length ? grossRevenue / paid.length : 0;

      const totalExpenses = (expenses.data ?? []).reduce((s, e) => s + Number(e.amount), 0);

      // Revenue grouped by day for the chart
      const byDay = new Map<string, number>();
      paid.forEach((p) => {
        const day = new Date(p.created_at).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        byDay.set(day, (byDay.get(day) ?? 0) + Number(p.amount));
      });
      const chartData = [...byDay.entries()].map(([day, value]) => ({ day, value }));

      return {
        newClients: newClients.count ?? 0,
        totalAppts: apptRows.length,
        completed,
        cancelled,
        attendanceRate,
        grossRevenue,
        pendingRevenue,
        avgTicket,
        totalExpenses,
        net: grossRevenue - totalExpenses,
        chartData,
      };
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
          Financeiro · Operação
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Relatórios</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Indicadores operacionais e financeiros calculados a partir dos dados reais do sistema.
        </p>
      </div>

      {/* Range filter */}
      <div className="flex flex-wrap gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              range === r.key
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {!isLoading && isError && (
        <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive-foreground">
          Não foi possível carregar os relatórios deste período.
        </Card>
      )}

      {(isLoading || (!isError && data)) && (
        <>
          {/* KPI grid */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              icon={UserPlus}
              label="Novos clientes"
              value={data?.newClients}
              loading={isLoading}
            />
            <Kpi
              icon={CalendarCheck2}
              label="Agendamentos concluídos"
              value={data?.completed}
              loading={isLoading}
            />
            <Kpi icon={XCircle} label="Cancelamentos" value={data?.cancelled} loading={isLoading} />
            <Kpi
              icon={Users}
              label="Taxa de comparecimento"
              value={data ? `${data.attendanceRate}%` : undefined}
              loading={isLoading}
            />
            <Kpi
              icon={TrendingUp}
              label="Receita bruta"
              value={data ? fmtMoney(data.grossRevenue) : undefined}
              loading={isLoading}
              tone="green"
            />
            <Kpi
              icon={Wallet}
              label="Pendente"
              value={data ? fmtMoney(data.pendingRevenue) : undefined}
              loading={isLoading}
              tone="yellow"
            />
            <Kpi
              icon={Receipt}
              label="Ticket médio"
              value={data ? fmtMoney(data.avgTicket) : undefined}
              loading={isLoading}
            />
            <Kpi
              icon={Scale}
              label="Resultado líquido"
              value={data ? fmtMoney(data.net) : undefined}
              loading={isLoading}
              tone={data && data.net >= 0 ? "green" : "red"}
            />
          </div>

          {/* Revenue chart */}
          <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Receita por dia</h2>
            {isLoading ? (
              <div className="h-64 animate-pulse rounded-xl bg-white/[0.03]" />
            ) : data && data.chartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                    <XAxis
                      dataKey="day"
                      stroke="oklch(0.7 0 0 / 0.5)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="oklch(0.7 0 0 / 0.5)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `R$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.14 0.02 230)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [fmtMoney(v), "Receita"]}
                    />
                    <Bar dataKey="value" fill="oklch(0.75 0.19 145)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 py-12 text-center">
                <TrendingUp className="h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Ainda não há dados suficientes para este relatório neste período.
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number | undefined;
  loading: boolean;
  tone?: "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "text-emerald-300"
      : tone === "yellow"
        ? "text-amber-300"
        : tone === "red"
          ? "text-rose-300"
          : "text-foreground";
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className={`mt-1 truncate text-xl font-semibold ${toneClass}`}>
        {loading ? (
          <span className="inline-block h-6 w-16 animate-pulse rounded bg-white/10 align-middle" />
        ) : (
          (value ?? "—")
        )}
      </div>
    </Card>
  );
}
