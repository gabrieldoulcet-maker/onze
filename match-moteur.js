/* ============================================================
   ONZE — Moteur de match v3 : les 13 stats (design/stats.md)
   ------------------------------------------------------------
   Utilisé par les pages du jeu (navigateur) ET par les scripts
   de calibrage (node). Aucune dépendance.

   Architecture ferme : le moteur produit une LISTE D'ÉVÉNEMENTS
   typés (type, acteurs, texte provisoire) — le rendu (match-ui.js
   aujourd'hui, l'animation 2D en phase 3) s'y branche sans que le
   moteur change.

   Les stats des joueurs se GÉNÈRENT par formule (jamais à la main) :
   profil d'archétype × budget de coût × touche d'École, ×1,5 par
   étoile, variation déterministe par nom (deux joueurs de même
   coût/étoile ne sont jamais interchangeables). Ajustements manuels
   réservés aux Uniques. Réglages regroupés ici pour le playtest.
   ============================================================ */

/* ---- Petites aides ---- */
const de = (max) => Math.floor(Math.random() * max) + 1;
const hasard = (tableau) => tableau[Math.floor(Math.random() * tableau.length)];
/* La formation est LIBRE (décision n°21) : chaque joueur occupe une
   ligne (GAR/DÉF/MIL/ATT), par défaut son poste naturel. Les duels
   lisent la ligne jouée ; jouer hors-poste coûte un malus. */
const ligneDe = (j) => j.ligne || j.poste;
const parPoste = (equipe, poste) => equipe.joueurs.filter((j) => ligneDe(j) === poste);
const proba = (p) => Math.random() < p;
const varie = (...variantes) => hasard(variantes);

/* Casting tournant : on met en scène de préférence un joueur encore
   peu vu dans ce match, pour que tout l'effectif vive à l'écran. */
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

/* Dégâts de prestige du perdant — copie exacte de TFT (design/economie.md) :
   base selon la période + 1 par but d'écart. Source unique jeu + affichage. */
function baseDegats(manche) {
  if (manche <= 3) return 0;   // amicaux
  if (manche <= 6) return 2;
  if (manche <= 9) return 5;
  if (manche <= 12) return 8;
  if (manche <= 15) return 10;
  if (manche <= 18) return 12;
  return 17;
}
function degatsPrestige(ecart, manche = 10) {
  // La composante écart est relevée (×1,25) depuis le rééquilibrage « 2-3 buts
  // par match » (décision 25) : moitié moins de buts qu'avant, donc
  // chaque but d'écart pèse un quart de plus — le rythme d'élimination TFT
  // (première élim ~M11-13, fin ~M17-19) est préservé.
  return ecart > 0 ? baseDegats(manche) + Math.round(1.25 * ecart) : 0;
}

/* ============================================================
   GÉNÉRATION DES STATS (design/stats.md)
   Champ : endurance vitesse technique tir passe dribble tacle
           placement vision mental
   Gardien : reflexes pied aerien remplacent tir dribble tacle
   ============================================================ */
const STATS_CHAMP = ["endurance", "vitesse", "technique", "tir", "passe", "dribble", "tacle", "placement", "vision", "mental"];
const STATS_GARDIEN = ["endurance", "vitesse", "technique", "reflexes", "passe", "pied", "aerien", "placement", "vision", "mental"];
const NOMS_STATS = {
  endurance: "END", vitesse: "VIT", technique: "TEC", tir: "TIR", passe: "PAS",
  dribble: "DRI", tacle: "TAC", placement: "PLA", vision: "VIS", mental: "MEN",
  reflexes: "RÉF", pied: "PIE", aerien: "AÉR",
};

/* Le profil = la forme (poids relatifs) ; le coût = la taille. */
const PROFILS_ARCHETYPES = {
  "Virtuose":   { dribble: 3, technique: 3, vitesse: 2, passe: 1.5, tir: 1.5, vision: 1.5, endurance: 1, placement: 1, mental: 1, tacle: 0.5 },
  "Sentinelle": { tacle: 3, placement: 3, mental: 2, endurance: 1.5, vitesse: 1.5, vision: 1.5, passe: 1, technique: 1, dribble: 0.5, tir: 0.5 },
  "Créateur":   { passe: 3, vision: 3, technique: 2.5, dribble: 1.5, mental: 1.5, placement: 1, endurance: 1, vitesse: 1, tir: 1, tacle: 0.5 },
  "Finisseur":  { tir: 3, placement: 3, vitesse: 2, mental: 1.5, technique: 1.5, dribble: 1.5, endurance: 1, passe: 1, vision: 1, tacle: 0.5 },
  "Moteur":     { endurance: 3, vitesse: 2.5, tacle: 2, passe: 1.5, technique: 1.5, placement: 1.5, mental: 1.5, vision: 1, dribble: 1, tir: 1 },
  "Mur":        { placement: 3, tacle: 2.5, mental: 2, endurance: 1.5, vitesse: 1, technique: 1, passe: 1, vision: 1, dribble: 0.5, tir: 0.5,
                  reflexes: 3, aerien: 2.5, pied: 1 },
  "Renard":     { placement: 3, vitesse: 2.5, tir: 2, mental: 1.5, endurance: 1.5, dribble: 1.5, technique: 1, passe: 1, vision: 1, tacle: 0.5 },
  "Chanceux":   { mental: 2, placement: 1.8, vitesse: 1.5, technique: 1.5, tir: 1.5, dribble: 1.5, passe: 1.5, vision: 1.5, endurance: 1.5, tacle: 1.2 },
  "Guerrier":   { mental: 3, endurance: 2.5, tacle: 2, vitesse: 1.5, placement: 1.5, tir: 1, passe: 1, technique: 1, dribble: 1, vision: 1 },
  "Mentor":     { vision: 3, mental: 3, passe: 2, technique: 1.5, placement: 1.5, endurance: 1, vitesse: 0.8, tacle: 1, dribble: 1, tir: 1 },
  "Capitaine":  { mental: 3, passe: 2.5, vision: 2, placement: 1.5, endurance: 1.5, tacle: 1.5, technique: 1.5, vitesse: 1, dribble: 0.8, tir: 1,
                  reflexes: 2.5, aerien: 1.5, pied: 1.5 },
  "Piston":     { vitesse: 3, endurance: 3, dribble: 1.8, passe: 1.5, tacle: 1.5, placement: 1.5, technique: 1.2, tir: 1, vision: 1, mental: 1 },
  "":           { endurance: 1, vitesse: 1, technique: 1, tir: 1, passe: 1, dribble: 1, tacle: 1, placement: 1, vision: 1, mental: 1,
                  reflexes: 1, pied: 1, aerien: 1 }, // les réservistes sans archétype
};
/* Chez les gardiens, le profil glisse vers les stats de gardien */
const PROFIL_BASE_GARDIEN = { reflexes: 3, aerien: 2, pied: 1.8, placement: 2, mental: 1.8, vision: 1.2, passe: 1, technique: 0.8, endurance: 1, vitesse: 0.8 };

/* La touche d'École : petit plus thématique sur des stats PRÉCISES */
const TOUCHES_ECOLES = {
  "Tiki-Taka": { passe: 6, technique: 4 },
  "Catenaccio": { tacle: 6, placement: 4 },
  "Kick & Rush": { aerien: 6, endurance: 4, placement: 2 },
  "École de la Rue": { dribble: 6, technique: 4 },
  "La Grinta": { mental: 8 },
  "Football Total": { vision: 5, vitesse: 3 },
  "L'Académie": { technique: 4, mental: 3 },
  "Les Internationaux": { vision: 4, mental: 3 },
  "Le Douzième Homme": { mental: 5, placement: 3 },
  "Les Pros": { placement: 4, technique: 3 },
  "Les Revanchards": { mental: 5, endurance: 3 },
};

/* Ajustements à la main : réservés aux Uniques (design/stats.md) */
const AJUSTEMENTS_UNIQUES = {
  "El Santo": { reflexes: 8, mental: 6 }, "Le Roc": { tacle: 8, placement: 6 },
  "Il Professore": { placement: 10, vision: 6 }, "El Pibe": { mental: 10, dribble: 6 },
  "Don Álvaro": { passe: 10, vision: 6 }, "La Lambretta": { passe: 8, vision: 8 },
  "La Pantera": { placement: 8, mental: 8 }, "O Rei da Rua": { dribble: 12 },
  "The Hammer": { aerien: 12, tir: 6 }, "Le Professeur": { vision: 10, placement: 6 },
  "Caméléon": { mental: 6, technique: 6 }, "Le Crack": { dribble: 8, vitesse: 6 },
};

/* Variation déterministe par nom : deux joueurs de même coût/étoile
   ne sont JAMAIS interchangeables, et un joueur garde son visage. */
function grainDuNom(nom, stat) {
  let h = 0;
  const cle = nom + "|" + stat;
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) % 997;
  return (h / 997 - 0.5) * 0.18; // ±9 %
}

function genererStats(fiche) {
  const gardien = fiche.poste === "GAR";
  const cles = gardien ? STATS_GARDIEN : STATS_CHAMP;
  const profilArchetype = PROFILS_ARCHETYPES[fiche.archetype || ""] || PROFILS_ARCHETYPES[""];
  const stats = {};
  // budget : le coût fait la taille, pas la forme (coût 0 = réserviste)
  let budgetMoyen = 38 + 6 * (fiche.cout || 0);
  if (fiche.icone) budgetMoyen *= 1.15; // une Icône s'est méritée (design/icones.md)
  let sommePoids = 0;
  const poids = {};
  for (const stat of cles) {
    let p = gardien
      ? (PROFIL_BASE_GARDIEN[stat] || 1) * 0.7 + (profilArchetype[stat] || 1) * 0.3
      : (profilArchetype[stat] || 1);
    p = Math.pow(p, 0.72); // adoucit les pics : profils marqués, pas caricaturaux
    p *= 1 + grainDuNom(fiche.nom, stat);
    poids[stat] = p;
    sommePoids += p;
  }
  const facteurEtoile = Math.pow(1.5, (fiche.etoiles || 1) - 1);
  const touche = TOUCHES_ECOLES[fiche.ecole] || {};
  const ajustement = AJUSTEMENTS_UNIQUES[fiche.unique] || {};
  for (const stat of cles) {
    let valeur = (poids[stat] / sommePoids) * cles.length * budgetMoyen;
    valeur += (touche[stat] || 0) + (ajustement[stat] || 0);
    valeur *= facteurEtoile;
    stats[stat] = Math.max(10, Math.min(99, Math.round(valeur)));
  }
  return stats;
}

/* Note globale façon FIFA : la moyenne des 6 meilleures stats */
function noteGlobale(stats) {
  const valeurs = Object.values(stats).sort((a, b) => b - a).slice(0, 6);
  return Math.round(valeurs.reduce((t, v) => t + v, 0) / valeurs.length);
}
/* Les 2 stats signatures du profil (pour la carte) */
function statsSignatures(stats) {
  return Object.entries(stats).sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([stat, valeur]) => ({ stat, nom: NOMS_STATS[stat], valeur }));
}

/* ============================================================
   LE STAFF (design/staff.md) — les « objets » d'ONZE.
   Un composant seul donne un petit boost de stats précises ;
   deux composants sur le même joueur fusionnent en SPÉCIALISATION
   (36 combos), définitive et plus puissante. Le Passeport combiné
   donne un emblème d'École. Quelques spécialisations portent en
   plus un effet de match (proc) géré par le moteur.
   ============================================================ */
const COMPOSANTS_STAFF = {
  "Prépa physique":    { endurance: 6 },
  "Coach mental":      { mental: 6 },
  "Analyste vidéo":    { placement: 4, vision: 3 },
  "Coach de finition": { tir: 6 },
  "Coach technique":   { technique: 4, dribble: 3 },
  "Kiné":              { endurance: 3, vitesse: 4 },
  "Adjoint tactique":  { placement: 5, tacle: 2 },
  "Scout":             { vision: 6 },
  "Passeport":         {}, // rien seul — combiné : emblème d'École
};
const cleCombo = (a, b) => [a, b].sort().join(" + ");
const SPECIALISATIONS = {}; // clé "A + B" triée → fiche de spécialisation
function defSpec(a, b, nom, boosts, proc, effet) {
  SPECIALISATIONS[cleCombo(a, b)] = { nom, boosts, proc: proc || null, effet: effet || "" };
}
defSpec("Prépa physique", "Prépa physique", "Marathonien", { endurance: 18, vitesse: 6 }, null, "Aucune baisse de régime");
defSpec("Prépa physique", "Coach mental", "Ironman", { endurance: 10, mental: 10 });
defSpec("Prépa physique", "Analyste vidéo", "Pressing machine", { endurance: 8, placement: 8, tacle: 5 });
defSpec("Prépa physique", "Coach de finition", "Percuteur", { tir: 10, vitesse: 8, endurance: 4 });
defSpec("Prépa physique", "Coach technique", "Second souffle", { dribble: 9, endurance: 9, technique: 4 });
defSpec("Prépa physique", "Kiné", "Increvable", { endurance: 14, vitesse: 8 });
defSpec("Prépa physique", "Adjoint tactique", "Soldat", { tacle: 9, placement: 8, endurance: 6 });
defSpec("Prépa physique", "Scout", "Contre-attaquant", { vitesse: 10, vision: 6 }, "contre", "Contre éclair sur ballon récupéré");
defSpec("Coach mental", "Coach mental", "Capitaine d'acier", { mental: 20 });
defSpec("Coach mental", "Analyste vidéo", "Joueur d'échecs", { mental: 9, vision: 9, placement: 5 });
defSpec("Coach mental", "Coach de finition", "Tueur froid", { tir: 10, mental: 10 });
defSpec("Coach mental", "Coach technique", "Maître du tempo", { technique: 9, mental: 9, passe: 5 });
defSpec("Coach mental", "Kiné", "Roc mental", { mental: 12, endurance: 8 });
defSpec("Coach mental", "Adjoint tactique", "Général", { mental: 10, placement: 8, tacle: 4 });
defSpec("Coach mental", "Scout", "Vista", { vision: 12, passe: 8, mental: 4 });
defSpec("Analyste vidéo", "Analyste vidéo", "Professeur", { placement: 10, vision: 10 }, "annulation", "Annule la première occasion adverse du match");
defSpec("Analyste vidéo", "Coach de finition", "Charognard", { placement: 10, tir: 8 }, "rebond", "Les ballons qui traînent deviennent ses tirs");
defSpec("Analyste vidéo", "Coach technique", "Relance éclair", { vision: 8, technique: 8, passe: 6 });
defSpec("Analyste vidéo", "Kiné", "Couverture", { placement: 10, vitesse: 8 });
defSpec("Analyste vidéo", "Adjoint tactique", "Cerveau", { placement: 12, tacle: 6, vision: 5 });
defSpec("Analyste vidéo", "Scout", "Directeur sportif", { vision: 14 }, null, "Révèle la compo adverse (déjà couvert par le scouting)");
defSpec("Coach de finition", "Coach de finition", "Sniper", { tir: 20 });
defSpec("Coach de finition", "Coach technique", "Feuille morte", { tir: 10, technique: 10 });
defSpec("Coach de finition", "Kiné", "Double détente", { tir: 8, placement: 6 }, "detente", "Si son tir est arrêté, il retente immédiatement");
defSpec("Coach de finition", "Adjoint tactique", "Point de fixation", { tir: 8, placement: 10 });
defSpec("Coach de finition", "Scout", "Appel parfait", { placement: 12, tir: 6, vitesse: 5 });
defSpec("Coach technique", "Coach technique", "Magicien", { dribble: 14, technique: 10 });
defSpec("Coach technique", "Kiné", "Porteur d'eau de luxe", { technique: 10, passe: 8, endurance: 6 });
defSpec("Coach technique", "Adjoint tactique", "Métronome", { passe: 10, technique: 8, placement: 5 });
defSpec("Coach technique", "Scout", "Chef d'orchestre", { passe: 10, vision: 10, technique: 5 });
defSpec("Kiné", "Kiné", "Immortel", { endurance: 16, mental: 6 });
defSpec("Kiné", "Adjoint tactique", "Libéro", { placement: 9, tacle: 7, vitesse: 6 });
defSpec("Kiné", "Scout", "Relanceur", { vision: 8, passe: 8, vitesse: 6 });
defSpec("Adjoint tactique", "Adjoint tactique", "Verrou", { tacle: 12, placement: 12 });
defSpec("Adjoint tactique", "Scout", "Capitaine de vestiaire", { vision: 8, mental: 8, placement: 6 });
defSpec("Scout", "Scout", "Œil de lynx", { vision: 16, passe: 6 });
/* Les emblèmes d'École (Passeport + composant, craftables) */
const EMBLEMES = {
  "Prépa physique": "Kick & Rush", "Coach mental": "Les Revanchards",
  "Analyste vidéo": "Catenaccio", "Coach de finition": "Les Internationaux",
  "Coach technique": "École de la Rue", "Kiné": "Football Total",
  "Adjoint tactique": "Tiki-Taka", "Scout": "Les Pros",
};

/* Assigne une carte (composant, spécialisation complète ou emblème) à une
   fiche joueur. 3 emplacements max : carte seule ou spécialisation = 1
   emplacement. Renvoie { ok, evenement } — l'évènement sert à la mise
   en scène (spécialisation créée, emblème posé…). */
function assignerCarte(fiche, carte) {
  fiche.staffCartes = fiche.staffCartes || [];
  fiche.specialisations = fiche.specialisations || [];
  const emplacements = fiche.staffCartes.length + fiche.specialisations.length;
  const estSpec = Object.values(SPECIALISATIONS).some((s) => s.nom === carte);
  if (estSpec) {
    if (emplacements >= 3) return { ok: false, raison: "3 emplacements maximum." };
    fiche.specialisations.push(carte);
    return { ok: true, evenement: { type: "spec", nom: carte, joueur: fiche.nom } };
  }
  // composant : peut fusionner avec une carte seule déjà posée
  if (fiche.staffCartes.length > 0) {
    const autre = fiche.staffCartes[0];
    if (carte === "Passeport" || autre === "Passeport") {
      const composant = carte === "Passeport" ? autre : carte;
      if (composant === "Passeport") { // Passeport + Passeport : Citoyen du monde
        fiche.staffCartes.shift();
        fiche.citoyenDuMonde = true;
        return { ok: true, evenement: { type: "citoyen", joueur: fiche.nom } };
      }
      const ecole = EMBLEMES[composant];
      fiche.staffCartes.shift();
      fiche.ecoleBonus = ecole;
      return { ok: true, evenement: { type: "embleme", ecole, joueur: fiche.nom } };
    }
    const combo = SPECIALISATIONS[cleCombo(autre, carte)];
    if (combo) {
      fiche.staffCartes.shift();
      fiche.specialisations.push(combo.nom);
      return { ok: true, evenement: { type: "spec", nom: combo.nom, joueur: fiche.nom } };
    }
  }
  if (emplacements >= 3) return { ok: false, raison: "3 emplacements maximum." };
  fiche.staffCartes.push(carte);
  return { ok: true, evenement: { type: "composant", nom: carte, joueur: fiche.nom } };
}
const aSpec = (j, nom) => (j.specialisations || []).includes(nom);
const equipeASpec = (equipe, nom) => equipe.joueurs.some((j) => aSpec(j, nom));

/* ============================================================
   SYNERGIES — paliers (design/synergies.md) et BOOSTS DE STATS
   PRÉCISES (design/stats.md : jamais de « +X % global »).
   Les effets à procs (ballon long, contre, gestes…) restent des
   événements de match, en plus des boosts.
   ============================================================ */
const PALIERS_ECOLES = {
  "La Grinta": [3, 6, 9], "Catenaccio": [2, 4, 6, 9], "Kick & Rush": [2, 5],
  "École de la Rue": [1, 3, 5, 7, 10], "Tiki-Taka": [3, 5, 7], "Football Total": [3, 5, 7, 10],
  "L'Académie": [2, 3], "Les Internationaux": [2, 3], "Le Douzième Homme": [3, 4, 6],
  "Les Pros": [2, 3], "Les Revanchards": [2, 3, 4],
};
const PALIERS_ARCHETYPES = {
  "Mur": [2, 4, 6], "Moteur": [2, 4, 6], "Sentinelle": [2, 4, 6],
  "Virtuose": [2, 3, 4, 5], "Finisseur": [2, 3, 4, 5], "Créateur": [2, 3, 4, 5],
  "Piston": [2, 3, 4, 5], "Renard": [2, 3, 4, 5], "Chanceux": [2, 4],
  "Guerrier": [2, 4, 6], "Mentor": [3, 5, 7], "Capitaine": [1],
};
/* Chaque famille booste des stats précises, ×s (palier atteint) */
const BOOSTS_FAMILLES = {
  "Tiki-Taka": { passe: 5, technique: 3 },
  "Catenaccio": { tacle: 5, placement: 3 },
  "Kick & Rush": { aerien: 5, endurance: 3 },
  "École de la Rue": { dribble: 5, technique: 3 },
  "La Grinta": { mental: 6 },
  "Football Total": { vision: 4, vitesse: 3 },
  "L'Académie": { technique: 4, mental: 3 },
  "Les Internationaux": { vision: 3, mental: 3 },
  "Le Douzième Homme": { mental: 4, placement: 3 },
  "Les Pros": { placement: 3, technique: 3 },
  "Les Revanchards": { mental: 4 },
  "Mur": { placement: 4, reflexes: 5 },
  "Moteur": { endurance: 5, vitesse: 3 },
  "Sentinelle": { placement: 4, tacle: 3 },
  "Virtuose": { dribble: 4, technique: 3 },
  "Finisseur": { tir: 5, placement: 2 },
  "Créateur": { passe: 4, vision: 3 },
  "Piston": { vitesse: 4, endurance: 3 },
  "Renard": { placement: 4, vitesse: 2 },
  "Chanceux": { mental: 3 },
  "Guerrier": { mental: 4, tacle: 2 },
  "Mentor": { vision: 4, mental: 2 },
  "Capitaine": { mental: 4 },
  "Guerre des égos": { mental: -8 },
};

function calculerSynergies(equipe) {
  const ecoles = {}, archetypes = {};
  for (const j of equipe.joueurs) {
    if (j.ecole) ecoles[j.ecole] = (ecoles[j.ecole] || 0) + 1;
    if (j.ecoleBonus && j.ecoleBonus !== j.ecole) ecoles[j.ecoleBonus] = (ecoles[j.ecoleBonus] || 0) + 1;
    if (j.archetype) archetypes[j.archetype] = (archetypes[j.archetype] || 0) + 1;
  }
  // Citoyen du monde : compte pour +1 dans TOUTES les Écoles actives
  const nbCitoyens = equipe.joueurs.filter((j) => j.citoyenDuMonde).length;
  if (nbCitoyens) for (const nom of Object.keys(ecoles)) ecoles[nom] += nbCitoyens;
  if (equipe.joueurs.some((j) => j.unique === "Le Professeur"))
    ecoles["Football Total"] = (ecoles["Football Total"] || 0) + 1;
  const nbCameleons = equipe.joueurs.filter((j) => j.unique === "Caméléon").length;
  if (nbCameleons > 0 && Object.keys(ecoles).length > 0) {
    const majoritaire = Object.keys(ecoles).sort((a, b) => ecoles[b] - ecoles[a])[0];
    ecoles[majoritaire] += nbCameleons;
  }
  const actives = [];
  for (const [nom, nb] of Object.entries(ecoles)) {
    const s = (PALIERS_ECOLES[nom] || [2, 4, 6]).filter((p) => nb >= p).length;
    if (s > 0) actives.push({ nom, nb, s, type: "ecole" });
  }
  for (const [nom, nb] of Object.entries(archetypes)) {
    if (nom === "Capitaine") {
      // Relique « Le Brassard du Fondateur » : DEUX Capitaines coexistent
      // (le bonus double), la guerre des égos est annulée
      const brassard = equipe.joueurs.some((j) => j.relique === "Le Brassard du Fondateur");
      if (nb === 1 || (brassard && nb >= 2)) actives.push({ nom, nb, s: brassard && nb >= 2 ? 2 : 1, type: "archetype" });
      else if (nb >= 2) actives.push({ nom: "Guerre des égos", nb, s: 1, type: "archetype" });
      continue;
    }
    const s = (PALIERS_ARCHETYPES[nom] || [2, 4, 6]).filter((p) => nb >= p).length;
    if (s > 0) actives.push({ nom, nb, s, type: "archetype" });
  }
  return actives;
}
const s = (equipe, nom) => { const sy = equipe.synergies.find((x) => x.nom === nom); return sy ? sy.s : 0; };
const aUnique = (equipe, nomUnique) => equipe.joueurs.find((j) => j.unique === nomUnique);

/* ============================================================
   CRÉATION D'ÉQUIPE — stats générées, puis boosts ciblés
   (j.statsBase = avant boosts ; j.boosts = le détail, pour que la
   fiche affiche les valeurs boostées en vert ; j.stats = final)
   ============================================================ */
function equipeDepuisFiches(nomClub, coach, fiches) {
  const joueurs = fiches.map((fiche) => ({
    ...fiche,
    nom: (fiche.etoiles || 1) >= 2 ? `${fiche.nom} ${"★".repeat(fiche.etoiles)}` : fiche.nom,
    statsBase: genererStats(fiche),
  }));
  const equipe = { nom: nomClub, coach, joueurs };
  equipe.synergies = calculerSynergies(equipe);

  for (const j of joueurs) {
    j.boosts = {};
    for (const sy of equipe.synergies) {
      // Un boost d'École ne touche que ses membres ; un boost d'archétype
      // que ses porteurs ; Capitaine et Guerre des égos touchent l'équipe.
      const concerne =
        (sy.type === "ecole" && j.ecole === sy.nom) ||
        (sy.type === "archetype" && j.archetype === sy.nom) ||
        sy.nom === "Capitaine" || sy.nom === "Guerre des égos";
      if (!concerne) continue;
      const boosts = BOOSTS_FAMILLES[sy.nom] || {};
      for (const [stat, montant] of Object.entries(boosts)) {
        if (!(stat in j.statsBase)) continue;
        j.boosts[stat] = (j.boosts[stat] || 0) + montant * sy.s;
      }
    }
    // Le staff : composants seuls + spécialisations = boosts ciblés
    for (const carte of j.staffCartes || []) {
      for (const [stat, montant] of Object.entries(COMPOSANTS_STAFF[carte] || {})) {
        if (stat in j.statsBase) j.boosts[stat] = (j.boosts[stat] || 0) + montant;
      }
    }
    for (const nomSpec of j.specialisations || []) {
      const spec = Object.values(SPECIALISATIONS).find((x) => x.nom === nomSpec);
      if (!spec) continue;
      // version ICONIQUE (les Radiants) : boosts ×1,5
      const facteurIconique = (j.specsIconiques || []).includes(nomSpec) ? 1.5 : 1;
      for (const [stat, montant] of Object.entries(spec.boosts)) {
        if (stat in j.statsBase) j.boosts[stat] = (j.boosts[stat] || 0) + Math.round(montant * facteurIconique);
      }
    }
    j.stats = {};
    for (const [stat, valeur] of Object.entries(j.statsBase))
      j.stats[stat] = Math.max(5, Math.min(99, valeur + (j.boosts[stat] || 0)));

    // ---- le malus hors-poste (décision n°21) ----
    // adjacent : −10 % · à deux lignes : −25 % · champ dans les buts : −50 %
    // Le Football Total le réduit (palier 3 : ×0,6 ; 5 : ×0,3 ; 7 : annulé) ;
    // Ruud (« Le Professeur ») y est immunisé par son Unique.
    const ORDRE_LIGNES = ["GAR", "DÉF", "MIL", "ATT"];
    const ligne = ligneDe(j);
    const distance = Math.abs(ORDRE_LIGNES.indexOf(ligne) - ORDRE_LIGNES.indexOf(j.poste));
    j.horsPoste = distance > 0;
    if (j.horsPoste) {
      let malus = ligne === "GAR" && j.poste !== "GAR" ? 0.5 : distance === 1 ? 0.10 : 0.25;
      const total = s(equipe, "Football Total");
      let facteur = total >= 3 ? 0 : total === 2 ? 0.3 : total === 1 ? 0.6 : 1;
      if (j.unique === "Le Professeur") facteur = 0;
      if (j.relique === "Le Sifflet Avalé") facteur = 0; // l'arbitre ne voit plus rien
      malus *= facteur;
      j.malusHorsPoste = malus;
      for (const stat of Object.keys(j.stats)) j.stats[stat] = Math.max(5, Math.round(j.stats[stat] * (1 - malus)));
      // un joueur de champ dans les buts : réflexes plancher (😱)
      if (ligne === "GAR" && j.poste !== "GAR") {
        j.stats.reflexes = 15;
        j.stats.aerien = j.stats.aerien || 20;
        j.stats.pied = j.stats.pied || 20;
      }
      // un gardien en joueur de champ : ses stats de champ n'existent pas
      if (j.poste === "GAR" && ligne !== "GAR") {
        j.stats.tir = j.stats.tir || 20;
        j.stats.dribble = j.stats.dribble || 20;
        j.stats.tacle = j.stats.tacle || 25;
      }
    }
    j.note = noteGlobale(j.stats);
    j.signatures = statsSignatures(j.stats);
  }
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
   L'ADN DU CLUB — 6 axes agrégés pour le panneau du mercato
   ============================================================ */
const AXES_ADN = {
  "Attaque": ["tir", "reflexes"], // les réflexes du gardien comptent à part
  "Création": ["passe", "vision"],
  "Dribble": ["dribble", "technique"],
  "Défense": ["tacle", "placement", "reflexes", "aerien"],
  "Physique": ["endurance", "vitesse"],
  "Mental": ["mental"],
};
function adnClub(equipe) {
  const axes = {};
  for (const [axe, statsAxe] of Object.entries(AXES_ADN)) {
    let total = 0, compte = 0;
    for (const j of equipe.joueurs) {
      for (const stat of statsAxe) {
        if (axe === "Attaque" && stat === "reflexes") continue; // le gardien n'attaque pas
        if (stat in (j.stats || {})) { total += j.stats[stat]; compte++; }
      }
    }
    axes[axe] = compte ? Math.round(total / compte) : 0;
  }
  return axes;
}

/* ============================================================
   LA MATRICE DES DUELS (design/stats.md) — chaque duel lit
   2 stats de chaque côté. L'endurance fatigue, le mental
   module les moments chauds.
   ============================================================ */
const duo = (j, s1, s2) => ((j.stats[s1] || 40) + (j.stats[s2] || 40)) / 2;

/* Fatigue : à partir de la mi-match, les stats baissent d'autant plus
   que l'endurance est basse. Mental : ±15 % dans les moments chauds. */
function forme(j, ctx, equipe) {
  const nb = ctx.nbPhases || NB_PHASES;
  const progression = Math.max(0, (ctx.numero - nb / 2) / nb);
  const fatigue = 1 - progression * (1 - (j.stats.endurance || 50) / 100) * 0.6;
  let mental = 1;
  if (ctx.momentChaud()) mental = 0.88 + ((j.stats.mental || 50) / 100) * 0.24;
  // Relique « Le Maillot Retourné » : la rage de l'ancien — bonus quand
  // l'adversaire aligne des joueurs de son École d'origine
  let rage = 1;
  if (j.relique === "Le Maillot Retourné" && j.ecole && ctx.ecolesAdverses &&
      ctx.ecolesAdverses[equipe.nom] && ctx.ecolesAdverses[equipe.nom].has(j.ecole)) rage = 1.12;
  return fatigue * mental * rage;
}
function forceCollective(equipe, joueurs, s1, s2, ctx) {
  if (!joueurs.length) return 0;
  const somme = joueurs.reduce((t, j) => t + duo(j, s1, s2) * forme(j, ctx, equipe), 0);
  return (somme / joueurs.length) * Math.sqrt(joueurs.length);
}

/* ============================================================
   LE TIR — Tir + Placement contre les Réflexes du gardien
   (le Placement des Murs pèse en malus d'xG). Autour : Professore,
   Sentinelles, El Santo, blocs des Murs, Renards, Chanceux.
   ============================================================ */
function tenterTir(attaque, defense, ctx, evenements, bonusQualite = 0) {
  const etatDef = ctx.etat[defense.nom];
  const attaquants = parPoste(attaque, "ATT");
  const candidatsTir = [...attaquants];
  const milieuxAtt = parPoste(attaque, "MIL");
  if (milieuxAtt.length && (candidatsTir.length === 0 || proba(0.35))) candidatsTir.push(...milieuxAtt);
  const improvise = candidatsTir.length === 0; // aucun joueur devant
  if (improvise) candidatsTir.push(...attaque.joueurs.filter((j) => ligneDe(j) !== "GAR"));
  const finisseur = choisirParmi(attaque, ctx, candidatsTir);
  const gardien = parPoste(defense, "GAR")[0] || { nom: "la cage vide", stats: { reflexes: 5 }, cageVide: true };
  // la passe décisive : le porteur de la phase, s'il est du bon camp et
  // n'est pas lui-même le buteur (contres : le porteur reste adverse → null)
  const passeurPour = (buteur) =>
    ctx.dernierPorteur && ctx.dernierPorteur.equipe === attaque.nom && ctx.dernierPorteur.nom !== buteur
      ? ctx.dernierPorteur.nom : null;

  if (aUnique(defense, "Il Professore") && !etatDef.professoreUtilise && proba(0.5)) {
    etatDef.professoreUtilise = true;
    evenements.push({ type: "hors_jeu", acteurs: [finisseur.nom], texte: `Drapeau levé ! Le piège du hors-jeu d'Il Professore se referme sur ${finisseur.nom}.`, synergie: "Il Professore", equipe: defense.nom });
    return false;
  }
  // La spécialisation Professeur (Analyste + Analyste) fait pareil, une fois
  if (equipeASpec(defense, "Professeur") && !etatDef.professeurStaffUtilise && proba(0.5)) {
    etatDef.professeurStaffUtilise = true;
    evenements.push({ type: "hors_jeu", acteurs: [finisseur.nom], texte: `Tout était anticipé à la vidéo — l'occasion de ${finisseur.nom} meurt dans l'œuf.`, synergie: "Professeur", equipe: defense.nom });
    return false;
  }
  const sentinelle = s(defense, "Sentinelle");
  if (sentinelle && proba(0.08 * sentinelle)) {
    const defenseur = choisirParmi(defense, ctx, parPoste(defense, "DÉF").length ? parPoste(defense, "DÉF") : defense.joueurs);
    evenements.push({ type: "interception", acteurs: [defenseur.nom, finisseur.nom], texte: `${finisseur.nom} arme son tir… mais ${defenseur.nom} surgit et coupe la trajectoire !`, synergie: "Sentinelle", equipe: defense.nom });
    return false;
  }

  // Le duel du tir : Tir + Placement vs Réflexes (+ Placement des Murs)
  // Un match court est un condensé : la conversion monte pour garder
  // un rythme de buts par MATCH comparable (décision n°20)
  const condense = (NB_PHASES - (ctx.nbPhases || NB_PHASES)) * 2.5;
  let qualite = duo(finisseur, "tir", "placement") * forme(finisseur, ctx, attaque) * (improvise ? 0.6 : 1) + de(38) + bonusQualite + condense;
  // Relique « La Chaussure Dépareillée » : xG dopé… mais 10 % de tirs
  // dans les nuages — le chaos assumé
  if (finisseur.relique === "La Chaussure Dépareillée") qualite *= proba(0.10) ? 0.2 : 1.35;
  // Anti-emballement : un match plié se gère — l'équipe qui mène de 3+
  // lève le pied, le rythme de buts ralentit (écarts fleuves évités)
  const avance = ctx.scoreDe(attaque) - ctx.scoreAdverse(attaque);
  if (avance >= 3) qualite *= Math.max(0.45, 1 - 0.2 * (avance - 2));
  const murs = defense.joueurs.filter((j) => j.archetype === "Mur" && j.poste !== "GAR");
  const malusMurs = Math.min(murs.reduce((t, j) => t + (j.stats.placement || 0), 0) * 0.05, 8);
  let parade = gardien.cageVide
    ? 10 + de(10)
    : (gardien.stats.reflexes || 40) * 0.90 * forme(gardien, ctx, defense) + de(26) + malusMurs;

  let classe = false;
  const virtuose = s(attaque, "Virtuose");
  if (virtuose && proba(0.08 * virtuose)) { parade /= 2; classe = true; ctx.etat[attaque.nom].flow++; }

  let but = qualite > parade;
  let blocage = null;
  const miTemps = ctx.numero <= (ctx.nbPhases || NB_PHASES) / 2 ? 1 : 2;
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
      but: true, buteur: finisseur.nom, passeur: passeurPour(finisseur.nom), equipe: attaque.nom,
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
      synergie: classe ? "Virtuose" : (s(attaque, "Finisseur") && qualite - parade <= 5 * s(attaque, "Finisseur") && proba(0.4) ? "Finisseur" : null),
    });
    return true;
  }

  const chanceux = s(attaque, "Chanceux");
  if (chanceux && proba(0.06 * chanceux)) {
    evenements.push({
      type: "but", acteurs: [finisseur.nom],
      but: true, buteur: finisseur.nom, passeur: passeurPour(finisseur.nom), equipe: attaque.nom,
      texte: `La frappe de ${finisseur.nom} est repoussée… non ! Poteau RENTRANT ! La chance ${chanceux >= 2 ? "insolente" : "sourit"} !`,
      cri: `BUUUT de ${finisseur.nom} pour ${attaque.nom} !`, synergie: "Chanceux",
    });
    return true;
  }

  if (blocage) {
    evenements.push({ type: "blocage", acteurs: [finisseur.nom], texte: blocage.texte, synergie: blocage.synergie, equipe: defense.nom });
  } else {
    // la MARGE du duel : un tir qui passait à un cheveu est un
    // presque-but (pres) — le rendu et le stade le célèbrent (OHHH)
    const marge = qualite - parade;
    evenements.push({
      type: "arret", acteurs: [finisseur.nom, gardien.nom],
      marge, pres: marge > -10,
      texte: gardien.cageVide
        ? `${finisseur.nom} vise la cage vide… et dévisse ! Incroyable raté !`
        : marge > -10
          ? varie(
            `${finisseur.nom} croyait l'avoir mise au fond… ${gardien.nom} sort l'arrêt RÉFLEXE ! Le stade n'en revient pas !`,
            `La frappe de ${finisseur.nom} prend la lucarne… et ${gardien.nom} la détourne du bout des gants ! OHHH !`,
            `${finisseur.nom} arme… c'est cadré, c'est fort — ${gardien.nom} s'envole et la sort du cadre !`
          )
          : varie(
            `${finisseur.nom} frappe… mais ${gardien.nom} s'envole et détourne ! Quel arrêt !`,
            `${finisseur.nom} arme sa frappe… ${gardien.nom} gagne son face-à-face du bout des gants !`,
            `La tentative de ${finisseur.nom} est cadrée… mais ${gardien.nom} dit non !`
          ),
      equipe: defense.nom,
      synergie: s(defense, "Mur") && proba(0.3) ? "Mur" : null,
    });
  }

  // Double détente : si son tir est arrêté, il retente immédiatement
  const etatAtt = ctx.etat[attaque.nom];
  if (aSpec(finisseur, "Double détente") && !etatAtt.detenteUtilisee) {
    etatAtt.detenteUtilisee = true;
    evenements.push({ type: "rebond", acteurs: [finisseur.nom], texte: `${finisseur.nom} suit sa frappe — double détente !`, synergie: "Double détente", equipe: attaque.nom });
    const secondTir = duo(finisseur, "tir", "placement") + de(34);
    const secondeParade = (gardien.cageVide ? 10 : gardien.stats.reflexes || 40) * 0.7 + de(26);
    if (secondTir > secondeParade) {
      evenements.push({
        type: "but", acteurs: [finisseur.nom, gardien.nom],
        but: true, buteur: finisseur.nom, passeur: passeurPour(finisseur.nom), equipe: attaque.nom,
        texte: `La reprise instantanée…`, cri: `BUUUT de ${finisseur.nom} pour ${attaque.nom} !`, synergie: "Double détente",
      });
      return true;
    }
    evenements.push({ type: "arret", acteurs: [finisseur.nom, gardien.nom], pres: secondTir - secondeParade > -10, texte: `…mais ${gardien.nom} s'y reprend à deux fois et gagne son duel !`, equipe: defense.nom, synergie: null });
  }

  let renard = s(attaque, "Renard");
  if (equipeASpec(attaque, "Charognard")) renard += 1;
  if (renard && proba(0.10 * renard)) {
    const renards = attaque.joueurs.filter((j) => j.archetype === "Renard" || aSpec(j, "Charognard"));
    const opportuniste = renards.length ? choisirParmi(attaque, ctx, renards) : finisseur;
    evenements.push({ type: "rebond", acteurs: [opportuniste.nom], texte: `Le ballon traîne dans la surface… ${opportuniste.nom} a suivi !`, synergie: "Renard", equipe: attaque.nom });
    const reprise = duo(opportuniste, "placement", "tir") + de(30);
    const paradeReprise = (gardien.cageVide ? 10 : gardien.stats.reflexes || 40) + de(24);
    if (reprise > paradeReprise) {
      evenements.push({
        type: "but", acteurs: [opportuniste.nom, gardien.nom],
        but: true, buteur: opportuniste.nom, passeur: passeurPour(opportuniste.nom), equipe: attaque.nom,
        texte: `Reprise à bout portant…`, cri: `BUUUT de ${opportuniste.nom} pour ${attaque.nom} !`, synergie: null,
      });
      return true;
    }
    evenements.push({ type: "arret", acteurs: [opportuniste.nom, gardien.nom], pres: reprise - paradeReprise > -10, texte: `…mais ${gardien.nom} réalise le double arrêt !`, equipe: defense.nom, synergie: null });
  }
  return false;
}

/* ============================================================
   UNE PHASE — 1. le milieu (Passe+Vision, duel de possession)
   2. la percée, dont le TYPE est tiré au sort et lit la matrice :
      dribble (Dribble+Technique vs Tacle+Placement)
      course  (Vitesse+Endurance vs Vitesse+Placement)
      aérien  (Placement+Mental des deux côtés)
      centre  (Passe+Technique vs Sortie aérienne du gardien)
   3. le tir. Les procs d'Écoles et d'Uniques s'y greffent.
   ============================================================ */
const TYPES_PERCEE = [
  { type: "dribble", poids: 4, att: ["dribble", "technique"], def: ["tacle", "placement"],
    reussite: null },
  { type: "course", poids: 2.5, att: ["vitesse", "endurance"], def: ["vitesse", "placement"] },
  { type: "aerien", poids: 1.5, att: ["placement", "mental"], def: ["placement", "mental"] },
  { type: "centre", poids: 2, att: ["passe", "technique"], def: null }, // le gardien sort
];

function resoudrePhase(eqA, eqB, ctx) {
  const evenements = [];
  let attaque = null;
  let bonusTir = 0;

  // Ballon long du Kick & Rush (un par match au palier 2, déferlante ensuite)
  for (const eq of [eqA, eqB]) {
    const kr = s(eq, "Kick & Rush");
    const etat = ctx.etat[eq.nom];
    const disponible = kr >= 2 ? true : (kr >= 1 && !etat.ballonLongUtilise);
    if (!attaque && disponible && proba(0.15)) {
      etat.ballonLongUtilise = true;
      etat.duelsAeriens = (etat.duelsAeriens || 0) + 1;
      attaque = eq;
      const hammer = aUnique(eq, "The Hammer");
      if (hammer) bonusTir += 15;
      evenements.push({
        type: "ballon_long", acteurs: [],
        texte: hammer
          ? `Longue transversale… The Hammer écrase son duel aérien, le ballon devient un boulet !`
          : `Longue transversale de ${eq.nom} par-dessus tout le monde — pur Kick & Rush !`,
        synergie: hammer ? "The Hammer" : "Kick & Rush", equipe: eq.nom,
      });
    }
  }
  if (!attaque) {
    for (const eq of [eqA, eqB]) {
      if (aUnique(eq, "La Lambretta") && proba(0.10)) {
        attaque = eq;
        bonusTir += 10;
        evenements.push({ type: "lambretta", acteurs: [], texte: `La Lambretta décolle — la passe par-dessus la défense trouve son homme à bout portant !`, synergie: "La Lambretta", equipe: eq.nom });
        break;
      }
    }
  }

  // --- Duel n°1 : le milieu — Passe + Vision des milieux ---
  // Staff du club « Le Bus du Club » : le premier duel d'équipe de
  // chaque match est gagné d'office (objet de soutien, non assigné)
  if (!attaque && ctx.numero === 1) {
    const busGagnants = [eqA, eqB].filter((e) =>
      (e.staffClub || []).includes("Le Bus du Club") && !(((e === eqA ? eqB : eqA).staffClub || []).includes("Le Bus du Club")));
    if (busGagnants.length === 1) {
      attaque = busGagnants[0];
      const porteurBus = attaque.joueurs.find((j) => ligneDe(j) === "MIL") || attaque.joueurs[0];
      evenements.push({ type: "possession", acteurs: [porteurBus.nom],
        texte: `Le Bus du Club a déposé l'équipe à l'heure — ${attaque.nom} démarre pied au plancher !`,
        synergie: null, equipe: attaque.nom });
      ctx.dernierPorteur = { nom: porteurBus.nom, equipe: attaque.nom };
    }
  }
  if (!attaque) {
    // Matrice « passe qui progresse » : Passe+Vision du porteur contre
    // Placement+Vitesse des milieux adverses (l'interception)
    const lesMilieux = (eq) => {
      const milieux = parPoste(eq, "MIL");
      return milieux.length ? { joueurs: milieux, facteur: 1 } : { joueurs: eq.joueurs.filter((j) => j.poste !== "GAR"), facteur: 0.55 };
    };
    const progression = (eq) => {
      const m = lesMilieux(eq);
      let bonus = 0;
      if (aUnique(eq, "Don Álvaro")) bonus += 10;
      if (s(eq, "La Grinta") && ctx.scoreDe(eq) < ctx.scoreAdverse(eq)) bonus += 6 * s(eq, "La Grinta");
      if (aUnique(eq, "El Pibe") && ctx.scoreDe(eq) < ctx.scoreAdverse(eq)) bonus += 8;
      if (s(eq, "Kick & Rush") >= 2 && ctx.numero >= 3) bonus += 8;
      if (s(eq, "École de la Rue") >= 2) bonus += Math.min(ctx.etat[eq.nom].flow * 3, 15); // le Flow
      if (ctx.scoreDe(eq) < ctx.scoreAdverse(eq)) bonus += 10; // l'équipe menée pousse
      if (ctx.scoreDe(eq) - ctx.scoreAdverse(eq) >= 3) bonus -= 12; // le match est plié, on gère
      return forceCollective(eq, m.joueurs, "passe", "vision", ctx) * m.facteur + bonus;
    };
    const interception = (eq) => {
      const m = lesMilieux(eq);
      return forceCollective(eq, m.joueurs, "placement", "vitesse", ctx) * m.facteur;
    };
    const forceA = progression(eqA) - 0.7 * interception(eqB) + de(70);
    const forceB = progression(eqB) - 0.7 * interception(eqA) + de(70);
    attaque = forceA >= forceB ? eqA : eqB;
    const milieux = parPoste(attaque, "MIL");
    const autresChamp = attaque.joueurs.filter((j) => j.poste !== "GAR");
    const candidatsPorteur = milieux.length && !proba(0.3) ? milieux : autresChamp;
    const porteur = choisirParmi(attaque, ctx, candidatsPorteur.length ? candidatsPorteur : attaque.joueurs);
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
      ),
      synergie: s(attaque, "Tiki-Taka") && proba(0.25) ? "Tiki-Taka" : null, equipe: attaque.nom,
    });
    // mémorisé pour créditer la passe décisive si la phase finit au fond
    ctx.dernierPorteur = { nom: porteur.nom, equipe: attaque.nom };
  }
  const defense = attaque === eqA ? eqB : eqA;

  // --- Duel n°2 : la percée — le type de duel est tiré au sort ---
  let percee = bonusTir > 0;
  if (!percee) {
    const totalPoids = TYPES_PERCEE.reduce((t, x) => t + x.poids, 0);
    let tirage = Math.random() * totalPoids, typePercee = TYPES_PERCEE[0];
    for (const candidat of TYPES_PERCEE) { tirage -= candidat.poids; if (tirage <= 0) { typePercee = candidat; break; } }

    const attaquants = [...parPoste(attaque, "ATT"), ...parPoste(attaque, "MIL")];
    const defenseurs = parPoste(defense, "DÉF");
    const gardienDef = parPoste(defense, "GAR")[0];
    // personne devant (bus intégral) : on dégage au petit bonheur — une
    // attaque improvisée par des défenseurs vaut moitié moins
    const forceAtt = attaquants.length
      ? forceCollective(attaque, attaquants, typePercee.att[0], typePercee.att[1], ctx)
      : forceCollective(attaque, attaque.joueurs.filter((j) => ligneDe(j) !== "GAR"), typePercee.att[0], typePercee.att[1], ctx) * 0.45;
    // Le surnombre défensif sature : au-delà d'un défenseur de plus que
    // d'attaquants, on se marche dessus (le bus est viable, pas absolu)
    const defenseursUtiles = defenseurs.slice(0, Math.max(attaquants.length, 1) + 1);
    let forceDef;
    if (typePercee.type === "centre") {
      forceDef = (gardienDef ? duo(gardienDef, "aerien", "placement") * 1.6 : 20)
        + forceCollective(defense, defenseursUtiles, "placement", "placement", ctx) * 0.5;
    } else {
      forceDef = forceCollective(defense, defenseursUtiles.length ? defenseursUtiles : defense.joueurs.filter((j) => ligneDe(j) !== "GAR"), typePercee.def[0], typePercee.def[1], ctx);
    }
    if (typePercee.type === "aerien") ctx.duelAerienEnCours = true;
    let bonusAtt = 0;
    if (s(attaque, "La Grinta") && ctx.scoreDe(attaque) < ctx.scoreAdverse(attaque)) bonusAtt += 6 * s(attaque, "La Grinta");
    // l'encombrement dilue le marquage : une ligne à 2 défend plein pot,
    // un bus à 4-5 se marche dessus (−7 % par défenseur au-delà de 2)
    const dilution = Math.max(0.72, 1 - 0.07 * Math.max(0, defenseursUtiles.length - 2));
    // +8 plat à l'attaque : plus de percées converties en OCCASIONS —
    // le gardien renforcé (parade ×0.90) garde les buts/match à 2-3.
    // C'est le réglage de la dramaturgie (décision 25) : un match plein
    // produit ~6 occasions pour ~2,6 buts, les presque-buts existent.
    percee = forceAtt + bonusAtt + 8 + de(50) > forceDef * dilution + de(50);

    if (!percee) {
      const rue = s(attaque, "École de la Rue");
      if (rue && proba(0.12 * rue)) {
        const dribbleur = choisirParmi(attaque, ctx, attaque.joueurs.filter((j) => j.poste !== "GAR"));
        ctx.etat[attaque.nom].flow++;
        if (aUnique(attaque, "O Rei da Rua")) ctx.etat[attaque.nom].flow++;
        evenements.push({ type: "geste", acteurs: [dribbleur.nom], texte: `${dribbleur.nom} est bloqué… petit pont ! La rue ne s'arrête jamais.`, synergie: "École de la Rue", equipe: attaque.nom });
        percee = forceAtt + bonusAtt + 8 + de(50) > forceDef * dilution + de(50);
      }
    }
    if (ctx.duelAerienEnCours) {
      ctx.etat[(percee ? attaque : defense).nom].duelsAeriens = (ctx.etat[(percee ? attaque : defense).nom].duelsAeriens || 0) + 1;
      ctx.duelAerienEnCours = false;
    }
    if (percee) {
      // La CHAÎNE CAUSALE de l'occasion (décision 24) : événement
      // informatif — qui a percé (le plus fort sur les 2 stats du duel)
      // et quel défenseur a cédé (le plus faible). Le rendu animé et le
      // récit montrent le VRAI chemin de l'attaque.
      const corps = attaquants.length ? attaquants : attaque.joueurs.filter((j) => ligneDe(j) !== "GAR");
      const perceur = corps.slice().sort((a, b) => duo(b, typePercee.att[0], typePercee.att[1]) - duo(a, typePercee.att[0], typePercee.att[1]))[0];
      const battu = typePercee.def && defenseursUtiles.length
        ? defenseursUtiles.slice().sort((a, b) => duo(a, typePercee.def[0], typePercee.def[1]) - duo(b, typePercee.def[0], typePercee.def[1]))[0]
        : null;
      const TEXTES_PERCEE = {
        dribble: `${perceur.nom} efface ${battu ? battu.nom : "son vis-à-vis"} d'un crochet sec — la défense s'ouvre !`,
        course: `${perceur.nom} prend le couloir de vitesse${battu ? ` — ${battu.nom} est distancé` : ""} !`,
        aerien: `${perceur.nom} gagne son duel aérien${battu ? ` au-dessus de ${battu.nom}` : ""} — le ballon retombe dans la surface !`,
        centre: `Le centre de ${perceur.nom} traverse la surface — personne ne coupe !`,
      };
      evenements.push({
        type: "percee", sousType: typePercee.type,
        acteurs: [perceur.nom, battu ? battu.nom : null].filter(Boolean),
        texte: TEXTES_PERCEE[typePercee.type], equipe: attaque.nom, synergie: null,
      });
    }
    if (!percee) {
      const candidatsStop = defenseurs.length && !proba(0.25) ? defenseurs : defense.joueurs.filter((j) => j.poste !== "GAR");
      const defenseur = choisirParmi(defense, ctx, candidatsStop.length ? candidatsStop : defense.joueurs);
      const TEXTES_STOP = {
        dribble: [`${defenseur.nom} ne mord pas dans la feinte et prend le ballon proprement.`, `Tacle parfait de ${defenseur.nom} — le stade apprécie.`],
        course: [`${defenseur.nom} avale la distance et referme la porte au sprint.`, `Course parfaite de ${defenseur.nom}, l'attaque de ${attaque.nom} meurt dans le couloir.`],
        aerien: [`${defenseur.nom} monte plus haut que tout le monde et dégage de la tête.`, `Duel aérien gagné par ${defenseur.nom} — rien ne retombe côté ${attaque.nom}.`],
        centre: [`Le centre est trop long — ${defenseur.nom} couvre et relance.`, `${gardienDef ? gardienDef.nom : defenseur.nom} sort dans les airs et boxe le centre !`],
      };
      evenements.push({
        type: "percee_stoppee", sousType: typePercee.type, acteurs: [defenseur.nom],
        texte: varie(...TEXTES_STOP[typePercee.type], `${defenseur.nom} ferme la porte — la défense de ${defense.nom} tient bon.`),
        synergie: s(defense, "Catenaccio") && proba(0.25) ? "Catenaccio" : null, equipe: defense.nom,
      });
    }
  }

  let butMarque = false;
  if (percee) butMarque = tenterTir(attaque, defense, ctx, evenements, bonusTir);

  // Contre éclair du Catenaccio (ou d'un Contre-attaquant du staff)
  if (!butMarque) {
    const cate = s(defense, "Catenaccio");
    if (!cate && equipeASpec(defense, "Contre-attaquant") && proba(0.08)) {
      evenements.push({ type: "contre", acteurs: [], texte: `Ballon récupéré — la contre-attaque part comme à l'entraînement !`, synergie: "Contre-attaquant", equipe: defense.nom });
      butMarque = tenterTir(defense, attaque, ctx, evenements, 5);
    } else if (cate && proba(0.05 * cate)) {
      evenements.push({ type: "contre", acteurs: [], texte: `Récupération et contre éclair de ${defense.nom} — tout le monde est pris de vitesse !`, synergie: "Catenaccio", equipe: defense.nom });
      butMarque = tenterTir(defense, attaque, ctx, evenements, cate >= 2 ? 8 : 0);
    }
  }
  return evenements;
}

/* ============================================================
   MATCH COMPLET — le moteur calcule tout, le rendu rejoue.
   ============================================================ */
const NB_PHASES = 8;
/* Les minutes affichées selon le format du match (décision n°20 :
   la durée d'un match est proportionnelle à ses enjeux) */
const MINUTES_PAR_FORMAT = {
  4: [12, 35, 61, 88],
  6: [9, 24, 39, 55, 71, 89],
  8: [7, 19, 31, 44, 52, 63, 77, 89],
};

function simulerMatch(eqA, eqB, nbPhases = NB_PHASES) {
  const MINUTES = MINUTES_PAR_FORMAT[nbPhases] ||
    Array.from({ length: nbPhases }, (_, i) => Math.round((90 * (i + 0.5)) / nbPhases));
  let scoreA = 0, scoreB = 0;
  const phases = [];
  const ctx = {
    numero: 0,
    nbPhases,
    etat: {
      [eqA.nom]: { flow: 0, ballonLongUtilise: false, professoreUtilise: false, professeurStaffUtilise: false, detenteUtilisee: false, santo: {}, murs: {}, apparitions: {} },
      [eqB.nom]: { flow: 0, ballonLongUtilise: false, professoreUtilise: false, professeurStaffUtilise: false, detenteUtilisee: false, santo: {}, murs: {}, apparitions: {} },
    },
    scoreDe: (eq) => (eq === eqA ? scoreA : scoreB),
    scoreAdverse: (eq) => (eq === eqA ? scoreB : scoreA),
    momentChaud: () => ctx.numero > nbPhases - 2 || (ctx.numero > nbPhases - 4 && Math.abs(scoreA - scoreB) <= 1),
    // pour le Maillot Retourné : les Écoles présentes chez l'adversaire
    ecolesAdverses: {
      [eqA.nom]: new Set(eqB.joueurs.map((j) => j.ecole).filter(Boolean)),
      [eqB.nom]: new Set(eqA.joueurs.map((j) => j.ecole).filter(Boolean)),
    },
  };
  for (let n = 1; n <= nbPhases; n++) {
    ctx.numero = n;
    const evenements = resoudrePhase(eqA, eqB, ctx);
    if (n === nbPhases && scoreA + compterButs(evenements, eqA) === scoreB + compterButs(evenements, eqB)) {
      for (const eq of [eqA, eqB]) {
        const pantera = aUnique(eq, "La Pantera");
        if (pantera) {
          evenements.push({
            type: "but", acteurs: [pantera.nom],
            but: true, buteur: pantera.nom, equipe: eq.nom,
            texte: `Tout le stade retient son souffle… La Pantera surgit de nulle part, comme toujours quand tout est encore possible.`,
            cri: `BUUUT de ${pantera.nom} pour ${eq.nom} !`, synergie: "La Pantera",
          });
          break;
        }
      }
    }
    for (const ev of evenements) {
      if (ev.but) { if (ev.equipe === eqA.nom) scoreA++; else scoreB++; }
    }
    phases.push({ numero: n, minute: MINUTES[n - 1], evenements, scoreA, scoreB });
  }
  return { phases, scoreA, scoreB, ecart: Math.abs(scoreA - scoreB), etats: ctx.etat };
}
function compterButs(evenements, eq) {
  return evenements.filter((ev) => ev.but && ev.equipe === eq.nom).length;
}

/* Fusion des copies (3 identiques → une étoile de plus, 3★ max) */
function fusionnerEffectif(terrain, banc) {
  const fusions = [];
  let encore = true;
  while (encore) {
    encore = false;
    const tout = [
      ...terrain.map((j) => ({ j, liste: terrain })),
      ...banc.map((j) => ({ j, liste: banc })),
    ].filter((e) => !e.j.icone); // les Icônes sont des copies uniques
    const groupes = {};
    for (const e of tout) {
      const cle = e.j.nom + "|" + (e.j.etoiles || 1);
      (groupes[cle] = groupes[cle] || []).push(e);
    }
    for (const cle of Object.keys(groupes)) {
      const groupe = groupes[cle];
      if (groupe.length >= 3 && (groupe[0].j.etoiles || 1) < 3) {
        groupe.sort((a, b) => (a.liste === terrain ? 0 : 1) - (b.liste === terrain ? 0 : 1));
        const garde = groupe[0].j;
        garde.etoiles = (garde.etoiles || 1) + 1;
        for (const e of groupe.slice(1, 3)) {
          // le staff des copies consommées suit le joueur gardé
          if (e.j.staffCartes) garde.staffCartes = [...(garde.staffCartes || []), ...e.j.staffCartes];
          if (e.j.specialisations) garde.specialisations = [...(garde.specialisations || []), ...e.j.specialisations];
          if (e.j.ecoleBonus && !garde.ecoleBonus) garde.ecoleBonus = e.j.ecoleBonus;
          if (e.j.citoyenDuMonde) garde.citoyenDuMonde = true;
          e.liste.splice(e.liste.indexOf(e.j), 1);
        }
        fusions.push({ nom: garde.nom, etoiles: garde.etoiles });
        encore = true;
        break;
      }
    }
  }
  return fusions;
}

/* ============================================================
   LE RECAP DU MATCH — contributions par joueur, dérivées du flux
   d'événements (le moteur reste la seule source de vérité) :
   buts, passes décisives, duels gagnés (milieu, percées stoppées,
   gestes), arrêts du gardien. L'« homme du match » est le meilleur
   score pondéré des deux camps.
   ============================================================ */
function statsDuMatch(resultat, eqA, eqB) {
  const camps = {};
  const fiches = {}; // nom → { equipe, poste }
  for (const eq of [eqA, eqB]) {
    camps[eq.nom] = {};
    for (const j of eq.joueurs) {
      fiches[j.nom] = { equipe: eq.nom, poste: j.poste };
      camps[eq.nom][j.nom] = { nom: j.nom, poste: j.poste, buts: 0, passes: 0, duels: 0, arrets: 0 };
    }
  }
  const ligneDeStat = (nom) => {
    const f = fiches[nom];
    return f ? camps[f.equipe][nom] : null; // « la cage vide » et cie → ignorés
  };
  for (const phase of resultat.phases) {
    for (const ev of phase.evenements) {
      if (ev.but) {
        const buteur = ligneDeStat(ev.buteur);
        if (buteur) buteur.buts++;
        const passeur = ev.passeur && ligneDeStat(ev.passeur);
        if (passeur) passeur.passes++;
      } else if (ev.type === "arret") {
        const gardien = ligneDeStat(ev.acteurs[1]);
        if (gardien) gardien.arrets++;
      } else if (ev.type === "possession" || ev.type === "percee_stoppee" ||
                 ev.type === "percee" || ev.type === "interception" || ev.type === "geste") {
        const acteur = ligneDeStat(ev.acteurs[0]);
        if (acteur) acteur.duels++;
      }
    }
  }
  const note = (l) => l.buts * 5 + l.passes * 3 + l.arrets * 2.5 + l.duels * 1.5;
  let hommeDuMatch = null;
  const parEquipe = {};
  for (const eq of [eqA, eqB]) {
    parEquipe[eq.nom] = Object.values(camps[eq.nom])
      .map((l) => ({ ...l, score: note(l) }))
      .sort((a, b) => b.score - a.score);
    for (const l of parEquipe[eq.nom]) {
      if (l.score > 0 && (!hommeDuMatch || l.score > hommeDuMatch.score)) {
        hommeDuMatch = { ...l, equipe: eq.nom };
      }
    }
  }
  return { parEquipe, hommeDuMatch };
}

/* ---- Export navigateur + node ---- */
const ONZE = {
  creerEquipe, equipeDepuisFiches, simulerMatch, calculerSynergies,
  genererStats, noteGlobale, statsSignatures, adnClub, NOMS_STATS,
  fusionnerEffectif, degatsPrestige, NB_PHASES, PALIERS_ECOLES, PALIERS_ARCHETYPES,
  COMPOSANTS_STAFF, SPECIALISATIONS, EMBLEMES, assignerCarte, statsDuMatch,
};
if (typeof module !== "undefined") module.exports = ONZE;
if (typeof window !== "undefined") window.ONZE = ONZE;
