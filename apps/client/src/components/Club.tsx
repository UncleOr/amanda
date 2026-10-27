import { useCallback, useEffect, useRef, useState } from "react";
import { CLUB_EMBLEMS, DONATIONS_PER_REQUEST } from "@amanda/shared";
import { Icon, type IconName } from "./Icon";
import { Overlay } from "./Overlay";
import { line as t, lineF as tf } from "../game/copy";
import { serverError } from "../game/serverError";
import { collectable } from "../data/catalog";
import { say } from "../game/lang";
import {
  askForCard,
  bequeathClub,
  claimClubChest,
  closeClub,
  createClub,
  donateCard,
  dressClub,
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

const TAB_ICON: Record<Tab, IconName> = {
  who: "friend",
  talk: "info",
  ask: "deck",
  goals: "challenge",
};

export function Club({ onClose, onBattle }: { onClose: () => void; onBattle?: (id: string) => void }) {
  const [club, setClub] = useState<ClubData | null>(null);
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
          <Found busy={busy} run={run} />
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

function Found({
  busy,
  run,
}: {
  busy: boolean;
  run: (fn: () => Promise<ClubAnswer>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <div className="club__found">
      <form
        className="club__row"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void run(() => createClub(name));
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          placeholder={t("s7b57db1", "שם המועדון")}
        />
        <button className="btn-fight" disabled={busy || !name.trim()}>
          <Icon name="plus" size={16} />
        </button>
      </form>

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
          placeholder={t("s525cb8b", "קוד מועדון")}
        />
        <button disabled={busy || code.length !== 6}>
          <Icon name="again" size={16} />
        </button>
      </form>
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
      <span className="club__id">
        <strong>{club.name}</strong>
        {/* The thing you read out to somebody standing next to you. */}
        <code className="club__code">{club.code}</code>
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
