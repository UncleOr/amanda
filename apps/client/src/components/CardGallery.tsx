import { useState } from "react";
import { ACTIONS, CATALOG, SERIES } from "../data/catalog";
import { CardView } from "./CardView";
import { CardDetailModal } from "./CardDetailModal";
import { ActionCardView } from "./ActionCardView";
import { ActionDetailModal } from "./ActionDetailModal";

/**
 * Art-review gallery (open the game with ?gallery). Shows every launch card at
 * board size and hand size so artwork and the card template can be checked
 * together, exactly as they render in play.
 */
export function CardGallery() {
  const [detail, setDetail] = useState<string | null>(null);
  const [onlyArt, setOnlyArt] = useState(false);
  const [actionDetail, setActionDetail] = useState<string | null>(null);

  return (
    <div className="gallery">
      <header className="gallery__bar">
        <h2>גלריית קלפים</h2>
        <label>
          <input type="checkbox" checked={onlyArt} onChange={(e) => setOnlyArt(e.target.checked)} />{" "}
          רק קלפים עם ציור
        </label>
      </header>

      {SERIES.map((s) => {
        const cards = s.cards
          .filter((c) => c.launch)
          .filter((c) => !onlyArt || c.art.sprite);
        if (!cards.length) return null;
        return (
          <section key={s.id} className="gallery__series">
            <h3>
              {s.name.he} <small>({cards.length})</small>
            </h3>
            <div className="gallery__row">
              {cards.map((c) => (
                <div key={c.id} className="gallery__item">
                  <div className="gallery__slot gallery__slot--board">
                    <CardView cardId={c.id} size="medium" onInfo={() => setDetail(c.id)} />
                  </div>
                  <div className="gallery__slot gallery__slot--hand">
                    <CardView
                      cardId={c.id}
                      size="large"
                      king={c.midBoss}
                      onInfo={() => setDetail(c.id)}
                    />
                  </div>
                  <span className="gallery__cap">{CATALOG.get(c.id)?.name.he}</span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="gallery__series">
        <h3>
          קלפי פעולה <small>({ACTIONS.size})</small>
        </h3>
        <div className="gallery__row">
          {[...ACTIONS.keys()].map((id) => (
            <div key={id} className="gallery__item">
              <div className="gallery__slot gallery__slot--board">
                <ActionCardView actionId={id} size="medium" onInfo={() => setActionDetail(id)} />
              </div>
              <div className="gallery__slot gallery__slot--hand">
                <ActionCardView actionId={id} size="large" onInfo={() => setActionDetail(id)} />
              </div>
              <span className="gallery__cap">{ACTIONS.get(id)?.name.he}</span>
            </div>
          ))}
        </div>
      </section>

      {detail && <CardDetailModal cardId={detail} onClose={() => setDetail(null)} />}
      {actionDetail && (
        <ActionDetailModal actionId={actionDetail} onClose={() => setActionDetail(null)} />
      )}
    </div>
  );
}
