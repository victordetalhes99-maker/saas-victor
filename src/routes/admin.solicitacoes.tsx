import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/solicitacoes")({
  component: RequestsPage,
});

function RequestsPage() {
  return (
    <SimplePage
      eyebrow="Operação"
      title="Solicitações"
      description="Entrada para pedidos manuais, aprovações e ajustes operacionais."
      actions={[{ label: "Ver clientes", to: "/admin/usuarios", variant: "secondary" }]}
    />
  );
}
