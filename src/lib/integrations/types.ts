/**
 * Tipos e registro central das integrações do sistema.
 * Este arquivo é seguro para importar do cliente — não contém segredos
 * nem lógica de acesso a chaves privadas.
 */

export type JsonValue =
  string | number | boolean | null | { [k: string]: JsonValue | undefined } | JsonValue[];

export type JsonRecord = { [k: string]: JsonValue | undefined };

export type IntegrationStatus =
  "connected" | "not_configured" | "testing" | "error" | "disabled" | "action_required";

export type IntegrationCategory =
  "infrastructure" | "payments" | "email" | "messaging" | "calendar";

export type IntegrationEnvVar = {
  name: string;
  description: string;
  scope: "public" | "server" | "deploy";
  required: boolean;
};

export type IntegrationDefinition = {
  id: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  features: string[];
  envVars: IntegrationEnvVar[];
  /** True se a integração suporta testConnection() real. */
  testable: boolean;
  /** True se possui webhook público que precisa ser configurado no provedor. */
  hasWebhook?: boolean;
  webhookHint?: string;
  docsUrl?: string;
};

export type IntegrationProvider =
  "supabase" | "stripe" | "resend" | "whatsapp" | "google_calendar" | "cloudflare";

export type IntegrationSnapshot = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  isEnabled: boolean;
  isConfigured: boolean;
  lastCheckedAt: string | null;
  lastSyncAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  /** Metadata sanitizada — nunca contém segredos. */
  metadata: JsonRecord;
  /** Nome das env vars ausentes (só nomes, nunca valores). */
  missingEnvVars: string[];
};

export const INTEGRATION_REGISTRY: IntegrationDefinition[] = [
  {
    id: "supabase",
    name: "Supabase",
    description: "Banco de dados, autenticação e storage.",
    category: "infrastructure",
    features: ["Banco de dados", "Autenticação", "Storage"],
    testable: true,
    envVars: [
      {
        name: "SUPABASE_URL",
        description: "URL do projeto Supabase.",
        scope: "server",
        required: true,
      },
      {
        name: "SUPABASE_ANON_KEY",
        description: "Chave pública/anon.",
        scope: "server",
        required: true,
      },
      {
        name: "SUPABASE_SERVICE_ROLE_KEY",
        description: "Chave de serviço (server-only).",
        scope: "server",
        required: true,
      },
      {
        name: "VITE_SUPABASE_URL",
        description: "URL do Supabase para o cliente.",
        scope: "public",
        required: true,
      },
      {
        name: "VITE_SUPABASE_ANON_KEY",
        description: "Chave pública para o cliente.",
        scope: "public",
        required: true,
      },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Pagamentos e assinaturas recorrentes.",
    category: "payments",
    features: ["Checkout", "Assinaturas", "Webhooks", "Portal do cliente"],
    testable: true,
    hasWebhook: true,
    webhookHint:
      "Configure o endpoint /api/public/payments/webhook e cadastre STRIPE_WEBHOOK_SECRET na hospedagem.",
    envVars: [
      {
        name: "STRIPE_SECRET_KEY",
        description: "Secret key do ambiente atual (sk_test_… ou sk_live_…).",
        scope: "server",
        required: true,
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        description: "Signing secret do webhook do ambiente atual (whsec_…).",
        scope: "server",
        required: true,
      },
      {
        name: "VITE_STRIPE_PUBLISHABLE_KEY",
        description: "Chave publishable (pk_…) para o frontend.",
        scope: "public",
        required: true,
      },
      {
        name: "APP_URL",
        description: "URL pública do app.",
        scope: "server",
        required: true,
      },
      {
        name: "STRIPE_SUCCESS_URL",
        description: "URL de retorno após checkout aprovado.",
        scope: "server",
        required: true,
      },
      {
        name: "STRIPE_CANCEL_URL",
        description: "URL de retorno após checkout cancelado.",
        scope: "server",
        required: true,
      },
      {
        name: "STRIPE_PORTAL_RETURN_URL",
        description: "URL de retorno do portal do cliente Stripe.",
        scope: "server",
        required: true,
      },
    ],
    docsUrl: "https://dashboard.stripe.com/apikeys",
  },
  {
    id: "resend",
    name: "Resend",
    description: "E-mails transacionais.",
    category: "email",
    features: ["Recuperação de senha", "Alertas", "Confirmações"],
    testable: true,
    envVars: [
      {
        name: "RESEND_API_KEY",
        description: "API key do Resend (re_…).",
        scope: "server",
        required: true,
      },
      {
        name: "EMAIL_FROM",
        description: "Remetente verificado, por exemplo App <no-reply@dominio.com>.",
        scope: "server",
        required: true,
      },
      {
        name: "EMAIL_REPLY_TO",
        description: "Reply-to opcional para respostas humanas.",
        scope: "server",
        required: false,
      },
      {
        name: "ADMIN_ALERT_EMAIL",
        description: "Destinatário de alertas operacionais.",
        scope: "server",
        required: false,
      },
    ],
    docsUrl: "https://resend.com/api-keys",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    description: "Notificações, confirmações e lembretes.",
    category: "messaging",
    features: ["Confirmações", "Lembretes", "Alertas"],
    testable: true,
    envVars: [
      {
        name: "WHATSAPP_PROVIDER",
        description: "Identificador do provedor (meta, twilio, evolution…).",
        scope: "server",
        required: true,
      },
      {
        name: "WHATSAPP_API_URL",
        description: "URL base da API do provedor.",
        scope: "server",
        required: true,
      },
      {
        name: "WHATSAPP_API_TOKEN",
        description: "Token de acesso à API.",
        scope: "server",
        required: true,
      },
      {
        name: "WHATSAPP_PHONE_NUMBER_ID",
        description: "ID do número emissor.",
        scope: "server",
        required: false,
      },
      {
        name: "WHATSAPP_BUSINESS_ACCOUNT_ID",
        description: "ID da conta business (Meta).",
        scope: "server",
        required: false,
      },
      {
        name: "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
        description: "Verify token do webhook.",
        scope: "server",
        required: false,
      },
      {
        name: "WHATSAPP_APP_SECRET",
        description: "App secret para validar assinatura de webhook.",
        scope: "server",
        required: false,
      },
    ],
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description: "Sincronização de agenda com Google.",
    category: "calendar",
    features: ["Criar eventos", "Atualizar eventos", "Leitura de agenda"],
    testable: true,
    envVars: [
      {
        name: "GOOGLE_CLIENT_ID",
        description: "OAuth Client ID.",
        scope: "server",
        required: true,
      },
      {
        name: "GOOGLE_CLIENT_SECRET",
        description: "OAuth Client Secret.",
        scope: "server",
        required: true,
      },
      {
        name: "GOOGLE_REDIRECT_URI",
        description: "URI de redirect OAuth registrado.",
        scope: "server",
        required: true,
      },
      {
        name: "GOOGLE_CALENDAR_ID",
        description: "ID do calendário alvo (primary ou email).",
        scope: "server",
        required: false,
      },
      {
        name: "SESSION_SECRET",
        description: "Segredo para assinar o estado do OAuth.",
        scope: "server",
        required: true,
      },
      {
        name: "ENCRYPTION_KEY",
        description: "Chave usada para cifrar o refresh token no banco.",
        scope: "server",
        required: true,
      },
    ],
    docsUrl: "https://console.cloud.google.com/apis/credentials",
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    description: "Infraestrutura, DNS e CDN.",
    category: "infrastructure",
    features: ["Deploy", "DNS", "CDN", "Segurança"],
    testable: true,

    envVars: [
      {
        name: "CLOUDFLARE_ACCOUNT_ID",
        description: "Account ID da conta Cloudflare.",
        scope: "deploy",
        required: true,
      },
      {
        name: "CLOUDFLARE_API_TOKEN",
        description: "API token com permissões apropriadas.",
        scope: "deploy",
        required: true,
      },
      {
        name: "CLOUDFLARE_ZONE_ID",
        description: "Zone ID do domínio (opcional).",
        scope: "deploy",
        required: false,
      },
      {
        name: "CLOUDFLARE_PROJECT_NAME",
        description: "Nome do projeto Pages/Workers.",
        scope: "deploy",
        required: false,
      },
    ],
    docsUrl: "https://dash.cloudflare.com/profile/api-tokens",
  },
];

export function getIntegrationDefinition(id: IntegrationProvider): IntegrationDefinition {
  const def = INTEGRATION_REGISTRY.find((i) => i.id === id);
  if (!def) throw new Error(`Integração desconhecida: ${id}`);
  return def;
}

/**
 * Máscara segura para exibição de valores sensíveis.
 * Nunca revela mais de 4 caracteres do final.
 */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length < 8) return "•".repeat(trimmed.length);
  const prefixMatch = trimmed.match(
    /^(sk_(?:live|test)_|pk_(?:live|test)_|re_|whsec_|token_|Bearer\s+)/i,
  );
  const prefix = prefixMatch ? prefixMatch[0] : "";
  return `${prefix}••••••••${trimmed.slice(-4)}`;
}
