-- Who may put a picture in the card-art bucket: an admin, and nobody else.
--
-- ═══ WHY THIS ONE WRITE DOES NOT GO THROUGH THE SERVER ═══
--
-- Every other change the admin panel makes is a POST that the server
-- authorises by reading the `admins` table. A picture cannot travel that way:
-- readBody caps a request at 256KB and TRUNCATES anything larger, so a photo
-- posted as base64 would arrive cut in half, fail to parse, and be received
-- as an empty body — a silent, confusing nothing. Raising that cap for one
-- route would mean every route could be made to buffer megabytes.
--
-- So the browser uploads straight to storage, and the same question —
-- "are you an admin?" — is asked HERE instead, by the database, against the
-- same table. Not a weaker check: a stricter one, because it is asked of the
-- signed-in user by Postgres rather than by code that could forget to ask.
--
-- Reading stays open to everybody (the bucket is public): a card's picture is
-- drawn on the home screen before anybody has signed in.
drop policy if exists card_art_admin_write on storage.objects;
create policy card_art_admin_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'card-art'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

drop policy if exists card_art_admin_update on storage.objects;
create policy card_art_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'card-art'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  )
  with check (
    bucket_id = 'card-art'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );

-- Deleting an old picture when one is replaced, so the bucket does not fill
-- up with every draft of every card.
drop policy if exists card_art_admin_delete on storage.objects;
create policy card_art_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'card-art'
    and exists (select 1 from public.admins a where a.user_id = auth.uid())
  );
