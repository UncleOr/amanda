import { Icon } from "./Icon";

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
      id: "amanda",
      icon: "king",
      title: "אמנדה — הצצה",
      blurb: "לוח 4×8 מולה, לבד. לא ניתן לניצחון, וזה בכוונה: זה בשביל לראות איך זה נראה.",
      start: onAmandaSolo,
    },
    {
      id: "mirror",
      icon: "deck",
      title: "חפיסה זהה",
      blurb: "אותם קלפים בדיוק לשני הצדדים, באותו סדר. אין תירוצים — רק מי שבנה נכון.",
      start: onMirror,
    },
    {
      id: "duo",
      icon: "monster",
      title: "2 נגד 2",
      blurb: "שניים בונים לוח אחד מול שניים אחרים. מי שמתווכח טוב יותר מנצח.",
      soon: true,
    },
    {
      id: "draft",
      icon: "discard",
      title: "דראפט",
      blurb: "בוחרים קלף אחד בכל סיבוב, ומה שלא לקחת הולך ליריב.",
      soon: true,
    },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--modes" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
        </button>
        <h2 className="modes__title">עוד מודים</h2>
        <p className="modes__lead">מה שכבר מוכן, ומה שאני עוד מבשלת.</p>
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
                <span className="modes__soon">בקרוב</span>
              ) : (
                <button
                  className="btn-fight modes__go"
                  onClick={() => {
                    onClose();
                    mode.start?.();
                  }}
                >
                  שחק
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
