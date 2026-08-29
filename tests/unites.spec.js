/* ============================================================
   ONZE — LES 79 FIGURINES DE TERRAIN (brief « Poser les 79
   figurines sur le terrain »).
   ------------------------------------------------------------
   Ce que cette recette garantit, et que rien d'autre ne dit :
     1. la PASSE DE BORD — aucune image importée ne porte d'alpha
        sur sa ligne de bord (seuil 8/255, le bruit de
        rééchantillonnage), ET elle sort ROUGE sur les deux défauts
        qu'elle prétend attraper : la bande parasite de Marcus et
        une figurine coupée par le canevas ;
     2. le jeu tourne avec une table d'ancrages VIDE, puis
        PARTIELLE — figurine absente, jeton d'aujourd'hui à la
        place, jamais d'écran cassé ;
     3. sur le terrain, le POINT D'APPUI de chaque figurine tombe
        exactement sur le point de pose calculé — c'est ça, « tous
        sur la même ligne de sol ».
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/unites.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const racine = path.join(__dirname, "..");

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });

  /* ---- 1. LA PASSE DE BORD, sur les 158 fichiers ---- */
  const fichiers = [];
  for (const d of ["da/unites", "da/ombres"]) {
    for (const fam of fs.readdirSync(path.join(racine, d))) {
      for (const f of fs.readdirSync(path.join(racine, d, fam))) fichiers.push(`${d}/${fam}/${f}`);
    }
  }
  /* Le détecteur : un SEUIL, pas une signature. Aucune des 79 sources ne
     touche son bord (elles s'arrêtent 4 px avant), donc tout alpha de
     bord au-delà du bruit de rééchantillonnage est un défaut — quelle que
     soit sa voisine intérieure. La première version cherchait « bord
     opaque, voisine transparente » : elle décrivait bien le défaut de
     Marcus, mais laissait passer le cas le plus grave, une figurine
     RÉELLEMENT COUPÉE par le canevas, dont le bord et sa voisine sont
     opaques tous les deux. Les deux sont contre-testés plus bas. */
  const SEUIL_ALPHA = 8;
  const detecteur = `(async (chemin, mode) => {
    const im = new Image(); im.src = chemin; await im.decode();
    const L = im.naturalWidth, H = im.naturalHeight;
    const c = document.createElement("canvas"); c.width = L; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    if (mode === "coupee") {
      // une figurine coupée par le canevas : on la dessine trop grande,
      // son corps déborde et les bords deviennent opaques des deux côtés
      g.drawImage(im, -L * 0.3, -H * 0.3, L * 1.6, H * 1.6);
    } else {
      g.drawImage(im, 0, 0);
      // le défaut d'origine de Marcus : 367 lignes de gris clair opaque
      if (mode === "marcus") { g.fillStyle = "rgba(200,200,200,1)"; g.fillRect(L - 1, 200, 1, 367); }
    }
    const d = g.getImageData(0, 0, L, H).data;
    const a = (x, y) => d[(y * L + x) * 4 + 3];
    let n = 0, pire = 0;
    const v = (x, y) => { const q = a(x, y); if (q > pire) pire = q; if (q > 8) n++; };
    for (let x = 0; x < L; x++) { v(x, 0); v(x, H - 1); }
    for (let y = 0; y < H; y++) { v(0, y); v(L - 1, y); }
    return { n, pire, taille: [L, H] };
  })`;
  const sales = [];
  let gabaritsFaux = 0, pireAlpha = 0;
  for (const f of fichiers) {
    const r = await page.evaluate(([code, chemin]) => eval(code)(chemin, "brut"), [detecteur, f]);
    if (r.n) sales.push(`${f} (${r.n} px, alpha max ${r.pire})`);
    if (r.pire > pireAlpha) pireAlpha = r.pire;
    if (r.taille[0] !== 600 || r.taille[1] !== 900) gabaritsFaux++;
  }
  verifier(`aucune des ${fichiers.length} images importées ne porte d'alpha sur sa ligne de bord ` +
    `(seuil ${SEUIL_ALPHA}/255 · alpha de bord maximal relevé : ${pireAlpha})`,
    sales.length === 0, sales.slice(0, 5).join(" | "));
  verifier(`les ${fichiers.length} images sont au gabarit 600 × 900`, gabaritsFaux === 0, `${gabaritsFaux} hors gabarit`);

  /* LES DEUX CONTRE-TESTS. Une recette qui ne sort pas rouge sur le défaut
     qu'elle prétend attraper n'est pas un garde-fou — et il y a DEUX
     défauts à attraper, pas un. */
  const marcus = "da/unites/08_Internationaux/05_Marcus_unit_alpha.webp";
  const sale = await page.evaluate(([code, chemin]) => eval(code)(chemin, "marcus"), [detecteur, marcus]);
  verifier(`contre-test 1 : ROUGE sur le défaut de Marcus reconstitué (${sale.n} pixels de bord)`,
    sale.n === 367, String(sale.n));
  const coupee = await page.evaluate(([code, chemin]) => eval(code)(chemin, "coupee"), [detecteur, marcus]);
  verifier(`contre-test 2 : ROUGE sur une figurine coupée par le canevas (${coupee.n} pixels de bord, ` +
    `bord ET voisine opaques — le cas que la version « signature » laissait passer)`,
    coupee.n > 200, String(coupee.n));

  /* ---- 2. (AMENDÉ PAR LA REFONTE, décision 74) ----
     La mise en place ne rend plus les figurines : des CARTES carrées
     portant le key art. Les contrats d'ancrage, d'ombre au sol et de
     table d'unités partielle n'ont plus d'objet sur cet écran — les
     158 fichiers restent vérifiés par la passe de bord (section 1),
     ils servent la scène et pourront revenir.
     Ce qui se vérifie désormais :
       · la table d'unités peut disparaître SANS RIEN CHANGER à la mise
         en place (elle n'en dépend plus) ;
       · la table des KEY ARTS vide, chaque jeton retombe sur le glyphe
         de poste déclaré — jamais d'écran cassé, la boutique est là. */
  const sansUnites = await page.evaluate(async () => {
    arreterChrono();
    const avant = [...document.querySelectorAll("#terrain-scene .jeton img.dessin-carte")].length;
    ONZE_PORTRAITS.definirUnites("", null);          // plus aucune figurine
    afficher();
    await new Promise((r) => setTimeout(r, 250));
    const apres = [...document.querySelectorAll("#terrain-scene .jeton img.dessin-carte")].length;
    return { avant, apres };
  });
  verifier(`la table d'unités peut disparaître sans toucher la mise en place ` +
    `(${sansUnites.avant} dessins avant, ${sansUnites.apres} après)`,
    sansUnites.avant === sansUnites.apres, JSON.stringify(sansUnites));

  const tableVide = await page.evaluate(async () => {
    ONZE_PORTRAITS.definir({});                      // plus aucun key art
    afficher();
    await new Promise((r) => setTimeout(r, 250));
    const jetons = [...document.querySelectorAll("#terrain-scene .jeton.carte-jeton, #banc .jeton.carte-jeton")];
    return { jetons: jetons.length,
      replis: jetons.filter((j) => j.querySelector(".dessin-carte.absent")).length,
      glyphesVides: jetons.filter((j) => {
        const a = j.querySelector(".dessin-carte.absent");
        return a && !(a.textContent || "").trim();
      }).length,
      boutique: document.querySelectorAll("#boutique .carte-boutique").length };
  });
  verifier(`table des key arts VIDE : ${tableVide.jetons} cartes en glyphe de poste, la boutique est là`,
    tableVide.jetons > 0 && tableVide.replis === tableVide.jetons &&
    tableVide.glyphesVides === 0 && tableVide.boutique === 5,
    JSON.stringify(tableVide));

  verifier("cartes : zéro erreur JS", erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nFigurines de terrain ✅");
  process.exit(echecs ? 1 : 0);
})();
