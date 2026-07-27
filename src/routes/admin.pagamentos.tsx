import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Wallet, CheckCircle2, Clock, XCircle, CreditCard } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/pagamentos")({
  component: PagamentosPage,
});

type PaymentRow = {
  id: string;
  user_id: string;
  amount: number;
  status: string;
  environment: string;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  pending: "Pendente",
  failed: "Falhou",
};
const STATUS_TONE: Record<string, string> = {
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  failed: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  try {
    return format(parseISO(v), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
};

function PagamentosPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "failed">("all");

  const {
    data: payments,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          "id, user_id, amount, status, environment, stripe_payment_intent_id, paid_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
      const byId = new Map((profilesData ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({ ...r, profiles: byId.get(r.user_id) ?? null })) as PaymentRow[];
    },
  });

  const summary = useMemo(() => {
    const list = payments ?? [];
    const now = new Date();
    const thisMonth = list.filter((p) => {
      const d = new Date(p.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      received: thisMonth
        .filter((p) => p.status === "paid")
        .reduce((s, p) => s + Number(p.amount), 0),
      pending: list.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0),
      failed: list.filter((p) => p.status === "failed").length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (payments ?? []).filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!term) return true;
      return (
        (p.profiles?.full_name ?? "").toLowerCase().includes(term) ||
        (p.profiles?.email ?? "").toLowerCase().includes(term)
      );
    });
  }, [payments, q, status]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
          Financeiro
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Pagamentos</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Transações processadas via Stripe, sincronizadas por webhook.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={CheckCircle2}
          label="Recebido este mês"
          value={fmtMoney(summary.received)}
          tone="green"
        />
        <SummaryCard
          icon={Clock}
          label="Pendente"
          value={fmtMoney(summary.pending)}
          tone="yellow"
        />
        <SummaryCard icon={XCircle} label="Falhas" value={summary.failed} tone="red" />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente ou e-mail"
            className="h-10 rounded-full border-white/10 bg-white/[0.03] pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-10 w-[160px] rounded-full border-white/10 bg-white/[0.03]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        {isLoading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}

        {!isLoading && isError && (
          <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive-foreground">
            Não foi possível carregar os pagamentos.
          </Card>
        )}

        {!isLoading &&
          !isError &&
          filtered.map((p) => (
            <Card
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-white/10 bg-card p-3.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {p.profiles?.full_name || p.profiles?.email || "Cliente"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtDate(p.paid_at ?? p.created_at)}
                    {p.environment === "sandbox" && " · teste"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {fmtMoney(Number(p.amount))}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    STATUS_TONE[p.status] ?? "border-white/10 bg-white/5 text-muted-foreground"
                  }`}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            </Card>
          ))}

        {!isLoading && !isError && filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <Wallet className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {q || status !== "all"
                ? "Nenhum pagamento encontrado com esse filtro."
                : "Nenhum pagamento ainda."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string | number;
  tone: "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-amber-300" : "text-rose-300";
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
        {label}
      </div>
      <div className="mt-1 truncate text-xl font-semibold text-foreground">{value}</div>
    </Card>
  );
}
