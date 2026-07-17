import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/usuarios")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <SimplePage
      eyebrow="Clientes"
      title="Gestão de clientes"
      description="Página disponível para expansão da operação. Use o perfil e a agenda para tarefas do dia a dia."
      actions={[{ label: "Abrir agenda", to: "/admin/agenda" }]}
    />
  );
}
