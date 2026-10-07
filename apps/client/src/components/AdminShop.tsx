import { useCallback, useEffect, useState } from "react";
import { CATALOG } from "../data/catalog";
import { AVATAR_IDS } from "./Profile";

/**
 * The shop, from Or's side.
 *
 * His constraint, in his own words: "every item in the shop is a row and not
 * code." So this screen writes rows — nothing in the game knows the name of a
 * single item, and adding one never needs a deploy.
 *
 * The price in cents is deliberately not editable here. Real money is a later
 * decision and it brings a store's billing with it; the COLUMN exists so that
 * switching one item on later is an update rather than a migration, and
 * leaving it off this screen means it cannot be set by accident in the
 * meantime.
 */
interface Item {
  id: string;
  kind: "avatar" | "emoji" | "skin" | "card" | "chest" | "phrase";
  name: { he: string; en?: string };
  blurb: { he: string; en?: string } | null;
  grants: Record<string, unknown>;
  price_diamonds: number;
  price_cents: number | null;
  art: string | null;
  active: boolean;
  sort: number;
  available_from: string | null;
  available_until: string | null;
  sale_price_diamonds: number | null;
  sale_until: string | null;
}

type Call = (path: string, body?: unknown) => Promise<Record<string, unknown>>;

const EMPTY: Item = {
  id: "",
  kind: "avatar",
  name: { he: "" },
  blurb: null,
  grants: {},
  price_diamonds: 0,
  price_cents: null,
  art: null,
  active: true,
  sort: 0,
  available_from: null,
  available_until: null,
  sale_price_diamonds: null,
  sale_until: null,
};

const KINDS: Array<{ id: Item["kind"]; he: string }> = [
  { id: "avatar", he: "פרצוף" },
  { id: "emoji", he: "אימוג׳י" },
  { id: "skin", he: "מראה לקלף" },
  { id: "chest", he: "תיבה" },
  { id: "card", he: "קלף" },
  /*
   * Catchphrases have been sellable since the migration that added them to
   * the kind check — and were missing from THIS list, so there was no way to
   * make one from the screen whose job is making them. Every phrase in the
   * shop today got there by a hand-written migration.
   */
  { id: "phrase", he: "משפט מחץ" },
];

export function ShopTab({ call, say }: { call: Call; say: (s: string) => void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState<Item>(EMPTY);

  const refresh = useCallback(async () => {
    const r = await call("/api/admin/shop");
    setItems((r.items as Item[]) ?? []);
  }, [call]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function save() {
    if (!draft.id.trim()) return say("צריך מזהה, באנגלית");
    if (!draft.name.he.trim()) return say("צריך שם");
    const r = await call("/api/admin/shop/save", {
      id: draft.id.trim(),
      kind: draft.kind,
      name: draft.name,
      blurb: draft.blurb,
      grants: draft.grants,
      priceDiamonds: draft.price_diamonds,
      art: draft.art,
      active: draft.active,
      sort: draft.sort,
      availableFrom: draft.available_from,
      availableUntil: draft.available_until,
      salePrice: draft.sale_price_diamonds,
      saleUntil: draft.sale_until,
    });
    if (r.error) return say(String(r.error));
    say("נשמר.");
    setDraft(EMPTY);
    await refresh();
  }

  /** Is this one on sale right now? Mirrors priceNow on the server. */
  function onSale(i: Item): boolean {
    return (
      i.sale_price_diamonds !== null &&
      i.sale_price_diamonds < i.price_diamonds &&
      !!i.sale_until &&
      i.sale_until >= new Date().toISOString()
    );
  }

  /**
   * On the shelf, or off it — in one tap, from the list.
   *
   * Sends the WHOLE item back rather than a patch, because the save endpoint
   * is an upsert of the whole row: sending `{id, active}` alone would write
   * an item with no name and no price. The one field that changes is `active`.
   */
  async function shelve(item: Item, active: boolean) {
    const r = await call("/api/admin/shop/save", {
      id: item.id,
      kind: item.kind,
      name: item.name,
      blurb: item.blurb,
      grants: item.grants,
      priceDiamonds: item.price_diamonds,
      art: item.art,
      active,
      sort: item.sort,
      availableFrom: item.available_from,
      availableUntil: item.available_until,
      salePrice: item.sale_price_diamonds,
      saleUntil: item.sale_until,
    });
    if (r.error) return say(String(r.error));
    await refresh();
  }

  async function drop(item: Item) {
    if (!window.confirm(`למחוק את "${item.name.he}" מהחנות?`)) return;
    await call("/api/admin/shop/delete", { id: item.id });
    await refresh();
  }

  /** What the item hands over depends on what kind of thing it is. */
  const grantsEditor = () => {
    if (draft.kind === "avatar")
      return (
        <label className="fld">
          <span>איזה פרצוף</span>
          <select
            value={(draft.grants.avatar as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, grants: { avatar: e.target.value } })}
          >
            <option value="">— בחר —</option>
            {AVATAR_IDS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
      );
    if (draft.kind === "card" || draft.kind === "skin")
      return (
        <label className="fld">
          <span>איזה קלף</span>
          <select
            value={(draft.grants.cardId as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, grants: { ...draft.grants, cardId: e.target.value } })}
          >
            <option value="">— בחר —</option>
            {[...CATALOG.values()]
              .filter((c) => c.id !== "crumb_demon")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name.he}
                </option>
              ))}
          </select>
        </label>
      );
    if (draft.kind === "chest")
      return (
        <label className="fld">
          <span>איזו תיבה</span>
          <select
            value={(draft.grants.kind as string) ?? ""}
            onChange={(e) => setDraft({ ...draft, grants: { kind: e.target.value } })}
          >
            <option value="">— בחר —</option>
            <option value="wood">עץ</option>
            <option value="silver">כסף</option>
            <option value="gold">זהב</option>
          </select>
        </label>
      );
    return null;
  };

  return (
    <div className="admin__pane gifts">
      <section className="gifts__editor">
        <h2>{items.some((i) => i.id === draft.id) ? "עריכת פריט" : "פריט חדש"}</h2>

        <div className="gifts__gives">
          <label className="fld fld--narrow">
            <span>מזהה</span>
            <input
              value={draft.id}
              onChange={(e) => setDraft({ ...draft, id: e.target.value })}
              placeholder="avatar.astronaut"
              dir="ltr"
            />
          </label>
          <label className="fld fld--narrow">
            <span>סוג</span>
            <select
              value={draft.kind}
              onChange={(e) =>
                setDraft({ ...draft, kind: e.target.value as Item["kind"], grants: {} })
              }
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.he}
                </option>
              ))}
            </select>
          </label>
          <label className="fld">
            <span>שם</span>
            <input
              value={draft.name.he}
              onChange={(e) => setDraft({ ...draft, name: { ...draft.name, he: e.target.value } })}
            />
          </label>
        </div>

        <label className="fld">
          <span>שורה קטנה מתחת (לא חובה)</span>
          <input
            value={draft.blurb?.he ?? ""}
            onChange={(e) =>
              setDraft({ ...draft, blurb: e.target.value ? { he: e.target.value } : null })
            }
          />
        </label>

        {grantsEditor()}

        <div className="gifts__gives">
          <label className="fld fld--narrow">
            <span>מחיר ביהלומים</span>
            <input
              type="number"
              min={0}
              value={draft.price_diamonds}
              onChange={(e) => setDraft({ ...draft, price_diamonds: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="fld fld--narrow">
            <span>סדר</span>
            <input
              type="number"
              value={draft.sort}
              onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) || 0 })}
            />
          </label>
          <label className="fld fld--check">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            <span>בחנות</span>
          </label>
        </div>

        {/* A window sells the thing by itself: a weekend item is two dates
            rather than somebody remembering to switch it off on Monday. */}
        <div className="gifts__gives">
          <label className="fld">
            <span>מופיע מ־ (לא חובה)</span>
            <input
              type="datetime-local"
              value={draft.available_from?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  available_from: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </label>
          <label className="fld">
            <span>ועד</span>
            <input
              type="datetime-local"
              value={draft.available_until?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  available_until: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </label>
        </div>

        {/*
          ═══ A SALE IS A PRICE WITH A DEADLINE ═══

          Or asked for *"sales"*. Both fields or neither: the server refuses
          to honour a discount with no end date, because a price that never
          goes back up is not a sale, it is a price — and the shop would show
          a struck-through "was" beside it forever.

          The full price stays where it is, which is the other half of it. A
          tile that says 80 where it used to say 120, with no 120 on it, is a
          tile that says 80.
        */}
        <div className="gifts__gives">
          <label className="fld fld--narrow">
            <span>מחיר במבצע (ריק = אין מבצע)</span>
            <input
              type="number"
              min={0}
              value={draft.sale_price_diamonds ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sale_price_diamonds: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="fld">
            <span>המבצע נגמר ב־</span>
            <input
              type="datetime-local"
              value={draft.sale_until?.slice(0, 16) ?? ""}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  sale_until: e.target.value ? new Date(e.target.value).toISOString() : null,
                })
              }
            />
          </label>
        </div>
        {draft.sale_price_diamonds !== null && !draft.sale_until && (
          <p className="gifts__hint">בלי תאריך סיום זה לא מבצע, זה פשוט מחיר. המבצע לא יחול.</p>
        )}

        <div className="gifts__actions">
          <button className="btn-fight" onClick={() => void save()}>
            שמירה
          </button>
          <button className="btn-fight btn-ghost" onClick={() => setDraft(EMPTY)}>
            חדש
          </button>
        </div>
      </section>

      <section className="gifts__list">
        <h2>על המדפים</h2>
        {items.length === 0 ? (
          <p className="gifts__hint">החנות ריקה.</p>
        ) : (
          <table className="admin__table">
            <thead>
              <tr>
                <th>שם</th>
                <th>סוג</th>
                <th>מחיר</th>
                <th>בחנות</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.name.he}
                    <br />
                    <small className="dim" dir="ltr">
                      {i.id}
                    </small>
                  </td>
                  <td className="dim">{KINDS.find((k) => k.id === i.kind)?.he ?? i.kind}</td>
                  <td className="dim">
                    {onSale(i) ? (
                      <>
                        <s>{i.price_diamonds}</s> <b>{i.sale_price_diamonds}</b>
                      </>
                    ) : (
                      i.price_diamonds || "חינם"
                    )}
                  </td>
                  {/*
                    Or: *"…and to temporarily take down from the shop."* It
                    was already possible and it was three steps — open the
                    item, find the checkbox, save. Taking something off the
                    shelf for an hour is a thing you do in a hurry, so it is
                    one tap here, where you are already looking at the shelf.
                  */}
                  <td>
                    <input
                      type="checkbox"
                      checked={i.active}
                      title={i.active ? "להוריד זמנית מהחנות" : "להחזיר לחנות"}
                      onChange={() => void shelve(i, !i.active)}
                    />
                  </td>
                  <td className="admin__row-actions">
                    <button onClick={() => setDraft(i)}>עריכה</button>
                    <button className="danger" onClick={() => void drop(i)}>
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
