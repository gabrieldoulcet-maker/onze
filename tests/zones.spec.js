/* ============================================================
   ONZE — LA GRILLE DE ZONES.
   ------------------------------------------------------------
   Vingt-sept défauts relevés sur deux captures ordinaires ont
   TOUS la même cause : rien n'a de place réservée. Chaque
   élément est posé en absolu au-dessus des autres et espère que
   ça tombe juste ; quand ça ne tombe pas juste, on monte d'un
   cran de z-index — ce qui est exactement le geste qui a produit
   le bug précédent.

   Cette recette pose la grille comme un CONTRAT MESURÉ, pas
   comme une intention :

     | zone         | ce qui a le droit d'y être              |
     | bandeau haut | état, pastilles de manche, tableau      |
     | bord gauche  | synergies / staff                       |
     | bord droit   | classement                              |
     | terrain      | la scène, et rien d'autre               |
     | bande basse  | banc, boutique, boutons                 |

   Deux assertions, et elles se complètent :
     1. AUCUN rectangle de zone n'en recouvre un autre (0 px) ;
     2. AUCUN texte visible ne se termine par « … ». Un nom
        tronqué n'est pas un détail typographique : c'est une
        zone trop étroite qui le dit à la place du développeur.

   Elle doit sortir ROUGE aujourd'hui — quatre « … » sur la
   capture du jour (« Royal To… », « Mon Clu… », « Titulai… »,
   « Match… ») — et le rester tant que la grille n'est pas posée.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/zones.spec.js
   ============================================================ */
const { chromium } = require("playwright-core");
const EXECUTABLE = process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const TAILLES = [
  { nom: "grand téléphone", l: 844, h: 390 },
  { nom: "grand écran", l: 926, h: 428 },
  { nom: "petit téléphone", l: 667, h: 375 },
];

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

/* CE QUE « ZONE TERRAIN » VEUT DIRE, et il faut le dire avant de mesurer :
   c'est la surface où les joueurs se tiennent, pas l'image de fond. Le
   décor peint garde le droit de couvrir tout le cadre (décision 48) —
   c'est la place RÉSERVÉE qui ne se partage pas, pas les pixels du ciel.
   D'où `#terrain-scene` et non `#fond-terrain`.

   Limite connue de la détection des textes coupés : elle ne voit que les
   FEUILLES de texte que le navigateur clippe réellement. Elle attrape les
   noms de jetons coupés à l'ellipse pendant le match ; elle n'a pas
   reproduit les quatre exemples de la capture (« Royal To… », « Mon
   Clu… », « Titulai… », « Match… ») aux trois formats testés — ils
   dépendent d'un cadrage plus large. Même classe de défaut, occurrences
   différentes : c'est dit plutôt que sous-entendu.

   Les cinq zones, désignées par ce qui les occupe aujourd'hui. Le jour
   où la grille existe pour de bon, ces sélecteurs deviennent des
   conteneurs déclarés ; en attendant on mesure ce qui est là. */
const ZONES = `{
  "bandeau haut": ".haut",
  "bord gauche": ".col-synergies",
  "bord droit": ".col-classement",
  "bande basse": ".boutique-barre"
}`;

const RELEVE = `(zones) => {
  const boite = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return null;
    const st = getComputedStyle(e);
    if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) return null;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
  };
  const rects = {};
  for (const [nom, sel] of Object.entries(zones)) { const b = boite(sel); if (b) rects[nom] = b; }
  /* LA ZONE « TERRAIN » N'EST PAS LE CONTENEUR, C'EST LÀ OÙ SE TIENNENT
     LES JOUEURS. Le conteneur prend tout le cadre depuis la phase 1
     (décision 48 : le décor plein écran, l'information qui flotte
     par-dessus) — exiger qu'aucune zone ne le touche reviendrait à
     défaire cette décision en douce. La question qui compte est
     l'inverse : une pastille de colonne, un bandeau, recouvre-t-il un
     JOUEUR ? On prend donc l'enveloppe des joueurs rendus. */
  const joueurs = [...document.querySelectorAll(".ligne-terrain .jeton, .couche-match .scene-match")]
    .map((e) => e.getBoundingClientRect()).filter((r) => r.width > 2 && r.height > 2);
  if (joueurs.length) {
    rects["terrain"] = { x: Math.min(...joueurs.map((r) => r.x)), y: Math.min(...joueurs.map((r) => r.y)),
      w: 0, h: 0 };
    rects["terrain"].w = Math.max(...joueurs.map((r) => r.x + r.width)) - rects["terrain"].x;
    rects["terrain"].h = Math.max(...joueurs.map((r) => r.y + r.height)) - rects["terrain"].y;
  }
  /* Les chevauchements, deux à deux. Tolérance d'un demi-pixel : deux
     zones qui PARTAGENT UN BORD ne se recouvrent pas — sans ça, un
     arrondi de sous-pixel déclarait « 80 × 0 px » de recouvrement. */
  const noms = Object.keys(rects), chevauche = [];
  for (let i = 0; i < noms.length; i++) for (let j = i + 1; j < noms.length; j++) {
    const a = rects[noms[i]], b = rects[noms[j]];
    const L = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const H = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    if (L > 0.5 && H > 0.5) chevauche.push(noms[i] + " ∩ " + noms[j] + " = " + Math.round(L) + "×" + Math.round(H) + " px");
  }
  /* LES TEXTES TRONQUÉS. On ne cherche pas le caractère « … » écrit à la
     main (personne ne l'écrit) : on cherche les éléments que le
     navigateur COUPE — scrollWidth plus large que clientWidth avec
     text-overflow: ellipsis, ou débordement caché. C'est la seule façon
     de les voir, l'ellipse n'existe pas dans le DOM. */
  const tronques = [];
  for (const e of document.querySelectorAll("body *")) {
    /* Deux façons d'être coupé, et la seconde a failli m'échapper : le
       navigateur qui CLIPPE (feuilles de texte), et l'ellipse ÉCRITE À LA
       MAIN dans un libellé — « ⏱ Match… » porte une icône, donc des
       enfants, donc la première passe l'ignorait. Un « … » posé par le
       code est une troncature comme une autre : il ne dit pas ce qui
       manque. */
    const propre = [...e.childNodes].filter((n) => n.nodeType === 3)
      .map((n) => n.textContent).join("").trim();
    /* ATTENTION : ce bloc vit dans un LITTÉRAL DE GABARIT, où « \\. » se
       résout en « . » avant d'atteindre l'expression régulière — un point
       qui matche n'importe quoi. Écrit simplement, le motif déclarait
       33 à 63 textes tronqués là où il n'y en avait aucun. Les
       échappements se doublent ici. */
    if (propre && /…|\\.\\.\\.\\s*$/.test(propre)) {
      const st0 = getComputedStyle(e);
      const r0 = e.getBoundingClientRect();
      if (st0.display !== "none" && st0.visibility !== "hidden" && r0.width > 4) {
        tronques.push(propre.slice(0, 18) + " (libellé " + e.tagName.toLowerCase() +
          "." + (e.className || "").toString().split(" ")[0] + ")");
        continue;
      }
    }
    if (e.children.length > 0) continue;                     // que les feuilles de texte
    const t = (e.textContent || "").trim();
    if (!t) continue;
    const st = getComputedStyle(e);
    if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const coupeX = e.scrollWidth - e.clientWidth > 1 &&
      (st.textOverflow === "ellipsis" || st.overflowX === "hidden" || st.overflow === "hidden");
    const coupeY = e.scrollHeight - e.clientHeight > 1 &&
      (st.overflowY === "hidden" || st.overflow === "hidden") && st.whiteSpace !== "nowrap";
    if (coupeX || coupeY || /…|\\.\\.\\.$/.test(t)) {
      tronques.push(t.slice(0, 18) + " (" + e.tagName.toLowerCase() + "." +
        (e.className || "").toString().split(" ")[0] + ")");
    }
  }
  return { rects, chevauche, tronques };
}`;

async function ouvrir(page) {
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector(".carte-boutique", { timeout: 15000 });
  await page.evaluate(() => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    partie.niveau = 9;
    const art = tousLesJoueurs.filter((j) => ONZE_PORTRAITS.frontale(j));
    partie.banc = art.slice(0, 9).map((f, i) => ({ ...f, etoiles: (i % 3) + 1, uid: "Z" + i }));
    if (typeof attribuerUids === "function") attribuerUids();
    afficher();
  });
  await page.evaluate(() => Promise.all([...document.images]
    .filter((i) => i.src && !i.complete).map((i) => i.decode().catch(() => {}))));
  await page.waitForTimeout(350);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ["--no-sandbox"] });

  for (const taille of TAILLES) {
    const page = await (await browser.newContext({ viewport: { width: taille.l, height: taille.h } })).newPage();
    await ouvrir(page);

    for (const ecran of ["mise en place", "match"]) {
      if (ecran === "match") {
        await page.evaluate(() => { arreterChrono(); jouerManche(); });
        await page.waitForSelector(".scene-match canvas", { timeout: 20000 });
        await page.waitForTimeout(900);
        await page.evaluate(() => document.querySelectorAll(".volet").forEach((v) => v.remove()));
      }
      const r = await page.evaluate(([code, zones]) => eval(code)(zones),
        [RELEVE, JSON.parse(ZONES)]);
      verifier(`${taille.nom} · ${ecran} : les ${Object.keys(r.rects).length} zones ne se recouvrent pas ` +
        `(la zone « terrain » est l'enveloppe des joueurs rendus, pas le conteneur — voir le commentaire)`,
        r.chevauche.length === 0, r.chevauche.slice(0, 4).join(" | "));
      verifier(`${taille.nom} · ${ecran} : aucun texte visible n'est coupé (${r.tronques.length} tronqué(s))`,
        r.tronques.length === 0, r.tronques.slice(0, 6).join(" | "));

      /* LE GARDE-FOU GÉNÉRAL : « si le joueur tape ici, qui reçoit le
         tap ? » — la question posée au navigateur, pas déduite d'un
         z-index. Née sur le tableau de match ; élargie ici à TOUT ce qui
         se tape, sur LES DEUX écrans, parce que c'est le même défaut à
         chaque fois : les 9 places du banc (le remplaçant que Gabriel
         n'arrivait pas à attraper), les deux colonnes (les quêtes qui
         cachent le banc), les cartes de boutique, et les contrôles du
         match. Une modale ouverte est légitime — elle est faite pour
         couvrir — donc on la referme d'abord. */
      const occlus = await page.evaluate(() => {
        const cibles = [];
        const ajouter = (sel, nom) => document.querySelectorAll(sel)
          .forEach((e, i) => cibles.push([e, `${nom}[${i}]`]));
        ajouter("#banc .jeton[data-liste]", "place de banc");
        ajouter(".ligne-terrain .jeton[data-liste]", "titulaire");
        ajouter(".carte-boutique", "carte de boutique");
        ajouter(".col-synergies > *", "colonne gauche");
        ajouter(".col-classement > *", "colonne droite");
        ajouter("#tableau-match:not(.masque), #btn-journal, #btn-match, #btn-refresh", "contrôle");
        /* ON TESTE LE CENTRE DE CE QUI EST VISIBLE, pas le centre de la
           boîte. Un enfant d'une colonne qui défile a un rectangle plus
           grand que sa fenêtre : `getBoundingClientRect()` rend la boîte
           de mise en page entière, dont une partie est clippée. Viser son
           centre revient à désigner un pixel que personne ne voit — et la
           recette accusait alors la boutique de recouvrir une pastille
           parfaitement rangée. On intersecte donc avec chaque ancêtre qui
           clippe, et avec le cadre. Si rien ne reste visible, l'élément
           est simplement défilé hors champ : ce n'est pas une occlusion. */
        const visible = (e) => {
          let r = e.getBoundingClientRect();
          let x0 = r.x, y0 = r.y, x1 = r.x + r.width, y1 = r.y + r.height;
          for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
            const sp = getComputedStyle(p);
            if (sp.overflow === "visible" && sp.overflowY === "visible" && sp.overflowX === "visible") continue;
            const q = p.getBoundingClientRect();
            x0 = Math.max(x0, q.x); y0 = Math.max(y0, q.y);
            x1 = Math.min(x1, q.x + q.width); y1 = Math.min(y1, q.y + q.height);
          }
          x0 = Math.max(x0, 0); y0 = Math.max(y0, 0);
          x1 = Math.min(x1, innerWidth); y1 = Math.min(y1, innerHeight);
          return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        };
        const rates = [];
        for (const [e, nom] of cibles) {
          const st = getComputedStyle(e);
          if (st.display === "none" || st.visibility === "hidden" || parseFloat(st.opacity) < 0.05) continue;
          if (e.getBoundingClientRect().width < 6) continue;
          const q = visible(e);
          if (q.w < 6 || q.h < 6) continue;         // défilé hors champ, pas recouvert
          const d = document.elementFromPoint(q.x + q.w / 2, q.y + q.h / 2);
          if (d && (d === e || e.contains(d) || d.contains(e))) continue;
          rates.push(nom + " ← " + (d ? d.tagName.toLowerCase() + "." +
            (d.className || "").toString().split(" ")[0] : "rien"));
        }
        return { rates, total: cibles.length };
      });
      verifier(`${taille.nom} · ${ecran} : tout ce qui se tape reçoit le tap ` +
        `(${occlus.total} cibles, ${occlus.rates.length} recouverte(s))`,
        occlus.rates.length === 0, occlus.rates.slice(0, 5).join(" | "));

      /* LE CONTRAT DE COUTURE (design/contrat-scene.md), vérifié en
         pixels. La scène de match vivait DANS le conteneur de la mise en
         place : trois symptômes pour un seul défaut — deux terrains
         empilés, un liseré de 2 px, et 53 des 55 px du banc recouverts. */
      if (ecran === "match") {
        const couture = await page.evaluate(() => {
          const b = (s) => { const e = document.querySelector(s); if (!e) return null;
            const st = getComputedStyle(e);
            if (st.display === "none") return { cache: true };
            const r = e.getBoundingClientRect();
            return { x: r.x, y: r.y, w: r.width, h: r.height, fond: st.backgroundImage }; };
          const banc = document.querySelector("#banc");
          const bandeau = document.querySelector(".haut");
          return { terrain: b("#terrain-scene"), fond: b("#fond-terrain"), scene: b(".scene-match"),
            hautBanc: banc ? banc.getBoundingClientRect().y : null,
            basBandeau: bandeau ? bandeau.getBoundingClientRect().bottom : null,
            peint: document.querySelector(".plateau").classList.contains("terrain-peint") };
        });
        verifier(`${taille.nom} · match : le conteneur de mise en place a disparu de l'écran ` +
          `(pas seulement couvert)`, !!couture.terrain && couture.terrain.cache === true,
          JSON.stringify(couture.terrain));
        /* CLAUSE (c), AMENDÉE PAR LA MESURE. Elle disait « le rectangle de
           la scène est exactement celui du décor ». Prise au pied de la
           lettre, elle mettait le bandeau flottant sur le terrain animé —
           844 × 41 px. La règle qui manquait existait déjà sur l'autre
           écran : « le bandeau flotte en haut du décor, donc rien ne doit
           pousser au-dessus de lui » (`margeHaut`). La scène prend donc la
           LARGEUR du décor à l'unité près, commence SOUS le bandeau, et
           s'arrête au banc. Le décor, lui, reste plein cadre. */
        const s2 = couture.scene, f2 = couture.fond;
        const memeLargeur = s2 && f2 && !s2.cache && !f2.cache &&
          Math.abs(s2.x - f2.x) < 0.5 && Math.abs(s2.w - f2.w) < 0.5;
        const sousBandeau = s2 && couture.basBandeau !== null &&
          Math.abs(s2.y - couture.basBandeau) < 6;
        const sarrete = s2 && couture.hautBanc !== null && Math.abs((s2.y + s2.h) - couture.hautBanc) < 0.5;
        verifier(`${taille.nom} · match : la scène prend la largeur du décor, commence sous le bandeau ` +
          `et s'arrête au banc (scène ${s2 ? Math.round(s2.w) + "×" + Math.round(s2.h) : "—"} à y=${s2 ? Math.round(s2.y) : "—"}, ` +
          `décor ${f2 ? Math.round(f2.w) : "—"} px de large, bandeau jusqu'à ${Math.round(couture.basBandeau)} px, ` +
          `banc à ${Math.round(couture.hautBanc)} px)`,
          memeLargeur && sousBandeau && sarrete,
          JSON.stringify({ scene: s2, largeurDecor: f2 && f2.w, basBandeau: couture.basBandeau, hautBanc: couture.hautBanc }));
        verifier(`${taille.nom} · match : sur décor peint, la scène ne peint pas son propre sol`,
          !couture.peint || (s2 && s2.fond === "none"), s2 ? String(s2.fond).slice(0, 60) : "—");

        /* LES COLONNES SE RÉTRACTENT, ET ON PEUT LES RAPPELER (décision
           65). Deux moitiés, et la seconde compte autant : elles GLISSENT
           hors cadre — pas de disparition sèche — et un onglet fin reste,
           qui les ramène. Sans lui, l'information serait perdue au lieu
           d'être rangée. */
        const retrait = await page.evaluate(async () => {
          const lire = () => {
            const g = document.querySelector(".col-synergies").getBoundingClientRect();
            const d = document.querySelector(".col-classement").getBoundingClientRect();
            const og = document.getElementById("onglet-gauche");
            const od = document.getElementById("onglet-droite");
            const vu = (e) => e && getComputedStyle(e).display !== "none" &&
              e.getBoundingClientRect().width > 4;
            return { gDroite: g.x + g.width, dGauche: d.x, onglets: vu(og) && vu(od) };
          };
          const range = lire();
          document.getElementById("onglet-gauche").click();
          await new Promise((r) => setTimeout(r, 420));
          const rappele = lire();
          document.getElementById("onglet-gauche").click();
          await new Promise((r) => setTimeout(r, 420));
          return { range, rappele, largeur: innerWidth };
        });
        const sorties = retrait.range.gDroite <= 0.5 && retrait.range.dGauche >= retrait.largeur - 0.5;
        verifier(`${taille.nom} · match : les colonnes glissent hors cadre et leurs onglets restent ` +
          `(bord droit de la gauche à ${Math.round(retrait.range.gDroite)} px, bord gauche de la droite à ` +
          `${Math.round(retrait.range.dGauche)} px sur ${retrait.largeur})`,
          sorties && retrait.range.onglets,
          JSON.stringify(retrait.range));
        verifier(`${taille.nom} · match : l'onglet rappelle la colonne ` +
          `(elle revient à ${Math.round(retrait.rappele.gDroite)} px)`,
          retrait.rappele.gDroite > retrait.range.gDroite + 20,
          JSON.stringify(retrait.rappele));
      }

      /* LES DEUX COLONNES NE MANGENT PAS L'ÉCRAN. Mesuré : 108 + 104 px
         sur 844, soit 25 % de la largeur pour de l'information de
         CONSULTATION, pendant que le terrain — le sujet — se serre au
         milieu. Trois contrats : collées au bord (la marge vient du seul
         `env(safe-area-inset-*)`), ≤ 80 px chacune au repos, et ≤ 20 %
         de l'écran à elles deux. Ce qui ne tient pas se replie derrière
         son bouton, il ne s'étale pas. */
      const colonnes = await page.evaluate(() => {
        const lire = (sel, cote) => {
          const e = document.querySelector(sel);
          if (!e) return null;
          const st = getComputedStyle(e);
          if (st.display === "none" || st.visibility === "hidden") return null;
          const r = e.getBoundingClientRect();
          return { sel, largeur: r.width,
            marge: cote === "gauche" ? r.x : innerWidth - (r.x + r.width) };
        };
        const g = lire(".col-synergies", "gauche"), d = lire(".col-classement", "droite");
        return { g, d, ecran: innerWidth };
      });
      const cols = [colonnes.g, colonnes.d].filter(Boolean);
      if (cols.length === 2) {
        const somme = cols.reduce((n, c) => n + c.largeur, 0);
        const part = somme / colonnes.ecran;
        const large = cols.filter((c) => c.largeur > 80);
        const decollees = cols.filter((c) => c.marge > 8);
        verifier(`${taille.nom} · ${ecran} : les deux colonnes rendent l'écran au terrain ` +
          `(${cols.map((c) => Math.round(c.largeur) + " px").join(" + ")} = ${(part * 100).toFixed(0)} % ` +
          `de ${colonnes.ecran} px — plafonds 80 px chacune et 20 % à elles deux)`,
          part <= 0.20 && large.length === 0,
          `${large.length} colonne(s) au-dessus de 80 px, ensemble à ${(part * 100).toFixed(0)} %`);
        verifier(`${taille.nom} · ${ecran} : les deux colonnes sont collées aux bords ` +
          `(marges ${cols.map((c) => Math.round(c.marge) + " px").join(" · ")}, la sécurité vient du seul safe-area)`,
          decollees.length === 0, decollees.map((c) => `${c.sel} à ${Math.round(c.marge)} px du bord`).join(" | "));
      }
    }
    await page.close();
  }

  await browser.close();
  console.log(echecs ? `\n${echecs} échec(s) — la grille de zones n'est pas posée` : "\nGrille de zones ✅");
  process.exit(echecs ? 1 : 0);
})();
