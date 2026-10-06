/**
 * Gifts: what a promotion gives, and who it reaches.
 *
 * Or: "give me an option to release a new card and hand it out free to
 * everybody, or to everyone above/below a certain level, or by any filter I
 * want, including scheduling it — say a present for a holiday."
 *
 * ═══ WHY THE FILTERS ARE A CLOSED LIST AND NOT A QUERY ═══
 *
 * "Any filter I want" is the request, and a text box where Or writes SQL is
 * the shortest way to grant it. It is also a box in which one typo gives ten
 * thousand people a legendary card, with no undo — and a box that runs
 * arbitrary SQL against the players table from the admin panel, which is the
 * single most dangerous thing this game could have.
 *
 * So the filters are a list, every one of them a thing Or actually asked for,
 * and adding another is three lines here. They are ANDed: each one narrows.
 *
 * Both the admin screen and the server read this file, so what the preview
 * counted and what the gift reaches cannot drift apart.
 */

export interface GrantGives {
  /** Cards, by id, with how many copies each. */
  cards?: Array<{ cardId: string; copies: number }>;
  diamonds?: number;
  /** Shop items — avatars, emoji, skins — handed over without paying. */
  items?: string[];
  /** A chest to open, by kind. */
  chest?: string;
}

export interface GrantFilters {
  /** At least this many trophies. */
  minTrophies?: number;
  /** At most this many. Together with the above: a band. */
  maxTrophies?: number;
  /** In this arena — expressed as a trophy band, resolved from arenas.ts. */
  arenaId?: string;
  /** Joined before / after this date (ISO). "Everybody who was here first." */
  joinedBefore?: string;
  joinedAfter?: string;
  /** Seen in the last N days. Or's "whoever played this week". */
  activeWithinDays?: number;
  /** Only real accounts, not the anonymous one everybody gets on first visit. */
  registeredOnly?: boolean;
  /** Only people who do NOT already hold this card — so a gift is a gift. */
  missingCardId?: string;
}

/** What each filter is called on screen, and what it does in a sentence. */
export const FILTER_LABELS: Record<keyof GrantFilters, { he: string; note: string }> = {
  minTrophies: { he: "לפחות X גביעים", note: "לא לשחקנים חדשים." },
  maxTrophies: { he: "עד X גביעים", note: "דווקא לשחקנים חדשים, או למי שנתקע." },
  arenaId: { he: "בארנה", note: "בדיוק טווח הגביעים של אותה ארנה." },
  joinedBefore: { he: "הצטרף לפני", note: "מי שהיה כאן מההתחלה." },
  joinedAfter: { he: "הצטרף אחרי", note: "רק החדשים." },
  activeWithinDays: { he: "שיחק ב-X הימים האחרונים", note: "לא להעיר מי שכבר עזב." },
  registeredOnly: { he: "רק עם חשבון", note: "חשבון אורח נזרק בניקוי הדפדפן; מתנה אליו נעלמת." },
  missingCardId: { he: "למי שאין לו את הקלף", note: "שמתנה תהיה מתנה ולא עותק מיותר." },
};

/**
 * Promotion shapes worth having the structure ready for.
 *
 * Or asked me to think of more. These are not built yet — they are written
 * down here because each one is a row in `grants` plus a trigger, and the
 * point of listing them now is that none of them needs a new table.
 */
export const PROMO_IDEAS = [
  "תיבה יומית, ורצף כניסות",
  "אירוע לזמן מוגבל — ארנה מיוחדת, כפל גביעים לסוף שבוע",
  "קוד מתנה להזנה",
  "הבא חבר — שניכם מקבלים",
  "קלף השבוע במחיר מוזל",
  "פיצוי אוטומטי אחרי תקלה",
] as const;

/** Is there anything here at all? An empty gift is a mistake, not a choice. */
export function givesSomething(g: GrantGives): boolean {
  return (
    (g.cards?.length ?? 0) > 0 ||
    (g.diamonds ?? 0) > 0 ||
    (g.items?.length ?? 0) > 0 ||
    !!g.chest
  );
}

/** Plain Hebrew for what a gift contains, for the confirmation step. */
export function describeGives(g: GrantGives): string {
  const parts: string[] = [];
  for (const c of g.cards ?? [])
    parts.push(c.copies > 1 ? `${c.copies} עותקים של ${c.cardId}` : c.cardId);
  if (g.diamonds) parts.push(`${g.diamonds} יהלומים`);
  if (g.items?.length) parts.push(`${g.items.length} פריטים`);
  if (g.chest) parts.push(`תיבת ${g.chest}`);
  return parts.length ? parts.join(" · ") : "כלום";
}
