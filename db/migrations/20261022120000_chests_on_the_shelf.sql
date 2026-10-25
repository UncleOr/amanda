-- ═══ CHESTS ARE FOR SALE, ONE OF EACH A DAY ═══
--
-- Or: *"we'll add the option to buy chests too — up to one chest of each
-- kind every day."*
--
-- Everything else in the shop is bought ONCE: `player_items` holds one row
-- per item and the till refuses anything already in it. A chest is the first
-- thing that is not a possession — it is a purchase you make again tomorrow
-- — so it needs a different question answered: not "do you own this" but
-- "have you bought this one TODAY".
--
-- The answer lives on the chest rather than in a new table, because the row
-- is written anyway. `bought_item` is the shop item it came from (null for
-- every chest won in a match) and `bought_day` is the Israeli calendar day
-- it was bought on — a text day and not a timestamp, because the rule is
-- "one a day" in the day a child is living in, and that is a date in a
-- place, not twenty-four hours since the last one.

alter table public.chests
  add column if not exists bought_item text,
  add column if not exists bought_day  text;

-- The only question ever asked of these two columns.
create index if not exists chests_bought_today_idx
  on public.chests (player_id, bought_item, bought_day)
  where bought_day is not null;

-- ── the shelf ───────────────────────────────────────────────────────
--
-- Priced above what is inside them, which is the one thing that matters:
-- a wooden chest holds 5 diamonds and costs 80, a gold one holds 40 and
-- costs 500, so no amount of buying chests prints diamonds. The contents
-- themselves are in apps/server/src/progress.ts (CHESTS) and are not
-- repeated here — the row says what it costs, not what it holds.
--
-- The names and the blurbs are Or's to change from the admin panel.
--
-- The blurbs are one line each, and short on purpose: the item's own page
-- draws what is INSIDE a chest from the table the server fills it from
-- (packages/shared/src/chests.ts) — 8 cards, 40 diamonds, one epic promised.
-- A blurb that said that in words would be saying it twice, which is the
-- clutter Or took off these tiles in the first place. What the numbers
-- cannot say is that it comes back tomorrow, so that is what is left here.

insert into public.shop_items (id, kind, name, blurb, grants, price_diamonds, art, sort, active)
values
  (
    'chest.wood',
    'chest',
    '{"he": "תיבת עץ", "en": "Wooden Chest"}'::jsonb,
    '{"he": "אחת ביום.", "en": "One a day."}'::jsonb,
    '{"chest": "wood"}'::jsonb,
    80,
    'scenes/chest_wood.png',
    10,
    true
  ),
  (
    'chest.silver',
    'chest',
    '{"he": "תיבת כסף", "en": "Silver Chest"}'::jsonb,
    '{"he": "אחת ביום.", "en": "One a day."}'::jsonb,
    '{"chest": "silver"}'::jsonb,
    200,
    'scenes/chest_silver.png',
    20,
    true
  ),
  (
    'chest.gold',
    'chest',
    '{"he": "תיבת זהב", "en": "Gold Chest"}'::jsonb,
    '{"he": "אחת ביום.", "en": "One a day."}'::jsonb,
    '{"chest": "gold"}'::jsonb,
    500,
    'scenes/chest_gold.png',
    30,
    true
  )
-- Re-running this must not undo an admin edit, so the conflict clause
-- deliberately leaves `name`, `blurb` and `price_diamonds` alone: those are
-- the three Or owns from the panel.
on conflict (id) do update
  set kind = excluded.kind,
      grants = excluded.grants,
      art = excluded.art,
      active = excluded.active;
