-- These two rules were assumed to already have columns in company_settings
-- (emergency_mode, min_booking_lead_minutes) based on the generated
-- src/integrations/supabase/types.ts. Since this migration is written
-- without a live connection to the target database, it does not trust
-- that assumption blindly: it (re)creates those columns defensively with
-- IF NOT EXISTS + safe defaults + a bounds check, so the migration is
-- self-contained and safe to run whether or not they already exist. If
-- they already exist with a compatible type, these statements are no-ops.
--
-- An admin screen could already write to these columns, but
-- create_client_appointment never read them back — so toggling "modo de
-- emergência" or a minimum booking lead time in the admin UI had zero
-- effect on actual bookings. This migration closes that gap.
--
-- Idempotent: safe to run more than once (CREATE OR REPLACE FUNCTION,
-- ADD COLUMN IF NOT EXISTS, and a guarded constraint check).
--
-- Rollback (manual — no automatic "down" migration exists in this repo's
-- pattern): re-run the function body from
-- 20260717090000_secure_appointment_booking.sql to drop the two new
-- checks. The new columns/constraint are backward compatible and safe to
-- leave in place even if the function is rolled back.

alter table public.company_settings
  add column if not exists emergency_mode boolean not null default false;
alter table public.company_settings
  add column if not exists emergency_mode_at timestamptz;
alter table public.company_settings
  add column if not exists emergency_mode_by uuid;
alter table public.company_settings
  add column if not exists emergency_mode_reason text;
alter table public.company_settings
  add column if not exists min_booking_lead_minutes integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'company_settings_min_booking_lead_minutes_check'
  ) then
    alter table public.company_settings
      add constraint company_settings_min_booking_lead_minutes_check
      check (min_booking_lead_minutes >= 0 and min_booking_lead_minutes <= 10080);
  end if;
end $$;

create or replace function public.create_client_appointment(
  _scheduled_at timestamptz,
  _vehicle_id uuid default null,
  _extra_service_ids uuid[] default '{}'
)
returns table (
  appointment_id uuid,
  scheduled_at timestamptz,
  estimated_minutes integer,
  total_extras_cents integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_vehicle_id uuid;
  v_subscription_id uuid;
  v_plan_duration integer := 30;
  v_remaining_washes integer := 0;
  v_extras_duration integer := 0;
  v_extras_total integer := 0;
  v_total_minutes integer := 0;
  v_appointment_id uuid;
  v_emergency_mode boolean := false;
  v_min_lead_minutes integer := 0;
begin
  if v_user_id is null then
    raise exception 'Autenticação obrigatória.';
  end if;

  if _scheduled_at is null then
    raise exception 'Horário obrigatório.';
  end if;

  if _scheduled_at <= now() then
    raise exception 'Escolha um horário futuro.';
  end if;

  select cs.emergency_mode, cs.min_booking_lead_minutes
    into v_emergency_mode, v_min_lead_minutes
    from public.company_settings cs
   order by cs.created_at desc
   limit 1;

  -- Se a tabela company_settings ainda não tiver nenhuma linha, o SELECT
  -- INTO acima deixa as variáveis como NULL. Normaliza explicitamente
  -- para os defaults seguros (nunca confiar em truthiness implícita de
  -- NULL em plpgsql).
  v_emergency_mode := coalesce(v_emergency_mode, false);
  v_min_lead_minutes := coalesce(v_min_lead_minutes, 0);

  if v_emergency_mode then
    raise exception 'Agendamentos temporariamente indisponíveis. Tente novamente mais tarde.';
  end if;

  if v_min_lead_minutes > 0 and _scheduled_at < now() + make_interval(mins => v_min_lead_minutes) then
    raise exception 'Escolha um horário com pelo menos % minutos de antecedência.', v_min_lead_minutes;
  end if;

  if _vehicle_id is not null then
    select v.id
      into v_vehicle_id
      from public.vehicles v
     where v.id = _vehicle_id
       and v.user_id = v_user_id;

    if v_vehicle_id is null then
      raise exception 'Veículo inválido para este usuário.';
    end if;
  end if;

  select
    s.id,
    greatest(coalesce(p.washes_per_month, 0) - coalesce(s.washes_used, 0), 0),
    coalesce(p.default_duration_minutes, 30)
    into v_subscription_id, v_remaining_washes, v_plan_duration
    from public.subscriptions s
    join public.plans p
      on p.id = s.plan_id
   where s.user_id = v_user_id
     and s.status in ('active', 'trialing')
   order by s.created_at desc
   limit 1;

  if v_subscription_id is null then
    raise exception 'Assinatura ativa não encontrada.';
  end if;

  if v_remaining_washes <= 0 then
    raise exception 'Plano sem lavagens disponíveis.';
  end if;

  select
    coalesce(sum(es.duration_minutes), 0),
    coalesce(sum(es.price_cents), 0)
    into v_extras_duration, v_extras_total
    from public.extra_services es
   where es.id = any(coalesce(_extra_service_ids, '{}'::uuid[]))
     and es.active = true;

  if cardinality(coalesce(_extra_service_ids, '{}'::uuid[])) <>
     (
       select count(*)
         from public.extra_services es
        where es.id = any(coalesce(_extra_service_ids, '{}'::uuid[]))
          and es.active = true
     ) then
    raise exception 'Um ou mais extras são inválidos.';
  end if;

  v_total_minutes := greatest(v_plan_duration + v_extras_duration, 1);

  if exists (
    select 1
      from public.blocked_slots bs
     where bs.blocked_at >= _scheduled_at
       and bs.blocked_at < _scheduled_at + make_interval(mins => v_total_minutes)
  ) then
    raise exception 'Horário bloqueado para agendamento.';
  end if;

  insert into public.appointments (
    user_id,
    subscription_id,
    vehicle_id,
    scheduled_at,
    estimated_minutes,
    total_extras_cents
  )
  values (
    v_user_id,
    v_subscription_id,
    v_vehicle_id,
    _scheduled_at,
    v_total_minutes,
    v_extras_total
  )
  returning id into v_appointment_id;

  insert into public.appointment_extras (
    appointment_id,
    extra_service_id,
    name_snapshot,
    price_cents,
    duration_minutes
  )
  select
    v_appointment_id,
    es.id,
    es.name,
    es.price_cents,
    es.duration_minutes
    from public.extra_services es
   where es.id = any(coalesce(_extra_service_ids, '{}'::uuid[]))
     and es.active = true;

  return query
  select
    v_appointment_id,
    _scheduled_at,
    v_total_minutes,
    v_extras_total;
end;
$$;

revoke all on function public.create_client_appointment(timestamptz, uuid, uuid[]) from public;
grant execute on function public.create_client_appointment(timestamptz, uuid, uuid[]) to authenticated;
