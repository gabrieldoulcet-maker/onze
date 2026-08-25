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

   UN JOUEUR PEUT AVOIR DEUX VISAGES. Gus et Titi jouent d'abord en
   maillot du club (deux des cinq de départ), puis en violet du Douzième
   Homme quand l'Icône n°38 se débloque. La table les distingue par une
   clé À VARIANTE : « Titi » = le maillot du club, « Titi · Le Douzième
   Homme » = la moitié d'Icône. Le jeu sert la bonne version en passant la
   FICHE du joueur (qui porte son École) plutôt que son nom : la variante
   est cherchée d'abord, le nom nu ensuite. Un nom sans variante continue
   de marcher — c'est le cas des 71 du roster.

   TROIS VISUELS POSSIBLES PAR JOUEUR, et deux repères. Les silhouettes
   passent en vue de TROIS QUARTS ÉLEVÉE (la caméra du terrain est en
   plongée : une frontale à hauteur d'œil se lit comme un autocollant
   posé sur la photo). Deux conséquences, prévues ici avant que les
   images n'arrivent :
     · « ombre » : l'ombre au sol est un FICHIER À PART, pas un dégradé
       CSS — elle se redimensionne avec le niveau d'étoiles comme la
       silhouette, et le dessinateur garde la main sur sa forme ;
     · « ancrage » : le POINT D'APPUI dans l'image, en parts de sa
       largeur et de sa hauteur ({ x: 0.5, y: 1 } = les pieds au bas de
       l'image, centrés). Une silhouette de trois quarts ne pose pas ses
       pieds au même endroit qu'une silhouette de face : c'est ce point
       qui est calé sur la ligne de sol, jamais le bord de l'image. Le
       code n'a donc rien à réapprendre quand les proportions changent.
   Les deux sont facultatifs : sans « ombre », l'ombre dessinée en CSS
   reste ; sans « ancrage », on suppose les pieds au bas de l'image.

   API :
     ONZE_PORTRAITS.charger(url?)     → Promise (ne rejette jamais)
     ONZE_PORTRAITS.definir(objet)    → injecte une table (tests)
     ONZE_PORTRAITS.carte(fiche|nom)  → chemin ou null
     ONZE_PORTRAITS.frontale(f|nom)   → chemin ou null
     ONZE_PORTRAITS.ombre(f|nom)      → chemin ou null
     ONZE_PORTRAITS.ancrage(f|nom)    → { x, y } (défaut : pieds en bas)
     ONZE_PORTRAITS.nombre()          → nombre d'entrées lisibles
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
    .replace(/\s*[·•|]\s*/g, " · ")   // le séparateur de variante, quelle que soit sa saisie
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const chemin = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

  /* Le point d'appui, tel qu'il sera saisi à la main dans la table :
     { x: 0.52, y: 0.93 } ou [0.52, 0.93]. Tout ce qui n'est pas un couple
     de nombres entre 0 et 1 retombe sur le défaut — la table s'édite à la
     main, elle n'a pas à être parfaite pour que le jeu tourne. */
  const ANCRAGE_DEFAUT = { x: 0.5, y: 1 };
  const part = (v) => (typeof v === "number" && isFinite(v) && v >= 0 && v <= 1 ? v : null);
  function lireAncrage(brut) {
    if (Array.isArray(brut)) brut = { x: brut[0], y: brut[1] };
    if (!brut || typeof brut !== "object") return null;
    const x = part(brut.x), y = part(brut.y);
    if (x === null && y === null) return null;
    return { x: x === null ? ANCRAGE_DEFAUT.x : x, y: y === null ? ANCRAGE_DEFAUT.y : y };
  }

  function definir(table) {
    index = {};
    if (!table || typeof table !== "object") return 0;
    for (const [nom, entree] of Object.entries(table)) {
      if (!entree || typeof entree !== "object") continue;   // ligne abîmée : ignorée
      index[normaliser(nom)] = { carte: chemin(entree.carte), frontale: chemin(entree.frontale),
        ombre: chemin(entree.ombre), ancrage: lireAncrage(entree.ancrage) };
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

  // « Titi » + « Le Douzième Homme » → la clé de la variante
  const cleVariante = (nom, variante) => nom + " · " + variante;

  /* La cible est SOIT un nom, SOIT une fiche de joueur. Avec une fiche on
     cherche d'abord sa variante d'École — c'est ce qui donne à Gus et Titi
     leur maillot violet une fois l'Icône signée, et leur maillot de club
     le reste du temps. Sans variante trouvée, on retombe sur le nom nu. */
  function entree(cible) {
    if (cible && typeof cible === "object") {
      const nom = cible.nom;
      const variante = cible.ecole || cible.variante;
      if (nom && variante) {
        const v = index[normaliser(cleVariante(nom, variante))];
        if (v) return v;
      }
      return index[normaliser(nom)] || null;
    }
    return index[normaliser(cible)] || null;
  }
  const carte = (cible) => (entree(cible) || {}).carte || null;
  const frontale = (cible) => (entree(cible) || {}).frontale || null;
  const ombre = (cible) => (entree(cible) || {}).ombre || null;
  const ancrage = (cible) => (entree(cible) || {}).ancrage || ANCRAGE_DEFAUT;
  const nombre = () => Object.keys(index).length;

  return { charger, definir, carte, frontale, ombre, ancrage, entree, normaliser, nombre, ANCRAGE_DEFAUT };
})();
if (typeof module !== "undefined") module.exports = ONZE_PORTRAITS;
