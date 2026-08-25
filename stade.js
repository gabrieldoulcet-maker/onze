/* ============================================================
   ONZE — LE STADE, couche de thème séparée (règle R13 du manuel
   design/scene-fm.md, décision 26).
   ------------------------------------------------------------
   Tout ce qui est DÉCOR (gazon, bandes de tonte, lignes, surfaces,
   cages, filets, tribunes, projecteurs, ambiance) vit ICI, en
   configuration. La scène de match (match-scene.js) ne connaît
   aucune couleur de terrain : elle demande au stade de se dessiner,
   puis elle pose les 22 pions et le ballon par-dessus.
   Conséquence : ajouter un skin de stade cosmétique (façon arènes
   de TFT) = ajouter une entrée dans THEMES, zéro ligne de scène.

   API :
     ONZE_STADE.liste()            → [{id, nom, description}]
     ONZE_STADE.sol(t)             → la couleur du sol, relevée ou dessinée
     ONZE_STADE.theme(id)          → l'objet thème (défaut si inconnu)
     ONZE_STADE.geometrie(l, h, t) → où vit le terrain dans le canvas
     ONZE_STADE.dessiner(ctx, geo, theme, temps)  → le décor complet
     ONZE_STADE.dessinerCages(ctx, geo, theme, tremblements)
   ============================================================ */

const ONZE_STADE = (() => {

  /* ---- Le gabarit d'un thème (toutes les clés sont obligatoires) ----
     marge      : part de la hauteur du canvas laissée aux tribunes (haut+bas)
     gazon      : deux teintes alternées + nombre de bandes de tonte
     lignes     : le tracé réglementaire
     tribunes   : la foule floue qui encadre le terrain
     projecteurs: les halos dans le cadre (nb, force)
     cages      : montants + filet (maille dessinée)
     ambiance   : vignette, teinte de lumière, brume  */

  const THEMES = {
    municipal: {
      nom: "Stade Municipal",
      description: "Le stade par défaut d'ONZE : pelouse rayée, tribunes sombres, quatre projecteurs.",
      marge: 0.10,
      sol: null, gazon: { clair: "#1E6B2E", sombre: "#185A26", bandes: 14, usure: "rgba(0,0,0,0.10)" },
      lignes: { couleur: "rgba(253,248,234,0.62)", epaisseur: 1.6 },
      tribunes: {
        fond: "#0A1310", gradin: "#16241B", foule: ["#394C40", "#4E6355", "#26352C"],
        densite: 0.62, flou: 2.5, bache: "rgba(242,193,78,0.10)",
      },
      projecteurs: { nb: 4, halo: "rgba(255,246,216,0.055)", rayon: 0.62, mat: "rgba(253,248,234,0.22)" },
      cages: { montant: "rgba(253,248,234,0.92)", filet: "rgba(253,248,234,0.30)", maille: 5, profondeur: 0.022 },
      ambiance: { vignette: 0.30, lumiere: "rgba(255,246,216,0.05)", brume: 0 },
    },

    nocturne: {
      nom: "Nocturne",
      description: "Match en nocturne : gazon profond, halos francs, tribunes noires.",
      marge: 0.10,
      sol: null, gazon: { clair: "#12512A", sombre: "#0D4222", bandes: 14, usure: "rgba(0,0,0,0.16)" },
      lignes: { couleur: "rgba(253,248,234,0.72)", epaisseur: 1.7 },
      tribunes: {
        fond: "#05090B", gradin: "#0D141B", foule: ["#26333F", "#33434F", "#1A242D"],
        densite: 0.68, flou: 3, bache: "rgba(62,155,224,0.12)",
      },
      projecteurs: { nb: 6, halo: "rgba(220,238,255,0.085)", rayon: 0.58, mat: "rgba(220,238,255,0.30)" },
      cages: { montant: "rgba(253,248,234,0.95)", filet: "rgba(220,238,255,0.34)", maille: 5, profondeur: 0.022 },
      ambiance: { vignette: 0.42, lumiere: "rgba(220,238,255,0.06)", brume: 0.04 },
    },

    bitume: {
      nom: "Le Bitume",
      description: "Le terrain de la Rue : stabilisé ocre, grillage au lieu des tribunes.",
      marge: 0.08,
      sol: null, gazon: { clair: "#8A5A32", sombre: "#7E522D", bandes: 6, usure: "rgba(0,0,0,0.14)" },
      lignes: { couleur: "rgba(253,248,234,0.50)", epaisseur: 1.4 },
      tribunes: {
        fond: "#14100C", gradin: "#1D1811", foule: ["#3A2E22", "#4A3B2B", "#2A2118"],
        densite: 0.30, flou: 1.5, bache: "rgba(232,80,63,0.10)",
      },
      projecteurs: { nb: 2, halo: "rgba(255,236,190,0.06)", rayon: 0.70, mat: "rgba(253,248,234,0.18)" },
      cages: { montant: "rgba(253,248,234,0.85)", filet: "rgba(253,248,234,0.22)", maille: 6, profondeur: 0.018 },
      ambiance: { vignette: 0.34, lumiere: "rgba(255,236,190,0.045)", brume: 0 },
    },

    /* ---- LES ARÈNES (DA S2) : trois skins photographiques ----
       CHOIX D'INTÉGRATION (brief §6) : l'image donne l'AMBIANCE — tribunes,
       projecteurs, ville, sièges — et le CODE dessine la surface de jeu
       par-dessus, à sa taille lisible. L'autre option (caler la géométrie
       sur le terrain peint) a été mesurée puis écartée : le cliché est en
       perspective, le rectangle inscrit dans le terrain peint ne fait que
       60 % × 53 % du cadre, soit des pions à ~10 px au lieu de ~14 —
       sous le seuil de lisibilité, non négociable au brief.
       Le rectangle de jeu recouvre entièrement le terrain peint (aucun
       reste de gazon photographique ne dépasse) ; les tours d'éclairage
       d'angle, la tribune haute et les sièges bas restent visibles :
       c'est là que vit l'identité de chaque arène. */
    bitumeNeon: {
      nom: "Bitume Néon",
      description: "Le city-stade sous les néons : bitume mouillé, métro aérien, façades roses et bleues.",
      fond: "da/arenes/A02.webp",
      terrain: { gauche: 0.184, droite: 0.819, haut: 0.231, bas: 0.800 },
      fondTaille: { w: 900, h: 416 },
      // le sol RELEVÉ sur l'image (le bitume mouillé) : c'est contre lui que
      // la lisibilité des pions se mesure, pas contre le gazon dessiné
      sol: "#1D2531",
      marge: 0.152,
      gazon: { clair: "#243330", sombre: "#1C2A27", bandes: 12, usure: "rgba(0,0,0,0.20)" },
      lignes: { couleur: "rgba(240,248,255,0.80)", epaisseur: 1.6 },
      tribunes: {
        fond: "#0A0B12", gradin: "#141726", foule: ["#2A2F45", "#3A2F4E", "#1E2233"],
        densite: 0.6, flou: 3, bache: "rgba(255,64,160,0.14)",
      },
      projecteurs: { nb: 0, halo: "rgba(255,255,255,0)", rayon: 0.5, mat: "rgba(0,0,0,0)" },
      cages: { montant: "rgba(253,248,234,0.92)", filet: "rgba(240,248,255,0.30)", maille: 5, profondeur: 0.022 },
      ambiance: { vignette: 0.24, lumiere: "rgba(190,120,255,0.035)", brume: 0 },
      ballon: { corps: "#FFFFFF", contour: "rgba(6,8,14,0.85)", halo: "rgba(215,235,255,0.85)" },
    },

    theatre: {
      nom: "Le Chaudron",
      description: "Grande enceinte en nocturne, tribunes pleines et halos chauds — le stade des grands soirs.",
      fond: "da/arenes/A12.webp",
      terrain: { gauche: 0.174, droite: 0.825, haut: 0.221, bas: 0.808 },
      fondTaille: { w: 900, h: 416 },
      // le sol RELEVÉ sur l'image (le gazon givré) : c'est contre lui que
      // la lisibilité des pions se mesure, pas contre le gazon dessiné
      sol: "#39817B",
      marge: 0.152,
      gazon: { clair: "#1F5C33", sombre: "#194E2B", bandes: 14, usure: "rgba(0,0,0,0.16)" },
      lignes: { couleur: "rgba(253,248,234,0.74)", epaisseur: 1.7 },
      tribunes: {
        fond: "#070C12", gradin: "#101822", foule: ["#28323F", "#36424F", "#1C242E"],
        densite: 0.66, flou: 3, bache: "rgba(242,193,78,0.12)",
      },
      projecteurs: { nb: 0, halo: "rgba(255,255,255,0)", rayon: 0.5, mat: "rgba(0,0,0,0)" },
      cages: { montant: "rgba(253,248,234,0.95)", filet: "rgba(253,248,234,0.32)", maille: 5, profondeur: 0.022 },
      ambiance: { vignette: 0.28, lumiere: "rgba(220,238,255,0.045)", brume: 0.03 },
      ballon: { corps: "#FFFFFF", contour: "rgba(6,13,8,0.85)", halo: "rgba(255,246,216,0.9)" },
    },

    emeraude: {
      nom: "L'Émeraude",
      description: "Pelouse éclatante sous les projecteurs bleus, sièges cerclés de vert — la carte postale.",
      fond: "da/arenes/A13.webp",
      terrain: { gauche: 0.174, droite: 0.823, haut: 0.224, bas: 0.810 },
      fondTaille: { w: 900, h: 416 },
      // le sol RELEVÉ sur l'image (la pelouse en pleine lumière) : c'est contre lui que
      // la lisibilité des pions se mesure, pas contre le gazon dessiné
      sol: "#20A40A",
      marge: 0.152,
      gazon: { clair: "#2C8A3A", sombre: "#227430", bandes: 14, usure: "rgba(0,0,0,0.14)" },
      lignes: { couleur: "rgba(253,248,234,0.88)", epaisseur: 1.8 },
      tribunes: {
        fond: "#050A08", gradin: "#0C1512", foule: ["#22322A", "#2E4136", "#182420"],
        densite: 0.66, flou: 3, bache: "rgba(61,226,107,0.14)",
      },
      projecteurs: { nb: 0, halo: "rgba(255,255,255,0)", rayon: 0.5, mat: "rgba(0,0,0,0)" },
      cages: { montant: "rgba(255,255,255,0.96)", filet: "rgba(253,248,234,0.34)", maille: 5, profondeur: 0.022 },
      ambiance: { vignette: 0.26, lumiere: "rgba(200,230,255,0.04)", brume: 0 },
      // gazon CLAIR → le ballon prend un contour sombre franc pour rester lisible
      ballon: { corps: "#FFFFFF", contour: "rgba(4,26,12,0.95)", halo: "rgba(255,255,255,0.75)" },
    },
  };

  /* Le ballon est un JETON DE THÈME (brief §6) : sur un gazon clair il
     lui faut un contour sombre franc, sur un gazon sombre un halo clair.
     Les thèmes dessinés qui n'en déclarent pas gardent l'ancien rendu. */
  const BALLON_DEFAUT = { corps: "#FFFFFF", contour: "rgba(6,13,8,0.75)", halo: "rgba(255,255,255,0.9)" };
  const ballon = (t) => (t && t.ballon) || BALLON_DEFAUT;

  /* Les images d'arène : chargées à la demande, jamais bloquantes.
     Tant qu'une image n'est pas prête (ou si elle échoue), le thème se
     dessine entièrement en code — le jeu ne montre jamais un trou. */
  const images = new Map();
  function image(src) {
    if (!src || typeof Image === "undefined") return null;
    if (!images.has(src)) {
      const im = new Image();
      im.decoding = "async";
      im.src = src;
      images.set(src, im);
    }
    const im = images.get(src);
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  /* Résout quand le décor du thème est prêt à être peint (ou tout de
     suite s'il n'y a pas d'image). Ne rejette jamais. */
  function precharger(t) {
    const src = t && t.fond;
    if (!src || typeof Image === "undefined") return Promise.resolve(false);
    if (image(src)) return Promise.resolve(true);
    return new Promise((resoudre) => {
      const im = images.get(src);
      im.addEventListener("load", () => resoudre(true), { once: true });
      im.addEventListener("error", () => resoudre(false), { once: true });
    });
  }

  const DEFAUT = "municipal";
  const theme = (id) => THEMES[id] || THEMES[DEFAUT];
  const liste = () => Object.entries(THEMES).map(([id, t]) => ({ id, nom: t.nom, description: t.description }));

  /* ---- Où vit le terrain dans le canvas ----
     Caméra FIXE (R1) : le terrain entier tient toujours dans le cadre,
     les tribunes prennent la marge haute et basse. Aucun zoom, jamais. */
  /* ============================================================
     LE TRACÉ, EN MÈTRES (Lois du Jeu, loi 1).
     Ces chiffres sont ceux d'un terrain de 104 × 68 m. Sur un terrain
     réduit (densité de 324 m² par joueur — décision 50), on ne les
     garde pas tels quels : une surface de 40,3 m de large sur un terrain
     de 46 m toucherait les deux touches, ce que le football réel ne fait
     pas. Mais on ne les réduit pas non plus au prorata — ce serait un
     no-op à l'écran, puisque diviser une longueur mise à l'échelle par
     la longueur du terrain redonne exactement la même fraction de
     pixels. Le football à effectif réduit fait autre chose : il garde des
     tracés PROPORTIONNELLEMENT PLUS GRANDS.

     Calibrage, sur le terrain à sept officiel de la FIFA (55 × 37 m,
     surface de 12 × 24 m) : il faut 16,5 → 12 m quand la longueur passe
     de 104 à 55, soit un facteur (55/104)^0,5. D'où l'échelle du tracé :

         k = √(L / 104)

     À 104 m elle vaut 1 (le règlement exact) ; à 55 m elle donne 12,0 m
     de profondeur de surface, la valeur officielle au décimètre près ; à
     70 m elle donne 13,5 m sur un terrain de 70 — soit 19 % de la
     longueur au lieu de 16 %. C'est ce léger grossissement qui rend le
     rétrécissement du terrain LISIBLE, avec les pions.
     ============================================================ */
  const TRACE_M = {
    rond: 9.15,                            // rayon du rond central
    surface: { prof: 16.5, larg: 40.32 },  // surface de réparation
    but: { prof: 5.5, larg: 18.32 },       // surface de but
    penalty: 11,                           // le point de penalty
    corner: 1,                             // l'arc de corner
    cage: 7.32,                            // la largeur des buts
  };
  const TERRAIN_PLEIN = { L: 104, W: 68 };

  /* ============================================================
     LA CAMÉRA DE LA SCÈNE DE MATCH (décision 51).
     Relevée sur les trois arènes peintes : le rectangle de jeu y a un
     rapport apparent de 2,41 · 2,40 · 2,39, soit une plongée d'environ
     40°. (L'écran de placement a la sienne, 2,86 à 32° — les deux ne se
     rencontrent jamais, voir la décision.)
     Les thèmes DESSINÉS n'ont pas d'artwork pour leur dicter ce rapport :
     sans consigne, leur rectangle suivait la fenêtre et allait de 2,12
     à 4,64 selon l'écran — ils ne suivaient aucune caméra. On leur fige
     donc celle-ci, pour que la scène ait le même point de vue quel que
     soit le stade choisi.
     ============================================================ */
  const RAPPORT_CAMERA = 2.40;

  /* ---- Le cadrage « cover » d'une image de fond ----
     L'arène est dessinée à 900 × 416 (rapport 2,16) et le cadre du jeu
     fait plutôt 3,1 : l'étirer, c'était déformer le stade de 44 % en
     largeur. On la pose donc en COVER — elle remplit le cadre sans se
     déformer, et c'est le débord qui est rogné. */
  function poseImage(largeur, hauteur, taille, cadre) {
    let e = Math.max(largeur / taille.w, hauteur / taille.h);
    /* LE TERRAIN PASSE AVANT LE REMPLISSAGE. Sur un cadre très plat, le
       cover rogne assez de hauteur pour manger un bout de surface de
       réparation — mesuré à 840 × 227 sur deux des trois arènes. Dans ce
       cas on RÉDUIT l'échelle jusqu'à ce que le terrain peint tienne
       entier (avec 1 % de garde), quitte à laisser une frange de fond au
       bord : perdre des tribunes est sans conséquence, perdre du terrain
       fausserait toute la géométrie. */
    if (cadre) {
      const garde = 1.02;
      const larg = (cadre.droite - cadre.gauche) * taille.w * garde;
      const haut = (cadre.bas - cadre.haut) * taille.h * garde;
      e = Math.min(e, largeur / larg, hauteur / haut);
    }
    const iw = taille.w * e, ih = taille.h * e;
    /* Le COVER rogne : sur un cadre plus large que l'image, c'est le haut
       et le bas qui partent. Centrer l'IMAGE ferait perdre un bout de
       surface de réparation dès que le terrain peint n'est pas au milieu
       de son arène ; on centre donc sur le TERRAIN PEINT, puis on borne
       pour ne jamais laisser de vide au bord. Perdre des tribunes est
       sans conséquence, perdre du terrain fausserait la géométrie. */
    const borner = (v, min, max) => (min > max ? (min + max) / 2 : Math.min(max, Math.max(min, v)));
    let ox = (largeur - iw) / 2, oy = (hauteur - ih) / 2;
    if (cadre) {
      const cx = (cadre.gauche + cadre.droite) / 2, cy = (cadre.haut + cadre.bas) / 2;
      ox = borner(largeur / 2 - cx * iw, largeur - iw, 0);
      oy = borner(hauteur / 2 - cy * ih, hauteur - ih, 0);
    }
    return { e, iw, ih, ox, oy,
      // la fenêtre réellement visible de l'image, en fractions de l'image
      fenetre: { x0: -ox / iw, y0: -oy / ih, x1: (largeur - ox) / iw, y1: (hauteur - oy) / ih } };
  }

  function geometrie(largeur, hauteur, t, terrain) {
    const marge = Math.round(hauteur * (t ? t.marge : 0.10));
    /* `terrain` = le rectangle de jeu PEINT dans l'arène, relevé sur
       l'image (fractions de l'image, pas du canvas). C'est lui qui donne
       sa géométrie à la scène : le décor commande, pas l'inverse.
       Sans image, comportement d'origine exact. */
    const cadre = t && t.terrain;
    const pose = cadre && t.fondTaille ? poseImage(largeur, hauteur, t.fondTaille, cadre) : null;
    const fx = (f) => (pose ? pose.ox + f * pose.iw : largeur * f);
    const fy = (f) => (pose ? pose.oy + f * pose.ih : hauteur * f);
    let x, y, w, h;
    if (cadre) {
      x = Math.round(fx(cadre.gauche));
      y = Math.round(fy(cadre.haut));
      w = Math.max(Math.round(fx(cadre.droite)) - x, 20);
      h = Math.max(Math.round(fy(cadre.bas)) - y, 20);
    } else {
      /* Thème dessiné : aucun artwork ne dicte le cadre, on applique la
         caméra de la scène. Le plus grand rectangle au bon rapport qui
         tient dans la fenêtre, centré ; le reste est du décor. */
      const dispoW = largeur, dispoH = Math.max(hauteur - marge * 2, 20);
      w = Math.max(Math.round(Math.min(dispoW, dispoH * RAPPORT_CAMERA)), 20);
      h = Math.max(Math.round(w / RAPPORT_CAMERA), 20);
      x = Math.round((largeur - w) / 2);
      y = Math.round((hauteur - h) / 2);
    }
    /* Les dimensions RÉELLES du terrain de ce match, en mètres. Le
       rectangle de pixels ne change pas ; c'est l'échelle mètre → pixel
       qui bouge, et c'est elle qui rend le rétrécissement lisible. */
    const m = terrain && terrain.L && terrain.W ? terrain : TERRAIN_PLEIN;
    return {
      largeur, hauteur, marge,
      x, y, w, h, m,
      // conversion mètres → pixels du canvas, origine au CENTRE du terrain
      mpx: (xm) => x + ((xm + m.L / 2) / m.L) * w,
      mpy: (ym) => y + ((ym + m.W / 2) / m.W) * h,
      // une LONGUEUR en mètres → px, selon l'axe
      mx: (v) => (v / m.L) * w,
      my: (v) => (v / m.W) * h,
      /* l'échelle du tracé : 1 sur un terrain plein, et plus GÉNÉREUSE
         que le prorata sur un terrain réduit (voir TRACE_M) */
      kTrace: Math.sqrt(m.L / TERRAIN_PLEIN.L),
      // la fenêtre visible de l'image de fond (fractions de l'image)
      fenetreImage: pose ? pose.fenetre : null,
      /* LE ZOOM. Le rectangle de pixels ne bouge jamais (R1, caméra
         fixe) : un terrain plus petit est donc la MÊME fenêtre sur une
         portion plus petite du monde. Tout ce qui a une taille réelle
         doit y paraître plus gros — les pions, mais aussi les bandes de
         tonte et le grain des tribunes. Sans ça, un petit terrain
         ressemble à un grand terrain avec de gros joueurs. */
      zoom: TERRAIN_PLEIN.L / m.L,
    };
  }

  /* ---- Les tribunes : une bande floue en haut et en bas ----
     Rendue une fois dans un canvas hors-écran (le flou coûte cher),
     puis recopiée à chaque frame : coût négligeable à 60 fps. */
  const cacheTribunes = new Map();
  function tribunes(geo, t) {
    const cle = `${t.nom}|${geo.largeur}|${geo.marge}|${(geo.zoom || 1).toFixed(2)}`;
    if (cacheTribunes.has(cle)) return cacheTribunes.get(cle);
    const c = document.createElement("canvas");
    c.width = Math.max(geo.largeur, 1); c.height = Math.max(geo.marge, 1);
    const g = c.getContext("2d");
    const tr = t.tribunes;
    g.fillStyle = tr.fond; g.fillRect(0, 0, c.width, c.height);
    // les gradins : 3 rangées en perspective écrasée
    for (let r = 0; r < 3; r++) {
      const y = (c.height / 3) * r;
      g.fillStyle = r % 2 ? tr.gradin : tr.fond;
      g.fillRect(0, y, c.width, c.height / 3);
    }
    // la foule : un mouchetis dense, déterministe (pas de scintillement)
    // le grain de la foule suit le zoom, comme tout ce qui a une taille réelle
    const pas = Math.max(3, Math.round((c.width * (geo.zoom || 1)) / (110 * tr.densite)));
    let graine = 7;
    const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let y = 2; y < c.height - 1; y += pas) {
      for (let x = 0; x < c.width; x += pas) {
        if (alea() > tr.densite) continue;
        g.fillStyle = tr.foule[Math.floor(alea() * tr.foule.length)];
        g.fillRect(x + alea() * 2, y + alea() * 2, pas * 0.7, pas * 0.7);
      }
    }
    // la bâche de club, une bande de couleur au ras du terrain
    g.fillStyle = tr.bache;
    g.fillRect(0, c.height - Math.max(2, c.height * 0.14), c.width, Math.max(2, c.height * 0.14));
    if (tr.flou && g.filter !== undefined) {
      const flou = document.createElement("canvas");
      flou.width = c.width; flou.height = c.height;
      const gf = flou.getContext("2d");
      gf.filter = `blur(${tr.flou}px)`;
      gf.drawImage(c, 0, 0);
      cacheTribunes.set(cle, flou);
      return flou;
    }
    cacheTribunes.set(cle, c);
    return c;
  }

  /* ---- Le décor complet, sous les pions ---- */
  function dessiner(ctx, geo, t, temps) {
    const { x, y, w, h } = geo;
    // 1. le fond (ce qui dépasse du terrain) — une ARÈNE le remplace
    const arene = image(t.fond);
    // toujours un fond sous l'image : elle peut ne pas couvrir tout le
    // cadre quand on a réduit l'échelle pour garder le terrain entier
    ctx.fillStyle = t.tribunes.fond;
    ctx.fillRect(0, 0, geo.largeur, geo.hauteur);
    if (arene) {
      // même pose que la géométrie : l'arène ne se déforme jamais
      const p = poseImage(geo.largeur, geo.hauteur,
        t.fondTaille || { w: arene.naturalWidth || 900, h: arene.naturalHeight || 416 }, t.terrain);
      ctx.drawImage(arene, p.ox, p.oy, p.iw, p.ih);
    } else {
      ctx.fillStyle = t.tribunes.fond;
      ctx.fillRect(0, 0, geo.largeur, geo.hauteur);
    }

    // 2. les tribunes dessinées, en haut (retournées) et en bas
    if (!arene && geo.marge > 3) {
      const trib = tribunes(geo, t);
      ctx.save();
      ctx.translate(0, geo.marge); ctx.scale(1, -1);
      ctx.drawImage(trib, 0, 0);
      ctx.restore();
      ctx.drawImage(trib, 0, geo.hauteur - geo.marge);
    }

    /* 3. le gazon et ses bandes de tonte.
       Une bande de tonte a une LARGEUR RÉELLE (104 m / 14 ≈ 7,4 m sur le
       thème par défaut). Le nombre de bandes suit donc le terrain : neuf
       à cinq contre cinq, quatorze à onze contre onze — et à l'écran
       elles sont une fois et demie plus larges. C'est cette texture qui
       dit « on est plus près », le tracé seul ne le dirait pas. */
    const bandes = Math.max(2, Math.round(t.gazon.bandes / (geo.zoom || 1)));
    const lb = w / bandes;
    for (let i = 0; i < bandes; i++) {
      ctx.fillStyle = i % 2 ? t.gazon.sombre : t.gazon.clair;
      ctx.fillRect(x + i * lb, y, lb + 1, h);
    }
    // l'usure : plus foncé au centre et devant les cages
    const usure = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.1, x + w / 2, y + h / 2, w * 0.62);
    usure.addColorStop(0, t.gazon.usure);
    usure.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = usure; ctx.fillRect(x, y, w, h);

    // 4. les halos de projecteurs, DANS le cadre
    for (let i = 0; i < t.projecteurs.nb; i++) {
      const fx = x + w * ((i + 0.5) / t.projecteurs.nb);
      for (const fy of [y, y + h]) {
        const halo = ctx.createRadialGradient(fx, fy, 0, fx, fy, h * t.projecteurs.rayon * (geo.zoom || 1));
        halo.addColorStop(0, t.projecteurs.halo);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(x, y, w, h);
      }
      // le mât, une amorce verticale dans la tribune
      if (geo.marge > 6) {
        ctx.fillStyle = t.projecteurs.mat;
        ctx.fillRect(fx - 1, Math.max(0, y - geo.marge * 0.7), 2, geo.marge * 0.7);
        ctx.fillRect(fx - geo.marge * 0.10, Math.max(0, y - geo.marge * 0.78), geo.marge * 0.20, geo.marge * 0.10);
        ctx.fillRect(fx - 1, y + h, 2, geo.marge * 0.7);
        ctx.fillRect(fx - geo.marge * 0.10, y + h + geo.marge * 0.68, geo.marge * 0.20, geo.marge * 0.10);
      }
    }

    /* 5. LE TRACÉ, dessiné en MÈTRES (étape 2 du plan de scène).
       Un rond central est un CERCLE sur le gazon : vu par une caméra
       qui écrase la profondeur, il devient une ellipse. On le dessine
       donc avec deux rayons — l'un converti sur l'axe long, l'autre sur
       l'axe large — au lieu d'un cercle de pixels qui mentait sur la
       projection. */
    const k = geo.kTrace;
    const cy = y + h / 2;
    ctx.save();
    ctx.strokeStyle = t.lignes.couleur;
    ctx.lineWidth = t.lignes.epaisseur;
    const bord = t.lignes.epaisseur;
    ctx.strokeRect(x + bord, y + bord, w - bord * 2, h - bord * 2);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, cy, geo.mx(TRACE_M.rond * k), geo.my(TRACE_M.rond * k), 0, 0, 6.283);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, cy, t.lignes.epaisseur * 1.4, 0, 6.283);
    ctx.fillStyle = t.lignes.couleur; ctx.fill();
    // surfaces de réparation (16,5 × 40,32 m) et de but (5,5 × 18,32 m)
    for (const cote of [0, 1]) {
      const sensX = cote === 0 ? 1 : -1;
      const x0 = cote === 0 ? x : x + w;
      const rect = (prof, larg) => {
        const p = geo.mx(prof * k), l = geo.my(larg * k);
        ctx.strokeRect(Math.min(x0, x0 + sensX * p), cy - l / 2, p, l);
      };
      rect(TRACE_M.surface.prof, TRACE_M.surface.larg);
      rect(TRACE_M.but.prof, TRACE_M.but.larg);
      // le point de penalty (11 m) et l'arc de cercle (9,15 m autour de lui)
      const xp = x0 + sensX * geo.mx(TRACE_M.penalty * k);
      ctx.beginPath(); ctx.arc(xp, cy, t.lignes.epaisseur, 0, 6.283);
      ctx.fillStyle = t.lignes.couleur; ctx.fill();
      /* L'arc ne montre que sa part HORS surface : on découpe au lieu de
         deviner un angle, sinon il traverse la ligne des 16,50 m dès que
         les proportions du cadre changent. */
      ctx.save();
      ctx.beginPath();
      const px16 = geo.mx(TRACE_M.surface.prof * k);
      ctx.rect(cote === 0 ? x0 + px16 : x, y, cote === 0 ? w - px16 : w - px16, h);
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(xp, cy, geo.mx(TRACE_M.rond * k), geo.my(TRACE_M.rond * k), 0, 0, 6.283);
      ctx.stroke();
      ctx.restore();
      // les corners (1 m)
      for (const yc of [y, y + h]) {
        ctx.beginPath();
        ctx.ellipse(x0, yc, geo.mx(TRACE_M.corner * k), geo.my(TRACE_M.corner * k), 0, 0, 6.283);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---- Les cages, dessinées APRÈS les pions (le filet passe devant) ----
     `tremblements` = { moi: 0..1, eux: 0..1 } : la cage vibre quand elle
     vient de prendre un but. */
  function dessinerCages(ctx, geo, t, tremblements, temps) {
    const { x, y, w, h } = geo;
    const prof = t.cages.profondeur * geo.w;
    for (const camp of ["moi", "eux"]) {
      const gauche = camp === "moi";
      const x0 = gauche ? x : x + w;
      const sens = gauche ? -1 : 1;
      const secousse = tremblements && tremblements[camp] ? tremblements[camp] : 0;
      const dy = secousse ? Math.sin(temps * 0.05) * 2.4 * secousse : 0;
      // la largeur réglementaire des buts : 7,32 m, à l'échelle du terrain
      const demiCage = geo.my(TRACE_M.cage * geo.kTrace) / 2;
      const yHaut = y + h / 2 - demiCage + dy, yBas = y + h / 2 + demiCage + dy;
      ctx.save();
      // le filet
      ctx.strokeStyle = secousse ? "rgba(242,193,78,0.75)" : t.cages.filet;
      ctx.lineWidth = 0.8;
      const nb = t.cages.maille;
      for (let i = 0; i <= nb; i++) {
        const yy = yHaut + ((yBas - yHaut) * i) / nb;
        ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + sens * prof, yy); ctx.stroke();
      }
      for (let i = 0; i <= 3; i++) {
        const xx = x0 + (sens * prof * i) / 3;
        ctx.beginPath(); ctx.moveTo(xx, yHaut); ctx.lineTo(xx, yBas); ctx.stroke();
      }
      // les montants
      ctx.strokeStyle = secousse ? "#F2C14E" : t.cages.montant;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x0, yHaut); ctx.lineTo(x0, yBas);
      ctx.moveTo(x0, yHaut); ctx.lineTo(x0 + sens * prof, yHaut);
      ctx.moveTo(x0, yBas); ctx.lineTo(x0 + sens * prof, yBas);
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ---- La finition d'ambiance, tout en haut de la pile ---- */
  function dessinerAmbiance(ctx, geo, t) {
    if (t.ambiance.lumiere) {
      ctx.fillStyle = t.ambiance.lumiere;
      ctx.fillRect(0, 0, geo.largeur, geo.hauteur);
    }
    if (t.ambiance.vignette > 0) {
      const v = ctx.createRadialGradient(
        geo.largeur / 2, geo.hauteur / 2, geo.hauteur * 0.35,
        geo.largeur / 2, geo.hauteur / 2, geo.largeur * 0.72);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, `rgba(0,0,0,${t.ambiance.vignette})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, geo.largeur, geo.hauteur);
    }
  }

  /* La couleur du SOL d'un thème : celle relevée sur l'image quand il y
     en a une, sinon le gazon dessiné. C'est la référence de contraste
     des pions — un maillot ne se lit pas contre un gazon théorique. */
  const sol = (t) => (t && t.sol) || (t && t.gazon ? t.gazon.sombre : "#185A26");

  return { liste, theme, geometrie, dessiner, dessinerCages, dessinerAmbiance, sol,
    precharger, ballon, DEFAUT, THEMES };
})();

if (typeof module !== "undefined") module.exports = ONZE_STADE;
