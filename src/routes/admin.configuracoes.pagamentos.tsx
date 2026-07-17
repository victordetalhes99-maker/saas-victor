import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import {
  CreditCard,
  ArrowRight,
  FlaskConical,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Users,
  Loader2,
} from "lucide-react";
import { getClientPaymentsEnv } from "@/lib/payments-env";

export const Route = createFileRoute("/admin/configuracoes/pagamentos")({
  component: PagamentosPage,
});

const fmtBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function startOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function PagamentosPage() {
  const env = getClientPaymentsEnv();
  const isLive = env === "live";

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["payments-config-metrics"],
    queryFn: async () => {
      const monthStart = startOfMonthISO();
      const [receivedMtd, pendingMtd, failedMtd, activeSubs, canceledSubs] = await Promise.all([
        supabase
          .from("payments")
          .select("amount_cents", { count: "exact" })
          .eq("status", "paid")
          .gte("created_at", monthStart),
        supabase
          .from("payments")
          .select("amount_cents", { count: "exact" })
          .eq("status", "pending")
          .gte("created_at", monthStart),
        supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "failed")
          .gte("created_at", monthStart),
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .in("status", ["cancelled", "past_due", "expired"]),
      ]);
      const sum = (rows: { amount_cents: number | null }[] | null) =>
        (rows ?? []).reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);
      return {
        received_cents: sum(receivedMtd.data as { amount_cents: number | null }[] | null),
        received_count: receivedMtd.count ?? 0,
        pending_cents: sum(pendingMtd.data as { amount_cents: number | null }[] | null),
        pending_count: pendingMtd.count ?? 0,
        failed_count: failedMtd.count ?? 0,
        active_subs: activeSubs.count ?? 0,
        canceled_subs: canceledSubs.count ?? 0,
      };
    },
  });

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Ambiente de pagamento</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Provedor: <strong className="text-foreground">Stripe</strong>. A interface lê{" "}
                <code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">
                  VITE_PAYMENTS_ENV
                </code>
                , que deve espelhar o valor server-side de{" "}
                <code className="rounded bg-white/10 px-1 py-0.5 text-[10px]">PAYMENTS_ENV</code>.
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wider ${
              isLive
                ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border border-amber-300/30 bg-amber-300/10 text-amber-200"
            }`}
          >
            {isLive ? <Zap className="h-3 w-3" /> : <FlaskConical className="h-3 w-3" />}
            {isLive ? "Produção" : "Sandbox"}
          </span>
        </div>
      </Card>

      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
          Este mês {isLoading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={TrendingUp}
            label="Recebido"
            value={fmtBRL(metrics?.received_cents ?? 0)}
            hint={`${metrics?.received_count ?? 0} pagamentos confirmados`}
            accent="emerald"
          />
          <MetricCard
            icon={CreditCard}
            label="Pendente"
            value={fmtBRL(metrics?.pending_cents ?? 0)}
            hint={`${metrics?.pending_count ?? 0} aguardando`}
            accent="amber"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Falhas / cancelamentos"
            value={String(metrics?.failed_count ?? 0)}
            hint="Nos últimos 30 dias"
            accent="rose"
          />
          <MetricCard
            icon={Users}
            label="Assinaturas ativas"
            value={String(metrics?.active_subs ?? 0)}
            hint={`${metrics?.canceled_subs ?? 0} inativas`}
            accent="primary"
          />
        </div>
      </div>

      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-base font-semibold tracking-tight">Infraestrutura do provedor</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Configurações operacionais do Stripe. Chaves são gerenciadas exclusivamente por variáveis
          de ambiente do servidor.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow
            icon={CheckCircle2}
            title="Webhook"
            value="/api/public/payments/webhook"
            hint="Assinatura HMAC obrigatória."
            ok
          />
          <InfoRow
            icon={CheckCircle2}
            title="Renovação"
            value="Automática"
            hint="Assinaturas ativas renovam via Stripe."
            ok
          />
          <InfoRow
            icon={CreditCard}
            title="Método padrão"
            value="Cartão de crédito"
            hint="Definido pelo provedor."
          />
          <InfoRow
            icon={CreditCard}
            title="Modo"
            value={isLive ? "Produção (live)" : "Sandbox (test)"}
            hint="Trocado pela variável de ambiente."
          />
        </div>
      </Card>

      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <h3 className="text-base font-semibold tracking-tight">Histórico e gestão</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Detalhamento completo de pagamentos e assinaturas nos módulos dedicados.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/admin/pagamentos"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
          >
            Ver pagamentos <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/admin/planos"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Gerenciar planos <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/admin/financeiro"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
          >
            Relatórios financeiros <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint: string;
  accent: "emerald" | "amber" | "rose" | "primary";
}) {
  const map = {
    emerald: "text-emerald-300 border-emerald-400/20 bg-emerald-400/[0.04]",
    amber: "text-amber-200 border-amber-300/20 bg-amber-300/[0.04]",
    rose: "text-rose-300 border-rose-400/20 bg-rose-400/[0.04]",
    primary: "text-primary border-primary/20 bg-primary/[0.04]",
  } as const;
  return (
    <Card className="rounded-2xl border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div className={`grid h-7 w-7 place-items-center rounded-lg border ${map[accent]}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">{hint}</p>
    </Card>
  );
}

function InfoRow({
  icon: Icon,
  title,
  value,
  hint,
  ok,
}: {
  icon: typeof CheckCircle2;
  title: string;
  value: string;
  hint: string;
  ok?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${ok ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.03] text-muted-foreground"}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
        <p className="text-[11px] text-muted-foreground/80">{hint}</p>
      </div>
    </div>
  );
}
