/* ============================================================
   ONZE — Parcours automatisé de bout en bout (navigateur réel).
   Traverse 5 manches (amicaux + 2 PvP) en jouant comme un joueur :
   achats en boutique, XP, refresh, verrou, drag remplacé par les
   fonctions de jeu, et TOUS les panneaux du sprint UI-TFT :
   calepin 📝, éclat de fusion, recap ⚔️, boutique escamotable 🪙,
   scouting fluide (swipe), bascule du panneau gauche, Labo 🧪.
   Échec si la moindre erreur JS survient en route.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/parcours.spec.js
   (serveur : python3 -m http.server 8123 --directory .)
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}`);
  if (!ok) echecs++;
};

/* ---- Anti-placeholder : aucun texte « chantier » ne doit atteindre le
   joueur (leçon du playtest : « le système complet arrive bientôt » a
   survécu deux sprints au système staff complet). Vérifié statiquement
   sur tous les fichiers servis au navigateur. ---- */
{
  const fs = require("fs"), path = require("path");
  const racine = path.join(__dirname, "..");
  const servis = fs.readdirSync(racine).filter((f) => /\.(html|js|css)$/.test(f));
  const INTERDITS = /arrive bient[oô]t|coming soon|en construction|prochainement|lorem ipsum|syst[eè]me complet|version future|sera ajout[eé]/i;
  const fautifs = [];
  for (const f of servis) {
    const contenu = fs.readFileSync(path.join(racine, f), "utf8");
    // on ignore les commentaires : seuls les textes vus du joueur comptent
    const sansCommentaires = contenu.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/<!--[\s\S]*?-->/g, "");
    const m = sansCommentaires.match(INTERDITS);
    if (m) fautifs.push(`${f} → « ${m[0]} »`);
  }
  verifier("aucun texte placeholder/« bientôt » servi au joueur", fautifs.length === 0);
  for (const f of fautifs) console.log("   ⚠️ " + f);

  // ---- Anti-ancienne-palette (DA saison 1) : les tokens de design/da/
  // font foi — aucune valeur de la palette d'AVANT la DA ne doit rester
  // en dur dans un fichier servi. ----
  const ANCIENNE_PALETTE = ["#101711", "#0B100C", "#182219", "#161F18", "#141B14", "#24331F",
    "#263129", "#1B241B", "#35502F", "#2A3A2C", "#6C7A6E", "#4FC57C", "#A9DDB6", "#E8C547",
    "#E7EEE7", "#96A699", "#7E9483", "#8B9E8E", "#4F9EC5", "#A66BD4", "#E8654F", "#E88C7D",
    "#D4A66B", "#3A2A24", "#17501F", "#1C5A2C", "#F5E08A", "#FFD9A0"];
  const servisPalette = [...servis, "manifest.json"];
  const fautifsPalette = [];
  for (const f of servisPalette) {
    const contenu = fs.readFileSync(path.join(racine, f), "utf8").toUpperCase();
    for (const hex of ANCIENNE_PALETTE) if (contenu.includes(hex)) fautifsPalette.push(`${f} → ${hex}`);
  }
  verifier("aucune valeur de l'ancienne palette en dur (tokens DA S1)", fautifsPalette.length === 0);
  for (const f of fautifsPalette.slice(0, 10)) console.log("   ⚠️ " + f);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });
  await page.evaluate(() => { arreterChrono(); });

  // ---- Mercato manche 1 : acheter tout ce qui est abordable ----
  await page.evaluate(() => {
    for (let i = 0; i < partie.boutique.length; i++) {
      const f = partie.boutique[i];
      if (f && partie.or >= f.cout) acheter(i);
    }
  });
  verifier("achats en boutique (manche 1)", await page.evaluate(() => partie.terrain.length + partie.banc.length > 0));

  // ---- Le calepin : épingler 2 joueurs, l'un doit briller en boutique ----
  await page.tap("#btn-calepin");
  await page.waitForSelector(".galerie .carte-galerie");
  await page.tap(".galerie .carte-galerie:nth-child(1)");
  await page.tap(".galerie .carte-galerie:nth-child(2)");
  const epingles = await page.$$eval(".carte-galerie.epingle", (l) => l.map((c) => c.dataset.nom));
  await page.evaluate(() => document.querySelector('[data-action="fermer"]').click());
  verifier("calepin : 2 joueurs épinglés", epingles.length === 2);
  const brille = await page.evaluate((nom) => {
    partie.boutique[0] = tousLesJoueurs.find((j) => j.nom === nom);
    afficher();
    return document.querySelector("#boutique .carte-boutique").classList.contains("planifie");
  }, epingles[0]);
  verifier("calepin : le joueur planifié brille en boutique", brille);

  // ---- Boutique escamotable + bascule du panneau gauche ----
  await page.tap("#btn-sac");
  verifier("boutique repliée : or/refresh/verrou restent", await page.evaluate(() =>
    document.getElementById("boutique-barre").classList.contains("repliee") &&
    ["or", "btn-refresh", "btn-verrou"].every((id) => document.getElementById(id).getBoundingClientRect().height > 0)));
  await page.tap("#btn-sac");
  await page.click("#btn-bascule-gauche");
  verifier("bascule gauche : page staff/quêtes affichée", await page.evaluate(() =>
    !document.getElementById("page-staff").classList.contains("masque") &&
    document.getElementById("page-synergies").classList.contains("masque")));
  await page.click("#btn-bascule-gauche");

  // ---- Scouting fluide : ouvrir, swiper, revenir ----
  await page.evaluate(() => scouterIndice(partie.coachs.findIndex((c) => c.ia)));
  await page.waitForSelector(".fiche-joueur.visite");
  const avantSwipe = await page.$eval(".nav-vestiaire h3", (h) => h.textContent);
  await page.evaluate(() => document.querySelector('[data-nav="1"]').click());
  const apresSwipe = await page.$eval(".nav-vestiaire h3", (h) => h.textContent);
  verifier("scouting : navigation entre clubs + liseré jaune", avantSwipe !== apresSwipe &&
    await page.evaluate(() => document.querySelectorAll("#classement-liste .coach-ligne.visite").length === 1));
  await page.evaluate(() => document.querySelector(".retour-fixe").click());

  // ---- Jouer 5 manches : amicaux M1-3 puis 2 PvP, vitesse ×2 ----
  for (let m = 1; m <= 5; m++) {
    await page.evaluate(() => { arreterChrono(); jouerManche(); });
    await page.evaluate(() => { if (ONZE_UI.basculerVitesse() === 1) ONZE_UI.basculerVitesse(); });
    // le recap ⚔️ doit être consultable PENDANT le match
    if (m === 1) {
      await page.tap("#btn-recap");
      await page.waitForSelector(".voile-fiche .onglet-recap");
      verifier("recap ⚔️ ouvert pendant le match (2 onglets)",
        await page.evaluate(() => document.querySelectorAll(".onglet-recap").length === 2));
      await page.evaluate(() => document.querySelector(".voile-fiche .fermer").click());
      // la scène canvas : disques des 2 camps, ballon focal, jauge, bandeau, 📜
      await page.waitForSelector(".scene-match canvas");
      const diag1 = await page.evaluate(() => sceneMatch.diagnostic());
      verifier("scène canvas : disques des deux camps + régimes actifs",
        diag1.nbDisques >= 2 &&
        diag1.positions.some((p) => p.camp === "moi") && diag1.positions.some((p) => p.camp === "eux") &&
        ["domination", "tension", "rendu", "ralenti"].includes(diag1.regime));
      await page.waitForTimeout(2500);
      const diag2 = await page.evaluate(() => sceneMatch.diagnostic());
      verifier("scène canvas : le ballon se déplace (point focal)",
        Math.hypot(diag2.ballon.x - diag1.ballon.x, diag2.ballon.y - diag1.ballon.y) > 0.5 ||
        diag2.regime !== diag1.regime);
      verifier("jauge de domination pilotée", await page.evaluate(() =>
        document.getElementById("jauge-dom").style.width !== ""));
      verifier("bandeau compact du récit alimenté, journal replié", await page.evaluate(() =>
        document.getElementById("bandeau-recit").textContent.length > 0 &&
        document.getElementById("recit").classList.contains("replie")));
      await page.click("#btn-journal");
      verifier("📜 déplie le journal complet", await page.evaluate(() =>
        !document.getElementById("recit").classList.contains("replie")));
      await page.click("#btn-journal");
    }
    // attendre le volet de bilan de fin de manche (le match dure ~5-20 s en ×2)
    await page.waitForFunction(() => !!document.getElementById("btn-continuer"), null, { timeout: 120000 });
    await page.evaluate(() => {
      arreterChrono();
      // le bilan de manche : ouvrir les orbes puis « Continuer »
      document.querySelectorAll(".volet .orbe").forEach((o) => o.click());
    });
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const btn = document.getElementById("btn-continuer");
      if (btn) { btn.click(); }
      // les volets suivants (philosophie, hiver, déblocage) : premier choix
      document.querySelectorAll(".volet [data-hiver]").forEach((b, i) => { if (i === 0) b.click(); });
      document.querySelectorAll(".volet").forEach((v) => { const b = v.querySelector("button"); if (b) b.click(); });
      document.querySelectorAll(".volet, .voile-fiche, .fusion-banniere").forEach((v) => v.remove());
      arreterChrono();
    });
    await page.waitForTimeout(300);
  }
  const bilan = await page.evaluate(() => ({ manche: partie.manche, or: partie.or, historique: partie.historique.length }));
  verifier(`5 manches jouées sans erreur (on est à la manche ${bilan.manche})`, bilan.manche >= 5 && bilan.historique >= 4);

  // ---- L'homme du match est annoncé, le recap est encore là après coup ----
  await page.tap("#btn-recap");
  await page.waitForSelector(".voile-fiche .onglet-recap");
  verifier("recap ⚔️ toujours disponible après le match", true);
  await page.evaluate(() => document.querySelector(".voile-fiche .fermer").click());

  // ---- Le Labo 🧪 s'ouvre depuis l'assignation staff ----
  const labo = await page.evaluate(() => {
    ouvrirLabo();
    const volet = [...document.querySelectorAll(".volet")].pop();
    const ok = volet && volet.textContent.includes("36");
    if (volet) volet.remove();
    return ok;
  });
  verifier("labo 🧪 : la grille des 36 s'ouvre", !!labo);

  // ---- Staff en drag & drop : 2 glissers CONSÉCUTIFS (le 2ᵉ fut un bug :
  //      la sélection de texte du 1er déclenchait un drag natif → pointercancel),
  //      aperçu de la spécialisation pendant le survol, confirmation de fusion ----
  await page.evaluate(() => {
    arreterChrono();
    const noms = Object.keys(ONZE.COMPOSANTS_STAFF).filter((n) => n !== "Passeport");
    partie.staff = [noms[0], noms[1]];
    if (!partie.terrain.length && partie.banc.length) partie.terrain.push(partie.banc.shift());
    partie.terrain[0].staffCartes = [];
    partie.terrain[0].specialisations = [];
    afficher();
  });
  await page.click("#btn-bascule-gauche");
  const unDragStaff = async () => {
    const bb = await (await page.$(".badge-staff")).boundingBox();
    const jb = await (await page.$('.jeton[data-liste="terrain"][data-indice="0"]')).boundingBox();
    await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.mouse.down();
    let apercu = "";
    for (let p = 1; p <= 6; p++) {
      await page.mouse.move(bb.x + (jb.x + jb.width / 2 - bb.x) * p / 6, bb.y + (jb.y + jb.height / 2 - bb.y) * p / 6);
      await page.waitForTimeout(25);
      const bulle = await page.$(".fantome .etiquette-apercu");
      if (bulle) apercu = await bulle.textContent();
    }
    await page.mouse.up();
    await page.waitForTimeout(150);
    return apercu;
  };
  const apercu1 = await unDragStaff();
  verifier("drag staff 1 : la carte est posée + aperçu « 1ʳᵉ carte » pendant le survol",
    await page.evaluate(() => partie.staff.length === 1 && (partie.terrain[0].staffCartes || []).length === 1) &&
    apercu1.includes("1ʳᵉ carte"));
  const apercu2 = await unDragStaff();
  verifier("drag staff 2 (consécutif) : aperçu de la spécialisation + demande de confirmation",
    apercu2.includes("→") &&
    await page.evaluate(() => !!document.querySelector("[data-choix='oui']")));
  await page.evaluate(() => document.querySelector("[data-choix='oui']").click());
  verifier("fusion confirmée : spécialisation appliquée, inventaire vidé",
    await page.evaluate(() => partie.staff.length === 0 &&
      ((partie.terrain[0].specialisations || []).length + (partie.terrain[0].emblemes || []).length) >= 1));
  await page.evaluate(() => { document.querySelectorAll(".fusion-banniere, .voile-fiche").forEach((v) => v.remove()); });
  await page.click("#btn-bascule-gauche");

  // ---- Sauvegarde/restauration : recharger la page reprend la partie ----
  const mancheAvant = await page.evaluate(() => { sauvegarder(); return partie.manche; });
  await page.reload();
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });
  verifier("sauvegarde : la partie reprend à la même manche",
    await page.evaluate(() => partie.manche) === mancheAvant);

  verifier("zéro erreur JS sur tout le parcours", erreursJS.length === 0);
  if (erreursJS.length) console.log("   erreurs :", erreursJS.slice(0, 5).join(" | "));

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nParcours complet ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
