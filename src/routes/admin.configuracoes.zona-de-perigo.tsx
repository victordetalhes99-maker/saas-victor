import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/configuracoes/zona-de-perigo")({
  component: DangerZonePage,
});

function DangerZonePage() {
  return (
    <SimplePage
      eyebrow="Perigo"
      title="Zona de perigo"
      description="Ações sensíveis e irreversíveis devem ficar isoladas aqui."
      actions={[{ label: "Segurança", to: "/admin/configuracoes/seguranca", variant: "secondary" }]}
    />
  );
}
