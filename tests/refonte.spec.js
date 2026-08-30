/* ============================================================
   ONZE — LA REFONTE DE L'INTERFACE (brief Gabriel, 28/08).
   « Ça n'est pas un joli jeu, on va faire des gros changements. »

   ⚠ ÉCRITE AVANT LE CODE : elle doit sortir rouge sur chaque
   changement qu'elle décrit (règle M3).

   Le brief, contrat par contrat :
     1. PLUS DE PANNEAU PERMANENT À GAUCHE.
     2. LA DROITE EST UNE FICHE DU PROCHAIN ADVERSAIRE — pas les
        huit équipes. Le classement complet vit derrière le menu.
     3. BANDEAU : à gauche vie + niveau + jauge XP ; au centre
        « MERCATO · 19 s » très lisible ; à droite Manche X/9 et
        le menu.
     4. PAS D'INFORMATION DUPLIQUÉE : la manche s'affiche UNE
        fois hors volets.
     5. CARTES CARRÉES sur le terrain et le banc : le dessin,
        cadre couleur du POSTE, deux glyphes de famille, pastille
        de coût.
     6. LE BANC : neuf places ENTRE le terrain et la boutique.
     7. LA BANDE BASSE = LA BOUTIQUE : niveau/XP, cinq cartes,
        l'argent, Relancer, Verrouiller — et l'argent n'est PAS
        dans un grand cadre doré (l'or est au légendaire).
     8. PANNEAUX vert-nuit #17301D à 90-95 %, texte ivoire.
     9. L'INTERFACE VARIE : MERCATO (boutique dépliée, chrono),
        PLACEMENT (boutique repliée), MATCH (scène).
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/refonte.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "petit téléphone", l: 667, h: 375 }];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });
    await page.waitForTimeout(400);

    /* ---- 1 · PLUS DE PANNEAU PERMANENT À GAUCHE ---- */
    const gauche = await page.evaluate(() => {
      const c = document.querySelector(".col-synergies");
      return { present: !!c, visible: !!c && c.getBoundingClientRect().width > 0 };
    });
    verifier(`${taille.nom} : plus de panneau permanent à gauche`, !gauche.visible, JSON.stringify(gauche));

    /* ---- 2 · LA DROITE : LE PROCHAIN ADVERSAIRE, PAS HUIT ÉQUIPES ---- */
    const droite = await page.evaluate(() => {
      const a = document.querySelector("#adversaire");
      const nomAttendu = (partie.appariement && partie.appariement.nomAdversaire) || "";
      const huit = document.querySelector(".col-classement");
      return { fiche: !!a && a.getBoundingClientRect().width > 0,
        porteLeNom: !!a && nomAttendu && (a.textContent || "").includes(nomAttendu.replace(/^Amical — /, "").replace(/^🏆 Coupe — /, "")),
        nomAttendu, huitVisibles: !!huit && huit.getBoundingClientRect().width > 0 };
    });
    verifier(`${taille.nom} : à droite, la fiche du prochain adversaire (« ${droite.nomAttendu} ») et pas les huit équipes`,
      droite.fiche && droite.porteLeNom && !droite.huitVisibles, JSON.stringify(droite));

    /* ---- 3 · LE BANDEAU : GAUCHE / CENTRE / DROITE ---- */
    const bandeau = await page.evaluate(() => {
      const h = document.querySelector(".haut");
      const rh = h.getBoundingClientRect();
      const zone = (e) => { if (!e) return null; const r = e.getBoundingClientRect();
        const cx = r.x + r.width / 2; return cx < rh.width / 3 ? "gauche" : cx < rh.width * 2 / 3 ? "centre" : "droite"; };
      const vie = document.getElementById("prestige");
      const niveau = document.getElementById("niveau");
      const jauge = h.querySelector(".jauge-xp-haut, #jauge-xp-haut");
      const centre = document.getElementById("phase-centre");
      const manche = document.getElementById("manche-affiche");
      const menu = document.getElementById("btn-menu");
      const rMenu = menu ? menu.getBoundingClientRect() : { width: 0, height: 0 };
      const police = centre ? parseFloat(getComputedStyle(centre).fontSize) : 0;
      return { vie: zone(vie), niveau: zone(niveau), jauge: zone(jauge),
        centre: zone(centre), texteCentre: centre ? (centre.textContent || "").trim() : "",
        police, manche: zone(manche), texteManche: manche ? (manche.textContent || "").trim() : "",
        menu: zone(menu), menuTaille: Math.round(Math.min(rMenu.width, rMenu.height)) };
    });
    verifier(`${taille.nom} : bandeau gauche = vie + niveau + jauge XP`,
      bandeau.vie === "gauche" && bandeau.niveau === "gauche" && bandeau.jauge === "gauche",
      JSON.stringify(bandeau));
    verifier(`${taille.nom} : au centre, « ${bandeau.texteCentre} » très lisible (${bandeau.police} px ≥ 15)`,
      bandeau.centre === "centre" && /MERCATO/.test(bandeau.texteCentre) && bandeau.police >= 15,
      JSON.stringify(bandeau));
    verifier(`${taille.nom} : à droite, « ${bandeau.texteManche} » et le menu (cible ${bandeau.menuTaille} px ≥ 26)`,
      bandeau.manche === "droite" && /Manche\s*\d+\s*\/\s*\d+/.test(bandeau.texteManche) &&
      bandeau.menu === "droite" && bandeau.menuTaille >= 26, JSON.stringify(bandeau));

    /* ---- 4 · LA MANCHE S'AFFICHE UNE FOIS ---- */
    const manches = await page.evaluate(() => {
      const vus = [];
      const marche = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = marche.nextNode())) {
        if (!/Manche\s*\d/i.test(n.textContent)) continue;
        const e = n.parentElement;
        if (e.closest(".volet, .voile-fiche")) continue;
        const r = e.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) vus.push(e.id || e.className || n.textContent.trim().slice(0, 16));
      }
      return vus;
    });
    verifier(`${taille.nom} : la manche s'affiche UNE fois hors volets (${manches.length})`,
      manches.length === 1, manches.join(" | "));

    /* ---- 5 · CARTES CARRÉES, CADRE COULEUR POSTE ---- */
    const cartes = await page.evaluate(() => {
      const jetons = [...document.querySelectorAll('.jeton[data-liste="terrain"], .jeton[data-liste="banc"]')]
        .filter((j) => j.getBoundingClientRect().width > 0);
      const ref = {};
      for (const p of ["g", "d", "m", "a"])
        ref[p] = getComputedStyle(document.documentElement).getPropertyValue("--poste-" + p).trim();
      const parse = (c) => { const m = String(c).match(/\d+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
      const proche = (a, b) => { const [x, y] = [parse(a), parse(b)];
        return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 40; };
      const temoin = document.createElement("div"); document.body.appendChild(temoin);
      const couleurDe = (tok) => { temoin.style.color = tok; return getComputedStyle(temoin).color; };
      const cle = { GAR: "g", "DÉF": "d", MIL: "m", ATT: "a" };
      const rates = [];
      let ratios = [];
      for (const j of jetons) {
        const r = j.getBoundingClientRect();
        ratios.push(r.width / r.height);
        const cs = getComputedStyle(j);
        const poste = [...j.classList].map((c) => c.match(/^p-(.+)$/)).find(Boolean);
        const attendu = poste && ref[cle[poste[1]]] ? couleurDe(ref[cle[poste[1]]]) : null;
        const carre = r.width / r.height > 0.72 && r.width / r.height < 1.38;
        const cadre = attendu && proche(cs.borderColor || cs.borderTopColor, attendu);
        const glyphes = j.querySelectorAll(".glyphes-carte svg, .glyphes-carte .ecusson-mini, .glyphes-carte span").length;
        const cout = !!j.querySelector(".pastille-cout");
        if (!(carre && cadre && cout)) rates.push({ nom: j.getAttribute("aria-label"), carre, cadre, glyphes, cout,
          ratio: +(r.width / r.height).toFixed(2) });
      }
      temoin.remove();
      return { total: jetons.length, rates: rates.slice(0, 4), nbRates: rates.length,
        ratioMin: +Math.min(...ratios).toFixed(2), ratioMax: +Math.max(...ratios).toFixed(2) };
    });
    verifier(`${taille.nom} : ${cartes.total} joueurs en CARTES carrées, cadre couleur poste, pastille de coût ` +
      `(ratios ${cartes.ratioMin}–${cartes.ratioMax}, ${cartes.nbRates} raté(s))`,
      cartes.total >= 5 && cartes.nbRates === 0, JSON.stringify(cartes.rates));

    /* ---- 6 · LE BANC ENTRE LE TERRAIN ET LA BOUTIQUE ---- */
    const banc = await page.evaluate(() => {
      const b = document.getElementById("banc");
      const rb = b.getBoundingClientRect();
      const barre = document.getElementById("boutique-barre").getBoundingClientRect();
      const jeu = document.querySelector(".ligne-terrain .jeton, #terrain-scene");
      const basTerrain = jeu ? [...document.querySelectorAll(".ligne-terrain .jeton")]
        .reduce((m, j) => Math.max(m, j.getBoundingClientRect().bottom), 0) : 0;
      return { places: b.children.length, attendu: ONZE_ECO.TAILLE_BANC,
        sousLeTerrain: rb.top >= basTerrain - 2,
        surLaBoutique: rb.bottom <= barre.top + 2, y: Math.round(rb.y), basTerrain: Math.round(basTerrain),
        hautBarre: Math.round(barre.top) };
    });
    // v2 (décision 77) : le nombre de places vient de TAILLE_BANC (4), plus du 9 de la refonte
    verifier(`${taille.nom} : le banc (${banc.places} places) vit entre le terrain et la boutique ` +
      `(banc y=${banc.y}, terrain jusqu'à ${banc.basTerrain}, boutique à ${banc.hautBarre})`,
      banc.places === banc.attendu && banc.sousLeTerrain && banc.surLaBoutique, JSON.stringify(banc));

    /* ---- 7 · L'ARGENT SANS GRAND CADRE DORÉ ---- */
    const argent = await page.evaluate(() => {
      const temoin = document.createElement("div"); document.body.appendChild(temoin);
      temoin.style.color = "var(--or-trophee)";
      const or = getComputedStyle(temoin).color; temoin.remove();
      const m = document.getElementById("medaillon-or") || document.getElementById("argent");
      if (!m) return { absent: true };
      const cs = getComputedStyle(m);
      const r = m.getBoundingClientRect();
      const parse = (c) => { const x = String(c).match(/\d+/g); return x ? x.slice(0, 3).map(Number) : [0, 0, 0]; };
      const proche = (a, b) => { const [x, y] = [parse(a), parse(b)];
        return Math.abs(x[0] - y[0]) + Math.abs(x[1] - y[1]) + Math.abs(x[2] - y[2]) < 40; };
      const borduree = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none";
      return { texte: (m.textContent || "").replace(/\s+/g, " ").trim(),
        cadreDore: borduree && proche(cs.borderTopColor, or), h: Math.round(r.height),
        lueur: /rgba?\(2[34]\d, ?19\d/.test(cs.boxShadow) };
    });
    verifier(`${taille.nom} : l'argent (« ${argent.texte} ») n'est pas dans un grand cadre doré ` +
      `(h ${argent.h} px ≤ 26, cadre doré ${argent.cadreDore})`,
      !argent.absent && !argent.cadreDore && argent.h <= 26 && !argent.lueur, JSON.stringify(argent));

    /* ---- 8 · LES PANNEAUX VERT-NUIT, TEXTE IVOIRE ---- */
    const panneaux = await page.evaluate(async () => {
      const menu = document.getElementById("btn-menu");
      if (menu) menu.click();
      await new Promise((r) => setTimeout(r, 250));
      const p = document.querySelector(".volet .panneau");
      if (!p) return { pasDeMenu: true };
      const fond = getComputedStyle(p).backgroundColor;
      const m = fond.match(/rgba?\((\d+), ?(\d+), ?(\d+)(?:, ?([\d.]+))?\)/);
      const texte = getComputedStyle(p).color;
      const t = texte.match(/\d+/g).map(Number);
      document.querySelector(".volet").remove();
      return { fond, texte,
        vertNuit: m && Math.abs(m[1] - 23) < 12 && Math.abs(m[2] - 48) < 14 && Math.abs(m[3] - 29) < 12,
        opacite: m && (m[4] === undefined ? 1 : parseFloat(m[4])),
        ivoire: Math.abs(t[0] - 253) < 14 && Math.abs(t[1] - 248) < 14 && Math.abs(t[2] - 234) < 18 };
    });
    verifier(`${taille.nom} : le menu s'ouvre et son panneau est vert-nuit #17301D à 90-95 %, texte ivoire ` +
      `(${panneaux.fond} / ${panneaux.texte})`,
      !panneaux.pasDeMenu && panneaux.vertNuit && panneaux.opacite >= 0.88 && panneaux.opacite <= 0.97 &&
      panneaux.ivoire, JSON.stringify(panneaux));

    /* ---- 9 · L'INTERFACE VARIE : MERCATO → PLACEMENT → MATCH ---- */
    const phases = await page.evaluate(async () => {
      const app = document.getElementById("app");
      const lire = () => ({ classes: [...app.classList].filter((c) => c.startsWith("phase-")).join(","),
        centre: (document.getElementById("phase-centre") || { textContent: "" }).textContent.trim() });
      const mercato = lire();
      const sac = document.getElementById("btn-sac");
      if (sac) sac.click();
      await new Promise((r) => setTimeout(r, 250));
      const placement = lire();
      if (sac) sac.click();
      await new Promise((r) => setTimeout(r, 250));
      return { mercato, placement, retour: lire() };
    });
    verifier(`${taille.nom} : MERCATO (« ${phases.mercato.centre} ») → boutique repliée = PLACEMENT ` +
      `(« ${phases.placement.centre} ») → dépliée = MERCATO`,
      phases.mercato.classes === "phase-mercato" && /MERCATO/.test(phases.mercato.centre) &&
      phases.placement.classes === "phase-placement" && /PLACEMENT/.test(phases.placement.centre) &&
      phases.retour.classes === "phase-mercato", JSON.stringify(phases));

    await page.evaluate(() => { arreterChrono(); jouerManche(); });
    await page.waitForFunction(() => !!document.querySelector(".scene-match"), { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    const enMatch = await page.evaluate(() => ({
      scene: !!document.querySelector(".scene-match"),
      classes: [...document.getElementById("app").classList].filter((c) => c.startsWith("phase-")).join(","),
      centre: (document.getElementById("phase-centre") || { textContent: "" }).textContent.trim() }));
    verifier(`${taille.nom} : pendant le match, phase MATCH (« ${enMatch.centre} »)`,
      enMatch.scene && enMatch.classes === "phase-match" && /MATCH/.test(enMatch.centre),
      JSON.stringify(enMatch));

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s) — la refonte de l'interface` : "\nLa refonte de l'interface ✅");
  process.exit(echecs ? 1 : 0);
})();
