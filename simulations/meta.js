/* ============================================================
   ONZE — L'ÉQUILIBRAGE MÉTA, comme TFT (bloc G).
   ------------------------------------------------------------
   10 bots ARCHÉTYPAUX (un par stratégie assumée) s'affrontent en
   lobbies de 8 à économie COMPLÈTE : pool partagé de 1344 copies,
   boutique aux odds réelles, XP, séries, intérêts, butin de staff
   assigné en spécialisations, Reliques à la manche 12, hivers,
   dégâts de prestige réels et éliminations.
   Mesures : par compo (winrate, top 4, manche d'élimination), par
   famille (présence et paliers chez les tops), par spécialisation,
   par Relique (présence top 4 vs champ).
   Cibles (méta TFT saine) : toutes les compos entre ~40 et ~55 %
   de top 4, ≥4 compos « méta » au coude à coude, 2-3 situationnelles,
   aucune famille poubelle, aucune spec au-dessus de ~60 % des équipes
   gagnantes.
   LIMITE ASSUMÉE : les Icônes (quêtes) ne sont pas simulées — le
   « chasseur d'Icônes » reçoit une approximation (unité +15 % à
   M8/M12), documentée dans le rapport de méta.
   Usage : node simulations/meta.js [nbParties=400]
   ============================================================ */
const M = require("../match-moteur.js");
const ECO = require("../donnees-eco.js");
const joueurs = JSON.parse(require("fs").readFileSync(__dirname + "/../design/joueurs.json", "utf8"));
const hasard = (t) => t[Math.floor(Math.random() * t.length)];

/* ---- Les 10 stratégies archétypales ---- */
const STRATEGIES = {
  "reroll-academie": { ecoles: ["L'Académie"], courbe: "reroll", staffPref: ["Coach technique", "Scout"] },
  "aggro-kickrush": { ecoles: ["Kick & Rush"], courbe: "aggro", staffPref: ["Coach de finition", "Prépa physique"] },
  "bus-catenaccio": { ecoles: ["Catenaccio"], courbe: "flex", bus: true, staffPref: ["Adjoint tactique", "Analyste vidéo"] },
  "fast8-total": { ecoles: ["Football Total"], courbe: "fast8", staffPref: ["Kiné", "Adjoint tactique"] },
  "late-grinta": { ecoles: ["La Grinta"], courbe: "late", staffPref: ["Coach mental", "Prépa physique"] },
  "eco-revanchards": { ecoles: ["Les Revanchards"], courbe: "eco", staffPref: ["Coach mental", "Analyste vidéo"] },
  "flex-rue": { ecoles: ["École de la Rue"], courbe: "flex", staffPref: ["Coach technique", "Coach de finition"] },
  "splash-tiki-inter": { ecoles: ["Tiki-Taka", "Les Internationaux"], courbe: "flex", staffPref: ["Adjoint tactique", "Scout"] },
  "hors-poste-total": { ecoles: ["Football Total"], courbe: "flex", horsPoste: true, staffPref: ["Kiné", "Prépa physique"] },
  "chasseur-icones": { ecoles: ["Les Pros"], courbe: "flex", icones: true, staffPref: ["Scout", "Coach mental"] },
};
/* mode « écoles » (node simulations/meta.js N ecoles) : la même courbe
   flex pour tous, une École chacun — isole la force des Écoles dans le
   vrai contexte économique (pool contesté, staff, matchs) */
if (process.argv.includes("ecoles")) {
  for (const cle of Object.keys(STRATEGIES)) delete STRATEGIES[cle];
  for (const ecole of ["Tiki-Taka", "Catenaccio", "Kick & Rush", "École de la Rue", "La Grinta",
    "Football Total", "L'Académie", "Les Internationaux", "Le Douzième Homme", "Les Pros", "Les Revanchards"]) {
    STRATEGIES["ecole:" + ecole] = { ecoles: [ecole], courbe: "flex", staffPref: ["Adjoint tactique", "Coach mental"] };
  }
}
const NOMS_STRATEGIES = Object.keys(STRATEGIES);
const MEMBRES = ["Prépa physique", "Coach mental", "Analyste vidéo", "Coach de finition",
  "Coach technique", "Kiné", "Adjoint tactique", "Scout"];
const RELIQUES = ["Le Brassard du Fondateur", "La Chaussure Dépareillée", "Le Sifflet Avalé",
  "Le Maillot Retourné", "La Cage Immaculée", "Le Crampon d'Or 1958", "Le Ballon Fétiche"];

/* ---- Le mercato d'un bot ---- */
function tirerCarte(bot, pool) {
  const odds = ECO.ODDS_PAR_NIVEAU[Math.min(bot.niveau, 10)];
  const t = Math.random() * 100;
  let cumul = 0, cout = 1;
  for (let c = 0; c < 5; c++) { cumul += odds[c]; if (t < cumul) { cout = c + 1; break; } }
  let candidats = pool.filter((j) => j.cout === cout);
  if (!candidats.length) candidats = pool;
  return candidats.length ? hasard(candidats) : null;
}
function boutiqueDe(bot, pool) {
  const cartes = [];
  for (let i = 0; i < 5; i++) {
    const carte = tirerCarte(bot, pool);
    if (carte) { pool.splice(pool.indexOf(carte), 1); cartes.push(carte); }
  }
  return cartes;
}
function rendreAuPool(cartes, pool) { for (const c of cartes) if (c) pool.push(c); }

function interetsVises(courbe, manche, bot) {
  // le plancher d'or à préserver (les intérêts) — un éco TFT réaliste
  // achète quand même son plateau : les planchers restent atteignables.
  // DÉPENSE PANIQUE : prestige bas = on convertit la banque en plateau
  // tout de suite (aucun joueur ne meurt riche).
  if (bot && bot.prestige <= 35) return 0;
  if (courbe === "aggro") return 0;
  if (courbe === "eco" || courbe === "late") return manche <= 9 ? Math.min(30, manche * 4) : 0;
  if (courbe === "fast8") return manche <= 7 ? Math.min(30, manche * 4) : 0; // il banque PUIS monte
  if (courbe === "reroll") return manche <= 5 ? 14 : 0; // il banque un peu puis brûle tout en refresh
  return 10; // flex : un coussin de sponsors
}

function mercatoDuBot(bot, pool, manche) {
  const strat = STRATEGIES[bot.strategie];
  const nbCopies = (nom) => bot.effectif.filter((j) => j.nom === nom && (j.etoiles || 1) === 1).length;
  const viseEcole = (f) => strat.ecoles.includes(f.ecole);
  const plancher = interetsVises(strat.courbe, manche, bot);

  // l'XP selon la courbe
  const viseNiveau = strat.courbe === "fast8" ? (manche >= 8 ? 9 : 4)
    : strat.courbe === "reroll" ? (manche >= 10 ? 7 : 5)
    : strat.courbe === "late" ? (manche >= 9 ? 9 : 4)
    : 9;
  while (bot.niveau < viseNiveau && bot.or - ECO.COUT_XP >= plancher &&
         (strat.courbe === "fast8" ? bot.or >= 10 && bot.effectif.length >= 6 : bot.or >= 14) &&
         ECO.XP_POUR_MONTER[bot.niveau]) {
    bot.or -= ECO.COUT_XP;
    bot.xp += ECO.XP_PAR_ACHAT;
    while (ECO.XP_POUR_MONTER[bot.niveau] && bot.xp >= ECO.XP_POUR_MONTER[bot.niveau]) {
      bot.xp -= ECO.XP_POUR_MONTER[bot.niveau];
      bot.niveau++;
    }
  }

  // les achats + relances
  let boutique = boutiqueDe(bot, pool);
  const relancesMax = strat.courbe === "reroll" && manche >= 5 ? 12 : 3;
  for (let relance = 0; relance <= relancesMax; relance++) {
    let achete = true;
    while (achete) {
      achete = false;
      const scores = boutique.map((f, i) => f ? {
        f, i,
        score: nbCopies(f.nom) * 10 + (viseEcole(f) ? 6 : 0) +
          (bot.effectif.some((j) => j.archetype === f.archetype) ? 2 : 0) - f.cout * 0.5,
      } : null).filter(Boolean).filter((x) =>
        // les paires passent toujours ; l'AMORÇAGE aussi : tant que le
        // plateau est court, on achète l'École cible sous le plancher
        bot.or - x.f.cout >= (nbCopies(x.f.nom) || (bot.effectif.length < 7 && x.f.cout <= 2) ? 0 : plancher * 0.5));
      scores.sort((a, b) => b.score - a.score);
      const meilleur = scores[0];
      if (meilleur && (meilleur.score >= 5 || (viseEcole(meilleur.f) && meilleur.f.cout <= 3) ||
          (strat.courbe === "aggro" && meilleur.f.cout <= 3))) {
        bot.or -= meilleur.f.cout;
        bot.effectif.push({ ...meilleur.f, etoiles: 1 });
        boutique[meilleur.i] = null;
        M.fusionnerEffectif(bot.effectif, []);
        achete = true;
      }
    }
    if (relance < relancesMax && bot.or - ECO.COUT_REFRESH >= plancher &&
        (strat.courbe === "reroll" ? bot.or >= 6 : bot.or >= 12)) {
      bot.or -= ECO.COUT_REFRESH;
      rendreAuPool(boutique, pool);
      boutique = boutiqueDe(bot, pool);
    } else break;
  }
  rendreAuPool(boutique, pool);
}

/* ---- Le staff : réception (sac équitable) et assignation par paires ---- */
function recevoirStaff(bot, nb) {
  for (let i = 0; i < nb; i++) {
    if (!bot.sac || !bot.sac.length) bot.sac = [...MEMBRES].sort(() => Math.random() - 0.5);
    bot.staff.push(bot.sac.pop());
  }
}
function assignerStaffDuBot(bot) {
  const strat = STRATEGIES[bot.strategie];
  // les préférés d'abord — le reste dans l'ordre du sac
  bot.staff.sort((a, b) => (strat.staffPref.includes(b) ? 1 : 0) - (strat.staffPref.includes(a) ? 1 : 0));
  while (bot.staff.length >= 2) {
    const porteurs = bot.effectif
      .filter((j) => ((j.staffCartes || []).length + (j.specialisations || []).length * 2) < 6)
      .sort((a, b) => (b.cout * (b.etoiles || 1)) - (a.cout * (a.etoiles || 1)));
    const cible = porteurs[0];
    if (!cible) break;
    const r1 = M.assignerCarte(cible, bot.staff[0]);
    if (!r1.ok) break;
    bot.staff.shift();
    const r2 = M.assignerCarte(cible, bot.staff[0]);
    if (r2.ok) bot.staff.shift();
    else break;
  }
}

/* ---- L'équipe alignée (bus et hors-poste compris) ---- */
function equipeDuBot(bot) {
  const strat = STRATEGIES[bot.strategie];
  const max = ECO.TITULAIRES_PAR_NIVEAU[bot.niveau];
  const valeur = (j) => j.cout * (j.etoiles || 1) * (strat.ecoles.includes(j.ecole) ? 1.3 : 1) + (j.icone ? 2 : 0);
  const tri = [...bot.effectif].sort((a, b) => valeur(b) - valeur(a));
  const gardien = tri.filter((j) => j.poste === "GAR")[0];
  const champ = tri.filter((j) => j.poste !== "GAR");
  const titulaires = [...(gardien ? [gardien] : []), ...champ].slice(0, max);
  for (const j of titulaires) j.ligne = undefined;
  if (strat.bus) {
    // le bus : tout le monde derrière sauf un attaquant de pointe
    const dePointe = titulaires.filter((j) => j.poste === "ATT")[0];
    for (const j of titulaires) if (j.poste !== "GAR" && j !== dePointe) j.ligne = "DÉF";
  } else if (strat.horsPoste) {
    // l'overload offensif du Football Total : 2 défenseurs, le reste devant
    const arrieres = titulaires.filter((j) => j.poste !== "GAR").slice(0, 2);
    for (const j of titulaires) if (j.poste !== "GAR") j.ligne = arrieres.includes(j) ? "DÉF" : "ATT";
  }
  return M.equipeDepuisFiches(bot.nom, bot.nom, titulaires);
}

/* ---- Une partie complète (lobby de 8) ---- */
function unePartie(strategiesDuLobby, mesures) {
  const pool = [];
  for (const j of joueurs) for (let c = 0; c < ECO.POOL_PAR_COUT[j.cout]; c++) pool.push(j);
  // les starters du centre de formation (comme le jeu : 5 coût 0)
  const STARTERS = [
    { nom: "Gus", cout: 0, poste: "GAR", ecole: "", archetype: "", unique: null },
    { nom: "Marcel", cout: 0, poste: "DÉF", ecole: "", archetype: "", unique: null },
    { nom: "Rachid", cout: 0, poste: "DÉF", ecole: "", archetype: "", unique: null },
    { nom: "Momo", cout: 0, poste: "MIL", ecole: "", archetype: "", unique: null },
    { nom: "Titi", cout: 0, poste: "ATT", ecole: "", archetype: "", unique: null },
  ];
  const bots = strategiesDuLobby.map((strategie, i) => ({
    nom: strategie + "#" + i, strategie, or: 0, niveau: 3, xp: 0, serie: 0,
    prestige: ECO.PRESTIGE_DEPART, vivant: true,
    effectif: STARTERS.map((j) => ({ ...j, etoiles: 1 })), staff: [], sac: null,
    relique: null, place: null,
  }));

  const eliminer = (bot, manche) => {
    bot.vivant = false;
    bot.mancheElim = manche;
    bot.place = bots.filter((b) => b.vivant).length + 1;
    // ses copies retournent au pool (règle TFT)
    for (const j of bot.effectif) {
      const original = joueurs.find((x) => x.nom === j.nom);
      if (original && !j.icone) for (let c = 0; c < Math.pow(3, (j.etoiles || 1) - 1); c++) pool.push(original);
    }
  };
  const appliquer = (gagnant, perdant, ecart, manche) => {
    if (ecart === 0) return; // décision 23
    gagnant.serie = gagnant.serie > 0 ? gagnant.serie + 1 : 1;
    perdant.serie = perdant.serie < 0 ? perdant.serie - 1 : -1;
    if (perdant.fantome) return;
    perdant.prestige = Math.max(0, perdant.prestige - M.degatsPrestige(ecart, manche));
    if (perdant.prestige === 0 && perdant.vivant) eliminer(perdant, manche);
  };

  let manche = 1;
  for (; manche <= 30; manche++) {
    const vivants = bots.filter((b) => b.vivant);
    if (vivants.length <= 1) break;

    // ---- mercato (ordre aléatoire : l'équité d'accès au pool) ----
    for (const bot of [...vivants].sort(() => Math.random() - 0.5)) mercatoDuBot(bot, pool, manche);

    // ---- le butin de staff (amicaux + coupes, comme le jeu) ----
    if (manche <= 3) for (const bot of vivants) recevoirStaff(bot, manche === 1 ? 1 : 1);
    if (ECO.MANCHES_COUPE.includes(manche)) for (const bot of vivants) { recevoirStaff(bot, 2); bot.or += 2; }
    for (const bot of vivants) assignerStaffDuBot(bot);

    // ---- les Reliques (M12, une par bot vivant — approximation : le jeu
    // n'en donne qu'une par PARTIE au joueur humain ; ici chacun a la
    // sienne pour mesurer leur poids) ----
    if (manche === 12) for (const bot of vivants) {
      bot.relique = hasard(RELIQUES);
      const porteurs = bot.relique === "La Cage Immaculée"
        ? bot.effectif.filter((j) => j.poste === "GAR")
        : bot.effectif.filter((j) => !j.relique);
      const porteur = porteurs.sort((a, b) => (b.cout * (b.etoiles || 1)) - (a.cout * (a.etoiles || 1)))[0];
      if (porteur) porteur.relique = bot.relique; else bot.relique = null;
    }

    // ---- les Icônes (APPROXIMATION documentée) ----
    for (const bot of vivants) {
      const chasseur = STRATEGIES[bot.strategie].icones;
      if ((chasseur && (manche === 8 || manche === 12)) || (!chasseur && manche === 12 && Math.random() < 0.2)) {
        const ecoleCible = STRATEGIES[bot.strategie].ecoles[0] || "Le Douzième Homme";
        const gabarit = hasard(joueurs.filter((j) => j.cout >= 3));
        bot.effectif.push({ ...gabarit, nom: "Icône " + bot.strategie + manche, ecole: ecoleCible,
          cout: Math.min(5, gabarit.cout + 1), etoiles: 1, icone: true });
        bot.aIcone = true;
      }
    }

    // ---- l'hiver : les mal classés servis d'abord ----
    if (ECO.MANCHES_MERCATO_HIVER.includes(manche)) {
      for (const bot of [...vivants].sort((a, b) => a.prestige - b.prestige)) {
        const cibles = pool.filter((j) => j.cout <= 3 && STRATEGIES[bot.strategie].ecoles.includes(j.ecole));
        const fiche = (cibles.length ? hasard(cibles) : null) || hasard(pool.filter((j) => j.cout <= 3));
        if (fiche) {
          pool.splice(pool.indexOf(fiche), 1);
          bot.effectif.push({ ...fiche, etoiles: 1 });
          M.fusionnerEffectif(bot.effectif, []);
        }
      }
    }

    // ---- les matchs (PvP à partir de M4 ; amicaux = revenus seulement) ----
    if (manche > 3 && !ECO.MANCHES_COUPE.includes(manche)) {
      const enLice = [...bots.filter((b) => b.vivant)].sort(() => Math.random() - 0.5);
      const paires = [];
      while (enLice.length >= 2) paires.push([enLice.shift(), enLice.shift()]);
      if (enLice.length) { // le clone fantôme
        const seul = enLice[0];
        const source = hasard(bots.filter((b) => b.vivant && b !== seul));
        paires.push([seul, { nom: "B-" + source.nom, fantome: true, serie: 0, effectif: source.effectif, niveau: source.niveau, strategie: source.strategie }]);
      }
      for (const [b1, b2] of paires) {
        const eq1 = equipeDuBot(b1), eq2 = equipeDuBot(b2);
        const r = M.simulerMatch(eq1, eq2, ECO.phasesDeManche(manche));
        if (r.scoreA > r.scoreB) appliquer(b1, b2, r.ecart, manche);
        else if (r.scoreB > r.scoreA) appliquer(b2, b1, r.ecart, manche);
      }
    }

    // ---- le diagnostic : la valeur de plateau à M8 et M12 ----
    if (manche === 8 || manche === 12) {
      for (const bot of bots.filter((b) => b.vivant)) {
        const eq = equipeDuBot(bot);
        const note = eq.joueurs.reduce((t, j) => t + j.note, 0);
        const d = mesures.diag[bot.strategie] = mesures.diag[bot.strategie] || { m8: [], m12: [], or8: [], niv8: [] };
        d[manche === 8 ? "m8" : "m12"].push(note);
        if (manche === 8) { d.or8.push(bot.or); d.niv8.push(bot.niveau); }
      }
    }

    // ---- les revenus ----
    for (const bot of bots.filter((b) => b.vivant)) {
      bot.or += ECO.sponsors(bot.or) + ECO.droitsTV(manche) + ECO.bonusSerie(bot.serie) +
        (manche > 3 && bot.serie > 0 ? 1 : 0);
      bot.xp += ECO.XP_GRATUITE_PAR_MANCHE;
      while (ECO.XP_POUR_MONTER[bot.niveau] && bot.xp >= ECO.XP_POUR_MONTER[bot.niveau]) {
        bot.xp -= ECO.XP_POUR_MONTER[bot.niveau];
        bot.niveau++;
      }
    }
  }
  // le classement final
  const survivants = bots.filter((b) => b.vivant).sort((a, b) => b.prestige - a.prestige);
  survivants.forEach((b, i) => { b.place = i + 1; b.mancheElim = manche; });

  // ---- les mesures ----
  for (const bot of bots) {
    const s = mesures.strategies[bot.strategie];
    s.parties++;
    s.places += bot.place;
    if (bot.place === 1) s.victoires++;
    if (bot.place <= 4) s.top4++;
    s.manchesElim += bot.mancheElim;
    const equipe = equipeDuBot(bot);
    const top = bot.place <= 4;
    for (const sy of equipe.synergies) {
      const f = mesures.familles[sy.nom] = mesures.familles[sy.nom] || { present: 0, top4: 0, palierMax: 0 };
      f.present++;
      if (top) f.top4++;
      f.palierMax = Math.max(f.palierMax, sy.s);
    }
    for (const j of equipe.joueurs) {
      for (const spec of j.specialisations || []) {
        const e = mesures.specs[spec] = mesures.specs[spec] || { present: 0, top4: 0 };
        e.present++;
        if (top) e.top4++;
      }
      if (j.relique) {
        const e = mesures.reliques[j.relique] = mesures.reliques[j.relique] || { present: 0, top4: 0 };
        e.present++;
        if (top) e.top4++;
      }
    }
    if (bot.aIcone) { mesures.icones.present++; if (top) mesures.icones.top4++; }
  }
}

/* ---- Le round-robin ---- */
const N = Number(process.argv[2]) || 400;
const mesures = {
  strategies: Object.fromEntries(NOMS_STRATEGIES.map((n) => [n, { parties: 0, places: 0, victoires: 0, top4: 0, manchesElim: 0 }])),
  familles: {}, specs: {}, reliques: {}, icones: { present: 0, top4: 0 }, diag: {},
};
for (let i = 0; i < N; i++) {
  // 8 stratégies par lobby, rotation pour que chacune joue autant
  const lobby = [...NOMS_STRATEGIES].sort(() => Math.random() - 0.5).slice(0, 8);
  unePartie(lobby, mesures);
}

console.log(`\n=== MÉTA — ${N} lobbies de 8 (${(N * 8)} parties de bot) ===\n`);
console.log("COMPOS — cible : top 4 entre 40 et 55 %");
const lignes = NOMS_STRATEGIES.map((n) => {
  const s = mesures.strategies[n];
  return { n, parties: s.parties, top4: 100 * s.top4 / s.parties, win: 100 * s.victoires / s.parties,
    place: s.places / s.parties, elim: s.manchesElim / s.parties };
}).sort((a, b) => b.top4 - a.top4);
for (const l of lignes) {
  const verdict = l.top4 > 55 ? "⚠️ DOMINANTE" : l.top4 < 40 ? "⚠️ MORTE" : "✓";
  console.log(`  ${l.n.padEnd(20)} top4 ${l.top4.toFixed(1).padStart(5)} % · win ${l.win.toFixed(1).padStart(4)} % · place moy ${l.place.toFixed(2)} · élim M${l.elim.toFixed(1)} ${verdict}`);
}
console.log("\nFAMILLES — taux de top 4 quand la famille est active (cible : aucune poubelle)");
const fams = Object.entries(mesures.familles).filter(([, f]) => f.present >= 30)
  .map(([nom, f]) => ({ nom, taux: 100 * f.top4 / f.present, present: f.present, palier: f.palierMax }))
  .sort((a, b) => b.taux - a.taux);
for (const f of fams) console.log(`  ${f.nom.padEnd(22)} ${f.taux.toFixed(1).padStart(5)} % top4 (${f.present} présences, palier max ${f.palier})`);
console.log("\nSPÉCIALISATIONS les plus présentes chez les top 4 (cible : < 60 % d'auto-include)");
const totalTop4 = NOMS_STRATEGIES.reduce((t, n) => t + mesures.strategies[n].top4, 0);
const specs = Object.entries(mesures.specs).map(([nom, e]) => ({ nom, tauxGagnants: 100 * e.top4 / totalTop4, present: e.present }))
  .sort((a, b) => b.tauxGagnants - a.tauxGagnants).slice(0, 10);
for (const s of specs) console.log(`  ${s.nom.padEnd(22)} dans ${s.tauxGagnants.toFixed(1).padStart(5)} % des équipes top 4`);
console.log("\nRELIQUES — taux de top 4 des porteurs");
for (const [nom, e] of Object.entries(mesures.reliques).sort((a, b) => b[1].top4 / b[1].present - a[1].top4 / a[1].present))
  console.log(`  ${nom.padEnd(26)} ${(100 * e.top4 / e.present).toFixed(1).padStart(5)} % top4 (${e.present})`);
console.log("\nDIAGNOSTIC — valeur de plateau (somme des notes) et éco à M8 / M12 :");
for (const [n, d] of Object.entries(mesures.diag)) {
  const moy = (t) => t.length ? (t.reduce((a, b) => a + b, 0) / t.length).toFixed(0) : "—";
  console.log(`  ${n.padEnd(20)} plateau M8 ${moy(d.m8).padStart(4)} · M12 ${moy(d.m12).padStart(4)} · or M8 ${moy(d.or8).padStart(3)} · niveau M8 ${moy(d.niv8)}`);
}
console.log(`\nICÔNES (approximation) : porteurs top 4 à ${(100 * mesures.icones.top4 / Math.max(1, mesures.icones.present)).toFixed(1)} % (${mesures.icones.present} présences)`);
