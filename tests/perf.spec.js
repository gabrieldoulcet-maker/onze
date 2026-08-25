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

  /* ---- L'ÉCRAN DE PLACEMENT, sur les trois décors (phase 3) ----
     Le décor occupe désormais les trois quarts de l'écran : un flou en
     temps réel y coûterait cher sur mobile. Le recul de la distance est
     donc CUIT DANS LES IMAGES — cette recette le vérifie (aucun filtre de
     flou sur la couche de décor) et mesure les images par seconde sur les
     trois terrains, effectif complet à l'écran. */
  for (const [id, nom] of [["emeraude", "Grand Soir"], ["theatre", "Boxing Day"], ["bitumeNeon", "City Stade"]]) {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    await page.addInitScript((s2) => { try {
      localStorage.setItem("onze-tutoriel-vu", "1");
      localStorage.setItem("onze-reglages-match", JSON.stringify({ stade: s2 }));
    } catch (e) {} }, id);
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
    const mesure = await page.evaluate(async () => {
      arreterChrono();
      partie.niveau = 10;
      const art = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j));
      partie.terrain = art.slice(0, 11).map((f, i) => ({ ...f, etoiles: (i % 3) + 1, uid: "P" + i,
        ligne: ["GAR", "DÉF", "MIL", "ATT"][i === 0 ? 0 : 1 + (i % 3)] }));
      partie.banc = art.slice(11, 20).map((f, i) => ({ ...f, etoiles: (i % 3) + 1, uid: "B" + i }));
      afficher();
      const im = document.getElementById("fond-terrain");
      if (im && !im.complete) await new Promise((r) => { im.onload = r; im.onerror = r; });
      /* On attend le décodage de TOUTES les figurines et de leurs ombres
         avant de compter les trames : ce qu'on mesure est la fluidité en
         régime établi, pas le coût du premier décodage — une image qui
         finit d'arriver pendant le relevé produisait une trame à 33 ms et
         une recette qui échoue une fois sur trois. */
      await Promise.all([...document.images].filter((i) => i.src && !i.complete)
        .map((i) => i.decode().catch(() => {})));
      await new Promise((r) => setTimeout(r, 500));
      // aucun flou EN TEMPS RÉEL sur la grande surface de décor
      const st = getComputedStyle(im);
      const flouDecor = /blur/.test(st.filter) || /blur/.test(st.backdropFilter || "");
      const plateau = getComputedStyle(document.getElementById("plateau"));
      const flouPlateau = /blur/.test(plateau.filter) || /blur/.test(plateau.backdropFilter || "");
      // les trames, pendant que l'aura du 3★ anime la scène
      const trames = [];
      await new Promise((fini) => {
        let precedent = performance.now(), n = 0;
        const tic = (t) => {
          trames.push(t - precedent); precedent = t;
          if (++n < 150) requestAnimationFrame(tic); else fini();
        };
        requestAnimationFrame(tic);
      });
      trames.sort((a, b) => a - b);
      return { flouDecor, flouPlateau, figurines: document.querySelectorAll(".jeton.figurine").length,
        p50: trames[Math.floor(trames.length * 0.5)], p95: trames[Math.floor(trames.length * 0.95)] };
    });
    verifier(`${nom} : aucun flou en temps réel sur le décor (il est cuit dans l'image)`,
      !mesure.flouDecor && !mesure.flouPlateau, JSON.stringify(mesure));
    verifier(`${nom} : écran de placement fluide avec ${mesure.figurines} figurines ` +
      `(p50 ${mesure.p50.toFixed(1)} ms · p95 ${mesure.p95.toFixed(1)} ms ≤ 20)`,
      mesure.p95 <= 20, `p95 ${mesure.p95.toFixed(1)} ms`);
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nProfiling ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
