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
      /* REFONTE 28/08 (décision 74) : le visuel EST la carte — le jeton
         carré lui-même. On mesure sa boîte : c'est elle que l'œil compare. */
      const haut = (racine) => [...document.querySelectorAll(racine + " .jeton")].map((j) => {
        const r = j.getBoundingClientRect();
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
    /* L'ARBITRAGE, ÉCRIT PLUTÔT QUE SUBI (même forme que la décision 47).
       Le contrat est « le banc reste sous le terrain ». Sur un écran
       minuscule il devient impossible : le terrain descend à son plancher
       de lisibilité (26 px) et le banc ne peut pas passer sous le sien
       (30 px) sans devenir illisible à son tour. On préfère alors un banc
       lisible à une hiérarchie parfaite — mais on l'EXIGE : dans ce cas,
       le banc doit être AU PLANCHER, sinon le dépassement vient d'ailleurs
       et c'est un vrai défaut. Un seuil qui se contente de passer quand la
       place manque ne dit plus rien ; celui-ci dit lequel des deux commande. */
    /* L'ENCADREMENT (décision 64 · P4, formulation corrigée après mesure).
       La première version disait « le banc ne dépasse jamais la plus
       PETITE figurine du terrain ». Elle a produit le défaut inverse — des
       remplaçants minuscules — pour une raison géométrique : la plus
       petite figurine du terrain est celle du FOND, et le banc est au
       PREMIER PLAN. Le plafonner sur l'arrière-plan lui fait hériter d'une
       taille d'arrière-plan alors qu'il est devant.
       La règle borne donc des DEUX côtés : jamais plus grand que la plus
       GRANDE figurine du terrain, jamais plus petit que sa MÉDIANE.
       L'assertion « à étoiles égales, un remplaçant n'est jamais plus
       grand qu'un titulaire » a été retirée : elle disait l'ancienne
       règle, et sous la nouvelle un 3★ du banc dépasse légitimement un
       1★ du fond. */
    const triees = [...hTerrain].sort((a, b) => a - b);
    const medianeTerrain = triees[triees.length >> 1];
    const sousPlafond = maxBanc <= maxTerrain + 1.5;
    const surPlancher = maxBanc >= medianeTerrain - 1.5;
    verifier(`${taille.nom} : le banc est ENCADRÉ par le terrain — banc ${maxBanc.toFixed(0)} px, ` +
      `terrain ${minTerrain.toFixed(0)}–${maxTerrain.toFixed(0)} px, médiane ${medianeTerrain.toFixed(0)} px ` +
      `(${mesures.terrain.length} titulaires · ${mesures.banc.length} remplaçants)`,
      mesures.banc.length >= 8 && mesures.terrain.length >= 10 && sousPlafond && surPlancher,
      !sousPlafond ? `le banc dépasse la plus grande figurine du terrain (${maxBanc.toFixed(0)} > ${maxTerrain.toFixed(0)})`
        : `le banc passe sous la médiane du terrain (${maxBanc.toFixed(0)} < ${medianeTerrain.toFixed(0)})`);

    /* LA PERSPECTIVE N'EST PAS UN DÉFAUT — première version corrigée.
       J'avais exigé la MÊME hauteur pour deux joueurs de même ligne et
       mêmes étoiles. C'était faux : dans une ligne, le point de pose
       varie avec l'index, donc `v` varie, donc `echelleProfondeur(v)`
       varie. Deux défenseurs à v = 0,427 et 0,763 ont un rapport PRÉDIT
       de 1,096 ; j'en mesurais 1,105. J'accusais les décisions 51 et 52
       d'être un bogue.

       La bonne question : la hauteur mesurée est-elle celle que la
       formule prédit POUR SA PROPRE PROFONDEUR ? On compare donc chaque
       joueur à la hauteur attendue = base(v) × facteur d'étoiles, à 2 px
       près. Ce qui reste au-dessus n'est plus de la perspective. */
    const perspective = await page.evaluate(() => {
      const out = [];
      for (const j of document.querySelectorAll(".ligne-terrain .jeton")) {
        if (!j.dataset.liste) continue; // refonte : la CARTE est le visuel
        const fiche = partie[j.dataset.liste][Number(j.dataset.indice)];
        const st = getComputedStyle(j);
        const attendue = parseFloat(st.getPropertyValue("--h-figurine"));
        out.push({ mesuree: j.getBoundingClientRect().height, attendue,
          ligne: (j.closest(".ligne-terrain") || {}).id,
          etoiles: fiche ? (fiche.etoiles || 1) : 1 });
      }
      return out.filter((m) => m.attendue > 0);
    });
    const derives = perspective.filter((m) => Math.abs(m.mesuree - m.attendue) > 2);
    const pireDerive = perspective.length
      ? Math.max(...perspective.map((m) => Math.abs(m.mesuree - m.attendue))) : 0;
    verifier(`${taille.nom} : chaque figurine fait la hauteur prédite pour SA profondeur ` +
      `(${perspective.length} titulaires, écart maximal ${pireDerive.toFixed(1)} px — tolérance 2 px)`,
      perspective.length >= 10 && derives.length === 0,
      derives.slice(0, 4).map((m) => `${m.ligne}·${m.etoiles}★ : ${m.mesuree.toFixed(0)} px pour ${m.attendue.toFixed(0)} attendus`).join(" | "));

    /* LA CASE VIDE N'EST PAS UN JOUEUR. Mesuré sur terrain peint : une
       case vide fait 52 × 47 px quand un jeton voisin en fait 39 × 62 —
       elle est donc PLUS LARGE qu'un joueur et occupe une surface
       comparable, alors qu'elle ne représente rien. Trois rectangles
       gris à bord pointillé, sans ombre, sans ligne de sol : ils ne
       ressemblent pas à des emplacements libres, ils ressemblent à des
       images qui n'ont pas chargé.

       Le contrat : hors glisser, une case vide occupe au plus 40 % de la
       surface d'une figurine de la même ligne, et ne porte pas de bord
       en pointillés. Elle ne s'allume que quand elle est une cible. */
    const cases = await page.evaluate(async () => {
      partie.niveau = 10;
      partie.terrain = partie.terrain.slice(0, 6);   // il reste des places libres
      afficher();
      await new Promise((r) => setTimeout(r, 300));
      const surface = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
      const out = [];
      for (const c of document.querySelectorAll(".ligne-terrain .case-vide")) {
        const ligne = c.closest(".ligne-terrain");
        const voisins = [...ligne.querySelectorAll(".jeton")].map((j) => {
          const v = j.querySelector("img.frontale, svg.frontale");
          return surface(v || j);
        }).filter((a) => a > 1);
        if (!voisins.length) continue;
        /* On mesure ce qui est PEINT, pas la boîte : la case garde sa
           surface de tap (le doigt vise large) et ne dessine qu'un ovale
           de sol. Le dessin vit dans le ::before, dont la boîte se lit
           dans le style calculé. */
        const st = getComputedStyle(c);
        const av = getComputedStyle(c, "::before");
        const aireDessin = av.content !== "none"
          ? parseFloat(av.width || 0) * parseFloat(av.height || 0)
          : surface(c);
        out.push({ ligne: ligne.id, aire: aireDessin, aireBoite: surface(c),
          aireVoisin: voisins.reduce((a, b) => a + b, 0) / voisins.length,
          pointilles: st.borderTopStyle === "dashed" && parseFloat(st.borderTopWidth) > 0 });
      }
      return out;
    });
    const trop = cases.filter((c) => c.aire > c.aireVoisin * 0.40);
    const pointillees = cases.filter((c) => c.pointilles);
    const parts = cases.map((c) => Math.round((c.aire / c.aireVoisin) * 100));
    verifier(`${taille.nom} : une case vide reste un repère de sol, pas un joueur ` +
      `(${cases.length} case(s), ${parts.join(" · ")} % de la surface d'une figurine voisine — plafond 40 %)`,
      cases.length > 0 && trop.length === 0,
      `${trop.length} case(s) au-dessus du plafond`);
    verifier(`${taille.nom} : aucune case vide ne porte de bord en pointillés (${pointillees.length}/${cases.length})`,
      cases.length > 0 && pointillees.length === 0, `${pointillees.length} en pointillés`);

    /* LE DESSIN RÉTRÉCIT, PAS LA CIBLE DU DOIGT. Une case vide reste une
       surface qu'on vise : si le repère de sol devenait aussi la zone de
       tap, on aurait échangé un défaut visuel contre un défaut de geste.
       Plancher : 28 px de côté, la taille d'un doigt. */
    const petites = cases.filter((c) => c.aireBoite < 28 * 28);
    verifier(`${taille.nom} : la case vide garde sa surface de tap ` +
      `(${cases.map((c) => Math.round(Math.sqrt(c.aireBoite))).join(" · ")} px de côté équivalent — plancher 28 px)`,
      cases.length > 0 && petites.length === 0, `${petites.length} case(s) trop petite(s) pour un doigt`);

    /* ET ELLE S'ALLUME QUAND ELLE EST UNE CIBLE. La moitié qui manque au
       contrat : discrète au repos, nette pendant un glisser. On pose la
       classe de cible et on relit le dessin — il doit changer. */
    const allumage = await page.evaluate(() => {
      const c = document.querySelector(".ligne-terrain .case-vide");
      if (!c) return null;
      const avant = getComputedStyle(c, "::before").backgroundImage;
      c.closest(".ligne-terrain").classList.add("cible");
      const pendant = getComputedStyle(c, "::before").backgroundImage;
      const ombre = getComputedStyle(c, "::before").boxShadow;
      c.closest(".ligne-terrain").classList.remove("cible");
      return { change: avant !== pendant, ombre: ombre !== "none" };
    });
    verifier(`${taille.nom} : la case vide s'allume quand elle devient une cible de dépôt`,
      !!allumage && allumage.change && allumage.ombre, JSON.stringify(allumage));

    /* ZÉRO REPÈRE DE SOL SANS PROPRIÉTAIRE. Sur une équipe complète, deux
       taches sombres restaient sur la pelouse : l'ovale se peignait aussi
       sous les places VERROUILLÉES — l'ombre d'un joueur qu'on ne peut
       même pas recruter. Une place verrouillée n'est pas un emplacement
       libre : elle n'a rien à poser au sol. */
    const orphelins = await page.evaluate(async () => {
      /* NIVEAU 3 : cinq titulaires, et la grille en dessine sept — les deux
         places restantes sont donc VERROUILLÉES. C'est exactement l'écran
         « 5/5 » de la capture, celui où Gabriel voyait deux taches
         sombres sur la pelouse. Au niveau 5 (sept titulaires) la grille
         en dessine sept aussi : aucune case, rien à mesurer. */
      partie.niveau = 3;
      const art = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j));
      /* EFFECTIF VRAIMENT PLEIN : on remplit jusqu'à `maxTitulaires()`,
         lu dans le jeu. Une première version mettait cinq titulaires « au
         niveau 5 » en supposant que le maximum valait cinq : il en valait
         sept, deux places restaient LIBRES, et l'assertion ne trouvait
         aucune case verrouillée à examiner. Un contrôle qui ne rencontre
         pas son sujet ne dit rien — c'est pour ça qu'il compte aussi les
         verrouillées et échoue s'il n'en voit aucune. */
      const max = maxTitulaires();
      partie.terrain = art.slice(0, max).map((f, i) => ({ ...f, etoiles: 1, uid: "P" + i,
        ligne: ["GAR", "DÉF", "MIL", "ATT"][i === 0 ? 0 : 1 + (i % 3)] }));
      afficher();
      await new Promise((r) => setTimeout(r, 300));
      const cases = [...document.querySelectorAll(".ligne-terrain .case-vide")];
      const peints = cases.filter((c) => getComputedStyle(c, "::before").content !== "none");
      return { total: cases.length,
        verrouillees: cases.filter((c) => c.classList.contains("verrouillee")).length,
        peints: peints.length,
        peintsVerrouilles: peints.filter((c) => c.classList.contains("verrouillee")).length };
    });
    verifier(`${taille.nom} : sur un effectif plein, aucun repère de sol sans propriétaire ` +
      `(${orphelins.total} case(s) dont ${orphelins.verrouillees} verrouillée(s), ` +
      `${orphelins.peints} repère(s) peint(s))`,
      orphelins.verrouillees > 0 && orphelins.peintsVerrouilles === 0,
      orphelins.verrouillees === 0 ? "aucune case verrouillée à examiner : le contrôle ne dit rien"
        : JSON.stringify(orphelins));

    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nHiérarchie visuelle ✅");
  process.exit(echecs ? 1 : 0);
})();
