import { useMemo, useState } from "react";
import { artUrl, spriteFor } from "../game/skins";
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
import { say } from "../game/lang";
import { line as t, lineF as tf } from "../game/copy";


const TPS = SIMULATION.ticksPerSecond;
const secs = (tick: number): string => (tick / TPS).toFixed(1);

/**
 * What each analysis code means, in play terms. The engine emits codes; the
 * wording lives here so it can be edited without touching the analysis.
 */
const FINDING_TEXT: Record<Finding["code"], (f: Finding) => string> = {
  mvp: (f) => tf("sf4b8060", "{0} עשה {1}% מהנזק של הצד הזה", f.name, f.value),
  kingCarried: (f) => tf("sb03fb80", "המלך {0} נשא את הקרב — {1}% מהנזק", f.name, f.value),
  deadWeight: (f) => tf("sf2f72a8", "{0} קלפים לא נגעו בקרב בכלל — לא תקפו ולא ספגו", f.value),
  backRowIdle: (f) => tf("s92c427c", "{0} קלפים בעורף שרדו בלי לתקוף אף פעם — הלוח עמוק מדי", f.value),
  kingFellEarly: (f) => tf("sb6efc72", "המלך {0} נפל כבר בשנייה {1}", f.name, secs(f.value ?? 0)),
  laneCollapse: (f) => tf("s296dff0", "כל הקלפים במסלול {0} נפלו — שם נפרצה החזית", (f.lane ?? 0) + 1),
  overkill: (f) => tf("s5ac99ca", "בוזבז נזק על {0}: ספג {1}% מהחיים שלו", f.name, f.value),
  wipe: (f) => tf("s7268432", "הצד הזה נמחק לגמרי — {0} קלפים", f.value),
  closeCall: () => t("sa039c8a", "קרב צמוד — הוכרע בהפרש של קלף אחד"),
  diedToThorns: (f) =>
    tf("se153a53", "{0} הרג את עצמו — הנזק החוזר מהיעד היה {1}% מהחיים שלו", f.name, f.value),
  outnumbered: (f) => tf("sf4060a1", "ניצחון סוחף — {0} קלפים הפרש", f.value),
};

const TIMELINE_TEXT: Record<TimelineEntry["kind"], (e: TimelineEntry) => string> = {
  firstBlood: (e) => tf("s03917ba", "דם ראשון — {0} הפיל את {1}", e.actor ?? t("s3c01a8e", "משהו"), e.target),
  kill: (e) => tf("s4813b7e", "{0} הפיל את {1}", e.actor ?? t("se33f63d", "משהו"), e.target),
  kingDown: (e) => tf("s09d8eb1", "המלך {0} נפל", e.target),
  reflected: (e) =>
    tf("sf5f7bec", "{0} ספג {1} נזק חוזר מ{2} — הוא פגע בקוצים", e.target, e.damage?.toLocaleString("he-IL"), e.actor),
  split: (e) => tf("s32b1dc6", "{0} התפצל", e.actor),
  reveal: (e) => tf("s29eee42", "נחשף קלף קומת קרקע: {0}", e.target),
  freeze: (e) => tf("s59a7b2d", "{0} הקפיא את {1}", e.actor ?? t("s1abba82", "משהו"), e.target),
  end: (e) => (e.owner ? t("s3f09475", "הקרב נגמר") : t("s9ab5edb", "תיקו. לשנינו טעם רע בפה.")),
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
  const sideName = (o: Owner) => (o === mySide ? t("s1ab2182", "אתה") : t("s36e0c61", "היריב"));

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
          {t("sd9066d0", "ניתוח")}
        </button>
        <button
          className={`log__tab${tab === "map" ? " log__tab--on" : ""}`}
          onClick={() => setTab("map")}
        >
          {t("s8c23ea2", "מפה")}
        </button>
        <button
          className={`log__tab${tab === "units" ? " log__tab--on" : ""}`}
          onClick={() => setTab("units")}
        >
          {t("s634d610", "קלפים")}
        </button>
        <button
          className={`log__tab${tab === "timeline" ? " log__tab--on" : ""}`}
          onClick={() => setTab("timeline")}
        >
          {t("s0d36f2d", "ציר זמן")}
        </button>
        <button className="log__copy" onClick={copyJson} title={t("s484ea7e", "העתקת הדוח המלא כ-JSON")}>
          {copied ? t("sb22f4be", "✔ הועתק") : t("s5970baf", "⧉ העתק JSON")}
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
          <p className="log__json-note">{t("se1d32f8", "הדפדפן לא נתן להעתיק. סמנו הכול והעתיקו ידנית.")}</p>
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
                  [t("sb9555de", "תוצאה"), "outcome"],
                  [t("s41257f4", "מהירות"), "speed"],
                  [t("sb7c0a3f", "יחס נזק"), "trade"],
                  [t("s63fa2b3", "השתתפות הלוח"), "participation"],
                  [t("s41fe997", "שרידות"), "survival"],
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
                      <dt>{t("sb7b9d16", "נזק")}</dt>
                      <dd>{s.damageDealt.toLocaleString("he-IL")}</dd>
                    </div>
                    <div>
                      <dt>{t("scca46b4", "הפלות")}</dt>
                      <dd>{s.kills}</dd>
                    </div>
                    <div>
                      <dt>{t("s995ae23", "שרדו")}</dt>
                      <dd>{s.survivors}</dd>
                    </div>
                    <div>
                      <dt>{t("sf79b753", "נפלו")}</dt>
                      <dd>{s.losses}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>

          <ul className="log__findings">
            {report.findings.length === 0 && <li className="log__quiet">{t("sc18fd03", "קרב משעמם. לא קרה כלום.")}</li>}
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
          <p className="log__quiet">{t("s30b45ab", "ככה נראו הלוחות בהתחלה. תראה מה כל קלף עשה.")}</p>
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
            <span><i className="log__swatch log__swatch--top" /> {t("s1d0a003", "הכי הרבה נזק")}</span>
            <span><i className="log__swatch log__swatch--some" /> {t("s9c41951", "תרם נזק")}</span>
            <span><i className="log__swatch log__swatch--idle" /> {t("s3b86504", "ישן")}</span>
            <span>
            <Icon name="skull" size={13} /> {t("s682e386", "נפל")} ·{" "}
            <Icon name="ready" size={13} /> {t("s4acff09", "שרד")} ·{" "}
            <Icon name="frozen" size={13} /> {t("s57f747b", "לא זז")}
          </span>
            <span>{t("s65ef918", "לחץ על קלף ואספר לך")}</span>
          </div>
        </div>
      )}

      {tab === "units" && (
        <div className="log__body log__body--scroll">
          <table className="log__table">
            <thead>
              <tr>
                <th>{t("s3b1fddd", "קלף")}</th>
                <th>{t("se4b01fc", "צד")}</th>
                <th>{t("sa777d2c", "נזק")}</th>
                <th>{t("s4e62559", "ספג")}</th>
                <th>{t("s1fad98a", "הפלות")}</th>
                <th>{t("scbe08c2", "סוף")}</th>
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
          ? tf("sd1502a2", "{0} — מילוי אוטומטי של משבצת ריקה", u.name)
          : tf("sf6c8aac", "{0} — לחצו לפרטים", u.name)
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
            title={tf("sf72ed62", "{0} — לחצו לפרטים", king.name)}
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
    ? artUrl(spriteFor(card.id, card.art.sprite))
    : null;
  const sideTotal = Math.max(1, report.sides[unit.owner].damageDealt);
  const share = Math.round((unit.damageDealt / sideTotal) * 100);
  const col = [t("secfc437", "עורף"), t("s5b44eac", "שלישית"), t("s2f05432", "שנייה"), t("s0160f0c", "חזית")][unit.startX] ?? "";

  // What this card actually did, in one line, rather than making the player
  // read the numbers and work it out.
  const story = (() => {
    if (unit.damageDealt === 0 && unit.damageTaken === 0)
      return t("s565b00b", "לא נגע בקרב. לא הגיע לאף אחד, ואף אחד לא הגיע אליו.");
    if (unit.damageDealt === 0) return t("s33300d2", "חטף ולא הספיק להחזיר אפילו מכה אחת.");
    if (unit.kills >= 2) return tf("sac3c899", "חתך את הדרך — הפיל {0} קלפים.", unit.kills);
    if (share >= 30) return tf("s22f4051", "נשא את הצד שלו: {0}% מכל הנזק.", share);
    return tf("s45645fa", "תרם {0}% מהנזק של הצד שלו.", share);
  })();

  return (
    <Overlay onClick={onClose}>
      <div
        className="modal modal--unit"
        onClick={(e) => e.stopPropagation()}
        style={{ ["--card-color"]: seriesColor(unit.seriesId) } as React.CSSProperties}
      >
        <button className="modal__close" onClick={onClose} title={t("sbf12851", "סגירה")}>
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
              {mine ? t("sa7d29bc", "שלך") : t("s8900b3c", "של היריב")} · {col},{" "}
              {tf("s548a9bf", "מסלול {0}", unit.lane + 1)}
            </p>
            <div className="modal__badges">
              {card && (
                <span className="badge">
                  <Icon name={ELEMENT_META[card.elements[0]!].icon} size={13} />{" "}
                  {say(ELEMENT_META[card.elements[0]!])}
                </span>
              )}
              {card && <span className="badge">{say(RANGE_META[card.stats.range])}</span>}
              <span className={`badge${unit.survived ? " badge--king" : ""}`}>
                {unit.survived ? (
              <>
                <Icon name="ready" size={14} /> {t("sfea5ea2", "שרד")}
              </>
            ) : (
              <>
                <Icon name="skull" size={14} /> {tf("s99b51e8", "נפל ב-{0}s", secs(unit.diedAtTick ?? 0))}
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
                <dt>{t("s64a471a", "נזק שעשה")}</dt>
                <dd>{unit.damageDealt.toLocaleString("he-IL")}</dd>
              </div>
              <div>
                <dt>{t("s6353210", "נזק שספג")}</dt>
                <dd>{unit.damageTaken.toLocaleString("he-IL")}</dd>
              </div>
              <div>
                <dt>{t("s48e7c57", "הפלות")}</dt>
                <dd>{unit.kills}</dd>
              </div>
              <div>
                <dt>{t("s95f2cfd", "מכות")}</dt>
                <dd>{unit.hits}</dd>
              </div>
            </dl>
          </div>
        </div>

        <ul className="log__facts">
          <li>
            <b>{t("sf9252a0", "מהנזק של הצד:")}</b> {share}%
          </li>
          <li>
            <b>{t("s80415c3", "חיים:")}</b> {unit.maxHp.toLocaleString("he-IL")}
            {unit.isKing && " " + t("s3ef4c7b", "(כולל בונוס מלך ×3)")}
          </li>
          <li>
            <b>{t("s5765650", "תזוזה:")}</b>{" "}
            {unit.colsMoved === 0
              ? t("s0cadd6e", "לא זז מילימטר")
              : tf("s1eeba78", "התקדם {0} משבצות", unit.colsMoved.toFixed(1))}
          </li>
        </ul>
      </div>
    </Overlay>
  );
}
