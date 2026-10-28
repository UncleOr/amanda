import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLUB_EMBLEMS,
  CLUB_NAME_MAX,
  DEFAULT_EMBLEM,
  DONATIONS_PER_REQUEST,
  INVITE_SECONDS,
  inviteLive,
} from "@amanda/shared";
import { Icon, type IconName } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t, lineF as tf } from "../game/copy";
import { serverError } from "../game/serverError";
import { collectable } from "../data/catalog";
import { say } from "../game/lang";
import {
  answerAtDoor,
  askForCard,
  bequeathClub,
  claimClubChest,
  closeClub,
  createClub,
  donateCard,
  dressClub,
  inviteToClub,
  joinClub,
  leaveClub,
  loadClub,
  reportClubMember,
  sayInClub,
  type Club as ClubData,
  type ClubAnswer,
  type ClubChallengeView,
} from "../game/club";

const BASE = import.meta.env.BASE_URL;

/**
 * THE SCREEN IS FOR: being in a club with the people you play with.
 *
 * Or set the whole thing out at once, and then set the tone for it:
 * *"you don't need to write all these explanations to the user. The user
 * sees only buttons. He will understand by himself what everything is. Give
 * messages only for critical things."*
 *
 * So there is no copy here that explains anything. Four tabs, each one a
 * noun; a row of members; a line of chat; a card somebody wants. The only
 * sentence in the whole component is the one that has to exist — the warning
 * after a message is refused — and it is his to rewrite.
 *
 * ═══ THE HERO IS THE PEOPLE ═══
 *
 * Not the chat, which is why the member list is what opens. A club with
 * nobody in it is the thing a child needs to fix, and the code to hand
 * somebody is the fix — so the code sits at the top, in the header, at the
 * size of a thing meant to be read out across a room.
 */

/** The four things a club is. Tabs, because they are peers. */
type Tab = "who" | "talk" | "ask" | "goals";

/*
 * Or: *"the chat icon in the club should be a chat."* It was `info`, because
 * there was no chat icon in the set — which is not a reason, it is a
 * shortcut, and an ⓘ above a list of messages tells a child the wrong thing.
 * There is a chat icon now (iconLooks.ts).
 */
const TAB_ICON: Record<Tab, IconName> = {
  who: "friend",
  talk: "chat",
  ask: "deck",
  goals: "challenge",
};

export function Club({ onClose, onBattle }: { onClose: () => void; onBattle?: (id: string) => void }) {
  const [club, setClub] = useState<ClubData | null>(null);
  /** The door you are standing at: not in a club, and not at the two doors. */
  const [waiting, setWaiting] = useState<{ name: string; emblem: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("who");
  const [busy, setBusy] = useState(false);
  /*
   * The one message in the feature. Held apart from everything else because
   * it must survive the view being replaced underneath it — a refused
   * message still returns the whole club, and the warning has to outlive
   * that re-render or nobody reads it.
   */
  const [notice, setNotice] = useState<string | null>(null);

  const take = useCallback((answer: ClubAnswer) => {
    setClub(answer.club);
    setWaiting(answer.waiting ?? null);
    if (answer.notice) {
      /*
       * The words come from serverError.ts, where every other refusal the
       * server sends gets its words — these two were written here as well
       * for about an hour, which put the same sentence into Or's copy
       * document twice under two ids.
       */
      setNotice(serverError(answer.notice));
    }
    return answer;
  }, []);

  useEffect(() => {
    let alive = true;
    void loadClub().then((a) => {
      if (!alive) return;
      setClub(a.club);
      setWaiting(a.waiting ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Every action answers with the whole club, so this is all there is to it. */
  const run = useCallback(
    async (fn: () => Promise<ClubAnswer>) => {
      setBusy(true);
      const answer = await fn();
      setBusy(false);
      take(answer);
    },
    [take],
  );

  if (loading) {
    return (
      <Overlay onClick={onClose}>
        <div className="modal modal--club" onClick={(e) => e.stopPropagation()} />
      </Overlay>
    );
  }

  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--club" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} title={t("s22400ab", "סגירה")}>
          <Icon name="exit" size={16} />
        </button>

        {notice && (
          <div className="club__notice" role="alert">
            {notice}
            <button onClick={() => setNotice(null)}>
              <Icon name="ready" size={14} />
            </button>
          </div>
        )}

        {!club ? (
          waiting ? (
            <Waiting at={waiting} busy={busy} run={run} />
          ) : (
            <Found busy={busy} run={run} />
          )
        ) : (
          <>
            <ClubHead club={club} busy={busy} run={run} />
            <nav className="club__tabs">
              {(["who", "talk", "ask", "goals"] as Tab[]).map((id) => (
                <button
                  key={id}
                  className={`club__tab${tab === id ? " club__tab--on" : ""}`}
                  onClick={() => setTab(id)}
                  aria-label={TAB_WORD[id]()}
                >
                  <Icon name={TAB_ICON[id]} size={17} />
                </button>
              ))}
            </nav>

            {tab === "who" && <Members club={club} busy={busy} run={run} onBattle={onBattle} />}
            {tab === "talk" && <Talk club={club} busy={busy} run={run} />}
            {tab === "ask" && <Requests club={club} busy={busy} run={run} />}
            {tab === "goals" && <Goals club={club} busy={busy} run={run} />}
          </>
        )}
      </div>
    </Overlay>
  );
}

/*
 * The tab names exist for a screen reader and for nothing else: the tabs
 * themselves are icons, as Or asked. A visible label on four buttons in a
 * row this narrow is the clutter he has been taking off these screens.
 */
const TAB_WORD: Record<Tab, () => string> = {
  who: () => t("s792effc", "חברים"),
  talk: () => t("sd3ccb21", "צ'אט"),
  ask: () => t("seeb4d7c", "בקשות"),
  goals: () => t("se1bdd84", "אתגרים"),
};

/* ───────────────────────── no club yet ───────────────────────── */

/**
 * ═══ TWO DOORS, AND YOU ARE THROUGH ONE OF THEM BEFORE YOU TYPE ═══
 *
 * Or: *"if I have no club I need two options: to join an existing club and
 * to found a new one. (Join an existing club + icon) → opens a panel for
 * writing a code. (Found a club + icon) → opens a panel for choosing a name
 * and a picture. After that I am already in the club screen with all the
 * options."*
 *
 * It was two text fields side by side with an icon button each, which asks a
 * child to read two placeholders and work out which of them they are. Now
 * the screen asks ONE question — which door — and each door is a screen with
 * a single job, which is §1: a screen with two heroes has none.
 *
 * Joining is the gold one. Not because it matters more, but because it is
 * the one somebody arrives holding something for: a friend read six digits
 * out across a room. Founding is the other way, and it is plainer.
 */
function Found({
  busy,
  run,
}: {
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  const [door, setDoor] = useState<"join" | "make" | null>(null);
  const [name, setName] = useState("");
  const [emblem, setEmblem] = useState<string>(DEFAULT_EMBLEM);
  const [code, setCode] = useState("");

  if (door === null) {
    return (
      <div className="club__found">
        <button className="club__door btn-fight" onClick={() => setDoor("join")}>
          <Icon name="friend" size={20} />
          {t("se3d7c79", "הצטרפות למועדון")}
        </button>
        <button className="club__door" onClick={() => setDoor("make")}>
          <Icon name="flag" size={20} />
          {t("scf325de", "הקמת מועדון")}
        </button>
      </div>
    );
  }

  return (
    <div className="club__found">
      <button className="club__back" onClick={() => setDoor(null)}>
        <Icon name="back" size={16} />
      </button>

      {door === "join" ? (
        <form
          className="club__row"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 6) void run(() => joinClub(code));
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            placeholder={t("s525cb8b", "קוד מועדון")}
          />
          <button className="btn-fight" disabled={busy || code.length !== 6}>
            <Icon name="ready" size={16} />
          </button>
        </form>
      ) : (
        <form
          className="club__row club__row--wrap"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) void run(() => createClub(name, emblem));
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={CLUB_NAME_MAX}
            autoFocus
            placeholder={t("s7b57db1", "שם המועדון")}
          />
          <button className="btn-fight" disabled={busy || !name.trim()}>
            <Icon name="ready" size={16} />
          </button>
          {/* The picture, chosen the same way the owner changes it later. */}
          <div className="club__emblems">
            {CLUB_EMBLEMS.map((id) => (
              <button
                key={id}
                type="button"
                className={`club__pick${id === emblem ? " club__pick--on" : ""}`}
                onClick={() => setEmblem(id)}
              >
                <Icon name={id as IconName} size={18} />
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * You typed the digits in time, and now somebody has to say yes.
 *
 * No sentence explaining that, because there is nothing a child can do about
 * it: the club's own badge and name, dimmed, and the way back out. The green
 * dot on the owner's home screen is what moves this along.
 */
function Waiting({
  at,
  busy,
  run,
}: {
  at: { name: string; emblem: string };
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  return (
    <div className="club__found club__waiting">
      <span className="club__emblem">
        <Icon name={(at.emblem as IconName) ?? "flag"} size={26} />
      </span>
      <strong>{at.name}</strong>
      <span className="club__knock" aria-hidden="true" />
      <button className="club__back" onClick={() => void run(leaveClub)} disabled={busy}>
        <Icon name="exit" size={16} />
      </button>
    </div>
  );
}

/* ───────────────────────── the header ───────────────────────── */

function ClubHead({
  club,
  busy,
  run,
}: {
  club: ClubData;
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  const [dressing, setDressing] = useState(false);
  const [name, setName] = useState(club.name);
  const mine = [...CLUB_EMBLEMS, ...club.emblems];

  return (
    <header className="club__head">
      <span className="club__emblem">
        <Icon name={(club.emblem as IconName) ?? "flag"} size={26} />
      </span>
      {/*
        The six digits used to live here, permanently. They are gone: a code
        is made on purpose now, lives half a minute, and is shown in the
        member list where the + that made it is. See Invite below.
      */}
      <span className="club__id">
        <strong>{club.name}</strong>
      </span>
      {club.owner && (
        <button className="club__gear" onClick={() => setDressing(!dressing)}>
          <Icon name="gear" size={16} />
        </button>
      )}

      {dressing && club.owner && (
        <div className="club__dress">
          <form
            className="club__row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => dressClub({ name }));
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
            <button disabled={busy}>
              <Icon name="ready" size={15} />
            </button>
          </form>
          <div className="club__emblems">
            {mine.map((id) => (
              <button
                key={id}
                className={`club__pick${id === club.emblem ? " club__pick--on" : ""}`}
                onClick={() => void run(() => dressClub({ emblem: id }))}
                disabled={busy}
              >
                <Icon name={id as IconName} size={18} />
              </button>
            ))}
          </div>
          <button className="club__danger" onClick={() => void run(closeClub)} disabled={busy}>
            <Icon name="erase" size={15} /> {t("s2a64db9", "סגירת המועדון")}
          </button>
        </div>
      )}
    </header>
  );
}

/* ───────────────────────── who is in it ───────────────────────── */

function Members({
  club,
  busy,
  run,
  onBattle,
}: {
  club: ClubData;
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
  onBattle?: (id: string) => void;
}) {
  return (
    <ul className="club__list">
      <li>
        <Invite busy={busy} />
      </li>

      {/*
        Or: *"the manager will also have to approve their entry."* Everybody
        sees the queue — that is how whoever pressed + knows their friend got
        the digits in — and only the owner is given the two answers.
      */}
      {club.waiting.map((m) => (
        <li key={m.id} className="club__member club__member--knock">
          <img src={`${BASE}brand/${m.avatar}.webp`} alt="" />
          <span className="club__who">
            <strong>{m.nickname}</strong>
            <small>
              <Icon name="win" size={11} /> {m.trophies}
            </small>
          </span>
          {club.owner && (
            <>
              <button
                className="club__go"
                onClick={() => void run(() => answerAtDoor(m.id, true))}
                disabled={busy}
                title={t("s7063bf0", "אישור")}
              >
                <Icon name="ready" size={15} />
              </button>
              <button
                className="club__flag"
                onClick={() => void run(() => answerAtDoor(m.id, false))}
                disabled={busy}
                title={t("s7cf1d10", "דחייה")}
              >
                <Icon name="exit" size={13} />
              </button>
            </>
          )}
        </li>
      ))}

      {club.members.map((m) => (
        <li key={m.id} className="club__member">
          <img src={`${BASE}brand/${m.avatar}.webp`} alt="" />
          <span className="club__who">
            <strong>{m.nickname}</strong>
            <small>
              <Icon name="win" size={11} /> {m.trophies}
            </small>
          </span>
          {m.owner && <Icon name="king" size={14} />}
          {m.online && <span className="club__on" aria-hidden="true" />}

          {/*
            Or: "club members can have a battle in one click if both of them
            are connected." One click is the whole requirement, so this is
            one button and it is only there when it would work.
          */}
          {m.online && !m.owner && onBattle && m.id !== club.members.find((x) => x.owner)?.id && (
            <button className="club__go" onClick={() => onBattle(m.id)}>
              <Icon name="play" size={14} />
            </button>
          )}
          {club.owner && !m.owner && (
            <button
              className="club__crown"
              onClick={() => void run(() => bequeathClub(m.id))}
              disabled={busy}
              title={t("s8b3b70f", "העברת הבעלות")}
            >
              <Icon name="king" size={13} />
            </button>
          )}
          {!m.owner && (
            <button
              className="club__flag"
              onClick={() => void run(() => reportClubMember(m.id, "club"))}
              disabled={busy}
              title={t("sc5257ed", "דיווח")}
            >
              <Icon name="report" size={13} />
            </button>
          )}
        </li>
      ))}
      <li className="club__leave">
        <button onClick={() => void run(leaveClub)} disabled={busy}>
          <Icon name="exit" size={14} /> {t("sfc9e23a", "יציאה מהמועדון")}
        </button>
      </li>
    </ul>
  );
}

/**
 * Press +, read six digits out, watch them run out.
 *
 * Or: *"the code should be one-time — generated only on the members screen
 * when you press + … valid for 30 seconds … otherwise a load of bots will get
 * in."*
 *
 * The draining bar is the whole explanation. Nobody is told the code expires;
 * they watch it expiring, which is the empty crown rule — if something needs
 * explaining, the something is wrong.
 */
function Invite({ busy }: { busy: boolean }) {
  const [invite, setInvite] = useState<{ code: string; until: string } | null>(null);
  const [left, setLeft] = useState(0);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!invite) return;
    const tick = () => {
      const ms = new Date(invite.until).getTime() - Date.now();
      setLeft(Math.max(0, ms));
      // The same question the server asks, from the same function, so the
      // number on screen and the number that works stop together.
      if (!inviteLive(invite.until)) setInvite(null);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [invite]);

  if (!invite) {
    return (
      <button
        className="club__add"
        disabled={busy || asking}
        onClick={() => {
          setAsking(true);
          void inviteToClub()
            .then((a) => setInvite(a.invite ?? null))
            .finally(() => setAsking(false));
        }}
      >
        <Icon name="plus" size={18} />
      </button>
    );
  }

  return (
    <div className="club__invite">
      <code className="club__code">{invite.code}</code>
      <span className="club__bar">
        <i style={{ width: `${(left / (INVITE_SECONDS * 1000)) * 100}%` }} />
      </span>
    </div>
  );
}

/* ───────────────────────── the chat ───────────────────────── */

function Talk({
  club,
  busy,
  run,
}: {
  club: ClubData;
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const foot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    foot.current?.scrollIntoView({ block: "end" });
  }, [club.messages.length]);

  return (
    <div className="club__talk">
      <ul className="club__chat">
        {club.messages.map((m) => (
          <li key={m.id}>
            <img src={`${BASE}brand/${m.avatar}.webp`} alt="" />
            <span>
              <strong>{m.nickname}</strong>
              {m.body}
            </span>
          </li>
        ))}
        <div ref={foot} />
      </ul>
      <form
        className="club__row"
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          setText("");
          void run(() => sayInClub(body));
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          placeholder={t("s1a1ea1b", "כתוב משהו")}
        />
        <button disabled={busy || !text.trim()}>
          <Icon name="play" size={15} />
        </button>
      </form>
    </div>
  );
}

/* ───────────────────────── asking for a card ───────────────────────── */

function Requests({
  club,
  busy,
  run,
}: {
  club: ClubData;
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  const [picking, setPicking] = useState(false);
  const mine = club.requests.some((r) => r.mine);

  return (
    <div className="club__asks">
      <ul className="club__list">
        {club.requests.map((r) => {
          const card = collectable().find((c) => c.id === r.cardId);
          return (
            <li key={r.id} className="club__ask">
              <img src={`${BASE}cards/${r.cardId}.webp`} alt="" />
              <span className="club__who">
                <strong>{card ? say(card.name) : r.cardId}</strong>
                <small>
                  {r.nickname} · {r.filled}/{r.of}
                </small>
              </span>
              {!r.mine && !r.gave && (
                <button
                  className="btn-fight club__give"
                  onClick={() => void run(() => donateCard(r.id))}
                  disabled={busy}
                >
                  <Icon name="plus" size={15} />
                </button>
              )}
              {r.gave && <Icon name="ready" size={16} />}
            </li>
          );
        })}
      </ul>

      {!mine && (
        <button className="club__wantbtn" onClick={() => setPicking(!picking)}>
          <Icon name="deck" size={15} /> {t("sabda139", "בקשת קלף")}
        </button>
      )}
      {picking && (
        <div className="club__pickcards">
          {collectable().map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setPicking(false);
                void run(() => askForCard(c.id));
              }}
              disabled={busy}
            >
              <img src={`${BASE}cards/${c.id}.webp`} alt={say(c.name)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── the club's challenges ───────────────────────── */

function Goals({
  club,
  busy,
  run,
}: {
  club: ClubData;
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  return (
    <ul className="club__list">
      {club.challenges.map((c) => (
        <li key={c.id} className="club__goal">
          <Icon name={GOAL_ICON[c.kind]} size={18} />
          <span className="club__who">
            <strong>{GOAL_WORD[c.kind](c.target)}</strong>
            <span className="club__bar">
              <i style={{ width: `${Math.min(100, (c.amount / c.target) * 100)}%` }} />
            </span>
          </span>
          {/*
            The chest is only offered to somebody who pushed. See the note in
            shared/clubs.ts: a club of forty where six played pays six.
          */}
          {c.done && !c.claimed && c.contributed > 0 ? (
            <button
              className="btn-fight"
              onClick={() => void run(() => claimClubChest(c.id))}
              disabled={busy}
            >
              <Icon name="chest" size={16} />
            </button>
          ) : (
            <small className="club__count">
              {c.amount}/{c.target}
            </small>
          )}
        </li>
      ))}
    </ul>
  );
}

type GoalKind = ClubChallengeView["kind"];

const GOAL_ICON: Record<GoalKind, IconName> = {
  wins: "win",
  trophies: "win",
  cards: "deck",
  battles: "monster",
};

/*
 * Four short lines, and they are the only strings in this component that
 * describe anything. Each one is a target and a noun — Or's rule is three
 * words at most on a control, and these are labels on a progress bar.
 */
const GOAL_WORD: Record<GoalKind, (n: number) => string> = {
  wins: (n) => tf("sb733665", "{0} נצחונות", String(n)),
  trophies: (n) => tf("sf7e2ddd", "{0} גביעים", String(n)),
  cards: (n) => tf("s4fe4c14", "{0} קלפים", String(n)),
  battles: (n) => tf("s47fdf22", "{0} קרבות פנימיים", String(n)),
};

void DONATIONS_PER_REQUEST;
