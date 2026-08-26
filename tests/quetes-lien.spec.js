/* ============================================================
   ONZE — LE LIEN QUÊTE ↔ JOUEUR (§6 + §10 du brief playtest).
   ------------------------------------------------------------
   Le carnet et les quêtes ne valent pas grand-chose pris
   séparément : deux listes de plus. Ce qui fait leur valeur,
   c'est le va-et-vient — une quête pointe des joueurs, une
   fiche de joueur liste les quêtes qu'il fait avancer. Cette
   recette teste CE LIEN, avant les deux écrans.

   ⚠ ÉCRITE AVANT LE CODE, elle doit sortir ROUGE : le lien
   n'existe pas encore (règle M3, tests/RECETTES.md).

   Les six contrats :
     1. AUCUNE QUÊTE MUETTE — chaque quête déclare son lien :
        soit elle pointe des joueurs (concerne), soit elle dit
        explicitement qu'elle n'en pointe aucun (sansJoueur).
        Une quête qui ne dit rien est un trou dans la relation.
     2. LA RELATION EST SYMÉTRIQUE — j est dans les joueurs de q
        si et seulement si q est dans les quêtes de j. Zéro
        désaccord toléré : deux vues d'une même arête.
     3. ELLE POINTE DES JOUEURS QUI EXISTENT — chaque nom rendu
        est un joueur du catalogue, pas une chaîne libre.
     4. LA FICHE LISTE SES QUÊTES — ouvrir un joueur visé par
        une quête visible montre son nom ET sa progression.
     5. PAS DE BLOC VIDE — un joueur qu'aucune quête visible ne
        vise n'a pas de cadre « quêtes » vide sur sa fiche.
     6. LE RETOUR EST CLIQUABLE — depuis la quête, on atteint le
        joueur : taper un joueur listé sous une quête ouvre sa
        fiche.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/quetes-lien.spec.js
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
  /* Les quêtes visibles sont tirées au hasard à chaque partie. Le
     contrat porte sur le LIEN, pas sur le tirage : on fixe donc un
     jeu de quêtes connu, dont deux pointent des joueurs. */
  await page.evaluate(() => {
    arreterChrono();
    partie.quetesVisibles = ["gus-et-titi", "surdoue", "le-patient"];
  });

  /* ---- 1 · AUCUNE QUÊTE MUETTE ---- */
  const declare = await page.evaluate(() => {
    if (typeof ONZE_ICONES === "undefined") return { pasDIcones: true };
    const muettes = ONZE_ICONES.liste.filter((q) => typeof q.concerne !== "function" && q.sansJoueur !== true);
    return { total: ONZE_ICONES.liste.length, muettes: muettes.map((q) => q.id),
      pointeuses: ONZE_ICONES.liste.filter((q) => typeof q.concerne === "function").length };
  });
  verifier(`chaque quête déclare son lien (${declare.pointeuses || 0} pointent un joueur, ` +
    `${(declare.muettes || []).length} muette(s) sur ${declare.total || 0})`,
    !declare.pasDIcones && declare.muettes && declare.muettes.length === 0,
    (declare.muettes || []).slice(0, 6).join(", "));

  /* ---- 2 et 3 · SYMÉTRIE, ET DES JOUEURS QUI EXISTENT ---- */
  const relation = await page.evaluate(() => {
    if (typeof ONZE_LIEN === "undefined") return { pasDeLien: true };
    const noms = new Set(ONZE_LIEN.catalogue().map((j) => j.nom));
    const desaccords = [];
    const inconnus = [];
    let aretes = 0;
    for (const q of ONZE_ICONES.liste) {
      const cotéQuete = new Set(ONZE_LIEN.joueursDeLaQuete(q.id).map((j) => j.nom));
      for (const n of cotéQuete) if (!noms.has(n)) inconnus.push(q.id + "→" + n);
      aretes += cotéQuete.size;
      for (const j of ONZE_LIEN.catalogue()) {
        const cotéJoueur = ONZE_LIEN.quetesDuJoueur(j).some((x) => x.id === q.id);
        if (cotéJoueur !== cotéQuete.has(j.nom)) desaccords.push(q.id + " ↔ " + j.nom);
      }
    }
    return { aretes, desaccords: desaccords.slice(0, 5), nbDesaccords: desaccords.length,
      inconnus: inconnus.slice(0, 5), nbInconnus: inconnus.length };
  });
  verifier(`la relation est symétrique (${relation.aretes || 0} arêtes, ` +
    `${relation.nbDesaccords === undefined ? "?" : relation.nbDesaccords} désaccord(s))`,
    !relation.pasDeLien && relation.nbDesaccords === 0 && relation.aretes > 0,
    (relation.desaccords || []).join(" | ") || "ONZE_LIEN absent");
  verifier(`elle ne pointe que des joueurs du catalogue (${relation.nbInconnus === undefined ? "?" : relation.nbInconnus} inconnu(s))`,
    !relation.pasDeLien && relation.nbInconnus === 0,
    (relation.inconnus || []).join(" | ") || "ONZE_LIEN absent");

  /* ---- 4 · LA FICHE LISTE SES QUÊTES ---- */
  const fiche = await page.evaluate(async () => {
    if (typeof ONZE_LIEN === "undefined") return { pasDeLien: true };
    // on cherche un joueur du catalogue visé par une quête VISIBLE
    const vise = ONZE_LIEN.catalogue().find((j) => ONZE_LIEN.quetesDuJoueur(j)
      .some((q) => partie.quetesVisibles.includes(q.id)));
    if (!vise) return { aucunVise: true };
    const attendues = ONZE_LIEN.quetesDuJoueur(vise).filter((q) => partie.quetesVisibles.includes(q.id));
    document.querySelectorAll(".voile-fiche").forEach((v) => v.remove());
    ONZE_UI.ouvrirFiche(vise);
    await new Promise((r) => setTimeout(r, 200));
    const bloc = document.querySelector(".voile-fiche .fiche-quetes");
    const texte = bloc ? bloc.textContent : "";
    return { nom: vise.nom, attendues: attendues.map((q) => q.nom), present: !!bloc,
      nomsCites: attendues.filter((q) => texte.includes(q.nom)).length,
      progressionCitee: attendues.some((q) => q.progression && texte.includes(q.progression)) };
  });
  verifier(`la fiche de ${fiche.nom || "?"} liste ses quêtes ` +
    `(${fiche.nomsCites || 0}/${(fiche.attendues || []).length} nommées)`,
    !fiche.pasDeLien && !fiche.aucunVise && fiche.present &&
    fiche.nomsCites === (fiche.attendues || []).length && fiche.progressionCitee,
    JSON.stringify(fiche));

  /* ---- 5 · PAS DE BLOC VIDE ---- */
  const muet = await page.evaluate(async () => {
    if (typeof ONZE_LIEN === "undefined") return { pasDeLien: true };
    const sansQuete = ONZE_LIEN.catalogue().find((j) => !ONZE_LIEN.quetesDuJoueur(j)
      .some((q) => partie.quetesVisibles.includes(q.id)));
    if (!sansQuete) return { tousVises: true };
    document.querySelectorAll(".voile-fiche").forEach((v) => v.remove());
    ONZE_UI.ouvrirFiche(sansQuete);
    await new Promise((r) => setTimeout(r, 200));
    return { nom: sansQuete.nom, bloc: !!document.querySelector(".voile-fiche .fiche-quetes") };
  });
  verifier(`un joueur sans quête visible n'a pas de cadre vide (${muet.nom || "?"})`,
    !muet.pasDeLien && !muet.tousVises && muet.bloc === false, JSON.stringify(muet));

  /* ---- 6 · LE RETOUR EST CLIQUABLE ---- */
  const retour = await page.evaluate(async () => {
    if (typeof ONZE_LIEN === "undefined") return { pasDeLien: true };
    document.querySelectorAll(".voile-fiche, .volet").forEach((v) => v.remove());
    voletQuetes();
    await new Promise((r) => setTimeout(r, 250));
    const cible = document.querySelector(".volet [data-quete-joueur]");
    if (!cible) return { sansCible: true };
    const nom = cible.dataset.queteJoueur;
    cible.click();
    await new Promise((r) => setTimeout(r, 250));
    const f = document.querySelector(".voile-fiche");
    return { nom, ouverte: !!f, bonJoueur: !!f && (f.textContent || "").includes(nom) };
  });
  verifier(`depuis la quête, taper un joueur ouvre sa fiche (${retour.nom || "—"})`,
    !retour.pasDeLien && !retour.sansCible && retour.ouverte && retour.bonJoueur,
    JSON.stringify(retour));

  verifier("zéro erreur JS", erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
  await page.close();
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s) — le lien quête ↔ joueur` : "\nLe lien quête ↔ joueur ✅");
  process.exit(echecs ? 1 : 0);
})();
