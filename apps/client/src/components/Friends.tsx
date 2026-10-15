import { useCallback, useEffect, useState } from "react";
import { arenaFor } from "@amanda/shared";
import { Icon } from "./Icon";
import {
  addableOpponents,
  askByCode,
  friendAction,
  friendCode,
  listFriends,
  type Friend,
} from "../game/account";
import { collectable } from "../data/catalog";
import { Overlay } from "./Overlay";
import { say } from "../game/lang";
import { line as t } from "../game/copy";

const BASE = import.meta.env.BASE_URL;

/**
 * The friends list, and one friend.
 *
 * Or: "an option to add players to a friends list, to see whether they are
 * online, and to invite them to a game."
 *
 * ═══ A ROW IS A PERSON ═══
 *
 * Or, with the list open on his phone: *"it should show a friend's name and
 * profile picture and connected/not connected (the ✕ is offside, but there
 * shouldn't be an ✕ there at all). Tapping should open a friend's board —
 * how many diamonds he has, which arena he is in, how many cards he has
 * got."*
 *
 * Both halves of that are one point. The row used to be a dot, a name and a
 * cross — a name is not a face, and **the only thing you could do to a
 * person on this screen was delete them**, which is what the cross being the
 * easiest thing on the row to hit actually meant. So the cross is gone from
 * the row entirely; ending a friendship now lives at the bottom of that
 * friend's own board, small, behind a confirmation, which is three
 * deliberate acts instead of one stray thumb.
 *
 * The board costs no extra request: trophies, diamonds and the card count
 * are columns on the row the list already fetched (friends.ts).
 *
 * ═══ WHAT THIS DELIBERATELY DOES NOT HAVE ═══
 *
 * A search box. There is no way here to look for a person by name, and there
 * will not be: a seven-year-old typing names into a box to find strangers is
 * the thing this shape prevents, in both directions.
 *
 * What there is instead is a six-character code you read out loud — Or:
 * *"add an option to add a friend with a matching code, like a game."* That
 * is the same consent by another route. You cannot guess one and you cannot
 * enumerate them; the only way to have somebody's is for them to have handed
 * it to you. See askByCode in apps/server/src/friends.ts, which is where
 * every rule on this screen is actually enforced.
 */
export function Friends({
  onClose,
  onInvite,
  canInvite,
}: {
  onClose: () => void;
  /** Open a room and call them into it. Null while there is no connection. */
  onInvite: ((playerId: string) => void) | null;
  canInvite: boolean;
}) {
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [addable, setAddable] = useState<Array<{
    id: string;
    nickname: string | null;
  }> | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  /** Whose board is open. An id, not the row, so a refresh keeps it current. */
  const [open, setOpen] = useState<string | null>(null);
  const [myCode, setMyCode] = useState<string | null>(null);
  const [typed, setTyped] = useState("");

  const refresh = useCallback(async () => {
    setFriends(await listFriends());
  }, []);

  useEffect(() => {
    void refresh();
    /*
     * Who is online changes while the list is open, and the only honest way
     * to show that is to ask again. Ten seconds is slow enough to be free and
     * quick enough that "they just came on" is noticed while you are looking.
     */
    const t = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function act(action: "ask" | "accept" | "remove", id: string) {
    setBusy(id);
    const err = await friendAction(action, id);
    setBusy(null);
    setNote(err);
    await refresh();
    if (!err && action === "remove") setOpen(null);
    if (!err && action === "ask")
      setAddable((list) => (list ?? []).filter((o) => o.id !== id));
  }

  async function openAdd() {
    setAdding(true);
    setAddable(await addableOpponents());
    // Made on the server the first time it is asked for, so a player who
    // never opens this panel never gets a code at all.
    setMyCode(await friendCode());
  }

  async function sendCode() {
    setBusy("code");
    const err = await askByCode(typed);
    setBusy(null);
    setNote(err);
    if (!err) {
      setTyped("");
      await refresh();
    }
  }

  const name = (f: { nickname: string | null }) => f.nickname ?? t("s99cd003", "בלי שם");
  const shown = friends?.find((f) => f.id === open) ?? null;

  if (shown) {
    return (
      <Overlay onClick={onClose}>
        <div className="modal modal--friends" onClick={(e) => e.stopPropagation()}>
          <FriendBoard
            friend={shown}
            name={name(shown)}
            busy={busy === shown.id}
            canInvite={canInvite}
            onInvite={onInvite}
            onAct={act}
            onBack={() => {
              setOpen(null);
              setNote(null);
            }}
          />
          {note && <p className="friends__note">{note}</p>}
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClick={onClose}>
      <div
        className="modal modal--friends"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal__close" onClick={onClose} title={t("s92f2116", "סגירה")}>
          <Icon name="exit" size={15} />
        </button>
        <h2 className="friends__title">
          {adding && (
            <button
              className="friends__back"
              onClick={() => {
                setAdding(false);
                setNote(null);
              }}
            >
              <Icon name="back" size={15} />
            </button>
          )}
          {adding ? t("s6fa5878", "להוסיף חבר") : t("s2e78dd8", "חברים")}
        </h2>

        {adding ? null : friends === null ? (
          <p className="friends__hint">{t("sf41dbdb", "רגע…")}</p>
        ) : friends.length === 0 && !adding ? (
          // Was three clauses: "nobody here yet. you can only add someone you
          // have played — play, and then you can add them." The rule it spent
          // two of them on is the same rule the add panel states when you get
          // there, which is the only place it is any use.
          <p className="friends__hint">{t("s451672b", "עוד אין כאן אף אחד.")}</p>
        ) : (
          <ul className="friends__list">
            {friends.map((f) => (
              <li key={f.id}>
                {/*
                  The whole row opens the person. There is no second target on
                  it to miss — which is the actual answer to "the ✕ is
                  offside": nothing on a row should be small enough to be
                  offside in the first place.
                */}
                <button
                  className={`friends__row${f.online ? " is-online" : ""}`}
                  onClick={() => setOpen(f.id)}
                >
                  <Face friend={f} />
                  <span className="friends__who">
                    <b>{name(f)}</b>
                    <small>
                      {f.state === "asking"
                        ? t("se22affe", "רוצה להיות חבר שלך")
                        : f.state === "asked"
                          ? t("s3d6a918", "מחכה שיאשר")
                          : f.online
                            ? t("s7171c91", "מחובר")
                            : t("s940973e", "לא מחובר")}
                    </small>
                  </span>
                  {/*
                    A mark, not a button: the row is the button. A request
                    waiting on you is the only thing here that goes nowhere
                    until somebody looks at it, so it is the only thing that
                    gets to be gold.
                  */}
                  {f.state === "asking" && (
                    <span className="friends__flag" aria-hidden="true">
                      <Icon name="ready" size={14} />
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {note && <p className="friends__note">{note}</p>}

        {!adding ? (
          <button
            className="btn-fight btn-ghost"
            onClick={() => void openAdd()}
          >
            <Icon name="plus" size={15} /> {t("s6bdffb3", "להוסיף חבר")}
          </button>
        ) : (
          <div className="friends__add">
            {/*
              The code first, because it is the half that works for two
              children sitting next to each other — which is the case the
              played-you list cannot serve at all.
            */}
            <div className="friends__code">
              <span className="friends__codelabel">{t("s310399d", "הקוד שלי")}</span>
              <b className="friends__codeval">{myCode ?? "…"}</b>
            </div>
            <div className="friends__codein">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value.toUpperCase().slice(0, 6))}
                placeholder={t("sec12a0d", "קוד של חבר")}
                inputMode="text"
                autoCapitalize="characters"
                spellCheck={false}
              />
              <button
                className="btn-fight btn-small"
                disabled={typed.length < 6 || busy === "code"}
                onClick={() => void sendCode()}
              >
                {t("s2a0da49", "הוספה")}
              </button>
            </div>

            {/*
              ONE line, whichever state this is in. Opening the add panel on an
              empty list used to stack three of them: "nobody here yet", "only
              someone you have played", "nobody to add right now" — three
              sentences for one fact, which is the thing §6 is about even when
              each of them is four words long.
            */}
            {addable === null ? (
              <p className="friends__hint">{t("s1620146", "רגע…")}</p>
            ) : addable.length === 0 ? null : (
              <>
                <p className="friends__hint">{t("sbec9016", "רק מי ששיחקת מולו.")}</p>
                <div className="friends__candidates">
                  {addable.map((o) => (
                    <button
                      key={o.id}
                      disabled={busy === o.id}
                      onClick={() => void act("ask", o.id)}
                    >
                      <Icon name="plus" size={13} /> {name(o)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Overlay>
  );
}

/**
 * A friend's face, or the first letter of their name.
 *
 * The server hands back a face for everybody — the one they chose, or the
 * one derived from their id (shared/identity.ts) — so the fallback should
 * never be reached. It is here because a broken `<img>` in a list of
 * children's faces is worse than a letter, and the file could always be the
 * one thing that failed to deploy.
 */
function Face({ friend }: { friend: Friend }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`friends__face${friend.online ? " is-on" : ""}`}>
      {friend.avatar && !broken ? (
        <img
          src={`${BASE}brand/${friend.avatar}.webp`}
          alt=""
          onError={() => setBroken(true)}
        />
      ) : (
        <i aria-hidden="true">{(friend.nickname ?? "?").slice(0, 1)}</i>
      )}
    </span>
  );
}

/**
 * One friend, big.
 *
 * Hero: **the person**. Three numbers under the face, the one thing you came
 * here to do under those, and the way out of the friendship at the very
 * bottom in the quietest type on the screen — Or: *"there is an option to
 * end the friendship, small, at the bottom, but not in one click and of
 * course with a confirmation."*
 */
function FriendBoard({
  friend,
  name,
  busy,
  canInvite,
  onInvite,
  onAct,
  onBack,
}: {
  friend: Friend;
  name: string;
  busy: boolean;
  canInvite: boolean;
  onInvite: ((playerId: string) => void) | null;
  onAct: (action: "ask" | "accept" | "remove", id: string) => void;
  onBack: () => void;
}) {
  const [sure, setSure] = useState(false);
  const arena = arenaFor(friend.trophies);
  const total = collectable().length;

  return (
    <div className="fboard">
      <button className="modal__close" onClick={onBack} title={t("sc5ab4b1", "חזרה")}>
        <Icon name="back" size={15} />
      </button>

      <Face friend={friend} />
      <h2 className="fboard__name">{name}</h2>
      <span className={`fboard__state${friend.online ? " is-on" : ""}`}>
        {friend.state === "asking"
          ? t("scf8308e", "רוצה להיות חבר שלך")
          : friend.state === "asked"
            ? t("se2994f6", "מחכה שיאשר")
            : friend.online
              ? t("s5855269", "מחובר")
              : t("sc89c440", "לא מחובר")}
      </span>

      <div className="fboard__stats">
        <span>
          <Icon name="gem" size={20} />
          <b>{friend.diamonds}</b>
          <small>{t("s93ea90a", "יהלומים")}</small>
        </span>
        <span>
          <Icon name="win" size={20} />
          <b>{say(arena.name)}</b>
          <small>{t("s48d6a95", "ארנה")}</small>
        </span>
        <span>
          <Icon name="deck" size={20} />
          <b>
            {friend.cards}/{total}
          </b>
          <small>{t("s456c1ca", "קלפים")}</small>
        </span>
      </div>

      {friend.state === "asking" ? (
        <button
          className="btn-fight"
          disabled={busy}
          onClick={() => onAct("accept", friend.id)}
        >
          <Icon name="ready" size={16} /> {t("s7e4bcf7", "כן, חברים")}
        </button>
      ) : (
        friend.state === "friend" &&
        onInvite && (
          <button
            className="btn-fight"
            disabled={!friend.online || !canInvite}
            title={canInvite ? undefined : t("s7d7e4b6", "אפשר להזמין ממסך הבית")}
            onClick={() => onInvite(friend.id)}
          >
            <Icon name="play" size={16} /> {t("s9e7bf93", "שחק")}
          </button>
        )
      )}

      {/*
        The quietest thing on the screen, and two taps away even once you
        have found it. "Are you sure" is the whole point — the version this
        replaces removed a friend on one stray press of a 26px cross.
      */}
      {sure ? (
        <div className="fboard__sure">
          <span>{t("sc40cb8d", "בטוח?")}</span>
          <button disabled={busy} onClick={() => onAct("remove", friend.id)}>
            {friend.state === "friend" ? t("seb9ab82", "כן, להפסיק") : t("s4075081", "כן, לבטל")}
          </button>
          <button onClick={() => setSure(false)}>{t("sb44edc2", "לא")}</button>
        </div>
      ) : (
        <button className="fboard__end" onClick={() => setSure(true)}>
          {friend.state === "friend" ? t("s97fbe28", "להפסיק חברות") : t("sd770e7d", "לבטל את הבקשה")}
        </button>
      )}
    </div>
  );
}
