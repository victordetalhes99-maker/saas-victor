import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CalendarDays,
  Clock,
  CalendarClock,
  RefreshCw,
  Ban,
  Save,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { updateAgendaRules } from "@/lib/config.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/configuracoes/agenda")({
  component: AgendaConfigPage,
});

type Rules = {
  min_booking_lead_minutes: number;
  cancellation_deadline_hours: number;
  allow_walkins: boolean;
  allow_reschedule: boolean;
};

const DEFAULT: Rules = {
  min_booking_lead_minutes: 60,
  cancellation_deadline_hours: 12,
  allow_walkins: true,
  allow_reschedule: true,
};

function AgendaConfigPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const iAmOwner = roles?.includes("owner") ?? false;
  const save = useServerFn(updateAgendaRules);

  const { data, isLoading } = useQuery({
    queryKey: ["agenda-rules"],
    queryFn: async () => {
      const [rules, blocked] = await Promise.all([
        supabase
          .from("company_settings")
          .select(
            "min_booking_lead_minutes, cancellation_deadline_hours, allow_walkins, allow_reschedule",
          )
          .limit(1)
          .maybeSingle(),
        supabase.from("blocked_slots").select("id", { count: "exact", head: true }),
      ]);
      return {
        rules: { ...DEFAULT, ...(rules.data ?? {}) } as Rules,
        blockedCount: blocked.count ?? 0,
      };
    },
  });

  const [form, setForm] = useState<Rules>(DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.rules) setForm(data.rules);
  }, [data]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(data?.rules ?? DEFAULT),
    [form, data],
  );

  const submit = async () => {
    if (!iAmOwner) {
      toast.error("Apenas o Owner pode salvar.");
      return;
    }
    setSaving(true);
    try {
      await save({ data: form });
      toast.success("Regras da agenda salvas.");
      qc.invalidateQueries({ queryKey: ["agenda-rules"] });
      qc.invalidateQueries({ queryKey: ["config-company"] });
      qc.invalidateQueries({ queryKey: ["config-agenda-summary"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const readOnly = !iAmOwner;

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
    );
  }

  return (
    <div className="space-y-5">
      {readOnly && (
        <Card className="rounded-2xl border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs text-amber-100/90">
          Somente o <strong>Owner</strong> pode editar regras da agenda. Você tem acesso apenas de
          visualização.
        </Card>
      )}

      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
            <CalendarDays className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">Regras globais da agenda</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Aplicadas a todos os agendamentos do cliente. Alterações valem imediatamente.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Clock className="h-3 w-3" /> Antecedência mínima (minutos)
            </Label>
            <Input
              type="number"
              min={0}
              max={60 * 24 * 7}
              value={form.min_booking_lead_minutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_booking_lead_minutes: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              disabled={readOnly}
            />
            <p className="text-[11px] text-muted-foreground/80">
              Tempo mínimo entre a solicitação e o horário desejado.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-3 w-3" /> Prazo para cancelamento (horas)
            </Label>
            <Input
              type="number"
              min={0}
              max={24 * 30}
              value={form.cancellation_deadline_hours}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  cancellation_deadline_hours: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              disabled={readOnly}
            />
            <p className="text-[11px] text-muted-foreground/80">
              Depois desse prazo, o cliente não consegue mais cancelar via app.
            </p>
          </div>

          <ToggleRow
            icon={Ban}
            label="Aceitar encaixes"
            description="Permite que administradores encaixem clientes fora dos horários regulares."
            checked={form.allow_walkins}
            onCheckedChange={(v) => setForm((f) => ({ ...f, allow_walkins: v }))}
            disabled={readOnly}
          />
          <ToggleRow
            icon={RefreshCw}
            label="Permitir reagendamento"
            description="Cliente pode alterar o próprio horário respeitando o prazo acima."
            checked={form.allow_reschedule}
            onCheckedChange={(v) => setForm((f) => ({ ...f, allow_reschedule: v }))}
            disabled={readOnly}
          />
        </div>
      </Card>

      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Horários e bloqueios</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Você tem <strong className="text-foreground">{data?.blockedCount ?? 0}</strong>{" "}
              {(data?.blockedCount ?? 0) === 1 ? "horário bloqueado" : "horários bloqueados"}{" "}
              atualmente. Gerencie diretamente na agenda.
            </p>
          </div>
          <Link
            to="/admin/agenda"
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/15"
          >
            Abrir agenda <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Card>

      {iAmOwner && (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/80 p-3 backdrop-blur-xl">
          <p className="text-xs text-muted-foreground">
            {dirty ? "Você tem alterações não salvas." : "Nenhuma alteração pendente."}
          </p>
          <Button
            onClick={submit}
            disabled={!dirty || saving}
            className="rounded-full bg-primary text-primary-foreground"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar regras
          </Button>
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: typeof Ban;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium">{label}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
