import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/planos")({
  component: PlansPage,
});

function PlansPage() {
  return (
    <SimplePage
      eyebrow="Assinaturas"
      title="Planos"
      description="Ajuste valores, benefícios e IDs de preço do Stripe."
      actions={[{ label: "Pagamentos", to: "/admin/pagamentos", variant: "secondary" }]}
    />
  );
}
