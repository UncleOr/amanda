/**
 * ═══ WHAT THIS SCREEN IS FOR ═══
 *
 * **This is me.** The face, the name and the one line thrown across the versus
 * screen — the three things another player will see. The rest (birthday, how
 * to address you, the account) is settings, and settings are furniture.
 *
 * Measured at 844x390 before that was true: the biggest thing on the screen
 * was an EMPTY TEXT BOX — the nickname field at 679x47 and 28px type, eight
 * times the area of the face at 84x84. The way out was a 13px grey link. And
 * five full-width panels stacked down a 766px scroll on a 353px window, each
 * one holding a row of content a fifth of its width: the gender panel was 779
 * wide round three buttons totalling 170.
 *
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
  loadShop,
  takeAuthError,
  getAuthTrace,
  saveProfile,
  switchAccount,
  type Account,
} from "../game/account";
import { Icon } from "./Icon";
import { NO_PHRASE, ownedCatchphrases } from "@amanda/shared";
import { Plaque } from "./Plaque";
import * as V from "../data/voice";
import { Overlay } from "./Overlay";
import { line as t, lineF as tf } from "../game/copy";

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

/**
 * The faces the shop sells.
 *
 * Kept apart from the free list above rather than mixed into it, because the
 * grid has to be able to answer "can I have this one" — and the answer is a
 * row in player_items, not a hard-coded list. A face that is not yours is not
 * drawn here at all: a locked thing you can see but not choose is an
 * advertisement inside the profile screen, and the shop is where the shop is.
 */
export const SHOP_AVATAR_IDS = [
  "av_astronaut",
  "av_mechanic",
  "av_skater",
  "av_yeti",
  "av_jellyking",
  "av_mothgirl",
] as const;

const BASE = import.meta.env.BASE_URL;

interface Props {
  account: Account | null;
  onClose: () => void;
  onChanged: () => void;
}

export function Profile({ account, onClose, onChanged }: Props) {
  /*
   * Which bought faces are this player's. Asked once when the screen opens;
   * the shop is the only thing that changes the answer, and it reloads the
   * account when it does.
   */
  const [bought, setBought] = useState<string[]>([]);
  /** Every shop item this player holds, for the catchphrases below. */
  const [owned, setOwned] = useState<string[]>([]);
  useEffect(() => {
    void loadShop().then(({ items, owned: mineIds }) => {
      const mine = new Set(mineIds);
      setOwned(mineIds);
      setBought(
        items
          .filter((i) => i.kind === "avatar" && mine.has(i.id))
          .map((i) => (i.grants as { avatar?: string }).avatar ?? "")
          .filter(Boolean),
      );
    });
  }, []);

  const [nickname, setNickname] = useState(account?.nickname ?? "");
  const [birthDate, setBirthDate] = useState(account?.birthDate ?? "");
  const [avatar, setAvatar] = useState(account?.avatar ?? AVATAR_IDS[0]);
  const [facesOpen, setFacesOpen] = useState(false);
  const [gender, setGenderChoice] = useState<V.Gender>(account?.gender ?? null);
  /** The line thrown across the versus screen. NO_PHRASE means say nothing. */
  const [phrase, setPhrase] = useState(account?.catchphrase ?? NO_PHRASE);
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
  /*
   * Whatever went wrong on the way back from Google.
   *
   * The sign-in happens across a page load, so by the time the player is
   * looking at this screen again the thing that failed is long over. Without
   * this they simply find themselves signed out with no explanation — which
   * is exactly what Or reported.
   */
  useEffect(() => {
    const failed = takeAuthError();
    if (failed) setNote(failed);
  }, []);
  const [busy, setBusy] = useState(false);

  const tooYoung = birthDate !== "" && ageFrom(birthDate) < MIN_AGE;
  const dirty =
    nickname !== (account?.nickname ?? "") ||
    birthDate !== (account?.birthDate ?? "") ||
    avatar !== (account?.avatar ?? AVATAR_IDS[0]) ||
    phrase !== (account?.catchphrase ?? NO_PHRASE) ||
    gender !== (account?.gender ?? null);

  async function save() {
    setBusy(true);
    const err = await saveProfile({
      nickname: nickname.trim(),
      avatar,
      // "" rather than the sentinel: the column holds a real id or nothing,
      // and NO_PHRASE is this screen's way of saying "nothing" out loud.
      catchphrase: phrase === NO_PHRASE ? "" : phrase,
      ...(birthDate ? { birthDate } : {}),
      ...(gender ? { gender } : {}),
    });
    setBusy(false);
    // The copy has to change under the player straight away, not on reload.
    V.setGender(gender);
    setNote(err ?? t("see9fd0e", "נשמר"));
    if (!err) onChanged();
  }

  return (
    <div className="profile">
      <header className="profile__top">
        <button className="btn-link" onClick={onClose}>
          {t("sc37bae6", "← חזרה")}
        </button>
      </header>

      <div className="profile__scroll">
        {/*
          ═══ THE CARD AND ITS FACE PICKER ARE ONE BLOCK ═══

          Or: *"on the profile screen the profile picture is cut off, and it
          also hides the heading of my catchphrases."*

          Both halves of that were one bug and it only appeared after you
          TAPPED the face — which is the only time anybody is looking at it.

          The scroll area is a two-column grid in landscape. The picker was a
          sibling spanning both columns, so opening it pushed the panel that
          had been sitting beside the identity card down into the next row and
          left the card alone in row one. Alone, it collapsed to 30px: the
          phone block sets `min-height: 0` on it, the grid's rows are at their
          base sizes because the content is taller than the scroll box, and a
          base size is the item's MINIMUM contribution. The card then stretched
          to that 30px row with `justify-content: center`, which spilled its
          102px face 35px ABOVE the card and the name below it — over the
          heading underneath. Measured: face top at y=-35 against a card at
          y=38.

          Wrapping the two means the card is never alone in a row, and the
          picker opens attached to the face it changes rather than as a band
          across the screen.
        */}
        <div className="profile__identity">
        {/* Your card: face, name, and what you have to show for it. */}
        <section className="profile__hero">
          <button
            className="profile__face"
            onClick={() => setFacesOpen((v) => !v)}
            title={t("sa83f16f", "החלף פרצוף")}
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
              placeholder={t("s5516565", "הכינוי שלך")}
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

        {facesOpen && (
          <div className="profile__faces">
            {[...AVATAR_IDS, ...bought].map((id) => (
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
        </div>

        {/*
          The panel, for the people who have it. Asked of the server, because
          the admins table is unreachable from the browser by design — and the
          answer only decides whether a link is drawn, never what it can do.
        */}
        {admin && (
          <section className="profile__box">
            <h3>{t("safd776c", "ניהול")}</h3>
            <a className="btn-fight btn-online profile__wide profile__admin" href="?admin">
              <Icon name="menu" size={15} /> {t("s2cf62eb", "פתח את לוח הניהול")}
            </a>
          </section>
        )}

        {leaving && (
          <Overlay onClick={() => setLeaving(false)}>
            <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
              <h2>{t("s23e4e7c", "לצאת מהחשבון?")}</h2>
              {/* One sentence. The other two said the same thing in
                  implementation detail — which login, which device — and §6's
                  own example of the offence is two sentences doing one
                  sentence's job. */}
              <p>{t("s6059eba", "הכול נשמר, ואפשר לחזור.")}</p>
              <div className="result__buttons">
                <button
                  className="btn-fight"
                  onClick={() => {
                    setLeaving(false);
                    void switchAccount().then(() => window.location.reload());
                  }}
                >
                  {t("s9dc75cf", "כן, לצאת")}
                </button>
                <button className="btn-fight btn-ghost" onClick={() => setLeaving(false)}>
                  {t("sae4c613", "ביטול")}
                </button>
              </div>
            </div>
          </Overlay>
        )}

        {/*
          The one line that is yours.

          Or: *"let everyone choose a catchphrase, at first from 5 phrases —
          but catchphrases (designed!) are another thing you can buy in the
          shop or win in a chest. Then people will have a reason to buy from
          the shop, because it is something you SEE."*

          The ones that are not yours are drawn here anyway, locked, for the
          same reason the shop and the album are shown to a guest: a hidden
          thing persuades nobody. You cannot want a line you have never read.
        */}
        {/*
          The one line that is yours.

          ═══ ONLY THE ONES YOU HAVE ═══

          Everywhere else in this game a locked thing is drawn rather than
          hidden, because wanting it is the point. Or drew the line here, and
          at the right place: *"don't put the phrases you don't have yet. The
          hope is that eventually there will be hundreds of them."* A list of
          hundreds is where "locked, not hidden" stops persuading and starts
          being a wall of padlocks. The shop is where you meet the rest.

          And no sentence explaining what a catchphrase is. Or: *"we don't
          need 'what is written about you when a match starts'. Remember what
          we said about explanatory lines? Cut, cut, cut."*
        */}
        <section className="panel">
          <h3>{t("s56f3a93", "משפט המחץ שלי")}</h3>
          <div className="phrases">
            {ownedCatchphrases(owned).map((p) => (
              <button
                key={p.id}
                className={`phrases__one${phrase === p.id ? " is-picked" : ""}`}
                aria-pressed={phrase === p.id}
                onClick={() => setPhrase(p.id)}
              >
                {p.id === NO_PHRASE ? (
                  <span className="phrases__silent">{t("sf806fc3", "בלי משפט")}</span>
                ) : (
                  <Plaque phrase={p} />
                )}
              </button>
            ))}
          </div>
        </section>

        {/*
          Changing it later, which was impossible.
          Or: "I still don't see that I can set my gender." He could not — the
          question is asked during onboarding, and onboarding only ever appears
          for an account that has never been set up. Anybody who already had a
          nickname never got asked and had no way to answer.
        */}
        <section className="panel">
          <h3>{t("s878f7ab", "איך לפנות אליך")}</h3>
          {/*
            ═══ NO EXPLANATION, AND NOT t("s7c32ea2", "לא אומר") ═══

            There was a line under this explaining that Hebrew forces the
            choice and that saying nothing gets you the masculine. Or: *"do
            you understand that there is no reason for that sentence to be in
            the interface? Why the hell does the user care?"* He is right —
            it was me explaining a problem with the language to a
            seven-year-old who only wants to tap a word.

            And the third option could not stay t("s3cb377b", "לא אומר"), because that is
            itself masculine: the button for "I would rather not say" was
            quietly saying it for you. Or's suggestion, and his wording.
          */}
          <div className="profile__gender">
            {([
              { v: "boy", he: t("s9003bc9", "בן") },
              { v: "girl", he: t("sb434f05", "בת") },
              { v: null, he: t("s95fa408", "למה להגדיר?") },
            ] as const).map((o) => (
              <button
                key={o.he}
                className={gender === o.v ? "is-on" : ""}
                onClick={() => setGenderChoice(o.v)}
              >
                {o.he}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>{t("sf69f486", "יום ההולדת שלך")}</h3>
          <input
            className="profile__input"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          {/* "This is only for your age" explained the field above it, which
              is the offence Or has named most often. The warning stays,
              because being turned away from online play without being told
              why is worse than a line of text — but it is four words. */}
          {tooYoung && (
            <p className="profile__note profile__note--loud">
              {tf("sde6d97c", "נגד אנשים — מגיל {0}", MIN_AGE)}
            </p>
          )}
        </section>

        {dirty && (
          <button className="btn-fight profile__save" disabled={busy} onClick={() => void save()}>
            {t("sf5092ae", "שמור שינויים")}
          </button>
        )}
        {note && <p className="profile__note profile__note--loud">{note}</p>}
        {/*
          What this page load actually saw of a sign-in.
          Not for players — it is so that a screenshot of this screen answers
          "what happened" instead of "it came back not signed in". See
          authTrace in account.ts.
        */}
        <p className="profile__trace" dir="ltr">
          {getAuthTrace()}
        </p>

        <section className="panel">
          <h3>{t("sc0f520f", "החשבון שלך")}</h3>
          {account?.linked ? (
            <>
              {/* t("sa8324d2", "מחובר") is the whole message. What being connected buys
                  was the reason to sign in and that argument was already
                  made and won on the way in — repeating it here is a
                  salesman still talking after the sale. */}
              <p className="profile__note">{t("s1d9574c", "מחובר")}</p>
              {/*
                Leaving, which was not possible before. A signed-in player on a
                shared machine had no way to hand it to anyone else.
              */}
              <button
                className="btn-fight btn-ghost profile__wide"
                onClick={() => setLeaving(true)}
              >
                <Icon name="back" size={15} /> {t("sa4507ca", "יציאה / החלפת משתמש")}
              </button>
              {/*
                ═══ DELETING MOVED INTO THE SETTINGS GEAR ═══

                Both of them were here, full width, wearing `btn-fight` — the
                same class as "המשך עם גוגל" directly above and as the button
                that starts a match. Or: *"the delete-my-data / delete-my-
                account buttons should not be so accessible. It almost looks
                as though we are inviting them to do it."* He is right: the
                most destructive pair of actions in the game looked exactly
                like the most wanted one.

                Play requires the route to account deletion to be FINDABLE
                inside the app. It does not require it to be loud. It is a
                closed section at the bottom of Settings now, and what is
                inside it is text links. The confirmations are unchanged —
                they are the part that is meant to be heavy.
              */}
            </>
          ) : (
            <>
              <button
                className="btn-fight btn-online profile__wide"
                onClick={() => void linkGoogle().then(setNote)}
              >
                {t("s2248739", "המשך עם גוגל")}
              </button>
              <div className="profile__or">{t("s074bcb0", "או")}</div>
              <input
                className="profile__input"
                type="email"
                placeholder={t("sc8aa4b2", "אימייל")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="profile__input"
                type="password"
                placeholder={t("scebe1c7", "סיסמה (6 תווים ומעלה)")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="btn-fight btn-online profile__wide"
                disabled={!email || password.length < 6}
                onClick={() => void linkEmail(email, password).then((e) => setNote(e ?? t("s4104b4f", "מחובר")))}
              >
                {t("s0d032c8", "שמור עם אימייל")}
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
