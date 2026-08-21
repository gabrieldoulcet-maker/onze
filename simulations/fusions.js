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

const ECO = require("../donnees-eco.js");
const POOL_PAR_COUT = ECO.POOL_PAR_COUT;
const ODDS_PAR_NIVEAU = ECO.ODDS_PAR_NIVEAU;
const droitsTV = ECO.droitsTV;
const XP_POUR_MONTER = ECO.XP_POUR_MONTER;
const hasardParmi = (t) => t[Math.floor(Math.random() * t.length)];
const TITULAIRES_PAR_NIVEAU_IA = ECO.TITULAIRES_PAR_NIVEAU;
const ECOLES_IA = ["Catenaccio", "Tiki-Taka", "École de la Rue", "Kick & Rush",
  "Football Total", "La Grinta", "Les Pros"];

/* Les 7 IA consomment le MÊME pool que le bot (backlog 4) — copie de
   genererEquipeIA de partie.html : copies rendues puis reprises chaque
   manche. C'est l'effet le plus exposé sur la première fusion. */
function iaPrennentLeursCopies(ias, pool, manche) {
  for (const ia of ias) {
    for (const f of ia.copiesPrises) pool.push(f);
    ia.copiesPrises = [];
    const niveau = ECO.niveauIA(manche);
    const taille = TITULAIRES_PAR_NIVEAU_IA[niveau];
    let budget = ECO.budgetIA(manche);
    const besoins = ["GAR"];
    for (let i = 0; i < taille - 1; i++) besoins.push(["DÉF", "MIL", "ATT"][i % 3]);
    const compo = [];
    for (const poste of besoins) {
      const slotsRestants = besoins.length - compo.length;
      const coutMax = Math.max(1, Math.min(5, Math.floor(budget - (slotsRestants - 1))));
      const nomsPris = new Set(compo.map((j) => j.nom));
      let candidats = pool.filter((j) => j.poste === poste && j.cout <= coutMax && !nomsPris.has(j.nom));
      const fideles = candidats.filter((j) => j.ecole === ia.ecole);
      if (fideles.length && Math.random() < 0.75) candidats = fideles;
      // une entrée par nom (sinon top-3 = 3 copies du même joueur cher)
      const parNom = new Map();
      for (const j of candidats) if (!parNom.has(j.nom)) parNom.set(j.nom, j);
      candidats = [...parNom.values()];
      candidats.sort((a, b) => b.cout - a.cout);
      const choix = candidats[Math.floor(Math.random() * Math.min(3, candidats.length))] || candidats[0];
      if (choix) { compo.push(choix); budget -= choix.cout; pool.splice(pool.indexOf(choix), 1); ia.copiesPrises.push(choix); }
    }
  }
}

let minStaff = Infinity, partiesSansDeuxStaff = 0, cartesStaffRecues = 0;
function unePartie(manchesMax) {
  // pool
  let pool = [];
  for (const j of joueurs) for (let c = 0; c < POOL_PAR_COUT[j.cout]; c++) pool.push(j);
  let or = 0, niveau = 3, xp = 0, serie = 0;
  const effectif = []; // copies possédées
  let mancheFusion = null;
  // plan de butin (comme partie.html) : gris/gris, gris/bleu, or —
  // avec 2 cartes staff GARANTIES (règle TFT du stage 1)
  const PLAN_BUTIN = { 1: [{ r: "gris" }, { r: "gris" }], 2: [{ r: "gris" }, { r: "bleu" }], 3: [{ r: "or" }] };
  const positionsStaff = [[1, 0], [1, 1], [2, 0], [2, 1], [3, 0]].sort(() => Math.random() - 0.5).slice(0, 2);
  for (const [m, i] of positionsStaff) PLAN_BUTIN[m][i].staffGaranti = true;
  // (compteur global : déclaré en tête de fichier)

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

  const ias = ECOLES_IA.map((ecole) => ({ ecole, copiesPrises: [] }));
  for (let manche = 1; manche <= manchesMax; manche++) {
    iaPrennentLeursCopies(ias, pool, manche);
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
    if (mancheFusion !== null && manche > 3) { finDePartieStaff(); return mancheFusion; }

    // ---- fin de manche : match (50 % de victoire), revenus, XP, butin ----
    const victoire = Math.random() < 0.5;
    serie = victoire ? (serie > 0 ? serie + 1 : 1) : (serie < 0 ? serie - 1 : -1);
    const sponsors = ECO.sponsors(or);
    const bonusSerie = ECO.bonusSerie(serie);
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
      for (const orbe of PLAN_BUTIN[manche]) {
        const rarete = orbe.r;
        if (orbe.staffGaranti) { cartesStaffRecues++; if (rarete === "or") or += 2; continue; }
        const tirage = Math.random();
        if (rarete === "gris") { if (tirage < 0.5) or += 1 + Math.round(Math.random()); else ajouterJoueur(1); }
        else if (rarete === "bleu") { if (tirage < 0.35) or += 2 + Math.round(Math.random()); else if (tirage < 0.65) { cartesStaffRecues++; } else ajouterJoueur(2); }
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
          } else if (tirage < 0.8) { or += 2; cartesStaffRecues++; }
          else ajouterJoueur(3, 2);
        }
      }
    }
    if (mancheFusion !== null && manche >= 3) { finDePartieStaff(); return mancheFusion; }
  }
  finDePartieStaff();
  return null;
}
function finDePartieStaff() {
  minStaff = Math.min(minStaff, cartesStaffRecues);
  if (cartesStaffRecues < 2) partiesSansDeuxStaff++;
  cartesStaffRecues = 0;
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
console.log(`Cartes staff avant la manche 4 — minimum : ${minStaff} | parties sous la garantie de 2 : ${partiesSansDeuxStaff} (attendu 0)`);
