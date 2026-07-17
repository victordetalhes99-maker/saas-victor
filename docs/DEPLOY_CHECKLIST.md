# Deploy Checklist

Data de referência: 2026-07-17

## Antes da homologação

1. Confirmar backup lógico do banco Supabase.
2. Rodar a consulta `supabase/diagnostics/2026-07-17_appointment_integrity_diagnostic.sql`.
3. Corrigir qualquer sobreposição, órfão ou duração inválida retornados pela consulta.
4. Confirmar que as variáveis do ambiente de homologação estão cadastradas.
5. Verificar se a migration `20260715000000_schedule_conflicts.sql` já foi aplicada no ambiente alvo.

## Ordem exata para homologação

1. Aplicar `20260715000000_schedule_conflicts.sql` se ela ainda não existir no histórico do ambiente.
2. Aplicar `20260717090000_secure_appointment_booking.sql`.
3. Publicar o código somente no ambiente de homologação.
4. Validar agendamento livre.
5. Validar conflito exato.
6. Validar conflito parcial.
7. Validar veículo de outro cliente.
8. Validar extra alterando duração.
9. Validar resposta clara quando a migration ainda não estiver presente em outro ambiente de teste controlado, se esse cenário fizer parte do plano.

## Supabase

1. Abrir SQL Editor.
2. Rodar a consulta diagnóstica.
3. Revisar o resultado com zero linhas críticas antes da migration.
4. Aplicar manualmente as migrations na ordem correta.
5. Testar a RPC `public.create_client_appointment` com usuário autenticado de homologação.

## Lovable

1. Atualizar o projeto com este snapshot já auditado.
2. Conferir que o fluxo `agendar` chama somente a função server-side.
3. Não reintroduzir insert direto no frontend.

## Cloudflare

1. Garantir que as variáveis de homologação equivalentes às de `.env.example` e `.dev.vars.example` existam.
2. Fazer build de homologação.
3. Publicar apenas no ambiente de teste.
4. Validar o fluxo real com Supabase de homologação.

## Antes de produção

1. Repetir o diagnóstico no banco de produção.
2. Reexecutar a suite local.
3. Homologar manualmente o fluxo completo.
4. Liberar produção somente após evidência do cenário real.
