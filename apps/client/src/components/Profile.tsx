/**
 * The player's own corner: who they are, what they look like, and which
 * account their album is tied to.
 *
 * The account is anonymous until they choose otherwise, so everything here is
 * optional and nothing blocks play. Signing in LINKS the account they already
 * have rather than making a new one, which is why none of these buttons says
 * "register" — there is nothing to register, they have been playing all along.
 */
import { useState } from "react";
import {
  MIN_AGE,
  ageFrom,
  linkEmail,
  linkGoogle,
  saveProfile,
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
  /** Re-read the account after something here changes it. */
  onChanged: () => void;
}

export function Profile({ account, onClose, onChanged }: Props) {
  const [nickname, setNickname] = useState(account?.nickname ?? "");
  const [birthDate, setBirthDate] = useState(account?.birthDate ?? "");
  const [avatar, setAvatar] = useState(account?.avatar ?? AVATAR_IDS[0]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooYoung = birthDate !== "" && ageFrom(birthDate) < MIN_AGE;

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
      <header className="album__bar">
        <button className="btn-fight btn-online" onClick={onClose}>
          ← חזרה
        </button>
        <div className="album__counts">
          {account && (
            <>
              <span className="album__count">
                <Icon name="win" size={16} /> {account.trophies}
              </span>
              <span className="album__count album__count--gem">💎 {account.diamonds}</span>
            </>
          )}
        </div>
      </header>

      <div className="album__scroll">
        <section className="profile__block">
          <h3>איך קוראים לך</h3>
          <input
            className="profile__input"
            value={nickname}
            maxLength={16}
            placeholder="הכינוי שלך"
            onChange={(e) => setNickname(e.target.value)}
          />
        </section>

        <section className="profile__block">
          <h3>הפרצוף שלך</h3>
          <div className="profile__avatars">
            {AVATAR_IDS.map((id) => (
              <button
                key={id}
                className={`profile__avatar${avatar === id ? " is-picked" : ""}`}
                onClick={() => setAvatar(id)}
                aria-pressed={avatar === id}
                title={id}
              >
                <img src={`${BASE}brand/${id}.webp`} alt="" />
              </button>
            ))}
          </div>
        </section>

        <section className="profile__block">
          <h3>מתי נולדת</h3>
          <input
            className="profile__input"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <p className="profile__note">
            {tooYoung
              ? `צריך להיות בן ${MIN_AGE} לפחות כדי לשחק נגד אנשים אחרים.`
              : "זה רק בשביל הגיל. לא נספר לאף אחד."}
          </p>
        </section>

        <button className="btn-fight" disabled={busy || tooYoung} onClick={() => void save()}>
          שמור
        </button>
        {note && <p className="profile__note profile__note--loud">{note}</p>}

        <section className="profile__block">
          <h3>שמירת האלבום</h3>
          {account?.linked ? (
            <p className="profile__note">החשבון שלך מחובר. האלבום שמור.</p>
          ) : (
            <>
              <p className="profile__note">
                בלי חשבון, האלבום קיים רק בדפדפן הזה.
              </p>
              <button
                className="btn-fight btn-online"
                onClick={() => void linkGoogle().then(setNote)}
              >
                המשך עם גוגל
              </button>
              <div className="profile__email">
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
                  placeholder="סיסמה"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="btn-fight btn-online"
                  disabled={!email || password.length < 6}
                  onClick={() => void linkEmail(email, password).then((e) => setNote(e ?? "מחובר"))}
                >
                  שמור עם אימייל
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
