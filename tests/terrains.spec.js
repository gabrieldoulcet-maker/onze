/* ============================================================
   ONZE — RECETTE DES TERRAINS D'ENTRAÎNEMENT (DA S2).
   ------------------------------------------------------------
   Le banc n'est pas posé où le code veut : les neuf emplacements
   sont PEINTS dans le décor. Cette recette vérifie la chaîne
   entière — config → cadre de l'image → positionnement réel —
   en relisant les PIXELS affichés : les neuf tuiles calculées
   doivent tomber dans les neuf rectangles peints, sur les trois
   terrains et aux cinq tailles d'écran de référence.
   Plus : la géométrie statique, et la correspondance arène ↔ terrain.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/terrains.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const fs = require("fs");
const path = require("path");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const TAILLES = [
  { nom: "grand téléphone", largeur: 844, hauteur: 390 },
  { nom: "petit téléphone", largeur: 667, hauteur: 375 },
  { nom: "encoche", largeur: 812, hauteur: 375 },
  { nom: "barre navigateur", largeur: 844, hauteur: 340 },
  { nom: "pire cas", largeur: 667, hauteur: 320 },
];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

const racine = path.join(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(racine, "design/terrains.json"), "utf8"));

/* ---------- 1. la géométrie, sans navigateur ---------- */
{
  const ids = Object.keys(config);
  verifier(`trois terrains configurés (${ids.join(", ")})`, ids.length === 3, ids.join(", "));
  const stade = fs.readFileSync(path.join(racine, "stade.js"), "utf8");
  for (const [id, t] of Object.entries(config)) {
    verifier(`${t.nom} : neuf emplacements`, Array.isArray(t.tuiles) && t.tuiles.length === 9,
      String((t.tuiles || []).length));
    const ordonnees = (t.tuiles || []).every((tu, i, a) => i === 0 || tu.x0 > a[i - 1].x1);
    verifier(`${t.nom} : emplacements ordonnés et disjoints`, ordonnees);
    const dansLimage = (t.tuiles || []).every((tu) => tu.x0 >= 0 && tu.x1 <= 1 && tu.y0 >= 0 && tu.y1 <= 1);
    verifier(`${t.nom} : emplacements dans les bornes de l'image`, dansLimage);
    for (const f of Object.values(t.image || {})) {
      verifier(`${t.nom} : ${f} présent`, fs.existsSync(path.join(racine, f)));
    }
    // le terrain d'entraînement RÉPOND à une arène de match : même clé
    verifier(`${t.nom} : répond à l'arène « ${id} »`, stade.includes(`${id}: {`), id);
    const q = t.terrain;
    verifier(`${t.nom} : quadrilatère en perspective (le fond est plus étroit)`,
      (q.hautDroite[0] - q.hautGauche[0]) < (q.basDroite[0] - q.basGauche[0]));
  }
}

/* ---------- 2. les pixels : les tuiles calculées sur les tuiles peintes ---------- */
(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const erreursJS = [];
  for (const [id, terrain] of Object.entries(config)) {
    for (const taille of TAILLES) {
      const page = await (await browser.newContext({
        viewport: { width: taille.largeur, height: taille.hauteur } })).newPage();
      page.on("pageerror", (e) => erreursJS.push(e.message));
      await page.addInitScript((s) => { try {
        localStorage.setItem("onze-tutoriel-vu", "1");
        localStorage.setItem("onze-reglages-match", JSON.stringify({ stade: s }));
      } catch (e) {} }, id);
      await page.goto("http://localhost:8123/partie.html");
      await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
      // banc VIDE : les neuf mats peints sont alors tous à découvert
      const cadre = await page.evaluate(async () => {
        arreterChrono();
        partie.banc = [];
        afficher();
        const im = document.getElementById("fond-terrain");
        if (im && !im.complete) await new Promise((r) => { im.onload = r; im.onerror = r; });
        await new Promise((r) => setTimeout(r, 250));
        const p = document.getElementById("plateau").getBoundingClientRect();
        const places = [...document.querySelectorAll("#banc .place-banc")].map((e) => {
          const r = e.getBoundingClientRect();
          return { x: r.x - p.x, y: r.y - p.y, l: r.width, h: r.height };
        });
        return { plateau: { x: Math.round(p.x), y: Math.round(p.y), width: Math.round(p.width), height: Math.round(p.height) }, places };
      });
      verifier(`${terrain.nom} · ${taille.nom} : neuf emplacements rendus`, cadre.places.length === 9,
        String(cadre.places.length));

      // on relit les PIXELS du plateau et on y cherche les mats peints
      const png = (await page.screenshot({ clip: cadre.plateau })).toString("base64");
      const verdict = await page.evaluate(async ([b64, places]) => {
        const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const lum = (x, y) => { const i = ((y | 0) * c.width + (x | 0)) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3; };
        // la bande des mats = celle des emplacements rendus
        const yBande = places.reduce((t, p) => t + p.y + p.h / 2, 0) / places.length;
        // on ne balaie QUE la bande des emplacements : hors d'elle, une ombre
        // du décor ferait un faux mat sans rien dire de l'alignement
        const x0 = Math.max(0, Math.round(places[0].x - places[0].l * 0.4));
        const dernier = places[places.length - 1];
        const x1 = Math.min(c.width - 1, Math.round(dernier.x + dernier.l * 1.4));
        const ligne = [];
        for (let x = x0; x <= x1; x++) ligne.push(lum(x, yBande));
        const trie = [...ligne].sort((a, b) => a - b);
        const seuil = (trie[(trie.length * 0.25) | 0] + trie[(trie.length * 0.75) | 0]) / 2;
        const runs = []; let deb = -1;
        for (let i = 0; i < ligne.length; i++) {
          const sombre = ligne[i] < seuil;
          if (sombre && deb < 0) deb = i;
          if ((!sombre || i === ligne.length - 1) && deb >= 0) {
            if (i - deb > (x1 - x0) * 0.03) runs.push([x0 + deb, x0 + i]);
            deb = -1;
          }
        }
        // 1. chaque emplacement calculé tombe DANS un rectangle peint
        const dedans = places.map((p) => {
          const cx = p.x + p.l / 2;
          return runs.some(([a, b]) => cx >= a - 1 && cx <= b + 1);
        });
        // 2. et l'intervalle entre deux emplacements retombe sur le tablier
        //    (sinon un mat unique et large passerait pour neuf)
        let intervallesClairs = 0;
        for (let i = 1; i < places.length; i++) {
          const milieu = (places[i - 1].x + places[i - 1].l + places[i].x) / 2;
          if (lum(milieu, yBande) > seuil) intervallesClairs++;
        }
        return { runs: runs.length, dedans: dedans.filter(Boolean).length, intervallesClairs,
          fautifs: places.map((p, i) => (dedans[i] ? null : i)).filter((v) => v !== null) };
      }, [png, cadre.places]);
      verifier(`${terrain.nom} · ${taille.nom} : les 9 emplacements tombent dans les rectangles peints ` +
        `(${verdict.dedans}/9 · ${verdict.runs} mats · ${verdict.intervallesClairs}/8 intervalles sur le tablier)`,
        verdict.dedans === 9 && verdict.runs === 9 && verdict.intervallesClairs === 8,
        "emplacements hors mat : " + verdict.fautifs.join(", "));
      await page.close();
    }
  }
  /* ---------- 2 bis. sur un stockage VIERGE, le décor est PEINT ---------- */
  {
    const neuf = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    neuf.on("pageerror", (e) => erreursJS.push(e.message));
    // aucun localStorage : exactement ce que voit un joueur qui arrive
    await neuf.goto("http://localhost:8123/partie.html");
    await neuf.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
    const vu = await neuf.evaluate(async () => {
      arreterChrono();
      const im = document.getElementById("fond-terrain");
      if (im && !im.complete) await new Promise((r) => { im.onload = r; im.onerror = r; });
      return { stade: (ONZE_SCENE.reglages() || {}).stade,
        peint: document.getElementById("plateau").classList.contains("terrain-peint"),
        decor: im && !im.classList.contains("masque") && im.complete && im.naturalWidth > 0
          ? im.currentSrc.split("/").slice(-1)[0] : null,
        tuiles: document.querySelectorAll("#banc .place-banc, #banc .jeton").length };
    });
    verifier(`stockage vierge : le décor peint s'affiche d'emblée (${vu.stade} → ${vu.decor})`,
      vu.peint && !!vu.decor && vu.tuiles === 9, JSON.stringify(vu));
    await neuf.close();
  }

  /* ---------- 3. la densité : jeu/ en 1×, hd/ en 2×, et le poids ---------- */
  /* PLAFOND ANNONCÉ pour l'écran de mercato, terrain d'entraînement compris :
       1,2 Mo en densité 1 · 1,45 Mo en forte densité.
     Pire cas : ~520 Ko de socle (polices, scripts, CSS, roster, tables)
     + les 5 key arts les plus lourds de la boutique (372 Ko)
     + le décor (93 Ko en jeu/, 354 Ko en hd/)
     + une silhouette de titulaire (~100 Ko).
     Le reste des 8 Mo de visuels ne se charge QUE quand il s'affiche. */
  for (const [dpr, attendu, plafondKo] of [[1, "jeu/", 1200], [2, "hd/", 1450]]) {
    const page = await (await browser.newContext({
      viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr })).newPage();
    let octets = 0; const decors = [];
    page.on("response", async (r) => {
      if (/da\/terrains\//.test(r.url())) decors.push(r.url().split("/da/terrains/")[1]);
      try {
        const t = r.headers()["content-type"] || "";
        if (/image|font|javascript|css|json|html/.test(t))
          octets += Number(r.headers()["content-length"] || 0) || (await r.body().catch(() => Buffer.alloc(0))).length;
      } catch (e) { /* corps déjà consommé */ }
    });
    await page.addInitScript(() => { try {
      localStorage.setItem("onze-tutoriel-vu", "1");
      localStorage.setItem("onze-reglages-match", JSON.stringify({ stade: "emeraude" }));
    } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
    await page.evaluate(() => arreterChrono());
    await page.waitForTimeout(1800);
    const ko = Math.round(octets / 1024);
    verifier(`densité ${dpr}× : le décor servi est ${attendu} et l'ouverture pèse ${ko} Ko ≤ ${plafondKo} Ko`,
      decors.length > 0 && decors.every((f) => f.startsWith(attendu)) && ko <= plafondKo,
      decors.join(", ") + ` · ${ko} Ko`);
    await page.close();
  }

  verifier(`zéro erreur JS (${erreursJS.length})`, erreursJS.length === 0, erreursJS.slice(0, 3).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nTerrains d'entraînement ✅");
  process.exit(echecs ? 1 : 0);
})();
