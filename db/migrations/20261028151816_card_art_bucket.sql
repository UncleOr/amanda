-- Somewhere for a card's picture to live that is not a deploy.
--
-- Or: *"and I need the picture for each one. With an option to replace the
-- picture."*
--
-- Until now `art.sprite` was a path inside apps/client/public, which is baked
-- into the GitHub Pages build — so "replace the picture" meant handing me a
-- file, a commit and a deploy. Every other thing on a card has been editable
-- from the panel for weeks; the picture was the one thing on it that still
-- needed me.
--
-- PUBLIC ON PURPOSE. A card's picture is drawn on the home screen before
-- anybody has signed in, exactly like the ones in the build, and a signed URL
-- that expires is a card that one day draws as a grey box. There is nothing
-- private in here.
--
-- Nobody uploads from a browser: the panel posts the file to the server,
-- which checks the admins table and writes with the service key. The 2MB cap
-- and the three types are enforced here as well as there, because a limit
-- that lives only in the code that calls it is a limit until somebody calls
-- it differently.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-art', 'card-art', true, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg'];
