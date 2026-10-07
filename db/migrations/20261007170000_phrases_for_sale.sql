-- Catchphrases and emoji packs, on the shelves.
--
-- Or: *"catchphrases (designed!) are another thing you can buy in the shop or
-- win in a chest. Then people will have a reason to buy from the shop,
-- because it is something you SEE."* And the same for the emoji: *"these
-- beautiful ones are also something you buy in the shop or win in a chest, so
-- that encourages you too."*
--
-- ═══ ONE NEW KIND, AND NO NEW TABLE ═══
--
-- `shop_items.kind` already allowed avatar, emoji, skin, card and chest; a
-- phrase is the sixth. Everything else about selling one was already built —
-- it is bought through `buy`, handed over by `deliver`, and recorded in
-- `player_items` like anything else, which is what the shop's one-door rule
-- (apps/server/src/shop.ts) was for.
--
-- ═══ THE ITEM ID IS THE THING ═══
--
-- `emoji.monsters` the shop item grants `emoji.monsters` the pack, and
-- `phrase.winner` the item grants `phrase.winner` the line. There is no
-- mapping table and no `grants` payload to keep in step, because the id in
-- packages/shared/src/emoji.ts and catchphrases.ts IS the id here. One name
-- for one thing: `ownedEmoji(items)` and `ownedCatchphrases(items)` both just
-- ask whether the list contains it.

alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items
  add constraint shop_items_kind_check
  check (kind in ('avatar', 'emoji', 'skin', 'card', 'chest', 'phrase'));

-- ── the two emoji packs ────────────────────────────────────────────
insert into public.shop_items (id, kind, name, blurb, price_diamonds, sort)
values
  (
    'emoji.monsters',
    'emoji',
    '{"he":"חבילת מפלצות","en":"Monsters pack"}'::jsonb,
    '{"he":"ארבעה אימוג׳ים לשלוח ליריב באמצע הקרב","en":"Four more to send mid-battle"}'::jsonb,
    150,
    40
  ),
  (
    'emoji.amanda',
    'emoji',
    '{"he":"חבילת אמנדה","en":"Amanda pack"}'::jsonb,
    '{"he":"היא, האריה, הריר ושד הפירורים","en":"Her, the lion, the slime and the crumb demon"}'::jsonb,
    150,
    41
  )
on conflict (id) do nothing;

-- ── the four lines that are not free ───────────────────────────────
-- The words are Or's; the prices climb with how loud the treatment is, because
-- what is being sold is not the sentence but how it ARRIVES.
insert into public.shop_items (id, kind, name, blurb, price_diamonds, sort)
values
  (
    'phrase.danger',
    'phrase',
    '{"he":"הופה, נהיה פה מסוכן","en":"Getting dangerous"}'::jsonb,
    '{"he":"משפט מחץ, באש","en":"A catchphrase, on fire"}'::jsonb,
    120,
    30
  ),
  (
    'phrase.clever',
    'phrase',
    '{"he":"חכם על חזקים","en":"Clever beats strong"}'::jsonb,
    '{"he":"משפט מחץ, בריר","en":"A catchphrase, in slime"}'::jsonb,
    120,
    31
  ),
  (
    'phrase.winner',
    'phrase',
    '{"he":"המנצח בין השניים","en":"The winner of the two"}'::jsonb,
    '{"he":"משפט מחץ, בזהב","en":"A catchphrase, in gold"}'::jsonb,
    200,
    32
  ),
  (
    'phrase.behindyou',
    'phrase',
    '{"he":"זהירות, אמנדה מאחוריך!","en":"Careful, Amanda is behind you!"}'::jsonb,
    '{"he":"משפט מחץ, בצל","en":"A catchphrase, in shadow"}'::jsonb,
    200,
    33
  )
on conflict (id) do nothing;
