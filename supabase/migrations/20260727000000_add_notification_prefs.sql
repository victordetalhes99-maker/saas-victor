-- Adiciona persistência real para as preferências de notificação do cliente
-- (antes eram apenas estado local no navegador, sem salvar em lugar nenhum).
alter table public.profiles
  add column if not exists notification_prefs jsonb not null
  default '{"push": true, "email": true, "reminders": true}'::jsonb;
