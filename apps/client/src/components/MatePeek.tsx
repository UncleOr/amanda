import { useState } from "react";
import { BoardGrid } from "./BoardGrid";
import { Icon } from "./Icon";
import { useCompact } from "../game/useCompact";
import type { ComponentProps } from "react";
import { Overlay } from "./Overlay";

type GridProps = ComponentProps<typeof BoardGrid>;

/**
 * Your partner's half in Amanda mode — a thumbnail on a phone, opened on tap.
 *
 * Or, after playing it with Hod on a phone: *"two against Amanda on mobile —
 * you can't see what is going on because it is so small. Maybe there should
 * be some small screen showing your partner, and tapping it makes it bigger
 * with an X to close."*
 *
 * ═══ WHY THE PHONE GETS A DIFFERENT THING AND NOT A SMALLER ONE ═══
 *
 * Amanda mode puts EIGHT lanes on the screen: four yours, four your
 * partner's, against her. On a desktop that is a second board beside your
 * own. On a 384-tall phone it is the same board at half the height — every
 * card a smudge, which is what Or was looking at.
 *
 * Shrinking it further is not the answer and neither is dropping it: knowing
 * what your partner built is the entire mode. So on a phone it becomes a
 * THUMBNAIL — enough to see that something is there and roughly where — and
 * tapping it gives the full board at the size it needs, over everything else,
 * for as long as you want it.
 *
 * On anything with room it stays exactly as it was: inline, beside your own,
 * nothing to tap.
 */
export function MatePeek({ label, ...grid }: GridProps & { label: string }) {
  const compact = useCompact();
  const [open, setOpen] = useState(false);

  if (!compact)
    return (
      <div className="mate mate--theirs">
        <div className="mate__label">
          <Icon name="friend" size={13} /> {label}
        </div>
        <BoardGrid {...grid} compact />
      </div>
    );

  return (
    <>
      <button
        className="mate mate--peek"
        onClick={() => setOpen(true)}
        title="להגדיל את החצי של מי שאיתך"
      >
        <span className="mate__label">
          <Icon name="friend" size={11} /> {label}
        </span>
        {/*
          A picture, not a board: nothing in here is tappable, because the
          whole tile is one tap that opens the real thing. A thumbnail with
          live cells would be a board you cannot hit.
        */}
        <span className="mate__thumb" aria-hidden="true">
          <BoardGrid {...grid} compact />
        </span>
        <span className="mate__grow">
          <Icon name="plus" size={12} />
        </span>
      </button>

      {open && (
        <Overlay onClick={() => setOpen(false)}>
          <div className="modal modal--mate" onClick={(e) => e.stopPropagation()}>
            <button className="modal__close" onClick={() => setOpen(false)} title="סגירה">
              <Icon name="exit" size={15} />
            </button>
            <h2 className="mate__title">
              <Icon name="friend" size={18} /> {label}
            </h2>
            <BoardGrid {...grid} />
          </div>
        </Overlay>
      )}
    </>
  );
}
