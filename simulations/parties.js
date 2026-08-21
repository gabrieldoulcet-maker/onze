/* ============================================================
   ONZE — Simulation : difficulté d'une partie complète
   ------------------------------------------------------------
   Un bot « chasseur de paires et de synergies » joue des parties
   entières contre les 7 IA. Cibles de calibrage (décision de
   direction) : ~45-50 % de top 4, écarts de buts rarement > 3.
   Usage : node simulations/parties.js [nb parties]
   Reproduit les règles de partie.html — GARDER SYNCHRO.
   ============================================================ */
const M = require("../match-moteur.js");
const joueurs = JSON.parse(require("fs").readFileSync(__dirname + "/../design/joueurs.json", "utf8"));

/* ---- Constantes copiées de partie.html ---- */
const POOL_PAR_COUT = { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 };
const ODDS_PAR_NIVEAU = {
  3: [75, 25, 0, 0, 0], 4: [55, 30, 15, 0, 0], 5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0], 7: [19, 30, 40, 10, 1], 8: [18, 25, 32, 22, 3],
  9: [10, 20, 25, 35, 10], 10: [5, 10, 20, 40, 25],
};
const droitsTV = (m) => [2, 2, 3, 4][m - 1] ?? 5;
const XP_POUR_MONTER = { 3: 6, 4: 10, 5: 20, 6: 36, 7: 60, 8: 68, 9: 68 };
const TITULAIRES_PAR_NIVEAU = { 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 11 };
const STARTERS = [
  { nom: "Gus", cout: 0, poste: "GAR", ecole: "", archetype: "", unique: null },
  { nom: "Marcel", cout: 0, poste: "DÉF", ecole: "", archetype: "", unique: null },
  { nom: "Rachid", cout: 0, poste: "DÉF", ecole: "", archetype: "", unique: null },
  { nom: "Momo", cout: 0, poste: "MIL", ecole: "", archetype: "", unique: null },
  { nom: "Titi", cout: 0, poste: "ATT", ecole: "", archetype: "", unique: null },
];
const COACHS_IA = [
  { nom: "Fortezza Nero", ecole: "Catenaccio" }, { nom: "La Masia Rebelle", ecole: "Tiki-Taka" },
  { nom: "Union Bitume", ecole: "École de la Rue" }, { nom: "Royal Toundra", ecole: "Kick & Rush" },
  { nom: "Clockwork XI", ecole: "Football Total" }, { nom: "Barrio Bravo", ecole: "La Grinta" },
  { nom: "Le Consortium", ecole: "Les Pros" },
];
const hasardParmi = (t) => t[Math.floor(Math.random() * t.length)];
// décision n°20 : durée (nombre de phases) proportionnelle aux enjeux
const phasesDeManche = (manche) => manche <= 3 ? 4 : manche <= 9 ? 6 : 8;

/* ---- La courbe des IA : LE réglage que cette simulation calibre.
   Doit rester identique à genererEquipeIA de partie.html. ---- */
const NIVEAU_IA = (manche) => Math.min(3 + Math.floor(manche / 4), 9);
const BUDGET_IA = (manche) => Math.min(1 + 1.35 * manche, 21);

function genererEquipeIA(coach, manche) {
  const niveau = NIVEAU_IA(manche);
  const taille = TITULAIRES_PAR_NIVEAU[niveau];
  let budget = BUDGET_IA(manche);
  const compo = [];
  const besoins = ["GAR"];
  for (let i = 0; i < taille - 1; i++) besoins.push(["DÉF", "MIL", "ATT"][i % 3]);
  for (const poste of besoins) {
    const slotsRestants = besoins.length - compo.length;
    const coutMax = Math.max(1, Math.min(5, Math.floor(budget - (slotsRestants - 1))));
    let candidats = joueurs.filter((j) => j.poste === poste && j.cout <= coutMax);
    const fideles = candidats.filter((j) => j.ecole === coach.ecole);
    if (fideles.length && Math.random() < 0.75) candidats = fideles;
    candidats.sort((a, b) => b.cout - a.cout);
    const choix = candidats[Math.floor(Math.random() * Math.min(3, candidats.length))] || candidats[0];
    if (choix) { compo.push(choix); budget -= choix.cout; }
  }
  return M.equipeDepuisFiches(coach.nom, coach.nom, compo);
}

/* ---- Le bot joueur : chasse les paires ET les synergies ---- */
/* Mode « loss-streak éco » (node simulations/parties.js N eco) :
   le bot encaisse volontairement jusqu'à la manche 7 en thésaurisant
   (primes de série de défaites + sponsors), puis pivote tout-dedans.
   Vérifie que cette stratégie — celle des Revanchards et de la Grinta —
   atteint le milieu de partie vivante. */
const MODE = process.argv[3] || "normal";
function botAchete(etat) {
  if (MODE === "eco" && etat.manche <= 7) return; // on encaisse, on économise
  const { pool, boutique } = etat;
  const possedes = [...etat.terrain, ...etat.banc];
  const nbCopies = (nom) => possedes.filter((j) => j.nom === nom && (j.etoiles || 1) === 1).length;
  const nbFamille = (fiche) => possedes.filter((j) => j.ecole === fiche.ecole || j.archetype === fiche.archetype).length;
  let continuer = true;
  while (continuer) {
    continuer = false;
    // score d'intérêt : compléter un trio > paire > synergie > coût 1 neuf
    const achetables = boutique.map((f, i) => ({ f, i })).filter((x) => x.f && etat.or >= x.f.cout);
    achetables.sort((a, b) =>
      (nbCopies(b.f.nom) * 10 + nbFamille(b.f) * 2 - b.f.cout) -
      (nbCopies(a.f.nom) * 10 + nbFamille(a.f) * 2 - a.f.cout));
    const meilleur = achetables[0];
    if (meilleur && (nbCopies(meilleur.f.nom) > 0 || nbFamille(meilleur.f) >= 1 || meilleur.f.cout <= 2)) {
      const fiche = meilleur.f;
      etat.or -= fiche.cout;
      boutique[meilleur.i] = null;
      const copie = { ...fiche, etoiles: 1 };
      const max = TITULAIRES_PAR_NIVEAU[etat.niveau];
      if (etat.terrain.length < max) etat.terrain.push(copie); else etat.banc.push(copie);
      M.fusionnerEffectif(etat.terrain, etat.banc);
      continuer = true;
    } else if (etat.or >= 12 && etat.manche >= 4) { // relance en gardant les sponsors
      etat.or -= 2;
      rafraichir(etat);
      continuer = true;
    }
  }
  // XP quand la caisse le permet (après la manche 4, au-dessus de 16M)
  while (etat.manche >= 4 && etat.or >= 16 && etat.niveau < 9) {
    etat.or -= 4; etat.xp += 4;
    while (XP_POUR_MONTER[etat.niveau] && etat.xp >= XP_POUR_MONTER[etat.niveau]) {
      etat.xp -= XP_POUR_MONTER[etat.niveau]; etat.niveau++;
    }
  }
  // aligner les meilleurs : vendre les réservistes devenus inutiles, monter du banc
  const max = TITULAIRES_PAR_NIVEAU[etat.niveau];
  const tous = [...etat.terrain, ...etat.banc].sort((a, b) => (b.cout * (b.etoiles || 1)) - (a.cout * (a.etoiles || 1)));
  const gardiens = tous.filter((j) => j.poste === "GAR");
  const champ = tous.filter((j) => j.poste !== "GAR");
  etat.terrain = [...(gardiens.length ? [gardiens[0]] : []), ...champ].slice(0, max);
  etat.banc = tous.filter((j) => !etat.terrain.includes(j)).slice(0, 8);
}
function tirerCarte(etat) {
  const odds = ODDS_PAR_NIVEAU[Math.min(etat.niveau, 10)];
  const t = Math.random() * 100; let cumul = 0, cout = 1;
  for (let c = 0; c < 5; c++) { cumul += odds[c]; if (t < cumul) { cout = c + 1; break; } }
  let candidats = etat.pool.filter((j) => j.cout === cout);
  if (!candidats.length) candidats = etat.pool;
  return candidats.length ? hasardParmi(candidats) : null;
}
function rafraichir(etat) {
  for (const c of etat.boutique) if (c) etat.pool.push(c);
  etat.boutique = [];
  for (let i = 0; i < 5; i++) {
    const carte = tirerCarte(etat);
    if (carte) etat.pool.splice(etat.pool.indexOf(carte), 1);
    etat.boutique.push(carte);
  }
}

/* ---- Une partie complète ---- */
function unePartie() {
  const etat = {
    manche: 1, or: 0, niveau: 3, xp: 0, pool: [],
    terrain: STARTERS.map((j) => ({ ...j, etoiles: 1 })), banc: [], boutique: [],
  };
  for (const j of joueurs) for (let c = 0; c < POOL_PAR_COUT[j.cout]; c++) etat.pool.push(j);
  const PRESTIGE_DEPART = 40;
  const coachs = [{ nom: "Bot", ia: false, prestige: PRESTIGE_DEPART, serie: 0, vivant: true }];
  for (const c of COACHS_IA) coachs.push({ ...c, ia: true, prestige: PRESTIGE_DEPART, serie: 0, vivant: true });
  const bot = coachs[0];
  // plan de butin (identique à partie.html)
  const valeurs = [2, 2, 2, 1].sort(() => Math.random() - 0.5);
  const repartition = Math.random() < 0.5 ? [1, 2, 1] : [2, 1, 1];
  let grosEcarts = 0, matchsJoues = 0;

  let mancheCourante = 1, premiereElimination = null, finPartie = null;
  const appliquer = (gagnant, perdant, ecart) => {
    if (ecart === 0) { gagnant.serie = 0; perdant.serie = 0; return; }
    gagnant.serie = gagnant.serie > 0 ? gagnant.serie + 1 : 1;
    perdant.serie = perdant.serie < 0 ? perdant.serie - 1 : -1;
    perdant.prestige = Math.max(0, perdant.prestige - M.degatsPrestige(ecart, mancheCourante));
    if (perdant.prestige === 0 && perdant.vivant) {
      perdant.vivant = false;
      if (premiereElimination === null) premiereElimination = mancheCourante;
    }
  };

  rafraichir(etat);
  for (let manche = 1; manche <= 40 && bot.vivant; manche++) {
    etat.manche = manche; mancheCourante = manche;
    if (coachs.filter((c) => c.vivant).length <= 1) { finPartie = manche; break; }
    botAchete(etat);
    const monEquipe = M.equipeDepuisFiches("Bot", "Bot", etat.terrain);
    if (manche <= 3) {
      // amical + butin (les orbes-joueurs sont approximés par leur valeur)
      const scriptes = [4, 5, 5][manche - 1];
      const amicale = M.equipeDepuisFiches("Amical", "Amical", STARTERS.slice(0, scriptes));
      const r = M.simulerMatch(monEquipe, amicale, phasesDeManche(manche));
      if (r.scoreA > r.scoreB) bot.serie = bot.serie > 0 ? bot.serie + 1 : 1;
      for (let n = 0; n < repartition[manche - 1]; n++) {
        const valeur = valeurs.shift();
        if (manche === 3 && n === 0) {
          const possedes = new Set([...etat.terrain, ...etat.banc].map((j) => j.nom));
          let candidats = etat.pool.filter((j) => j.cout === 1 && etat.pool.filter((x) => x.nom === j.nom).length >= 2);
          const doublons = candidats.filter((j) => possedes.has(j.nom));
          if (doublons.length && Math.random() < 0.7) candidats = doublons;
          if (candidats.length) {
            const nom = hasardParmi(candidats).nom;
            for (let k = 0; k < 2; k++) {
              etat.pool.splice(etat.pool.findIndex((j) => j.nom === nom), 1);
              etat.banc.push({ ...joueurs.find((j) => j.nom === nom), etoiles: 1 });
            }
            M.fusionnerEffectif(etat.terrain, etat.banc);
          }
        } else if (Math.random() < 0.35) etat.or += valeur;
        else if (Math.random() < 0.46 && valeur >= 2) { /* staff */ }
        else {
          const candidats = etat.pool.filter((j) => j.cout >= 1 && j.cout <= valeur);
          if (candidats.length) {
            const fiche = hasardParmi(candidats);
            etat.pool.splice(etat.pool.indexOf(fiche), 1);
            etat.banc.push({ ...fiche, etoiles: 1 });
            M.fusionnerEffectif(etat.terrain, etat.banc);
          }
        }
      }
    } else {
      const vivants = coachs.filter((c) => c.vivant);
      if (vivants.length <= 1) break;
      const autres = vivants.slice(1).sort(() => Math.random() - 0.5);
      const adversaire = autres.shift();
      const r = M.simulerMatch(monEquipe, genererEquipeIA(adversaire, manche), phasesDeManche(manche));
      matchsJoues++;
      if (r.ecart > 3) grosEcarts++;
      if (r.scoreA > r.scoreB) appliquer(bot, adversaire, r.ecart);
      else if (r.scoreB > r.scoreA) appliquer(adversaire, bot, r.ecart);
      else appliquer(bot, adversaire, 0);
      const paires = [];
      while (autres.length >= 2) paires.push([autres.shift(), autres.shift()]);
      for (const [c1, c2] of paires) {
        const rIA = M.simulerMatch(genererEquipeIA(c1, manche), genererEquipeIA(c2, manche), phasesDeManche(manche));
        if (rIA.scoreA > rIA.scoreB) appliquer(c1, c2, rIA.ecart);
        else if (rIA.scoreB > rIA.scoreA) appliquer(c2, c1, rIA.ecart);
        else appliquer(c1, c2, 0);
      }
    }
    // revenus
    const sponsors = Math.min(Math.floor(etat.or / 10), 5);
    const serieAbs = Math.abs(bot.serie);
    const bonusSerie = serieAbs >= 6 ? 3 : serieAbs >= 5 ? 2 : serieAbs >= 3 ? 1 : 0;
    etat.or += sponsors + droitsTV(manche) + bonusSerie + (manche > 3 && bot.serie > 0 ? 1 : 0);
    etat.xp += 2;
    while (XP_POUR_MONTER[etat.niveau] && etat.xp >= XP_POUR_MONTER[etat.niveau]) {
      etat.xp -= XP_POUR_MONTER[etat.niveau]; etat.niveau++;
    }
    rafraichir(etat);
  }
  const place = bot.vivant ? 1 : coachs.filter((c) => c.vivant).length + 1;
  return { place, grosEcarts, matchsJoues, premiereElimination, finPartie: finPartie || mancheCourante,
    vivantManche10: mancheCourante >= 10 || bot.vivant };
}

const N = Number(process.argv[2]) || 500;
let top4 = 0, places = [], grosEcarts = 0, matchs = 0, elims = [], fins = [];
let survieM10 = 0;
for (let i = 0; i < N; i++) {
  const r = unePartie();
  places.push(r.place);
  if (r.place <= 4) top4++;
  grosEcarts += r.grosEcarts; matchs += r.matchsJoues;
  if (r.premiereElimination) elims.push(r.premiereElimination);
  fins.push(r.finPartie);
  if (r.vivantManche10) survieM10 = (typeof survieM10 === "number" ? survieM10 : 0) + 1;
}
const moyenne = (liste) => (liste.reduce((t, v) => t + v, 0) / (liste.length || 1)).toFixed(1);
console.log(`${N} parties — top 4 : ${(100 * top4 / N).toFixed(1)} % (cible 45-50) | place moyenne : ${moyenne(places)}`);
console.log(`écarts > 3 buts : ${(100 * grosEcarts / matchs).toFixed(1)} % des matchs PvP du bot (cible : rare)`);
console.log(`première élimination : manche ${moyenne(elims)} (cible 9-11) | fin de partie : manche ${moyenne(fins)} (cible 15-19)`);
console.log(`bot vivant à la manche 10 : ${(100 * survieM10 / N).toFixed(1)} %${MODE === "eco" ? " (mode loss-streak éco)" : ""}`);
