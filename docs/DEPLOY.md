# פריסה — איפה כל חלק רץ

למשחק שני חלקים, ולכל אחד דרישות שונות:

| חלק | מה זה | איפה יכול לרוץ |
| --- | --- | --- |
| **קליינט** | אתר סטטי (HTML/JS) | GitHub Pages · Vercel · Netlify · Cloudflare Pages |
| **שרת** | Node + WebSocket, חיבור פתוח לאורך כל המשחק | Fly.io · Railway · Render · VPS |

> **שים לב:** Vercel **לא** יכול להריץ את השרת כמו שהוא. פונקציות serverless
> לא מחזיקות WebSocket פתוח לאורך משחק של דקה וחצי. Vercel מצוין לקליינט.
>
> **Supabase** גם הוא לא תחליף ישיר — ה-Realtime שלו הוא ארכיטקטורה אחרת
> (ערוצים על Postgres) וידרוש לכתוב מחדש את שכבת הרשת. הוא כן יהיה הבחירה
> הנכונה בהמשך לחשבונות, שמירת התקדמות ולוחות תוצאות.

## 1. השרת

הוא כבר מוכן: קורא `PORT` מהסביבה ויש לו endpoint לבדיקת בריאות ב-`GET /`.
יש `apps/server/Dockerfile` שעובד על כל אחד מהשירותים למעלה.

```bash
fly launch --dockerfile apps/server/Dockerfile
```

או ב-Railway/Render: לחבר את הריפו, לבחור `apps/server/Dockerfile`, לפרוס.
בסוף מקבלים כתובת כמו `https://amanda-server.fly.dev`.

## 2. לחבר את הקליינט לשרת

ב-GitHub של הריפו: **Settings → Secrets and variables → Actions → Variables**,
משתנה חדש:

```
VITE_SERVER_URL = wss://amanda-server.fly.dev
```

(`wss://` ולא `https://`.) הבנייה הבאה תפעיל את כפתור **אונליין**. בלי המשתנה
הכפתור נשאר מושבת וזה בסדר — המשחק נגד המחשב עובד בלי שרת.

## 3. מעבר לחשבון פרטי

1. לפתוח חשבון GitHub אישי.
2. בריפו הנוכחי: **Settings → General → Transfer ownership**, או ליצור ריפו
   חדש ולדחוף אליו (`git remote set-url origin <הכתובת החדשה>`).
3. להפעיל Pages: **Settings → Pages → Source: GitHub Actions**.
4. אם שם הריפו משתנה, לעדכן את `base` ב-`apps/client/vite.config.ts`.

## רוץ מקומית

```bash
pnpm --filter @amanda/server dev
```

הקליינט בפיתוח מתחבר ל-`ws://localhost:2567` אוטומטית.
