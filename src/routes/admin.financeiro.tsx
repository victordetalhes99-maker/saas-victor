import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinancePage,
});

function FinancePage() {
  return (
    <SimplePage
      eyebrow="Financeiro"
      title="Controle financeiro"
      description="Espaço para conciliação e auditoria de receitas."
      actions={[{ label: "Pagamentos", to: "/admin/pagamentos", variant: "secondary" }]}
    />
  );
}
