/* ============================================================
   ONZE — RECETTE DE L'ÉCRAN D'ACCUEIL (DA S2).
   ------------------------------------------------------------
   L'accueil est posé sur une photo : chaque texte doit donc se
   détacher de ce qu'il y a DERRIÈRE LUI, pixels à l'appui — même
   contrôle que sur les cartes de boutique. On vérifie aussi les
   zones de pose : le logo en haut au centre (nuit du tunnel), les
   boutons en bas à gauche (autour du tableau tactique), le
   palmarès dans le tiers droit — et surtout rien au bas du centre,
   la seule zone claire de l'image, sauf plaque sombre.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/accueil.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};
const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const contraste = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  for (const taille of [{ nom: "paysage", l: 844, h: 390 }, { nom: "pire cas", l: 667, h: 320 },
    { nom: "portrait", l: 390, h: 844 }]) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try {
      localStorage.setItem("onze-palmares", JSON.stringify([
        { place: 1, manche: 14, compo: ["Facundo", "Rodrigo"], icones: ["a"], date: "24/08" },
        { place: 3, manche: 11, compo: ["Billy", "Unai"], date: "23/08" }]));
    } catch (e) {} });
    await page.goto("http://localhost:8123/index.html");
    await page.waitForTimeout(1000);

    // ---- le décor est bien celui de l'accueil, et il est chargé ----
    const decor = await page.evaluate(() => {
      const im = document.querySelector(".fond-accueil");
      return im && im.complete && im.naturalWidth > 0 ? (im.currentSrc || "").split("/accueil/")[1] : null;
    });
    verifier(`${taille.nom} : le décor d'accueil est chargé (${decor})`, !!decor, String(decor));

    // ---- CONTRASTE de chaque texte, mesuré sur les pixels composités ----
    const textes = await page.evaluate(() => {
      const cibles = [".cartouche-logo .nom-logo", ".devise", ".bouton-jouer", "#btn-difficulte", "#btn-sons",
        "#btn-detente", "#btn-reset", ".palmares strong", ".palmares .ligne span", ".labo a", ".invite-a2hs strong"];
      const sortie = [];
      for (const sel of cibles) {
        const e = document.querySelector(sel);
        if (!e) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        sortie.push({ sel, couleur: getComputedStyle(e).color,
          rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } });
      }
      return sortie;
    });
    let pire = { sel: "", ratio: 99 };
    for (const t of textes) {
      const clip = { x: Math.max(0, t.rect.x), y: Math.max(0, t.rect.y),
        width: Math.min(t.rect.width, taille.l - t.rect.x), height: Math.min(t.rect.height, taille.h - t.rect.y) };
      if (clip.width < 4 || clip.height < 4) continue;
      const png = (await page.screenshot({ clip })).toString("base64");
      const fond = await page.evaluate(async (b64) => {
        const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        const g = c.getContext("2d"); g.drawImage(im, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        const px = [];
        for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
        const clair = (p) => 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2];
        px.sort((a, b) => clair(a) - clair(b));
        return px[Math.floor(px.length * 0.35)];      // le fond, sous le texte
      }, png);
      const couleur = t.couleur.match(/\d+/g).map(Number).slice(0, 3);
      const ratio = contraste(couleur, fond);
      if (ratio < pire.ratio) pire = { sel: t.sel, ratio };
    }
    verifier(`${taille.nom} : chaque texte se détache du décor (le pire : ${pire.sel} à ${pire.ratio.toFixed(1)}:1 ≥ 4.5:1)`,
      pire.ratio >= 4.5, `${pire.sel} ${pire.ratio.toFixed(2)}`);

    // ---- les zones de pose, et les deux points d'accroche épargnés ----
    if (taille.nom !== "portrait") {
      const zones = await page.evaluate(() => {
        const L = window.innerWidth, H = window.innerHeight;
        const boite = (sel) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const r = e.getBoundingClientRect();
          return { g: r.left / L, d: r.right / L, h: r.top / H, b: r.bottom / H };
        };
        return { logo: boite("header"), menu: boite(".menu"), palmares: boite(".palmares") };
      });
      const centreH = (z) => (z.g + z.d) / 2;
      verifier(`${taille.nom} : le logo est en haut au centre`,
        zones.logo && zones.logo.h < 0.12 && Math.abs(centreH(zones.logo) - 0.5) < 0.08,
        JSON.stringify(zones.logo));
      verifier(`${taille.nom} : les boutons sont en bas à gauche, autour du tableau tactique`,
        zones.menu && zones.menu.b > 0.85 && zones.menu.d < 0.45, JSON.stringify(zones.menu));
      // le ballon vit à droite (x 0,68-0,82 · y 0,70-0,98) : rien ne le couvre
      const ballon = { g: 0.68, d: 0.82, h: 0.70, b: 0.98 };
      const chevauche = (z) => z && !(z.d < ballon.g || z.g > ballon.d || z.b < ballon.h || z.h > ballon.b);
      verifier(`${taille.nom} : le palmarès occupe le tiers droit sans couvrir le ballon`,
        zones.palmares && zones.palmares.g > 0.6 && !chevauche(zones.palmares), JSON.stringify(zones.palmares));
      verifier(`${taille.nom} : rien du menu ne déborde sur la pelouse éclairée du bas-centre`,
        !chevauche(zones.menu), JSON.stringify(zones.menu));
    }
    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nAccueil ✅");
  process.exit(echecs ? 1 : 0);
})();
