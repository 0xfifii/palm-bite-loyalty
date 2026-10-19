-- Palm Bite Loyalty: drink image storage.
-- Public read (menu photography), administrator write. 4 MB limit, images only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('drink-images', 'drink-images', true, 4194304, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy drink_images_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'drink-images');

create policy drink_images_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'drink-images' and public.is_admin());

create policy drink_images_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'drink-images' and public.is_admin())
  with check (bucket_id = 'drink-images' and public.is_admin());

create policy drink_images_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'drink-images' and public.is_admin());
