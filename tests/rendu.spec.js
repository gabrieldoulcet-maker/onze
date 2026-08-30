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
const MESURE = require("./outils-mesure.js");
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
  /* Partie fraîche SANS tutoriel : effacer tout le stockage faisait
     resurgir la proposition de tuto, et ses bulles apparaissaient en
     PLEINE mesure différentielle (« 947 px d'écart entre deux mesures
     identiques », une fois sur trois selon la vitesse de la machine). */
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("onze-tutoriel-vu", "1"); });
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
/* LA PRÉCONDITION D'INERTIE, écrite une fois dans tests/outils-mesure.js.
   Trois fois une mesure différentielle a été faussée par quelque chose
   qui bougeait — l'aura des légendaires, puis une annonce qui traverse le
   cadre (135 % relevé là où la valeur vraie est 0, une fois sur trois).
   On ne peut pas énumérer ce qui bouge : avant CHAQUE mesure, on
   photographie deux fois la même zone sans rien changer et on exige une
   différence de zéro. Ce qui suit ne s'exécute que sur une page inerte,
   et un écart est NOMMÉ en pixels au lieu de contaminer un chiffre. */
let bruitsDeFond = [];
/* Faire taire les annonces reste le CORRECTIF — la file d'annonces se pose
   sous le bandeau, donc au-dessus du terrain. La précondition n'est pas là
   pour le remplacer mais pour attraper ce qu'on n'a pas prévu : elle est
   contre-testée en retirant cette ligne. */
async function taireAnnonces(page) {
  await page.evaluate(() => {
    if (typeof viderAnnonces === "function") viderAnnonces();
    // la file, ET ce qui balaye déjà l'écran hors file (bannières de
    // palier/fusion) : une bannière en vol pendant la mesure a produit
    // « 1004 px d'écart entre deux mesures identiques », une fois sur trois
    document.querySelectorAll("#file-annonces > *, .fusion-banniere, .message-flottant, .bulle-tuto")
      .forEach((e) => e.remove());
  });
  await new Promise((r) => setTimeout(r, 120));
}

async function empreinteVisuel(page, indice, zone) {
  await taireAnnonces(page);
  /* Les dessins se chargent en paresseux, et les key arts des starters
     sont les plus lourds du dépôt : un décodage qui atterrit ENTRE deux
     photos a produit « 420 px d'écart entre deux mesures identiques ».
     On attend que toutes les images soient décodées avant de mesurer. */
  await page.evaluate(() => Promise.all([...document.images]
    .filter((im) => im.src && !im.complete).map((im) => im.decode().catch(() => {}))));
  // et les POLICES : une fonte qui finit d'arriver repeint « Titulaires
  // 5/5 » ou la fiche d'adversaire au milieu des photos — même écart
  // stable (947 px) d'un passage à l'autre, déclenché par le cache
  await page.evaluate(() => document.fonts ? document.fonts.ready.then(() => undefined) : undefined);
  const masquer = (v) => page.evaluate(([n, etat]) => {
    const j = document.querySelectorAll(".ligne-terrain .jeton")[n];
    if (j) j.querySelectorAll(".dessin-carte").forEach((e) => { e.style.visibility = etat; });
  }, [indice, v]);
  /* La précondition dit exactement ça : une mesure non inerte NE VEUT
     RIEN DIRE. La conséquence honnête n'est pas de la publier quand même,
     c'est de REFAIRE la mesure — et de ne signaler le bruit que s'il
     persiste (une page qui bouge en continu reste un rouge). Un événement
     ponctuel (décodage tardif, repaint unique) est absorbé ; il l'était
     à la main avant, en relançant le passage. */
  let r;
  for (let essai = 0; essai < 3; essai++) {
    r = await MESURE.empreinte(page, zone, () => masquer("hidden"), () => masquer(""));
    if (r.inerte) break;
    await new Promise((res) => setTimeout(res, 250));
  }
  if (!r.inerte) bruitsDeFond.push(`joueur ${indice} : ${r.ecart} px d'écart entre deux mesures identiques, trois fois`);
  return { pixels: r.pixels, centre: r.centre };
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
          // refonte 28/08 (décision 74) : la CARTE porte coût, étoiles et
          // insignes de staff — chiffres, « · », « ★ » et ces emojis sont
          // l'habillage voulu. Le NOM, lui, reste à un tap.
          if (!texte || texte === "+" || /^[0-9·★🧪🧰🛂🏺🌟\s]+$/u.test(texte)) continue;
          const par = n.parentElement;
          // v2 (décision 77) : les six promus du onze de départ jouent en
          // SILHOUETTE NEUTRE — le glyphe de poste dans .dessin-carte.absent
          // est le repli déclaré (règle M4 : « bouche-trou », pas « cassé »)
          if (par.closest(".dessin-carte.absent") && /^[GDMA]$/.test(texte)) continue;
          const r = par.getBoundingClientRect();
          if (r.width < 1 || r.height < 1 || getComputedStyle(par).visibility === "hidden") continue;
          restes.push(texte.slice(0, 20));
        }
      }
      const compte = (sel) => lignes.reduce((n, l) => n + l.querySelectorAll(sel).length, 0);
      const pastilles = compte(".pastille, .pastille-poste, .nom-jeton, .note-jeton, .etoiles, .glyphes-famille");
      return { restes, pastilles, jetons: compte(".jeton"), figurines: compte(".jeton.carte-jeton") };
    });
    verifier(`${taille.nom} : aucun nom sur le terrain — que des cartes (${terrain.figurines}/${terrain.jetons})`,
      terrain.restes.length === 0 && terrain.pastilles === 0 && terrain.jetons === terrain.figurines,
      `textes ${JSON.stringify(terrain.restes)} · pastilles ${terrain.pastilles}`);

    /* ---- 2 · CHAQUE JOUEUR DU BANC PORTE UNE IMAGE VISIBLE ----
       Pas « un <img> existe dans le DOM » : une image qui occupe vraiment
       des pixels, et une dalle dont le contenu n'est pas plat. */
    const bancInfos = await page.evaluate(() => {
      const banc = document.getElementById("banc");
      return [...banc.children].filter((c) => c.classList.contains("jeton")).map((c) => {
        const r = c.getBoundingClientRect();
        const visuel = c.querySelector("img.dessin-carte, .dessin-carte.absent");
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

    /* ---- 3 · (AMENDÉ PAR LA REFONTE, décision 74) ----
       « Aucun jeton ne peint fond/bordure/ombre » gardait l'ère des
       silhouettes nues ; la CARTE peint par design (cadre poste, fond
       panneau) et refonte.spec.js le tient. Reste le vrai contrat :
       chaque joueur peint son DESSIN sur sa case — photographie
       différentielle, avec et sans lui. */
    const surLeGazon = await page.evaluate(() => [...document.querySelectorAll(".ligne-terrain .jeton")].map((j) => {
      const v = j.querySelector(".dessin-carte");
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

    /* v2 (décision 77) : au coup d'envoi le terrain porte ONZE cartes —
       elles se chevauchent (budget de recouvrement déclaré) et tombent à
       ~24 px. La photographie différentielle ne sait isoler que les
       cartes ASSEZ GRANDES (≥ 40 px) et NON RECOUVERTES par une voisine
       peinte après (> 25 % de sa boîte) : pour les autres, le contrat
       devient « le visuel est là et occupe ses pixels déclarés » —
       la preuve au pixel reste portée par les montages de lisibilité
       plus bas et par le banc. */
    const recouvert = (k) => {
      const a = surLeGazon[k].box;
      const aireA = Math.max(1, a.width * a.height);
      for (let j2 = k + 1; j2 < surLeGazon.length; j2++) {
        const b = surLeGazon[j2].box;
        const ix = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        const iy = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        if ((ix * iy) / aireA > 0.25) return true;
      }
      return false;
    };
    let terrainKO = 0, mesures = 0;
    const parts = [], ecarts = [];
    for (const [k, j] of surLeGazon.entries()) {
      const present = j.charge && j.visuel && j.visuel.w >= 8 && j.visuel.h >= 12;
      if (j.box.width < 40 || recouvert(k)) {
        if (!present) { terrainKO++; console.log(`   ↳ joueur ${k} (non mesurable) : chargé ${j.charge}, visuel ${JSON.stringify(j.visuel)}`); }
        continue;
      }
      mesures++;
      const aire = Math.max(1, Math.round(j.box.width) * Math.round(j.box.height));
      const emp = await empreinteVisuel(page, k, zoneTerrain);
      const part = emp.pixels / aire;
      // et ce qu'il peint tombe-t-il sur SA case ? (le défaut signalé :
      // un joueur qui n'est pas là où son emplacement dit qu'il est)
      const ecart = Math.hypot(emp.centre.x - (j.box.x + j.box.width / 2),
        emp.centre.y - (j.box.y + j.box.height / 2));
      parts.push(part); ecarts.push(ecart);
      const ok = present && part >= PART_MINIMALE && ecart <= Math.max(12, j.box.width * 0.5);
      if (!ok) { terrainKO++; console.log(`   ↳ joueur ${k} : chargé ${j.charge}, visuel ${JSON.stringify(j.visuel)}, empreinte ${(part * 100).toFixed(0)} % de sa boîte, centre à ${ecart.toFixed(1)} px de sa case`); }
    }
    const pire = parts.length ? Math.min(...parts) : 0;
    const pireEcart = ecarts.length ? Math.max(...ecarts) : 0;
    verifier(`${taille.nom} : les ${surLeGazon.length} joueurs du terrain portent leur visuel (${mesures} isolables prouvés au pixel — ` +
      `la plus discrète couvre ${(pire * 100).toFixed(0)} % de sa boîte, seuil ${(PART_MINIMALE * 100).toFixed(0)} % ; ` +
      `centre au plus à ${pireEcart.toFixed(1)} px de sa case)`,
      surLeGazon.length >= 4 && terrainKO === 0, `${terrainKO} joueur(s) sans visuel`);

    /* LE CONTRE-TEST. Une recette qui ne sort pas rouge sur le défaut
       qu'elle prétend attraper n'est pas un garde-fou : on efface pour de
       bon la silhouette du premier joueur du terrain, et la mesure doit la
       déclarer absente. */
    await page.evaluate(() => {
      const v = document.querySelectorAll(".ligne-terrain .jeton")[0].querySelector(".dessin-carte");
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

    /* (AMENDÉ PAR LA REFONTE, décision 74.) Ici vivaient « aucune
       figurine n'est un repli sans visuel » et toute la machinerie
       d'ANONYMISATION des corps empruntés — le prix des rendus 3D. Les
       cartes n'empruntent rien : un joueur sans dessin (les réservistes
       gratuits) porte un fond neutre et le GLYPHE de son poste, déclaré
       par une classe. Le contrat devient : le repli est identifiable,
       jamais une image cassée — et un joueur qui A un dessin ne tombe
       jamais dessus. */
    const RESERVISTES = ["Gilbert", "Norbert", "Fernand", "Marius", "Lucien", "Célestin"];
    const replis = await page.evaluate(async (noms) => {
      arreterChrono();
      document.querySelectorAll(".volet").forEach((v) => v.remove());
      partie.niveau = 9;
      partie.banc = [];
      partie.terrain = noms.slice(0, 5).map((nom, i) => ({ nom, cout: 0,
        poste: ["GAR", "DÉF", "MIL", "ATT", "MIL"][i], ecole: "", archetype: "",
        unique: null, etoiles: 1, uid: "R" + i }));
      afficher();
      await new Promise((r) => setTimeout(r, 250));
      const jetons = [...document.querySelectorAll(".ligne-terrain .jeton.carte-jeton")];
      const sansDessin = jetons.filter((j) => j.querySelector(".dessin-carte.absent"));
      const glyphesVides = sansDessin.filter((j) => !(j.querySelector(".dessin-carte.absent").textContent || "").trim());
      const avecArt = tousLesJoueurs.filter((x) => ONZE_PORTRAITS.carte(x)).slice(0, 5);
      partie.terrain = avecArt.map((f, i) => ({ ...f, uid: "A" + i }));
      afficher();
      await new Promise((r) => setTimeout(r, 250));
      const retombes = [...document.querySelectorAll(".ligne-terrain .jeton.carte-jeton")]
        .filter((j) => j.querySelector(".dessin-carte.absent")).length;
      return { total: jetons.length, replis: sansDessin.length, glyphesVides: glyphesVides.length, retombes };
    }, RESERVISTES);
    verifier(`${taille.nom} : le repli sans dessin est identifiable (${replis.replis}/${replis.total} réservistes ` +
      `en glyphe de poste) et un joueur illustré ne tombe jamais dessus (${replis.retombes})`,
      replis.total >= 5 && replis.replis === replis.total && replis.glyphesVides === 0 && replis.retombes === 0,
      JSON.stringify(replis));

    /* LE CONTRE-TEST DE LA PRÉCONDITION, FABRIQUÉ ET NON ATTENDU. Le
       défaut d'origine sortait une fois sur trois ; trois passages verts
       ne prouvent donc rien. On provoque la condition : une annonce est
       posée sur la zone, et `zoneInerte` doit la voir bouger. Sans ça, la
       précondition serait un décor. */
    /* LE CONTRE-TEST DE LA PRÉCONDITION, construit sur la propriété
       REVENDIQUÉE et non sur le scénario du défaut. Trois essais avaient
       échoué en courant après la fenêtre entre deux photos ; celui-ci
       change la page ENTRE LES DEUX PASSES de la mesure — franchement,
       sans course. À dire : ça ne reproduit pas la synchronisation exacte
       du défaut réel, mais ça éprouve exactement ce que l'assertion
       promet. */
    /* Le cobaye est UN JETON QUI A UN DESSIN — le premier de la liste
       pouvait être une case au repli glyphe, dont le masquage ne change
       aucun pixel : le contre-test mesurait alors 0 contre 0 et
       accusait la précondition. */
    /* Les annonces d'abord : les bannières de palier déclenchées par le
       montage balayent le terrain, et sur un écran de 667 px elles
       recouvrent le cobaye — les quatre photos montraient la bannière,
       jamais la carte, et le contre-test lisait 0 contre 0. */
    await taireAnnonces(page);
    const zoneCT = await page.evaluate(() => {
      const js = [...document.querySelectorAll(".ligne-terrain .jeton")];
      const k = js.findIndex((j) => j.querySelector("img.dessin-carte"));
      const r = js[k].getBoundingClientRect();
      return { k, x: Math.max(0, Math.round(r.x)), y: Math.max(0, Math.round(r.y)),
        width: Math.round(r.width), height: Math.round(r.height) };
    });
    const masquerCT = (v) => page.evaluate(([etat, k]) => {
      const j = document.querySelectorAll(".ligne-terrain .jeton")[k];
      j.querySelectorAll(".dessin-carte").forEach((e) => { e.style.visibility = etat; });
    }, [v, zoneCT.k]);
    const ctCalme = await MESURE.empreinte(page, zoneCT, () => masquerCT("hidden"), () => masquerCT(""));
    const ctAgite = await MESURE.empreinte(page, zoneCT, () => masquerCT("hidden"), () => masquerCT(""),
      () => page.evaluate((k) => {
        /* LE TÉMOIN DOIT ÊTRE VU PAR LA MESURE, PAS SEULEMENT PAR L'ŒIL.
           Chaque passe mesure « avec dessin » MOINS « dessin masqué » :
           un changement du fond de la carte est identique dans les deux
           photos d'une passe et pèse zéro. Le témoin porte donc la
           CLASSE du dessin — le masque le cache aussi — et il est blanc :
           la passe d'après mesure un écart massif, à toute taille.
           (Premier essai : opacité 0,3 sur un dessin sombre de 27 px —
           sous le seuil par pixel, écart 0, le contre-test accusait la
           précondition.) */
        const j = document.querySelectorAll(".ligne-terrain .jeton")[k];
        const temoin = document.createElement("div");
        temoin.className = "dessin-carte temoin-ct";
        temoin.style.cssText = "position:absolute;inset:0;background:#fff;z-index:5";
        j.appendChild(temoin);
      }, zoneCT.k));
    await page.evaluate(() => document.querySelectorAll(".temoin-ct").forEach((e) => e.remove()));
    verifier(`${taille.nom} : la précondition d'inertie voit une page qui change entre deux passes ` +
      `(inerte : écart ${ctCalme.ecart} px · changée : écart ${ctAgite.ecart} px)`,
      ctCalme.inerte && !ctAgite.inerte,
      `calme ${ctCalme.ecart}, agitée ${ctAgite.ecart} — la précondition ne discrimine pas`);

    /* LA PRÉCONDITION D'INERTIE EST UN VERDICT, pas une note de bas de
       page : si deux mesures identiques n'ont pas donné le même nombre,
       la page bougeait et TOUS les chiffres de cette recette sont
       suspects — on le dit au lieu de les publier. */
    verifier(`${taille.nom} : deux mesures identiques donnent le même nombre ` +
      `(${bruitsDeFond.length} mesure(s) prise(s) sur une page qui bougeait)`,
      bruitsDeFond.length === 0, bruitsDeFond.slice(0, 3).join(" | "));
    bruitsDeFond = [];

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

  /* ---- 4 ter · (RETIRÉE PAR LA REFONTE, décision 74) ----
     Elle vérifiait les promesses des silhouettes de trois quarts :
     point d'appui posé sur la ligne de sol, ombre-fichier qui remplace
     l'ombre dessinée. Les cartes carrées n'ont ni ancrage ni ombre au
     sol — le contrat n'a plus d'objet. ---- */

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
    await page.evaluate(() => ouvrirCalepin()); // refonte : le carnet vit au menu
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
