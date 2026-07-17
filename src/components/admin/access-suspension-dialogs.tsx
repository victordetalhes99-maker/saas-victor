import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ShieldOff, ShieldCheck, CalendarIcon, Loader2, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";

type ReasonCode =
  | "overdue"
  | "payment_refused"
  | "subscription_cancelled"
  | "admin_request"
  | "misuse"
  | "policy_violation"
  | "other";

const REASONS: { code: ReasonCode; label: string }[] = [
  { code: "overdue", label: "Mensalidade em atraso" },
  { code: "payment_refused", label: "Pagamento recusado" },
  { code: "subscription_cancelled", label: "Assinatura cancelada" },
  { code: "admin_request", label: "Solicitação administrativa" },
  { code: "misuse", label: "Uso indevido" },
  { code: "policy_violation", label: "Violação das regras" },
  { code: "other", label: "Outro" },
];

type NotifyChannel = "none" | "email" | "whatsapp" | "both";

const DEFAULT_SUSPEND_MSG = `Olá, {{nome}}.

Seu acesso ao Clube Detail foi temporariamente suspenso porque identificamos uma pendência em sua assinatura.

Assim que a situação for regularizada, seu acesso será restabelecido automaticamente ou por um administrador.

Caso tenha dúvidas, entre em contato conosco.`;

const DEFAULT_RESTORE_MSG = `Olá, {{nome}}.

Seu acesso foi restabelecido. Obrigado por regularizar sua situação.

Seja bem-vindo(a) novamente.`;

const fmtMoney = (v?: number | null) =>
  typeof v === "number" ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  try {
    return format(parseISO(v), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

function daysOverdue(dueDate?: string | null) {
  if (!dueDate) return 0;
  try {
    const d = parseISO(dueDate).getTime();
    const diff = Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

function ClientSummary({ client }: { client: any }) {
  const sub = client.subscriptions?.[0];
  const veh = client.vehicles?.[0];
  const lastPayment = client.payments?.[0];
  const overdue = daysOverdue(sub?.next_due_date);
  const initials = (client.full_name || client.email || "?")
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-sm font-semibold text-emerald-200">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{client.full_name || "—"}</div>
          <div className="truncate text-xs text-muted-foreground">{client.email}</div>
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <span className="truncate">☎ {client.phone ?? "—"}</span>
            <span className="truncate">
              🚗 {veh ? `${veh.brand ?? ""} ${veh.model ?? ""} · ${veh.plate ?? ""}` : "—"}
            </span>
            <span className="truncate">📦 {sub?.plans?.name ?? "Sem plano"}</span>
            <span className="truncate">
              💰{" "}
              {sub?.plans?.monthly_price != null ? fmtMoney(Number(sub.plans.monthly_price)) : "—"}
            </span>
            <span className="truncate">⏳ Vence: {fmtDate(sub?.next_due_date)}</span>
            <span className="truncate">
              💳 Último pgto: {fmtDate(lastPayment?.paid_at ?? lastPayment?.created_at)}
            </span>
          </div>
          {overdue > 0 && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">
              <AlertTriangle className="h-3 w-3" />
              {overdue} {overdue === 1 ? "dia" : "dias"} em atraso
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------- Suspend Dialog --------------------

export function SuspendAccessDialog({
  client,
  open,
  onOpenChange,
  onSubmit,
}: {
  client: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: {
    userId: string;
    reasonCode: ReasonCode;
    reason?: string;
    suspensionType: "until_regularization" | "until_date" | "days";
    untilDate?: string;
    days?: number;
    notifyChannel: NotifyChannel;
    notifyMessage?: string;
  }) => Promise<void>;
}) {
  const [reasonCode, setReasonCode] = useState<ReasonCode>("overdue");
  const [otherReason, setOtherReason] = useState("");
  const [suspensionType, setSuspensionType] = useState<
    "until_regularization" | "until_date" | "days"
  >("until_regularization");
  const [untilDate, setUntilDate] = useState<Date | undefined>(undefined);
  const [days, setDays] = useState<number>(7);
  const [notifyChannel, setNotifyChannel] = useState<NotifyChannel>("none");
  const [message, setMessage] = useState(DEFAULT_SUSPEND_MSG);
  const [confirmWord, setConfirmWord] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReasonCode("overdue");
      setOtherReason("");
      setSuspensionType("until_regularization");
      setUntilDate(undefined);
      setDays(7);
      setNotifyChannel("none");
      setMessage(DEFAULT_SUSPEND_MSG);
      setConfirmWord("");
      setSubmitting(false);
    }
  }, [open]);

  const canSubmit = useMemo(() => {
    if (confirmWord.trim().toUpperCase() !== "SUSPENDER") return false;
    if (reasonCode === "other" && !otherReason.trim()) return false;
    if (suspensionType === "until_date" && !untilDate) return false;
    if (suspensionType === "days" && (!days || days < 1)) return false;
    return true;
  }, [confirmWord, reasonCode, otherReason, suspensionType, untilDate, days]);

  if (!client) return null;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        userId: client.id,
        reasonCode,
        reason:
          reasonCode === "other"
            ? otherReason.trim()
            : REASONS.find((r) => r.code === reasonCode)?.label,
        suspensionType,
        untilDate:
          suspensionType === "until_date" && untilDate
            ? untilDate.toISOString().slice(0, 10)
            : undefined,
        days: suspensionType === "days" ? days : undefined,
        notifyChannel,
        notifyMessage: notifyChannel === "none" ? undefined : message,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao suspender acesso.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (submitting) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="flex max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-2xl"
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogHeader className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-200">
              <ShieldOff className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                Suspender acesso do cliente
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                Suspenda temporariamente o acesso deste cliente ao sistema até que sua situação seja
                regularizada.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ClientSummary client={client} />

          {/* Motivo */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
              Motivo da suspensão
            </Label>
            <RadioGroup
              value={reasonCode}
              onValueChange={(v) => setReasonCode(v as ReasonCode)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {REASONS.map((r) => (
                <label
                  key={r.code}
                  htmlFor={`reason-${r.code}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                    reasonCode === r.code
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20",
                  )}
                >
                  <RadioGroupItem value={r.code} id={`reason-${r.code}`} />
                  <span>{r.label}</span>
                </label>
              ))}
            </RadioGroup>
            {reasonCode === "other" && (
              <Textarea
                autoFocus
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Descreva o motivo…"
                rows={2}
                className="bg-white/[0.03]"
              />
            )}
          </section>

          {/* Tipo */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
              Tipo da suspensão
            </Label>
            <RadioGroup
              value={suspensionType}
              onValueChange={(v) => setSuspensionType(v as any)}
              className="space-y-2"
            >
              <label
                htmlFor="type-reg"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                  suspensionType === "until_regularization"
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/10 bg-white/[0.02]",
                )}
              >
                <RadioGroupItem value="until_regularization" id="type-reg" />
                Até regularização
              </label>
              <label
                htmlFor="type-date"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                  suspensionType === "until_date"
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/10 bg-white/[0.02]",
                )}
              >
                <RadioGroupItem value="until_date" id="type-date" />
                <span>Até uma data específica</span>
                {suspensionType === "until_date" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-auto h-8 gap-1.5"
                        onClick={(e) => e.preventDefault()}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {untilDate
                          ? format(untilDate, "dd/MM/yyyy", { locale: ptBR })
                          : "Escolher data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0"
                      align="end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Calendar
                        mode="single"
                        selected={untilDate}
                        onSelect={setUntilDate}
                        disabled={(d) => d < new Date(new Date().toDateString())}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </label>
              <label
                htmlFor="type-days"
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                  suspensionType === "days"
                    ? "border-primary/50 bg-primary/10"
                    : "border-white/10 bg-white/[0.02]",
                )}
              >
                <RadioGroupItem value="days" id="type-days" />
                <span>Número de dias</span>
                {suspensionType === "days" && (
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value) || 1)}
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto h-8 w-24 bg-white/[0.03]"
                  />
                )}
              </label>
            </RadioGroup>
          </section>

          {/* O que acontecerá */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 h-4 w-4 text-emerald-300/80" />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
                  O que acontecerá
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  <li>✔ O cliente não poderá entrar no sistema.</li>
                  <li>✔ Novos agendamentos serão bloqueados.</li>
                  <li>✔ Os dados permanecerão salvos.</li>
                  <li>✔ O histórico continuará disponível.</li>
                  <li>✔ O acesso poderá ser restaurado a qualquer momento.</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Notificar cliente */}
          <section className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
              Notificar cliente
            </Label>
            <RadioGroup
              value={notifyChannel}
              onValueChange={(v) => setNotifyChannel(v as NotifyChannel)}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {[
                { v: "none", l: "Não enviar" },
                { v: "email", l: "Email" },
                { v: "whatsapp", l: "WhatsApp" },
                { v: "both", l: "Ambos" },
              ].map((o) => (
                <label
                  key={o.v}
                  htmlFor={`notify-${o.v}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                    notifyChannel === o.v
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/10 bg-white/[0.02]",
                  )}
                >
                  <RadioGroupItem value={o.v} id={`notify-${o.v}`} />
                  {o.l}
                </label>
              ))}
            </RadioGroup>
            {notifyChannel !== "none" && (
              <div className="space-y-1">
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="bg-white/[0.03] font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Variáveis:{" "}
                  <code className="text-emerald-300/80">
                    {"{{nome}} {{plano}} {{valor}} {{vencimento}}"}
                  </code>
                </p>
              </div>
            )}
          </section>

          {/* Confirmação */}
          <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4">
            <Label
              htmlFor="confirm-word"
              className="text-xs font-semibold uppercase tracking-wider text-rose-200"
            >
              Digite <span className="font-bold">SUSPENDER</span> para confirmar
            </Label>
            <Input
              id="confirm-word"
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              placeholder="SUSPENDER"
              className="mt-2 bg-white/[0.03] uppercase"
              autoComplete="off"
            />
          </section>
        </div>

        <DialogFooter className="flex-row gap-2 border-t border-white/10 bg-black/20 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 gap-2 bg-rose-600 text-white hover:bg-rose-500 sm:flex-none"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldOff className="h-4 w-4" />
            )}
            Suspender acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Restore Dialog --------------------

export function RestoreAccessDialog({
  client,
  open,
  onOpenChange,
  onSubmit,
}: {
  client: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (payload: {
    userId: string;
    allowLogin: boolean;
    allowBooking: boolean;
    notifyChannel: NotifyChannel;
    notifyMessage?: string;
  }) => Promise<void>;
}) {
  const [allowLogin, setAllowLogin] = useState(true);
  const [allowBooking, setAllowBooking] = useState(true);
  const [immediate, setImmediate] = useState(true);
  const [notify, setNotify] = useState(true);
  const [channel, setChannel] = useState<NotifyChannel>("email");
  const [message, setMessage] = useState(DEFAULT_RESTORE_MSG);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAllowLogin(true);
      setAllowBooking(true);
      setImmediate(true);
      setNotify(true);
      setChannel("email");
      setMessage(DEFAULT_RESTORE_MSG);
      setSubmitting(false);
    }
  }, [open]);

  if (!client) return null;

  const sub = client.subscriptions?.[0];

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        userId: client.id,
        allowLogin,
        allowBooking,
        notifyChannel: notify ? channel : "none",
        notifyMessage: notify ? message : undefined,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reativar acesso.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (submitting) return;
        onOpenChange(o);
      }}
    >
      <DialogContent
        className="flex max-h-[92vh] w-[96vw] flex-col gap-0 overflow-hidden bg-card p-0 sm:max-w-xl"
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogHeader className="border-b border-white/10 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                Reativar acesso do cliente
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs text-muted-foreground">
                Deseja restabelecer o acesso deste cliente?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ClientSummary client={client} />

          <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Motivo da suspensão</span>
              <span className="text-foreground">{client.blocked_reason ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span>Suspenso em</span>
              <span className="text-foreground">{fmtDate(client.blocked_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Plano</span>
              <span className="text-foreground">{sub?.plans?.name ?? "—"}</span>
            </div>
          </section>

          <section className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
              Configurações da reativação
            </Label>
            <div className="space-y-2">
              {[
                { v: allowLogin, s: setAllowLogin, l: "Liberar login" },
                { v: allowBooking, s: setAllowBooking, l: "Liberar novos agendamentos" },
                { v: immediate, s: setImmediate, l: "Restaurar acesso imediatamente" },
                { v: notify, s: setNotify, l: "Notificar cliente" },
              ].map((row, i) => (
                <label
                  key={i}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span>{row.l}</span>
                  <Switch checked={row.v} onCheckedChange={row.s} />
                </label>
              ))}
            </div>
          </section>

          {notify && (
            <section className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-emerald-300/80">
                Canal e mensagem
              </Label>
              <RadioGroup
                value={channel}
                onValueChange={(v) => setChannel(v as NotifyChannel)}
                className="grid grid-cols-3 gap-2"
              >
                {[
                  { v: "email", l: "Email" },
                  { v: "whatsapp", l: "WhatsApp" },
                  { v: "both", l: "Ambos" },
                ].map((o) => (
                  <label
                    key={o.v}
                    htmlFor={`rst-${o.v}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition",
                      channel === o.v
                        ? "border-primary/50 bg-primary/10"
                        : "border-white/10 bg-white/[0.02]",
                    )}
                  >
                    <RadioGroupItem value={o.v} id={`rst-${o.v}`} />
                    {o.l}
                  </label>
                ))}
              </RadioGroup>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="bg-white/[0.03] font-mono text-xs"
              />
            </section>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 border-t border-white/10 bg-black/20 px-6 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 gap-2 bg-emerald-600 text-white hover:bg-emerald-500 sm:flex-none"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Reativar acesso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------------------- Generic Confirm Dialog --------------------

export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  tone = "default",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "default" | "danger" | "success";
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="w-[92vw] bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="flex-1 sm:flex-none"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={busy}
            className={cn(
              "flex-1 gap-2 sm:flex-none",
              tone === "danger" && "bg-rose-600 text-white hover:bg-rose-500",
              tone === "success" && "bg-emerald-600 text-white hover:bg-emerald-500",
            )}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
