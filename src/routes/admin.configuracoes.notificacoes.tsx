import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageCircle, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { updateNotificationPrefs, type NotificationPrefs } from "@/lib/config.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/configuracoes/notificacoes")({
  component: NotificacoesPage,
});

type Channel = "system" | "email" | "whatsapp";
type EventKey = keyof NotificationPrefs;

const CHANNELS: { key: Channel; label: string; icon: typeof Bell; hint: string }[] = [
  { key: "system", label: "Sistema", icon: Bell, hint: "Alertas no painel." },
  { key: "email", label: "E-mail", icon: Mail, hint: "Requer Resend." },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, hint: "Requer integração." },
];

const EVENTS: { key: EventKey; label: string; description: string }[] = [
  {
    key: "new_client",
    label: "Novo cliente cadastrado",
    description: "Ao final de um cadastro aprovado.",
  },
  {
    key: "new_payment",
    label: "Novo pagamento recebido",
    description: "Cobrança confirmada pelo provedor.",
  },
  {
    key: "pending_payment",
    label: "Pagamento pendente",
    description: "Cobrança aguardando confirmação.",
  },
  { key: "new_appointment", label: "Novo agendamento", description: "Cliente marca um serviço." },
  { key: "cancellation", label: "Cancelamento", description: "Cliente ou operador cancela." },
  { key: "reschedule", label: "Reagendamento", description: "Alteração de horário confirmada." },
  {
    key: "security_alert",
    label: "Tentativa de invasão",
    description: "Bloqueios do rate limiter.",
  },
  {
    key: "system_error",
    label: "Erro crítico do sistema",
    description: "Falha registrada no servidor.",
  },
];

const emptyChannel = { system: false, email: false, whatsapp: false };
const DEFAULT_PREFS: NotificationPrefs = {
  new_client: { ...emptyChannel, system: true },
  new_payment: { ...emptyChannel, system: true },
  pending_payment: { ...emptyChannel, system: true },
  new_appointment: { ...emptyChannel, system: true },
  cancellation: { ...emptyChannel, system: true },
  reschedule: { ...emptyChannel, system: true },
  security_alert: { ...emptyChannel, system: true },
  system_error: { ...emptyChannel, system: true },
};

function NotificacoesPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const iAmOwner = roles?.includes("owner") ?? false;
  const save = useServerFn(updateNotificationPrefs);

  const { data, isLoading } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: async (): Promise<NotificationPrefs> => {
      const { data } = await supabase
        .from("company_settings")
        .select("notification_prefs")
        .limit(1)
        .maybeSingle();
      const raw = (data?.notification_prefs ?? {}) as Partial<NotificationPrefs>;
      return { ...DEFAULT_PREFS, ...raw } as NotificationPrefs;
    },
  });

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setPrefs(data);
  }, [data]);

  const dirty = useMemo(
    () => JSON.stringify(prefs) !== JSON.stringify(data ?? DEFAULT_PREFS),
    [prefs, data],
  );

  const toggle = (event: EventKey, channel: Channel) => {
    setPrefs((p) => ({ ...p, [event]: { ...p[event], [channel]: !p[event][channel] } }));
  };

  const submit = async () => {
    if (!iAmOwner) {
      toast.error("Apenas o Owner pode salvar.");
      return;
    }
    setSaving(true);
    try {
      await save({ data: prefs });
      toast.success("Preferências de notificação salvas.");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-64 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]" />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Preferências de notificação</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Escolha o canal de notificação para cada evento. Alterações são globais para todos os
              administradores.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/[0.04] p-3 text-[11px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/80" />
          <span>
            <strong className="text-foreground">Sistema</strong> funciona nativamente.{" "}
            <strong className="text-foreground">E-mail</strong> e{" "}
            <strong className="text-foreground">WhatsApp</strong> só disparam quando os provedores
            estiverem conectados em Integrações — sua preferência fica salva e é aplicada assim que
            as chaves forem configuradas.
          </span>
        </div>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-white/10 bg-card p-0">
        <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-white/10 px-5 py-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:grid-cols-[1fr_repeat(3,88px)]">
          <span>Evento</span>
          {CHANNELS.map((c) => (
            <span key={c.key} className="hidden text-center sm:block">
              {c.label}
            </span>
          ))}
          <span className="sm:hidden">Canais</span>
        </div>
        <ul>
          {EVENTS.map((ev, i) => (
            <li
              key={ev.key}
              className={`grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-[1fr_repeat(3,88px)] sm:items-center ${i < EVENTS.length - 1 ? "border-b border-white/[0.06]" : ""}`}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{ev.label}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{ev.description}</div>
              </div>
              <div className="flex flex-wrap gap-3 sm:contents">
                {CHANNELS.map((c) => (
                  <label
                    key={c.key}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] sm:justify-center sm:border-0 sm:bg-transparent sm:p-0"
                  >
                    <span className="sm:hidden inline-flex items-center gap-1 text-muted-foreground">
                      <c.icon className="h-3 w-3" /> {c.label}
                    </span>
                    <Switch
                      checked={prefs[ev.key][c.key]}
                      onCheckedChange={() => toggle(ev.key, c.key)}
                      disabled={!iAmOwner}
                      aria-label={`${ev.label} - ${c.label}`}
                    />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {iAmOwner ? (
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
            Salvar preferências
          </Button>
        </div>
      ) : (
        <Card className="rounded-2xl border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs text-amber-100/90">
          Somente o <strong>Owner</strong> pode alterar preferências de notificação globais.
        </Card>
      )}
    </div>
  );
}
