import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { TrendingUp, TrendingDown, Scale, Plus, Trash2, PiggyBank } from "lucide-react";
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

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-finance", monthStart],
    queryFn: async () => {
      const [revenueRes, expensesRes] = await Promise.all([
        supabase
          .from("payments")
          .select("amount")
          .eq("status", "paid")
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
        supabase
          .from("expenses")
          .select("*")
          .order("expense_date", { ascending: false })
          .limit(100),
      ]);
      if (revenueRes.error) throw revenueRes.error;
      if (expensesRes.error) throw expensesRes.error;
      const revenue = (revenueRes.data ?? []).reduce((s, p) => s + Number(p.amount), 0);
      const expenses = (expensesRes.data ?? []) as Expense[];
      const monthExpenses = expenses.filter((e) => e.expense_date >= monthStart.slice(0, 10));
      const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
      return { revenue, expenses, totalExpenses };
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

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={TrendingUp}
          label="Receita do mês"
          value={fmtMoney(data?.revenue ?? 0)}
          tone="green"
        />
        <SummaryCard
          icon={TrendingDown}
          label="Despesas do mês"
          value={fmtMoney(data?.totalExpenses ?? 0)}
          tone="red"
        />
        <SummaryCard
          icon={Scale}
          label="Resultado líquido"
          value={fmtMoney(netResult)}
          tone={netResult >= 0 ? "green" : "red"}
        />
      </div>

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
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {e.category}
                    {e.description ? ` — ${e.description}` : ""}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{fmtDate(e.expense_date)}</p>
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
        <AlertDialogContent className="rounded-2xl border-white/10 bg-card">
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
}: {
  icon: any;
  label: string;
  value: string;
  tone: "green" | "red";
}) {
  return (
    <Card className="rounded-2xl border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        <Icon
          className={`h-3.5 w-3.5 ${tone === "green" ? "text-emerald-300" : "text-rose-300"}`}
        />
        {label}
      </div>
      <div
        className={`mt-1 truncate text-xl font-semibold ${
          tone === "green" ? "text-emerald-300" : "text-rose-300"
        }`}
      >
        {value}
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
      <DialogContent className="rounded-2xl border-white/10 bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova despesa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Produtos de limpeza"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
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
            {saving ? "Salvando..." : "Cadastrar despesa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
