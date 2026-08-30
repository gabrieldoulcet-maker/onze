/* ============================================================
   ONZE — SIMULATION v2 : la nouvelle ÉCONOMIE au-dessus du
   football existant (brief v2, décision 76).
   ------------------------------------------------------------
   On ne simule pas un nouveau football : le match reste
   ONZE.simulerMatch. Ce qui est simulé : notes de match,
   fourchette de talent + progression (minutes × note × copains),
   valeur marchande + revente, masse salariale, suffisance,
   sponsors, centre de formation — joués par 5 stratégies d'IA
   CONTRASTÉES (l'instrument de mesure), 8 coachs par partie,
   structure de partie inchangée (prestige, élimination).

   Prédictions écrites et poussées AVANT le premier passage :
   design/simulation-v2-prediction.md. Chaque molette est dans P
   et chaque retouche se consigne (M2). Contre-tests (M6) :
     node simulations/v2.js 2000 --masse=0        → critère 3
     node simulations/v2.js 2000 --suffisance=off → critère 4
   Tête-à-tête du critère 5 :
     node simulations/v2.js 2000 --h2h
   Usage : node simulations/v2.js [nParties] [--graine=76]
   ============================================================ */
const M = require("../match-moteur.js");
const ECO = require("../donnees-eco.js");
const fs = require("fs");
const joueursV1 = JSON.parse(fs.readFileSync(__dirname + "/../design/joueurs.json", "utf8"));

/* ---- Un hasard REPRODUCTIBLE : le rapport cite sa graine. Le moteur
   utilise Math.random : on le remplace globalement par un LCG semé. ---- */
let graine = 76;
for (const a of process.argv) { const m = a.match(/^--graine=(\d+)/); if (m) graine = Number(m[1]); }
let etatRng = graine >>> 0;
Math.random = () => {
  etatRng = (etatRng * 1664525 + 1013904223) >>> 0;
  return etatRng / 4294967296;
};
const alea = Math.random;
const parmi = (t) => t[Math.floor(alea() * t.length)];

/* ============ P — LA TABLE DES MOLETTES (règle M2) ============
   Valeurs de départ = celles du fichier de prédictions. Toute
   retouche est consignée dans design/simulation-v2-rapport.md :
   valeur avant → après → effet mesuré. */
const P = {
  note: { base: 5.85, but: 1.2, passe: 0.8, arret: 0.55, duel: 0.35, duelDEF: 0.7, resultat: 0.3,
  // M2 tour 8 : base 6 → 5,85 — les tours 2 et 5 avaient poussé la médiane à 6,6 et les >=8 à 10,1 %
    cleanSheet: 0.8, cleanSheetDEF: 1.1, butEncaisse: 0.25 },
  // M2 tour 2 : duel DÉF 0,35 → 0,7 (les >=8 DÉF étaient à 0,1 %) — sans effet mesurable seul
  // M2 tour 5 : cleanSheetDEF 0 → 1,1 (le collectif paie la défense)
  progression: { base: 0.3, parNote: 0.24, parCopain: 0.35, margeDiv: 12,
    jeunesse: 1.8 },
  // M2 tour 1 : jeunesse 0 → 0,9 (les pépites plafonnaient à +10, cible ~25)
  // M2 tour 4 : base 0,55 → 0,42 · copains 0,18 → 0,28 · jeunesse 0,9 → 1,3 —
  //   le tour 1 montait tout le monde (+16,7 le moyen, cible 10-15) sans
  //   creuser l'écart pépite/moyen : l'écart vient des copains et de la marge
  // M2 tour 10 : base 0,42 → 0,30 · parNote 0,30 → 0,24 · copains 0,28 → 0,35 ·
  //   jeunesse 1,3 → 1,8 — le moyen était à +18,4 (cible 10-15) et la pépite
  //   à +18,7 (cible ~25) : on transfère la croissance de la BASE vers la
  //   MARGE et les COPAINS, qui sont les deux leviers du concept
  valeur: { parTier: [2, 4, 8, 14, 22], forme: 0.12, progression: 0.03 },
  masseSalariale: 0.06,
  // M2 tour 14 : pente 0,75 -> 0,5 — les paliers ×2 musclaient tout le monde
  // et le piège sans rotation perdait 44,3 % (cible ~33) ; à 0,5 : 33,9 %.
  suffisance: { serieMin: 4, ratioForce: 1.2, changementsMin: 3, malus: 0.78, pente: 0.5, plancher: 0.7 },
  // M2 tour 11 : pente 0,5 → 0,75, plancher 0,72 → 0,70 — au banc, la pente
  //   douce ne faisait perdre le suffisant que 11,5 % (cible ~33)
  // M2 tour 3 : malus 0,88 → 0,84 (sans rotation perdait 27 %, cible ~33) et
  // ratio 1,15 → 1,2 (le plancher de variance du moteur à 1,15× noyait le remède)
  // M2 tour 7 : malus 0,84 → 0,78 — sur le châssis commun (tour 6), 0,84 ne
  //   faisait perdre le suffisant que 17,6 % (cible ~33)
  // M2 tour 9 : le malus FIXE devient PROPORTIONNEL à l'arrogance —
  //   facteur = max(plancher, 1 − pente × (ratio − 1)). À 0,78 fixe, un
  //   piège limite (1,2×) rendait le fort PLUS FAIBLE que le faible :
  //   64 % de défaites en écologique contre 36 % au banc d'essai. Plus
  //   l'écart est grand, plus on prend de haut — et ça se borne tout seul.
  forceDiv: 58,
  bonusPaliers: 2,   // M2 tour 12 (arbitrage Gabriel) : paliers ×2 -> 50,3 % au +20 % (l'écrêtage à 99 masquait la molette, levé)
  degats: 1.4,       // M2 tour 13 (arbitrage Gabriel) : dégâts ×1,4 -> médiane 18 manches (cible v1 : 15-19)
  notesTier: [[40, 55], [48, 62], [55, 70], [62, 78], [70, 88]],
  plafondMaxParTier: [30, 26, 20, 15, 10],   // les petits tiers portent les grandes fourchettes
  effectifMax: 15,
};
for (const a of process.argv) {
  let m = a.match(/^--masse=([\d.]+)/); if (m) P.masseSalariale = Number(m[1]);
  m = a.match(/^--paliers=([\d.]+)/); if (m) P.bonusPaliers = Number(m[1]);
  m = a.match(/^--degats=([\d.]+)/); if (m) P.degats = Number(m[1]);
  m = a.match(/^--pente=([\d.]+)/); if (m) P.suffisance.pente = Number(m[1]);
  if (a === "--suffisance=off") P.suffisance.malus = 1;
}

const ECOLES = [...new Set(joueursV1.map((j) => j.ecole).filter(Boolean))];
const ARCHETYPES = [...new Set(joueursV1.map((j) => j.archetype).filter((x) => x && x !== "Capitaine"))];
const POSTES = ["GAR", "DÉF", "MIL", "ATT"];

/* ============ LES JOUEURS v2 : note actuelle + plafond ============ */
let compteurJoueurs = 0;
function genJoueur(tier, options = {}) {
  const [n0, n1] = P.notesTier[tier - 1];
  const note = options.note !== undefined ? options.note : n0 + alea() * (n1 - n0);
  const plafond = Math.min(95, note + (options.grandPlafond
    ? 20 + alea() * 10
    : alea() * P.plafondMaxParTier[tier - 1]));
  const poste = options.poste || POSTES[compteurJoueurs % 4 === 0 ? Math.floor(alea() * 4) : 1 + Math.floor(alea() * 3)];
  return {
    nom: "J" + (++compteurJoueurs), tier,
    cout: tier, poste,
    ecole: options.ecole !== undefined ? options.ecole : parmi(ECOLES),
    archetype: options.archetype !== undefined ? options.archetype : parmi(ARCHETYPES),
    unique: null,
    note, plafond, progAcquise: 0, formes: [], matchsJoues: 0,
  };
}
function effectifDepart() {
  // onze faibles ~40 aux plafonds variés + formation jouable
  const postes = ["GAR", "DÉF", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "ATT", "ATT", "ATT"];
  return postes.map((poste) => genJoueur(1, { poste, note: 36 + alea() * 8 }));
}

const valeurDe = (j) => {
  const forme = j.formes.length ? j.formes.slice(-3).reduce((t, v) => t + v, 0) / Math.min(3, j.formes.length) : 6;
  return Math.max(1, P.valeur.parTier[j.tier - 1] *
    (1 + P.valeur.forme * (forme - 6)) * (1 + P.valeur.progression * j.progAcquise));
};
const masseDe = (c) => c.joueurs.reduce((t, j) => t + valeurDe(j), 0);

/* ============ LE MATCH : la note EST la force ============ */
function equipePourMatch(coach, onze, malusSuffisance = 1) {
  /* M2 tour 6 — LE CHÂSSIS COMMUN. Les stats du moteur dépendent du
     cout de la fiche : un tier 4 note 66 écrasait un tier 2 note 52
     bien au-delà de leur écart de notes (la qualité comptait DOUBLE, et
     la « force » en somme de notes mentait — le banc d'essai des pièges
     sortait 0,3 % là où l'écologique disait 36 %). En v2 la note EST la
     force : toutes les fiches passent au même châssis (cout 3), le tier
     ne gouverne plus que la valeur marchande et les odds. */
  const chassis = onze.map((j) => ({ ...j, cout: 3 }));
  const eq = M.equipeDepuisFiches(coach.nom, coach.nom, chassis);
  for (const j of eq.joueurs) {
    const source = onze.find((x) => x.nom === j.nom);
    const facteur = ((source ? source.note : 55) / P.forceDiv) * malusSuffisance;
    for (const stat of Object.keys(j.stats)) {
      // M2 tour 12 : le renfort des paliers s'applique à la part BOOST avant
      // l'échelle de note. On lit le VRAI boost dans j.boosts (le moteur
      // écrête stats à 99, donc stats − statsBase ment dès que la base est
      // haute : un gardien base 95 + boost 12 perdait 8 points, et la
      // molette --paliers amplifiait la part tronquée — d'où le plateau à
      // 43-45 %). Pas de plafond à 99 ici : les stats sont des poids dans
      // des formules continues, le moteur les tolère au-delà.
      const base = j.statsBase ? j.statsBase[stat] : j.stats[stat];
      const boost = j.boosts ? (j.boosts[stat] || 0) : 0;
      j.stats[stat] = Math.max(1, (base + boost * P.bonusPaliers) * facteur);
    }
  }
  return eq;
}
const forceOnze = (onze) => onze.reduce((t, j) => t + j.note, 0);

/* ============ LA NOTE DE MATCH (depuis statsDuMatch) ============ */
function notesDuMatch(resultat, eqA, eqB, onzeA, onzeB, gagneA) {
  const stats = M.statsDuMatch(resultat, eqA, eqB);
  const sortie = new Map();
  for (const [eq, onze, aGagne, encaisses] of [
    [eqA, onzeA, gagneA === true, resultat.scoreB],
    [eqB, onzeB, gagneA === false, resultat.scoreA]]) {
    const lignes = stats.parEquipe ? stats.parEquipe[eq.nom] : null;
    for (const j of onze) {
      const l = (lignes || []).find((x) => x.nom === j.nom) || { buts: 0, passes: 0, arrets: 0, duels: 0 };
      let note = P.note.base + l.buts * P.note.but + l.passes * P.note.passe +
        l.arrets * P.note.arret + l.duels * (j.poste === "DÉF" ? P.note.duelDEF : P.note.duel) +
        (gagneA === null ? 0 : aGagne ? P.note.resultat : -P.note.resultat);
      if (j.poste === "GAR") {
        if (encaisses === 0) note += P.note.cleanSheet;
        else note -= Math.max(0, encaisses - 1) * P.note.butEncaisse;
      }
      // M2 tour 5 : le clean sheet paie AUSSI la défense (les >=8 DÉF
      // restaient à 0,1 % — le moteur nomme peu les défenseurs, le
      // résultat collectif doit les payer, c'est football-vrai)
      if (j.poste === "DÉF" && encaisses === 0) note += P.note.cleanSheetDEF;
      sortie.set(j.nom, Math.max(3, Math.min(10, note)));
    }
  }
  return sortie;
}

/* ============ LA PROGRESSION : minutes × note × copains ============ */
function progresser(coach, onze, notes) {
  const parFamille = {};
  for (const j of onze) {
    if (j.ecole) parFamille[j.ecole] = (parFamille[j.ecole] || 0) + 1;
    if (j.archetype) parFamille[j.archetype] = (parFamille[j.archetype] || 0) + 1;
  }
  for (const j of onze) {
    const noteMatch = notes.get(j.nom) || 5;
    j.formes.push(noteMatch); j.matchsJoues++;
    j.copainsCumul = (j.copainsCumul || 0);
    const copains = Math.max(0, (parFamille[j.ecole] || 1) - 1) + Math.max(0, (parFamille[j.archetype] || 1) - 1);
    j.copainsCumul += copains;
    const marge = Math.min(1, Math.max(0, (j.plafond - j.note) / P.progression.margeDiv));
    // l'accélérateur de JEUNESSE : loin de son plafond, on apprend vite —
    // c'est lui qui fait de la pépite un pari (M2 tour 1)
    const jeunesse = 1 + P.progression.jeunesse * Math.min(1, Math.max(0, (j.plafond - j.note) / 20));
    const gain = Math.max(0, (P.progression.base + P.progression.parNote * (noteMatch - 6) +
      P.progression.parCopain * copains) * marge * jeunesse);
    j.note = Math.min(j.plafond, j.note + gain);
    j.progAcquise += gain;
  }
}

/* ============ LES CINQ STRATÉGIES — l'instrument de mesure ============ */
const STRATEGIES = ["talent", "synergies", "trader", "rotation", "passif"];
function scoreAchat(strategie, offre, coach) {
  const marge = offre.plafond - offre.note;
  const familles = coach.joueurs.filter((j) =>
    j.ecole === offre.ecole || j.archetype === offre.archetype).length;
  switch (strategie) {
    case "talent": return offre.note;                                    // le plus fort, point
    case "synergies": return familles * 12 + offre.note * 0.4;           // les paliers d'abord
    case "trader": return marge * 3 + offre.note * 0.3 - valeurDe(offre); // la pépite pas chère
    case "rotation": return marge * 1.5 + offre.note * 0.5;
    default: return -1;                                                   // passif : n'achète pas
  }
}
function leMoinsUtile(coach) {
  // le joueur qu'on libère quand l'effectif est plein : le plus faible en
  // note+avenir (le trader protège ses grandes marges)
  return [...coach.joueurs].sort((a, b) =>
    (a.note + (a.plafond - a.note) * 0.5) - (b.note + (b.plafond - b.note) * 0.5))[0];
}
function mercato(coach, manche, niveau) {
  if (coach.strategie === "passif") return;
  const odds = ECO.ODDS_PAR_NIVEAU[Math.min(niveau, 10)];
  const offres = [];
  for (let i = 0; i < 5; i++) {
    const t = alea() * 100; let cumul = 0, tier = 1;
    for (let c = 0; c < 5; c++) { cumul += odds[c]; if (t < cumul) { tier = c + 1; break; } }
    offres.push(genJoueur(tier));
  }
  // le trader vend d'abord : toute pépite arrivée à moins de 4 points du
  // plafond avec une valeur >= 2x sa base est encaissée
  if (coach.strategie === "trader") {
    for (const j of [...coach.joueurs]) {
      if (j.plafond - j.note < 4 && valeurDe(j) >= 2 * P.valeur.parTier[j.tier - 1] &&
          coach.joueurs.length > 12) {
        coach.or += valeurDe(j);
        coach.ventes = (coach.ventes || 0) + 1;
        coach.joueurs.splice(coach.joueurs.indexOf(j), 1);
      }
    }
  }
  // deux achats max par manche : chaque achat est un REMPLACEMENT
  for (let n = 0; n < 2; n++) {
    const achetables = offres.filter((o) => o && valeurDe(o) <= coach.or);
    if (!achetables.length) break;
    achetables.sort((a, b) => scoreAchat(coach.strategie, b, coach) - scoreAchat(coach.strategie, a, coach));
    const choix = achetables[0];
    const score = scoreAchat(coach.strategie, choix, coach);
    if (score <= 0) break;
    // qui sort ? — la décision d'entraîneur
    if (coach.joueurs.length >= P.effectifMax) {
      const sortant = leMoinsUtile(coach);
      if (sortant.note + 3 > choix.note && choix.plafond - choix.note < 8) break; // pas mieux : on garde
      coach.or += valeurDe(sortant) * 0.7;   // libéré / bradé
      coach.joueurs.splice(coach.joueurs.indexOf(sortant), 1);
    }
    coach.or -= valeurDe(choix);
    coach.joueurs.push(choix);
    offres[offres.indexOf(choix)] = null;
  }
}
function choisirOnze(coach, manche) {
  const gardiens = coach.joueurs.filter((j) => j.poste === "GAR").sort((a, b) => b.note - a.note);
  const champ = coach.joueurs.filter((j) => j.poste !== "GAR").sort((a, b) => b.note - a.note);
  let onze = [...(gardiens.length ? [gardiens[0]] : [champ.pop()]), ...champ].slice(0, 11);
  if (coach.strategie === "synergies") {
    // maximiser les familles : on préfère un joueur un peu plus faible qui
    // complète une famille du onze
    const compte = {};
    for (const j of onze) { compte[j.ecole] = (compte[j.ecole] || 0) + 1; compte[j.archetype] = (compte[j.archetype] || 0) + 1; }
    for (const dehors of coach.joueurs.filter((j) => !onze.includes(j) && j.poste !== "GAR")) {
      const gainFamille = (compte[dehors.ecole] || 0) + (compte[dehors.archetype] || 0);
      const plusFaible = [...onze].filter((j) => j.poste !== "GAR").sort((a, b) => a.note - b.note)[0];
      if (gainFamille >= 2 && plusFaible && dehors.note > plusFaible.note - 8) {
        onze[onze.indexOf(plusFaible)] = dehors;
      }
    }
  }
  if (coach.strategie === "rotation" || coach.strategie === "trader") {
    // faire tourner : 3 remplaçants/jeunes entrent CHAQUE manche — les
    // minutes des pépites (et la parade à la suffisance)
    const banc = coach.joueurs.filter((j) => !onze.includes(j) && j.poste !== "GAR")
      .sort((a, b) => (b.plafond - b.note) - (a.plafond - a.note));
    const sortants = [...onze].filter((j) => j.poste !== "GAR").sort((a, b) => a.plafond - a.note - (b.plafond - b.note));
    for (let i = 0; i < 3 && i < banc.length; i++) {
      const sortant = sortants[i];
      if (sortant) onze[onze.indexOf(sortant)] = banc[i];
    }
  }
  return onze;
}

/* ============ LA SUFFISANCE ============ */
function suffisancePossible(coach, onze, forceAdverse) {
  if (P.suffisance.malus >= 1) return false;                 // contre-test M6
  if (coach.serie < P.suffisance.serieMin) return false;
  if (forceOnze(onze) <= P.suffisance.ratioForce * forceAdverse) return false;
  const dernier = coach.dernierOnze || new Set();
  const changements = onze.filter((j) => !dernier.has(j.nom)).length;
  return changements < P.suffisance.changementsMin;          // la rotation est LE remède
}

/* ============ UNE PARTIE COMPLÈTE ============ */
function unePartie(mesures) {
  compteurJoueurs = 0;
  const coachs = STRATEGIES.concat(["talent", "synergies", "rotation"]) // 8 coachs, stratégies contrastées
    .map((strategie, i) => ({
      nom: strategie + "-" + i, strategie, joueurs: effectifDepart(),
      or: 0, serie: 0, prestige: ECO.PRESTIGE_DEPART, vivant: true,
      dernierOnze: null, primeVictoire: 0, tauxMasse: 1,
    }));
  const parJoueur = new Map(); // suivi de progression par joueur (critère 2)
  for (const c of coachs) for (const j of c.joueurs)
    parJoueur.set(j.nom, { depart: j.note, plafond: j.plafond, coach: c.strategie, j });

  let manche = 1, leaderM5 = null, rangsM5 = null;
  for (; manche <= 40; manche++) {
    const vivants = coachs.filter((c) => c.vivant);
    if (vivants.length <= 1) break;
    const niveau = ECO.niveauIA(manche);

    // centre de formation : un jeune gratuit à grand plafond
    if ([2, 5, 8, 11].includes(manche)) {
      for (const c of vivants) {
        const jeune = genJoueur(1 + Math.floor(alea() * 2), { grandPlafond: true });
        parJoueur.set(jeune.nom, { depart: jeune.note, plafond: jeune.plafond, coach: c.strategie, j: jeune });
        if (c.joueurs.length >= P.effectifMax) {
          const sortant = leMoinsUtile(c);
          c.joueurs.splice(c.joueurs.indexOf(sortant), 1);
        }
        c.joueurs.push(jeune);
      }
    }
    // sponsors (les manches des Philosophies)
    if (ECO.MANCHES_PHILOSOPHIE.includes(manche)) {
      for (const c of vivants) {
        if (c.strategie === "passif") continue;
        const choix = c.strategie === "trader" ? "virement" : c.strategie === "talent" ? "masse" : "prime";
        if (choix === "virement") c.or += 12;
        else if (choix === "masse") c.tauxMasse = 0.8;
        else c.primeVictoire = 2;
      }
    }
    for (const c of vivants) mercato(c, manche, niveau);

    // placement + appariement + matchs
    const onzes = new Map();
    for (const c of vivants) onzes.set(c, choisirOnze(c, manche));
    const amical = manche <= ECO.DERNIERE_MANCHE_AMICALE;
    const paires = [];
    if (amical) {
      for (const c of vivants) paires.push([c, null]);
    } else {
      const melange = [...vivants].sort(() => alea() - 0.5);
      while (melange.length >= 2) paires.push([melange.shift(), melange.shift()]);
    }
    for (const [c1, c2] of paires) {
      const onze1 = onzes.get(c1);
      let eq2, onze2, coach2;
      if (c2 === null) {
        onze2 = Array.from({ length: Math.min(11, 4 + manche) }, () => genJoueur(1, { note: 40 }));
        coach2 = { nom: "Espoirs-" + c1.nom, serie: 0, prestige: 999, strategie: "amical" };
      } else { onze2 = onzes.get(c2); coach2 = c2; }
      const force1 = forceOnze(onze1), force2 = forceOnze(onze2);
      const suff1 = suffisancePossible(c1, onze1, force2);
      const suff2 = c2 ? suffisancePossible(c2, onze2, force1) : false;
      const malusPour = (forceA, forceB) =>
        Math.max(P.suffisance.plancher, 1 - P.suffisance.pente * (forceA / forceB - 1));
      const eq1 = equipePourMatch(c1, onze1, suff1 ? malusPour(force1, force2) : 1);
      eq2 = equipePourMatch(coach2, onze2, suff2 ? malusPour(force2, force1) : 1);
      const r = M.simulerMatch(eq1, eq2, ECO.phasesDeManche(manche));
      const gagneA = r.scoreA > r.scoreB ? true : r.scoreB > r.scoreA ? false : null;

      // ---- critère 4 : le match-piège (série >= 4 contre un nettement plus faible)
      if (c2 && mesures) {
        for (const [fort, _faible, forceF, forcef, gagneFort, suffisant] of [
          [c1, c2, force1, force2, gagneA === true, c1.serie >= P.suffisance.serieMin],
          [c2, c1, force2, force1, gagneA === false, c2.serie >= P.suffisance.serieMin]]) {
          if (suffisant && forceF > P.suffisance.ratioForce * forcef) {
            const dernier = fort.dernierOnze || new Set();
            const onzeFort = onzes.get(fort);
            const rotation = onzeFort.filter((j) => !dernier.has(j.nom)).length >= P.suffisance.changementsMin;
            mesures.pieges.push({ rotation, perdu: gagneFort === false, strategie: fort.strategie });
          }
        }
      }
      const notes = notesDuMatch(r, eq1, eq2, onze1, onze2, gagneA);
      if (mesures) for (const j of onze1.concat(c2 ? onze2 : [])) {
        const n = notes.get(j.nom);
        if (n !== undefined) mesures.notes.push({ poste: j.poste, note: n });
      }
      if (mesures && c2 !== null && gagneA !== null) {
        // le gardien du PERDANT est-il la meilleure note de son équipe ?
        const perdants = gagneA ? onze2 : onze1;
        const meilleure = perdants.reduce((m, j) => (notes.get(j.nom) > (notes.get(m.nom) || 0) ? j : m), perdants[0]);
        mesures.defaites++;
        if (meilleure && meilleure.poste === "GAR") mesures.gardienMeilleurPerdant++;
      }
      progresser(c1, onze1, notes);
      if (c2) progresser(c2, onze2, notes);
      c1.dernierOnze = new Set(onze1.map((j) => j.nom));
      if (c2) c2.dernierOnze = new Set(onze2.map((j) => j.nom));

      // prestige et séries (jamais pendant les amicaux, comme aujourd'hui)
      if (c2) {
        const appliquer = (g, p, ecart) => {
          if (ecart === 0) return;
          g.serie = g.serie > 0 ? g.serie + 1 : 1;
          p.serie = p.serie < 0 ? p.serie - 1 : -1;
          p.prestige = Math.max(0, p.prestige - Math.round(M.degatsPrestige(ecart, manche) * P.degats));
          if (p.prestige === 0 && p.vivant) { p.vivant = false; p.mancheElim = manche; }
          g.or += g.primeVictoire || 0;
        };
        if (gagneA === true) appliquer(c1, c2, r.ecart);
        else if (gagneA === false) appliquer(c2, c1, r.ecart);
      } else if (gagneA === true) { c1.serie = c1.serie > 0 ? c1.serie + 1 : 1; }
    }

    // économie : revenus − masse salariale
    for (const c of vivants) {
      const masse = Math.round(masseDe(c) * P.masseSalariale * c.tauxMasse);
      c.or = Math.max(0, c.or + ECO.droitsTV(manche) + ECO.sponsors(c.or) +
        ECO.bonusSerie(c.serie) - masse);
      if (mesures) mesures.masses.push(masse);
    }
    // --diag : la trajectoire des stratégies (force, or, masse)
    if (DIAG && [5, 10, 15].includes(manche)) {
      for (const c of vivants) {
        DIAG.push({ manche, s: c.strategie, force: forceOnze(choisirOnze(c, manche)) / 11,
          or: c.or, masse: masseDe(c) });
      }
    }
    // photo de la manche 5 (critère 3)
    if (manche === 5) {
      const ordre = [...coachs].sort((a, b) => b.prestige - a.prestige);
      leaderM5 = ordre[0];
      rangsM5 = ordre;
    }
  }

  /* LE CLASSEMENT : les vivants d'abord (prestige), puis les éliminés par
     MANCHE D'ÉLIMINATION décroissante. La première version départageait
     les éliminés par prestige final — or il vaut 0 pour tous : l'ordre du
     TABLEAU décidait, et le trader (3ᵉ du tableau) sortait à 99,7 % de
     top 4. Un instrument qui classe par ordre d'écriture ne mesure rien —
     le mélange aléatoire final couvre les ex æquo de la même manche. */
  const classement = [...coachs].sort(() => alea() - 0.5).sort((a, b) =>
    (b.vivant ? 1 : 0) - (a.vivant ? 1 : 0) ||
    (a.vivant ? b.prestige - a.prestige : (b.mancheElim || 0) - (a.mancheElim || 0)));
  const place = new Map(classement.map((c, i) => [c, i + 1]));
  return { coachs, parJoueur, leaderM5, rangsM5, place, duree: manche };
}

/* ============ LE TÊTE-À-TÊTE DU CRITÈRE 5 ============ */
function teteATete(n, ecartNotes = 2) {
  /* « Plus chers de 20 % » se traduit AU TAUX DU MARCHÉ : sur le châssis
     commun, le tier 3 (8M) porte ~62,5 de note et le tier 4 (14M) ~70 —
     soit ~10 % de valeur par point de note. +20 % de budget ≈ +2 notes.
     (Premier montage : +6 notes, donc des mercenaires à +75 % — mesuré
     18,5 % pour les synergies, chiffre conservé au rapport comme borne.) */
  let victoiresSynergies = 0, nuls = 0;
  for (let i = 0; i < n; i++) {
    // équipe à synergies : deux familles empilées aux paliers (budget B)
    const ecole = parmi(ECOLES), arch = parmi(ARCHETYPES);
    const synergie = ["GAR", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "MIL", "ATT", "ATT", "ATT"]
      .map((poste, k) => genJoueur(3, { poste, note: 60, ecole: k < 6 ? ecole : parmi(ECOLES),
        archetype: k % 2 ? arch : parmi(ARCHETYPES) }));
    // mercenaires +20 % de budget = +2 notes, familles éclatées
    const mercenaires = ["GAR", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "MIL", "ATT", "ATT", "ATT"]
      .map((poste) => genJoueur(3, { poste, note: 60 + ecartNotes, ecole: parmi(ECOLES), archetype: parmi(ARCHETYPES) }));
    const eqS = equipePourMatch({ nom: "Synergies" }, synergie);
    const eqM = equipePourMatch({ nom: "Mercenaires" }, mercenaires);
    const r = M.simulerMatch(eqS, eqM, 8);
    if (r.scoreA > r.scoreB) victoiresSynergies++;
    else if (r.scoreA === r.scoreB) nuls++;
  }
  const decisifs = n - nuls;
  const p = victoiresSynergies / decisifs;
  const ic = 1.96 * Math.sqrt(p * (1 - p) / decisifs);
  console.log(`critère 5 · tête-à-tête : synergies ${(100 * p).toFixed(1)} % ` +
    `(n=${decisifs} matchs décisifs sur ${n}, IC ±${(100 * ic).toFixed(1)})`);
}

/* ============ LE BANC D'ESSAI DU CRITÈRE 4 : --pieges ============
   L'écologique ne fournit pas assez de pièges AVEC rotation (n=14 sur
   1 000 parties) : on construit le match-piège et on le rejoue en
   masse — leader en série (onze fort, série 4) contre un faible à
   1/1,25 de sa force, avec et sans rotation, malus appliqué selon P. */
function bancDesPieges(n) {
  const perdus = { sans: 0, avec: 0 }, joues = { sans: 0, avec: 0 };
  let coutRotation = 0;
  for (let i = 0; i < n; i++) {
    const postes = ["GAR", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "MIL", "ATT", "ATT", "ATT"];
    const effectif = postes.map((poste) => genJoueur(4, { poste, note: 66 }))
      .concat(["DÉF", "MIL", "MIL", "ATT"].map((poste) => genJoueur(2, { poste, note: 54 })));
    const faible = postes.map((poste) => genJoueur(2, { poste, note: 52 }));
    const rotation = i % 2 === 1;
    let onze = effectif.slice(0, 11);
    if (rotation) { onze = [...effectif.slice(0, 8), ...effectif.slice(11, 14)]; }
    const cle = rotation ? "avec" : "sans";
    // le coût de la rotation, mesuré : la force alignée qu'on sacrifie
    if (rotation) coutRotation += 1 - forceOnze(onze) / forceOnze(effectif.slice(0, 11));
    const suffisant = !rotation && P.suffisance.malus < 1;   // série 4, pas de rotation
    const ratio = forceOnze(onze) / forceOnze(faible);
    const facteur = Math.max(P.suffisance.plancher, 1 - P.suffisance.pente * (ratio - 1));
    const eqF = equipePourMatch({ nom: "Leader" }, onze, suffisant ? facteur : 1);
    const eqf = equipePourMatch({ nom: "Piege" }, faible);
    const r = M.simulerMatch(eqF, eqf, 8);
    joues[cle]++;
    if (r.scoreB > r.scoreA) perdus[cle]++;
  }
  const ic = (a, b) => 100 * 1.96 * Math.sqrt((a / b) * (1 - a / b) / b);
  console.log(`critère 4 · banc d'essai (${n} pièges construits, malus ${P.suffisance.malus}) :`);
  console.log(`  SANS rotation (suffisance active) : perd ${(100 * perdus.sans / joues.sans).toFixed(1)} % ` +
    `(n=${joues.sans}, IC ±${ic(perdus.sans, joues.sans).toFixed(1)}) — cible ~33`);
  console.log(`  AVEC rotation (pas de suffisance) : perd ${(100 * perdus.avec / joues.avec).toFixed(1)} % ` +
    `(n=${joues.avec}, IC ±${ic(perdus.avec, joues.avec).toFixed(1)}) — cible < 10`);
  console.log(`  coût de la rotation : ${(100 * coutRotation / joues.avec).toFixed(1)} % de force alignée sacrifiée`);
}

/* ============ LA CAMPAGNE DE MESURE ============ */
const N = Number(process.argv[2]) || 2000;
const DIAG = process.argv.includes("--diag") ? [] : null;
if (process.argv.includes("--h2h")) {
  let ecart = 2;
  for (const a of process.argv) { const m = a.match(/^--ecart=([\d.]+)/); if (m) ecart = Number(m[1]); }
  teteATete(N, ecart); process.exit(0);
}
if (process.argv.includes("--pieges")) { bancDesPieges(N); process.exit(0); }

const mesures = { notes: [], pieges: [], masses: [], defaites: 0, gardienMeilleurPerdant: 0 };
const agr = {
  parties: 0, leaderM5Gagne: 0, leaderM5Total: 0, moyenM5Top4: 0, moyenM5Total: 0,
  topParStrategie: {}, placesParStrategie: {}, progression: { moyens: [], pepites: [], jamais: 0, jamaisTotal: 0 },
  durees: [],
};
for (const s of STRATEGIES) { agr.topParStrategie[s] = { top4: 0, n: 0 }; agr.placesParStrategie[s] = []; }

const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = unePartie(mesures);
  agr.parties++; agr.durees.push(r.duree);
  if (r.leaderM5) {
    agr.leaderM5Total++;
    if (r.place.get(r.leaderM5) === 1) agr.leaderM5Gagne++;
  }
  if (r.rangsM5) for (const c of [r.rangsM5[3], r.rangsM5[4]]) {
    agr.moyenM5Total++;
    if (r.place.get(c) <= 4) agr.moyenM5Top4++;
  }
  for (const c of r.coachs) {
    const s = agr.topParStrategie[c.strategie];
    s.n++; if (r.place.get(c) <= 4) s.top4++;
    agr.placesParStrategie[c.strategie].push(r.place.get(c));
  }
  /* critère 2 — les cohortes par NATURE (marge de talent à l'arrivée) et
     USAGE (minutes, copains), pas par stratégie du coach : c'est la
     question du concept — « un joueur moyen », « une pépite BIEN GÉRÉE »
     (minutes ET copains), « un joueur qui ne joue jamais ». */
  for (const { depart, plafond, j } of r.parJoueur.values()) {
    const gain = j.note - depart;
    const marge = plafond - depart;
    const copainsMoyens = j.matchsJoues ? (j.copainsCumul || 0) / j.matchsJoues : 0;
    if (j.matchsJoues === 0) { agr.progression.jamais += gain; agr.progression.jamaisTotal++; }
    else if (marge >= 18 && j.matchsJoues >= 8 && copainsMoyens >= 1.5)
      agr.progression.pepites.push(gain);
    else if (marge >= 6 && marge <= 15 && j.matchsJoues >= 8)
      agr.progression.moyens.push(gain);
  }
}
const secondes = ((Date.now() - t0) / 1000).toFixed(1);

/* ============ LE RAPPORT CHIFFRÉ (n et IC partout) ============ */
const pct = (a, b) => b ? (100 * a / b) : 0;
const ic95 = (a, b) => { if (!b) return 0; const p = a / b; return 100 * 1.96 * Math.sqrt(p * (1 - p) / b); };
const mediane = (t) => { const s = [...t].sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };
const moyenne = (t) => t.length ? t.reduce((x, y) => x + y, 0) / t.length : 0;

console.log(`\n=== SIMULATION v2 — ${N} parties · graine ${graine} · masse ${P.masseSalariale} · ` +
  `suffisance ${P.suffisance.malus >= 1 ? "OFF" : P.suffisance.malus} · ${secondes}s ===`);
console.log(`durée d'une partie : médiane ${mediane(agr.durees)} manches (moyenne ${moyenne(agr.durees).toFixed(1)})`);

const notes = mesures.notes.map((x) => x.note);
const huitPlus = notes.filter((v) => v >= 8).length;
console.log(`\n— critère 1 · LA NOTE (${notes.length} notes) —`);
console.log(`médiane ${mediane(notes).toFixed(1)} · moyenne ${moyenne(notes).toFixed(2)} · ` +
  `notes >= 8 : ${pct(huitPlus, notes.length).toFixed(1)} % (IC ±${ic95(huitPlus, notes.length).toFixed(2)})`);
for (const poste of POSTES) {
  const dents = mesures.notes.filter((x) => x.poste === poste);
  const h = dents.filter((x) => x.note >= 8).length;
  console.log(`  ${poste} : médiane ${mediane(dents.map((x) => x.note)).toFixed(1)}, >=8 : ${pct(h, dents.length).toFixed(1)} %`);
}
console.log(`gardien = meilleure note du PERDANT : ${pct(mesures.gardienMeilleurPerdant, mesures.defaites).toFixed(1)} % ` +
  `des ${mesures.defaites} défaites (IC ±${ic95(mesures.gardienMeilleurPerdant, mesures.defaites).toFixed(2)})`);

console.log(`\n— critère 2 · LA PROGRESSION (par partie) —`);
console.log(`titulaire moyen : +${moyenne(agr.progression.moyens).toFixed(1)} (médiane +${mediane(agr.progression.moyens).toFixed(1)}, n=${agr.progression.moyens.length})`);
console.log(`pépite bien gérée : +${moyenne(agr.progression.pepites).toFixed(1)} (médiane +${mediane(agr.progression.pepites).toFixed(1)}, n=${agr.progression.pepites.length})`);
console.log(`jamais aligné : +${(agr.progression.jamais / Math.max(1, agr.progression.jamaisTotal)).toFixed(2)} (n=${agr.progression.jamaisTotal})`);

console.log(`\n— critère 3 · BOULE DE NEIGE & VALEUR —`);
console.log(`le 1er de la manche 5 GAGNE : ${pct(agr.leaderM5Gagne, agr.leaderM5Total).toFixed(1)} % ` +
  `(n=${agr.leaderM5Total}, IC ±${ic95(agr.leaderM5Gagne, agr.leaderM5Total).toFixed(1)}) — cible < 65`);
console.log(`club MOYEN (rangs 4-5) manche 5 -> top 4 : ${pct(agr.moyenM5Top4, agr.moyenM5Total).toFixed(1)} % ` +
  `(n=${agr.moyenM5Total}, IC ±${ic95(agr.moyenM5Top4, agr.moyenM5Total).toFixed(1)}) — cible > 25`);
console.log(`masse salariale moyenne par manche : ${moyenne(mesures.masses).toFixed(1)} M`);
for (const s of STRATEGIES) {
  const d = agr.topParStrategie[s];
  console.log(`  ${s.padEnd(10)} top 4 : ${pct(d.top4, d.n).toFixed(1)} % (n=${d.n}, IC ±${ic95(d.top4, d.n).toFixed(1)}) · place moyenne ${moyenne(agr.placesParStrategie[s]).toFixed(2)}`);
}

console.log(`\n— critère 4 · LA SUFFISANCE (matchs-pièges : série >= ${P.suffisance.serieMin}, force > ${P.suffisance.ratioForce}x) —`);
const sans = mesures.pieges.filter((x) => !x.rotation);
const avec = mesures.pieges.filter((x) => x.rotation);
const pSans = sans.filter((x) => x.perdu).length, pAvec = avec.filter((x) => x.perdu).length;
console.log(`SANS rotation : perd ${pct(pSans, sans.length).toFixed(1)} % (n=${sans.length}, IC ±${ic95(pSans, sans.length).toFixed(1)}) — cible ~33`);
console.log(`AVEC rotation : perd ${pct(pAvec, avec.length).toFixed(1)} % (n=${avec.length}, IC ±${ic95(pAvec, avec.length).toFixed(1)}) — cible < 10`);
console.log(`\n(critère 5 : lancer avec --h2h ; et lire l'écart de top 4 synergies/talent ci-dessus)`);
if (DIAG) {
  console.log(`\n— DIAGNOSTIC · trajectoires par stratégie —`);
  for (const manche of [5, 10, 15]) {
    console.log(`  manche ${manche} :`);
    for (const s of STRATEGIES) {
      const l = DIAG.filter((d) => d.manche === manche && d.s === s);
      const moy = (f) => (l.reduce((t, x) => t + f(x), 0) / (l.length || 1)).toFixed(1);
      console.log(`    ${s.padEnd(10)} force/joueur ${moy((x) => x.force)} · or ${moy((x) => x.or)} · masse ${moy((x) => x.masse)} (n=${l.length})`);
    }
  }
}
