import { useCallback, useEffect, useState } from "react";
import { openChest, unopenedChests, type Chest } from "../game/account";
import { Icon } from "./Icon";

/**
 * The chests waiting for you, on the home screen.
 *
 * Or: "show buttons for chests that haven't been opened yet and prizes that
 * haven't been taken — interactive and inviting and fun."
 *
 * This could not exist a day ago. Winning a chest also opened it, in the same
 * breath, on the server — so there was never such a thing as an unopened
 * chest. Which is a shame, because an unopened chest is the single thing in a
 * game like this that makes somebody come back tomorrow.
 *
 * Nothing here decides anything. What is inside was sealed when the match was
 * won; tapping asks the server to break the seal.
 */
const BASE = import.meta.env.BASE_URL;

const ART: Record<string, string> = {
  wood: "chest_wood.png",
  silver: "chest_silver.png",
  gold: "chest_gold.png",
};

export function ChestShelf({
  onOpened,
  reload,
}: {
  /** Hand the opened chest up so the reveal can play over the whole screen. */
  onOpened: (chest: Chest) => void;
  /** The album and the purse changed, so whoever owns them should look again. */
  reload: () => void;
}) {
  const [chests, setChests] = useState<Chest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let alive = true;
    void unopenedChests().then((list) => alive && setChests(list));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(load, [load]);

  if (!chests.length) return null;

  return (
    <div className="shelf" aria-label="תיבות שמחכות לך">
      {chests.slice(0, 4).map((chest) => (
        <button
          key={chest.id}
          className={`shelf__chest shelf__chest--${chest.kind}`}
          disabled={busy === chest.id}
          title="פתח"
          onClick={() => {
            setBusy(chest.id);
            void openChest(chest.id).then((opened) => {
              setBusy(null);
              if (!opened) return; // still there; try again
              setChests((list) => list.filter((c) => c.id !== chest.id));
              onOpened(opened);
              reload();
            });
          }}
        >
          <img src={`${BASE}scenes/${ART[chest.kind] ?? ART.wood}`} alt="" />
        </button>
      ))}
      {chests.length > 4 && (
        <span className="shelf__more">
          <Icon name="chest" size={16} /> +{chests.length - 4}
        </span>
      )}
    </div>
  );
}
