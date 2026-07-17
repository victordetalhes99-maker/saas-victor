import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/aguardando-aprovacao")({
  component: AwaitingApprovalPage,
});

function AwaitingApprovalPage() {
  return (
    <SimplePage
      eyebrow="Acesso"
      title="Cadastro em análise"
      description="Seu acesso ainda aguarda aprovação da equipe. Assim que liberado, você poderá entrar na área do cliente."
      actions={[{ label: "Voltar ao login", to: "/login", variant: "secondary" }]}
    />
  );
}
