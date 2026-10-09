# הטריילר — סטוריבורד לאישור

**אל תריץ כלום עד שאתה מאשר את הדף הזה.** כל שוט מחולל עולה כסף אמיתי
(fal.ai, החשבון שלך), וזו בדיוק הסיבה שהוא כתוב כאן קודם.

הרעיון הוא של אור: *"מתחיל מאיזה 5 שניות של קרב יותר ריאליסטי. רואים את
הדמויות המצוירות של הקלפים ב-3D נלחמות אחת בשנייה בתוך תחנת דלק חשוכה, ואז
הם נכנסים לתוך הקלפים ומתחילים לראות הקלטת מסך של קרב, ואז עוד כמה צילומי
מסך."*

---

## מה כבר יש במאגר, ולמה זה אפשרי בכלל

הדבר שהפך את זה מ"אי אפשר" ל"אפשר" הוא ש**הצינור כבר בנוי**:
`packages/art/src/fal.ts` כבר יודע לחולל תמונה מתוך תמונות ייחוס
(`generateWithReference`, Nano Banana Pro) ולהנפיש תמונה לסרטון
(`animate`, Kling image-to-video). ככה נוצרה אמנדה שזזה במסך הבית.

ו-`apps/client/public/arena/fuel.webp` הוא **תחנת דלק חשוכה מלמעלה**, מצוירת
בסגנון של המשחק. היא כבר שם, כי היא אחת הזירות.

---

## הקאסט

אור: *"לך על החזקים — צ'ופי, פליים דראגון, לחם מטוגן וכמובן אמנדה ועוד כמה
ידועים."*

| | מי | הקובץ | הערה |
| --- | --- | --- | --- |
| ⭐ | **אמנדה** | `cards/legends_01_amanda.webp` | הבוסית. מופיעה אחרונה. |
| ⭐ | **דרקון הלהבה** | `cards/dragons_01_flame_dragon.webp` | הלוחם. רקע שחור — הכי נקי לייחוס. |
| ⭐ | **צ'ופי** | `cards/furries_01_chuppy.webp` | הידיד. הוא החמוד שחוטף. |
| ⭐ | **לחם מטוגן** | `emoji/bread_hi.png` | **אמוג'י, לא קלף** — 128×128. מספיק כייחוס עיצוב, לא כתמונה. |
| | **מלך הטיטאנים** | `cards/giants_10_titan_king.webp` | ענק האבן מהתיאור בחנות. |
| | **מלך השמיים** | `cards/dragons_10_sky_king.webp` | רזרבה. |

---

## הסטוריבורד — חמישה שוטים, 22 שניות

### שוט 1 · 0:00–0:03 · **הקרב** — מחולל 💰

תחנת דלק, לילה, אספלט רטוב, ניאון של הגגון מהבהב. **דרקון הלהבה מול מלך
הטיטאנים**, פנים אל פנים בין המשאבות, באמצע תנועה. אש מול אבן.

> שני יצורים בפריים ולא חמישה — **מודל וידאו מתמודד יפה עם שניים ועושה דייסה
> מחמישה.** צ'ופי והלחם נכנסים בשוט 2, שבו הם לא צריכים להילחם, רק לחטוף.

### שוט 2 · 0:03–0:06 · **אמנדה** — מחולל 💰

האור בתחנה נשבר. **אמנדה עולה מאחור**, ענקית. הדרקון והטיטאן קופאים ומסתובבים
אליה. צ'ופי והלחם המטוגן נמלטים מתחת לפריים.

> *"אמנדה אכלה את כולם לארוחת ערב"* — זו השורה שלך מדף החנות, וזה השוט שלה.

### שוט 3 · 0:06–0:08 · **הם נכנסים לקלפים** — ffmpeg, בחינם

הפריים קופא, מתכווץ ומסתובב — ונוחת כקלף על לוח המשחק. שלושה קלפים נופלים
אחריו. **אין כאן חילול.** זה הרעיון שלך, והוא ניתן לעשייה עם חיתוך, סיבוב
ו-blur בלבד.

### שוט 4 · 0:08–0:16 · **קרב אמיתי** — הקלטת מסך, בחינם

**זה החלק שאתה מצלם.** אנדרואיד מקליט מסך מובנה: גלילה מלמעלה ← הקלטת מסך.
תשחק קרב, תקליט ~40 שניות, תשלח לי — אני חותך את שמונה השניות הטובות.

> שוט אחד שבו רואים **הנחת קלף, ההתקפה, והמד זז.** לא תפריטים.

### שוט 5 · 0:16–0:22 · **הסגירה** — בחינם

אלבום ← ניצחון ← הלוגו ← `playamanda.com`. מה שכבר צילמנו.

---

## הפרומפטים — זה מה שצריך את העין שלך

אתה הקופירייטר. **אלה טיוטות שלי.** מה שכתוב באותיות גדולות הוא מה שאסור
למודל לעשות, ומניסיון עם אמנדה שזזה — זה החלק שבאמת עובד.

### שוט 1 — התמונה (Nano Banana Pro, ייחוס: הדרקון + הטיטאן + `arena/fuel.webp`)

```
A cinematic wide shot at night inside a dark, empty petrol station forecourt:
wet black asphalt, a concrete canopy overhead with flickering fluorescent
strips, two fuel pumps, deep shadows, cold blue night behind and warm sodium
light pooling on the ground.

Standing in that forecourt, facing each other mid-fight: the FIRE DRAGON from
the first reference image and the STONE GIANT KING from the second. KEEP THEIR
EXACT DESIGNS — the same silhouettes, the same colours, the same horns, wings,
armour and glowing lava cracks. Do not redesign them, do not restyle them, do
not make them cute.

Render them as DETAILED 3D CREATURES with real volume, skin, scale and stone
texture, lit by the station's own lights — the dragon's fire throwing orange
light onto the wet asphalt, the giant's lava cracks glowing from inside.

Cinematic, volumetric haze, shallow depth of field, slight film grain.
NO TEXT, NO LOGOS, NO CARDS, NO USER INTERFACE, NO WATERMARK.
```

### שוט 1 — ההנפשה (Kling image-to-video, 5 שניות)

```
The fire dragon lunges forward and breathes a short burst of flame; the stone
giant raises one arm to block, and the impact throws sparks and dust across the
wet asphalt. The overhead fluorescent light flickers twice. The camera pushes in
very slowly.

THE CHARACTERS DO NOT CHANGE: no new creatures enter, nothing transforms,
nobody leaves the frame. NO TEXT APPEARS. The camera does not cut, spin or
whip-pan — one continuous slow push.
```

### שוט 2 — התמונה (ייחוס: קלף אמנדה + `brand/amanda_banner.webp` + הפריים של שוט 1)

```
The same dark petrol station forecourt, same camera, same lighting — but now
AMANDA from the reference image towers at the back of the frame, enormous,
her teal flame crown and glowing runes lighting the whole station from behind
and throwing long shadows forward across the wet asphalt.

KEEP HER EXACT DESIGN: the teal flame hair, the dark blue flowing hair, the
green skin, the glowing runes, the serpent and the lion at her sides. Render
her as a DETAILED 3D CREATURE, same treatment as the dragon and the giant,
who are now small in front of her and turning to look up.

Cinematic, volumetric light, deep shadows, film grain.
NO TEXT, NO LOGOS, NO CARDS, NO USER INTERFACE, NO WATERMARK.
```

### שוט 2 — ההנפשה (5 שניות)

```
Amanda's flame crown flares and her light floods the station. The dragon and
the giant turn slowly to look up at her and freeze. Her hair and the runes
drift. The camera pulls back very slightly.

SHE DOES NOT WALK, ATTACK OR SPEAK. Nothing new enters the frame. NO TEXT
APPEARS. One continuous shot.
```

---

## מה זה עולה

| | כמה | מה |
| --- | --- | --- |
| Nano Banana Pro | 2 תמונות | ~0.15$ לתמונה |
| Kling 5 שניות | 2 קטעים | ~0.30$ לקטע |
| **סבב אחד** | | **~1$** |

הסכומים מהזיכרון ולא מהחשבונית — **המספר האמיתי בלוח הבקרה של fal.ai**. גם
אם אני טועה פי שלוש, שלושה סבבים הם בסביבות עשרה דולר, לא מאה. התקציב
האמיתי כאן הוא לא כסף אלא זמן: כל קטע לוקח כמה דקות.

**תכנן שני סבבים.** המודל כמעט אף פעם לא קולע בפעם הראשונה, ובפעם הראשונה
עם אמנדה שזזה הוא הזיז לה את כל הגוף במקום את השיער.

---

## הדבר שאני לא יכול להבטיח

**הדמויות ב-3D לא ייראו זהות לקלפים.** הקלפים מצוירים בסגנון "קומיקס אפל" —
קו שחור עבה, צבע שטוח. 3D הוא מדיום אחר: הדרקון יישאר אותו דרקון, אבל עם
עור ונפח במקום קו.

**וזו דווקא הנקודה של השוט.** פותחים ב"אמיתי", ואז הם מתקפלים לתוך הקלפים —
המעבר הזה הוא הקרס של הטריילר. אבל אם אתה רוצה שהם יישארו מצוירים בדיוק כמו
הקלפים, תגיד ואני מוריד את המילה `3D` מהפרומפטים.
