import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { ARENAS } from "@amanda/shared";
import { GiftsTab } from "./AdminGifts";
import { ShopTab } from "./AdminShop";
import { DialsTab, PhrasesTab, SeriesTab } from "./AdminContent";
import { PlayerStats, StatsTab } from "./AdminStats";
import { CardEditor } from "./CardEditor";
// The panel's own sheet, loaded with the panel. It used to be in the entry
// file, so every child downloaded the admin styles to play a card game.
import "../admin.css";
import { Overlay } from "./Overlay";

/**
 * The admin panel. Opened with ?admin.
 *
 * Or asked for "an admin interface where I can update things normally instead
 * of in a file", and for the user controls a tester needs: delete, reset
 * password, and put a player back to their first minute.
 *
 * Nothing here is trusted. The browser only ever holds the player's own access
 * token; the service key that can actually do these things lives on the server
 * and nowhere else. The server checks the `admins` table on every single
 * request, so hiding or showing this screen is a convenience, not a lock —
 * someone who types ?admin without being an admin gets a screen that cannot do
 * anything at all.
 */

const URL = import.meta.env.VITE_SUPABASE_URL ?? "https://iiviygfltyrsonioyqxm.supabase.co";
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? "sb_publishable_j1lvAt_idYWAzD0WCEJ4ig_PR0egOzG";
const SERVER = (import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "ws://localhost:2567" : ""))
  .replace(/^ws:/, "http:")
  .replace(/^wss:/, "https:");

const sb = createClient(URL, KEY, { auth: { persistSession: true } });

interface AdminUser {
  id: string;
  email: string | null;
  providers: string[];
  createdAt: string;
  lastSeen: string | null;
  nickname: string | null;
  trophies: number;
  diamonds: number;
  tutorialDone: boolean;
  cards: number;
  isAdmin: boolean;
  isYou: boolean;
  suspendedUntil: string | null;
  gender: "boy" | "girl" | null;
}

interface CopyEntry {
  id: string;
  section: string;
  text: string;
  where: { kind: "json" | "source"; file: string; path?: (string | number)[]; line?: number };
}

/**
 * One call to the admin API.
 *
 * Never throws. An unreachable server used to leave the panel on "רגע…"
 * forever, because the rejection escaped and the state was never set — which
 * is exactly what happens on a laptop with the match server not running.
 */
async function call(path: string, body: unknown = {}): Promise<Record<string, unknown>> {
  if (!SERVER) return { error: "אין כתובת שרת בגרסה הזאת" };
  try {
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { error: "not signed in" };
    const res = await fetch(`${SERVER}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: "השרת לא עונה" };
  }
}

export function Admin() {
  const [state, setState] = useState<"checking" | "out" | "denied" | "in" | "down">("checking");
  const [why, setWhy] = useState<string>("");
  const [tab, setTab] = useState<
    | "cards"
    | "copy"
    | "users"
    | "reports"
    | "shop"
    | "gifts"
    | "phrases"
    | "series"
    | "dials"
    | "stats"
  >(
    "cards",
  );
  const [note, setNote] = useState<string | null>(null);

  const check = useCallback(async () => {
    const { data } = await sb.auth.getSession();
    /*
     * An anonymous session counts as no session here. Every player has one
     * from their first visit, so treating it as "signed in" sent Or straight
     * to "you are not an admin" with no way to become one.
     */
    if (!data.session || data.session.user.is_anonymous) return setState("out");
    const r = await call("/api/admin/whoami");
    if (r.ok) return setState("in");
    // "Not an admin" and "the server is unreachable" need different screens.
    const err = String(r.error ?? "");
    if (err.includes("שרת") || err.includes("database")) {
      setWhy(err);
      return setState("down");
    }
    setState("denied");
  }, []);

  useEffect(() => {
    void check();
    const { data } = sb.auth.onAuthStateChange(() => void check());
    return () => data.subscription.unsubscribe();
  }, [check]);

  if (state === "checking") return <div className="admin admin--msg">רגע…</div>;

  if (state === "out")
    return (
      <div className="admin admin--msg">
        <h1>ניהול</h1>
        <p>צריך להתחבר קודם.</p>
        <button
          className="btn-fight"
          onClick={() =>
            // Sign OUT of the anonymous session first: otherwise Supabase is
            // being asked to attach Google to a throwaway account rather than
            // to sign in as the real one.
            void sb.auth.signOut().then(() =>
              sb.auth.signInWithOAuth({
                provider: "google",
                options: { redirectTo: window.location.href },
              }),
            )
          }
        >
          התחברות עם גוגל
        </button>
      </div>
    );

  if (state === "down")
    return (
      <div className="admin admin--msg">
        <h1>ניהול</h1>
        <p>{why || "השרת לא עונה"}.</p>
        <p className="admin__hint">
          הניהול עובד מול שרת המשחק. בפיתוח צריך להריץ אותו (<code>pnpm dev</code>),
          ובענן הוא צריך את <code>SUPABASE_SERVICE_KEY</code>.
        </p>
        <button className="btn-fight" onClick={() => void check()}>
          נסה שוב
        </button>
      </div>
    );

  if (state === "denied")
    return (
      <div className="admin admin--msg">
        <h1>ניהול</h1>
        <p>החשבון הזה הוא לא מנהל.</p>
        <button className="btn-link" onClick={() => void sb.auth.signOut()}>
          התנתקות
        </button>
      </div>
    );

  return (
    <div className="admin">
      <header className="admin__bar">
        <h1>ניהול אמנדה</h1>
        <nav>
          {/* First, because it is the only tab that answers a question rather
              than changing something. */}
          <button className={tab === "stats" ? "on" : ""} onClick={() => setTab("stats")}>
            נתונים
          </button>
          <button className={tab === "cards" ? "on" : ""} onClick={() => setTab("cards")}>
            קלפים
          </button>
          <button className={tab === "copy" ? "on" : ""} onClick={() => setTab("copy")}>
            טקסטים
          </button>
          <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>
            משתמשים
          </button>
          <button className={tab === "reports" ? "on" : ""} onClick={() => setTab("reports")}>
            דיווחים
          </button>
          <button className={tab === "shop" ? "on" : ""} onClick={() => setTab("shop")}>
            חנות
          </button>
          <button className={tab === "gifts" ? "on" : ""} onClick={() => setTab("gifts")}>
            מתנות
          </button>
          <button className={tab === "phrases" ? "on" : ""} onClick={() => setTab("phrases")}>
            משפטים
          </button>
          <button className={tab === "series" ? "on" : ""} onClick={() => setTab("series")}>
            סדרות
          </button>
          <button className={tab === "dials" ? "on" : ""} onClick={() => setTab("dials")}>
            מספרים
          </button>
        </nav>
        <a className="btn-link" href={window.location.pathname}>
          ← למשחק
        </a>
      </header>
      {note && (
        <p className="admin__note" onClick={() => setNote(null)}>
          {note}
        </p>
      )}
      {tab === "stats" ? (
        <StatsTab call={call} />
      ) : tab === "cards" ? (
        <CardEditor call={call} say={setNote} />
      ) : tab === "copy" ? (
        <CopyTab say={setNote} />
      ) : tab === "reports" ? (
        <ReportsTab call={call} say={setNote} />
      ) : tab === "shop" ? (
        <ShopTab call={call} say={setNote} />
      ) : tab === "gifts" ? (
        <GiftsTab call={call} say={setNote} />
      ) : tab === "phrases" ? (
        <PhrasesTab call={call} say={setNote} />
      ) : tab === "series" ? (
        <SeriesTab call={call} say={setNote} />
      ) : tab === "dials" ? (
        <DialsTab call={call} say={setNote} />
      ) : (
        <UsersTab say={setNote} />
      )}
    </div>
  );
}

/* ──────────────────────────── texts ──────────────────────────── */

function CopyTab({ say }: { say: (s: string) => void }) {
  const [map, setMap] = useState<CopyEntry[] | null>(null);
  const [saved, setSaved] = useState<Record<string, string[]>>({});
  /** What is in the boxes right now, per id: the full list of versions. */
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [section, setSection] = useState<string>("");
  const [query, setQuery] = useState("");
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const mod = (await import("../../../../docs/copy.map.json")).default as CopyEntry[];
      setMap(mod);
      try {
        const res = await fetch(`${SERVER}/api/copy`);
        const body = (await res.json()) as { copy?: Record<string, string[]> };
        setSaved(body.copy ?? {});
      } catch {
        /* no server: the list still shows what the game ships with */
      }
    })();
  }, []);

  const sections = useMemo(
    () => [...new Set((map ?? []).map((e) => e.section))],
    [map],
  );

  const rows = useMemo(() => {
    if (!map) return [];
    const needle = query.trim();
    return map.filter((e) => {
      if (section && e.section !== section) return false;
      if (onlyChanged && !saved[e.id] && !draft[e.id]) return false;
      if (!needle) return true;
      return e.text.includes(needle) || e.id === needle || (saved[e.id] ?? []).some((t) => t.includes(needle));
    });
  }, [map, section, query, onlyChanged, saved, draft]);

  /** The versions currently in the boxes for one id. */
  const valueOf = (e: CopyEntry): string[] => draft[e.id] ?? saved[e.id] ?? [e.text];

  const edit = (id: string, index: number, text: string) =>
    setDraft((d) => {
      const cur = [...(d[id] ?? saved[id] ?? [])];
      while (cur.length <= index) cur.push("");
      cur[index] = text;
      return { ...d, [id]: cur };
    });

  const save = async () => {
    const ids = Object.keys(draft);
    if (!ids.length) return say("אין מה לשמור.");
    setBusy(true);
    // Everything for a changed id goes up together, including the blanks,
    // because a blank is how a version is removed.
    const rowsOut: { id: string; variant: number; text: string }[] = [];
    for (const id of ids) {
      const versions = draft[id]!;
      const before = Math.max(versions.length, (saved[id] ?? []).length);
      for (let v = 0; v < before; v++) rowsOut.push({ id, variant: v, text: versions[v] ?? "" });
    }
    const r = await call("/api/admin/copy", { rows: rowsOut });
    setBusy(false);
    if (r.error) return say(`לא נשמר: ${String(r.error)}`);
    setSaved((s) => {
      const next = { ...s };
      for (const id of ids) {
        const kept = draft[id]!.map((t) => t.trim()).filter(Boolean);
        if (kept.length) next[id] = kept;
        else delete next[id];
      }
      return next;
    });
    setDraft({});
    say(`נשמרו ${r.saved ?? 0} טקסטים. טקסטי קלפים כבר חיים; טקסטי מסך ייכנסו בדפלוי הבא.`);
  };

  if (!map) return <div className="admin__body">טוען…</div>;

  return (
    <div className="admin__body">
      <div className="admin__tools">
        <select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">כל הקטגוריות ({map.length})</option>
          {sections.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש טקסט…" />
        <label>
          <input
            type="checkbox"
            checked={onlyChanged}
            onChange={(e) => setOnlyChanged(e.target.checked)}
          />{" "}
          רק מה ששיניתי
        </label>
        <button className="btn-fight" disabled={busy || !Object.keys(draft).length} onClick={() => void save()}>
          {busy ? "שומר…" : `שמירה (${Object.keys(draft).length})`}
        </button>
      </div>

      <p className="admin__hint">
        טקסט של קלף נכנס למשחק מיד. טקסט של מסך נשמר כאן ונכנס בדפלוי הבא — כתוב
        ליד כל שורה. אפשר להוסיף כמה גרסאות לאותו משפט, והמשחק יבחר אחת כל פעם.
      </p>

      <table className="admin__table">
        <thead>
          <tr>
            <th>מזהה</th>
            <th>מה כתוב היום</th>
            <th>מה יהיה כתוב</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 300).map((e) => {
            const versions = valueOf(e);
            const live = e.where.kind === "json";
            const changed = !!draft[e.id];
            return (
              <tr key={e.id} className={changed ? "admin__row--dirty" : ""}>
                <td className="admin__id">
                  <code>{e.id}</code>
                  <span className={`admin__where admin__where--${live ? "live" : "deploy"}`}>
                    {live ? "חי" : "דפלוי"}
                  </span>
                </td>
                <td className="admin__was">{e.text}</td>
                <td>
                  {versions.map((v, i) => (
                    <textarea
                      key={i}
                      className="admin__input"
                      rows={Math.min(4, Math.ceil((v.length || 1) / 52))}
                      value={v}
                      onChange={(ev) => edit(e.id, i, ev.target.value)}
                    />
                  ))}
                  <button
                    className="admin__add"
                    onClick={() => edit(e.id, versions.length, "")}
                    title="עוד גרסה למשפט הזה — המשחק יבחר אחת כל פעם"
                  >
                    + עוד גרסה
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > 300 && (
        <p className="admin__hint">מוצגות 300 שורות ראשונות מתוך {rows.length}. צמצם בחיפוש.</p>
      )}
    </div>
  );
}

/* ──────────────────────────── reports ──────────────────────────── */

interface ReportRow {
  id: string;
  kind: "bug" | "player";
  reporter_id: string;
  reported_id: string | null;
  message: string;
  created_at: string;
  status: "open" | "done";
  reporterName: string | null;
  reportedName: string | null;
  reportedSuspendedUntil: string | null;
}

/**
 * The inbox.
 *
 * Suspending is right here, on the report, because the alternative is reading
 * a complaint in one tab and hunting for the name in another — which is how
 * a report goes unanswered. Marking it handled and suspending are SEPARATE
 * buttons on purpose: most reports do not deserve a suspension, and a single
 * "deal with it" button would quietly make them all deserve one.
 */
function ReportsTab({
  call,
  say,
}: {
  call: (path: string, body?: unknown) => Promise<Record<string, unknown>>;
  say: (s: string) => void;
}) {
  const [status, setStatus] = useState<"open" | "done" | "all">("open");
  const [rows, setRows] = useState<ReportRow[] | null>(null);

  const load = useCallback(
    async (which: "open" | "done" | "all") => {
      const r = await call("/api/admin/reports", { status: which });
      if (r.error) return say(String(r.error));
      setRows((r.reports as ReportRow[]) ?? []);
    },
    [call, say],
  );

  useEffect(() => {
    void load(status);
  }, [load, status]);

  const act = async (path: string, body: unknown, done: string) => {
    const r = await call(path, body);
    if (r.error) return say(String(r.error));
    say(done);
    void load(status);
  };

  if (!rows) return <div className="admin__body">טוען…</div>;

  return (
    <div className="admin__body">
      <div className="admin__tools">
        {(["open", "done", "all"] as const).map((k) => (
          <button
            key={k}
            className={`rack__tab${status === k ? " rack__tab--on" : ""}`}
            onClick={() => setStatus(k)}
          >
            {k === "open" ? "פתוחים" : k === "done" ? "טופלו" : "הכול"}
          </button>
        ))}
      </div>

      {rows.length === 0 && <p className="admin__hint">אין כאן כלום. זה טוב.</p>}

      <div className="rep__list">
        {rows.map((r) => (
          <div key={r.id} className={`rep rep--${r.kind}`}>
            <div className="rep__head">
              <span className={`admin__where admin__where--${r.kind === "bug" ? "deploy" : "banned"}`}>
                {r.kind === "bug" ? "באג" : "שחקן"}
              </span>
              <b>{r.reporterName ?? "בלי שם"}</b>
              {r.reported_id && (
                <>
                  <span className="rep__arrow">←</span>
                  <b>{r.reportedName ?? "בלי שם"}</b>
                </>
              )}
              <small>{new Date(r.created_at).toLocaleString("he-IL")}</small>
              {r.reportedSuspendedUntil && (
                <span className="admin__where admin__where--banned">
                  מושעה עד {new Date(r.reportedSuspendedUntil).toLocaleDateString("he-IL")}
                </span>
              )}
            </div>
            <p className="rep__msg">{r.message || "— בלי טקסט —"}</p>
            <div className="admin__actions">
              {r.status === "open" && (
                <button onClick={() => void act("/api/admin/report/handle", { id: r.id }, "סומן כטופל")}>
                  סמן כטופל
                </button>
              )}
              {r.reported_id &&
                [
                  { label: "השעה ליום", hours: 24 },
                  { label: "לשבוע", hours: 24 * 7 },
                  { label: "לתמיד", hours: undefined },
                ].map((o) => (
                  <button
                    key={o.label}
                    className="admin__danger"
                    onClick={() =>
                      void act(
                        "/api/admin/user/suspend",
                        {
                          userId: r.reported_id,
                          reason: r.message.slice(0, 200),
                          ...(o.hours !== undefined ? { hours: o.hours } : {}),
                        },
                        "הושעה.",
                      )
                    }
                  >
                    {o.label}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────── users ──────────────────────────── */

/**
 * Put an account somewhere, for testing.
 *
 * Arenas ARE trophies — the ladder is a trophy range — so the arena buttons
 * simply set the trophies that arena begins at. That is deliberately the only
 * way to do it: an "arena" field that could disagree with the trophy count
 * would be a second source of truth about the same fact.
 */
function GrantPanel({
  user,
  onClose,
  onDone,
}: {
  user: AdminUser;
  onClose: () => void;
  onDone: (body: {
    trophies?: number;
    diamonds?: number;
    gender?: "boy" | "girl" | null;
  }) => void;
}) {
  const [trophies, setTrophies] = useState(String(user.trophies));
  const [diamonds, setDiamonds] = useState(String(user.diamonds));
  const [gender, setGender] = useState<"boy" | "girl" | null>(user.gender);
  return (
    <Overlay onClick={onClose}>
      <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
        <h2>{user.nickname ?? user.email ?? "החשבון"}</h2>
        <p className="admin__hint">
          ארנה היא טווח גביעים, אז בחירת ארנה פשוט קובעת את הגביעים שהיא מתחילה
          בהם. אין שדה נפרד — שני מקורות אמת לאותה עובדה זה באג שמחכה לקרות.
        </p>
        <div className="admin__arenas">
          {ARENAS.map((a) => (
            <button key={a.id} onClick={() => setTrophies(String(a.from))}>
              {a.name.he}
              <small>{a.from}</small>
            </button>
          ))}
        </div>
        <label className="admin__field">
          גביעים
          <input value={trophies} inputMode="numeric" onChange={(e) => setTrophies(e.target.value)} />
        </label>
        <label className="admin__field">
          יהלומים
          <input value={diamonds} inputMode="numeric" onChange={(e) => setDiamonds(e.target.value)} />
        </label>
        <div className="admin__field">
          פנייה
          <div className="admin__arenas admin__arenas--tight">
            {([
              { v: "boy", he: "ילד" },
              { v: "girl", he: "ילדה" },
              { v: null, he: "לא אמר" },
            ] as const).map((o) => (
              <button
                key={o.he}
                className={gender === o.v ? "is-on" : ""}
                onClick={() => setGender(o.v)}
              >
                {o.he}
              </button>
            ))}
          </div>
        </div>
        <div className="result__buttons">
          <button
            className="btn-fight"
            onClick={() =>
              onDone({
                trophies: Number(trophies) || 0,
                diamonds: Number(diamonds) || 0,
                gender,
              })
            }
          >
            שמור
          </button>
          <button className="btn-fight btn-ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </div>
    </Overlay>
  );
}


function UsersTab({ say }: { say: (s: string) => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);
  /** Which account the "put them somewhere" panel is open for. */
  const [granting, setGranting] = useState<AdminUser | null>(null);
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  /** Whose statistics are being read, instead of the list. */
  const [looking, setLooking] = useState<AdminUser | null>(null);

  const [hidden, setHidden] = useState(0);
  const load = useCallback(async () => {
    const r = await call("/api/admin/users");
    if (r.error) return say(String(r.error));
    setUsers((r.users as AdminUser[]) ?? []);
    setHidden(typeof r.hiddenAnonymous === "number" ? r.hiddenAnonymous : 0);
  }, [say]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (what: string, user: AdminUser, body: unknown) => {
    setBusy(user.id);
    const r = await call(what, body);
    setBusy(null);
    if (r.error) return say(String(r.error));
    say("בוצע.");
    void load();
  };

  if (!users) return <div className="admin__body">טוען…</div>;

  // One person, instead of the list. Not a modal: there is a lot to read and
  // it is the kind of screen somebody scrolls.
  if (looking)
    return (
      <PlayerStats
        call={call}
        userId={looking.id}
        name={looking.nickname ?? looking.email ?? "אורח"}
        onClose={() => setLooking(null)}
      />
    );

  return (
    <div className="admin__body">
      <p className="admin__hint">
        {hidden > 0 && (
          <>
            <b>{hidden}</b> חשבונות אורח לא מוצגים כאן — מי שפתח את המשחק ולא
            התחבר. הם לא נמחקו: אלבום של ילד הופך לחשבון מלא ברגע שהוא מתחבר.
            <br />
          </>
        )}
        <b>איפוס</b> מחזיר שחקן לדקה הראשונה שלו — אלבום, גביעים, יהלומים
        והטוטריאל מתאפסים והוא מקבל שוב את קלפי ההתחלה. החשבון עצמו נשאר: אותה
        התחברות, אותו מזהה. <b>מחיקה</b> מוחקת את החשבון לגמרי ואי אפשר לבטל.
      </p>
      <table className="admin__table">
        <thead>
          <tr>
            <th>מי</th>
            <th>נכנס</th>
            <th>גביעים</th>
            <th>קלפים</th>
            <th>טוטריאל</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <b>{u.nickname ?? "— בלי שם —"}</b>
                <br />
                <small>{u.email ?? (u.providers.length ? u.providers.join(", ") : "אורח")}</small>
                {u.isYou && <span className="admin__where admin__where--live">אתה</span>}
                {u.isAdmin && !u.isYou && (
                  <span className="admin__where admin__where--deploy">מנהל</span>
                )}
                {u.suspendedUntil && (
                  <span className="admin__where admin__where--banned">
                    מושעה עד {new Date(u.suspendedUntil).toLocaleDateString("he-IL")}
                  </span>
                )}
              </td>
              <td>
                <small>{u.lastSeen ? new Date(u.lastSeen).toLocaleDateString("he-IL") : "—"}</small>
              </td>
              <td>{u.trophies}</td>
              <td>{u.cards}</td>
              <td>{u.tutorialDone ? "✔" : "—"}</td>
              <td className="admin__actions">
                {/* Or asked for the statistics per user as well as overall.
                    They are genuinely different questions: the overview says
                    whether the game is working, this says what one child is
                    doing with it. */}
                <button disabled={busy === u.id} onClick={() => setLooking(u)}>
                  נתונים
                </button>
                <button
                  disabled={busy === u.id}
                  onClick={() => void act("/api/admin/user/reset", u, { userId: u.id })}
                >
                  איפוס
                </button>
                <button
                  disabled={busy === u.id || !u.email}
                  title={u.email ? "" : "אין לחשבון הזה אימייל"}
                  onClick={() => void act("/api/admin/user/password", u, { email: u.email })}
                >
                  איפוס סיסמה
                </button>
                <button disabled={busy === u.id} onClick={() => setGranting(u)}>
                  גביעים / יהלומים
                </button>
                {u.suspendedUntil ? (
                  <button
                    disabled={busy === u.id}
                    onClick={() =>
                      void act("/api/admin/user/suspend", u, { userId: u.id, hours: 0 })
                    }
                  >
                    בטל השעיה
                  </button>
                ) : (
                  <button
                    className="admin__danger"
                    disabled={busy === u.id || u.isYou}
                    onClick={() => setSuspending(u)}
                  >
                    השעיה
                  </button>
                )}
                <button
                  disabled={busy === u.id || u.isYou}
                  title={u.isAdmin ? "הורד מניהול" : "הפוך למנהל"}
                  onClick={() => {
                    if (
                      !u.isAdmin &&
                      !window.confirm(
                        `להפוך את ${u.nickname ?? u.email ?? "המשתמש הזה"} למנהל? יהיו לו כל ההרשאות שלך.`,
                      )
                    )
                      return;
                    void act("/api/admin/user/admin", u, { userId: u.id, make: !u.isAdmin });
                  }}
                >
                  {u.isAdmin ? "הורד מניהול" : "הפוך למנהל"}
                </button>
                <button
                  className="admin__danger"
                  disabled={busy === u.id || u.isYou}
                  onClick={() => setConfirmDelete(u)}
                >
                  מחיקה
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {granting && (
        <GrantPanel
          user={granting}
          onClose={() => setGranting(null)}
          onDone={(body) => {
            const u = granting;
            setGranting(null);
            void act("/api/admin/user/grant", u, { userId: u.id, ...body });
          }}
        />
      )}

      {suspending && (
        <Overlay onClick={() => setSuspending(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <h2>להשעות את {suspending.nickname ?? suspending.email ?? "החשבון"}?</h2>
            <p>
              הוא לא יוכל להתחיל משחק מול שחקנים אחרים. מול המחשב כן — השעיה היא
              לא נעילה של המשחק, היא הוצאה מהחברה.
            </p>
            <div className="admin__arenas">
              {[
                { label: "שעה", hours: 1 },
                { label: "יום", hours: 24 },
                { label: "שבוע", hours: 24 * 7 },
                { label: "חודש", hours: 24 * 30 },
                { label: "ללא הגבלה", hours: undefined },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => {
                    const u = suspending;
                    setSuspending(null);
                    void act("/api/admin/user/suspend", u, {
                      userId: u.id,
                      ...(o.hours !== undefined ? { hours: o.hours } : {}),
                    });
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="result__buttons">
              <button className="btn-fight btn-ghost" onClick={() => setSuspending(null)}>
                ביטול
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {confirmDelete && (
        <Overlay onClick={() => setConfirmDelete(null)}>
          <div className="modal modal--confirm" onClick={(e) => e.stopPropagation()}>
            <h2>למחוק את {confirmDelete.nickname ?? confirmDelete.email ?? "החשבון הזה"}?</h2>
            <p>
              החשבון, האלבום והגביעים נמחקים לגמרי. אי אפשר לבטל. אם רק רצית
              להתחיל מחדש — <b>איפוס</b> עושה את זה בלי למחוק.
            </p>
            <div className="result__buttons">
              <button
                className="btn-fight admin__danger"
                onClick={() => {
                  const u = confirmDelete;
                  setConfirmDelete(null);
                  void act("/api/admin/user/delete", u, { userId: u.id });
                }}
              >
                כן, למחוק
              </button>
              <button className="btn-fight btn-ghost" onClick={() => setConfirmDelete(null)}>
                ביטול
              </button>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
