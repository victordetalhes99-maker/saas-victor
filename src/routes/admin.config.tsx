import { createFileRoute, redirect } from "@tanstack/react-router";

// Rota antiga preservada apenas como redirect para o novo Centro de Configurações.
export const Route = createFileRoute("/admin/config")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/configuracoes/geral", replace: true });
  },
});
