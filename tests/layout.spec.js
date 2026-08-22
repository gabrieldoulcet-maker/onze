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
  // ---- Portrait : plus de rendu tourné — l'écran doux « Tourne ton
  // téléphone » s'affiche (et disparaît en paysage). Leçon du playtest :
  // la rotation logicielle était pénible avec la barre Safari. ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector(".carte-boutique");
    const r = await page.evaluate(() => ({
      ecranDoux: getComputedStyle(document.getElementById("tourne-ecran")).display !== "none",
      renduTourne: getComputedStyle(document.getElementById("app")).transform !== "none",
      promo: getComputedStyle(document.getElementById("promo-pwa")).display !== "none",
    }));
    await page.setViewportSize({ width: 844, height: 390 });
    const cache = await page.evaluate(() => getComputedStyle(document.getElementById("tourne-ecran")).display === "none");
    const ok = r.ecranDoux && !r.renduTourne && r.promo && cache;
    console.log(`${ok ? "✅" : "❌"} portrait : écran doux 🔄 (visible ${r.ecranDoux}, rendu tourné ${r.renduTourne}, promo PWA ${r.promo}, caché en paysage ${cache})`);
    if (!ok) total++;
    await page.close();
  }
  await browser.close();
  process.exit(total ? 1 : 0);
})();
