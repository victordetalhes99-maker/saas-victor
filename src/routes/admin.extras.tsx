import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Sparkles, Plus, Pencil, Clock, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/admin/extras")({
  component: ExtrasPage,
});

type Extra = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  active: boolean;
  sort_order: number;
};

const fmtMoney = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function ExtrasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Extra | "new" | null>(null);
  const [deleting, setDeleting] = useState<Extra | null>(null);

  const {
    data: extras,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-extras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extra_services")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Extra[];
    },
  });

  const toggleActive = async (extra: Extra) => {
    const { error } = await supabase
      .from("extra_services")
      .update({ active: !extra.active })
      .eq("id", extra.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(extra.active ? "Extra desativado." : "Extra ativado.");
    qc.invalidateQueries({ queryKey: ["admin-extras"] });
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("extra_services").delete().eq("id", deleting.id);
    if (error) {
      toast.error(
        error.message.includes("foreign key")
          ? "Este extra já foi usado em agendamentos e não pode ser excluído. Desative em vez de excluir."
          : error.message,
      );
      setDeleting(null);
      return;
    }
    toast.success("Extra excluído.");
    qc.invalidateQueries({ queryKey: ["admin-extras"] });
    setDeleting(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
            Comercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Extras</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Serviços adicionais cobrados à parte, com preço e duração próprios.
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          className="h-10 gap-1.5 rounded-full bg-primary px-4 text-sm text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Novo extra
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white/[0.03]" />
          ))}

        {!isLoading && isError && (
          <Card className="col-span-full rounded-2xl border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive-foreground">
            Não foi possível carregar os extras.
          </Card>
        )}

        {!isLoading &&
          !isError &&
          extras?.map((extra) => (
            <Card
              key={extra.id}
              className={`rounded-2xl border p-4 ${
                extra.active
                  ? "border-white/10 bg-card"
                  : "border-white/5 bg-white/[0.015] opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{extra.name}</p>
                  <p className="text-base font-bold text-primary">{fmtMoney(extra.price_cents)}</p>
                </div>
                <Switch checked={extra.active} onCheckedChange={() => toggleActive(extra)} />
              </div>
              {extra.description && (
                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {extra.description}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />+{extra.duration_minutes} min no atendimento
              </p>
              <div className="mt-3 flex justify-end gap-1.5 border-t border-white/[0.06] pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditing(extra)}
                  className="h-7 gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                >
                  <Pencil className="h-3 w-3" />
                  Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleting(extra)}
                  className="h-7 gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 text-[11px] text-rose-200 hover:bg-rose-400/20"
                >
                  <Trash2 className="h-3 w-3" />
                  Excluir
                </Button>
              </div>
            </Card>
          ))}

        {!isLoading && !isError && extras?.length === 0 && (
          <Card className="col-span-full flex flex-col items-center gap-2 rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Nenhum extra cadastrado</p>
            <p className="text-xs text-muted-foreground">
              Crie serviços adicionais para vender junto com os agendamentos.
            </p>
          </Card>
        )}
      </div>

      <ExtraEditorDialog
        target={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-extras"] });
          setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Se este extra já foi usado em algum agendamento, não
              será possível excluir — desative em vez disso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-500 text-white hover:bg-rose-500/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExtraEditorDialog({
  target,
  onOpenChange,
  onSaved,
}: {
  target: Extra | "new" | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isNew = target === "new";
  const extra = isNew ? null : target;

  const [name, setName] = useState(extra?.name ?? "");
  const [description, setDescription] = useState(extra?.description ?? "");
  const [price, setPrice] = useState(extra ? (extra.price_cents / 100).toString() : "");
  const [duration, setDuration] = useState(extra?.duration_minutes?.toString() ?? "10");
  const [saving, setSaving] = useState(false);

  const key = isNew ? "new" : (extra?.id ?? "closed");
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) {
    setLastKey(key);
    setName(extra?.name ?? "");
    setDescription(extra?.description ?? "");
    setPrice(extra ? (extra.price_cents / 100).toString() : "");
    setDuration(extra?.duration_minutes?.toString() ?? "10");
  }

  const save = async () => {
    if (!name.trim() || !price) {
      toast.error("Preencha nome e preço.");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase.from("extra_services").insert({
          name: name.trim(),
          slug: slugify(name),
          description: description.trim() || null,
          price_cents: Math.round(Number(price) * 100),
          duration_minutes: Number(duration) || 0,
        });
        if (error) throw error;
        toast.success("Extra criado.");
      } else if (extra) {
        const { error } = await supabase
          .from("extra_services")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            price_cents: Math.round(Number(price) * 100),
            duration_minutes: Number(duration) || 0,
          })
          .eq("id", extra.id);
        if (error) throw error;
        toast.success("Extra atualizado.");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível salvar o extra.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo extra" : `Editar ${extra?.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Higienização de bancos"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Duração extra (min)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
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
            {saving ? "Salvando..." : isNew ? "Criar extra" : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
