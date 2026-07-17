import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/painel")({
  component: PainelRedirect,
});

function PainelRedirect() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }
    void navigate({ to: isAdmin ? "/admin" : "/dashboard", replace: true });
  }, [loading, user, isAdmin, navigate]);

  return <SimplePage eyebrow="Carregando" title="Redirecionando..." description="Aguarde." />;
}
