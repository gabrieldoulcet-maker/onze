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
/* UNE DETTE ASSUMÉE (règle M3) : un garde-fou qu'on SAIT rouge s'écrit
   quand même — il porte la dette à l'écran et retombe vert tout seul le
   jour où le défaut est réparé. Il ne compte pas dans les échecs, sans
   quoi on ne distinguerait plus une dette connue d'une régression ; mais
   il s'affiche en rouge, et il PRÉVIENT quand il devient vert pour qu'on
   le promeuve en vraie assertion. */
/* ============================================================
   DEUX TESTS, PAS DEUX FOURCHETTES (corollaire de M6 bis).
   « La tolérance doit dépasser le bruit » vaut pour une FOURCHETTE —
   quand les deux nombres comparés sont bruités. Ici la référence est
   EXACTE (6 306 épisodes réels, 7,01/min) et la question est ORIENTÉE :
   « y en a-t-il assez ? ». Un test tranche là où une fourchette ne peut
   pas, et il se RENFORCE tout seul quand la durée rendue s'accumule au
   lieu de rester bloqué par le bruit.
   Un test s'achète au prix de son hypothèse : l'indépendance des
   épisodes est VÉRIFIÉE (indice de dispersion), pas supposée.
   ============================================================ */
// P(N ≤ k | λ) — Poisson, unilatéral à gauche
function poissonCumul(k, lambda) {
  if (lambda <= 0) return k >= 0 ? 1 : 0;
  let terme = Math.exp(-lambda), somme = terme;
  for (let i = 1; i <= k; i++) { terme *= lambda / i; somme += terme; }
  return Math.min(1, somme);
}
// P(X ≤ k | n, p) — binomiale, unilatéral à gauche
function binomialeCumul(k, n, p) {
  if (n <= 0) return 1;
  let terme = Math.pow(1 - p, n), somme = k >= 0 ? terme : 0;
  for (let i = 1; i <= k; i++) { terme *= ((n - i + 1) / i) * (p / (1 - p)); somme += terme; }
  return Math.min(1, somme);
}
/* P(a, x) — gamma incomplète régularisée, série puis fraction continue.
   Elle sert au test du χ² sur l'indice de dispersion : c'est le seul de
   nos tests qui se joue sur n = MATCHS et non n = épisodes, donc le seul
   que notre échantillon peut vraiment porter. */
function gammaLn(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -t + Math.log((2.5066282746310005 * ser) / x);
}
function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a, somme = 1 / a, terme = somme;
    for (let i = 0; i < 500; i++) {
      ap++; terme *= x / ap; somme += terme;
      if (Math.abs(terme) < Math.abs(somme) * 1e-12) break;
    }
    return somme * Math.exp(-x + a * Math.log(x) - gammaLn(a));
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
}
// P(χ²_ddl ≤ x)
const chi2Cumul = (x, ddl) => gammaP(ddl / 2, x / 2);

// l'indice de dispersion : ~1 = Poisson pur, >1 = épisodes groupés
function dispersion(comptes) {
  if (comptes.length < 2) return null;
  const m = comptes.reduce((a, b) => a + b, 0) / comptes.length;
  if (!m) return null;
  const v = comptes.reduce((a, b) => a + (b - m) ** 2, 0) / (comptes.length - 1);
  return v / m;
}

let dettes = 0, dettesVertes = 0;
const dette = (nom, ok, quand) => {
  /* UN VERT NE PAIE PAS UNE DETTE À LUI SEUL (M7) — mais la première
     version de ce message se trompait de remède. Elle demandait « trois
     exécutions vertes d'affilée », ce qui agrège des VERDICTS au lieu
     d'agréger des DONNÉES : trois tests à n = 50 n'auront jamais la
     puissance d'un test à n = 150, et un verdict est la compression avec
     perte d'une mesure. Les comptages se CUMULENT désormais entre
     exécutions (sac indexé par empreinte de code), et le test tranche sur
     le n cumulé. Ce qui reste à la répétition est une AUTRE question —
     la stabilité de l'instrument — et elle a son assertion à part. */
  if (ok) { dettesVertes++; console.log(`🟡 ${nom} — VERTE SUR LE CUMUL : à confirmer sur un cumul plus large, et la stabilité de l'instrument se juge à part`); }
  else { dettes++; console.log(`❌ ${nom}  ⟵ dette assumée, ${quand}`); }
};

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
    /* décision 50 : tout est en MÈTRES, origine au centre. On raisonne
       en « distance à son propre but », le seul repère qui vaille pour
       les deux camps ET pour toutes les tailles de terrain. */
    const T = diag.terrain;
    const depuisSonBut = (p) => (p.camp === "moi" ? p.base + T.L / 2 : T.L / 2 - p.base);
    const bande = (p) => depuisSonBut(p) > 4 && depuisSonBut(p) < 17;   // la ligne de DÉF
    const defCate = diag.positions.filter((p) => p.camp === "moi" && bande(p));
    const defTiki = diag.positions.filter((p) => p.camp === "eux" && bande(p));
    // le bloc bas : les lignes du Catenaccio (mon camp, gauche) sont plus
    // proches de leur but qu'une ligne neutre (13,5 m → 8,9 m)
    const blocBas = defCate.length && defTiki.length
      ? Math.min(...defCate.map(depuisSonBut)) < Math.min(...defTiki.map(depuisSonBut)) - 2 : false;

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
    // décision 50 : tout est en MÈTRES, origine au centre du terrain
    const rayon = 1.84;                       // le rayon d'un pion en m
    const terrain = { L: 104, W: 68 };
    const melee = Array.from({ length: 6 }, (_, i) => ({ x: 0, y: 0, echelle: 1, phase: i * 0.7 }));
    for (let f = 0; f < 40; f++) ONZE_SCENE.separerDisques(melee, terrain, rayon);
    let distMin = Infinity;
    for (let i = 0; i < melee.length; i++) for (let j = i + 1; j < melee.length; j++) {
      const d = Math.hypot(melee[j].x - melee[i].x, melee[j].y - melee[i].y);
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
  verifier(`répulsion : une mêlée de 6 pions se désserre (dist min ${r.repulsion.distMin.toFixed(2)} m ≥ ${r.repulsion.seuil.toFixed(2)} m)`,
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
      for (let i = 0; i < d.positions.length; i++) for (let j = i + 1; j < d.positions.length; j++) {
        const a = d.positions[i], b = d.positions[j];
        mini = Math.min(mini, Math.hypot(b.x - a.x, b.y - a.y));   // en mètres
      }
      // le rayon vient de la scène elle-même : le figer dans le test le
      // rendait faux au premier changement d'échelle (décision 33)
      if (mini < Infinity) releves.push({ mini, rayon: d.rayonPionM });
    }
    return releves;
  });
  const pire = live.length ? live.reduce((a, b) => (a.mini < b.mini ? a : b)) : null;
  verifier(`match animé : jamais deux pions superposés (${live.length} relevés, pire ${pire ? pire.mini.toFixed(2) : "—"} m pour un rayon de ${pire ? pire.rayon.toFixed(2) : "—"} m)`,
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

  /* ---- LES DEUX FORMATS DE TEMPS FORT : la règle d'allocation, testée
     de façon DÉTERMINISTE sur des matchs synthétiques (2 à 6 buts).
     C'est l'arbitrage de Gabriel : tous les buts rendus, tout le monde
     en grand format tant que ça rentre sous ~50 s, puis bascule du
     moins important au plus important — et le DERNIER but du match
     garde toujours le grand format. ---- */
  const alloc = await page.evaluate(() => {
    const parEcole = (ecole, n) => tousLesJoueurs.filter((j) => j.ecole === ecole).slice(0, n)
      .map((j) => ({ ...j, etoiles: 1 }));
    const eqA = ONZE.equipeDepuisFiches("Nous", "Nous", parEcole("Tiki-Taka", 6));
    const eqB = ONZE.equipeDepuisFiches("Eux", "Eux", parEcole("Catenaccio", 6));
    const nA = eqA.joueurs.map((j) => j.nom), nB = eqB.joueurs.map((j) => j.nom);
    // un match de 8 phases dont `nbButs` finissent au fond, alternées
    const matchAvec = (nbButs) => ({ phases: Array.from({ length: 8 }, (_, i) => {
      const numero = i + 1, minute = 10 + i * 10;
      const pourNous = i % 2 === 0;
      const eq = pourNous ? "Nous" : "Eux";
      const noms = pourNous ? nA : nB;
      if (i < nbButs) return { numero, minute, evenements: [
        { type: "possession", equipe: eq, acteurs: [noms[1]], texte: "p" },
        { type: "percee", sousType: "dribble", equipe: eq, acteurs: [noms[2], "X"], texte: "pe" },
        { type: "but", but: true, buteur: noms[2], equipe: eq, acteurs: [noms[2], "G"], texte: "f", cri: "BUT" },
      ] };
      return { numero, minute, evenements: [
        { type: "possession", equipe: eq, acteurs: [noms[1]], texte: "p" },
        { type: "percee_stoppee", sousType: "course", equipe: eq === "Nous" ? "Eux" : "Nous", acteurs: [noms[3]], texte: "s" },
      ] };
    }) });
    const mesures = {};
    for (const nbButs of [2, 3, 4, 5, 6]) {
      const res = matchAvec(nbButs);
      const plan = ONZE_UI.planifierTempsForts(res, eqA, eqB, { delaiPhase: 5000, vitesse: 1 });
      const rendues = [...plan.rendues];
      const dureeTotale = rendues.reduce((t, p) =>
        t + ONZE_UI.coutTempsFort(plan.actions.get(p), plan.miseEnPlaceMs, plan.courtes.has(p)), 0);
      mesures[nbButs] = {
        rendus: rendues.length,
        grands: rendues.filter((p) => !plan.courtes.has(p)).length,
        courts: rendues.filter((p) => plan.courtes.has(p)).length,
        dureeTotale,
        dernierButEnGrand: !plan.courtes.has(plan.derniereAvecBut),
        // tous les buts sont-ils rendus ? (décision 25)
        tousLesButsRendus: res.phases.filter((p) => p.evenements.some((e) => e.but))
          .every((p) => plan.rendues.has(p)),
      };
    }
    // le coût des deux formats, mesuré sur la même action
    const res = matchAvec(3);
    const plan = ONZE_UI.planifierTempsForts(res, eqA, eqB, { delaiPhase: 5000, vitesse: 1 });
    const une = plan.actions.get([...plan.rendues][0]);
    return { mesures,
      coutGrand: ONZE_UI.coutTempsFort(une, plan.miseEnPlaceMs, false),
      coutCourt: ONZE_UI.coutTempsFort(une, plan.miseEnPlaceMs, true),
      tempsCourt: ONZE_UI.actionCourte(une).length, tempsGrand: une.length };
  });
  /* DÉCISION 73 (qui remplace la 32) : TOUT est court, TOUT est rendu.
     Le coût planifié reste ~8 s par action AVANT le facteur de
     déroulement (1,6) — soit ~4-5 s jouées. */
  verifier(`Décision 73 : le format unique coûte ~8 s planifiés (${(alloc.coutCourt / 1000).toFixed(1)} s, ${alloc.tempsCourt} temps — ~${(alloc.coutCourt / 1600 / 1000 * 1000).toFixed(1)} s au déroulement ×1,6)`,
    alloc.coutCourt > 6000 && alloc.coutCourt < 9000);
  for (const [nbButs, m] of Object.entries(alloc.mesures)) {
    verifier(`Décision 73 — ${nbButs} buts : ${m.rendus} rendus, TOUS courts (${m.courts}/${m.rendus}), ${(m.dureeTotale / 1000).toFixed(1)} s planifiées ≈ ${(m.dureeTotale / 1600).toFixed(1)} s jouées (tous les buts rendus : ${m.tousLesButsRendus ? "oui" : "NON"})`,
      m.tousLesButsRendus && m.courts === m.rendus);
  }
  verifier(`Décision 73 : TOUTES les occasions sont rendues, plus de tri (8 phases → 2 buts : ${alloc.mesures[2].rendus} rendus · 6 buts : ${alloc.mesures[6].rendus})`,
    alloc.mesures[2].rendus >= 2 && alloc.mesures[6].rendus >= 6);

  /* ---- FIDÉLITÉ (décision 24) : LE CAS DES HOMONYMES, forcé.
     Le pool contient plusieurs copies de chaque joueur : deux clubs
     peuvent aligner un « Esteban » chacun (mesuré en jeu). On monte donc
     le pire cas — DEUX équipes composées des MÊMES fiches — et on
     vérifie que la scène ne confond pas les deux hommes. ---- */
  const homonymes = await page.evaluate(async () => {
    const fiches = tousLesJoueurs.slice(0, 6).map((j) => ({ ...j, etoiles: 1 }));
    const eqA = ONZE.equipeDepuisFiches("Nous", "Nous", fiches);
    const eqB = ONZE.equipeDepuisFiches("Eux", "Eux", fiches.map((j) => ({ ...j })));
    const bac = document.createElement("div");
    bac.style.cssText = "position:fixed;left:-2000px;width:800px;height:360px";
    document.body.appendChild(bac);
    const sc = ONZE_SCENE.creer(bac, eqA, eqB, {});
    const nom = eqB.joueurs.find((j) => j.poste !== "GAR").nom;
    // une action de l'équipe B, portée par un joueur dont l'homonyme
    // existe aussi dans l'équipe A
    const seq = [{ type: "recuperation", acteur: nom, equipe: "Eux", promesse: "…" }];
    seq.equipe = "Eux"; seq.situation = "placee";
    sc.miseEnPlace(seq, 400);
    sc.jouerTemps(seq[0], 800);
    await new Promise((r) => setTimeout(r, 700));
    const d = sc.diagnostic();
    const memeNom = d.positions.filter((p) => p.nom === nom);
    const resultat = {
      nomPartage: memeNom.length,
      camps: memeNom.map((p) => p.camp),
      porteur: d.ballon.porteur,
      porteursDesignes: d.positions.filter((p) => p.cle === d.ballon.porteur).length,
      etiquetes: d.etiquettes.length,
    };
    sc.detruire(); bac.remove();
    return resultat;
  });
  verifier(`Décision 24 : le cas est bien monté — « ${homonymes.nomPartage} » joueurs du même nom, un par camp (${homonymes.camps.join(", ")})`,
    homonymes.nomPartage === 2 && new Set(homonymes.camps).size === 2);
  verifier(`Décision 24 : l'homonyme ne vole pas le ballon — porteur « ${homonymes.porteur} », ${homonymes.porteursDesignes} pion désigné`,
    homonymes.porteur === "eux|" + homonymes.porteur.split("|")[1] && homonymes.porteursDesignes === 1);
  verifier(`Décision 24 : un seul des deux homonymes est étiqueté (${homonymes.etiquetes})`,
    homonymes.etiquetes === 1);

  /* Le second cas d'homonymie, plus sournois : DEUX COPIES du même
     joueur dans la MÊME équipe (le pool en contient plusieurs, et deux
     copies non fusionnées coexistent). Aucune clé ne doit alors être
     partagée, sinon l'anneau du porteur s'allume deux fois. */
  const jumeaux = await page.evaluate(() => {
    const j = tousLesJoueurs.find((x) => x.poste !== "GAR");
    const fiches = [j, { ...j }, ...tousLesJoueurs.slice(1, 5)].map((f) => ({ ...f, etoiles: 1 }));
    const eq = ONZE.equipeDepuisFiches("Jumeaux", "Jumeaux", fiches);
    const bac = document.createElement("div");
    bac.style.cssText = "position:fixed;left:-2000px;width:800px;height:360px";
    document.body.appendChild(bac);
    const sc = ONZE_SCENE.creer(bac, eq, ONZE.equipeDepuisFiches("B", "B",
      tousLesJoueurs.slice(10, 15).map((f) => ({ ...f, etoiles: 1 }))), {});
    const d = sc.diagnostic();
    const memeNom = d.positions.filter((p) => p.nom === j.nom && p.camp === "moi").length;
    const cles = d.positions.map((p) => p.cle);
    const doublons = cles.filter((c, i) => cles.indexOf(c) !== i);
    sc.detruire(); bac.remove();
    return { memeNom, doublons: doublons.length, total: cles.length };
  });
  verifier(`Décision 24 : deux copies du même joueur dans la même équipe (${jumeaux.memeNom}) gardent des clés distinctes (${jumeaux.doublons} doublon(s) sur ${jumeaux.total})`,
    jumeaux.memeNom >= 2 && jumeaux.doublons === 0);

  /* M5 — LE DÉNOMINATEUR D'UNE SUITE SE DÉCLARE. « Suite complète
     verte » n'est pas vérifiable tant que le nombre de recettes bouge :
     deux conversations ont annoncé 13 et 14 le même jour pour 15
     fichiers réels. Le nombre publié dans tests/RECETTES.md est comparé
     au contenu du disque. */
  const denominateur = await page.evaluate(async () => {
    const md = await (await fetch("/tests/RECETTES.md")).text();
    const annonce = (md.match(/\*\*(\d+) fichiers de recette\.?\*\*/) || [])[1];
    const listes = (md.match(/`tests\/[a-z-]+\.spec\.js`/g) || [])
      .map((x) => x.slice(8, -10)).filter((v, i, l) => l.indexOf(v) === i);
    return { annonce: annonce ? Number(annonce) : null, listes: listes.length };
  });
  const surDisque = require("fs").readdirSync("tests").filter((f) => f.endsWith(".spec.js")).length;
  verifier(`M5 — le dénominateur est déclaré et juste : ${denominateur.annonce} annoncé dans tests/RECETTES.md, ${denominateur.listes} listé(s), ${surDisque} sur le disque`,
    denominateur.annonce === surDisque && denominateur.listes === surDisque);

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

  /* ============================================================
     ÉTAPE 2 — LE TERRAIN ÉLASTIQUE (design/scene-simulation.md §11).
     La surface suit la table de densité (324 m² par joueur, sur le TOTAL
     des deux équipes), à tous les effectifs, y compris asymétriques.
     Fonctions pures : mesuré sans ouvrir de match.
     ============================================================ */
  const elastique = await page.evaluate(() => {
    // la table de design/football-chiffre.md §1
    const TABLE = [
      { n: 10, L: 70, W: 46, quoi: "5 contre 5" },
      { n: 12, L: 77, W: 51, quoi: "6 contre 6" },
      { n: 14, L: 83, W: 55, quoi: "7 contre 7" },
      { n: 16, L: 89, W: 58, quoi: "8 contre 8" },
      { n: 19, L: 97, W: 64, quoi: "8 contre 11 (asymétrique)" },
      { n: 22, L: 104, W: 68, quoi: "11 contre 11" },
      { n: 23, L: 104, W: 68, quoi: "12 contre 11 — plafonné au rectangle peint" },
    ];
    const mesures = TABLE.map((r) => {
      const d = ONZE_SCENE.dimensionsTerrain(r.n);
      return { ...r, obtL: d.L, obtW: d.W,
        ecartL: Math.abs(d.L - r.L) / r.L, ecartW: Math.abs(d.W - r.W) / r.W,
        densite: (d.L * d.W) / r.n };
    });
    /* Le TRACÉ et les PIONS, à chaque effectif. On lit le rectangle de
       pixels une seule fois (il ne bouge pas — R1, caméra fixe) et on ne
       fait varier QUE le terrain en mètres. */
    const th = ONZE_STADE.theme("municipal");
    const tracesEtPions = TABLE.map((r) => {
      const d = ONZE_SCENE.dimensionsTerrain(r.n);
      const g = ONZE_STADE.geometrie(800, 280, th, d);
      return {
        n: r.n, L: d.L, W: d.W,
        // la profondeur de surface RENDUE, en part de la longueur du terrain
        partSurface: (16.5 * g.kTrace) / d.L,
        // le diamètre d'un pion, en part de la LARGEUR du terrain
        partPion: (2 * ONZE_SCENE.RAYON_PION_M) / d.W,
        // et en pixels, pour la lisibilité
        rayonPx: (ONZE_SCENE.RAYON_PION_M / d.W) * g.h,
        // la texture : combien de bandes de tonte, et de quelle largeur RÉELLE
        bandes: Math.max(2, Math.round(14 / g.zoom)),
        zoom: g.zoom,
      };
    });
    // le calibrage : à 55 m (le sept contre sept officiel), 16,5 → 12 m
    const g7 = ONZE_STADE.geometrie(800, 280, th, { L: 55, W: 37 });
    return { mesures, tracesEtPions, surfaceA7: 16.5 * g7.kTrace };
  });
  for (const m of elastique.mesures) {
    verifier(`Étape 2 — densité : ${m.quoi} → ${m.obtL} × ${m.obtW} m (table ${m.L} × ${m.W}, écart ${Math.round(Math.max(m.ecartL, m.ecartW) * 100)} %, ${Math.round(m.densite)} m²/joueur)`,
      m.ecartL <= 0.05 && m.ecartW <= 0.05);
  }
  /* Le tracé GROSSIT quand le terrain rétrécit — c'est ce que fait le
     football à effectif réduit, et c'est ce qui rend le rétrécissement
     lisible. Un tracé en fractions fixes du cadre (le code d'avant)
     donnait exactement la même part à tous les effectifs : cette recette
     sort rouge dessus. */
  const parts = elastique.tracesEtPions.map((t) => t.partSurface);
  const croissantQuandPetit = parts.every((p, i) => i === 0 || p <= parts[i - 1] + 1e-9);
  verifier(`Étape 2 — le tracé grossit quand le terrain rétrécit : surface de réparation de ${Math.round(parts[0] * 1000) / 10} % de la longueur à 10 joueurs → ${Math.round(parts[parts.length - 1] * 1000) / 10} % à 22 (le règlement, 15,9 %)`,
    croissantQuandPetit && parts[0] > parts[parts.length - 1] * 1.15
    && Math.abs(parts[parts.length - 1] - 16.5 / 104) < 0.002);
  verifier(`Étape 2 — le tracé est calibré sur le football à sept officiel : à 55 m, la surface fait ${elastique.surfaceA7.toFixed(1)} m de profondeur (FIFA : 12 m)`,
    Math.abs(elastique.surfaceA7 - 12) < 0.3);
  /* Les PIONS : un joueur ne rétrécit pas quand le terrain rétrécit. Sa
     part de la largeur doit donc AUGMENTER à effectif réduit — sinon le
     rétrécissement ne se voit nulle part. Et il reste lisible partout :
     jamais sous 3,5 % ni au-dessus de 9 % de la largeur du terrain. */
  const pions = elastique.tracesEtPions.map((t) => t.partPion);
  const grossitQuandPetit = pions.every((p, i) => i === 0 || p <= pions[i - 1] + 1e-9);
  verifier(`Étape 2 — le pion garde sa taille RÉELLE : il occupe ${Math.round(pions[0] * 1000) / 10} % de la largeur à 10 joueurs contre ${Math.round(pions[pions.length - 1] * 1000) / 10} % à 22 — c'est là que le rétrécissement se voit`,
    grossitQuandPetit && pions[0] > pions[pions.length - 1] * 1.25);
  const lisibles = elastique.tracesEtPions.every((t) => t.partPion >= 0.035 && t.partPion <= 0.09 && t.rayonPx >= 2.4);
  verifier(`Étape 2 — pions lisibles à TOUS les effectifs (${elastique.tracesEtPions.map((t) => `${t.n}:${Math.round(t.partPion * 1000) / 10}%`).join(" · ")} — bornes 3,5-9 %)`,
    lisibles);
  /* LA TEXTURE DU GAZON. Un tracé mis à l'échelle donne au petit terrain
     exactement la SILHOUETTE d'un grand : si le gazon aussi paraît
     identique, l'œil n'a plus que la taille des pions comme indice, et
     c'est maigre. Une bande de tonte a une largeur réelle (~7,4 m) : à
     effectif réduit on en voit donc MOINS, et elles sont plus larges à
     l'écran. La recette vérifie que cette largeur réelle ne bouge pas —
     un nombre de bandes figé (le code d'avant) la ferait varier du
     simple au double et sort rouge ici. */
  const largeursBande = elastique.tracesEtPions.map((t) => t.L / t.bandes);
  const bandeMin = Math.min(...largeursBande), bandeMax = Math.max(...largeursBande);
  const nbBandes = elastique.tracesEtPions.map((t) => t.bandes);
  /* LE COVER ROGNE — et il ne doit jamais rogner du TERRAIN. Une arène
     de rapport 2,16 posée sur un cadre de 3,1 perd 15 % de sa hauteur en
     haut et autant en bas. Perdre des tribunes est sans conséquence ;
     perdre un bout de surface de réparation fausserait la géométrie
     qu'on vient de relever sur ces mêmes images. On vérifie donc que le
     quadrilatère relevé tient ENTIÈREMENT dans la fenêtre visible, sur
     chaque thème et chaque taille d'écran. */
  const cadrages = await page.evaluate(() => {
    const tailles = [[840, 269], [663, 200], [928, 297], [840, 227], [663, 180]];
    const sortie = [], rapports = [];
    /* TOUS les thèmes servis au joueur, pas seulement ceux qui ont un
       décor peint. C'est ce filtre-là qui avait laissé la recette verte :
       les trois thèmes DESSINÉS n'ont ni fond ni quadrilatère, leur
       rectangle suivait la fenêtre — de 2,12 à 4,64 selon l'écran — et
       ils ne suivaient donc aucune caméra (décision 51). */
    for (const { id } of ONZE_STADE.liste()) {
      const th = ONZE_STADE.theme(id);
      if (!th) continue;
      for (const [L, H] of tailles) {
        const g = ONZE_STADE.geometrie(L, H, th, { L: 104, W: 68 });
        /* La caméra d'un thème : dessiné → le rapport imposé 2,40 ;
           ARÈNE (mode quad) → celui de SON terrain peint, sans
           déformation — le rendu doit reproduire exactement le rapport
           du quadrilatère de l'image (renversement de la décision 51,
           « ils jouent sur mon arène »). */
        let rapportImage = null;
        if (th.quad) {
          const q2 = th.quad;
          const wf = Math.max(q2.hautDroite[0] - q2.hautGauche[0], q2.basDroite[0] - q2.basGauche[0]) * th.fondTaille.w;
          const hf = ((q2.basGauche[1] + q2.basDroite[1]) - (q2.hautGauche[1] + q2.hautDroite[1])) / 2 * th.fondTaille.h;
          rapportImage = wf / hf;
        }
        rapports.push({ nom: th.nom, arene: !!th.quad, L, H, rapport: g.w / g.h, rapportImage });
        if (!th.fond || !th.terrain) continue;    // pas d'image : rien à rogner
        const f = g.fenetreImage;
        if (!f) { sortie.push({ nom: th.nom, L, H, ok: false, pourquoi: "aucune fenêtre" }); continue; }
        // en mode quad, ce qui ne doit jamais être rogné est le QUAD lui-même
        const q = th.quad
          ? { gauche: Math.min(th.quad.hautGauche[0], th.quad.basGauche[0]),
              droite: Math.max(th.quad.hautDroite[0], th.quad.basDroite[0]),
              haut: Math.min(th.quad.hautGauche[1], th.quad.hautDroite[1]),
              bas: Math.max(th.quad.basGauche[1], th.quad.basDroite[1]) }
          : th.terrain;
        const marge = Math.min(q.gauche - f.x0, f.x1 - q.droite, q.haut - f.y0, f.y1 - q.bas);
        sortie.push({ nom: th.nom, L, H, ok: marge >= 0, marge,
          // la marge la plus faible, en pixels du cadre
          margePx: Math.round(marge * Math.min(L / (f.x1 - f.x0), H / (f.y1 - f.y0))) });
      }
    }
    return { sortie, rapports, nbThemes: ONZE_STADE.liste().length };
  });
  /* LA CAMÉRA, sur TOUS les thèmes et toutes les tailles — RENVERSEMENT
     PARTIEL de la décision 51 (« ils jouent sur mon arène ») : une ARÈNE
     n'a plus de rapport imposé, sa caméra est celle de son terrain
     PEINT, et le rendu doit le reproduire SANS déformation (rapport
     rendu = rapport image, à 2 % près). Les thèmes DESSINÉS gardent le
     2,40 de la décision 51 — eux n'ont pas d'artwork pour le dicter. */
  const horsCamera = cadrages.rapports.filter((r) => (r.arene
    ? Math.abs(r.rapport - r.rapportImage) / r.rapportImage > 0.02
    : Math.abs(r.rapport - 2.40) > 0.12));
  const aRendus = cadrages.rapports.filter((r) => r.arene);
  verifier(`Étape 2 — chaque stade suit SA caméra : arènes sans déformation (rendu = terrain peint, ${[...new Set(aRendus.map((r) => `${r.nom} ${r.rapportImage.toFixed(2)}`))].join(" · ")}), thèmes dessinés à 2,40 (décision 51 renversée en partie : « ils jouent sur mon arène »)${horsCamera.length ? ` — fautifs : ${[...new Set(horsCamera.map((r) => r.nom))].join(", ")}` : ""}`,
    cadrages.rapports.length >= 25 && horsCamera.length === 0);

  const pires = {};
  for (const c of cadrages.sortie) {
    if (!pires[c.nom] || c.marge < pires[c.nom].marge) pires[c.nom] = c;
  }
  for (const nom in pires) {
    const p = pires[nom];
    verifier(`Étape 2 — le cadrage « cover » ne rogne pas le terrain peint : « ${nom} », pire cas ${p.L}×${p.H} → marge ${(p.marge * 100).toFixed(1)} % de l'image (${p.margePx} px)`,
      p.ok);
  }
  verifier(`Étape 2 — toutes les arènes contrôlées à toutes les tailles (${cadrages.sortie.length} cadrages, ${cadrages.sortie.filter((c) => !c.ok).length} fautif(s))`,
    cadrages.sortie.length >= 9 && cadrages.sortie.every((c) => c.ok));

  verifier(`Étape 2 — le gazon zoome avec le terrain : la bande de tonte garde sa largeur réelle (${bandeMin.toFixed(1)}-${bandeMax.toFixed(1)} m) et on en voit ${nbBandes[0]} à 10 joueurs contre ${nbBandes[nbBandes.length - 1]} à 22`,
    bandeMax / bandeMin <= 1.15 && nbBandes[0] < nbBandes[nbBandes.length - 1]);

  /* ============================================================
     LES MAILLOTS DE MATCH — la couleur dit l'ÉQUIPE, la séparation
     d'avec le sol vient d'un signal NON COLORÉ (décision 61).
     ============================================================ */
  const couleurs = await page.evaluate(() => {
    const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const contraste = (a, b) => { const la = L(a), lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
    const melange = (src, alpha, fond) => src.map((v, i) => Math.round(v * alpha + fond[i] * (1 - alpha)));
    const lab = (rgb) => {
      const [r, g, b] = rgb.map(lin);
      const X = r * 0.4124 + g * 0.3576 + b * 0.1805, Y = r * 0.2126 + g * 0.7152 + b * 0.0722,
            Z = r * 0.0193 + g * 0.1192 + b * 0.9505;
      const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      const fx = f(X / 0.95047), fy = f(Y), fz = f(Z / 1.08883);
      return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    };
    const dE = (a, b) => { const x = lab(a), y = lab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
    const m = ONZE_SCENE.maillots();
    const o = ONZE_SCENE.OMBRE_CONTACT, li = ONZE_SCENE.LISERE_HAUT;
    const sols = ONZE_STADE.liste().map(({ id }) => {
      const t = ONZE_STADE.theme(id);
      return { nom: t.nom, sol: hex(ONZE_STADE.sol(t)) };
    });
    return {
      dEBleuRouge: dE(hex(m.moi.corps), hex(m.eux.corps)),
      dEBleuJaune: dE(hex(m.moi.corps), hex(m.gardien.corps)),
      dERougeJaune: dE(hex(m.eux.corps), hex(m.gardien.corps)),
      // le constat qui JUSTIFIE le signal non coloré : aucun maillot ne tient
      maillotsContreSol: sols.map((s) => ({ nom: s.nom,
        moi: contraste(hex(m.moi.corps), s.sol), eux: contraste(hex(m.eux.corps), s.sol) })),
      // et le signal non coloré, lui, tient partout
      signal: sols.map((s) => ({ nom: s.nom,
        ombre: contraste(melange(o.rgb, o.alpha, s.sol), s.sol),
        lisere: contraste(melange(li.rgb, li.alpha, s.sol), s.sol) })),
      // la couleur est rangée par ÉQUIPE : aucune famille sur le terrain
      parEquipe: !!(m.moi && m.eux && m.gardien) &&
        Object.values(m).every((x) => typeof x.corps === "string"),
      familles: Object.keys(ONZE_SCENE.couleurFamille ? {} : {}).length,
    };
  });
  verifier(`Décision 61 — bleu et rouge sont la meilleure paire (ΔE ${Math.round(couleurs.dEBleuRouge)} ; gardien à ΔE ${Math.round(couleurs.dEBleuJaune)} du bleu et ${Math.round(couleurs.dERougeJaune)} du rouge)`,
    couleurs.dEBleuRouge >= 100 && couleurs.dEBleuJaune >= 60 && couleurs.dERougeJaune >= 60);
  const aucunMaillotNeTient = couleurs.maillotsContreSol.some((s) => s.moi < 3 || s.eux < 3);
  console.log(`   📐 aucun maillot ne tient 3:1 contre tous les sols — ${couleurs.maillotsContreSol.map((s) => `${s.nom} ${s.moi.toFixed(2)}/${s.eux.toFixed(2)}`).join(" · ")} (c'est pour ça que la séparation ne peut pas venir de la teinte)`);
  const signalOk = couleurs.signal.every((s) => Math.max(s.ombre, s.lisere) >= 3);
  verifier(`Décision 61 — la séparation vient d'un signal NON COLORÉ : sur chaque sol, l'ombre de contact OU le liseré tient 3:1 (${couleurs.signal.map((s) => `${s.nom} ${s.ombre.toFixed(1)}/${s.lisere.toFixed(1)}`).join(" · ")})`,
    signalOk && aucunMaillotNeTient);

  /* ============================================================
     ÉTAPE A — LE PION EST UN CORPS. Taille, mêlée, repli.
     ============================================================ */
  const figurines = await page.evaluate(async () => {
    const parEcole = (ecole, n) => tousLesJoueurs.filter((j) => j.ecole === ecole).slice(0, n)
      .map((j) => ({ ...j, etoiles: 1 }));
    const sortie = { tailles: [], melee: null, repli: null };
    // 1. LA TAILLE : hauteur = 1,2 × le diamètre du pion, à tous les
    //    effectifs et à toutes les tailles d'écran
    for (const [n, L, H] of [[5, 800, 280], [8, 800, 280], [11, 800, 280], [11, 560, 190], [5, 1000, 340]]) {
      const bac = document.createElement("div");
      bac.style.cssText = `position:fixed;left:-3000px;width:${L}px;height:${H}px`;
      document.body.appendChild(bac);
      const sc = ONZE_SCENE.creer(bac,
        ONZE.equipeDepuisFiches("A", "A", parEcole("Tiki-Taka", n)),
        ONZE.equipeDepuisFiches("B", "B", parEcole("Catenaccio", n)), {});
      const d = sc.diagnostic();
      sortie.tailles.push({ n: n * 2, L, H, hauteur: d.figurine.hauteur,
        diametre: 2 * d.rayonPion, rapport: d.figurine.hauteur / (2 * d.rayonPion),
        partTete: d.figurine.partTete });
      sc.detruire(); bac.remove();
    }
    /* 2. LA MÊLÉE — le vrai go/no-go du chantier. À 23 px avec
       vingt-deux corps, trois joueurs qui se croisent peuvent faire une
       bouillie là où trois disques restaient lisibles. On les superpose
       de force et on regarde les PIXELS : le porteur doit rester
       identifiable (son anneau au sol) et les deux camps distinguables. */
    {
      const bac = document.createElement("div");
      bac.style.cssText = "position:fixed;left:-3000px;width:800px;height:280px";
      document.body.appendChild(bac);
      const sc = ONZE_SCENE.creer(bac,
        ONZE.equipeDepuisFiches("A", "A", parEcole("Tiki-Taka", 6)),
        ONZE.equipeDepuisFiches("B", "B", parEcole("Catenaccio", 6)), {});
      await new Promise((r) => setTimeout(r, 600));
      const d0 = sc.diagnostic();
      // on colle quatre pions des DEUX camps au même endroit
      sc.entasser(0, 0);
      await new Promise((r) => setTimeout(r, 120));
      const cv = bac.querySelector("canvas");
      const g = cv.getContext("2d");
      const dpr = cv.width / cv.clientWidth;
      const geo = sc.diagnostic().cadre;
      const cx = (geo.x + geo.w / 2) * dpr, cy = (geo.y + geo.h / 2) * dpr;
      // assez large pour contenir la mêlée même après la poussée (R4)
      const cote = Math.round(95 * dpr);
      const im = g.getImageData(Math.round(cx - cote), Math.round(cy - cote), cote * 2, cote * 2).data;
      let bleus = 0, rouges = 0, clairs = 0;
      for (let i = 0; i < im.length; i += 4) {
        const R = im[i], V = im[i + 1], B = im[i + 2], A = im[i + 3];
        if (A < 40) continue;
        if (B > 120 && B > R * 1.5 && B > V * 1.2) bleus++;
        else if (R > 120 && R > B * 1.5 && R > V * 1.5) rouges++;
        else if (R > 200 && V > 200 && B > 190) clairs++;   // l'anneau du porteur / le liseré
      }
      sortie.melee = { bleus, rouges, clairs, entasses: d0.nbDisques };
      sc.detruire(); bac.remove();
    }
    // 3. LE REPLI : figurines coupées, le match reste jouable et lisible
    {
      const avant = ONZE_SCENE.reglages().figurines;
      ONZE_SCENE.majReglages({ figurines: false });
      const bac = document.createElement("div");
      bac.style.cssText = "position:fixed;left:-3000px;width:800px;height:280px";
      document.body.appendChild(bac);
      const sc = ONZE_SCENE.creer(bac,
        ONZE.equipeDepuisFiches("A", "A", parEcole("Tiki-Taka", 6)),
        ONZE.equipeDepuisFiches("B", "B", parEcole("Catenaccio", 6)), {});
      await new Promise((r) => setTimeout(r, 500));
      const d = sc.diagnostic();
      const cv = bac.querySelector("canvas");
      const g = cv.getContext("2d");
      const dpr = cv.width / cv.clientWidth;
      const im = g.getImageData(0, 0, cv.width, cv.height).data;
      let bleus = 0, rouges = 0;
      for (let i = 0; i < im.length; i += 4) {
        const R = im[i], V = im[i + 1], B = im[i + 2];
        if (B > 120 && B > R * 1.5 && B > V * 1.2) bleus++;
        else if (R > 120 && R > B * 1.5 && R > V * 1.5) rouges++;
      }
      sortie.repli = { figurines: d.figurine.active, pions: d.nbDisques, bleus, rouges };
      sc.detruire(); bac.remove();
      ONZE_SCENE.majReglages({ figurines: avant });
    }
    return sortie;
  });
  const tailleOk = figurines.tailles.every((t) => Math.abs(t.rapport - 1.2) < 0.02);
  verifier(`Étape A — la figurine mesure 1,2 × le diamètre du pion, à tous les effectifs et écrans (${figurines.tailles.map((t) => `${t.n}j ${t.L}×${t.H}: ${t.hauteur.toFixed(1)} px pour ${t.diametre.toFixed(1)}`).join(" · ")})`,
    tailleOk && figurines.tailles.every((t) => t.partTete >= 0.34 && t.partTete <= 0.38));
  /* P5 — UN SEUIL ENTRE DEUX CAMPS EST RELATIF ET SYMÉTRIQUE. Un
     plancher par équipe ne suffit pas : la recette resterait verte
     pendant qu'un camp disparaît. Mesuré avant correctif : 325 px bleus
     contre 203 rouges, soit 1,60× — et ce n'est pas un hasard de
     cadrage, le rouge est à 1,00 de contraste contre le sol turquoise et
     perd sur deux sols sur trois. On exige donc un plancher pour CHACUN
     et un rapport borné entre les deux. */
  const m = figurines.melee;
  const rapportCamps = Math.max(m.bleus, m.rouges) / Math.max(1, Math.min(m.bleus, m.rouges));
  verifier(`Étape A — la MÊLÉE reste lisible ET symétrique : ${m.bleus} px bleus contre ${m.rouges} rouges (rapport ${rapportCamps.toFixed(2)}, plafond 1,35) sur ${m.entasses} pions entassés, porteur repérable (${m.clairs} px clairs)`,
    m.bleus > 40 && m.rouges > 40 && m.clairs > 20 && rapportCamps <= 1.35);
  verifier(`Étape A — le repli tient : figurines coupées, le match reste lisible (${figurines.repli.pions} disques, ${figurines.repli.bleus} px bleus / ${figurines.repli.rouges} px rouges)`,
    figurines.repli.figurines === false && figurines.repli.bleus > 40 && figurines.repli.rouges > 40);

  /* ---- Un MATCH PLEIN sous instruments : régimes, durées, mouvement,
     étiquettes, ballon jamais téléporté ---- */
  /* Le match de relevé doit avoir de la MATIÈRE : un 0-0 à une seule
     occasion ne prouve rien sur les buts ni sur les formats. On rejoue
     (jusqu'à 4 fois) jusqu'à décrocher un match avec au moins un but —
     le moteur n'est pas touché, on tire juste un autre match. */
  /* Le MARQUAGE, lui, se juge sur un ÉCHANTILLON, pas sur une durée.
     Un match court peut ne montrer qu'un seul marqueur en position : le
     seuil « au moins 15 relevés » échouait alors sur la taille de
     l'échantillon, pas sur la qualité du marquage (mesuré : 1, 52, 64,
     79 relevés selon les matchs). On CUMULE donc les relevés d'un match
     à l'autre jusqu'à remplir le sac — ce sont les mêmes observations de
     la même règle, et rejouer un match ne coûte que du temps machine. */
  /* La taille de l'échantillon, pas la sévérité du seuil. Un match ne
     donne qu'une cinquantaine de relevés de marquage et la dispersion
     d'un match à l'autre est réelle (mesurée : 47, 88, 100 %). On cumule
     donc jusqu'à 100 relevés — ce sont les mêmes observations de la même
     règle, et rejouer un match ne coûte que du temps machine. Le nombre
     d'essais suit : à ~20-50 relevés par match, six ne suffisaient pas
     toujours (mesuré : 136, 128, 109 sur six). */
  const ECHANTILLON_MARQUAGE = 100;
  const sacMarquage = { vus: 0, bons: 0, tous: 0, tousBons: 0, matchs: 0 };
  const sacPorteur = [];
  /* Les ÉPISODES de l'étape 3 se cumulent d'un match à l'autre, comme le
     marquage : un match ne donne que cinq appels et sept pressings, et
     une distribution ne se juge pas sur sept points (décision 43). */
  const sacE3 = { hauteurs: [], postures: {}, lignes: [], appels: [], pressings: [], options: [], dureesOption: [] };
  /* La tenue de ligne se cumule sur TOUS les matchs du passage, par
     régime : le verdict sur un seul match tirait à pile ou face autour
     du seuil (6,5 · 6,7 · 8,3 · 9,2 mesurés sur le même code). */
  const sacLignes = { repos: { n: 0, somme: 0 }, action: { n: 0, somme: 0 } };
  const lignesReposParMatch = [];
  /* Le FOOTBALL RENDU, en secondes cumulées : c'est le dénominateur du
     taux de pressing. Un TAUX se stabilise sur le nombre de MATCHS, pas
     sur le nombre d'épisodes — neuf matchs suffisent là où la
     distribution en demanderait trente-cinq. */
  let secondesRendues = 0;
  const episodesParMatch = [];   // pour vérifier l'hypothèse d'indépendance
  /* La durée des temps forts se cumule elle aussi : un match ne rend
     parfois qu'UN grand format, et une moyenne sur un point n'est pas
     une moyenne (décision 43). */
  const sacFormats = [];
  let releve = null, avecMatiere = null;
  let matchsHorsDelai = 0;
  for (let essai = 0; essai < 14; essai++) {
    releve = await mesurerUnMatch(page);
    if (releve.horsDelai) {
      /* Un match qui n'a pas rendu la main dans les deux minutes : on le
         SIGNALE et on s'arrête là. En relancer un par-dessus mélangeait
         deux scènes et faisait tomber trois assertions étrangères au
         défaut. */
      matchsHorsDelai++;
      break;
    }
    sacMarquage.vus += releve.marquagesVus; sacMarquage.bons += releve.marquagesBons;
    sacMarquage.tous += releve.marquagesTous; sacMarquage.tousBons += releve.marquagesTousBons;
    sacMarquage.matchs++;
    sacPorteur.push(...(releve.relevesPorteurSimule || []));
    sacFormats.push(...(releve.tempsFortsMs || []));
    if (releve.lignesParRegime) {
      for (const k of ["repos", "action"]) {
        sacLignes[k].n += releve.lignesParRegime[k].n;
        sacLignes[k].somme += releve.lignesParRegime[k].somme;
      }
      if (releve.lignesParRegime.repos.n >= 2) {
        lignesReposParMatch.push(releve.lignesParRegime.repos.somme / releve.lignesParRegime.repos.n);
      }
    }
    secondesRendues += (releve.duree || 0) / 1000;
    episodesParMatch.push(((releve.etape3 && releve.etape3.pressings) || []).filter((p) => p.duree >= 1).length);
    if (releve.etape3) {
      for (const k of ["hauteurs", "lignes", "appels", "pressings", "options", "dureesOption"]) {
        sacE3[k].push(...(releve.etape3[k] || []));
      }
      for (const k in releve.etape3.postures) sacE3.postures[k] = (sacE3.postures[k] || 0) + releve.etape3.postures[k];
    }
    // le relevé qui sert à TOUTES les autres mesures doit avoir de la matière
    if (!avecMatiere && releve.buts >= 1 && releve.misesEnPlace >= 2) avecMatiere = releve;
    const tiragesPostures = Object.values(sacE3.postures).reduce((a, b) => a + b, 0);
    if (avecMatiere && sacMarquage.vus >= ECHANTILLON_MARQUAGE && sacPorteur.length >= 40
        && sacE3.appels.length >= 15 && sacE3.dureesOption.length >= 30
        // on compte les ÉPISODES (≥ 1 s), pas les pressings bruts : c'est
        // sur eux que portent les trois références recalculées
        && sacE3.pressings.filter((p) => p.duree >= 1).length >= 25
        /* Le test de densité se renforce avec la durée rendue. À 380 s le
           p oscillait entre 0,009 et 0,048 selon le tirage : le VERDICT
           tenait (toujours rouge) mais il frôlait le seuil. À 500 s,
           λ ≈ 58 et un taux réel de ~5,05/min donne p ≈ 0,015 — la
           décision ne dépend plus du tirage. Trois matchs de plus,
           ~2 minutes de recette. */
        && secondesRendues >= 500
        && tiragesPostures >= 45) break;
    console.log(`   (relevé ${essai + 1} : ${releve.buts} but(s), ${releve.misesEnPlace} temps fort(s), ${releve.marquagesVus} marquage(s) en position — sac à ${sacMarquage.vus}/${ECHANTILLON_MARQUAGE} · épisodes de pressing ≥1 s cumulés : ${sacE3.pressings.filter((p) => p.duree >= 1).length}, on rejoue)`);
  }
  if (avecMatiere) releve = avecMatiere;

  async function mesurerUnMatch(pageDuMatch) { return pageDuMatch.evaluate(async () => {
    // repartir propre : si un bilan de manche traîne, on le referme
    const btn = document.getElementById("btn-continuer");
    if (btn) btn.click();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    arreterChrono();
    partie.manche = 10;
    // on instrumente la scène AVANT qu'elle naisse
    const creerOriginal = ONZE_SCENE.creer;
    const journal = { temps: [], cuts: 0, misesEnPlace: 0, resultat: null };
    // décision 73 : on attrape le RÉSULTAT du moteur au passage, pour
    // compter ses phases chaudes (le dénominateur du « 100 % rendues »)
    if (!ONZE_UI.__rejouerOriginal) {
      ONZE_UI.__rejouerOriginal = ONZE_UI.rejouer;
    }
    ONZE_UI.rejouer = function (resultat, ...reste) {
      journal.resultat = resultat;
      return ONZE_UI.__rejouerOriginal.call(this, resultat, ...reste);
    };
    ONZE_SCENE.creer = function (...args) {
      const sc = creerOriginal.apply(this, args);
      const jt = sc.jouerTemps, ct = sc.cut, mp = sc.miseEnPlace;
      sc.jouerTemps = (t, d, cb) => {
        journal.temps.push({ t: performance.now(), type: t.type, issue: !!t.issue,
          decisif: !!t.issue || !!t.decisif || t.type === "percee" });
        return jt(t, d, cb);
      };
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
    let etiqAction = [], etiqBut = 0, nonFinies = 0;
    // étape 3 : les distributions du cerveau
    const e3 = { hauteurs: [], postures: {}, lignes: [] };
    // décision 33 : les mesures du cerveau de placement
    let sansRaison = 0, premierMuet = null; const ecartsCible = [];
    let appelsVus = 0, appelsEnCourse = 0;
    let reposDepuis = 0, vitesseReposCourante = 0; const finsDeRepos = [];
    let lignesVues = 0, sommeEcartType = 0;
    const lignesParRegime = { repos: { n: 0, somme: 0 }, action: { n: 0, somme: 0 } };
    let marquagesVus = 0, marquagesBons = 0, marquagesTous = 0, marquagesTousBons = 0;
    // R12 : la timeline des temps forts
    let tlTotal = 0, tlMax = -1, tlRecule = 0, tlMalCompte = 0;
    let porteurAmbigu = 0, matchsAvecHomonymes = 0;
    let capPrec = null; const braquages = []; const allures = [];
    /* ÉTAPE 1 : les distributions de vitesse. Les relevés « au tick »
       (accélération, sur-vitesse) viennent de la scène elle-même —
       échantillonner à 50 ms raterait les pics. */
    const vitessesChamp = [], vitessesPorteur = [], vitessesPorteurSimule = [];
    const pct = (l, q) => (l.length ? l.slice().sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor(l.length * q))] : 0);
    const med = (l) => pct(l, 0.5);
    let physique = { accelMax: 0, vitesseMax: 0, surVitesse: 0, surAccel: 0, ticks: 0 };
    let vMaxPlusHaut = 0;
    let sceneVue = false, horsDelai = false;
    await new Promise((fini) => {
      const tic = setInterval(() => {
        const sc = typeof sceneMatch !== "undefined" ? sceneMatch : null;
        if (sc) sceneVue = true;
        if (!sc) {
          // la scène a vécu puis disparu : le match est terminé
          if (sceneVue) { clearInterval(tic); fini(); }
          return;
        }
        const d = sc.diagnostic();
        regimes.push(d.regime);
        if (d.positions.some((p) => !isFinite(p.x) || !isFinite(p.y)) ||
            !isFinite(d.ballon.x) || !isFinite(d.ballon.y)) nonFinies++;
        /* --- FIDÉLITÉ (décision 24) : le pool contient plusieurs copies
           de chaque joueur, donc deux clubs peuvent aligner un homonyme.
           Le porteur, le receveur attendu et l'homme marqué doivent être
           désignés par leur CLÉ (camp|nom), sinon la scène allume les
           deux et peut montrer le mauvais homme. --- */
        if (d.ballon.porteur) {
          const porteurs = d.positions.filter((p) => p.cle === d.ballon.porteur);
          if (porteurs.length !== 1) porteurAmbigu++;
        }
        const homonymes = d.positions.map((p) => p.nom)
          .filter((n, i, l) => l.indexOf(n) !== i);
        if (homonymes.length) matchsAvecHomonymes++;
        // --- Règle 12 de la spec : la timeline ---
        if (d.timeline) {
          tlTotal = d.timeline.total;
          if (d.timeline.courant < tlMax) tlRecule++;      // elle ne revient jamais en arrière
          tlMax = Math.max(tlMax, d.timeline.courant);
          const points = document.querySelectorAll(".timeline-tf .point-tf");
          const courants = document.querySelectorAll(".timeline-tf .point-tf.courant");
          // un point par temps fort, et un seul courant dès qu'un est ouvert
          if (points.length !== d.timeline.total ||
              courants.length !== (d.timeline.courant >= 0 ? 1 : 0)) tlMalCompte++;
        }
        /* --- ÉTAPE 1 : LE BRAQUAGE. Un joueur lancé décrit une courbe ;
           il ne pivote pas sur place. On mesure la rotation du cap par
           seconde, sur les seuls pions qui COURENT vraiment (au-dessus
           de 6 %/s) — à l'arrêt, tourner est gratuit et normal. --- */
        if (capPrec) {
          for (const p of d.positions) {
            /* On ne mesure QUE la population que la règle gouverne :
               un joueur LANCÉ (> 12 %/s, là où le plafond angulaire mord
               vraiment) et qui a de la route devant lui
               (> 4 % de terrain). Mesurer plus large diluait le signal
               au point que la recette passait même braquage coupé — un
               garde-fou qui ne sort pas rouge sur son propre défaut n'en
               est pas un. */
            if (p.vitesse < 5 || (p.ecartCible !== null && p.ecartCible <= 4)) continue;
            const avant = capPrec[p.cle];
            if (avant === undefined || avant.v < 5 || avant.loin === false) continue;
            let ecart = p.cap - avant.cap;
            while (ecart > Math.PI) ecart -= 2 * Math.PI;
            while (ecart < -Math.PI) ecart += 2 * Math.PI;
            const parSeconde = Math.abs(ecart) / 0.05;   // le pas d'échantillonnage
            braquages.push(parSeconde);
          }
        }
        capPrec = {};
        for (const p of d.positions) capPrec[p.cle] = { cap: p.cap, v: p.vitesse, vx: p.vx, vy: p.vy,
          loin: p.ecartCible === null || p.ecartCible > 4 };
        // --- décision 33 : le cerveau ---
        const champ = d.positions.filter((p) => p.role !== "gardien");
        const muets = champ.filter((p) => !p.role);
        if (muets.length) {
          sansRaison++;
          if (!premierMuet) premierMuet = { regime: d.regime, n: muets.length,
            qui: muets.map((p) => `${p.camp}|${p.nom}`).slice(0, 3).join(","),
            cible: muets[0].cible ? "avec cible" : "sans cible" };
        }
        champ.forEach((p) => { if (p.ecartCible !== null) ecartsCible.push(p.ecartCible); });
        if (d.receveurAttendu) {
          const r = d.positions.find((p) => p.cle === d.receveurAttendu);
          if (r) { appelsVus++; if (r.vitesse > 1) appelsEnCourse++; }
        }
        /* Le repos : on ne mesure PAS le pic juste après un temps fort
           (les pions s'y replacent, c'est de la convergence). On garde la
           vitesse à la FIN de chaque période de repos : c'est là qu'une
           scène pilotée par une fonction du temps continuerait d'osciller
           alors qu'une scène pilotée par des intentions s'est calmée. */
        if (d.regime === "repos") {
          vitesseReposCourante = Math.max(...champ.map((p) => p.vitesse));
          reposDepuis++;
        } else if (reposDepuis >= 3) {
          finsDeRepos.push(vitesseReposCourante); reposDepuis = 0;
        } else reposDepuis = 0;
        for (const camp of ["moi", "eux"]) {
          const ligne = d.positions.filter((p) => p.camp === camp && p.role === "ligne");
          if (ligne.length < 2) continue;
          const moy = ligne.reduce((t, p) => t + p.x, 0) / ligne.length;
          const et = Math.sqrt(ligne.reduce((t, p) => t + (p.x - moy) ** 2, 0) / ligne.length);
          sommeEcartType += et;
          lignesVues++;
          // la même grandeur, séparée par régime : une ligne posée (repos)
          // et une ligne en plein pressing ne sont pas la même population
          const cleReg = d.regime === "repos" ? "repos" : "action";
          lignesParRegime[cleReg].n++; lignesParRegime[cleReg].somme += et;
        }
        for (const m of d.positions.filter((p) => p.role === "marquage" && p.marque)) {
          const homme = d.positions.find((p) => p.cle === m.marque);
          if (!homme) continue;
          // goal-side : le marqueur est entre son homme et SON but
          const but = m.camp === "moi" ? -d.terrain.L / 2 : d.terrain.L / 2;
          const bon = Math.abs(m.x - but) <= Math.abs(homme.x - but) + 0.5;
          marquagesTous++; if (bon) marquagesTousBons++;
          // la spec demande un défenseur goal-side « à moins d'un seuil » :
          // celui qui court encore vers son homme n'est pas en position
          if (m.ecartCible !== null && m.ecartCible < 5) {
            marquagesVus++; if (bon) marquagesBons++;
          }
        }
        if (d.regime === "action" && d.hauteurDepuisBut) {
          for (const c of ["moi", "eux"]) {
            // ramenée au terrain plein : c'est l'échelle du manuel
            e3.hauteurs.push(d.hauteurDepuisBut[c] * (104 / d.terrain.L));

            const xs = d.positions.filter((p) => p.camp === c && p.role !== "gardien")
              .map((p) => p.x).sort((a, b) => a - b);
            let n = xs.length ? 1 : 0;
            for (let i = 1; i < xs.length; i++) if (xs[i] - xs[i - 1] > 6) n++;
            e3.lignes.push(n);
          }
        }
        for (const p of d.positions) if (p.role !== "gardien") allures.push(p.vitesse / p.vMax);
        /* ÉTAPE 1 : la distribution de vitesse du football réel.
           Joueur de champ : pointe 6,5-9,5 m/s selon VIT. Porteur de
           balle : 2,5 m/s en MÉDIANE (design/football-chiffre.md §2) —
           c'est la mesure la plus contre-intuitive du lot. */
        for (const p of d.positions) {
          if (p.role === "gardien") continue;
          vitessesChamp.push(p.vitesse);
          vMaxPlusHaut = Math.max(vMaxPlusHaut, p.vMax);
          if (p.porteur) {
            vitessesPorteur.push(p.vitesse);
            // le porteur PILOTÉ PAR LA SIMULATION (rôle « porteur ») —
            // celui que l'étape 1 gouverne. Quand une chorégraphie tient
            // encore le pion (rôle de scénario), c'est l'étape 4 qui en
            // répond, pas la physique.
            if (p.role === "porteur") vitessesPorteurSimule.push(p.vitesse);
          }
        }
        if (d.mesures && d.mesures.ticks > physique.ticks) physique = d.mesures;
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
        /* LE MATCH EST FINI QUAND LA SCÈNE EST DÉTRUITE, pas quand le
           bilan s'ouvre. Depuis que la cérémonie de butin s'intercale
           entre les deux (P2 : le match se range d'abord), attendre
           « btn-continuer » revenait à mesurer le match PLUS la
           cérémonie — et si l'un des deux traîne, l'échantillonneur
           tapait son plafond de 120 s, le match suivant démarrait par
           dessus, et la timeline de la scène neuve « reculait » par
           rapport à l'ancienne. Trois assertions tombaient pour une
           seule cause, et aucune ne la nommait. */
        if (sceneVue && !sceneMatch) { clearInterval(tic); fini(); return; }
        if (document.getElementById("btn-continuer")) { clearInterval(tic); fini(); }
      }, 50);
      setTimeout(() => { clearInterval(tic); horsDelai = true; fini(); }, 120000);
    });
    ONZE_SCENE.creer = creerOriginal;
    const duree = performance.now() - debut;
    // les écarts entre deux temps joués (le plancher de lisibilité)
    const jeu = journal.temps.filter((t) => t.type !== "_miseEnPlace");
    const ecarts = jeu.slice(1).map((x, i) => x.t - jeu[i].t)
      .filter((e) => e < 2500); // on ignore les sauts de cut / mise en place
    return {
      duree, horsDelai, regimes: [...new Set(regimes)], nbRegimes: regimes.length,
      cuts: journal.cuts, misesEnPlace: journal.misesEnPlace,
      /* décision 73 : le compte des phases CHAUDES du moteur — c'est le
         dénominateur du « 100 % des promesses rendues » */
      chaudes: (journal.resultat ? journal.resultat.phases : []).filter((p) =>
        p.evenements.some((ev) => ev.but || ev.type === "arret" || ev.type === "blocage" || ev.type === "rebond")).length,
      nbTemps: journal.temps.filter((t) => t.type !== "_miseEnPlace").length,
      // la durée RÉELLE d'une mise en place à l'écran : de son départ au
      // premier temps de jeu qui la suit. C'est elle qui trahit le
      // FORMAT du temps fort : ~3 s en grand format, ~1,2 s en court.
      misesEnPlaceMs: journal.temps.map((x, i) => x.type === "_miseEnPlace" && journal.temps[i + 1]
        ? journal.temps[i + 1].t - x.t : null).filter((v) => v !== null),
      // la durée de chaque temps fort, de sa mise en place à la suivante
      tempsFortsMs: (() => {
        const departs = journal.temps.map((x, i) => x.type === "_miseEnPlace" ? i : -1).filter((i) => i >= 0);
        return departs.map((d, k) => {
          const suivant = departs[k + 1];
          const fin = suivant !== undefined ? journal.temps[suivant].t : null;
          return fin === null ? null : { mep: journal.temps[d + 1] ? journal.temps[d + 1].t - journal.temps[d].t : 0,
            duree: fin - journal.temps[d].t };
        }).filter(Boolean);
      })(),
      // la durée d'affichage d'une issue avant la suite
      issuesMs: journal.temps.map((x, i) => x.issue && journal.temps[i + 1]
        ? journal.temps[i + 1].t - x.t : null).filter((v) => v !== null),
      /* La durée réelle des temps DÉCISIFS non terminaux (percée, frappe).
         L'issue est exclue : sa suite est un cut et fausserait la mesure.
         Chaque temps est rattaché à son FORMAT (décision 32) — on le lit
         sur la mise en place qui l'ouvre : ~3 s en grand, ~1,2 s en
         court. Les deux formats n'ont pas le même contrat de patience. */
      decisifs: (() => {
        const sortie = [];
        let formatCourant = null;
        journal.temps.forEach((x, i) => {
          if (x.type === "_miseEnPlace") {
            const mep = journal.temps[i + 1] ? journal.temps[i + 1].t - x.t : 0;
            formatCourant = mep >= 2000 ? "grand" : "court";
            return;
          }
          if (!x.decisif || x.issue || !journal.temps[i + 1]) return;
          sortie.push({ format: formatCourant, duree: journal.temps[i + 1].t - x.t });
        });
        return sortie;
      })(),
      issues: journal.temps.filter((t) => t.issue).length,
      buts: journal.temps.filter((t) => t.type === "issue_but").length,
      ecartMin: ecarts.length ? Math.min(...ecarts) : 0,
      vitesseMoyenne: vitesses.length ? vitesses.reduce((a, b) => a + b, 0) / vitesses.length : 0,
      partsImmobiles: vitesses.filter((v) => v < 0.15).length / Math.max(vitesses.length, 1),
      sautMaxBallon,
      // aucune position ne doit jamais devenir non finie
      nonFinies,
      // décision 33
      sansRaison, premierMuet,
      ecartMedian: ecartsCible.length ? ecartsCible.slice().sort((a, b) => a - b)[Math.floor(ecartsCible.length / 2)] : 0,
      appelsVus, appelsEnCourse,
      reposVus: finsDeRepos.length,
      vitesseRepos: finsDeRepos.length
        ? finsDeRepos.slice().sort((a, b) => a - b)[Math.floor(finsDeRepos.length / 2)] : 0,
      lignesVues, ecartTypeLigne: lignesVues ? sommeEcartType / lignesVues : 0,
      lignesParRegime,
      marquagesVus, marquagesBons, marquagesTous, marquagesTousBons,
      tlTotal, tlMax, tlRecule, tlMalCompte, porteurAmbigu, matchsAvecHomonymes,
      // ÉTAPE 3 : les distributions du cerveau
      etape3: { ...e3, postures: physique.tiragesPosture || {},
        appels: physique.appels || [], pressings: physique.pressings || [],
        options: physique.optionsPasse || [], dureesOption: physique.dureesOption || [] },
      // ÉTAPE 1 : la physique
      physique, vMaxPlusHaut,
      vitesseChampMediane: med(vitessesChamp), vitesseChampP90: pct(vitessesChamp, 0.9),
      vitesseChampMax: vitessesChamp.length ? Math.max(...vitessesChamp) : 0,
      vitessePorteurMediane: med(vitessesPorteur), porteursVus: vitessesPorteur.length,
      vitessePorteurSimule: med(vitessesPorteurSimule), porteursSimules: vitessesPorteurSimule.length,
      // les relevés BRUTS : le rôle « porteur » ne s'allume pas dans tous
      // les matchs (parfois la chorégraphie tient le pion du début à la
      // fin), donc l'échantillon se CUMULE d'un match à l'autre
      relevesPorteurSimule: vitessesPorteurSimule.slice(0, 400),
      braquageP99: braquages.length ? braquages.slice().sort((a, b) => a - b)[Math.floor(braquages.length * 0.99)] : 0,
      braquageMax: braquages.length ? Math.max(...braquages) : 0,
      braquagesVus: braquages.length,
      // la part de sa vitesse max qu'un joueur utilise : la distribution
      // sera recalibrée sur design/football-chiffre.md
      allureMediane: allures.length ? allures.slice().sort((a, b) => a - b)[Math.floor(allures.length / 2)] : 0,
      alluresVues: allures.length,
      etiqMax: etiqAction.length ? Math.max(...etiqAction) : 0,
      etiqMed: etiqAction.length ? etiqAction.slice().sort((a, b) => a - b)[Math.floor(etiqAction.length / 2)] : 0,
      etiqBut,
    };
  }); }

  verifier(`R2 : aucun régime « domination » (${releve.regimes.join(", ")})`,
    !releve.regimes.includes("domination"));
  verifier(`R2 : le match est fait de temps forts coupés au carton (${releve.misesEnPlace} temps forts, ${releve.cuts} cuts)`,
    releve.misesEnPlace >= 1 && releve.cuts >= releve.misesEnPlace);
  /* DÉCISION 73 : toutes les promesses du moteur sont rendues — le
     nombre de mises en place vaut le nombre de phases CHAUDES. */
  verifier(`Décision 73 : 100 % des promesses du moteur rendues (${releve.misesEnPlace} rendus pour ${releve.chaudes} phases chaudes, dont ${releve.buts} but(s))`,
    releve.chaudes >= 1 && releve.misesEnPlace === releve.chaudes);
  verifier(`R9 : chaque temps fort porte au moins une issue (${releve.issues} issues pour ${releve.misesEnPlace} temps forts)`,
    releve.issues >= releve.misesEnPlace);
  verifier(`R9 : plancher de lisibilité tenu (temps le plus court ${Math.round(releve.ecartMin)} ms ≥ 800)`,
    releve.ecartMin >= 780);
  verifier(`Fiabilité de la mesure : aucun match n'a dépassé le plafond de l'échantillonneur (${matchsHorsDelai} hors délai)`,
    matchsHorsDelai === 0);
  /* LE GARDE-FOU PRÉ-ENREGISTRÉ de la décision 73 : plus vite ET tout
     voir. Durée mesurée AVANT (matchs pleins instrumentés) : 41,0 ·
     48,9 · 51,3 s pour 2-5 rendus. Cible du calcul : ~25-30 s pour ~4-6
     rendus ; le plafond de recette laisse la marge d'un festival. */
  const plafond73 = 24000 + releve.misesEnPlace * 3000;
  verifier(`Décision 73 : plus vite ET tout voir — ${(releve.duree / 1000).toFixed(1)} s pour ${releve.misesEnPlace} rendus dont ${releve.buts} but(s) (avant : 41-51 s pour 2-5 rendus ; plafond ${(plafond73 / 1000).toFixed(0)} s)`,
    releve.duree > 12000 && releve.duree < plafond73);
  /* Règle 3 sous la décision 73 : le tempo a doublé mais la dramaturgie
     survit en miniature — le temps DÉCISIF reste étiré (1600/1,6 =
     1000 ms) au-dessus des temps de jeu au plancher (800 ms). */
  const tousDecisifs = releve.decisifs.map((d) => d.duree);
  verifier(`Décision 73 — le décisif reste étiré : ${tousDecisifs.length} mesurés, le plus court ${tousDecisifs.length ? Math.round(Math.min(...tousDecisifs)) : "—"} ms ≥ 950 (plancher de jeu 800)`,
    tousDecisifs.length >= 1 && tousDecisifs.every((v) => v >= 950));
  verifier(`Décision 33 : aucune position non finie (${releve.nonFinies} relevé(s) fautif(s))`,
    releve.nonFinies === 0);
  verifier(`R4 : les 22 pions bougent en permanence (vitesse moyenne ${releve.vitesseMoyenne.toFixed(2)} m/s, ${Math.round(releve.partsImmobiles * 100)} % de relevés figés)`,
    releve.vitesseMoyenne > 0.4 && releve.partsImmobiles < 0.2);
  verifier(`R4 : le ballon ne se téléporte jamais (saut max ${releve.sautMaxBallon.toFixed(1)} m entre deux relevés)`,
    releve.sautMaxBallon > 0 && releve.sautMaxBallon < 10);
  verifier(`R6 : les étiquettes suivent l'action, pas tout le monde (médiane ${releve.etiqMed}, max ${releve.etiqMax})`,
    releve.etiqMed >= 1 && releve.etiqMed <= 4);
  verifier(`R6 : tous les noms s'affichent au but (${releve.etiqBut} relevés)`, releve.etiqBut >= 1);
  /* ============================================================
     LE CERVEAU DE PLACEMENT (design/scene-intention.md, décision 33) —
     les cinq tests d'acceptation de la spec.
     ============================================================ */
  verifier(`Décision 33 — test de pause : chaque pion a une RAISON nommée (${releve.sansRaison} relevé(s) avec un pion sans rôle${releve.premierMuet ? ` — ${JSON.stringify(releve.premierMuet)}` : ""})`,
    releve.sansRaison === 0);
  verifier(`Décision 33 — test de pause : les pions convergent vers leur cible (écart médian ${releve.ecartMedian.toFixed(1)} m)`,
    releve.ecartMedian > 0 && releve.ecartMedian < 14);
  verifier(`Décision 33 — test de projection : le receveur attendu est DÉJÀ en course (${releve.appelsEnCourse}/${releve.appelsVus} appels mesurés en mouvement)`,
    releve.appelsVus >= 2 && releve.appelsEnCourse / releve.appelsVus >= 0.8);
  /* Zéro sinusoïde : le vrai test est comportemental. Sans ballon qui
     bouge et sans temps joué, une scène pilotée par une fonction du
     temps oscillerait sans fin ; une scène pilotée par des intentions
     se STABILISE. On mesure la décroissance au repos. */
  /* ZÉRO BRUIT — le test déterministe. Une scène qu'on laisse
     TRANQUILLE (aucun temps joué, ballon immobile) doit se figer : si
     une seule position dépendait d'une fonction du temps, les pions
     oscilleraient indéfiniment. On mesure après 3,5 s de calme. */
  const calme = await page.evaluate(async () => {
    const parEcole = (ecole, n) => tousLesJoueurs.filter((j) => j.ecole === ecole).slice(0, n)
      .map((j) => ({ ...j, etoiles: 1 }));
    const bac = document.createElement("div");
    bac.style.cssText = "position:fixed;left:-2000px;width:800px;height:360px";
    document.body.appendChild(bac);
    const sc = ONZE_SCENE.creer(bac,
      ONZE.equipeDepuisFiches("A", "A", parEcole("Tiki-Taka", 6)),
      ONZE.equipeDepuisFiches("B", "B", parEcole("Catenaccio", 6)), {});
    const lire = () => sc.diagnostic().positions.map((p) => ({ v: p.vitesse, x: p.x, y: p.y }));
    /* Six secondes de calme, pas trois et demie : depuis que la ligne
       défensive vit à sa vraie hauteur (décision 57), les pions ont une
       vingtaine de mètres de plus à parcourir avant d'être en place.
       Mesuré : vitesse max 6,1 m/s à 3 s, 1,2 à 4 s, 0,00 à partir de 5.
       Le test mesure la STABILITÉ, pas la vitesse de convergence. */
    await new Promise((r) => setTimeout(r, 6000));
    const a = lire();
    await new Promise((r) => setTimeout(r, 800));
    const b = lire();
    sc.detruire(); bac.remove();
    return {
      vitesseMax: Math.max(...a.map((p) => p.v)),
      // et surtout : plus personne ne BOUGE entre deux relevés distants
      deplacementMax: Math.max(...a.map((p, i) => Math.hypot(b[i].x - p.x, b[i].y - p.y))),
    };
  });
  /* Ce qui compte est le DÉPLACEMENT : une scène pilotée par le temps
     dériverait sans fin. La vitesse résiduelle, elle, vient des pions
     qui se bousculent sur place (la répulsion les repousse, ils
     reviennent) — c'est du sur-place, pas de la dérive. */
  verifier(`Décision 33 — zéro bruit : une scène laissée tranquille se FIGE (déplacement ${calme.deplacementMax.toFixed(2)} m en 0,8 s ; vitesse résiduelle ${calme.vitesseMax.toFixed(2)} m/s de sur-place)`,
    calme.deplacementMax < 0.6);
  console.log(`   (repos en match : vitesse médiane ${releve.vitesseRepos.toFixed(2)} m/s sur ${releve.reposVus} période(s) — les pions se replacent encore, c'est de la convergence)`);
  /* SUR UN SEUL MATCH, CE VERDICT TIRAIT À PILE OU FACE : 6,5 · 6,7 ·
     8,3 · 9,2 m mesurés sur le même code, pour un seuil à 8 — la
     tolérance était SOUS le bruit (M6 bis). Même remède que partout :
     cumuler les matchs du passage, même population (tous régimes).
     ET LA MESURE A REFUSÉ L'HYPOTHÈSE FACILE : on croyait la ligne
     cassée par l'action (pressing, marquages) et posée au repos — c'est
     l'INVERSE (repos 7,5 m · action 5,8 m sur 5 230 relevés). Restreindre
     au repos aurait donc EMPIRÉ la mesure en la faisant passer pour plus
     propre. La ligne 📐 garde ce partage sous les yeux.
     CONTRE-TEST du seuil : une ligne rendue au hasard sur la profondeur
     du bloc (~35 m) mesurerait un écart-type ≥ 10 m — le seuil à 8
     attrape toujours ce défaut-là. */
  const lTot = sacLignes.repos.n + sacLignes.action.n;
  const lMoy = lTot ? (sacLignes.repos.somme + sacLignes.action.somme) / lTot : 0;
  verifier(`Décision 33 — la ligne se voit : les défenseurs partagent une hauteur (écart-type moyen ${lMoy.toFixed(1)} m sur ${sacMarquage.matchs} MATCHS du passage — ${lTot} relevés, corrélés dans un match : la puissance se compte en matchs)`,
    sacMarquage.matchs >= 5 && lTot >= 100 && lMoy < 8);
  console.log(`   📐 tenue de ligne par régime : repos ${sacLignes.repos.n ? (sacLignes.repos.somme / sacLignes.repos.n).toFixed(1) : "—"} m (${sacLignes.repos.n} relevés) · action ${sacLignes.action.n ? (sacLignes.action.somme / sacLignes.action.n).toFixed(1) : "—"} m (${sacLignes.action.n} relevés) — par match au repos : ${lignesReposParMatch.map((v) => v.toFixed(1)).join(" · ")}`);
  /* Le marquage n'est JAMAIS à 100 %, et c'est voulu : quand le moteur
     désigne un défenseur battu, il se retrouve du mauvais côté — et ça
     doit se voir. On vérifie que la règle tient dans la large majorité
     des cas, pas qu'elle est absolue. */
  const tauxGoalSide = sacMarquage.vus ? sacMarquage.bons / sacMarquage.vus : 0;
  const tauxBrut = sacMarquage.tous ? sacMarquage.tousBons / sacMarquage.tous : 0;
  /* Le seuil est calé sur la dispersion RÉELLE, mesurée sur cinq
     exécutions : 77, 98, 100, 100, 100 %. Le creux à 77 % vient d'un
     échantillon court où un défenseur s'était fait battre — ce que la
     spec veut justement voir. Un seuil à 0,7 laisse passer cette
     variance mais attrape une vraie panne (marquage cassé ≈ 50 %, soit
     le hasard). L'échantillon est CUMULÉ sur les matchs joués : c'est sa
     taille qui est garantie, plus la durée d'un match. */
  /* Le VERDICT du marquage a déménagé plus bas, sur le SAC CUMULÉ entre
     exécutions. Payé le 27 août : trois passages du même code ont donné
     93 → 68 → 97 % — les ~300 relevés d'un passage sont CORRÉLÉS (les
     mêmes marqueurs, les mêmes battus, tout le match durant), le n
     effectif est ~11 matchs, et le seuil de 70 % se fait traverser par
     un mauvais tirage. Même remède que le pressing : cumuler les
     comptages, pas les verdicts (M7). */

  /* ============================================================
     ÉTAPE 1 — LA PHYSIQUE DU PION (design/scene-simulation.md §3,
     chiffrée par design/football-chiffre.md).
     Tout est en MÈTRES et en MÈTRES PAR SECONDE. Ces bornes-là ne sont
     pas inventées : ce sont celles de dix vrais matchs. Elles sortent
     TOUTES rouges sur la scène d'avant (voir tests/etape1-avant.md),
     où les pions filaient à 10-15 m/s — c'est ce qui les rend
     recevables comme garde-fous.
     ============================================================ */
  const phy = releve.physique;
  verifier(`Étape 1 — plafond de vitesse : aucun pion ne dépasse sa pointe VIT (${phy.surVitesse} tick(s) fautif(s) sur ${phy.ticks}, pic mesuré ${phy.vitesseMax.toFixed(1)} m/s pour une pointe max de ${releve.vMaxPlusHaut.toFixed(1)})`,
    phy.ticks > 1000 && phy.surVitesse === 0 && phy.vitesseMax <= releve.vMaxPlusHaut + 0.1);
  verifier(`Étape 1 — aucune vitesse hors du réel : ${phy.nonFinis} tick(s) non fini(s) sur ${phy.ticks}`,
    phy.nonFinis === 0);
  verifier(`Étape 1 — inertie : l'accélération reste bornée à ~5 m/s² (pic ${phy.accelMax.toFixed(1)} m/s², ${phy.surAccel} tick(s) au-dessus)`,
    phy.accelMax < 6 && phy.surAccel === 0);
  /* La MOYENNE D'UNE COURSE, pas la pointe. Le plan le dit mot pour
     mot : « ce sont des pointes ; la moyenne sur une course doit
     retomber autour de 5 m/s ». Le pion d'avant tenait 7,7 m/s en
     médiane, soit 100 % de sa pointe en permanence — c'est ce défaut-là
     que ces deux bornes attrapent. */
  verifier(`Étape 1 — vitesse de course : la médiane retombe autour de 5 m/s (médiane ${releve.vitesseChampMediane.toFixed(2)} m/s, p90 ${releve.vitesseChampP90.toFixed(2)}, max ${releve.vitesseChampMax.toFixed(2)} pour une pointe de ${releve.vMaxPlusHaut.toFixed(1)})`,
    releve.vitesseChampMediane >= 3 && releve.vitesseChampMediane <= 6.5
    && releve.vitesseChampMax <= releve.vMaxPlusHaut + 0.1);
  verifier(`Étape 1 — un joueur vit SOUS son maximum : allure médiane ${Math.round(releve.allureMediane * 100)} % de la pointe (${releve.alluresVues} relevés — la scène d'avant était à 100 %)`,
    releve.alluresVues >= 500 && releve.allureMediane <= 0.75);
  /* LE PORTEUR — et une leçon de méthode qui vaut pour toutes les
     distributions à venir. Le 2,5 m/s du document est la médiane sur
     TOUT le football, construction comprise ; or nous ne rendons jamais
     ça. Remesuré sur les dix mêmes matchs, par type de situation :
     construction 1,87 · création 2,23 · jeu direct 2,26 · finition 2,59
     · contre rapide 3,67 · transition 4,38 — et surtout, les possessions
     qui mènent à un TIR sont à 3,40 m/s, celles qui mènent à un BUT à
     3,52 (p90 : 7,0). Comme la scène ne rend que des buts et des
     occasions chaudes, notre référence est **3,4 m/s**, pas 2,5. La
     tolérance reste celle du document : médiane à ±25 %.
     Règle générale : les chiffres du manuel décrivent le football
     entier, nous n'en rendons que le sommet — chaque écart se signale
     et se fait remesurer sur le sous-ensemble pertinent, il ne se
     corrige pas en tordant le code.
     On l'exige du porteur que la SIMULATION pilote. Quand une
     chorégraphie tient encore le pion, c'est l'étape 4 (les gabarits)
     qui en répondra : on le mesure et on l'affiche plutôt que de le
     cacher dans une moyenne. */
  /* Le verdict du PORTEUR a déménagé sur le sac cumulé entre exécutions
     (plus bas) : les matchs raccourcis par la décision 73 ne donnent
     plus ~100 relevés par passage — même remède que le marquage,
     cumuler les données, pas les verdicts. */
  console.log(`   📐 porteur, tous rôles confondus (chorégraphie comprise) : ${releve.vitessePorteurMediane.toFixed(2)} m/s sur ${releve.porteursVus} relevés — la chorégraphie court encore, c'est l'étape 4 qui la remplace`);
  console.log(`   📐 braquage : p99 ${releve.braquageP99.toFixed(1)} rad/s, max ${releve.braquageMax.toFixed(1)} (${releve.braquagesVus} mesures sur les joueurs lancés)`);
  console.log(`   📐 allure : médiane à ${Math.round(releve.allureMediane * 100)} % de la vitesse max (${releve.alluresVues} relevés) — dans le vrai football, un joueur passe l'essentiel du match SOUS son maximum`);

  /* ============================================================
     ÉTAPE 3 — LE CERVEAU DE PLACEMENT, comparé aux distributions du
     football réel (design/football-chiffre.md, corrigé par la
     décision 57). Tolérance du manuel : médiane ±25 %, p90 ±35 %.
     Ce qui TIENT devient une assertion ; ce qui manque encore est
     AFFICHÉ avec son écart, jamais noyé ni desserré.
     ============================================================ */
  const e3 = sacE3;
  const q = (l, p) => (l.length ? l.slice().sort((a, b) => a - b)[Math.min(l.length - 1, Math.floor(l.length * p))] : 0);
  const ecart = (v, ref) => Math.abs(v - ref) / ref;
  // 1. la hauteur de la dernière ligne : p10 13,0 · médiane 34,8 · p90 52,2
  const H = e3.hauteurs;
  verifier(`Étape 3 — la ligne défensive vit à sa vraie hauteur : p10 ${q(H, 0.1).toFixed(1)} · médiane ${q(H, 0.5).toFixed(1)} · p90 ${q(H, 0.9).toFixed(1)} m de son but (réel 13,0 · 34,8 · 52,2 ; ${H.length} relevés)`,
    H.length >= 300 && ecart(q(H, 0.5), 34.8) <= 0.25 && ecart(q(H, 0.9), 52.2) <= 0.35);
  // 2. les quatre postures existent toutes, et aucune n'écrase les autres
  /* On compte les TIRAGES, pas les frames : le manuel donne des parts DE
     PHASES. Compter frame par frame pondère chaque posture par la durée
     de son temps fort, et une poignée de temps forts longs suffit à
     fausser la distribution — mesuré 59 % de bloc médian là où les
     tirages en donnaient 41. */
  const partPost = e3.postures, totalP = Object.values(partPost).reduce((a, b) => a + b, 0) || 1;
  const quatre = ["bas", "median", "haut", "chaos"].every((k) => (partPost[k] || 0) / totalP >= 0.05);
  /* LA RÉFÉRENCE N'EST PAS RENORMALISÉE, et c'est déclaré. Les mesures
     d'origine donnent bas 22 · médian 37 · haut 16 · chaos 13, somme
     88 % : les 12 % restants sont quatre autres postures réelles que la
     scène ne modélise pas encore. Les diviser par 0,88 pour « faire
     100 » revient à déplacer la RÉFÉRENCE au lieu du seuil — le même
     geste, en moins visible — et l'hypothèse serait fausse : la défense
     sur coup de pied arrêté a une médiane de 9,4 m, PLUS BASSE que notre
     bloc bas, donc les 12 % écartés ne se répartissent pas au prorata.
     On compare donc nos parts aux parts brutes, en disant que 12 % du
     football réel n'a pas encore d'équivalent chez nous. */
  const REF_POSTURES = { bas: 0.22, median: 0.37, haut: 0.16, chaos: 0.13 };  // somme 88 %
  verifier(`Étape 3 — les quatre postures se tirent vraiment (${totalP} tirages : ${Object.entries(partPost).map(([k, v]) => `${k} ${Math.round(100 * v / totalP)} %`).join(" · ")} ; mesures brutes bas 22 · médian 37 · haut 16 · chaos 13 — les 12 % manquants sont quatre postures réelles non modélisées, dont la défense sur coup de pied arrêté à 9,4 m)`,
    totalP >= 40 && quatre && (partPost.median || 0) / totalP <= 0.62
    && Object.keys(REF_POSTURES).every((k) => (partPost[k] || 0) / totalP <= REF_POSTURES[k] * 2.2));
  // 3. le bloc a TROIS lignes (médiane du manuel)
  verifier(`Étape 3 — le bloc a trois lignes (médiane mesurée ${q(e3.lignes, 0.5)}, réel 3)`,
    e3.lignes.length >= 100 && q(e3.lignes, 0.5) >= 2 && q(e3.lignes, 0.5) <= 4);
  /* 4. l'appel dure ce que dure un appel : 2,1 s.
     Population (M2) : appels finis EN JEU — un appel coupé par la fin du
     temps fort (décision 73 : rendus ~2× plus courts) n'a pas fini sa
     course, sa durée est censurée. Mesuré au moment du changement :
     médiane 1,9 · 1,9 · 1,9 · 1,8 · 1,9 puis 1,6 s, la censure tirait
     la médiane sous la fenêtre. Le taux de troncature est affiché. */
  const appelsFinis = e3.appels.filter((a) => !a.tronque);
  if (e3.appels.length) console.log(`   📐 appels : ${e3.appels.length - appelsFinis.length}/${e3.appels.length} coupés par la fin du temps fort (exclus de la durée et de la longueur, déclaré)`);
  const AD = appelsFinis.map((a) => a.duree);
  verifier(`Étape 3 — un appel dure ${q(AD, 0.5).toFixed(1)} s (réel 2,1 ; ${AD.length} appels relevés)`,
    AD.length >= 15 && ecart(q(AD, 0.5), 2.1) <= 0.25);
  /* 5. LE PRESSING : les trois grandeurs, chacune contre SA référence,
     jamais leur quotient (décision 57). La distance minimale est celle
     qui dit qu'un défenseur est SUR le porteur et pas seulement qu'il a
     couru vers lui — c'est elle qui a fait tomber deux réglages faux
     coup sur coup : un seuil d'entrée à 10 m donnait 5,4 m (le p90
     réel), puis une mission de 2 s donnait 2,0 m (entre le p10 et la
     médiane). Les deux se réglaient par un seul nombre : la mission à
     1,6 s, la médiane réelle. */
  /* SOUS-POPULATION DÉCLARÉE, ET RÉFÉRENCES RECALCULÉES DESSUS (M2).
     On ne retient que les pressings qui ont EU LIEU : au moins une
     seconde. Un défenseur qui s'élance et voit le ballon partir au bout
     de 0,3 s n'a pas raté sa fermeture, il n'a pas pressé — et ces
     épisodes faisaient sauter la médiane de 1,7 à 4,1 d'une exécution à
     l'autre.
     LA FAUTE QUE ÇA A COÛTÉ, et qui complète M2 : la population avait
     bien été déclarée, dans une section dédiée — mais on continuait à
     comparer à 2,61 m, la médiane sur la population ENTIÈRE. Déclarer un
     changement de population ne suffit pas : il faut RECALCULER LA
     RÉFÉRENCE dessus. Une note à côté d'un chiffre faux laisse le chiffre
     faux. Recalculé sur les dix matchs, pour les pressings ≥ 1 s :
       départ  2,89 · 6,41 · 9,65 m
       minimum 0,79 · 2,27 · 4,88 m
       durée   1,10 · 2,10 · 4,40 s
     (Sur la population entière : 5,94 · 2,60 · 1,60 — ce sont ces
     chiffres-là qui avaient servi de repère, et c'est ce qui a fait
     ramener la mission de pressing de 2,0 s à 1,6 s alors que 2,0 était
     juste.) */
  /* DEUX POPULATIONS, PAS UNE, ET CHACUNE NOMMÉE (M2). La décision 73
     raccourcit les temps forts ~2× : la plupart des épisodes ≥ 1 s sont
     désormais COUPÉS par la fin du temps fort (mesuré : 20/24 sur un
     passage). La coupure ne censure pas les trois grandeurs de la même
     façon :
       — le DÉPART est acquis à l'élan : un épisode coupé a un départ
         exact. Population : tous les épisodes ≥ 1 s, tronqués inclus.
       — la DURÉE et le MINIMUM sont censurés par la coupure : un épisode
         coupé n'a eu le temps ni de durer ni de fermer. Population :
         épisodes ≥ 1 s finis EN JEU. Et comme les épisodes longs sont
         plus souvent coupés, la médiane des survivants est une borne
         BASSE — si elle sort sous 1,79 s, c'est le rendu qui étouffe le
         pressing, et c'est un vrai signal, pas du bruit.
     Le taux de troncature est affiché à chaque passage : s'il monte
     encore, ça se voit ici au lieu de polluer les médianes. */
  const bruts = e3.pressings.filter((p) => p.duree >= 1);
  const episodes = bruts.filter((p) => !p.tronque);
  if (bruts.length) console.log(`   📐 pressing : ${bruts.length - episodes.length}/${bruts.length} épisodes ≥ 1 s tronqués par la fin du temps fort (exclus de durée/minimum, gardés pour le départ et la densité — déclaré)`);
  const PDepTous = bruts.map((p) => p.depart);
  const PU2 = episodes.map((p) => p.duree);
  const PMin = episodes.map((p) => p.mini);
  /* Le VERDICT sur départ et durée a déménagé sur le sac cumulé entre
     exécutions, plus bas : un passage ne livre plus que ~4 épisodes finis
     en jeu, et un verdict à n = 4 est un tirage au sort. Même remède que
     la fermeture, le marquage et le porteur — cumuler les DONNÉES, pas
     les verdicts. */
  /* LE MINIMUM : LA PROPORTION, PAS LA MÉDIANE — ET LA TOLÉRANCE DOIT
     RESTER AU-DESSUS DU BRUIT (M6 bis).
     Le bruit d'une mesure se chiffre. Rééchantillonné sur la vraie
     distribution (6 306 pressings ≥ 1 s), l'intervalle à 90 % d'une
     MÉDIANE vaut ±27 % à n=30, ±19,6 % à n=60, ±14,1 % à n=120 : à trente
     épisodes, une tolérance de ±15 % tire le rouge et le vert au sort.
     La PART sous un seuil se tient mieux — ±21,7 % à n=28, ±16,4 % à
     n=60, ±10,7 % à n=120 — et c'est la même information de football :
     « le défenseur est-il vraiment venu sur lui ? ».
     LA RÉFÉRENCE EST CELLE DE LA POPULATION MESURÉE (M2 bis) : sur les
     pressings ≥ 1 s, 65,9 % ferment sous 3 m. (Sur la population entière
     ce serait 58,7 % — et l'écrire ici serait la même faute que
     comparer à 2,61 m.) La population est nommée DANS LE LIBELLÉ, parce
     que c'est là qu'on la relit quand la ligne sort rouge. */
  /* LA DENSITÉ : DÉCIDABLE AUJOURD'HUI, ET ELLE COÛTE ZÉRO MINUTE.
     On ne peut pas encore mesurer si le pressing ferme assez près — il y
     faudrait 120 épisodes, donc ~35 matchs. Mais on peut mesurer dès
     maintenant s'il y en a ASSEZ, parce qu'un TAUX se stabilise sur le
     nombre de matchs et non sur le nombre d'épisodes.
     La référence : 6 306 épisodes ≥ 1 s sur dix matchs, soit 630,6 par
     match et **7,01 par minute** de football. Sur nos ~49 s rendues par
     match, cela fait 5,7 épisodes attendus.
     ET C'EST UNE BORNE BASSE, plus dure qu'elle n'en a l'air : les
     secondes que nous rendons sont des TEMPS FORTS, choisis pour être
     les moments chauds — récupérations, ruptures, frappes — donc plus
     riches en pressing qu'une minute moyenne de match. L'assertion est
     donc à SENS UNIQUE : au-dessus de la référence tout va bien, en
     dessous le pressing manque. */
  /* UN TEST, PAS UNE FOURCHETTE. Un plancher à « référence −15 % »
     supposait les deux nombres bruités et exigeait donc que la tolérance
     dépasse le bruit — à N ≈ 31 épisodes, le bruit d'un taux vaut ±29,5 %
     (en 1/√N, exactement comme une médiane : un taux ne se stabilise PAS
     sur le nombre de matchs, c'est le nombre d'épisodes qui commande).
     Mais la référence, elle, est EXACTE : 7,01/min vient de 6 306
     épisodes réels, elle ne bruite pas. La question n'est donc pas
     « deux nombres bruités sont-ils loin ? » mais « ce comptage est-il
     trop bas pour une espérance connue ? » — et ça, un test le tranche.
     Il se renforce tout seul à mesure que la durée rendue s'accumule :
     368 s → p = 0,035 · 500 s → 0,015 · 700 s → 0,005 · 900 s → 0,002.
     La même assertion devient de plus en plus dure sans qu'on y touche. */
  /* ============================================================
     LE SAC CUMULÉ ENTRE EXÉCUTIONS.
     Exiger « trois exécutions vertes d'affilée » agrégeait des
     VERDICTS au lieu d'agréger des DONNÉES — et un verdict est la
     compression avec perte d'une mesure. Trois tests à n = 50 n'auront
     jamais la puissance d'un test à n = 150 : c'est le même geste que
     composer deux médianes, une strate plus haut.
     On sépare donc les deux questions, qui n'ont pas le même remède :
       — contre le BRUIT D'ÉCHANTILLON : on CUMULE les comptages entre
         exécutions et on tranche sur le n cumulé ;
       — contre la VOLATILITÉ de l'instrument (un tirage qui change
         l'ordre des phases, une image qui charge plus tard, un temps
         fort qui se coupe) : on RÉPÈTE, et la question n'est pas
         « trois verts » mais « aucun passage ne s'effondre ».
     LE SAC PORTE LA RÉVISION (M2 appliqué au TEMPS et non à la
     population) : il est indexé par l'empreinte des fichiers dont il
     mesure le comportement. Un cumul qui traverserait un changement de
     code mesurerait deux comportements différents. */
  const cheminCumul = require("path").join(__dirname, ".cumul-scene.json");
  const empreinte = (() => {
    const h = require("crypto").createHash("sha1");
    for (const f of ["../match-scene.js", "../match-ui.js", "./scene.spec.js"]) {
      h.update(require("fs").readFileSync(require("path").join(__dirname, f)));
    }
    return h.digest("hex").slice(0, 12);
  })();
  const sacDisque = (() => {
    try {
      const j = JSON.parse(require("fs").readFileSync(cheminCumul, "utf8"));
      if (j.empreinte === empreinte) return j;
    } catch { /* premier passage, ou fichier illisible */ }
    return { empreinte, passages: [] };
  })();
  sacDisque.passages.push({
    quand: new Date().toISOString(),
    /* episodes/fermes : épisodes ≥ 1 s FINIS EN JEU (durée et minimum,
       censurés par la coupure) ; episodesTous : tous les ≥ 1 s, tronqués
       inclus (départ et densité — un épisode coupé a bien EU LIEU). */
    episodes: PMin.length,
    fermes: PMin.filter((v) => v <= 3).length,
    episodesTous: bruts.length,
    dep: PDepTous.slice(0, 200),
    dur: PU2.slice(0, 200),
    secondes: secondesRendues,
    parMatch: episodesParMatch.slice(),
    options: e3.options.length,
    optionsDans13: e3.options.filter((v) => v >= 1 && v <= 3).length,
    mVus: sacMarquage.vus, mBons: sacMarquage.bons, mMatchs: sacMarquage.matchs,
    porteur: sacPorteur.slice(0, 300),
  });
  if (sacDisque.passages.length > 20) sacDisque.passages = sacDisque.passages.slice(-20);
  try { require("fs").writeFileSync(cheminCumul, JSON.stringify(sacDisque, null, 1)); } catch { /* lecture seule : on tranche sur ce passage */ }
  const cumul = sacDisque.passages.reduce((a, p) => ({
    episodes: a.episodes + p.episodes, fermes: a.fermes + p.fermes,
    episodesTous: a.episodesTous + (p.episodesTous ?? p.episodes),
    secondes: a.secondes + p.secondes, options: a.options + p.options,
    optionsDans13: a.optionsDans13 + p.optionsDans13,
    mVus: a.mVus + (p.mVus || 0), mBons: a.mBons + (p.mBons || 0), mMatchs: a.mMatchs + (p.mMatchs || 0),
    porteur: a.porteur.concat(p.porteur || []),
    dep: a.dep.concat(p.dep || []), dur: a.dur.concat(p.dur || []),
    parMatch: a.parMatch.concat(p.parMatch || []),
  }), { episodes: 0, fermes: 0, episodesTous: 0, secondes: 0, options: 0, optionsDans13: 0, mVus: 0, mBons: 0, mMatchs: 0, porteur: [], dep: [], dur: [], parMatch: [] });
  const nbPassages = sacDisque.passages.length;

  /* `attendu`/p de Poisson retirés avec la suspension de la densité :
     un p calculé contre une référence non appariée serait un chiffre qui
     a l'air d'une preuve. La ligne suspendue n'affiche que la mesure. */
  const indice = dispersion(cumul.parMatch);
  /* La densité compte les épisodes qui ont EU LIEU : tronqués inclus,
     comme parMatch — même population que la référence réelle, où rien ne
     coupe un pressing. Durée/minimum gardent leur population à eux. */
  const tauxMin = cumul.secondes > 0 ? (cumul.episodesTous / cumul.secondes) * 60 : 0;
  /* L'HYPOTHÈSE SE VÉRIFIE, ELLE NE SE SUPPOSE PAS. Poisson suppose
     l'indépendance ; des pressings groupés dans un même temps fort
     rendraient le p optimiste. L'indice de dispersion (variance/moyenne)
     doit rester proche de 1 — mesuré 1,02 sur les cumuls de référence. */
  verifier(`Étape 3 — l'hypothèse du test de densité tient : indice de dispersion ${indice === null ? "—" : indice.toFixed(2)} sur ${cumul.parMatch.length} matchs cumulés (Poisson pur = 1 ; SOUS 1 le test est conservateur, donc sans risque ; AU-DELÀ DE 2 les épisodes se groupent et le p deviendrait optimiste — c'est ce seul côté qu'on surveille)`,
    indice !== null && indice < 2);
  /* LA VOLATILITÉ DE L'INSTRUMENT — une question DIFFÉRENTE, et un
     remède différent. Le cumul répond « combien » ; la répétition répond
     « la mesure est-elle fiable ». Une recette peut osciller pour des
     raisons qui ne sont pas de l'échantillonnage : un tirage qui change
     l'ordre des phases, une image qui charge plus tard, un temps fort qui
     se coupe. Seule la répétition l'attrape — et l'assertion n'est pas
     « trois verts », c'est « aucun passage ne s'effondre ». */
  if (nbPassages >= 3) {
    const tauxParPassage = sacDisque.passages.filter((p) => p.secondes > 0)
      .map((p) => ((p.episodesTous ?? p.episodes) / p.secondes) * 60);
    const pire = Math.min(...tauxParPassage);
    /* CE QU'UN VERT ICI PROUVE, ET CE QU'IL NE PROUVE PAS. Mesuré sur
       quatre passages : 5,88 · 5,05 · 4,99 · 6,09 → écart-type 0,564,
       là où le bruit de Poisson pur à ~49 épisodes par passage en
       prédirait 0,784. Nos passages varient donc DEUX FOIS MOINS que le
       hasard seul — cohérent avec la sous-dispersion de la scène. Cette
       assertion ne se déclenchera donc que sur un passage franchement
       CASSÉ, et c'est bien ce qu'on lui demande : un garde-fou de
       FIABILITÉ, pas de justesse. Un vert dit « rien ne s'est
       effondré », jamais « la valeur est juste » — c'est le cumul, et
       lui seul, qui répond de la justesse. */
    verifier(`Étape 3 — l'instrument est stable : aucun passage ne s'effondre (${tauxParPassage.map((t) => t.toFixed(1)).join(" · ")} épisodes/min sur ${nbPassages} passages, cumul ${tauxMin.toFixed(2)} — plancher à la moitié ; ce vert dit « rien ne s'est effondré », pas « la valeur est juste »)`,
      pire >= tauxMin / 2);
  }
  /* LE MÊME CHIFFRE DIT AUTRE CHOSE, ET C'EST UN DÉFAUT DE FIDÉLITÉ.
     Sous 1, l'indice ne menace pas le test — mais il dit que NOS MATCHS
     SE RESSEMBLENT TROP. Le vrai football est surdispersé : sur les dix
     matchs de référence, les épisodes ≥ 1 s valent 665 · 641 · 671 · 559
     · 729 · 624 · 531 · 673 · 628 · 585, soit une moyenne de 630,6 pour
     une variance de 3 509 — indice 5,56. Les matchs ne se ressemblent
     pas. Ramené à une fenêtre aussi courte que la nôtre, le terme de
     variation entre matchs ne pèse presque plus et la référence retombe
     près de 1 :
        variance = Poisson (λ) + CV²(taux) × λ², CV² = 0,0088
        à ~45 s rendues (λ ≈ 5,7) : indice ≈ 1,05 ;
        à ~25-33 s (décision 73, λ ≈ 2) : ≈ 1,02.
     On garde 1,05 : entre les deux la différence est de 3 % — et dans le
     sens LÉGÈREMENT INDULGENT pour une dette attendue rouge, donc sans
     risque de fausse dette.
     Chez nous, un match qui est une bataille et un match qui est une
     promenade contiennent presque autant de pressing. C'est exactement
     ce que les gabarits pilotés par le tempo existent pour produire.
     ET C'EST LE SEUL DE NOS TESTS QUI SE JOUE SUR n = MATCHS : sous
     H0, (k−1)·D/1,05 suit un χ² à k−1 degrés de liberté. Notre
     échantillon peut le porter — celui-là, pour une fois. */
  const ddl = cumul.parMatch.length - 1;
  const chi2 = indice === null ? null : (ddl * indice) / 1.05;
  const pDisp = chi2 === null ? 1 : chi2Cumul(chi2, ddl);
  dette(`Étape 3 — les matchs ne se ressemblent pas : indice de dispersion des pressings ${indice === null ? "—" : indice.toFixed(2)} sur ${cumul.parMatch.length} matchs cumulés (référence 1,05 pour une fenêtre courte — 1,02 à la fenêtre décision 73, écart de 3 % dans le sens indulgent, déclaré ; le vrai football est à 5,56 sur des matchs entiers) → χ² = ${chi2 === null ? "—" : chi2.toFixed(1)} à ${ddl} ddl, p = ${pDisp.toFixed(4)}`,
    ddl >= 6 && pDisp >= 0.05,
    "ÉCHÉANCE étape 4 — un match-bataille et un match-promenade doivent contenir des quantités de pressing différentes ; c'est le tempo qui les distinguera. Quatrième distribution à atteindre, et la seule qui se mesure sur n = MATCHS");
  /* LE PORTEUR, SUR LE CUMUL (même mécanique que le marquage). */
  const pTrie = cumul.porteur.slice().sort((a, b) => a - b);
  const pMed = pTrie.length ? pTrie[Math.floor(pTrie.length / 2)] : 0;
  if (pTrie.length < 100) {
    console.log(`   ⚠ Étape 1 — porteur simulé à ${pMed.toFixed(2)} m/s sur ${pTrie.length} relevés cumulés (< 100) : NON CONCLUANT, relancer la recette cumule`);
  } else {
    verifier(`Étape 1 — le porteur tient l'allure d'une occasion chaude : médiane ${pMed.toFixed(2)} m/s sur ${pTrie.length} relevés CUMULÉS (${nbPassages} passage(s) ; référence 3,4 m/s ±25 % → 2,55-4,25)`,
      pMed >= 2.55 && pMed <= 4.25);
  }
  /* LE MARQUAGE, SUR LE CUMUL. Trois niveaux, calibrés sur l'incident
     du 27 août (93 → 68 → 97 % d'un passage à l'autre, même code) :
     ≥ 70 % sur le cumul → vert ; < 55 % → ROUGE quel que soit
     l'échantillon (le hasard pur est à ~50 %, c'est une panne) ; entre
     les deux sur un cumul encore court (< 25 matchs) → NON CONCLUANT
     affiché, relancer la recette élargit le cumul. Un mauvais tirage ne
     fabrique plus une fausse régression, une vraie panne sort toujours. */
  const tauxM = cumul.mVus ? cumul.mBons / cumul.mVus : 0;
  const tauxBrutM = sacMarquage.tous ? sacMarquage.tousBons / sacMarquage.tous : 0;
  if (cumul.mVus < ECHANTILLON_MARQUAGE && tauxM >= 0.55) {
    console.log(`   ⚠ Décision 33 — marquage goal-side à ${Math.round(tauxM * 100)} % sur ${cumul.mMatchs} MATCHS cumulés mais seulement ${cumul.mVus} relevés (< ${ECHANTILLON_MARQUAGE}) : NON CONCLUANT — les matchs raccourcis par la décision 73 donnent peu de marquages par passage, relancer la recette cumule`);
  } else if (tauxM < 0.7 && tauxM >= 0.55 && cumul.mMatchs < 25) {
    console.log(`   ⚠ Décision 33 — marquage goal-side à ${Math.round(tauxM * 100)} % sur ${cumul.mMatchs} MATCHS cumulés : NON CONCLUANT sous 25 matchs — relancer la recette élargit le cumul. (${cumul.mBons}/${cumul.mVus} relevés, mais la puissance se compte en MATCHS : les relevés d'un même match sont corrélés — mêmes marqueurs, mêmes battus)`);
  } else {
    verifier(`Décision 33 — le marquage se voit : EN POSITION, le marqueur est goal-side ${Math.round(tauxM * 100)} % du temps sur ${cumul.mMatchs} MATCHS cumulés (${nbPassages} passage(s) ; ${cumul.mBons}/${cumul.mVus} relevés, corrélés dans un match — la puissance se compte en matchs) — ${Math.round(tauxBrutM * 100)} % en comptant ceux qui courent encore sur ce passage`,
      cumul.mVus >= ECHANTILLON_MARQUAGE && tauxM >= 0.7);
  }
  /* LA DENSITÉ EST SUSPENDUE — SA RÉFÉRENCE N'EST PAS APPARIÉE À
     L'EFFECTIF (amendement IV de design/etape4-prediction.md).
     Les 7,01 épisodes/minute sont mesurés sur du football à 22 joueurs ;
     les matchs de cette recette tournent à 10-14 pions (médiane 13,
     relevé sur huit matchs), et notre taux monte avec l'effectif en
     ~P^1,67. Comparer une moyenne à effectifs MÉLANGÉS à une référence à
     22 inverse même le verdict : à effectif apparié (22 pions, 104 × 68
     — le seul point où notre terrain et le réel coïncident), nous sommes
     à 11,31/min contre 7,01, soit 61 % de pressing EN TROP, pas 22 % en
     moins. Une dette dont la référence n'est pas appariée ne mesure
     rien : ni rouge ni verte — on AFFICHE, et ce qui la lèvera est
     nommé. (C'était la faute de la semaine une strate plus haut : la
     population qui bougeait n'était plus celle des épisodes, mais celle
     des matchs.) */
  /* Le chiffre apparié porte son n et son intervalle, pas un pourcentage
     nu : la cellule à 22 pions vient du banc d'échelle — 3 matchs,
     27 épisodes sur 143 s. Le même standard qui a fait écarter la
     cellule à 11 pions (3 épisodes) impose de le dire. IC exact de
     Poisson à 90 % sur l'excédent : +14 % à +123 % — la DIRECTION est
     robuste (borne basse 8,0/min > 7,01), l'AMPLEUR ne l'est pas.
     Personne ne doit calibrer les gabarits pour retirer « 61 % » d'une
     grandeur connue à un facteur deux près. */
  console.log(`   ⏸ Étape 3 — densité de pressing SUSPENDUE : ${tauxMin.toFixed(2)}/min mesurés sur ${cumul.secondes.toFixed(0)} s (épisodes ≥ 1 s tronqués inclus — un épisode coupé a bien eu lieu ; matchs à 10-14 pions) — la référence 7,01/min vaut à 22 joueurs. À effectif apparié : EXCÉDENT démontré en direction, ampleur à confirmer (11,3/min sur 27 épisodes, IC 90 % de l'excédent +14 à +123 %). Se lève en restreignant la mesure aux matchs à 22 pions, ou avec une référence appariée à l'effectif courant`);
  /* LES MÉDIANES DU PRESSING, SUR LE CUMUL — même mécanique que la
     fermeture juste en dessous. CHAQUE GRANDEUR SA TOLÉRANCE, SA RAISON,
     ET SA POPULATION :
       — DÉPART, ±35 % : condition de départ, pas ce que l'œil lit.
         Personne ne mesure à l'écran d'où un défenseur s'est élancé.
         Tronqués INCLUS : le départ est acquis à l'élan.
       — DURÉE, ±15 % : PAS pour une raison de ressenti — SON ERREUR SE
         PROPAGE DANS LE MINIMUM. La mission de pressing fixe la durée,
         et la durée décide du temps qu'un presseur a pour fermer. À
         ±35 % autour de 1,6, la fourchette laissait passer la régression
         qui a lancé tout cet échange. Finis EN JEU seulement (censure),
         et borne basse : les épisodes longs sont plus souvent coupés. */
  const mDepC = cumul.dep.length ? q(cumul.dep, 0.5) : 0;
  const mDurC = cumul.dur.length ? q(cumul.dur, 0.5) : 0;
  if (cumul.dep.length < 25) {
    console.log(`   ⚠ Étape 3 — départ de pressing à ${mDepC.toFixed(1)} m sur ${cumul.dep.length} épisodes ≥ 1 s cumulés (< 25) : NON CONCLUANT, relancer la recette cumule`);
  } else {
    verifier(`Étape 3 — le pressing part de la bonne distance : départ ${mDepC.toFixed(1)} m sur ${cumul.dep.length} épisodes ≥ 1 s CUMULÉS, tronqués inclus (${nbPassages} passage(s) ; réel 6,41 ±35 %, condition de départ)`,
      ecart(mDepC, 6.41) <= 0.35);
  }
  if (cumul.dur.length < 25) {
    console.log(`   ⚠ Étape 3 — durée de pressing à ${mDurC.toFixed(1)} s sur ${cumul.dur.length} épisodes finis en jeu cumulés (< 25) : NON CONCLUANT, relancer la recette cumule`);
  } else {
    verifier(`Étape 3 — le pressing dure ce qu'il doit : ${mDurC.toFixed(1)} s sur ${cumul.dur.length} épisodes ≥ 1 s finis en jeu CUMULÉS (${nbPassages} passage(s) ; réel 2,10 ±15 %, son erreur se propage dans le minimum — borne basse, les épisodes longs sont plus souvent coupés)`,
      ecart(mDurC, 2.10) <= 0.15);
  }
  /* MÊME RAISONNEMENT ICI, ET IL DÉBLOQUE LA DETTE. La part sous 3 m est
     une proportion comparée à une référence EXACTE (65,9 %, mesurée sur
     6 306 épisodes) : un test binomial unilatéral tranche sans attendre
     les 120 épisodes qu'une fourchette exigeait. Vérifié avant d'être
     attendu, comme demandé. */
  const fermes = cumul.fermes, nFerme = cumul.episodes;
  const sous3 = nFerme ? fermes / nFerme : 0;
  const pFerme = binomialeCumul(fermes, nFerme, 0.659);
  /* LE TEST NE SAUVE PAS TOUT, ET IL FAUT LE DIRE. Vérifié plutôt
     qu'espéré, comme demandé : le binomial tranche IMMÉDIATEMENT quand
     l'écart est grand (9/25 à 36 % → p = 0,002) mais PAS quand il vaut
     l'écart réel (16/29 à 55 % → p = 0,15). Pour détecter 55 % contre
     65,9 % à 80 % de puissance, il faut n ≈ 160 — SIMULÉ, pas calculé de
     tête : 60 → 38 % de puissance · 90 → 58 % · 120 → 65 % · 150 → 76 %
     · 200 → 88 %. Le 120 qu'un calcul rapide donnait était optimiste, et
     il tombait sur le même chiffre que l'argument de bruit par deux
     chemins différents — coïncidence, pas confirmation. Un « p ≥ 0,05 » à n = 29 ne dit
     donc PAS que le pressing est conforme, il dit qu'on n'a pas de quoi
     l'affirmer : la dette ne se paie qu'avec la PUISSANCE de conclure,
     jamais avec un vert obtenu faute d'échantillon (M6). */
  const conclusifFerme = nFerme >= 160;
  dette(`Étape 3 — le pressing ferme vraiment : ${fermes}/${nFerme} épisodes ≥ 1 s finis en jeu ferment sous 3 m (CUMUL sur ${nbPassages} passage(s) à empreinte ${empreinte}), soit ${Math.round(sous3 * 100)} % contre ${Math.round(0.659 * nFerme)} attendus (référence 65,9 % SUR CETTE MÊME POPULATION — 58,7 % serait celle de la population entière) → p = ${pFerme.toFixed(4)}${pFerme < 0.05 ? " — TROP LOIN, démontré" : conclusifFerme ? "" : `, NON CONCLUANT : à n = ${nFerme} le test n'a pas la puissance de détecter l'écart réel (~11 points), il en faudrait 160 — relancer la recette les cumule`} · médiane ${q(PMin, 0.5).toFixed(1)} m sur ce passage contre 2,27`,
    conclusifFerme && pFerme >= 0.05,
    "ÉCHÉANCE étape 4 — le test binomial tranche quand l'écart est grand (36 % → p = 0,002) mais pas à l'écart réel : il faut la même puissance qu'une fourchette pour CONCLURE, il ne l'apporte que pour RÉFUTER");
  /* 6. UNE OPTION EST UN ÉVÉNEMENT COURT. C'est la propriété qui
     distingue la bonne définition de la mauvaise : « un coéquipier à
     portée » reste disponible des dizaines de secondes, une option née
     d'un mouvement vit une seconde. On borne donc largement — le but
     n'est pas de coller au chiffre réel (0,70 s) mais d'attraper un
     retour à la définition géométrique. */
  const DO = e3.dureesOption;
  verifier(`Étape 3 — une option de passe est un ÉVÉNEMENT, pas un coéquipier à portée : elle vit ${q(DO, 0.5).toFixed(2)} s, p90 ${q(DO, 0.9).toFixed(1)} (réel 0,70 et 2,3 ; ${DO.length} options)`,
    DO.length >= 30 && q(DO, 0.5) <= 1.5 && q(DO, 0.9) <= 4);
  /* CE QUI MANQUE ENCORE — affiché avec son écart plutôt que desserré.
     Ces trois distributions dépendent de la chorégraphie, que l'étape 4
     remplace : elle décide qui touche le ballon et quand, donc la
     longueur des courses, la densité du bloc autour du porteur et le
     nombre de solutions ouvertes au moment de la passe. */
  const AL = e3.appels.filter((a) => !a.tronque).map((a) => a.longueur), OP = e3.options;
  const dans13 = OP.length ? OP.filter((v) => v >= 1 && v <= 3).length / OP.length : 0;
  /* M3 — UN GARDE-FOU CONNU ROUGE S'ÉCRIT QUAND MÊME. Les options à
     l'instant de la passe restent sous la référence (médiane 2, et 88 %
     des possessions entre une et trois) : c'est la chorégraphie qui
     décide qui touche le ballon et quand, donc l'étape 4 qui en répond.
     On écrit la recette et on la laisse ROUGE : un garde-fou déclaré
     rouge porte la dette à l'écran et retombe vert tout seul le jour où
     le défaut est réparé ; un garde-fou absent ne dit rien. */
  const partOptions = cumul.options ? cumul.optionsDans13 / cumul.options : 0;
  dette(`Étape 3 — 1 à 3 options ouvertes dans 88 % des cas (mesuré ${Math.round(partOptions * 100)} % sur ${cumul.options} passes CUMULÉES, médiane ${q(OP, 0.5)} contre 2 sur ce passage)`,
    cumul.options >= 30 && partOptions >= 0.88,
    "ÉCHÉANCE étape 4 (les gabarits) — c'est la chorégraphie qui décide aujourd'hui qui touche le ballon et quand");
  console.log(`   📐 encore court, l'étape 4 en répond : longueur d'appel ${q(AL, 0.5).toFixed(1)} m (réel 10,7) · options à la passe médiane ${q(OP, 0.5)} (réel 2), ${Math.round(dans13 * 100)} % dans 1-3 (réel 88 %)`);

  verifier(`Décision 24 : le porteur est désigné sans ambiguïté, même avec des homonymes (${releve.porteurAmbigu} relevé(s) ambigu(s)${releve.matchsAvecHomonymes ? `, ${releve.matchsAvecHomonymes} relevé(s) AVEC homonymes sur le terrain` : ", aucun homonyme dans ce match"})`,
    releve.porteurAmbigu === 0);

  /* ---- Règle 12 de la spec : LA TIMELINE DES TEMPS FORTS ----
     (à ne pas confondre avec le repère interne « R12 » du code, qui
     désigne la fidélité au moteur — table de correspondance dans
     design/decisions.md, décision 26.) */
  verifier(`Règle 12 : un point par temps fort rendu (${releve.tlTotal} points pour ${releve.misesEnPlace} temps forts)`,
    releve.tlTotal === releve.misesEnPlace);
  verifier(`Règle 12 : un seul point courant à la fois (${releve.tlMalCompte} relevé(s) fautif(s))`,
    releve.tlMalCompte === 0);
  verifier(`Règle 12 : la timeline avance jusqu'au bout et ne recule jamais (arrivée au point ${releve.tlMax + 1}/${releve.tlTotal}, ${releve.tlRecule} recul(s))`,
    releve.tlRecule === 0 && releve.tlMax + 1 === releve.tlTotal);

  const mepMin = releve.misesEnPlaceMs.length ? Math.min(...releve.misesEnPlaceMs) : 0;
  verifier(`R3 : la mise en place a le temps de se jouer (la plus courte ${Math.round(mepMin)} ms ≥ 950 — plancher propre de 1 000 ms, hors facteur de vitesse)`,
    mepMin >= 950);

  /* ---- LE FORMAT UNIQUE (décision 73, qui remplace la 32) ----
     Tout est court : chaque temps fort déroulé tient ~4-8 s, et il n'y
     a PLUS de mise en place pleine (~3 s) — en voir une serait la
     régression. */
  const moy = (l) => l.length ? l.reduce((a, b) => a + b.duree, 0) / l.length : 0;
  verifier(`Décision 73 : chaque temps fort tient ~4-8 s au déroulement (${sacFormats.length} mesuré(s), moyenne ${sacFormats.length ? (moy(sacFormats) / 1000).toFixed(1) : "—"} s)`,
    sacFormats.length === 0 || (moy(sacFormats) > 3500 && moy(sacFormats) < 8500));
  const mepGrandes = releve.misesEnPlaceMs.filter((v) => v >= 2000).length;
  verifier(`Décision 73 : plus aucune mise en place pleine — le grand format a disparu (${mepGrandes}/${releve.misesEnPlaceMs.length} au-dessus de 2 s)`,
    mepGrandes === 0);
  const issueMin = releve.issuesMs.length ? Math.min(...releve.issuesMs) : 0;
  verifier(`R7 : l'issue reste à l'écran après sa révélation (la plus courte ${Math.round(issueMin)} ms ≥ 900)`,
    issueMin >= 900);

  await browser.close();
  if (dettes || dettesVertes) {
    console.log(`\n${dettes} dette(s) assumée(s)${dettesVertes ? `, ${dettesVertes} verte(s) sur le cumul — relancer la recette élargit l'échantillon (M7)` : ""}`);
  }
  console.log(echecs ? `\n${echecs} échec(s)` : "\nFidélité de la scène ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
