import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserPlus, ShieldAlert, Check, X, Inbox, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/admin/solicitacoes")({
  component: SolicitacoesPage,
});

const fmtDateTime = (v?: string | null) => {
  if (!v) return "—";
  try {
    return format(typeof v === "string" ? parseISO(v) : v, "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
};

type Tab = "cadastros" | "exclusao";

function SolicitacoesPage() {
  const [tab, setTab] = useState<Tab>("cadastros");
  const { user } = useAuth();
  const qc = useQueryClient();

  const {
    data: pendingProfiles,
    isLoading: loadingProfiles,
    isError: errorProfiles,
  } = useQuery({
    queryKey: ["admin-pending-signups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, created_at, status")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: deletionRequests,
    isLoading: loadingDeletion,
    isError: errorDeletion,
  } = useQuery({
    queryKey: ["admin-deletion-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_deletion_requests")
        .select("id, user_id, reason, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profilesData } = userIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
        : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
      const byId = new Map((profilesData ?? []).map((p) => [p.id, p]));
      return rows.map((r) => ({
        ...r,
        profiles: byId.get(r.user_id) ?? null,
      }));
    },
  });

  const pendingCount = pendingProfiles?.length ?? 0;
  const deletionCount = deletionRequests?.length ?? 0;

  // ---- Approve / reject signup -------------------------------------------
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const approveSignup = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "active",
          approved_at: new Date().toISOString(),
          approved_by: user?.id ?? null,
          rejection_reason: null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Cadastro aprovado. O cliente já pode acessar a conta.");
      qc.invalidateQueries({ queryKey: ["admin-pending-signups"] });
      qc.invalidateQueries({ queryKey: ["admin-clients-monitor"] });
      qc.invalidateQueries({ queryKey: ["admin-home-overview"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível aprovar o cadastro.");
    } finally {
      setBusyId(null);
    }
  };

  const rejectSignup = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          status: "blocked",
          blocked_at: new Date().toISOString(),
          blocked_by: user?.id ?? null,
          blocked_reason: rejectReason.trim() || "Cadastro recusado pela administração.",
          rejection_reason: rejectReason.trim() || "Não informado",
        })
        .eq("id", rejectTarget.id);
      if (error) throw error;
      toast.success("Cadastro recusado.");
      qc.invalidateQueries({ queryKey: ["admin-pending-signups"] });
      qc.invalidateQueries({ queryKey: ["admin-clients-monitor"] });
      setRejectTarget(null);
      setRejectReason("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível recusar o cadastro.");
    } finally {
      setBusyId(null);
    }
  };

  // ---- Deletion requests ---------------------------------------------------
  const [deletionDecision, setDeletionDecision] = useState<{
    id: string;
    kind: "approved" | "rejected";
    name: string;
  } | null>(null);
  const [deletionNote, setDeletionNote] = useState("");

  const decideDeletion = async () => {
    if (!deletionDecision) return;
    setBusyId(deletionDecision.id);
    try {
      const { error } = await supabase
        .from("data_deletion_requests")
        .update({
          status: deletionDecision.kind,
          decided_at: new Date().toISOString(),
          decided_by: user?.id ?? null,
          admin_note: deletionNote.trim() || null,
        })
        .eq("id", deletionDecision.id);
      if (error) throw error;
      toast.success(
        deletionDecision.kind === "approved"
          ? "Solicitação aprovada. Prossiga com a exclusão/anonimização manual dos dados conforme a política de retenção."
          : "Solicitação recusada.",
      );
      qc.invalidateQueries({ queryKey: ["admin-deletion-requests"] });
      setDeletionDecision(null);
      setDeletionNote("");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar a decisão.");
    } finally {
      setBusyId(null);
    }
  };

  const tabs = useMemo(
    () => [
      { id: "cadastros" as Tab, label: "Cadastros pendentes", count: pendingCount, icon: UserPlus },
      {
        id: "exclusao" as Tab,
        label: "Exclusão de dados",
        count: deletionCount,
        icon: ShieldAlert,
      },
    ],
    [pendingCount, deletionCount],
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
          Operação
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Solicitações</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Cadastros novos e pedidos de exclusão de dados aguardando decisão.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:border-white/20 hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  active ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cadastros pendentes */}
      {tab === "cadastros" && (
        <div className="grid gap-3">
          {loadingProfiles &&
            [0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}

          {!loadingProfiles && errorProfiles && (
            <ErrorCard label="Não foi possível carregar os cadastros pendentes." />
          )}

          {!loadingProfiles &&
            !errorProfiles &&
            pendingProfiles?.map((p) => (
              <Card
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-white/10 bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {p.full_name || p.email || "Cliente"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>✉ {p.email ?? "—"}</span>
                    <span>☎ {p.phone ?? "—"}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtDateTime(p.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === p.id}
                    onClick={() => approveSignup(p.id)}
                    className="h-8 gap-1.5 rounded-full bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === p.id}
                    onClick={() =>
                      setRejectTarget({ id: p.id, name: p.full_name || p.email || "" })
                    }
                    className="h-8 gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 text-xs text-rose-200 hover:bg-rose-400/20"
                  >
                    <X className="h-3.5 w-3.5" />
                    Recusar
                  </Button>
                </div>
              </Card>
            ))}

          {!loadingProfiles && !errorProfiles && pendingProfiles?.length === 0 && (
            <EmptyCard
              icon={UserPlus}
              title="Nenhum cadastro pendente"
              description="Novos clientes aguardando aprovação vão aparecer aqui."
            />
          )}
        </div>
      )}

      {/* Exclusão de dados */}
      {tab === "exclusao" && (
        <div className="grid gap-3">
          {loadingDeletion &&
            [0, 1].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.03]" />
            ))}

          {!loadingDeletion && errorDeletion && (
            <ErrorCard label="Não foi possível carregar as solicitações de exclusão." />
          )}

          {!loadingDeletion &&
            !errorDeletion &&
            deletionRequests?.map((r) => (
              <Card key={r.id} className="rounded-2xl border-white/10 bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.profiles?.full_name || r.profiles?.email || "Cliente"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Solicitado em {fmtDateTime(r.created_at)}
                    </p>
                    {r.reason && (
                      <p className="mt-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs text-muted-foreground">
                        “{r.reason}”
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      disabled={busyId === r.id}
                      onClick={() =>
                        setDeletionDecision({
                          id: r.id,
                          kind: "approved",
                          name: r.profiles?.full_name || r.profiles?.email || "",
                        })
                      }
                      className="h-8 gap-1.5 rounded-full bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === r.id}
                      onClick={() =>
                        setDeletionDecision({
                          id: r.id,
                          kind: "rejected",
                          name: r.profiles?.full_name || r.profiles?.email || "",
                        })
                      }
                      className="h-8 gap-1.5 rounded-full border border-rose-400/30 bg-rose-400/10 px-3 text-xs text-rose-200 hover:bg-rose-400/20"
                    >
                      <X className="h-3.5 w-3.5" />
                      Recusar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

          {!loadingDeletion && !errorDeletion && deletionRequests?.length === 0 && (
            <EmptyCard
              icon={ShieldAlert}
              title="Nenhuma solicitação de exclusão"
              description="Pedidos de exclusão de dados (LGPD) aparecerão aqui para análise."
            />
          )}
        </div>
      )}

      {/* Reject signup dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="rounded-2xl border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar cadastro de {rejectTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              O motivo é obrigatório e fica registrado no histórico do cliente.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explique o motivo da recusa..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              disabled={!rejectReason.trim() || busyId === rejectTarget?.id}
              onClick={rejectSignup}
              className="bg-rose-500 text-white hover:bg-rose-500/90"
            >
              Confirmar recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deletion decision dialog */}
      <Dialog open={!!deletionDecision} onOpenChange={(o) => !o && setDeletionDecision(null)}>
        <DialogContent className="rounded-2xl border-white/10 bg-card sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {deletionDecision?.kind === "approved" ? "Aprovar" : "Recusar"} exclusão de dados de{" "}
              {deletionDecision?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {deletionDecision?.kind === "approved" && (
              <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-xs text-amber-100">
                Aprovar marca a solicitação como aceita. A exclusão/anonimização definitiva dos
                dados deve ser executada manualmente conforme a política de retenção da empresa.
              </p>
            )}
            <Textarea
              value={deletionNote}
              onChange={(e) => setDeletionNote(e.target.value)}
              placeholder="Observação interna (opcional)..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeletionDecision(null)}>
              Cancelar
            </Button>
            <Button
              disabled={busyId === deletionDecision?.id}
              onClick={decideDeletion}
              className={
                deletionDecision?.kind === "approved"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-rose-500 text-white hover:bg-rose-500/90"
              }
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyCard({
  icon: Icon,
  title,
  description,
}: {
  icon: any;
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 rounded-2xl border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/50" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </Card>
  );
}

function ErrorCard({ label }: { label: string }) {
  return (
    <Card className="flex items-center gap-2 rounded-2xl border-destructive/20 bg-destructive/5 p-4">
      <Inbox className="h-4 w-4 text-destructive-foreground" />
      <p className="text-sm text-destructive-foreground">{label}</p>
    </Card>
  );
}
