-- ════════ A GOLD CHEST ON YOUR BIRTHDAY ════════
--
-- Or: "it's my birthday today. Maybe when you open the game on your birthday
-- you get some kind of gold chest with presents? Cool, right? Make it for me
-- and I can test it today. Obviously that means the birth date can only be
-- set when you sign up and not changed afterwards in the profile."
--
-- The second sentence is the whole reason this is a migration and not just
-- some code. A prize attached to a date is a prize attached to a FIELD, and
-- the field was `update`-able by the player who owns the row: set today's
-- date, collect a gold chest, set tomorrow's, collect another. Or saw that
-- before I did.
--
-- ─── which year we last paid ───
--
-- A year, not a flag and not a date: the question is "have we paid for THIS
-- birthday", and a year answers it for ever without anything to reset. A
-- player who misses their birthday is simply not paid for it, which is what
-- a birthday is.
alter table public.players add column birthday_year smallint;

-- Filled by the server when it mints the chest; never by the player, who
-- could otherwise clear it and collect again.
revoke update (birthday_year) on public.players from authenticated;

-- ─── the birth date is written once ───
--
-- A GRANT cannot say this, because the onboarding card is the player writing
-- their own birth date and that has to keep working. What is wrong is only
-- CHANGING one that is already there. So: a trigger, which is the one place
-- that can see both the old value and the new.
--
-- It fires for everybody, service role included. That is deliberate: the
-- server has no business rewriting a birth date either, and a rule with an
-- exception in it is a rule somebody will route around.
create or replace function public.birth_date_is_written_once()
returns trigger
language plpgsql
as $$
begin
  if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
    raise exception 'birth_date cannot be changed once it is set';
  end if;
  return new;
end;
$$;

create trigger players_birth_date_write_once
  before update of birth_date on public.players
  for each row
  execute function public.birth_date_is_written_once();
