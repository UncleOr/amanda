# משימות תפעול פתוחות

דברים שהוחלט לדחות, לא לשכוח.

## ניקיונות

- [ ] **לכבות את ה-Pages הישן** ב-`or-42creative/amanda`. נשאר פעיל בכוונה כגיבוי
      עד שנרגיש בטוחים עם הכתובת החדשה.
      דורש admin על ריפו העבודה — Claude מחובר שם, אז זו פקודה שלו:
      `gh api -X DELETE repos/or-42creative/amanda/pages`

- [ ] **לבדוק את ה-service השני ב-Railway.** הדומיין
      `amanda-server-production-372b.up.railway.app` מחזיר 502. אם זה service
      נפרד מניסיון פריסה ראשון — הוא צורך כסף על כלום וצריך למחוק אותו.
      אם זה רק דומיין נוסף על אותו service — למחוק אותו ב-Networking.

## חיסכון בעלויות

- [ ] **Serverless Mode** על ה-service `amanda-server`:
      בקנבס → הקופסה של השירות → Settings → Deploy → Serverless.
      השירות נעצר אחרי 10 דקות חוסר פעילות ולא נצבר חיוב. בטוח למשחק:
      Railway מודד לפי תעבורה יוצאת, והשקט הארוך ביותר באמצע משחק הוא 60
      שניות (שלב הבנייה) מול סף של 10 דקות.

- [ ] **תקרת הוצאה** ב-Railway: Workspace Settings → Usage → Usage Limit.

## Vercel

הקוד כבר מוכן (`vercel.json`, ו-`base` נשלט דרך `VITE_BASE_PATH`). נשאר רק:

- [ ] vercel.com/new → Continue with GitHub (UncleOr) → Import `UncleOr/amanda`
- [ ] Environment Variables: `VITE_SERVER_URL` = `wss://amanda-server-production.up.railway.app`
- [ ] Deploy

> **לא** לחבר את האינטגרציה Railway→Vercel. היא מקשרת סביבות Railway לפריסות
> Vercel ואין לנו שימוש בה.
