import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/conta-bloqueada")({
  component: BlockedAccountPage,
});

function BlockedAccountPage() {
  return (
    <SimplePage
      eyebrow="Conta"
      title="Conta bloqueada"
      description="O acesso foi suspenso. Fale com a equipe responsável para regularização."
      actions={[{ label: "Ir para login", to: "/login", variant: "secondary" }]}
    />
  );
}
