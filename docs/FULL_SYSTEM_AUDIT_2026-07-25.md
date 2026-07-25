# Auditoria Completa do Sistema — 2026-07-25

## Resumo executivo

**Estado geral:** o sistema está estruturalmente sólido — separação
correta de segredos, RPC de agendamento protegida por exclusion
constraint no Postgres, webhook do Stripe com verificação de assinatura
correta, autorização server-side consistente na maior parte das rotas
administrativas. Os problemas reais encontrados não eram de arquitetura,
e sim de **conexão**: peças bem construídas (funções de servidor,
páginas, colunas de banco) que existiam mas não estavam ligadas entre si
— navegação apontando para o lugar errado, link de e-mail para uma rota
inexistente, configurações que não tinham efeito nenhum no backend.

**Nível de prontidão para produção:** condicional. Os bugs funcionais e
de segurança identificados foram corrigidos e validados
(`typecheck`/`lint`/`test`/`build` limpos). Ainda há pendências reais que
dependem de acesso externo (schema completo do Supabase, painel do
Stripe/Google/Cloudflare) — ver seção "Pendências externas". Não
recomendo produção sem primeiro resolver essas pendências externas.

**Quantidade de problemas encontrados nesta auditoria (rodada 2):** 8
reais e concretos (além dos 4 de segurança já corrigidos na rodada
anterior, 2026-07-25 sessão 1).
**Quantidade corrigida no código:** 8 de 8.
**Pendências reais (não corrigidas, documentadas):** 3 (telas
administrativas ainda não construídas para funcionalidades que já têm
backend pronto: gestão de convites, criação manual de cliente pelo
admin; mais a limitação de schema completo do Supabase).

**Limitações desta auditoria:**
- O pacote enviado não inclui o schema completo do Supabase (apenas as
  migrations mais recentes). Não é possível confirmar 100% das políticas
  RLS de todas as tabelas a partir do código-fonte.
- Não há acesso a um ambiente Supabase/Stripe/Google real — os
  `npm run build`/`test`/`lint`/`typecheck` foram executados de verdade
  neste ambiente, mas não foi possível testar contra um banco de dados
  real (deploy, autenticação real, webhooks reais).
- Fluxos citados no pedido original que não existem neste projeto
  (cadastro de tatuador, integração com Google Drive, envio de
  WhatsApp) não foram "auditados" — foram confirmados como **inexistentes
  no repositório**, não inventados.

---

## Problemas encontrados e corrigidos

### 1. [CRÍTICA] Navegação principal do admin apontava para uma página-fachada

- **Rota/arquivo:** `src/routes/admin.tsx`, `src/routes/admin.index.tsx`,
  `src/routes/admin.solicitacoes.tsx`
- **Comportamento anterior:** o item de menu "Clientes" (usado em toda a
  navegação administrativa) apontava para `/admin/usuarios`, uma página
  stub ("página disponível para expansão da operação"). A página real e
  completa de gestão de clientes (`/admin/clientes`, 831 linhas,
  aprovação de cadastro, suspensão, histórico de pagamento) existia mas
  **não tinha nenhum link apontando para ela em todo o projeto**.
- **Causa raiz:** duplicidade de rotas criadas em momentos diferentes do
  desenvolvimento; a navegação nunca foi atualizada para a rota nova.
- **Correção aplicada:** todos os links "Clientes"/"Ver clientes"
  redirecionados para `/admin/clientes`.
- **Teste executado:** `npm run typecheck`, `npm run build` (confirma
  que a rota existe e resolve); revisão manual de todos os `Link to=`
  do projeto contra a lista real de rotas.
- **Resultado final:** corrigido.

### 2. [CRÍTICA] Link de ativação de conta enviado por e-mail levava a uma rota inexistente

- **Rota/arquivo:** convites gerados em `src/lib/invites.server.ts` e
  `src/lib/invites.functions.ts` apontavam para `/ativar?token=...`; a
  rota `/ativar` não existia em `src/routes`.
- **Comportamento anterior:** todo cliente que recebesse um convite por
  e-mail (criado manualmente pelo admin ou após checkout do Stripe) via
  uma tela 404 ao clicar no link. As funções de servidor
  `validateInvite`/`acceptInvite` já existiam e estavam corretas, mas
  **nenhuma tela em todo o projeto as chamava**.
- **Causa raiz:** a página de ativação nunca foi criada; o backend do
  fluxo de convite foi implementado sem o frontend correspondente.
- **Correção aplicada:** criada `src/routes/ativar.tsx`, que valida o
  token (mostrando erro claro se expirado/usado/inválido), coleta nome e
  senha, chama `acceptInvite` e redireciona para `/login`.
- **Teste executado:** `npm run typecheck`, `npm run build` (rota
  registrada em `routeTree.gen.ts`), revisão de todos os retornos de
  erro (`used`, `expired`, `revoked`, `invalid`) mapeados para mensagens
  específicas.
- **Resultado final:** corrigido.

### 3. [ALTA] "Gerenciar acessos administrativos" era uma cópia do stub de clientes, sem função real

- **Rota/arquivo:** `src/routes/admin.usuarios.tsx`
- **Comportamento anterior:** o link "Gerenciar acessos" (em
  Configurações → Geral) levava à mesma página-fachada do item 1. As
  funções de servidor `updateUserStaffRole`, `createInternalUser` e
  `deleteInternalUser` já existiam, totalmente protegidas no servidor
  (apenas o Owner pode executá-las), mas **nunca eram chamadas por
  nenhuma tela**.
- **Causa raiz:** backend implementado sem o frontend correspondente.
- **Correção aplicada:** `admin.usuarios.tsx` reconstruída como página
  real de gestão de acessos: lista o staff atual (via `user_roles` +
  `profiles`), permite trocar papel, criar novo acesso administrativo e
  revogar acesso — usando as funções já existentes e já protegidas.
- **Teste executado:** `npm run typecheck`, `npm run lint`, `npm run
  build`.
- **Resultado final:** corrigido.

### 4. [MÉDIA] Cliente não tinha como gerenciar cobrança/cancelar assinatura

- **Rota/arquivo:** `src/routes/_authenticated/conta.tsx`
- **Comportamento anterior:** a função `createStripePortalSession`
  (abre o portal de billing do Stripe: atualizar cartão, ver faturas,
  cancelar) existia no servidor mas não era chamada por nenhuma tela.
- **Causa raiz:** backend implementado sem o frontend correspondente.
- **Correção aplicada:** adicionado botão "Gerenciar cobrança e
  pagamento" na página Conta, que chama a função existente e redireciona
  ao portal do Stripe.
- **Teste executado:** `npm run typecheck`, `npm run build`.
- **Resultado final:** corrigido.

### 5. [MÉDIA] Configurações de agenda existiam na UI mas não tinham nenhum efeito no backend

- **Rota/arquivo:** RPC `create_client_appointment`;
  `src/routes/admin.configuracoes.agenda.tsx`;
  `src/routes/admin.configuracoes.zona-de-perigo.tsx`.
- **Comportamento anterior:** `company_settings.min_booking_lead_minutes`
  e `company_settings.emergency_mode` já existiam como colunas e tinham
  telas administrativas para configurá-las (a segunda era um stub), mas
  a função que cria agendamentos (`create_client_appointment`) nunca as
  lia. Um admin podia "ativar modo de emergência" ou definir "30 min de
  antecedência mínima" e nada acontecia de fato — clientes continuavam
  agendando normalmente, inclusive para 1 minuto no futuro.
- **Causa raiz:** regra de negócio configurável no admin, mas nunca
  conectada à camada que efetivamente cria o agendamento — validação
  ausente exatamente onde deveria estar (no banco/RPC), que é o ponto
  citado explicitamente como risco no escopo desta auditoria.
- **Correção aplicada:**
  - Nova migration
    `supabase/migrations/20260725000000_enforce_booking_rules.sql`
    recria `create_client_appointment` preservando 100% da lógica e da
    proteção por exclusion constraint já existente, e adiciona duas
    checagens: `emergency_mode` bloqueia qualquer novo agendamento;
    `min_booking_lead_minutes` exige a antecedência mínima configurada.
  - Nova função de servidor `setEmergencyMode` (owner-only) em
    `src/lib/config.functions.ts`.
  - `admin.configuracoes.zona-de-perigo.tsx` reconstruída como painel
    real de ativação/desativação do modo de emergência, com motivo
    registrado em log (`admin_logs`).
  - Novo helper puro `validateBookingWindow` em
    `src/lib/appointment-rules.ts` espelhando a regra em JavaScript, com
    4 testes automatizados novos.
- **Teste executado:** `npm run test:unit` (17/17, incluindo os 4 novos
  testes), `npm run typecheck`, `npm run build`.
- **Resultado final:** corrigido no código da aplicação e em uma nova
  migration. **Pendência externa:** a migration precisa ser aplicada no
  banco de produção/homologação — não foi (e não poderia ser) aplicada
  automaticamente por esta auditoria.

### 6. [BAIXA] Mensagem de erro de conflito de horário incompleta na agenda do admin

- **Rota/arquivo:** `src/routes/admin.agenda.tsx`
- **Comportamento anterior:** ao remarcar um agendamento para um horário
  que colide com outro, o Postgres retorna o código `23P01`
  (`exclusion_violation`) — mas o tratamento de erro na tela só
  reconhecia `23505` (`unique_violation`). O admin veria a mensagem
  crua do Postgres em vez de "Já existe um agendamento ativo neste
  horário."
- **Causa raiz:** o exclusion constraint (adicionado em
  2026-07-17) usa um código de erro Postgres diferente do índice único
  antigo que ele substituiu, e o tratamento de erro na tela não foi
  atualizado.
- **Correção aplicada:** `friendlyApptError` agora trata `23505` e
  `23P01` da mesma forma.
- **Teste executado:** `npm run typecheck`, `npm run lint`.
- **Resultado final:** corrigido.

### 7. [BAIXA] Código morto: arquivos de exemplo do template e aliases sem uso

- **Rota/arquivo:** `src/lib/api/example.functions.ts`,
  `src/lib/config.server.ts`, `blockUserAccount`/`unblockUserAccount`
  em `src/lib/admin.functions.ts`.
- **Comportamento anterior:** `example.functions.ts`/`config.server.ts`
  eram arquivos de exemplo do template TanStack Start, nunca importados
  pela aplicação real. `blockUserAccount`/`unblockUserAccount` eram
  aliases de `suspendUserAccess`/`restoreUserAccess` que a UI real
  (`admin.clientes.tsx`) já chama diretamente pelo nome original —
  os aliases nunca eram usados.
- **Correção aplicada:** arquivos de exemplo removidos; aliases sem uso
  removidos.
- **Teste executado:** `npm run typecheck`, `npm run lint`, `npm run
  build` (confirmando que nada dependia deles).
- **Resultado final:** corrigido.

### 8. Retomado da rodada anterior (segurança) — ver
`docs/SECURITY_AUDIT_2026-07-25.md` para o detalhamento completo:
- `/api/auth/google` aceitava um `user_id` não autenticado pela query
  string — corrigido para exigir token + papel admin/owner.
- `/api/google-calendar/disconnect` não verificava papel — corrigido
  para exigir admin/owner.
- Rate limiting existente no banco não estava conectado a login,
  cadastro, recuperação de senha, login administrativo e webhook —
  conectado em todos.
- Comparação de assinatura HMAC não era constant-time — corrigida com
  `timingSafeEqual`.

---

## Pendências reais (não corrigidas nesta rodada)

Estas são lacunas genuínas — backend pronto e protegido, mas sem tela —
que decidi **não** construir nesta rodada por serem funcionalidades
novas de escopo considerável (não "bugs" a corrigir, e sim telas
inteiras a desenhar), e por isso preferi documentar com clareza em vez
de entregar algo construído às pressas e não testado a fundo:

1. **Gestão de convites pendentes** — `listInvites`, `resendInvite`,
   `revokeInvite` existem no servidor (owner/admin only) mas não há
   nenhuma tela para o admin ver convites enviados, reenviar ou
   revogar.
2. **Criação manual de cliente pelo admin** — `createClientByAdmin`
   existe e está protegida, mas não há formulário na UI para usá-la (o
   fluxo real hoje é: checkout no Stripe → convite automático).
3. Não constatei função de cancelamento/reagendamento pelo próprio
   cliente (hoje só o admin cancela/remarca, em `admin.agenda.tsx`).
   Pode ser intencional (negócio pequeno, cancelamento por
   telefone/WhatsApp) — não assumi que é bug, só registro a ausência.

---

## Rotas auditadas

| Rota | Tipo | Autenticação | Papel permitido | Status | Observação |
|---|---|---|---|---|---|
| `/` | pública | não | — | OK | landing |
| `/login` | pública | não | — | OK | rate limit conectado nesta auditoria |
| `/cadastro` | pública | não | — | OK | rate limit conectado |
| `/signup` | pública | não | — | OK | redirect para `/cadastro` |
| `/forgot-password` | pública | não | — | OK | rate limit conectado |
| `/reset-password` | pública | não (requer link do e-mail) | — | OK | |
| `/ativar` | pública | não (requer token de convite) | — | **corrigido** | rota criada nesta auditoria |
| `/admin-login` | pública | não | — | OK | rate limit conectado |
| `/painel` | autenticada | sim | qualquer | OK | redirect por papel |
| `/aguardando-aprovacao` | autenticada | sim | client pendente | OK | |
| `/assinatura-pendente` | autenticada | sim | client sem assinatura | OK | |
| `/conta-bloqueada` | autenticada | sim | client bloqueado | OK | |
| `/dashboard`, `/agendar`, `/veiculos`, `/historico`, `/conta`, `/perfil`, `/planos`, `/configuracoes` | autenticada | sim | client | OK | protegidas por `_authenticated.tsx` + gate de assinatura |
| `/excluir-dados` | autenticada | sim | client | OK | |
| `/admin`, `/admin/` | admin | sim | admin/owner | OK | guard client-side + RLS/RPC server-side |
| `/admin/clientes` | admin | sim | admin/owner | **corrigido** | agora alcançável pela navegação |
| `/admin/usuarios` | admin | sim | owner (mutações) | **reconstruído** | gestão de acessos administrativos |
| `/admin/solicitacoes` | admin | sim | admin/owner | placeholder | link corrigido; conteúdo já coberto por `/admin/clientes` |
| `/admin/agenda` | admin | sim | admin/owner | **corrigido** | mensagem de erro de conflito |
| `/admin/relatorios`, `/admin/planos`, `/admin/pagamentos`, `/admin/financeiro`, `/admin/extras` | admin | sim | admin/owner | OK | não alterado nesta rodada |
| `/admin/configuracoes/*` | admin | sim | admin (leitura) / owner (escrita) | OK/corrigido | `zona-de-perigo` reconstruída |
| `/admin/config` | admin | sim | — | OK | redirect legado intencional |
| `/api/health` | API pública | não | — | OK | |
| `/api/auth/google` | API | sim (corrigido) | admin/owner | **corrigido** | era explorável sem login |
| `/api/auth/google/callback` | API | via state assinado | — | OK | HMAC agora constant-time |
| `/api/google-calendar/disconnect` | API | sim (corrigido) | admin/owner | **corrigido** | qualquer client conseguia desconectar |
| `/api/public/payments/webhook` | API pública (Stripe) | assinatura HMAC | — | OK | rate limit por IP conectado |
| `/src/$` | catch-all | não | — | OK | 404 intencional para paths de dev |

---

## Fluxos auditados

| Fluxo | Frontend | API/servidor | Banco | Autorização | Status final |
|---|---|---|---|---|---|
| Cadastro | `cadastro.tsx` | Supabase Auth `signUp` | `profiles` (trigger) | pública | OK, rate limit conectado |
| Login (cliente) | `login.tsx` | Supabase Auth | `profiles`/`user_roles` | pública | OK, rate limit conectado |
| Login (admin) | `admin-login.tsx` | Supabase Auth + `list_user_roles` | `user_roles` | exige staff role | OK, rate limit conectado |
| Recuperação de senha | `forgot-password.tsx` | Supabase Auth | — | pública | OK, rate limit conectado |
| Redefinição de senha | `reset-password.tsx` | Supabase Auth | — | sessão de recovery | OK |
| Aprovação de cadastro | `aguardando-aprovacao.tsx` + `admin.clientes.tsx` | update direto (RLS) | `profiles.status` | admin/owner | OK |
| Bloqueio/suspensão | `admin.clientes.tsx` | `suspendUserAccess`/`restoreUserAccess` | `profiles` | admin/owner (server-side) | OK |
| **Ativação de convite** | **`ativar.tsx` (novo)** | `validateInvite`/`acceptInvite` | `invites`, `profiles`, `subscriptions` | token de convite | **corrigido** |
| Criação de agendamento | `agendar.tsx` | `createClientAppointment` → RPC `create_client_appointment` | `appointments` + exclusion constraint | client autenticado | OK, regras de negócio agora completas |
| Reagendamento/cancelamento (admin) | `admin.agenda.tsx` | update direto (RLS) | `appointments` | admin/owner | **corrigido** (mensagem de erro) |
| Contratação de plano / checkout | `planos.tsx` | `createStripeCheckout` | `subscriptions`, Stripe | client autenticado | OK (não alterado) |
| **Gerenciar cobrança** | **`conta.tsx` (corrigido)** | `createStripePortalSession` | Stripe | client autenticado | **corrigido** |
| Webhook Stripe | — | `/api/public/payments/webhook` | `payment_webhook_events`, `subscriptions`, `profiles` | assinatura HMAC | OK, rate limit conectado |
| Conexão Google Calendar | `admin.configuracoes.integracoes.tsx` | `/api/auth/google` → callback | `integration_connections` | **corrigido para admin/owner** | corrigido |
| Desconexão Google Calendar | idem | `/api/google-calendar/disconnect` | idem | **corrigido para admin/owner** | corrigido |
| Modo de emergência | `zona-de-perigo.tsx` (novo) | `setEmergencyMode` | `company_settings` | owner | **novo, corrigido** |
| Gestão de acessos administrativos | `admin.usuarios.tsx` (reconstruído) | `updateUserStaffRole`/`createInternalUser`/`deleteInternalUser` | `user_roles`, `profiles` | owner | **corrigido** |
| Convites (listar/reenviar/revogar) | — | `listInvites`/`resendInvite`/`revokeInvite` prontos | `invites` | admin/owner | **pendente** (sem tela) |
| Criação manual de cliente pelo admin | — | `createClientByAdmin` prontos | `profiles`, `subscriptions` | admin/owner | **pendente** (sem tela) |

---

## Variáveis de ambiente

| Nome | Ambiente | Pública/Secreta | Obrigatória | Onde é usada | Status |
|---|---|---|---|---|---|
| `APP_ENV`, `APP_NAME`, `APP_URL`, `APP_TIMEZONE` | servidor | secreta (config) | sim (URL) | `env.server.ts` | OK |
| `ALLOWED_ORIGINS` | servidor | secreta (config) | não | `env.server.ts` (`getAllowedOrigins`) | **documentada mas não usada** — nenhuma rota seta CORS com base nela; não é uma falha de segurança (ausência de CORS falha fechado), mas o valor não tem efeito nenhum hoje |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | ambos | anon é pública (espelhada em `VITE_SUPABASE_*`) | sim | `env.server.ts`, `env.public.ts` | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | **secreta** | sim | `client.server.ts` (isolado, nunca no bundle do cliente — confirmado por build real) | OK |
| `VITE_APP_NAME`, `VITE_SUPPORT_WHATSAPP_NUMBER`, `VITE_TURNSTILE_SITE_KEY` | ambos | pública | não | `env.public.ts` | OK |
| `VITE_STRIPE_PUBLISHABLE_KEY` / `STRIPE_PUBLISHABLE_KEY` | ambos | pública | não | checkout | OK |
| `STRIPE_SECRET_KEY` | servidor | **secreta** | sim (pagamentos) | `stripe.functions.ts`, webhook | OK |
| `STRIPE_WEBHOOK_SECRET` | servidor | **secreta** | sim (webhook) | webhook | OK |
| `STRIPE_SUCCESS_URL`/`CANCEL_URL`/`PORTAL_RETURN_URL` | servidor | secreta (config) | não | checkout/portal | OK |
| `SUBSCRIPTION_GRACE_PERIOD_DAYS` | servidor | config | não | não localizei uso direto além do schema — verificar se é lido no cron/rotina de expiração (fora do código revisado) | **verificar** |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `ADMIN_ALERT_EMAIL` | servidor | secreta/config | não | `resend.server.ts`, convites | OK |
| `GOOGLE_CLIENT_ID` | servidor | secreta (mas não é segredo per se) | sim (integração) | OAuth | OK |
| `GOOGLE_CLIENT_SECRET` | servidor | **secreta** | sim | OAuth | OK |
| `GOOGLE_REDIRECT_URI`, `GOOGLE_CALENDAR_ID` | servidor | config | sim/não | OAuth | OK |
| `SESSION_SECRET` | servidor | **secreta** | sim (assinatura de state) | `crypto.server.ts` | OK, comparação agora constant-time |
| `ENCRYPTION_KEY` | servidor | **secreta** | sim (cifra refresh token/segredos) | `crypto.server.ts`, `secrets-store.server.ts` | OK |
| `TURNSTILE_SECRET_KEY` | servidor | **secreta** | não | não localizei chamada de verificação server-side do Turnstile — o site key existe no cliente mas não achei o `siteverify` correspondente | **verificar** |
| `CLOUDFLARE_ACCOUNT_ID`/`API_TOKEN`/`ZONE_ID` | servidor | **secreta** | não | não localizei uso no código-fonte da aplicação (provável uso apenas em deploy/Wrangler, fora do runtime da app) | informativo |
| `LOG_LEVEL`, `SENTRY_DSN` | servidor | config/secreta | não | logging | OK |

Nenhum valor real de segredo foi colocado neste relatório ou em qualquer
arquivo do repositório — apenas nomes e descrições, como já era o
padrão em `.env.example`/`.dev.vars.example`.

**Achados sobre variáveis:**
- `ALLOWED_ORIGINS`/`getAllowedOrigins()` documentada e implementada,
  mas nunca chamada — nenhuma rota aplica CORS com base nela
  (informativo, não é uma vulnerabilidade: a ausência de cabeçalho CORS
  é o padrão seguro).
- `TURNSTILE_SECRET_KEY` está declarada e validada em `env.server.ts`,
  mas não encontrei nenhuma chamada a
  `https://challenges.cloudflare.com/turnstile/v0/siteverify` em todo o
  código-fonte — o site key (`VITE_TURNSTILE_SITE_KEY`) provavelmente
  renderiza o widget no frontend, mas se o token não é verificado no
  servidor, o CAPTCHA é apenas decorativo. **Recomendo verificar** se
  essa verificação existe em uma Edge Function do Supabase não incluída
  neste pacote, ou implementá-la se realmente faltar.
- `SUBSCRIPTION_GRACE_PERIOD_DAYS` está validada no schema mas não
  encontrei o código que a lê para de fato aplicar um período de
  carência antes de bloquear um inadimplente — pode estar implementado
  como uma Supabase Edge Function/cron não incluída neste pacote.

---

## Banco de dados

**Verificado (a partir das migrations incluídas neste pacote):**
- `appointments`: exclusion constraint por intervalo de tempo
  (`EXCLUDE USING gist`), cobrindo status ativos — verificado e
  preservado integralmente, apenas estendido com duas novas checagens
  na função que insere linhas (não na constraint em si).
- `blocked_slots`: índice único por timestamp.
- RPC `create_client_appointment`: `security definer`, `search_path`
  explicitamente fixado em `public` (mitigação correta contra o ataque
  clássico de search_path em funções `SECURITY DEFINER`), valida
  autenticação, propriedade do veículo, assinatura ativa, extras
  válidos, horários bloqueados — agora também modo de emergência e
  antecedência mínima.
- Uso de `service_role`: apenas em `client.server.ts`, sempre carregado
  via `import()` dinâmico dentro de handlers server-only, nunca no nível
  de módulo de arquivos que chegam ao cliente (exceto três rotas de API
  puras que já eram assim antes desta auditoria — não são "cliente"
  no sentido de navegador, e a chave nunca aparece no bundle, confirmado
  por build real).

**Não verificável a partir deste pacote (limitação confirmada):**
- Políticas RLS completas de todas as tabelas (`profiles`,
  `subscriptions`, `appointments`, `vehicles`, `user_roles`,
  `integration_connections`, `integration_secrets`,
  `payment_webhook_events`, `company_settings`, `invites`) — o pacote
  só trouxe duas migrations recentes, não o schema base completo.
- Se existem outras funções `SECURITY DEFINER` fora das duas migrations
  incluídas, e se todas fixam `search_path`.
- Se há índices adequados em colunas de filtro frequente
  (`appointments.scheduled_at`, `subscriptions.user_id`, etc.) — as
  migrations incluídas não mostram o schema base.

**O que exportar para concluir esta parte:** `supabase db dump
--schema public` (ou o script SQL completo do painel, em Database →
Schema Visualizer → "Download schema"), incluindo definição de todas as
tabelas, políticas RLS, functions e triggers.

---

## Testes e comandos executados

Executados de verdade neste ambiente, nesta ordem, após cada lote de
correções:

```
npm install         → OK (478–484 pacotes, sem erro)
npm run typecheck   → OK, 0 erros
npm run lint        → OK, 0 erros, 11 warnings pré-existentes (não relacionados às áreas alteradas)
npm run test:unit   → OK, 17/17 (13 pré-existentes + 4 novos desta rodada)
npm run build       → OK, build de produção (client + SSR + Nitro/Wrangler) sem erros
```

Verificação adicional de segurança: bundle final do cliente
(`.output/public`) inspecionado à procura de valores de
`SUPABASE_SERVICE_ROLE_KEY`, `sk_live`/`sk_test`, `whsec_`,
`GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` — nenhum
valor real encontrado (apenas nomes de campos em um formulário
administrativo).

---

## Arquivos alterados

**Criados:**
- `src/routes/ativar.tsx`
- `src/lib/authz.server.ts`
- `docs/SECURITY_AUDIT_2026-07-25.md`
- `docs/FULL_SYSTEM_AUDIT_2026-07-25.md` (este arquivo)
- `supabase/migrations/20260725000000_enforce_booking_rules.sql`

**Editados:**
- `src/routes/api/auth/google.ts` — remove fallback inseguro, exige admin/owner
- `src/routes/api/google-calendar/disconnect.ts` — exige admin/owner
- `src/lib/crypto.server.ts` — comparação HMAC constant-time
- `src/routes/login.tsx`, `src/routes/admin-login.tsx`,
  `src/routes/cadastro.tsx`, `src/routes/forgot-password.tsx` — rate
  limiting conectado
- `src/routes/api/public/payments/webhook.ts` — rate limiting por IP
- `src/routes/admin.tsx`, `src/routes/admin.index.tsx`,
  `src/routes/admin.solicitacoes.tsx` — navegação corrigida para
  `/admin/clientes`
- `src/routes/admin.usuarios.tsx` — reconstruída (gestão de acessos)
- `src/routes/_authenticated/conta.tsx` — botão de portal de cobrança
- `src/routes/admin.agenda.tsx` — código de erro `23P01` tratado
- `src/routes/admin.configuracoes.zona-de-perigo.tsx` — reconstruída
  (modo de emergência)
- `src/lib/config.functions.ts` — nova função `setEmergencyMode`
- `src/lib/appointment-rules.ts` — novo helper `validateBookingWindow`
- `src/lib/admin.functions.ts` — remoção de aliases mortos

**Removidos:**
- `src/lib/api/example.functions.ts` (arquivo de exemplo do template, sem uso)
- `src/lib/config.server.ts` (idem)

**Migrations criadas:**
- `supabase/migrations/20260725000000_enforce_booking_rules.sql`
  (precisa ser aplicada manualmente no ambiente Supabase)

**Testes adicionados:**
- 4 novos casos em `tests/appointment-rules.test.ts` cobrindo modo de
  emergência, horário no passado e antecedência mínima (aceito/rejeitado)

---

## Pendências externas

Itens que dependem de acesso que esta auditoria não tinha:

- **Supabase:** aplicar a nova migration
  (`20260725000000_enforce_booking_rules.sql`) no ambiente de
  homologação/produção; exportar o schema completo para uma futura
  revisão de RLS; confirmar se `SUBSCRIPTION_GRACE_PERIOD_DAYS` é
  aplicado por alguma Edge Function não incluída neste pacote.
- **Cloudflare:** confirmar bindings/secrets reais no Wrangler
  (`CLOUDFLARE_ACCOUNT_ID`, `API_TOKEN`, `ZONE_ID`) — não usados no
  código da aplicação, prováveis variáveis de deploy apenas.
- **Google Cloud:** confirmar que o `GOOGLE_REDIRECT_URI` cadastrado no
  console corresponde exatamente ao domínio de produção após a correção
  de autorização em `/api/auth/google`.
- **Cloudflare Turnstile:** confirmar se existe verificação server-side
  do token (`TURNSTILE_SECRET_KEY`) em algum lugar fora deste pacote —
  não encontrada no código revisado.
- **Domínio/DNS:** fora do escopo do código-fonte.
- **Credenciais reais:** nenhuma foi fornecida nem seria apropriado
  testar contra produção a partir desta auditoria.

---

## Confirmação de prontidão

**Não recomendo produção ainda**, não por bugs conhecidos e não
corrigidos no código (todos os que encontrei foram corrigidos), mas
porque:
1. A nova migration ainda não foi aplicada em nenhum banco real.
2. A verificação de RLS completa depende do schema completo, não
   incluído neste pacote.
3. O Turnstile e o período de carência de inadimplência têm uso
   incerto (podem estar corretos em uma Edge Function não incluída, ou
   podem ser lacunas reais) — precisam de confirmação.

Com esses três pontos resolvidos/confirmados, o código-fonte em si está
em condição de ir para produção.
