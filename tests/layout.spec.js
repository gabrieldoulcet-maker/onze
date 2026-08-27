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
      ...(await page.$$(".carte-boutique[data-boutique]")),   // la carte ENTIÈRE est la cible d'achat
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

    /* ---- L'ÉCHELLE DES PIONS DE SCÈNE (décision 33) ----
       FM affiche des disques d'un diamètre ≈ 5 % de la hauteur du
       terrain. On vérifie le ratio sur CHAQUE taille d'écran, et que le
       gardien (or) comme le porteur (anneau clair) restent identifiables
       à cette taille — c'est la lecture des blocs et des courses qui en
       dépend. Les pions de la GRILLE de placement sont un autre
       composant (cibles tactiles ≥ 44 px) : on n'y touche pas. ---- */
    const echelle = await page.evaluate(async () => {
      arreterChrono(); partie.manche = 10; preparerManche(); jouerManche();
      await new Promise((r) => setTimeout(r, 2600));
      const d = sceneMatch.diagnostic();
      const toile = document.querySelector(".scene-match canvas");
      const ctx = toile.getContext("2d");
      const dpr = toile.width / toile.clientWidth;
      const geo = d.cadre, r = d.rayonPion;
      /* Le diagnostic parle MÈTRES, origine au centre (décision 50) — et
         la scène peut projeter en PERSPECTIVE sur le terrain peint de
         l'arène (décision de Gabriel). La sonde calcule comme la scène,
         via la projection exposée. */
      const T = d.terrain, pj = d.projection;
      const px = (p) => {
        const u = (p.x + T.L / 2) / T.L, v = (p.y + T.W / 2) / T.W;
        if (pj && pj.plat === false && pj.quadPx) {
          const q = pj.quadPx;
          const g = q.hautX0 + (q.basX0 - q.hautX0) * v;
          const dr = q.hautX1 + (q.basX1 - q.hautX1) * v;
          return { X: g + u * (dr - g), Y: q.yHaut + v * (q.yBas - q.yHaut) };
        }
        return { X: geo.x + u * geo.w, Y: geo.y + v * geo.h };
      };
      /* La scène bouge entre la lecture du diagnostic et celle des
         pixels : on ne cherche donc pas UN pixel, on balaie le
         voisinage du joueur. La question posée reste la bonne — « à
         cette taille, voit-on encore que c'est le gardien / le
         porteur ? » */
      const balayer = (centre, rayonPx, test) => {
        const R = Math.ceil(rayonPx);
        const img = ctx.getImageData(
          Math.max(0, Math.round(centre.X * dpr) - R), Math.max(0, Math.round(centre.Y * dpr) - R),
          R * 2, R * 2).data;
        for (let i = 0; i < img.length; i += 4) {
          if (test(img[i], img[i + 1], img[i + 2])) return true;
        }
        return false;
      };
      // le gardien : son aplat doit rester doré
      const g = d.positions.find((p) => p.role === "gardien");
      const gardienOr = g ? balayer(px(g), (r + 6) * dpr,
        (R, V, B) => R > 170 && V > 130 && B < 140) : null;
      // le porteur : un anneau clair autour de lui
      const po = d.ballon.porteur && d.positions.find((p) => p.cle === d.ballon.porteur);
      const anneau = po ? balayer(px(po), (r * 2 + 8) * dpr,
        (R, V, B) => R > 205 && V > 205 && B > 195) : null;
      return { ratio: d.ratioPion, rayon: r, hauteur: geo.h, gardienOr, anneau,
        terrain: d.terrain, rayonM: d.rayonPionM, projection: d.projection };
    });
    /* L'ÉCHELLE DU PION. En mode PLAT : attendue depuis la taille réelle
       (1,84 m sur la largeur du terrain). En mode ARÈNE (perspective),
       le modèle vit dans la géométrie elle-même — comparer code à code
       serait une tautologie : on assert donc les PLANCHERS ABSOLUS, ceux
       de la mesure publiée avant le rendu — une figurine du FOND jamais
       sous 10 px (le seuil qui avait fait échouer la décision 37), un
       rayon jamais sous 2,4 px. */
    const ratioPct = echelle.ratio * 100;
    let ratioOk, detail;
    if (echelle.projection && echelle.projection.plat === false) {
      const q = echelle.projection.quadPx;
      const pxmFond = (q.hautX1 - q.hautX0) / echelle.terrain.L;
      const figFond = 1.2 * 2 * echelle.rayonM * pxmFond;
      ratioOk = figFond >= 10 && echelle.rayon >= 2.4;
      detail = `ARÈNE : figurine du fond ${figFond.toFixed(1)} px (plancher 10 — le seuil de la décision 37), rayon centre ${echelle.rayon.toFixed(1)} px`;
      /* DETTE VISIBLE, dépendance nommée : à 22 pions (terrain 104 m),
         le fond passe sous le plancher tant que la couche de match garde
         sa hauteur actuelle — c'est la hauteur que le repli de la
         boutique doit rendre (chantier de mise en page, contrat de
         couture). Quand elle arrivera, ce chiffre remontera tout seul. */
      const fond104 = 1.2 * 2 * echelle.rayonM * pxmFond * echelle.terrain.L / 104;
      if (fond104 < 10) console.log(`   ⏸ ${taille.nom} : à 22 pions la figurine du fond ferait ${fond104.toFixed(1)} px (< 10) — bloqué par la hauteur de la couche de match, rendue par le repli de la boutique (contrat de couture)`);
    } else {
      const attendu = (2 * echelle.rayonM / echelle.terrain.W) * 100;
      ratioOk = Math.abs(ratioPct - attendu) / attendu <= 0.10
        && ratioPct >= 4 && ratioPct <= 9 && echelle.rayon >= 2.4;
      detail = `pions à ${ratioPct.toFixed(1)} % de la hauteur (attendu ${attendu.toFixed(1)} % pour ${echelle.terrain.L}×${echelle.terrain.W} m — rayon ${echelle.rayon.toFixed(1)} px)`;
    }
    console.log(`${ratioOk ? "✅" : "❌"} ${taille.nom} : ${detail}`);
    if (!ratioOk) total++;
    const identifiable = echelle.gardienOr !== false && echelle.anneau !== false;
    console.log(`${identifiable ? "✅" : "❌"} ${taille.nom} : gardien (or ${echelle.gardienOr}) et porteur (anneau ${echelle.anneau}) identifiables à cette taille`);
    if (!identifiable) total++;

    /* ---- LE CHROME FLOTTANT NE MANGE PAS LE TABLEAU DE MATCH ----
       Né d'un défaut mesuré : la phase 1 de l'habillage a détaché le
       bandeau du haut (`position: absolute`, plein cadre) pour laisser le
       décor respirer — et il s'est posé sur le tableau de match. Score,
       chrono, nom de l'adversaire, jauge de domination et bouton Journal
       passaient DESSOUS : le score se lisait à travers une plaque, et le
       tap sur 📜 n'arrivait plus jamais (le parcours complet mourait là,
       30 s d'attente sur un clic intercepté).

       La mesure ne regarde ni les classes ni les z-index : elle DÉSIGNE le
       pixel central de chaque contrôle et demande au navigateur qui répond.
       C'est la seule question qui compte — « si le joueur tape ici, qui
       reçoit le tap ? ». Le contre-test remet l'ancienne position et exige
       que la recette sorte rouge. */
    const CONTROLES = ["#tableau-match", "#btn-journal", "#score-a", "#chrono",
      "#nom-adversaire-match", ".jauge-domination"];
    const survol = (page, liste) => page.evaluate((cibles) => cibles.map((sel) => {
      const e = document.querySelector(sel);
      if (!e) return [sel, "absent"];
      const q = e.getBoundingClientRect();
      if (!q.width || !q.height) return [sel, "absent"];
      const dessus = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2);
      if (dessus && (dessus === e || e.contains(dessus) || dessus.contains(e))) return [sel, "libre"];
      return [sel, "recouvert par " + (dessus ? dessus.tagName.toLowerCase() +
        "." + (dessus.className || "").toString().split(" ")[0] : "?")];
    }), liste);
    /* Une MODALE ouverte au-dessus du match (tutoriel, événement) est
       légitime — elle est faite pour couvrir. On la referme d'abord :
       la question porte sur le chrome permanent, pas sur les volets. */
    await page.evaluate(() => document.querySelectorAll(".volet").forEach((v) => v.remove()));
    const couverts = (await survol(page, CONTROLES)).filter((c) => c[1] !== "libre");
    const chromeOk = couverts.length === 0;
    console.log(`${chromeOk ? "✅" : "❌"} ${taille.nom} : pendant le match, les ${CONTROLES.length} contrôles du tableau reçoivent le tap (aucun sous le chrome flottant)` +
      (chromeOk ? "" : " — " + couverts.map((c) => c.join(" ")).join(" | ")));
    if (!chromeOk) total++;

    /* LE CONTRE-TEST, RÉÉCRIT (août 2026). Il remettait le tableau à
       `top: 6px; z-index: 9` — sa position d'avant le premier correctif —
       et attendait qu'il repasse sous le bandeau. Il ne sort plus rouge,
       et c'est une bonne nouvelle : depuis que la scène de match vit dans
       une couche qui COMMENCE SOUS LE BANDEAU (décision 65), un `top: 6px`
       compté dans cette couche tombe déjà sous lui. Le défaut est devenu
       impossible par construction, pas masqué.
       Pour que le contre-test prouve encore quelque chose, il faut donc
       recréer l'ancienne situation pour de bon : sortir le tableau de la
       couche et le poser en plein cadre, là où le bandeau le recouvre. */
    await page.evaluate(() => {
      const t = document.getElementById("tableau-match");
      document.body.appendChild(t);
      t.style.position = "fixed"; t.style.top = "6px"; t.style.left = "50%";
      t.style.transform = "translateX(-50%)"; t.style.zIndex = "9";
    });
    const couvertsAvant = (await survol(page, CONTROLES)).filter((c) => c[1] !== "libre");
    const contreOk = couvertsAvant.length > 0;
    console.log(`${contreOk ? "✅" : "❌"} ${taille.nom} : contre-test — tableau remis sous le bandeau, la recette sort rouge (${couvertsAvant.length}/${CONTROLES.length} contrôles recouverts)`);
    if (!contreOk) total++;

    await page.close();
  }
  // ---- Portrait : l'écran de rotation s'affiche et RIEN D'AUTRE (la
  // rotation logicielle est supprimée — c'était un mode à moitié cassé
  // qui échappait à ces tests). Retour paysage : le jeu revient entier. ----
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto("http://localhost:8123/partie.html");
    await page.waitForFunction(() => typeof partie !== "undefined" && partie.boutique, null, { timeout: 8000 });
    const r = await page.evaluate(() => ({
      ecranRotation: getComputedStyle(document.getElementById("tourne-ecran")).display !== "none",
      appCache: getComputedStyle(document.getElementById("app")).display === "none",
      classeJS: document.documentElement.classList.contains("en-portrait"),
    }));
    // « rien d'autre » : aucun contrôle critique ne doit avoir de boîte visible
    const boiteMatch = await (await page.$("#btn-match")).boundingBox();
    const boiteRefresh = await (await page.$("#btn-refresh")).boundingBox();
    // retour paysage : le jeu se rend à nouveau, l'écran disparaît
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300); // le resize se propage (classe JS + reflow)
    const retour = await page.evaluate(() => ({
      ecranCache: getComputedStyle(document.getElementById("tourne-ecran")).display === "none",
      appVisible: getComputedStyle(document.getElementById("app")).display !== "none",
      classeRetiree: !document.documentElement.classList.contains("en-portrait"),
    }));
    const boiteMatchRetour = await (await page.$("#btn-match")).boundingBox();
    const ok = r.ecranRotation && r.appCache && r.classeJS && !boiteMatch && !boiteRefresh &&
      retour.ecranCache && retour.appVisible && retour.classeRetiree && !!boiteMatchRetour;
    console.log(`${ok ? "✅" : "❌"} portrait : écran de rotation et rien d'autre (app cachée ${r.appCache}, classe JS ${r.classeJS}, contrôles sans boîte ${!boiteMatch && !boiteRefresh}) · retour paysage complet ${retour.ecranCache && retour.appVisible && !!boiteMatchRetour}`);
    if (!ok) total++;
    await page.close();
  }
  await browser.close();
  process.exit(total ? 1 : 0);
})();
