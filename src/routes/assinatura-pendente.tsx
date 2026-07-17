import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/assinatura-pendente")({
  component: SubscriptionPendingPage,
});

function SubscriptionPendingPage() {
  return (
    <SimplePage
      eyebrow="Assinatura"
      title="Assinatura pendente"
      description="Sua conta existe, mas a assinatura ainda não está ativa. Conclua o pagamento ou contate a equipe."
      actions={[{ label: "Ir para login", to: "/login", variant: "secondary" }]}
    />
  );
}
