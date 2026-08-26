/* ============================================================
   ONZE — LES QUÊTES SORTENT DE LA COLONNE (§10 du brief playtest).
   ------------------------------------------------------------
   Constat du playtest : les quêtes vivaient derrière la bascule
   de la colonne gauche, empilées sous l'inventaire de staff.
   Pour savoir où en était une quête il fallait basculer une
   colonne de 17 % de large — donc on ne regardait jamais. Une
   information qu'on ne consulte pas ne fait pas partie du jeu.

   ⚠ ÉCRITE AVANT LE CODE, elle doit sortir ROUGE (règle M3).

   Les cinq contrats :
     1. UN ACCÈS PROPRE, dans le bandeau du haut, présent sur
        l'écran de mise en place comme pendant le match ;
     2. LA CIBLE FAIT SA TAILLE — 26 px au moins, comme toutes
        les cibles tapables du jeu (décision 37) ;
     3. LE BOUTON DIT L'ÉTAT SANS QU'ON L'OUVRE : combien de
        quêtes sont prêtes à tomber. Une quête prête et un
        bouton muet, c'est une récompense qu'on rate ;
     4. PLUS RIEN DANS LA COLONNE : aucune quête rendue dans
        .col-synergies — sinon on a deux endroits qui disent la
        même chose, et le pire des deux gagne ;
     5. LE PANNEAU TIENT SUR PETIT TÉLÉPHONE : rien ne déborde
        de son cadre, sur les deux tailles.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/quetes.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "petit téléphone", l: 667, h: 375 }];
/* Le seuil de lisibilité d'une cible tapable, décision 37. */
const MIN_LISIBLE = 26;

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
    await page.evaluate(() => arreterChrono());

    /* ---- 1 et 2 · UN ACCÈS PROPRE, À LA BONNE TAILLE ---- */
    const bouton = await page.evaluate(() => {
      const b = document.getElementById("btn-quetes");
      if (!b) return { absent: true };
      const r = b.getBoundingClientRect();
      return { dansLeHaut: !!b.closest(".haut"), dansLaColonne: !!b.closest(".col-synergies"),
        l: Math.round(r.width), h: Math.round(r.height),
        visible: r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== "hidden" &&
          r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth };
    });
    verifier(`${taille.nom} : les quêtes ont un accès dans le bandeau du haut`,
      !bouton.absent && bouton.dansLeHaut && !bouton.dansLaColonne && bouton.visible,
      JSON.stringify(bouton));
    verifier(`${taille.nom} : la cible fait sa taille (${bouton.l || 0}×${bouton.h || 0} px, seuil ${MIN_LISIBLE})`,
      !bouton.absent && bouton.l >= MIN_LISIBLE && bouton.h >= MIN_LISIBLE, JSON.stringify(bouton));

    /* ---- 3 · LE BOUTON DIT L'ÉTAT SANS QU'ON L'OUVRE ----
       On force une quête à être prête : le bouton doit le montrer,
       et redevenir discret quand plus rien n'est prêt. */
    const pastille = await page.evaluate(async () => {
      const lire = () => {
        const b = document.getElementById("btn-quetes");
        const p = b && b.querySelector(".pastille-quetes");
        return { marque: !!b && b.classList.contains("pretes"),
          texte: p ? (p.textContent || "").trim() : null };
      };
      // aucune quête prête
      partie.quetesVisibles = ["le-patient"];       // « Verrouiller la boutique 2 fois »
      partie.compteurs.verrous = 0;
      afficher();
      await new Promise((r) => setTimeout(r, 150));
      const repos = lire();
      // une quête prête
      partie.compteurs.verrous = 2;
      afficher();
      await new Promise((r) => setTimeout(r, 150));
      const prete = lire();
      return { repos, prete };
    });
    verifier(`${taille.nom} : le bouton signale une quête prête sans qu'on l'ouvre ` +
      `(repos « ${pastille.repos.texte} », prête « ${pastille.prete.texte} »)`,
      pastille.prete.marque === true && pastille.prete.texte === "1" &&
      pastille.repos.marque === false, JSON.stringify(pastille));

    /* ---- 4 · PLUS RIEN DANS LA COLONNE ---- */
    const colonne = await page.evaluate(async () => {
      // on ouvre la page escamotable où les quêtes vivaient
      const bascule = document.getElementById("btn-bascule-gauche");
      if (bascule) bascule.click();
      await new Promise((r) => setTimeout(r, 200));
      const col = document.querySelector(".col-synergies");
      if (!col) return { sansColonne: true };
      const restes = [...col.querySelectorAll("*")].filter((e) =>
        /🎯/.test(e.childNodes.length === 1 && e.firstChild && e.firstChild.nodeType === 3 ? e.textContent : "") ||
        e.id === "quetes-liste");
      return { restes: restes.map((e) => e.id || e.className || e.tagName).slice(0, 4),
        nb: restes.length, listeEncoreLa: !!document.getElementById("quetes-liste") };
    });
    verifier(`${taille.nom} : la colonne gauche ne rend plus de quêtes`,
      !colonne.sansColonne && colonne.nb === 0 && !colonne.listeEncoreLa, JSON.stringify(colonne));

    /* ---- 5 · LE PANNEAU TIENT DANS SON CADRE ---- */
    const panneau = await page.evaluate(async () => {
      document.querySelectorAll(".volet").forEach((v) => v.remove());
      partie.quetesVisibles = ["gus-et-titi", "surdoue", "le-patient"];
      const b = document.getElementById("btn-quetes");
      if (!b) return { sansBouton: true };
      b.click();
      await new Promise((r) => setTimeout(r, 300));
      const p = document.querySelector(".volet .panneau");
      if (!p) return { pasOuvert: true };
      const rp = p.getBoundingClientRect();
      const debordent = [...p.querySelectorAll("*")].filter((e) => {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        return r.right > rp.right + 1 || r.left < rp.left - 1;
      });
      return { ouvert: true, dansLEcran: rp.top >= -1 && rp.bottom <= innerHeight + 1,
        deborde: debordent.length, exemples: debordent.slice(0, 3).map((e) => e.className || e.tagName) };
    });
    verifier(`${taille.nom} : le panneau des quêtes tient dans son cadre ` +
      `(${panneau.deborde === undefined ? "?" : panneau.deborde} débordement(s))`,
      panneau.ouvert && panneau.dansLEcran && panneau.deborde === 0, JSON.stringify(panneau));

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s) — les quêtes hors de la colonne (§10)` : "\nLes quêtes hors de la colonne ✅");
  process.exit(echecs ? 1 : 0);
})();
