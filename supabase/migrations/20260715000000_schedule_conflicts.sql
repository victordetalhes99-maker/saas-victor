create unique index if not exists appointments_active_slot_unique
  on public.appointments (scheduled_at)
  where status in ('scheduled', 'confirmed', 'in_progress');

create unique index if not exists blocked_slots_blocked_at_unique
  on public.blocked_slots (blocked_at);
