/* ============================================================
   ONZE — RECETTE DE LA DA S2 (cartes illustrées, banc figurines,
   arènes). Ce que le brief exige, vérifié dans un vrai navigateur :
     1. le jeu tourne avec une table de portraits VIDE
     2. il tourne avec une table PARTIELLE (mélange illustré / Blason)
     3. le cadre de coût est présent et de la BONNE couleur
     4. nom et prix restent lisibles PAR-DESSUS l'illustration
        (contraste mesuré sur les pixels réellement composités)
     5. les silhouettes du banc partagent hauteur ET ligne de sol
     6. le poids chargé à l'ouverture reste sous le plafond annoncé
     7. pendant le match, les jetons redeviennent des pastilles
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/da.spec.js
   (serveur : python3 -m http.server 8123 --directory .)
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
/* LE PLAFOND ANNONCÉ : 1,2 Mo à l'ouverture de l'écran de mercato, décor
   d'entraînement compris (il est désormais peint par DÉFAUT).
   Pire cas : ~520 Ko de socle (polices auto-hébergées, scripts, CSS,
   roster + tables) + les 5 key arts les plus lourds (372 Ko) + le terrain
   d'entraînement (93 Ko en jeu/) + une silhouette (~100 Ko) ≈ 1085 Ko.
   Le reste des 8 Mo de visuels ne se charge QUE quand il s'affiche
   (loading="lazy" sur chaque illustration et chaque silhouette). */
const PLAFOND_OUVERTURE_KO = 1200;

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

/* Luminance relative (WCAG) puis rapport de contraste. */
const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));

  // ---- 6. le poids réellement téléchargé jusqu'à l'écran de mercato ----
  let octets = 0;
  page.on("response", async (r) => {
    try {
      const t = (r.headers()["content-type"] || "");
      if (/image|font|javascript|css|json|html/.test(t)) {
        const l = Number(r.headers()["content-length"] || 0);
        octets += l || (await r.body().catch(() => Buffer.alloc(0))).length;
      }
    } catch (e) { /* réponse déjà consommée : ignorée */ }
  });

  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
  await page.evaluate(() => { arreterChrono(); });
  await page.waitForTimeout(1200);          // laisse les visuels visibles arriver
  const ko = Math.round(octets / 1024);
  verifier(`poids à l'ouverture : ${ko} Ko ≤ ${PLAFOND_OUVERTURE_KO} Ko (plafond annoncé)`,
    ko <= PLAFOND_OUVERTURE_KO, `${ko} Ko`);

  // pas de compte figé : ce qui doit tenir, c'est que TOUT le roster ait un visage
  const couverture = await page.evaluate(() => ({
    entrees: ONZE_PORTRAITS.nombre(),
    sansCarte: tousLesJoueurs.filter((j) => !ONZE_PORTRAITS.carte(j.nom)).map((j) => j.nom),
    sansFrontale: tousLesJoueurs.filter((j) => !ONZE_PORTRAITS.frontale(j.nom)).map((j) => j.nom),
  }));
  verifier(`la table couvre les ${71} joueurs du roster (${couverture.entrees} entrées en tout)`,
    couverture.sansCarte.length === 0 && couverture.sansFrontale.length === 0,
    "sans visuel : " + [...new Set([...couverture.sansCarte, ...couverture.sansFrontale])].join(", "));

  // ---- 3. le cadre de coût : présent, et de la couleur du coût ----
  const cadres = await page.evaluate(() => {
    partie.or = 40;
    partie.boutique = [1, 2, 3, 4, 5].map((c) => tousLesJoueurs.find((j) => j.cout === c));
    afficher();
    return [...document.querySelectorAll("#boutique .carte-boutique")].map((c) => {
      const cs = getComputedStyle(c);
      const attendue = getComputedStyle(document.documentElement)
        .getPropertyValue(`--cout-${[...c.classList].find((x) => x.startsWith("cout-")).slice(5)}`).trim();
      const versRGB = (h) => { const n = parseInt(h.slice(1), 16); return `rgb(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255})`; };
      return { largeur: parseFloat(cs.borderTopWidth), reelle: cs.borderTopColor, attendue: versRGB(attendue),
        illustree: c.classList.contains("illustree") };
    });
  });
  verifier("cadre de coût présent et de la bonne couleur sur les 5 cartes",
    cadres.length === 5 && cadres.every((c) => c.largeur >= 1.5 && c.reelle === c.attendue),
    JSON.stringify(cadres.filter((c) => c.reelle !== c.attendue)));
  verifier("les 5 cartes sont bien illustrées", cadres.every((c) => c.illustree));

  // ---- 4. nom et prix lisibles PAR-DESSUS l'illustration ----
  // On mesure les pixels composités de la barre basse : le fond est
  // approché par le 40ᵉ centile de luminance (le texte, clair, est au-dessus).
  const barre = await page.evaluate(() => {
    const b = document.querySelector(".carte-boutique.illustree .barre-nom");
    const r = b.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height),
      couleurTexte: getComputedStyle(b.querySelector(".nom-carte")).color };
  });
  const png = (await page.screenshot({ clip: barre })).toString("base64");
  const fond = await page.evaluate(async (b64) => {
    const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const pixels = [];
    for (let i = 0; i < d.length; i += 4) pixels.push([d[i], d[i + 1], d[i + 2]]);
    const clair = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
    pixels.sort((p, q) => clair(p) - clair(q));
    return pixels[Math.floor(pixels.length * 0.4)];   // 40ᵉ centile = le fond
  }, png);
  const texte = barre.couleurTexte.match(/\d+/g).map(Number).slice(0, 3);
  const ratio = contraste(texte, fond);
  verifier(`contraste du nom sur la barre basse : ${ratio.toFixed(1)}:1 ≥ 4.5:1`, ratio >= 4.5, ratio.toFixed(2));

  // ---- 4 bis. l'illustration garde sa LUMIÈRE (brief habillage v2) ----
  // Le voile ne doit vivre que sous les textes : la zone illustrée doit
  // rester à au moins 80 % de la luminance de la même région du fichier
  // source — et dans TOUS les états, grisé compris (sinon le personnage
  // devient une silhouette noire, ce que la carte-illustration doit éviter).
  const avantLumiere = await page.evaluate(() => ({ or: partie.or, boutique: partie.boutique.map((f) => f && f.nom) }));
  for (const [etat, or, plancher] of [["achetable", 40, 0.80], ["grisée", 0, 0.80]]) {
    const info = await page.evaluate(async (or) => {
      arreterChrono(); partie.or = or;
      partie.boutique = Array(5).fill(0).map(() => tousLesJoueurs.find((j) => j.nom === "Facundo"));
      afficher();
      await new Promise((r) => setTimeout(r, 700));
      const c = document.querySelector(".carte-boutique.illustree");
      const img = c.querySelector(".art-carte");
      const rc = c.getBoundingClientRect(), ri = img.getBoundingClientRect();
      return { carte: { x: Math.round(rc.x), y: Math.round(rc.y), width: Math.round(rc.width), height: Math.round(rc.height) },
        boite: { l: ri.width, h: ri.height }, barre: Math.round(c.querySelector(".barre-nom").getBoundingClientRect().height),
        grisee: c.classList.contains("grisee"), nat: [img.naturalWidth, img.naturalHeight],
        objPos: getComputedStyle(img).objectPosition, source: img.currentSrc.split("/").slice(-3).join("/") };
    }, or);
    const pngCarte = (await page.screenshot({ clip: info.carte })).toString("base64");
    const lumiere = await page.evaluate(async ([b64, info]) => {
      const lire = async (src) => {
        const im = new Image(); im.src = src; await im.decode();
        const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
        return { g, L: c.width, H: c.height };
      };
      const moyenne = (o, x0, y0, x1, y1) => {
        const d = o.g.getImageData(Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)).data;
        let t = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) { t += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
        return t / n;
      };
      // la région du fichier source RÉELLEMENT affichée : cover, puis le
      // zoom « buste » (scale 1,5 autour de 72 % 2 %)
      const [NL, NH] = info.nat, BL = info.boite.l, BH = info.boite.h;
      const s = Math.max(BL / NL, BH / NH);
      const decX = (BL - NL * s) * ((parseFloat(info.objPos) / 100) || 0.72);
      const decY = (BH - NH * s) * 0.20;
      const k = 1.5, ox = BL * 0.72, oy = BH * 0.02;
      const versSource = (bx, by) => [(bx - decX) / s, (by - decY) / s];
      const [sx0, sy0] = versSource(ox + (0 - ox) / k, oy + (0 - oy) / k);
      const [sx1, sy1] = versSource(ox + (BL - ox) / k, oy + (BH - oy) / k);
      const src = await lire(info.source);
      const zoneSrc = moyenne(src, Math.max(0, sx0), Math.max(0, sy0), Math.min(NL, sx1), Math.min(NH, sy1));
      const ecran = await lire("data:image/png;base64," + b64);
      const zoneEcran = moyenne(ecran, 2, 2, ecran.L - 2, ecran.H - info.barre - 2);
      return { ecran: +zoneEcran.toFixed(1), source: +zoneSrc.toFixed(1), rapport: +(zoneEcran / zoneSrc).toFixed(3) };
    }, [pngCarte, info]);
    verifier(`illustration ${etat} : luminance ${lumiere.ecran} ≥ ${Math.round(plancher * 100)} % de la source ` +
      `(${lumiere.source}) → ${Math.round(lumiere.rapport * 100)} %`,
      info.grisee === (or === 0) && lumiere.rapport >= plancher, JSON.stringify(lumiere));
  }
  // on rend la boutique et l'or tels qu'on les a trouvés : les recettes
  // suivantes comptent dessus
  await page.evaluate((avant) => {
    partie.or = avant.or;
    partie.boutique = avant.boutique.map((n) => (n ? tousLesJoueurs.find((j) => j.nom === n) : null));
    afficher();
  }, avantLumiere);

  // ---- 5. l'ÉPURATION (brief habillage v2) : silhouettes nues, dalles de
  //         poste, et le niveau d'étoiles lu dans la TAILLE ----
  const scene = await page.evaluate(() => {
    const parPoste = (p, n = 0) => tousLesJoueurs.filter((j) => j.poste === p && ONZE_PORTRAITS.frontale(j.nom))[n];
    partie.banc = [
      { ...parPoste("GAR"), etoiles: 1, uid: "e1" }, { ...parPoste("DÉF"), etoiles: 1, uid: "e2" },
      { ...parPoste("MIL"), etoiles: 1, uid: "e3" }, { ...parPoste("ATT"), etoiles: 2, uid: "e4" },
      { ...parPoste("DÉF", 1), etoiles: 3, uid: "e5" },
    ];
    partie.niveau = 8;
    partie.terrain = [{ ...parPoste("GAR", 1), ligne: "GAR", etoiles: 1, uid: "t1" },
      { ...parPoste("MIL", 1), ligne: "MIL", etoiles: 2, uid: "t2" }];
    afficher();
    const teinte = (j) => getComputedStyle(j).getPropertyValue("--teinte-poste").trim();
    const jetons = [...document.querySelectorAll("#banc .jeton.figurine")];
    const mesure = (j) => {
      const im = j.querySelector(".frontale").getBoundingClientRect();
      return { h: Math.round(im.height * 10) / 10, sol: Math.round(im.bottom * 10) / 10 };
    };
    const m = jetons.map(mesure);
    const parEtoile = partie.banc.map((f, i) => ({ etoiles: f.etoiles, ...m[i], poste: f.poste, teinte: teinte(jetons[i]),
      legende: jetons[i].classList.contains("legende") }));
    const surGazon = [...document.querySelectorAll(".ligne-terrain .jeton.figurine")];
    const habillage = surGazon.map((j) => {
      const cs = getComputedStyle(j);
      return { bordure: parseFloat(cs.borderTopWidth), fond: cs.backgroundImage, ombre: cs.boxShadow,
        nom: !!j.querySelector(".nom-jeton"), pastille: !!j.querySelector(".pastille"),
        etoiles: !!j.querySelector(".etoiles, .etoiles-tete") };
    });
    return { banc: parEtoile, terrain: habillage, nbGazon: surGazon.length };
  });

  const un = scene.banc.filter((b) => b.etoiles === 1);
  const deux = scene.banc.find((b) => b.etoiles === 2);
  const trois = scene.banc.find((b) => b.etoiles === 3);
  verifier(`banc : hauteur commune à niveau d'étoile égal (${un.length} joueurs 1★ à ${un[0].h} px)`,
    new Set(un.map((b) => b.h)).size === 1, JSON.stringify(un.map((b) => b.h)));
  verifier(`banc : la ligne de sol est la même pour tous (étoiles comprises)`,
    new Set(scene.banc.map((b) => b.sol)).size === 1, JSON.stringify(scene.banc.map((b) => b.sol)));
  const r2 = deux.h / un[0].h, r3 = trois.h / un[0].h;
  verifier(`étoiles dans la taille : 1★ 100 % · 2★ ${Math.round(r2 * 100)} % · 3★ ${Math.round(r3 * 100)} %`,
    Math.abs(r2 - 1.18) < 0.02 && Math.abs(r3 - 1.38) < 0.02, `${r2.toFixed(3)} / ${r3.toFixed(3)}`);
  verifier("le 3★ allume le sol en or, et lui seul",
    trois.legende && !deux.legende && un.every((b) => !b.legende));
  const COULEUR = { GAR: "245, 197, 49", "DÉF": "62, 155, 224", MIL: "61, 204, 110", ATT: "232, 80, 63" };
  const dallesJustes = scene.banc.every((b) => b.teinte.includes(COULEUR[b.poste]));
  verifier("banc : chaque dalle porte la couleur de son poste",
    dallesJustes, JSON.stringify(scene.banc.map((b) => [b.poste, b.teinte])));
  verifier(`terrain : plus aucun habillage sur les ${scene.nbGazon} silhouettes ` +
    `(ni cadre, ni fond, ni nom, ni étoiles, ni pastille)`,
    scene.nbGazon > 0 && scene.terrain.every((t) => t.bordure === 0 && t.fond === "none" &&
      t.ombre === "none" && !t.nom && !t.pastille && !t.etoiles),
    JSON.stringify(scene.terrain[0]));
  verifier("banc : les emplacements vides restent visibles",
    await page.evaluate(() => document.querySelectorAll("#banc .place-banc").length > 0));

  // ---- 7. pendant le match, les jetons redeviennent des pastilles ----
  const enMatch = await page.evaluate(() => {
    partie.matchEnCours = true; afficher();
    const n = document.querySelectorAll(".jeton.figurine").length;
    partie.matchEnCours = false; afficher();
    return { pendant: n, apres: document.querySelectorAll(".jeton.figurine").length };
  });
  verifier("match : aucune figurine pendant le match, elles reviennent après",
    enMatch.pendant === 0 && enMatch.apres > 0, JSON.stringify(enMatch));

  // ---- 1 & 2. table VIDE puis PARTIELLE : le jeu reste jouable ----
  /* La promesse tenue avec une table vide a CHANGÉ de forme (décision 39
     complétée) : sans illustration, le jeton ne redevient plus une carte
     avec un nom — c'était ce repli qui remettait des rectangles et des
     noms sur le gazon. Il devient une SILHOUETTE NEUTRE, teintée du
     poste et dessinée en SVG : un seul chemin de rendu hors match, quelle
     que soit la table. Côté boutique, le repli Blason ne bouge pas. */
  const vide = await page.evaluate(() => {
    ONZE_PORTRAITS.definir({});
    afficher();
    const jetons = [...document.querySelectorAll("#terrain-scene .jeton, #banc .jeton")];
    return { cartes: document.querySelectorAll("#boutique .carte-boutique").length,
      illustrees: document.querySelectorAll(".carte-boutique.illustree").length,
      jetons: jetons.length,
      figurines: jetons.filter((j) => j.classList.contains("figurine")).length,
      silhouettes: jetons.filter((j) => j.querySelector("svg.frontale")).length,
      textes: jetons.filter((j) => (j.innerText || "").trim()).length,
      // la carte ENTIÈRE est la cible d'achat : plus de bouton à compter
      boutons: document.querySelectorAll("#boutique .carte-boutique[data-boutique]").length };
  });
  verifier("table VIDE : cartes Blason en boutique, silhouettes neutres sur le terrain, achat possible",
    vide.cartes === 5 && vide.illustrees === 0 && vide.boutons === 5 &&
    vide.jetons > 0 && vide.figurines === vide.jetons && vide.silhouettes === vide.jetons && vide.textes === 0,
    JSON.stringify(vide));
  const achatSansTable = await page.evaluate(() => {
    const avant = partie.terrain.length + partie.banc.length;
    acheter(0);
    return partie.terrain.length + partie.banc.length > avant;
  });
  verifier("table VIDE : un achat fonctionne normalement", achatSansTable);

  const partielle = await page.evaluate(() => {
    const nom = partie.boutique.find(Boolean).nom;
    ONZE_PORTRAITS.definir({ [nom]: { carte: "da/keyarts/ONZE_01_Sam.webp" } });  // carte seule, pas de frontale
    afficher();
    const jetons = [...document.querySelectorAll("#terrain-scene .jeton, #banc .jeton")];
    return { illustrees: document.querySelectorAll(".carte-boutique.illustree").length,
      cartes: document.querySelectorAll("#boutique .carte-boutique").length,
      jetons: jetons.length,
      silhouettes: jetons.filter((j) => j.querySelector("svg.frontale")).length,
      textes: jetons.filter((j) => (j.innerText || "").trim()).length };
  });
  verifier("table PARTIELLE : une carte illustrée, les autres en Blason, silhouettes neutres au sol",
    partielle.illustrees === 1 && partielle.cartes === 5 &&
    partielle.silhouettes === partielle.jetons && partielle.textes === 0,
    JSON.stringify(partielle));

  // ---- l'arène : le décor se peint, le ballon reste un jeton de thème ----
  const arene = await page.evaluate(async () => {
    const t = ONZE_STADE.theme("emeraude");
    const prete = await ONZE_STADE.precharger(t);
    const b = ONZE_STADE.ballon(t);
    const g = ONZE_STADE.geometrie(844, 390, t);
    const gDefaut = ONZE_STADE.geometrie(844, 390, ONZE_STADE.theme("municipal"));
    return { prete, contour: b.contour, inscrit: g.x > 0 && g.w < 844,
      defautIntact: gDefaut.x === 0 && gDefaut.w === 844 };
  });
  verifier("arène : l'image se charge, le rectangle de jeu se resserre, les thèmes dessinés sont intacts",
    arene.prete && arene.inscrit && arene.defautIntact, JSON.stringify(arene));
  verifier("arène : le ballon porte un contour de thème", !!arene.contour);
  verifier("les 3 arènes sont proposées dans les réglages",
    await page.evaluate(() => ONZE_STADE.liste().filter((t) => ONZE_STADE.theme(t.id).fond).length) === 3);

  // ---- l'effectif COMPLET en figurines, sur le pire écran (667×320) ----
  const petit = await (await browser.newContext({ viewport: { width: 667, height: 320 } })).newPage();
  await petit.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await petit.goto("http://localhost:8123/partie.html");
  await petit.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
  const serre = await petit.evaluate(() => {
    arreterChrono();
    partie.niveau = 10;                      // 11 titulaires : 4 par ligne de champ
    const avecArt = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j.nom));
    partie.terrain = avecArt.slice(0, 11).map((f, i) => ({ ...f, ligne: ["GAR", "DÉF", "MIL", "ATT"][i === 0 ? 0 : 1 + (i % 3)], etoiles: 1, uid: "p" + i }));
    partie.banc = avecArt.slice(11, 11 + TAILLE_BANC).map((f, i) => ({ ...f, etoiles: 1, uid: "b" + i }));
    afficher();
    const deborde = (sel) => [...document.querySelectorAll(sel)].some((e) => {
      const r = e.getBoundingClientRect();
      return r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1 || r.top < -1;
    });
    return { figurines: document.querySelectorAll(".jeton.figurine").length,
      debordeJetons: deborde(".jeton"), debordeBoutons: deborde("#boutique .carte-boutique button"),
      barre: Math.round(document.getElementById("boutique-barre").getBoundingClientRect().bottom) };
  });
  verifier(`effectif complet (${serre.figurines} figurines) à 667×320 : rien ne déborde`,
    serre.figurines >= 15 && !serre.debordeJetons && !serre.debordeBoutons && serre.barre <= 321,
    JSON.stringify(serre));
  await petit.close();

  // ---- l'ACCUEIL : le décor du tunnel, et rien qui déborde ----
  for (const [nom, l, h] of [["paysage", 844, 390], ["pire cas", 667, 320], ["portrait", 390, 844]]) {
    const acc = await (await browser.newContext({ viewport: { width: l, height: h } })).newPage();
    const errAcc = [];
    acc.on("pageerror", (e) => errAcc.push(e.message));
    await acc.goto("http://localhost:8123/index.html");
    await acc.waitForTimeout(900);
    const etat = await acc.evaluate(() => {
      const im = document.querySelector(".fond-accueil");
      const dansLecran = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.left >= -1 && r.top >= -1 &&
          r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1;
      };
      return { fond: !!im && im.complete && im.naturalWidth > 0,
        source: im ? (im.currentSrc || "").split("/accueil/")[1] : null,
        jouer: dansLecran(".bouton-jouer"), reglages: dansLecran(".reglages") };
    });
    verifier(`accueil · ${nom} : décor chargé (${etat.source}), « Jouer » et les réglages entiers à l'écran`,
      etat.fond && etat.jouer && etat.reglages && errAcc.length === 0,
      JSON.stringify(etat) + errAcc.slice(0, 2).join(" | "));
    await acc.close();
  }

  verifier(`zéro erreur JS (${erreursJS.length})`, erreursJS.length === 0, erreursJS.slice(0, 3).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nRecette DA ✅");
  process.exit(echecs ? 1 : 0);
})();
