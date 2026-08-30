/* ============================================================
   ONZE — LE SYSTÈME DE MATIÈRES (phase 4 du chantier d'habillage).
   ------------------------------------------------------------
   La règle du brief — « plus aucun aplat, tout passe par une des
   quatre matières » — n'est pas une intention : elle est
   vérifiable, et c'est ce que fait cette recette.

   L'INVENTAIRE ci-dessous EST la déclaration : chaque composant de
   chrome y annonce sa matière, et la recette vérifie que le style
   calculé en porte bien la signature. Un composant qu'on ajoute
   sans l'inscrire ici sera attrapé par le contrôle « aucun aplat »,
   qui balaie l'écran entier.

   Les quatre signatures :
     verre  : dégradé · arête haute (ombre interne) · ombre portée · flou d'arrière-plan
     plaque : dégradé · arête haute · ombre portée
     jeton  : dégradé · arête haute · ombre portée courte · bordure
     creux  : dégradé · ombre INTERNE dominante (le vide se lit comme un trou)

   Usage : NODE_PATH=<scratchpad>/node_modules node tests/matieres.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

/* L'inventaire : sélecteur → matière déclarée.
   AMENDÉ PAR LA REFONTE (28/08, décision 74) : la palette introduit la
   matière PANNEAU — un aplat vert-nuit #17301D à 90-95 %, ASSUMÉ (c'est
   le brief de Gabriel, pas un oubli). Le médaillon d'or n'existe plus :
   l'argent est un chiffre nu, l'or est réservé au légendaire — un
   composant qui n'est plus une matière sort de l'inventaire. Le
   calepin, la bascule et le classement permanent ont quitté l'écran
   (menu, fiche d'adversaire). */
const INVENTAIRE = [
  ["#btn-xp", "jeton", "le bouton XP"],
  ["#btn-refresh", "jeton", "le bouton de relance"],
  ["#btn-menu", "jeton", "le bouton du menu"],
  [".odds-affiche span", "jeton", "les pastilles d'odds"],
  [".xp-jauge", "creux", "la jauge d'XP"],
  [".place-banc", "creux", "un emplacement de banc vide"],
  [".fiche-adversaire", "panneau", "la fiche du prochain adversaire"],
  [".rangee-banc", "panneau", "la bande du banc"],
];

/* Les seuls endroits où le VERT NÉON a le droit d'apparaître : un état
   interactif, ou une signalisation dont le sens est déclaré dans la DA. */
const NEON_AUTORISE = [
  ".bouton-jouer", ".principal", "#btn-match",          // l'action principale
  ".prix-carte", ".carte-boutique button",              // acheter
  ".cible", ".choisi", ".jeton.cible-staff",            // cible de glisser, sélection
  ".fusion-banniere", ".banniere-balayage.verte",       // vert = fusion (sens déclaré)
  ".coach-ligne.moi",                                   // le liseré d'appartenance
  ".mini-adn .barre-mini > div.forte",                  // force d'axe (paire vert/rouge signifiante)
  ".fermer", ".volet button",                           // les actions des volets
  /* v2 (décision 77) : le onze de départ arrive avec ses familles — les
     pastilles actives de la rangée mercato (décision 75) existent donc
     dès la manche 1 et la recette les voit enfin. Elles sont TAPPABLES
     (elles se déplient) : « palier atteint » est un état interactif au
     sens déclaré de la DA. */
  ".pastille-synergie.active", ".ecusson-badge.actif",
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const erreursJS = [];
  page.on("pageerror", (e) => erreursJS.push(e.message));
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector("#boutique .carte-boutique", { timeout: 15000 });
  await page.evaluate(async () => {
    arreterChrono();
    // de l'or : on mesure des boutons ACTIFS. Un bouton désactivé est un
    // autre état, avec sa propre matière (le creux) — il a sa mesure à lui
    // juste en dessous.
    partie.or = 40;
    partie.banc = tousLesJoueurs.slice(0, 3).map((f, i) => ({ ...f, etoiles: 1, uid: "mat" + i }));
    afficher();
    await new Promise((r) => setTimeout(r, 300));
  });

  /* ---- 1. CHAQUE COMPOSANT PORTE LA SIGNATURE DE SA MATIÈRE ---- */
  const releve = await page.evaluate((inventaire) => {
    const lire = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const st = getComputedStyle(e);
      /* Découper un box-shadow, c'est découper sur les virgules QUI NE
         SONT PAS dans une parenthèse — « rgba(0, 0, 0, .5) » en contient
         trois. Un simple split(",") ou un remplacement d'« inset » donne
         n'importe quoi : Chromium écrit d'ailleurs « inset » à la FIN de
         chaque ombre, pas au début. C'est ce détail qui faisait échouer
         les trois creux alors qu'ils étaient parfaitement conformes. */
      const couches = [];
      let profond = 0, courant = "";
      for (const c of (st.boxShadow || "")) {
        if (c === "(") profond++;
        if (c === ")") profond--;
        if (c === "," && profond === 0) { couches.push(courant.trim()); courant = ""; } else courant += c;
      }
      if (courant.trim()) couches.push(courant.trim());
      const internes = couches.filter((c) => /inset/.test(c));
      const externes = couches.filter((c) => !/inset/.test(c));
      return {
        degrade: /gradient/.test(st.backgroundImage),
        aplat: st.backgroundImage === "none",
        inset: internes.length > 0,
        portee: externes.length > 0,
        flou: /blur/.test(st.backdropFilter || ""),
        bordure: parseFloat(st.borderTopWidth) > 0 || parseFloat(st.borderLeftWidth) > 0,
        // dans un CREUX, l'ombre interne est seule : rien ne se projette au-dehors
        insetDominant: internes.length > 0 && externes.length === 0,
        couches: couches.length,
      };
    };
    return inventaire.map(([sel, matiere, nom]) => ({ sel, matiere, nom, style: lire(sel) }));
  }, INVENTAIRE);

  const signature = {
    verre: (s) => s.degrade && s.inset && s.portee,
    plaque: (s) => s.degrade && s.inset && s.portee,
    jeton: (s) => s.degrade && s.inset && s.portee && s.bordure,
    creux: (s) => s.degrade && s.insetDominant,
    // refonte 28/08 : le PANNEAU est un aplat vert-nuit assumé
    panneau: (s) => s.aplat,
  };
  const absents = releve.filter((r) => !r.style);
  verifier(`les ${INVENTAIRE.length} composants de l'inventaire sont présents à l'écran`,
    absents.length === 0, absents.map((r) => r.sel).join(", "));
  const fautifs = releve.filter((r) => r.style && !signature[r.matiere](r.style));
  verifier("chaque composant porte la signature de la matière qu'il déclare",
    fautifs.length === 0, JSON.stringify(fautifs.map((r) => [r.nom, r.matiere, r.style])).slice(0, 400));

  /* Un JETON DÉSACTIVÉ s'enfonce : il devient un creux. C'est la même
     grammaire, dans l'autre sens — et ça se vérifie. */
  const eteint = await page.evaluate(() => {
    partie.or = 0; afficher();
    const b = document.getElementById("btn-xp");
    const st = getComputedStyle(b);
    const couches = (st.boxShadow || "").split(/,(?![^(]*\))/).map((c) => c.trim()).filter(Boolean);
    return { desactive: b.disabled, interne: couches.some((c) => /inset/.test(c)),
      externe: couches.some((c) => !/inset/.test(c)) };
  });
  verifier("un jeton désactivé s'enfonce (il passe en matière creux)",
    eteint.desactive && eteint.interne && !eteint.externe, JSON.stringify(eteint));
  await page.evaluate(() => { partie.or = 40; afficher(); });
  await page.waitForTimeout(200);

  /* ---- 2. AUCUN APLAT SUR UN COMPOSANT DE CHROME ----
     On balaie l'écran : tout élément qui peint un fond de couleur UNIE
     assez grand pour être un composant (et qui n'est ni une illustration,
     ni une jauge de remplissage, ni un jeton de joueur) est un aplat. */
  const aplats = await page.evaluate(() => {
    const vertNuit = (c) => { const m = String(c).match(/rgba?\((\d+), ?(\d+), ?(\d+)(?:, ?([\d.]+))?\)/);
      return m && Math.abs(m[1] - 23) < 12 && Math.abs(m[2] - 48) < 14 && Math.abs(m[3] - 29) < 12; };
    const exempt = (e) => e.closest(".jeton, .carte-boutique, .scene-match, .fond-terrain, .art-carte") ||
      // refonte 28/08 (décision 74) : la matière PANNEAU est un aplat vert-nuit VOULU
      vertNuit(getComputedStyle(e).backgroundColor) ||
      e.classList.contains("art-carte") || e.tagName === "IMG" || e.tagName === "SVG" ||
      // les REMPLISSAGES de jauge sont de la donnée peinte, pas du chrome
      e.parentElement && /jauge|barre-|chrono-barre|barre-mini/.test(e.parentElement.className || "");
    const sortie = [];
    for (const e of document.querySelectorAll("#app *")) {
      if (exempt(e)) continue;
      const st = getComputedStyle(e);
      if (st.display === "none" || st.visibility === "hidden") continue;
      const r = e.getBoundingClientRect();
      /* Le plancher de taille : assez bas pour attraper une PASTILLE
         (une pastille d'odds fait 28 × 10 px et c'est bien un composant),
         assez haut pour ignorer les liserés et les traits d'un pixel. */
      if (r.width < 18 || r.height < 8) continue;
      const m = (st.backgroundColor || "").match(/rgba?\(([^)]+)\)/);
      const alpha = m ? (m[1].split(",").length > 3 ? parseFloat(m[1].split(",")[3]) : 1) : 0;
      if (alpha < 0.25) continue;                                   // transparent : rien de peint
      if (st.backgroundImage !== "none") continue;                  // dégradé ou image : une matière
      sortie.push({ cls: (e.className || "").toString().slice(0, 40) || e.id || e.tagName,
        fond: st.backgroundColor, box: [Math.round(r.width), Math.round(r.height)] });
    }
    return sortie;
  });
  verifier(`aucun composant de chrome n'est un aplat (${aplats.length} trouvé(s))`,
    aplats.length === 0, JSON.stringify(aplats.slice(0, 6)));

  /* ---- 3. LE VERT NÉON N'APPARAÎT QUE SUR UN ÉTAT INTERACTIF ---- */
  const neons = await page.evaluate((autorises) => {
    const NEON = /(61,\s*226,\s*107)/;
    const sortie = [];
    for (const e of document.querySelectorAll("#app *")) {
      const st = getComputedStyle(e);
      const peint = [st.color, st.backgroundColor, st.backgroundImage, st.borderTopColor,
        st.borderLeftColor, st.boxShadow, st.outlineColor].join(" | ");
      if (!NEON.test(peint)) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (autorises.some((sel) => { try { return e.matches(sel) || e.closest(sel); } catch (err) { return false; } })) continue;
      sortie.push({ cls: (e.className || "").toString().slice(0, 44) || e.id || e.tagName,
        quoi: NEON.test(st.color) ? "texte" : NEON.test(st.backgroundColor + st.backgroundImage) ? "fond" : "bord" });
    }
    return sortie;
  }, NEON_AUTORISE);
  verifier(`le vert néon reste réservé aux états interactifs (${neons.length} usage(s) hors liste)`,
    neons.length === 0, JSON.stringify(neons.slice(0, 6)));

  /* ---- 4. TYPOGRAPHIE : tout texte clair posé sur le décor porte un halo ---- */
  const halos = await page.evaluate(() => {
    /* Refonte : il ne reste presque plus de texte posé SUR le décor —
       c'était le but (« sur le terrain : uniquement les joueurs »). On
       mesure ce qui y vit encore. */
    const sels = ["#compteur-titulaires", ".fiche-adversaire strong", ".carte-jeton .etoiles-carte"];
    const sortie = [];
    for (const sel of sels) {
      const e = document.querySelector(sel);
      if (!e) continue;
      const st = getComputedStyle(e);
      const clair = (st.color.match(/\d+/g) || [0, 0, 0]).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3 > 110;
      sortie.push({ sel, clair, halo: st.textShadow !== "none" });
    }
    return sortie;
  });
  const sansHalo = halos.filter((h) => h.clair && !h.halo);
  verifier(`tout texte clair posé sur le décor porte un halo sombre (${halos.length} mesurés)`,
    halos.length >= 2 && sansHalo.length === 0, JSON.stringify(sansHalo));

  /* ---- 5. LE GABARIT DE PANNEAU : un volet ouvert est en VERRE ---- */
  await page.evaluate(() => ouvrirCalepin());
  await page.waitForTimeout(350);
  const volet = await page.evaluate(() => {
    const p = document.querySelector(".volet .panneau");
    if (!p) return null;
    const st = getComputedStyle(p);
    const couches = (st.boxShadow || "").split(/,(?![^(]*\))/).map((c) => c.trim());
    const mFond = (st.backgroundColor || "").match(/rgba?\((\d+), ?(\d+), ?(\d+)/);
    return { degrade: /gradient/.test(st.backgroundImage), flou: /blur/.test(st.backdropFilter || ""),
      vertNuit: !!mFond && Math.abs(mFond[1] - 23) < 12 && Math.abs(mFond[2] - 48) < 14 && Math.abs(mFond[3] - 29) < 12,
      inset: couches.some((c) => /inset/.test(c)), portee: couches.some((c) => !/inset/.test(c) && c) };
  });
  verifier(`le gabarit de panneau commun est en matière PANNEAU vert-nuit (refonte, décision 74)`,
    volet && volet.vertNuit === true && volet.flou && volet.portee,
    JSON.stringify(volet));

  verifier("matières : zéro erreur JS", erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s)` : "\nSystème de matières ✅");
  process.exit(echecs ? 1 : 0);
})();
