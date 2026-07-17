with appointment_windows as (
  select
    a.id,
    a.user_id,
    a.vehicle_id,
    a.subscription_id,
    a.status,
    a.scheduled_at,
    a.estimated_minutes,
    a.scheduled_at + make_interval(mins => greatest(coalesce(a.estimated_minutes, 0), 0)) as scheduled_end
  from public.appointments a
),
overlapping_appointments as (
  select
    'overlapping_appointments' as issue_type,
    a.id as appointment_id,
    b.id as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    format('Overlap with %s (%s - %s)', b.id, b.scheduled_at, b.scheduled_end) as details
  from appointment_windows a
  join appointment_windows b
    on a.id < b.id
   and a.status in ('scheduled', 'confirmed', 'in_progress')
   and b.status in ('scheduled', 'confirmed', 'in_progress')
   and tstzrange(a.scheduled_at, a.scheduled_end, '[)') &&
       tstzrange(b.scheduled_at, b.scheduled_end, '[)')
),
duplicated_slots as (
  select
    'duplicated_slots' as issue_type,
    a.id as appointment_id,
    b.id as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    'Same scheduled_at timestamp' as details
  from appointment_windows a
  join appointment_windows b
    on a.id < b.id
   and a.status in ('scheduled', 'confirmed', 'in_progress')
   and b.status in ('scheduled', 'confirmed', 'in_progress')
   and a.scheduled_at = b.scheduled_at
),
invalid_duration as (
  select
    'invalid_duration' as issue_type,
    a.id as appointment_id,
    null::uuid as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    format('estimated_minutes=%s', coalesce(a.estimated_minutes::text, 'null')) as details
  from appointment_windows a
  where a.estimated_minutes is null
     or a.estimated_minutes <= 0
),
missing_end_window as (
  select
    'missing_end_window' as issue_type,
    a.id as appointment_id,
    null::uuid as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    'Cannot derive a valid end time from scheduled_at + estimated_minutes' as details
  from appointment_windows a
  where a.scheduled_at is null
     or a.estimated_minutes is null
),
orphaned_subscriptions as (
  select
    'orphaned_subscription' as issue_type,
    a.id as appointment_id,
    null::uuid as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    format('Missing subscription %s', a.subscription_id) as details
  from appointment_windows a
  left join public.subscriptions s
    on s.id = a.subscription_id
  where a.subscription_id is not null
    and s.id is null
),
missing_vehicles as (
  select
    'missing_vehicle' as issue_type,
    a.id as appointment_id,
    null::uuid as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    format('Missing vehicle %s', a.vehicle_id) as details
  from appointment_windows a
  left join public.vehicles v
    on v.id = a.vehicle_id
  where a.vehicle_id is not null
    and v.id is null
),
missing_users as (
  select
    'missing_user' as issue_type,
    a.id as appointment_id,
    null::uuid as related_appointment_id,
    a.user_id,
    a.vehicle_id,
    a.status,
    a.scheduled_at,
    a.scheduled_end,
    format('Missing profile %s', a.user_id) as details
  from appointment_windows a
  left join public.profiles p
    on p.id = a.user_id
  where p.id is null
)
select *
from overlapping_appointments
union all
select *
from duplicated_slots
union all
select *
from invalid_duration
union all
select *
from missing_end_window
union all
select *
from orphaned_subscriptions
union all
select *
from missing_vehicles
union all
select *
from missing_users
order by issue_type, scheduled_at nulls first, appointment_id;
