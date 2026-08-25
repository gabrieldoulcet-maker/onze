/* ============================================================
   ONZE — LES 79 FIGURINES DE TERRAIN (brief « Poser les 79
   figurines sur le terrain »).
   ------------------------------------------------------------
   Ce que cette recette garantit, et que rien d'autre ne dit :
     1. la PASSE DE BORD — aucune image importée ne porte de ligne
        parasite sur son bord (la signature du défaut de Marcus :
        une ligne de bord opaque alors que sa voisine est
        transparente) — ET la passe sort ROUGE sur ce défaut
        reconstitué, sinon ce n'est pas un garde-fou ;
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
  const detecteur = `(async (chemin, salir) => {
    const im = new Image(); im.src = chemin; await im.decode();
    const L = im.naturalWidth, H = im.naturalHeight;
    const c = document.createElement("canvas"); c.width = L; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    if (salir) { g.fillStyle = "rgba(200,200,200,1)"; g.fillRect(L - 1, 200, 1, 367); }
    const d = g.getImageData(0, 0, L, H).data;
    const a = (x, y) => d[(y * L + x) * 4 + 3];
    // parasite : bord opaque dont le voisin intérieur est transparent
    let n = 0;
    for (let x = 0; x < L; x++) {
      if (a(x, 0) > 200 && a(x, 1) < 12) n++;
      if (a(x, H - 1) > 200 && a(x, H - 2) < 12) n++;
    }
    for (let y = 0; y < H; y++) {
      if (a(0, y) > 200 && a(1, y) < 12) n++;
      if (a(L - 1, y) > 200 && a(L - 2, y) < 12) n++;
    }
    return { n, taille: [L, H] };
  })`;
  const sales = [];
  let gabaritsFaux = 0;
  for (const f of fichiers) {
    const r = await page.evaluate(([code, chemin]) => eval(code)(chemin, false), [detecteur, f]);
    if (r.n) sales.push(`${f} (${r.n})`);
    if (r.taille[0] !== 600 || r.taille[1] !== 900) gabaritsFaux++;
  }
  verifier(`aucune des ${fichiers.length} images importées ne porte de ligne parasite sur un bord`,
    sales.length === 0, sales.slice(0, 5).join(" | "));
  verifier(`les ${fichiers.length} images sont au gabarit 600 × 900`, gabaritsFaux === 0, `${gabaritsFaux} hors gabarit`);

  /* La même passe, sur le défaut RECONSTITUÉ (la bande d'1 px de gris
     clair opaque de Marcus) : elle doit sortir rouge, sinon elle ne
     garantit rien. */
  const marcus = "da/unites/08_Internationaux/05_Marcus_unit_alpha.webp";
  const sale = await page.evaluate(([code, chemin]) => eval(code)(chemin, true), [detecteur, marcus]);
  verifier(`la passe de bord sort ROUGE sur le défaut de Marcus reconstitué (${sale.n} pixels parasites)`,
    sale.n === 367, String(sale.n));

  /* ---- 2. TABLE D'ANCRAGES VIDE, puis PARTIELLE ---- */
  const vide = await page.evaluate(async () => {
    arreterChrono();
    ONZE_PORTRAITS.definirUnites("", null);          // aucune figurine
    afficher();
    await new Promise((r) => setTimeout(r, 250));
    const jetons = [...document.querySelectorAll("#terrain-scene .jeton, #banc .jeton")];
    return { jetons: jetons.length,
      avecOmbre: jetons.filter((j) => j.classList.contains("avec-ombre")).length,
      visuels: jetons.filter((j) => j.querySelector("img.frontale, svg.frontale")).length,
      boutique: document.querySelectorAll("#boutique .carte-boutique").length,
      or: partie.or };
  });
  verifier(`table VIDE : le jeu tourne, ${vide.jetons} jetons rendus, aucun ne réclame d'ombre, la boutique est là`,
    vide.jetons > 0 && vide.avecOmbre === 0 && vide.visuels === vide.jetons && vide.boutique === 5,
    JSON.stringify(vide));

  const partielle = await page.evaluate(async () => {
    const manifeste = "index\tfamille\tjoueur\tunite\tombre\n" +
      "01\t01 Ecole de la Rue\tMalandro\tunits/01_Ecole_de_la_Rue/01_Malandro_unit_alpha.png\tshadows/01_Ecole_de_la_Rue/01_Malandro_shadow_alpha.png";
    const table = { _defaut: { x: 0.4585, y: 0.9701 },
      ancrages: { Malandro: { x: 0.4864, y: 0.9544, jeu: "Malandro" } } };
    const posees = ONZE_PORTRAITS.definirUnites(manifeste, table);
    const base = tousLesJoueurs.find((j) => j.nom === "Malandro");
    const autre = tousLesJoueurs.find((j) => j.nom !== "Malandro" && ONZE_PORTRAITS.carte(j));
    partie.banc = [{ ...base, etoiles: 1, uid: "pa1" }, { ...autre, etoiles: 1, uid: "pa2" }];
    afficher();
    await new Promise((r) => setTimeout(r, 250));
    const jetons = [...document.querySelectorAll("#banc .jeton.figurine")];
    return { posees, avecFigurine: jetons.filter((j) => j.classList.contains("avec-ombre")).length,
      tous: jetons.length, visuels: jetons.filter((j) => j.querySelector("img.frontale, svg.frontale")).length };
  });
  verifier(`table PARTIELLE (1 figurine sur 79) : celui qui l'a la porte, les autres gardent leur visuel d'avant`,
    partielle.posees === 1 && partielle.avecFigurine === 1 && partielle.visuels === partielle.tous,
    JSON.stringify(partielle));

  /* ---- 3. LE POINT D'APPUI TOMBE SUR LE POINT DE POSE ---- */
  await page.reload();
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
  const poses = await page.evaluate(async () => {
    arreterChrono();
    partie.niveau = 10;
    const art = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j));
    partie.terrain = art.slice(0, 11).map((f, i) => ({ ...f, etoiles: (i % 3) + 1, uid: "U" + i,
      ligne: ["GAR", "DÉF", "MIL", "ATT"][i === 0 ? 0 : 1 + (i % 3)] }));
    afficher();
    await Promise.all([...document.images].filter((i) => i.src && !i.complete).map((i) => i.decode().catch(() => {})));
    await new Promise((r) => setTimeout(r, 300));
    return [...document.querySelectorAll(".ligne-terrain .jeton.figurine")].map((j) => {
      const st = getComputedStyle(j);
      const ay = parseFloat(st.getPropertyValue("--ancrage-y")) || 1;
      const ax = parseFloat(st.getPropertyValue("--ancrage-x")) || 0.5;
      const rj = j.getBoundingClientRect();
      const im = j.querySelector("img.frontale, svg.frontale");
      const om = j.querySelector("img.ombre-sol");
      const ri = im.getBoundingClientRect();
      const ro = om ? om.getBoundingClientRect() : null;
      return {
        // le point de pose = le bas de la case (les PIEDS y sont posés)
        pose: { x: rj.x + rj.width / 2, y: rj.bottom },
        appui: { x: ri.x + ax * ri.width, y: ri.bottom - (1 - ay) * ri.height },
        appuiOmbre: ro ? { x: ro.x + ax * ro.width, y: ro.bottom - (1 - ay) * ro.height } : null,
        avecOmbre: !!ro,
      };
    });
  });
  const decales = poses.filter((p) => Math.abs(p.appui.x - p.pose.x) > 1.5 || Math.abs(p.appui.y - p.pose.y) > 1.5);
  verifier(`terrain : les ${poses.length} figurines posent leur point d'appui sur leur point de pose (± 1,5 px)`,
    poses.length === 11 && decales.length === 0,
    JSON.stringify(decales.map((p) => [Math.round(p.appui.x - p.pose.x), Math.round(p.appui.y - p.pose.y)])));
  const ombresDecalees = poses.filter((p) => p.avecOmbre &&
    (Math.abs(p.appuiOmbre.x - p.appui.x) > 1 || Math.abs(p.appuiOmbre.y - p.appui.y) > 1));
  verifier(`terrain : l'ombre de chaque figurine tombe sous son pied (± 1 px, ${poses.filter((p) => p.avecOmbre).length} ombres)`,
    ombresDecalees.length === 0,
    JSON.stringify(ombresDecalees.map((p) => [Math.round(p.appuiOmbre.x - p.appui.x), Math.round(p.appuiOmbre.y - p.appui.y)])));

  verifier("figurines : zéro erreur JS", erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nFigurines de terrain ✅");
  process.exit(echecs ? 1 : 0);
})();
