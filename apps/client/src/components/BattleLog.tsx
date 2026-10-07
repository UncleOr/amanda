import { useMemo, useState } from "react";
import { spriteFor } from "../game/skins";
import { Icon, type IconName } from "./Icon";
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
import { Overlay } from "./Overlay";


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
  diedToThorns: (f) =>
    `${f.name} הרג את עצמו — הנזק החוזר מהיעד היה ${f.value}% מהחיים שלו`,
  outnumbered: (f) => `ניצחון סוחף — ${f.value} קלפים הפרש`,
};

const TIMELINE_TEXT: Record<TimelineEntry["kind"], (e: TimelineEntry) => string> = {
  firstBlood: (e) => `דם ראשון — ${e.actor ?? "משהו"} הפיל את ${e.target}`,
  kill: (e) => `${e.actor ?? "משהו"} הפיל את ${e.target}`,
  kingDown: (e) => `המלך ${e.target} נפל`,
  reflected: (e) =>
    `${e.target} ספג ${e.damage?.toLocaleString("he-IL")} נזק חוזר מ${e.actor} — הוא פגע בקוצים`,
  split: (e) => `${e.actor} התפצל`,
  reveal: (e) => `נחשף קלף קומת קרקע: ${e.target}`,
  freeze: (e) => `${e.actor ?? "משהו"} הקפיא את ${e.target}`,
  end: (e) => (e.owner ? `הקרב נגמר` : `תיקו. לשנינו טעם רע בפה.`),
};

// The game's own icons, not the phone's. Each key is an id in iconLooks.ts.
const ICON: Record<TimelineEntry["kind"], IconName> = {
  firstBlood: "blood",
  kill: "skull",
  kingDown: "king",
  reflected: "thorns",
  split: "split",
  reveal: "joker",
  freeze: "frozen",
  end: "flag",
};

/**
 * The battle report: what happened, who did the work, and what the board got
 * wrong. Shown on the result screen so a match teaches something, and copyable
 * as JSON so the same numbers can drive strategy and balance work later.
 */
export function BattleLog({ result, mySide }: { result: BattleResult; mySide: Owner }) {
  const [tab, setTab] = useState<"analysis" | "map" | "units" | "timeline">("analysis");
  const [copied, setCopied] = useState(false);
  /** The report as text, shown when the clipboard would not take it. */
  const [fallback, setFallback] = useState<string | null>(null);
  const [inspect, setInspect] = useState<UnitReport | null>(null);
  const report = useMemo(() => buildReport(result, CATALOG), [result]);

  const theirSide: Owner = mySide === "A" ? "B" : "A";
  const sideName = (o: Owner) => (o === mySide ? "אתה" : "היריב");

  /**
   * Put the whole report on the clipboard, or show it if that is not possible.
   *
   * ═══ THIS USED TO THROW ═══
   *
   * It was `navigator.clipboard?.writeText(...).then(...)`. The optional chain
   * guards `clipboard` being undefined and then calls `.then` on the
   * `undefined` that produces — so on any browser without the API the button
   * raised a TypeError instead of copying. Or found it on his phone: "and you
   * can't copy the JSON."
   *
   * Two things are wrong on a phone and both are handled. The API may be
   * missing entirely, and it may be present and REFUSE — a write needs a
   * secure context and a real user gesture, and Safari turns some of them
   * down anyway. Either way the answer is the same: show the text, selected,
   * so a long-press and "copy" gets it. A button that silently does nothing
   * is worse than no button.
   */
  const copyJson = () => {
    const text = JSON.stringify(report, null, 2);
    const showIt = () => setFallback(text);
    try {
      const write = navigator.clipboard?.writeText(text);
      if (!write) return showIt();
      void write.then(
        () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        },
        showIt,
      );
    } catch {
      showIt();
    }
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

      {fallback !== null && (
        <>
          <textarea
            className="log__json"
            readOnly
            value={fallback}
            // Selected on arrival: the whole point is that the next thing the
            // player does is "copy", and selecting it by hand on a phone is
            // the fiddly part.
            ref={(el) => el?.select()}
          />
          <p className="log__json-note">הדפדפן לא נתן להעתיק. סמנו הכול והעתיקו ידנית.</p>
        </>
      )}

      {tab === "analysis" && (
        <div className="log__body">
          <div className="log__grade">
            <div className={`log__grade-score log__grade-score--${gradeBand(report.grades[mySide].score)}`}>
              {report.grades[mySide].score}
              <small>/10</small>
            </div>
            <div className="log__grade-bars">
              {(
                [
                  ["תוצאה", "outcome"],
                  ["מהירות", "speed"],
                  ["יחס נזק", "trade"],
                  ["השתתפות הלוח", "participation"],
                  ["שרידות", "survival"],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="log__grade-bar">
                  <span>{label}</span>
                  <i>
                    <b style={{ width: `${Math.round(report.grades[mySide].parts[key] * 100)}%` }} />
                  </i>
                </div>
              ))}
            </div>
          </div>

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
            {report.findings.length === 0 && <li className="log__quiet">קרב משעמם. לא קרה כלום.</li>}
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
          <p className="log__quiet">ככה נראו הלוחות בהתחלה. תראה מה כל קלף עשה.</p>
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
            <span><i className="log__swatch log__swatch--idle" /> ישן</span>
            <span>
            <Icon name="skull" size={13} /> נפל · <Icon name="ready" size={13} /> שרד ·{" "}
            <Icon name="frozen" size={13} /> לא זז
          </span>
            <span>לחץ על קלף ואספר לך</span>
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
                        {u.isKing && <Icon name="king" size={13} />}
                        {u.name}
                      </td>
                      <td className={o === mySide ? "log__me" : "log__them"}>{sideName(o)}</td>
                      <td>{u.damageDealt.toLocaleString("he-IL")}</td>
                      <td>{u.damageTaken.toLocaleString("he-IL")}</td>
                      <td>{u.kills || ""}</td>
                      <td>
                    {u.survived ? (
                      <Icon name="ready" size={14} />
                    ) : (
                      <>
                        <Icon name="skull" size={14} /> {secs(u.diedAtTick ?? 0)}s
                      </>
                    )}
                  </td>
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
                <span className="log__icon">
                  <Icon name={ICON[e.kind]} size={15} />
                </span>
                {TIMELINE_TEXT[e.kind](e)}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/** Colour band for a match grade. */
function gradeBand(score: number): "bad" | "ok" | "good" {
  return score >= 8 ? "good" : score >= 5 ? "ok" : "bad";
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
      className={
        `log__cell log__cell--${band(u, top)}` +
        `${u.survived ? "" : " log__cell--dead"}` +
        `${u.cardId === FILLER_CARD_ID ? " log__cell--filler" : ""}`
      }
      style={{ gridColumn: colFor(u.startX), gridRow: u.lane + 1 }}
      title={
        u.cardId === FILLER_CARD_ID
          ? `${u.name} — מילוי אוטומטי של משבצת ריקה`
          : `${u.name} — לחצו לפרטים`
      }
      onClick={() => onPick(u)}
    >
      <span className="log__cell-name">{u.name}</span>
      <span className="log__cell-dmg">{u.damageDealt.toLocaleString("he-IL")}</span>
      <span className="log__cell-marks">
        <Icon name={u.survived ? "ready" : "skull"} size={12} />
        {u.colsMoved === 0 && !u.isKing && <Icon name="frozen" size={12} />}
        {u.kills > 0 && (
                        <>
                          <Icon name="melee" size={12} />
                          {u.kills}
                        </>
                      )}
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
            <span className="log__cell-name">
            <Icon name="king" size={13} /> {king.name}
          </span>
            <span className="log__cell-dmg">{king.damageDealt.toLocaleString("he-IL")}</span>
            <span className="log__cell-marks">
            <Icon name={king.survived ? "ready" : "skull"} size={12} />
          </span>
          </button>
        )}
        {/*
          * Filler monsters are shown, faint. Hiding them left the map looking
          * like half the board was never filled at all, which is the opposite
          * of what happened — every empty slot gets one when the board locks.
          */}
        {units.filter((u) => !u.isKing).map(cell)}
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
  const art = card?.art.sprite
    ? `${import.meta.env.BASE_URL}${spriteFor(card.id, card.art.sprite)}`
    : null;
  const sideTotal = Math.max(1, report.sides[unit.owner].damageDealt);
  const share = Math.round((unit.damageDealt / sideTotal) * 100);
  const col = ["עורף", "שלישית", "שנייה", "חזית"][unit.startX] ?? "";

  // What this card actually did, in one line, rather than making the player
  // read the numbers and work it out.
  const story = (() => {
    if (unit.damageDealt === 0 && unit.damageTaken === 0)
      return "לא נגע בקרב. לא הגיע לאף אחד, ואף אחד לא הגיע אליו.";
    if (unit.damageDealt === 0) return "חטף ולא הספיק להחזיר אפילו מכה אחת.";
    if (unit.kills >= 2) return `חתך את הדרך — הפיל ${unit.kills} קלפים.`;
    if (share >= 30) return `נשא את הצד שלו: ${share}% מכל הנזק.`;
    return `תרם ${share}% מהנזק של הצד שלו.`;
  })();

  return (
    <Overlay onClick={onClose}>
      <div
        className="modal modal--unit"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--card-color"]: seriesColor(unit.seriesId) } as React.CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title="סגירה">
          <Icon name="exit" size={15} />
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
              {unit.isKing && <Icon name="king" size={14} />}
              {unit.name}
            </h2>
            <p className="modal__subtitle">
              {mine ? "שלך" : "של היריב"} · {col}, מסלול {unit.lane + 1}
            </p>
            <div className="modal__badges">
              {card && (
                <span className="badge">
                  <Icon name={ELEMENT_META[card.elements[0]!].icon} size={13} />{" "}
                  {ELEMENT_META[card.elements[0]!].he}
                </span>
              )}
              {card && <span className="badge">{RANGE_META[card.stats.range].he}</span>}
              <span className={`badge${unit.survived ? " badge--king" : ""}`}>
                {unit.survived ? (
              <>
                <Icon name="ready" size={14} /> שרד
              </>
            ) : (
              <>
                <Icon name="skull" size={14} /> נפל ב-{secs(unit.diedAtTick ?? 0)}s
              </>
            )}
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
              ? "לא זז מילימטר"
              : `התקדם ${unit.colsMoved.toFixed(1)} משבצות`}
          </li>
        </ul>
      </div>
    </Overlay>
  );
}
