# Environment Setup

Data de referência: 2026-07-17

## Arquivos de exemplo

- `.env.example`
- `.dev.vars.example`

## Variáveis necessárias

- `APP_ENV`
- `APP_NAME`
- `APP_URL`
- `APP_TIMEZONE`
- `ALLOWED_ORIGINS`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_APP_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_SUPPORT_WHATSAPP_NUMBER`
- `VITE_PAYMENTS_ENV`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_PORTAL_RETURN_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `ADMIN_ALERT_EMAIL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_ID`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `LOG_LEVEL`

## Observações

- Não versionar `.env`, `.env.local` ou `.dev.vars`.
- Não usar credenciais reais no ZIP.
- Para homologação, preencher somente fora do Git.
- O projeto local validado nesta auditoria não precisou de nenhuma credencial real para `typecheck`, `lint`, `test` e `build`.

## Alterações — 2026-07-25 (rodada de prontidão para produção)

- `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY` removidas: não havia
  widget no frontend nem verificação no backend em nenhum lugar do
  código — não era proteção "apenas visual", era uma variável sem
  nenhuma implementação. Se o Turnstile for adotado no futuro, será
  necessário implementar o widget, o envio do token ao servidor e a
  chamada a `https://challenges.cloudflare.com/turnstile/v0/siteverify`
  antes de reintroduzir a variável.
- `SUBSCRIPTION_GRACE_PERIOD_DAYS` removida: nenhum código a lia. O
  bloqueio por inadimplência hoje é imediato — assim que uma assinatura
  vira `past_due`, o acesso é cortado (ver `src/hooks/use-auth.tsx`,
  filtro `status in (active, trialing)`). Existe uma coluna
  `subscriptions.grace_period_ends_at` no banco real (visível em
  `src/integrations/supabase/types.ts`) sem nenhum código que a
  preencha ou leia — decisão de produto pendente: implementar carência
  de verdade (webhook grava a data, gate de acesso passa a aceitar
  `past_due` até essa data) ou remover a coluna. Não removida nesta
  auditoria por ser uma alteração de schema (DROP COLUMN) sem acesso ao
  banco real para confirmar que nada mais depende dela.
