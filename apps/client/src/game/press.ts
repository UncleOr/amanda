/**
 * **A press that answers on the same frame it was pressed.**
 *
 * Or, with a screen recording of himself taking a challenge: *"watch how you
 * press 'take' and it turns into a button with three dots on it… think about
 * it, this is the FUN moment of the game. All these presses have to be an
 * experience — fun, exploding, and responding immediately."* And, with a
 * second recording, about the upgrade button: *"you press upgrade and it
 * takes a few seconds until anything moves there. Not fun."*
 *
 * Both recordings show the same thing, and it is not slowness exactly — it
 * is that the whole of the feedback was waiting on a server. Press, dots,
 * nothing, nothing, and then a number somewhere is different. The pay-off
 * for an evening of play arrived as a spinner.
 *
 * ═══ THE PRESS IS ITS OWN EVENT ═══
 *
 * The thing a child presses and the thing a database writes are two separate
 * events that happen to be related, and only one of them has to be waited
 * for. This is the first one: it runs synchronously, on the pointer event,
 * before a single byte goes anywhere.
 *
 * Plain DOM, for the same reason reward.ts is (see the note there): the
 * chips are in the air above everything and belong to no component. It also
 * means any button in the game can have this with one line and nothing has
 * to be lifted into state.
 *
 * ⚠ IT NEVER THROWS AND NEVER AWAITS. Everything below is decoration, and a
 * decoration that can break the thing it decorates is worse than no
 * decoration. The caller's next line runs whatever happens here.
 */
import { sfx, type SoundName } from "./sfx";
import { haptics, type Buzz } from "./haptics";

/** The game's own palette, so a burst belongs to this game and not to a library. */
const CHIPS = ["#ffd166", "#5ce1e6", "#ff8fab", "#9af06a", "#ffffff"];

/** How long the chips live. Long enough to read, short enough to be a burst. */
const LIFE = 620;

export interface Press {
  /** One of sfx's names, played at once. Leave out for a silent press. */
  sound?: SoundName;
  /**
   * What the phone does, if it does anything.
   *
   * Or: *"the small vibrations there are now can be on button presses —
   * going into the shop, into the tunnel, into a game. But during the game
   * itself there needs to be a more significant vibration."*
   *
   * So a press is a TAP by default — the lightest thing in the set, because
   * it happens more than anything else — and the handful of presses that
   * are events in their own right say so: a chest, a prize. `false` for a
   * press that must stay still.
   */
  buzz?: Buzz | false;
  /** How many chips fly. 0 for a press with no confetti. */
  chips?: number;
  /** Chip colours, if this press wants its own. */
  colors?: readonly string[];
}

const still = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * Thump the button and throw confetti out of it. Returns immediately.
 *
 * The squash is on the button itself and the chips are on the body, which is
 * deliberate: a button that only threw confetti would still feel dead under
 * the thumb, and a button that only squashed would be a button rather than a
 * prize. The two together are what reads as "it went off".
 */
export function pressed(el: HTMLElement | null | undefined, opts: Press = {}): void {
  try {
    if (opts.sound) sfx.play(opts.sound);
    if (opts.buzz !== false) haptics.buzz(opts.buzz ?? "tap");
    if (!el || still()) return;

    /*
     * Down and back, slightly past where it started. A pure scale-down reads
     * as the button being disabled; the overshoot is what makes it a thump.
     */
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.9)", offset: 0.22 },
        { transform: "scale(1.06)", offset: 0.55 },
        { transform: "scale(1)" },
      ],
      { duration: 260, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.4)" },
    );

    const count = opts.chips ?? 14;
    if (count <= 0) return;
    const box = el.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const colors = opts.colors ?? CHIPS;

    for (let i = 0; i < count; i++) {
      const chip = document.createElement("i");
      chip.setAttribute("aria-hidden", "true");
      const size = 4 + Math.random() * 5;
      /*
       * ⚠ NO `will-change`. See the burst below for the whole story: it is
       * a standing promise to the compositor that this element will keep
       * moving, on a thing that lives for a second and is then deleted.
       */
      chip.style.cssText =
        `position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size * 1.6}px;` +
        `background:${colors[i % colors.length]};border-radius:1px;pointer-events:none;` +
        `z-index:9999`;
      document.body.appendChild(chip);

      /*
       * Thrown UPWARDS and outwards, then dropped. A ring that expands
       * evenly looks like a loading spinner; gravity is what makes it
       * confetti. The angles are biased to the upper half for the same
       * reason — things that celebrate go up first.
       */
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const speed = 60 + Math.random() * 110;
      const dx = Math.cos(a) * speed;
      const up = Math.sin(a) * speed;
      const fall = 90 + Math.random() * 120;
      const spin = (Math.random() - 0.5) * 900;

      /*
       * ═══ THE BURNT PIXEL ═══
       *
       * Or, twice: *"there is some annoying bug — when there are diamonds
       * or other things flying there is a 'burnt' pixel on the screen"*,
       * and then *"the pixel is still there."* The first search went to
       * reward.ts, which throws the diamonds; this is the thing that throws
       * fourteen four-pixel rectangles out of EVERY press in the game,
       * including the press that starts the diamonds flying.
       *
       * Three faults, and any one of them is enough to leave one lit:
       *
       *   NO `fill`. The last keyframe is opacity 0 — and with no fill the
       *   chip SNAPS BACK to its base style the moment the animation ends:
       *   full opacity, back at the button. It then sits there, visible,
       *   until a timer removes it up to 400ms later. On a frame where the
       *   main thread is busy — opening a chest, changing screen — that
       *   timer is late and the chip stays.
       *
       *   NO `cancel` BEFORE REMOVAL. A composited layer deleted while its
       *   animation still holds a painted frame is the classic ghost tile.
       *
       *   `will-change` FOR EVER, on an element that lives for a second.
       *
       * So: hold the last frame, cancel on the way out, and take the layer
       * back. And remove on `finished` as well as on the timer — with the
       * cancel in `gone`, `finished` settling late or not at all costs
       * nothing, because the timer is still the floor.
       */
      const run = chip.animate(
        [
          { transform: "translate(-50%, -50%) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${up}px)) rotate(${spin * 0.5}deg)`,
            opacity: 1,
            offset: 0.45,
          },
          {
            transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${up + fall}px)) rotate(${spin}deg)`,
            opacity: 0,
          },
        ],
        {
          duration: LIFE + Math.random() * 220,
          easing: "cubic-bezier(0.25, 0.6, 0.4, 1)",
          fill: "forwards",
        },
      );
      const gone = () => {
        for (const a of chip.getAnimations()) a.cancel();
        chip.remove();
      };
      run.finished.then(gone, gone);
      window.setTimeout(gone, LIFE + 400);
    }
  } catch {
    /* Decoration. If it cannot run, the press still counts. */
  }
}
