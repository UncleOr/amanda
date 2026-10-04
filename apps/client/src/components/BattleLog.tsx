import { useMemo, useState } from "react";
import { SIMULATION } from "@amanda/shared";
import {
  buildReport,
  FILLER_CARD_ID,
  type BattleReport,
  type BattleResult,
  type Finding,
  type Owner,
  type TimelineEntry,
  type UnitReport,
} from "@amanda/engine";
import { CATALOG } from "../data/catalog";
import { ELEMENT_META, RANGE_META, seriesColor } from "../data/cardMeta";


const TPS = SIMULATION.ticksPerSecond;
const secs = (tick: number): string => (tick / TPS).toFixed(1);

/**
 * What each analysis code means, in play terms. The engine emits codes; the
 * wording lives here so it can be edited without touching the analysis.
 */
const FINDING_TEXT: Record<Finding["code"], (f: Finding) => string> = {
  mvp: (f) => `${f.name} עשה ${f.value}% מהנזק של הצד הזה`,
  kingCarried: (f) => `המלך ${f.name} נשא את הקרב — ${f.value}% מהנזק`,
  deadWeight: (f) => `${f.value} קלפים לא נגעו בקרב בכלל — לא תקפו ולא ספגו`,
  backRowIdle: (f) => `${f.value} קלפים בעורף שרדו בלי לתקוף אף פעם — הלוח עמוק מדי`,
  kingFellEarly: (f) => `המלך ${f.name} נפל כבר בשנייה ${secs(f.value ?? 0)}`,
  laneCollapse: (f) => `כל הקלפים במסלול ${(f.lane ?? 0) + 1} נפלו — שם נפרצה החזית`,
  overkill: (f) => `בוזבז נזק על ${f.name}: ספג ${f.value}% מהחיים שלו`,
  wipe: (f) => `הצד הזה נמחק לגמרי — ${f.value} קלפים`,
  closeCall: () => `קרב צמוד — הוכרע בהפרש של קלף אחד`,
  outnumbered: (f) => `ניצחון סוחף — ${f.value} קלפים הפרש`,
};

const TIMELINE_TEXT: Record<TimelineEntry["kind"], (e: TimelineEntry) => string> = {
  firstBlood: (e) => `דם ראשון — ${e.actor ?? "משהו"} הפיל את ${e.target}`,
  kill: (e) => `${e.actor ?? "משהו"} הפיל את ${e.target}`,
  kingDown: (e) => `👑 המלך ${e.target} נפל`,
  split: (e) => `${e.actor} התפצל`,
  reveal: (e) => `נחשף קלף קומת קרקע: ${e.target}`,
  freeze: (e) => `${e.actor ?? "משהו"} הקפיא את ${e.target}`,
  end: (e) => (e.owner ? `הקרב נגמר` : `הקרב נגמר בתיקו`),
};

const ICON: Record<TimelineEntry["kind"], string> = {
  firstBlood: "🩸",
  kill: "💀",
  kingDown: "👑",
  split: "🧬",
  reveal: "🃏",
  freeze: "❄️",
  end: "🏁",
};

/**
 * The battle report: what happened, who did the work, and what the board got
 * wrong. Shown on the result screen so a match teaches something, and copyable
 * as JSON so the same numbers can drive strategy and balance work later.
 */
export function BattleLog({ result, mySide }: { result: BattleResult; mySide: Owner }) {
  const [tab, setTab] = useState<"analysis" | "map" | "units" | "timeline">("analysis");
  const [copied, setCopied] = useState(false);
  const [inspect, setInspect] = useState<UnitReport | null>(null);
  const report = useMemo(() => buildReport(result, CATALOG), [result]);

  const theirSide: Owner = mySide === "A" ? "B" : "A";
  const sideName = (o: Owner) => (o === mySide ? "אתה" : "היריב");

  const copyJson = () => {
    void navigator.clipboard?.writeText(JSON.stringify(report, null, 2)).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="log">
      <div className="log__tabs">
        <button
          className={`log__tab${tab === "analysis" ? " log__tab--on" : ""}`}
          onClick={() => setTab("analysis")}
        >
          ניתוח
        </button>
        <button
          className={`log__tab${tab === "map" ? " log__tab--on" : ""}`}
          onClick={() => setTab("map")}
        >
          מפה
        </button>
        <button
          className={`log__tab${tab === "units" ? " log__tab--on" : ""}`}
          onClick={() => setTab("units")}
        >
          קלפים
        </button>
        <button
          className={`log__tab${tab === "timeline" ? " log__tab--on" : ""}`}
          onClick={() => setTab("timeline")}
        >
          ציר זמן
        </button>
        <button className="log__copy" onClick={copyJson} title="העתקת הדוח המלא כ-JSON">
          {copied ? "✔ הועתק" : "⧉ העתק JSON"}
        </button>
      </div>

      {tab === "analysis" && (
        <div className="log__body">
          <div className="log__scores">
            {([mySide, theirSide] as Owner[]).map((o) => {
              const s = report.sides[o];
              return (
                <div key={o} className={`log__score log__score--${o === mySide ? "me" : "them"}`}>
                  <h4>{sideName(o)}</h4>
                  <dl>
                    <div>
                      <dt>נזק</dt>
                      <dd>{s.damageDealt.toLocaleString("he-IL")}</dd>
                    </div>
                    <div>
                      <dt>הפלות</dt>
                      <dd>{s.kills}</dd>
                    </div>
                    <div>
                      <dt>שרדו</dt>
                      <dd>{s.survivors}</dd>
                    </div>
                    <div>
                      <dt>נפלו</dt>
                      <dd>{s.losses}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          <ul className="log__findings">
            {report.findings.length === 0 && <li className="log__quiet">אין ממצאים מיוחדים בקרב הזה.</li>}
            {report.findings.map((f, i) => (
              <li key={i} className={`log__finding log__finding--${f.owner === mySide ? "me" : "them"}`}>
                <span className="log__who">{sideName(f.owner)}</span>
                {FINDING_TEXT[f.code](f)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "map" && (
        <div className="log__body">
          <p className="log__quiet">הלוחות כפי שנראו בתחילת הקרב — מה כל קלף עשה מהמקום שלו.</p>
          <div className="log__maps">
            {([mySide, theirSide] as Owner[]).map((o) => (
              <BoardMap
                key={o}
                report={report}
                owner={o}
                title={sideName(o)}
                mine={o === mySide}
                onPick={setInspect}
              />
            ))}
          </div>
          <div className="log__legend">
            <span><i className="log__swatch log__swatch--top" /> הכי הרבה נזק</span>
            <span><i className="log__swatch log__swatch--some" /> תרם נזק</span>
            <span><i className="log__swatch log__swatch--idle" /> לא עשה כלום</span>
            <span>💀 נפל · ✅ שרד · 🧊 לא זז</span>
            <span>לחצו על קלף לפרטים</span>
          </div>
        </div>
      )}

      {tab === "units" && (
        <div className="log__body log__body--scroll">
          <table className="log__table">
            <thead>
              <tr>
                <th>קלף</th>
                <th>צד</th>
                <th>נזק</th>
                <th>ספג</th>
                <th>הפלות</th>
                <th>סוף</th>
              </tr>
            </thead>
            <tbody>
              {([mySide, theirSide] as Owner[]).flatMap((o) =>
                report.sides[o].units
                  .filter((u) => u.cardId !== "crumb_demon")
                  .map((u) => (
                    <tr key={u.uid} className="log__row" onClick={() => setInspect(u)}>
                      <td>
                        <span
                          className="log__dot"
                          style={{ background: seriesColor(u.seriesId) }}
                        />
                        {u.isKing && "👑 "}
                        {u.name}
                      </td>
                      <td className={o === mySide ? "log__me" : "log__them"}>{sideName(o)}</td>
                      <td>{u.damageDealt.toLocaleString("he-IL")}</td>
                      <td>{u.damageTaken.toLocaleString("he-IL")}</td>
                      <td>{u.kills || ""}</td>
                      <td>{u.survived ? "✅" : `💀 ${secs(u.diedAtTick ?? 0)}s`}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {inspect && (
        <UnitReportModal
          unit={inspect}
          mine={inspect.owner === mySide}
          report={report}
          onClose={() => setInspect(null)}
        />
      )}

      {tab === "timeline" && (
        <div className="log__body log__body--scroll">
          <ol className="log__timeline">
            {report.timeline.map((e, i) => (
              <li key={i} className={e.owner === mySide ? "log__them-win" : ""}>
                <span className="log__time">{secs(e.tick)}s</span>
                <span className="log__icon">{ICON[e.kind]}</span>
                {TIMELINE_TEXT[e.kind](e)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Which bucket a card falls into, for the heat colouring. */
function band(u: UnitReport, top: number): "top" | "some" | "idle" {
  if (u.damageDealt <= 0) return "idle";
  return u.damageDealt >= top ? "top" : "some";
}

/**
 * One player's 4×4 board exactly as it stood when the battle started, with each
 * card carrying what it went on to do. Seeing it in place is what turns "2 cards
 * did nothing" into "my whole back row did nothing".
 */
function BoardMap({
  report,
  owner,
  title,
  mine,
  onPick,
}: {
  report: BattleReport;
  owner: Owner;
  title: string;
  mine: boolean;
  onPick: (u: UnitReport) => void;
}) {
  const units = report.sides[owner].units;
  const top = Math.max(...units.filter((u) => u.cardId !== FILLER_CARD_ID).map((u) => u.damageDealt), 1);
  const king = units.find((u) => u.isKing);
  // The front row faces the middle, so the opponent's board is mirrored — the
  // same arrangement the build screen shows.
  const colFor = (x: number) => (mine ? x + 1 : 4 - x);

  const cell = (u: UnitReport) => (
    <button
      key={u.uid}
      type="button"
      className={`log__cell log__cell--${band(u, top)}${u.survived ? "" : " log__cell--dead"}`}
      style={{ gridColumn: colFor(u.startX), gridRow: u.lane + 1 }}
      title={`${u.name} — לחצו לפרטים`}
      onClick={() => onPick(u)}
    >
      <span className="log__cell-name">{u.name}</span>
      <span className="log__cell-dmg">{u.damageDealt.toLocaleString("he-IL")}</span>
      <span className="log__cell-marks">
        {u.survived ? "✅" : "💀"}
        {u.colsMoved === 0 && !u.isKing && "🧊"}
        {u.kills > 0 && `⚔${u.kills}`}
      </span>
    </button>
  );

  return (
    <figure className="log__map">
      <figcaption className={mine ? "log__me" : "log__them"}>{title}</figcaption>
      <div className="log__grid" dir="ltr">
        {king && (
          <button
            type="button"
            className={`log__cell log__cell--king log__cell--${band(king, top)}${king.survived ? "" : " log__cell--dead"}`}
            style={{ gridColumn: "2 / 4", gridRow: "2 / 4" }}
            title={`${king.name} — לחצו לפרטים`}
            onClick={() => onPick(king)}
          >
            <span className="log__cell-name">👑 {king.name}</span>
            <span className="log__cell-dmg">{king.damageDealt.toLocaleString("he-IL")}</span>
            <span className="log__cell-marks">{king.survived ? "✅" : "💀"}</span>
          </button>
        )}
        {units
          .filter((u) => !u.isKing && u.cardId !== FILLER_CARD_ID)
          .map(cell)}
      </div>
    </figure>
  );
}

/** One card's own account of the battle, opened from the map or the table. */
function UnitReportModal({
  unit,
  mine,
  report,
  onClose,
}: {
  unit: UnitReport;
  mine: boolean;
  report: BattleReport;
  onClose: () => void;
}) {
  const card = CATALOG.get(unit.cardId);
  const art = card?.art.sprite ? `${import.meta.env.BASE_URL}${card.art.sprite}` : null;
  const sideTotal = Math.max(1, report.sides[unit.owner].damageDealt);
  const share = Math.round((unit.damageDealt / sideTotal) * 100);
  const col = ["עורף", "שלישית", "שנייה", "חזית"][unit.startX] ?? "";

  // What this card actually did, in one line, rather than making the player
  // read the numbers and work it out.
  const story = (() => {
    if (unit.damageDealt === 0 && unit.damageTaken === 0)
      return "לא נגע בקרב — אף אחד לא הגיע אליו והוא לא הגיע לאף אחד.";
    if (unit.damageDealt === 0) return "ספג מכות אבל לא הספיק להחזיר ולו מכה אחת.";
    if (unit.kills >= 2) return `חתך את הדרך — הפיל ${unit.kills} קלפים.`;
    if (share >= 30) return `נשא את הצד שלו: ${share}% מכל הנזק.`;
    return `תרם ${share}% מהנזק של הצד שלו.`;
  })();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal--unit"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--card-color"]: seriesColor(unit.seriesId) } as React.CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title="סגירה">
          ✕
        </button>
        <div className="modal__banner">
          <div
            className="modal__portrait"
            style={
              art
                ? { backgroundImage: `url("${art}")`, backgroundSize: "cover", backgroundPosition: "top center" }
                : { background: seriesColor(unit.seriesId) }
            }
          />
          <div className="modal__title">
            <h2>
              {unit.isKing && "👑 "}
              {unit.name}
            </h2>
            <p className="modal__subtitle">
              {mine ? "שלך" : "של היריב"} · {col}, מסלול {unit.lane + 1}
            </p>
            <div className="modal__badges">
              {card && (
                <span className="badge">
                  {ELEMENT_META[card.elements[0]!].icon} {ELEMENT_META[card.elements[0]!].he}
                </span>
              )}
              {card && <span className="badge">{RANGE_META[card.stats.range].he}</span>}
              <span className={`badge${unit.survived ? " badge--king" : ""}`}>
                {unit.survived ? "✅ שרד" : `💀 נפל ב-${secs(unit.diedAtTick ?? 0)}s`}
              </span>
            </div>
          </div>
        </div>

        <p className="modal__role">{story}</p>

        <div className="log__scores">
          <div className="log__score">
            <dl>
              <div>
                <dt>נזק שעשה</dt>
                <dd>{unit.damageDealt.toLocaleString("he-IL")}</dd>
              </div>
              <div>
                <dt>נזק שספג</dt>
                <dd>{unit.damageTaken.toLocaleString("he-IL")}</dd>
              </div>
              <div>
                <dt>הפלות</dt>
                <dd>{unit.kills}</dd>
              </div>
              <div>
                <dt>מכות</dt>
                <dd>{unit.hits}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ul className="log__facts">
          <li>
            <b>מהנזק של הצד:</b> {share}%
          </li>
          <li>
            <b>חיים:</b> {unit.maxHp.toLocaleString("he-IL")}
            {unit.isKing && " (כולל בונוס מלך ×3)"}
          </li>
          <li>
            <b>תזוזה:</b>{" "}
            {unit.colsMoved === 0
              ? "נשאר במקום לאורך כל הקרב"
              : `התקדם ${unit.colsMoved.toFixed(1)} משבצות`}
          </li>
        </ul>
      </div>
    </div>
  );
}
