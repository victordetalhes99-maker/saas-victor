import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { suspendUserAccess, restoreUserAccess } from "@/lib/admin.functions";
import {
  SuspendAccessDialog,
  RestoreAccessDialog,
  ConfirmActionDialog,
} from "@/components/admin/access-suspension-dialogs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Search,
  Eye,
  ShieldOff,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Circle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/clientes")({
  component: ClientesPage,
});

// ------------ Buckets -----------------------------------------------------
type Bucket =
  | "all"
  | "awaiting_payment"
  | "payment_review"
  | "active"
  | "expired"
  | "blocked"
  | "incomplete"
  | "cancelled";

const BUCKET_LABEL: Record<Bucket, string> = {
  all: "Todos",
  awaiting_payment: "Aguardando pagamento",
  payment_review: "Pagamento em análise",
  active: "Plano ativo",
  expired: "Plano vencido",
  blocked: "Acesso suspenso",
  incomplete: "Cadastro incompleto",
  cancelled: "Cancelado",
};

const BUCKET_ORDER: Bucket[] = [
  "all",
  "awaiting_payment",
  "payment_review",
  "active",
  "expired",
  "blocked",
  "incomplete",
  "cancelled",
];

type StatusTone = "green" | "yellow" | "red" | "gray";
const BUCKET_TONE: Record<Bucket, StatusTone> = {
  all: "gray",
  active: "green",
  awaiting_payment: "yellow",
  payment_review: "yellow",
  expired: "red",
  blocked: "yellow",
  cancelled: "red",
  incomplete: "gray",
};

const toneClass = (t: StatusTone) => {
  switch (t) {
    case "green":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
    case "yellow":
      return "border-amber-400/30 bg-amber-400/10 text-amber-200";
    case "red":
      return "border-rose-400/30 bg-rose-400/10 text-rose-200";
    default:
      return "border-white/10 bg-white/5 text-muted-foreground";
  }
};

// ------------------------------------------------------------------------

function classify(c: any): Bucket {
  const sub = c.subscriptions?.[0];
  const latestPayment = c.payments?.[0];
  if (c.status === "blocked") return "blocked";
  if (sub?.status === "cancelled") return "cancelled";
  if (sub?.status === "expired" || sub?.status === "past_due") return "expired";
  if (sub?.status === "active" && c.status === "active") return "active";
  if (latestPayment && latestPayment.status === "pending") return "payment_review";
  if (sub && sub.status === "pending") return "awaiting_payment";
  if (!sub || !c.vehicles?.length || c.status === "pending") return "incomplete";
  return "incomplete";
}

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  try {
    return format(typeof v === "string" ? parseISO(v) : v, "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};
const fmtDateTime = (v?: string | null) => {
  if (!v) return "—";
  try {
    return format(typeof v === "string" ? parseISO(v) : v, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
};
const fmtMoney = (v?: number | null) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

// ==========================================================================

function ClientesPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<Bucket>("all");
  const [sortBy, setSortBy] = useState<
    "recent" | "oldest" | "pending_payment" | "due_soon" | "overdue"
  >("recent");
  const [selected, setSelected] = useState<any | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<any | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description?: string;
    confirmLabel: string;
    tone: "default" | "danger" | "success";
    run: () => Promise<void>;
  } | null>(null);

  const suspendFn = useServerFn(suspendUserAccess);
  const restoreFn = useServerFn(restoreUserAccess);

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-monitor"],
    queryFn: async () => {
      const [profilesRes, subsRes, plansRes, vehiclesRes, paymentsRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("plans").select("*"),
        supabase.from("vehicles").select("*"),
        supabase.from("payments").select("*").order("created_at", { ascending: false }),
      ]);
      const plansById = new Map((plansRes.data ?? []).map((p: any) => [p.id, p]));
      return (profilesRes.data ?? []).map((profile: any) => ({
        ...profile,
        subscriptions: (subsRes.data ?? [])
          .filter((s: any) => s.user_id === profile.id)
          .map((s: any) => ({ ...s, plans: plansById.get(s.plan_id) ?? null })),
        vehicles: (vehiclesRes.data ?? []).filter((v: any) => v.user_id === profile.id),
        payments: (paymentsRes.data ?? []).filter((p: any) => p.user_id === profile.id),
      }));
    },
  });

  const enriched = useMemo(
    () => (clients ?? []).map((c: any) => ({ ...c, __bucket: classify(c) })),
    [clients],
  );

  const counts = useMemo(() => {
    const out: Record<Bucket, number> = {
      all: enriched.length,
      awaiting_payment: 0,
      payment_review: 0,
      active: 0,
      expired: 0,
      blocked: 0,
      incomplete: 0,
      cancelled: 0,
    };
    enriched.forEach((c) => {
      out[c.__bucket as Bucket] = (out[c.__bucket as Bucket] ?? 0) + 1;
    });
    return out;
  }, [enriched]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    let list = enriched.filter((c) => (bucket === "all" ? true : c.__bucket === bucket));
    if (term) {
      list = list.filter((c) => {
        const veh = c.vehicles?.[0];
        return (
          (c.full_name ?? "").toLowerCase().includes(term) ||
          (c.email ?? "").toLowerCase().includes(term) ||
          (c.phone ?? "").toLowerCase().includes(term) ||
          (veh?.plate ?? "").toLowerCase().includes(term)
        );
      });
    }
    const now = Date.now();
    list = [...list].sort((a, b) => {
      const subA = a.subscriptions?.[0];
      const subB = b.subscriptions?.[0];
      switch (sortBy) {
        case "oldest":
          return +new Date(a.created_at) - +new Date(b.created_at);
        case "pending_payment": {
          const pa = a.__bucket === "awaiting_payment" || a.__bucket === "payment_review" ? 0 : 1;
          const pb = b.__bucket === "awaiting_payment" || b.__bucket === "payment_review" ? 0 : 1;
          return pa - pb || +new Date(b.created_at) - +new Date(a.created_at);
        }
        case "due_soon": {
          const da = subA?.next_due_date ? +new Date(subA.next_due_date) : Infinity;
          const db = subB?.next_due_date ? +new Date(subB.next_due_date) : Infinity;
          return (da < now ? Infinity : da) - (db < now ? Infinity : db);
        }
        case "overdue": {
          const oa = a.__bucket === "expired" ? 0 : 1;
          const ob = b.__bucket === "expired" ? 0 : 1;
          return oa - ob;
        }
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return list;
  }, [enriched, bucket, q, sortBy]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-clients-monitor"] });

  // ----- Actions ----------------------------------------------------------
  const askConfirmPayment = (c: any) => {
    setConfirmState({
      title: "Confirmar pagamento",
      description: `Deseja confirmar o pagamento de ${c.full_name || c.email}?`,
      confirmLabel: "Confirmar pagamento",
      tone: "success",
      run: async () => {
        const sub = c.subscriptions?.[0];
        const latestPending = c.payments?.find((p: any) => p.status === "pending");
        try {
          if (latestPending) {
            const { error } = await supabase
              .from("payments")
              .update({ status: "paid", paid_at: new Date().toISOString() })
              .eq("id", latestPending.id);
            if (error) throw error;
          }
          if (sub) {
            const { error } = await supabase
              .from("subscriptions")
              .update({ status: "active" })
              .eq("id", sub.id);
            if (error) throw error;
          }
          toast.success("Pagamento confirmado.");
          invalidate();
        } catch (e: any) {
          toast.error(e?.message ?? "Falha ao confirmar pagamento.");
        }
      },
    });
  };

  const askReleaseAccess = (c: any) => {
    setConfirmState({
      title: "Liberar acesso",
      description: `Liberar o acesso de ${c.full_name || c.email}?`,
      confirmLabel: "Liberar acesso",
      tone: "success",
      run: async () => {
        const { error } = await supabase
          .from("profiles")
          .update({ status: "active", approved_at: new Date().toISOString() })
          .eq("id", c.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Acesso liberado.");
        invalidate();
      },
    });
  };

  const askMarkPending = (c: any) => {
    const sub = c.subscriptions?.[0];
    if (!sub) return toast.error("Cliente sem assinatura.");
    setConfirmState({
      title: "Marcar como pendente",
      description: "Marcar o pagamento desta assinatura como pendente?",
      confirmLabel: "Marcar pendente",
      tone: "default",
      run: async () => {
        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "pending" })
          .eq("id", sub.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Pagamento marcado como pendente.");
        invalidate();
      },
    });
  };

  const askCancelRequest = (c: any) => {
    const sub = c.subscriptions?.[0];
    if (!sub) return toast.error("Cliente sem assinatura.");
    setConfirmState({
      title: "Cancelar solicitação",
      description: "Cancelar solicitação/assinatura? A conta e o histórico serão preservados.",
      confirmLabel: "Cancelar solicitação",
      tone: "danger",
      run: async () => {
        const { error } = await supabase
          .from("subscriptions")
          .update({ status: "cancelled" })
          .eq("id", sub.id);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Solicitação cancelada.");
        invalidate();
      },
    });
  };

  const submitSuspend = async (payload: {
    userId: string;
    reasonCode: any;
    reason?: string;
    suspensionType: any;
    untilDate?: string;
    days?: number;
    notifyChannel: any;
    notifyMessage?: string;
  }) => {
    await suspendFn({ data: payload });
    toast.success("Acesso suspenso.");
    invalidate();
  };

  const submitRestore = async (payload: {
    userId: string;
    allowLogin: boolean;
    allowBooking: boolean;
    notifyChannel: any;
    notifyMessage?: string;
  }) => {
    await restoreFn({ data: payload });
    toast.success("Acesso reativado.");
    invalidate();
  };

  const actionsFor = (c: any) => {
    const b = c.__bucket as Bucket;
    const items: { label: string; fn: () => void; tone?: StatusTone }[] = [];
    if (b === "awaiting_payment" || b === "payment_review") {
      items.push({ label: "Confirmar pagamento", fn: () => askConfirmPayment(c), tone: "green" });
      items.push({ label: "Cancelar solicitação", fn: () => askCancelRequest(c), tone: "red" });
    }
    if (b === "payment_review" || (b === "active" && c.status !== "active")) {
      items.push({ label: "Liberar acesso", fn: () => askReleaseAccess(c), tone: "green" });
    }
    if (b === "expired") {
      items.push({ label: "Marcar como pendente", fn: () => askMarkPending(c), tone: "yellow" });
      items.push({ label: "Suspender acesso", fn: () => setSuspendTarget(c), tone: "red" });
    }
    if (b === "blocked") {
      items.push({ label: "Reativar acesso", fn: () => setRestoreTarget(c), tone: "green" });
    } else if (b !== "cancelled") {
      items.push({ label: "Suspender acesso", fn: () => setSuspendTarget(c), tone: "red" });
    }
    return items;
  };

  // ==================================================================

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
            Central · Acompanhamento
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Somente visualização e ações de fluxo. Dados cadastrais são gerenciados em seus módulos.
          </p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, e-mail, telefone ou placa"
              className="h-10 rounded-full border-white/10 bg-white/[0.03] pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="h-10 w-[210px] rounded-full border-white/10 bg-white/[0.03]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="pending_payment">Pagamento pendente</SelectItem>
              <SelectItem value="due_soon">Próximos do vencimento</SelectItem>
              <SelectItem value="overdue">Planos vencidos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2">
        {BUCKET_ORDER.map((b) => {
          const active = bucket === b;
          const tone = BUCKET_TONE[b];
          return (
            <button
              key={b}
              onClick={() => setBucket(b)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition ${
                active
                  ? "border-primary/40 bg-primary/15 text-primary shadow-[var(--shadow-glow-soft)]"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              <span>{BUCKET_LABEL[b]}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  active ? "bg-primary/20 text-primary" : toneClass(tone)
                }`}
              >
                {counts[b] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="grid gap-3">
        {filtered.map((c: any) => {
          const sub = c.subscriptions?.[0];
          const veh = c.vehicles?.[0];
          const lastPayment = c.payments?.[0];
          const b = c.__bucket as Bucket;
          const tone = BUCKET_TONE[b];
          return (
            <Card
              key={c.id}
              className="overflow-hidden rounded-[22px] border border-white/10 bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {veh?.image_url ? (
                    <img
                      src={veh.image_url}
                      alt=""
                      className="h-14 w-20 shrink-0 rounded-xl object-cover ring-1 ring-white/10"
                    />
                  ) : (
                    <div className="grid h-14 w-20 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted-foreground">
                      sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold">
                        {c.full_name || c.email || "—"}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${toneClass(
                          tone,
                        )}`}
                      >
                        {BUCKET_LABEL[b]}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                      <span className="truncate">✉ {c.email ?? "—"}</span>
                      <span className="truncate">☎ {c.phone ?? "—"}</span>
                      <span className="truncate">
                        🚗 {veh ? `${veh.brand} ${veh.model} · ${veh.plate}` : "Sem veículo"}
                      </span>
                      <span className="truncate">
                        📦 {sub?.plans?.name ?? "Sem plano"}
                        {sub?.plans?.monthly_price != null
                          ? ` · ${fmtMoney(Number(sub.plans.monthly_price))}`
                          : ""}
                      </span>
                      <span className="truncate">📅 Cadastro: {fmtDate(c.created_at)}</span>
                      <span className="truncate">
                        💳 Pgto: {fmtDate(lastPayment?.paid_at ?? lastPayment?.created_at)}
                      </span>
                      <span className="truncate">▶ Início: {fmtDate(sub?.start_date)}</span>
                      <span className="truncate">⏳ Vencimento: {fmtDate(sub?.next_due_date)}</span>
                      <span className="truncate">🕒 Atualizado: {fmtDateTime(c.updated_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelected(c)}
                    className="h-8 gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-xs"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Ver detalhes
                  </Button>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {actionsFor(c).map((a) => (
                      <Button
                        key={a.label}
                        size="sm"
                        variant="ghost"
                        onClick={a.fn}
                        className={`h-7 rounded-full border px-2.5 text-[11px] ${toneClass(
                          a.tone ?? "gray",
                        )}`}
                      >
                        {a.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}

        {!filtered.length && (
          <Card className="rounded-2xl border-white/10 bg-white/[0.02] p-8 text-center text-sm text-muted-foreground">
            Nenhum cliente nesta situação.
          </Card>
        )}
      </div>

      <ClientDetailsSheet client={selected} onOpenChange={(o) => !o && setSelected(null)} />

      <SuspendAccessDialog
        client={suspendTarget}
        open={!!suspendTarget}
        onOpenChange={(o) => !o && setSuspendTarget(null)}
        onSubmit={submitSuspend}
      />

      <RestoreAccessDialog
        client={restoreTarget}
        open={!!restoreTarget}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
        onSubmit={submitRestore}
      />

      <ConfirmActionDialog
        open={!!confirmState}
        onOpenChange={(o) => !o && setConfirmState(null)}
        title={confirmState?.title ?? ""}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel ?? "Confirmar"}
        tone={confirmState?.tone ?? "default"}
        onConfirm={async () => {
          if (confirmState) await confirmState.run();
        }}
      />
    </div>
  );
}

// ==================================================================

function ClientDetailsSheet({
  client,
  onOpenChange,
}: {
  client: any | null;
  onOpenChange: (open: boolean) => void;
}) {
  const events = useMemo(() => {
    if (!client) return [];
    const list: { at: string | null; label: string; icon: any; tone: StatusTone }[] = [];
    list.push({
      at: client.created_at,
      label: "Cadastro realizado",
      icon: Circle,
      tone: "gray",
    });
    const sub = client.subscriptions?.[0];
    if (sub) {
      list.push({
        at: sub.created_at,
        label: `Plano selecionado: ${sub.plans?.name ?? "—"}`,
        icon: Circle,
        tone: "gray",
      });
    }
    (client.payments ?? [])
      .slice()
      .reverse()
      .forEach((p: any) => {
        if (p.status === "pending") {
          list.push({
            at: p.created_at,
            label: `Pagamento enviado (${fmtMoney(Number(p.amount))})`,
            icon: Clock,
            tone: "yellow",
          });
        } else if (p.status === "paid") {
          list.push({
            at: p.paid_at ?? p.created_at,
            label: `Pagamento confirmado (${fmtMoney(Number(p.amount))})`,
            icon: CheckCircle2,
            tone: "green",
          });
        } else if (p.status === "failed") {
          list.push({
            at: p.created_at,
            label: "Pagamento recusado",
            icon: XCircle,
            tone: "red",
          });
        }
      });
    if (client.approved_at) {
      list.push({
        at: client.approved_at,
        label: "Acesso liberado",
        icon: ShieldCheck,
        tone: "green",
      });
    }
    if (sub?.status === "expired" || sub?.status === "past_due") {
      list.push({
        at: sub.next_due_date ?? sub.updated_at,
        label: "Plano vencido",
        icon: AlertTriangle,
        tone: "red",
      });
    }
    if (client.status === "blocked") {
      list.push({
        at: client.blocked_at,
        label: `Acesso suspenso${client.blocked_reason ? ` — ${client.blocked_reason}` : ""}`,
        icon: ShieldOff,
        tone: "yellow",
      });
    }
    if (sub?.status === "cancelled") {
      list.push({
        at: sub.updated_at,
        label: "Cancelamento realizado",
        icon: XCircle,
        tone: "red",
      });
    }
    return list.sort((a, b) => {
      const ta = a.at ? +new Date(a.at) : 0;
      const tb = b.at ? +new Date(b.at) : 0;
      return ta - tb;
    });
  }, [client]);

  if (!client) return null;
  const sub = client.subscriptions?.[0];
  const veh = client.vehicles?.[0];
  const b = classify(client);

  const infoRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[65%] text-right text-sm font-medium text-foreground">
        {value ?? "—"}
      </span>
    </div>
  );

  return (
    <Sheet open={!!client} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-[92vw] flex-col gap-0 border-l border-emerald-900/40 bg-[#0B1511] p-0 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] sm:w-full sm:max-w-xl"
      >
        {/* Header (sticky) */}
        <SheetHeader className="sticky top-0 z-10 flex-row items-start justify-between gap-3 border-b border-white/10 bg-[#07110D] px-5 py-4 pr-16 text-left">
          <div className="min-w-0 flex-1 space-y-1">
            <SheetTitle className="truncate text-lg font-semibold text-white sm:text-xl">
              {client.full_name || client.email}
            </SheetTitle>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Cadastro: {fmtDate(client.created_at)}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneClass(
                  BUCKET_TONE[b],
                )}`}
              >
                {BUCKET_LABEL[b]}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {/* Dados pessoais */}
          <section className="rounded-xl border border-white/10 bg-[#0E1B16] p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
              Dados pessoais
            </p>
            <div className="divide-y divide-white/[0.06]">
              {infoRow("Nome", client.full_name)}
              {infoRow("E-mail", client.email)}
              {infoRow("WhatsApp", client.phone)}
              {infoRow("Cidade", client.city)}
              {client.address && infoRow("Endereço", client.address)}
            </div>
          </section>

          {/* Veículo */}
          <section className="rounded-xl border border-white/10 bg-[#0E1B16] p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
              Veículo
            </p>
            {veh ? (
              <div className="divide-y divide-white/[0.06]">
                {infoRow("Marca / Modelo", `${veh.brand ?? "—"} ${veh.model ?? ""}`.trim())}
                {infoRow("Placa", veh.plate)}
                {infoRow("Cor", veh.color)}
                {infoRow("Ano", veh.year)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado.</p>
            )}
          </section>

          {/* Plano e pagamento */}
          <section className="rounded-xl border border-white/10 bg-[#0E1B16] p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
              Plano e pagamento
            </p>
            <div className="divide-y divide-white/[0.06]">
              {infoRow("Plano", sub?.plans?.name)}
              {infoRow(
                "Valor mensal",
                sub?.plans?.monthly_price != null ? fmtMoney(Number(sub.plans.monthly_price)) : "—",
              )}
              {infoRow(
                "Status assinatura",
                sub?.status ? (
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${toneClass(
                      sub.status === "active"
                        ? "green"
                        : sub.status === "pending"
                          ? "yellow"
                          : "red",
                    )}`}
                  >
                    {sub.status}
                  </span>
                ) : (
                  "—"
                ),
              )}
              {infoRow("Início", fmtDate(sub?.start_date))}
              {infoRow("Vencimento", fmtDate(sub?.next_due_date))}
              {infoRow("Lavagens usadas", sub?.washes_used ?? 0)}
            </div>
          </section>

          {/* Linha do tempo */}
          <section className="rounded-xl border border-white/10 bg-[#0E1B16] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/80">
              Linha do tempo
            </p>
            <ol className="relative space-y-3 border-l border-white/10 pl-4">
              {events.map((e, i) => {
                const Icon = e.icon;
                return (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[22px] top-0.5 grid h-4 w-4 place-items-center rounded-full border ${toneClass(
                        e.tone,
                      )}`}
                    >
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <div className="text-sm text-foreground">{e.label}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtDateTime(e.at)}</div>
                  </li>
                );
              })}
              {!events.length && (
                <li className="text-sm text-muted-foreground">Sem eventos registrados.</li>
              )}
            </ol>
          </section>

          <p className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-muted-foreground">
            Esta tela é somente para consulta. Alterações de nome, e-mail, veículo ou plano devem
            ser feitas nos respectivos módulos (Cadastro, Veículos, Planos/Assinatura).
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
