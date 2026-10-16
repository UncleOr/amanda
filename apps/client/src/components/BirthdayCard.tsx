/**
 * **Happy birthday.**
 *
 * Or, on the morning of his: *"it's my birthday today. Maybe when you open
 * the game on your birthday you get some kind of gold chest with presents?
 * Cool, right?"*
 *
 * It is, and it is also the only thing in the game that happens because of
 * who you are rather than what you did. Everything else — arenas, chests,
 * challenges, upgrades — is earned. This one is a present.
 *
 * So it says the age out loud. "You are 8 today" is the line a seven-year-old
 * will read twice, and it is the one piece of this that a generic
 * congratulations screen could not do.
 *
 * The chest and the diamonds are already on the shelf and in the purse by the
 * time this draws — the server mints them on the way into the home screen
 * (apps/server/src/birthday.ts). This announces; it does not grant.
 */
import { Celebrate, PartyChest } from "./Celebrate";
import { Icon } from "./Icon";
import { line as t, lineF as tf } from "../game/copy";

export function BirthdayCard({
  age,
  diamonds,
  onClose,
}: {
  /** The age they have turned today. Zero when the year is not known. */
  age: number;
  diamonds: number;
  onClose: () => void;
}) {
  return (
    <Celebrate
      kicker={t("sfe72726", "יום הולדת שמח")}
      /*
       * The age, when there is one. `birth_date` is optional — a player can
       * skip it at sign-up — and in that case there is no year to count
       * from, so the screen says the thing that is true instead of inventing
       * a number.
       */
      title={age > 0 ? tf("sb4b4284", "בן {0} היום!", age) : t("s5dc59d0", "היום זה היום שלך!")}
      onClose={onClose}
    >
      <div className="party__loot">
        <PartyChest />
        {diamonds > 0 && (
          <span className="party__gems">
            <Icon name="gem" size={22} /> {diamonds}
          </span>
        )}
      </div>
      <button className="btn-fight" onClick={onClose}>
        {t("sf6a63bb", "תודה!")}
      </button>
    </Celebrate>
  );
}
