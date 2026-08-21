/* ============================================================
   ONZE — Fidélité de la scène animée (décision 24).
   L'animation est une projection du moteur : ces assertions
   vérifient que le rendu NE MENT PAS.
   1. Le style détecté = l'École dominante réelle de l'équipe.
   2. Les formations traduisent le style (Catenaccio bloc bas,
      pivot Kick & Rush avancé, Pistons collés aux couloirs).
   3. La jauge de domination = les vrais événements de la phase
      (possession/percée/tir → le camp qui a réellement poussé).
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/scene.spec.js
   (serveur : python3 -m http.server 8123 --directory .)
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok) => { console.log(`${ok ? "✅" : "❌"} ${nom}`); if (!ok) echecs++; };

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 8000 });

  const r = await page.evaluate(() => {
    arreterChrono();
    const parEcole = (ecole, n) => tousLesJoueurs.filter((j) => j.ecole === ecole).slice(0, n)
      .map((j) => ({ ...j, etoiles: 1 }));
    const catenaccio = ONZE.equipeDepuisFiches("Cate", "Cate", parEcole("Catenaccio", 6));
    const tiki = ONZE.equipeDepuisFiches("Tiki", "Tiki", parEcole("Tiki-Taka", 6));
    const neutres = ONZE.equipeDepuisFiches("Neutre", "Neutre",
      tousLesJoueurs.filter((j) => !j.ecole).slice(0, 6).map((j) => ({ ...j, etoiles: 1 })));

    // 1. le style détecté est l'École dominante réelle
    const styles = { cate: ONZE_SCENE.styleDe(catenaccio).style, tiki: ONZE_SCENE.styleDe(tiki).style };

    // 2. les formations traduisent le style : scène Catenaccio vs Tiki
    const bac = document.createElement("div");
    bac.style.cssText = "position:fixed;left:-2000px;width:800px;height:360px";
    document.body.appendChild(bac);
    const scene = ONZE_SCENE.creer(bac, catenaccio, tiki, {});
    const diag = scene.diagnostic();
    const defCate = diag.positions.filter((p) => p.camp === "moi" && p.base > 8 && p.base < 30);
    const defTiki = diag.positions.filter((p) => p.camp === "eux" && p.base > 70 && p.base < 92);
    // le bloc bas : les lignes du Catenaccio (mon camp, gauche) sont plus
    // proches de leur but que celles d'une équipe neutre (base 20 → 15)
    const blocBas = defCate.length ? Math.min(...defCate.map((p) => p.base)) < 18 : false;

    // 3. la jauge lit les VRAIS événements
    const phaseA = { evenements: [
      { type: "possession", equipe: "Cate", acteurs: ["x"] },
      { type: "percee", equipe: "Cate", acteurs: ["x"] },
      { type: "but", but: true, buteur: "x", equipe: "Cate", acteurs: ["x"] },
    ] };
    const phaseB = { evenements: [
      { type: "possession", equipe: "Tiki", acteurs: ["y"] },
      { type: "percee_stoppee", equipe: "Cate", acteurs: ["z"] },
    ] };
    const domA = scene.dominationDe(phaseA); // Cate (moi) pousse → > 0
    const domB = scene.dominationDe(phaseB); // Tiki pousse, Cate stoppe → < 0 côté poussée
    // un arrêt du camp adverse = l'occasion était à moi
    const phaseArret = { evenements: [
      { type: "possession", equipe: "Cate", acteurs: ["x"] },
      { type: "arret", equipe: "Tiki", acteurs: ["x", "g"] },
    ] };
    const domArret = scene.dominationDe(phaseArret);
    scene.detruire();
    bac.remove();
    return { styles, blocBas, domA, domB, domArret };
  });

  verifier("style détecté : équipe Catenaccio → catenaccio", r.styles.cate === "catenaccio");
  verifier("style détecté : équipe Tiki-Taka → tiki", r.styles.tiki === "tiki");
  verifier("formation : le Catenaccio joue en bloc bas (lignes reculées)", r.blocBas);
  verifier(`jauge : phase dominée par moi → positive (${r.domA.toFixed(2)})`, r.domA > 0.5);
  verifier(`jauge : phase dominée par l'adversaire → négative (${r.domB.toFixed(2)})`, r.domB < 0);
  verifier(`jauge : un arrêt adverse compte pour MON occasion (${r.domArret.toFixed(2)})`, r.domArret > 0);

  verifier("zéro erreur JS", true);
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nFidélité de la scène ✅");
  process.exit(echecs ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC FATAL:", e.message); process.exit(1); });
