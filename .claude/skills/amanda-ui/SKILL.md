---
name: amanda-ui
description: "The look of Amanda: hierarchy, type, colour, space and words. Load before changing ANY screen, and run its audit before calling one done."
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# How Amanda's screens are built

Or, after a day of me fixing overflows: *"I feel I didn't make myself clear:
this goes beyond fitting pixels to screens. All our screens don't look good.
The information isn't laid out smartly, logically or beautifully. Things
aren't arranged nicely on the screen. A lot of it isn't readable, there's no
hierarchy, and there are tons of unnecessary texts that you put in even though
I asked a thousand times not to."*

He is right, and the measurements agreed with him. Before this skill existed:

| | | |
|---|---|---|
| **23** distinct font sizes | 176 of the rules sat between 11px and 13px | so nothing could be bigger than anything |
| **36** uses of `--muted` against **28** of `--text` | more of the game was grey than was readable | grey was the default, white the exception |
| **~20** panel backgrounds | differing by 1–3% opacity | twenty surfaces that all read as one |
| **31** sentences of prose in `<p>` tags | on screens whose job is to be played | after being asked repeatedly to stop |

Four numbers, one cause: **every one of those was decided locally, at the
moment it was needed, instead of taken from a system.** There was no type
scale, no space scale and no elevation scale to take anything from — only
colours. So each screen invented its own, and a dozen screens inventing their
own is exactly what "no hierarchy" looks like from the outside.

This file is the system. It is short on purpose; a rule nobody can hold in
their head is a rule that loses to a deadline.

---

## 0. Before you touch a screen, answer this in one sentence

> **What is this screen FOR?**

Not what it contains — what a player came here to do. "Start a match." "See
what I have." "Find out why I lost."

That one thing is the screen's **hero**. Everything else on the screen is
furniture, and furniture is allowed to be quiet. If you cannot name the hero,
you are not ready to lay the screen out, and nothing below will save you.

Write the sentence into the component's docstring. If a screen has two heroes
it has none — split it, or demote one.

---

## 1. Hierarchy: three tiers, and they must not be close

Every element on a screen is one of three things:

- **HERO** — the screen's job. Exactly one per screen.
- **PATH** — the other ways out of this screen. Usually three to six.
- **MARGIN** — version numbers, legal, counts, timestamps.

They are separated by **at least two steps of the type scale**, and by
surface, and by space. A hero that is one step bigger than a path is not a
hero, it is a slightly larger path — which is what every screen in this game
looked like.

**The test, and run it by eye on a screenshot:** squint until the words blur.
You should still be able to point at the hero. If three things fight for the
eye, two of them are in the wrong tier.

**Never** give two siblings the same size *and* the same surface *and* the
same weight. One of the three has to move.

---

## 2. Type: six steps, no others

```css
--t-1: clamp(10px,  2.6vh, 12px);   /* a number on a badge. Nothing else. */
--t-2: clamp(11.5px, 3vh,  14px);   /* captions under icons, meta, units  */
--t-3: clamp(13px,  3.6vh, 16px);   /* BODY AND EVERY CONTROL — the default */
--t-4: clamp(16px,  4.6vh, 21px);   /* section titles                      */
--t-5: clamp(21px,  6vh,   28px);   /* screen titles                       */
--t-6: clamp(28px,  8.5vh, 44px);   /* the hero, once                      */
```

- **`--t-3` is the default.** If you are reaching below it for a control, a
  label or a sentence, the layout is too tight — fix the layout.
- `--t-1` is for a number that sits *next to* something that explains it. It
  is never a word on its own.
- The scale is in `vh` because the thing that decides whether this game is
  readable is screen HEIGHT — a landscape phone is 390 tall. The floors are
  the smallest readable size; the ceilings stop a desktop shouting.
- **No `font-size` literal anywhere else.** The audit checks.

---

## 3. Colour: three roles, and `--muted` is not one of them for words

```css
--text    /* DEFAULT. Anything a player reads in order to play.           */
--muted   /* a unit or a timestamp BESIDE a value. Never a sentence,      */
          /* never a control's label, never the only thing in a box.      */
--accent  /* the hero, and at most one other element per screen region.   */
```

Grey was the default here and that is most of "a lot of it isn't readable".
The rule is inverted now: **text is readable unless there is a reason, and
"it is secondary" is not a reason — secondary is handled by SIZE and SPACE.**

Accent is a currency. Spend it on the hero. A screen with six gold things has
no gold thing.

---

## 4. Surface: three levels

```css
--sur-1   /* a panel sitting on the screen                */
--sur-2   /* a card raised above the panels — the hero    */
--sur-lit /* the one thing being offered right now        */
```

Plus `--line` and `--line-lit`. **No raw `rgba(255,255,255,0.0x)` backgrounds
in component CSS** — that is how twenty near-identical surfaces happened. If
a thing needs to look different from a panel, it is a different TIER, not a
different 2% of white.

---

## 5. Space: proximity is the only grouping that works

```css
--sp-1: 4px;   --sp-2: 8px;   --sp-3: 14px;   --sp-4: 22px;
```

**The gap BETWEEN groups must be at least twice the gap INSIDE a group.**
That single rule does more for "arranged nicely" than any border: things that
belong together look like they belong together, and nothing needs a box drawn
round it to say so.

A box drawn round things that are already close together is a box that can be
deleted. Prefer deleting it.

---

## 6. Words: the rule Or has asked for a thousand times

> **Nothing on a screen explains that screen.**

- A control says what it **does**: a verb, or a noun. **Three words at most.**
- **No `<p>` of prose on a gameplay screen** — home, build, battle, result.
  None. The audit returns zero or the screen is not done.
- An empty state is **five words at most**. "אין כאן כלום. זה טוב." is good.
  "אין כלום חדש. כשתהיה מתנה, היא תופיע כאן." is two sentences doing one
  sentence's job.
- **If something needs explaining, the something is wrong.** Rewrite the
  control, do not annotate it. An empty crown on the board taught the King
  rule with no words at all; that is the standard.
- Amanda's own voice is not an explanation and is welcome — "זה לא יפתח את
  עצמו" is character. "לחץ כמה פעמים כדי לפתוח" is an instruction. Know
  which one you are writing.

The exception, and only this one: the **admin panel** may explain itself. It
is a tool for one adult, where a wrong number has consequences and a warning
beside a dial is worth its space.

---

## 7. Before you say a screen is done

Run the audit:

```bash
bash .claude/skills/amanda-ui/audit.sh
```

It reports the four numbers at the top of this file. **They must not go up.**

Then, by eye, on a real screenshot at **844×390** (the landscape phone — that
is what a child actually plays on):

1. Squint. Can you still point at the hero?
2. Is any text below `--t-2`?
3. Is any sentence doing a control's job?
4. Are the gaps between groups twice the gaps inside them?
5. Count the gold things. More than two in a region?

A screen that fits and aligns is not a screen that is done. Fitting was never
the complaint.
