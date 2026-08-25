/* ============================================================
   ONZE — LE GESTE LE PLUS RÉPÉTÉ DU JEU : ATTRAPER UN JOUEUR.
   ------------------------------------------------------------
   Née d'un verdict de playtest — « très mauvais le drag and drop,
   pas précis du tout », « le joueur bouge en décalé de la scène,
   d'au moins 3 cm ». Mesuré : l'écart horizontal entre le
   fantôme et le doigt valait EXACTEMENT la coordonnée `left` du
   jeton attrapé, jusqu'à 672 px sur le dernier remplaçant — le
   fantôme sortait de l'écran.

   Pourquoi aucune recette ne l'a vu : `parcours.spec.js` annonce
   en tête « drag remplacé par les fonctions de jeu ». Le chemin
   du pointeur n'avait donc JAMAIS été traversé. Un écart de
   672 px est invisible pour un test qui appelle `deplacer()`.

   Ce que celle-ci garantit, et que rien d'autre ne dit :
     1. la carte reste SOUS LE DOIGT — centre du fantôme à moins
        de 12 px du pointeur — sur le remplaçant le plus à
        GAUCHE, le plus à DROITE, et sur un titulaire du terrain ;
     2. elle y reste PENDANT tout le geste, pas seulement à
        l'arrivée ;
     3. on tient la carte là où on l'a prise (l'écart de prise est
        conservé, c'est ce qui donne la sensation de tenir) ;
     4. le dépôt fonctionne : ce qu'on lâche sur une ligne y va.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/drag.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [
  { nom: "grand téléphone", l: 844, h: 390 },
  { nom: "grand écran", l: 926, h: 428 },
  { nom: "petit téléphone", l: 667, h: 375 },
];
/* Le seuil n'est pas négociable à la hausse : au-delà, le doigt et la
   carte ne racontent plus la même chose. */
const SEUIL_PX = 12;

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

/* Le mercato peuplé : un banc plein (9) et cinq titulaires. */
async function ouvrirMercato(page) {
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector(".carte-boutique", { timeout: 15000 });
  await page.evaluate(() => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    /* De la place sur le terrain : sinon le dépôt est refusé pour une
       raison de RÈGLE (équipe pleine) et la recette accuserait le geste
       d'un défaut qui n'existe pas. */
    partie.niveau = 9;
    const art = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j));
    partie.banc = art.slice(0, 9).map((f, i) => ({ ...f, etoiles: (i % 3) + 1, uid: "B" + i }));
    if (typeof attribuerUids === "function") attribuerUids();
    afficher();
  });
  await page.evaluate(() => Promise.all([...document.images]
    .filter((i) => i.src && !i.complete).map((i) => i.decode().catch(() => {}))));
  await page.waitForTimeout(350);
}

/* Attrape un jeton au POINTEUR (jamais par une fonction de jeu), le
   traîne jusqu'à une cible, et relève l'écart fantôme ↔ pointeur à
   chaque étape du trajet. Rend aussi l'écart de prise, pour savoir si
   on tient la carte là où on l'a saisie. */
async function trainer(page, selecteur, arrivee) {
  const prise = await page.evaluate((sel) => {
    const j = document.querySelector(sel);
    if (!j) return null;
    const r = j.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height,
      left: Math.round(r.x), nom: (j.textContent || "").trim().slice(0, 14) };
  }, selecteur);
  if (!prise) return null;
  await page.mouse.move(prise.x, prise.y);
  await page.mouse.down();
  const ecarts = [];
  const etapes = 6;
  for (let k = 1; k <= etapes; k++) {
    const x = prise.x + ((arrivee.x - prise.x) * k) / etapes;
    const y = prise.y + ((arrivee.y - prise.y) * k) / etapes;
    await page.mouse.move(x, y);
    const e = await page.evaluate(([px, py]) => {
      const f = document.querySelector(".fantome");
      if (!f) return null;
      const r = f.getBoundingClientRect();
      const st = getComputedStyle(f);
      return { dx: r.x + r.width / 2 - px, dy: r.y + r.height / 2 - py,
        // l'écart de prise : où le doigt se trouve DANS la carte
        prisex: (px - r.x) / (r.width || 1), prisey: (py - r.y) / (r.height || 1),
        position: st.position, parent: f.parentElement ? f.parentElement.id || f.parentElement.tagName : "?" };
    }, [x, y]);
    if (e) ecarts.push(e);
  }
  const dernier = ecarts[ecarts.length - 1] || null;
  await page.mouse.up();
  await page.waitForTimeout(120);
  return { prise, ecarts, dernier,
    pire: ecarts.length ? Math.max(...ecarts.map((e) => Math.hypot(e.dx, e.dy))) : Infinity };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await ouvrirMercato(page);

    const cible = await page.evaluate(() => {
      const l = document.querySelector("#ligne-MIL") || document.querySelector(".ligne-terrain");
      const r = l.getBoundingClientRect();
      return { x: Math.round(r.x + r.width * 0.5), y: Math.round(r.y + r.height * 0.5) };
    });

    /* Les trois prises qui comptent : le remplaçant le plus à GAUCHE
       (celui que Gabriel n'arrivait pas à attraper), le plus à DROITE
       (celui dont le fantôme sortait de l'écran), et un titulaire. */
    const prises = [["banc gauche", "gauche"], ["banc droite", "droite"], ["terrain", "terrain"]];
    for (const [quoi, ou] of prises) {
      /* On DÉSIGNE la prise juste avant de l'attraper : chaque geste
         déplace un joueur, donc le banc se vide au fil des essais — un
         sélecteur calculé une fois pour toutes visait un jeton disparu
         et faisait échouer la recette pour une raison qui n'était pas
         le sujet. */
      const sel = await page.evaluate((quel) => {
        if (quel === "terrain") { const j = document.querySelector(".ligne-terrain .jeton[data-liste]");
          return j ? `[data-liste="${j.dataset.liste}"][data-indice="${j.dataset.indice}"]` : null; }
        const l = [...document.querySelectorAll("#banc .jeton[data-liste]")]
          .sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x);
        const j = quel === "gauche" ? l[0] : l[l.length - 1];
        return j ? `[data-liste="${j.dataset.liste}"][data-indice="${j.dataset.indice}"]` : null;
      }, ou);
      const r = sel ? await trainer(page, sel, cible) : null;
      if (!r) { verifier(`${taille.nom} · ${quoi} : le jeton existe`, false, sel); continue; }
      const ok = r.pire < SEUIL_PX;
      verifier(`${taille.nom} · ${quoi} : la carte reste sous le doigt tout le trajet ` +
        `(écart maximal ${r.pire.toFixed(0)} px < ${SEUIL_PX} px, jeton pris à left ${r.prise.left} px)`,
        ok, r.dernier ? `dx ${r.dernier.dx.toFixed(0)} dy ${r.dernier.dy.toFixed(0)} · position ${r.dernier.position} · parent ${r.dernier.parent}` : "pas de fantôme");
    }

    /* ON TIENT LA CARTE LÀ OÙ ON L'A PRISE. Prise par le coin haut
       gauche : le doigt doit rester dans ce coin, pas sauter au
       centre. C'est ça, la sensation de tenir un objet. */
    const coin = await page.evaluate(() => {
      const j = document.querySelector("#banc .jeton[data-liste]");
      const r = j.getBoundingClientRect();
      return { x: Math.round(r.x + r.width * 0.22), y: Math.round(r.y + r.height * 0.22) };
    });
    await page.mouse.move(coin.x, coin.y);
    await page.mouse.down();
    await page.mouse.move(coin.x + 40, coin.y - 30);
    await page.mouse.move(cible.x, cible.y);
    const tenue = await page.evaluate(([px, py]) => {
      const f = document.querySelector(".fantome");
      if (!f) return null;
      const r = f.getBoundingClientRect();
      return { px: (px - r.x) / (r.width || 1), py: (py - r.y) / (r.height || 1) };
    }, [cible.x, cible.y]);
    await page.mouse.up();
    await page.waitForTimeout(120);
    const tenueOk = tenue && Math.abs(tenue.px - 0.22) < 0.15 && Math.abs(tenue.py - 0.22) < 0.15;
    verifier(`${taille.nom} : on tient la carte LÀ OÙ on l'a prise (prise à 22 %/22 %, ` +
      `retrouvée à ${tenue ? (tenue.px * 100).toFixed(0) + " %/" + (tenue.py * 100).toFixed(0) + " %" : "—"})`,
      tenueOk, JSON.stringify(tenue));

    /* LES NEUF PLACES DU BANC REÇOIVENT LEUR PROPRE APPUI. Le symptôme
       « je ne peux pas attraper le joueur le plus à gauche » : une
       colonne flottante peut recouvrir la première dalle selon le
       format d'écran — d'où les trois formats. */
    const occlusion = await page.evaluate(() => [...document.querySelectorAll("#banc .jeton[data-liste]")].map((j, i) => {
      const r = j.getBoundingClientRect();
      const dessus = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return dessus && (dessus === j || j.contains(dessus)) ? null
        : i + " → " + (dessus ? dessus.tagName.toLowerCase() + "." + (dessus.className || "").toString().split(" ")[0] : "?");
    }).filter(Boolean));
    verifier(`${taille.nom} : les 9 places du banc reçoivent leur propre appui (0 recouverte)`,
      occlusion.length === 0, occlusion.join(" | "));

    /* LE DÉPÔT ARRIVE À DESTINATION : le geste complet, pas seulement
       le fantôme. Ce qu'on lâche sur une ligne s'y installe. */
    /* La bonne question est « CE JOUEUR-LÀ est-il arrivé ? », pas
       « l'effectif a-t-il grandi » : lâcher sur une case occupée est un
       ÉCHANGE, parfaitement légitime, qui laisse le compte inchangé.
       La première version comptait les titulaires et accusait le geste
       d'un défaut qui était une règle du jeu. */
    const nomTire = await page.evaluate(() => {
      const j = document.querySelector("#banc .jeton[data-liste]");
      return partie[j.dataset.liste][Number(j.dataset.indice)].nom;
    });
    const r2 = await trainer(page, "#banc .jeton[data-liste]", cible);
    const arrive = await page.evaluate((nom) => ({
      surTerrain: partie.terrain.some((f) => f && f.nom === nom),
      auBanc: partie.banc.some((f) => f && f.nom === nom),
    }), nomTire);
    verifier(`${taille.nom} : le joueur lâché sur une ligne y arrive (${nomTire} : terrain ${arrive.surTerrain})`,
      r2 !== null && arrive.surTerrain && !arrive.auBanc, JSON.stringify(arrive));

    /* POURQUOI LE FANTÔME VIT DANS LE BODY, et pas dans `#app`.
       Le brief demandait un contre-test « rétablir el("app").appendChild
       doit sortir rouge ». Il sort VERT — et c'est instructif : la
       neutralisation en ligne (`position: fixed` posé à la main) suffit
       déjà à battre la règle de décor, donc les deux correctifs se
       recouvrent. Sauf dans un cas, et il est réel : un ancêtre qui porte
       un `transform` (une secousse d'écran, une transition) devient le
       référentiel des enfants `position: fixed`. Le fantôme suivrait
       alors l'ancêtre au lieu du doigt. On le prouve en posant une
       secousse sur `#app` : dans le body, la carte ne bouge pas d'un
       pixel ; dans `#app`, elle partirait avec lui. */
    await page.evaluate(() => { document.getElementById("app").style.transform = "translate(40px, 25px)"; });
    const selSecousse = await page.evaluate(() => {
      const j = document.querySelector("#banc .jeton[data-liste]");
      return j ? `[data-liste="${j.dataset.liste}"][data-indice="${j.dataset.indice}"]` : null;
    });
    const secousse = selSecousse ? await trainer(page, selSecousse, cible) : null;
    await page.evaluate(() => { document.getElementById("app").style.transform = ""; });
    verifier(`${taille.nom} : la carte tient le doigt même quand l'écran est secoué ` +
      `(ancêtre transformé, écart maximal ${secousse ? secousse.pire.toFixed(0) : "—"} px)`,
      !!secousse && secousse.pire < SEUIL_PX,
      secousse ? `parent ${secousse.dernier && secousse.dernier.parent}` : "pas de prise");

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nLe geste d'attraper un joueur ✅");
  process.exit(echecs ? 1 : 0);
})();
