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
/* LE PLAFOND ANNONCÉ : 1,5 Mo à l'ouverture de l'écran de mercato, décor
   d'entraînement compris (peint par DÉFAUT), figurines de trois quarts et
   leurs ombres comprises.
   Pire cas recalculé à l'arrivée des 79 unités :
     ~520 Ko de socle (polices auto-hébergées, scripts, CSS, roster + tables)
   + les 5 key arts les plus lourds de la boutique (365 Ko)
   + le terrain d'entraînement (79 Ko en jeu/, le flou de distance ayant
     allégé les décors)
   + les 5 titulaires de départ en UNITÉ + OMBRE (5 × 71 Ko = 355 Ko —
     c'est ce que ce lot ajoute : l'unité pèse 60 Ko, son ombre 11)
   + une figurine de remplaçant (71 Ko) ≈ 1390 Ko.
   Le reste des 14 Mo de visuels ne se charge QUE quand il s'affiche.

   CE QUI A CHANGÉ, ET POURQUOI. Cette assertion mesurait le tirage DU
   JOUR : six ouvertures d'affilée ont donné 1359, 1456, 1467, 1468, 1502
   et 1516 Ko — même code, même plafond, verdict tiré aux dés. Une
   assertion qui répond vert ou rouge selon la boutique du moment ne
   mesure pas le produit : elle mesure la chance, et elle finit par être
   crue le jour où elle a tort. Le plafond a toujours dit borner le PIRE
   tirage — on mesure donc le pire tirage, au lieu d'espérer le rencontrer.

   Le pire tirage se calcule : on retire du total les key arts des 5
   cartes réellement tirées, ce qui donne le SOCLE (scripts, CSS, page,
   polices, tables, décor, figurines de départ) ; on y rajoute les 5 key
   arts les plus lourds du roster, mesurés par requête HEAD. Le nombre ne
   dépend plus d'aucun tirage. */
const PLAFOND_OUVERTURE_KO = 1500;

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
  let sansTaille = 0;
  const parChemin = new Map();
  /* Écouteur SYNCHRONE : la version précédente attendait `r.body()`, et les
     réponses dont la promesse retombait après la fin de la mesure n'étaient
     pas comptées — d'où un socle qui variait de 72 Ko d'un passage à l'autre
     sans qu'un octet ait bougé sur le disque. Le serveur envoie toujours
     content-length ; on le lit, et on compte à part ce qui n'en a pas plutôt
     que de faire semblant de l'avoir mesuré. */
  page.on("response", (r) => {
    try {
      const t = (r.headers()["content-type"] || "");
      if (!/image|font|javascript|css|json|html/.test(t)) return;
      const l = Number(r.headers()["content-length"] || 0);
      if (!l) { sansTaille++; return; }
      octets += l;
      // décodé : « Sékou » arrive en %C3%A9 dans l'URL, et une clé encodée
      // ne retrouve jamais le chemin que ONZE_PORTRAITS rend en clair
      parChemin.set(decodeURIComponent(new URL(r.url()).pathname).replace(/^\//, ""), l);
    } catch (e) { sansTaille++; }
  });

  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
  await page.evaluate(() => { arreterChrono(); });
  await page.waitForTimeout(1200);          // laisse les visuels visibles arriver
  const ko = Math.round(octets / 1024);
  /* Le pire tirage, calculé : socle + les 5 key arts les plus lourds du
     roster. Aucun dé dans le verdict. */
  /* DÉDOUBLONNÉ : la boutique peut tirer deux fois le même joueur, et son
     key art n'est alors téléchargé qu'une fois. Le soustraire deux fois
     amputait le socle de 72 Ko une fois sur cinq. */
  const tire = [...new Set(await page.evaluate(() =>
    partie.boutique.map((f) => f && ONZE_PORTRAITS.carte(f)).filter(Boolean)))];
  const octetsTires = tire.reduce((t, c) => t + (parChemin.get(c.replace(/^\//, "")) || 0), 0);
  const socle = octets - octetsTires;
  const cheminsRoster = await page.evaluate(() =>
    [...new Set(tousLesJoueurs.map((j) => ONZE_PORTRAITS.carte(j)).filter(Boolean))]);
  const poidsRoster = [];
  for (const c of cheminsRoster)
    poidsRoster.push(await page.evaluate((u) =>
      fetch(u, { method: "HEAD" }).then((x) => Number(x.headers.get("content-length") || 0)).catch(() => 0), c));
  poidsRoster.sort((a, b) => b - a);
  const cinqPires = poidsRoster.slice(0, 5).reduce((t, v) => t + v, 0);
  const koPire = Math.round((socle + cinqPires) / 1024);
  verifier(`toutes les réponses ont été pesées (${sansTaille} sans content-length)`,
    sansTaille === 0, `${sansTaille} réponse(s) non mesurée(s) : le poids annoncé serait sous-estimé`);
  verifier(`poids à l'ouverture, PIRE tirage : ${koPire} Ko ≤ ${PLAFOND_OUVERTURE_KO} Ko ` +
    `(socle ${Math.round(socle / 1024)} Ko + les 5 key arts les plus lourds ${Math.round(cinqPires / 1024)} Ko ; ` +
    `le tirage du jour pesait ${ko} Ko)`,
    koPire <= PLAFOND_OUVERTURE_KO, `${koPire} Ko`);

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

  // ---- 5. (AMENDÉ PAR LA REFONTE, décision 74) : les CARTES ----
  //      L'« épuration » (silhouettes nues, dalles de poste, étoiles
  //      dans la taille du corps) était le contrat de l'ère 3D. Les
  //      contrats de la carte : cadre couleur du poste, banc à taille
  //      UNIQUE (une bande de rangement), étoiles dans la taille SUR LE
  //      TERRAIN (1★ 100 % · 2★ 118 %), 3★ seul auréolé d'or, aucun nom.
  const scene = await page.evaluate(() => {
    const parPoste = (p, n = 0) => tousLesJoueurs.filter((j) => j.poste === p && ONZE_PORTRAITS.carte(j))[n];
    partie.banc = [
      { ...parPoste("GAR"), etoiles: 1, uid: "e1" }, { ...parPoste("DÉF"), etoiles: 1, uid: "e2" },
      { ...parPoste("MIL"), etoiles: 1, uid: "e3" }, { ...parPoste("ATT"), etoiles: 2, uid: "e4" },
      { ...parPoste("DÉF", 1), etoiles: 3, uid: "e5" },
    ];
    partie.niveau = 8;
    partie.terrain = [{ ...parPoste("MIL", 2), ligne: "MIL", etoiles: 1, uid: "t1" },
      { ...parPoste("MIL", 1), ligne: "MIL", etoiles: 2, uid: "t2" }];
    afficher();
    const jetons = [...document.querySelectorAll("#banc .jeton.carte-jeton")];
    const banc = partie.banc.map((f, i) => ({ etoiles: f.etoiles, poste: f.poste,
      h: Math.round(jetons[i].getBoundingClientRect().height * 10) / 10,
      bord: getComputedStyle(jetons[i]).borderTopColor,
      legende: jetons[i].classList.contains("legende") }));
    const surGazon = [...document.querySelectorAll(".ligne-terrain .jeton.carte-jeton")];
    const terrain = surGazon.map((j) => ({
      h: j.getBoundingClientRect().height,
      nom: !!j.querySelector(".nom-jeton"), pastille: !!j.querySelector(".pastille") }));
    return { banc, terrain, nbGazon: surGazon.length };
  });
  verifier(`banc : la bande range à taille unique (${scene.banc.map((b) => b.h).join(" · ")} px)`,
    new Set(scene.banc.map((b) => b.h)).size === 1, JSON.stringify(scene.banc.map((b) => b.h)));
  verifier("le 3★ est seul auréolé d'or (classe legende)",
    scene.banc.filter((b) => b.legende).length === 1 && scene.banc.find((b) => b.etoiles === 3).legende);
  const COULEUR = { GAR: "245, 197, 49", "DÉF": "62, 155, 224", MIL: "61, 204, 110", ATT: "232, 80, 63" };
  verifier("banc : chaque cadre porte la couleur de son poste",
    scene.banc.every((b) => b.bord.includes(COULEUR[b.poste])),
    JSON.stringify(scene.banc.map((b) => [b.poste, b.bord])));
  const rEtoiles = scene.terrain.length === 2 ? scene.terrain[1].h / scene.terrain[0].h : 0;
  verifier(`terrain : les étoiles se lisent dans la taille (2★ à ${Math.round(rEtoiles * 100)} % du 1★)`,
    Math.abs(rEtoiles - 1.18) < 0.06, String(rEtoiles.toFixed(3)));
  verifier(`terrain : aucun nom ni pastille sur les ${scene.nbGazon} cartes`,
    scene.nbGazon > 0 && scene.terrain.every((t) => !t.nom && !t.pastille),
    JSON.stringify(scene.terrain[0]));
  verifier("banc : les emplacements vides restent visibles",
    await page.evaluate(() => document.querySelectorAll("#banc .place-banc").length > 0));

  /* ---- 7. LA SCÈNE À L'ÉCRAN, PAS LE DRAPEAU ----
     Première version : elle posait `partie.matchEnCours = true` et
     comptait les figurines. Elle testait donc un DRAPEAU, et la décision
     55 avait prévenu que ce drapeau ne dit pas ce qu'on croit — il couvre
     le match ET le bilan. Le défaut qu'elle a laissé passer : depuis que
     le match se range avant la cérémonie de butin, les joueurs
     redevenaient des cartes-jetons AU MILIEU DES ORBES, alors que la
     scène n'existait plus. Deux moitiés à vérifier, et la seconde est
     celle qui manquait. */
  const enMatch = await page.evaluate(async () => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    partie.manche = 3; preparerManche(); jouerManche();
    let garde = 0;
    while (!document.querySelector(".scene-match canvas") && garde++ < 200) {
      await new Promise((r) => setTimeout(r, 100));
    }
    /* Refonte : le BANC reste visible pendant le match (clause c du
       contrat de couture) et il porte des cartes — la promesse vaut pour
       le TERRAIN : aucune carte de terrain VISIBLE tant que la scène est
       à l'écran (la scène a ses propres pions). */
    const visibles = () => [...document.querySelectorAll(".ligne-terrain .jeton.carte-jeton")]
      .filter((j) => j.offsetParent !== null && j.getBoundingClientRect().width > 0).length;
    const pendant = visibles();
    // on range le match SANS toucher au drapeau : c'est l'état de la
    // cérémonie de butin, où matchEnCours vaut encore true
    rangerLeMatch();
    await new Promise((r) => setTimeout(r, 250));
    return { pendant, drapeau: partie.matchEnCours,
      ceremonie: visibles(),
      scene: !!document.querySelector(".scene-match") };
  });
  verifier(`match : aucune carte de terrain tant que la SCÈNE est à l'écran (${enMatch.pendant})`,
    enMatch.pendant === 0, JSON.stringify(enMatch));
  verifier(`cérémonie : les cartes reviennent dès que la scène est rangée, même si ` +
    `matchEnCours vaut encore ${enMatch.drapeau} (${enMatch.ceremonie} cartes, scène ${enMatch.scene})`,
    enMatch.ceremonie > 0 && enMatch.scene === false, JSON.stringify(enMatch));

  // ---- 1 & 2. table VIDE puis PARTIELLE : le jeu reste jouable ----
  /* La promesse tenue avec une table vide a CHANGÉ de forme (décision 39
     complétée) : sans illustration, le jeton ne redevient plus une carte
     avec un nom — c'était ce repli qui remettait des rectangles et des
     noms sur le gazon. Il devient une SILHOUETTE NEUTRE, teintée du
     poste et dessinée en SVG : un seul chemin de rendu hors match, quelle
     que soit la table. Côté boutique, le repli Blason ne bouge pas. */
  const vide = await page.evaluate(() => {
    // « table vide » veut dire les DEUX tables : les key arts ET les 79
    // figurines de terrain, qui vivent dans leur propre table depuis le
    // lot des unités. Vider l'une sans l'autre ne teste rien.
    ONZE_PORTRAITS.definir({});
    ONZE_PORTRAITS.definirUnites("", null);
    afficher();
    const jetons = [...document.querySelectorAll("#terrain-scene .jeton, #banc .jeton")];
    return { cartes: document.querySelectorAll("#boutique .carte-boutique").length,
      illustrees: document.querySelectorAll(".carte-boutique.illustree").length,
      jetons: jetons.length,
      figurines: jetons.filter((j) => j.classList.contains("carte-jeton")).length,
      silhouettes: jetons.filter((j) => j.querySelector(".dessin-carte.absent")).length,
      // refonte : la carte porte coût/étoiles — le NOM seul reste interdit
      textes: jetons.filter((j) => /[A-Za-zÀ-ÿ]{2,}/.test(j.innerText || "")).length,
      // la carte ENTIÈRE est la cible d'achat : plus de bouton à compter
      boutons: document.querySelectorAll("#boutique .carte-boutique[data-boutique]").length };
  });
  verifier("table VIDE : cartes Blason en boutique, cartes-glyphes sur le terrain, achat possible",
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
    ONZE_PORTRAITS.definirUnites("", null);                                       // et aucune figurine
    afficher();
    const jetons = [...document.querySelectorAll("#terrain-scene .jeton, #banc .jeton")];
    return { illustrees: document.querySelectorAll(".carte-boutique.illustree").length,
      cartes: document.querySelectorAll("#boutique .carte-boutique").length,
      jetons: jetons.length,
      silhouettes: jetons.filter((j) => j.querySelector(".dessin-carte.absent") || j.querySelector("img.dessin-carte")).length,
      textes: jetons.filter((j) => /[A-Za-zÀ-ÿ]{2,}/.test(j.innerText || "")).length };
  });
  verifier("table PARTIELLE : une carte illustrée, les autres en Blason, cartes-glyphes au sol",
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
      /* Décision 51 : un thème DESSINÉ n'a pas d'artwork pour lui dicter
         son cadre, il suit donc la caméra de la scène (2,40:1) au lieu
         de s'étaler sur toute la fenêtre — ce qu'il faisait avant, et
         qui le laissait sans caméra du tout. */
      rapportDefaut: +(gDefaut.w / gDefaut.h).toFixed(2),
      defautCentre: Math.abs((844 - gDefaut.w) / 2 - gDefaut.x) <= 1 };
  });
  verifier(`arène : l'image se charge, le rectangle de jeu se resserre, et un thème dessiné garde la caméra de la scène (${arene.rapportDefaut}:1)`,
    arene.prete && arene.inscrit && Math.abs(arene.rapportDefaut - 2.40) <= 0.12 && arene.defautCentre,
    JSON.stringify(arene));
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
    return { figurines: document.querySelectorAll(".jeton.carte-jeton").length,
      debordeJetons: deborde(".jeton"), debordeBoutons: deborde("#boutique .carte-boutique button"),
      barre: Math.round(document.getElementById("boutique-barre").getBoundingClientRect().bottom) };
  });
  verifier(`effectif complet (${serre.figurines} cartes) à 667×320 : rien ne déborde`,
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
