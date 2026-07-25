# Auditoria de Segurança — 2026-07-25

Escopo pedido: revisão completa de agendamentos (conflitos de horário),
pagamentos, sessões/login e variáveis de ambiente/API, com correção do
que fosse encontrado (não apenas relatório).

## 1. Agendamentos (conflitos de horário)

Já existia, de uma auditoria anterior (2026-07-17), uma solução robusta:

- `supabase/migrations/20260717090000_secure_appointment_booking.sql`
  cria um **exclusion constraint** (`EXCLUDE USING gist`) sobre o
  intervalo `[scheduled_at, scheduled_at + estimated_minutes)` para
  status ativos (`scheduled`, `confirmed`, `in_progress`). Isso torna
  **impossível no banco** dois agendamentos ativos se sobrepondo,
  mesmo sob concorrência — não depende de checagem na aplicação.
- A criação de agendamento passa por uma função `security definer`
  (`create_client_appointment`) que valida: usuário autenticado, veículo
  pertence ao usuário, assinatura ativa com lavagens restantes, extras
  válidos e ativos, e horários bloqueados (`blocked_slots`).
- Existe consulta de diagnóstico
  (`supabase/diagnostics/2026-07-17_appointment_integrity_diagnostic.sql`)
  para detectar sobreposições, duplicatas e inconsistências antes de
  aplicar a constraint em produção.
- 13 testes automatizados cobrindo colisão exata, parcial, contida,
  adjacente, concorrência e uso de veículo de outro cliente — todos
  passando (`npm run test`).

**Nenhuma alteração necessária aqui.** Recomendação: rodar o SQL de
diagnóstico contra o banco de produção antes de qualquer nova aplicação
da migration, caso ainda não tenha sido aplicada.

## 2. Vulnerabilidades encontradas e corrigidas nesta rodada

### 2.1 `GET /api/auth/google` — início de OAuth sem autenticação real (CRÍTICO)

**Antes:** se não houvese um bearer token válido, o endpoint aceitava um
`user_id` vindo da **query string, sem nenhuma verificação**, e seguia o
fluxo OAuth do Google com esse id. Como `integration_connections` é uma
linha única e global (a empresa tem uma única conexão de calendário),
qualquer pessoa não autenticada podia acessar
`/api/auth/google?user_id=<qualquer-uuid>` e, ao completar o consentimento
com a própria conta Google, **substituir a conexão do Google Calendar do
negócio** pela conta do atacante.

**Correção:** `src/routes/api/auth/google.ts` agora exige um bearer token
Supabase válido (sem fallback nenhum de query string) **e** que o usuário
tenha papel `admin`/`owner` — via novo helper `requireAdminRequest` em
`src/lib/authz.server.ts`. Sem isso, responde `401`/`403`.

### 2.2 `POST /api/google-calendar/disconnect` — falta de controle de acesso (CRÍTICO)

**Antes:** verificava apenas se havia *um* bearer token válido — de
**qualquer** usuário, inclusive cliente comum — e desconectava a
integração global do Google Calendar da empresa.

**Correção:** `src/routes/api/google-calendar/disconnect.ts` agora exige
papel `admin`/`owner` (mesmo helper `requireAdminRequest`).

### 2.3 Rate limiting existia no banco, mas não estava conectado em nenhuma tela

Havia toda a infraestrutura pronta (`auth_attempts` no Postgres, RPCs
`check_auth_rate_limit` / `record_auth_attempt`, e os wrappers
`checkRateLimit`/`recordAttempt` em `src/lib/rate-limit.functions.ts` e
`checkWebhookRateLimit`/`recordWebhookAttempt` em
`src/lib/rate-limit.server.ts`), mas **nenhuma tela ou rota chamava
essas funções** — login de cliente, login administrativo, cadastro,
recuperação de senha e o webhook do Stripe estavam sem qualquer limite
de tentativas no nível da aplicação (o login de cliente/admin ainda
contava com o rate limit padrão do GoTrue/Supabase, mas não com o
limite mais granular por IP+e-mail já modelado no schema).

**Correção — conectado em:**
- `src/routes/login.tsx` (login do cliente)
- `src/routes/admin-login.tsx` (login administrativo — o mais sensível)
- `src/routes/cadastro.tsx` (criação de conta)
- `src/routes/forgot-password.tsx` (recuperação de senha)
- `src/routes/api/public/payments/webhook.ts` (rate limit por IP antes
  de processar o corpo do webhook)

Em todos os casos: checa o limite antes da tentativa e registra
sucesso/falha depois, sem vazar contagens exatas ao usuário (mensagem
genérica "aguarde alguns minutos").

### 2.4 Comparação de assinatura HMAC não era constant-time

`verifySignedPayload` (usado para validar o `state` assinado do fluxo
OAuth do Google) comparava a assinatura com `===`, suscetível a timing
attack em teoria. Trocado por `crypto.timingSafeEqual` em
`src/lib/crypto.server.ts` (o webhook do Stripe já fazia isso
corretamente).

## 3. Áreas revisadas e já corretas (sem alteração)

- **Variáveis de ambiente**: `src/lib/env.server.ts` e
  `src/lib/env.public.ts` separam claramente segredos de servidor
  (Supabase service role, Stripe secret, Google client secret, Resend,
  Turnstile, Cloudflare) de variáveis públicas (`VITE_*`). Nenhum
  arquivo `.env` real está no pacote — apenas `.env.example` e
  `.dev.vars.example` com valores fictícios. `.gitignore` cobre
  `.env*`, `.dev.vars*`. Confirmado por build real: a chave de serviço
  do Supabase **não aparece** no bundle enviado ao navegador.
- **`supabaseAdmin` (service role)**: isolado em
  `client.server.ts`, carregado sempre via `import()` dinâmico dentro
  dos handlers nos arquivos `*.functions.ts`, nunca importado por
  código de componente/cliente.
- **Webhook do Stripe**: assinatura verificada com HMAC-SHA256 +
  `timingSafeEqual` + janela de 5 minutos contra replay.
- **Autorização administrativa**: todas as `createServerFn` em
  `admin.functions.ts`, `config.functions.ts` e
  `integrations.functions.ts` que alteram dados sensíveis
  (papéis de usuário, configurações da empresa, chaves de integração)
  chamam `ensureAdmin`/`ensureOwner` antes de qualquer escrita. Ações
  que só afetam o próprio usuário (perfil, senha, preferências de
  aparência) corretamente dispensam esse checchecagem, pois já são
  restritas a `context.userId`.
- **Convites**: token de 256 bits (`randomBytes(32)`), armazenado só
  como hash SHA-256, expira em 48h, consumido atomicamente via RPC
  (protege contra reuso concorrente).
- **Segredos de integrações** (`secrets-store.server.ts`): valores
  cifrados em repouso com AES-256-GCM antes de ir ao banco.

## 4. Testes executados após as correções

```
npm run typecheck   → OK
npm run test:unit    → 13/13 passando
npm run lint          → 0 erros, 11 warnings pré-existentes (não relacionados)
npm run build          → build de produção concluído sem erros
```

Verificação adicional: bundle final do cliente (`.output/public`)
inspecionado à procura de `SUPABASE_SERVICE_ROLE_KEY`, `sk_live`,
`sk_test`, `whsec_`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`,
`ENCRYPTION_KEY` — a única ocorrência é o **nome** desses campos na
tela administrativa de gerenciamento de chaves (rótulos de formulário),
nunca o valor real.

## 5. Arquivos modificados nesta rodada

- `src/lib/authz.server.ts` (novo)
- `src/routes/api/auth/google.ts`
- `src/routes/api/google-calendar/disconnect.ts`
- `src/lib/crypto.server.ts`
- `src/routes/login.tsx`
- `src/routes/admin-login.tsx`
- `src/routes/cadastro.tsx`
- `src/routes/forgot-password.tsx`
- `src/routes/api/public/payments/webhook.ts`

## 6. Riscos residuais / recomendações

- Este pacote não inclui o **schema base completo** do Supabase (apenas
  as duas migrations mais recentes), então não foi possível revisar
  100% das políticas RLS de todas as tabelas a partir do código-fonte.
  Recomendo exportar o schema completo (`supabase db dump` ou o painel)
  numa próxima rodada para confirmar que toda tabela sensível
  (`profiles`, `subscriptions`, `appointments`, `vehicles`,
  `user_roles`, `integration_connections`, `integration_secrets`) tem
  RLS habilitada com policies coerentes com as regras já aplicadas no
  código.
- Antes de aplicar a migration de exclusion constraint em produção
  (se ainda não aplicada), rode o diagnóstico SQL primeiro.
- Considere também aplicar rate limit ao endpoint de convite
  (`validateInvite`/`acceptInvite`); hoje a proteção é só o tamanho do
  token (256 bits), que já é suficiente contra força bruta, mas um
  limite por IP adiciona defesa em profundidade barata.
