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
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_PAYMENTS_ENV`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_CANCEL_URL`
- `STRIPE_PORTAL_RETURN_URL`
- `SUBSCRIPTION_GRACE_PERIOD_DAYS`
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
- `TURNSTILE_SECRET_KEY`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`
- `LOG_LEVEL`

## Observações

- Não versionar `.env`, `.env.local` ou `.dev.vars`.
- Não usar credenciais reais no ZIP.
- Para homologação, preencher somente fora do Git.
- O projeto local validado nesta auditoria não precisou de nenhuma credencial real para `typecheck`, `lint`, `test` e `build`.
