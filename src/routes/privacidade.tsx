import { createFileRoute } from "@tanstack/react-router";
import { SimplePage } from "@/components/simple-page";
import { COMPANY_INFO } from "@/config/company";

export const Route = createFileRoute("/privacidade")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SimplePage
      eyebrow="LGPD"
      title="Política de Privacidade"
      description={`Contato de privacidade: ${COMPANY_INFO.emailDpo}.`}
      actions={[{ label: "Voltar", to: "/", variant: "secondary" }]}
    >
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Os dados são usados para autenticação, agendamento, faturamento e suporte.</p>
        <p>Você pode solicitar exclusão na área autenticada.</p>
      </div>
    </SimplePage>
  );
}
