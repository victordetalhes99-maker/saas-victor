# Central de Integrações

Arquitetura da seção `Painel administrativo -> Configurações -> Integrações`.

## Princípios

- Nenhum secret vai para o frontend.
- O painel só exibe nomes de variáveis e metadados sanitizados.
- Testes reais de conexão acontecem no servidor.
- O sistema suporta estado `not_configured`, `action_required`, `connected` e `error`.

## Variáveis usadas

### Supabase

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Stripe

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_PORTAL_RETURN_URL`
- `SUBSCRIPTION_GRACE_PERIOD_DAYS`

Webhook:

- Endpoint: `https://app-complexo.victordetalhes99.workers.dev/api/public/payments/webhook`
- Preserve secrets remotos usando `wrangler deploy --keep-vars`

### Resend

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `ADMIN_ALERT_EMAIL`

### Google Calendar

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_ID`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`

Fluxo OAuth:

1. `GET /api/auth/google`
2. Google redireciona para `GET /api/auth/google/callback`
3. O refresh token cifrado é salvo em `integration_connections`
4. `POST /api/google-calendar/disconnect` remove a conexão

Use estes valores em produção:

- `APP_URL=https://app-complexo.victordetalhes99.workers.dev`
- `GOOGLE_REDIRECT_URI=https://app-complexo.victordetalhes99.workers.dev/api/auth/google/callback`
- `APP_TIMEZONE=America/Fortaleza`

### Cloudflare

- `CLOUDFLARE_ACCOUNT_ID` (somente mÃ¡quina local/CI)
- `CLOUDFLARE_API_TOKEN` (somente mÃ¡quina local/CI)
- `CLOUDFLARE_ZONE_ID` (somente mÃ¡quina local/CI, opcional)

NÃ£o cadastre essas variÃ¡veis no runtime do Worker a menos que o cÃ³digo passe a chamar a API da Cloudflare em execuÃ§Ã£o.

Worker versionado:

- `app-complexo`
- [wrangler.jsonc](C:/Users/atila/Documents/GitHub/APP-cliente-adm/wrangler.jsonc)

## Banco

Novas estruturas relevantes:

- `integration_connections`
- `payment_webhook_events`
- colunas de grace period/bloqueio em `subscriptions`
- colunas `google_event_id` e `google_sync_status` em `appointments`

## Observações operacionais

- `payment_webhook_events` garante idempotência do Stripe.
- `integration_connections` persiste a conexão Google sem expor refresh token em texto puro.
- O trigger `enforce_active_subscription_for_appointments` impede agendamento com assinatura sem acesso válido.
