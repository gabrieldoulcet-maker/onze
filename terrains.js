/* ============================================================
   ONZE — LES TERRAINS D'ENTRAÎNEMENT (DA S2).
   ------------------------------------------------------------
   Le décor de l'écran de placement : le terrain est PEINT, en
   perspective (vue plongeante, but à gauche), et ses neuf
   emplacements de banc sont peints eux aussi. Le code ne pose
   donc pas son banc où il veut : il cale ses tuiles sur les
   rectangles dessinés, et projette la grille des joueurs dans
   le quadrilatère du terrain peint — sinon les pions flottent
   au-dessus du gazon au lieu d'être posés dessus.

   Toute la géométrie vit dans design/terrains.json, en
   PROPORTIONS de l'image (donc valable pour les deux tailles).
   Si Gabriel regénère un terrain, seule la config bouge.

   Un terrain d'entraînement RÉPOND à une arène de match : ils
   partagent la clé du réglage « stade », le joueur ne choisit
   qu'une fois.

   API :
     ONZE_TERRAINS.charger()          → Promise (ne rejette jamais)
     ONZE_TERRAINS.pour(idStade)      → le terrain, ou le décor à plat
     ONZE_TERRAINS.cadre(l, h, t)     → où l'image atterrit dans la zone
     ONZE_TERRAINS.projeter(t, c, u, v) → un point du terrain → px
     ONZE_TERRAINS.tuile(t, c, n)     → le rectangle du nᵉ emplacement
     ONZE_TERRAINS.cadre(L, H, r, a)  → le mapping image → zone (a = ancrage
                                        vertical : 1 en bas, 0 en haut)
   ============================================================ */
const ONZE_TERRAINS = (() => {
  const NB_TUILES = 9;

  /* Le repli quand aucun terrain n'est peint (thèmes dessinés, table
     absente) : un terrain À PLAT et neuf tuiles régulières. Même langage
     géométrique, donc UN SEUL chemin de rendu dans le jeu. */
  const A_PLAT = {
    nom: "Terrain d'entraînement", clair: false, image: null,
    terrain: { hautGauche: [0.02, 0.02], hautDroite: [0.98, 0.02],
      basDroite: [0.98, 0.98], basGauche: [0.02, 0.98] },
    tuiles: Array.from({ length: NB_TUILES }, (_, n) => ({
      x0: 0.06 + n * 0.098, x1: 0.06 + n * 0.098 + 0.082, y0: 0.06, y1: 0.94 })),
  };

  let table = {};

  const valide = (t) => t && t.terrain && Array.isArray(t.tuiles) && t.tuiles.length === NB_TUILES &&
    ["hautGauche", "hautDroite", "basDroite", "basGauche"].every((c) => Array.isArray(t.terrain[c]) && t.terrain[c].length === 2);

  function definir(brut) {
    table = {};
    if (!brut || typeof brut !== "object") return 0;
    for (const [id, t] of Object.entries(brut)) if (valide(t)) table[id] = t;
    return Object.keys(table).length;
  }
  function charger(url = "design/terrains.json") {
    if (typeof fetch !== "function") return Promise.resolve(0);
    return fetch(url).then((r) => (r.ok ? r.json() : null)).then(definir).catch(() => definir(null));
  }

  const pour = (id) => table[id] || A_PLAT;
  const liste = () => Object.entries(table)
    .sort((a, b) => (a[1].ordre || 0) - (b[1].ordre || 0))
    .map(([id, t]) => ({ id, nom: t.nom, description: t.description || "" }));

  /* Où l'image atterrit dans une zone : elle la COUVRE, calée en bas —
     le bas de l'image (le banc) doit toujours rester visible ; c'est le
     ciel qu'on rogne si la zone est plus large que le format 2,16. */
  /* ANCRAGE VERTICAL : 1 = calé en bas (on perd le ciel), 0 = calé en
     haut (on perd le premier plan). Depuis que la scène occupe tout le
     cadre (phase 1 de l'habillage), la zone est bien plus large que le
     format de l'image : le « cover » zoome, et c'est cet ancrage qui
     décide de ce qu'on garde. Un peu moins de 1 laisse voir une tranche
     de tribune sans jamais faire sortir les mats peints du cadre. */
  const ANCRAGE_DEFAUT = 0.92;

  function cadre(largeur, hauteur, ratioImage = 844 / 390, ancrage = ANCRAGE_DEFAUT) {
    // rendu « cover » : l'image remplit la zone, on ne rogne jamais la
    // largeur (le banc va d'un bord à l'autre) et l'ancrage décide de ce
    // qu'on garde en haut et en bas.
    const rendueL = Math.max(largeur, hauteur * ratioImage);
    const rendueH = rendueL / ratioImage;
    const dx = (largeur - rendueL) / 2;
    const dy = (hauteur - rendueH) * Math.min(1, Math.max(0, ancrage));
    return {
      largeur: rendueL, hauteur: rendueH, dx, dy, zoneL: largeur, zoneH: hauteur,
      versZone: (fx, fy) => [dx + fx * rendueL, dy + fy * rendueH],
    };
  }

  /* Un point du terrain (u,v) ∈ [0,1]² → pixels de la zone.
     u : de la ligne de but gauche (0) à la droite (1)
     v : de la ligne de touche du fond (0) à celle d'en bas (1)
     Interpolation bilinéaire des 4 coins : la grille suit la perspective. */
  function projeter(t, c, u, v) {
    const q = (t || A_PLAT).terrain;
    const hx = q.hautGauche[0] + (q.hautDroite[0] - q.hautGauche[0]) * u;
    const hy = q.hautGauche[1] + (q.hautDroite[1] - q.hautGauche[1]) * u;
    const bx = q.basGauche[0] + (q.basDroite[0] - q.basGauche[0]) * u;
    const by = q.basGauche[1] + (q.basDroite[1] - q.basGauche[1]) * u;
    return c.versZone(hx + (bx - hx) * v, hy + (by - hy) * v);
  }

  /* Le rectangle du nᵉ emplacement de banc, en pixels de la zone. */
  function tuile(t, c, n) {
    const tu = ((t || A_PLAT).tuiles || A_PLAT.tuiles)[n];
    if (!tu) return null;
    const [x0, y0] = c.versZone(tu.x0, tu.y0);
    const [x1, y1] = c.versZone(tu.x1, tu.y1);
    return { x: x0, y: y0, largeur: x1 - x0, hauteur: y1 - y0 };
  }

  /* La profondeur d'un point sert à l'échelle des pions : au fond du
     terrain ils sont plus petits qu'au premier plan. */
  const echelleProfondeur = (v) => 0.86 + 0.28 * v;

  return { charger, definir, pour, liste, cadre, projeter, tuile, echelleProfondeur, NB_TUILES, A_PLAT, ANCRAGE_DEFAUT };
})();
if (typeof module !== "undefined") module.exports = ONZE_TERRAINS;
