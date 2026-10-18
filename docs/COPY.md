# הטקסטים של אמנדה

כל טקסט שהשחקן רואה — 1147 במספר, 1147 מהם כבר באנגלית.

## איך עורכים

**הקובץ הנוח הוא `docs/COPY.xlsx`** — אותם טקסטים בדיוק, באקסל, עם יישור
לימין, כותרות קפואות ופילטר לפי מסך. זה הקובץ לעבוד בו. ה-MD הזה נשאר
כדי שאפשר יהיה לראות בגיט מה השתנה.

**שתי עמודות למלא, ושתיהן אופציונליות.**

| עמודה | למה היא |
| --- | --- |
| `טקסט חדש` | לשנות את העברית. מה שנשאר ריק לא ישתנה |
| `אנגלית` | התרגום. מה שנשאר ריק פשוט יישאר בעברית במשחק |

אחר כך אומרים לי, ואני מריץ `pnpm copy:back` ואז `pnpm copy:apply`:
האקסל נכנס לקובץ הזה, ומכאן העברית נכתבת בחזרה לקוד
— לכל טקסט יש מזהה שיודע בדיוק מאיפה הוא נלקח — והאנגלית נכתבת ל-
`data/copy.en.json`, שהמשחק טוען כשבוחרים אנגלית.

אל תשנו את עמודת המזהה ואל תמחקו שורות. אם טקסט מופיע פעמיים ברשימה, הוא
באמת מופיע פעמיים במשחק — אפשר לשנות כל אחד בנפרד.

> **מה לא לתרגם מילולית:** הקול של אמנדה. היא דמות, ו-`"ילד ילד ילד, בוא
> להילחם"` שעובר מילה במילה מפסיק להיות היא. עדיף לכתוב לה שורה חדשה
> באנגלית מאשר לתרגם את זו.

## שם המשחק וכותרות הדפדפן

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| hfc09a93 | אמנדה \| משחק קלפים מפלצתי | | Amanda \| Monster card game |
| h9f563dd | אוספים קלפים. נלחמים במפלצות. אמנדה אוכלת את כולם. | | Collect cards. Fight monsters. Amanda eats the lot. |
| hafb233b | אמנדה | | Amanda |
| h1b28f47 | אמנדה \| משחק קלפים מפלצתי | | Amanda \| Monster card game |
| h9c383ea | אמנדה | | Amanda |
| h6ec6982 | אוספים קלפים. נלחמים במפלצות. אמנדה אוכלת את כולם. | | Collect cards. Fight monsters. Amanda eats the lot. |

## סדרה — הדרקונים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| d708c394 | הדרקונים | | The Dragons |
| dda5d4e9 | נזק אזורי ופצצות מתקתקות | | Area damage and ticking bombs |
| dc64864a | קשקשי דרקון | | Dragon Scales |
| da6ab0c0 | שלושה צמודים מאותה משפחה מקבלים +20% עוצמה ו+20% חיים. | | Three touching cards of the same family get +20% power and +20% health. |
| dd069f94 | פליים דראגון | | Flame Dragon |
| d387c4a6 | צועד לתוך שטח היריב | | Advances into enemy territory |
| ddfe4de4 | ביצת אובסידיאן | | Obsidian Egg |
| d9a746c1 | אחרי 10 שניות בוקע ממנה דרקון עם +1500 עוצמה. | | Hatches a dragon with +1500 Power after 10 seconds |
| dd171205 | פצצה מתקתקת לקומת קרקע: מניחים אותה למטה ומעליה טנק; עד שהטנק נפרץ הטיימר נגמר. | | Ground-floor ticking bomb: place it under a tank; by the time the tank breaks, its timer is up. |
| d1cdf43f | טורץ' | | Torch |
| d0c38210 | יורה בקלף האויב האחרון בנתיב שלו, כל עוד יש לו קו ראייה פנוי. | | Shoots the last enemy card in its lane, as long as it has a clear line of sight |
| d751bd5b | לאבה | | Lava |
| dd201848 | משאיר בנתיב שלו לבה רותחת, מי שנוגע בה נשרף ומאבד חיים | | Leaves a trail of molten lava in its lane. Enemies touching it burn and take damage |
| d4c2a5cc | שליטת נתיבים / חסימת הסתערות עם נזק מתמשך. | | Lane control / advance-denial with damage over time. |
| d20cc0d1 | ספייק | | Spike |
| d4bceedb | מחזיר 30% מהנזק שספג, מצוין תחת קלף מתפוצץ. | | Returns 30% of damage taken, great under a bomb card. |
| dd13f864 | דרקון הקרח | | Ice Dragon |
| dcc2cd07 | מקפיא יריב מסתער ל-2 שניות ומאפס לו את זמן הטעינה. | | Freezes an advancing enemy for 2s and resets its attack cooldown. |
| d5bf3bd1 | גולדנהורן | | Golden Horn |
| d97bf3bb | לוקח איתו את הקלף הכי חלש שנמצא בסמוך אליו שאינו שומר או מלך והופך אותו לשריון | | Turns the weakest adjacent card (except Guards and Kings) into Armor |
| d168698d | טנק כבד שמתחזק כשמקריבים קלף אחר | | Heavy tank fueled by sacrifice. |
| d634b55d | דרקון רפאים | | Ghost Dragon |
| d016d527 | כשהוא מת - בוקעות ממנו 3 רוחות שממשיכות להסתער. | | When destroyed, spawns 3 spirits that charge forward. |
| d330d7d5 | דרקון הטייפון | | Typhoon Dragon |
| de90eb52 | דוחף את היריב הצידה מעמודה לעמודה, מזיז צלפים מחוץ לנתיב. | | Pushes the enemy sideways between columns, moving snipers out of the lane. |
| d0dd38e1 | שליטה מרחבית / הדף צדדי. | | Spatial control / lateral knockback. |
| dbcd6ba4 | מלך השחקים | | Sky King |
| d1cbbaba | מכת כנפיים לרוחב 3 נתיבים כל 5 שניות עם הדף. | | A wing sweep across 3 lanes every 5 seconds with knockback. |

## סדרה — הענקים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| d8c365e1 | הענקים | | The Giants |
| d1b5fe74 | טנקים, התגרות והחזרת נזק | | Tanks, taunts and damage reflection |
| d27e8948 | עור עבה | | Thick Hide |
| d5da4e5e | שלושה צמודים מאותה משפחה מקבלים +20% עוצמה ו+20% חיים. | | Three touching cards of the same family get +20% power and +20% health. |
| dbbaccd6 | גולם אבן | | Stone Colossus |
| d3694c8e | טנק הליכה שמחזיר נזק. | | A walking tank that reflects damage. |
| dd07b195 | שומר הפלדה | | Steel Warden |
| df53d12f | מעניק שריון לכל בעלי הברית סביבו. | | Grants armor to nearby allies. |
| d68c3bcf | ענק הגבעות | | Hill Giant |
| d71c0943 | מכה כבדה שהודפת יריבים אחורה. | | Heavy blows that knock enemies back. |
| d8d307c3 | טרול סלע | | Rock Troll |
| dce82a23 | מתחדש: מרפא את עצמו לאורך הקרב. | | Regenerates its own health during battle. |
| da06b9a9 | שובר החומות | | Wall Breaker |
| d5065925 | מכה איטית שמנפצת שריון. | | A slow blow that shatters armor. |
| dfb64c5b | ענק הקרח | | Frost Giant |
| d9ca1ff9 | כל מכה מקפיאה את היריב לרגע. | | Each hit briefly freezes the enemy. |
| d2f2bf3c | מגן הברזל | | Iron Bulwark |
| dedbf1d1 | חומה כמעט בלתי חדירה שמחזירה 40% נזק. | | A near-impenetrable wall reflecting 40% damage. |
| dfcad363 | רוק הנוקם | | Vengeful Rok |
| dc28819c | מעניש כל מי שמעז לתקוף אותו. | | Punishes anyone who dares strike it. |
| dc8d0506 | ענק הרעם | | Thunder Giant |
| d0768b12 | מכת רעם שפוגעת בשני נתיבים. | | A thunderclap that strikes two lanes. |
| d28e30a0 | אבי-הענקים | | Titan King |

## סדרה — הפרוותיים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| d2cdcd05 | הפרוותיים | | The Furries |
| d85387a0 | מכות חשמל מהירות — מעט חיים, הרבה כוח | | Fast electric strikes — little health, a lot of power |
| de4a1b06 | פרווה טעונה | | Charged Fur |
| d512f04e | שלושה צמודים מאותה משפחה מקבלים +20% עוצמה ו+20% חיים. | | Three touching cards of the same family get +20% power and +20% health. |
| d267c630 | צ'ופי | | Chuppy |
| d8d0f124 | החבר שלך מההתחלה. מכה חזק מרחוק ושובר שריון — אבל סופג כמעט כלום, אז הוא לא עומד בחזית. | | Your friend from the start. Hits hard at range and breaks armour, but takes almost nothing, so he does not belong in the front row. |

## סדרה — החרקים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| df172f20 | החרקים | | The Insects |
| d0a8be11 | מלכודות, רעל ופגיעה ישירה במרכז | | Traps, poison and striking straight at the center |
| db45ae8e | נחיל | | The Swarm |
| d5df62d0 | שלושה צמודים מאותה משפחה מקבלים +20% עוצמה ו+20% חיים. | | Three touching cards of the same family get +20% power and +20% health. |
| d1e8dfab | חייל נמלה | | Ant Soldier |
| daff27cb | מסתער מהיר וזול להצפת נתיבים. | | A cheap, fast rusher to flood lanes. |
| d56e0c0e | מלכת הנמלים | | Ant Queen |
| dc0d7f80 | במוות בוקעות ממנה 3 נמלים חדשות. | | On death hatches 3 fresh ants. |
| d528ee34 | עקרב ארסי | | Venom Scorpion |
| d25b3f53 | עוקץ ומרעיל; הרעל מצטבר. | | Stings and poisons; the venom stacks. |
| d428d394 | עש רעל | | Toxic Moth |
| d2d1f2d6 | מרחף מעל הקרקע ומפזר אבקת רעל. | | Flies over the ground spreading toxic dust. |
| d8a9bd04 | חיפושית שריון | | Armored Beetle |
| d48bf173 | שריון קשה שמחזיר מעט נזק. | | A hard shell that reflects some damage. |
| d40a44e2 | עכביש מארב | | Ambush Spider |
| d9a4769d | מלכודת קומת-קרקע: כשנחשף מדביק את היריב. | | Ground-floor trap: roots the enemy when revealed. |
| dc3c1f11 | צרעה תוקפנית | | Aggressive Wasp |
| d1bb9b6f | עפה מהר, עוקצת והודפת. | | Flies fast, stings and knocks back. |
| dd3a1765 | גחלילית | | Firefly |
| d5219007 | מאיצה את קצב התקיפה של הנחיל סביבה. | | Speeds up the attack rate of the nearby swarm. |
| de11f78a | חרק פצצה | | Bombardier |
| de11c8f1 | מתפוצץ במוות לשני חרקים קטנים. | | Explodes on death into two small bugs. |
| d737d9d3 | קיסרית החרקים | | Insect Empress |

## סדרה — הצמחים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| d5696dab | הצמחים | | The Plants |
| d180cb32 | התפשטות על הלוח, צמיחה ותוספת חיים | | Spreading across the board, growth and added health |
| d1c33c0c | פוטוסינתזה | | Photosynthesis |
| d1c379cd | שלושה צמודים מאותה משפחה מקבלים +20% עוצמה ו+20% חיים. | | Three touching cards of the same family get +20% power and +20% health. |
| dd730075 | הדרדר | | Thorn Sprout |
| de22538b | מי שנוגע בו נדקר ומאבד חיים | | Thorns that prick whoever touches it. |
| d1bc139b | העץ העתיק | | Ancient Tree |
| da1c7536 | חומה חיה שמתחדשת ללא הרף. | | A living wall that constantly regenerates. |
| de453d57 | הילינג בלום | | Healing Bloom |
| d6b0cd91 | מרפא את כל בעלי הברית סביבו. | | Heals all nearby allies. |
| d3e9dc06 | וונוס טראפ | | Venus Trap |
| d4a5f02b | יורה רעל שפוגע לאורך זמן | | Bites and injects stacking poison. |
| dddd5ae6 | שריגים מטפסים | | Creeping Vine |
| dea053a7 | עותק נוסף של הקלף צומח בכל שטח שמתפנה בסמוך אליו | | Spawns a copy of itself in any adjacent tile that becomes empty. |
| d63b8ef2 | פטרייה רעילה | | Toxic Mushroom |
| db0816c9 | יורה נבגי רעל מרחוק. | | Fires poison spores from afar. |
| d1845f96 | שן הארי | | Dandelion |
| db45272e | לאחר המוות מפזרת זרעים שממשיכים להילחם | | On death scatters seeds that fight on. |
| d137f274 | קקטוס | | Cactus |
| db267dde | קוצני ועמיד | | Spiky and hardy |
| d57a0224 | חמנייה | | Sunflower |
| db9c640c | יורה גרעינים. סופגת שמש משטחים פנויים סמוכים ומתרפאת. | | Shoots seeds. Absorbs sunlight from empty adjacent spaces to Heal |
| db57d5b0 | אמא - עץ | | Great Mother Tree |
| d60e56ed | גדול ויציב, מרפא את כל הצמחים בלוח שלך | | Massive and sturdy. Heals all allied plants. |

## סדרה — הדביקים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| dc1662ed | הדביקים | | The Slimes |
| d477a268 | משאירים שובל ריר שמאט את היריב | | Leaving a slime trail that slows the enemy |
| df041649 | דביקות | | Stickiness |
| d45c17b6 | שלושה צמודים מאותה משפחה מקבלים +20% עוצמה ו+20% חיים. | | Three touching cards of the same family get +20% power and +20% health. |
| dd6d1363 | הסליים | | Slime |
| dc8d5f0a | מי שעובר דרכו מאט | | Enemies passing through are Slowed |
| d9dab6c4 | קוביית ג'לי | | Gelatinous Cube |
| d9e3edc7 | בולעת כל קלף אויב עם פחות חיים שעובר דרכה, ומוסיפה את החיים שלו לשלה. | | Swallows any enemy card with less Health passing through it and gains its Health. |
| d16b90ad | חמוצי | | Acid Ooze |
| d4bb1b7a | ממיסה במכה הראשונה  את שריון האויב, חזק ככל שיהיה | | First hit: Melts all enemy Armor, regardless of its strength |
| d0855e04 | ממיס שריון. | | Armor melter. |
| df582627 | בלוב | | Splitting Blob |
| d26b185e | במוות נחתך לשני בלובים קטנים שקופצים לנתיבים הסמוכים וממשיכים להילחם. | | On death splits into two small blobs that leap to adjacent lanes and keep fighting. |
| d414ebd5 | שטיח-דבק | | Sticky Rug |
| df4c8192 | מדביק את היריב שמולו ומונע ממנו לזוז עד סוף הקרב. | | Glues the enemy in front so it cannot move for the rest of the battle. |
| d0b30ec8 | מלכודת קומת-קרקע. | | Ground-floor trap. |
| daaa981c | סליים רדיואקטיבי | | Radioactive Slime |
| da746365 | מי שעובר דרכו מאט ומאבד כח תקיפה | | Enemies passing through are Slowed and lose Attack Power |
| d1818001 | נזק מתמשך מרחוק. | | Ranged damage over time. |
| d9892ad9 | מוח-צף | | Floating Brain |
| d920d13a | משדר פולסים חשמליים שמעניקים מהירות תקיפה למפלצות הסמוכות שלך | | Emits electric pulses, granting Attack Speed to your adjacent monsters |
| d81d470f | באף אזורי. | | Area buffer. |
| df2a4637 | מטמיע הצורות | | Assimilator |
| d4b8587c | בפגיעה הראשונה מעתיק את האלמנט של היריב ומשתלב בסינרגיות. | | On its first hit copies the enemy's element, letting it slot into synergies. |
| da2bed0b | גנב אלמנטים. | | Element thief. |
| d5ff14e8 | פודינג-מגן | | Pudding Shield |
| d9ffeb46 | סופג חצי מהנזק שמופנה לקלפים הצמודים אליו מימין ומשמאל. | | Absorbs half the damage aimed at the cards directly to its left and right. |
| d59cfdc3 | הגנה היקפית / שומר ראש. | | Perimeter guard / bodyguard. |
| de5bfdae | זליג הענק | | Zelig the Giant |
| db20969f | כל 6 שניות מושך את כל קלפי היריב המסתערים משבצת אחת פנימה למרכז ומשבש נתיבים. | | Every 3 seconds pulls all advancing enemy cards one slot inward, disrupting lanes. |

## סדרה — האגדיים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| d2d5efb3 | האגדיים | | The Legends |
| d0a4d057 | לא נאספים ולא נבנים. מופיעים. | | Not collected, not built. They arrive. |
| df6551b7 | תוהו | | Chaos |
| d3dcebe0 | אין. הם לא באים בשלושה. | | None. They do not come in threes. |
| da3285cd | אמנדה | | Amanda |
| d48433be | המפלצת הכי חזקה באלבום. יורה רחוק וחזק ומרפאה את כל מי שסביבה. אף אחד עדיין לא ניצח אותה. אולי תהיו הראשונים. | | The strongest monster in the album. Shoots far and hard, and heals everyone around her. No one has beaten her yet. Maybe you’ll be the firs |

## קלפי פעולה

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| d8af9ed0 | בוסט אנרגיה | | Energy Boost |
| d924260a | מעניק +50 עוצמה לכל הקלפים שמונחים כרגע על הלוח שלך. | | Grants +50 power to all cards currently on your board. |
| d191f69c | משמיד הקלפים | | Radioactive Eraser |
| d281179a | מוחק קלף אחד של היריב (אי אפשר להפעיל על המלך). | | Erases one enemy card (if used on the King, deals heavy damage instead of erasing). |
| dcf7b540 | הפריזר | | Time Freeze |
| dca2eedf | היריב לא יכול להדביק קלפים באלבום למשך 5 שניות | | Completely freezes the opponent's screen for 3 seconds. |
| d0014d6d | הסוויצ׳ר | | Swap Places |
| d52f8ecc | מחליף מיקומים בין שני קלפים שכבר הנחת על הלוח שלך. | | Swaps the positions of two cards you have already placed on your board. |
| d6c5480b | רנטגן | | X-Ray |
| d0c06a9b | חושף את כל הלוח של היריב (כולל שורת ההפתעה האחורית) למשך 5 שניות. | | Reveals the entire enemy board (including the back Surprise Row) for 5 seconds. |
| d8dd9d7a | קומת קרקע | | Ground Floor (Stacking) |
| d393c007 | מאפשר להדביק קלף אחד על גבי קלף קיים. כשהעליון מת בקרב, התחתון נחשף. | | Lets you pick 4 slots and stack a card on top of another. When the top dies in battle, the bottom is revealed. |
| d45d0447 | פינות אפלות | | Dark Corners |
| d25f1f60 | מכפיל את החיים של כל הקלפים שמודבקים בפינות | | Automatically enables stacking a double card on all 4 outer corners of your board. |
| d2af4555 | סופת חול | | Sandstorm |
| dc311f15 | מחליפה בין שני שומרי המלך של היריב, ובין שני הקלפים שבקצוות — השורה הקדמית נשארת, הסדר שלה לא. | | Swaps the enemy's two King guards with each other, and its two outer front cards with each other. |
| d2221bdb | תדלוק מלא | | Full Refuel |
| daee0956 | משדרג מיידית קלף שהנחת על הלוח לגרסה החזקה יותר שלו (רמה 2) למשך המשחקון. | | Instantly upgrades a placed card to its stronger version (level 2) for the match. |
| d45ad227 | פינוי בינוי | | Recall Card |
| d934ff11 | מאפשר לך להסיר קלף שכבר הדבקת ולפנות משבצת | | On use: pick a card you placed and remove it (its slot frees up). Undoes the glue. |
| d5bb37c6 | מילוי לאבה | | Lava Fill |
| d71c0f77 | בסוף הבנייה ממלא עד 3 משבצות ריקות ב'לאבה' במיקומים אקראיים. | | Passive: at the end of building, fills up to 3 empty slots with Lava (instead of Crumb Demons) at random positions. |
| dc3fedf6 | מילוי גולם אבן | | Colossus Fill |
| d20f47e3 | פסיבי: בסוף הבנייה ממלא עד 3 משבצות ריקות ב'גולם אבן' במיקומים אקראיים. | | Passive: at the end of building, fills up to 3 empty slots with Stone Colossus at random positions. |
| db4905a9 | מילוי דרקון אש | | Flame Fill |
| d598d611 | פסיבי: בסוף הבנייה ממלא עד 3 משבצות ריקות ב'פליים דראגון' במיקומים אקראיים. | | Passive: at the end of building, fills up to 3 empty slots with Flame Dragon at random positions. |
| db55bdb5 | מילוי קוביית ג'לי | | Cube Fill |
| d3c3107c | פסיבי: בסוף הבנייה ממלא עד 3 משבצות ריקות ב'קוביית ג'לי' במיקומים אקראיים. | | Passive: at the end of building, fills up to 3 empty slots with Gelatinous Cube at random positions. |

## הקול של אמנדה — שורות מתחלפות (כמה גרסאות לכל רגע)

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s09c9dbd | ילדה | | kid |
| sd2076b4 | ילד | | kid |
| sa0c2f52 | זהו, הולכים? | | Leaving already? |
| s2631ad1 | מה, זהו? | | What, that's it? |
| sb4c1729 | ברצינות? | | Seriously? |
| s98bfa4a | דווקא עכשיו? | | Now of all times? |
| sd058c50 | הולכים? רק התחלנו | | But we only just started |
| s6dbd722 | הלוח נמחק ואתם חוזרים לתפריט. לתפריט שלי | | The board you built is gone. I'll keep you a place on my menu, kid. |
| sb024f5a | כל מה שבנית נמחק. חבל, כבר היה לי תיאבון | | Everything you built goes in the trash. I'll survive somehow. |
| sdc548ed | הלוח נמחק. הלכתי לישון רעבה. | | The board is gone and the battle won't happen. Nobody will know you were here. |
| s4f08f6b | אני מוחקת את הלוח. אל תדאג, אני זוכרת אותך. | | I'm wiping the board. Don't worry, I remember you. |
| s10d5f41 | זה נמחק והולך. כולם חוזרים. | | Wiped and gone. They all come back. |
| s0d9df94 | כן, זזתי הביתה | | Yes, I'm out of here |
| sec9f3ef | כן, יש לי חיים | | Yes, I've had enough |
| sb74d641 | כן, שחררי אותי | | Yes, let me go |
| s2a07130 | כן, יאללה ביי | | Yes, bye |
| sfdc5788 | נראה לי שאשאר | | No, I'm staying |
| s54722a8 | לא, בואי נשחק | | No, let's play |
| s1ddeb1f | בעצם לא, התבלבלתי | | My mistake |
| s07e484c | עוד לא סיימתי | | I'm not done yet |
| s029189a | ניצחת. אבל רק הפעם. | | You won! This time. |
| s178f33f | ניצחת. אבל רק כי נתתי לך. | | You won. I let you. |
| s072fa2f | יפה, ילד. | | Nice, kid. |
| s47dce22 | יפה, ילדה. | | Nice, kid. |
| sb470edf | ניצחת. לא להתרגל. | | You won. Don't get used to it. |
| sd1f0cd1 | טוב. באמת טוב. | | Good. Genuinely good. |
| sbaf0592 | הפסדת. קדימה לצלחת שלי | | You lost. Delicious. |
| sdc2f0f9 | נחמד ששיחקת, יותר נחמד שהפסדת | | You lost. That was nice. |
| scae423d | זהו, הפסדת. שיהיה לי בתיאבון. | | That's that. Thanks for dinner. |
| saf64df3 | הפסדת. לא נעים, לא נורא. | | You lost, and you knew you would. |
| s82fb0b7 | הפסדת. כל כך קרוב, כל כך רחוק. | | Oh. So close. |
| s4e10573 | היריב ברח. ניצחון טכני! | | Your opponent ran. You win on a technicality. |
| sbb68dcd | היריב שלך ברח. אני לא מאשימה אותו | | They ran. I don't blame them. |
| sdb10f2b | נשארת לבד. זה נחשב ניצחון. | | You're on your own. That counts as a win. |
| s0176373 | היריב נעלם. אכלתי אותו בדרך. | | Your opponent vanished. I ate them on the way. |
| s1661c13 | התכונן לקרב, ילד | | Get ready to fight, kid |
| s0f9d55a | התכונני לקרב, ילדה | | Get ready to fight, kid |
| s34b7fb9 | תתארגן, ילד | | Get it together, kid |
| s5361c59 | תתארגני, ילדה | | Get it together, kid |
| sacf574c | נשימה ארוכה - ונתחיל | | Here we go. Breathe. |
| s5656766 | קדימה, ילד | | Come on, kid |
| s9175f67 | קדימה, ילדה | | Come on, kid |
| s36e79b6 | קדימה לקרב! | | Into battle! |
| sf842646 | ועכשיו: לקרב! | | And now: fight! |
| sf43f6cb | בואו נלחם! | | Let's fight! |
| sa21c01f | הקרב מתחיל, ילד | | The battle begins, kid |
| sd988a9d | הקרב מתחיל, ילדה | | The battle begins, kid |
| s647d2f6 | ועכשיו נראה מה בנית | | Now let's see what you built |
| s05b265d | זהו, אין שינויים. עכשיו - לקרב. | | Too late to change it |
| s32acee8 | בוא נראה אותך | | Let's see what you've got |
| s6f30a3c | בואי נראה אותך | | Let's see what you've got |
| s69104e2 | מחפשת לך מישהו מתוק | | Finding you someone sweet |
| s43db7a1 | מחפשת לך יריב. סבלנות. | | Finding you an opponent. Patience. |
| s95c7718 | מישהו יבוא. תמיד בא מישהו. | | Someone will come. Someone always comes. |
| s4fa0459 | רגע, אני מסדרת לך משחק | | Hold on, I'm setting you up a game |
| s50cc39e | קודם כול מלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר. גרור מפלצת לאמצע. קלף פעולה ביד? לפח איתו. | | The King first. He doesn't move, he's three times as strong, and if he falls it's over. Drag a monster to the middle. Holding an action card? Throw it away. |
| s54b2c21 | שתי המשבצות האלה שומרות עליו. כל עוד מישהו עומד שם, אי אפשר לגעת בו. | | These two squares guard him. While somebody is standing there, nobody can touch him. |
| s2e30355 | זה מה שיש לך ביד. לא מוצא חן בעיניך? לפח. אבל רק הקלף העליון חוזר, אז תחשוב. | | That's what's in your hand. Don't like it? Throw it away. But only the top card comes back, so think. |
| sdc4abc1 | כל מה שאפשר למלא — למלא. מה שיישאר ריק אני אמלא, וזה לא יהיה נעים. | | Fill everything you can. Whatever you leave empty, I'll fill — and you won't enjoy it. |
| sb496ba8 | וכשזה נראה מוכן — ללחוץ. אני כבר מוכנה. | | And when it looks ready — press it. I'm ready already. |
| s0a11063 | רגע. לפני הכול — אני מדברת אל ילד או אל ילדה? | | Wait. Before anything — am I talking to a boy or a girl? |
| scae72fe | אז הגעת. יופי. לפני שנתחיל אני רוצה לדעת את מי אני אוכלת. | | So you came. Good. Before we start I want to know who I'm eating. |
| s0d5203b | בחר לך פרצוף. זה מה שאני אזכור. | | Pick a face. That's what I'll remember. |
| s9836b0a | ואיך קוראים לך? תן שם שאפשר לצעוק. | | And what's your name? Give me one worth shouting. |
| s82a43b6 | ומתי נולדת? זה רק בשבילי. אני אוהבת לדעת כמה זמן חיכיתי. | | And when were you born? That's just for me. I like knowing how long I waited. |
| s42071fe | משהו בפנים. תפתח כבר. | | Something's inside. Open it already. |
| sb72299f | זכית. אל תתרגש מדי. | | You won something. Don't get too excited. |
| se3b46b6 | קח, הרווחת. | | Here. You earned it. |
| se56f9ce | בוא נראה מה יצא לך. | | Let's see what you got. |
| sd4cc59c | בואי נראה מה יצא לך. | | Let's see what you got. |
| s6e563e0 | זה לא יפתח את עצמו. | | It won't open itself. |

## מסכי המשחק — פתיחה, בנייה, קרב, תוצאה

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| safa431d | לרוקן את {0} | | Empty {0} |
| sdfa1c45 | נקה | | Clear |
| sdfad51e | מתארגנת… | | Getting set up… |
| s8da6ce3 | מחפשת לך יריב… | | Finding you an opponent… |
| s7265e57 | נועלת לוחות… | | Locking the boards… |
| s7b1e036 | זהו | | That's it |
| sb472148 | רגע… | | One moment… |
| s49e6902 | רגע… | | One moment… |
| s1396b7a | סובב את המכשיר | | Turn your device |
| sf038582 | אני משוחקת לרוחב, ילד. ככה אני רואה את שניכם. | | I am played sideways, kid. That is how I see you both. |
| sbd466e9 | מחכה לחבר שלך… | | Waiting for your friend… |
| sc18c32d | דק זהה | | Same deck |
| se2c2032 | הפרופיל שלי | | My profile |
| sda25897 | התחברות | | Sign in |
| s1703f49 | הודעות | | Messages |
| s460b8e8 | חזרה לתפריט | | Back to the menu |
| s7ee96f5 | יציאה | | Leave |
| s0dad0ff | הגדרות | | Settings |
| s0eb9706 | יש עדכון שלא קראתם | | There is an update you have not read |
| se65fa4a | השרת לא עונה | | The server is not answering |
| sa759290 | מחכה לחבר שלך… | | Waiting for your friend… |
| s70fb9fd | מחפשת לך יריב… | | Finding you an opponent… |
| sbb39d20 | שלח את הקוד למי שבא לך לאכול: | | Send the code to whoever you feel like eating: |
| s8850299 | ✔ העתקתי | | ✔ Copied |
| sb48d812 | ⧉ העתק הזמנה | | ⧉ Copy invitation |
| s20677b2 | השרת לא עונה. אני פנויה. | | The server is not answering. I am free. |
| s7156cf4 | נגד המחשב | | Against the computer |
| s3ffaa2b | חזרה | | Back |
| s7807abd | ביטול | | Cancel |
| sc2b0252 | הצד שלך | | Your side |
| sc84b632 | החצי שלך | | Your half |
| s502312f | אתה | | You |
| sa531737 | הידיים שלך קפואות | | Your hands are frozen |
| s5d4a4e0 | לשלוף ולזרוק אפשר. להדביק — לא. | | You can draw and you can discard. Placing — no. |
| s138a2c6 | החצי שלך | | Your half |
| sc8775fd | החצי של מי שאיתך | | Your teammate's half |
| sfc83143 | הצד שמולך | | The side facing you |
| s9d29f31 | אמנדה | | Amanda |
| s52b9172 | היריב | | Opponent |
| sf0485e7 | נחשף! | | Revealed! |
| sbcd9db8 | בחר קלף אצל היריב | | Pick a card on the opponent's side |
| s1445cf1 | ועכשיו את השני | | And now the second one |
| s4106038 | בחר קלף על הלוח שלך | | Pick a card on your board |
| s8004b74 | עבור „{0}” | | for “{0}” |
| s7ab31ff | ביטול | | Cancel |
| se6dcc04 | קלפי פעולה | | Action cards |
| s3cec9ca | מאוחר. תכננת גרוע. | | Too late. You planned badly. |
| sb9a31bf | פעיל ∞ | | Active ∞ |
| s34ec88c | נוצל | | Used |
| sa549a85 | מאוחר מדי | | Too late |
| sf916188 | הפעל | | Use |
| sdc8c744 | הסבר | | What it does |
| s932d88e | גע בקלף על הלוח כדי להוריד אותו | | Touch a card on the board to take it off |
| s3adfc6c | הבר מלא | | The bar is full |
| s25edd89 | קח לפעולה | | Take it to the bar |
| s8006c77 | הרץ קרב | | Run a battle |
| sb0d338c | אין קלף | | No card |
| sba4d2ee | קלפים שנשארו בדק | | Cards left in the deck |
| s6c4fc10 | קלפים בפח | | Cards in the trash |
| s7aacede | הבר מלא | | The bar is full |
| s9f032e5 | קח לפעולה | | Take it to the bar |
| sd06d0bd | זרוק | | Discard |
| s1bd8f04 | קח מהפח | | Take from the bin |
| sfbeaf8c | אפשר להניח קלף על קלף שכבר הנחתם — נשארו {0} | | You can stack a card on one you already placed — {0} left |
| sb28db8b | ארבע הפינות פתוחות להנחה כפולה | | All four corners are open for a double placement |
| s4a9f52a | התחל קרב! | | Start the battle! |
| s72c3f50 | מוכן — לחץ לביטול | | Ready — tap to undo |
| sd693107 | אני מוכן | | I'm ready |
| sa4fb281 | שניכם מוכנים — מתחילים | | You are both ready — here we go |
| s0ecac63 | אתה מוכן. אפשר להמשיך לבנות עד שגם הוא יהיה. | | You are ready. You can keep building until your opponent is too. |
| sabbc0bf | היריב מוכן. אתה עדיין יכול לבנות. | | Your opponent is ready. You can still build. |
| seef7e51 | הלוח שלך נעול | | Your board is locked |
| sc0930d9 | מחכה שהיריב יסיים… | | Waiting for the opponent to finish… |
| s40977ec | ממלאת לך את החורים… | | Filling in your holes… |
| s19395af | יפה. עכשיו משהו קצת יותר מתוחכם. | | Nice. Now something a little cleverer. |
| s9b86633 | במשחק הבא יש ליריב לוח אמיתי — ולך יש בדיוק מה שמנצח אותו. | | In the next game your opponent has a real board — and you have exactly what beats it. |
| se31bdcc | קדימה | | Go |
| sb604bef | זהו, אתה יודע לשחק. | | That's it, you know how to play. |
| s80f3ec6 | עכשיו לך תאסוף קלפים. אני רעבה. | | Now go and collect cards. I'm hungry. |
| s8e26ffe | יאללה | | Let's go |
| s0e0ecca | סגירה | | Close |
| sb3ce2e0 | סגירה | | Close |
| scb3bea3 | הדקים שלי | | My decks |
| s7347353 | {0} מזמין אותך למשחק | | {0} is inviting you to a match |
| seaa865f | חבר | | Friend |
| sa2adcdb | קדימה | | Go |
| sfe483c6 | אולי אחר כך | | Maybe later |

## דוח הקרב

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sf4b8060 | {0} עשה {1}% מהנזק של הצד הזה | | {0} did {1}% of this side's damage |
| sb03fb80 | המלך {0} נשא את הקרב — {1}% מהנזק | | King {0} carried the battle — {1}% of the damage |
| sf2f72a8 | {0} קלפים לא נגעו בקרב בכלל — לא תקפו ולא ספגו | | {0} cards never touched the battle — no attacks, no damage taken |
| s92c427c | {0} קלפים בעורף שרדו בלי לתקוף אף פעם — הלוח עמוק מדי | | {0} cards in the back row survived without ever attacking — the board is too deep |
| sb6efc72 | המלך {0} נפל כבר בשנייה {1} | | King {0} fell as early as second {1} |
| s296dff0 | כל הקלפים במסלול {0} נפלו — שם נפרצה החזית | | Every card in lane {0} fell — that is where the line broke |
| s5ac99ca | בוזבז נזק על {0}: ספג {1}% מהחיים שלו | | Damage wasted on {0}: it took {1}% of its health |
| s7268432 | הצד הזה נמחק לגמרי — {0} קלפים | | This side was wiped out completely — {0} cards |
| sa039c8a | קרב צמוד — הוכרע בהפרש של קלף אחד | | A close battle — decided by a single card |
| se153a53 | {0} הרג את עצמו — הנזק החוזר מהיעד היה {1}% מהחיים שלו | | {0} killed itself — the damage reflected back was {1}% of its health |
| sf4060a1 | ניצחון סוחף — {0} קלפים הפרש | | A landslide — {0} cards apart |
| s03917ba | דם ראשון — {0} הפיל את {1} | | First blood — {0} took down {1} |
| s3c01a8e | משהו | | something |
| s4813b7e | {0} הפיל את {1} | | {0} took down {1} |
| se33f63d | משהו | | something |
| s09d8eb1 | המלך {0} נפל | | King {0} fell |
| sf5f7bec | {0} ספג {1} נזק חוזר מ{2} — הוא פגע בקוצים | | {0} took {1} reflected damage from {2} — it hit the spikes |
| s32b1dc6 | {0} התפצל | | {0} split |
| s29eee42 | נחשף קלף קומת קרקע: {0} | | A ground-floor card was revealed: {0} |
| s59a7b2d | {0} הקפיא את {1} | | {0} froze {1} |
| s1abba82 | משהו | | something |
| s3f09475 | הקרב נגמר | | The battle is over |
| s9ab5edb | תיקו. לשנינו טעם רע בפה. | | A draw. We are both left with a bad taste. |
| s1ab2182 | אתה | | You |
| s36e0c61 | היריב | | Opponent |
| sd9066d0 | ניתוח | | Analysis |
| s8c23ea2 | מפה | | Map |
| s634d610 | קלפים | | Cards |
| s0d36f2d | ציר זמן | | Timeline |
| s484ea7e | העתקת הדוח המלא כ-JSON | | Copy the full report as JSON |
| sb22f4be | ✔ הועתק | | ✔ Copied |
| s5970baf | ⧉ העתק JSON | | ⧉ Copy JSON |
| se1d32f8 | הדפדפן לא נתן להעתיק. סמנו הכול והעתיקו ידנית. | | The browser would not allow copying. Select it all and copy by hand. |
| sb9555de | תוצאה | | Result |
| s41257f4 | מהירות | | Speed |
| sb7c0a3f | יחס נזק | | Damage ratio |
| s63fa2b3 | השתתפות הלוח | | Board participation |
| s41fe997 | שרידות | | Survival |
| sb7b9d16 | נזק | | Damage |
| scca46b4 | הפלות | | Takedowns |
| s995ae23 | שרדו | | Survived |
| sf79b753 | נפלו | | Fell |
| sc18fd03 | קרב משעמם. לא קרה כלום. | | A boring battle. Nothing happened. |
| s30b45ab | ככה נראו הלוחות בהתחלה. תראה מה כל קלף עשה. | | This is how the boards started. See what every card did. |
| s1d0a003 | הכי הרבה נזק | | Most damage |
| s9c41951 | תרם נזק | | Dealt damage |
| s3b86504 | ישן | | Asleep |
| s682e386 | נפל | | fell |
| s4acff09 | שרד | | Survived |
| s57f747b | לא זז | | Did not move |
| s65ef918 | לחץ על קלף ואספר לך | | Tap a card and I will tell you |
| s3b1fddd | קלף | | Card |
| se4b01fc | צד | | Side |
| sa777d2c | נזק | | Damage |
| s4e62559 | ספג | | Taken |
| s1fad98a | הפלות | | Takedowns |
| scbe08c2 | סוף | | End |
| sd1502a2 | {0} — מילוי אוטומטי של משבצת ריקה | | {0} — an empty square filled automatically |
| sf6c8aac | {0} — לחצו לפרטים | | {0} — tap for details |
| sf72ed62 | {0} — לחצו לפרטים | | {0} — tap for details |
| secfc437 | עורף | | Back |
| s5b44eac | שלישית | | Third |
| s2f05432 | שנייה | | Second |
| s0160f0c | חזית | | Front |
| s565b00b | לא נגע בקרב. לא הגיע לאף אחד, ואף אחד לא הגיע אליו. | | Never touched the battle. It reached nobody, and nobody reached it. |
| s33300d2 | חטף ולא הספיק להחזיר אפילו מכה אחת. | | Took a beating without landing a single hit. |
| sac3c899 | חתך את הדרך — הפיל {0} קלפים. | | Cut straight through — took down {0} cards. |
| s22f4051 | נשא את הצד שלו: {0}% מכל הנזק. | | Carried its side: {0}% of all the damage. |
| s45645fa | תרם {0}% מהנזק של הצד שלו. | | Dealt {0}% of its side's damage. |
| sbf12851 | סגירה | | Close |
| sa7d29bc | שלך | | Yours |
| s8900b3c | של היריב | | Opponent's |
| s548a9bf | מסלול {0} | | lane {0} |
| sfea5ea2 | שרד | | survived |
| s99b51e8 | נפל ב-{0}s | | fell at {0}s |
| s64a471a | נזק שעשה | | Damage dealt |
| s6353210 | נזק שספג | | Damage taken |
| s48e7c57 | הפלות | | Takedowns |
| s95f2cfd | מכות | | Hits |
| sf9252a0 | מהנזק של הצד: | | Of its side's damage: |
| s80415c3 | חיים: | | Health: |
| s3ef4c7b | (כולל בונוס מלך ×3) | | (including the ×3 King bonus) |
| s5765650 | תזוזה: | | Movement: |
| s0cadd6e | לא זז מילימטר | | Did not move an inch |
| s1eeba78 | התקדם {0} משבצות | | Advanced {0} squares |

## חלון פרטי מפלצת

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s2027844 | סגירה | | Close |
| s461e043 | ענק אמצע | | Middle giant |
| sf0837e4 | רמה {0} | | Level {0} |
| se6317ab | רמה {0} | | Level {0} |
| s50f1f7b | {0} עותקים | | {0} copies |
| sad22ee6 | · הרמה הבאה עולה {0} | | · the next level costs {0} |
| s512576d | · הגעת למקסימום | | · you have reached the maximum |
| sa1b7d2c | חיים | | Health |
| s4173ded | עוצמה | | Power |
| s4763941 | קצב תקיפה | | Attack rate |
| s26ebf92 | {0}ש׳ | | {0}s |
| sefc23b0 | תנועה | | Movement |
| s9546375 | {0}/ש׳ | | {0}/s |
| s60fd570 | סטטי | | Static |
| sa3be69c | טווח | | Range |
| s8fa9cc4 | יכולות | | Abilities |
| s8efe7ee | תפקיד | | Role |
| s4261335 | סינרגיית סדרה: {0} | | Series synergy: {0} |

## חלון פרטי קלף פעולה

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s3383520 | סגירה | | Close |
| s900e8c0 | ∞ פסיבי | | ∞ Passive |
| se9c2d53 | בלחיצה | | On tap |
| s9c8a7eb | מה הוא עושה (אוטומטית) | | What it does (on its own) |
| s333574c | מה הוא עושה בלחיצה | | What it does when tapped |
| s3460857 | ▶ הפעל עכשיו | | ▶ Use it now |
| sc3582bb | כבר נוצל | | Already used |
| s2ed708e | ∞ פועל מעצמו | | ∞ Works on its own |

## תווית קלף פעולה

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sba8cb81 | פסיבי — פועל כל הזמן | | Passive — always working |
| sff358eb | קלף פעולה | | Action card |
| sbeacb74 | פרטי הקלף | | Card details |
| s2ee640d | פסיבי | | Passive |
| sf01886f | קלף פעולה | | Action card |

## קלף מפלצת

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s5379cdd | מסתער | | Charger |
| sd75b53b | מעופף | | Flier |
| sd3446ed | בונוס מלך ×3 | | King bonus ×3 |
| s4aa3080 | ענק אמצע (מתאים למלך) | | Middle giant (suits the King) |
| sdf7d9b8 | פרטי הקלף | | Card details |
| sd3b512b | חיים | | Health |
| s415a2b6 | עוצמה | | Power |
| se274434 | מוסתר בערפל | | Hidden in the fog |

## הלוח

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s3ed5f40 | המלך | | The King |
| s8845f5f | יש קלף מתחת. הוא יצוץ כשהעליון ייפול. | | There is a card underneath. It appears when the top one falls. |
| s0e2bdac | משמר המלך. כאן עוצרים את מי שבא לאכול אותו. | | The King's guard. This is where you stop whoever comes to eat him. |

## זירת הקרב

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sb1bd099 | אתה | | You |
| s8854c7a | היריב | | Opponent |
| s25910a5 | ⏱ נגמר הזמן! | | ⏱ Time's up! |
| sb672b2e | נתקע אחרי {0} שניות בלי ציור | | Stuck after {0} seconds with nothing drawn |
| sbaf8bec | לא הצלחתי להראות לך את הקרב. | | I could not show you the battle. |
| se051373 | הוא כבר הוכרע — אני לוקחת אותך לתוצאה. | | It has already been decided — I am taking you to the result. |
| s54733fd | קדימה לתוצאה | | On to the result |

## גלריית קלפים (כלי פיתוח)

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s30e62ac | גלריית קלפים | | Card gallery |
| s537a98d | רק קלפים עם ציור | | Only cards with artwork |
| sccd4814 | קלפי פעולה | | Action cards |

## מעבדת קרב (כלי פיתוח)

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sd2e39c8 | מעבדת קרב | | Battle lab |
| se4ac52e | שמאל | | Left |
| se019310 | מעורב | | Mixed |
| sef32a80 | ימין | | Right |
| s3962d65 | מעורב | | Mixed |
| s1e70355 | ▶ הרץ שוב | | ▶ Run again |

## טבלאות — אלמנטים, נדירות, סדרות, יכולות

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s3b5fada | אש | | Fire |
| se54cfe6 | מים | | Water |
| s97762a4 | אדמה | | Earth |
| s4ebd96a | אוויר | | Air |
| s047a96e | חשמל | | Electric |
| s6452608 | מתכת | | Metal |
| s1839931 | אור | | Light |
| sd03badd | אופל | | Dark |
| s65e3646 | רעל | | Poison |
| scb4ea40 | משתנה | | Variable |
| sa6527a7 | קרוב | | Melee |
| sdd2006d | רחוק | | Ranged |
| s317ed65 | צלף | | Sniper |
| s255b0a7 | נפוץ | | Common |
| s251c112 | נדיר | | Rare |
| sc88b92c | אפי | | Epic |
| sa91c15e | אגדי | | Legendary |
| sb12fa21 | דרקונים | | Dragons |
| s0e72d20 | ענקים | | Giants |
| s33bdcfd | חרקים | | Insects |
| s8548d4d | צמחים | | Plants |
| sd14e01c | ריריים | | Slimes |
| s3de4a7f | הדף אחורה | | Knock back |
| s592cd53 | הדף הצידה | | Knock sideways |
| s5687c43 | דריסה והמשך | | Trample onward |
| s7e92335 | שאיבה למרכז | | Pull to centre |
| s7ca9c66 | מלכודת הצמדה | | Rooting trap |
| se4a0bda | חסין הדיפה | | Immovable |
| s2beb051 | החזרת נזק | | Reflect damage |
| s64c0a63 | צבירת שריון | | Gain armour |
| sc6f2e8a | שבירת שריון | | Break armour |
| s06c965d | הילת שריון | | Armour aura |
| s82d0727 | ספיגה לשכנים | | Share with neighbours |
| sc53cc27 | הילת הגנה | | Shield aura |
| sc8f8c73 | התחדשות | | Regenerate |
| s4d5bc89 | הילת ריפוי | | Healing aura |
| s9f338b9 | מכה אזורית | | Area strike |
| saf36f95 | חסימת נתיב | | Block the lane |
| s2b9b46b | הקפאה במכה | | Freeze on hit |
| s9454569 | רעל מצטבר | | Stacking poison |
| s46a5630 | בליעת יריב | | Swallow rival |
| sfe07448 | הילת האטה | | Slowing aura |
| s703d3b1 | הילת מהירות | | Speed aura |
| sab709b3 | התמרה מושהית | | Delayed change |
| s58ed0ca | נחיל במוות | | Swarm on death |
| s42bf123 | פיצול במוות | | Split on death |
| s5cbfbc5 | הקרבת בעל-ברית | | Sacrifice an ally |
| s271ce55 | גניבת אלמנט | | Steal element |

## נתוני קלפים

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s09e69cb | מפלץ פירורים | | Crumb Demon |

## components/About.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s4c6892c | אמנדה המפלצת מסונול כצנלסון | | Amanda, the Monster from the Sonol on Katznelson |
| s8c8128f | אמנדה המפלצת מסונול כצנלסון | | Amanda, the Monster from the Sonol on Katznelson |
| sa1ba3d6 | עלינו | | About us |
| s4bda300 | פרטיות | | Privacy |
| s4947c25 | נגישות | | Accessibility |
| s16ab030 | תנאים | | Terms |
| sd1e2d62 | סגירה | | Close |
| sc87eb06 | {0}: חפשו ביוטיוב | | {0}: search YouTube for |
| s315003f | אם אתם מפחדים ממפלצות — המשחק הזה לא בשבילכם | | If monsters scare you, this game is not for you |
| sb21002c | הכירו את אמנדה: המפלצת הכי חזקה באלבום המפלצות. דרקונים יורקי אש, ענקי אבן, אפילו צ'ופי המחשמל — כולם ניסו להילחם בה ונכשלו. אמנדה אכלה את כולם לארוחת ערב, והיא תשמח לאכול גם אתכם לקינוח. | | Meet Amanda: the strongest monster in the monster album. Fire-breathing dragons, stone giants, even Chuppy the Electric — every one of them tried to fight her, and every one of them lost. Amanda ate the lot for dinner, and she would be delighted to have you for dessert. |
| s00f650e | אבל זה לא אומר שאתם צריכים לוותר מראש. אם יש לכם סבלנות ומוח, אם אתם יודעים לאסוף את הקלפים הנכונים ולהשתמש בהם בתבונה, אם יש לכם חברים שיודעים לשחק טוב כמוכם ובעיקר — אם יש לכם אומץ להתמודד מול המפלצת החזקה מכולם — אולי תוכלו לנצח ולהיות מלכי המפלצות. | | That doesn't mean you should give up before you start. If you have patience and a brain, if you can collect the right cards and play them wisely, if you have friends who play as well as you do — and above all, if you have the nerve to stand in front of the strongest monster of them all — you might just win, and become king of the monsters. |
| s7a86ff4 | המשחק נוצר על ידי הוד אסולין ואור אסולין, בהשראת הסרט שיצרנו יחד: “אמנדה — המפלצת מסונול כצנלסון”. מוזמנים לצפות בו ולהעלות לנו קצת את הצפיות. תיהנו! | | Made by Hod Asulin and Or Asulin, inspired by the film we made together: “Amanda — the Monster from the Sonol on Katznelson”. Go and watch it, and push our view count up a bit while you're there. Have fun! |
| sf8961a7 | הסרט המלא | | The full film |
| s2173639 | לראות שוב את הפתיח | | Watch the opening again |
| sce69090 | שיר הנושא | | The theme song |
| sf085dc3 | המוזיקה שמתנגנת כאן היא שלנו. לשמוע אותה במלואה: | | The music playing here is ours. To hear all of it: |
| s9b547f8 | השיר | | The song |
| s02cec25 | מדיניות פרטיות | | Privacy policy |
| sbfac0cb | עודכן: אוקטובר 2026 | | Updated: October 2026 |
| sda5279b | מה נשמר עליך | | What we keep about you |
| s9a31259 | כינוי, אווטאר ומגדר | | Nickname, avatar and gender |
| sc5a94ee | — אם בחרת. אפשר לשחק בלי אף אחד מהם. | | — if you chose them. You can play without any of them. |
| s2dcc96e | תאריך לידה | | Date of birth |
| s7bf0944 | — רק כדי לוודא גיל מינימלי של 7. נשמר כתאריך, לא | | — only to confirm a minimum age of 7. Stored as a date, not |
| s680df67 | כתעודת זהות, ולא משותף עם אף אחד. | | as an identity document, and is not shared with anybody. |
| sb82d9bb | ההתקדמות שלך | | Your progress |
| sb049d69 | — גביעים, יהלומים, הקלפים באלבום, ותוצאות | | — trophies, diamonds, the cards in your album, and results |
| sbf10f6b | המשחקים ששיחקת. | | the games you have played. |
| sc1ff6e0 | חשבון | | Account |
| sfcd6056 | — ברירת המחדל היא חשבון אנונימי בלי שם ובלי אימייל. אם | | — the default is an anonymous account with no name and no email. If |
| se0c1408 | בחרת להתחבר עם גוגל או עם אימייל, נשמרת גם כתובת האימייל שלך. | | you chose to sign in with Google or with email, your email address is kept as well. |
| s0e064c8 | מה לא נשמר | | What we do not keep |
| s3d74007 | אין פרסומות, אין מזהי פרסום, אין מעקב בין אתרים, ואין צ'אט חופשי. אנחנו לא אוספים מיקום, אנשי קשר, תמונות או מיקרופון. | | No ads, no advertising identifiers, no cross-site tracking and no free chat. We do not collect location, contacts, photos or microphone. |
| s17cae8a | איפה זה יושב | | Where it is kept |
| s5b4f8cf | על שרתי Supabase בפרנקפורט שבגרמניה (האיחוד האירופי). רק אתה יכול לקרוא את השורות שלך — בסיס הנתונים חוסם גישה לשורות של מישהו אחר ברמת המסד עצמו, לא רק באפליקציה. | | On Supabase servers in Frankfurt, Germany (the European Union). Only you can read your own rows — the database blocks access to anybody else's rows at the database itself, not only in the app. |
| sa910811 | איך מוחקים הכול | | How to delete everything |
| s006c31b | בגלגל השיניים למעלה, תחת מחיקת מידע, יש מחיקת החשבון שלי. היא מוחקת את החשבון, האלבום, הגביעים וההיסטוריה — מיד, בלי תקופת המתנה ובלי לשלוח אימייל. אי אפשר לבטל. | | In the settings gear at the top, under Delete my data, there is Delete my account. It erases the account, the album, the trophies and the history — right away, with no waiting period and no confirmation email. It cannot be undone. |
| scf1e0b8 | יצירת קשר | | Contact |
| s55a8220 | לשאלות על פרטיות או למחיקת מידע: amanda@orasul.in | | For privacy questions or to delete your data: amanda@orasul.in |
| s3bbb564 | הצהרת נגישות | | Accessibility statement |
| s98d6639 | עודכן: אוקטובר 2026 | | Updated: October 2026 |
| s8de9bac | אנחנו משתדלים שהמשחק יהיה נגיש לכמה שיותר אנשים, ומכוונים לתקן הישראלי ת״י 5568 ולהנחיות WCAG 2.1 ברמה AA. | | We try to make the game usable by as many people as possible, and we aim at the Israeli standard SI 5568 and at WCAG 2.1 level AA. |
| s9e45ede | מה כבר נעשה | | What has been done |
| s0b8e183 | כל הכפתורים נגישים במקלדת וסימון המיקוד נשאר גלוי. | | Every button can be reached by keyboard, and the focus outline stays visible. |
| s1897e21 | מי שביקש פחות תנועה במערכת ההפעלה — האנימציות נעצרות. זה כולל את ההבהובים, הניצוצות והתיבות הקופצות. | | If you have asked your operating system for less motion, the animations stop. That includes the flashing, the sparkles and the popping chests. |
| s12cb0a6 | אפשר לכבות את הצלילים ואת המוזיקה בנפרד, והבחירה נשמרת. | | Sounds and music can be turned off separately, and the choice is remembered. |
| s0ec6329 | אייקונים נושאים תיאור טקסטואלי כשהם עומדים בפני עצמם. | | Icons carry a text description when they stand on their own. |
| s99b2530 | המשחק עובד לאורך ולרוחב, ובלי לנעול את גודל הטקסט. | | The game works in portrait and in landscape, and does not lock the text size. |
| s1bd53f9 | מה עוד לא | | What has not been done yet |
| s7e382b5 | הקרב עצמו הוא אנימציה גרפית, ואנחנו עדיין עובדים על תיאור טקסטואלי מלא של מה שקורה בו. דוח הקרב בסוף כל משחק מתאר את ההתרחשות במילים, וזו כרגע הדרך הנגישה לדעת מה קרה. | | The battle itself is a graphical animation, and we are still working on a full text description of what happens in it. The battle report at the end of every game describes what happened in words, and for now that is the accessible way to know what went on. |
| s9e79aac | נתקלתם בבעיה? | | Run into a problem? |
| se71be7a | ספרו לנו דרך פרטי הקשר בדף החנות, ונתקן. | | Tell us through the contact details on the store page and we will fix it. |
| s1c1af17 | תנאי שימוש | | Terms of use |
| sadf3694 | עודכן: אוקטובר 2026 | | Updated: October 2026 |
| s2b98856 | המשחק חינמי. אין רכישות בתוך האפליקציה. | | The game is free. There are no in-app purchases. |
| sab731f2 | הגיל המינימלי הוא 7. | | The minimum age is 7. |
| s7b2b5d0 | הקלפים, הדמויות, האיורים והסיפור הם שלנו. אפשר לשחק, אי אפשר למכור או להפיץ אותם. | | The cards, the characters, the artwork and the story are ours. You may play with them; you may not sell them or pass them on. |
| sc9d7902 | מי שמתנהג לא יפה כלפי שחקנים אחרים עלול להיות מושעה — לזמן קצוב או לצמיתות. | | Anybody who behaves badly towards other players may be suspended — for a set time or for good. |
| s2724777 | אנחנו עושים כמיטב יכולתנו שהשמירה תעבוד, אבל המשחק ניתן כמו שהוא. אם השרת נופל, האלבום שלכם נשאר — הוא לא שמור במכשיר. | | We do our best to keep saving working, but the game is provided as it is. If the server goes down your album stays — it is not kept on your device. |

## components/Album.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sdf8896f | ← חזרה | | ← Back |
| sfb0ff51 | אתה משחק מהדק המלא | | You are playing from the full deck |
| s5c7bb8f | הקרבות שלך | | Your battles |
| sf9d8dd4 | ניצחונות | | Wins |
| s0ab9316 | {0} מתוך {1} | | {0} out of {1} |
| s2fd7491 | שיא גביעים | | Best trophies |
| s3cfae6d | הקרבות האחרונים, החדש ביותר ראשון | | Your most recent battles, newest first |
| s176d067 | עותקים — כמה פעמים אפשר להניח אותו | | Copies — how many times you can place it |
| s4308b06 | רמה {0} | | Level {0} |
| s3e3750f | מקסימום | | Max |
| s6c954dd | {0} מתוך {1} קלפים לשדרוג | | {0} of {1} cards to upgrade |
| s15650ab | שדרוג לרמה {0} | | Upgrade to level {0} |
| sac15acb | שדרוג | | Upgrade |

## components/ArenaTrack.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s84b983e | כל הארנות | | All the arenas |
| sbdb539a | {0} · עוד {1} | | {0} · {1} more |
| s00844be | הגעת לסוף הדרך | | you reached the end of the road |
| s92d6d79 | סגירה | | Close |
| s474cafb | הדרך | | The road |
| s2411278 | אתה כאן | | You are here |

## components/ArenaUp.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| se7b9be7 | עלית ארנה | | Arena up! |
| s6a89081 | קדימה! | | Let's go! |

## components/BattleScreen.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s1a437d7 | שגיאה בהצגת הקרב | | Something went wrong showing the battle |
| s3e7a5b3 | המשך לתוצאה | | On to the result |
| s0e0b682 | רגע… | | One moment… |
| s84d910b | עצור וחזור ללוח | | Stop and go back to the board |

## components/BirthdayCard.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sfe72726 | יום הולדת שמח | | Happy birthday |
| sb4b4284 | בן {0} היום! | | {0} today! |
| s5dc59d0 | היום זה היום שלך! | | Today is your day! |
| sf6a63bb | תודה! | | Thanks! |

## components/CardPicker.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sa38c228 | בלי קלף ביד — נגיעה בקלף על הלוח מורידה אותו | | With no card in hand, touching a card on the board takes it off |
| s06b4234 | מחק | | Delete |
| s7af4893 | חיפוש קלף… | | Search for a card… |
| sddd5ff9 | הכול | | All |
| s251d187 | פעולה | | Action |
| s0d0c2fd | קלפי פעולה | | Action cards |
| s5b61d19 | אין קלף כזה. המצאת אותו? | | No such card. Did you make it up? |

## components/Challenges.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sfbba2d0 | היום | | Today |
| sb2dcc21 | השבוע | | This week |
| scbbd32e | החודש | | This month |
| sa421571 | עוד פחות משעה | | Less than an hour left |
| sde4b772 | עוד {0} שעות | | {0} hours left |
| s58b31e8 | עוד יום | | One day left |
| sa1356f2 | עוד {0} ימים | | {0} days left |
| se995a4a | אתגרים | | Challenges |
| s4b399e6 | אתגרים | | Challenges |
| s8037b61 | יש פרס לקחת | | There is a prize to collect |
| sb752d13 | נלקח | | Collected |
| s1d3665c | לקחת | | Collect |
| sac7fc13 | אתגרים | | Challenges |

## components/ChestReveal.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s82374a3 | תיבת עץ | | Wooden chest |
| s662d31c | תיבת כסף | | Silver chest |
| s5bba8e8 | תיבת זהב | | Gold chest |
| s3a10489 | פתח {0} | | Open {0} |
| sbcd9e71 | יפה | | Nice |
| s297ce81 | {0} קלפים חדשים! | | {0} new cards! |
| s605a181 | קלף חדש! | | A new card! |
| s340e045 | ועוד {0} | | and {0} more |
| s70a58ef | איזה יופי | | Lovely |
| sb0e2d63 | חדש אצלך | | New to you |

## components/ChestShelf.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sb1a59ea | תיבות שמחכות לך | | Chests waiting for you |
| s97a626f | פתח | | Open |

## components/DeckBuilder.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sa92d994 | מחיר | | Price |
| s57bf777 | עוצמה | | Power |
| s1950df9 | חיים | | Health |
| s39768fa | סדרה | | Family |
| sa1cd05d | א-ב | | A–Z |
| s7d2f2c0 | תנועה | | Movement |
| s91ecd04 | זזים | | Moving |
| s3fc66d9 | סטטיים | | Static |
| s1d926cf | עפים | | Flying |
| sfeaf273 | קרב | | Combat |
| s2e7ed39 | יורים מרחוק | | Ranged |
| s2845407 | רודפים את המלך | | Hunts the King |
| sb15ae7e | יכולת | | Ability |
| scae68e4 | חיים אחרי המוות | | Life after death |
| s234a399 | מרפאים | | Healers |
| s2c85215 | מחזירים נזק | | Returns damage |
| s7966a9d | משוריינים | | Armoured |
| sf621727 | משפחה | | Family |
| s0ce23c9 | שם לדק | | Name this deck |
| sd87ddf0 | חזרה | | Back |
| sd7b2e93 | גב הקלפים | | Card back |
| s1cf2150 | הדק שלי | | My deck |
| s7ec416f | מלא לי | | Fill it for me |
| s1776336 | הורד מהדק | | Take it out |
| sa0f9456 | סינון | | Filter |
| se3355ce | לנקות | | Clear |
| s3451fcc | מיון | | Sort |
| s9db8c07 | האלבום שלי | | My album |
| scba3d8d | שמור | | Save |
| se0c2a5c | מחק | | Delete |
| sad4a141 | לערוך | | Edit |
| s4a9e250 | דק {0} | | Deck {0} |

## components/ErrorBoundary.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s231aee0 | משהו נשבר | | Something broke |
| s9959640 | זה קורה. האוסף שלך שמור. | | It happens. Your collection is safe. |
| sb1a0138 | לטעון מחדש | | Reload |

## components/Friends.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s99cd003 | בלי שם | | No name |
| s92f2116 | סגירה | | Close |
| s6fa5878 | להוסיף חבר | | Add a friend |
| s2e78dd8 | חברים | | Friends |
| sf41dbdb | רגע… | | One moment… |
| s451672b | עוד אין כאן אף אחד. | | Nobody here yet. |
| se22affe | רוצה להיות חבר שלך | | wants to be your friend |
| s3d6a918 | מחכה שיאשר | | Waiting for them to accept |
| s7171c91 | מחובר | | Online |
| s940973e | לא מחובר | | Offline |
| s6bdffb3 | להוסיף חבר | | Add a friend |
| s310399d | הקוד שלי | | My code |
| sec12a0d | קוד של חבר | | Friend's code |
| s2a0da49 | הוספה | | Add |
| s1620146 | רגע… | | One moment… |
| sbec9016 | רק מי ששיחקת מולו. | | Only people you have played against. |
| sc5ab4b1 | חזרה | | Back |
| scf8308e | רוצה להיות חבר שלך | | Wants to be your friend |
| se2994f6 | מחכה שיאשר | | Waiting for them to accept |
| s5855269 | מחובר | | Online |
| sc89c440 | לא מחובר | | Offline |
| s93ea90a | יהלומים | | Diamonds |
| s48d6a95 | ארנה | | Arena |
| s456c1ca | קלפים | | Cards |
| s7e4bcf7 | כן, חברים | | Yes, friends |
| s7d7e4b6 | אפשר להזמין ממסך הבית | | You can invite from the home screen |
| s9e7bf93 | שחק | | Play |
| sc40cb8d | בטוח? | | Sure? |
| seb9ab82 | כן, להפסיק | | Yes, end it |
| s4075081 | כן, לבטל | | Yes, cancel |
| sb44edc2 | לא | | No |
| s97fbe28 | להפסיק חברות | | End friendship |
| sd770e7d | לבטל את הבקשה | | Cancel the request |

## components/HomeScreen.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s5eb66c7 | קליל | | Easy |
| s9251769 | לוח דליל, קלפים חלשים. מנצח ב-17% מהקרבות. | | A thin board, weak cards. Wins 17% of its battles. |
| s0c9f683 | רגיל | | Normal |
| s901d39c | בונה כמו שהוא יודע. חצי-חצי. | | Builds as well as it knows how. Fifty-fifty. |
| sc93cdac | קשה | | Hard |
| s62d48e5 | בוחר מתוך אוסף גדול בהרבה. מנצח בערך ב-58%. | | Picks from a much bigger collection. Wins about 58%. |
| sfd7535c | אמנדה | | Amanda |
| s86247d1 | משחק קלפים מפלצתי | | Monster card game |
| s0cadb17 | לשחק | | Play |
| s066beed | כמה הבוט מתאמץ | | How hard the bot tries |
| sb99e77d | לשחק עם בוט | | You vs. Bot |
| s0443085 | לא בגרסה הזאת | | Not in this version |
| sa6f7e6a | לשחק עם חברים | | You vs. Friends |
| s665bc9f | לפתוח חדר | | Open a room |
| s3ebc7cd | יש לי קוד | | I have a code |
| saedd95d | מישהו אקראי | | Somebody random |
| s9cadb42 | ← חזרה | | ← Back |
| scf8cabd | קוד החדר | | Room code |
| sd1f36fa | הצטרף | | Join |
| s2c8e767 | עוד מודים | | More modes |
| s1dda509 | בלי שעון, שני הצדדים שלך | | No clock, both sides are yours |
| s77f529a | מגרש המשחקים | | The playground |
| s48c712b | החשבון הזה מושעה עד {0}. אפשר לשחק נגד המחשב בינתיים. | | This account is suspended until {0}. You can play against the computer meanwhile. |
| sd01b2d8 | אין חדר כזה. אולי המצאת אותו. | | No such room. Maybe you made it up. |
| sf8d116e | זה הקוד שלך. אתה לא יכול לאכול את עצמך. | | That is your own code. You cannot eat yourself. |
| s1f6e5ea | החדר מלא. שניים מספיקים לי. | | The room is full. Two is enough for me. |
| sefa91e2 | ההתקדמות שלי | | My progress |
| s7c9dce4 | הדק שלי | | My deck |
| sac17bac | האלבום שלי | | My album |
| s3cd2566 | מה יש לך | | What you have |
| s5d488a4 | האוסף שלי | | My collection |
| s3fc668a | דק | | Deck |
| sb1c5413 | האלבום | | The album |
| s2706aa0 | חנות נוחות | | Corner Shop |
| s26c5785 | חדש בחנות | | New in the shop |
| s0cab6b9 | חברים | | Friends |
| s44d803c | חברים | | Friends |
| sd0647c4 | מישהו מחכה לתשובה | | Somebody is waiting for an answer |

## components/Inbox.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s9b9aa0b | עכשיו | | Just now |
| s16309f9 | לפני {0} דק׳ | | {0} min ago |
| sf183b5f | לפני {0} שע׳ | | {0} hr ago |
| sa00dd23 | סגירה | | Close |
| sca9e956 | הודעות | | Messages |
| sbaae76e | רגע… | | One moment… |
| s3fa36bf | שקט כאן. זה בסדר. | | It is quiet here. That is fine. |
| s1c852d5 | לראות | | See it |

## components/Intro.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s7bf4370 | דלג | | Skip |

## components/LevelUp.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sc54710e | שדרוג! | | Upgraded! |
| s63923f0 | חזק ב-{0}% | | {0}% stronger |
| sfe8cfe5 | מגניב! | | Cool! |

## components/MatePeek.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s8a4e2d5 | להגדיל את החצי של מי שאיתך | | Make your teammate's half bigger |
| sf3cf709 | סגירה | | Close |

## components/MoreModes.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s4fc5b19 | אמנדה — הצצה | | Amanda — a peek |
| s7767343 | מולה לבד. אי אפשר לנצח. | | Against her, on your own. You cannot win. |
| s7c9fba9 | דק זהה | | Same deck |
| secbb695 | אותם קלפים לשני הצדדים. | | The same cards for both sides. |
| se14e946 | 2 נגד 2 | | 2 against 2 |
| sac17390 | שניים בונים לוח אחד. | | Two of you build one board. |
| se4e1ef0 | דראפט | | Draft |
| s4b7da7f | מה שלא לקחת הולך ליריב. | | Whatever you do not take goes to your opponent. |
| sc4d6c42 | סגירה | | Close |
| sa53602d | עוד מודים | | More modes |
| sbdb5aac | בקרוב | | Soon |
| sb8d28c1 | שחק | | Play |

## components/NachoBar.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s90346fe | {0} נאצ'וס מתוך {1} לתיבה הבאה | | {0} nachos out of {1} to the next chest |
| s65876b9 | כל משחק נותן נאצ'וס, לפי כמה טוב שיחקת | | Every game gives nachos, depending on how well you played |

## components/Onboarding.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s7628ae6 | שחקן | | Player |
| sbe708cc | יאללה | | Let's go |
| s8d5377a | אחר כך | | Later |
| sd66df01 | בן | | Boy |
| s51bc16c | בת | | Girl |
| s4e5fa5b | למה להגדיר? | | Why set this? |
| s42fb787 | זה אני | | That's me |
| s8e369df | הכינוי שלך | | Your nickname |
| sb359ace | קדימה | | Go |
| sbccb202 | בשביל לשחק נגד אנשים אחרים צריך להיות בן {0} לפחות. נגד הבוט — תמיד אפשר. | | To play against other people you have to be {0} or older. Against the bot — always. |
| sd694b8e | סיימנו | | Done |
| scea7960 | בלי להגיד | | Not saying |

## components/Payout.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sedb65d6 | תיבה מחכה לך! | | A chest is waiting for you! |
| s1b4740d | אתגר הושלם | | Challenge complete |
| s440773f | {0} אתגרים הושלמו | | {0} challenges complete |
| s854fe19 | מספיק גביעים מהבוט להיום — נאצ'וס ואתגרים ממשיכים | | Enough trophies from the bot for today — nachos and challenges carry on |
| s937aed8 | עוד {0} נאצ'וס ותיבה | | {0} more nachos and a chest |

## components/Profile.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| see9fd0e | נשמר | | Saved |
| sc37bae6 | ← חזרה | | ← Back |
| sa83f16f | החלף פרצוף | | Change face |
| s5516565 | הכינוי שלך | | Your nickname |
| safd776c | ניהול | | Admin |
| s2cf62eb | פתח את לוח הניהול | | Open the admin panel |
| s23e4e7c | לצאת מהחשבון? | | Sign out of the account? |
| s6059eba | הכול נשמר, ואפשר לחזור. | | Everything is saved, and you can come back. |
| s9dc75cf | כן, לצאת | | Yes, sign out |
| sae4c613 | ביטול | | Cancel |
| s56f3a93 | משפט המחץ שלי | | My catchphrase |
| sf806fc3 | בלי משפט | | No catchphrase |
| s878f7ab | איך לפנות אליך | | How to address you |
| s9003bc9 | בן | | Boy |
| sb434f05 | בת | | Girl |
| s95fa408 | למה להגדיר? | | Why set this? |
| sf69f486 | יום ההולדת שלך | | Your birthday |
| sde6d97c | נגד אנשים — מגיל {0} | | Against people — age {0}+ |
| sf5092ae | שמור שינויים | | Save changes |
| sc0f520f | החשבון שלך | | Your account |
| sa8324d2 | מחובר | | Signed in |
| sa4507ca | יציאה / החלפת משתמש | | Sign out / switch user |
| s2248739 | המשך עם גוגל | | Continue with Google |
| s074bcb0 | או | | or |
| sc8aa4b2 | אימייל | | Email |
| scebe1c7 | סיסמה (6 תווים ומעלה) | | Password (6 characters or more) |
| s1d9574c | מחובר | | Signed in |
| s0d032c8 | שמור עם אימייל | | Save with email |

## components/Report.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sb82583e | סגירה | | Close |
| sf3ddba9 | קיבלנו. | | Got it. |
| s2c4bff4 | נסתכל על זה. תודה שסיפרת לנו. | | We will look at it. Thank you for telling us. |
| s62681f7 | סגור | | Close |
| s8566da7 | לספר לנו משהו | | Tell us something |
| s70bbb9d | משהו לא עובד | | Something is not working |
| s7945004 | שחקן שהתנהג לא יפה | | A player who behaved badly |
| s632b011 | אפשר לדווח רק על מישהו ששיחקת מולו, ורק אם יש לו חשבון. | | You can only report somebody you have played against, and only if they have an account. |
| s32c1f5b | רגע… | | One moment… |
| s9a36847 | עוד לא שיחקת מול שחקן רשום. דיווח על שחקן אפשרי רק אחרי משחק כזה. | | You have not played against a registered player yet. Reporting a player is only possible after a game like that. |
| sdd0c69b | בלי שם | | No name |
| s39b2618 | מה קרה? מה ציפית שיקרה? | | What happened? What did you expect to happen? |
| saa2714a | מה הוא עשה? | | What did they do? |
| se6b6c12 | שולח… | | Sending… |
| sb224f0c | שליחה | | Send |
| s8978c83 | ביטול | | Cancel |

## components/ResultScreen.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sb73e6cd | הצד שלך החזיק | | Your side held |
| sb66c1e6 | הצד שמולך החזיק | | The side facing you held |
| s6832cda | {0}ש׳ | | {0}s |
| sb4b2aa8 | {0} נפלו | | {0} fell |
| s6052ae4 | מתחילים… | | Starting… |
| s30a40da | מחכה ליריב… | | Waiting for the opponent… |
| s21914e7 | רוצים עוד אחד! קדימה | | We want another one! Come on |
| sab50205 | קרב חוזר | | Rematch |
| s2d822f4 | ← חזרה ללוח | | ← Back to the board |
| se3da978 | משחק חדש | | New game |
| s28e9a18 | חזרה | | Back |
| seb359d8 | דיווח על היריב | | Report your opponent |
| s18fbbed | מספיק, הבנתי | | Enough, I get it |
| se664893 | שאסביר לך מה קרה? | | Shall I explain what happened? |

## components/Say.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sba7f872 | סגירה | | Close |
| sf1e57a9 | להגיד משהו | | Say something |
| sedb69c9 | סגירה | | Close |
| sc6886d9 | להגיד משהו | | Say something |
| s1e8d9ca | עוד אימוג'ים בחנות | | More emoji in the shop |
| s7e6e15e | עוד | | More |
| s299e1cd | לא לראות הודעות | | Hide messages |
| sf929198 | להראות הודעות שוב | | Show messages again |
| sed1b7c0 | אין אימוג'ים | | No emoji |

## components/Settings.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sbf142a2 | עברית | | Hebrew |
| sc8369bd | עלינו | | About |
| saf78986 | פרטיות | | Privacy |
| sf13b7f5 | נגישות | | Accessibility |
| sf28862a | תנאים | | Terms |
| se811a27 | סגירה | | Close |
| seb080a0 | הגדרות | | Settings |
| s497670b | צלילים | | Sounds |
| s6af16ba | כבוי | | Off |
| s4e2eb6c | דולק | | On |
| sa503b39 | מוזיקה | | Music |
| s6f43267 | דולקת | | On |
| s3c95ca3 | כבויה | | Off |
| s46dcd47 | שפה | | Language |
| s15c7730 | איך משחקים | | How to play |
| s8e11615 | מה חדש | | What's new |
| s6eed161 | יש עדכון שלא קראתם | | There is an update you have not read |
| s50fb087 | משהו לא עובד? | | Something not working? |
| s3d84a17 | גרסה {0} · מסך {1} | | version {0} · screen {1} |
| s7dee97b | מוריד אותי מחדש ומנקה גרסאות ישנות | | Downloads me again and clears out old versions |
| s1f572e7 | ⟳ רענן | | ⟳ Refresh |
| sf4d6e5d | מחיקת מידע | | Delete my data |
| sa694783 | מחיקת הפרטים שלי | | Delete my details |
| s60338b2 | מחיקת החשבון שלי | | Delete my account |
| s5a90022 | למחוק את הפרטים שלך? | | Delete your details? |
| s926d0e0 | הכינוי, הפרצוף, יום ההולדת, משפט המחץ, רשימת החברים וכל המשחקים שלך — נמחקים. | | Your nickname, face, birthday, catchphrase, friends list and all your matches are erased. |
| s6e1464d | האלבום, הקלפים, הגביעים והיהלומים נשארים. | | The album, the cards, the trophies and the gems stay. |
| s9a33847 | מוחק… | | Deleting… |
| sa2535e5 | כן, למחוק את הפרטים | | Yes, delete the details |
| sf2fe2be | ביטול | | Cancel |
| s119a2a3 | למחוק את החשבון? | | Delete the account? |
| s57fde6a | הכול נמחק: האלבום, הקלפים, הגביעים, היהלומים וההיסטוריה. מיד, בלי תקופת המתנה. | | Everything goes: the album, the cards, the trophies, the gems and the history. Right away, with no waiting period. |
| s06f4486 | אי אפשר לבטל. | | This cannot be undone. |
| sc39a712 | אם רק רצית לשחק מחשבון אחר — יציאה / החלפת משתמש בפרופיל עושה את זה בלי למחוק כלום. | | If you only wanted to play from another account, Sign out / switch user in your profile does that without deleting anything. |
| sa4bb51d | מוחק… | | Deleting… |
| s15a335a | כן, למחוק הכול | | Yes, delete everything |
| sfb7cc23 | ביטול | | Cancel |

## components/Shop.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s509b97d | פרצופים | | Faces |
| sa52276e | מראה לקלפים | | Card looks |
| s0185a61 | גב לקלפים | | Card backs |
| s63ae982 | אימוג׳ים | | Emoji |
| se3cd8fd | משפטי מחץ | | Catchphrases |
| sd9e67b5 | תיבות | | Chests |
| s26df959 | קלפים | | Cards |
| s56fa87f | סגירה | | Close |
| s4eef1f1 | חנות נוחות | | Corner Shop |
| s0f95b79 | רגע… | | One moment… |
| s947b31f | המדפים עוד ריקים. בקרוב. | | The shelves are still empty. Soon. |
| s1a96dcd | שלך | | Yours |
| s585947b | אין מספיק יהלומים | | Not enough diamonds |
| s9eddab1 | חינם | | Free |

## components/SignedInOnly.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s9c73ff4 | צריך חשבון. זה חינם, ושומר את האלבום שלך. | | You need an account. It is free, and it keeps your album. |
| s3e98614 | האלבום נשמר — גם אם תנקה את הדפדפן או תחליף מכשיר | | Your album is kept — even if you clear the browser or change device |
| se65df62 | לשחק מול אנשים אמיתיים | | Play against real people |
| s627ac6b | חברים — לראות מי מחובר ולהזמין למשחק | | Friends — see who is online and invite them to a game |
| sa9713fa | חנות נוחות | | Corner Shop |
| s59e83a1 | סגירה | | Close |
| sde7d6f8 | עם חשבון זה שלך | | With an account it is yours |
| se86ff27 | בלי חשבון אפשר לשחק ולאסוף — אבל הכול יושב רק בדפדפן הזה, וברגע שתנקה אותו או תעבור למכשיר אחר, הוא ייעלם. | | Without an account you can play and collect — but it all sits in this browser only, and the moment you clear it or move to another device, it is gone. |
| s29640f4 | להתחבר | | Sign in |
| s88dd08b | אחר כך | | Later |

## components/Tutorial.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sbecf213 | המשך ← | | Continue → |
| s7955b5e | אני יודע לשחק | | I know how to play |

## components/Updates.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s25bc69f | סגירה | | Close |
| s2ddcf0b | מה חדש | | What's new |
| s0c0129b | עוד לא קרה כלום. תחזרו. | | Nothing has happened yet. Come back. |
| s912daec | חדש | | New |

## components/Versus.tsx

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s67c1f88 | ביחד | | Together |
| s91836d5 | אני | | Me |
| sb1bf590 | היריב | | Opponent |

## data/tutorialLines.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sec89d42 | היי, אני אמנדה. באת להילחם מולי, ילד? בוא נלמד איך עושים את זה. | | Hi, I'm Amanda. You came to fight me, kid? Let's learn how it's done. |
| s9484b03 | ההקדמה, לפני שהיא מצביעה על משהו | | The introduction, before she points at anything |
| sad8f4bf | אנחנו בחדר המשחקים. אם תנצח אותי פה תוכל להתקדם למקומות אחרים. זה האלבום שלי, זה האלבום שלך. אנחנו מדביקים מדבקות, ובסוף הן ילחמו. | | We are in the games room. Beat me here and you can move on to other places. This is my album, that one is yours. We stick stickers on, and in the end they fight. |
| s6da50a2 | ההקדמה, שורה שנייה | | The introduction, second line |
| sf6e019c | נתחיל בהדבקות. הנה הקלף הראשון — {card}. {trait}. {where}. | | Let's start sticking. Here is the first card — {card}. {trait}. {where}. |
| s3b5a80d | הקלף הראשון, על לוח ריק | | The first card, on an empty board |
| sdd3544e | עוד אחד: {card}. {trait}. {where}. | | Another one: {card}. {trait}. {where}. |
| s8231a88 | הקלף השני | | The second card |
| s267eda8 | ועכשיו המלך. הוא לא זז, הוא חזק פי שלושה, ואם הוא נופל — נגמר. | | And now the King. He does not move, he is three times as strong, and if he falls it is over. |
| s5384124 | אחרי שני קלפים, כשאין עדיין מלך | | After two cards, when there is still no King |
| s2e3ddc3 | {card}? סטטי, הרבה חיים. הוא לא ילך לשום מקום — שים אותו מול המלך, שם עוצרים את מי שבא אליו. | | {card}? Static, plenty of health. He is not going anywhere — put him in front of the King, that is where you stop whoever comes for him. |
| scbdee8f | קלף כבד וסטטי ביד, אחרי שיש מלך | | A heavy static card in hand, once there is a King |
| s5877095 | {card} {moves} — הוא לא צריך שהדרך תהיה פנויה. שים אותו מאחורה ושיירה משם. | | {card} {moves} — it does not need a clear path. Put it at the back and let it shoot from there. |
| s9bfb295 | מעופף או צלף ביד | | A flier or a sniper in hand |
| sc22b303 | קלף פעולה. לא מניחים אותו על הלוח — לוקחים אותו לבר ומפעילים כשצריך. | | An action card. You do not place it on the board — you take it to the bar and use it when you need it. |
| s17dc9b0 | קלף פעולה ביד, אחרי שיש מלך | | An action card in hand, once there is a King |
| s21cb509 | כל קלף אחר ביד — שלא נאמר עליו משהו ספציפי יותר | | Any other card in hand, with nothing more specific to say about it |
| sb3dff27 | זה קלף פעולה — הוא לא יושב על הלוח. קח אותו לבר שמתחת. | | This is an action card — it does not sit on the board. Take it to the bar below. |
| s1643dc2 | קלף פעולה ביד לפני שיש מלך | | An action card in hand before there is a King |
| se947507 | {card} חלש. יגיעו טובים יותר — לפח איתו. | | {card} is weak. Better ones will come — throw it away. |
| s52db857 | קלף חלש משמעותית מהממוצע | | A card well below average |
| sb491c42 | התחרטת? הקלף העליון בפח חוזר. רק הוא, ומה שתיתן במקומו נקבר. | | Changed your mind? The top card in the trash comes back. Only that one, and whatever you give in its place is buried. |
| s2ca2d8b | אחרי שנזרק קלף ראשון לפח | | After the first card is thrown away |
| s0f0bc4e | שלושה מאותה סדרה צמודים זה לזה — {bonus} נדלק. {what} | | Three from the same series touching each other — {bonus} lights up. {what} |
| sfc7ee43 | כששלושה מאותה סדרה נוגעים זה בזה | | When three from the same series touch each other |
| s658fd0b | נגמר הערפל — עכשיו רואים מה היריב שם. שינויים של הרגע האחרון? | | The fog is gone — now you can see what your opponent put down. Any last-minute changes? |
| s2fae425 | בתחילת שלב הפאניקה | | At the start of the panic phase |
| sfce8645 | יאללה, בוא נראה מה קורה. | | Come on then, let's see what happens. |
| s2fe9cd5 | הדבר האחרון לפני הקרב | | The last thing before the battle |
| sec0b1a9 | ל{enemy} יש ערימת חיים. {card} לא מנסה לנצח אותו במכות — הארס שלו מצטבר בכל פגיעה וממשיך לשרוף גם אחרי שהוא מת. שים אותו מולו. | | {enemy} has a pile of health. {card} does not try to beat it with blows — its venom stacks with every hit and keeps burning after it dies. Put it opposite. |
| s0a06b79 | ארס ביד מול קיר חיים של היריב | | Venom in hand against a wall of health |
| sefad056 | הוא שם משהו שמתפצל כשהוא מת — תהרוג אחד ויהיו שניים. {card} מכה כמה נתיבים בבת אחת, וזה בדיוק מה שמבטל את זה. רק אל תשים אותו בקצה, שם חצי מהמכה הולכת לאוויר. | | They put down something that splits when it dies — kill one and there will be two. {card} hits several lanes at once, which is exactly what cancels that. Just do not put it at the edge, where half the blow goes into thin air. |
| sa0e51a2 | מכת רוחב ביד מול משהו שמתרבה | | An area strike in hand against something that multiplies |
| se750bda | הוא ערם קלפים בטור אחד. {card} מבעיר את הנתיב שלפניו — כולם שם משלמים כל שנייה, ושריון לא עוזר. שים אותו מול הטור הזה. | | They stacked cards in one column. {card} sets the lane in front of it alight — everyone there pays every second, and armor does not help. Put it opposite that column. |
| sf7d19d0 | הצתת נתיב ביד מול טור עמוס | | A lane burner in hand against a crowded column |
| se17e5e8 | הוא בנה משהו שיורה מרחוק ולא מתקרב. {card} גורר את כל הקו שלו אליך — ישר לתוך הטווח של השומרים שלך. | | They built something that shoots from a distance and never comes close. {card} drags their whole line towards you — straight into range of your guards. |
| s4c27fff | שואב ביד מול יריב ששומר מרחק | | A puller in hand against an opponent keeping their distance |
| se565ab8 | {ally} מכה חזק ושובר בקלות. {card} סופג חצי מכל מכה שמכוונת לשכן שלו — שים אותו ממש לידו ותן לו לחיות קצת. | | {ally} hits hard and breaks easily. {card} soaks up half of every blow aimed at its neighbor — put it right beside it and let it live a little. |
| s5a0fcb1 | סופג ביד כשיש לך קלף שביר שמכה חזק | | A soaker in hand when you have a fragile card that hits hard |
| sfbcc457 | היי, אני אמנדה. הגעת כדי להילחם מולי, {kid}? בכיף, אני אראה לך איך עושים את זה. | | Hi, I'm Amanda. Came to fight me, {kid}? Happily. I'll show you how it's done. |
| sc39b53f | המשפט הראשון, לפני שהיא מצביעה על משהו | | the first line, before she points at anything |
| sd9bc88a | אנחנו כרגע בחדר המשחקים. אם מנצחים פה — מתקדמים למקומות אחרים. | | We're in the games room. Win here and you move on to other places. |
| s9e32cd7 | המשפט השני, עדיין באמצע המסך | | the second line, still in the middle of the screen |
| sf961c72 | זה האלבום שלי, זה האלבום שלך. כל אחד מדביק עליהם את הקלפים שלו. כשייגמר הזמן — האלבומים נלחמים אחד בשני. | | That album is mine, this one is yours. Each of us sticks our own cards on. When the time is up — the albums fight each other. |
| s6a53354 | שני הלוחות מודגשים | | both boards highlighted |
| s62d0dd0 | נתחיל בהדבקות. הנה הקלף הראשון: גולם אבן. קלף עם הרבה כוח ספיגה. נמקם אותו בעמדת השומר. | | Let's start sticking. Here is the first card: Stone Colossus. A card that soaks up a lot. We'll put it in the guard post. |
| s42dbb6c | גולם אבן ביד, לוח ריק | | Stone Colossus in hand, empty board |
| s4f0b0c7 | הקלף הבא: פליים דראגון — דרקון חזק. נמקם אותו מאחור. הוא יעופף מעל כולם ויתקוף את האויב. | | Next card: Flame Dragon — a strong dragon. We'll put him at the back. He'll fly over everyone and hit the enemy. |
| sdaca2bb | פליים דראגון ביד | | Flame Dragon in hand |
| s195f0f7 | הקלף הבא: בוסט אנרגיה. זה קלף פעולה. ניקח אותו כדי להשתמש בו בהמשך. | | Next card: Energy Boost. That's an action card. We'll take it to use later. |
| s37af730 | בוסט אנרגיה ביד | | Energy Boost in hand |
| s1e604c6 | קלפי הפעולה נמצאים כאן, למקרה שנרצה להשתמש בהם. | | The action cards live here, in case we want them. |
| sedb61e0 | אחרי שהבוסט נכנס לבר | | after the boost reaches the bar |
| sd597bbf | טוב, זה לאחר כך. בואו נמשיך. | | Right, that's for later. Let's carry on. |
| s325b7db | מגירת קלפי הפעולה פתוחה | | the action card drawer is open |
| s5e4cdb0 | קוביית ג'לי — קלף, אממ... לא משהו. בואו נזרוק אותו. יגיעו טובים יותר. | | Gelatinous Cube — a card that is, erm... not great. Let's bin it. Better ones are coming. |
| sb4d2832 | קוביית ג'לי ביד | | Gelatinous Cube in hand |
| s2bd7018 | בעצם — לא בטוח שיגיע משהו טוב יותר. מזל שאפשר להתחרט על הקלף האחרון שזרקתם. הנה, כאן. | | Actually — not sure anything better is coming. Lucky you can change your mind about the last card you binned. Here, this one. |
| s31f77d0 | מיד אחרי הזריקה | | right after the bin |
| sd4b3818 | אוקיי, קוביית הג'לי בולעת קלפי יריב. נמקם אותה כאן למעלה מאחורה. היא לא תחסום את הדרקון, הוא מעופף. | | Okay, the Gelatinous Cube swallows enemy cards. We'll put it up here at the back. It won't block the dragon, he flies. |
| s253d8e7 | קוביית הג'לי חזרה מהפח | | the cube is back from the bin |
| s1ff71ce | הופה, אבי-הענקים. קלף ענק וחזק. מושלם למשבצת המלך. | | Oho, Titan King. A huge, strong card. Perfect for the King slot. |
| s559179f | אבי-הענקים ביד | | Titan King in hand |
| sd65daae | הכוח של קלף המלך גדל פי 3, וזה חשוב. אם הוא מת — הפסדתם. | | A King card hits three times harder, and that matters. If he dies — you lose. |
| sb25f12e | מיד אחרי שהוכתר מלך | | right after a King is crowned |
| s503c2fe | הופה, עוד ענק. טרול סלע, שמרפא את עצמו. נמקם אותו בעמדת השומר. | | Oho, another giant. Rock Troll, and he heals himself. We'll put him in the guard post. |
| s856075f | טרול סלע ביד | | Rock Troll in hand |
| see01751 | יש לך שני שומרים וזה חשוב מאוד! כל עוד השומרים חיים — המלך בלתי פגיע. | | You have two guards and that matters a lot! As long as the guards are alive — the King cannot be touched. |
| s045e8b5 | שתי עמדות השומר תפוסות | | both guard posts are taken |
| saa20106 | אוקיי, מספיק דיבורים. בואו ניגש לקרב ונראה מה קורה. | | Okay, enough talking. Let's get to the fight and see what happens. |
| scb6277d | הכול בנוי, נשאר ללחוץ | | everything is built, all that is left is to press |
| s408dcff | שימו לב — כל הריבועים הריקים מתמלאים במפלצות פירורים חלשות. כדאי למלא אותם בזמן! | | Watch out — every empty square fills up with weak crumb monsters. Worth filling them yourself while there's time! |
| sb842d99 | אחרי הלחיצה על התחל קרב, לפני הספירה | | after pressing start, before the countdown |
| s4a756c9 | ניצחת! אבל זה היה קל, כי עזרתי. | | You won! But that was easy, because I helped. |
| sb08f699 | מסך התוצאה של המשחק הראשון | | the result screen of the first match |
| s40cdf63 | חזרת. יפה. עכשיו בוא נדבר על מה שקורה בצד השני. | | You came back. Good. Now let's talk about the other side of the board. |
| s5263775 | פתיחת המשחק השני | | the opening of the second match |
| s2f0283d | שים לב ללוח שלי. רואה את השורה הקדמית? זה כל מה שאפשר לראות בשלב הזה. | | Look at my board. See the front row? That is all you get to see right now. |
| s25ea352 | מצביעה על הלוח של היריב, לפני שנגעת בקלף | | pointing at the opponent's board, before you touch a card |
| s2feac9e | רנטגן. קלף פעולה ששובר את הכלל הזה. ניקח אותו ונשתמש בו. | | X-Ray. An action card that breaks that rule. Let's take it and use it. |
| s66dddf3 | רנטגן ביד | | X-Ray in hand |
| s0a71ac4 | עכשיו תלחץ עליו. | | Now press it. |
| se52f43e | רנטגן בבר, לפני שהופעל | | X-Ray in the bar, before it is played |
| s734f906 | הנה. שש שניות, כל הלוח שלי פתוח. עצים עתיקים מקדימה, גפנים בפינות. | | There. Six seconds, my whole board open. Ancient Trees at the front, vines in the corners. |
| s8f6cfb7 | מיד אחרי שהרנטגן הופעל | | right after the X-Ray is played |
| s68e3bda | עץ עתיק. 2000 חיים, מתרפא לבד. בדיוק מה שצריך בעמדת השומר. | | Ancient Tree. 2000 health, heals itself. Exactly what a guard post wants. |
| sd49b897 | עץ עתיק ביד | | Ancient Tree in hand |
| s75ccaa2 | קקטוס: דוקר את מי שנוגע בו. לעמדת השומר השנייה, צמוד לעץ. | | Cactus: it pricks whatever touches it. Second guard post, right against the tree. |
| s62b4ae3 | קקטוס ביד, אחרי שהעץ הונח | | Cactus in hand, after the tree is down |
| s562a021 | מה יש לנו כאן? שני קלפים מאותה משפחה. רואה את צבע המסגרת? בוא נוסיף להם עוד אחד. | | What have we here? Two cards from the same family. See the colour of the frame? Let's give them a third. |
| s16619e1 | שני צמחים צמודים על הלוח | | two plants touching on the board |
| se1b06e1 | חמנייה. צמח. תדביק אותה צמוד לאחד מהם — לא באלכסון, צמוד ממש. | | Sunflower. A plant. Stick it against one of them — not corner to corner, properly touching. |
| s3bb1a6a | חמנייה ביד | | Sunflower in hand |
| s2fb50f7 | פוטוסינתזה! שלושה צמחים צמודים מקבלים +20% עוצמה ו+20% חיים. שווה לשים אותם יחד! | | Photosynthesis! Three plants touching get +20% power and +20% health. Worth keeping them together. |
| sd356bf5 | ברגע שהשלישייה נדלקה | | the moment the trio lights up |
| sa808c9e | צ'ופי! החבר הכי טוב, עם עוצמת חשמל אדירה — אבל כמעט בלי חיים. מקדימה הוא ימות ראשון. פה עדיף. | | Chuppy! Best friend you have, hits like lightning — and almost no health. At the front he dies first. Back here is better. |
| s6d14c48 | צ'ופי ביד | | Chuppy in hand |
| s8e82b1e | אבי-הענקים. למשבצת המלך, כמו בפעם הקודמת. | | Titan King. Into the King slot, same as last time. |
| s33be16b | אבי-הענקים ביד | | Titan King in hand |
| scb28bb8 | בוסט אנרגיה — נותן כוח לכל מה שכבר על הלוח. רק לכל מה שכבר שם. אז לא נשתמש בו עכשיו. | | Energy Boost — it powers up everything already on the board. Only what is already there. So not yet. |
| sb32330d | בוסט אנרגיה נכנס לבר, הלוח עוד לא מלא | | Energy Boost reaches the bar, the board is not full yet |
| s4f2f850 | עכשיו. הלוח שלך מלא. עכשיו תפעיל אותו. | | Now. Your board is full. Now play it. |
| sceb7841 | הלוח מלא, הבוסט עדיין לא הופעל | | the board is full, the boost has not been played |
| s8137a86 | פאניקה. עשר השניות האחרונות. תסתכל — המלך שלי נחשף. | | Panic. The last ten seconds. Look — my King is showing. |
| se8e0990 | השנייה הראשונה של הפאניקה | | the first second of the panic phase |
| s7c44eb4 | אבל השורה האחורית שלי עדיין חשוכה. גם בפאניקה. בשביל זה היה שווה את הרנטגן. | | But my back row is still dark. Even in panic. That is what the X-Ray was worth. |
| s7298202 | בפאניקה, על השורה האחורית המעורפלת | | in panic, on the fogged back row |
| sb0dc9d8 | סופת חול. מערבבת לי את השורה הקדמית. בנית נתיב מול משהו? עכשיו הוא במקום אחר. | | Sandstorm. It shuffles my front row. Built a lane against something? It is somewhere else now. |
| scf7ab2b | סופת חול ביד, בפאניקה | | Sandstorm in hand, during panic |
| sb32906f | מספיק. בוא נראה מה בנית. | | Enough. Let's see what you built. |
| s5706d6f | הכול בנוי, נשאר ללחוץ | | everything is built, all that is left is to press |
| s39b816e | ניצחת. והפעם לא עזרתי. | | You won. And this time I didn't help. |
| s88efec6 | מסך התוצאה של המשחק השני | | the result screen of the second match |

## data/updates.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s00ba05b | אוקטובר 2026 | | October 2026 |
| s8e775e4 | חנות נוחות, חברים, ודיווח | | A corner shop, friends, and reporting |
| sffee556 | נפתחה חנות נוחות — אווטארים, אימוג'ים וקלפים, הכל ביהלומים. | | A corner shop has opened — avatars, emoji and cards, all for diamonds. |
| s945e9ab | אפשר להוסיף לחברים מישהו ששיחקתם מולו, לראות מי מחובר, ולהזמין אותו למשחק. | | You can add somebody you have played against as a friend, see who is online, and invite them to a game. |
| s1f2e3f1 | אפשר להגיד ליריב ארבעה-עשר משפטים מוכנים, וגם לבחור לא לראות הודעות בכלל. | | You can say fourteen ready-made lines to your opponent, and you can also choose not to see messages at all. |
| sc99cf96 | יש כפתור לדווח על באג או על שחקן. | | There is a button for reporting a bug or a player. |
| sb7b7b9a | אוקטובר 2026 | | October 2026 |
| s9ff5891 | נאצ'וס, אתגרים, וחוגת קושי | | Nachos, challenges, and a difficulty dial |
| s86e4a59 | כל משחק נותן נאצ'וס לפי כמה טוב שיחקתם — גם כשמפסידים. כל 5 נאצ'וס זו תיבה. | | Every game gives nachos according to how well you played — even when you lose. Every 5 nachos is a chest. |
| s0dce83b | אתגרים יומיים, שבועיים וחודשיים, עם יהלומים ונאצ'וס בסוף. | | Daily, weekly and monthly challenges, with diamonds and nachos at the end. |
| sa6c8b7d | לבוט יש עכשיו שלוש דרגות: קליל, רגיל וקשה. הקליל באמת קליל. | | The bot now has three settings: easy, normal and hard. The easy one really is easy. |
| s37ceacb | ניצחון מול הבוט שווה גביעים — רגיל 8, קשה 12. | | Beating the bot is worth trophies — 8 on normal, 12 on hard. |
| sc9e804b | בתיבות יש יותר קלפים שכבר יש לכם, כדי שיהיה אפשר לשדרג אותם. | | Chests now hold more cards you already have, so that you can upgrade them. |

## game/account.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s3add400 | חשבון הגוגל הזה כבר שייך לחשבון אחר, ולא הצלחתי להיכנס אליו. | | This Google account already belongs to another account, and I could not get into it. |
| s9365276 | ההתחברות לגוגל לא הושלמה. נסה שוב מהדפדפן הרגיל ולא מתוך אפליקציה אחרת. | | The Google sign-in did not finish. Try again from your normal browser, not from inside another app. |
| s674d50d | אין חיבור לשרת | | No connection to the server |
| s648890c | אין חשבון | | No account |
| s2efa30b | לא הצליח | | It did not work |
| see8db43 | אין חיבור לשרת | | No connection to the server |
| sde6b2f0 | צריך להיות בן {0} לפחות | | You have to be at least {0} |
| s56e58ef | אין חשבון | | No account |
| s665d389 | אין חיבור לשרת | | No connection to the server |
| se81f968 | צריך להתחיל לשחק קודם | | You have to start playing first |
| s5383875 | אין חיבור לשרת | | No connection to the server |
| s5370a70 | צריך חשבון כדי לדווח | | You need an account to report |
| s97e263e | לא הצליח | | It did not work |
| s651f017 | אין חיבור לשרת | | No connection to the server |
| sd13c7f9 | לא הצליח | | It did not work |
| sedc6c2a | אין חיבור לשרת | | No connection to the server |
| s54a1abe | לא הצליח | | It did not work |
| sac33701 | אין חיבור לשרת | | No connection to the server |
| s2afe5ef | לא הצליח | | It did not work |
| s835acce | אין חיבור לשרת | | No connection to the server |
| s2cb3864 | אין חשבון | | No account |
| s58e9ecf | לא הצליח | | It did not work |
| s5da8d9e | לא הצליח | | It did not work |
| s115ddae | אין חיבור לשרת | | No connection to the server |
| s2d85691 | אין חשבון | | No account |
| s7a9bffc | לא הצליח | | That didn't work |
| se7da992 | אין חיבור לשרת | | No connection to the server |
| sf5f2796 | צריך להתחיל לשחק קודם | | You have to start playing first |
| s79d47ae | כבר מחובר | | Already signed in |
| sd0c6462 | לא הצלחתי לשמור. נסה שוב. | | That did not save. Try again. |
| sb7305bc | אין חיבור לשרת | | No connection to the server |
| s2a6031b | אין חיבור לשרת | | No connection to the server |
| s2c36448 | אפשר לשמור {0} דקים. תמחק אחד קודם. | | You can keep {0} decks. Delete one first. |
| sb682ef4 | כבר יש לך דק בשם הזה. | | You already have a deck with that name. |

## game/coach.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sc10480b | הוא מעופף | | It flies |
| s4a2ba08 | הוא צלף | | It is a sniper |
| sdf5d45f | הוא עבה | | It is tough |
| s46589c2 | הוא חזק | | It is strong |
| s6124c70 | הוא לא זז | | It does not move |
| se7147b6 | הוא בסדר גמור | | It is perfectly fine |
| s9e7ee3f | נמקם אותו מאחורה | | We will put it at the back |
| seb09973 | נמקם אותו מקדימה | | We will put it at the front |
| sfe838f6 | נמקם אותו באמצע | | We will put it in the middle |
| s8f1fa7e | עף | | flies |
| sc2c8332 | צלף | | snipes |

## game/lessons.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s24e4af8 | משחק ראשון — איך בונים לוח | | First game — how to build a board |
| s078dd87 | משחק שני — מה מנצח את מה | | Second game — what beats what |

## game/meta.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sbd36b97 | אין חיבור לשרת | | No connection to the server |
| s7a0587d | צריך חשבון | | You need an account |
| sc65088a | האתגר הזה כבר לא פעיל. | | That challenge is no longer running. |
| sc6b6e23 | עוד לא סיימת את האתגר. | | You have not finished the challenge yet. |
| s1322daa | כבר לקחת את הפרס. | | You have already collected the prize. |
| sbf13716 | לא הצלחתי. נסה שוב. | | I could not do it. Try again. |

## game/serverError.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sc839803 | זה אתה. | | That's you. |
| s1e4d1ce | צריך חשבון כדי להוסיף חברים. אפשר להתחבר באזור האישי. | | Adding friends needs an account. You can sign in from your profile. |
| s8c2f055 | לשחקן הזה אין חשבון. | | That player doesn't have an account. |
| sfb1cb0c | אפשר להוסיף רק מישהו ששיחקת מולו. | | You can only add someone you've played against. |
| s9768947 | אתם כבר חברים. | | You're already friends. |
| s73fed82 | כבר ביקשת. מחכים שיאשרו. | | You already asked. Waiting for them to say yes. |
| sa1cbf5f | יש לך יותר מדי בקשות שמחכות לתשובה. | | You have too many requests still waiting for an answer. |
| s28541c5 | אין בקשה כזאת. | | There's no such request. |
| sc6d8f34 | אין קוד כזה. | | No such code. |
| s1ea1328 | אין מספיק עותקים. | | Not enough copies. |
| s4cfc2af | חסרים {0} עותקים. | | {0} more copies needed. |
| sd0abc03 | זאת הרמה הכי גבוהה. | | That's the highest level. |
| sce3da7e | הקלף הזה עוד לא שלך. | | That card isn't yours yet. |
| s0c9162c | צריך חשבון כדי לדווח על שחקן. אפשר להתחבר באזור האישי. | | Reporting a player needs an account. You can sign in from your profile. |
| scc4eb78 | ספר לנו מה קרה. | | Tell us what happened. |
| s3a38c0a | על מי מדווחים? | | Who is this about? |
| s8583e14 | זה אתה. | | That's you. |
| se4e8aeb | אפשר לדווח רק על שחקנים רשומים. | | You can only report registered players. |
| s39dfb3e | אפשר לדווח רק על מישהו ששיחקת מולו. | | You can only report someone you've played against. |
| s606c355 | דיווחת הרבה. נבדוק, ונחזור אליך. | | That's a lot of reports. We'll look, and we'll get back to you. |
| s9c601a6 | הפריט הזה לא בחנות. | | That item isn't in the shop. |
| se01b086 | עוד לא. | | Not yet. |
| s750dee1 | זה כבר נגמר. | | That one's over. |
| s50f7dfe | זה כבר שלך. | | You already have it. |
| sc59543d | אין מספיק יהלומים. | | Not enough gems. |
| s31caecc | חסרים {0} יהלומים. | | You're {0} gems short. |
| s67fd1f6 | לא הצלחתי. נסה שוב. | | That didn't work. Try again. |
| s25ffa6e | לא הצלחתי. נסה שוב. | | That didn't work. Try again. |

## game/useMatch.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| sadfc854 | בוט קליל | | Easy bot |
| s69fcaa6 | הבוט | | The bot |
| s38e97db | בוט קשה | | Hard bot |

## game/verdict.ts

| מזהה | טקסט נוכחי | טקסט חדש | אנגלית |
| --- | --- | --- | --- |
| s656f60c | של היריב | | Opponent's |
| s42347b7 | שלך | | Yours |
| s38e8e92 | המלך {0} נפל — הקרב הסתיים | | The {0} King fell — the battle is over |
| sbc89487 | הזמן נגמר, הקרב הסתיים | | Time ran out and both kings survived — decided on king health: {0} yours against {1} theirs. |
| s156d757 | הזמן נגמר, הקרב הסתיים. שניכם בתיקו מוחלט. הטלתי מטבע כדי לקבוע מי המנצח | | Time ran out and everything came out exactly equal — decided by a coin toss. |
