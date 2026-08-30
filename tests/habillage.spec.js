/* ============================================================
   ONZE — L'HABILLAGE DE L'ÉCRAN (playtest du 26/08 15:32).
   Six défauts, tous vus sur des captures estampillées, chacun
   ramené à une mesure.

   ⚠ ÉCRITE AVANT LES CORRECTIFS : elle doit sortir rouge sur
   chaque défaut qu'elle prétend attraper (règle M3).

   Les six contrats :
     1. PENDANT LE MATCH, AUCUN PIXEL DU DÉCOR DE PLACEMENT —
        l'arène de nuit en haut et le jardin de jour en dessous,
        c'est deux mondes sur un écran. Quand sceneMatch existe,
        le décor d'entraînement n'existe plus : ni l'image de
        fond, ni aucun élément hors de .scene-match qui peint
        da/terrains/. (Ma moitié du chantier partagé avec la
        conversation scène : le FOND. La surface de jeu est la
        leur — contrat de couture, design/contrat-scene.md.)
     2. LE COMMENTAIRE APPARTIENT À LA SCÈNE — son rectangle vit
        dans celui de la couche de match, jamais sur le décor
        d'en dessous.
     3. LE MÉDAILLON NE CHEVAUCHE AUCUNE CARTE en mercato
        déplié — « Les Revanchards » de la carte Karim passait
        dessous. Il a une place dans la bande basse repliée ; il
        en a une aussi dépliée.
     4. « M 0 M » NE SE LIT PLUS « MAN OF THE MATCH » — à zéro
        million, le jeton s'efface et on lit « 0 M » ; dès 1M le
        jeton revient.
     5. L'EMPLACEMENT VIDE DE LA BOUTIQUE NE PORTE AUCUN GLYPHE —
        ni caractère (déjà couvert par zones.spec.js), ni barre
        peinte en ::after : le creux suffit.
     6. L'INDICE DES SYNERGIES SE FERME AU PREMIER GESTE — en
        manche 1 il couvrait le gardien tant qu'aucune synergie
        n'existait. Premier pointerdown : il part, et il ne
        revient pas au rendu suivant.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/habillage.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [{ nom: "grand téléphone", l: 844, h: 390 }, { nom: "petit téléphone", l: 667, h: 375 }];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    const erreursJS = [];
    page.on("pageerror", (e) => erreursJS.push(e.message));
    await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForSelector(".carte-boutique", { timeout: 15000 });
    await page.evaluate(() => arreterChrono());

    /* ---- 6 · PLUS DE BULLE PERMANENTE, ET L'INDICE VIT AU MENU ----
       AMENDÉ PAR LA REFONTE (28/08, décision 74) : la version d'avant
       fermait la bulle au premier geste ; la refonte la supprime — le
       terrain ne porte QUE les joueurs. AMENDÉ PAR LA v2 (décision 77) :
       le onze de départ arrive AVEC ses familles, donc le club a presque
       toujours des synergies dès la manche 1 — le volet du menu montre
       alors la liste vivante, et l'indice ne sert que le cas (devenu
       rare) du club sans aucune synergie. L'esprit du contrat tient :
       rien sur le terrain, le contenu au menu. */
    const indice = await page.evaluate(async () => {
      const surTerrain = document.querySelector(".indice-synergies");
      ouvrirSynergies();
      await new Promise((r) => setTimeout(r, 200));
      const auVolet = document.querySelector(".volet .indice-synergies");
      const badges = document.querySelectorAll(".volet .synergies [data-famille], .volet .synergies .badge-synergie").length;
      const texte = auVolet ? auVolet.textContent : "";
      document.querySelectorAll(".volet").forEach((v) => v.remove());
      return { surTerrain: !!surTerrain, auVolet: !!auVolet, badges, texte };
    });
    verifier(`${taille.nom} : aucune bulle permanente sur le terrain — le menu porte l'indice ou les synergies vivantes`,
      !indice.surTerrain && (indice.badges > 0 || (indice.auVolet && /École|archétype/.test(indice.texte))),
      JSON.stringify(indice));

    /* ---- 3 · LE MÉDAILLON NE CHEVAUCHE AUCUNE CARTE (mercato déplié) ---- */
    const medaillon = await page.evaluate(() => {
      const m = document.getElementById("medaillon-or");
      if (!m) return { absent: true };
      const rm = m.getBoundingClientRect();
      let pixels = 0; const touchees = [];
      for (const c of document.querySelectorAll(".carte-boutique")) {
        const rc = c.getBoundingClientRect();
        const L = Math.max(0, Math.min(rm.right, rc.right) - Math.max(rm.left, rc.left));
        const H = Math.max(0, Math.min(rm.bottom, rc.bottom) - Math.max(rm.top, rc.top));
        if (L * H > 1) { pixels += Math.round(L * H); touchees.push((c.textContent || "").trim().slice(0, 14)); }
      }
      const barre = document.getElementById("boutique-barre").getBoundingClientRect();
      const dedans = rm.top >= barre.top - 0.5 && rm.bottom <= barre.bottom + 0.5;
      return { pixels, touchees, dedans, repliee: document.getElementById("boutique-barre").classList.contains("repliee") };
    });
    verifier(`${taille.nom} : mercato déplié, le médaillon ne recouvre aucune carte ` +
      `(${medaillon.pixels || 0} px² sur ${(medaillon.touchees || []).length} carte(s))`,
      !medaillon.absent && !medaillon.repliee && medaillon.pixels === 0 && medaillon.dedans,
      JSON.stringify(medaillon));

    /* ---- 4 · « M 0 M » NE SE LIT PLUS « MAN OF THE MATCH » ---- */
    const lecture = await page.evaluate(async () => {
      const lire = () => {
        const m = document.getElementById("medaillon-or");
        const piece = m.querySelector(".piece");
        const pieceVisible = !!piece && piece.getBoundingClientRect().width > 0;
        return { texte: (m.innerText || "").replace(/\s+/g, " ").trim(), pieceVisible };
      };
      const orInitial = partie.or;
      partie.or = 0; afficher();
      await new Promise((r) => setTimeout(r, 100));
      const aZero = lire();
      partie.or = 5; afficher();
      await new Promise((r) => setTimeout(r, 100));
      const aCinq = lire();
      partie.or = orInitial; afficher();
      return { aZero, aCinq };
    });
    verifier(`${taille.nom} : à 0M le jeton s'efface et on lit « ${lecture.aZero.texte} », pas « M 0 M »`,
      lecture.aZero.pieceVisible === false && lecture.aZero.texte === "0 M",
      JSON.stringify(lecture.aZero));
    /* AMENDÉ PAR LA REFONTE : l'or est réservé au légendaire — le jeton
       « M » ne revient plus jamais, à 5M on lit « 5 M » nu. */
    verifier(`${taille.nom} : dès 5M on lit « ${lecture.aCinq.texte} », toujours sans jeton`,
      lecture.aCinq.pieceVisible === false && /^5 M$/.test(lecture.aCinq.texte),
      JSON.stringify(lecture.aCinq));

    /* ---- 5 · L'EMPLACEMENT VIDE NE PEINT AUCUN GLYPHE ---- */
    const creux = await page.evaluate(async () => {
      if (!document.querySelector(".carte-boutique.vendue")) {
        // on libère un emplacement pour de vrai : un achat
        partie.or = 30;
        const i = partie.boutique.findIndex(Boolean);
        if (i >= 0) acheter(i);
        await new Promise((r) => setTimeout(r, 150));
      }
      const v = document.querySelector(".carte-boutique.vendue");
      if (!v) return { aucun: true };
      const ap = getComputedStyle(v, "::after");
      const alpha = (couleur) => { const m = couleur.match(/rgba?\(([^)]+)\)/);
        if (!m) return couleur === "transparent" ? 0 : 1;
        const parts = m[1].split(","); return parts.length === 4 ? parseFloat(parts[3]) : 1; };
      const peint = ap.content !== "none" && parseFloat(ap.width) > 0 && parseFloat(ap.height) > 0 &&
        (alpha(ap.backgroundColor) > 0 || ap.backgroundImage !== "none");
      return { peint, contenu: ap.content, largeur: ap.width, fond: ap.backgroundColor };
    });
    verifier(`${taille.nom} : l'emplacement vide ne peint rien — pas de barre en ::after`,
      !creux.aucun && creux.peint === false, JSON.stringify(creux));

    /* ---- 1 et 2 · PENDANT LE MATCH ---- */
    await page.evaluate(() => jouerManche());
    await page.waitForFunction(() => !!document.querySelector(".scene-match"), { timeout: 20000 })
      .catch(() => {});
    await page.waitForTimeout(1500);
    const match = await page.evaluate(() => {
      if (!document.querySelector(".scene-match")) return { pasDeScene: true };
      const visible = (e) => { if (!e) return false; const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
        const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      // 1 · l'image du décor de placement, et tout ce qui peint da/terrains/ hors scène
      const fond = document.getElementById("fond-terrain");
      const fuites = [...document.querySelectorAll("*")].filter((e) => {
        if (e.closest(".scene-match")) return false;
        if (e === fond) return false;
        const bg = getComputedStyle(e).backgroundImage || "";
        return bg.includes("da/terrains/") && visible(e);
      }).map((e) => e.id || e.className).slice(0, 3);
      // 2 · le commentaire dans le rectangle de la couche
      const bandeau = document.getElementById("bandeau-recit");
      bandeau.textContent = "Mesure : le commentaire vit dans la scène.";
      const rb = bandeau.getBoundingClientRect();
      const rc = document.getElementById("couche-match").getBoundingClientRect();
      const dedans = rb.width > 0 && rb.left >= rc.left - 0.5 && rb.right <= rc.right + 0.5 &&
        rb.top >= rc.top - 0.5 && rb.bottom <= rc.bottom + 0.5;
      bandeau.textContent = "";
      return { fondVisible: visible(fond), fuites, commentaireDedans: dedans,
        rb: { y: Math.round(rb.y), h: Math.round(rb.height) }, rc: { y: Math.round(rc.y), h: Math.round(rc.height) } };
    });
    verifier(`${taille.nom} · match : aucun pixel du décor de placement — l'image de fond a disparu`,
      !match.pasDeScene && match.fondVisible === false, JSON.stringify(match));
    verifier(`${taille.nom} · match : rien hors de la scène ne peint da/terrains/ (${(match.fuites || []).length} fuite(s))`,
      !match.pasDeScene && (match.fuites || []).length === 0, JSON.stringify(match.fuites));
    verifier(`${taille.nom} · match : le commentaire vit dans le rectangle de la couche`,
      !match.pasDeScene && match.commentaireDedans === true,
      JSON.stringify({ bandeau: match.rb, couche: match.rc }));

    verifier(`${taille.nom} : zéro erreur JS`, erreursJS.length === 0, erreursJS.slice(0, 2).join(" | "));
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s) — l'habillage de l'écran` : "\nL'habillage de l'écran ✅");
  process.exit(echecs ? 1 : 0);
})();
