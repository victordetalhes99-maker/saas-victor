import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listInvites, resendInvite, revokeInvite } from "@/lib/invites.functions";
import { createClientByAdmin } from "@/lib/admin.functions";
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
import { ArrowLeft, Mail, Send, UserPlus, XCircle, Copy } from "lucide-react";
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

function ConvitesPage() {
  const qc = useQueryClient();
  const createFn = useServerFn(createClientByAdmin);
  const listFn = useServerFn(listInvites);
  const resendFn = useServerFn(resendInvite);
  const revokeFn = useServerFn(revokeInvite);

  const { data: plans } = useQuery({
    queryKey: ["admin-convites-plans"],
    queryFn: async () => (await supabase.from("plans").select("id, name")).data ?? [],
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

  const invites = invitesData?.invites ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/clientes"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para clientes
        </Link>
        <h1 className="mt-2 text-display text-3xl tracking-tight text-foreground">
          Convites e cadastro manual
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Crie um acesso de cliente diretamente (sem passar pelo checkout do Stripe) ou acompanhe
          convites já enviados.
        </p>
      </div>

      <Card className="rounded-3xl border-white/10 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Criar cliente manualmente</h2>
        </div>
        <form onSubmit={submitCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Nome completo"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            required
            minLength={2}
          />
          <Input
            placeholder="E-mail"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
          />
          <Input
            placeholder="Telefone (opcional)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Select value={form.planId} onValueChange={(v) => setForm((f) => ({ ...f, planId: v }))}>
            <SelectTrigger>
              <SelectValue placeholder="Plano (opcional)" />
            </SelectTrigger>
            <SelectContent>
              {(plans ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={creating} className="sm:col-span-2 lg:col-span-4">
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
        <div className="mb-4 flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Convites enviados</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum convite enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {invites.map((inv: any) => (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3"
              >
                <div>
                  <p className="text-sm font-medium">{inv.full_name || inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.email} ·{" "}
                    {inv.created_at
                      ? format(new Date(inv.created_at), "dd MMM yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs font-medium text-muted-foreground">
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
                      >
                        <Send className="mr-1 h-3.5 w-3.5" /> Reenviar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busyId === inv.id}
                          >
                            <XCircle className="mr-1 h-3.5 w-3.5 text-destructive" /> Revogar
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revogar convite de {inv.email}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              O link enviado deixará de funcionar. Você pode criar um novo convite
                              depois, se necessário.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => revoke(inv.id)}>
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
