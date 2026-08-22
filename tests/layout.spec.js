/* ============================================================
   Test anti-régression : TOUS les contrôles critiques (Recruter ×5,
   Actualiser, XP, verrou, bouton de manche) entièrement visibles.
   Tailles réelles + hauteurs amputées simulant la barre du navigateur.
   Lancer : node tests/layout.spec.js (serveur :8123 requis)
   ============================================================ */
const { chromium } = require("playwright-core");
const TAILLES = [
  { nom: "grand téléphone", largeur: 844, hauteur: 390 },
  { nom: "petit téléphone", largeur: 667, hauteur: 375 },
  { nom: "encoche (iPhone X)", largeur: 812, hauteur: 375 },
  { nom: "barre navigateur visible (844×340)", largeur: 844, hauteur: 340 },
  { nom: "pire cas (667×320)", largeur: 667, hauteur: 320 },
];
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
  let total = 0;
  for (const taille of TAILLES) {
    const page = await browser.newPage({ viewport: { width: taille.largeur, height: taille.hauteur } });
    await page.goto("http://localhost:8123/partie.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector(".carte-boutique");
    await page.evaluate(() => typeof arreterChrono === "function" && arreterChrono());
    const controles = [
      ...(await page.$$(".carte-boutique button")),
      await page.$("#btn-refresh"), await page.$("#btn-xp"), await page.$("#btn-verrou"), await page.$("#btn-match"),
    ];
    let rognes = 0;
    for (const c of controles) {
      if (!c) { rognes++; continue; }
      const b = await c.boundingBox();
      if (!b || b.y < -1 || b.x < -1 || b.y + b.height > taille.hauteur + 1 || b.x + b.width > taille.largeur + 1) rognes++;
    }
    console.log(`${rognes ? "❌" : "✅"} ${taille.nom} (${taille.largeur}×${taille.hauteur})${rognes ? " : " + rognes + " contrôle(s) rogné(s)" : ""}`);
    total += rognes;
    await page.close();
  }
  // ---- Portrait : l'écran de rotation s'affiche et RIEN D'AUTRE (la
  // rotation logicielle est supprimée — c'était un mode à moitié cassé
  // qui échappait à ces tests). Retour paysage : le jeu revient entier. ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForFunction(() => typeof partie !== "undefined" && partie.boutique, null, { timeout: 8000 });
    const r = await page.evaluate(() => ({
      ecranRotation: getComputedStyle(document.getElementById("tourne-ecran")).display !== "none",
      appCache: getComputedStyle(document.getElementById("app")).display === "none",
      classeJS: document.documentElement.classList.contains("en-portrait"),
    }));
    // « rien d'autre » : aucun contrôle critique ne doit avoir de boîte visible
    const boiteMatch = await (await page.$("#btn-match")).boundingBox();
    const boiteRefresh = await (await page.$("#btn-refresh")).boundingBox();
    // retour paysage : le jeu se rend à nouveau, l'écran disparaît
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300); // le resize se propage (classe JS + reflow)
    const retour = await page.evaluate(() => ({
      ecranCache: getComputedStyle(document.getElementById("tourne-ecran")).display === "none",
      appVisible: getComputedStyle(document.getElementById("app")).display !== "none",
      classeRetiree: !document.documentElement.classList.contains("en-portrait"),
    }));
    const boiteMatchRetour = await (await page.$("#btn-match")).boundingBox();
    const ok = r.ecranRotation && r.appCache && r.classeJS && !boiteMatch && !boiteRefresh &&
      retour.ecranCache && retour.appVisible && retour.classeRetiree && !!boiteMatchRetour;
    console.log(`${ok ? "✅" : "❌"} portrait : écran de rotation et rien d'autre (app cachée ${r.appCache}, classe JS ${r.classeJS}, contrôles sans boîte ${!boiteMatch && !boiteRefresh}) · retour paysage complet ${retour.ecranCache && retour.appVisible && !!boiteMatchRetour}`);
    if (!ok) total++;
    await page.close();
  }
  await browser.close();
  process.exit(total ? 1 : 0);
})();
