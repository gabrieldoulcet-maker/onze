/* ============================================================
   ONZE — Profiling : pas de fuite mémoire, pas de frame perdue.
   1. FRAMES : pendant un match complet avec la scène animée, on
      mesure chaque delta de requestAnimationFrame — le p95 doit
      rester sous ~40 ms (au-dessus, la scène « saccade »).
   2. MÉMOIRE : trois matchs consécutifs (création/destruction de
      la scène à chaque fois) — le tas JS ne doit pas croître de
      façon non bornée (fuite de scène, de listeners, de tampons).
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/perf.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    args: ["--js-flags=--expose-gc", "--enable-precise-memory-info"],
  });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await page.addInitScript(() => { try { localStorage.clear(); localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });

  // ---- 1. les frames pendant un match animé ----
  await page.evaluate(() => {
    arreterChrono();
    window.__deltas = [];
    let precedent = performance.now();
    const mesurer = (t) => { window.__deltas.push(t - precedent); precedent = t; requestAnimationFrame(mesurer); };
    requestAnimationFrame(mesurer);
    partie.manche = 10;
    preparerManche();
    jouerManche();
  });
  await page.waitForFunction(() => !!document.getElementById("btn-continuer"), null, { timeout: 90000 });
  const frames = await page.evaluate(() => {
    const deltas = window.__deltas.slice(5).sort((a, b) => a - b); // les premières frames chauffent
    const p = (q) => deltas[Math.floor(deltas.length * q)];
    return { n: deltas.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), max: deltas[deltas.length - 1] };
  });
  console.log(`   frames : ${frames.n} mesurées · p50 ${frames.p50.toFixed(1)} ms · p95 ${frames.p95.toFixed(1)} ms · p99 ${frames.p99.toFixed(1)} ms · max ${frames.max.toFixed(1)} ms`);
  verifier("frames : p95 sous 40 ms (scène fluide)", frames.p95 < 40, frames.p95.toFixed(1) + " ms");

  // ---- 2. la mémoire sur trois matchs consécutifs ----
  const heap = async () => page.evaluate(() => {
    if (window.gc) { window.gc(); window.gc(); }
    return performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null;
  });
  await page.evaluate(() => { document.getElementById("btn-continuer").click(); arreterChrono(); document.querySelectorAll(".volet").forEach((v) => v.remove()); });
  const heapDepart = await heap();
  for (let m = 0; m < 3; m++) {
    await page.evaluate(() => {
      arreterChrono();
      document.querySelectorAll(".volet, .voile-fiche").forEach((v) => v.remove());
      partie.matchEnCours = false;
      partie.manche = 10 + Math.floor(Math.random() * 3);
      preparerManche();
      jouerManche();
    });
    await page.waitForFunction(() => !!document.getElementById("btn-continuer"), null, { timeout: 90000 });
    await page.evaluate(() => { document.getElementById("btn-continuer").click(); arreterChrono(); document.querySelectorAll(".volet").forEach((v) => v.remove()); });
  }
  const heapFin = await heap();
  if (heapDepart !== null && heapFin !== null) {
    const croissance = heapFin - heapDepart;
    console.log(`   tas JS : ${heapDepart.toFixed(1)} Mo → ${heapFin.toFixed(1)} Mo après 3 matchs (Δ ${croissance.toFixed(1)} Mo)`);
    verifier("mémoire : pas de fuite (croissance < 8 Mo sur 3 matchs)", croissance < 8, croissance.toFixed(1) + " Mo");
  } else console.log("   (performance.memory indisponible — mesure sautée)");
  // les scènes détruites ne doivent plus tourner (une seule boucle rAF)
  const scenes = await page.evaluate(() => document.querySelectorAll(".scene-match").length);
  verifier("une seule scène vivante au plus", scenes <= 1, String(scenes));

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nProfiling ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
