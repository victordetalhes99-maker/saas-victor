import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/relatorios")({
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <SimplePage
      eyebrow="Relatórios"
      title="Relatórios operacionais"
      description="Painel reservado para exportações e indicadores do negócio."
      actions={[{ label: "Financeiro", to: "/admin/financeiro", variant: "secondary" }]}
    />
  );
}
