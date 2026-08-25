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
  /* ================= LES UNITÉS DE TERRAIN (79 figurines) =================
     Les silhouettes frontales laissent la place à des figurines vues de
     trois quarts, chacune avec son OMBRE dans un fichier à part et son
     ANCRAGE mesuré. Deux tables livrées par Gabriel, lues telles quelles :
       · design/unites-manifest.tsv : l'index (famille, joueur, chemins)
       · design/ancrages.json       : les 79 ancrages mesurés + le repli
     Rien n'est recopié à la main : si Gabriel regénère une unité, il
     relance sa mesure et redépose les deux fichiers.

     LE PONT DE NOMMAGE. La clé « jeu » de chaque entrée donne le nom tel
     qu'il s'écrit dans joueurs.json — 71 des 79 en ont une. Les 8 autres
     sont volontaires et se raccordent ailleurs qu'au roster : les trois
     Icônes et les cinq Copains du Club. Ce pont-là est une affaire
     d'identités, pas de mesures : il vit donc dans le code, et il est
     testé. */
  const PONT_UNITES = {
    "Le Fidele": "Le Fidèle",                     // l'Icône n° 9
    "Gus": "Gus · Le Douzième Homme",             // moitié de l'Icône n° 38
    "Titi": "Titi · Le Douzième Homme",           // l'autre moitié
    "Gus Club": "Gus", "Titi Club": "Titi",       // les cinq de départ (partie.html)
    "Marcel": "Marcel", "Rachid": "Rachid", "Momo": "Momo",
  };
  // « units/01_X/… .png » → « da/unites/01_X/… .webp » (le manifeste liste
  // l'extension de travail, le lot est livré en WebP)
  const cheminJeu = (brut) => String(brut || "")
    .replace(/^units\//, "da/unites/")
    .replace(/^shadows\//, "da/ombres/")
    .replace(/\.(png|jpg)$/i, ".webp");

  let manquants = [];
  const sansFigurine = () => manquants.slice();
  /* Les unités vivent dans LEUR table, pas mélangées à celle des portraits :
     redéfinir les figurines (table vide, table partielle, retour au lot
     complet) ne doit rien laisser derrière. La fusion se fait à la
     LECTURE — l'unité passe devant la silhouette quand elle existe. */
  let unites = {};

  /* Fusionne les unités dans la table : la figurine remplace la frontale,
     l'ombre et l'ancrage viennent avec. Ne jette jamais : une table
     absente ou abîmée laisse le jeu tourner avec ce qu'il a. */
  function definirUnites(manifeste, table) {
    manquants = [];
    unites = {};
    const mesures = (table && table.ancrages) || {};
    const defaut = (table && table._defaut) || ANCRAGE_DEFAUT;
    const lignes = String(manifeste || "").trim().split(/\r?\n/).slice(1);
    let posees = 0;
    for (const ligne of lignes) {
      const [, , joueur, unite, ombre] = ligne.split("\t");
      if (!joueur || !unite) continue;
      const mesure = mesures[joueur] || {};
      const cle = mesure.jeu || PONT_UNITES[joueur];
      if (!cle) { manquants.push(joueur); continue; }   // bruyant, jamais silencieux
      unites[normaliser(cle)] = {
        frontale: cheminJeu(unite),
        ombre: cheminJeu(ombre || mesure.ombre),
        ancrage: lireAncrage(mesure) || lireAncrage(defaut) || ANCRAGE_DEFAUT,
        controle: mesure.controle || null };
      posees++;
    }
    return posees;
  }

  function chargerUnites(urlManifeste = "design/unites-manifest.tsv", urlAncrages = "design/ancrages.json") {
    if (typeof fetch !== "function") return Promise.resolve(0);
    return Promise.all([
      fetch(urlManifeste).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
      fetch(urlAncrages).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([m, a]) => definirUnites(m, a)).catch(() => 0);
  }

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
  // la figurine passe devant la silhouette, la table de portraits fournit
  // le reste (le key art de la carte, notamment)
  const fusion = (k) => {
    const p = index[k], u = unites[k];
    if (!p && !u) return null;
    return u ? { ...(p || {}), ...u } : p;
  };
  function entree(cible) {
    if (cible && typeof cible === "object") {
      const nom = cible.nom;
      const variante = cible.ecole || cible.variante;
      if (nom && variante) {
        const v = fusion(normaliser(cleVariante(nom, variante)));
        if (v) return v;
      }
      return fusion(normaliser(nom));
    }
    return fusion(normaliser(cible));
  }
  const carte = (cible) => (entree(cible) || {}).carte || null;
  const frontale = (cible) => (entree(cible) || {}).frontale || null;
  const ombre = (cible) => (entree(cible) || {}).ombre || null;
  const ancrage = (cible) => (entree(cible) || {}).ancrage || ANCRAGE_DEFAUT;
  const nombre = () => Object.keys(index).length;

  /* L'EMPRUNT : un corps pour ceux qui n'ont pas de visuel (§9.1 du brief
     playtest). Les réservistes du centre — six bouche-trous poussés sur le
     terrain quand le banc est vide — n'ont aucune illustration, et le repli
     dessiné les faisait apparaître PLATS et DE FACE au milieu de figurines
     de trois quarts : une image cassée au milieu du jeu.
     Ils empruntent donc une vraie unité, avec son ombre et son ancrage —
     même caméra, même ligne de sol. Le rendu s'occupe de l'anonymiser (pas
     de visage, pas de couleurs) : ce fichier ne fait que prêter un corps.
     TROIS emprunts, choisis par le nom : six réservistes ne doivent pas
     être six clones, et le même nom doit toujours donner le même corps —
     un tirage au sort les ferait changer de corps à chaque rendu. */
  const CORPS_EMPRUNTES = ["Malandro", "Mattia", "Harry"];
  function emprunt(nom) {
    if (!nom) return null;
    let somme = 0;
    for (let i = 0; i < nom.length; i++) somme = (somme * 31 + nom.charCodeAt(i)) >>> 0;
    for (let k = 0; k < CORPS_EMPRUNTES.length; k++) {
      const e = entree(CORPS_EMPRUNTES[(somme + k) % CORPS_EMPRUNTES.length]);
      if (e && e.frontale) return { unite: e.frontale, ombre: e.ombre || null,
        ancrage: e.ancrage || ANCRAGE_DEFAUT };
    }
    return null;   // table vide : le repli dessiné reprend la main
  }

  return { charger, chargerUnites, definir, definirUnites, carte, frontale, ombre, ancrage,
    emprunt, entree, normaliser, nombre, sansFigurine, PONT_UNITES, ANCRAGE_DEFAUT };
})();
if (typeof module !== "undefined") module.exports = ONZE_PORTRAITS;
