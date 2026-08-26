/* ============================================================
   ONZE — LA CÉRÉMONIE DE BUTIN.
   ------------------------------------------------------------
   Quatre défauts sur un seul objet, dont le plus gros ne se voit
   pas — c'est justement pour ça qu'il est le plus gros.

     1. LE MOMENT. `ramasserOrbes()` est appelée dans
        `finDeManche()`, mais c'est `continuer()` — après que le
        joueur a refermé le bilan — qui détruit la scène et
        masque le tableau. La cérémonie de butin se jouait donc
        PAR-DESSUS un match qu'on n'avait pas rangé : score
        encore affiché, pions encore sur la pelouse, arbitre
        encore là, et deux grosses billes au milieu. Deux moments
        du jeu sur le même écran (décision 64, P2).
     2. LA TAILLE. 42 px de diamètre contre ~20 px pour un
        joueur : rapport 2,03 en diamètre, 4,1 en surface. Le lot
        était quatre fois plus gros que le footballeur qui venait
        de le gagner.
     3. LA PLACE. Position tirée au sort en pourcents du
        conteneur, qui ignorait les colonnes flottantes — une
        orbe à 82 % tombait sur le classement. Et comme il y a un
        `Math.random()`, le défaut est INTERMITTENT : invisible
        pour qui teste trois fois. D'où 20 tirages.
     4. LE GEL. Un rectangle plein écran TOTALEMENT TRANSPARENT
        avalait les touches pendant 900 + n × 900 ms — 2 700 ms
        en coupe. Un blocage qu'on ne voit pas est ressenti comme
        un bug, pas comme une cérémonie (décision 64, P3).
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/orbes.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "petit téléphone", l: 667, h: 375 }];
const TIRAGES = 20;   // le Math.random() impose de répéter

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

async function ouvrir(page) {
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector(".carte-boutique", { timeout: 15000 });
  await page.evaluate(() => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    afficher();
  });
  await page.waitForTimeout(250);
}

/* Deux orbes en attente, la cérémonie lancée à la main : on veut
   l'instant où elles existent, pas la partie entière. */
const POSER = `async (n) => {
  document.querySelectorAll(".orbe-terrain, .volet").forEach((e) => e.remove());
  partie.orbesEnAttente = Array.from({ length: n }, (_, i) => ({
    type: "or", montant: 2, rarete: i === 0 ? "or" : "bleu" }));
  ramasserOrbes(() => {});
  await new Promise((r) => setTimeout(r, 120));
  return document.querySelectorAll(".orbe-terrain").length;
}`;

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await ouvrir(page);

    /* ---- 1 · LE MOMENT : quand une orbe existe, le match est RANGÉ ---- */
    const moment = await page.evaluate(async () => {
      arreterChrono();
      partie.manche = 3;
      preparerManche();
      /* On GARANTIT le butin plutôt que d'espérer qu'une manche en
         produise : sur un petit écran la première tentative n'en donnait
         pas, et la recette annonçait « aucune orbe en 40 s » — elle
         mesurait le tirage du butin, pas le moment de la cérémonie. */
      const vraiRamasser = ramasserOrbes;
      window.ramasserOrbes = function (suite) {
        partie.orbesEnAttente = [{ type: "or", montant: 2, rarete: "or" },
          { type: "or", montant: 3, rarete: "bleu" }];
        return vraiRamasser(suite);
      };
      jouerManche();
      /* On attend la fin de la manche : les orbes tombent à ce moment-là.
         Le plafond DOIT dépasser largement la durée d'un match (~40 s par
         conception) : à 400×100 ms il valait exactement cette durée, sans
         marge, et le verdict dépendait de la vitesse de la machine — rouge
         sur un conteneur lent, vert sur un rapide, même code (même famille
         que la décision 69). 120 s = la durée de conception ×3. */
      let garde = 0;
      while (!document.querySelector(".orbe-terrain") && garde++ < 1200) {
        await new Promise((r) => setTimeout(r, 100));
      }
      const orbe = document.querySelector(".orbe-terrain");
      if (!orbe) return { pasDorbe: true };
      const tableau = document.getElementById("tableau-match");
      return {
        scene: !!document.querySelector(".scene-match"),
        tableauMasque: !!tableau && tableau.classList.contains("masque"),
        pions: document.querySelectorAll(".couche-match canvas, .scene-match canvas").length,
      };
    });
    if (moment.pasDorbe) {
      verifier(`${taille.nom} : une manche produit du butin`, false, "aucune orbe en 120 s");
    } else {
      verifier(`${taille.nom} : quand une orbe existe, la scène de match n'existe plus ` +
        `(un moment, un écran — décision 64 · P2)`, moment.scene === false, JSON.stringify(moment));
      verifier(`${taille.nom} : quand une orbe existe, le tableau de score est masqué`,
        moment.tableauMasque === true, JSON.stringify(moment));
      /* ET AUCUNE ORBE NE TOMBE SOUS UNE COLONNE **EN FIN DE MATCH RÉEL**.
         Le contrôle des 20 tirages se fait sur l'écran de mise en place,
         où les colonnes sont déjà en place — il ne pouvait pas voir le
         défaut. Mesuré : au moment du tirage les colonnes étaient encore
         RÉTRACTÉES pour le match (x = −88 et x = 852) et revenaient à 0 et
         764 une seconde plus tard, leur transition durant 0,28 s. Le
         tirage voyait un écran large, et les colonnes retombaient sur les
         orbes. La cérémonie attend désormais que l'écran soit revenu. */
      const surColonnes = await page.evaluate(async () => {
        await new Promise((r) => setTimeout(r, 700));   // les colonnes ont fini de revenir
        const b = (s) => { const e = document.querySelector(s); if (!e) return null;
          const st = getComputedStyle(e);
          if (st.display === "none" || st.visibility === "hidden") return null;
          const r = e.getBoundingClientRect(); return r.width > 1 ? r : null; };
        const cols = [b(".col-synergies"), b(".col-classement")].filter(Boolean);
        const chocs = [];
        for (const o of document.querySelectorAll(".orbe-terrain")) {
          const r = o.getBoundingClientRect();
          for (const c of cols) {
            const L = Math.max(0, Math.min(r.right, c.right) - Math.max(r.left, c.left));
            const H = Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top));
            if (L > 0.5 && H > 0.5) chocs.push(Math.round(L) + "×" + Math.round(H) + " px");
          }
        }
        return { chocs, orbes: document.querySelectorAll(".orbe-terrain").length,
          colonnes: cols.map((c) => Math.round(c.x)) };
      });
      verifier(`${taille.nom} : en fin de match réel, aucune orbe ne tombe sous une colonne revenue ` +
        `(${surColonnes.orbes} orbe(s), colonnes à ${surColonnes.colonnes.join(" et ")} px)`,
        surColonnes.chocs.length === 0, surColonnes.chocs.join(" | "));
    }

    await page.reload();
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });
    await ouvrir(page);

    /* ---- 2 · LA TAILLE : une orbe ne dépasse pas un joueur ---- */
    const taille2 = await page.evaluate(async ([code]) => {
      await eval(code)(2);
      const orbe = document.querySelector(".orbe-terrain");
      const jetons = [...document.querySelectorAll(".ligne-terrain .jeton")].map((j) => {
        const v = j.querySelector("img.frontale, svg.frontale");
        return (v || j).getBoundingClientRect().width;
      }).filter((w) => w > 2);
      const ro = orbe ? orbe.getBoundingClientRect() : null;
      return { orbe: ro ? ro.width : null,
        joueurMax: jetons.length ? Math.max(...jetons) : null,
        joueurMed: jetons.length ? jetons.sort((a, b) => a - b)[jetons.length >> 1] : null };
    }, [POSER]);
    const rapport = taille2.orbe && taille2.joueurMed ? taille2.orbe / taille2.joueurMed : Infinity;
    verifier(`${taille.nom} : une orbe ne dépasse pas un joueur ` +
      `(${taille2.orbe ? Math.round(taille2.orbe) : "—"} px contre ${taille2.joueurMed ? Math.round(taille2.joueurMed) : "—"} px ` +
      `pour la figurine médiane — rapport ${rapport.toFixed(2)}, plafond 1,00)`,
      rapport <= 1.0, `rapport ${rapport.toFixed(2)}`);

    /* ---- 3 · LA PLACE : jamais sous une colonne, sur 20 tirages ---- */
    let fautifs = 0, pires = [];
    for (let t = 0; t < TIRAGES; t++) {
      const r = await page.evaluate(async ([code]) => {
        await eval(code)(2);
        const boite = (s) => { const e = document.querySelector(s); if (!e) return null;
          const st = getComputedStyle(e);
          if (st.display === "none" || st.visibility === "hidden") return null;
          const q = e.getBoundingClientRect();
          return q.width > 1 ? q : null; };
        const cols = [boite(".col-synergies"), boite(".col-classement")].filter(Boolean);
        const chocs = [];
        for (const o of document.querySelectorAll(".orbe-terrain")) {
          const q = o.getBoundingClientRect();
          for (const c of cols) {
            const L = Math.max(0, Math.min(q.right, c.right) - Math.max(q.left, c.left));
            const H = Math.max(0, Math.min(q.bottom, c.bottom) - Math.max(q.top, c.top));
            if (L > 0.5 && H > 0.5) chocs.push(Math.round(L) + "×" + Math.round(H) + " px");
          }
        }
        return chocs;
      }, [POSER]);
      if (r.length) { fautifs++; if (pires.length < 3) pires.push(`tirage ${t} : ${r.join(", ")}`); }
    }
    /* Ce contrôle est VERT depuis que les colonnes sont passées de 108 à
       80 px (décision 64 · P1) : les orbes tombent entre 16 % et 82 % du
       cadre, ce qui ne les atteint plus. Il est gardé quand même — la
       position est tirée au sort, et rien n'empêche demain d'élargir une
       colonne ou la dispersion. Un garde-fou vert pour une bonne raison
       reste un garde-fou. */
    verifier(`${taille.nom} : sur ${TIRAGES} tirages, aucune orbe ne tombe sous une colonne ` +
      `(${fautifs} tirage(s) fautif(s))`, fautifs === 0, pires.join(" | "));

    /* ---- 4 · LE GEL : aucun bloqueur invisible ----
       On repart d'une page NEUVE : les vingt tirages précédents lancent
       chacun une cérémonie qui pose son voile, et ces voiles ne se
       retirent qu'au bout de leurs 2,7 s. Sans ce rechargement la recette
       en comptait 21 et accusait le jeu d'un défaut qui était le sien. */
    await page.reload();
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });
    await ouvrir(page);
    const gel = await page.evaluate(async ([code]) => {
      await eval(code)(2);
      const muets = [];
      for (const e of document.querySelectorAll("body > *, #app > *")) {
        const st = getComputedStyle(e);
        if (st.pointerEvents === "none" || st.display === "none" || st.visibility === "hidden") continue;
        const q = e.getBoundingClientRect();
        // plein écran (ou presque) ET rien à voir : ni fond, ni image, ni bord
        if (q.width < innerWidth * 0.9 || q.height < innerHeight * 0.9) continue;
        const fond = st.backgroundColor.match(/rgba?\(([^)]+)\)/);
        const alpha = fond ? (fond[1].split(",").length > 3 ? parseFloat(fond[1].split(",")[3]) : 1) : 0;
        const rienAVoir = alpha < 0.02 && st.backgroundImage === "none" &&
          st.borderTopWidth === "0px" && st.boxShadow === "none" && !e.textContent.trim();
        if (rienAVoir) muets.push(e.tagName.toLowerCase() + "." + (e.className || "").toString().split(" ")[0] +
          " z=" + st.zIndex);
      }
      return muets;
    }, [POSER]);
    verifier(`${taille.nom} : aucun bloqueur plein écran invisible pendant la cérémonie ` +
      `(${gel.length} trouvé(s) — décision 64 · P3)`, gel.length === 0, gel.slice(0, 3).join(" | "));

    /* L'AUTRE MOITIÉ DE P3 : « on peut toujours avancer ». Un voile
       visible qui bloque quand même trois secondes reste une attente
       subie. Un tap doit ramasser tout de suite — et surtout NE RIEN
       PERDRE : les orbes non encore ramassées sont résolues, pas jetées. */
    const accelere = await page.evaluate(async () => {
      /* Page propre : appeler d'abord le poseur d'orbes lancerait une
         PREMIÈRE cérémonie avec son propre voile, et le tap tomberait sur
         celui-là. La recette mesurait alors l'accélération d'une
         cérémonie qui n'était pas celle qu'elle observait. */
      document.querySelectorAll(".orbe-terrain, .voile-butin, .volet").forEach((e) => e.remove());
      const orAvant = partie.or;
      let suiteAppelee = false;
      partie.orbesEnAttente = [{ type: "or", montant: 4, rarete: "or" },
        { type: "or", montant: 5, rarete: "bleu" }];
      ramasserOrbes(() => { suiteAppelee = true; });
      await new Promise((r) => setTimeout(r, 120));
      const voile = document.querySelector(".voile-butin");
      const debut = performance.now();
      if (voile) voile.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      return { suiteAppelee, ms: performance.now() - debut,
        gagne: partie.or - orAvant, restantes: document.querySelectorAll(".orbe-terrain:not(.ramassee)").length,
        voileParti: !document.querySelector(".voile-butin") };
    });
    verifier(`${taille.nom} : un tap ramasse tout de suite et ne perd rien ` +
      `(+${accelere.gagne}M encaissés, suite enchaînée en ${Math.round(accelere.ms)} ms au lieu de 2 700, ` +
      `${accelere.restantes} orbe(s) laissée(s))`,
      accelere.suiteAppelee && accelere.voileParti && accelere.gagne >= 9 && accelere.ms < 400,
      JSON.stringify(accelere));

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nLa cérémonie de butin ✅");
  process.exit(echecs ? 1 : 0);
})();
