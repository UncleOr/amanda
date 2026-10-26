/**
 * **A gold chest, once a year, on the day.**
 *
 * Or, on the morning of his: *"it's my birthday today. Maybe when you open
 * the game on your birthday you get some kind of gold chest with presents?
 * Cool, right? Obviously that means the birth date can only be set when you
 * sign up and not changed afterwards in the profile."*
 *
 * ═══ THE SECOND SENTENCE IS THE DESIGN ═══
 *
 * He spotted the hole in the same breath as the idea. A prize attached to a
 * date is a prize attached to a FIELD, and `birth_date` was one the player
 * could write whenever they liked: set today, collect, set tomorrow, collect
 * again. So the date is now write-once — enforced by a trigger in the
 * database, not by this file and not by the profile screen, because a rule
 * that lives in the UI is a rule that lives in the browser.
 *
 * See db/migrations/20261016090000_birthday.sql.
 *
 * ═══ AND IT IS CHECKED WHEN YOU OPEN THE GAME ═══
 *
 * There is no job running at midnight and there should not be: a present
 * nobody is there to receive is a row in a table. `/api/meta` is the call
 * the home screen makes on the way in, so the chest is minted on the first
 * visit of the day and is sitting on the shelf by the time the screen draws.
 *
 * A player who does not open the game on their birthday does not get one.
 * That is not a bug to fix — it is what a birthday is.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { israelDay } from "@amanda/shared";
import { notify } from "./notify.js";
import { bestTrophiesOf, rollChest } from "./progress.js";

/**
 * Is `birthDate`'s month and day today's, in Israel?
 *
 * Compared as the two strings the database already holds, rather than by
 * building Dates: `birth_date` is a plain calendar date with no time and no
 * zone, and turning it into a Date gives it both — at which point a birthday
 * in Jerusalem starts at 3am for somebody and a timezone bug is waiting.
 *
 * 29 February is handled by not handling it: a leap-day birthday lands in the
 * years it exists in. Picking 28 February or 1 March on its behalf is a
 * decision for whoever has that birthday, not for me.
 */
export function isBirthday(birthDate: string, today: string): boolean {
  return birthDate.slice(5) === today.slice(5);
}

/** What a birthday is worth. The occasion, not the ladder — so, the big one. */
const DIAMONDS = 150;

export interface BirthdayGift {
  diamonds: number;
  /** The age they have just turned, for the card that says so. */
  age: number;
}

/**
 * What today is worth, if today is the day.
 *
 * ═══ MINTING AND ANNOUNCING ARE DIFFERENT QUESTIONS ═══
 *
 * The first version answered only "did I just mint one", and Or lost his
 * birthday to it. The server deployed before the browser did: it minted the
 * chest and the diamonds on his first visit, the old build on his phone did
 * not know what the `birthday` field was, and `birthday_year` was 2026 for
 * ever after. The present arrived; the party did not.
 *
 * Verified afterwards in the database rather than guessed — birthday_year
 * 2026, a gold chest at 13:07, diamonds 361 → 556, which is exactly the 150
 * plus the chest's own 40 plus 5 from a wood chest. Everything worked except
 * the one part he could see.
 *
 * So: this says IT IS YOUR BIRTHDAY for the whole of the day, every time it
 * is asked, and mints at most once. Whether the party has already been
 * thrown is a question about this browser, and it is answered in this
 * browser (game/meta.ts). A present is minted once; being told about it is
 * not a resource that can run out.
 */
export async function birthdayGift(
  sb: SupabaseClient,
  playerId: string,
  now: Date = new Date(),
): Promise<BirthdayGift | null> {
  try {
    const today = israelDay(now);
    const year = Number(today.slice(0, 4));

    const { data } = await sb
      .from("players")
      .select("birth_date, birthday_year, diamonds")
      .eq("id", playerId)
      .maybeSingle();

    const birthDate = (data?.birth_date as string | null) ?? null;
    if (!birthDate || !isBirthday(birthDate, today)) return null;

    const age = year - Number(birthDate.slice(0, 4));
    const gift = { diamonds: DIAMONDS, age };

    // Already paid today. Still their birthday, so still say so.
    if ((data?.birthday_year as number | null) === year) return gift;

    /*
     * The year is claimed FIRST.
     *
     * Two tabs opening the game at the same moment are two calls to this, and
     * the loser of that race must not also mint a chest. Marking the year
     * before handing anything over means the worst case is a birthday that
     * was marked and not paid — which is recoverable by hand — rather than
     * two gold chests, which is not.
     *
     * The `or` makes the update itself the lock: only one of the two can
     * match a row whose year is not yet this one.
     */
    const { data: claimed } = await sb
      .from("players")
      .update({ birthday_year: year, diamonds: (data?.diamonds ?? 0) + DIAMONDS })
      .eq("id", playerId)
      .or(`birthday_year.is.null,birthday_year.neq.${year}`)
      .select("id");
    // Somebody else's call got there first. It is still their birthday.
    if (!claimed?.length) return gift;

    await sb.from("chests").insert({
      player_id: playerId,
      kind: "gold",
      opened_at: null,
      contents: rollChest(await bestTrophiesOf(sb, playerId), "gold"),
    });

    await notify(
      sb,
      playerId,
      "gift",
      { he: "יום הולדת שמח!", en: "Happy birthday!" },
      {
        he: `תיבת זהב ו-${DIAMONDS} יהלומים מחכים לך.`,
        en: `A gold chest and ${DIAMONDS} diamonds are waiting for you.`,
      },
    );
    return gift;
  } catch {
    // A birthday is a present, not a gate. If the database is unhappy the
    // home screen still has to open.
    return null;
  }
}
