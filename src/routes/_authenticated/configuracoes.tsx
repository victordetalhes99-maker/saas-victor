import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Bell, Moon, Mail, Settings as SettingsIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const [pushNotif, setPushNotif] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [reminders, setReminders] = useState(true);

  return (
    <div className="space-y-6 pb-8">
      <header className="anim-rise pt-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.25em] text-muted-foreground/80 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Link>
        <h1 className="mt-2 text-display text-[34px] leading-[1.05] sm:text-[42px] text-gradient">
          Configurações
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Preferências do sistema e notificações.
        </p>
      </header>

      <section className="anim-rise anim-rise-1 relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
            <Bell className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
              Notificações
            </p>
            <h2 className="text-display text-lg leading-tight text-foreground">
              Como você quer ser avisado
            </h2>
          </div>
        </div>
        <div className="relative mt-5 space-y-2">
          <Row
            icon={Bell}
            label="Notificações push"
            description="Alertas no dispositivo"
            checked={pushNotif}
            onChange={setPushNotif}
          />
          <Row
            icon={Mail}
            label="E-mails de confirmação"
            description="Agendamentos e recibos"
            checked={emailNotif}
            onChange={setEmailNotif}
          />
          <Row
            icon={Bell}
            label="Lembretes de lavagem"
            description="Aviso antes do horário"
            checked={reminders}
            onChange={setReminders}
          />
        </div>
      </section>

      <section className="anim-rise anim-rise-2 relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-6 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <div className="relative flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-primary">
            <SettingsIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground/70">
              Aparência
            </p>
            <h2 className="text-display text-lg leading-tight text-foreground">
              Tema do aplicativo
            </h2>
          </div>
        </div>
        <div className="relative mt-5 flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <span className="flex items-center gap-2.5 text-sm text-foreground">
            <Moon className="h-4 w-4 text-primary" />
            Modo escuro / claro
          </span>
          <ThemeToggle />
        </div>
      </section>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium leading-tight text-foreground">
          {label}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
