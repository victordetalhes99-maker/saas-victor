create extension if not exists btree_gist;

drop index if exists public.appointments_active_slot_unique;

alter table public.appointments
  drop constraint if exists appointments_active_timeslot_excl;

alter table public.appointments
  add constraint appointments_active_timeslot_excl
  exclude using gist (
    tstzrange(
      scheduled_at,
      scheduled_at + make_interval(mins => greatest(estimated_minutes, 1)),
      '[)'
    ) with &&
  )
  where (status in ('scheduled', 'confirmed', 'in_progress'));

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
