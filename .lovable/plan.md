# Centro de Configurações — Plano de Entrega

Sua última diretriz foi **não aumentar escopo antes da auditoria/deploy**. Esta tela, do jeito que está descrita, mistura **UI/UX pura** (segura, rápida, sem migrations) com **funcionalidades que exigem novas tabelas, integrações reais e superfícies de segurança sensíveis** (2FA real, tracking de sessões, notificações multicanal, teste de integrações). Vou entregar em **duas fases**, com corte claro entre o que é seguro fazer agora e o que fica preparado para depois.

Se preferir uma coisa só, me diga — mas recomendo fortemente a separação abaixo.

---

## Fase A — Agora (Shell premium + categorias seguras)

### Estrutura de rotas

- Nova rota-mãe `src/routes/admin.configuracoes.tsx` com layout de 2 colunas (menu interno esquerda + `<Outlet />` direita), breadcrumb, header sticky, versão responsiva (abas horizontais no mobile).
- Rotas filhas (uma por categoria) refletindo na URL:
  - `/admin/configuracoes/geral`
  - `/admin/configuracoes/estabelecimento`
  - `/admin/configuracoes/administrador`
  - `/admin/configuracoes/seguranca`
  - `/admin/configuracoes/notificacoes`
  - `/admin/configuracoes/agenda`
  - `/admin/configuracoes/integracoes`
  - `/admin/configuracoes/pagamentos`
  - `/admin/configuracoes/aparencia`
  - `/admin/configuracoes/zona-de-perigo`
- Item de menu do painel: `Config` → `Configurações`, apontando para `/admin/configuracoes/geral`. Rota antiga `/admin/config` continua funcionando via redirect para não quebrar links.

### Categorias 100% funcionais nesta fase

1. **Geral** — dashboard resumido (empresa, contagens reais via Supabase: clientes, agendamentos, acessos administrativos), versão da app, atalhos rápidos (deep-links para as outras seções).
2. **Estabelecimento** — nova tabela `public.company_settings` (single row) com todos os campos pedidos (logo, nome, CNPJ, telefone, WhatsApp, e-mail, redes, endereço). RLS: leitura por admin+owner, escrita apenas owner. Form com detecção de mudanças, validação Zod, máscaras, save via `createServerFn` + toast.
3. **Administrador** — edita `profiles` do próprio usuário logado (foto, nome, telefone, cargo, nome de exibição). Reutiliza `use-auth` e bucket já existente para avatar.
4. **Segurança → Alterar senha** — fluxo real via `supabase.auth.updateUser({ password })` com reautenticação, indicador de força, validação, log em `admin_logs`.
5. **Agenda** — reaproveita config já existente (bloqueios em `blocked_slots`); apresenta em card premium com link para `/admin/agenda` para operações de calendário. Regras globais (antecedência mínima, prazo cancelamento) ficam como campos no `company_settings` e são lidas onde a agenda precisar.
6. **Aparência** — tema (light/dark/sistema), densidade, reduzir animações, cor principal (fixa em verde nesta fase). Persistência em `localStorage` por usuário. Preview ao vivo.
7. **Zona de Perigo** — cards vermelhos com **duas ações reais**: encerrar todas as sessões do próprio usuário (`supabase.auth.signOut({ scope: 'global' })`) e solicitar exclusão de dados (usa fluxo existente `data_deletion_requests`). Confirmação por senha + texto digitado.

### Categorias com "coming soon" honesto (mas UI pronta)

- **Segurança → 2FA**, **Sessões ativas**, **Alertas** — cards com estado "Em breve" e explicação. Sem botões falsos.
- **Notificações** — UI de switches com placeholder "Em breve" (a fase 2 conecta ao backend).
- **Integrações** — cards read-only mostrando status derivado do ambiente (Supabase = conectado; Stripe/Resend/Google/WhatsApp/Cloudflare = "não configurado" quando as vars não existem). Botão "Testar conexão" habilitado só para as que têm ping seguro.
- **Pagamentos** — mostra ambiente Stripe (sandbox/live), plano do sistema, sem botões fictícios.

### UX obrigatória em todos os formulários da Fase A

Detecção de alterações, aviso ao sair sem salvar (via `useBlocker`), loading, skeleton, sucesso/erro em toast, botão salvar desabilitado quando nada mudou, validação em tempo real com Zod, máscaras (CNPJ, CEP, telefone), persistência real no Supabase.

### Backend Fase A

- 1 migration: cria `public.company_settings` com RLS (SELECT admin+owner, UPDATE owner), grants corretos, `updated_at` trigger. Nenhuma outra migration.
- Reutiliza: `profiles`, `admin_logs`, `data_deletion_requests`, `blocked_slots`, bucket `vehicle-art` (não; para logo criaremos bucket `company-assets` somente se você aprovar — caso contrário, upload de logo fica na Fase B).

### Design

Layout Stripe/Vercel: `max-w-6xl`, grid `[240px_1fr]` no desktop, cards com `rounded-[20px]`, borda `border-white/10`, gradiente sutil, verde apenas em estado ativo/destaque, hover translúcido, microtransições 200ms. Mobile: menu vira `<Select>` no topo + `<Outlet />` full-width.

---

## Fase B — Depois (recursos que exigem backend novo)

Fica **arquiteturalmente preparada** na Fase A (rotas existem, cards existem com "Em breve"), mas nada é implementado agora:

- **2FA TOTP real**: tabela `user_mfa`, geração de secret, QR code, códigos de recuperação com hash, verificação, backup codes single-use.
- **Sessões ativas**: tabela `user_sessions` alimentada por hook de login (IP, UA, geo aproximada), listagem, encerrar individual/todas.
- **Alertas de segurança**: preferências por usuário + integração com envio (Resend, quando configurado).
- **Notificações multicanal**: tabela `notification_preferences` + workers/edge para envio real por e-mail/WhatsApp.
- **Integrações — testar conexão** para Stripe, Resend, Google Calendar, WhatsApp: cada uma precisa de secret registrado e endpoint de ping.
- **Pagamentos — Gerenciar/Atualizar plano**: depende do fluxo Stripe do cliente estar ligado.
- **Zona de Perigo — Exportar dados, Remover integrações, Excluir empresa**: exigem workers dedicados e políticas de retenção.

Cada item da Fase B vira uma migration + server fn independente quando você autorizar.

---

## Riscos & garantias

- **Zero quebra**: rotas antigas (`/admin/config`) redirecionam; nenhum guard, RLS existente ou fluxo de cliente é alterado.
- **Compatível com Cloudflare Workers**: sem dependências nativas novas, sem `child_process`, sem libs Node-only.
- **Compatível com Supabase**: uma única migration nova (company_settings) com RLS + GRANTs.
- **Sem mocks, sem botões fantasma**: qualquer card sem funcionalidade real leva o rótulo "Em breve".

---

## Confirmação necessária antes de eu executar

1. **Fase A agora, Fase B só quando eu pedir** — OK?
2. **Upload de logo do estabelecimento**: crio bucket `company-assets` na Fase A **ou** deixo pra Fase B e mantenho apenas URL de logo por enquanto?
3. **Alterar senha na Fase A**: OK exigir reautenticação (pedir senha atual)? Se preferir simplificado (só nova senha), me diga.
4. **Rota antiga `/admin/config`**: redirecionar para nova (recomendado) ou remover?

Respondendo essas 4, executo a Fase A inteira em uma passada e entrego o relatório final.
