import { Icon } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t } from "../game/copy";

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
  soon?: boolean;
  start?: () => void;
}

export function MoreModes({
  onClose,
  onAmandaSolo,
  onMirror,
}: {
  onClose: () => void;
  onAmandaSolo: () => void;
  onMirror: () => void;
}) {
  const modes: Mode[] = [
    {
      /*
       * ═══ BEHIND "SOON", ON PURPOSE, FOR NOW ═══
       *
       * Or, the day before the testers arrive: *"Amanda mode looks awful. I
       * suggest you put it behind 'soon' as well for now, so users have no
       * access to it, and we'll work on it later. I don't want it to let
       * down the first users."*
       *
       * It is eight lanes against four and the screen has not caught up:
       * his screenshot has the teammate's half overlapping the board, a
       * card's name spilling as "The", and the enemy's twelve slots drawn
       * in a column that does not line up with anything.
       *
       * The mode itself still works and every line of it is still here —
       * dropping `soon` and giving it back `start: onAmandaSolo` is the
       * whole of switching it on again. This is a curtain, not a deletion.
       */
      id: "amanda",
      icon: "king",
      title: t("s4fc5b19", "אמנדה — הצצה"),
      blurb: t("s7767343", "מולה לבד. אי אפשר לנצח."),
      soon: true,
    },
    {
      id: "mirror",
      icon: "deck",
      title: t("s7c9fba9", "דק זהה"),
      blurb: t("secbb695", "אותם קלפים לשני הצדדים."),
      start: onMirror,
    },
    {
      id: "duo",
      icon: "monster",
      title: t("se14e946", "2 נגד 2"),
      blurb: t("sac17390", "שניים בונים לוח אחד."),
      soon: true,
    },
    {
      id: "draft",
      icon: "discard",
      title: t("se4e1ef0", "דראפט"),
      blurb: t("s4b7da7f", "מה שלא לקחת הולך ליריב."),
      soon: true,
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
          {modes.map((mode) => (
            <li key={mode.id} className={`modes__row${mode.soon ? " modes__row--soon" : ""}`}>
              <span className="modes__icon">
                <Icon name={mode.icon} size={26} />
              </span>
              <span className="modes__text">
                <b>{mode.title}</b>
                <small>{mode.blurb}</small>
              </span>
              {mode.soon ? (
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
          ))}
        </ul>
      </div>
    </Overlay>
  );
}
