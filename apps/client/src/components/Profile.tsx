/**
 * The player's own corner.
 *
 * This used to be a stack of inputs with a save button, which is what Or
 * called ugly. The first minute is the onboarding's job now, so this is where
 * you come back to CHANGE things — a card with your face on it, and panels
 * underneath for the parts you might want to edit.
 *
 * Everything here is optional. The account is anonymous until the player
 * decides otherwise, and signing in LINKS the one they already have rather
 * than starting a new one — which is why nothing says "register".
 */
import { useEffect, useState } from "react";
import {
  MIN_AGE,
  ageFrom,
  isAdmin,
  linkEmail,
  linkGoogle,
  saveProfile,
  switchAccount,
  type Account,
} from "../game/account";
import { Icon } from "./Icon";

/**
 * The avatars drawn for this, matching packages/art/src/brandLooks.ts.
 * Interleaved on purpose so the grid does not read as "the boys, then the
 * girls, then the monsters" — the first row alone is a knight, a sorceress,
 * a robot and a warrior.
 */
export const AVATAR_IDS = [
  "av_knight",
  "av_sorceress",
  "av_robot",
  "av_warrior",
  "av_witch",
  "av_pirate",
  "av_goblin",
  "av_fairy",
  "av_ghost",
  "av_vampire",
  "av_cat",
  "av_alien",
  "av_slime",
  "av_mummy",
  "av_dragon",
  "av_wolf",
] as const;

const BASE = import.meta.env.BASE_URL;

interface Props {
  account: Account | null;
  onClose: () => void;
  onChanged: () => void;
}

export function Profile({ account, onClose, onChanged }: Props) {
  const [nickname, setNickname] = useState(account?.nickname ?? "");
  const [birthDate, setBirthDate] = useState(account?.birthDate ?? "");
  const [avatar, setAvatar] = useState(account?.avatar ?? AVATAR_IDS[0]);
  const [facesOpen, setFacesOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** Whether to draw the admin link. The server decides; this only shows it. */
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    void isAdmin().then((yes) => alive && setAdmin(yes));
    return () => {
      alive = false;
    };
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooYoung = birthDate !== "" && ageFrom(birthDate) < MIN_AGE;
  const dirty =
    nickname !== (account?.nickname ?? "") ||
    birthDate !== (account?.birthDate ?? "") ||
    avatar !== (account?.avatar ?? AVATAR_IDS[0]);

  async function save() {
    setBusy(true);
    const err = await saveProfile({
      nickname: nickname.trim(),
      avatar,
      ...(birthDate ? { birthDate } : {}),
    });
    setBusy(false);
    setNote(err ?? "נשמר");
    if (!err) onChanged();
  }

  return (
    <div className="profile">
      <header className="profile__top">
        <button className="btn-link" onClick={onClose}>
          ← חזרה
        </button>
      </header>

      <div className="profile__scroll">
        {/* Your card: face, name, and what you have to show for it. */}
        <section className="profile__hero">
          <button
            className="profile__face"
            onClick={() => setFacesOpen((v) => !v)}
            title="החלף פרצוף"
          >
            <img src={`${BASE}brand/${avatar}.webp`} alt="" />
            {/* A corner badge, not a stamp across the face. */}
            <span className="profile__face-edit">
              <Icon name="plus" size={11} />
            </span>
          </button>
          <div className="profile__who">
            <input
              className="profile__name"
              value={nickname}
              maxLength={16}
              placeholder="הכינוי שלך"
              onChange={(e) => setNickname(e.target.value)}
            />
            <div className="profile__stats">
              <span>
                <Icon name="win" size={17} /> {account?.trophies ?? 0}
              </span>
              <span className="is-gem">
          <Icon name="gem" size={15} /> {account?.diamonds ?? 0}
        </span>
              <span>
                <Icon name="monster" size={17} /> {account?.album.size ?? 0}
              </span>
            </div>
          </div>
        </section>

        {/*
          The panel, for the people who have it. Asked of the server, because
          the admins table is unreachable from the browser by design — and the
          answer only decides whether a link is drawn, never what it can do.
        */}
        {admin && (
          <section className="profile__box">
            <h3>ניהול</h3>
            <a className="btn-fight btn-online profile__wide profile__admin" href="?admin">
              <Icon name="menu" size={15} /> פתח את לוח הניהול
            </a>
          </section>
        )}

        {leaving && (
          <div className="modal-overlay" onClick={() => setLeaving(false)}>
            <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
              <h2>לצאת מהחשבון?</h2>
              <p>
                האלבום, הגביעים והקלפים שלך נשמרים. אפשר לחזור אליהם בכל רגע עם
                אותה התחברות. המכשיר יתחיל מחשבון אורח חדש.
              </p>
              <div className="result__buttons">
                <button
                  className="btn-fight"
                  onClick={() => {
                    setLeaving(false);
                    void switchAccount().then(() => window.location.reload());
                  }}
                >
                  כן, לצאת
                </button>
                <button className="btn-fight btn-ghost" onClick={() => setLeaving(false)}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        )}

        {facesOpen && (
          <div className="profile__faces">
            {AVATAR_IDS.map((id) => (
              <button
                key={id}
                className={`profile__avatar${avatar === id ? " is-picked" : ""}`}
                aria-pressed={avatar === id}
                onClick={() => {
                  setAvatar(id);
                  setFacesOpen(false);
                }}
              >
                <img src={`${BASE}brand/${id}.webp`} alt="" />
              </button>
            ))}
          </div>
        )}

        <section className="panel">
          <h3>יום ההולדת שלך</h3>
          <input
            className="profile__input"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <p className="profile__note">
            {tooYoung
              ? `בשביל לשחק נגד אנשים אחרים צריך להיות בן ${MIN_AGE} לפחות. נגד הבוט — תמיד אפשר.`
              : "זה רק בשביל הגיל."}
          </p>
        </section>

        {dirty && (
          <button className="btn-fight profile__save" disabled={busy} onClick={() => void save()}>
            שמור שינויים
          </button>
        )}
        {note && <p className="profile__note profile__note--loud">{note}</p>}

        <section className="panel">
          <h3>החשבון שלך</h3>
          {account?.linked ? (
            <>
              <p className="profile__note">מחובר. האלבום שלך שמור גם אם תחליף מכשיר.</p>
              {/*
                Leaving, which was not possible before. A signed-in player on a
                shared machine had no way to hand it to anyone else.
              */}
              <button
                className="btn-fight btn-ghost profile__wide"
                onClick={() => setLeaving(true)}
              >
                <Icon name="back" size={15} /> יציאה / החלפת משתמש
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-fight btn-online profile__wide"
                onClick={() => void linkGoogle().then(setNote)}
              >
                המשך עם גוגל
              </button>
              <div className="profile__or">או</div>
              <input
                className="profile__input"
                type="email"
                placeholder="אימייל"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="profile__input"
                type="password"
                placeholder="סיסמה (6 תווים ומעלה)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="btn-fight btn-online profile__wide"
                disabled={!email || password.length < 6}
                onClick={() => void linkEmail(email, password).then((e) => setNote(e ?? "מחובר"))}
              >
                שמור עם אימייל
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
