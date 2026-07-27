import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/club/Logo";
import {
  LayoutDashboard,
  Users,
  Inbox,
  CalendarRange,
  FileBarChart,
  Package,
  Wallet,
  PiggyBank,
  Sparkles,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";

const NAV_GROUPS: Array<{
  label: string;
  links: Array<{ to: string; label: string; icon: any; end?: boolean }>;
}> = [
  {
    label: "Operação",
    links: [
      { to: "/admin/", label: "Visão geral", icon: LayoutDashboard, end: true },
      { to: "/admin/solicitacoes", label: "Solicitações", icon: Inbox },
      { to: "/admin/clientes", label: "Clientes", icon: Users },
      { to: "/admin/agenda", label: "Agenda", icon: CalendarRange },
    ],
  },
  {
    label: "Comercial",
    links: [
      { to: "/admin/planos", label: "Planos", icon: Package },
      { to: "/admin/extras", label: "Extras", icon: Sparkles },
      { to: "/admin/pagamentos", label: "Pagamentos", icon: Wallet },
      { to: "/admin/financeiro", label: "Financeiro", icon: PiggyBank },
      { to: "/admin/relatorios", label: "Relatórios", icon: FileBarChart },
    ],
  },
  {
    label: "Administração",
    links: [
      { to: "/admin/convites", label: "Convites", icon: UserPlus },
      { to: "/admin/usuarios", label: "Usuários e acessos", icon: UsersRound },
      { to: "/admin/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
];

const ADMIN_LINKS = NAV_GROUPS.flatMap((g) => g.links);

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AdminLayout() {
  const { user, isAdmin, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) {
      void navigate({ to: "/admin-login", replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const activeLink = useMemo(() => {
    return (
      ADMIN_LINKS.find((l) =>
        l.end ? location.pathname === l.to : location.pathname.startsWith(l.to),
      ) ?? ADMIN_LINKS[0]
    );
  }, [location.pathname]);

  const primaryRole = roles.includes("owner")
    ? "Owner"
    : roles.includes("admin")
      ? "Admin"
      : roles[0]
        ? roles[0][0].toUpperCase() + roles[0].slice(1)
        : "Staff";

  if (loading || !user || !isAdmin) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background">
        <BackgroundFX />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Carregando painel...
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <BackgroundFX />

      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        {/* Sidebar — desktop */}
        <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-[linear-gradient(180deg,oklch(0.14_0.018_220/0.6),oklch(0.11_0.012_250/0.4))] px-4 py-5 backdrop-blur-xl lg:flex">
          <SidebarContent
            activeTo={activeLink.to}
            userEmail={user.email ?? ""}
            role={primaryRole}
            onSignOut={() => {
              void signOut();
              void navigate({ to: "/admin-login", replace: true });
            }}
          />
        </aside>

        {/* Sidebar — mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="anim-rise relative flex h-full w-[280px] flex-col border-r border-white/[0.08] bg-[oklch(0.12_0.015_230)] px-4 py-5">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent
                activeTo={activeLink.to}
                userEmail={user.email ?? ""}
                role={primaryRole}
                onSignOut={() => {
                  void signOut();
                  void navigate({ to: "/admin-login", replace: true });
                }}
              />
            </aside>
          </div>
        )}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-background/70 px-4 py-3.5 backdrop-blur-xl sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-foreground lg:hidden"
              >
                <Menu className="h-4 w-4" />
              </button>
              <nav className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <span className="hidden sm:inline">Painel</span>
                <ChevronRight className="hidden h-3.5 w-3.5 sm:inline" />
                <span className="truncate font-medium text-foreground">{activeLink.label}</span>
              </nav>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary sm:flex">
              <ShieldCheck className="h-3.5 w-3.5" />
              {primaryRole}
            </div>
          </header>

          {/* Page content */}
          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  activeTo,
  userEmail,
  role,
  onSignOut,
}: {
  activeTo: string;
  userEmail: string;
  role: string;
  onSignOut: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-6 flex items-center justify-between px-1">
        <Logo />
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.links.map(({ to, label, icon: Icon }) => {
                const active = to === activeTo;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                      active
                        ? "bg-[linear-gradient(180deg,oklch(0.88_0.22_145),oklch(0.78_0.2_155))] text-primary-foreground shadow-[0_8px_24px_-8px_oklch(0.85_0.22_145/0.5)]"
                        : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "" : "opacity-70"}`} />
                    <span className="truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-3 border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
            {userEmail.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-foreground">{userEmail}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{role}</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,oklch(0.10_0.02_200)_0%,oklch(0.13_0.015_250)_45%,oklch(0.16_0.03_170)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_80%_0%,oklch(0.85_0.22_145/0.10),transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(45%_40%_at_0%_100%,oklch(0.55_0.15_210/0.10),transparent_70%)]" />
    </div>
  );
}
