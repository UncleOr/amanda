import { useMemo, useState } from "react";
import { ACTIONS, CATALOG, SERIES } from "../data/catalog";
import { CardView } from "./CardView";
import { ActionCardView } from "./ActionCardView";
import { Icon } from "./Icon";

/**
 * The playground's card rack.
 *
 * Every card in the game, on tap, at any moment — which is the whole point of
 * the mode: "שאפשר לבחור בכל רגע נתון מבין כל הקלפים". Not a deck, not a hand,
 * not something you spend. The card you pick stays picked so a board can be
 * filled by tapping, and the eraser is just "nothing picked".
 *
 * Unlike the album it shows cards that have not launched yet too — a bench is
 * for trying things, including the ones not in anybody's collection.
 */
export function CardPicker({
  picked,
  onPick,
  onInfo,
}: {
  /** The card currently in hand, or null while the eraser is on. */
  picked: string | null;
  onPick: (cardId: string | null) => void;
  onInfo: (cardId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [openSeries, setOpenSeries] = useState<string>("all");

  const needle = query.trim();
  const groups = useMemo(() => {
    const matches = (id: string, he: string, en: string) =>
      !needle || he.includes(needle) || en.toLowerCase().includes(needle.toLowerCase()) || id.includes(needle);
    const out = SERIES.filter((s) => openSeries === "all" || s.id === openSeries).map((s) => ({
      id: s.id,
      name: s.name.he,
      cards: s.cards
        .filter((c) => CATALOG.has(c.id))
        .filter((c) => matches(c.id, c.name.he, c.name.en))
        .map((c) => c.id),
    }));
    return out.filter((g) => g.cards.length > 0);
  }, [needle, openSeries]);

  const actions = useMemo(() => {
    if (openSeries !== "all" && openSeries !== "actions") return [];
    return [...ACTIONS.values()]
      .filter((a) => !needle || a.name.he.includes(needle) || a.id.includes(needle))
      .map((a) => a.id);
  }, [needle, openSeries]);

  return (
    <aside className="rack">
      <div className="rack__bar">
        <button
          className={`rack__erase${picked === null ? " rack__erase--on" : ""}`}
          onClick={() => onPick(null)}
          title="בלי קלף ביד — נגיעה בקלף על הלוח מורידה אותו"
        >
          <Icon name="erase" size={14} /> מחק
        </button>
        <input
          className="rack__search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש קלף…"
          inputMode="search"
        />
      </div>

      <div className="rack__tabs">
        <button
          className={`rack__tab${openSeries === "all" ? " rack__tab--on" : ""}`}
          onClick={() => setOpenSeries("all")}
        >
          הכול
        </button>
        {SERIES.map((s) => (
          <button
            key={s.id}
            className={`rack__tab${openSeries === s.id ? " rack__tab--on" : ""}`}
            onClick={() => setOpenSeries(s.id)}
          >
            {s.name.he}
          </button>
        ))}
        <button
          className={`rack__tab${openSeries === "actions" ? " rack__tab--on" : ""}`}
          onClick={() => setOpenSeries("actions")}
        >
          פעולה
        </button>
      </div>

      <div className="rack__scroll">
        {groups.map((g) => (
          <section key={g.id} className="rack__group">
            <h4>{g.name}</h4>
            <div className="rack__row">
              {g.cards.map((id) => (
                <button
                  key={id}
                  className={`rack__card${picked === id ? " rack__card--on" : ""}`}
                  onClick={() => onPick(id)}
                  onDoubleClick={() => onInfo(id)}
                  title={CATALOG.get(id)?.name.he}
                >
                  <CardView cardId={id} size="small" />
                </button>
              ))}
            </div>
          </section>
        ))}

        {actions.length > 0 && (
          <section className="rack__group">
            <h4>קלפי פעולה</h4>
            <div className="rack__row">
              {actions.map((id) => (
                <button
                  key={id}
                  className={`rack__card${picked === id ? " rack__card--on" : ""}`}
                  onClick={() => onPick(id)}
                  onDoubleClick={() => onInfo(id)}
                  title={ACTIONS.get(id)?.name.he}
                >
                  <ActionCardView actionId={id} size="small" />
                </button>
              ))}
            </div>
          </section>
        )}

        {groups.length === 0 && actions.length === 0 && (
          <p className="rack__none">אין קלף כזה. המצאת אותו?</p>
        )}
      </div>
    </aside>
  );
}
