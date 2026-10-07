/**
 * The first minute: who you are, what you look like, how old you are.
 *
 * Four screens, one question each, and Amanda asking them — because the
 * alternative is the form the profile screen used to be, which is what Or
 * called ugly and was right about. Nothing here blocks play: every step can be
 * passed over, and the only thing that actually gates anything is the
 * birthday, which gates playing against other people rather than playing.
 */
import { useState } from "react";
import { MIN_AGE, ageFrom, saveProfile } from "../game/account";
import { AVATAR_IDS } from "./Profile";
import * as V from "../data/voice";

const BASE = import.meta.env.BASE_URL;

interface Props {
  /** A name to start from, when they already have one. */
  initialNickname?: string | null;
  onDone: () => void;
}

type Stage = "hello" | "who" | "face" | "name" | "age";

export function Onboarding({ initialNickname, onDone }: Props) {
  const [stage, setStage] = useState<Stage>("hello");
  const [avatar, setAvatar] = useState<string>(AVATAR_IDS[0]);
  const [gender, setGender] = useState<V.Gender>(null);
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [birthDate, setBirthDate] = useState("");
  const [saving, setSaving] = useState(false);

  const tooYoung = birthDate !== "" && ageFrom(birthDate) < MIN_AGE;

  async function finish() {
    setSaving(true);
    await saveProfile({
      avatar,
      ...(gender ? { gender } : {}),
      nickname: nickname.trim() || "שחקן",
      ...(birthDate && !tooYoung ? { birthDate } : {}),
    });
    setSaving(false);
    onDone();
  }

  return (
    <div className="ob">
      <div
        className="ob__art"
        style={{ backgroundImage: `url("${BASE}brand/amanda_banner.webp")` }}
        aria-hidden="true"
      />
      <div className="ob__wash" aria-hidden="true" />

      <div className="ob__panel">
        <p className="ob__says">{V.ONBOARDING[stage]}</p>

        {stage === "hello" && (
          <div className="ob__row">
            <button className="btn-fight" onClick={() => setStage("who")}>
              יאללה
            </button>
            <button className="btn-link" onClick={onDone}>
              אחר כך
            </button>
          </div>
        )}

        {/*
          Who she is talking to. First, because everything after it is
          addressed to somebody — and skippable, because a child who does not
          want to answer should not be stuck on a question to play a game.
          Unanswered falls back to the masculine, which is the Hebrew default
          and what every line said before anyone was asked.
        */}
        {stage === "who" && (
          <div className="ob__row ob__who">
            <button
              className="btn-fight"
              onClick={() => {
                setGender("boy");
                V.setGender("boy");
                setStage("face");
              }}
            >
              {/* "בן"/"בת", and the third is not "לא אומר" — that phrasing is
                  itself masculine, so the button for declining to say was
                  saying it. Or's wording; the same three are in Profile. */}
              בן
            </button>
            <button
              className="btn-fight"
              onClick={() => {
                setGender("girl");
                V.setGender("girl");
                setStage("face");
              }}
            >
              בת
            </button>
            <button className="btn-link" onClick={() => setStage("face")}>
              למה להגדיר?
            </button>
          </div>
        )}

        {stage === "face" && (
          <>
            <div className="ob__faces">
              {AVATAR_IDS.map((id) => (
                <button
                  key={id}
                  className={`ob__face${avatar === id ? " is-picked" : ""}`}
                  aria-pressed={avatar === id}
                  onClick={() => setAvatar(id)}
                >
                  <img src={`${BASE}brand/${id}.webp`} alt="" />
                </button>
              ))}
            </div>
            <div className="ob__row">
              <button className="btn-fight" onClick={() => setStage("name")}>
                זה אני
              </button>
            </div>
          </>
        )}

        {stage === "name" && (
          <>
            <input
              className="ob__input"
              value={nickname}
              maxLength={16}
              autoFocus
              placeholder="הכינוי שלך"
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setStage("age")}
            />
            <div className="ob__row">
              <button className="btn-fight" onClick={() => setStage("age")}>
                קדימה
              </button>
            </div>
          </>
        )}

        {stage === "age" && (
          <>
            <input
              className="ob__input"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            {tooYoung && (
              <p className="ob__warn">
                בשביל לשחק נגד אנשים אחרים צריך להיות בן {MIN_AGE} לפחות. נגד הבוט — תמיד
                אפשר.
              </p>
            )}
            <div className="ob__row">
              <button className="btn-fight" disabled={saving} onClick={() => void finish()}>
                סיימנו
              </button>
              <button className="btn-link" onClick={() => void finish()}>
                בלי להגיד
              </button>
            </div>
          </>
        )}

        <span className="ob__dots">
          {(["hello", "face", "name", "age"] as Stage[]).map((s) => (
            <i key={s} className={s === stage ? "is-now" : undefined} />
          ))}
        </span>
      </div>
    </div>
  );
}
