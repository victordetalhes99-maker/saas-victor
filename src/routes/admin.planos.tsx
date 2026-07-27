import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientPaymentsEnv } from "@/lib/payments-env";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Package,
  Plus,
  Pencil,
  AlertTriangle,
  Users,
  CreditCard,
  ChevronUp,
  ChevronDown,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin/planos")({
  component: PlanosPage,
});

type Plan = {
  id: string;
  name: string;
  monthly_price: number;
  washes_per_month: number;
  default_duration_minutes: number;
  benefits: string[];
  stripe_price_id: string | null;
  active: boolean;
};

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PlanosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);

  const {
    data: plans,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const [plansRes, subsRes] = await Promise.all([
        supabase.from("plans").select("*").order("monthly_price", { ascending: true }),
        supabase
          .from("subscriptions")
          .select("plan_id, status")
          .eq("environment", getClientPaymentsEnv())
          .in("status", ["active", "trialing"]),
      ]);
      if (plansRes.error) throw plansRes.error;
      const subsByPlan = new Map<string, number>();
      (subsRes.data ?? []).forEach((s) => {
        subsByPlan.set(s.plan_id, (subsByPlan.get(s.plan_id) ?? 0) + 1);
      });
      return {
        plans: (plansRes.data ?? []) as Plan[],
        subsByPlan,
      };
    },
  });

  const toggleActive = async (plan: Plan) => {
    const { error } = await supabase
      .from("plans")
      .update({ active: !plan.active })
      .eq("id", plan.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(plan.active ? "Plano desativado." : "Plano ativado.");
    qc.invalidateQueries({ queryKey: ["admin-plans"] });
  };

  const activeCount = plans?.plans.filter((p) => p.active).length ?? 0;
  const totalSubs = plans ? [...plans.subsByPlan.values()].reduce((a, b) => a + b, 0) : 0;
  const bestSeller = plans?.plans.reduce<Plan | null>((best, p) => {
    const count = plans.subsByPlan.get(p.id) ?? 0;
    const bestCount = best ? (plans.subsByPlan.get(best.id) ?? 0) : -1;
    return count > bestCount ? p : best;
  }, null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
            Comercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Planos</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Valores, benefícios e vínculo com o Stripe.
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          className="h-10 gap-1.5 rounded-full bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo plano
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Package} label="Planos ativos" value={activeCount} />
        <SummaryCard icon={Users} label="Assinaturas ativas" value={totalSubs} />
        <SummaryCard
          icon={CreditCard}
          label="Mais vendido"
          value={bestSeller ? bestSeller.name : "—"}
        />
      </div>

      {/* List */}
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}

        {!isLoading && isError && (
          <Card className="col-span-full rounded-2xl border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive-foreground">
            Não foi possível carregar os planos.
          </Card>
        )}

        {!isLoading &&
          !isError &&
          plans?.plans.map((plan) => (
            <Card
              key={plan.id}
              className={`rounded-2xl border p-4 ${
                plan.active
                  ? "border-white/10 bg-card"
                  : "border-white/5 bg-white/[0.015] opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{plan.name}</p>
                  <p className="text-lg font-bold text-primary">
                    {fmtMoney(Number(plan.monthly_price))}
                    <span className="text-xs font-normal text-muted-foreground">/mês</span>
                  </p>
                </div>
                <Switch checked={plan.active} onCheckedChange={() => toggleActive(plan)} />
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                {plan.washes_per_month} lavagens/mês · {plan.default_duration_minutes} min por
                atendimento
              </p>

              {plan.benefits?.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-foreground/85">
                  {plan.benefits.slice(0, 4).map((b, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" />
                  {plans.subsByPlan.get(plan.id) ?? 0} assinantes
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(plan)}
                  className="h-7 gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
              </div>

              {!plan.stripe_price_id && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Sem Price ID do Stripe — assinaturas via checkout não vão funcionar.
                </div>
              )}
            </Card>
          ))}

        {!isLoading && !isError && plans?.plans.length === 0 && (
          <Card className="col-span-full flex flex-col items-center gap-2 rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <Package className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Nenhum plano configurado</p>
            <p className="text-xs text-muted-foreground">
              Crie o primeiro plano para liberar assinaturas.
            </p>
          </Card>
        )}
      </div>

      <PlanEditorDialog
        target={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-plans"] });
          setEditing(null);
        }}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: number | string;
}) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-1 truncate text-xl font-semibold text-foreground">{value}</div>
    </Card>
  );
}

function PlanEditorDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: Plan | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isNew = target === "new";
  const plan = isNew ? null : target;

  const [name, setName] = useState(plan?.name ?? "");
  const [price, setPrice] = useState(plan?.monthly_price?.toString() ?? "");
  const [washes, setWashes] = useState(plan?.washes_per_month?.toString() ?? "4");
  const [duration, setDuration] = useState(plan?.default_duration_minutes?.toString() ?? "30");
  const [benefits, setBenefits] = useState<string[]>(plan?.benefits ?? []);
  const [newBenefit, setNewBenefit] = useState("");
  const [stripePriceId, setStripePriceId] = useState(plan?.stripe_price_id ?? "");
  const [saving, setSaving] = useState(false);

  // Reset fields whenever a different plan is opened
  const key = isNew ? "new" : (plan?.id ?? "closed");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(plan?.name ?? "");
    setPrice(plan?.monthly_price?.toString() ?? "");
    setWashes(plan?.washes_per_month?.toString() ?? "4");
    setDuration(plan?.default_duration_minutes?.toString() ?? "30");
    setBenefits(plan?.benefits ?? []);
    setNewBenefit("");
    setStripePriceId(plan?.stripe_price_id ?? "");
  }

  const addBenefit = () => {
    const value = newBenefit.trim();
    if (!value) return;
    setBenefits((list) => [...list, value]);
    setNewBenefit("");
  };
  const removeBenefit = (index: number) => {
    setBenefits((list) => list.filter((_, i) => i !== index));
  };
  const moveBenefit = (index: number, dir: -1 | 1) => {
    setBenefits((list) => {
      const next = [...list];
      const target = index + dir;
      if (target < 0 || target >= next.length) return next;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const save = async () => {
    if (!name.trim() || !price) {
      toast.error("Preencha nome e valor mensal.");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      monthly_price: Number(price),
      washes_per_month: Number(washes) || 0,
      default_duration_minutes: Number(duration) || 30,
      benefits,
      stripe_price_id: stripePriceId.trim() || null,
    };
    try {
      if (isNew) {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
        toast.success("Plano criado.");
      } else if (plan) {
        const { error } = await supabase.from("plans").update(payload).eq("id", plan.id);
        if (error) throw error;
        toast.success("Plano atualizado.");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo plano" : `Editar ${plan?.name}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Nome</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Plano Mensal"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="99.90"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lavagens/mês</Label>
              <Input type="number" value={washes} onChange={(e) => setWashes(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs">Duração padrão por atendimento (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Benefícios</Label>
            <div className="flex gap-2">
              <Input
                value={newBenefit}
                onChange={(e) => setNewBenefit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBenefit();
                  }
                }}
                placeholder="Ex: Prioridade na agenda"
              />
              <Button
                type="button"
                onClick={addBenefit}
                disabled={!newBenefit.trim()}
                className="h-10 shrink-0 rounded-xl bg-primary/15 px-3 text-primary hover:bg-primary/25"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {benefits.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {benefits.map((b, i) => (
                  <li
                    key={`${b}-${i}`}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground/90">{b}</span>
                    <button
                      type="button"
                      onClick={() => moveBenefit(i, -1)}
                      disabled={i === 0}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground disabled:opacity-30 hover:bg-white/5 hover:text-foreground"
                      aria-label="Mover para cima"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBenefit(i, 1)}
                      disabled={i === benefits.length - 1}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground disabled:opacity-30 hover:bg-white/5 hover:text-foreground"
                      aria-label="Mover para baixo"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBenefit(i)}
                      className="grid h-6 w-6 place-items-center rounded text-rose-300 hover:bg-rose-400/10"
                      aria-label="Remover benefício"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Nenhum benefício adicionado ainda.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Stripe Price ID</Label>
            <Input
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Necessário para o checkout de assinatura funcionar. Pegue em Stripe → Catálogo de
              produtos → Preço.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={save}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? "Salvando..." : isNew ? "Criar plano" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
