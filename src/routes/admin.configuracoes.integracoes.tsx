import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  CreditCard,
  Mail,
  Calendar,
  MessageCircle,
  Cloud,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Info,
  Eye,
  EyeOff,
  Save,
  Trash2,
  KeyRound,
} from "lucide-react";
import {
  INTEGRATION_REGISTRY,
  getIntegrationDefinition,
  type IntegrationDefinition,
  type IntegrationProvider,
  type IntegrationSnapshot,
  type IntegrationStatus,
} from "@/lib/integrations/types";
import {
  listIntegrations,
  testIntegration,
  saveIntegrationKeys,
  clearIntegrationKey,
} from "@/lib/integrations/integrations.functions";

export const Route = createFileRoute("/admin/configuracoes/integracoes")({
  component: IntegracoesPage,
});

const ICONS: Record<IntegrationProvider, typeof Database> = {
  supabase: Database,
  stripe: CreditCard,
  resend: Mail,
  whatsapp: MessageCircle,
  google_calendar: Calendar,
  cloudflare: Cloud,
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function IntegracoesPage() {
  const list = useServerFn(listIntegrations);
  const qc = useQueryClient();
  const [configuring, setConfiguring] = useState<IntegrationProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<IntegrationProvider | null>(null);

  const {
    data: integrations,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin", "integrations"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  // Executa o teste real via server function

  const runTest = useServerFn(testIntegration);
  const doTest = useMutation({
    mutationFn: async (provider: IntegrationProvider) => {
      setTestingProvider(provider);
      return runTest({ data: { provider } });
    },
    onSuccess: (res, provider) => {
      const def = getIntegrationDefinition(provider);
      if (res.ok) toast.success(`${def.name}: conexão confirmada.`);
      else if (res.status === "not_configured") toast.error(`${def.name}: variáveis ausentes.`);
      else toast.error(`${def.name}: ${res.message}`);
      qc.invalidateQueries({ queryKey: ["admin", "integrations"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Falha ao testar.";
      toast.error(msg);
    },
    onSettled: () => setTestingProvider(null),
  });

  const snapshotByProvider = useMemo(() => {
    const map = new Map<IntegrationProvider, IntegrationSnapshot>();
    (integrations ?? []).forEach((s) => map.set(s.provider as IntegrationProvider, s));
    return map;
  }, [integrations]);

  return (
    <div className="space-y-5">
      {/* header */}
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Serviços conectados</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Os testes de conexão são executados no servidor. Nenhuma chave privada trafega pelo
              navegador.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="rounded-full border-white/10 bg-white/[0.03]"
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/5 p-3 text-xs text-rose-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Não foi possível carregar o status das integrações. Verifique se você tem permissão de
              administrador.
            </span>
          </div>
        )}
      </Card>

      {/* grid */}
      <div className="grid gap-3 md:grid-cols-2">
        {INTEGRATION_REGISTRY.map((def) => {
          const snap = snapshotByProvider.get(def.id);
          const Icon = ICONS[def.id];
          const isTesting = testingProvider === def.id && doTest.isPending;
          return (
            <IntegrationCard
              key={def.id}
              def={def}
              icon={Icon}
              snapshot={snap}
              isLoading={isLoading}
              isTesting={isTesting}
              onTest={() => doTest.mutate(def.id)}
              onConfigure={() => setConfiguring(def.id)}
            />
          );
        })}
      </div>

      <ConfigureDialog
        provider={configuring}
        snapshot={configuring ? snapshotByProvider.get(configuring) : undefined}
        onClose={() => setConfiguring(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["admin", "integrations"] })}
        onRecheck={(p) => {
          setConfiguring(null);
          doTest.mutate(p);
        }}
      />
    </div>
  );
}

function IntegrationCard({
  def,
  icon: Icon,
  snapshot,
  isLoading,
  isTesting,
  onTest,
  onConfigure,
}: {
  def: IntegrationDefinition;
  icon: typeof Database;
  snapshot: IntegrationSnapshot | undefined;
  isLoading: boolean;
  isTesting: boolean;
  onTest: () => void;
  onConfigure: () => void;
}) {
  const status: IntegrationStatus = snapshot?.status ?? (isLoading ? "testing" : "not_configured");
  const configured = snapshot?.isConfigured ?? false;

  return (
    <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{def.name}</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{def.description}</p>
          </div>
        </div>
        <StatusBadge status={isTesting ? "testing" : status} />
      </div>

      {/* features */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {def.features.map((f) => (
          <span
            key={f}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {f}
          </span>
        ))}
      </div>

      {/* meta */}
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Última verificação
          </div>
          <div className="text-foreground/80">{formatDate(snapshot?.lastCheckedAt ?? null)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
            Última sincronização
          </div>
          <div className="text-foreground/80">{formatDate(snapshot?.lastSyncAt ?? null)}</div>
        </div>
      </div>

      {/* messages */}
      {!configured && snapshot?.missingEnvVars && snapshot.missingEnvVars.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-2.5 text-[11px] text-amber-100/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Configure as variáveis:{" "}
            <span className="font-mono text-amber-200">{snapshot.missingEnvVars.join(", ")}</span>
          </span>
        </div>
      )}
      {status === "error" && snapshot?.lastErrorMessage && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-400/5 p-2.5 text-[11px] text-rose-200">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{snapshot.lastErrorMessage}</span>
        </div>
      )}
      {status === "action_required" && configured && !snapshot?.lastCheckedAt && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-2.5 text-[11px] text-amber-100/90">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Variáveis detectadas. Clique em "Testar conexão" para confirmar.</span>
        </div>
      )}
      {snapshot &&
        snapshot.metadata &&
        Object.keys(snapshot.metadata).length > 0 &&
        status === "connected" && (
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
              Detalhes
            </div>
            <div className="mt-1 space-y-0.5 text-[11px] text-foreground/80">
              {Object.entries(snapshot.metadata)
                .filter(([, v]) => v !== null && v !== undefined && v !== "")
                .slice(0, 4)
                .map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="truncate font-mono">{formatMetaValue(v)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-white/[0.06] pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onConfigure}
          className="rounded-full border-white/10 bg-white/[0.03] text-[11px]"
        >
          Configurar
        </Button>
        <Button
          size="sm"
          onClick={onTest}
          disabled={isTesting || !def.testable}
          className="rounded-full text-[11px]"
        >
          {isTesting ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Testando…
            </>
          ) : (
            <>Testar conexão</>
          )}
        </Button>
      </div>
    </Card>
  );
}

function formatMetaValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return `${v.length} item(s)`;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 40);
  return String(v);
}

function StatusBadge({ status }: { status: IntegrationStatus }) {
  const map: Record<
    IntegrationStatus,
    { label: string; className: string; icon: typeof Check | null }
  > = {
    connected: {
      label: "Conectado",
      className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
      icon: Check,
    },
    not_configured: {
      label: "Não configurado",
      className: "border-white/10 bg-white/[0.04] text-muted-foreground",
      icon: null,
    },
    testing: {
      label: "Testando",
      className: "border-blue-400/30 bg-blue-400/10 text-blue-200",
      icon: Loader2,
    },
    error: {
      label: "Erro",
      className: "border-rose-400/30 bg-rose-400/10 text-rose-200",
      icon: AlertCircle,
    },
    disabled: {
      label: "Desativado",
      className: "border-white/10 bg-white/[0.04] text-muted-foreground",
      icon: null,
    },
    action_required: {
      label: "Ação necessária",
      className: "border-amber-300/30 bg-amber-300/10 text-amber-200",
      icon: AlertCircle,
    },
  };
  const cfg = map[status];
  return (
    <Badge
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${cfg.className}`}
    >
      {cfg.icon && <cfg.icon className={`h-3 w-3 ${status === "testing" ? "animate-spin" : ""}`} />}
      {cfg.label}
    </Badge>
  );
}

function ConfigureDialog({
  provider,
  snapshot,
  onClose,
  onRecheck,
  onSaved,
}: {
  provider: IntegrationProvider | null;
  snapshot: IntegrationSnapshot | undefined;
  onClose: () => void;
  onRecheck: (p: IntegrationProvider) => void;
  onSaved: () => void;
}) {
  const def = provider ? getIntegrationDefinition(provider) : null;
  const [values, setValues] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const storedKeys = useMemo<string[]>(() => {
    const raw = snapshot?.metadata?.storedKeys;
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [snapshot]);

  useEffect(() => {
    // Ao abrir/trocar de provider, limpa o formulário — nunca prefill de valores.
    setValues({});
    setReveal({});
  }, [provider]);

  const save = useServerFn(saveIntegrationKeys);
  const clearKey = useServerFn(clearIntegrationKey);

  const handleSave = async (thenTest: boolean) => {
    if (!def) return;
    const keys: Record<string, string> = {};
    for (const v of def.envVars) {
      if (v.scope === "public") continue;
      const val = values[v.name];
      if (val !== undefined && val.length > 0) keys[v.name] = val;
    }
    if (Object.keys(keys).length === 0) {
      toast.error("Informe pelo menos uma chave para salvar.");
      return;
    }
    setSaving(true);
    try {
      await save({ data: { provider: def.id, keys } });
      toast.success("Chaves salvas com segurança.");
      onSaved();
      setValues({});
      if (thenTest) onRecheck(def.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar chaves.");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (keyName: string) => {
    if (!def) return;
    if (!confirm(`Remover a chave ${keyName}?`)) return;
    try {
      await clearKey({ data: { provider: def.id, keyName } });
      toast.success(`${keyName} removida.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover chave.");
    }
  };

  return (
    <Dialog open={!!provider} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-card border-white/10 rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Configurar {def?.name}
          </DialogTitle>
          <DialogDescription className="text-xs">
            As chaves são criptografadas (AES-256-GCM) no servidor e nunca voltam ao navegador
            depois de salvas. Deixe em branco para não alterar.
          </DialogDescription>
        </DialogHeader>

        {def && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[11px] text-emerald-100/90">
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" /> Segurança
              </div>
              Alternativa a variáveis de ambiente: as chaves salvas aqui têm precedência em runtime.
              Elas nunca aparecem no código-fonte nem no bundle do cliente.
            </div>

            <div className="space-y-3">
              {def.envVars
                .filter((v) => v.scope !== "public")
                .map((v) => {
                  const isStored = storedKeys.includes(v.name);
                  const show = reveal[v.name] ?? false;
                  return (
                    <div
                      key={v.name}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Label className="font-mono text-[12px] text-foreground">{v.name}</Label>
                        {v.required && (
                          <Badge className="rounded-full border border-amber-300/30 bg-amber-300/10 px-1.5 py-0 text-[9px] uppercase tracking-wider text-amber-200">
                            Obrigatória
                          </Badge>
                        )}
                        {isStored ? (
                          <Badge className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0 text-[9px] uppercase tracking-wider text-emerald-200">
                            <Check className="mr-1 h-2.5 w-2.5" /> Salva
                          </Badge>
                        ) : (
                          <Badge className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0 text-[9px] uppercase tracking-wider text-muted-foreground">
                            Vazia
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{v.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={show ? "text" : "password"}
                            autoComplete="off"
                            spellCheck={false}
                            value={values[v.name] ?? ""}
                            onChange={(e) =>
                              setValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                            }
                            placeholder={
                              isStored ? "•••••••• (mantém valor atual)" : "Cole a chave"
                            }
                            className="h-9 rounded-lg bg-white/[0.03] font-mono text-[12px] pr-10"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setReveal((prev) => ({ ...prev, [v.name]: !prev[v.name] }))
                            }
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            aria-label={show ? "Ocultar" : "Mostrar"}
                          >
                            {show ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {isStored && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleClear(v.name)}
                            className="h-9 shrink-0 rounded-lg border-rose-400/30 bg-rose-400/5 text-[11px] text-rose-200 hover:bg-rose-400/10"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {def.hasWebhook && def.webhookHint && (
              <div className="rounded-xl border border-blue-400/20 bg-blue-400/5 p-3 text-[11px] text-blue-100/90">
                <div className="mb-1 flex items-center gap-1.5 font-medium">
                  <Info className="h-3.5 w-3.5" /> Webhook
                </div>
                {def.webhookHint}
              </div>
            )}

            {def.docsUrl && (
              <a
                href={def.docsUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
              >
                Abrir documentação do provedor <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-full">
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="rounded-full"
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Salvar
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="rounded-full bg-primary text-primary-foreground"
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Salvar e testar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
