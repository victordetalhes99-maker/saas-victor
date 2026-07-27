import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listInvites, resendInvite, revokeInvite } from "@/lib/invites.functions";
import { createClientByAdmin } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Mail,
  Send,
  UserPlus,
  XCircle,
  Copy,
  Clock,
  CheckCircle2,
  Ban,
  User,
  Phone,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Ambos os fluxos abaixo (criação manual de cliente e gestão de convites)
// já tinham funções de servidor prontas e protegidas por papel admin/owner
// (createClientByAdmin, listInvites, resendInvite, revokeInvite), mas
// nenhuma tela em todo o projeto as chamava. Esta página conecta as duas.

export const Route = createFileRoute("/admin/convites")({
  component: ConvitesPage,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  used: "Ativado",
  revoked: "Revogado",
  expired: "Expirado",
};

const STATUS_TONE: Record<string, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  used: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  revoked: "border-rose-400/30 bg-rose-400/10 text-rose-200",
  expired: "border-white/10 bg-white/5 text-muted-foreground",
};

const fmtMoney = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ConvitesPage() {
  const qc = useQueryClient();
  const createFn = useServerFn(createClientByAdmin);
  const listFn = useServerFn(listInvites);
  const resendFn = useServerFn(resendInvite);
  const revokeFn = useServerFn(revokeInvite);

  const { data: plans } = useQuery({
    queryKey: ["admin-convites-plans"],
    queryFn: async () =>
      (await supabase.from("plans").select("id, name, monthly_price, washes_per_month, benefits"))
        .data ?? [],
  });

  const { data: invitesData, isLoading } = useQuery({
    queryKey: ["admin-invites"],
    queryFn: () => listFn(),
  });

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", planId: "" });
  const [creating, setCreating] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidateInvites = () => qc.invalidateQueries({ queryKey: ["admin-invites"] });

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setLastLink(null);
    try {
      const result = await createFn({
        data: {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          planId: form.planId || undefined,
        },
      });
      toast.success("Cliente criado/aprovado.");
      if (result.activationLink) {
        setLastLink(result.activationLink);
      }
      setForm({ fullName: "", email: "", phone: "", planId: "" });
      await invalidateInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar cliente.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    if (!lastLink) return;
    try {
      await navigator.clipboard.writeText(lastLink);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar automaticamente. Selecione o link manualmente.");
    }
  };

  const resend = async (inviteId: string) => {
    setBusyId(inviteId);
    try {
      await resendFn({ data: { inviteId } });
      toast.success("Convite reenviado.");
      await invalidateInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reenviar convite.");
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (inviteId: string) => {
    setBusyId(inviteId);
    try {
      await revokeFn({ data: { inviteId } });
      toast.success("Convite revogado.");
      await invalidateInvites();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao revogar convite.");
    } finally {
      setBusyId(null);
    }
  };

  const invites = useMemo(() => invitesData?.invites ?? [], [invitesData]);

  const selectedPlan = useMemo(
    () => (plans ?? []).find((p) => p.id === form.planId) ?? null,
    [plans, form.planId],
  );

  const stats = useMemo(() => {
    const pending = invites.filter((i: any) => i.effective_status === "pending").length;
    const used = invites.filter((i: any) => i.effective_status === "used").length;
    const expiredOrRevoked = invites.filter((i: any) =>
      ["expired", "revoked"].includes(i.effective_status),
    ).length;
    return { pending, used, expiredOrRevoked, total: invites.length };
  }, [invites]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
        </Link>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
          Administração
        </p>
        <h1 className="text-display text-3xl tracking-tight text-foreground">
          Convites e cadastro manual
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Crie um acesso de cliente diretamente (sem passar pelo checkout do Stripe) ou acompanhe
          convites já enviados.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={Clock} label="Convites pendentes" value={stats.pending} tone="yellow" />
        <SummaryCard icon={CheckCircle2} label="Ativados" value={stats.used} tone="green" />
        <SummaryCard
          icon={Ban}
          label="Expirados/revogados"
          value={stats.expiredOrRevoked}
          tone="red"
        />
      </div>

      <Card id="criar-cliente-card" className="rounded-3xl border-white/10 bg-card p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <UserPlus className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Criar cliente manualmente</h2>
            <p className="text-xs text-muted-foreground">
              Ideal para clientes cadastrados por telefone, WhatsApp ou balcão.
            </p>
          </div>
        </div>
        <p className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
          O cadastro manual aprova o cliente diretamente, sem passar pelo fluxo público de cadastro
          e aprovação.
        </p>
        <form onSubmit={submitCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FieldWithIcon icon={User} label="Nome completo">
            <Input
              id="cliente-fullname-input"
              placeholder="Nome do cliente"
              value={form.fullName}
              onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              required
              minLength={2}
              className="border-white/10 bg-white/[0.03]"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={Mail} label="E-mail">
            <Input
              placeholder="cliente@email.com"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="border-white/10 bg-white/[0.03]"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={Phone} label="Telefone (opcional)">
            <Input
              placeholder="(00) 00000-0000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="border-white/10 bg-white/[0.03]"
            />
          </FieldWithIcon>
          <FieldWithIcon icon={Package} label="Plano (opcional)">
            <Select
              value={form.planId}
              onValueChange={(v) => setForm((f) => ({ ...f, planId: v }))}
            >
              <SelectTrigger className="border-white/10 bg-white/[0.03]">
                <SelectValue placeholder="Selecionar plano" />
              </SelectTrigger>
              <SelectContent>
                {(plans ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldWithIcon>

          {selectedPlan && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 sm:col-span-2 lg:col-span-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Package className="h-3.5 w-3.5 text-primary" />
                {selectedPlan.name}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtMoney(Number(selectedPlan.monthly_price))}/mês · {selectedPlan.washes_per_month}{" "}
                lavagens por mês
              </p>
              {selectedPlan.benefits?.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {selectedPlan.benefits.slice(0, 4).map((b: string) => (
                    <li
                      key={b}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={creating}
            className="h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 sm:col-span-2 lg:col-span-4"
          >
            {creating ? "Criando..." : "Criar / aprovar cliente"}
          </Button>
        </form>
        {lastLink && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
            <span className="text-muted-foreground">
              Link de definição de senha (envie manualmente ao cliente):
            </span>
            <code className="max-w-full truncate text-xs">{lastLink}</code>
            <Button type="button" variant="ghost" size="sm" onClick={copyLink}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
        )}
      </Card>

      <Card className="rounded-3xl border-white/10 bg-card p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">Convites enviados</h2>
        </div>

        {isLoading && (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}
          </div>
        )}

        {!isLoading && invites.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 bg-[radial-gradient(60%_80%_at_50%_0%,oklch(0.85_0.22_145/0.05),transparent)] py-10 text-center">
            <Mail className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Nenhum convite enviado ainda</p>
            <p className="text-xs text-muted-foreground">
              Convites aparecem aqui assim que você criar um cliente com plano vinculado.
            </p>
            <button
              type="button"
              onClick={() => {
                document
                  .getElementById("criar-cliente-card")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                document.getElementById("cliente-fullname-input")?.focus();
              }}
              className="mt-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
            >
              Criar o primeiro cliente
            </button>
          </div>
        )}

        {!isLoading && invites.length > 0 && (
          <div className="space-y-2">
            {invites.map((inv: any) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {inv.full_name || inv.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inv.email} ·{" "}
                    {inv.created_at
                      ? format(new Date(inv.created_at), "dd MMM yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      STATUS_TONE[inv.effective_status] ??
                      "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {STATUS_LABEL[inv.effective_status] ?? inv.effective_status}
                  </span>
                  {inv.effective_status !== "used" && inv.effective_status !== "revoked" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busyId === inv.id}
                        onClick={() => resend(inv.id)}
                        className="h-7 gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 text-[11px]"
                      >
                        <Send className="h-3 w-3" /> Reenviar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busyId === inv.id}
                            className="h-7 gap-1 rounded-full border border-rose-400/30 bg-rose-400/10 px-2.5 text-[11px] text-rose-200 hover:bg-rose-400/20"
                          >
                            <XCircle className="h-3 w-3" /> Revogar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-2xl border-white/10 bg-card">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar convite de {inv.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O link enviado deixará de funcionar. Você pode criar um novo convite
                              depois, se necessário.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => revoke(inv.id)}
                              className="bg-rose-500 text-white hover:bg-rose-500/90"
                            >
                              Revogar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
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
  value: number;
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
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </Card>
  );
}

function FieldWithIcon({
  icon: Icon,
  label,
  children,
}: {
  icon: any;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </Label>
      {children}
    </div>
  );
}
