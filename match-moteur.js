/* ============================================================
   ONZE — Moteur de match (phases de possession) + synergies
   ------------------------------------------------------------
   Utilisé par match.html (navigateur) ET par les scripts de
   calibrage (node). Aucune dépendance.

   Décision n°5 : match par phases de possession, duels lisibles,
   tirs façon xG, dégâts de prestige = écart de buts.
   Décision n°3 : synergies École + archétype, paliers 2/4/6.
   Les 71 joueurs vivent dans design/joueurs.json.
   ============================================================ */

/* ---- Petites aides ---- */
const de = (max) => Math.floor(Math.random() * max) + 1; // dé de 1 à max
const hasard = (tableau) => tableau[Math.floor(Math.random() * tableau.length)];
const parPoste = (equipe, poste) => equipe.joueurs.filter((j) => j.poste === poste);
// Variantes de textes pour que deux matchs ne se racontent pas pareil
const varie = (...variantes) => hasard(variantes);

/* ============================================================
   STATS DES JOUEURS — dérivées du coût et du poste
   Talent de base = 3 + coût (de 4 à 8). À affiner en playtest.
   ============================================================ */
function statsJoueur(j) {
  const T = 3 + j.cout;
  switch (j.poste) {
    case "GAR": return { att: 1, def: T + 1 };
    case "DÉF": return { att: Math.max(1, T - 3), def: T };
    case "MIL": return { att: T - 1, def: T - 1 };
    case "ATT": return { att: T, def: Math.max(1, T - 4) };
    default: return { att: 1, def: 1 };
  }
}

/* ============================================================
   SYNERGIES — paliers 2/4/6 (s = 1, 2 ou 3)
   Chaque École et chaque archétype a un effet distinct, fidèle
   à son identité (intentions : design/decisions.md).

   Écoles :
   - Tiki-Taka      : possession — bonus au duel du milieu
   - Catenaccio     : défense renforcée + chance de contre éclair
   - Kick & Rush    : ballon long — peut sauter le duel du milieu
   - La Grinta      : bonus à tout quand le club est mené
   - L'Académie     : montée en puissance en seconde période
   - École de la Rue: un dribble peut relancer une percée ratée
   - Football Total : polyvalence — petit bonus partout
   Archétypes :
   - Mur       : gardien et surface plus durs à passer
   - Sentinelle: peut intercepter le tir adverse avant qu'il parte
   - Piston    : bonus à la percée (les couloirs)
   - Moteur    : bonus au duel du milieu
   - Virtuose  : geste de classe — un tir peut ignorer la moitié de la parade
   - Créateur  : occasions mieux préparées (bonus xG à la passe)
   - Finisseur : tirs plus dangereux
   - Capitaine : petit bonus à tous les duels de l'équipe
   ============================================================ */
function palier(nb) { return nb >= 6 ? 3 : nb >= 4 ? 2 : nb >= 2 ? 1 : 0; }

// Compte les Écoles et archétypes actifs d'une équipe.
// Le Caméléon (L'Enfant du Pays) adopte l'École majoritaire.
function calculerSynergies(equipe) {
  const ecoles = {}, archetypes = {};
  for (const j of equipe.joueurs) {
    if (j.ecole !== "Caméléon") ecoles[j.ecole] = (ecoles[j.ecole] || 0) + 1;
    archetypes[j.archetype] = (archetypes[j.archetype] || 0) + 1;
  }
  const cameleons = equipe.joueurs.filter((j) => j.ecole === "Caméléon").length;
  if (cameleons > 0 && Object.keys(ecoles).length > 0) {
    const majoritaire = Object.keys(ecoles).sort((a, b) => ecoles[b] - ecoles[a])[0];
    ecoles[majoritaire] += cameleons;
  }
  const actives = [];
  for (const [nom, nb] of Object.entries(ecoles)) {
    if (palier(nb) > 0) actives.push({ nom, nb, s: palier(nb), type: "ecole" });
  }
  for (const [nom, nb] of Object.entries(archetypes)) {
    if (palier(nb) > 0) actives.push({ nom, nb, s: palier(nb), type: "archetype" });
  }
  return actives;
}

const aSynergie = (equipe, nom) => equipe.synergies.find((sy) => sy.nom === nom);
const s = (equipe, nom) => { const sy = aSynergie(equipe, nom); return sy ? sy.s : 0; };

/* ---- Bonus contextuels appliqués aux trois duels ----
   Chaque bonus est listé avec sa source pour pouvoir raconter
   « la synergie X a fait la différence » quand elle décide du duel. */
function bonusCommuns(equipe, ctx) {
  const liste = [];
  const capitaine = s(equipe, "Capitaine");
  if (capitaine) liste.push({ nom: "Capitaine", valeur: 1 * capitaine });
  const total = s(equipe, "Football Total");
  if (total) liste.push({ nom: "Football Total", valeur: 1 * total });
  const grinta = s(equipe, "La Grinta");
  if (grinta && ctx.scoreDe(equipe) < ctx.scoreAdverse(equipe)) {
    liste.push({ nom: "La Grinta", valeur: 2 * grinta });
  }
  const academie = s(equipe, "L'Académie");
  if (academie && ctx.numero >= 5) liste.push({ nom: "L'Académie", valeur: 1.5 * academie });
  return liste;
}
function bonusMilieu(equipe, ctx) {
  const liste = bonusCommuns(equipe, ctx);
  const tiki = s(equipe, "Tiki-Taka");
  if (tiki) liste.push({ nom: "Tiki-Taka", valeur: 1.5 * tiki });
  const moteur = s(equipe, "Moteur");
  if (moteur) liste.push({ nom: "Moteur", valeur: 2 * moteur });
  return liste;
}
function bonusPercee(equipe, ctx) {
  const liste = bonusCommuns(equipe, ctx);
  const piston = s(equipe, "Piston");
  if (piston) liste.push({ nom: "Piston", valeur: 2 * piston });
  const createur = s(equipe, "Créateur");
  if (createur) liste.push({ nom: "Créateur", valeur: 1.5 * createur });
  return liste;
}
function bonusDefense(equipe, ctx) {
  const liste = bonusCommuns(equipe, ctx);
  const cate = s(equipe, "Catenaccio");
  if (cate) liste.push({ nom: "Catenaccio", valeur: 1.5 * cate });
  return liste;
}
const totalBonus = (liste) => liste.reduce((t, b) => t + b.valeur, 0);
// La synergie qui a « fait la différence » : la plus grosse contribution,
// seulement si le duel s'est joué à moins que le total des bonus.
function synergieDecisive(liste, marge) {
  if (liste.length === 0) return null;
  const meilleur = liste.slice().sort((a, b) => b.valeur - a.valeur)[0];
  // On ne raconte la synergie que si le duel s'est joué dans sa marge,
  // et pas à chaque fois : c'est un moment fort, pas un bruit de fond.
  if (marge > meilleur.valeur || Math.random() > 0.4) return null;
  return meilleur.nom;
}

/* ============================================================
   CRÉATION D'ÉQUIPE — depuis les données de design/joueurs.json
   ============================================================ */
// Depuis des fiches joueurs déjà en main (le mercato s'en sert)
function equipeDepuisFiches(nomClub, coach, fiches) {
  const joueurs = fiches.map((fiche) => ({ ...fiche, ...statsJoueur(fiche) }));
  const equipe = { nom: nomClub, coach, joueurs };
  equipe.synergies = calculerSynergies(equipe);
  return equipe;
}

// Depuis des noms cherchés dans design/joueurs.json (les équipes de test)
function creerEquipe(nomClub, coach, noms, tousLesJoueurs) {
  const fiches = noms.map((nom) => {
    const fiche = tousLesJoueurs.find((j) => j.nom === nom);
    if (!fiche) throw new Error("Joueur introuvable : " + nom);
    return fiche;
  });
  return equipeDepuisFiches(nomClub, coach, fiches);
}

/* ============================================================
   RÉSOLUTION D'UNE PHASE — trois duels lisibles :
   1. MILIEU  — qui prend le ballon ? (Kick & Rush peut le sauter)
   2. PERCÉE  — l'attaque passe-t-elle ? (la Rue peut relancer)
   3. TIR     — façon xG (Sentinelle, Virtuose, Mur s'en mêlent)
   Un arrêt du Catenaccio peut déclencher un contre immédiat.
   ============================================================ */
function tenterTir(attaque, defense, ctx, evenements) {
  const finisseur = hasard(parPoste(attaque, "ATT").length ? parPoste(attaque, "ATT") : attaque.joueurs);
  const gardien = parPoste(defense, "GAR")[0];

  // La Sentinelle peut couper la trajectoire avant le tir
  const sentinelle = s(defense, "Sentinelle");
  if (sentinelle && Math.random() < 0.10 * sentinelle) {
    const defenseur = hasard(parPoste(defense, "DÉF"));
    evenements.push({ texte: `${finisseur.nom} arme son tir… mais ${defenseur.nom} surgit et coupe la trajectoire !`, synergie: "Sentinelle", equipe: defense.nom });
    return false;
  }

  let qualite = finisseur.att + de(8);
  qualite += 1.5 * s(attaque, "Finisseur") + 1 * s(attaque, "Créateur");
  let parade = gardien.def + de(6) + 1.5 * s(defense, "Mur");

  // Le Virtuose peut sortir le geste de classe
  const virtuose = s(attaque, "Virtuose");
  let classe = false;
  if (virtuose && Math.random() < 0.15 * virtuose) { parade = parade / 2; classe = true; }

  if (qualite > parade) {
    evenements.push({
      but: true, buteur: finisseur.nom, equipe: attaque.nom,
      texte: classe
        ? `${finisseur.nom} invente un geste de classe — le gardien est cloué sur place…`
        : `${finisseur.nom} se présente face à ${gardien.nom}…`,
      cri: `BUUUT de ${finisseur.nom} pour ${attaque.nom} !`,
      synergie: classe ? "Virtuose" : synergieDecisive(
        [{ nom: "Finisseur", valeur: 1.5 * s(attaque, "Finisseur") }, { nom: "Créateur", valeur: 1 * s(attaque, "Créateur") }].filter((b) => b.valeur > 0),
        qualite - parade
      ),
    });
    return true;
  }
  evenements.push({ texte: varie(
    `${finisseur.nom} frappe… mais ${gardien.nom} s'envole et détourne ! Quel arrêt !`,
    `${finisseur.nom} arme sa frappe… ${gardien.nom} gagne son face-à-face du bout des gants !`,
    `La tentative de ${finisseur.nom} est cadrée… mais ${gardien.nom} dit non !`
  ), equipe: defense.nom, synergie: s(defense, "Mur") && parade - qualite <= 1 * s(defense, "Mur") ? "Mur" : null });
  return false;
}

function resoudrePhase(eqA, eqB, ctx) {
  const evenements = [];

  // --- Duel n°1 : le milieu (ou ballon long du Kick & Rush) ---
  let attaque = null, porteurTexte = null;
  for (const eq of [eqA, eqB]) {
    const kr = s(eq, "Kick & Rush");
    if (!attaque && kr && Math.random() < 0.12 * kr) {
      attaque = eq;
      porteurTexte = `Longue transversale de ${eq.nom} par-dessus tout le monde — pur Kick & Rush !`;
      evenements.push({ texte: porteurTexte, synergie: "Kick & Rush", equipe: eq.nom });
    }
  }
  if (!attaque) {
    const bA = bonusMilieu(eqA, ctx), bB = bonusMilieu(eqB, ctx);
    const forceA = parPoste(eqA, "MIL").reduce((t, j) => t + j.att + j.def, 0) + totalBonus(bA) + de(8);
    const forceB = parPoste(eqB, "MIL").reduce((t, j) => t + j.att + j.def, 0) + totalBonus(bB) + de(8);
    attaque = forceA >= forceB ? eqA : eqB;
    const marge = Math.abs(forceA - forceB);
    const sy = synergieDecisive(attaque === eqA ? bA : bB, marge);
    const porteur = hasard(parPoste(attaque, "MIL").length ? parPoste(attaque, "MIL") : attaque.joueurs);
    evenements.push({ texte: varie(
      `${porteur.nom} gagne la bataille du milieu pour ${attaque.nom}.`,
      `${porteur.nom} ratisse le ballon et met ${attaque.nom} dans le sens du jeu.`,
      `${porteur.nom} dicte le tempo — possession pour ${attaque.nom}.`,
      `${porteur.nom} s'arrache dans l'entrejeu et oriente pour ${attaque.nom}.`
    ), synergie: sy, equipe: attaque.nom });
  }
  const defense = attaque === eqA ? eqB : eqA;

  // --- Duel n°2 : la percée (l'École de la Rue peut relancer) ---
  const bAtt = bonusPercee(attaque, ctx), bDef = bonusDefense(defense, ctx);
  const forceAtt = parPoste(attaque, "ATT").reduce((t, j) => t + j.att, 0)
    + parPoste(attaque, "MIL").reduce((t, j) => t + j.att, 0) + totalBonus(bAtt);
  const forceDef = parPoste(defense, "DÉF").reduce((t, j) => t + j.def, 0) + totalBonus(bDef);
  let percee = forceAtt + de(10) > forceDef + de(10);
  if (!percee) {
    const rue = s(attaque, "École de la Rue");
    if (rue && Math.random() < 0.20 * rue) {
      const dribbleur = hasard(attaque.joueurs.filter((j) => j.poste !== "GAR"));
      evenements.push({ texte: `${dribbleur.nom} est bloqué… petit pont ! La rue ne s'arrête jamais.`, synergie: "École de la Rue", equipe: attaque.nom });
      percee = forceAtt + de(10) > forceDef + de(10);
    }
  }

  let butMarque = false;
  if (percee) {
    butMarque = tenterTir(attaque, defense, ctx, evenements);
  } else {
    const defenseur = hasard(parPoste(defense, "DÉF"));
    const sy = totalBonus(bDef) >= 3 && Math.random() < 0.25
      ? bDef.slice().sort((a, b) => b.valeur - a.valeur)[0].nom : null;
    evenements.push({ texte: varie(
      `${defenseur.nom} ferme la porte — la défense de ${defense.nom} tient bon.`,
      `${defenseur.nom} jaillit et coupe l'attaque net. Rien ne passe.`,
      `Tacle parfait de ${defenseur.nom} — le stade apprécie.`,
      `${defense.nom} recule en bloc, ${defenseur.nom} dégage le danger.`
    ), synergie: sy, equipe: defense.nom });
  }

  // --- Contre éclair du Catenaccio après un arrêt ---
  if (!butMarque && percee !== null) {
    const cate = s(defense, "Catenaccio");
    if (cate && Math.random() < 0.10 * cate) {
      evenements.push({ texte: `Récupération et contre éclair de ${defense.nom} — tout le monde est pris de vitesse !`, synergie: "Catenaccio", equipe: defense.nom });
      butMarque = tenterTir(defense, attaque, ctx, evenements) || butMarque;
    }
  }
  return evenements;
}

/* ============================================================
   MATCH COMPLET — calcule tout d'avance ; l'interface rejoue
   ensuite phase par phase (~40 s au total).
   ============================================================ */
const NB_PHASES = 8;
const MINUTES = [7, 19, 31, 44, 52, 63, 77, 89];

function simulerMatch(eqA, eqB) {
  let scoreA = 0, scoreB = 0;
  const phases = [];
  const ctx = {
    numero: 0,
    scoreDe: (eq) => (eq === eqA ? scoreA : scoreB),
    scoreAdverse: (eq) => (eq === eqA ? scoreB : scoreA),
  };
  for (let n = 1; n <= NB_PHASES; n++) {
    ctx.numero = n;
    const evenements = resoudrePhase(eqA, eqB, ctx);
    for (const ev of evenements) {
      if (ev.but) { if (ev.equipe === eqA.nom) scoreA++; else scoreB++; }
    }
    phases.push({ numero: n, minute: MINUTES[n - 1], evenements, scoreA, scoreB });
  }
  return { phases, scoreA, scoreB, ecart: Math.abs(scoreA - scoreB) };
}

/* ---- Export navigateur + node ---- */
const ONZE = { creerEquipe, equipeDepuisFiches, simulerMatch, calculerSynergies, statsJoueur, NB_PHASES };
if (typeof module !== "undefined") module.exports = ONZE;
if (typeof window !== "undefined") window.ONZE = ONZE;
