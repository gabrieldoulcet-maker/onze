/* ============================================================
   ONZE — LE CARNET DU RECRUTEUR, FAÇON TFT (§6 du brief playtest).
   ------------------------------------------------------------
   ⚠ CETTE RECETTE EST DÉCLARÉE ROUGE. C'est une DETTE ASSUMÉE,
   pas une régression : elle est écrite AVANT le carnet, et ses
   six contrats sont la définition de ce que « le carnet est
   fait » voudra dire. C'est le meilleur moment pour l'écrire, et
   le seul où personne ne peut la plier au résultat.

   ÉCHÉANCE : la livraison du §6. QUI EN RÉPOND : cette
   conversation. Voir tests/RECETTES.md, table des dettes.

   Je l'avais écrite, vue rouge, puis RETIRÉE de la livraison
   « pour ne pas laisser un rouge non déclaré ». L'instinct était
   bon, la conclusion était l'inverse de la règle M3 : le remède
   d'un rouge non déclaré est de le DÉCLARER, pas de le
   supprimer. Un garde-fou déclaré rouge est honnête ; un
   garde-fou absent ne dit rien.

   Ce que fait le guide de TFT, et qui manque ici — chaque point
   est une assertion, pas une intention :
     1. UNE GRILLE DENSE de vignettes, pas une liste : on voit
        30 joueurs d'un coup d'œil, chacun réduit à son portrait,
        son coût (couleur du cadre) et son poste ;
     2. UN FILTRE PERMANENT en haut, toujours visible : coût,
        École, poste. Un tap, la grille se recompose — jamais de
        rechargement, donc le panneau n'est pas reconstruit ;
     3. LE TAP OUVRE LE DÉTAIL À CÔTÉ, sans quitter la grille ;
     4. LE RANGEMENT PAR COÛT en colonnes — c'est ce qui apprend
        l'économie du jeu sans une ligne de texte ;
     5. LES SYNERGIES CLIQUABLES : taper une École filtre ses
        joueurs ;
     6. L'ÉPINGLAGE qui existait déjà survit à la refonte — une
        fonctionnalité perdue en silence est une régression.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/carnet.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "petit téléphone", l: 667, h: 375 }];
/* TFT montre une trentaine de champions sans défiler. Le seuil est
   déclaré ici et mesuré ; il ne dépend pas du nombre de joueurs. */
const VUS_SANS_DEFILER = 30;

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

async function ouvrirCarnet(page) {
  await page.evaluate(() => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    ouvrirCalepin();
  });
  await page.waitForSelector(".volet .carnet-grille", { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });
    await ouvrirCarnet(page);

    /* ---- 1 · UNE GRILLE DENSE, PAS UNE LISTE ---- */
    const grille = await page.evaluate(() => {
      const g = document.querySelector(".volet .carnet-grille");
      if (!g) return { absente: true, total: 0, vus: 0, avecVisuel: 0 };
      const rg = g.getBoundingClientRect();
      const vignettes = [...g.querySelectorAll("[data-nom]")];
      const dansLeCadre = vignettes.filter((v) => {
        const r = v.getBoundingClientRect();
        return r.top >= rg.top - 0.5 && r.bottom <= rg.bottom + 0.5 &&
          r.top >= 0 && r.bottom <= innerHeight;
      });
      const une = vignettes[0] ? vignettes[0].getBoundingClientRect() : null;
      return { total: vignettes.length, vus: dansLeCadre.length,
        largeur: une ? Math.round(une.width) : 0, hauteur: une ? Math.round(une.height) : 0,
        avecVisuel: vignettes.filter((v) => v.querySelector("img, svg")).length };
    });
    verifier(`${taille.nom} : la grille montre ${grille.vus} joueurs d'un coup d'œil ` +
      `(seuil ${VUS_SANS_DEFILER}, ${grille.total} au catalogue)`,
      !grille.absente && grille.vus >= VUS_SANS_DEFILER, JSON.stringify(grille));
    verifier(`${taille.nom} : chaque vignette porte un visuel, pas seulement du texte ` +
      `(${grille.avecVisuel}/${grille.total})`,
      !grille.absente && grille.total > 0 && grille.avecVisuel === grille.total,
      `${grille.total - grille.avecVisuel} sans visuel`);

    /* ---- 1 bis · UN NOM COUPÉ N'EST PAS UNE VIGNETTE ----
       Ajouté après coup : la grille passait ce contrat à 73 px de
       colonne, avec des noms réduits à « A… ». « 30 joueurs vus »
       ne veut rien dire si on ne peut pas les lire. */
    const noms = await page.evaluate(() => {
      const vs = [...document.querySelectorAll(".volet .carnet-grille [data-nom]")];
      const coupes = vs.map((v) => {
        const n = v.querySelector(".carnet-nom");
        if (!n) return v.dataset.nom;
        // coupé en largeur OU en hauteur : les deux amputent le nom
        return n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1
          ? v.dataset.nom : null;
      }).filter(Boolean);
      const col = document.querySelector(".volet .carnet-colonne");
      return { total: vs.length, coupes: coupes.length, exemples: coupes.slice(0, 4),
        largeurColonne: col ? Math.round(col.getBoundingClientRect().width) : 0 };
    });
    verifier(`${taille.nom} : aucun nom coupé ni rogné dans la grille ` +
      `(${noms.coupes}/${noms.total}, colonnes de ${noms.largeurColonne} px)`,
      noms.total > 0 && noms.coupes === 0, JSON.stringify(noms.exemples));

    /* ---- 4 · LE RANGEMENT PAR COÛT EN COLONNES ---- */
    const colonnes = await page.evaluate(() =>
      [...document.querySelectorAll(".volet .carnet-colonne")].map((c) => ({
        cout: Number(c.dataset.cout), x: Math.round(c.getBoundingClientRect().x),
        joueurs: c.querySelectorAll("[data-nom]").length,
        memeCout: [...c.querySelectorAll("[data-cout]")].every((v) => v.dataset.cout === c.dataset.cout),
      })));
    const ordonnees = colonnes.every((c, i) => i === 0 || c.x > colonnes[i - 1].x);
    const coutsCroissants = colonnes.every((c, i) => i === 0 || c.cout > colonnes[i - 1].cout);
    verifier(`${taille.nom} : les joueurs sont rangés par coût en colonnes ` +
      `(${colonnes.map((c) => c.cout + "M:" + c.joueurs).join(" · ") || "aucune colonne"})`,
      colonnes.length === 5 && ordonnees && coutsCroissants && colonnes.every((c) => c.memeCout),
      JSON.stringify(colonnes));

    /* ---- 2 · LE FILTRE EST PERMANENT ET NE RECHARGE RIEN ---- */
    const filtre = await page.evaluate(async () => {
      const barre = document.querySelector(".volet .carnet-filtres");
      if (!barre) return { absente: true };
      const rb = barre.getBoundingClientRect();
      const grilleAvant = document.querySelector(".volet .carnet-grille");
      const avant = document.querySelectorAll(".volet .carnet-grille [data-nom]").length;
      const bouton = document.querySelector('.volet .carnet-filtres [data-poste="ATT"]');
      if (!bouton) return { sansBouton: true };
      bouton.click();
      await new Promise((r) => setTimeout(r, 150));
      const apres = document.querySelectorAll(".volet .carnet-grille [data-nom]").length;
      const memeGrille = document.querySelector(".volet .carnet-grille") === grilleAvant;
      bouton.click();
      await new Promise((r) => setTimeout(r, 150));
      return { avant, apres, retour: document.querySelectorAll(".volet .carnet-grille [data-nom]").length,
        memeGrille, visible: rb.top >= 0 && rb.height > 4 };
    });
    verifier(`${taille.nom} : le filtre est permanent et recompose sans recharger ` +
      `(${filtre.avant} → ${filtre.apres} → ${filtre.retour} joueurs, même grille ${filtre.memeGrille})`,
      !filtre.absente && !filtre.sansBouton && filtre.visible &&
      filtre.apres > 0 && filtre.apres < filtre.avant && filtre.retour === filtre.avant && filtre.memeGrille,
      JSON.stringify(filtre));

    /* ---- 3 · LE TAP OUVRE LE DÉTAIL SANS QUITTER LA GRILLE ---- */
    const detail = await page.evaluate(async () => {
      const v = document.querySelector(".volet .carnet-grille [data-nom]");
      if (!v) return { absent: true };
      const nom = v.dataset.nom;
      v.click();
      await new Promise((r) => setTimeout(r, 200));
      const d = document.querySelector(".volet .carnet-detail");
      const g = document.querySelector(".volet .carnet-grille");
      return { nom, ouvert: !!d && d.getBoundingClientRect().width > 20,
        porteLeNom: !!d && (d.textContent || "").includes(nom),
        grilleEncoreLa: !!g && g.getBoundingClientRect().height > 20,
        joueursEncoreLa: document.querySelectorAll(".volet .carnet-grille [data-nom]").length };
    });
    verifier(`${taille.nom} : un tap ouvre le détail SANS quitter la grille ` +
      `(${detail.joueursEncoreLa || 0} joueurs toujours à l'écran)`,
      !detail.absent && detail.ouvert && detail.porteLeNom && detail.grilleEncoreLa &&
      detail.joueursEncoreLa > 10, JSON.stringify(detail));

    /* ---- 5 · LES SYNERGIES SONT CLIQUABLES ---- */
    const synergie = await page.evaluate(async () => {
      const b = document.querySelector('.volet .carnet-filtres [data-ecole]:not([data-ecole=""])');
      if (!b) return { absente: true };
      const ecole = b.dataset.ecole;
      const avant = document.querySelectorAll(".volet .carnet-grille [data-nom]").length;
      b.click();
      await new Promise((r) => setTimeout(r, 150));
      const cartes = [...document.querySelectorAll(".volet .carnet-grille [data-nom]")];
      const toutes = cartes.every((c) => c.dataset.ecole === ecole);
      b.click();
      await new Promise((r) => setTimeout(r, 150));
      return { ecole, avant, apres: cartes.length, toutes };
    });
    verifier(`${taille.nom} : taper une École filtre ses joueurs ` +
      `(${synergie.ecole || "—"} : ${synergie.avant || 0} → ${synergie.apres || 0})`,
      !synergie.absente && synergie.apres > 0 && synergie.apres < synergie.avant && synergie.toutes,
      JSON.stringify(synergie));

    /* ---- 6 · L'ÉPINGLAGE SURVIT À LA REFONTE ---- */
    const epingle = await page.evaluate(async () => {
      partie.calepin = [];
      const v = document.querySelector(".volet .carnet-grille [data-nom]");
      if (!v) return { absent: true, apresUn: [], apresDeux: [] };
      const nom = v.dataset.nom;
      (v.querySelector("[data-epingler]") || v).click();
      await new Promise((r) => setTimeout(r, 200));
      const apresUn = partie.calepin.slice();
      const encore = document.querySelector(`.volet .carnet-grille [data-nom="${CSS.escape(nom)}"]`);
      const marque = !!encore && encore.classList.contains("epingle");
      if (encore) (encore.querySelector("[data-epingler]") || encore).click();
      await new Promise((r) => setTimeout(r, 200));
      return { nom, apresUn, marque, apresDeux: partie.calepin.slice() };
    });
    verifier(`${taille.nom} : l'épinglage survit à la refonte`,
      !epingle.absent && epingle.apresUn.includes(epingle.nom) && epingle.marque &&
      !epingle.apresDeux.includes(epingle.nom), JSON.stringify(epingle));

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs
    ? `\n${echecs} échec(s) — DETTE DÉCLARÉE : le carnet n'est pas encore fait (§6), échéance sa livraison`
    : "\nLe carnet du recruteur ✅");
  process.exit(echecs ? 1 : 0);
})();
