-- Estatística pública e segura de planos: só a contagem de assinantes
-- ativos por plano (nenhum dado de cliente, nenhuma informação
-- financeira interna). Usada na home pública para decidir de verdade
-- qual plano é "Mais escolhido", em vez de chutar no frontend.
create or replace function public.get_public_plan_stats()
returns table (plan_id uuid, subscriber_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select plan_id, count(*) as subscriber_count
  from public.subscriptions
  where status in ('active', 'trialing')
  group by plan_id;
$$;

revoke all on function public.get_public_plan_stats() from public;
grant execute on function public.get_public_plan_stats() to anon, authenticated;
