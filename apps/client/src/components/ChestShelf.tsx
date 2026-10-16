import { useCallback, useEffect, useState } from "react";
import { openChest, unopenedChests, type Chest } from "../game/account";
import { Icon } from "./Icon";
import { line as t } from "../game/copy";

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
    <div className="shelf" aria-label={t("sb1a59ea", "תיבות שמחכות לך")}>
      {chests.slice(0, 4).map((chest) => (
        <button
          key={chest.id}
          className={`shelf__chest shelf__chest--${chest.kind}`}
          disabled={busy === chest.id}
          title={t("s97a626f", "פתח")}
          /*
           * ═══ THE CHEST OPENS NOW, NOT WHEN THE SERVER ANSWERS ═══
           *
           * Or: *"chests take a while to open, it's annoying."*
           *
           * Measured: the tap fired a request to Railway, which asks
           * Supabase to check the chest, mark it open, grant the cards and
           * add the diamonds — half a dozen round trips — and ONLY then did
           * the reveal screen appear. A quarter of a second of nothing after
           * a seven-year-old presses a treasure chest.
           *
           * And it was never necessary: `unopenedChests` already reads
           * `contents` out of the player's own row, so the browser knows
           * what is inside before it asks. The server call is what makes it
           * TRUE — marks it open, puts the cards in the album, pays the
           * diamonds — and none of that is anything the reveal has to wait
           * for.
           *
           * So the screen opens on the tap, with what we already hold, and
           * the answer lands during the chest's own 480ms of rattling. The
           * second `onOpened` fills in `fresh` — which cards were new — and
           * that is not read until every card has turned over, a second and
           * a half later.
           */
          onClick={() => {
            setBusy(chest.id);
            onOpened(chest);
            setChests((list) => list.filter((c) => c.id !== chest.id));
            void openChest(chest.id).then((opened) => {
              setBusy(null);
              // Which of them the album had never held — the one thing only
              // the server can say, arriving while the lid is still shut.
              if (opened) onOpened(opened);
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
