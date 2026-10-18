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
import { linkGoogle } from "../game/account";
import { line as t, lineF as tf } from "../game/copy";

const BASE = import.meta.env.BASE_URL;

interface Props {
  /** A name to start from, when they already have one. */
  initialNickname?: string | null;
  onDone: () => void;
}

type Stage = "hello" | "account" | "who" | "face" | "name" | "age";

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
      nickname: nickname.trim() || t("s7628ae6", "שחקן"),
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
            <button className="btn-fight" onClick={() => setStage("account")}>
              {t("sbe708cc", "יאללה")}
            </button>
            <button className="btn-link" onClick={onDone}>
              {t("s8d5377a", "אחר כך")}
            </button>
          </div>
        )}

        {/*
          ═══ THE ACCOUNT, ASKED FIRST ═══

          Or: *"I think we should offer him to sign in with Google right at
          the start, with a small 'later' button."*

          Second card rather than first, and the difference matters: the
          first thing a child meets is Amanda introducing herself, which is
          one tap, and only then does anything ask them for something. A
          sign-in button before she has said a word is a login screen.

          "Later" is a text link, not a button, because the two are not
          equal choices — but it is always there and it always works. Nobody
          is held at this card.

          Signing in LEAVES: the browser opens, and coming back re-enters
          the app from the top. So this is deliberately before the nickname,
          the face and the birthday — there is nothing half-filled to lose
          at this point, which there would be if it were asked at the end.
        */}
        {stage === "account" && (
          <div className="ob__row">
            <button
              className="btn-fight btn-online"
              onClick={() => void linkGoogle().then((err) => err && setStage("who"))}
            >
              {t("s7d1c936", "המשך עם גוגל")}
            </button>
            <button className="btn-link" onClick={() => setStage("who")}>
              {t("sfcd8d79", "אחר כך")}
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
              {t("sd66df01", "בן")}
            </button>
            <button
              className="btn-fight"
              onClick={() => {
                setGender("girl");
                V.setGender("girl");
                setStage("face");
              }}
            >
              {t("s51bc16c", "בת")}
            </button>
            <button className="btn-link" onClick={() => setStage("face")}>
              {t("s4e5fa5b", "למה להגדיר?")}
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
                {t("s42fb787", "זה אני")}
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
              placeholder={t("s8e369df", "הכינוי שלך")}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setStage("age")}
            />
            <div className="ob__row">
              <button className="btn-fight" onClick={() => setStage("age")}>
                {t("sb359ace", "קדימה")}
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
                {tf("sbccb202", "בשביל לשחק נגד אנשים אחרים צריך להיות בן {0} לפחות. נגד הבוט — תמיד אפשר.", MIN_AGE)}
              </p>
            )}
            <div className="ob__row">
              <button className="btn-fight" disabled={saving} onClick={() => void finish()}>
                {t("sd694b8e", "סיימנו")}
              </button>
              <button className="btn-link" onClick={() => void finish()}>
                {t("scea7960", "בלי להגיד")}
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
