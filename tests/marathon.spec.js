/* ============================================================
   ONZE — Le MARATHON : des parties complètes en masse, au
   navigateur réel, avec un bot qui traverse toutes les branches
   (philosophies × raretés × relance, hivers, coupes, icônes,
   staff jusqu'à saturation, spécialisations, ventes, fusions,
   verrou multi-manches, clone fantôme) et les cas limites.
   À chaque manche, des INVARIANTS durs :
   - conservation des copies du pool (pool + boutique + mes copies
     + copies des IA = total de départ, à l'unité près)
   - or ≥ 0, staff ≤ 10, 1 gardien max, terrain ≤ taille du club
   - zéro erreur JS, jamais de bannière « Installe ONZE » en match
   Reload aux manches 5 et 11 (reprise de sauvegarde exacte).
   Usage : node tests/marathon.spec.js [nbParties=3]
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const N_PARTIES = Number(process.argv[2]) || 3;
// mode « boost » : le bot reçoit un trésor de guerre à M4/M8 — un
// FORÇAGE DE TEST pour couvrir la branche victoire et l'écran CHAMPION
const BOOST = process.argv.includes("boost");

let echecs = 0;
const verifier = (nom, ok, detail) => {
  if (!ok) { console.log(`❌ ${nom}${detail ? " — " + detail : ""}`); echecs++; }
  return ok;
};

async function unePartie(browser, numero) {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));
  await page.addInitScript(() => {
    try {
      // ne purger qu'au PREMIER chargement — les reloads testent la reprise
      if (!sessionStorage.getItem("marathon-init")) {
        localStorage.clear();
        sessionStorage.setItem("marathon-init", "1");
      }
      localStorage.setItem("onze-commentaire", "on"); // marathon : sans scène (couvre AUSSI ce mode)
      localStorage.setItem("onze-tutoriel-vu", "1");
    } catch (e) {}
  });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });
  // l'accélérateur de test : matchs expédiés (les délais seulement — le
  // moteur, l'économie et les règles restent EXACTEMENT ceux du jeu)
  await page.evaluate(() => {
    window.formatDuMatch = () => ({ phases: partie.manche <= 3 ? 4 : partie.manche <= 9 ? 6 : 8, delaiPhase: 260, delaiEvenement: 30 });
    arreterChrono();
  });

  let relanceTestee = false, manchesJouees = 0, resume = {};
  for (let tour = 0; tour < 42; tour++) {
    // ---- gérer les volets ouverts (philosophie, hiver, fin de partie) ----
    const etatVolet = await page.evaluate(() => {
      const volets = [...document.querySelectorAll(".volet")];
      for (const v of volets) {
        if (v.textContent.includes("Philosophie")) return "philosophie";
        if (v.textContent.includes("Mercato d'hiver")) return "hiver";
        if (v.textContent.includes("CHAMPION") || v.textContent.includes("Éliminé")) return "fin";
      }
      return volets.length ? "autre" : null;
    });
    if (etatVolet === "fin") { resume.fin = true; break; }
    if (etatVolet === "philosophie" && !relanceTestee) {
      relanceTestee = true;
      await page.evaluate(() => { const b = document.querySelector("[data-relance]"); if (b && !b.disabled) b.click(); });
    }
    if (etatVolet) {
      await page.evaluate(() => {
        const volet = [...document.querySelectorAll(".volet")].pop();
        if (!volet) return;
        const choix = volet.querySelector("[data-philo], [data-hiver]");
        if (choix) choix.click();
        else { const b = volet.querySelector("button"); if (b) b.click(); else volet.remove(); }
        arreterChrono();
      });
      await page.waitForTimeout(120);
      continue;
    }

    // ---- le mercato du bot : couvre achats, ventes, XP, verrou, staff ----
    await page.evaluate(({ tour, boost }) => {
      arreterChrono();
      if (boost && (partie.manche === 4 || partie.manche === 8) && !partie["boostM" + partie.manche]) {
        partie["boostM" + partie.manche] = true;
        partie.or += 40; // forçage de test (branche victoire)
      }
      const nbCopies = (nom) => [...partie.terrain, ...partie.banc]
        .filter((j) => j.nom === nom && (j.etoiles || 1) === 1).length;
      for (let passe = 0; passe < 3; passe++) {
        for (let i = 0; i < partie.boutique.length; i++) {
          const f = partie.boutique[i];
          if (!f || partie.or < f.cout) continue;
          if (f.estIcone || nbCopies(f.nom) > 0 || f.cout <= 2 || partie.or > 15) acheter(i);
        }
        if (partie.or >= 10 && passe < 2) refresh();
      }
      // vendre un réserviste du banc de temps en temps (couvre la vente)
      if (tour % 4 === 2 && partie.banc.length > 3) vendre("banc", partie.banc.length - 1);
      // XP
      while (partie.or >= 14 && partie.niveau < 9) acheterXP();
      // le staff : assigner 2 cartes au même joueur (couvre les
      // spécialisations et vide l'inventaire avant saturation)
      while (partie.staff.length >= 2 && partie.terrain.length) {
        const cible = partie.terrain.find((j) => !j.icone) || partie.terrain[0];
        const r1 = ONZE.assignerCarte(cible, partie.staff[0]);
        if (r1 && r1.ok) partie.staff.shift(); else break;
        const r2 = ONZE.assignerCarte(cible, partie.staff[0]);
        if (r2 && r2.ok) partie.staff.shift(); else break;
      }
      // verrou : 2 manches de suite au milieu de partie (cas limite)
      partie.verrou = (partie.manche === 7 || partie.manche === 8);
      // aligner les MEILLEURS (gardien inclus, jamais 2) — sans détruire
      // de copies : personne n'est vendu ici, le banc garde le reste
      const max = TITULAIRES_PAR_NIVEAU[partie.niveau];
      const tousJ = [...partie.terrain, ...partie.banc]
        .sort((a, b) => (b.cout * (b.etoiles || 1)) - (a.cout * (a.etoiles || 1)));
      const gardiens = tousJ.filter((j) => j.poste === "GAR");
      const champ = tousJ.filter((j) => j.poste !== "GAR");
      partie.terrain = [...(gardiens.length ? [gardiens[0]] : []), ...champ].slice(0, max);
      partie.terrain.forEach((j) => { j.ligne = undefined; });
      partie.banc = tousJ.filter((j) => !partie.terrain.includes(j));
      afficher();
    }, { tour, boost: BOOST });

    // ---- les invariants durs ----
    const inv = await page.evaluate(() => {
      const catalogue = new Set(tousLesJoueurs.filter((j) => !j.icone).map((j) => j.nom));
      const copiesDe = (j) => Math.pow(3, (j.etoiles || 1) - 1);
      const mesCopies = [...partie.terrain, ...partie.banc]
        .filter((j) => catalogue.has(j.nom.replace(/ ★+$/, "")) && !j.icone)
        .reduce((t, j) => t + copiesDe(j), 0);
      const copiesIA = partie.coachs.reduce((t, c) => t + (c.copiesPrises ? c.copiesPrises.length : 0), 0);
      const boutiqueReelle = partie.boutique.filter((f) => f && !f.estIcone).length;
      const gardiensTerrain = partie.terrain.filter((j) => (j.ligne || j.poste) === "GAR").length;
      const banniereA2HS = [...document.querySelectorAll("div")].some((d) =>
        d.children.length === 0 && d.textContent.includes("Installe ONZE"));
      return {
        manche: partie.manche, or: partie.or, niveau: partie.niveau,
        totalCopies: partie.pool.length + boutiqueReelle + mesCopies + copiesIA,
        staff: partie.staff.length, gardiensTerrain,
        terrain: partie.terrain.length, max: TITULAIRES_PAR_NIVEAU[partie.niveau],
        banniereA2HS,
      };
    });
    verifier(`P${numero} M${inv.manche} : conservation du pool (${inv.totalCopies})`, inv.totalCopies === 1344, String(inv.totalCopies));
    verifier(`P${numero} M${inv.manche} : or ≥ 0`, inv.or >= 0, String(inv.or));
    verifier(`P${numero} M${inv.manche} : staff ≤ 10`, inv.staff <= 10, String(inv.staff));
    verifier(`P${numero} M${inv.manche} : 1 gardien max`, inv.gardiensTerrain <= 1, String(inv.gardiensTerrain));
    verifier(`P${numero} M${inv.manche} : terrain ≤ taille club`, inv.terrain <= inv.max, inv.terrain + ">" + inv.max);
    verifier(`P${numero} M${inv.manche} : pas de bannière A2HS`, !inv.banniereA2HS);

    // ---- reload de reprise aux manches 5 et 11 ----
    if (inv.manche === 5 || inv.manche === 11) {
      const avant = await page.evaluate(() => { sauvegarder(); return { manche: partie.manche, or: partie.or, effectif: partie.terrain.length + partie.banc.length }; });
      await page.reload();
      await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });
      await page.evaluate(() => {
        window.formatDuMatch = () => ({ phases: partie.manche <= 3 ? 4 : partie.manche <= 9 ? 6 : 8, delaiPhase: 260, delaiEvenement: 30 });
        arreterChrono();
      });
      const apres = await page.evaluate(() => ({ manche: partie.manche, or: partie.or, effectif: partie.terrain.length + partie.banc.length }));
      verifier(`P${numero} M${inv.manche} : reprise de sauvegarde exacte`,
        JSON.stringify(avant) === JSON.stringify(apres), JSON.stringify(apres));
    }

    // ---- jouer la manche ----
    const pretDejaFini = await page.evaluate(() => {
      if (partie.matchEnCours) return "encours";
      const btn = document.getElementById("btn-match");
      if (btn.disabled) { autoCompleter && autoCompleter(); }
      jouerManche();
      return "lancé";
    }).catch(() => "erreur-lancement");
    await page.waitForFunction(() => !!document.getElementById("btn-continuer") ||
      [...document.querySelectorAll(".volet")].some((v) => v.textContent.includes("CHAMPION") || v.textContent.includes("Éliminé")),
      null, { timeout: 45000 }).catch(() => verifier(`P${numero} M${inv.manche} : le match se termine`, false, "timeout"));
    manchesJouees++;
    await page.evaluate(() => {
      document.querySelectorAll(".volet .orbe").forEach((o) => o.click());
    });
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      const b = document.getElementById("btn-continuer");
      if (b) b.click();
      arreterChrono();
    });
    await page.waitForTimeout(120);
  }

  const bilanFinal = await page.evaluate(() => ({
    mancheFinale: partie.manche,
    vivant: partie.coachs.find((c) => !c.ia).vivant,
    vivants: partie.coachs.filter((c) => c.vivant).length,
    finAffichee: [...document.querySelectorAll(".volet")].some((v) =>
      v.textContent.includes("CHAMPION") || v.textContent.includes("Éliminé")),
  }));
  const partieFinie = bilanFinal.vivants <= 1 || !bilanFinal.vivant;
  if (partieFinie) verifier(`P${numero} : la partie se TERMINE proprement (fin affichée)`, bilanFinal.finAffichee, JSON.stringify(bilanFinal));
  else console.log(`   (P${numero} : tours de test épuisés à M${bilanFinal.mancheFinale}, partie encore en cours — pas un échec du jeu)`);
  verifier(`P${numero} : zéro erreur JS (${erreursJS.length})`, erreursJS.length === 0,
    erreursJS.slice(0, 3).join(" | "));
  console.log(`✅ Partie ${numero} : ${manchesJouees} manches, fin M${bilanFinal.mancheFinale}, ` +
    `${bilanFinal.vivant ? "VICTOIRE/vivant" : "éliminé"}, ${erreursJS.length} erreur(s) JS`);
  await page.context().close();
  return { ...bilanFinal, erreursJS: erreursJS.length };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const resultats = [];
  for (let i = 1; i <= N_PARTIES; i++) resultats.push(await unePartie(browser, i));
  await browser.close();
  const victoires = resultats.filter((r) => r.vivant).length;
  console.log(`\n${N_PARTIES} parties : ${victoires} victoires/vivants, ${N_PARTIES - victoires} éliminations`);
  console.log(echecs ? `${echecs} ÉCHEC(S) — à corriger` : "MARATHON COMPLET ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
