const nach = (s) => (s >= 9 ? 3 : s >= 6 ? 2 : s >= 3 ? 1 : 0);
function* scores(n, seed = 12345) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < n; i++)
    yield rnd() < 0.5 ? 5 + Math.floor(rnd() * 6) : 1 + Math.floor(rnd() * 6);
}
console.log(" bar  chests  matches/chest  flush%");
for (const N of [4, 5, 6, 7, 8, 9, 10, 11]) {
  let total = 0, matches = 0, chests = 0, flush = 0, prev = 0;
  for (const sc of scores(300000)) {
    total += nach(sc); matches++;
    const now = Math.floor(total / N);
    if (now > prev) { chests += now - prev; if (total % N === 0) flush++; prev = now; }
  }
  console.log(`  ${String(N).padStart(2)}  ${String(chests).padStart(6)}  ${(matches / chests).toFixed(2).padStart(13)}  ${((flush / chests) * 100).toFixed(1).padStart(6)}`);
}
let t = 0, m = 0;
for (const sc of scores(300000)) { t += nach(sc); m++; }
console.log(`\naverage nachos per match: ${(t / m).toFixed(2)}`);
