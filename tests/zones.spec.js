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
const fs = require("fs");
const path = require("path");
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

/* LE TOAST DE REPRISE N'EXISTE QU'AU RETOUR D'UNE SAUVEGARDE. C'est un
   ÉTAT, pas une géométrie : `signaler("💾 Partie reprise…")` ne part que
   dans `restaurer()`. Une recette qui démarre une partie neuve ne le voit
   jamais — et le contre-test du toast restait muet pour cette raison, pas
   parce que le format différait. On fait donc jouer une manche, on
   sauvegarde, et on RECHARGE : le jeu reprend et le message part. */
async function reprendreUneSauvegarde(page) {
  await page.evaluate(() => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    partie.manche = 12;
    if (typeof sauvegarder === "function") sauvegarder();
  });
  await page.reload();
  await page.waitForSelector(".carte-boutique", { timeout: 15000 });
  await page.waitForTimeout(250);
  // le message a rejoint la file d'annonces : il n'a plus de classe à lui
  return page.evaluate(() => {
    const z = document.getElementById("file-annonces");
    return !!(z && !z.classList.contains("masque") && (z.textContent || "").trim());
  });
}

async function ouvrir(page) {
  await page.addInitScript(() => { try { localStorage.setItem("onze-tutoriel-vu", "1"); } catch (e) {} });
  await page.goto("http://localhost:8123/partie.html");
  await page.waitForSelector(".carte-boutique", { timeout: 15000 });
  await page.evaluate(() => {
    arreterChrono();
    document.querySelectorAll(".volet").forEach((v) => v.remove());
    partie.niveau = 9;
    // un emplacement de boutique VIDE, pour que l'assertion qui le vise
    // s'exécute vraiment : un contrôle qui ne tourne pas ne dit rien
    if (partie.boutique && partie.boutique.length > 2) partie.boutique[2] = null;
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
  /* UNE ESTAMPILLE SE VÉRIFIE CONTRE CE QU'ELLE PRÉTEND NOMMER.
     Première version : elle affichait une RÉVISION et se vérifiait contre
     les `mtime` des fichiers — deux choses différentes, et c'est l'écart
     entre les deux qui l'a laissée passer. Deux défauts en découlaient :

       · un `git pull`, un `checkout`, un `merge` ou un clone réécrivent
         tous les `mtime` à maintenant. La recette serait sortie ROUGE À
         TORT après chaque récupération — et j'aurais pris le réflexe de
         ré-estampiller jusqu'au vert, l'inverse exact d'un garde-fou ;
       · sur GitHub Pages il n'y a pas de `mtime` du tout : le mécanisme
         protégeait l'atelier, pas l'artefact que Gabriel photographie,
         qui est toute la raison de l'estampille.

     L'estampille ne nomme plus qu'UN MOMENT DE FABRICATION. On la vérifie
     donc contre les dates de commit, qui disent la même chose :
       · arbre PROPRE — l'estampille doit tomber entre le commit
         précédent et le commit courant : elle a bien été faite POUR ce
         commit-là ;
       · arbre SALE — elle doit être postérieure au dernier commit :
         elle couvre le travail en cours.
     Le `mtime` reste imprimé comme signal secondaire ; il ne rend plus le
     verdict. */
  const racine = path.join(__dirname, "..");
  const git = (...a) => {
    const r = require("child_process").spawnSync("git", a, { encoding: "utf8", cwd: racine });
    return r.status === 0 ? (r.stdout || "").trim() : "";
  };
  const version = (() => {
    try {
      const brut = fs.readFileSync(path.join(racine, "version.js"), "utf8");
      const m = brut.match(/horodatage:\s*"([^"]+)"/);
      return m ? new Date(m[1]) : null;
    } catch (e) { return null; }
  })();
  const sale = !!git("status", "--porcelain");
  const dateTete = git("log", "-1", "--format=%cI");
  const dateParent = git("log", "-1", "--format=%cI", "HEAD~1");
  const tete = dateTete ? new Date(dateTete) : null;
  const parent = dateParent ? new Date(dateParent) : new Date(0);
  /* Une seconde de tolérance : git n'enregistre pas les millisecondes. */
  const TOLERANCE = 1500;
  let verdict = false, pourquoi = "";
  if (!version) pourquoi = "version.js absent — lance « node outils/estampiller.js »";
  else if (!tete) { verdict = true; pourquoi = "aucun commit : rien à comparer"; }
  else if (sale) {
    verdict = version.getTime() >= tete.getTime() - TOLERANCE;
    pourquoi = verdict ? "" : "l'estampille est antérieure au dernier commit alors que l'arbre porte des modifications";
  } else {
    verdict = version.getTime() > parent.getTime() &&
      version.getTime() <= tete.getTime() + TOLERANCE;
    pourquoi = verdict ? "" : "l'estampille ne tombe pas dans la fenêtre du commit courant";
  }
  // signal secondaire : le fichier de jeu le plus récemment touché
  const fichiersJeu = [];
  for (const f of fs.readdirSync(racine)) {
    if (f !== "version.js" && /\.(html|css|js)$/.test(f)) fichiersJeu.push(path.join(racine, f));
  }
  const plusRecent = fichiersJeu.reduce((max, f) => {
    const t = fs.statSync(f).mtime;
    return t > max.t ? { t, f: path.basename(f) } : max;
  }, { t: new Date(0), f: "—" });
  verifier(`l'estampille nomme bien le build courant ` +
    `(écrite ${version ? version.toISOString().slice(5, 16).replace("T", " ") : "jamais"}, ` +
    `arbre ${sale ? "avec modifications" : "propre"}, dernier commit ` +
    `${tete ? tete.toISOString().slice(5, 16).replace("T", " ") : "—"}` +
    ` · signal secondaire : ${plusRecent.f} modifié ${plusRecent.t.toISOString().slice(5, 16).replace("T", " ")})`,
    verdict, pourquoi);

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

        /* RÉTRACTÉE VEUT DIRE PARTIE, PAS SEULEMENT DÉCALÉE. Les colonnes
           glissaient mais restaient entièrement LISIBLES pendant le match,
           et les languettes se dessinaient par-dessus — sur une capture,
           la languette gauche coupait les mots d'une infobulle. Deux
           choses à exiger, et la seconde manquait :
             · le rectangle d'une colonne rétractée est hors du cadre ;
             · aucune languette ne recouvre une colonne. */
        const dehors = await page.evaluate(() => {
          const b = (s) => { const e = document.querySelector(s); if (!e) return null;
            const st = getComputedStyle(e); const r = e.getBoundingClientRect();
            return { x: r.x, right: r.right, w: r.width, top: r.top, bottom: r.bottom,
              vu: st.display !== "none" && st.visibility !== "hidden" && parseFloat(st.opacity) > 0.05 }; };
          const g = b(".col-synergies"), d = b(".col-classement");
          const og = b("#onglet-gauche"), od = b("#onglet-droite");
          const chevauche = (a, c) => {
            if (!a || !c || !a.vu || !c.vu) return 0;
            const L = Math.max(0, Math.min(a.right, c.right) - Math.max(a.x, c.x));
            const H = Math.max(0, Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top));
            return Math.round(L * H);
          };
          return { g, d, largeur: innerWidth,
            ongletSurColonne: chevauche(og, g) + chevauche(od, d) };
        });
        const gPartie = !dehors.g.vu || dehors.g.right <= 0.5;
        const dPartie = !dehors.d.vu || dehors.d.x >= dehors.largeur - 0.5;
        verifier(`${taille.nom} · match : une colonne rétractée est hors du cadre, pas seulement décalée ` +
          `(gauche : droite à ${Math.round(dehors.g.right)} px${dehors.g.vu ? "" : ", invisible"} · ` +
          `droite : gauche à ${Math.round(dehors.d.x)} px sur ${dehors.largeur}${dehors.d.vu ? "" : ", invisible"})`,
          gPartie && dPartie, JSON.stringify({ g: dehors.g, d: dehors.d }));
        verifier(`${taille.nom} · match : aucune languette ne recouvre une colonne ` +
          `(${dehors.ongletSurColonne} px² de recouvrement)`,
          dehors.ongletSurColonne === 0);
      }

      /* UNE CAPTURE D'ÉCRAN DIT DE QUAND ELLE DATE (règle M3 ter).
         Le même jour, la même erreur des deux côtés : j'ai annoncé une
         recette rouge en relisant un RAPPORT plus vieux que le code, et
         Gabriel a redemandé un correctif livré depuis deux jours en
         mesurant une CAPTURE plus vieille que le code. Le lanceur de
         recettes s'estampille ; le jeu devait faire le miroir.
         L'estampille vit dans le bandeau du haut — la seule zone présente
         sur TOUTES les captures — et elle est vérifiée sur les deux
         écrans : une estampille que le match masquerait ne servirait à
         rien, puisque c'est le match qu'on capture le plus. */
      const estampille = await page.evaluate(() => {
        const e = document.getElementById("estampille");
        if (!e) return { absente: true };
        const st = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return { texte: (e.textContent || "").trim(),
          vue: st.display !== "none" && st.visibility !== "hidden" && parseFloat(st.opacity) > 0.05 && r.width > 4,
          horsCadre: r.right > innerWidth + 0.5 || r.x < -0.5,
          coupee: e.scrollWidth - e.clientWidth > 1 };
      });
      verifier(`${taille.nom} · ${ecran} : la capture dit de quelle version elle date ` +
        `(« ${estampille.texte || "—"} »)`,
        !estampille.absente && estampille.vue && !estampille.horsCadre && !estampille.coupee &&
        /\d\d\/\d\d/.test(estampille.texte || ""), JSON.stringify(estampille));

      /* LA LARGEUR DES CARTES EST RÉSERVÉE EN PREMIER (décision 64 · P1).
         Le modèle de la bande basse était à l'envers : les deux blocs
         latéraux avaient une largeur RÉSERVÉE (`flex: 0 0 96px` et
         `0 0 84px`) et les cinq cartes prenaient « le reste »
         (`flex: 1`). Tout ce qui grossit sur un côté les rétrécit donc en
         silence — deux fois de suite : l'étiquette « chances » (8 px),
         puis le bloc de boutons qui accueillait l'action principale. Deux
         occurrences, ce n'est plus un incident, c'est le modèle.
         L'assertion pose la règle : **la largeur d'une carte ne bouge pas
         quand le chrome change.** On mesure une carte, on fait grossir un
         bloc latéral, on remesure. */
      if (ecran === "mise en place") {
        const cartes = await page.evaluate(async () => {
          const largeur = () => {
            const c = document.querySelector("#boutique .carte-boutique");
            return c ? c.getBoundingClientRect().width : 0;
          };
          const avant = largeur();
          /* ON FAIT GROSSIR LE CHROME COMME LA VRAIE VIE LE FAIT : en y
             AJOUTANT DU CONTENU. Une première version forçait un
             `min-width` sur le bloc — un instrument plus fort que le
             réel, qui passe par-dessus le plafond censé être le
             correctif : la recette serait restée rouge quoi qu'on fasse.
             Les deux incidents étaient une étiquette et un bouton de
             plus ; c'est donc ça qu'on injecte. */
          const bloc = document.querySelector(".bloc-xp");
          const intrus = document.createElement("button");
          intrus.textContent = "Un libellé nettement plus long";
          intrus.style.whiteSpace = "nowrap";
          bloc.appendChild(intrus);
          await new Promise((r) => setTimeout(r, 150));
          const apres = largeur();
          intrus.remove();
          await new Promise((r) => setTimeout(r, 150));
          return { avant, apres, retour: largeur(), nb: document.querySelectorAll("#boutique .carte-boutique").length };
        });
        verifier(`${taille.nom} : la largeur d'une carte de boutique ne bouge pas quand le chrome grossit ` +
          `(${cartes.avant.toFixed(1)} px → ${cartes.apres.toFixed(1)} px avec 40 px de chrome en plus, ` +
          `${cartes.nb} cartes)`,
          cartes.nb === 5 && Math.abs(cartes.apres - cartes.avant) < 0.5,
          `la carte a perdu ${(cartes.avant - cartes.apres).toFixed(1)} px`);
      }

      /* LE MOBILIER TIENT DANS SA ZONE (§9.6, décision 64 · P1). Chaque
         meuble a une place réservée ; aucun ne vit à cheval sur une
         couture. Trois qui l'étaient :
           · le médaillon d'or, à `top: -13px`, dont 12 des 22 px
             dépassaient au-dessus de la barre de boutique — coupé en deux
             par son bord, on n'en voyait que la moitié haute ;
           · le toast, à `bottom: 110px`, posé sur les cartes de boutique.
             **Mon premier diagnostic était faux** : j'avais mis le
             contre-test muet sur le compte du format de la capture, qui
             fait 844 × 390 à densité 3 — exactement le format que je
             testais. La vraie cause du silence était un ÉTAT : le message
             « 💾 Partie reprise » ne part qu'au retour d'une sauvegarde,
             et les recettes démarraient toutes des parties neuves. Le
             toast n'existait donc **jamais** chez elles. La recette
             reprend maintenant une vraie sauvegarde.

             **Et le contre-test mord — mais pas partout, et il faut le
             chiffrer plutôt que de le laisser entendre.** Remis à
             `bottom: 110px` : il recouvre 2 cartes en **926 × 428**, et
             **aucune en 844 × 390**, où son bas tombe à 280 px pour des
             cartes qui commencent à 291 — **11 px d'écart**. Un message
             plus long ne change rien : le toast grandit vers le HAUT (son
             bas reste à 280). Trois hypothèses vérifiées, aucune ne
             reproduit le recouvrement au format de la capture ; je
             n'invente pas la quatrième. Il est déplacé parce qu'un
             message ne se pose pas sur ce qu'on regarde, et l'assertion
             garde les trois formats ;
           · l'emplacement libre de la boutique, un grand rectangle sombre
             portant un tiret — la troisième forme de placeholder de
             l'écran, et celle qui lisait le plus comme une image cassée. */
      // le toast doit EXISTER pour qu'on puisse dire où il se pose
      const toastVu = ecran === "mise en place" ? await reprendreUneSauvegarde(page) : false;
      const meubles = await page.evaluate(() => {
        const dedans = (sel, parent) => {
          const e = document.querySelector(sel), p = document.querySelector(parent);
          if (!e || !p) return null;
          const st = getComputedStyle(e);
          if (st.display === "none" || st.visibility === "hidden") return { absent: true };
          const r = e.getBoundingClientRect(), q = p.getBoundingClientRect();
          return { sel, hautDehors: Math.round(q.top - r.top), basDehors: Math.round(r.bottom - q.bottom),
            gaucheDehors: Math.round(q.left - r.left), droiteDehors: Math.round(r.right - q.right) };
        };
        const z = document.getElementById("file-annonces");
        const t = z && !z.classList.contains("masque") && (z.textContent || "").trim() ? z : null;
        const cartes = [...document.querySelectorAll(".carte-boutique")].map((e) => e.getBoundingClientRect());
        let surCartes = 0;
        if (t) { const rt = t.getBoundingClientRect();
          for (const c of cartes) {
            const L = Math.max(0, Math.min(rt.right, c.right) - Math.max(rt.left, c.left));
            const H = Math.max(0, Math.min(rt.bottom, c.bottom) - Math.max(rt.top, c.top));
            if (L * H > 4) surCartes++;
          } }
        // l'emplacement libre ne porte plus de caractère
        const vide = document.querySelector(".carte-boutique.vendue");
        return { medaillon: dedans("#medaillon-or", ".boutique-barre"), toastSurCartes: surCartes,
          videTexte: vide ? (vide.textContent || "").trim() : null, videExiste: !!vide };
      });
      const m = meubles.medaillon;
      const deborde = m && !m.absent && Math.max(m.hautDehors, m.basDehors, m.gaucheDehors, m.droiteDehors) > 0;
      verifier(`${taille.nom} · ${ecran} : le médaillon d'or tient dans la bande basse ` +
        `(dépassements haut ${m && m.hautDehors} · bas ${m && m.basDehors} px)`,
        !!m && !deborde, JSON.stringify(m));
      if (ecran === "mise en place") {
        verifier(`${taille.nom} : le toast de reprise existe (sans lui, l'assertion suivante ne dit rien)`,
          toastVu === true, "aucun message flottant après reprise d'une sauvegarde");
        verifier(`${taille.nom} : le toast de reprise ne se pose pas sur les cartes de boutique ` +
          `(${meubles.toastSurCartes} carte(s) recouverte(s))`,
          toastVu === true && meubles.toastSurCartes === 0);
      }
      verifier(`${taille.nom} · ${ecran} : l'emplacement libre de la boutique ne porte pas de caractère ` +
        `(« ${meubles.videTexte === null ? "—" : meubles.videTexte} »)`,
        meubles.videExiste && meubles.videTexte === "",
        meubles.videExiste ? meubles.videTexte : "aucun emplacement vide à mesurer");

      /* UNE FILE, PAS UNE PILE (décision 64 · P1 et P2). Le jeu avait TROIS
         canaux d'annonce qui s'ignoraient : le message flottant, les
         bannières de butin et les bannières de fête. Reproduit à l'état
         exact de la capture — trois annonces au même instant en fin de
         manche : elles s'affichaient à y = 0, 47 et 131, trois bandes
         empilées dont deux se recouvraient chez Gabriel.
         Mes trois hypothèses précédentes portaient toutes sur un toast
         SEUL et n'ont donc rien reproduit. C'était la pile, pas la
         hauteur. */
      if (ecran === "mise en place") {
        const pile = await page.evaluate(async () => {
          viderAnnonces();
          // les trois canaux d'un coup, comme en fin de manche
          partie.orbesEnAttente = [{ type: "staff", membre: "Coach mental", rarete: "or" },
            { type: "or", montant: 2, rarete: "bleu" }];
          ramasserOrbes(() => {});
          signaler("🔥 +2 Ferveur !");
          celebrerStaff({ type: "embleme", joueur: "Sékou", ecole: "École de la Rue" });
          let pire = 0, vues = 0, chevauchements = 0;
          for (let t = 0; t < 14; t++) {
            await new Promise((r) => setTimeout(r, 350));
            /* DÉDOUBLONNER : une bannière POSÉE DANS la file matche les deux
               sélecteurs (`#file-annonces > *` et `.fusion-banniere`).
               Comptée deux fois, elle se « recouvrait elle-même » — la
               recette annonçait 2 annonces et 2 chevauchements là où il
               n'y en avait qu'une. On passe par un Set d'ÉLÉMENTS. */
            const vus = new Set([...document.querySelectorAll(
              "#file-annonces > *, .message-flottant, .banniere-orbe, .fusion-banniere, .banniere-balayage")]);
            const boites = [...vus]
              .filter((e) => { const st = getComputedStyle(e);
                return st.display !== "none" && st.visibility !== "hidden" && (e.textContent || "").trim(); })
              .map((e) => e.getBoundingClientRect());
            if (boites.length > pire) pire = boites.length;
            if (boites.length) vues++;
            for (let i = 0; i < boites.length; i++) for (let j = i + 1; j < boites.length; j++) {
              const L = Math.max(0, Math.min(boites[i].right, boites[j].right) - Math.max(boites[i].left, boites[j].left));
              const H = Math.max(0, Math.min(boites[i].bottom, boites[j].bottom) - Math.max(boites[i].top, boites[j].top));
              if (L * H > 4) chevauchements++;
            }
          }
          const restants = [...new Set([...document.querySelectorAll(
            "#file-annonces > *, .message-flottant, .banniere-orbe, .fusion-banniere, .banniere-balayage")])]
            .map((e) => (e.parentElement && e.parentElement.id || "?") + "/" +
              (e.className || "").toString().split(" ")[0]);
          viderAnnonces();
          return { pire, vues, chevauchements, restants };
        });
        verifier(`${taille.nom} : trois annonces au même instant défilent, elles ne s'empilent pas ` +
          `(au plus ${pile.pire} à l'écran, ${pile.chevauchements} chevauchement(s), ${pile.vues} relevés non vides)`,
          pile.vues >= 3 && pile.pire <= 1 && pile.chevauchements === 0, JSON.stringify(pile));
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
