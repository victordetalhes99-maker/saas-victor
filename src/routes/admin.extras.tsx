import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/admin/extras")({
  component: ExtrasPage,
});

function ExtrasPage() {
  return (
    <SimplePage
      eyebrow="Serviços"
      title="Serviços adicionais"
      description="Gerencie extras cobrados à parte e duração estimada."
      actions={[{ label: "Agenda", to: "/admin/agenda", variant: "secondary" }]}
    />
  );
}
