-- Cria os buckets de Storage usados pelo app (fotos de veículo e avatar de
-- perfil) e as políticas de acesso. Sem isso, o upload de foto do veículo
-- (já implementado em VehicleUploader.tsx) falha silenciosamente nesse
-- projeto Supabase, já que ele foi criado vazio.

insert into storage.buckets (id, name, public)
values ('vehicle-art', 'vehicle-art', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Leitura pública (as fotos ficam atrás de URL assinada/pública, sem
-- listagem do bucket).
drop policy if exists "public read vehicle-art" on storage.objects;
create policy "public read vehicle-art" on storage.objects for select
  using (bucket_id = 'vehicle-art');

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');

-- Cada usuário só pode enviar/atualizar/remover arquivos dentro da própria
-- pasta (primeiro segmento do caminho = seu auth.uid()).
drop policy if exists "owners write vehicle-art" on storage.objects;
create policy "owners write vehicle-art" on storage.objects for insert
  with check (bucket_id = 'vehicle-art' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners update vehicle-art" on storage.objects;
create policy "owners update vehicle-art" on storage.objects for update
  using (bucket_id = 'vehicle-art' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners delete vehicle-art" on storage.objects;
create policy "owners delete vehicle-art" on storage.objects for delete
  using (bucket_id = 'vehicle-art' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners write avatars" on storage.objects;
create policy "owners write avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners update avatars" on storage.objects;
create policy "owners update avatars" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "owners delete avatars" on storage.objects;
create policy "owners delete avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Staff (admin/owner/etc.) também pode gerenciar qualquer arquivo dos dois
-- buckets, por exemplo para remover uma foto inadequada.
drop policy if exists "staff manage vehicle-art" on storage.objects;
create policy "staff manage vehicle-art" on storage.objects for all
  using (bucket_id = 'vehicle-art' and public.has_staff_role(auth.uid()))
  with check (bucket_id = 'vehicle-art' and public.has_staff_role(auth.uid()));

drop policy if exists "staff manage avatars" on storage.objects;
create policy "staff manage avatars" on storage.objects for all
  using (bucket_id = 'avatars' and public.has_staff_role(auth.uid()))
  with check (bucket_id = 'avatars' and public.has_staff_role(auth.uid()));
