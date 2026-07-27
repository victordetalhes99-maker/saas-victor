import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getClientPaymentsEnv } from "@/lib/payments-env";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogIconHeader,
  DialogFooter,
  DialogBody,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  Trash2,
  PiggyBank,
  Clock,
  Repeat,
  ShoppingBag,
  Wrench,
  Building2,
  Zap,
  Droplet,
  Megaphone,
  Hammer,
  Users,
  Landmark,
  Receipt,
  Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinanceiroPage,
});

type Expense = {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  expense_date: string;
};

const EXPENSE_CATEGORIES = [
  "Produtos",
  "Equipamentos",
  "Aluguel",
  "Energia",
  "Água",
  "Marketing",
  "Manutenção",
  "Salários",
  "Impostos",
  "Outros",
] as const;

const EXPENSE_CATEGORY_ICON: Record<string, any> = {
  Produtos: ShoppingBag,
  Equipamentos: Wrench,
  Aluguel: Building2,
  Energia: Zap,
  Água: Droplet,
  Marketing: Megaphone,
  Manutenção: Hammer,
  Salários: Users,
  Impostos: Landmark,
  Outros: Receipt,
};

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (v: string) => {
  try {
    return format(parseISO(v), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return v;
  }
};

function FinanceiroPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Expense | null>(null);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-finance", monthStart],
    queryFn: async () => {
      const [revenueRes, lastRevenueRes, pendingRes, expensesRes, activeSubsRes] =
        await Promise.all([
          supabase
            .from("payments")
            .select("amount")
            .eq("status", "paid")
            .eq("environment", getClientPaymentsEnv())
            .gte("created_at", monthStart)
            .lte("created_at", monthEnd),
          supabase
            .from("payments")
            .select("amount")
            .eq("status", "paid")
            .eq("environment", getClientPaymentsEnv())
            .gte("created_at", lastMonthStart)
            .lte("created_at", lastMonthEnd),
          supabase
            .from("payments")
            .select("amount")
            .eq("status", "pending")
            .eq("environment", getClientPaymentsEnv()),
          supabase
            .from("expenses")
            .select("*")
            .order("expense_date", { ascending: false })
            .limit(200),
          supabase
            .from("subscriptions")
            .select("id, plans(monthly_price)")
            .eq("environment", getClientPaymentsEnv())
            .in("status", ["active", "trialing"]),
        ]);
      if (revenueRes.error) throw revenueRes.error;
      if (lastRevenueRes.error) throw lastRevenueRes.error;
      if (pendingRes.error) throw pendingRes.error;
      if (expensesRes.error) throw expensesRes.error;
      if (activeSubsRes.error) throw activeSubsRes.error;

      // Realizado: pagamentos já confirmados (status = paid) neste mês.
      const revenue = (revenueRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const lastMonthRevenue = (lastRevenueRes.data ?? []).reduce(
        (s, p) => s + Number(p.amount),
        0,
      );
      const revenueDeltaPct =
        lastMonthRevenue > 0
          ? Math.round(((revenue - lastMonthRevenue) / lastMonthRevenue) * 100)
          : revenue > 0
            ? 100
            : 0;

      // Pendente: cobranças criadas mas ainda não confirmadas — nunca é
      // somado ao resultado, só exibido separadamente.
      const pendingRevenue = (pendingRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      // Previsto: receita recorrente esperada das assinaturas ativas
      // (MRR), que ainda vai gerar cobrança mas não é dinheiro em caixa.
      const forecastMrr = (activeSubsRes.data ?? []).reduce(
        (s, sub: any) => s + Number(sub.plans?.monthly_price ?? 0),
        0,
      );

      const expenses = (expensesRes.data ?? []) as Expense[];
      const monthExpenses = expenses.filter((e) => e.expense_date >= monthStart.slice(0, 10));
      const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const lastMonthExpenses = expenses.filter(
        (e) =>
          e.expense_date >= lastMonthStart.slice(0, 10) && e.expense_date < monthStart.slice(0, 10),
      );
      const lastMonthExpensesTotal = lastMonthExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const expensesDeltaPct =
        lastMonthExpensesTotal > 0
          ? Math.round(((totalExpenses - lastMonthExpensesTotal) / lastMonthExpensesTotal) * 100)
          : totalExpenses > 0
            ? 100
            : 0;

      return {
        revenue,
        revenueDeltaPct,
        pendingRevenue,
        forecastMrr,
        expenses,
        totalExpenses,
        expensesDeltaPct,
      };
    },
  });

  const netResult = (data?.revenue ?? 0) - (data?.totalExpenses ?? 0);

  const removeExpense = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("expenses").delete().eq("id", deleting.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Despesa removida.");
    qc.invalidateQueries({ queryKey: ["admin-finance"] });
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
            Financeiro
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Resultado do mês e despesas operacionais. Transações individuais ficam em Pagamentos.
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="h-10 gap-1.5 rounded-full bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nova despesa
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={TrendingUp}
          label="Receita do mês (realizado)"
          value={fmtMoney(data?.revenue ?? 0)}
          tone="green"
          deltaPct={data?.revenueDeltaPct}
        />
        <SummaryCard
          icon={Clock}
          label="Pendente (não confirmado)"
          value={fmtMoney(data?.pendingRevenue ?? 0)}
          tone="yellow"
        />
        <SummaryCard
          icon={Repeat}
          label="Previsto (MRR ativo)"
          value={fmtMoney(data?.forecastMrr ?? 0)}
          tone="yellow"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Despesas do mês"
          value={fmtMoney(data?.totalExpenses ?? 0)}
          tone="red"
          deltaPct={data?.expensesDeltaPct}
          invertDeltaTone
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Scale}
          label="Resultado líquido (realizado − despesas)"
          value={fmtMoney(netResult)}
          tone={netResult >= 0 ? "green" : "red"}
        />
      </div>

      <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-xs text-muted-foreground">
        <strong className="text-foreground">Realizado</strong> é dinheiro já confirmado pelo Stripe.{" "}
        <strong className="text-foreground">Pendente</strong> são cobranças criadas que ainda
        aguardam confirmação. <strong className="text-foreground">Previsto</strong> é a receita
        recorrente esperada das assinaturas ativas este mês. Nenhum dos dois entra no resultado
        líquido até ser confirmado.
      </p>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Despesas recentes</h2>
        <div className="grid gap-2">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}

          {!isLoading && isError && (
            <Card className="rounded-2xl border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive-foreground">
              Não foi possível carregar as despesas.
            </Card>
          )}

          {!isLoading &&
            !isError &&
            data?.expenses.map((e) => (
              <Card
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-2xl border-white/10 bg-card p-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground">
                    {(() => {
                      const Icon = EXPENSE_CATEGORY_ICON[e.category] ?? Receipt;
                      return <Icon className="h-4 w-4" />;
                    })()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.category}
                      {e.description ? ` — ${e.description}` : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{fmtDate(e.expense_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-rose-300">
                    -{fmtMoney(Number(e.amount))}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(e)}
                    className="h-7 w-7 rounded-full p-0 text-muted-foreground hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}

          {!isLoading && !isError && data?.expenses.length === 0 && (
            <Card className="flex flex-col items-center gap-2 rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
              <PiggyBank className="h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Nenhuma despesa registrada</p>
              <p className="text-xs text-muted-foreground">Cadastre a primeira despesa do mês.</p>
            </Card>
          )}
        </div>
      </div>

      <NewExpenseDialog
        open={creating}
        onOpenChange={setCreating}
        createdBy={user?.id ?? null}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-finance"] });
          setCreating(false);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleting?.category}" de {deleting ? fmtMoney(Number(deleting.amount)) : ""} será
              removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeExpense}
              className="bg-rose-500 text-white hover:bg-rose-500/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  deltaPct,
  invertDeltaTone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: "green" | "yellow" | "red";
  deltaPct?: number;
  invertDeltaTone?: boolean;
}) {
  const toneClass =
    tone === "green" ? "text-emerald-300" : tone === "yellow" ? "text-amber-300" : "text-rose-300";
  const deltaPositive = invertDeltaTone ? (deltaPct ?? 0) <= 0 : (deltaPct ?? 0) >= 0;
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${toneClass}`} />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`truncate text-xl font-semibold ${toneClass}`}>{value}</span>
        {typeof deltaPct === "number" && deltaPct !== 0 && (
          <span
            className={`text-[11px] font-medium ${deltaPositive ? "text-emerald-300" : "text-rose-300"}`}
          >
            {deltaPct > 0 ? "+" : ""}
            {deltaPct}% vs mês anterior
          </span>
        )}
      </div>
    </Card>
  );
}

function NewExpenseDialog({
  open,
  onOpenChange,
  createdBy,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  createdBy: string | null;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!category.trim() || !amount) {
      toast.error("Preencha categoria e valor.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("expenses").insert({
        category: category.trim(),
        description: description.trim() || null,
        amount: Number(amount),
        expense_date: date,
        created_by: createdBy,
      });
      if (error) throw error;
      toast.success("Despesa cadastrada.");
      setCategory("");
      setDescription("");
      setAmount("");
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar a despesa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px]">
        <DialogIconHeader
          icon={Wallet}
          title="Nova despesa"
          description="Registre uma nova saída financeira"
        />
        <DialogBody>
          <div>
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => {
                  const Icon = EXPENSE_CATEGORY_ICON[c];
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {c}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Input
              className="mt-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                className="mt-2"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input
                className="mt-2"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-14 rounded-[18px] border border-white/[0.08] bg-[linear-gradient(145deg,oklch(1_0_0/0.055),oklch(1_0_0/0.025))] text-[15px] font-semibold text-foreground hover:bg-white/[0.08]"
          >
            Cancelar
          </Button>
          <Button
            disabled={saving}
            onClick={save}
            className="h-14 rounded-[18px] bg-[linear-gradient(135deg,#4cf278,#63e987)] text-[15px] font-semibold text-[#07130b] shadow-[0_0_30px_rgba(71,255,125,0.34),0_12px_30px_rgba(37,220,94,0.20),inset_0_1px_0_rgba(255,255,255,0.38)] transition-all hover:brightness-105 active:scale-[0.98]"
          >
            {saving ? "Salvando..." : "Cadastrar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
