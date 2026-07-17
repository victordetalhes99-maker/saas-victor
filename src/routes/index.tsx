import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import hero from "@/assets/car-hero.png";
import { SimplePage } from "@/components/simple-page";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    void navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  }, [isAdmin, loading, navigate, user]);

  return (
    <SimplePage
      eyebrow="Clube Detail"
      title="Gestão de assinaturas, agenda e operações."
      description="Aplicação pronta para área do cliente, painel administrativo, integração com Supabase, Stripe e Cloudflare."
      actions={[
        { label: "Entrar", to: "/login" },
        { label: "Criar conta", to: "/cadastro", variant: "secondary" },
      ]}
    >
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Use o painel para agendar serviços, acompanhar assinaturas e administrar clientes em
            tempo real.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Supabase Auth
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Stripe Billing
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Google Calendar
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              Cloudflare
            </span>
          </div>
          <Link to="/admin-login" className="inline-flex text-sm font-medium text-primary">
            Acesso administrativo
          </Link>
        </div>
        <img
          src={hero}
          alt="Carro em destaque"
          className="h-56 w-full rounded-[28px] border border-white/10 object-cover"
        />
      </div>
    </SimplePage>
  );
}
