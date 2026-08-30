/* ============================================================
   ONZE — LES SYNERGIES EN TENUE MERCATO (décision de Gabriel,
   30/08, prolonge la décision 74).
   ------------------------------------------------------------
   Une rangée de MINI-PASTILLES repliées, en tenue MERCATO
   uniquement. Au repos : écusson + compte (« ◈ 2/3 »), une seule
   ligne discrète, palette de la refonte. Un tap sur une pastille
   la déplie (palier atteint, prochain palier, joueurs qui
   comptent) ; un tap ailleurs la referme ; le passage en
   Placement ou Match fait disparaître la rangée entière. Les
   bannières de palier restent, le panneau complet reste au menu.

   ⚠ ÉCRITE AVANT LE CODE : elle doit sortir rouge (règle M3).

   Les six contrats :
     1. EN MERCATO, LA RANGÉE EXISTE — une seule ligne, chaque
        pastille au repos ne dit que l'écusson et « n/p » ;
     2. UN TAP DÉPLIE : palier atteint, prochain palier, joueurs
        qui comptent — et UNE SEULE dépliée à la fois ;
     3. UN TAP AILLEURS REFERME ;
     4. EN PLACEMENT ET EN MATCH, LA RANGÉE DISPARAÎT ENTIÈRE ;
     5. RIEN D'ELLE NE RECOUVRE le terrain (l'enveloppe des
        joueurs rendus — la grille de la décision 74 fait foi),
        le banc, ni les cartes de boutique — pastille dépliée
        comprise ;
     6. zéro erreur JS.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/synergies-mercato.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "petit téléphone", l: 667, h: 375 }];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });
    /* Montage : deux familles bien peuplées — une École au palier
       atteint, un archétype en approche. */
    await page.evaluate(async () => {
      arreterChrono();
      if (typeof viderAnnonces === "function") viderAnnonces();
      const tiki = tousLesJoueurs.filter((j) => j.ecole === "Tiki-Taka").slice(0, 3);
      const murs = tousLesJoueurs.filter((j) => j.archetype === "Mur" && j.ecole !== "Tiki-Taka").slice(0, 1);
      partie.niveau = 5;
      partie.terrain = [...tiki, ...murs].map((f, i) => ({ ...f, uid: "S" + i }));
      partie.banc = [];
      afficher();
      await new Promise((r) => setTimeout(r, 300));
      if (typeof viderAnnonces === "function") viderAnnonces();
    });

    /* ---- 1 · LA RANGÉE, UNE LIGNE, DES PASTILLES MUETTES ---- */
    const repos = await page.evaluate(() => {
      const r = document.getElementById("rangee-synergies");
      if (!r || r.getBoundingClientRect().width === 0) return { absente: true };
      const pastilles = [...r.querySelectorAll(".pastille-synergie")];
      const tops = pastilles.map((p) => Math.round(p.getBoundingClientRect().top));
      const uneLigne = tops.length && Math.max(...tops) - Math.min(...tops) <= 2;
      const textes = pastilles.map((p) => (p.innerText || "").replace(/\s+/g, " ").trim());
      const muettes = textes.every((t) => /^\d+\s*\/\s*\d+$/.test(t) || /^\d+$/.test(t));
      const ecussons = pastilles.filter((p) => p.querySelector("svg, .ecusson-mini, .ecusson-badge")).length;
      return { pastilles: pastilles.length, uneLigne, textes, muettes, ecussons };
    });
    verifier(`${taille.nom} : en MERCATO la rangée existe — ${repos.pastilles || 0} pastilles sur une ligne, ` +
      `au repos rien que l'écusson et le compte (${(repos.textes || []).join(" · ")})`,
      !repos.absente && repos.pastilles >= 2 && repos.uneLigne && repos.muettes &&
      repos.ecussons === repos.pastilles, JSON.stringify(repos));

    /* ---- 2 · UN TAP DÉPLIE, UNE SEULE À LA FOIS ---- */
    const depli = await page.evaluate(async () => {
      const pastilles = [...document.querySelectorAll("#rangee-synergies .pastille-synergie")];
      if (pastilles.length < 2) return { pasAssez: true };
      pastilles[0].click();
      await new Promise((r) => setTimeout(r, 200));
      const p1 = document.querySelector("#rangee-synergies .panneau-synergie");
      const texte1 = p1 ? p1.innerText : "";
      const nomsAttendus = partie.terrain.filter((j) => j.ecole === pastilles[0].dataset.famille ||
        j.archetype === pastilles[0].dataset.famille || j.ecoleBonus === pastilles[0].dataset.famille)
        .map((j) => j.nom);
      /* le rendu REMPLACE les nœuds : on re-cherche la 2ᵉ pastille comme
         le ferait un doigt, au lieu de cliquer une référence morte */
      const seconde = [...document.querySelectorAll("#rangee-synergies .pastille-synergie")]
        .find((x) => x.dataset.famille === pastilles[1].dataset.famille);
      seconde.click();
      await new Promise((r) => setTimeout(r, 200));
      const ouvertes = document.querySelectorAll("#rangee-synergies .pastille-synergie.depliee").length;
      const p2 = document.querySelector("#rangee-synergies .panneau-synergie");
      return { texte1, nomsAttendus, ouvertes,
        famille2: p2 ? p2.dataset.famille : null,
        attendue2: pastilles[1].dataset.famille };
    });
    const nomsCites = (depli.nomsAttendus || []).filter((n) => (depli.texte1 || "").includes(n));
    verifier(`${taille.nom} : le tap déplie — palier atteint, prochain palier, joueurs qui comptent ` +
      `(${nomsCites.length}/${(depli.nomsAttendus || []).length} noms cités)`,
      !depli.pasAssez && /[Pp]alier/.test(depli.texte1 || "") && /[Pp]rochain/.test(depli.texte1 || "") &&
      (depli.nomsAttendus || []).length > 0 && nomsCites.length === depli.nomsAttendus.length,
      JSON.stringify({ texte: (depli.texte1 || "").slice(0, 120), attendus: depli.nomsAttendus }));
    verifier(`${taille.nom} : une seule pastille dépliée à la fois (tap la 2ᵉ ferme la 1ʳᵉ)`,
      depli.ouvertes === 1 && depli.famille2 === depli.attendue2, JSON.stringify(depli));

    /* ---- 5 · RIEN NE RECOUVRE — mesuré pastille DÉPLIÉE ---- */
    const recouvre = await page.evaluate(() => {
      const zone = (sel) => [...document.querySelectorAll(sel)]
        .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      const rangs = zone("#rangee-synergies, #rangee-synergies *");
      const cibles = [...zone(".ligne-terrain .jeton"), ...zone("#banc"), ...zone(".carte-boutique")];
      let pixels = 0;
      for (const a of rangs) for (const c of cibles) {
        const L = Math.max(0, Math.min(a.right, c.right) - Math.max(a.left, c.left));
        const H = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
        pixels += L * H;
      }
      return { pixels: Math.round(pixels), deplie: !!document.querySelector("#rangee-synergies .panneau-synergie") };
    });
    verifier(`${taille.nom} : rien de la rangée — pastille dépliée comprise — ne recouvre le terrain, ` +
      `le banc ni la boutique (${recouvre.pixels} px²)`,
      recouvre.deplie && recouvre.pixels === 0, JSON.stringify(recouvre));

    /* ---- 3 · UN TAP AILLEURS REFERME ---- */
    await page.mouse.click(Math.round(taille.l * 0.65), Math.round(taille.h * 0.55));
    await page.waitForTimeout(200);
    const referme = await page.evaluate(() => ({
      ouvertes: document.querySelectorAll("#rangee-synergies .pastille-synergie.depliee").length,
      panneau: !!document.querySelector("#rangee-synergies .panneau-synergie") }));
    verifier(`${taille.nom} : un tap ailleurs referme la pastille`,
      referme.ouvertes === 0 && !referme.panneau, JSON.stringify(referme));

    /* ---- 4 · PLACEMENT ET MATCH : LA RANGÉE DISPARAÎT ---- */
    const phases = await page.evaluate(async () => {
      const visible = () => { const r = document.getElementById("rangee-synergies");
        return !!r && r.getBoundingClientRect().width > 0 && getComputedStyle(r).display !== "none"; };
      document.getElementById("btn-sac").click();
      await new Promise((r) => setTimeout(r, 200));
      const enPlacement = visible();
      document.getElementById("btn-sac").click();
      await new Promise((r) => setTimeout(r, 200));
      return { enPlacement, retourMercato: visible() };
    });
    verifier(`${taille.nom} : en PLACEMENT la rangée disparaît entière, et revient au mercato`,
      phases.enPlacement === false && phases.retourMercato === true, JSON.stringify(phases));

    await page.evaluate(() => jouerManche());
    await page.waitForFunction(() => !!document.querySelector(".scene-match"), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(600);
    const enMatch = await page.evaluate(() => {
      const r = document.getElementById("rangee-synergies");
      return { scene: !!document.querySelector(".scene-match"),
        visible: !!r && r.getBoundingClientRect().width > 0 && getComputedStyle(r).display !== "none" };
    });
    verifier(`${taille.nom} : en MATCH la rangée disparaît entière`,
      enMatch.scene && !enMatch.visible, JSON.stringify(enMatch));

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s) — les synergies en tenue mercato` : "\nLes synergies en tenue mercato ✅");
  process.exit(echecs ? 1 : 0);
})();
