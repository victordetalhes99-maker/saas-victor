import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import {
  Home,
  Building2,
  User,
  Lock,
  Bell,
  CalendarDays,
  Plug,
  CreditCard,
  Palette,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

type Section = {
  to: string;
  label: string;
  icon: typeof Home;
  description: string;
  danger?: boolean;
};

const SECTIONS: Section[] = [
  {
    to: "/admin/configuracoes/geral",
    label: "Geral",
    icon: Home,
    description: "Visão geral do sistema",
  },
  {
    to: "/admin/configuracoes/estabelecimento",
    label: "Estabelecimento",
    icon: Building2,
    description: "Dados da empresa",
  },
  {
    to: "/admin/configuracoes/administrador",
    label: "Administrador",
    icon: User,
    description: "Seu perfil",
  },
  {
    to: "/admin/configuracoes/seguranca",
    label: "Segurança",
    icon: Lock,
    description: "Senha e acessos",
  },
  {
    to: "/admin/configuracoes/notificacoes",
    label: "Notificações",
    icon: Bell,
    description: "Preferências de alerta",
  },
  {
    to: "/admin/configuracoes/agenda",
    label: "Agenda",
    icon: CalendarDays,
    description: "Regras de agendamento",
  },
  {
    to: "/admin/configuracoes/integracoes",
    label: "Integrações",
    icon: Plug,
    description: "Serviços conectados",
  },
  {
    to: "/admin/configuracoes/pagamentos",
    label: "Pagamentos",
    icon: CreditCard,
    description: "Assinatura e faturas",
  },
  {
    to: "/admin/configuracoes/aparencia",
    label: "Aparência",
    icon: Palette,
    description: "Tema e densidade",
  },
  {
    to: "/admin/configuracoes/zona-de-perigo",
    label: "Zona de Perigo",
    icon: AlertTriangle,
    description: "Ações irreversíveis",
    danger: true,
  },
];

function ConfigLayout() {
  const loc = useLocation();
  const nav = useNavigate();
  const active =
    SECTIONS.find((s) => loc.pathname === s.to || loc.pathname.startsWith(s.to + "/")) ??
    SECTIONS[0];

  return (
    <div className="space-y-6">
      {/* Breadcrumb + título */}
      <div className="flex flex-col gap-1">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground/70"
        >
          <Link to="/admin" className="hover:text-primary">
            Painel
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/admin/configuracoes/geral" className="hover:text-primary">
            Configurações
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{active.label}</span>
        </nav>
        <h1 className="text-3xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Centro de controle do Clube Detail.</p>
      </div>

      {/* Seletor mobile */}
      <div className="lg:hidden">
        <Select value={active.to} onValueChange={(to) => nav({ to })}>
          <SelectTrigger className="rounded-2xl border-white/10 bg-white/[0.03] py-6 text-left">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SECTIONS.map((s) => (
              <SelectItem key={s.to} value={s.to}>
                <span className="flex items-center gap-2">
                  <s.icon className="h-4 w-4" /> {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid desktop */}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Menu interno */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {SECTIONS.map((s) => {
              const isActive = loc.pathname === s.to || loc.pathname.startsWith(s.to + "/");
              return (
                <Link
                  key={s.to}
                  to={s.to}
                  className={`group flex items-start gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-200 ${
                    isActive
                      ? s.danger
                        ? "border-rose-400/30 bg-rose-400/10"
                        : "border-primary/30 bg-primary/10"
                      : "border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                  }`}
                >
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border transition-colors ${
                      isActive
                        ? s.danger
                          ? "border-rose-400/40 bg-rose-400/15 text-rose-200"
                          : "border-primary/40 bg-primary/20 text-primary"
                        : "border-white/10 bg-white/[0.03] text-muted-foreground group-hover:text-foreground"
                    }`}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-sm font-medium ${isActive ? (s.danger ? "text-rose-100" : "text-foreground") : "text-foreground"}`}
                    >
                      {s.label}
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                      {s.description}
                    </div>
                  </div>
                  {isActive && (
                    <span
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${s.danger ? "bg-rose-300" : "bg-primary shadow-[0_0_10px_var(--primary)]"}`}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Conteúdo */}
        <section className="min-w-0">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
