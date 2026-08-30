/* ============================================================
   ONZE — PHASE 1 v2 : ONZE DÈS LE COUP D'ENVOI (concept-v2 §2,
   décisions 76-77).

   ⚠ ÉCRITE AVANT LE CODE : elle doit sortir rouge sur chaque
   changement qu'elle décrit (règle M3).

   Le contrat, point par point :
     1. LE ONZE DE DÉPART : le terrain compte 11 joueurs dès la
        manche 1 (plus de démarrage à 5).
     2. LES FAMILLES DU DÉPART : chaque joueur du onze de départ
        porte une École ET un archétype (« tirés avec leurs
        familles » — plus de bouche-trous sans synergie).
     3. L'IA JOUE À ONZE : l'équipe d'un coach IA aligne 11
        joueurs dès la manche 1.
     4. PLUS DE MONTÉE 5→11 : quel que soit le niveau du club,
        le nombre de titulaires est 11 ; le banc fait 4 places
        (effectif plafonné à 15).
     5. ACHAT À EFFECTIF PLEIN = REMPLACEMENT : à 15 joueurs,
        acheter n'est PAS bloqué — un volet .volet-remplacement
        propose de désigner qui sort (chaque joueur du club porte
        [data-sortant]) ; après désignation, l'effectif est
        toujours à 15, la recrue est au club, le sortant est
        vendu (l'or récupère son prix de vente).
     6. JAMAIS SOUS ONZE : à 11 joueurs, la vente est refusée —
        un club ne descend jamais sous le onze de départ.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/effectif-v2.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector(".carte-boutique", { timeout: 15000 });
  await page.waitForTimeout(300);

  /* ---- 1 · LE ONZE DE DÉPART ---- */
  const depart = await page.evaluate(() => ({
    terrain: partie.terrain.length, banc: partie.banc.length, manche: partie.manche,
  }));
  verifier("le terrain compte 11 joueurs dès la manche 1",
    depart.manche === 1 && depart.terrain === 11, JSON.stringify(depart));

  /* ---- 2 · LES FAMILLES DU DÉPART ---- */
  const familles = await page.evaluate(() =>
    partie.terrain.map((j) => ({ nom: j.nom, ecole: j.ecole || "", archetype: j.archetype || "" })));
  const sansFamille = familles.filter((j) => !j.ecole || !j.archetype);
  verifier("chaque joueur du onze de départ porte une École ET un archétype",
    familles.length > 0 && sansFamille.length === 0,
    "sans famille : " + JSON.stringify(sansFamille.slice(0, 3)));

  /* ---- 3 · L'IA JOUE À ONZE ---- */
  const ia = await page.evaluate(() => {
    const coach = partie.coachs.find((c) => c.ia && !c.elimine);
    const eq = ONZE_IA.equipeDe(coach, { ECO: ONZE_ECO, M: ONZE, difficulte: partie.difficulte });
    return { nom: coach.nom, joueurs: eq.joueurs.length };
  });
  verifier("l'équipe d'un coach IA aligne 11 joueurs dès la manche 1",
    ia.joueurs === 11, JSON.stringify(ia));

  /* ---- 4 · PLUS DE MONTÉE 5→11, EFFECTIF 15 ---- */
  const plafond = await page.evaluate(() => {
    const parNiveau = [];
    const sauve = partie.niveau;
    for (const n of [3, 5, 8, 10]) { partie.niveau = n; parNiveau.push(maxTitulaires()); }
    partie.niveau = sauve;
    return { parNiveau, banc: ONZE_ECO.TAILLE_BANC };
  });
  verifier("le nombre de titulaires est 11 à tous les niveaux",
    plafond.parNiveau.every((n) => n === 11), JSON.stringify(plafond.parNiveau));
  verifier("le banc fait 4 places (effectif plafonné à 15)",
    plafond.banc === 4, "TAILLE_BANC = " + plafond.banc);

  /* ---- 5 · ACHAT À EFFECTIF PLEIN = REMPLACEMENT ---- */
  const rempl = await page.evaluate(() => {
    // remplir l'effectif à ras bord et se donner de quoi acheter
    let k = 0;
    while (partie.terrain.length + partie.banc.length < maxTitulaires() + ONZE_ECO.TAILLE_BANC)
      partie.banc.push({ nom: "Bouchon " + (++k), cout: 1, poste: "MIL", ecole: "", archetype: "", etoiles: 1, uid: "bouchon-" + k });
    partie.or = 99;
    const indice = partie.boutique.findIndex((f) => f && !f.estIcone);
    if (indice < 0) return { erreur: "boutique vide" };
    const fiche = partie.boutique[indice];
    const avant = { effectif: partie.terrain.length + partie.banc.length, or: partie.or };
    acheter(indice);
    const volet = document.querySelector(".volet-remplacement");
    const sortants = volet ? volet.querySelectorAll("[data-sortant]").length : 0;
    return { recrue: fiche.nom, cout: fiche.cout, avant, voletOuvert: !!volet, sortants };
  });
  verifier("à effectif plein, l'achat ouvre le volet de remplacement (pas de blocage)",
    rempl.voletOuvert, JSON.stringify(rempl));
  verifier("le volet liste tout le club comme sortant possible (15 entrées)",
    rempl.sortants === 15, "entrées : " + rempl.sortants);

  const apres = await page.evaluate((recrue) => {
    const premier = document.querySelector(".volet-remplacement [data-sortant]");
    if (!premier) return { erreur: "pas de sortant cliquable" };
    const nomSortant = premier.getAttribute("data-sortant");
    premier.click();
    const club = [...partie.terrain, ...partie.banc];
    return {
      nomSortant,
      effectif: club.length,
      recrueAuClub: club.some((j) => j.nom === recrue),
      sortantParti: !club.some((j) => (j.uid || j.nom) === nomSortant),
      voletFerme: !document.querySelector(".volet-remplacement"),
    };
  }, rempl.recrue);
  verifier("après désignation du sortant : effectif à 15, la recrue est là, le sortant est parti",
    apres.effectif === 15 && apres.recrueAuClub && apres.sortantParti && apres.voletFerme,
    JSON.stringify(apres));

  /* ---- 6 · JAMAIS SOUS ONZE ---- */
  const plancher = await page.evaluate(() => {
    // ramener l'effectif à 11 exactement, puis tenter une vente
    partie.banc.length = 0;
    while (partie.terrain.length > 11) partie.terrain.pop();
    afficher();
    const avant = partie.terrain.length;
    vendre("terrain", 0);
    return { avant, apres: partie.terrain.length + partie.banc.length };
  });
  verifier("à 11 joueurs, la vente est refusée (jamais sous le onze)",
    plancher.avant === 11 && plancher.apres === 11, JSON.stringify(plancher));

  verifier("zéro erreur JavaScript pendant la recette", erreursJS.length === 0, erreursJS.join(" | "));

  await browser.close();
  console.log(echecs ? `\n${echecs} contrat(s) non tenus.` : "\nTous les contrats de l'effectif v2 sont tenus.");
  process.exit(echecs ? 1 : 0);
})();
