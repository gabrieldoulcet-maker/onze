/* ============================================================
   ONZE — LA HIÉRARCHIE VISUELLE : LE TERRAIN AVANT LE BANC.
   ------------------------------------------------------------
   Mesuré sur une capture de manche 12 : les figurines du BANC
   font ~55 px de haut (le plafond `ECHELLE.banc.max = 58`,
   atteint) pendant que la meilleure figurine du TERRAIN en fait
   ~51 (plafond 72, jamais atteint) et la plus petite ~25 (au
   plancher `minLisible`).

   Autrement dit : les remplaçants sont plus grands que les
   titulaires. La zone secondaire est servie à son plafond,
   la zone principale est écrasée au plancher — la hiérarchie
   est exactement à l'envers.

   Deux contrats, à effectif plein, sur les trois formats :
     1. max(hauteur banc) ≤ min(hauteur terrain) ;
     2. entre deux titulaires de MÊME niveau d'étoiles sur la
        MÊME ligne, l'écart de hauteur ne vient que de la
        profondeur — tout le reste est un bogue d'échelle.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/hierarchie.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [
  { nom: "grand téléphone", l: 844, h: 390 },
  { nom: "grand écran", l: 926, h: 428 },
  { nom: "petit téléphone", l: 667, h: 375 },
];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });

    /* EFFECTIF PLEIN : onze titulaires et neuf remplaçants. C'est le cas
       où la place manque, donc celui où la hiérarchie se joue. */
    const mesures = await page.evaluate(async () => {
      arreterChrono();
      document.querySelectorAll(".volet").forEach((v) => v.remove());
      partie.niveau = 10;
      const art = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j));
      /* Le montage garantit des GROUPES COMPARABLES : sur chaque ligne,
         plusieurs joueurs du MÊME niveau d'étoiles. Sans ça la seconde
         assertion n'a rien à comparer et ne dit rien — un « 0 groupe »
         qui passe pour un verdict est pire qu'un rouge. */
      const LIGNES = ["GAR", "DÉF", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "ATT", "ATT", "ATT"];
      const ETOILES = [1, 2, 2, 2, 2, 1, 1, 1, 3, 3, 3];
      partie.terrain = art.slice(0, 11).map((f, i) => ({ ...f, etoiles: ETOILES[i], uid: "T" + i,
        ligne: LIGNES[i] }));
      partie.banc = art.slice(11, 20).map((f, i) => ({ ...f, etoiles: (i % 3) + 1, uid: "R" + i }));
      afficher();
      await Promise.all([...document.images].filter((i) => i.src && !i.complete).map((i) => i.decode().catch(() => {})));
      await new Promise((r) => setTimeout(r, 350));
      /* On mesure la FIGURINE (le visuel), pas la case : c'est elle que
         l'œil compare. Une case peut être grande et son occupant petit. */
      const haut = (racine) => [...document.querySelectorAll(racine + " .jeton")].map((j) => {
        const v = j.querySelector("img.frontale, svg.frontale");
        const r = (v || j).getBoundingClientRect();
        /* Les étoiles se lisent dans l'ÉTAT DE LA PARTIE, pas dans une
           variable CSS qui peut ne pas exister : une lecture qui rend
           `null` transforme la comparaison en silence. */
        const fiche = j.dataset.liste ? partie[j.dataset.liste][Number(j.dataset.indice)] : null;
        return { h: r.height, etoiles: fiche ? (fiche.etoiles || 1) : null,
          ligne: (j.closest(".ligne-terrain") || {}).id || null, y: r.bottom,
          nom: (j.dataset.nom || (j.querySelector(".nom-jeton") || {}).textContent || "").trim() };
      }).filter((m) => m.h > 1);
      return { banc: haut("#banc"), terrain: haut(".ligne-terrain"),
        echelle: typeof ECHELLE !== "undefined" ? { banc: ECHELLE.banc, terrain: ECHELLE.terrain } : null };
    });

    const hBanc = mesures.banc.map((m) => m.h);
    const hTerrain = mesures.terrain.map((m) => m.h);
    const maxBanc = Math.max(...hBanc), minTerrain = Math.min(...hTerrain), maxTerrain = Math.max(...hTerrain);
    verifier(`${taille.nom} : le banc reste sous le terrain — max(banc) ${maxBanc.toFixed(0)} px ` +
      `≤ min(terrain) ${minTerrain.toFixed(0)} px (terrain ${minTerrain.toFixed(0)}–${maxTerrain.toFixed(0)} px, ` +
      `${mesures.terrain.length} titulaires · ${mesures.banc.length} remplaçants)`,
      mesures.banc.length >= 8 && mesures.terrain.length >= 10 && maxBanc <= minTerrain,
      `banc jusqu'à ${maxBanc.toFixed(0)} px contre ${minTerrain.toFixed(0)} px pour le plus petit titulaire`);

    /* MÊME LIGNE, MÊMES ÉTOILES : l'écart ne doit venir que de la
       PROFONDEUR. Sur une même ligne, la profondeur est la même pour
       tout le monde — donc l'écart attendu est nul. Tout écart au-delà
       de la tolérance de rendu est une échelle incohérente, pas un
       choix. */
    const parGroupe = {};
    for (const m of mesures.terrain) {
      if (!m.ligne || !m.etoiles) continue;
      const cle = m.ligne + "·" + m.etoiles + "★";
      (parGroupe[cle] = parGroupe[cle] || []).push(m.h);
    }
    const fautifs = Object.entries(parGroupe).filter(([, l]) => l.length > 1)
      .map(([cle, l]) => ({ cle, min: Math.min(...l), max: Math.max(...l), n: l.length }))
      .filter((g) => g.max - g.min > 1.5);
    const groupes = Object.entries(parGroupe).filter(([, l]) => l.length > 1).length;
    verifier(`${taille.nom} : à même ligne et mêmes étoiles, la hauteur est la même ` +
      `(${groupes} groupe(s) comparable(s), écart maximal toléré 1,5 px)`,
      groupes > 0 && fautifs.length === 0,
      fautifs.map((g) => `${g.cle} : ${g.min.toFixed(0)}→${g.max.toFixed(0)} px`).join(" | ") ||
      "aucun groupe de deux joueurs de mêmes étoiles sur une même ligne");

    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nHiérarchie visuelle ✅");
  process.exit(echecs ? 1 : 0);
})();
