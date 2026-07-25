# Prontidão para Produção — 2026-07-25 (rodada final)

## 1. Resumo executivo

Esta rodada não repete a auditoria funcional/de segurança já concluída
(ver `docs/SECURITY_AUDIT_2026-07-25.md` e
`docs/FULL_SYSTEM_AUDIT_2026-07-25.md`). Ela fecha pendências
específicas que dependiam de decisão de produto ou de acesso externo, e
tudo que era possível resolver **sem acesso ao Supabase/Stripe/Google
reais** foi resolvido diretamente no código nesta rodada:

- Migration de agendamento revisada e reforçada para ser autocontida
  (não assume mais que colunas já existem no banco real).
- `TURNSTILE_SECRET_KEY`/`VITE_TURNSTILE_SITE_KEY` removidas — não havia
  nenhuma implementação em lugar nenhum (nem widget, nem verificação),
  não era "proteção visual", era 100% inexistente.
- `SUBSCRIPTION_GRACE_PERIOD_DAYS` removida — nenhum código a lia; o
  bloqueio por inadimplência é imediato hoje, sem carência.
- As duas telas administrativas pendentes (gestão de convites, criação
  manual de cliente) foram **construídas por completo**, usando o
  backend que já existia e já era protegido por papel.
- Todos os checks locais (`typecheck`, `lint`, `test`, `build`)
  reexecutados e limpos após as mudanças.

**O que esta rodada não pôde fazer, e por quê:** os itens 2, 3, 9 (parte
de execução), 10 (parte de logs ao vivo) e 11 do pedido original exigem
acesso a um Supabase real, a um domínio publicado, ou a um painel — nada
disso foi fornecido nesta conversa (nenhum dump de schema foi anexado, e
não há acesso de rede a supabase.co, stripe.com, google.com nem a
domínios de terceiros a partir deste ambiente). Essas seções abaixo
foram entregues como **checklists e instruções exatas de execução**,
não como resultados fabricados. Ver §10 "Pendências externas".

---

## 2. Migration pendente — revisão detalhada

Arquivo: `supabase/migrations/20260725000000_enforce_booking_rules.sql`

**Nome e ordem:** prefixo `20260725000000`, posterior às duas migrations
existentes (`20260715000000`, `20260717090000`) — ordem cronológica
correta, sem conflito de nome.

**Problema encontrado e corrigido nesta rodada:** a versão anterior
presumia que as colunas `company_settings.emergency_mode`,
`emergency_mode_at`, `emergency_mode_by`, `emergency_mode_reason` e
`min_booking_lead_minutes` já existiam no banco real, com base apenas no
arquivo gerado `src/integrations/supabase/types.ts`. Isso é uma
suposição razoável (esse arquivo é descrito como "automaticamente
gerado" a partir do banco), mas nunca deveria ser a **única** garantia
para uma migration — se por qualquer motivo o arquivo de tipos estiver
desatualizado ou essas colunas tiverem sido criadas fora de uma
migration versionada, a função falharia com "column does not exist" ao
ser aplicada.

**Correção aplicada:** a migration agora começa com
`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para as 5 colunas, com
defaults seguros (`emergency_mode boolean not null default false`,
`min_booking_lead_minutes integer not null default 0`), e adiciona uma
`CHECK` de faixa (`0` a `10080` minutos = 7 dias) em um bloco `DO $$ ...
END $$` que só cria a constraint se ela ainda não existir. Isso torna a
migration **idempotente e autocontida**: pode ser aplicada com
segurança independentemente do estado real dessas colunas.

**Checklist pedido:**
| Item | Situação |
|---|---|
| `IF EXISTS`/`IF NOT EXISTS` | ✅ adicionado em todas as 5 colunas e na constraint |
| Valores padrão | ✅ `false`/`0`, seguros e conservadores (não bloqueiam nada por padrão) |
| Restrições | ✅ `CHECK` de faixa adicionada para `min_booking_lead_minutes` |
| Tipos | `boolean`, `timestamptz`, `uuid`, `text`, `integer` — compatíveis com o que `src/lib/config.functions.ts` já lê/escreve |
| Registros já existentes | ✅ `ADD COLUMN` com default preenche linhas existentes automaticamente; `CREATE OR REPLACE FUNCTION` não afeta dados |
| Rollback lógico | Não há "down" migration automática neste repositório (nenhuma das 3 migrations existentes tem uma). Rollback manual: reaplicar o corpo da função de `20260717090000_secure_appointment_booking.sql` remove as duas checagens novas; as colunas/constraint são seguras para deixar no banco mesmo revertendo a função (não quebram nada, só ficam sem uso) |
| Impacto em produção | Baixo: `CREATE OR REPLACE FUNCTION` é atômico; `ADD COLUMN ... DEFAULT` em Postgres moderno (11+) não reescreve a tabela inteira para valores constantes; a única leitura nova é um `SELECT` em `company_settings` (tabela pequena, uma linha) |
| Compatibilidade com a função atual | ✅ mesma assinatura (`create_client_appointment(timestamptz, uuid, uuid[])`), mesmo tipo de retorno — não quebra `src/lib/appointments.functions.ts` |

**Proteção contra conflito de horário — confirmação explícita:** a
migration **não toca** no `EXCLUDE USING gist` criado em
`20260717090000_secure_appointment_booking.sql`. Essa constraint vive na
tabela `appointments`, não na função; a função recriada nesta migration
continua fazendo `INSERT INTO public.appointments (...)`, então qualquer
tentativa de inserir um horário sobreposto a um agendamento ativo
continua sendo rejeitada pelo Postgres com `23P01`, exatamente como
antes. Não removida, não enfraquecida.

**Comando exato para aplicar em homologação/produção** (não executado
por esta auditoria — sem acesso ao projeto Supabase real):

```bash
# Via Supabase CLI, a partir da raiz do projeto, com o projeto certo
# selecionado (supabase link --project-ref <ref> já feito):
supabase db push

# OU, para inspecionar antes de aplicar:
supabase db diff --schema public
supabase migration up --db-url "$SUPABASE_DB_URL"
```

Ou, colando o conteúdo do arquivo diretamente no SQL Editor do painel
Supabase (Database → SQL Editor) e executando uma vez.

**Recomendado antes de aplicar:** rodar a query de diagnóstico já
existente em
`supabase/diagnostics/2026-07-17_appointment_integrity_diagnostic.sql`
para confirmar que não há sobreposição de agendamentos ativos hoje (a
exclusion constraint já deveria estar impedindo isso desde 07-17, mas
vale checar antes de qualquer nova migration em produção).

---

## 3. Database drift

**Limitação confirmada:** nenhum dump de schema (`pg_dump`,
`supabase db dump`, export do Schema Visualizer) foi fornecido nesta
conversa nem em nenhuma anterior. A comparação abaixo usa como melhor
proxy disponível o arquivo `src/integrations/supabase/types.ts`
(descrito no próprio repositório como gerado automaticamente a partir do
banco real) e os textos de função presentes nas 3 migrations incluídas.
Isso **não substitui** um dump real: tipos gerados não trazem policies
de RLS, corpo de funções não incluídas nas migrations deste pacote
(`has_role`, `list_user_roles`, `validate_invite_token`,
`consume_invite_token`, `check_auth_rate_limit`, `record_auth_attempt`,
`handle_new_user` — todas chamadas pelo código, nenhuma com SQL
disponível neste pacote), nem triggers.

**Divergências encontradas dentro do que é possível verificar:**

| Tipo | Item | Situação |
|---|---|---|
| Coluna existente, código não usa | `subscriptions.grace_period_ends_at` | Existe no `types.ts`; nenhum código lê ou escreve. Ver §7. |
| Coluna existente, agora usada (nova) | `company_settings.emergency_mode*`, `min_booking_lead_minutes` | Já existiam no `types.ts`; agora efetivamente lidas pela RPC (migration desta rodada também garante a existência via `IF NOT EXISTS`, então funciona mesmo se o `types.ts` estiver desatualizado). |
| Função referenciada, sem SQL no pacote | `has_role`, `list_user_roles`, `validate_invite_token`, `consume_invite_token`, `check_auth_rate_limit`, `record_auth_attempt`, e o trigger/função `handle_new_user` (mencionado em comentário de `admin.functions.ts`) | Não incluídas nas migrations deste pacote. Não é possível confirmar `SECURITY DEFINER`/`search_path`/lógica interna a partir do código-fonte. **Ação necessária:** exportar essas definições (`pg_get_functiondef`) para auditoria completa. |
| Tabela referenciada, sem migration correspondente | `invites`, `payment_webhook_events`, `integration_connections`, `integration_secrets`, `admin_logs`, `auth_attempts`, `profiles`, `user_roles`, `plans`, `extra_services`, `vehicles`, `subscriptions` | Todas usadas extensivamente no código e presentes no `types.ts`, mas nenhuma tem `CREATE TABLE` neste pacote — o schema base foi criado fora das migrations incluídas (provavelmente diretamente no painel/Lovable Cloud antes deste repositório começar a versionar migrations). Isso não é necessariamente um erro, mas significa que **este repositório de migrations, sozinho, não recria o banco do zero** — só aplica incrementos sobre uma base que já existe em produção. |

**Conclusão desta seção:** impossível fechar 100% sem o dump. O que
está aqui é honesto e correto dentro do que os arquivos permitem ver;
não fabriquei nenhuma conclusão sobre políticas ou colunas que não
consigo enxergar.

---

## 4. Auditoria de RLS

**Não é possível auditar RLS a partir deste pacote.** Políticas
`ROW LEVEL SECURITY` não aparecem em nenhum artefato incluído: não
existem em `types.ts` (tipos gerados nunca incluem policies), e as 3
migrations do repositório só contêm a exclusion constraint e a função
`create_client_appointment` — nenhuma delas cria ou altera policies.

**O que confirmo apenas indiretamente, pelo comportamento do código:**
- O padrão do projeto é usar dois clientes Supabase distintos:
  `context.supabase` (RLS-scoped, com o JWT do usuário — usado nas
  telas comuns) e `supabaseAdmin` (service role, bypassa RLS —
  isolado em `client.server.ts`, só acessível via handlers de servidor,
  sempre atrás de uma checagem de papel como `ensureAdmin`/`ensureOwner`
  antes de qualquer escrita sensível). Esse padrão é consistente em
  todos os arquivos `*.functions.ts` revisados nas rodadas anteriores.
- Isso sugere fortemente que a intenção de design é "RLS protege o
  cliente comum; rotas administrativas usam service role com checagem
  de papel no código" — um padrão válido e comum — mas **não prova**
  que as policies de RLS nas tabelas estão de fato corretas e habilitadas
  para o cliente comum (`profiles`, `appointments`, `vehicles`,
  `subscriptions`), porque não tenho como ler as policies em si.

**Comando exato para extrair o que falta** (rodar no SQL Editor do
Supabase ou via `psql`):

```sql
-- Lista todas as tabelas do schema public e se RLS está habilitado
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- Lista todas as policies existentes, por tabela, comando e roles
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
```

Com a saída dessas duas queries eu consigo, em uma próxima rodada,
preencher de fato a tabela pedida (RLS habilitado, policies de
SELECT/INSERT/UPDATE/DELETE, acesso anon/authenticated, isolamento entre
clientes) para `profiles`, `appointments`, `subscriptions`,
`payment_webhook_events`, `company_settings`,
`integration_connections`, `integration_secrets`, `admin_logs`,
`invites`, `user_roles` e demais tabelas sensíveis. **Sem essa saída,
qualquer afirmação sobre RLS aqui seria inventada — por isso não fiz
nenhuma.**

**Sinal de alerta que consigo apontar mesmo sem a saída:** se ao rodar a
primeira query alguma das tabelas sensíveis listadas acima aparecer com
`rowsecurity = false`, isso é crítico e deve bloquear produção
imediatamente — não a reabilite via código, resolva a policy.

---

## 5. Funções e RPCs

**Auditadas (SQL disponível neste pacote):**

| Função | `SECURITY` | `search_path` | Observação |
|---|---|---|---|
| `create_client_appointment` | `DEFINER` | `set search_path = public` ✅ | Usa `auth.uid()` internamente (não confia em parâmetro do cliente para identidade); todos os parâmetros de negócio (veículo, extras) são revalidados contra o banco, nunca aceitos "no valor". Retorno limitado a 4 colunas (não há retorno excessivo de dados). Idempotência: não é idempotente por design (cada chamada cria um novo agendamento) — correto para essa operação; a proteção contra duplicidade fica a cargo da exclusion constraint, que é a ferramenta certa para isso, não idempotência de função. |

**Não auditadas (SQL não incluído neste pacote — chamadas existem no
código, definição não):**

`has_role`, `list_user_roles`, `validate_invite_token`,
`consume_invite_token`, `check_auth_rate_limit`, `record_auth_attempt`,
e o(s) trigger(s) por trás de `handle_new_user`.

**Risco concreto de não poder revisar essas funções:** `has_role` é a
função mais crítica do sistema de autorização — praticamente toda rota
administrativa (`ensureAdmin`, `assertAdmin`) depende dela para decidir
se alguém é admin. Se essa função não tiver `search_path` fixo e for
`SECURITY DEFINER`, ela é vulnerável ao ataque clássico de
"search_path hijacking" (alguém cria uma tabela/função `public.role`
ou similar que a função acaba resolvendo por engano). **Esta é a
verificação mais importante pendente para o veredito final.**

**Comando exato para extrair:**

```sql
select p.proname,
       p.prosecdef as security_definer,
       pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'has_role', 'list_user_roles', 'validate_invite_token',
    'consume_invite_token', 'check_auth_rate_limit',
    'record_auth_attempt', 'handle_new_user'
  );
```

---

## 6. Triggers, constraints e índices

**Confirmado (nas migrations incluídas):**
- `appointments_active_timeslot_excl` (exclusion constraint via
  `EXCLUDE USING gist`) — impede dois agendamentos ativos sobrepostos.
  Preservada e reconfirmada nesta rodada (§2).
- `blocked_slots_blocked_at_unique` (índice único) — evita bloqueio de
  horário duplicado no mesmo timestamp exato.
- Nova (`20260725000000`): `company_settings_min_booking_lead_minutes_check`
  — impede valores negativos ou absurdamente altos (>7 dias) na
  antecedência mínima.

**Não verificável neste pacote:** triggers de criação de perfil
(`handle_new_user`, mencionado em comentários do código mas sem SQL
incluído), triggers de auditoria, foreign keys e `ON DELETE` de
`subscriptions`/`payment_webhook_events`/`invites`/`admin_logs`,
índices em colunas de filtro frequente
(`appointments.scheduled_at`, `subscriptions.user_id`,
`profiles.status`) — todas dependem do dump completo (§3/§4).

**Comando exato para extrair:**

```sql
select trigger_name, event_manipulation, event_object_table, action_timing
from information_schema.triggers
where trigger_schema = 'public'
order by event_object_table;

select conname, conrelid::regclass as table_name, contype, pg_get_constraintdef(oid)
from pg_constraint
where connamespace = 'public'::regnamespace
order by table_name;

select indexname, tablename, indexdef
from pg_indexes
where schemaname = 'public'
order by tablename;
```

---

## 7. Variáveis revisadas

### `TURNSTILE_SECRET_KEY` / `VITE_TURNSTILE_SITE_KEY`

Fluxo completo verificado passo a passo, conforme pedido:

1. Frontend gera o token? **Não.** Nenhum componente renderiza o widget
   Turnstile em nenhuma tela (`login.tsx`, `cadastro.tsx`,
   `admin-login.tsx`, `forgot-password.tsx` revisados — nenhum importa
   ou referencia Turnstile).
2. Token enviado ao backend? **Não** — não existe token para enviar.
3. Backend recebe o token? **Não.**
4. Backend valida na Cloudflare? **Não.** Nenhuma chamada a
   `challenges.cloudflare.com/turnstile/v0/siteverify` em todo o
   código-fonte.
5. Backend bloqueia operação em falha? **Não aplicável** (não há
   validação para falhar).
6. Chave secreta usada só no servidor? **Não aplicável** (não é usada
   em lugar nenhum).
7. Timeout/falha externa tratados? **Não aplicável.**

**Decisão tomada:** removida (variável, schema Zod, `.env.example`,
`.dev.vars.example`, `docs/ENVIRONMENT_SETUP.md`), seguindo a opção
explícita dada — "não faz parte do produto hoje". Documentado o que
seria necessário para implementar de verdade caso o Turnstile seja
adotado no futuro (ver `docs/ENVIRONMENT_SETUP.md`, seção de
alterações). Não implementei o Turnstile do zero nesta rodada porque
isso seria construir uma funcionalidade nova de anti-bot (frontend +
backend + wiring em 4 formulários), não "religar" algo que já existia
parcialmente — decisão de produto que prefiro deixar explícita para
confirmação humana em vez de decidir sozinho no meio de uma rodada de
prontidão para produção.

### `SUBSCRIPTION_GRACE_PERIOD_DAYS`

**Determinação:** o sistema **não possui** período de carência
funcionando hoje. `src/hooks/use-auth.tsx` filtra assinatura ativa com
`.in("status", ["active", "trialing"])` — assim que o webhook do Stripe
marca uma assinatura como `past_due` (em `invoice.payment_failed`), o
acesso do cliente é cortado na hora, sem nenhuma janela de tolerância.

**Achado relevante:** existe uma coluna real no banco,
`subscriptions.grace_period_ends_at` (confirmada em
`src/integrations/supabase/types.ts`), que sugere que esse recurso foi
planejado em algum momento, mas nenhum código a preenche ou lê.

**Decisão tomada:** removida a variável de ambiente e a documentação
associada (ela não reflete o comportamento real do produto hoje — "não
deixar variável morta sugerindo funcionalidade inexistente" era
explícito no pedido). **Não removi a coluna do banco** — isso seria uma
alteração de schema (`DROP COLUMN`) sem visibilidade sobre se algo mais
depende dela, o que é uma ação destrutiva demais para decidir sem acesso
ao banco real. Deixei documentado como pendência de decisão de produto
em `docs/ENVIRONMENT_SETUP.md`: implementar a carência de verdade
(webhook grava `grace_period_ends_at`, gate de acesso passa a aceitar
`past_due` até essa data) ou, se a intenção real é bloquear
imediatamente mesmo, formalizar isso (dropar a coluna depois de
confirmar que nada mais a usa) em uma migration futura com acesso ao
banco.

---

## 8. Telas administrativas pendentes — resolvidas

Ambas foram **construídas por completo** nesta rodada, e não apenas
ocultadas, porque o backend já existia pronto e protegido:

### Gestão de convites
- Nova rota `src/routes/admin.convites.tsx`.
- Lista convites (`listInvites`), com status calculado
  (pendente/ativado/revogado/expirado), reenvio (`resendInvite`,
  gera novo token e nova expiração de 48h) e revogação
  (`revokeInvite`).
- Protegida no servidor por `assertAdmin` (já existia nas 3 funções,
  não alterado).

### Criação manual de cliente
- Mesma rota, seção "Criar cliente manualmente": formulário
  nome/e-mail/telefone/plano, chama `createClientByAdmin` (já existente,
  protegido por `ensureAdmin`). Reaproveita conta existente se o e-mail
  já tiver Auth (evita duplicar), gera link de definição de senha
  quando cria do zero, e mostra esse link na tela para o admin copiar e
  repassar manualmente (a função não envia e-mail automático nesse
  caminho — comportamento preexistente, não alterado).
- Link de acesso adicionado em `admin.clientes.tsx` ("Convidar ou criar
  cliente manualmente"), já que é uma ação relacionada à gestão de
  clientes.

Nenhum stub, placeholder ou botão sem ação restou no admin após esta
rodada — confirmado por grep: zero funções em `*.functions.ts` sem
nenhum import em `src/` (ver §12).

---

## 9. Checklist de homologação no domínio publicado

Este checklist é para **execução manual** após o deploy, com 3 contas
de teste separadas (`cliente@teste`, `admin@teste`, `owner@teste`).
Não foi executado por esta auditoria — não há domínio publicado
acessível a partir deste ambiente.

### Cadastro → ativação → login (cliente)
- [ ] `/cadastro` cria conta e redireciona corretamente conforme o
      status retornado (`session` vs sem sessão)
- [ ] Convite manual (`/admin/convites`, como admin) gera link de
      definição de senha válido
- [ ] Convite automático (checkout Stripe de teste) chega por e-mail com
      link para `/ativar?token=...` e o link funciona (token válido,
      não expirado)
- [ ] `/ativar` com token inválido/expirado/revogado mostra mensagem
      clara, sem 500
- [ ] Login com e-mail/senha recém-criados funciona e redireciona para
      `/dashboard`

### Sessão e navegação
- [ ] F5 em `/dashboard`, `/admin`, `/admin/clientes` mantém sessão
      (sem logout inesperado)
- [ ] Acesso direto por URL a `/admin/*` sem estar logado redireciona
      para `/admin-login`
- [ ] Cliente comum tentando acessar `/admin/*` diretamente é bloqueado
- [ ] Logout limpa sessão e bloqueia volta por "voltar" do navegador

### Estados de conta
- [ ] Conta pendente de aprovação vai para `/aguardando-aprovacao`
- [ ] Admin aprova em `/admin/clientes` e o cliente recupera acesso sem
      precisar logar de novo (realtime já implementado em `use-auth.tsx`)
- [ ] Bloqueio (`/admin/clientes`, suspender) tira o acesso do cliente
      imediatamente
- [ ] Reativação devolve o acesso

### Agendamento
- [ ] Criar agendamento em horário livre funciona
- [ ] Duas abas/dispositivos tentando o mesmo horário simultaneamente:
      só uma cria, a outra recebe erro de conflito com mensagem amigável
      (não erro cru do Postgres) — testar tanto em `/agendar` (cliente)
      quanto em `/admin/agenda` (reagendar para colidir)
- [ ] Tentar agendar com antecedência menor que
      `min_booking_lead_minutes` configurado é rejeitado com mensagem
      clara
- [ ] Ativar "modo de emergência" em `/admin/configuracoes/zona-de-perigo`
      e confirmar que `/agendar` passa a rejeitar novos agendamentos;
      desativar e confirmar que volta ao normal
- [ ] Cancelamento pelo admin em `/admin/agenda` reflete no histórico
      do cliente

### Pagamentos
- [ ] Checkout de um plano cria `subscription` com status correto após
      o webhook processar
- [ ] Portal de cobrança (`/conta`, botão "Gerenciar cobrança") abre o
      portal real do Stripe e volta para a URL configurada
- [ ] Webhook: disparar um evento de teste do Stripe CLI
      (`stripe trigger checkout.session.completed`) e confirmar que
      `payment_webhook_events` registra e `subscriptions`/`profiles`
      são atualizados
- [ ] Reenviar o mesmo evento de webhook (idempotência): não deve
      duplicar nem corromper o estado

### Integrações
- [ ] Conectar Google Calendar como admin/owner funciona
      (`/api/auth/google` → consentimento → callback)
- [ ] Tentar acessar `/api/auth/google` sem estar logado como
      admin/owner retorna 401/403 (regressão da correção de segurança
      da rodada anterior)
- [ ] Desconectar como cliente comum (chamando a API diretamente) deve
      falhar com 403 (mesma regressão)
- [ ] Google Drive: **não existe no código-fonte deste projeto** — não
      há nada a testar aqui; se o negócio espera essa integração, é uma
      funcionalidade a ser construída do zero, não uma auditoria
- [ ] E-mail (Resend): convite, ativação de assinatura — chegam e o
      conteúdo renderiza corretamente

### Permissões administrativas
- [ ] `/admin/usuarios` como admin (não owner): pode ver a lista, mas
      trocar papel/criar/revogar deve falhar com mensagem "Somente o
      Owner..." (checar no navegador que o erro do servidor aparece)
- [ ] Mesmas ações como owner: funcionam

### Responsividade e erros
- [ ] Telas principais (`/dashboard`, `/agendar`, `/admin/clientes`,
      `/admin/convites`) sem conteúdo cortado em mobile real (não só
      DevTools)
- [ ] Erros de API (ex.: cortar internet no meio de um agendamento)
      mostram mensagem amigável, não tela branca

### Rede e cookies
- [ ] Cookies do fluxo OAuth do Google (`google_oauth_state`,
      `google_oauth_verifier`) têm `Secure` no domínio HTTPS real
      (confirmar no DevTools → Application → Cookies)
- [ ] `GOOGLE_REDIRECT_URI` configurado no Google Cloud Console bate
      exatamente com o domínio publicado
- [ ] CORS: como não há cabeçalhos CORS explícitos nas rotas de API
      (ver `docs/FULL_SYSTEM_AUDIT_2026-07-25.md`), confirmar que
      nenhum frontend de terceiro depende de chamar essas rotas
      via `fetch` do navegador a partir de outra origem — se depender,
      vai falhar silenciosamente e precisa de CORS explícito

---

## 10. Observabilidade

**Revisão de código (possível sem ambiente ao vivo):**
- Erros de autenticação, rate limit, falhas de webhook e de integração
  já geram `console.error`/`console.warn` no servidor, e a maioria das
  ações administrativas sensíveis (troca de papel, suspensão,
  desconexão de integração, criação de cliente, modo de emergência)
  grava em `admin_logs` com `admin_id`, ação e payload — bom padrão de
  auditoria já existente e ampliado nesta rodada (`emergency_mode_*` e
  criação manual de cliente também logam).
- Verifiquei manualmente todos os `console.*` em `src/lib` e
  `src/routes/api`: nenhum loga senha, token, chave, cookie ou corpo
  bruto de requisição — sempre objetos de erro (`error.message`) ou
  identificadores não sensíveis.
- Mensagens de erro retornadas ao navegador (`http.server.ts`,
  handlers de API) são genéricas — não vazam stack trace nem detalhes
  internos ao cliente.

**Não verificável sem ambiente ao vivo:** se os logs de
`console.error`/`console.warn` realmente chegam a algum lugar
monitorado em produção (Cloudflare Workers Logs, `SENTRY_DSN` se
configurado) — isso é configuração de infraestrutura, não de código.

---

## 11. Backup e recuperação

**Não afirmo que o backup está ativo — não há evidência de painel
disponível nesta auditoria.** O que precisa ser conferido manualmente no
painel Supabase antes de produção:

- [ ] Database → Backups: backup automático habilitado (diário, no
      mínimo)
- [ ] Retenção configurada de acordo com a política do negócio
- [ ] Point-in-time recovery disponível (depende do plano Supabase
      contratado — Pro ou superior)
- [ ] Storage buckets (se usados para documentos/comprovantes) têm
      backup ou replicação próprios — não confirmei uso de Storage
      Buckets no código revisado; se não há upload de arquivos hoje,
      este item não se aplica
- [ ] Teste de restauração já foi feito ao menos uma vez em ambiente
      de homologação (nunca confiar em backup nunca restaurado)

---

## 12. Validação final

Executado neste ambiente após todas as correções desta rodada:

```
npm install         → OK
npm run typecheck   → OK, 0 erros
npm run lint        → OK, 0 erros, 11 warnings pré-existentes (não relacionados)
npm run test:unit   → OK, 17/17
npm run build       → OK, build de produção completo (client + SSR + Nitro/Wrangler)
```

**Confirmações adicionais:**
- Migration válida sintaticamente (revisão manual linha a linha — sem
  acesso a um Postgres real para `EXPLAIN`/dry-run neste ambiente
  sandbox, que não tem rede para `supabase.co`).
- `routeTree.gen.ts` regenerado e inclui `/admin/convites` e `/ativar`.
- Nenhuma variável secreta no bundle do cliente (`.output/public`) —
  reconfirmado por grep após todas as mudanças desta rodada.
- Zero funções exportadas em `src/lib/*.functions.ts` sem nenhum import
  em `src/` — reconfirmado por script de varredura após esta rodada
  (zero resultados, contra 7 encontradas na rodada anterior).
- Diferenças não documentadas entre banco e código: as que são
  visíveis a partir deste pacote estão documentadas em §3; as que
  dependem do dump completo estão listadas como pendência explícita, não
  omitidas.

---

## 13. Arquivos alterados nesta rodada

**Criados:**
- `src/routes/admin.convites.tsx`
- `docs/PRODUCTION_READINESS_2026-07-25.md` (este arquivo)

**Editados:**
- `supabase/migrations/20260725000000_enforce_booking_rules.sql` —
  reforçada com `ADD COLUMN IF NOT EXISTS`, `CHECK` constraint, e
  normalização explícita de NULL
- `src/lib/env.server.ts` — remoção de `TURNSTILE_SECRET_KEY` e
  `SUBSCRIPTION_GRACE_PERIOD_DAYS`
- `src/lib/env.public.ts` — remoção de `VITE_TURNSTILE_SITE_KEY`
- `.env.example`, `.dev.vars.example` — remoção das mesmas 3 variáveis
- `docs/ENVIRONMENT_SETUP.md` — lista atualizada + nota explicando as
  remoções
- `src/routes/admin.clientes.tsx` — link para a nova página de convites

---

## 14. Pendências externas (resumo)

Nada aqui foi "corrigido" nesta rodada porque nenhum item abaixo é
alcançável a partir do código-fonte sozinho:

1. **Aplicar a migration** `20260725000000_enforce_booking_rules.sql`
   no banco real (comando exato em §2).
2. **Exportar o schema completo** (`pg_dump`/Schema Visualizer) para
   fechar a auditoria de drift (§3).
3. **Rodar as duas queries de `pg_policies`/`pg_tables`** para a
   auditoria de RLS (§4) — item mais crítico pendente.
4. **Rodar a query de `pg_get_functiondef`** para `has_role` e as demais
   funções sem SQL neste pacote (§5) — segundo item mais crítico.
5. **Confirmar backup/retenção** no painel Supabase (§11).
6. **Confirmar `GOOGLE_REDIRECT_URI`** cadastrado no Google Cloud
   Console contra o domínio publicado real.
7. **Executar o checklist de homologação** (§9) no domínio publicado
   com as 3 contas de teste.
8. **Decisão de produto:** implementar carência de inadimplência de
   verdade ou formalizar que não existe (§7).

---

## 15. Veredito final

**PRONTO COM PENDÊNCIAS EXTERNAS**

Justificativa: nenhum problema crítico foi deixado sem correção **no
código-fonte** — tudo que dependia só do repositório (migration
insegura/incompleta, variáveis mortas, telas-fachada, mensagens de erro
incompletas, rate limiting desconectado, autorização faltando em rotas
de API) foi corrigido e validado com `typecheck`/`lint`/`test`/`build`
limpos nesta e nas rodadas anteriores.

Não posso classificar como **"PRONTO PARA PRODUÇÃO"** porque, pelas
próprias regras desta auditoria, isso exigiria (a) a migration já
aplicada no banco real e (b) nenhuma falha crítica de RLS confirmada —
nenhuma das duas condições é verificável nem executável a partir deste
ambiente. Não é uma suposição de que algo esteja errado: é a ausência
de evidência, que as próprias instruções desta rodada pedem para não
tratar como aprovação.

Não é **"NÃO PRONTO PARA PRODUÇÃO"** porque não há nenhum problema
concreto e conhecido bloqueando — apenas verificações pendentes que
dependem de acesso externo já listado no item 14, executáveis em minutos
por quem tiver esse acesso.
