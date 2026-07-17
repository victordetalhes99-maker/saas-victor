import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";

const ADMIN_LINKS = [
  { to: "/admin/", label: "Visão geral" },
  { to: "/admin/usuarios", label: "Clientes" },
  { to: "/admin/solicitacoes", label: "Solicitações" },
  { to: "/admin/agenda", label: "Agenda" },
  { to: "/admin/relatorios", label: "Relatórios" },
  { to: "/admin/planos", label: "Planos" },
  { to: "/admin/pagamentos", label: "Pagamentos" },
  { to: "/admin/financeiro", label: "Financeiro" },
  { to: "/admin/extras", label: "Extras" },
  { to: "/admin/configuracoes", label: "Configurações" },
];

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/admin-login", replace: true });
      return;
    }
    if (!isAdmin) {
      void navigate({ to: "/admin-login", replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        Carregando...
      </div>
    );
  }

  return (
    <div className="mx-auto grid min-h-screen max-w-7xl gap-4 px-4 py-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Painel administrativo
        </div>
        <nav className="space-y-1">
          {ADMIN_LINKS.map((link) => {
            const active =
              location.pathname === link.to || location.pathname.startsWith(link.to + "/");
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`block rounded-2xl px-3 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 rounded-[28px] border border-white/10 bg-white/[0.02] p-5">
        <Outlet />
      </main>
    </div>
  );
}
