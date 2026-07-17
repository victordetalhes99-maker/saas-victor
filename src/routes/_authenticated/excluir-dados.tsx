import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/excluir-dados")({
  component: DeleteDataPage,
  head: () => ({
    meta: [{ title: "Excluir meus dados — Clube Detail" }],
  }),
});

function DeleteDataPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: requests } = useQuery({
    queryKey: ["my-deletion-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_deletion_requests")
        .select("id, status, reason, admin_note, created_at, decided_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const hasPending = (requests ?? []).some((r) => r.status === "pending");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("data_deletion_requests").insert({
        user_id: user.id,
        reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success("Solicitação enviada. Nossa equipe analisará em até 15 dias.");
      setReason("");
      qc.invalidateQueries({ queryKey: ["my-deletion-requests"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Não foi possível registrar sua solicitação.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-5 px-1 py-2">
      <header>
        <p className="text-[11px] uppercase tracking-[0.22em] text-primary/80">
          LGPD · Direito do titular
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Excluir meus dados</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você tem o direito de solicitar a exclusão dos seus dados pessoais (art. 18 da LGPD). Seu
          pedido será analisado em até 15 dias. Dados exigidos por lei (ex: registros fiscais de
          pagamento) podem ser <strong>anonimizados</strong> em vez de apagados.
        </p>
      </header>

      <Card className="rounded-[22px] border-amber-400/30 bg-amber-400/5 p-4">
        <div className="flex gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-300" />
          <div className="text-sm text-amber-100/90">
            <p className="font-medium">Antes de prosseguir</p>
            <p className="mt-1 text-amber-100/70">
              A exclusão é definitiva. Você perderá histórico de agendamentos, plano ativo e acesso
              ao app. Recomendamos{" "}
              <Link to="/privacidade" className="underline">
                ler a Política de Privacidade
              </Link>{" "}
              antes.
            </p>
          </div>
        </div>
      </Card>

      <Card className="rounded-[22px] border-white/10 bg-card p-5">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">
              Motivo (opcional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Conte-nos por que está saindo. Isso nos ajuda a melhorar."
              maxLength={500}
              rows={4}
            />
          </div>
          <Button
            type="submit"
            disabled={busy || hasPending}
            className="w-full bg-rose-500/90 text-white hover:bg-rose-500"
          >
            {hasPending
              ? "Você já tem uma solicitação em análise"
              : busy
                ? "Enviando..."
                : "Solicitar exclusão dos meus dados"}
          </Button>
        </form>
      </Card>

      {(requests?.length ?? 0) > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Suas solicitações</h2>
          <div className="space-y-2">
            {requests!.map((r) => (
              <Card key={r.id} className="rounded-2xl border-white/10 bg-white/[0.02] p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                      r.status === "pending"
                        ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                        : r.status === "approved"
                          ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                          : r.status === "rejected"
                            ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                            : "border-white/10 bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {labelStatus(r.status)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                {r.reason && <p className="mt-2 text-muted-foreground">{r.reason}</p>}
                {r.admin_note && (
                  <p className="mt-2 rounded-md border border-white/10 bg-white/[0.03] p-2 text-xs">
                    <strong>Resposta da equipe:</strong> {r.admin_note}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function labelStatus(s: string) {
  return (
    (
      {
        pending: "Em análise",
        approved: "Aprovada",
        rejected: "Recusada",
        completed: "Concluída",
      } as Record<string, string>
    )[s] ?? s
  );
}
