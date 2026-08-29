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

      /* (AMENDÉ PAR LA REFONTE, décision 74.) Ici vivaient deux contrats
         de l'ère des mats peints : « les 9 emplacements tombent dans les
         rectangles peints » et « chaque remplaçant est POSÉ sur son
         mat » — lus au pixel dans le décor. Le banc est désormais une
         BANDE à lui (neuf places égales entre le terrain et la
         boutique) : le décor peut peindre ce qu'il veut dessous, la
         bande l'assume. Les contrats deviennent :
           · la bande est OPAQUE (panneau ≥ 88 %) — pas de double monde
             entre les mats peints et les places réelles ;
           · chaque place et chaque joueur vivent DANS la bande ;
           · un joueur du club n'est JAMAIS invisible (contrat conservé
             tel quel — il ne dépendait pas des mats). */
      const bande = await page.evaluate(() => {
        const b = document.getElementById("banc");
        const rb = b.getBoundingClientRect();
        const st = getComputedStyle(b);
        const m = (st.backgroundColor || "").match(/rgba?\(([^)]+)\)/);
        const parts = m ? m[1].split(",").map(parseFloat) : [];
        const alpha = parts.length > 3 ? parts[3] : (m ? 1 : 0);
        const dehors = [...b.children].filter((c) => {
          const r = c.getBoundingClientRect();
          return r.width > 0 && (r.top < rb.top - 1 || r.bottom > rb.bottom + 1 ||
            r.left < rb.left - 1 || r.right > rb.right + 1);
        }).length;
        return { alpha, dehors, places: b.children.length };
      });
      verifier(`${terrain.nom} · ${taille.nom} : la bande du banc est opaque (${bande.alpha}) et ses ` +
        `${bande.places} places vivent dedans (${bande.dehors} dehors)`,
        bande.alpha >= 0.88 && bande.dehors === 0 && bande.places === 9, JSON.stringify(bande));

      for (const [etiquette, nb] of [["banc plein", 9], ["un seul remplaçant", 1]]) {
        const pose = await page.evaluate(async (nbJoueurs) => {
          const prendre = (i) => tousLesJoueurs[i % tousLesJoueurs.length];
          partie.banc = Array.from({ length: nbJoueurs }, (_, i) => ({ ...prendre(i), etoiles: (i % 3) + 1, uid: "t" + i }));
          if (nbJoueurs > 1) {   // un joueur sans dessin : il se rend en glyphe de poste
            partie.banc[nbJoueurs - 1] = { nom: "Gilbert", cout: 0, poste: "DÉF", ligne: "DÉF",
              ecole: "", archetype: "", etoiles: 1, uid: "tx" };
          }
          afficher();
          await new Promise((r) => setTimeout(r, 260));
          const rb = document.getElementById("banc").getBoundingClientRect();
          const hors = [], invisibles = [];
          [...document.getElementById("banc").children].forEach((c, n) => {
            if (!c.classList.contains("jeton")) return;         // une place vide
            if (getComputedStyle(c).display === "none" || getComputedStyle(c).visibility === "hidden") {
              invisibles.push(n); return;                        // un joueur du club JAMAIS invisible
            }
            const visuel = c.querySelector(".dessin-carte");
            const r = c.getBoundingClientRect();
            const dedans = r.top >= rb.top - 1 && r.bottom <= rb.bottom + 1 &&
              r.left >= rb.left - 1 && r.right <= rb.right + 1;
            if (!visuel || !dedans) hors.push({ n, quoi: visuel ? "hors bande" : "sans visuel" });
          });
          return { joueurs: partie.banc.length, hors, invisibles };
        }, nb);
        verifier(`${terrain.nom} · ${taille.nom} · ${etiquette} : chaque remplaçant vit dans la bande, ` +
          `visible et avec son visuel (${pose.joueurs} joueur(s))`,
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
        /* Refonte 28/08 (décision 74) : il reste PEU d'information posée
           sur le décor — c'était le but. On mesure ce qui y vit encore. */
        const sels = [".bloc-club", ".phase-centre", ".manche-haut", ".fiche-adversaire strong",
          "#compteur-titulaires", "#btn-match"];
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
        pire.ratio >= 4.5 && cibles.length >= 4, `${pire.sel} ${pire.ratio.toFixed(2)}`);
      await page.close();
    }
  }

  /* ---------- 2 quinquies. (AMENDÉ PAR LA REFONTE, décision 74) ----------
     L'ancienne version lisait au pixel les DALLES de poste peintes sous
     les remplaçants — parties avec les mats. Le poste vit désormais sur
     le CADRE de la carte, qui ne composite pas avec le décor : les deux
     contrats se mesurent sur les couleurs rendues des cadres, une fois.
       · les quatre postes restent distincts ENTRE EUX (ΔE ≥ 15) ;
       · chaque cadre se détache de la bande du banc (contraste ≥ 1,8:1 —
         le cadre a AUSSI un halo de sa couleur, la bordure n'est pas
         seule à porter la distinction). */
  {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
    const releve = await page.evaluate(async () => {
      arreterChrono();
      const parPoste = {};
      for (const j2 of tousLesJoueurs) if (!parPoste[j2.poste]) parPoste[j2.poste] = j2;
      partie.banc = ["GAR", "DÉF", "MIL", "ATT"].map((p2, i) => ({ ...parPoste[p2], uid: "d" + i }));
      afficher();
      await new Promise((r) => setTimeout(r, 250));
      const fond = getComputedStyle(document.getElementById("banc")).backgroundColor;
      const cartes = [...document.querySelectorAll("#banc .jeton.carte-jeton")].map((c) => ({
        poste: ([...c.classList].find((k) => k.startsWith("p-")) || "").slice(2),
        bord: getComputedStyle(c).borderTopColor }));
      return { fond, cartes };
    });
    const rgb = (c) => (String(c).match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number);
    const canal2 = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum2 = ([r, g, b]) => 0.2126 * canal2(r) + 0.7152 * canal2(g) + 0.0722 * canal2(b);
    const contraste2 = (a, b) => { const [x, y] = [lum2(a), lum2(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const versLab = ([r, g, b]) => {
      const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const [R, G, B] = [f(r), f(g), f(b)];
      const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
      const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
      const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
      const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
      return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
    };
    const deltaE = (a, b) => { const [l1, a1, b1] = versLab(a), [l2, a2, b2] = versLab(b);
      return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2); };
    const paires = [];
    for (let a = 0; a < releve.cartes.length; a++)
      for (let b = a + 1; b < releve.cartes.length; b++)
        paires.push({ paire: `${releve.cartes[a].poste}/${releve.cartes[b].poste}`,
          dE: deltaE(rgb(releve.cartes[a].bord), rgb(releve.cartes[b].bord)) });
    const tropProches = paires.filter((x) => x.dE < 15);
    verifier(`refonte : les cadres des quatre postes restent distincts entre eux ` +
      `(ΔE ${Math.round(Math.min(...paires.map((x) => x.dE)))} à ${Math.round(Math.max(...paires.map((x) => x.dE)))} — seuil 15)`,
      paires.length === 6 && tropProches.length === 0,
      JSON.stringify(tropProches.map((x) => [x.paire, Math.round(x.dE)])));
    const fondRgb = rgb(releve.fond);
    const faibles = releve.cartes.map((c) => ({ poste: c.poste, ratio: contraste2(rgb(c.bord), fondRgb) }))
      .filter((c) => c.ratio < 1.8);
    verifier(`refonte : le cadre de chaque poste se détache de la bande du banc ` +
      `(${releve.cartes.map((c) => `${c.poste} ${contraste2(rgb(c.bord), fondRgb).toFixed(1)}:1`).join(" · ")} — seuil 1,8:1)`,
      releve.cartes.length === 4 && faibles.length === 0, JSON.stringify(faibles));
    await page.close();
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
       1,5 Mo en densité 1 · 1,7 Mo en forte densité.
     Relevé après l'arrivée des 79 figurines de trois quarts : chaque
     titulaire pèse maintenant son unité (60 Ko) ET son ombre (11 Ko), là
     où une silhouette frontale coûtait ~50 Ko. Le poids DÉPEND du tirage
     de la boutique : mesuré sur six ouvertures, 1276-1412 Ko en densité 1
     et 1407-1532 en densité 2 — le plafond borne le pire tirage.
     Le reste des 8 Mo de visuels ne se charge QUE quand il s'affiche.

     CE QUI A CHANGÉ (décision 69) : l'assertion comparait le tirage DU
     JOUR au plafond du pire tirage — verte ou rouge selon la boutique du
     moment (1502 Ko un jour, 1460 le lendemain, même code). On calcule
     désormais le PIRE tirage comme dans da.spec.js : socle (total moins
     les key arts des cartes réellement tirées, dédoublonnées, chemins
     décodés) + les 5 key arts les plus lourds du roster (requêtes HEAD).

     En densité 1, le verdict de poids appartient à da.spec.js — qui
     porte la dette déclarée (1 580 Ko > 1 500, cause : match-scene.js
     différable). Le répéter ici compterait la même dette deux fois et
     brouillerait la ligne entre dette connue et régression : cette
     recette garde son vrai sujet, LE BON DOSSIER DE DÉCOR par densité,
     et imprime le poids en information. En densité 2, le plafond 1700
     n'existe qu'ici : il reste un verdict, sur le pire tirage. */
  for (const [dpr, attendu, plafondKo] of [[1, "jeu/", null], [2, "hd/", 1700]]) {
    const page = await (await browser.newContext({
      viewport: { width: 844, height: 390 }, deviceScaleFactor: dpr })).newPage();
    let octets = 0; const decors = []; const parChemin = new Map();
    page.on("response", (r) => {
      if (/da\/terrains\//.test(r.url())) decors.push(decodeURIComponent(r.url()).split("/da/terrains/")[1]);
      try {
        const t = r.headers()["content-type"] || "";
        if (!/image|font|javascript|css|json|html/.test(t)) return;
        const l = Number(r.headers()["content-length"] || 0);
        if (!l) return;
        octets += l;
        parChemin.set(decodeURIComponent(new URL(r.url()).pathname).replace(/^\//, ""), l);
      } catch (e) { /* url illisible : ignorée */ }
    });
    await page.addInitScript(() => { try {
      localStorage.setItem("onze-tutoriel-vu", "1");
      localStorage.setItem("onze-reglages-match", JSON.stringify({ stade: "emeraude" }));
    } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
    await page.evaluate(() => arreterChrono());
    await page.waitForTimeout(1800);
    verifier(`densité ${dpr}× : le décor servi est ${attendu}`,
      decors.length > 0 && decors.every((f) => f.startsWith(attendu)), decors.join(", "));
    // le pire tirage, calculé — jamais le tirage du jour (décision 69).
    // Le poids du jour se fige ICI : les requêtes HEAD ci-dessous passent
    // par le même écouteur et gonfleraient le chiffre imprimé (5,6 Mo
    // affichés pour 1,5 réellement chargés, vu au premier passage).
    const koJour = Math.round(octets / 1024);
    const tire = [...new Set(await page.evaluate(() =>
      partie.boutique.map((f) => f && ONZE_PORTRAITS.carte(f)).filter(Boolean)))];
    const socle = octets - tire.reduce((t, c) => t + (parChemin.get(c.replace(/^\//, "")) || 0), 0);
    const cheminsRoster = await page.evaluate(() =>
      [...new Set(tousLesJoueurs.map((j) => ONZE_PORTRAITS.carte(j)).filter(Boolean))]);
    const poidsRoster = [];
    for (const c of cheminsRoster)
      poidsRoster.push(await page.evaluate((u) =>
        fetch(u, { method: "HEAD" }).then((x) => Number(x.headers.get("content-length") || 0)).catch(() => 0), c));
    poidsRoster.sort((a, b) => b - a);
    const koPire = Math.round((socle + poidsRoster.slice(0, 5).reduce((t, v) => t + v, 0)) / 1024);
    if (plafondKo === null) {
      // densité 1 : le verdict vit dans da.spec.js (dette déclarée) — ici, l'information seulement
      console.log(`   ℹ️ densité ${dpr}× : pire tirage ${koPire} Ko — verdict porté par da.spec.js`);
    } else {
      verifier(`densité ${dpr}× : l'ouverture au PIRE tirage pèse ${koPire} Ko ≤ ${plafondKo} Ko ` +
        `(socle ${Math.round(socle / 1024)} Ko ; tirage du jour ${koJour} Ko)`,
        koPire <= plafondKo, `${koPire} Ko`);
    }
    await page.close();
  }

  verifier(`zéro erreur JS (${erreursJS.length})`, erreursJS.length === 0, erreursJS.slice(0, 3).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nTerrains d'entraînement ✅");
  process.exit(echecs ? 1 : 0);
})();
