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
/* LE PLAFOND ANNONCÉ : 1,1 Mo à l'ouverture de l'écran de mercato.
   Calcul du pire cas : ~520 Ko de socle (polices auto-hébergées, scripts,
   CSS, roster + table) + les 5 key arts les plus lourds de la boutique
   (372 Ko) + une silhouette de titulaire (~100 Ko) ≈ 990 Ko.
   Le reste des 8 Mo de visuels ne se charge QUE quand il s'affiche
   (loading="lazy" sur chaque illustration et chaque silhouette). */
const PLAFOND_OUVERTURE_KO = 1100;

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

  // ---- 5. les silhouettes du banc : même hauteur, même ligne de sol ----
  const silhouettes = await page.evaluate(() => {
    partie.banc = ["Sékou", "Rodrigo", "Billy", "Gorka"].map((n, i) => ({
      ...tousLesJoueurs.find((j) => j.nom === n), etoiles: i === 2 ? 2 : 1, uid: "t" + i }));
    afficher();
    return [...document.querySelectorAll("#banc .jeton.figurine .frontale")].map((im) => {
      const r = im.getBoundingClientRect();
      return { h: Math.round(r.height * 10) / 10, sol: Math.round(r.bottom * 10) / 10 };
    });
  });
  verifier(`banc : ${silhouettes.length} silhouettes à hauteur et ligne de sol communes`,
    silhouettes.length === 4 &&
    new Set(silhouettes.map((s) => s.h)).size === 1 &&
    new Set(silhouettes.map((s) => s.sol)).size === 1, JSON.stringify(silhouettes));
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
  const vide = await page.evaluate(() => {
    ONZE_PORTRAITS.definir({});
    afficher();
    return { cartes: document.querySelectorAll("#boutique .carte-boutique").length,
      illustrees: document.querySelectorAll(".carte-boutique.illustree").length,
      figurines: document.querySelectorAll(".jeton.figurine").length,
      boutons: document.querySelectorAll("#boutique .carte-boutique button").length };
  });
  verifier("table VIDE : les 5 cartes Blason s'affichent, achat toujours possible",
    vide.cartes === 5 && vide.illustrees === 0 && vide.figurines === 0 && vide.boutons === 5,
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
    return { illustrees: document.querySelectorAll(".carte-boutique.illustree").length,
      cartes: document.querySelectorAll("#boutique .carte-boutique").length,
      figurines: document.querySelectorAll(".jeton.figurine").length };
  });
  verifier("table PARTIELLE : une carte illustrée, les autres en Blason, aucune figurine sans frontale",
    partielle.illustrees === 1 && partielle.cartes === 5 && partielle.figurines === 0,
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

  verifier(`zéro erreur JS (${erreursJS.length})`, erreursJS.length === 0, erreursJS.slice(0, 3).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nRecette DA ✅");
  process.exit(echecs ? 1 : 0);
})();
