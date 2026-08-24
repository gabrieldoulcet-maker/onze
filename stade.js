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
      gazon: { clair: "#1E6B2E", sombre: "#185A26", bandes: 14, usure: "rgba(0,0,0,0.10)" },
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
      gazon: { clair: "#12512A", sombre: "#0D4222", bandes: 14, usure: "rgba(0,0,0,0.16)" },
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
      gazon: { clair: "#8A5A32", sombre: "#7E522D", bandes: 6, usure: "rgba(0,0,0,0.14)" },
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
      terrain: { gauche: 0.088, droite: 0.912, haut: 0.152, bas: 0.848 },
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
      terrain: { gauche: 0.088, droite: 0.912, haut: 0.152, bas: 0.848 },
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
      terrain: { gauche: 0.088, droite: 0.912, haut: 0.152, bas: 0.848 },
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
  function geometrie(largeur, hauteur, t) {
    const marge = Math.round(hauteur * (t ? t.marge : 0.10));
    // `terrain` (thèmes à image) resserre le rectangle de jeu pour laisser
    // voir les angles de l'arène ; sans lui, comportement d'origine exact.
    const cadre = t && t.terrain;
    const x = cadre ? Math.round(largeur * cadre.gauche) : 0;
    const y = cadre ? Math.round(hauteur * cadre.haut) : marge;
    const w = Math.max((cadre ? Math.round(largeur * cadre.droite) : largeur) - x, 20);
    const h = Math.max((cadre ? Math.round(hauteur * cadre.bas) : hauteur - marge) - y, 20);
    return {
      largeur, hauteur, marge,
      x, y, w, h,
      // conversion pourcentage de terrain → pixels du canvas
      px: (xPct) => x + (xPct / 100) * w,
      py: (yPct) => y + (yPct / 100) * h,
      // une longueur en % de terrain → px (utile pour les rayons)
      ux: (v) => (v / 100) * w,
      uy: (v) => (v / 100) * h,
    };
  }

  /* ---- Les tribunes : une bande floue en haut et en bas ----
     Rendue une fois dans un canvas hors-écran (le flou coûte cher),
     puis recopiée à chaque frame : coût négligeable à 60 fps. */
  const cacheTribunes = new Map();
  function tribunes(geo, t) {
    const cle = `${t.nom}|${geo.largeur}|${geo.marge}`;
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
    const pas = Math.max(3, Math.round(c.width / (110 * tr.densite)));
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
    if (arene) {
      ctx.drawImage(arene, 0, 0, geo.largeur, geo.hauteur);
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

    // 3. le gazon et ses bandes de tonte
    const bandes = Math.max(2, t.gazon.bandes);
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
        const halo = ctx.createRadialGradient(fx, fy, 0, fx, fy, h * t.projecteurs.rayon);
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

    // 5. le tracé
    ctx.save();
    ctx.strokeStyle = t.lignes.couleur;
    ctx.lineWidth = t.lignes.epaisseur;
    const bord = t.lignes.epaisseur;
    ctx.strokeRect(x + bord, y + bord, w - bord * 2, h - bord * 2);
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.155, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, t.lignes.epaisseur * 1.4, 0, 6.283);
    ctx.fillStyle = t.lignes.couleur; ctx.fill();
    // surfaces de réparation (16,5 m) et de but (5,5 m), les deux côtés
    for (const cote of [0, 1]) {
      const sensX = cote === 0 ? 1 : -1;
      const x0 = cote === 0 ? x : x + w;
      ctx.strokeRect(Math.min(x0, x0 + sensX * geo.ux(15.5)), y + h * 0.20, geo.ux(15.5), h * 0.60);
      ctx.strokeRect(Math.min(x0, x0 + sensX * geo.ux(5.5)), y + h * 0.355, geo.ux(5.5), h * 0.29);
      // le point de penalty et l'arc de cercle
      const xp = x0 + sensX * geo.ux(10.5);
      ctx.beginPath(); ctx.arc(xp, y + h / 2, t.lignes.epaisseur, 0, 6.283);
      ctx.fillStyle = t.lignes.couleur; ctx.fill();
      ctx.beginPath();
      ctx.arc(xp, y + h / 2, h * 0.13, cote === 0 ? -0.9 : 2.24, cote === 0 ? 0.9 : 4.04);
      ctx.stroke();
      // les corners
      for (const yc of [y, y + h]) {
        ctx.beginPath();
        ctx.arc(x0, yc, geo.ux(1.4), 0, 6.283);
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
    const prof = geo.ux(t.cages.profondeur * 100);
    for (const camp of ["moi", "eux"]) {
      const gauche = camp === "moi";
      const x0 = gauche ? x : x + w;
      const sens = gauche ? -1 : 1;
      const secousse = tremblements && tremblements[camp] ? tremblements[camp] : 0;
      const dy = secousse ? Math.sin(temps * 0.05) * 2.4 * secousse : 0;
      const yHaut = y + h * 0.40 + dy, yBas = y + h * 0.60 + dy;
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

  return { liste, theme, geometrie, dessiner, dessinerCages, dessinerAmbiance,
    precharger, ballon, DEFAUT, THEMES };
})();

if (typeof module !== "undefined") module.exports = ONZE_STADE;
