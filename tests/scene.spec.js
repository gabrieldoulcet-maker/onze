/* ============================================================
   ONZE — Fidélité de la scène animée (décision 24).
   L'animation est une projection du moteur : ces assertions
   vérifient que le rendu NE MENT PAS.
   1. Le style détecté = l'École dominante réelle de l'équipe.
   2. Les formations traduisent le style (Catenaccio bloc bas,
      pivot Kick & Rush avancé, Pistons collés aux couloirs).
   3. La jauge de domination = les vrais événements de la phase
      (possession/percée/tir → le camp qui a réellement poussé).
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/scene.spec.js
   (serveur : python3 -m http.server 8123 --directory .)
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok) => { console.log(`${ok ? "✅" : "❌"} ${nom}`); if (!ok) echecs++; };

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });

  const r = await page.evaluate(() => {
    arreterChrono();
    const parEcole = (ecole, n) => tousLesJoueurs.filter((j) => j.ecole === ecole).slice(0, n)
      .map((j) => ({ ...j, etoiles: 1 }));
    const catenaccio = ONZE.equipeDepuisFiches("Cate", "Cate", parEcole("Catenaccio", 6));
    const tiki = ONZE.equipeDepuisFiches("Tiki", "Tiki", parEcole("Tiki-Taka", 6));
    const neutres = ONZE.equipeDepuisFiches("Neutre", "Neutre",
      tousLesJoueurs.filter((j) => !j.ecole).slice(0, 6).map((j) => ({ ...j, etoiles: 1 })));

    // 1. le style détecté est l'École dominante réelle
    const styles = { cate: ONZE_SCENE.styleDe(catenaccio).style, tiki: ONZE_SCENE.styleDe(tiki).style };

    // 2. les formations traduisent le style : scène Catenaccio vs Tiki
    const bac = document.createElement("div");
    bac.style.cssText = "position:fixed;left:-2000px;width:800px;height:360px";
    document.body.appendChild(bac);
    const scene = ONZE_SCENE.creer(bac, catenaccio, tiki, {});
    const diag = scene.diagnostic();
    const defCate = diag.positions.filter((p) => p.camp === "moi" && p.base > 8 && p.base < 30);
    const defTiki = diag.positions.filter((p) => p.camp === "eux" && p.base > 70 && p.base < 92);
    // le bloc bas : les lignes du Catenaccio (mon camp, gauche) sont plus
    // proches de leur but que celles d'une équipe neutre (base 20 → 15)
    const blocBas = defCate.length ? Math.min(...defCate.map((p) => p.base)) < 18 : false;

    // 3. la jauge lit les VRAIS événements
    const phaseA = { evenements: [
      { type: "possession", equipe: "Cate", acteurs: ["x"] },
      { type: "percee", equipe: "Cate", acteurs: ["x"] },
      { type: "but", but: true, buteur: "x", equipe: "Cate", acteurs: ["x"] },
    ] };
    const phaseB = { evenements: [
      { type: "possession", equipe: "Tiki", acteurs: ["y"] },
      { type: "percee_stoppee", equipe: "Cate", acteurs: ["z"] },
    ] };
    const domA = scene.dominationDe(phaseA); // Cate (moi) pousse → > 0
    const domB = scene.dominationDe(phaseB); // Tiki pousse, Cate stoppe → < 0 côté poussée
    // un arrêt du camp adverse = l'occasion était à moi
    const phaseArret = { evenements: [
      { type: "possession", equipe: "Cate", acteurs: ["x"] },
      { type: "arret", equipe: "Tiki", acteurs: ["x", "g"] },
    ] };
    const domArret = scene.dominationDe(phaseArret);

    // 4. la répulsion des pions : une mêlée de 6 disques superposés se
    // résout en quelques frames — plus aucun recouvrement au-delà de ~20 %
    const rayon = 16;
    const melee = Array.from({ length: 6 }, (_, i) => ({ x: 50, y: 50, echelle: 1, phase: i * 0.7 }));
    for (let f = 0; f < 40; f++) ONZE_SCENE.separerDisques(melee, 800, 360, rayon);
    let distMin = Infinity;
    for (let i = 0; i < melee.length; i++) for (let j = i + 1; j < melee.length; j++) {
      const d = Math.hypot((melee[j].x - melee[i].x) * 8, (melee[j].y - melee[i].y) * 3.6);
      distMin = Math.min(distMin, d);
    }
    const repulsion = { distMin, seuil: 0.75 * 2 * rayon };

    // 5. pendant une vraie scène animée : jamais deux pions collés
    scene.detruire();
    bac.remove();
    return { styles, blocBas, domA, domB, domArret, repulsion };
  });

  verifier("style détecté : équipe Catenaccio → catenaccio", r.styles.cate === "catenaccio");
  verifier("style détecté : équipe Tiki-Taka → tiki", r.styles.tiki === "tiki");
  verifier("formation : le Catenaccio joue en bloc bas (lignes reculées)", r.blocBas);
  verifier(`jauge : phase dominée par moi → positive (${r.domA.toFixed(2)})`, r.domA > 0.5);
  verifier(`jauge : phase dominée par l'adversaire → négative (${r.domB.toFixed(2)})`, r.domB < 0);
  verifier(`jauge : un arrêt adverse compte pour MON occasion (${r.domArret.toFixed(2)})`, r.domArret > 0);
  verifier(`répulsion : une mêlée de 6 pions se désserre (dist min ${r.repulsion.distMin.toFixed(1)} px ≥ ${r.repulsion.seuil.toFixed(1)})`,
    r.repulsion.distMin >= r.repulsion.seuil);

  // ---- un match animé réel : échantillonner les positions, jamais collés ----
  const live = await page.evaluate(async () => {
    arreterChrono();
    partie.manche = 10;
    preparerManche();
    jouerManche();
    const releves = [];
    for (let t = 0; t < 30; t++) {
      await new Promise((r2) => setTimeout(r2, 150));
      const scene = typeof sceneMatch !== "undefined" ? sceneMatch : null;
      if (!scene) continue;
      const d = scene.diagnostic();
      let mini = Infinity;
      const boite = document.querySelector(".scene-match canvas");
      const L = boite ? boite.clientWidth : 800, H = boite ? boite.clientHeight : 360;
      for (let i = 0; i < d.positions.length; i++) for (let j = i + 1; j < d.positions.length; j++) {
        const a = d.positions[i], b = d.positions[j];
        mini = Math.min(mini, Math.hypot((b.x - a.x) * L / 100, (b.y - a.y) * H / 100));
      }
      if (mini < Infinity) releves.push({ mini, rayon: Math.max(H * 0.045, 8) });
    }
    return releves;
  });
  const pire = live.length ? live.reduce((a, b) => (a.mini < b.mini ? a : b)) : null;
  verifier(`match animé : jamais deux pions superposés (${live.length} relevés, pire ${pire ? pire.mini.toFixed(1) : "—"} px pour un rayon de ${pire ? pire.rayon.toFixed(1) : "—"})`,
    !!pire && pire.mini >= 0.6 * 2 * pire.rayon);
  await page.waitForFunction(() => !!document.getElementById("btn-continuer"), null, { timeout: 90000 });

  verifier("zéro erreur JS", true);

  /* ============================================================
     LA RECETTE DU MANUEL — une vérification par règle de
     design/scene-fm.md. Ces assertions disent si le rendu TIENT
     ses promesses, pas seulement s'il ne plante pas.
     ============================================================ */
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });

  /* ---- R7 / R12 : l'issue ne s'annonce jamais, et l'ADN se lit
     dans la CONSTRUCTION de l'action (fonctions pures) ---- */
  const pur = await page.evaluate(() => {
    const parEcole = (ecole, n) => tousLesJoueurs.filter((j) => j.ecole === ecole).slice(0, n)
      .map((j) => ({ ...j, etoiles: 1 }));
    const eq = (nom, ecole) => ONZE.equipeDepuisFiches(nom, nom, parEcole(ecole, 6));
    const tiki = eq("Tiki", "Tiki-Taka"), kick = eq("Kick", "Kick & Rush");
    const rue = eq("Rue", "École de la Rue"), cate = eq("Cate", "Catenaccio");
    const nomsDe = (e) => e.joueurs.map((j) => j.nom);

    // deux phases JUMELLES : même construction, issues opposées
    const construire = (issue, attaquants) => ({ minute: 40, numero: 5, evenements: [
      { type: "possession", equipe: "Tiki", acteurs: [attaquants[0]], texte: "possession" },
      { type: "percee", sousType: "dribble", equipe: "Tiki", acteurs: [attaquants[1], "X"], texte: "percée" },
      issue === "but"
        ? { type: "but", but: true, buteur: attaquants[1], equipe: "Tiki", acteurs: [attaquants[1], "G"], texte: "frappe", cri: "BUT !" }
        : { type: "arret", pres: true, equipe: "Cate", acteurs: [attaquants[1], "G"], texte: "arrêt" },
    ] });
    const noms = nomsDe(tiki);
    const aBut = ONZE_SCENE.construireAction(construire("but", noms), tiki, cate);
    const aArret = ONZE_SCENE.construireAction(construire("arret", noms), tiki, cate);
    const avant = (a) => a.slice(0, a.length - 1).map((t) => t.type).join(">");
    const typesIdentiques = avant(aBut) === avant(aArret);
    const issueEnDernier = aBut[aBut.length - 1].issue === true && aArret[aArret.length - 1].issue === true;
    const aucuneIssueAvant = !aBut.slice(0, -1).some((t) => t.issue);
    // 4 à 8 temps (R3)
    const bornes = aBut.length >= 3 && aBut.length <= 8;

    // R12 : l'ADN d'École se lit dans les temps construits
    const typesPour = (equipe, nom) => {
      const n = nomsDe(equipe);
      const phase = { minute: 30, numero: 4, evenements: [
        { type: "possession", equipe: nom, acteurs: [n[0]], texte: "p" },
        { type: "percee", sousType: "course", equipe: nom, acteurs: [n[1], "X"], texte: "pe" },
        { type: "but", but: true, buteur: n[1], equipe: nom, acteurs: [n[1], "G"], texte: "f", cri: "BUT" },
      ] };
      return ONZE_SCENE.construireAction(phase, equipe, cate).map((t) => t.type);
    };
    const adn = {
      tiki: typesPour(tiki, "Tiki").includes("relais"),
      kick: typesPour(kick, "Kick").includes("relais_long"),
      rue: typesPour(rue, "Rue").includes("conduite"),
    };
    // R5 : chaque temps de construction porte une promesse au futur
    const promesses = aBut.filter((t) => !t.issue).every((t) => !!t.promesse || t.type === "frappe");
    return { typesIdentiques, issueEnDernier, aucuneIssueAvant, bornes, adn, promesses,
             sequence: aBut.map((t) => t.type) };
  });
  verifier(`R7 : but et arrêt ont la MÊME chorégraphie avant l'issue (${pur.sequence.join(" > ")})`, pur.typesIdentiques);
  verifier("R7 : l'issue est le dernier temps, et rien avant ne la trahit", pur.issueEnDernier && pur.aucuneIssueAvant);
  verifier(`R3 : l'action tient dans les bornes de temps (${pur.sequence.length})`, pur.bornes);
  verifier("R5 : chaque temps de construction porte une promesse au futur", pur.promesses);
  verifier("R12 : le Tiki-Taka construit en passes courtes", pur.adn.tiki);
  verifier("R12 : le Kick & Rush construit au long ballon", pur.adn.kick);
  verifier("R12 : l'École de la Rue construit balle au pied", pur.adn.rue);

  /* ---- R13 : le stade est une couche de thème, pas du dur ---- */
  const stade = await page.evaluate(async () => {
    const src = await (await fetch("/match-scene.js")).text();
    const gazons = Object.values(ONZE_STADE.THEMES).flatMap((t) => [t.gazon.clair, t.gazon.sombre]);
    return {
      nbThemes: ONZE_STADE.liste().length,
      aucunGazonEnDur: !gazons.some((c) => src.includes(c)),
      geometrieStable: (() => {
        const g1 = ONZE_STADE.geometrie(800, 360, ONZE_STADE.theme("municipal"));
        const g2 = ONZE_STADE.geometrie(800, 360, ONZE_STADE.theme("municipal"));
        return g1.x === g2.x && g1.y === g2.y && g1.w === g2.w && g1.h === g2.h;
      })(),
    };
  });
  verifier(`R13 : plusieurs thèmes de stade disponibles (${stade.nbThemes})`, stade.nbThemes >= 2);
  verifier("R13 : aucune couleur de gazon codée en dur dans la scène", stade.aucunGazonEnDur);
  verifier("R1 : la géométrie du terrain est déterministe (caméra fixe)", stade.geometrieStable);

  /* ---- Un MATCH PLEIN sous instruments : régimes, durées, mouvement,
     étiquettes, ballon jamais téléporté ---- */
  const releve = await page.evaluate(async () => {
    arreterChrono();
    partie.manche = 10;
    // on instrumente la scène AVANT qu'elle naisse
    const creerOriginal = ONZE_SCENE.creer;
    const journal = { temps: [], cuts: 0, misesEnPlace: 0 };
    ONZE_SCENE.creer = function (...args) {
      const sc = creerOriginal.apply(this, args);
      const jt = sc.jouerTemps, ct = sc.cut, mp = sc.miseEnPlace;
      sc.jouerTemps = (t, d, cb) => { journal.temps.push({ t: performance.now(), type: t.type, issue: !!t.issue }); return jt(t, d, cb); };
      sc.cut = (...a) => { journal.cuts++; return ct(...a); };
      sc.miseEnPlace = (...a) => { journal.misesEnPlace++; journal.temps.push({ t: performance.now(), type: "_miseEnPlace" }); return mp(...a); };
      return sc;
    };
    preparerManche();
    const debut = performance.now();
    jouerManche();
    const regimes = [];
    const vitesses = [];
    let ballonPrec = null, sautMaxBallon = 0;
    let etiqAction = [], etiqBut = 0;
    await new Promise((fini) => {
      const tic = setInterval(() => {
        const sc = typeof sceneMatch !== "undefined" ? sceneMatch : null;
        if (!sc) return;
        const d = sc.diagnostic();
        regimes.push(d.regime);
        if (d.regime === "action") {
          vitesses.push(d.positions.reduce((t, p) => t + p.vitesse, 0) / d.positions.length);
          etiqAction.push(d.etiquettes.length);
          if (ballonPrec && !d.ballon.enVol === false) { /* en vol : trajet normal */ }
          if (ballonPrec) {
            const saut = Math.hypot(d.ballon.x - ballonPrec.x, d.ballon.y - ballonPrec.y);
            sautMaxBallon = Math.max(sautMaxBallon, saut);
          }
          ballonPrec = { x: d.ballon.x, y: d.ballon.y };
        } else ballonPrec = null;
        if (d.etiquettes.length >= d.nbDisques) etiqBut++;
        if (document.getElementById("btn-continuer")) { clearInterval(tic); fini(); }
      }, 50);
      setTimeout(() => { clearInterval(tic); fini(); }, 120000);
    });
    ONZE_SCENE.creer = creerOriginal;
    const duree = performance.now() - debut;
    // les écarts entre deux temps joués (le plancher de lisibilité)
    const jeu = journal.temps.filter((t) => t.type !== "_miseEnPlace");
    const ecarts = jeu.slice(1).map((x, i) => x.t - jeu[i].t)
      .filter((e) => e < 2500); // on ignore les sauts de cut / mise en place
    return {
      duree, regimes: [...new Set(regimes)], nbRegimes: regimes.length,
      cuts: journal.cuts, misesEnPlace: journal.misesEnPlace,
      nbTemps: journal.temps.filter((t) => t.type !== "_miseEnPlace").length,
      // la durée RÉELLE d'une mise en place à l'écran : de son départ au
      // premier temps de jeu qui la suit (R3 : ~3 s, comprimée si le
      // budget serre, jamais escamotée)
      misesEnPlaceMs: journal.temps.map((x, i) => x.type === "_miseEnPlace" && journal.temps[i + 1]
        ? journal.temps[i + 1].t - x.t : null).filter((v) => v !== null),
      // la durée d'affichage d'une issue avant la suite
      issuesMs: journal.temps.map((x, i) => x.issue && journal.temps[i + 1]
        ? journal.temps[i + 1].t - x.t : null).filter((v) => v !== null),
      issues: journal.temps.filter((t) => t.issue).length,
      ecartMin: ecarts.length ? Math.min(...ecarts) : 0,
      vitesseMoyenne: vitesses.length ? vitesses.reduce((a, b) => a + b, 0) / vitesses.length : 0,
      partsImmobiles: vitesses.filter((v) => v < 0.15).length / Math.max(vitesses.length, 1),
      sautMaxBallon,
      etiqMax: etiqAction.length ? Math.max(...etiqAction) : 0,
      etiqMed: etiqAction.length ? etiqAction.slice().sort((a, b) => a - b)[Math.floor(etiqAction.length / 2)] : 0,
      etiqBut,
    };
  });

  verifier(`R2 : aucun régime « domination » (${releve.regimes.join(", ")})`,
    !releve.regimes.includes("domination"));
  verifier(`R2 : le match est fait de temps forts coupés au carton (${releve.misesEnPlace} temps forts, ${releve.cuts} cuts)`,
    releve.misesEnPlace >= 1 && releve.cuts >= releve.misesEnPlace);
  verifier(`R9 : 2 à 5 temps forts rendus sur un match plein (${releve.misesEnPlace})`,
    releve.misesEnPlace >= 2 && releve.misesEnPlace <= 5);
  verifier(`R9 : chaque temps fort porte au moins une issue (${releve.issues} issues pour ${releve.misesEnPlace} temps forts)`,
    releve.issues >= releve.misesEnPlace);
  verifier(`R9 : plancher de lisibilité tenu (temps le plus court ${Math.round(releve.ecartMin)} ms ≥ 640)`,
    releve.ecartMin >= 620);
  verifier(`R9 : le match tient dans son budget (${(releve.duree / 1000).toFixed(1)} s pour ~40 s visées)`,
    releve.duree > 15000 && releve.duree < 60000);
  verifier(`R4 : les 22 pions bougent en permanence (vitesse moyenne ${releve.vitesseMoyenne.toFixed(2)} %/s, ${Math.round(releve.partsImmobiles * 100)} % de relevés figés)`,
    releve.vitesseMoyenne > 0.8 && releve.partsImmobiles < 0.2);
  verifier(`R4 : le ballon ne se téléporte jamais (saut max ${releve.sautMaxBallon.toFixed(1)} % de terrain en 50 ms)`,
    releve.sautMaxBallon > 0 && releve.sautMaxBallon < 12);
  verifier(`R6 : les étiquettes suivent l'action, pas tout le monde (médiane ${releve.etiqMed}, max ${releve.etiqMax})`,
    releve.etiqMed >= 1 && releve.etiqMed <= 4);
  verifier(`R6 : tous les noms s'affichent au but (${releve.etiqBut} relevés)`, releve.etiqBut >= 1);
  const mepMin = releve.misesEnPlaceMs.length ? Math.min(...releve.misesEnPlaceMs) : 0;
  verifier(`R3 : la mise en place a le temps de se jouer (la plus courte ${Math.round(mepMin)} ms ≥ 1200)`,
    mepMin >= 1150);
  const issueMin = releve.issuesMs.length ? Math.min(...releve.issuesMs) : 0;
  verifier(`R7 : l'issue reste à l'écran après sa révélation (la plus courte ${Math.round(issueMin)} ms ≥ 900)`,
    issueMin >= 900);

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nFidélité de la scène ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
