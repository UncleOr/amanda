/*
 * Composition, measured. Paste into the browser pane on any screen.
 *
 * Or: *"one of the things you fail at most is the division of the screen.
 * There are loads of empty areas and loads of crowded areas, there's no
 * correct hierarchy of what's important and what isn't, what should be next
 * to what, where the user's eye goes — the basics of UI/UX."*
 *
 * Every one of those is a judgement I kept getting wrong by eye, so this
 * turns the four of them into numbers:
 *
 *   DENSITY   the screen as a grid of cells, each one scored by how much
 *             drawn content covers it. Empty deserts and packed corners both
 *             show up as outliers against the median.
 *   DEAD AIR  the largest rectangle with nothing in it, as a share of the
 *             screen. One big hole is a layout problem; many small gaps are
 *             breathing room.
 *   EDGES     how many distinct left/right edges the content uses. A layout
 *             with a skeleton has few. One assembled piece by piece has one
 *             per piece, which is exactly what "not arranged nicely" is.
 *   EYE PATH  the biggest things in reading order (RTL: top→bottom, then
 *             right→left). The first thing listed is where the eye lands. If
 *             that is not the hero, the hierarchy is a lie.
 *
 * It reports; it does not judge. The thresholds are in SKILL.md §5b.
 */
(() => {
  const W = innerWidth;
  const H = innerHeight;
  const COLS = 12;
  const ROWS = 8;
  const cw = W / COLS;
  const ch = H / ROWS;

  /** Does this element actually draw anything? */
  const draws = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.05)
      return false;
    const hasText = [...el.childNodes].some(
      (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
    );
    const hasBg =
      cs.backgroundImage !== "none" ||
      (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent");
    const hasBorder = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
    const isMedia = /^(IMG|SVG|CANVAS|VIDEO)$/.test(el.tagName);
    return hasText || hasBg || hasBorder || isMedia;
  };

  // The full-screen backdrops are scenery, not content: counting them makes
  // every cell equally "full" and the whole measurement meaningless.
  const SCENERY = /intro__art|intro__room|intro__wash|intro__motes|app$|^$/;

  const boxes = [];
  for (const el of document.querySelectorAll("body *")) {
    const cls = String(el.className || "");
    if (SCENERY.test(cls)) continue;
    if (!draws(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.right < 0 || r.left > W || r.bottom < 0 || r.top > H) continue;
    // A box covering nearly the whole screen is a container, not content.
    if (r.width * r.height > W * H * 0.75) continue;
    boxes.push({ el, r, cls: cls.split(" ")[0] || el.tagName.toLowerCase() });
  }

  /* ── density grid ── */
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  for (const b of boxes) {
    const c0 = Math.max(0, Math.floor(b.r.left / cw));
    const c1 = Math.min(COLS - 1, Math.floor((b.r.right - 1) / cw));
    const r0 = Math.max(0, Math.floor(b.r.top / ch));
    const r1 = Math.min(ROWS - 1, Math.floor((b.r.bottom - 1) / ch));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) grid[r][c]++;
  }
  const flat = grid.flat();
  const used = flat.filter((n) => n > 0);
  const sorted = [...used].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const empty = flat.filter((n) => n === 0).length;
  const crowded = flat.filter((n) => n > median * 3).length;

  /* ── the largest empty rectangle, in grid cells ── */
  let best = { area: 0, r: 0, c: 0, h: 0, w: 0 };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== 0) continue;
      for (let h = 1; r + h <= ROWS; h++) {
        let w = 0;
        while (c + w < COLS) {
          let ok = true;
          for (let rr = r; rr < r + h; rr++) if (grid[rr][c + w] !== 0) ok = false;
          if (!ok) break;
          w++;
        }
        if (w === 0) break;
        if (h * w > best.area) best = { area: h * w, r, c, h, w };
      }
    }

  /* ── alignment: how many distinct edges ── */
  const round = (n) => Math.round(n / 3) * 3; // 3px tolerance
  const lefts = new Set();
  const rights = new Set();
  for (const b of boxes) {
    // Only STRUCTURE. A width test alone counted every chip and pill, so the
    // number went UP on a screen that had just been put on a twelve-column
    // grid — which is the opposite of what it is for.
    if (b.r.width * b.r.height < W * H * 0.012) continue;
    lefts.add(round(b.r.left));
    rights.add(round(b.r.right));
  }

  /* ── eye path: the biggest things, in RTL reading order ── */
  const weighty = boxes
    .filter((b) => {
      const cs = getComputedStyle(b.el);
      const size = parseFloat(cs.fontSize) || 0;
      // Something the eye lands on: big type, or a big block.
      return size >= 18 || b.r.width * b.r.height > W * H * 0.04;
    })
    // Drop anything that merely contains another weighty thing.
    .filter((b, _i, all) => !all.some((o) => o !== b && b.el.contains(o.el)))
    .sort((a, b) => a.r.top - b.r.top || b.r.right - a.r.right)
    .slice(0, 8)
    .map((b) => ({
      what: b.cls,
      at: `${Math.round(b.r.left)},${Math.round(b.r.top)}`,
      size: `${Math.round(b.r.width)}x${Math.round(b.r.height)}`,
      type: Math.round(parseFloat(getComputedStyle(b.el).fontSize)) + "px",
      text: (b.el.textContent || "").trim().slice(0, 22),
    }));

  const pct = (n) => Math.round((n / flat.length) * 100);
  return {
    viewport: `${W}x${H}`,
    blocks: boxes.length,
    density: {
      map: grid.map((row) => row.map((n) => (n === 0 ? "·" : n > median * 3 ? "#" : n > median ? "+" : "-")).join("")),
      emptyCells: `${empty}/${flat.length} (${pct(empty)}%)`,
      crowdedCells: `${crowded} (${pct(crowded)}%)`,
      median,
    },
    deadAir: best.area
      ? { cells: `${best.w}x${best.h}`, share: `${pct(best.area)}%`, atRow: best.r, atCol: best.c }
      : null,
    edges: { distinctLeft: lefts.size, distinctRight: rights.size },
    eyePath: weighty,
  };
})();
