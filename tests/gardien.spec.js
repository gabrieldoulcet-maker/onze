/* ============================================================
   Test anti-régression : JAMAIS deux gardiens sur le terrain.
   Vérifie tous les chemins : acquisition (placerAuClub), titularisation
   (échange intelligent), auto-complétion au coup d'envoi.
   Lancer :  node tests/gardien.spec.js   (serveur sur :8123 requis :
   python3 -m http.server 8123 ; utilise playwright-core + chromium local)
   ============================================================ */
const { chromium } = require("playwright-core");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const erreurs = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.goto("http://localhost:8123/partie.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector(".carte-boutique");
  const nbGardiens = () => page.evaluate(() => partie.terrain.filter((j) => (j.ligne || j.poste) === "GAR").length);
  let echecs = 0;
  const verifier = (nom, valeur, attendu) => {
    const ok = valeur === attendu;
    console.log(`${ok ? "✅" : "❌"} ${nom} : ${valeur} (attendu ${attendu})`);
    if (!ok) echecs++;
  };
  // 1. acquisition d'un 2ᵉ gardien → au banc
  await page.evaluate(() => { placerAuClub({ ...tousLesJoueurs.find((j) => j.poste === "GAR"), etoiles: 1 }); afficher(); });
  verifier("acquisition 2ᵉ GAR", await nbGardiens(), 1);
  // 2. titularisation du 2ᵉ gardien → échange intelligent
  await page.evaluate(() => basculer("banc", 0));
  verifier("titularisation 2ᵉ GAR (échange)", await nbGardiens(), 1);
  // 3. auto-complétion : ne monte jamais un 2ᵉ GAR
  await page.evaluate(() => {
    partie.terrain = partie.terrain.slice(0, 2);
    const gk2 = tousLesJoueurs.filter((j) => j.poste === "GAR")[1];
    partie.banc = [{ ...gk2, etoiles: 1 }, { ...tousLesJoueurs.find((j) => j.poste === "DÉF"), etoiles: 1 }];
    autoCompleter();
  });
  verifier("auto-complétion", await nbGardiens(), 1);
  verifier("le 2ᵉ GAR reste au banc", await page.evaluate(() => partie.banc.filter((j) => j.poste === "GAR").length), 1);
  if (erreurs.length) { console.log("❌ erreurs JS:", erreurs); echecs++; }
  await browser.close();
  process.exit(echecs ? 1 : 0);
})();
