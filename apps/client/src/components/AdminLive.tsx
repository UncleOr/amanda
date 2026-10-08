import { useCallback, useEffect, useState } from "react";

/**
 * Is the game all right, right now?
 *
 * ═══ WHY THIS SCREEN EXISTS AT ALL ═══
 *
 * Or: *"zero thinking ahead from you about what should be in an interface
 * that has to run a fucking online game."*
 *
 * He is right. I built the admin panel exactly as he named it — shop, then
 * cards, then phrases, then statistics — one item at a time, and never once
 * asked what RUNNING a live game for children actually requires. It requires
 * being able to answer six questions in the ten seconds before you decide
 * whether to panic:
 *
 *   Is anybody playing?          sockets, players, matches
 *   Is matchmaking working?      how many are waiting, and how long
 *   Can it save?                 the database, actually written to
 *   Is it serving the right      the content overrides this process has
 *     content?                     applied, and when it last read them
 *   Did anything break?          crashes, from real phones, with the error
 *   Who changed what?            every action taken from this panel
 *
 * Every one of those was already known by the server or sitting in a table.
 * None of it was on a screen. The first sign of broken matchmaking would
 * have been a child saying "it's stuck".
 *
 * ═══ AND IT IS THE FIRST SCREEN BUILT ON THE DESIGN SYSTEM ═══
 *
 * Or, about the game generally: *"all our screens don't look good… there's
 * no hierarchy."* So this one is laid out by the rules in
 * .claude/skills/amanda-ui/SKILL.md rather than by eye:
 *
 *   THE HERO is the verdict — one line, the largest thing here, saying
 *     whether anything is wrong. Everything else is evidence for it.
 *   THE PATH is the four live counts and the two lists.
 *   THE MARGIN is uptime and timestamps.
 *
 * Nothing on it explains it. The numbers are labelled and that is all.
 */

type Call = (path: string, body?: unknown) => Promise<Record<string, unknown>>;

interface Live {
  now: { sockets: number; online: number; queue: number; rooms: number; matches: number };
  upSince: string;
  content: { phrases: number; series: number; tunables: number; lastError: string | null; loadedAt: string | null };
  cards: { applied: number; hidden: number; lastError: string | null; loadedAt: string | null };
  crashes: Array<{ player_id: string | null; at: string; data: Record<string, unknown> }>;
  actions: Array<{ player_id: string | null; at: string; data: Record<string, unknown> }>;
}

/** How long since, in the roundest words that are still true. */
function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return `לפני ${s} שניות`;
  const m = Math.round(s / 60);
  if (m < 60) return `לפני ${m} דקות`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שעות`;
  return `לפני ${Math.round(h / 24)} ימים`;
}

function upFor(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 90) return `${s} שניות`;
  const m = Math.floor(s / 60);
  if (m < 90) return `${m} דקות`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} שעות`;
  return `${Math.floor(h / 24)} ימים`;
}

export function LiveTab({ call }: { call: Call }) {
  const [live, setLive] = useState<Live | null>(null);
  const [health, setHealth] = useState<{ canSave?: boolean; db?: string | null } | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/live");
    if (r.error || !r.now) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setLive(r as unknown as Live);
  }, [call]);

  useEffect(() => {
    void refresh();
    /*
     * Ten seconds. This is the one screen in the whole app that is about
     * NOW, and a "now" you have to reload by hand is a yesterday.
     */
    const t = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(t);
  }, [refresh]);

  // The health check is a separate, public endpoint and deliberately stays
  // one: it is the thing you want to be able to hit when nothing else works.
  useEffect(() => {
    const url = (import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : ""))
      .replace(/^ws:/, "http:")
      .replace(/^wss:/, "https:");
    if (!url) return;
    const read = () =>
      void fetch(`${url}/api/health`)
        .then((r) => r.json())
        .then((h) => setHealth(h as { canSave?: boolean; db?: string | null }))
        .catch(() => setHealth(null));
    read();
    const t = window.setInterval(read, 10_000);
    return () => window.clearInterval(t);
  }, []);

  if (failed) return <p className="live__verdict live__verdict--bad">השרת לא עונה.</p>;
  if (!live) return <p className="live__quiet">רגע…</p>;

  /*
   * ═══ THE HERO: ONE LINE, AND IT IS A VERDICT ═══
   *
   * The whole point of this screen is to be read in two seconds from a
   * phone. A grid of numbers makes somebody do the judging; the numbers are
   * the evidence and the judgement goes at the top, big.
   */
  const problems: string[] = [];
  if (health && health.canSave === false) problems.push("אי אפשר לשמור לדאטהבייס");
  if (live.content.lastError) problems.push("התוכן לא נטען");
  if (live.cards.lastError) problems.push("הקלפים לא נטענו");
  if (live.now.queue >= 4) problems.push(`${live.now.queue} ממתינים בתור`);
  const fresh = live.crashes.filter((c) => Date.now() - Date.parse(c.at) < 3_600_000).length;
  if (fresh > 0) problems.push(`${fresh} קריסות בשעה האחרונה`);

  const ok = problems.length === 0;

  return (
    <div className="live">
      <p className={`live__verdict${ok ? "" : " live__verdict--bad"}`}>
        {ok ? "הכל תקין" : problems.join(" · ")}
      </p>

      <div className="live__counts">
        <Count n={live.now.online} label="מחוברים" lit={live.now.online > 0} />
        <Count n={live.now.matches} label="משחקים עכשיו" lit={live.now.matches > 0} />
        <Count n={live.now.queue} label="בתור" />
        <Count n={live.now.rooms} label="חדרים פתוחים" />
        <Count n={live.now.sockets} label="חיבורים" />
      </div>

      <div className="live__pair">
        <section className="live__box">
          <h2>מה שהשרת מגיש</h2>
          <dl className="live__facts">
            <Fact k="שומר לדאטהבייס" v={health ? (health.canSave ? "כן" : "לא") : "—"} bad={health?.canSave === false} />
            <Fact k="קלפים ששונו" v={String(live.cards.applied)} />
            <Fact k="משפטים ששונו" v={String(live.content.phrases)} />
            <Fact k="מספרים ששונו" v={String(live.content.tunables)} />
            <Fact k="נקרא לאחרונה" v={live.content.loadedAt ? ago(live.content.loadedAt) : "—"} />
            <Fact k="השרת למעלה" v={upFor(live.upSince)} />
          </dl>
        </section>

        {/*
          Crashes, with the error in them.

          This list is the reason the error boundary now reports: the same
          crash has been described to me twice as "it did the thing again",
          because the message went to a console on a phone.
        */}
        <section className="live__box">
          <h2>קריסות אצל שחקנים</h2>
          {live.crashes.length === 0 ? (
            <p className="live__quiet">אין. טוב.</p>
          ) : (
            <ul className="live__list">
              {live.crashes.slice(0, 8).map((c, i) => (
                <li key={i}>
                  <span className="live__when">{ago(c.at)}</span>
                  <code>{String(c.data.message ?? "").slice(0, 120)}</code>
                  <span className="live__where">{String(c.data.screen ?? "")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="live__box">
        <h2>מה שונה מכאן</h2>
        {live.actions.length === 0 ? (
          <p className="live__quiet">כלום עדיין.</p>
        ) : (
          <ul className="live__list live__list--actions">
            {live.actions.slice(0, 10).map((a, i) => (
              <li key={i}>
                <span className="live__when">{ago(a.at)}</span>
                <code>{String(a.data.action ?? "")}</code>
                {a.data.target ? <span className="live__where">{String(a.data.target)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Count({ n, label, lit = false }: { n: number; label: string; lit?: boolean }) {
  return (
    <div className={`live__count${lit ? " is-lit" : ""}`}>
      <b>{n}</b>
      <span>{label}</span>
    </div>
  );
}

function Fact({ k, v, bad = false }: { k: string; v: string; bad?: boolean }) {
  return (
    <>
      <dt>{k}</dt>
      <dd className={bad ? "is-bad" : undefined}>{v}</dd>
    </>
  );
}
