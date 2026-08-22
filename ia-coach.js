/* ============================================================
   ONZE — LES COACHS IA DE LA PARTIE RÉELLE (sprint post-playtest).
   Les 7 IA jouent les stratégies des bots archétypaux du banc méta
   (simulations/meta.js) : économie complète — or, intérêts, XP,
   chasse aux paires, École cible, relances, staff en spécialisations,
   alignement des meilleurs. Elles piochent dans le MÊME pool que le
   joueur (chaque copie prise est enregistrée dans coach.copiesPrises,
   la conservation des 1344 copies reste vraie).
   TROIS DIFFICULTÉS — de l'intelligence, jamais de triche de stats :
   amateur  : scoring bruité, presque pas de relances, zéro discipline
              d'intérêts, staff posé au hasard ;
   pro      : le banc méta tel quel (défaut) ;
   legende  : scoring affûté, relances larges, discipline totale.
   Utilisé par partie.html ET par simulations/difficulte.js (node).
   ============================================================ */
const ONZE_IA = (() => {
  /* La stratégie de chaque club (identité assumée : l'École affichée
     du club est son École cible). Les courbes : aggro (tempo), flex,
     reroll (paires low-cost), eco (intérêts), fast8 (niveaux). */
  const STRATEGIES = {
    "Fortezza Nero": { ecoles: ["Catenaccio"], courbe: "flex", bus: true },
    "La Masia Rebelle": { ecoles: ["Tiki-Taka", "Les Internationaux"], courbe: "flex" },
    "Union Bitume": { ecoles: ["École de la Rue"], courbe: "reroll" },
    "Royal Toundra": { ecoles: ["Kick & Rush"], courbe: "aggro" },
    "Clockwork XI": { ecoles: ["Football Total"], courbe: "fast8" },
    "Barrio Bravo": { ecoles: ["La Grinta"], courbe: "flex" },
    "Le Consortium": { ecoles: ["Les Pros"], courbe: "eco" },
  };
  const DIFFICULTES = {
    // amateur : achète beaucoup mais au hasard, n'aligne pas ses meilleurs,
    // plafonne au niveau 6 — le tempo brouillon d'un débutant
    amateur: { scorePaire: 4, bonusEcole: 2, bruit: 7, relancesPlafond: 1, planchers: false,
      staffMalin: false, alignMalin: false, niveauMax: 5, pivote: false },
    // pro : le banc méta discipliné (défaut)
    pro: { scorePaire: 10, bonusEcole: 6, bruit: 3, relancesPlafond: 12, planchers: true,
      staffMalin: true, alignMalin: true, niveauMax: 10, pivote: false },
    // légende : le pro affûté — paires plus chères, École mieux tenue,
    // et surtout une montée en NIVEAUX agressive (plus de titulaires,
    // plus tôt). Leçon d'ablation : la diversité des comportements fait
    // la force du lobby — pas de « pivot » qui groupe les IA.
    legende: { scorePaire: 12, bonusEcole: 7, bruit: 3, relancesPlafond: 12, planchers: true,
      staffMalin: true, alignMalin: true, niveauMax: 10, pivote: false, xpAgressif: true, courbesSures: true },
    // le profil FIGÉ du bot « optimiseur » des simulations de calibrage —
    // jamais proposé au joueur, jamais retouché avec les niveaux
    optimiseur: { scorePaire: 13, bonusEcole: 7, bruit: 0, relancesPlafond: 14, planchers: true,
      staffMalin: true, alignMalin: true, niveauMax: 10, pivote: false, alignSynergie: true },
  };
  /* Les réservistes de départ des IA (coût 0, hors pool) — un espace de
     noms par club, jamais ceux du joueur ni du pool. */
  const STARTERS_IA = {
    "Fortezza Nero": ["Enzo", "Furio", "Santo", "Aldo", "Nino F."],
    "La Masia Rebelle": ["Pau", "Biel", "Quim", "Jordi", "Cesc"],
    "Union Bitume": ["Driss", "Kylian B.", "Sofiane", "Wesh", "Tonio"],
    "Royal Toundra": ["Sven", "Olaf", "Magnus", "Bjorn", "Nils"],
    "Clockwork XI": ["Daan", "Stijn", "Roel", "Bram", "Coen"],
    "Barrio Bravo": ["Chucho", "Pancho", "Rulo", "Tigre", "Beto"],
    "Le Consortium": ["Serge", "Hervé", "Patrice", "Gilles", "Yvon"],
  };
  const MEMBRES_STAFF = ["Prépa physique", "Coach mental", "Analyste vidéo", "Coach de finition",
    "Coach technique", "Kiné", "Adjoint tactique", "Scout"];
  const STAFF_PREFERE = {
    "Fortezza Nero": ["Analyste vidéo", "Adjoint tactique"], "La Masia Rebelle": ["Adjoint tactique", "Scout"],
    "Union Bitume": ["Coach technique", "Coach de finition"], "Royal Toundra": ["Coach de finition", "Prépa physique"],
    "Clockwork XI": ["Kiné", "Adjoint tactique"], "Barrio Bravo": ["Coach mental", "Prépa physique"],
    "Le Consortium": ["Scout", "Analyste vidéo"],
  };

  const hasard = (t) => t[Math.floor(Math.random() * t.length)];

  function initCoach(coach) {
    const postes = ["GAR", "DÉF", "DÉF", "MIL", "ATT"];
    const noms = STARTERS_IA[coach.nom] || ["Rémi", "Jojo", "Fred", "Léon", "Marco"];
    coach.etatIA = {
      or: 0, niveau: 3, xp: 0,
      effectif: postes.map((poste, i) => ({ nom: noms[i], cout: 0, poste, ecole: "", archetype: "", unique: null, etoiles: 1 })),
      staff: [], sacStaff: null,
    };
    coach.copiesPrises = coach.copiesPrises || [];
  }

  /* Le plancher d'intérêts visé par la courbe (dépense panique sous
     35 de prestige — aucun coach ne meurt riche) */
  function plancher(courbe, manche, coach, regles) {
    if (!regles.planchers) return 0;
    if (coach.prestige <= 35) return 0;
    if (courbe === "aggro") return 0;
    if (courbe === "eco") return manche <= 9 ? Math.min(30, manche * 4) : 0;
    if (courbe === "fast8") return manche <= 7 ? Math.min(30, manche * 4) : 0;
    if (courbe === "reroll") return manche <= 5 ? 14 : 0;
    return 10;
  }

  function tirerCarte(niveau, pool, ECO) {
    const odds = ECO.ODDS_PAR_NIVEAU[Math.min(niveau, 10)];
    const t = Math.random() * 100;
    let cumul = 0, cout = 1;
    for (let c = 0; c < 5; c++) { cumul += odds[c]; if (t < cumul) { cout = c + 1; break; } }
    let candidats = pool.filter((j) => j.cout === cout);
    if (!candidats.length) candidats = pool;
    return candidats.length ? hasard(candidats) : null;
  }
  function ouvrirBoutique(niveau, pool, ECO) {
    const cartes = [];
    for (let i = 0; i < 5; i++) {
      const carte = tirerCarte(niveau, pool, ECO);
      if (carte) { pool.splice(pool.indexOf(carte), 1); cartes.push(carte); }
    }
    return cartes;
  }
  const rendreAuPool = (cartes, pool) => { for (const c of cartes) if (c) pool.push(c); };

  /* Une manche de mercato pour un coach IA : revenus, XP, achats,
     relances, fusions, staff — sur le pool PARTAGÉ. */
  function jouerManche(coach, pool, manche, ctx) {
    const { ECO, M, difficulte } = ctx;
    const regles = DIFFICULTES[coach.difficultePerso || difficulte] || DIFFICULTES.pro;
    let strat = coach.strategiePerso || STRATEGIES[coach.nom] || { ecoles: [coach.ecole], courbe: "flex" };
    // en légende, plus de courbe suicidaire : les clubs à courbe fragile
    // (fast8, eco) jouent flex — choisir sa courbe est de l'intelligence
    if (regles.courbesSures && (strat.courbe === "fast8" || strat.courbe === "eco"))
      strat = { ...strat, courbe: "flex" };
    const ia = coach.etatIA;

    // ---- les revenus (les mêmes règles que le joueur) ----
    ia.or += ECO.sponsors(ia.or) + ECO.droitsTV(manche) + ECO.bonusSerie(coach.serie || 0) +
      (manche > 3 && (coach.serie || 0) > 0 ? 1 : 0);
    ia.xp += ECO.XP_GRATUITE_PAR_MANCHE;
    while (ECO.XP_POUR_MONTER[ia.niveau] && ia.xp >= ECO.XP_POUR_MONTER[ia.niveau]) {
      ia.xp -= ECO.XP_POUR_MONTER[ia.niveau]; ia.niveau++;
    }

    // ---- le staff (symétrie avec le butin du joueur : amicaux + coupes) ----
    const recevoir = (nb) => { for (let i = 0; i < nb; i++) {
      if (!ia.sacStaff || !ia.sacStaff.length) ia.sacStaff = [...MEMBRES_STAFF].sort(() => Math.random() - 0.5);
      ia.staff.push(ia.sacStaff.pop());
    } };
    if (manche <= 3) recevoir(1);
    if (ECO.MANCHES_COUPE.includes(manche)) { recevoir(2); ia.or += 2; }

    const seuil = plancher(strat.courbe, manche, coach, regles);

    // ---- l'XP acheté, selon la courbe (plafonné par la difficulté) ----
    const viseNiveau = Math.min(regles.niveauMax,
      strat.courbe === "fast8" ? (manche >= 8 ? 9 : 4)
      : strat.courbe === "reroll" ? (manche >= 10 ? 7 : 5) : 9);
    while (ia.niveau < viseNiveau && ia.or - ECO.COUT_XP >= seuil &&
           (strat.courbe === "fast8" ? ia.or >= 10 && ia.effectif.length >= 6 : ia.or >= (regles.xpAgressif ? 10 : 14)) &&
           ECO.XP_POUR_MONTER[ia.niveau]) {
      ia.or -= ECO.COUT_XP;
      ia.xp += ECO.XP_PAR_ACHAT;
      while (ECO.XP_POUR_MONTER[ia.niveau] && ia.xp >= ECO.XP_POUR_MONTER[ia.niveau]) {
        ia.xp -= ECO.XP_POUR_MONTER[ia.niveau]; ia.niveau++;
      }
    }

    // ---- les achats scorés + relances ----
    const nbCopies = (nom) => ia.effectif.filter((j) => j.nom === nom && (j.etoiles || 1) === 1).length;
    // en légende, l'IA lit son plateau : les 2 Écoles les plus fournies
    // de son effectif comptent aussi comme cibles (le pivot d'un humain)
    let pivots = [];
    if (regles.pivote && manche >= 6) { // d'abord son École, le pivot vient avec l'info
      const comptes = {};
      for (const j of ia.effectif) if (j.ecole) comptes[j.ecole] = (comptes[j.ecole] || 0) + 1;
      pivots = Object.keys(comptes).sort((a, b) => comptes[b] - comptes[a]).slice(0, 2);
    }
    const viseEcole = (f) => strat.ecoles.includes(f.ecole) || pivots.includes(f.ecole);
    let boutique = ouvrirBoutique(ia.niveau, pool, ECO);
    const relancesMax = Math.min(regles.relancesPlafond,
      strat.courbe === "reroll" && manche >= 5 ? 12 : 3);
    for (let relance = 0; relance <= relancesMax; relance++) {
      let achete = true;
      while (achete) {
        achete = false;
        const scores = boutique.map((f, i) => f ? {
          f, i,
          // paires > École cible > valeur intrinsèque (le coût) > archétype,
          // avec une urgence de remplissage tant que le plateau est court
          score: nbCopies(f.nom) * regles.scorePaire + (viseEcole(f) ? regles.bonusEcole : 0) +
            (ia.effectif.some((j) => j.archetype === f.archetype) ? 2 : 0) +
            f.cout * 0.8 + (ia.effectif.length < 8 ? 4 : 0) +
            Math.random() * regles.bruit,
        } : null).filter(Boolean).filter((x) =>
          ia.or - x.f.cout >= (nbCopies(x.f.nom) || (ia.effectif.length < 7 && x.f.cout <= 2) ? 0 : seuil * 0.5));
        scores.sort((a, b) => b.score - a.score);
        const meilleur = scores[0];
        if (meilleur && (meilleur.score >= 4.5 || (viseEcole(meilleur.f) && meilleur.f.cout <= 3) ||
            (strat.courbe === "aggro" && meilleur.f.cout <= 3))) {
          ia.or -= meilleur.f.cout;
          ia.effectif.push({ ...meilleur.f, etoiles: 1 });
          coach.copiesPrises.push(boutique[meilleur.i]); // la copie du pool reste « prise »
          boutique[meilleur.i] = null;
          M.fusionnerEffectif(ia.effectif, []);
          achete = true;
        }
      }
      if (relance < relancesMax && ia.or - ECO.COUT_REFRESH >= seuil &&
          (strat.courbe === "reroll" ? ia.or >= 6 : ia.or >= 12)) {
        ia.or -= ECO.COUT_REFRESH;
        rendreAuPool(boutique, pool);
        boutique = ouvrirBoutique(ia.niveau, pool, ECO);
      } else break;
    }
    rendreAuPool(boutique.filter(Boolean), pool);

    // ---- le staff en spécialisations (par paires, préférés d'abord) ----
    if (regles.staffMalin) {
      const preferes = STAFF_PREFERE[coach.nom] || [];
      ia.staff.sort((a, b) => (preferes.includes(b) ? 1 : 0) - (preferes.includes(a) ? 1 : 0));
    } else ia.staff.sort(() => Math.random() - 0.5);
    while (ia.staff.length >= 2) {
      const porteurs = ia.effectif
        .filter((j) => ((j.staffCartes || []).length + (j.specialisations || []).length * 2) < 6)
        .sort((a, b) => regles.staffMalin
          ? (b.cout * (b.etoiles || 1)) - (a.cout * (a.etoiles || 1))
          : Math.random() - 0.5);
      const cible = porteurs[0];
      if (!cible) break;
      const r1 = M.assignerCarte(cible, ia.staff[0]);
      if (!r1.ok) break;
      ia.staff.shift();
      const r2 = M.assignerCarte(cible, ia.staff[0]);
      if (r2.ok) ia.staff.shift();
      else break;
    }
  }

  /* L'alignement : les meilleurs de l'effectif, l'École cible favorisée,
     1 gardien max, bus du Catenaccio (tout le monde derrière). */
  function equipeDe(coach, ctx) {
    const { ECO, M } = ctx;
    const regles = DIFFICULTES[coach.difficultePerso || ctx.difficulte] || DIFFICULTES.pro;
    const strat = coach.strategiePerso || STRATEGIES[coach.nom] || { ecoles: [coach.ecole], courbe: "flex" };
    const ia = coach.etatIA;
    const max = ECO.TITULAIRES_PAR_NIVEAU[ia.niveau];
    // un amateur n'aligne pas toujours ses meilleurs (fort bruit) ;
    // une légende aligne ses BLOCS de synergies ensemble
    const nbMemeEcole = {};
    if (regles.alignSynergie) for (const j of ia.effectif) if (j.ecole) nbMemeEcole[j.ecole] = (nbMemeEcole[j.ecole] || 0) + 1;
    const valeur = (j) => j.cout * (j.etoiles || 1) * (strat.ecoles.includes(j.ecole) ? 1.3 : 1) +
      (regles.alignSynergie ? (nbMemeEcole[j.ecole] || 0) * 0.6 : 0) +
      (regles.alignMalin ? 0 : Math.random() * 10);
    const tri = [...ia.effectif].sort((a, b) => valeur(b) - valeur(a));
    const gardien = tri.filter((j) => j.poste === "GAR")[0];
    const champ = tri.filter((j) => j.poste !== "GAR");
    const titulaires = [...(gardien ? [gardien] : []), ...champ].slice(0, max)
      .map((j) => ({ ...j, ligne: undefined }));
    if (strat.bus) {
      const dePointe = titulaires.filter((j) => j.poste === "ATT")[0];
      for (const j of titulaires) if (j.poste !== "GAR" && j !== dePointe) j.ligne = "DÉF";
    }
    return M.equipeDepuisFiches(coach.nom, coach.nom, titulaires);
  }

  /* L'élimination : les copies retournent au pool (le registre est
     coach.copiesPrises — la conservation des 1344 reste exacte). */
  function liberer(coach, pool) {
    for (const fiche of coach.copiesPrises || []) pool.push(fiche);
    coach.copiesPrises = [];
    if (coach.etatIA) coach.etatIA.effectif = [];
  }

  return { initCoach, jouerManche, equipeDe, liberer, STRATEGIES, DIFFICULTES };
})();
if (typeof module !== "undefined") module.exports = ONZE_IA;
