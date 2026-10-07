-- The warm catchphrases, on the shelves.
--
-- Or asked for both kinds: *"and for the phrases, have both nicely-teasing
-- ones and encouraging ones — good luck, good game, and so on."* The four
-- teasing ones he wrote went on sale with the rest; these four were written
-- and then had nowhere to come from, which made them lines nobody could ever
-- have.
--
-- ⚠️ THE WORDS ARE MINE AND ARE DRAFTS. Or writes the copy; he asked for this
-- tone and did not send the lines, so these are placeholders in roughly the
-- right register. Rewriting one is an edit to catchphrases.ts — the database
-- holds only the id and the price.
--
-- ═══ WHY THEY COST LESS ═══
--
-- Not because they are worth less. What is being sold throughout is how a
-- line ARRIVES — the plaque, the treatment — and these deliberately arrive
-- quietly, because a line that wishes somebody luck and then explodes in gold
-- is making a joke of itself. A cheaper price for a quieter thing is the
-- honest arrangement, and it also means the kindest lines are the easiest for
-- a child with few diamonds to reach.

insert into public.shop_items (id, kind, name, blurb, price_diamonds, sort)
values
  (
    'phrase.goodluck',
    'phrase',
    '{"he":"בהצלחה לשנינו","en":"Good luck to us both"}'::jsonb,
    '{"he":"משפט מחץ, בלי מחץ","en":"A catchphrase, minus the punch"}'::jsonb,
    80,
    34
  ),
  (
    'phrase.goodgame',
    'phrase',
    '{"he":"שיהיה משחק טוב","en":"Have a good game"}'::jsonb,
    '{"he":"משפט מחץ, בלי מחץ","en":"A catchphrase, minus the punch"}'::jsonb,
    80,
    35
  ),
  (
    'phrase.friends',
    'phrase',
    '{"he":"באתי לשחק, לא לריב","en":"I came to play, not to fight"}'::jsonb,
    '{"he":"משפט מחץ, בלי מחץ","en":"A catchphrase, minus the punch"}'::jsonb,
    80,
    36
  ),
  (
    'phrase.learn',
    'phrase',
    '{"he":"תלמד אותי משהו","en":"Teach me something"}'::jsonb,
    '{"he":"משפט מחץ, בלי מחץ","en":"A catchphrase, minus the punch"}'::jsonb,
    80,
    37
  )
on conflict (id) do nothing;
