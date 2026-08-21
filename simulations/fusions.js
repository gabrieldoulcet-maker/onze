/* ============================================================
   ONZE — Simulation : fréquence des premières fusions 2★
   ------------------------------------------------------------
   Question de design (cf. TFT) : quel % de parties obtient une
   fusion 2★ avant la manche 4 quand on chasse les paires ?
   Usage : node simulations/fusions.js [nb de parties]
   Reproduit l'économie de partie.html (design/economie.md) —
   garder les constantes synchronisées avec partie.html.
   ============================================================ */
const M = require("../match-moteur.js");
const joueurs = JSON.parse(require("fs").readFileSync(__dirname + "/../design/joueurs.json", "utf8"));

const POOL_PAR_COUT = { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 };
const ODDS_PAR_NIVEAU = {
  3: [75, 25, 0, 0, 0], 4: [55, 30, 15, 0, 0], 5: [45, 33, 20, 2, 0],
};
const droitsTV = (manche) => [2, 2, 3, 4][manche - 1] ?? 5;
const XP_POUR_MONTER = { 3: 6, 4: 10, 5: 20 };
const hasardParmi = (t) => t[Math.floor(Math.random() * t.length)];

function unePartie(manchesMax) {
  // pool
  let pool = [];
  for (const j of joueurs) for (let c = 0; c < POOL_PAR_COUT[j.cout]; c++) pool.push(j);
  let or = 0, niveau = 3, xp = 0, serie = 0;
  const effectif = []; // copies possédées
  let mancheFusion = null;
  // plan de butin (comme partie.html) : gris/gris, gris/bleu, or
  const PLAN_BUTIN = { 1: ["gris", "gris"], 2: ["gris", "bleu"], 3: ["or"] };

  const tirerCarte = () => {
    const odds = ODDS_PAR_NIVEAU[Math.min(niveau, 5)];
    const t = Math.random() * 100; let cumul = 0, cout = 1;
    for (let c = 0; c < 5; c++) { cumul += odds[c]; if (t < cumul) { cout = c + 1; break; } }
    let candidats = pool.filter((j) => j.cout === cout);
    if (!candidats.length) candidats = pool;
    return hasardParmi(candidats);
  };
  const nbCopies = (nom) => effectif.filter((j) => j.nom === nom && j.etoiles === 1).length;
  const acheterCopie = (fiche) => {
    pool.splice(pool.indexOf(fiche), 1);
    or -= fiche.cout;
    effectif.push({ ...fiche, etoiles: 1 });
    const terrain = effectif; // banc+terrain confondus pour la fusion
    const fusions = M.fusionnerEffectif(terrain, []);
    if (fusions.length && mancheFusion === null) return true;
    return false;
  };

  for (let manche = 1; manche <= manchesMax; manche++) {
    // ---- phase de boutique : le bot chasse les paires ----
    let boutique = Array.from({ length: 5 }, () => tirerCarte());
    let relances = 0;
    while (true) {
      // 1. compléter un trio > 2. faire une paire > 3. le moins cher
      let choix = boutique.filter(Boolean).filter((f) => or >= f.cout);
      if (choix.length) {
        choix.sort((a, b) => (nbCopies(b.nom) - nbCopies(a.nom)) || (a.cout - b.cout));
        const meilleur = choix[0];
        // on n'achète un joueur inédit que s'il est coût 1 (élargir la chasse à moindres frais)
        if (nbCopies(meilleur.nom) > 0 || meilleur.cout === 1) {
          if (acheterCopie(meilleur)) { if (mancheFusion === null) mancheFusion = manche; }
          boutique[boutique.indexOf(meilleur)] = null;
          continue;
        }
      }
      if (or >= 2 && relances < 20) { or -= 2; relances++; boutique = Array.from({ length: 5 }, () => tirerCarte()); continue; }
      break;
    }
    if (mancheFusion !== null) return mancheFusion;

    // ---- fin de manche : match (50 % de victoire), revenus, XP, butin ----
    const victoire = Math.random() < 0.5;
    serie = victoire ? (serie > 0 ? serie + 1 : 1) : (serie < 0 ? serie - 1 : -1);
    const sponsors = Math.min(Math.floor(or / 10), 5);
    const serieAbs = Math.abs(serie);
    const bonusSerie = serieAbs >= 6 ? 3 : serieAbs >= 5 ? 2 : serieAbs >= 3 ? 1 : 0;
    or += sponsors + droitsTV(manche) + (manche > 3 && victoire ? 1 : 0) + bonusSerie;
    xp += 2;
    while (XP_POUR_MONTER[niveau] && xp >= XP_POUR_MONTER[niveau]) { xp -= XP_POUR_MONTER[niveau]; niveau++; }
    if (manche <= 3) {
      const ajouterJoueur = (coutMax, coutMin = 1) => {
        const possedes = new Set(effectif.map((j) => j.nom));
        let candidats = pool.filter((j) => j.cout >= coutMin && j.cout <= coutMax);
        const doublons = candidats.filter((j) => possedes.has(j.nom));
        if (doublons.length && Math.random() < 0.6) candidats = doublons;
        if (!candidats.length) return;
        const fiche = hasardParmi(candidats);
        pool.splice(pool.indexOf(fiche), 1);
        effectif.push({ ...fiche, etoiles: 1 });
        const fusions = M.fusionnerEffectif(effectif, []);
        if (fusions.length && mancheFusion === null) mancheFusion = manche;
      };
      for (const rarete of PLAN_BUTIN[manche]) {
        const tirage = Math.random();
        if (rarete === "gris") { if (tirage < 0.5) or += 1 + Math.round(Math.random()); else ajouterJoueur(1); }
        else if (rarete === "bleu") { if (tirage < 0.35) or += 2 + Math.round(Math.random()); else if (tirage < 0.65) { /* staff */ } else ajouterJoueur(2); }
        else { // or : duo 60 %
          if (tirage < 0.6) {
            const possedes = new Set(effectif.map((j) => j.nom));
            let candidats = pool.filter((j) => j.cout === 1 && pool.filter((x) => x.nom === j.nom).length >= 2);
            const doublons = candidats.filter((j) => possedes.has(j.nom));
            if (doublons.length && Math.random() < 0.7) candidats = doublons;
            if (candidats.length) {
              const nom = hasardParmi(candidats).nom;
              for (let k = 0; k < 2; k++) {
                pool.splice(pool.findIndex((j) => j.nom === nom), 1);
                effectif.push({ ...joueurs.find((j) => j.nom === nom), etoiles: 1 });
              }
              const fusions = M.fusionnerEffectif(effectif, []);
              if (fusions.length && mancheFusion === null) mancheFusion = manche;
            }
          } else if (tirage < 0.8) { or += 2; /* staff */ }
          else ajouterJoueur(3, 2);
        }
      }
    }
    if (mancheFusion !== null) return mancheFusion;
  }
  return null;
}

const N = Number(process.argv[2]) || 500;
const MANCHES = 8;
const premieres = [];
let avant4 = 0, jamais = 0;
for (let i = 0; i < N; i++) {
  const manche = unePartie(MANCHES);
  if (manche === null) jamais++;
  else { premieres.push(manche); if (manche < 4) avant4++; }
}
console.log(`${N} parties simulées (bot chasseur de paires, ${MANCHES} manches)`);
console.log(`Fusion 2★ avant la manche 4 : ${(100 * avant4 / N).toFixed(1)} %`);
const repartition = {};
for (const m of premieres) repartition[m] = (repartition[m] || 0) + 1;
console.log("Première fusion par manche :", Object.entries(repartition).map(([m, n]) => `M${m}: ${(100 * n / N).toFixed(0)}%`).join("  "), jamais ? `— jamais: ${(100 * jamais / N).toFixed(0)}%` : "");
