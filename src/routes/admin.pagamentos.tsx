import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientPaymentsEnv } from "@/lib/payments-env";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search,
  Wallet,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  ExternalLink,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/pagamentos")({
  component: PagamentosPage,
});

type PaymentRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: string;
  environment: string;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
  planName: string | null;
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
const maskId = (id?: string | null) => {
  if (!id) return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
};
function stripeUrl(kind: "payments" | "invoices", id: string, environment: string) {
  const prefix = environment === "sandbox" ? "test/" : "";
  return `https://dashboard.stripe.com/${prefix}${kind}/${id}`;
}

type PeriodKey = "all" | "today" | "7d" | "30d" | "month";
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "Todo o período" },
  { key: "today", label: "Hoje" },
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "month", label: "Mês atual" },
];

function PagamentosPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "paid" | "pending" | "failed">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [selected, setSelected] = useState<PaymentRow | null>(null);

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
          "id, user_id, subscription_id, amount, currency, status, environment, stripe_invoice_id, stripe_payment_intent_id, paid_at, created_at",
        )
        .eq("environment", getClientPaymentsEnv())
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = data ?? [];

      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const subIds = [...new Set(rows.map((r) => r.subscription_id).filter(Boolean))] as string[];

      const [profilesRes, subsRes] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id, full_name, email").in("id", userIds)
          : Promise.resolve({
              data: [] as Array<{ id: string; full_name: string | null; email: string | null }>,
            }),
        subIds.length
          ? supabase.from("subscriptions").select("id, plan_id, plans(name)").in("id", subIds)
          : Promise.resolve({
              data: [] as Array<{ id: string; plan_id: string; plans: { name: string } | null }>,
            }),
      ]);

      const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const planNameBySub = new Map(
        (subsRes.data ?? []).map((s: any) => [s.id, s.plans?.name ?? null]),
      );

      return rows.map((r) => ({
        ...r,
        profiles: profileById.get(r.user_id) ?? null,
        planName: r.subscription_id ? (planNameBySub.get(r.subscription_id) ?? null) : null,
      })) as PaymentRow[];
    },
  });

  const planOptions = useMemo(() => {
    const names = new Set((payments ?? []).map((p) => p.planName).filter(Boolean) as string[]);
    return [...names];
  }, [payments]);

  const summary = useMemo(() => {
    const list = payments ?? [];
    const now = new Date();
    const inMonth = (d: Date, ref: Date) =>
      d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();

    const thisMonthPaid = list.filter(
      (p) => p.status === "paid" && inMonth(new Date(p.paid_at ?? p.created_at), now),
    );
    const lastMonthRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPaid = list.filter(
      (p) => p.status === "paid" && inMonth(new Date(p.paid_at ?? p.created_at), lastMonthRef),
    );

    const received = thisMonthPaid.reduce((s, p) => s + Number(p.amount), 0);
    const receivedLastMonth = lastMonthPaid.reduce((s, p) => s + Number(p.amount), 0);
    const deltaPct =
      receivedLastMonth > 0
        ? Math.round(((received - receivedLastMonth) / receivedLastMonth) * 100)
        : received > 0
          ? 100
          : 0;

    return {
      received,
      deltaPct,
      pending: list.filter((p) => p.status === "pending").reduce((s, p) => s + Number(p.amount), 0),
      failed: list.filter((p) => p.status === "failed").length,
    };
  }, [payments]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const now = new Date();
    let start: Date | null = null;
    if (period === "today") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "7d") {
      start = new Date(now);
      start.setDate(start.getDate() - 6);
    } else if (period === "30d") {
      start = new Date(now);
      start.setDate(start.getDate() - 29);
    } else if (period === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return (payments ?? []).filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (planFilter !== "all" && p.planName !== planFilter) return false;
      if (start && new Date(p.created_at) < start) return false;
      if (!term) return true;
      return (
        (p.profiles?.full_name ?? "").toLowerCase().includes(term) ||
        (p.profiles?.email ?? "").toLowerCase().includes(term) ||
        (p.stripe_invoice_id ?? "").toLowerCase().includes(term) ||
        (p.stripe_payment_intent_id ?? "").toLowerCase().includes(term)
      );
    });
  }, [payments, q, status, planFilter, period]);

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
        <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            Recebido este mês
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="truncate text-xl font-semibold text-emerald-300">
              {fmtMoney(summary.received)}
            </span>
            {summary.deltaPct !== 0 && (
              <span
                className={`flex items-center gap-0.5 text-[11px] font-medium ${
                  summary.deltaPct > 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {summary.deltaPct > 0 ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
                {Math.abs(summary.deltaPct)}%
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[10px] text-muted-foreground">vs. mês anterior</p>
        </Card>
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
            placeholder="Cliente, e-mail ou ID do Stripe"
            className="h-10 rounded-full border-white/10 bg-white/[0.03] pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="h-10 w-[150px] rounded-full border-white/10 bg-white/[0.03]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
          </SelectContent>
        </Select>
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="h-10 w-[150px] rounded-full border-white/10 bg-white/[0.03]">
            <SelectValue placeholder="Plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            {planOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="h-10 w-[150px] rounded-full border-white/10 bg-white/[0.03]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label}
              </SelectItem>
            ))}
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
            <button key={p.id} onClick={() => setSelected(p)} className="block w-full text-left">
              <Card className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-white/10 bg-card p-3.5 transition hover:border-primary/25">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03]">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {p.profiles?.full_name || p.profiles?.email || "Cliente"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {p.planName ?? "Sem plano"} · {fmtDate(p.paid_at ?? p.created_at)}
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
            </button>
          ))}

        {!isLoading && !isError && filtered.length === 0 && (
          <Card className="flex flex-col items-center gap-2 rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <Wallet className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              {q || status !== "all" || planFilter !== "all" || period !== "all"
                ? "Nenhum pagamento encontrado com esse filtro."
                : "Nenhum pagamento ainda."}
            </p>
          </Card>
        )}
      </div>

      <PaymentDetailDialog payment={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

function PaymentDetailDialog({
  payment,
  onOpenChange,
}: {
  payment: PaymentRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!payment) return null;
  const row = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 py-2 first:pt-0">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[65%] text-right text-sm font-medium text-foreground">
        {value ?? "—"}
      </span>
    </div>
  );

  const stripeLink = payment.stripe_payment_intent_id
    ? stripeUrl("payments", payment.stripe_payment_intent_id, payment.environment)
    : payment.stripe_invoice_id
      ? stripeUrl("invoices", payment.stripe_invoice_id, payment.environment)
      : null;

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl border-white/10 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Pagamento de {payment.profiles?.full_name || payment.profiles?.email}
          </DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-white/[0.06]">
          {row("Cliente", payment.profiles?.full_name || payment.profiles?.email)}
          {row("Plano", payment.planName ?? "Sem plano vinculado")}
          {row("Valor", `${fmtMoney(Number(payment.amount))} ${payment.currency.toUpperCase()}`)}
          {row(
            "Status",
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                STATUS_TONE[payment.status] ?? ""
              }`}
            >
              {STATUS_LABEL[payment.status] ?? payment.status}
            </span>,
          )}
          {row("Criado em", fmtDate(payment.created_at))}
          {row("Pago em", fmtDate(payment.paid_at))}
          {row(
            "Invoice (Stripe)",
            <span className="font-mono text-xs">{maskId(payment.stripe_invoice_id)}</span>,
          )}
          {row(
            "Payment Intent",
            <span className="font-mono text-xs">{maskId(payment.stripe_payment_intent_id)}</span>,
          )}
          {row("Ambiente", payment.environment === "sandbox" ? "Teste (sandbox)" : "Produção")}
        </div>

        <p className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-muted-foreground">
          Taxa do Stripe, valor líquido e tentativas de cobrança não são armazenados neste banco —
          consulte esses detalhes direto no Stripe pelo link abaixo.
        </p>

        {stripeLink && (
          <a
            href={stripeLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition hover:bg-primary/20"
          >
            Abrir no Stripe
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </DialogContent>
    </Dialog>
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
