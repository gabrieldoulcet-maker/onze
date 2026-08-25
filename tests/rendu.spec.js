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
        (variance des pixels de sa dalle) et chaque joueur du
        terrain peint sa silhouette sur le gazon (la même zone,
        photographiée avec puis sans son visuel) ;
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
  await page.waitForTimeout(600);
  /* On attend que TOUTES les images soient décodées : depuis l'arrivée
     des 79 unités et de leurs ombres, une figurine pouvait encore être en
     vol au moment de la capture — la recette lisait alors du gazon et
     annonçait une silhouette manquante qui existait très bien. */
  await page.evaluate(() => Promise.all([...document.images]
    .filter((i) => i.src && !i.complete).map((i) => i.decode().catch(() => {}))));
  await page.waitForTimeout(250);
}

/* DEUX MESURES DE PIXELS, pour deux questions différentes.

   (a) la VARIANCE d'une zone : une dalle vide est plate, une carte de banc
       ne l'est pas. Elle suffit au banc, où le visuel remplit sa dalle.

   (b) l'EMPREINTE d'un visuel : on photographie la zone, on masque le seul
       visuel du joueur, on rephotographie la MÊME zone, et on compte les
       pixels qui ont changé. C'est la seule question honnête pour le
       terrain : « ce joueur peint-il quelque chose là où il est censé
       être ? ». La variance n'y répondait pas — une figurine du fond ne
       fait que 20 × 30 px et le gazon a son propre grain, si bien qu'une
       silhouette parfaitement visible (vérifiée à la loupe) était déclarée
       absente une fois sur trois. Comparer la zone à elle-même supprime
       d'un coup le grain du gazon, le décor, les voisines et la taille. */
async function varianceZone(page, clip) {
  if (clip.width < 4 || clip.height < 4) return 0;
  const png = (await page.screenshot({ clip, animations: "disabled" })).toString("base64");
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

/* Ce que peint UN visuel, mesuré sur toute la zone terrain : on
   photographie la zone, on masque le seul visuel du joueur n° `indice`, on
   rephotographie la MÊME zone, et on regarde les pixels qui ont changé —
   combien, et où.

   Pourquoi toute la zone plutôt que la boîte du joueur : cadrer sur sa
   boîte oblige à la lire avant la photo, et une figurine peut encore se
   déplacer de quelques pixels entre les deux (le plateau se redispose
   quand une image finit d'arriver). La mesure lisait alors un morceau de
   silhouette et annonçait un joueur absent qui était parfaitement là. En
   photographiant large, le décalage devient une INFORMATION — la position
   du nuage de pixels changés — au lieu d'être un piège. */
/* Les captures GÈLENT les animations : l'aura des joueurs légendaires
   pulse en boucle, et ses pixels changeaient entre les deux photos — la
   mesure comptait alors l'aura d'un autre joueur dans l'empreinte de
   celui-ci, ou la ratait. Deux photos d'une page figée, sinon on mesure
   le temps qui passe. */
const ECART_PIXEL = 24;          // un pixel « a changé » au-delà de cet écart
/* Seuil déclaré : une silhouette doit peindre au moins un huitième de sa
   propre boîte. Mesuré sur les cinq de départ, la plus discrète (une
   figurine du fond, 20 × 30 px) en couvre un bon tiers ; le contre-test
   plus bas vérifie qu'une silhouette absente tombe, elle, à zéro. */
const PART_MINIMALE = 0.125;
async function empreinteVisuel(page, indice, zone) {
  const masquer = (n, v) => page.evaluate(([k, etat]) => {
    const j = document.querySelectorAll(".ligne-terrain .jeton")[k];
    if (j) j.querySelectorAll("img.frontale, svg.frontale").forEach((e) => { e.style.visibility = etat; });
  }, [n, v]);
  const avec = (await page.screenshot({ clip: zone, animations: "disabled" })).toString("base64");
  await masquer(indice, "hidden");
  const sans = (await page.screenshot({ clip: zone, animations: "disabled" })).toString("base64");
  await masquer(indice, "");
  const r = await page.evaluate(async ([a, b, seuil]) => {
    const lire = async (b64) => {
      const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
      return { d: g.getImageData(0, 0, c.width, c.height).data, L: c.width };
    };
    const [x, y] = [await lire(a), await lire(b)];
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < x.d.length; i += 4) {
      const e = Math.max(Math.abs(x.d[i] - y.d[i]), Math.abs(x.d[i + 1] - y.d[i + 1]),
        Math.abs(x.d[i + 2] - y.d[i + 2]));
      if (e > seuil) { const p = i / 4; n++; sx += p % x.L; sy += Math.floor(p / x.L); }
    }
    return { pixels: n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
  }, [avec, sans, ECART_PIXEL]);
  return { pixels: r.pixels, centre: { x: zone.x + r.cx, y: zone.y + r.cy } };
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
       (b) chaque joueur du terrain PEINT vraiment sa silhouette là où sa
           case dit qu'il est — mesuré en masquant son visuel et en
           comparant la même zone avec et sans lui. */
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
      const v = j.querySelector("img.frontale, svg.frontale");
      const rv = v ? v.getBoundingClientRect() : null;
      /* On photographie la BOÎTE DU VISUEL, pas celle du jeton : depuis
         que les figurines sont des unités de trois quarts, la silhouette
         n'occupe qu'une partie de sa case, et mesurer la case revient à
         mesurer surtout du gazon — la variance chutait sans que rien ne
         soit cassé. */
      const r = rv || j.getBoundingClientRect();
      return { box: { x: r.x, y: r.y, width: r.width, height: r.height },
        charge: v ? (v.tagName === "IMG" ? v.naturalWidth > 0 : true) : false,
        visuel: rv ? { w: Math.round(rv.width), h: Math.round(rv.height) } : null };
    }));
    /* la zone photographiée : toutes les lignes de jeu d'un seul tenant */
    const zoneTerrain = await page.evaluate(() => {
      const l = [...document.querySelectorAll(".ligne-terrain")].map((e) => e.getBoundingClientRect());
      const x0 = Math.min(...l.map((r) => r.left)), x1 = Math.max(...l.map((r) => r.right));
      const y0 = Math.min(...l.map((r) => r.top)), y1 = Math.max(...l.map((r) => r.bottom));
      return { x: Math.max(0, Math.floor(x0)), y: Math.max(0, Math.floor(y0)),
        width: Math.ceil(x1 - x0), height: Math.ceil(y1 - y0) };
    });
    zoneTerrain.width = Math.min(zoneTerrain.width, taille.l - zoneTerrain.x);
    zoneTerrain.height = Math.min(zoneTerrain.height, taille.h - zoneTerrain.y);

    let terrainKO = 0;
    const parts = [], ecarts = [];
    for (const [k, j] of surLeGazon.entries()) {
      const aire = Math.max(1, Math.round(j.box.width) * Math.round(j.box.height));
      const emp = await empreinteVisuel(page, k, zoneTerrain);
      const part = emp.pixels / aire;
      // et ce qu'il peint tombe-t-il sur SA case ? (le défaut signalé :
      // un joueur qui n'est pas là où son emplacement dit qu'il est)
      const ecart = Math.hypot(emp.centre.x - (j.box.x + j.box.width / 2),
        emp.centre.y - (j.box.y + j.box.height / 2));
      parts.push(part); ecarts.push(ecart);
      const ok = j.charge && j.visuel && j.visuel.w >= 8 && j.visuel.h >= 12 &&
        part >= PART_MINIMALE && ecart <= Math.max(12, j.box.width * 0.5);
      if (!ok) { terrainKO++; console.log(`   ↳ joueur ${k} : chargé ${j.charge}, visuel ${JSON.stringify(j.visuel)}, empreinte ${(part * 100).toFixed(0)} % de sa boîte, centre à ${ecart.toFixed(1)} px de sa case`); }
    }
    const pire = parts.length ? Math.min(...parts) : 0;
    const pireEcart = ecarts.length ? Math.max(...ecarts) : 0;
    verifier(`${taille.nom} : les ${surLeGazon.length} joueurs du terrain peignent leur silhouette sur leur case ` +
      `(la plus discrète couvre ${(pire * 100).toFixed(0)} % de sa boîte — seuil ${(PART_MINIMALE * 100).toFixed(0)} % ; ` +
      `centre au plus à ${pireEcart.toFixed(1)} px de sa case)`,
      surLeGazon.length >= 4 && terrainKO === 0, `${terrainKO} joueur(s) sans silhouette visible`);

    /* LE CONTRE-TEST. Une recette qui ne sort pas rouge sur le défaut
       qu'elle prétend attraper n'est pas un garde-fou : on efface pour de
       bon la silhouette du premier joueur du terrain, et la mesure doit la
       déclarer absente. */
    await page.evaluate(() => {
      const v = document.querySelectorAll(".ligne-terrain .jeton")[0].querySelector("img.frontale, svg.frontale");
      if (v) v.remove();
    });
    const empSans = await empreinteVisuel(page, 0, zoneTerrain);
    const aireCobaye = Math.max(1, Math.round(surLeGazon[0].box.width) * Math.round(surLeGazon[0].box.height));
    const partSans = empSans.pixels / aireCobaye;
    verifier(`${taille.nom} : contre-test — silhouette retirée, la mesure la déclare absente ` +
      `(${(partSans * 100).toFixed(0)} % < ${(PART_MINIMALE * 100).toFixed(0)} %)`,
      partSans < PART_MINIMALE, `${(partSans * 100).toFixed(0)} %`);
    await page.evaluate(() => afficher());
    await page.waitForTimeout(150);

    /* AUCUNE FIGURINE SERVIE SUR TERRAIN PEINT NE PORTE `sans-portrait`
       (§9.1 du brief playtest). Le défaut le plus visible de l'écran de
       mise en place : une silhouette PLATE, SAUMON, SANS VISAGE debout au
       milieu de figurines peintes — c'est le repli `SILHOUETTE_NEUTRE`,
       teinté par le poste (`--teinte-pleine: #DE6350` pour un attaquant).

       Et c'est un cas d'école de la règle M4 : **le repli était
       parfaitement acceptable tant que personne n'avait de portrait.** Une
       silhouette neutre parmi des silhouettes neutres ne choque pas.
       L'arrivée des 79 figurines l'a transformée en image cassée sans que
       personne ne touche à son code — c'est le VOISINAGE qui a changé.
       Aucune recette ne pouvait l'attraper : elle vérifiait un chemin de
       rendu unique, et il l'est resté.

       Qui n'a pas de portrait : les six réservistes du centre (Gilbert,
       Norbert, Fernand, Marius, Lucien, Célestin), que `autoCompleter()`
       POUSSE SUR LE TERRAIN quand le banc est vide. */
    const RESERVISTES = ["Gilbert", "Norbert", "Fernand", "Marius", "Lucien", "Célestin"];
    const replis = await page.evaluate(async (noms) => {
      arreterChrono();
      document.querySelectorAll(".volet").forEach((v) => v.remove());
      partie.niveau = 9;
      partie.banc = [];
      // le cas réel : le banc est vide, les réservistes montent
      partie.terrain = noms.slice(0, 5).map((nom, i) => ({ nom, cout: 0,
        poste: ["GAR", "DÉF", "MIL", "ATT", "MIL"][i], ecole: "", archetype: "",
        unique: null, etoiles: 1, uid: "R" + i }));
      afficher();
      await Promise.all([...document.images].filter((i) => i.src && !i.complete)
        .map((i) => i.decode().catch(() => {})));
      await new Promise((r) => setTimeout(r, 300));
      const peint = document.querySelector(".plateau").classList.contains("terrain-peint");
      const tous = [...document.querySelectorAll(".ligne-terrain .jeton.figurine, #banc .jeton.figurine")];
      return { peint, total: tous.length,
        sansPortrait: tous.filter((j) => j.classList.contains("sans-portrait"))
          .map((j) => (j.getAttribute("aria-label") || "?").split(",")[0]) };
    }, RESERVISTES);
    verifier(`${taille.nom} : aucune figurine du terrain peint n'est un repli sans visuel ` +
      `(${replis.total} figurines, ${replis.sansPortrait.length} sans portrait)`,
      replis.peint && replis.total > 0 && replis.sansPortrait.length === 0,
      replis.sansPortrait.slice(0, 6).join(", "));

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

  /* ---- 4 bis · À ONZE TITULAIRES, LES SILHOUETTES RÉTRÉCISSENT ----
     L'échelle est un jeton de configuration (`ECHELLE`) et non des
     nombres en dur, précisément pour que l'effectif complet tienne : on
     vérifie ici que le budget de recouvrement déclaré est RESPECTÉ dans
     le rendu — deux joueurs d'une même ligne ne se mordent jamais plus
     que ce que la config autorise — et qu'aucune silhouette ne descend
     sous la borne de lisibilité. ---- */
  for (const [L, H] of [[844, 390], [667, 320]]) {
    const page = await (await browser.newContext({ viewport: { width: L, height: H } })).newPage();
    await ouvrirMercato(page);
    const plein = await page.evaluate(async () => {
      // effectif COMPLET : onze titulaires et neuf remplaçants
      partie.niveau = 10;
      const prendre = (i) => tousLesJoueurs[i % tousLesJoueurs.length];
      const lignes = ["GAR", "DÉF", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "ATT", "ATT", "ATT"];
      partie.terrain = lignes.map((ligne, i) => ({ ...prendre(i), ligne, etoiles: (i % 3) + 1, uid: "T" + i }));
      partie.banc = Array.from({ length: 9 }, (_, i) => ({ ...prendre(i + 20), etoiles: 1, uid: "B" + i }));
      afficher();
      await new Promise((r) => setTimeout(r, 320));
      const conf = ECHELLE;
      const parLigne = {};
      for (const ligne of ["GAR", "DÉF", "MIL", "ATT"]) {
        const jetons = [...document.querySelectorAll(`#ligne-${ligne} .jeton`)].map((j) => {
          const v = j.querySelector("img.frontale, svg.frontale");
          const r = (v || j).getBoundingClientRect();
          return { haut: r.top, bas: r.bottom, hauteur: r.height };
        }).sort((a, b) => a.haut - b.haut);
        // le pas réel entre deux joueurs de la ligne, et ce qu'ils mordent
        const morsures = [];
        for (let i = 1; i < jetons.length; i++) {
          const pas = jetons[i].bas - jetons[i - 1].bas;
          if (pas > 0) morsures.push(jetons[i - 1].hauteur / pas);
        }
        parLigne[ligne] = { n: jetons.length, pireMorsure: morsures.length ? Math.max(...morsures) : 0,
          plusPetite: jetons.length ? Math.min(...jetons.map((j) => j.hauteur)) : 0 };
      }
      return { conf: { recouvrement: conf.terrain.recouvrement, minLisible: conf.terrain.minLisible },
        titulaires: partie.terrain.length, parLigne };
    });
    const lignes = Object.entries(plein.parLigne).filter(([, v]) => v.n > 1);
    const budget = plein.conf.recouvrement * 1.08;   // 8 % de tolérance de rendu
    /* DEUX branches, et c'est un arbitrage assumé, pas une échappatoire :
       soit le budget de recouvrement est tenu, soit c'est la BORNE DE
       LISIBILITÉ qui commande — sur un petit écran avec un effectif
       complet, on préfère des silhouettes qui se serrent à des silhouettes
       illisibles. La recette exige alors que la plus petite soit
       effectivement AU PLANCHER : sans quoi le dépassement viendrait
       d'ailleurs, et ce serait un vrai défaut. */
    /* « Au plancher » se juge sur la hauteur RENDUE, qui porte encore le
       facteur de profondeur (0,86 à 1,14 selon la rangée) : une silhouette
       calée sur la borne de 26 px sort donc entre 22 et 30 px à l'écran.
       La marge de 1,15 est cette plage, pas une tolérance de confort. */
    const trop = lignes.filter(([, v]) =>
      v.pireMorsure > budget && v.plusPetite > plein.conf.minLisible * 1.15);
    const auPlancher = lignes.filter(([, v]) => v.pireMorsure > budget).map(([k]) => k);
    verifier(`${L}×${H} · onze titulaires : le recouvrement tient le budget déclaré (${plein.conf.recouvrement}) ou bute sur la borne de lisibilité ` +
      lignes.map(([k, v]) => `${k} ${v.n}→${v.pireMorsure.toFixed(2)}`).join(" · ") +
      (auPlancher.length ? ` · au plancher : ${auPlancher.join(", ")}` : ""),
      plein.titulaires === 11 && trop.length === 0, JSON.stringify(trop));
    const tropPetit = Object.entries(plein.parLigne).filter(([, v]) => v.n && v.plusPetite < plein.conf.minLisible * 0.8);
    verifier(`${L}×${H} · onze titulaires : aucune silhouette sous la borne de lisibilité (${plein.conf.minLisible} px)`,
      tropPetit.length === 0, JSON.stringify(tropPetit));
    await page.close();
  }

  /* ---- 4 ter · PRÊT POUR LES SILHOUETTES DE TROIS QUARTS ----
     Les nouvelles unités seront dessinées en vue de trois quarts élevée,
     avec leur ombre portée dans un FICHIER À PART. Deux promesses à tenir
     avant même que les images n'arrivent, et donc à vérifier ici :
       · le POINT D'APPUI déclaré dans la table se pose sur la ligne de
         sol — quel que soit l'ancrage, les pieds tombent au même endroit,
         donc changer les proportions d'un visuel ne déplace personne ;
       · l'ombre servie en fichier remplace l'ombre dessinée (jamais les
         deux) et grandit avec le niveau d'étoiles, comme la silhouette.
     On injecte une table de test : une vraie silhouette du dépôt, un
     ancrage volontairement décalé, et une ombre en image de test. ---- */
  {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await ouvrirMercato(page);
    const mesures = await page.evaluate(async () => {
      /* On prend une VRAIE paire du lot (unité + ombre cadrées ensemble) :
         c'est elle qu'il faut mesurer, une ombre bricolée d'un autre
         format ne dirait rien du partage de transformation. */
      const source = ONZE_PORTRAITS.frontale({ nom: "Sékou" });
      const OMBRE2 = ONZE_PORTRAITS.ombre({ nom: "Sékou" });
      // trois joueurs : ancrage par défaut, ancrage décalé, et 3★ avec ombre
      ONZE_PORTRAITS.definir({
        Aplomb: { carte: source, frontale: source },
        Trois_quarts: { carte: source, frontale: source, ombre: OMBRE2, ancrage: { x: 0.34, y: 0.78 } },
        Legende: { carte: source, frontale: source, ombre: OMBRE2, ancrage: { x: 0.5, y: 0.82 } },
      });
      const base = tousLesJoueurs[0];
      partie.banc = [
        { ...base, nom: "Aplomb", etoiles: 1, uid: "a1" },
        { ...base, nom: "Trois_quarts", etoiles: 1, uid: "a2" },
        { ...base, nom: "Legende", etoiles: 1, uid: "a3" },
        { ...base, nom: "Legende", etoiles: 3, uid: "a4" },
      ];
      afficher();
      await new Promise((r) => setTimeout(r, 400));
      const jetons = [...document.querySelectorAll("#banc .jeton.figurine")];
      return jetons.map((j) => {
        const st = getComputedStyle(j);
        const ax = parseFloat(st.getPropertyValue("--ancrage-x")) || 0.5;
        const ay = parseFloat(st.getPropertyValue("--ancrage-y")) || 1;
        const im = j.querySelector("img.frontale");
        const om = j.querySelector("img.ombre-sol");
        const rj = j.getBoundingClientRect();
        const ri = im ? im.getBoundingClientRect() : null;
        const ro = om ? om.getBoundingClientRect() : null;
        return {
          ancrage: { x: ax, y: ay },
          // LE POINT D'APPUI en pixels de page : c'est lui qui doit tenir la ligne
          appui: ri ? { x: ri.x + ax * ri.width, y: ri.bottom - (1 - ay) * ri.height } : null,
          jeton: { centre: rj.x + rj.width / 2, bas: rj.bottom },
          hauteurVisuel: ri ? ri.height : 0,
          ombre: ro ? { l: ro.width, y: ro.y + ro.height / 2, centre: ro.x + ro.width / 2 } : null,
          // la comparaison exacte des deux boîtes, au dixième de pixel
          memeBoite: !!(ri && ro) && ["x", "y", "width", "height"].every((k) => Math.abs(ri[k] - ro[k]) < 0.5),
          ecarts: ri && ro ? ["x", "y", "width", "height"].map((k) => Math.round((ro[k] - ri[k]) * 10) / 10) : null,
          // l'ombre DESSINÉE vit dans le ::before : on lit le pseudo-élément
          // lui-même, sinon on ne mesure rien (la première version lisait
          // le « content » de l'élément, qui ne veut rien dire ici)
          ombreDessinee: getComputedStyle(j, "::before").content !== "none",
          avecOmbre: j.classList.contains("avec-ombre"),
        };
      });
    });

    // 1. tous les points d'appui sur la MÊME ligne de sol, ancrages différents compris
    const lignes = mesures.map((m) => Math.round(m.appui.y * 10) / 10);
    const ecart = Math.max(...lignes) - Math.min(...lignes);
    verifier(`ancrage : les points d'appui tiennent la même ligne de sol quel que soit l'ancrage ` +
      `(${mesures.map((m) => m.ancrage.y).join(" / ")} → écart ${ecart.toFixed(1)} px)`,
      ecart <= 1, JSON.stringify(lignes));

    // 2. le point d'appui est CENTRÉ sur l'emplacement, ancrage horizontal compris
    const decentres = mesures.filter((m) => Math.abs(m.appui.x - m.jeton.centre) > 1);
    verifier("ancrage : le point d'appui est centré sur l'emplacement, même avec un ancrage décalé",
      decentres.length === 0, JSON.stringify(decentres.map((m) => [m.ancrage.x, Math.round(m.appui.x - m.jeton.centre)])));

    // 3. l'ombre de fichier remplace l'ombre dessinée, et suit les étoiles
    const avecOmbre = mesures.filter((m) => m.avecOmbre);
    const sansOmbre = mesures.filter((m) => !m.avecOmbre);
    verifier(`ombre en fichier : servie aux joueurs qui en ont une (${avecOmbre.length}), ` +
      `l'ombre dessinée reste aux autres (${sansOmbre.length})`,
      avecOmbre.length === 3 && sansOmbre.length === 1 && avecOmbre.every((m) => m.ombre && m.ombre.l > 4));
    /* LA RÈGLE QUI NE DOIT JAMAIS CÉDER : une seule ombre au sol par
       joueur. L'ombre dessinée est un REPLI — dès qu'un fichier existe
       elle disparaît, et elle reste pour ceux qui n'en ont pas. Deux
       ombres superposées feraient une tache, et personne ne le verrait
       venir en ajoutant des ombres ailleurs dans l'interface. */
    verifier("une seule ombre au sol par joueur : le fichier chasse l'ombre dessinée, jamais les deux",
      avecOmbre.every((m) => !m.ombreDessinee) && sansOmbre.every((m) => m.ombreDessinee),
      JSON.stringify(mesures.map((m) => [m.avecOmbre, m.ombreDessinee])));
    const un = avecOmbre.find((m) => m.ancrage.y === 0.82 && m.hauteurVisuel < 60);
    const trois = avecOmbre[avecOmbre.length - 1];
    const rapport = un && trois ? trois.hauteurVisuel / un.hauteurVisuel : 0;
    verifier(`ombre et unité grandissent ensemble avec les étoiles (1★ ${un ? Math.round(un.hauteurVisuel) : "?"} px → ` +
      `3★ ${trois ? Math.round(trois.hauteurVisuel) : "?"} px, rapport ${rapport.toFixed(2)} ≈ 1,38)`,
      Math.abs(rapport - 1.38) < 0.06, String(rapport));
    /* 4. L'OMBRE ET L'UNITÉ PARTAGENT LA MÊME TRANSFORMATION.
       Les deux images sont cadrées ensemble (600 × 900) : l'ombre est
       déjà dessinée à sa place dedans. Elle ne doit donc recevoir NI
       taille propre, NI translation propre — même boîte, même pivot,
       même échelle que l'unité. Si elles divergent à l'écran, c'est le
       code qui décale, pas les images. */
    const divergentes = avecOmbre.filter((m) => !m.memeBoite);
    verifier("ombre et unité : même boîte, même pivot, même échelle (aucune transformation propre)",
      divergentes.length === 0, JSON.stringify(divergentes.map((m) => m.ecarts)));
    /* La sélection doit rester visible AU SOL même quand l'ombre dessinée
       a disparu : sans ça, un joueur à ombre de fichier n'aurait plus
       aucun retour visuel quand on le choisit. */
    const selection = await page.evaluate(async () => {
      const jetons = [...document.querySelectorAll("#banc .jeton.figurine")];
      const avec = jetons.find((j) => j.classList.contains("avec-ombre"));
      const sans = jetons.find((j) => !j.classList.contains("avec-ombre"));
      const lire = (j) => {
        j.classList.add("choisi");
        const st = getComputedStyle(j.querySelector("img.ombre-sol") || j);
        const pseudo = getComputedStyle(j, "::before");
        // le repère au sol est vert, qu'il passe par le fond du pseudo,
        // sa lueur, ou le filtre de l'ombre-fichier
        const vert = /61, ?226, ?107/;
        const marque = (st.filter && st.filter !== "none") ||
          vert.test(pseudo.backgroundImage || "") || vert.test(pseudo.boxShadow || "");
        j.classList.remove("choisi");
        return marque;
      };
      return { avecOmbre: lire(avec), sansOmbre: lire(sans) };
    });
    verifier("sélection : le repère reste AU SOL, ombre de fichier comprise",
      selection.avecOmbre && selection.sansOmbre, JSON.stringify(selection));
    verifier("silhouettes de trois quarts : zéro erreur JS", erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  /* ---- 5 · LE SEUL ÉTAT OÙ UN TAP N'ACHÈTE PAS : une modale ouverte.
     C'est le piège de méthode qui a fait croire à un achat cassé — la
     recette d'achat écartait le tutoriel de première partie, donc elle ne
     voyait jamais ce que voit un joueur neuf. On vérifie les deux temps :
     la modale mange le tap (c'est son rôle), et le tap SUIVANT, une fois
     la modale refermée, achète.
     On ouvre la modale SOI-MÊME (le calepin) au lieu d'attendre celle du
     tutoriel : celle-ci peut être balayée par un autre événement de
     première manche, et une recette qui dépend d'une course ne prouve
     rien — la première version de ce contrôle passait par chance. ---- */
  {
    const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
    await ouvrirMercato(page);
    await page.evaluate(() => { partie.or = 60; partie.banc = []; afficher(); });
    await page.waitForTimeout(250);
    await page.click("#btn-calepin");
    await page.waitForTimeout(350);
    const ouverte = await page.evaluate(() => {
      const c = document.querySelector(".carte-boutique[data-boutique]");
      const r = c.getBoundingClientRect();
      const dessus = document.elementFromPoint(r.x + r.width / 2, r.y + r.height * 0.35);
      return { volet: !!document.querySelector(".volet"), couvre: !!(dessus && dessus.closest(".volet")), or: partie.or };
    });
    const box = await (await page.$(".carte-boutique[data-boutique]")).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.35);
    await page.waitForTimeout(400);
    const pendant = await page.evaluate(() => partie.or);
    verifier(`modale ouverte : le tap ne la traverse pas (or ${ouverte.or} → ${pendant})`,
      ouverte.volet && ouverte.couvre && pendant === ouverte.or, JSON.stringify({ ...ouverte, pendant }));

    await page.evaluate(() => document.querySelectorAll(".volet").forEach((v) => v.remove()));
    await page.evaluate(() => { partie.or = 60; partie.banc = []; afficher(); });
    await page.waitForTimeout(300);
    const box2 = await (await page.$(".carte-boutique[data-boutique]")).boundingBox();
    await page.mouse.click(box2.x + box2.width / 2, box2.y + box2.height * 0.35);
    await page.waitForTimeout(500);
    const apres = await page.evaluate(() => ({ or: partie.or, banc: partie.banc.length }));
    verifier(`modale refermée : le tap suivant achète (or 60 → ${apres.or}, banc ${apres.banc})`,
      apres.or < 60 && apres.banc === 1);
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nRendu du mercato ✅");
  process.exit(echecs ? 1 : 0);
})();
