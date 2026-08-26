/* ============================================================
   ONZE — LE LIEN QUÊTE ↔ JOUEUR
   ------------------------------------------------------------
   Le carnet et les quêtes sont deux vues d'une même arête :
   une quête pointe des joueurs, un joueur fait avancer des
   quêtes. Ce fichier tient cette relation, une seule fois, pour
   que les deux écrans ne puissent pas se contredire.

   LA RÈGLE DU LIEN (c'est elle qui évite le bruit) :
   une quête pointe un joueur seulement si sa CONDITION nomme un
   trait de ce joueur — son École, son archétype, son poste, son
   coût, son nom, son statut d'Unique. « Aligner un Académicien
   avec 2 cartes Staff » nomme une École : elle pointe les
   Académiciens. « Verrouiller la boutique 2 fois » ne nomme
   personne : elle ne pointe personne, et le déclare avec
   sansJoueur (voir icones.js).

   Sans cette règle, « Aligner un joueur portant 2 cartes Staff »
   pointerait les 71 joueurs, et la fiche de chacun afficherait
   une quête que tout le monde fait avancer : une information
   qui ne distingue rien n'en est pas une.
   ============================================================ */

const ONZE_LIEN = (() => {
  const listeQuetes = () => (typeof ONZE_ICONES !== "undefined" ? ONZE_ICONES.liste : []);
  const etat = () => (typeof partie !== "undefined" ? partie : null);

  /* LE CATALOGUE, UNE SEULE FOIS. Il ne suffit pas de lire le roster :
     Gus et Titi — que la quête « les Increvables » pointe nommément —
     sont des STARTERS, ils ne sont dans design/joueurs.json. La quête
     visait donc deux joueurs introuvables. partie.html déclare ici la
     liste complète (roster + starters) et les deux sens du lien la
     lisent : impossible qu'ils divergent. */
  let sourceCatalogue = () => (typeof tousLesJoueurs !== "undefined" ? tousLesJoueurs : []);
  const definirCatalogue = (fn) => { if (typeof fn === "function") sourceCatalogue = fn; };
  function catalogue() {
    const vus = new Set();
    return (sourceCatalogue() || []).filter((j) => {
      const n = j && j.nom;
      if (!n || vus.has(n)) return false;
      vus.add(n); return true;
    });
  }

  // le dernier aperçu de synergies calculé par partie.html : deux
  // quêtes en ont besoin pour leur progression (Le Système, Le Sélectionneur)
  let dernierApercu = null;
  const memoriserApercu = (a) => { dernierApercu = a || dernierApercu; };

  /* Le nom nu, sans les étoiles ajoutées par les fusions. */
  const nomNu = (j) => String(j && j.nom || "").replace(/ ★+$/, "");

  /* Est-ce que ce joueur fait avancer cette quête ? */
  function pointe(quete, joueur) {
    if (!quete || !joueur || typeof quete.concerne !== "function") return false;
    try { return !!quete.concerne(joueur); } catch (e) { return false; }
  }

  /* La progression affichable d'une quête, calculée sur la partie en cours. */
  function progressionDe(quete, p) {
    p = p || etat();
    if (!p || typeof quete.progression !== "function") return "";
    try { return String(quete.progression(p, dernierApercu)); } catch (e) { return ""; }
  }

  function estDebloquee(quete, p) {
    p = p || etat();
    if (!p || typeof quete.test !== "function") return false;
    try { return !!quete.test(p, dernierApercu); } catch (e) { return false; }
  }

  /* ---- L'ALLER : les quêtes qu'un joueur fait avancer ---- */
  function quetesDuJoueur(joueur, p) {
    p = p || etat();
    const visibles = (p && p.quetesVisibles) || [];
    return listeQuetes().filter((q) => pointe(q, joueur)).map((q) => ({
      id: q.id, nom: q.nom, condition: q.condition,
      progression: progressionDe(q, p),
      visible: visibles.includes(q.id),
      debloquee: estDebloquee(q, p),
    }));
  }

  /* Ce que la fiche du joueur montre : ses quêtes ACTIVES seulement.
     Une quête qu'on ne peut pas encore décrocher n'a rien à y faire. */
  function quetesVisiblesDuJoueur(joueur, p) {
    return quetesDuJoueur(joueur, p).filter((q) => q.visible);
  }

  /* ---- LE RETOUR : les joueurs qu'une quête pointe ---- */
  function joueursDeLaQuete(id) {
    const q = listeQuetes().find((x) => x.id === id);
    if (!q) return [];
    return catalogue().filter((j) => pointe(q, j));
  }

  /* Les joueurs de la quête, rangés par ce qui aide le coach :
     d'abord ceux qu'il a déjà (terrain, puis banc), ensuite les
     autres, du moins cher au plus cher — ceux qu'il peut viser. */
  function joueursDeLaQueteTries(id, p) {
    p = p || etat();
    const terrain = new Set(((p && p.terrain) || []).map(nomNu));
    const banc = new Set(((p && p.banc) || []).map(nomNu));
    const rang = (j) => (terrain.has(j.nom) ? 0 : banc.has(j.nom) ? 1 : 2);
    return joueursDeLaQuete(id).map((j) => ({ fiche: j, rang: rang(j), possede: rang(j) < 2 }))
      .sort((a, b) => a.rang - b.rang || a.fiche.cout - b.fiche.cout ||
        a.fiche.nom.localeCompare(b.fiche.nom));
  }

  /* Les quêtes muettes : celles qui n'ont pas déclaré leur lien.
     Sert au garde-fou (tests/quetes-lien.spec.js) autant qu'à la
     prochaine session qui ajoutera une Icône. */
  const quetesMuettes = () => listeQuetes()
    .filter((q) => typeof q.concerne !== "function" && q.sansJoueur !== true).map((q) => q.id);

  return { quetesDuJoueur, quetesVisiblesDuJoueur, joueursDeLaQuete,
           joueursDeLaQueteTries, quetesMuettes, memoriserApercu, nomNu,
           progressionDe, estDebloquee, definirCatalogue, catalogue };
})();
if (typeof module !== "undefined") module.exports = ONZE_LIEN;
