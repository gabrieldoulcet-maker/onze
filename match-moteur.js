/* ============================================================
   ONZE — Moteur de match v2 (phases de possession + synergies v2)
   ------------------------------------------------------------
   Utilisé par match.html et draft.html (navigateur) ET par les
   scripts de calibrage (node). Aucune dépendance.

   Références de design :
   - design/synergies.md : 11 Écoles (paliers variés), 12 archétypes,
     12 traits Uniques. Ici on implémente les effets DE MATCH ;
     les effets d'économie/manches (Académie palier 2, Revanchards,
     Pros, quêtes, Ferveur…) viendront avec les manches.
   - design/joueurs.json : les 71 joueurs (source de vérité).
   Toutes les valeurs chiffrées sont volontairement simples et
   regroupées ici — l'équilibrage sérieux viendra plus tard.
   ============================================================ */

/* ---- Petites aides ---- */
const de = (max) => Math.floor(Math.random() * max) + 1;
const hasard = (tableau) => tableau[Math.floor(Math.random() * tableau.length)];
const parPoste = (equipe, poste) => equipe.joueurs.filter((j) => j.poste === poste);
const proba = (p) => Math.random() < p;
// Variantes de textes pour que deux matchs ne se racontent pas pareil
const varie = (...variantes) => hasard(variantes);

/* Casting tournant : on choisit de préférence un joueur encore peu mis
   en scène dans ce match, pour que le récit (et demain l'animation)
   fasse vivre toute l'équipe au lieu de radoter sur deux noms. */
function choisirParmi(equipe, ctx, candidats) {
  if (!candidats || candidats.length === 0) return null;
  const apparitions = ctx.etat[equipe.nom].apparitions;
  let minimum = Infinity;
  for (const j of candidats) minimum = Math.min(minimum, apparitions[j.nom] || 0);
  const frais = candidats.filter((j) => (apparitions[j.nom] || 0) <= minimum);
  const choix = hasard(frais);
  apparitions[choix.nom] = (apparitions[choix.nom] || 0) + 1;
  return choix;
}

/* Dégâts de prestige du perdant — source unique pour le jeu ET l'affichage */
function degatsPrestige(ecart) { return ecart > 0 ? 6 + 3 * ecart : 0; }

/* ============================================================
   STATS DES JOUEURS — dérivées du coût et du poste
   Talent de base = 3 + coût (de 4 à 8). À affiner en playtest.
   ============================================================ */
function statsJoueur(j) {
  const T = 3 + j.cout;
  // Montée en étoiles : 1★ → 2★ (Titulaire) → 3★ (Légende), façon TFT
  const facteur = [1, 1.8, 3.2][(j.etoiles || 1) - 1] || 1;
  const arrondi = (x) => Math.round(x * facteur);
  switch (j.poste) {
    case "GAR": return { att: 1, def: arrondi(T + 1) };
    case "DÉF": return { att: arrondi(Math.max(1, T - 3)), def: arrondi(T) };
    case "MIL": return { att: arrondi(T - 1), def: arrondi(T - 1) };
    case "ATT": return { att: arrondi(T), def: arrondi(Math.max(1, T - 4)) };
    default: return { att: 1, def: 1 };
  }
}

/* Fusion des copies au mercato : 3 exemplaires identiques → une étoile
   de plus (3★ maximum). Modifie terrain/banc sur place et renvoie la
   liste des fusions, pour que l'interface les mette en scène. */
function fusionnerEffectif(terrain, banc) {
  const fusions = [];
  let encore = true;
  while (encore) {
    encore = false;
    const tout = [
      ...terrain.map((j) => ({ j, liste: terrain })),
      ...banc.map((j) => ({ j, liste: banc })),
    ];
    const groupes = {};
    for (const e of tout) {
      const cle = e.j.nom + "|" + (e.j.etoiles || 1);
      (groupes[cle] = groupes[cle] || []).push(e);
    }
    for (const cle of Object.keys(groupes)) {
      const groupe = groupes[cle];
      if (groupe.length >= 3 && (groupe[0].j.etoiles || 1) < 3) {
        // On garde de préférence l'exemplaire déjà titulaire
        groupe.sort((a, b) => (a.liste === terrain ? 0 : 1) - (b.liste === terrain ? 0 : 1));
        const garde = groupe[0].j;
        garde.etoiles = (garde.etoiles || 1) + 1;
        for (const e of groupe.slice(1, 3)) e.liste.splice(e.liste.indexOf(e.j), 1);
        fusions.push({ nom: garde.nom, etoiles: garde.etoiles });
        encore = true;
        break;
      }
    }
  }
  return fusions;
}

/* ============================================================
   SYNERGIES v2 — paliers variés par famille (design/synergies.md)
   s = nombre de paliers atteints (0 = famille inactive).
   Cas spécial Capitaines : 1 seul = aura ; 2+ = guerre des égos (malus).
   ============================================================ */
const PALIERS_ECOLES = {
  "La Grinta": [3, 6, 9],
  "Catenaccio": [2, 4, 6, 9],
  "Kick & Rush": [2, 5],
  "École de la Rue": [1, 3, 5, 7, 10],
  "Tiki-Taka": [3, 5, 7],
  "Football Total": [3, 5, 7, 10],
  "L'Académie": [2, 3],
  "Les Internationaux": [2, 3],
  "Le Douzième Homme": [3, 4, 6],
  "Les Pros": [2, 3],
  "Les Revanchards": [2, 3, 4],
};
const PALIERS_ARCHETYPES = {
  "Mur": [2, 4, 6],
  "Moteur": [2, 4, 6],
  "Sentinelle": [2, 4, 6],
  "Virtuose": [2, 3, 4, 5],
  "Finisseur": [2, 3, 4, 5],
  "Créateur": [2, 3, 4, 5],
  "Piston": [2, 3, 4, 5],
  "Renard": [2, 3, 4, 5],
  "Chanceux": [2, 4],
  "Guerrier": [2, 4, 6],
  "Mentor": [3, 5, 7],
  "Capitaine": [1],
};

function calculerSynergies(equipe) {
  const ecoles = {}, archetypes = {};
  for (const j of equipe.joueurs) {
    if (j.ecole) ecoles[j.ecole] = (ecoles[j.ecole] || 0) + 1;
    if (j.archetype) archetypes[j.archetype] = (archetypes[j.archetype] || 0) + 1;
  }
  // Ruud (« Le Professeur ») compte comme un Football Total de plus
  if (equipe.joueurs.some((j) => j.unique === "Le Professeur")) {
    ecoles["Football Total"] = (ecoles["Football Total"] || 0) + 1;
  }
  // Le Caméléon adopte l'École majoritaire et compte pour +1 dedans
  const nbCameleons = equipe.joueurs.filter((j) => j.unique === "Caméléon").length;
  if (nbCameleons > 0 && Object.keys(ecoles).length > 0) {
    const majoritaire = Object.keys(ecoles).sort((a, b) => ecoles[b] - ecoles[a])[0];
    ecoles[majoritaire] += nbCameleons;
  }

  const actives = [];
  for (const [nom, nb] of Object.entries(ecoles)) {
    const paliers = PALIERS_ECOLES[nom] || [2, 4, 6];
    const s = paliers.filter((p) => nb >= p).length;
    if (s > 0) actives.push({ nom, nb, s, type: "ecole" });
  }
  for (const [nom, nb] of Object.entries(archetypes)) {
    if (nom === "Capitaine") {
      // Le brassard ne se partage pas : 2+ Capitaines = guerre des égos
      if (nb === 1) actives.push({ nom, nb, s: 1, type: "archetype" });
      if (nb >= 2) actives.push({ nom: "Guerre des égos", nb, s: 1, type: "archetype" });
      continue;
    }
    const paliers = PALIERS_ARCHETYPES[nom] || [2, 4, 6];
    const s = paliers.filter((p) => nb >= p).length;
    if (s > 0) actives.push({ nom, nb, s, type: "archetype" });
  }
  return actives;
}

const s = (equipe, nom) => { const sy = equipe.synergies.find((x) => x.nom === nom); return sy ? sy.s : 0; };
const aUnique = (equipe, nomUnique) => equipe.joueurs.find((j) => j.unique === nomUnique);

/* ============================================================
   CRÉATION D'ÉQUIPE
   ============================================================ */
function equipeDepuisFiches(nomClub, coach, fiches) {
  const joueurs = fiches.map((fiche) => ({
    ...fiche,
    ...statsJoueur(fiche),
    nom: (fiche.etoiles || 1) >= 2 ? `${fiche.nom} ${"★".repeat(fiche.etoiles)}` : fiche.nom,
  }));
  const equipe = { nom: nomClub, coach, joueurs };
  equipe.synergies = calculerSynergies(equipe);
  return equipe;
}
function creerEquipe(nomClub, coach, noms, tousLesJoueurs) {
  const fiches = noms.map((nom) => {
    const fiche = tousLesJoueurs.find((j) => j.nom === nom);
    if (!fiche) throw new Error("Joueur introuvable : " + nom);
    return fiche;
  });
  return equipeDepuisFiches(nomClub, coach, fiches);
}

/* ============================================================
   BONUS DE DUEL — chaque bonus garde sa source pour que le récit
   puisse dire « la synergie X a fait la différence ».
   L'état de match (Flow de la Rue, confiance des Guerriers,
   arrêts déjà consommés…) vit dans ctx.etat[nom d'équipe].
   ============================================================ */
function bonusCommuns(equipe, ctx) {
  const liste = [];
  const etat = ctx.etat[equipe.nom];
  if (s(equipe, "Capitaine")) liste.push({ nom: "Capitaine", valeur: 1 });
  if (s(equipe, "Guerre des égos")) liste.push({ nom: "Guerre des égos", valeur: -1.5 });
  const grinta = s(equipe, "La Grinta");
  if (grinta && ctx.scoreDe(equipe) < ctx.scoreAdverse(equipe))
    liste.push({ nom: "La Grinta", valeur: 1.5 * grinta });
  if (aUnique(equipe, "El Pibe") && ctx.scoreDe(equipe) < ctx.scoreAdverse(equipe))
    liste.push({ nom: "El Pibe", valeur: 2 });
  const inter = s(equipe, "Les Internationaux");
  if (inter) liste.push({ nom: "Les Internationaux", valeur: 0.5 * inter });
  const academie = s(equipe, "L'Académie");
  if (academie >= 2) liste.push({ nom: "L'Académie", valeur: 1 });
  const mentor = s(equipe, "Mentor");
  if (mentor) liste.push({ nom: "Mentor", valeur: 0.5 * mentor });
  const guerrier = s(equipe, "Guerrier");
  if (guerrier && etat.confiance > 0)
    liste.push({ nom: "Guerrier", valeur: Math.min(0.3 * guerrier * etat.confiance, 3) });
  const flow = s(equipe, "École de la Rue") >= 2 ? etat.flow : 0; // le Flow dès le palier 3
  if (flow > 0) liste.push({ nom: "École de la Rue", valeur: Math.min(0.5 * flow, 3) });
  // Kick & Rush palier 5 : la déferlante à partir de la 3e phase
  if (s(equipe, "Kick & Rush") >= 2 && ctx.numero >= 3)
    liste.push({ nom: "Kick & Rush", valeur: 1.5 });
  return liste;
}
function bonusMilieu(equipe, ctx) {
  const liste = bonusCommuns(equipe, ctx);
  const tiki = s(equipe, "Tiki-Taka");
  if (tiki) liste.push({ nom: "Tiki-Taka", valeur: 1.2 * tiki });
  const moteur = s(equipe, "Moteur");
  if (moteur) liste.push({ nom: "Moteur", valeur: 1 * moteur });
  if (aUnique(equipe, "Don Álvaro")) liste.push({ nom: "Don Álvaro", valeur: 1.5 });
  return liste;
}
function bonusPercee(equipe, ctx) {
  const liste = bonusCommuns(equipe, ctx);
  const piston = s(equipe, "Piston");
  if (piston) liste.push({ nom: "Piston", valeur: 1 * piston });
  const createur = s(equipe, "Créateur");
  if (createur) liste.push({ nom: "Créateur", valeur: 0.8 * createur });
  const total = s(equipe, "Football Total");
  if (total >= 2) liste.push({ nom: "Football Total", valeur: 0.7 * total });
  return liste;
}
function bonusDefense(equipe, ctx) {
  const liste = bonusCommuns(equipe, ctx);
  const cate = s(equipe, "Catenaccio");
  if (cate) liste.push({ nom: "Catenaccio", valeur: 1.6 * cate });
  const douzieme = s(equipe, "Le Douzième Homme");
  if (douzieme) {
    let valeur = 0.8 * douzieme;
    if (douzieme >= 2 && ctx.scoreDe(equipe) > ctx.scoreAdverse(equipe)) valeur += 0.8; // le stade gronde
    liste.push({ nom: "Le Douzième Homme", valeur });
  }
  const total = s(equipe, "Football Total");
  if (total) liste.push({ nom: "Football Total", valeur: 0.7 * total });
  return liste;
}
const totalBonus = (liste) => liste.reduce((t, b) => t + b.valeur, 0);
function synergieDecisive(liste, marge) {
  const positifs = liste.filter((b) => b.valeur > 0);
  if (positifs.length === 0) return null;
  const meilleur = positifs.sort((a, b) => b.valeur - a.valeur)[0];
  // On ne raconte la synergie que si le duel s'est joué dans sa marge,
  // et pas à chaque fois : c'est un moment fort, pas un bruit de fond.
  if (marge > meilleur.valeur || Math.random() > 0.4) return null;
  return meilleur.nom;
}

/* ============================================================
   LE TIR — façon xG, avec toute la ménagerie autour :
   Il Professore et les Sentinelles coupent avant le tir,
   les Murs et El Santo bloquent le premier tir cadré de la
   mi-temps, les Renards rôdent sur les ballons qui traînent,
   les Chanceux ont des poteaux rentrants.
   ============================================================ */
function tenterTir(attaque, defense, ctx, evenements, bonusQualite = 0) {
  const etatDef = ctx.etat[defense.nom];
  const attaquants = parPoste(attaque, "ATT");
  const candidatsTir = [...attaquants];
  const milieuxAtt = parPoste(attaque, "MIL");
  if (milieuxAtt.length && (candidatsTir.length === 0 || proba(0.35))) candidatsTir.push(...milieuxAtt);
  if (candidatsTir.length === 0) candidatsTir.push(...attaque.joueurs.filter((j) => j.poste !== "GAR"));
  const finisseur = choisirParmi(attaque, ctx, candidatsTir);
  // Jouer sans gardien est permis : la cage est vide, presque tout rentre
  const gardien = parPoste(defense, "GAR")[0] || { nom: "la cage vide", def: 0, att: 0, cageVide: true };

  // Il Professore : le piège du hors-jeu, une occasion annulée par match
  if (aUnique(defense, "Il Professore") && !etatDef.professoreUtilise && proba(0.5)) {
    etatDef.professoreUtilise = true;
    evenements.push({ type: "hors_jeu", acteurs: [finisseur.nom], texte: `Drapeau levé ! Le piège du hors-jeu d'Il Professore se referme sur ${finisseur.nom}.`, synergie: "Il Professore", equipe: defense.nom });
    return false;
  }
  // Les Sentinelles peuvent couper la trajectoire
  const sentinelle = s(defense, "Sentinelle");
  if (sentinelle && proba(0.08 * sentinelle)) {
    const defenseur = hasard(parPoste(defense, "DÉF").length ? parPoste(defense, "DÉF") : defense.joueurs);
    evenements.push({ type: "interception", acteurs: [defenseur.nom, finisseur.nom], texte: `${finisseur.nom} arme son tir… mais ${defenseur.nom} surgit et coupe la trajectoire !`, synergie: "Sentinelle", equipe: defense.nom });
    return false;
  }

  let qualite = finisseur.att + de(8) + bonusQualite;
  qualite += 0.8 * s(attaque, "Finisseur") + 0.6 * s(attaque, "Créateur");
  let parade = gardien.cageVide ? 1 + de(2) : gardien.def + de(8) + 1 * s(defense, "Mur");

  // Le Virtuose peut sortir le geste de classe (et nourrir le Flow de la Rue)
  let classe = false;
  const virtuose = s(attaque, "Virtuose");
  if (virtuose && proba(0.08 * virtuose)) { parade /= 2; classe = true; ctx.etat[attaque.nom].flow++; }

  let but = qualite > parade;
  let blocage = null;

  // Premier tir cadré de la mi-temps : El Santo (garanti) ou les Murs (palier 4)
  const miTemps = ctx.numero <= 4 ? 1 : 2;
  if (but && aUnique(defense, "El Santo") && !etatDef.santo[miTemps]) {
    etatDef.santo[miTemps] = true; but = false;
    blocage = { texte: `El Santo s'interpose — le premier tir cadré de la période est pour lui !`, synergie: "El Santo" };
  } else if (but && s(defense, "Mur") >= 2 && !etatDef.murs[miTemps]) {
    etatDef.murs[miTemps] = true; but = false;
    blocage = { texte: `Le rideau de Murs se referme — la frappe de ${finisseur.nom} est déviée in extremis !`, synergie: "Mur" };
  }

  if (but) {
    evenements.push({
      type: "but", acteurs: [finisseur.nom, gardien.nom],
      but: true, buteur: finisseur.nom, equipe: attaque.nom,
      texte: classe
        ? `${finisseur.nom} invente un geste de classe — le gardien est cloué sur place…`
        : varie(
          `${finisseur.nom} se présente face à ${gardien.nom}…`,
          `${finisseur.nom} surgit entre les lignes et ajuste ${gardien.nom}…`,
          `Contrôle orienté, frappe sèche de ${finisseur.nom}…`,
          `${finisseur.nom} croise sa frappe au ras du poteau…`,
          `Enchaînement de ${finisseur.nom} dans la surface…`
        ),
      cri: `BUUUT de ${finisseur.nom} pour ${attaque.nom} !`,
      synergie: classe ? "Virtuose" : synergieDecisive(
        [{ nom: "Finisseur", valeur: 0.8 * s(attaque, "Finisseur") }, { nom: "Créateur", valeur: 0.6 * s(attaque, "Créateur") }],
        qualite - parade
      ),
    });
    return true;
  }

  // Tir manqué : les Chanceux peuvent avoir un poteau rentrant…
  const chanceux = s(attaque, "Chanceux");
  if (chanceux && proba(0.06 * chanceux)) {
    evenements.push({
      type: "but", acteurs: [finisseur.nom],
      but: true, buteur: finisseur.nom, equipe: attaque.nom,
      texte: `La frappe de ${finisseur.nom} est repoussée… non ! Poteau RENTRANT ! La chance ${chanceux >= 2 ? "insolente" : "sourit"} !`,
      cri: `BUUUT de ${finisseur.nom} pour ${attaque.nom} !`,
      synergie: "Chanceux",
    });
    return true;
  }

  if (blocage) {
    evenements.push({ type: "blocage", acteurs: [finisseur.nom], texte: blocage.texte, synergie: blocage.synergie, equipe: defense.nom });
  } else {
    evenements.push({
      type: "arret", acteurs: [finisseur.nom, gardien.nom],
      texte: gardien.cageVide
        ? `${finisseur.nom} vise la cage vide… et dévisse ! Incroyable raté !`
        : varie(
        `${finisseur.nom} frappe… mais ${gardien.nom} s'envole et détourne ! Quel arrêt !`,
        `${finisseur.nom} arme sa frappe… ${gardien.nom} gagne son face-à-face du bout des gants !`,
        `La tentative de ${finisseur.nom} est cadrée… mais ${gardien.nom} dit non !`
      ),
      equipe: defense.nom,
      synergie: s(defense, "Mur") && parade - qualite <= s(defense, "Mur") && proba(0.4) ? "Mur" : null,
    });
  }

  // …et les Renards rôdent sur le ballon qui traîne
  const renard = s(attaque, "Renard");
  if (renard && proba(0.10 * renard)) {
    const renards = attaque.joueurs.filter((j) => j.archetype === "Renard");
    const opportuniste = renards.length ? choisirParmi(attaque, ctx, renards) : finisseur;
    evenements.push({ type: "rebond", acteurs: [opportuniste.nom], texte: `Le ballon traîne dans la surface… ${opportuniste.nom} a suivi !`, synergie: "Renard", equipe: attaque.nom });
    const qualiteReprise = opportuniste.att + de(8);
    const paradeReprise = (gardien.cageVide ? 1 : gardien.def) + de(6);
    if (qualiteReprise > paradeReprise) {
      evenements.push({
        type: "but", acteurs: [opportuniste.nom, gardien.nom],
        but: true, buteur: opportuniste.nom, equipe: attaque.nom,
        texte: `Reprise à bout portant…`,
        cri: `BUUUT de ${opportuniste.nom} pour ${attaque.nom} !`, synergie: null,
      });
      return true;
    }
    evenements.push({ type: "arret", acteurs: [opportuniste.nom, gardien.nom], texte: `…mais ${gardien.nom} réalise le double arrêt !`, equipe: defense.nom, synergie: null });
  }
  return false;
}

/* ============================================================
   UNE PHASE DE POSSESSION — trois duels lisibles :
   1. MILIEU (Kick & Rush et La Lambretta peuvent le court-circuiter)
   2. PERCÉE (l'École de la Rue peut relancer d'un geste)
   3. TIR
   Un arrêt du Catenaccio peut déclencher un contre éclair.
   ============================================================ */
function resoudrePhase(eqA, eqB, ctx) {
  const evenements = [];
  let attaque = null;
  let bonusTir = 0;

  // Ballon long du Kick & Rush : un par match au palier 2, la déferlante ensuite
  for (const eq of [eqA, eqB]) {
    const kr = s(eq, "Kick & Rush");
    const etat = ctx.etat[eq.nom];
    const disponible = kr >= 2 ? true : (kr >= 1 && !etat.ballonLongUtilise);
    if (!attaque && disponible && proba(0.15)) {
      etat.ballonLongUtilise = true;
      attaque = eq;
      const hammer = aUnique(eq, "The Hammer");
      if (hammer) bonusTir += 1.5;
      evenements.push({
        type: "ballon_long", acteurs: [],
        texte: hammer
          ? `Longue transversale… The Hammer écrase son duel aérien, le ballon devient un boulet !`
          : `Longue transversale de ${eq.nom} par-dessus tout le monde — pur Kick & Rush !`,
        synergie: hammer ? "The Hammer" : "Kick & Rush", equipe: eq.nom,
      });
    }
  }
  // La Lambretta : la passe par-dessus la défense, tir à bout portant direct
  if (!attaque) {
    for (const eq of [eqA, eqB]) {
      if (aUnique(eq, "La Lambretta") && proba(0.10)) {
        attaque = eq;
        bonusTir += 1;
        evenements.push({ type: "lambretta", acteurs: [], texte: `La Lambretta décolle — la passe par-dessus la défense trouve son homme à bout portant !`, synergie: "La Lambretta", equipe: eq.nom });
        break;
      }
    }
  }

  // Duel n°1 : le milieu
  if (!attaque) {
    const bA = bonusMilieu(eqA, ctx), bB = bonusMilieu(eqB, ctx);
    const forceA = parPoste(eqA, "MIL").reduce((t, j) => t + j.att + j.def, 0) + totalBonus(bA) + de(12);
    const forceB = parPoste(eqB, "MIL").reduce((t, j) => t + j.att + j.def, 0) + totalBonus(bB) + de(12);
    attaque = forceA >= forceB ? eqA : eqB;
    const marge = Math.abs(forceA - forceB);
    const sy = synergieDecisive(attaque === eqA ? bA : bB, marge);
    const milieux = parPoste(attaque, "MIL");
    const autresChamp = attaque.joueurs.filter((j) => j.poste !== "GAR");
    // 7 fois sur 10 le milieu porte le jeu, sinon un autre joueur de champ
    const candidatsPorteur = milieux.length && !proba(0.3) ? milieux : autresChamp;
    const porteur = choisirParmi(attaque, ctx, candidatsPorteur.length ? candidatsPorteur : attaque.joueurs);
    ctx.etat[attaque.nom].confiance++;
    evenements.push({
      type: "possession", acteurs: [porteur.nom],
      texte: varie(
        `${porteur.nom} gagne la bataille du milieu pour ${attaque.nom}.`,
        `${porteur.nom} ratisse le ballon et met ${attaque.nom} dans le sens du jeu.`,
        `${porteur.nom} dicte le tempo — possession pour ${attaque.nom}.`,
        `${porteur.nom} s'arrache dans l'entrejeu et oriente pour ${attaque.nom}.`,
        `${porteur.nom} récupère haut et lance l'attaque de ${attaque.nom}.`,
        `Pressing gagnant : ${porteur.nom} arrache le ballon pour ${attaque.nom}.`,
        `${porteur.nom} trouve l'intervalle — ${attaque.nom} s'installe dans le camp adverse.`
      ), synergie: sy, equipe: attaque.nom,
    });
  }
  const defense = attaque === eqA ? eqB : eqA;

  // Duel n°2 : la percée (sautée si le ballon est déjà à bout portant)
  let percee = bonusTir > 0; // ballon long / Lambretta : occasion déjà créée
  if (!percee) {
    const bAtt = bonusPercee(attaque, ctx), bDef = bonusDefense(defense, ctx);
    const forceAtt = parPoste(attaque, "ATT").reduce((t, j) => t + j.att, 0)
      + parPoste(attaque, "MIL").reduce((t, j) => t + j.att, 0) + totalBonus(bAtt);
    const forceDef = parPoste(defense, "DÉF").reduce((t, j) => t + j.def, 0) + totalBonus(bDef);
    percee = forceAtt + de(10) > forceDef + de(10);

    // L'École de la Rue : un geste peut relancer une percée ratée (et nourrit le Flow)
    if (!percee) {
      const rue = s(attaque, "École de la Rue");
      if (rue && proba(0.12 * rue)) {
        const dribbleurs = attaque.joueurs.filter((j) => j.poste !== "GAR");
        const dribbleur = choisirParmi(attaque, ctx, dribbleurs);
        ctx.etat[attaque.nom].flow++;
        if (aUnique(attaque, "O Rei da Rua")) ctx.etat[attaque.nom].flow++;
        evenements.push({ type: "geste", acteurs: [dribbleur.nom], texte: `${dribbleur.nom} est bloqué… petit pont ! La rue ne s'arrête jamais.`, synergie: "École de la Rue", equipe: attaque.nom });
        percee = forceAtt + de(10) + 2 > forceDef + de(10);
      }
    }
    if (percee) ctx.etat[attaque.nom].confiance++;
    else {
      ctx.etat[defense.nom].confiance++;
      const defenseurs = parPoste(defense, "DÉF");
      const candidatsStop = defenseurs.length && !proba(0.25)
        ? defenseurs : defense.joueurs.filter((j) => j.poste !== "GAR");
      const defenseur = choisirParmi(defense, ctx, candidatsStop.length ? candidatsStop : defense.joueurs);
      const sy = totalBonus(bDef) >= 3 && proba(0.25)
        ? bDef.filter((b) => b.valeur > 0).sort((a, b) => b.valeur - a.valeur)[0].nom : null;
      evenements.push({
        type: "percee_stoppee", acteurs: [defenseur.nom],
        texte: varie(
          `${defenseur.nom} ferme la porte — la défense de ${defense.nom} tient bon.`,
          `${defenseur.nom} jaillit et coupe l'attaque net. Rien ne passe.`,
          `Tacle parfait de ${defenseur.nom} — le stade apprécie.`,
          `${defense.nom} recule en bloc, ${defenseur.nom} dégage le danger.`,
          `${defenseur.nom} lit la passe avant tout le monde et intercepte.`,
          `Duel d'épaule gagné par ${defenseur.nom} — le public gronde.`,
          `${defenseur.nom} accompagne l'attaquant jusqu'à la ligne et sort le ballon proprement.`
        ), synergie: sy, equipe: defense.nom,
      });
    }
  }

  let butMarque = false;
  if (percee) butMarque = tenterTir(attaque, defense, ctx, evenements, bonusTir);

  // Contre éclair du Catenaccio après un arrêt (palier 4 : les contres mordent)
  if (!butMarque) {
    const cate = s(defense, "Catenaccio");
    if (cate && proba(0.12 * cate)) {
      evenements.push({ type: "contre", acteurs: [], texte: `Récupération et contre éclair de ${defense.nom} — tout le monde est pris de vitesse !`, synergie: "Catenaccio", equipe: defense.nom });
      butMarque = tenterTir(defense, attaque, ctx, evenements, cate >= 2 ? 1 : 0);
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
    etat: {
      [eqA.nom]: { flow: 0, confiance: 0, ballonLongUtilise: false, professoreUtilise: false, santo: {}, murs: {}, apparitions: {} },
      [eqB.nom]: { flow: 0, confiance: 0, ballonLongUtilise: false, professoreUtilise: false, santo: {}, murs: {}, apparitions: {} },
    },
    scoreDe: (eq) => (eq === eqA ? scoreA : scoreB),
    scoreAdverse: (eq) => (eq === eqA ? scoreB : scoreA),
  };
  for (let n = 1; n <= NB_PHASES; n++) {
    ctx.numero = n;
    const evenements = resoudrePhase(eqA, eqB, ctx);

    // La Pantera marque d'office si le score est nul à la dernière phase
    if (n === NB_PHASES && scoreA + compterButs(evenements, eqA) === scoreB + compterButs(evenements, eqB)) {
      for (const eq of [eqA, eqB]) {
        const pantera = aUnique(eq, "La Pantera");
        if (pantera) {
          evenements.push({
            type: "but", acteurs: [pantera.nom],
            but: true, buteur: pantera.nom, equipe: eq.nom,
            texte: `Tout le stade retient son souffle… La Pantera surgit de nulle part, comme toujours quand tout est encore possible.`,
            cri: `BUUUT de ${pantera.nom} pour ${eq.nom} !`, synergie: "La Pantera",
          });
          break; // une seule panthère par soir
        }
      }
    }

    for (const ev of evenements) {
      if (ev.but) { if (ev.equipe === eqA.nom) scoreA++; else scoreB++; }
    }
    phases.push({ numero: n, minute: MINUTES[n - 1], evenements, scoreA, scoreB });
  }
  return { phases, scoreA, scoreB, ecart: Math.abs(scoreA - scoreB) };
}
function compterButs(evenements, eq) {
  return evenements.filter((ev) => ev.but && ev.equipe === eq.nom).length;
}

/* ---- Export navigateur + node ---- */
const ONZE = { creerEquipe, equipeDepuisFiches, simulerMatch, calculerSynergies, statsJoueur, fusionnerEffectif, degatsPrestige, NB_PHASES, PALIERS_ECOLES, PALIERS_ARCHETYPES };
if (typeof module !== "undefined") module.exports = ONZE;
if (typeof window !== "undefined") window.ONZE = ONZE;
