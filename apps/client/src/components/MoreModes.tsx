import { ARENAS, atArena } from "@amanda/shared";
import { Icon } from "./Icon";
import { Lock } from "./SignedInOnly";
import { Overlay } from "./Overlay";
import { line as t } from "../game/copy";
import { say } from "../game/lang";

/**
 * The shelf of modes that do not exist yet.
 *
 * Or asked for the button now and the modes later, so this is honest about it:
 * every row says what it will be and that it is not here. An empty promise
 * dressed up as a working button is worse than a shelf you can see is empty.
 *
 * To ship one of these: give it a `start` and drop the `soon` flag.
 *
 * The playground is deliberately NOT on this shelf. It has its own button on
 * the home screen, and Or's note was simply that it should not be in both
 * places at once — a door listed twice reads as two different doors.
 */
interface Mode {
  id: string;
  icon: Parameters<typeof Icon>[0]["name"];
  title: string;
  blurb: string;
  /**
   * The arena this mode opens at.
   *
   * Or, naming all four in one message: *"Amanda is not a peek, she is
   * simply locked, with a small caption under the padlock (opens at the Fuel
   * Stop). 2v2 we will open at the train station. Mirror deck at the alley.
   * The draft at the court."*
   *
   * Which turns this shelf from a list of promises into part of the ladder:
   * every mode has a place it belongs to, and climbing is what opens it.
   */
  opensAt?: string;
  soon?: boolean;
  start?: () => void;
}

export function MoreModes({
  onClose,
  onAmandaSolo,
  onMirror,
  onDraft,
  best = 0,
}: {
  onClose: () => void;
  onAmandaSolo: () => void;
  onMirror: () => void;
  onDraft: () => void;
  /** Best trophies ever, which is what an arena being "reached" means. */
  best?: number;
}) {
  const modes: Mode[] = [
    /*
     * In the order they open, which is the order of the ladder.
     *
     * Or: *"and sort the modes by order of appearance."* The same
     * instruction he gave the album an hour earlier, and the same reason:
     * a shelf ordered by nothing in particular puts the one you can almost
     * reach at the bottom and the one a year away at the top.
     *
     * Written out in order rather than sorted at runtime: four rows, and a
     * sort would hide the order from the person reading the file.
     */
    {
      id: "draft",
      icon: "discard",
      title: t("se4e1ef0", "דראפט"),
      blurb: t("s4b7da7f", "מה שלא לקחת הולך ליריב."),
      opensAt: "court",
      start: onDraft,
    },
    {
      id: "duo",
      icon: "monster",
      title: t("se14e946", "2 נגד 2"),
      blurb: t("sac17390", "שניים בונים לוח אחד."),
      opensAt: "station",
      soon: true,
    },
    {
      id: "mirror",
      icon: "deck",
      title: t("s7c9fba9", "דק זהה"),
      blurb: t("secbb695", "אותם קלפים לשני הצדדים."),
      // Or first said the alley, then moved it down: *"and fine, let mirror
      // deck open at the garage."* Four thousand five hundred trophies was a
      // year away from a mode that already works.
      opensAt: "garage",
      start: onMirror,
    },
    {
      /*
       * ═══ THE CURTAIN BECAME A DOOR ═══
       *
       * Or, the day before the testers arrived: *"Amanda mode looks awful.
       * Put it behind 'soon' as well for now, so users have no access to
       * it."* It is eight lanes against four and the screen had not caught
       * up — the teammate's half overlapping the board, a card's name
       * spilling as "The", the enemy's twelve slots in a column that lines
       * up with nothing.
       *
       * It is not "soon" any more; it is the last thing on the ladder:
       * *"Amanda is not a peek, she is simply locked, with a small caption
       * under the padlock (opens at the Fuel Stop)."* Which is a better
       * curtain than the word "soon" — it says WHEN.
       *
       * ⚠ AND THE SCREEN IS STILL NOT FIXED. The Fuel Stop is 8,000
       * trophies away, so there is time; but the day somebody gets there
       * this opens, and the layout has to be done before then rather than
       * because of then.
       */
      id: "amanda",
      icon: "king",
      title: t("s096f0c1", "אמנדה"),
      blurb: t("s7767343", "מולה לבד. אי אפשר לנצח."),
      opensAt: "fuel",
      start: onAmandaSolo,
    },
  ];

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--modes" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("sc4d6c42", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>
        <h2 className="modes__title">{t("sa53602d", "עוד מודים")}</h2>
        {/* The list says it itself: a mode you can play has a "שחק" button
            and one that is not ready says t("sbdb5aac", "בקרוב"). A line above it
            describing that is a line describing the obvious. */}
        <ul className="modes__list">
          {modes.map((mode) => {
            /*
             * ═══ A LOCK WITH A PLACE UNDER IT, AND NO SENTENCE ═══
             *
             * Or: *"Amanda is not a peek, she is simply locked, with a small
             * caption under the padlock (opens at the Fuel Stop)."*
             *
             * The caption is the place and nothing else — "בתחנת הדלק" under
             * a padlock. He wrote the whole phrase, *"opens at the Fuel
             * Stop"*, and the verb is the one word that cannot be shared:
             * אמנדה is feminine and דראפט is masculine, so one phrase for
             * four rows is wrong on two of them. A lock and a place says it
             * without conjugating anything. ⚠ His to overrule.
             */
            const gate = mode.opensAt ? ARENAS.find((a) => a.id === mode.opensAt) : undefined;
            const shut = !!gate && best < gate.from;
            const quiet = shut || mode.soon;
            return (
              <li key={mode.id} className={`modes__row${quiet ? " modes__row--soon" : ""}`}>
                <span className="modes__icon">
                  <Icon name={mode.icon} size={26} />
                </span>
                <span className="modes__text">
                  <b>{mode.title}</b>
                  <small>{mode.blurb}</small>
                </span>
                {shut ? (
                  // The same padlock every other locked thing in this game
                  // draws — a mode that invents its own lock is a second
                  // visual language for one idea.
                  <span className="modes__shut">
                    <Lock />
                    <small>{atArena(say(gate.name))}</small>
                  </span>
                ) : mode.soon ? (
                  <span className="modes__soon">{t("sbc98f3e", "בקרוב")}</span>
                ) : (
                  <button
                    className="btn-fight modes__go"
                    onClick={() => {
                      onClose();
                      mode.start?.();
                    }}
                  >
                    {t("sb8d28c1", "שחק")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Overlay>
  );
}
