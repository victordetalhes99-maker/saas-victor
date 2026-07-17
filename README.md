# Clube Detail

Aplicação SaaS em `TanStack Start + Supabase`, pronta para Cloudflare Workers, com área do cliente, painel administrativo, pagamentos Stripe, e-mails transacionais via Resend e integração OAuth com Google Calendar.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run deploy`

O script de deploy usa `wrangler deploy --keep-vars` para preservar variáveis e secrets já cadastrados no Worker remoto.

## Ambiente

Copie `.env.example` para o ambiente local e preencha apenas com valores reais fora do Git.

### Variáveis principais

| Variável                    | Finalidade                         | Escopo             | Obrigatória | Cadastro              |
| --------------------------- | ---------------------------------- | ------------------ | ----------- | --------------------- |
| `APP_URL`                   | URL pública do SaaS                | servidor           | sim         | Cloudflare Worker     |
| `SUPABASE_URL`              | URL do projeto Supabase            | servidor           | sim         | Cloudflare secret/var |
| `SUPABASE_ANON_KEY`         | chave pública do Supabase          | público + servidor | sim         | Cloudflare secret/var |
| `SUPABASE_SERVICE_ROLE_KEY` | chave admin do Supabase            | servidor           | sim         | Cloudflare secret     |
| `STRIPE_SECRET_KEY`         | secret key do Stripe               | servidor           | sim         | Cloudflare secret     |
| `STRIPE_WEBHOOK_SECRET`     | assinatura do webhook Stripe       | servidor           | sim         | Cloudflare secret     |
| `STRIPE_PUBLISHABLE_KEY`    | publishable key do Stripe          | público            | sim         | Cloudflare var        |
| `RESEND_API_KEY`            | envio de e-mails                   | servidor           | sim         | Cloudflare secret     |
| `EMAIL_FROM`                | remetente transacional             | servidor           | sim         | Cloudflare var        |
| `GOOGLE_CLIENT_ID`          | OAuth Google                       | servidor           | sim         | Cloudflare secret/var |
| `GOOGLE_CLIENT_SECRET`      | OAuth Google                       | servidor           | sim         | Cloudflare secret     |
| `GOOGLE_REDIRECT_URI`       | callback OAuth Google              | servidor           | sim         | Cloudflare var        |
| `SESSION_SECRET`            | assinatura de estado/cookies       | servidor           | sim         | Cloudflare secret     |
| `ENCRYPTION_KEY`            | criptografia de tokens persistidos | servidor           | sim         | Cloudflare secret     |

### Prefixos públicos aceitos

Somente variáveis `VITE_*` explicitamente consumidas por [src/lib/env.public.ts](C:/Users/atila/Documents/GitHub/APP-cliente-adm/src/lib/env.public.ts) entram no bundle do frontend.

## Cloudflare Worker

- Worker esperado: `app-complexo`
- URL esperada: `https://app-complexo.victordetalhes99.workers.dev`
- Configuração local versionada: [wrangler.jsonc](C:/Users/atila/Documents/GitHub/APP-cliente-adm/wrangler.jsonc)

O arquivo do Wrangler não contém secrets. Valores sensíveis devem ser cadastrados como `secret` no Worker já existente.

## Stripe

- Checkout recorrente via [src/lib/stripe.functions.ts](C:/Users/atila/Documents/GitHub/APP-cliente-adm/src/lib/stripe.functions.ts)
- Webhook verificado via `Stripe-Signature` em [src/routes/api/public/payments/webhook.ts](C:/Users/atila/Documents/GitHub/APP-cliente-adm/src/routes/api/public/payments/webhook.ts)
- Use `stripe_price_id` na tabela `plans`
- Defina o endpoint do webhook para `https://app-complexo.victordetalhes99.workers.dev/api/public/payments/webhook`

## Google Calendar

- Início OAuth: `GET /api/auth/google`
- Callback: `GET /api/auth/google/callback`
- Desconexão: `POST /api/google-calendar/disconnect`

O refresh token é cifrado antes de ser persistido em `integration_connections`.

## Segurança

- Não versione `.env`, `.env.*`, `.dev.vars` ou chaves privadas.
- Não exponha `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SESSION_SECRET` ou `ENCRYPTION_KEY`.
- O backend aplica headers de segurança em [src/server.ts](C:/Users/atila/Documents/GitHub/APP-cliente-adm/src/server.ts).
- O banco aplica verificação de assinatura ativa/grace period para agendamentos pela migration `20260712102000_8f5bde0f_env_payments_google_hardening.sql`.
