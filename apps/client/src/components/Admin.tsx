import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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
}

interface CopyEntry {
  id: string;
  section: string;
  text: string;
  where: { kind: "json" | "source"; file: string; path?: (string | number)[]; line?: number };
}

async function call(path: string, body: unknown = {}): Promise<Record<string, unknown>> {
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "not signed in" };
  const res = await fetch(`${SERVER}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as Record<string, unknown>;
}

export function Admin() {
  const [state, setState] = useState<"checking" | "out" | "denied" | "in">("checking");
  const [tab, setTab] = useState<"copy" | "users">("copy");
  const [note, setNote] = useState<string | null>(null);

  const check = useCallback(async () => {
    const { data } = await sb.auth.getSession();
    if (!data.session) return setState("out");
    const r = await call("/api/admin/whoami");
    setState(r.ok ? "in" : "denied");
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
            void sb.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: window.location.href },
            })
          }
        >
          התחברות עם גוגל
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
          <button className={tab === "copy" ? "on" : ""} onClick={() => setTab("copy")}>
            טקסטים
          </button>
          <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>
            משתמשים
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
      {tab === "copy" ? <CopyTab say={setNote} /> : <UsersTab say={setNote} />}
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

/* ──────────────────────────── users ──────────────────────────── */

function UsersTab({ say }: { say: (s: string) => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminUser | null>(null);

  const load = useCallback(async () => {
    const r = await call("/api/admin/users");
    if (r.error) return say(String(r.error));
    setUsers((r.users as AdminUser[]) ?? []);
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

  return (
    <div className="admin__body">
      <p className="admin__hint">
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
                {u.isAdmin && <span className="admin__where admin__where--live">אתה</span>}
              </td>
              <td>
                <small>{u.lastSeen ? new Date(u.lastSeen).toLocaleDateString("he-IL") : "—"}</small>
              </td>
              <td>{u.trophies}</td>
              <td>{u.cards}</td>
              <td>{u.tutorialDone ? "✔" : "—"}</td>
              <td className="admin__actions">
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
                <button
                  className="admin__danger"
                  disabled={busy === u.id || u.isAdmin}
                  onClick={() => setConfirmDelete(u)}
                >
                  מחיקה
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
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
        </div>
      )}
    </div>
  );
}
