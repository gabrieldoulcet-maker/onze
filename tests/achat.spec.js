/* ============================================================
   ONZE — RECETTE DE L'ACHAT AU TAP (brief habillage v2).
   ------------------------------------------------------------
   La carte de boutique entière est le bouton d'achat :
     · un appui au centre de l'illustration recrute
     · un appui sur la barre de prix recrute aussi (aucune zone morte)
     · un appui LONG ouvre la fiche sans rien acheter
     · or insuffisant → rien, une secousse et le manque qui clignote
     · banc plein → rien, une secousse
   Aucun de ces refus ne doit lever d'erreur ni bloquer l'écran.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/achat.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });

  /* Remet la boutique dans un état connu : 5 fois le même joueur à 4M,
     un seul titulaire, banc vide (sauf demande contraire). */
  const preparer = (or, bancPlein = false) => page.evaluate(([or, bancPlein]) => {
    arreterChrono();
    partie.or = or;
    if (!bancPlein) partie.terrain = partie.terrain.slice(0, 1);
    const dispo = tousLesJoueurs.filter((j) => j.cout === 1);
    partie.banc = bancPlein ? dispo.slice(0, TAILLE_BANC).map((f, i) => ({ ...f, etoiles: 1, uid: "x" + i })) : [];
    if (bancPlein) {
      // effectif VRAIMENT complet : le terrain à son maximum ET le banc plein
      const max = maxTitulaires();
      partie.terrain = dispo.slice(TAILLE_BANC, TAILLE_BANC + max)
        .map((f, i) => ({ ...f, ligne: i === 0 ? "GAR" : "MIL", etoiles: 1, uid: "y" + i }));
    }
    partie.boutique = Array(5).fill(0).map(() => tousLesJoueurs.find((j) => j.nom === "Facundo"));
    document.querySelectorAll(".voile-fiche").forEach((v) => v.remove());
    afficher();
    return { or: partie.or, effectif: partie.terrain.length + partie.banc.length };
  }, [or, bancPlein]);
  const etat = () => page.evaluate(() => ({ or: partie.or,
    effectif: partie.terrain.length + partie.banc.length,
    fiche: !!document.querySelector(".voile-fiche"),
    refus: !!document.querySelector(".carte-boutique.refus"),
    manque: !!document.querySelector(".manque-bulle, .manque") }));
  const boite = async () => (await page.$("#boutique .carte-boutique[data-boutique]")).boundingBox();

  // ---- 1. un appui au CENTRE de l'illustration achète ----
  const avant1 = await preparer(40);
  let b = await boite();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.35);
  await page.waitForTimeout(450);
  const apres1 = await etat();
  verifier(`appui au centre de l'illustration : le joueur est recruté (or ${avant1.or}→${apres1.or})`,
    apres1.effectif === avant1.effectif + 1 && apres1.or < avant1.or && !apres1.fiche, JSON.stringify(apres1));

  // ---- 2. un appui sur la BARRE DE PRIX achète aussi (aucune zone morte) ----
  const avant2 = await preparer(40);
  b = await boite();
  await page.mouse.click(b.x + b.width * 0.86, b.y + b.height - 6);
  await page.waitForTimeout(450);
  const apres2 = await etat();
  verifier("appui sur la barre de prix : recruté aussi (le prix reste une information)",
    apres2.effectif === avant2.effectif + 1 && apres2.or < avant2.or, JSON.stringify(apres2));

  // ---- 2 bis. les BORDS de la carte réagissent également ----
  const avant2b = await preparer(40);
  b = await boite();
  await page.mouse.click(b.x + 2, b.y + 2);
  await page.waitForTimeout(450);
  const apres2b = await etat();
  verifier("appui sur le coin de la carte : aucune zone morte",
    apres2b.effectif === avant2b.effectif + 1, JSON.stringify(apres2b));

  // ---- 3. l'appui LONG ouvre la fiche et n'achète pas ----
  const avant3 = await preparer(40);
  b = await boite();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const apres3 = await etat();
  verifier("appui long : la fiche s'ouvre, rien n'est acheté",
    apres3.fiche && apres3.effectif === avant3.effectif && apres3.or === avant3.or, JSON.stringify(apres3));

  // ---- 4. or insuffisant : rien, une secousse, le manque clignote ----
  const avant4 = await preparer(1);
  b = await boite();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(200);
  const apres4 = await etat();
  verifier("or insuffisant : aucun achat, une secousse et le manque qui clignote",
    apres4.effectif === avant4.effectif && apres4.or === avant4.or && apres4.refus && apres4.manque,
    JSON.stringify(apres4));

  // ---- 5. banc plein : même traitement ----
  const avant5 = await preparer(40, true);
  b = await boite();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(200);
  const apres5 = await etat();
  verifier(`banc plein (${avant5.effectif} joueurs) : aucun achat, une secousse`,
    apres5.effectif === avant5.effectif && apres5.or === avant5.or && apres5.refus, JSON.stringify(apres5));

  verifier(`aucun refus ne lève d'erreur (${erreursJS.length})`, erreursJS.length === 0,
    erreursJS.slice(0, 3).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nAchat au tap ✅");
  process.exit(echecs ? 1 : 0);
})();
