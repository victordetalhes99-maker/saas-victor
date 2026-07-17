import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";

export const Route = createFileRoute("/termos")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <SimplePage
      eyebrow="Legal"
      title="Termos de uso"
      description="Uso autorizado apenas para clientes e administradores da operação."
      actions={[{ label: "Voltar", to: "/", variant: "secondary" }]}
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>O acesso à plataforma depende de conta ativa e das regras operacionais do clube.</p>
        <p>Agendamentos dependem de disponibilidade, regras da agenda e assinatura válida.</p>
      </div>
    </SimplePage>
  );
}
