/* ============================================================
   ONZE — Les DONNÉES d'économie (design/economie.md, copie TFT).
   ------------------------------------------------------------
   La source de vérité UNIQUE des chiffres d'économie, partagée par
   le jeu (partie.html) et les simulations (simulations/*.js) —
   plus jamais de constantes dupliquées à garder synchronisées.
   Toute retouche d'équilibrage économique se fait ICI (et se
   re-mesure avec simulations/parties.js).
   ============================================================ */

const ONZE_ECO = {
  /* ---- le mercato ---- */
  COUT_REFRESH: 2,
  COUT_XP: 4,
  XP_PAR_ACHAT: 4,
  XP_GRATUITE_PAR_MANCHE: 2,
  TAILLE_BOUTIQUE: 5,
  TAILLE_BANC: 9,
  // le pool de copies partagé (30/25/18/10/9 = les sacs TFT)
  POOL_PAR_COUT: { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 },
  // les odds officielles par niveau de club
  ODDS_PAR_NIVEAU: {
    3: [75, 25, 0, 0, 0], 4: [55, 30, 15, 0, 0], 5: [45, 33, 20, 2, 0],
    6: [30, 40, 25, 5, 0], 7: [19, 30, 40, 10, 1], 8: [18, 25, 32, 22, 3],
    9: [10, 20, 25, 35, 10], 10: [5, 10, 20, 40, 25],
  },
  XP_POUR_MONTER: { 3: 6, 4: 10, 5: 20, 6: 36, 7: 60, 8: 68, 9: 68 },
  TITULAIRES_PAR_NIVEAU: { 3: 5, 4: 6, 5: 7, 6: 8, 7: 9, 8: 10, 9: 11, 10: 11 },

  /* ---- les revenus ---- */
  droitsTV: (manche) => [2, 2, 3, 4][manche - 1] ?? 5,
  // sponsors (les intérêts) : +1M par tranche de 10M, plafonné
  sponsors: (or, plafond = 5) => Math.min(Math.floor(or / 10), plafond),
  // primes de série (victoires OU défaites) : 3-4 → 1, 5 → 2, 6+ → 3
  bonusSerie: (serie) => {
    const abs = Math.abs(serie);
    return abs >= 6 ? 3 : abs >= 5 ? 2 : abs >= 3 ? 1 : 0;
  },

  /* ---- la partie ---- */
  PRESTIGE_DEPART: 40, // calibré en simulation
  DERNIERE_MANCHE_AMICALE: 3,
  MANCHES_COUPE: [6, 9, 12, 15],
  MANCHES_PHILOSOPHIE: [4, 7, 10],
  MANCHES_MERCATO_HIVER: [8, 13],
  // décision n°20 : le nombre de phases d'un match suit les enjeux
  phasesDeManche: (manche) => (manche <= 3 ? 4 : manche <= 9 ? 6 : 8),

  /* ---- la courbe des IA (LE réglage calibré par simulations/parties.js) ---- */
  niveauIA: (manche) => Math.min(3 + Math.floor(manche / 4), 9),
  budgetIA: (manche) => Math.min(1 + 1.48 * manche, 22),
};

if (typeof module !== "undefined") module.exports = ONZE_ECO;
if (typeof window !== "undefined") window.ONZE_ECO = ONZE_ECO;
