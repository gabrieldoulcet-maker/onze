/* ============================================================
   ONZE — RECETTE DES TERRAINS D'ENTRAÎNEMENT (DA S2).
   ------------------------------------------------------------
   Le banc n'est pas posé où le code veut : les neuf emplacements
   sont PEINTS dans le décor. Cette recette vérifie la chaîne
   entière — config → cadre de l'image → positionnement réel —
   en relisant les PIXELS affichés : les neuf tuiles calculées
   doivent tomber dans les neuf rectangles peints, sur les trois
   terrains et aux cinq tailles d'écran de référence — ET chaque
   REMPLAÇANT RENDU doit être posé dans le mat qui lui est attribué
   (centre de la silhouette et ligne de sol dedans). Les deux
   contrôles sont distincts : le premier valide la géométrie, le
   second le rendu — un emplacement juste n'a jamais garanti qu'un
   joueur s'y tienne.
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

      /* On relit les PIXELS du plateau. Détection directe et robuste : un
         mat peint est un CREUX SOMBRE, donc le centre de chaque
         emplacement calculé doit être nettement plus sombre que les
         intervalles qui l'encadrent. (La première version comptait des
         « segments sombres » sur toute la bande ; depuis que la scène
         occupe tout le cadre, le balayage attrape d'autres ombres du
         décor et le compte devenait faux alors que la géométrie était
         juste — vérifié à l'œil, repères magenta sur les mats peints.)
         Écart mesuré sur les 3 décors × 5 tailles : 45 à 91 unités de
         luminance. Le seuil est posé à 25 : large sous le pire cas réel,
         très au-dessus d'un alignement raté. */
      const ECART_MIN = 25;
      const png = (await page.screenshot({ clip: cadre.plateau })).toString("base64");
      const verdict = await page.evaluate(async ([b64, places, zoneL]) => {
        const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
        const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
        const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
        const dpr = im.width / zoneL;
        const lum = (x, y) => {
          const d = g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
          return (d[0] + d[1] + d[2]) / 3;
        };
        const y = places.reduce((t, p) => t + p.y + p.h / 2, 0) / places.length;
        const centres = places.map((p) => lum(p.x + p.l / 2, y));
        const trous = [];
        for (let i = 1; i < places.length; i++) {
          trous.push(lum((places[i - 1].x + places[i - 1].l + places[i].x) / 2, y));
        }
        const ecarts = centres.map((v, i) => {
          const voisins = [trous[i - 1], trous[i]].filter((t) => t !== undefined);
          return voisins.length ? Math.min(...voisins.map((t) => t - v)) : 0;
        });
        return { ecarts: ecarts.map((v) => Math.round(v)),
          fautifs: ecarts.map((v, i) => (v < 25 ? i : null)).filter((v) => v !== null) };
      }, [png, cadre.places, cadre.plateau.width]);
      const pireEcart = Math.min(...verdict.ecarts);
      verifier(`${terrain.nom} · ${taille.nom} : les 9 emplacements tombent dans les rectangles peints ` +
        `(chaque mat est plus sombre que ses intervalles de ${pireEcart} unités au minimum, seuil ${ECART_MIN})`,
        verdict.fautifs.length === 0 && pireEcart >= ECART_MIN,
        "emplacements hors mat : " + verdict.fautifs.join(", "));

      /* ---- LE JOUEUR RENDU EST-IL SUR SON MAT ? ----
         La vérification ci-dessus prouve que les EMPLACEMENTS calculés
         tombent sur les rectangles peints. Elle ne dit rien du JOUEUR :
         une silhouette peut très bien se retrouver à côté de son
         emplacement. On peuple donc le banc — étoiles mêlées (1★, 2★, 3★
         n'ont pas la même taille) et un joueur SANS illustration (donc en
         silhouette neutre) — et on exige, pour chacun, que le centre de sa
         silhouette ET sa ligne de sol tombent dans le mat qui lui est
         attribué. Testé avec un banc PLEIN, puis avec un SEUL remplaçant :
         c'est le cas courant en début de partie. */
      for (const [etiquette, nb] of [["banc plein", 9], ["un seul remplaçant", 1]]) {
        const pose = await page.evaluate(async (nb) => {
          const prendre = (i) => tousLesJoueurs[i % tousLesJoueurs.length];
          partie.banc = Array.from({ length: nb }, (_, i) => ({ ...prendre(i), etoiles: (i % 3) + 1, uid: "t" + i }));
          if (nb > 1) {   // un joueur sans visuel : il se rend en silhouette neutre
            partie.banc[nb - 1] = { nom: "Gilbert", cout: 0, poste: "DÉF", ligne: "DÉF",
              ecole: "", archetype: "", etoiles: 1, uid: "tx" };
          }
          afficher();
          await new Promise((r) => setTimeout(r, 260));
          const plateau = document.getElementById("plateau");
          const terr = ONZE_TERRAINS.pour((ONZE_SCENE.reglages() || {}).stade);
          const cadre = ONZE_TERRAINS.cadre(plateau.clientWidth, plateau.clientHeight);
          const rp = plateau.getBoundingClientRect();
          const hors = [], invisibles = [];
          [...document.getElementById("banc").children].forEach((c, n) => {
            if (!c.classList.contains("jeton")) return;         // une dalle vide
            if (getComputedStyle(c).display === "none" || getComputedStyle(c).visibility === "hidden") {
              invisibles.push(n); return;                        // un joueur du club JAMAIS invisible
            }
            const visuel = c.querySelector("img.frontale, svg.frontale");
            const mat = ONZE_TERRAINS.tuile(terr, cadre, n % ONZE_TERRAINS.NB_TUILES);
            if (!visuel || !mat) { hors.push({ n, quoi: visuel ? "sans mat" : "sans silhouette" }); return; }
            const r = visuel.getBoundingClientRect();
            const centre = r.x + r.width / 2 - rp.x;             // le centre de la silhouette
            const sol = r.bottom - rp.y;                         // sa ligne de sol
            const dansX = centre >= mat.x - 1 && centre <= mat.x + mat.largeur + 1;
            const dansY = sol >= mat.y - 1 && sol <= mat.y + mat.hauteur + 1;
            if (!dansX || !dansY) {
              hors.push({ n, centre: Math.round(centre), sol: Math.round(sol),
                mat: [Math.round(mat.x), Math.round(mat.y), Math.round(mat.largeur), Math.round(mat.hauteur)],
                dansX, dansY });
            }
          });
          return { joueurs: partie.banc.length, hors, invisibles };
        }, nb);
        verifier(`${terrain.nom} · ${taille.nom} · ${etiquette} : chaque remplaçant est POSÉ sur son mat ` +
          `(centre et ligne de sol dedans, ${pose.joueurs} joueur(s))`,
          pose.hors.length === 0 && pose.invisibles.length === 0,
          JSON.stringify(pose).slice(0, 300));
      }
      await page.close();
    }
  }
  /* ---------- 2 ter. PHASE 1 : l'information flotte SUR le décor, et
     elle doit rester lisible — sur le City Stade très sombre comme sur le
     Boxing Day très clair. Même méthode que sur l'accueil : on mesure les
     PIXELS composités derrière chaque texte, pas la couleur déclarée. ---------- */
  {
    const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lumRel = ([r, g, b]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    const contraste = (a, b) => { const [x, y] = [lumRel(a), lumRel(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    for (const [id, terrain] of Object.entries(config)) {
      const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
      page.on("pageerror", (e) => erreursJS.push(e.message));
      await page.addInitScript((s2) => { try {
        localStorage.setItem("onze-tutoriel-vu", "1");
        localStorage.setItem("onze-reglages-match", JSON.stringify({ stade: s2 }));
      } catch (e) {} }, id);
      await page.goto("http://localhost:8123/partie.html");
      await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
      await page.evaluate(async () => {
        arreterChrono();
        // un club qui vit : des synergies allumées, des remplaçants
        partie.terrain = tousLesJoueurs.slice(0, 5).map((f, i) => ({ ...f, etoiles: 1, uid: "c" + i,
          ligne: ["GAR", "DÉF", "DÉF", "MIL", "ATT"][i] }));
        partie.banc = tousLesJoueurs.slice(5, 8).map((f, i) => ({ ...f, etoiles: 1, uid: "d" + i }));
        afficher();
        const im = document.getElementById("fond-terrain");
        if (im && !im.complete) await new Promise((r) => { im.onload = r; im.onerror = r; });
        await new Promise((r) => setTimeout(r, 320));
      });
      const cibles = await page.evaluate(() => {
        const sels = [".haut .manche-info", "#btn-legende", "#btn-bascule-gauche", ".indice-synergies",
          ".col-synergies .badge", ".col-classement .coach-ligne", "#compteur-titulaires", "#btn-match"];
        const sortie = [];
        for (const sel of sels) {
          for (const e of document.querySelectorAll(sel)) {
            const r = e.getBoundingClientRect();
            if (r.width < 6 || r.height < 6) continue;
            sortie.push({ sel, couleur: getComputedStyle(e).color,
              rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } });
            break;    // un exemplaire par sélecteur suffit : ils partagent leur matière
          }
        }
        return sortie;
      });
      let pire = { sel: "", ratio: 99 };
      for (const t of cibles) {
        const clip = { x: Math.max(0, t.rect.x), y: Math.max(0, t.rect.y),
          width: Math.min(t.rect.width, 844 - t.rect.x), height: Math.min(t.rect.height, 390 - t.rect.y) };
        if (clip.width < 6 || clip.height < 6) continue;
        const png = (await page.screenshot({ clip })).toString("base64");
        const fond = await page.evaluate(async (b64) => {
          const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
          const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
          const g = c.getContext("2d"); g.drawImage(im, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const px = [];
          for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
          const clair = (p2) => 0.2126 * p2[0] + 0.7152 * p2[1] + 0.0722 * p2[2];
          px.sort((a, b) => clair(a) - clair(b));
          return px[Math.floor(px.length * 0.35)];
        }, png);
        const couleur = t.couleur.match(/\d+/g).map(Number).slice(0, 3);
        const ratio = contraste(couleur, fond);
        if (ratio < pire.ratio) pire = { sel: t.sel, ratio };
      }
      verifier(`${terrain.nom} : l'information flottante reste lisible sur le décor ` +
        `(le pire : ${pire.sel} à ${pire.ratio.toFixed(1)}:1 ≥ 4.5:1, ${cibles.length} éléments mesurés)`,
        pire.ratio >= 4.5 && cibles.length >= 5, `${pire.sel} ${pire.ratio.toFixed(2)}`);
      await page.close();
    }
  }

  /* ---------- 2 quater. LE REPLI : un thème DESSINÉ n'a pas de mats
     peints — la scène pleine se désactive et la mise en page revient au
     flux normal, tous les contrôles à l'écran. ---------- */
  {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try {
      localStorage.setItem("onze-tutoriel-vu", "1");
      localStorage.setItem("onze-reglages-match", JSON.stringify({ stade: "municipal" }));
    } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
    await page.evaluate(() => { arreterChrono(); afficher(); });
    await page.waitForTimeout(300);
    const repli = await page.evaluate(() => {
      const dans = (sel) => {
        const e = document.querySelector(sel);
        if (!e) return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= -1 && r.left >= -1 &&
          r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1;
      };
      return { scenePleine: document.getElementById("app").classList.contains("scene-pleine"),
        peint: document.getElementById("plateau").classList.contains("terrain-peint"),
        controles: ["#btn-match", "#btn-refresh", "#btn-xp", "#btn-verrou"].every(dans),
        jetons: document.querySelectorAll("#terrain-scene .jeton").length };
    });
    verifier("thème dessiné : la scène pleine se désactive et la mise en page revient au flux",
      !repli.scenePleine && !repli.peint && repli.controles && repli.jetons > 0, JSON.stringify(repli));
    await page.close();
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
       1,3 Mo en densité 1 · 1,55 Mo en forte densité.
     Relevé après l'arrivée des cinq de départ, dont les silhouettes
     s'affichent d'emblée sur le gazon (+199 Ko). Le poids DÉPEND du tirage
     de la boutique : mesuré sur six ouvertures, 1088-1216 Ko en densité 1
     et 1383-1486 en densité 2 — le plafond borne le pire tirage.
     Pire cas : ~520 Ko de socle (polices, scripts, CSS, roster, tables)
     + les 5 key arts les plus lourds de la boutique (372 Ko)
     + le décor (93 Ko en jeu/, 354 Ko en hd/)
     + une silhouette de titulaire (~100 Ko).
     Le reste des 8 Mo de visuels ne se charge QUE quand il s'affiche. */
  for (const [dpr, attendu, plafondKo] of [[1, "jeu/", 1300], [2, "hd/", 1550]]) {
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
