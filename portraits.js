/* ============================================================
   ONZE — LES PORTRAITS (DA S2) : la table nom → visuels.
   ------------------------------------------------------------
   Deux visuels par joueur : « carte » (illustration paysage 3:2,
   personnage dans les 55 % droits) et « frontale » (silhouette
   debout sur fond transparent).

   RÈGLE D'ARCHITECTURE : aucun chemin d'image n'est écrit dans le
   code du jeu. La source de vérité est design/portraits.json —
   Gabriel réattribue un visuel en éditant UNE ligne.

   Le jeu doit rester parfaitement jouable si la table est vide,
   partielle ou illisible : toute fonction renvoie alors null et
   l'affichage retombe sur la carte Blason / le jeton d'origine.

   API :
     ONZE_PORTRAITS.charger(url?)  → Promise (ne rejette jamais)
     ONZE_PORTRAITS.definir(objet) → injecte une table (tests)
     ONZE_PORTRAITS.carte(nom)     → chemin ou null
     ONZE_PORTRAITS.frontale(nom)  → chemin ou null
     ONZE_PORTRAITS.nombre()       → nombre d'entrées lisibles
   ============================================================ */
const ONZE_PORTRAITS = (() => {
  let index = {};

  /* La clé de recherche est TOLÉRANTE : la table est éditée à la main.
     On absorbe les étoiles de fusion (« Facundo ★★ »), les trois
     apostrophes typographiques (L’Enfant / L'Enfant), la casse et les
     espaces en trop. Les accents, eux, sont significatifs. */
  const normaliser = (nom) => String(nom == null ? "" : nom)
    .normalize("NFC")
    .replace(/\s*★+\s*$/, "")
    .replace(/[’‘‛`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const chemin = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

  function definir(table) {
    index = {};
    if (!table || typeof table !== "object") return 0;
    for (const [nom, entree] of Object.entries(table)) {
      if (!entree || typeof entree !== "object") continue;   // ligne abîmée : ignorée
      index[normaliser(nom)] = { carte: chemin(entree.carte), frontale: chemin(entree.frontale) };
    }
    return Object.keys(index).length;
  }

  /* Ne rejette jamais : fichier absent, JSON cassé, hors-ligne → table vide. */
  function charger(url = "design/portraits.json") {
    if (typeof fetch !== "function") return Promise.resolve(0);
    return fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((t) => definir(t))
      .catch(() => definir(null));
  }

  const entree = (nom) => index[normaliser(nom)] || null;
  const carte = (nom) => (entree(nom) || {}).carte || null;
  const frontale = (nom) => (entree(nom) || {}).frontale || null;
  const nombre = () => Object.keys(index).length;

  return { charger, definir, carte, frontale, entree, normaliser, nombre };
})();
if (typeof module !== "undefined") module.exports = ONZE_PORTRAITS;
