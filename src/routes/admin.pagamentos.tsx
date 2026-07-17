import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/pagamentos")({
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <SimplePage
      eyebrow="Stripe"
      title="Pagamentos"
      description="Confira webhook, sessão de checkout e estado dos pagamentos recorrentes."
      actions={[{ label: "Abrir configurações", to: "/admin/configuracoes/pagamentos" }]}
    />
  );
}
