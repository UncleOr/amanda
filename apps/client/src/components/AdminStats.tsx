import { useCallback, useEffect, useState } from "react";

/**
 * What is actually happening in the game.
 *
 * Or: *"in the admin panel give me statistics too — how many games each user
 * played, how many wins, losses, app usage, purchases, user behaviour
 * (abandoning mid-game for instance), how many playground games, what users
 * like most. Think of lots of information and statistics I can get."*
 *
 * ═══ THE SCREEN IS FIVE QUESTIONS, NOT A WALL OF NUMBERS ═══
 *
 * A statistics page is easy to fill and hard to read, and one with forty
 * numbers on it is one nobody looks at twice. These are grouped by the
 * question they answer, in the order the questions matter:
 *
 *   WHO IS HERE        how many people, how many came back
 *   WHAT THEY PLAY     matches, wins, bot against people, the playground
 *   WHERE THEY LEAVE   the only group that is a warning rather than a count
 *   WHAT IT EARNS      purchases, chests, whether collecting still works
 *   WHAT THEY LIKE     which cards get played, and which ones win
 *
 * ═══ AND IT SAYS WHEN IT IS EMPTY ═══
 *
 * Every number here comes from the events table, which the game only started
 * writing when this screen was built. A fortnight of zeroes is not a broken
 * screen and is indistinguishable from one, so it says so.
 */

type Call = (path: string, body?: unknown) => Promise<Record<string, unknown>>;

interface Stats {
  windowDays: number;
  people: Record<string, number>;
  play: Record<string, number | Array<{ id: string; n: number }>>;
  behaviour: Record<string, number | Array<{ id: string; n: number }>>;
  economy: Record<string, number | Array<{ id: string; n: number }>>;
  taste: { played: Named[]; winners: Named[] };
  daily: { opens: Day[]; matches: Day[] };
}
interface Named {
  id: string;
  he: string;
  n: number;
}
interface Day {
  day: string;
  n: number;
}

const PHASE_HE: Record<string, string> = {
  intro: "לפני שהתחיל",
  build: "בזמן הבנייה",
  panic: "בפאניקה",
  prebattle: "רגע לפני הקרב",
  countdown: "בספירה",
  battle: "באמצע הקרב",
  waiting: "בהמתנה ליריב",
};
const MODE_HE: Record<string, string> = {
  bot: "מול הבוט",
  online: "מול שחקן",
  playground: "במגרש",
  amanda: "מול אמנדה",
};
const LEVEL_HE: Record<string, string> = { easy: "קליל", normal: "רגיל", hard: "קשה" };

function Num({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="stat">
      <b className="stat__n">{value}</b>
      <span className="stat__label">{label}</span>
      {note && <small className="stat__note">{note}</small>}
    </div>
  );
}

/**
 * Fourteen days as fourteen bars.
 *
 * Drawn here rather than brought in, because a chart library for one shape is
 * three hundred kilobytes to say "this is the tallest day". The point of it
 * is the SHAPE — climbing, flat, or one spike and nothing since — and bars
 * made of divs say that perfectly well.
 */
function Spark({ days, title }: { days: Day[]; title: string }) {
  const most = Math.max(1, ...days.map((d) => d.n));
  return (
    <div className="spark">
      <span className="spark__title">{title}</span>
      <div className="spark__bars">
        {days.map((d) => (
          <i
            key={d.day}
            style={{ height: `${Math.round((d.n / most) * 100)}%` }}
            title={`${d.day}: ${d.n}`}
          />
        ))}
      </div>
      <small className="dim">
        {days[0]?.day.slice(5)} — {days[days.length - 1]?.day.slice(5)} · הכי הרבה ביום: {most}
      </small>
    </div>
  );
}

function Tally({ rows, he }: { rows: Array<{ id: string; n: number }>; he?: Record<string, string> }) {
  if (!rows.length) return <p className="dim">—</p>;
  const most = Math.max(...rows.map((r) => r.n));
  return (
    <ul className="tally">
      {rows.map((r) => (
        <li key={r.id}>
          <span className="tally__bar" style={{ width: `${(r.n / most) * 100}%` }} />
          <span className="tally__name">{he?.[r.id] ?? r.id}</span>
          <b>{r.n}</b>
        </li>
      ))}
    </ul>
  );
}

export function StatsTab({ call }: { call: Call }) {
  const [s, setS] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/stats");
    if (r.error || !r.people) {
      setFailed(true);
      return;
    }
    setS(r as unknown as Stats);
  }, [call]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (failed) return <p className="gifts__hint">לא הצלחתי להביא נתונים מהשרת.</p>;
  if (!s) return <p className="gifts__hint">רגע…</p>;

  const n = (group: Record<string, unknown>, key: string) => Number(group[key] ?? 0);
  const list = (group: Record<string, unknown>, key: string) =>
    (group[key] as Array<{ id: string; n: number }>) ?? [];

  const nothingYet = n(s.play, "matches") === 0 && n(s.behaviour, "opens") === 0;

  return (
    <div className="stats">
      {nothingYet && (
        <p className="gifts__hint">
          עוד לא נרשם כלום. המשחק התחיל לספור רק מהרגע שהמסך הזה נבנה — מה שקרה לפני זה לא
          נשמר בשום מקום. תן לזה יום-יומיים של משחק.
        </p>
      )}

      <section className="stats__group">
        <h2>מי נמצא כאן</h2>
        <div className="stats__row">
          <Num label="שחקנים רשומים" value={n(s.people, "total")} />
          <Num label="נרשמו השבוע" value={n(s.people, "newThisWeek")} />
          <Num label="שיחקו היום" value={n(s.people, "activeToday")} />
          <Num label="שיחקו השבוע" value={n(s.people, "activeThisWeek")} />
          <Num
            label="סיימו את ההדרכה"
            value={n(s.people, "finishedTutorial")}
            note={`מתוך ${n(s.people, "total")}`}
          />
          <Num label="בחרו כינוי" value={n(s.people, "withNickname")} />
        </div>
      </section>

      <section className="stats__group">
        <h2>מה משחקים</h2>
        <div className="stats__row">
          <Num label="משחקים" value={n(s.play, "matches")} note={`ב-${s.windowDays} ימים`} />
          <Num label="ניצחונות" value={n(s.play, "wins")} />
          <Num label="הפסדים" value={n(s.play, "losses")} />
          <Num label="אחוז ניצחון" value={`${n(s.play, "winRate")}%`} />
          <Num label="מול הבוט" value={n(s.play, "vsBot")} />
          <Num label="מול שחקנים" value={n(s.play, "vsPeople")} />
          <Num label="במגרש המשחקים" value={n(s.play, "playground")} />
          <Num label="ציון ממוצע" value={n(s.play, "meanScore")} note="מתוך 10" />
        </div>
        <h3>איזו רמת בוט בוחרים</h3>
        <Tally rows={list(s.play, "byLevel")} he={LEVEL_HE} />
      </section>

      {/*
        The group that is a warning rather than a count. "A quarter of matches
        are abandoned" is the kind of thing a game can be losing players to
        for a month without anybody noticing — and the phase breakdown says
        WHERE, which is the half that can be acted on.
      */}
      <section className="stats__group">
        <h2>איפה עוזבים</h2>
        <div className="stats__row">
          <Num label="פתיחות של המשחק" value={n(s.behaviour, "opens")} />
          <Num label="מתוכן כאפליקציה" value={n(s.behaviour, "installed")} />
          <Num label="נטישות באמצע" value={n(s.behaviour, "quits")} />
          <Num
            label="אחוז נטישה"
            value={`${n(s.behaviour, "quitRate")}%`}
            note="מתוך כל המשחקים שהתחילו"
          />
        </div>
        <h3>באיזה שלב עוזבים</h3>
        <Tally rows={list(s.behaviour, "quitPhase")} he={PHASE_HE} />
        <h3>מאיזה מצב משחק</h3>
        <Tally rows={list(s.behaviour, "quitMode")} he={MODE_HE} />
      </section>

      <section className="stats__group">
        <h2>הכלכלה</h2>
        <div className="stats__row">
          <Num label="רכישות" value={n(s.economy, "purchases")} />
          <Num label="יהלומים שהוצאו" value={n(s.economy, "diamondsSpent")} />
          <Num label="יהלומים ביד של כולם" value={n(s.economy, "diamondsHeld")} />
          <Num label="תיבות שנפתחו" value={n(s.economy, "chestsOpened")} />
          <Num label="קלפים מתיבות" value={n(s.economy, "cardsFromChests")} />
          {/*
            The one number that says whether collecting still feels like
            collecting. As it falls towards zero a chest becomes a handful of
            duplicates, and the whole loop quietly stops working.
          */}
          <Num
            label="מתוכם קלפים חדשים"
            value={n(s.economy, "newCardsFromChests")}
            note="כשזה מתקרב לאפס, תיבה היא כפילויות"
          />
          <Num label="אתגרים שנגבו" value={n(s.economy, "claims")} />
        </div>
        <h3>מה הכי נמכר</h3>
        <Tally rows={list(s.economy, "bestSellers")} />
      </section>

      {/*
        Two lists on purpose, and the gap between them is the point: a card
        everybody plays and nobody wins with is a card that LOOKS good, which
        is a balance problem no single list can show.
      */}
      <section className="stats__group">
        <h2>מה אוהבים</h2>
        <h3>הקלפים שהכי מניחים על הלוח</h3>
        <Tally rows={s.taste.played.map((c) => ({ id: c.he, n: c.n }))} />
        <h3>הקלפים שהכי מנצחים איתם</h3>
        <Tally rows={s.taste.winners.map((c) => ({ id: c.he, n: c.n }))} />
      </section>

      <section className="stats__group">
        <h2>שבועיים אחורה</h2>
        <div className="stats__row stats__row--sparks">
          <Spark days={s.daily.opens} title="פתיחות" />
          <Spark days={s.daily.matches} title="משחקים" />
        </div>
      </section>
    </div>
  );
}

/* ════════════════ one person ════════════════ */

interface PlayerStats {
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  vsBot: number;
  vsPeople: number;
  playground: number;
  opens: number;
  quits: number;
  quitPhase: Array<{ id: string; n: number }>;
  chests: number;
  purchases: number;
  diamondsSpent: number;
  claims: number;
  cardsHeld: number;
  favourites: Named[];
  recent: Array<{ kind: string; at: string; data: Record<string, unknown> }>;
}

const KIND_HE: Record<string, string> = {
  open: "פתח את המשחק",
  match: "סיים משחק",
  quit: "עזב באמצע",
  playground: "שיחק במגרש",
  buy: "קנה",
  chest: "פתח תיבה",
  claim: "לקח פרס על אתגר",
};

/**
 * Everything about one player, opened from the users tab.
 *
 * Or asked for this per user as well as overall — *"how many games each user
 * played, how many wins, losses"* — and they are genuinely different screens:
 * the overview answers "is the game working", this answers "what is this
 * child doing", which is the question he will actually have about Hod.
 */
export function PlayerStats({
  call,
  userId,
  name,
  onClose,
}: {
  call: Call;
  userId: string;
  name: string;
  onClose: () => void;
}) {
  const [s, setS] = useState<PlayerStats | null>(null);
  useEffect(() => {
    void call("/api/admin/stats/player", { userId }).then((r) => setS(r as unknown as PlayerStats));
  }, [call, userId]);

  return (
    <div className="stats stats--one">
      <div className="stats__head">
        <h2>{name}</h2>
        <button className="btn-link" onClick={onClose}>
          ← חזרה לרשימה
        </button>
      </div>
      {!s ? (
        <p className="gifts__hint">רגע…</p>
      ) : (
        <>
          <div className="stats__row">
            <Num label="משחקים" value={s.matches} />
            <Num label="ניצחונות" value={s.wins} />
            <Num label="הפסדים" value={s.losses} />
            <Num label="אחוז ניצחון" value={`${s.winRate}%`} />
            <Num label="מול הבוט" value={s.vsBot} />
            <Num label="מול שחקנים" value={s.vsPeople} />
            <Num label="במגרש" value={s.playground} />
            <Num label="פתח את המשחק" value={s.opens} />
            <Num label="עזב באמצע" value={s.quits} />
            <Num label="תיבות" value={s.chests} />
            <Num label="רכישות" value={s.purchases} />
            <Num label="יהלומים שהוציא" value={s.diamondsSpent} />
            <Num label="אתגרים שגבה" value={s.claims} />
            <Num label="קלפים באלבום" value={s.cardsHeld} />
          </div>

          {s.quitPhase.length > 0 && (
            <>
              <h3>באיזה שלב הוא עוזב</h3>
              <Tally rows={s.quitPhase} he={PHASE_HE} />
            </>
          )}

          <h3>הקלפים שהוא הכי מניח</h3>
          <Tally rows={s.favourites.map((c) => ({ id: c.he, n: c.n }))} />

          {/* The one view here that is a story rather than a number.
              "Played three, quit, left" is a sentence no aggregate says. */}
          <h3>מה הוא עשה לאחרונה</h3>
          <ul className="stats__recent">
            {s.recent.map((e, i) => (
              <li key={i}>
                <span className="dim">{new Date(e.at).toLocaleString("he-IL")}</span>{" "}
                {KIND_HE[e.kind] ?? e.kind}
                {e.kind === "match" && (
                  <b> — {e.data.won === true ? "ניצח" : "הפסיד"} ({String(e.data.score ?? "?")}/10)</b>
                )}
                {e.kind === "quit" && <b> — {PHASE_HE[String(e.data.phase)] ?? String(e.data.phase)}</b>}
                {e.kind === "buy" && <b> — {String(e.data.item)}</b>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
