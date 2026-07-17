import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound, Monitor, BellRing, Loader2 } from "lucide-react";
import { changeAdminPassword } from "@/lib/config.functions";

export const Route = createFileRoute("/admin/configuracoes/seguranca")({
  component: SegurancaPage,
});

function scorePassword(v: string): { score: number; label: string; color: string } {
  let s = 0;
  if (v.length >= 10) s++;
  if (v.length >= 14) s++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) s++;
  if (/\d/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  const labels = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte", "Excelente"];
  const colors = [
    "bg-rose-500",
    "bg-rose-400",
    "bg-amber-400",
    "bg-yellow-400",
    "bg-emerald-400",
    "bg-emerald-500",
  ];
  return { score: s, label: labels[s], color: colors[s] };
}

function SegurancaPage() {
  const [curr, setCurr] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const strength = useMemo(() => scorePassword(next), [next]);

  const validations = [
    { ok: next.length >= 10, label: "Mínimo 10 caracteres" },
    { ok: /[a-z]/.test(next) && /[A-Z]/.test(next), label: "Maiúsculas e minúsculas" },
    { ok: /\d/.test(next), label: "Pelo menos 1 número" },
    { ok: !!next && next === confirm, label: "Confirmação bate" },
    { ok: !!next && next !== curr, label: "Diferente da senha atual" },
  ];
  const canSubmit = curr && validations.every((v) => v.ok);

  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    try {
      await changeAdminPassword({ data: { currentPassword: curr, newPassword: next } });
      toast.success("Senha alterada. Suas outras sessões foram encerradas.");
      setCurr("");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao alterar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Alterar senha */}
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <SectionHeader
          icon={KeyRound}
          title="Alterar senha"
          description="Após alterar, todas as suas outras sessões serão encerradas."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Senha atual" className="sm:col-span-2">
            <PasswordInput
              value={curr}
              onChange={setCurr}
              show={show}
              onToggleShow={() => setShow((s) => !s)}
            />
          </Field>
          <Field label="Nova senha">
            <PasswordInput
              value={next}
              onChange={setNext}
              show={show}
              onToggleShow={() => setShow((s) => !s)}
            />
          </Field>
          <Field label="Confirmar nova senha">
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              show={show}
              onToggleShow={() => setShow((s) => !s)}
            />
          </Field>
        </div>

        {next && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Força da senha</span>
              <span className="font-medium">{strength.label}</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < strength.score ? strength.color : "bg-white/[0.06]"}`}
                />
              ))}
            </div>
            <ul className="mt-3 grid gap-1 text-[11px] sm:grid-cols-2">
              {validations.map((v) => (
                <li
                  key={v.label}
                  className={`flex items-center gap-1.5 ${v.ok ? "text-emerald-300" : "text-muted-foreground"}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${v.ok ? "bg-emerald-400" : "bg-white/20"}`}
                  />
                  {v.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <Button
            onClick={submit}
            disabled={!canSubmit || saving}
            className="rounded-full bg-primary text-primary-foreground"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            Alterar senha
          </Button>
        </div>
      </Card>

      {/* 2FA — placeholder */}
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <SectionHeader
          icon={ShieldCheck}
          title="Autenticação em dois fatores"
          description="Camada extra de segurança para o login administrativo."
        />
        <ComingSoon>
          A verificação em duas etapas por TOTP (Google Authenticator, 1Password) será liberada em
          uma próxima versão, junto com os códigos de recuperação.
        </ComingSoon>
      </Card>

      {/* Sessões — placeholder */}
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <SectionHeader
          icon={Monitor}
          title="Sessões ativas"
          description="Lista de dispositivos onde sua conta está conectada."
        />
        <ComingSoon>
          O rastreamento de sessões (SO, navegador, cidade aproximada) será liberado em breve.
          Enquanto isso, você pode encerrar todas as sessões pela <strong>Zona de Perigo</strong>.
        </ComingSoon>
      </Card>

      {/* Alertas — placeholder */}
      <Card className="rounded-3xl border-white/10 bg-white/[0.02] p-6">
        <SectionHeader
          icon={BellRing}
          title="Alertas de segurança"
          description="Notificações de eventos críticos."
        />
        <ComingSoon>
          Alertas por e-mail (novo dispositivo, senha alterada, 2FA, atividade suspeita) serão
          configurados na próxima fase, junto com a integração de e-mails transacionais.
        </ComingSoon>
      </Card>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Lock;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}
function PasswordInput({
  value,
  onChange,
  show,
  onToggleShow,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
}) {
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        autoComplete="new-password"
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Ocultar senha" : "Mostrar senha"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
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
function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-xs text-muted-foreground">
      <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
        Em breve
      </span>
      <p className="mt-2 leading-relaxed">{children}</p>
    </div>
  );
}
