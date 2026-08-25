/* ============================================================
   ONZE — RECETTE DE RENDU DU MERCATO.
   ------------------------------------------------------------
   Les autres recettes vérifient des ÉTATS DU DOM ; celle-ci
   vérifie CE QUE LE JOUEUR VOIT. Elle est née de trois défauts
   qu'aucune recette n'avait attrapés : des noms et des pastilles
   restés sur le terrain, des rectangles sombres posés sur le
   gazon à la place des silhouettes, et un banc qu'on croyait
   peuplé. Ses assertions sont donc géométriques et pixellaires :
     1. aucun texte ni pastille visible dans la zone terrain ;
     2. chaque joueur du banc porte une image RÉELLEMENT visible
        (on mesure la variance des pixels de sa dalle) ;
     3. aucun élément opaque de plus de 100 px ne recouvre le
        gazon en dehors des silhouettes ;
     4. l'achat se déclenche par un CLIC À DES COORDONNÉES au
        centre de l'illustration — jamais par l'appel d'un
        gestionnaire ni par un clic sur un sélecteur.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/rendu.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "pire cas", l: 667, h: 320 }];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

/* Le mercato, prêt à photographier : tutoriel écarté, chrono arrêté, un
   banc peuplé de joueurs ILLUSTRÉS et de joueurs SANS illustration (les
   deux chemins de rendu doivent donner le même résultat à l'écran). */
async function ouvrirMercato(page) {
  await page.goto("http://localhost:8123/partie.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".carte-boutique", { timeout: 10000 });
  const tuto = await page.$('.volet [data-tuto="non"]');
  if (tuto) await tuto.click();
  await page.evaluate(() => {
    arreterChrono();
    const prendre = (nom, etoiles) => {
      const base = tousLesJoueurs.find((j) => j.nom === nom);
      return base ? { ...base, etoiles } : null;
    };
    partie.banc = [prendre("Sékou", 1), prendre("Brahim", 2), prendre("Denilson", 3),
      // un joueur SANS illustration : il doit se voir autant que les autres
      { nom: "Gilbert", cout: 0, poste: "DÉF", ligne: "DÉF", ecole: "", archetype: "", etoiles: 1 }].filter(Boolean);
    if (typeof attribuerUids === "function") attribuerUids();
    afficher();
  });
  await page.waitForTimeout(900);
}

// la variance des pixels d'une zone : une dalle vide est plate, une
// silhouette ne l'est pas. On mesure DANS la page, sur la capture.
async function varianceZone(page, clip) {
  if (clip.width < 4 || clip.height < 4) return 0;
  const png = (await page.screenshot({ clip })).toString("base64");
  return page.evaluate(async (b64) => {
    const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
    const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let somme = 0, sommeCarres = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      somme += v; sommeCarres += v * v; n++;
    }
    return Math.sqrt(sommeCarres / n - (somme / n) ** 2);   // écart-type
  }, png);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await ouvrirMercato(page);

    /* ---- 1 · AUCUN TEXTE NI PASTILLE DANS LA ZONE TERRAIN ----
       Le « + » des emplacements vides est le seul caractère toléré : c'est
       le marqueur de la case libre, et le brief le garde explicitement. */
    const terrain = await page.evaluate(() => {
      // les LIGNES de jeu : c'est là que vivent les joueurs. Le compteur
      // « Titulaires 5/5 » et le tableau de match sont du chrome flottant,
      // pas de l'habillage de joueur : ils ne sont pas dans ce périmètre.
      const lignes = [...document.querySelectorAll(".ligne-terrain")];
      const restes = [];
      for (const ligne of lignes) {
        const marche = document.createTreeWalker(ligne, NodeFilter.SHOW_TEXT);
        for (let n = marche.nextNode(); n; n = marche.nextNode()) {
          const texte = (n.nodeValue || "").trim();
          if (!texte || texte === "+") continue;   // le « + » de la case vide reste
          const par = n.parentElement;
          const r = par.getBoundingClientRect();
          if (r.width < 1 || r.height < 1 || getComputedStyle(par).visibility === "hidden") continue;
          restes.push(texte.slice(0, 20));
        }
      }
      const compte = (sel) => lignes.reduce((n, l) => n + l.querySelectorAll(sel).length, 0);
      const pastilles = compte(".pastille, .pastille-poste, .nom-jeton, .note-jeton, .etoiles, .glyphes-famille");
      return { restes, pastilles, jetons: compte(".jeton"), figurines: compte(".jeton.figurine") };
    });
    verifier(`${taille.nom} : aucun nom ni pastille sur le terrain (${terrain.figurines}/${terrain.jetons} jetons en silhouette)`,
      terrain.restes.length === 0 && terrain.pastilles === 0 && terrain.jetons === terrain.figurines,
      `textes ${JSON.stringify(terrain.restes)} · pastilles ${terrain.pastilles}`);

    /* ---- 2 · CHAQUE JOUEUR DU BANC PORTE UNE IMAGE VISIBLE ----
       Pas « un <img> existe dans le DOM » : une image qui occupe vraiment
       des pixels, et une dalle dont le contenu n'est pas plat. */
    const bancInfos = await page.evaluate(() => {
      const banc = document.getElementById("banc");
      return [...banc.children].filter((c) => c.classList.contains("jeton")).map((c) => {
        const r = c.getBoundingClientRect();
        const visuel = c.querySelector("img.frontale, svg.frontale");
        const rv = visuel ? visuel.getBoundingClientRect() : null;
        return {
          box: { x: r.x, y: r.y, width: r.width, height: r.height },
          type: visuel ? visuel.tagName.toLowerCase() : null,
          charge: visuel && visuel.tagName === "IMG" ? visuel.naturalWidth > 0 : !!visuel,
          visuelBox: rv ? { w: Math.round(rv.width), h: Math.round(rv.height) } : null,
        };
      });
    });
    let bancKO = 0;
    for (const [i, j] of bancInfos.entries()) {
      // la zone photographiée : la dalle ET ce qui la dépasse vers le haut
      const clip = { x: Math.max(0, Math.round(j.box.x) - 6), y: Math.max(0, Math.round(j.box.y) - Math.round(j.box.height)),
        width: Math.min(Math.round(j.box.width) + 12, taille.l - Math.round(j.box.x)),
        height: Math.min(Math.round(j.box.height) * 2, taille.h - Math.max(0, Math.round(j.box.y) - Math.round(j.box.height))) };
      const ecartType = await varianceZone(page, clip);
      const ok = j.charge && j.visuelBox && j.visuelBox.w >= 8 && j.visuelBox.h >= 12 && ecartType >= 12;
      if (!ok) { bancKO++; console.log(`   ↳ place ${i} : type ${j.type}, chargé ${j.charge}, visuel ${JSON.stringify(j.visuelBox)}, écart-type ${ecartType.toFixed(1)}`); }
    }
    verifier(`${taille.nom} : les ${bancInfos.length} joueurs du banc portent une image visible (pixels mesurés)`,
      bancInfos.length >= 4 && bancKO === 0, `${bancKO} place(s) sans image visible`);

    /* ---- 3 · RIEN D'OPAQUE NE RECOUVRE LE GAZON ----
       L'assertion qui aurait attrapé les rectangles sombres. Deux mesures,
       parce qu'une seule se laisse contourner :
       (a) aucun jeton du terrain ne PEINT quoi que ce soit — ni fond de
           couleur, ni DÉGRADÉ (c'est un dégradé qui faisait le rectangle
           sombre, et c'est pour ça qu'une lecture de la seule couleur de
           fond passait à côté), ni bordure, ni ombre portée ;
       (b) chaque joueur du terrain occupe vraiment des pixels variés — une
           silhouette n'est jamais un aplat. */
    const peintures = await page.evaluate(() => {
      const alpha = (couleur) => {
        const m = couleur.match(/rgba?\(([^)]+)\)/);
        if (!m) return 0;
        const p = m[1].split(",").map((v) => parseFloat(v));
        return p.length > 3 ? p[3] : 1;
      };
      return [...document.querySelectorAll(".ligne-terrain .jeton")].map((j) => {
        const st = getComputedStyle(j);
        return { cls: (j.className || "").toString().slice(0, 44),
          fond: alpha(st.backgroundColor) >= 0.5, degrade: st.backgroundImage !== "none",
          bordure: st.borderTopWidth !== "0px" && alpha(st.borderTopColor) >= 0.3,
          ombre: st.boxShadow !== "none" };
      }).filter((j) => j.fond || j.degrade || j.bordure || j.ombre);
    });
    verifier(`${taille.nom} : aucun jeton du terrain ne peint de fond, de dégradé, de bordure ni d'ombre`,
      peintures.length === 0, JSON.stringify(peintures).slice(0, 260));

    const surLeGazon = await page.evaluate(() => [...document.querySelectorAll(".ligne-terrain .jeton")].map((j) => {
      const r = j.getBoundingClientRect();
      const v = j.querySelector("img.frontale, svg.frontale");
      const rv = v ? v.getBoundingClientRect() : null;
      return { box: { x: r.x, y: r.y, width: r.width, height: r.height },
        charge: v ? (v.tagName === "IMG" ? v.naturalWidth > 0 : true) : false,
        visuel: rv ? { w: Math.round(rv.width), h: Math.round(rv.height) } : null };
    }));
    let terrainKO = 0;
    for (const [i, j] of surLeGazon.entries()) {
      const clip = { x: Math.max(0, Math.round(j.box.x)), y: Math.max(0, Math.round(j.box.y)),
        width: Math.min(Math.round(j.box.width), taille.l - Math.round(j.box.x)),
        height: Math.min(Math.round(j.box.height), taille.h - Math.round(j.box.y)) };
      const ecartType = await varianceZone(page, clip);
      const ok = j.charge && j.visuel && j.visuel.w >= 8 && j.visuel.h >= 12 && ecartType >= 12;
      if (!ok) { terrainKO++; console.log(`   ↳ joueur ${i} : chargé ${j.charge}, visuel ${JSON.stringify(j.visuel)}, écart-type ${ecartType.toFixed(1)}`); }
    }
    verifier(`${taille.nom} : les ${surLeGazon.length} joueurs du terrain sont des silhouettes visibles (pixels mesurés)`,
      surLeGazon.length >= 4 && terrainKO === 0, `${terrainKO} joueur(s) sans silhouette visible`);

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  /* ---- 4 · L'ACHAT SE DÉCLENCHE À DES COORDONNÉES ----
     On ne clique pas « sur un sélecteur » et on n'appelle aucun
     gestionnaire : on pose la souris au centre de l'ILLUSTRATION, puis
     dans un coin, puis sur la barre du nom. Les trois doivent acheter. */
  {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await ouvrirMercato(page);
    await page.evaluate(() => { partie.or = 60; partie.banc = []; afficher(); });
    await page.waitForTimeout(300);

    // rien ne doit intercepter le tap : un volet ouvert mangerait le clic
    const volet = await page.evaluate(() => {
      const c = document.querySelector(".carte-boutique[data-boutique]");
      const r = c.getBoundingClientRect();
      const dessus = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return dessus && dessus.closest(".volet") ? dessus.closest(".volet").className : null;
    });
    verifier("le tap arrive bien jusqu'à la carte (aucun volet par-dessus la boutique)", !volet, String(volet));

    const points = [
      { nom: "au centre de l'illustration", fx: 0.5, fy: 0.35 },
      { nom: "dans le coin haut-gauche", fx: 0.08, fy: 0.10 },
      { nom: "sur la barre du nom", fx: 0.5, fy: 0.92 },
    ];
    for (const pt of points) {
      const avant = await page.evaluate(() => ({ or: partie.or, banc: partie.banc.length }));
      const box = await (await page.$(".carte-boutique[data-boutique]")).boundingBox();
      await page.mouse.move(box.x + box.width * pt.fx, box.y + box.height * pt.fy);
      await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
      await page.waitForTimeout(500);
      const apres = await page.evaluate(() => ({ or: partie.or, banc: partie.banc.length }));
      verifier(`achat par clic ${pt.nom} (or ${avant.or} → ${apres.or}, banc ${avant.banc} → ${apres.banc})`,
        apres.or < avant.or && apres.banc === avant.banc + 1);
    }

    /* l'appui LONG inspecte, il n'achète pas */
    const avant = await page.evaluate(() => ({ or: partie.or, banc: partie.banc.length }));
    const box = await (await page.$(".carte-boutique[data-boutique]")).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35);
    await page.mouse.down(); await page.waitForTimeout(600); await page.mouse.up();
    await page.waitForTimeout(400);
    const apres = await page.evaluate(() => ({ or: partie.or, banc: partie.banc.length,
      fiche: !!document.querySelector(".voile-fiche, .fiche-joueur") }));
    verifier(`appui long : la fiche s'ouvre et rien n'est acheté (or ${avant.or} → ${apres.or})`,
      apres.or === avant.or && apres.banc === avant.banc);

    verifier("achat : zéro erreur JS", erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  /* ---- 5 · LE SEUL ÉTAT OÙ UN TAP N'ACHÈTE PAS : une modale ouverte.
     C'est le piège de méthode qui a fait croire à un achat cassé — la
     recette d'achat écartait le tutoriel de première partie, donc elle ne
     voyait jamais ce que voit un joueur neuf. On vérifie ici les deux
     temps : la modale mange le tap (c'est son rôle), et le tap SUIVANT,
     une fois la modale refermée, achète. ---- */
  {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    await page.goto("http://localhost:8123/partie.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector(".carte-boutique", { timeout: 10000 });
    const modale = await page.$(".volet");
    if (!modale) {
      verifier("joueur neuf : le tutoriel s'affiche au premier lancement", false, "aucune modale");
    } else {
      await page.evaluate(() => { arreterChrono(); partie.or = 60; afficher(); });
      const avant = await page.evaluate(() => partie.or);
      const box = await (await page.$(".carte-boutique[data-boutique]")).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
      await page.waitForTimeout(400);
      const pendant = await page.evaluate(() => partie.or);
      verifier(`tutoriel ouvert : le tap ne traverse pas la modale (or ${avant} → ${pendant})`, pendant === avant);
      const bouton = await page.$('.volet [data-tuto="non"]');
      if (bouton) await bouton.click();
      await page.waitForTimeout(300);
      await page.evaluate(() => { partie.or = 60; partie.banc = []; afficher(); });
      await page.waitForTimeout(300);
      const box2 = await (await page.$(".carte-boutique[data-boutique]")).boundingBox();
      await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height * 0.35);
      await page.waitForTimeout(500);
      const apres = await page.evaluate(() => ({ or: partie.or, banc: partie.banc.length }));
      verifier(`tutoriel refermé : le tap suivant achète (or 60 → ${apres.or}, banc ${apres.banc})`,
        apres.or < 60 && apres.banc === 1);
    }
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nRendu du mercato ✅");
  process.exit(echecs ? 1 : 0);
})();
