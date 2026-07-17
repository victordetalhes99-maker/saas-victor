import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Building2, Save, Loader2 } from "lucide-react";
import { updateCompanySettings } from "@/lib/config.functions";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/configuracoes/estabelecimento")({
  component: EstabelecimentoPage,
});

type Company = {
  logo_url: string | null;
  legal_name: string | null;
  trade_name: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  cep: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  city: string | null;
  state: string | null;
  min_booking_lead_minutes: number;
  cancellation_deadline_hours: number;
  allow_walkins: boolean;
  allow_reschedule: boolean;
};

const EMPTY: Company = {
  logo_url: "",
  legal_name: "",
  trade_name: "",
  cnpj: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  facebook: "",
  website: "",
  cep: "",
  address: "",
  address_number: "",
  address_complement: "",
  city: "",
  state: "",
  min_booking_lead_minutes: 60,
  cancellation_deadline_hours: 12,
  allow_walkins: true,
  allow_reschedule: true,
};

function maskCNPJ(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3");
  return d.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3");
}
function maskCEP(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, "$1-$2");
}

function EstabelecimentoPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const iAmOwner = roles?.includes("owner") ?? false;

  const { data, isLoading } = useQuery({
    queryKey: ["config-company"],
    queryFn: async (): Promise<Company> => {
      const { data } = await supabase.from("company_settings").select("*").limit(1).maybeSingle();
      return { ...EMPTY, ...(data ?? {}) };
    },
  });

  const [form, setForm] = useState<Company>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(data ?? EMPTY), [form, data]);

  // Warn on unload with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = <K extends keyof Company>(k: K, v: Company[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!iAmOwner) {
      toast.error("Apenas o Owner pode salvar.");
      return;
    }
    setSaving(true);
    try {
      await updateCompanySettings({
        data: {
          ...form,
          logo_url: form.logo_url || null,
          legal_name: form.legal_name || null,
          trade_name: form.trade_name || null,
          cnpj: form.cnpj || null,
          phone: form.phone || null,
          whatsapp: form.whatsapp || null,
          email: form.email || null,
          instagram: form.instagram || null,
          facebook: form.facebook || null,
          website: form.website || null,
          cep: form.cep || null,
          address: form.address || null,
          address_number: form.address_number || null,
          address_complement: form.address_complement || null,
          city: form.city || null,
          state: form.state || null,
        },
      });
      toast.success("Configurações da empresa salvas.");
      qc.invalidateQueries({ queryKey: ["config-company"] });
      qc.invalidateQueries({ queryKey: ["config-geral-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <Skeleton />;

  const readOnly = !iAmOwner;

  return (
    <div className="space-y-5">
      {readOnly && (
        <Card className="rounded-2xl border-amber-300/20 bg-amber-300/[0.04] p-4 text-xs text-amber-100/90">
          Somente o <strong>Owner</strong> pode editar os dados do estabelecimento. Você tem acesso
          apenas de visualização.
        </Card>
      )}

      <SectionCard
        icon={Building2}
        title="Identidade"
        description="Como o estabelecimento é apresentado."
      >
        <Grid>
          <Field label="Razão social">
            <Input
              value={form.legal_name ?? ""}
              onChange={(e) => set("legal_name", e.target.value)}
              disabled={readOnly}
              maxLength={160}
            />
          </Field>
          <Field label="Nome fantasia">
            <Input
              value={form.trade_name ?? ""}
              onChange={(e) => set("trade_name", e.target.value)}
              disabled={readOnly}
              maxLength={160}
            />
          </Field>
          <Field label="CNPJ">
            <Input
              value={form.cnpj ?? ""}
              onChange={(e) => set("cnpj", maskCNPJ(e.target.value))}
              disabled={readOnly}
              placeholder="00.000.000/0000-00"
            />
          </Field>
          <Field label="Logo (URL)">
            <Input
              value={form.logo_url ?? ""}
              onChange={(e) => set("logo_url", e.target.value)}
              disabled={readOnly}
              placeholder="https://..."
            />
          </Field>
        </Grid>
      </SectionCard>

      <SectionCard title="Contato" description="Canais oficiais de comunicação.">
        <Grid>
          <Field label="Telefone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => set("phone", maskPhone(e.target.value))}
              disabled={readOnly}
              placeholder="(00) 0000-0000"
            />
          </Field>
          <Field label="WhatsApp">
            <Input
              value={form.whatsapp ?? ""}
              onChange={(e) => set("whatsapp", maskPhone(e.target.value))}
              disabled={readOnly}
              placeholder="(00) 00000-0000"
            />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              disabled={readOnly}
              placeholder="contato@empresa.com"
            />
          </Field>
          <Field label="Site">
            <Input
              value={form.website ?? ""}
              onChange={(e) => set("website", e.target.value)}
              disabled={readOnly}
              placeholder="https://..."
            />
          </Field>
          <Field label="Instagram">
            <Input
              value={form.instagram ?? ""}
              onChange={(e) => set("instagram", e.target.value)}
              disabled={readOnly}
              placeholder="@usuario"
            />
          </Field>
          <Field label="Facebook">
            <Input
              value={form.facebook ?? ""}
              onChange={(e) => set("facebook", e.target.value)}
              disabled={readOnly}
              placeholder="/pagina"
            />
          </Field>
        </Grid>
      </SectionCard>

      <SectionCard title="Endereço" description="Localização do estabelecimento.">
        <Grid>
          <Field label="CEP">
            <Input
              value={form.cep ?? ""}
              onChange={(e) => set("cep", maskCEP(e.target.value))}
              disabled={readOnly}
              placeholder="00000-000"
            />
          </Field>
          <Field label="Cidade">
            <Input
              value={form.city ?? ""}
              onChange={(e) => set("city", e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Estado (UF)">
            <Input
              value={form.state ?? ""}
              onChange={(e) => set("state", e.target.value.toUpperCase().slice(0, 2))}
              disabled={readOnly}
              maxLength={2}
            />
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            <Input
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Número">
            <Input
              value={form.address_number ?? ""}
              onChange={(e) => set("address_number", e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Complemento" className="sm:col-span-2">
            <Input
              value={form.address_complement ?? ""}
              onChange={(e) => set("address_complement", e.target.value)}
              disabled={readOnly}
            />
          </Field>
        </Grid>
      </SectionCard>

      <SectionCard
        title="Regras globais de agenda"
        description="Aplicadas em todos os agendamentos."
      >
        <Grid>
          <Field label="Antecedência mínima (minutos)">
            <Input
              type="number"
              min={0}
              max={10080}
              value={form.min_booking_lead_minutes}
              onChange={(e) =>
                set("min_booking_lead_minutes", Math.max(0, Number(e.target.value) || 0))
              }
              disabled={readOnly}
            />
          </Field>
          <Field label="Prazo para cancelamento (horas)">
            <Input
              type="number"
              min={0}
              max={720}
              value={form.cancellation_deadline_hours}
              onChange={(e) =>
                set("cancellation_deadline_hours", Math.max(0, Number(e.target.value) || 0))
              }
              disabled={readOnly}
            />
          </Field>
          <ToggleRow
            label="Aceitar encaixes"
            description="Clientes podem ser encaixados fora dos horários regulares."
            checked={form.allow_walkins}
            onCheckedChange={(v) => set("allow_walkins", v)}
            disabled={readOnly}
          />
          <ToggleRow
            label="Permitir reagendamento"
            description="Clientes podem reagendar via app."
            checked={form.allow_reschedule}
            onCheckedChange={(v) => set("allow_reschedule", v)}
            disabled={readOnly}
          />
        </Grid>
      </SectionCard>

      {/* Barra fixa de salvar */}
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
            Salvar alterações
          </Button>
        </div>
      )}
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: typeof Building2;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
      <div className="mb-4 flex items-start gap-3">
        {Icon && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description && (
          <div className="mt-0.5 text-[11px] text-muted-foreground">{description}</div>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}
function Skeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-56 animate-pulse rounded-3xl border border-white/10 bg-white/[0.02]"
        />
      ))}
    </div>
  );
}
