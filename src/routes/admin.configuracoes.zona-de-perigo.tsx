import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { setEmergencyMode } from "@/lib/config.functions";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// A coluna emergency_mode (e emergency_mode_at/by/reason) já existia em
// company_settings, mas esta página era apenas um placeholder e nada no
// sistema lia essas colunas — ativar o "modo de emergência" não tinha
// efeito nenhum. Agora a RPC create_client_appointment bloqueia novos
// agendamentos quando emergency_mode = true (ver migration
// 20260725000000_enforce_booking_rules.sql), e esta tela liga/desliga o
// modo real, através de uma server function restrita ao Owner.

export const Route = createFileRoute("/admin/configuracoes/zona-de-perigo")({
  component: DangerZonePage,
});

type CompanyEmergency = {
  emergency_mode: boolean;
  emergency_mode_at: string | null;
  emergency_mode_by: string | null;
  emergency_mode_reason: string | null;
};

async function fetchEmergencyState(): Promise<CompanyEmergency | null> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("emergency_mode, emergency_mode_at, emergency_mode_by, emergency_mode_reason")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

function DangerZonePage() {
  const qc = useQueryClient();
  const toggleFn = useServerFn(setEmergencyMode);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data } = useQuery({
    queryKey: ["company-emergency-mode"],
    queryFn: fetchEmergencyState,
  });

  const active = data?.emergency_mode ?? false;

  const activate = async () => {
    setBusy(true);
    try {
      await toggleFn({ data: { enabled: true, reason: reason.trim() || undefined } });
      toast.success("Modo de emergência ativado. Novos agendamentos foram pausados.");
      setReason("");
      await qc.invalidateQueries({ queryKey: ["company-emergency-mode"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao ativar modo de emergência.");
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    setBusy(true);
    try {
      await toggleFn({ data: { enabled: false } });
      toast.success("Modo de emergência desativado. Agendamentos normalizados.");
      await qc.invalidateQueries({ queryKey: ["company-emergency-mode"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao desativar modo de emergência.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-destructive/80">
          Perigo
        </p>
        <h1 className="text-display text-3xl tracking-tight text-foreground">Zona de perigo</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ações sensíveis e de impacto imediato no negócio. Apenas o Owner pode executá-las.
        </p>
      </div>

      <Card className="rounded-3xl border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="flex-1 space-y-2">
            <h2 className="text-sm font-semibold">Modo de emergência</h2>
            <p className="text-sm text-muted-foreground">
              Pausa imediatamente a criação de novos agendamentos por todos os clientes (útil em
              casos de falta de água, energia, equipe reduzida, etc). Agendamentos já existentes não
              são afetados.
            </p>

            {active ? (
              <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" /> Ativo desde{" "}
                  {data?.emergency_mode_at
                    ? format(new Date(data.emergency_mode_at), "dd MMM yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })
                    : "—"}
                </p>
                {data?.emergency_mode_reason && (
                  <p className="text-sm text-muted-foreground">
                    Motivo: {data.emergency_mode_reason}
                  </p>
                )}
                <Button variant="outline" onClick={deactivate} disabled={busy}>
                  {busy ? "Desativando..." : "Desativar modo de emergência"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  placeholder="Motivo (opcional, fica registrado no log)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={busy}>
                      Ativar modo de emergência
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Pausar todos os novos agendamentos?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Nenhum cliente conseguirá criar novos agendamentos até você desativar isso
                        manualmente. Agendamentos já confirmados continuam normalmente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={activate}>Ativar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
