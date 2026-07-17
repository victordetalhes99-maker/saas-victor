import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/club/Logo";
import { UserProfileDrawer } from "@/components/user-profile-drawer";
import { Calendar, Car, Home, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
  head: () => ({
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "googlebot", content: "noindex, nofollow" },
    ],
  }),
});

const SUBSCRIPTION_REQUIRED_PREFIXES = ["/dashboard", "/agendar", "/veiculos", "/historico"];

function AuthLayout() {
  const { user, loading, isAdmin, profileStatus, hasActiveSubscription, subscriptionLoading } =
    useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/login", replace: true });
      return;
    }
    // Contas administrativas nunca acessam a área do cliente.
    if (isAdmin) {
      nav({ to: "/admin", replace: true });
      return;
    }
    // Contas bloqueadas: nenhum acesso a rotas privadas.
    if (!isAdmin && profileStatus === "blocked" && loc.pathname !== "/conta-bloqueada") {
      nav({ to: "/conta-bloqueada", replace: true });
      return;
    }
    // Approval gate: non-admin clients whose profile isn't active go to the waiting page.
    if (
      !isAdmin &&
      profileStatus &&
      profileStatus !== "active" &&
      profileStatus !== "blocked" &&
      loc.pathname !== "/aguardando-aprovacao"
    ) {
      nav({ to: "/aguardando-aprovacao", replace: true });
      return;
    }
    if (subscriptionLoading) return;
    const needsSubscription = SUBSCRIPTION_REQUIRED_PREFIXES.some(
      (p) => loc.pathname === p || loc.pathname.startsWith(p + "/"),
    );
    // Bypass de teste: e-mail de demonstração entra mesmo sem assinatura ativa.
    if (needsSubscription && !isAdmin && !hasActiveSubscription) {
      nav({ to: "/assinatura-pendente", replace: true });
    }
  }, [
    user,
    loading,
    subscriptionLoading,
    isAdmin,
    profileStatus,
    hasActiveSubscription,
    loc.pathname,
    nav,
  ]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  const navItems = [
    { to: "/dashboard", label: "Início", icon: Home },
    { to: "/agendar", label: "Agendar", icon: Calendar },
    { to: "/veiculos", label: "Veículos", icon: Car },
    { to: "/historico", label: "Histórico", icon: History },
  ];

  const isAgendar = loc.pathname === "/agendar" || loc.pathname.startsWith("/agendar/");

  return (
    <div className="relative min-h-screen ambient-bg pb-[120px] md:pb-10">
      {/* Ambient light blobs */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="blob-anim absolute -top-32 -left-24 h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
        <div
          className="blob-anim absolute -bottom-40 -right-24 h-[480px] w-[480px] rounded-full bg-[oklch(0.55_0.18_220)]/15 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0.1_0.012_255/0.5)_100%)]" />
      </div>

      <header className="sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 backdrop-blur-xl">
          <Link to="/dashboard" className="transition-transform hover:scale-[1.02]">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            <UserProfileDrawer />
          </div>
        </div>
      </header>

      <main
        className={`mx-auto max-w-5xl px-4 pt-2 pb-[100px] md:pb-10 ${isAgendar ? "mt-2 rounded-t-3xl bg-card/40 shadow-[var(--shadow-float)] backdrop-blur-sm" : ""}`}
      >
        <Outlet />
      </main>

      <footer className="mx-auto mt-6 max-w-5xl px-4 pb-24 text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50 md:pb-2">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link to="/privacidade" className="hover:text-primary">
            Privacidade
          </Link>
          <span aria-hidden>·</span>
          <Link to="/termos" className="hover:text-primary">
            Termos
          </Link>
          <span aria-hidden>·</span>
          <Link to="/excluir-dados" className="hover:text-primary">
            Excluir meus dados
          </Link>
        </div>
      </footer>

      {/* Floating glass dock — sempre visível */}
      <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),16px)] md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between rounded-full border border-white/5 bg-card px-2 py-2 shadow-xl shadow-black/40">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active =
              loc.pathname === to || (to !== "/dashboard" && loc.pathname.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`group relative flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 transition-all duration-300 ${
                  active ? "text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-primary shadow-[var(--shadow-glow-soft)] transition-all duration-300" />
                )}
                <span className="relative z-10 flex flex-col items-center gap-0.5">
                  <Icon
                    className={`h-[18px] w-[18px] transition-transform duration-300 ${active ? "scale-110" : "group-active:scale-90"}`}
                  />
                  <span className="text-[9px] font-medium tracking-wider uppercase">{label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
