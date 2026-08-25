/* ============================================================
   ONZE — L'INTÉGRITÉ DE LA TABLE DES PORTRAITS (DA S2, brief §8).
   ------------------------------------------------------------
   Des contrôles STATIQUES, sans navigateur : ils tournent en une
   seconde et rendent impossible la classe de défaut attrapée à
   l'intégration (la frontale de Gorka portait le numéro 63 — celui
   de Salvatore — au lieu de son numéro de roster, 29).

   La convention de nommage :
     ONZE_<id>_<Nom>[_frontale].webp
   où <id> est l'IDENTIFIANT du joueur, selon d'où il vient :
     · joueur du roster  → son index dans design/joueurs.json (1-based)
     · un des CINQ DE DÉPART (const STARTERS de partie.html, coût 0,
       sans École) → « S » + son rang, S1 à S5 : ils ne sont pas au
       roster, ils ont donc leur propre suite
     · unité d'Icône (design/icones.md) → le préfixe à lettre de
       Gabriel (I1, H1, H2)
   Le contrôle n'est donc PAS desserré pour les hors-roster : il est
   étendu, avec en plus la règle qui vaut pour tout le monde — un
   identifiant par entrée, et jamais le même pour deux joueurs.

   DEUX VISAGES POUR UN NOM. Gus et Titi existent en maillot du club
   (les cinq de départ) ET en violet du Douzième Homme (les moitiés de
   l'Icône n°38). La table les distingue par une clé à variante :
   « Titi » et « Titi · Le Douzième Homme ».

   Usage : node tests/portraits.spec.js
   ============================================================ */
const fs = require("fs");
const path = require("path");

const racine = path.join(__dirname, "..");
const lire = (f) => JSON.parse(fs.readFileSync(path.join(racine, f), "utf8"));

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

const table = lire("design/portraits.json");
const roster = lire("design/joueurs.json");
// L'index se lit avec la MÊME tolérance qu'au runtime (portraits.js) :
// la table est éditée à la main, « L'Enfant du Pays » s'y écrit avec
// l'apostrophe courbe et dans joueurs.json avec la droite.
let indexRoster;   // rempli après `plier` (défini juste dessous)

/* Comparaison de noms indulgente : accents, apostrophes (droite ou
   courbe), tirets bas des noms de fichiers, casse. Les fichiers du Drive
   sont d'ailleurs sans accents (09_Jairzao.png) — les deux graphies
   doivent se reconnaître. */
const plier = (s) => String(s || "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[’‘‛`´']/g, "")
  .replace(/[_\-]+/g, " ")
  .replace(/\s+/g, " ")
  .trim().toLowerCase();

indexRoster = new Map(roster.map((j, i) => [plier(j.nom), i + 1]));
const entreeDe = (nom) => indexRoster.get(plier(nom));

/* Les CINQ DE DÉPART se lisent dans partie.html : ce sont eux, les cartes
   vides qui apparaissaient en rectangles sombres sur le terrain. On les
   lit à la source plutôt que de les recopier — une liste recopiée ment
   dès que Gabriel change la formation de départ. */
const sourceJeu = fs.readFileSync(path.join(racine, "partie.html"), "utf8");
const blocStarters = /const STARTERS = \[([\s\S]*?)\n    \];/.exec(sourceJeu);
const starters = blocStarters ? [...blocStarters[1].matchAll(/nom:\s*"([^"]+)"/g)].map((m) => m[1]) : [];
verifier(`la formation de départ se lit dans partie.html (${starters.join(", ")})`,
  starters.length >= 5, JSON.stringify(starters));
const indexStarter = new Map(starters.map((n, i) => [plier(n), i + 1]));

/* Une clé de table peut porter une VARIANTE : « Titi · Le Douzième
   Homme ». On sépare le nom de la variante avant tout contrôle. */
const decouper = (cle) => {
  const m = /^(.*?)\s*[·•|]\s*(.+)$/.exec(cle);
  return m ? { nom: m[1], variante: m[2] } : { nom: cle, variante: null };
};

/* L'identifiant attendu, selon la provenance du joueur. */
const identiteDe = (cle) => {
  const { nom, variante } = decouper(cle);
  if (!variante) {
    const r = entreeDe(nom);
    if (r !== undefined) return { source: "roster", attendu: String(r), numerique: true, nom };
    const s = indexStarter.get(plier(nom));
    if (s !== undefined) return { source: "départ", attendu: "S" + s, nom };
  }
  // unité d'Icône : l'identifiant est celui de Gabriel, on en vérifie la
  // FORME et l'unicité, pas la valeur (aucune numérotation officielle)
  return { source: "icône", motif: /^[A-Z]+\d+$/, nom };
};

const entrees = Object.entries(table);

/* ---- LES DEUX CHAMPS FACULTATIFS (silhouettes de trois quarts) ----
   « ombre » : l'ombre au sol servie en fichier à part.
   « ancrage » : le point d'appui dans l'image, en parts de sa largeur et
   de sa hauteur — c'est lui qu'on pose sur la ligne de sol.
   Ils sont facultatifs, mais dès qu'ils sont là ils doivent être justes :
   un ancrage aberrant ne casse rien à l'écran, il décale silencieusement
   un joueur, et c'est exactement la classe de défaut que cette recette
   existe pour rendre impossible. */
const ombres = entrees.filter(([, v]) => v.ombre);
const ancrages = entrees.filter(([, v]) => v.ancrage !== undefined);
const ancrageInvalide = [];
for (const [cle, v] of ancrages) {
  const a = Array.isArray(v.ancrage) ? { x: v.ancrage[0], y: v.ancrage[1] } : v.ancrage;
  const bon = a && typeof a === "object" &&
    typeof a.x === "number" && a.x >= 0.2 && a.x <= 0.8 &&      // les pieds ne sont pas dans un coin
    typeof a.y === "number" && a.y >= 0.5 && a.y <= 1;          // ni au-dessus de la ceinture
  if (!bon) ancrageInvalide.push(`${cle} : ${JSON.stringify(v.ancrage)}`);
}
verifier(`les ${ancrages.length} ancrages déclarés sont plausibles (x 0,2-0,8 · y 0,5-1)`,
  ancrageInvalide.length === 0, ancrageInvalide.slice(0, 5).join(" | "));
console.log(`   trois quarts : ${ombres.length} ombre(s) en fichier, ${ancrages.length} ancrage(s) déclaré(s)` +
  (ombres.length === 0 ? " — les visuels de trois quarts ne sont pas encore arrivés, le code les attend" : ""));
// pas de nombre magique : la table grandit quand Gabriel produit un visuel.
// Ce qui doit tenir, c'est que chaque entrée soit COMPLÈTE (les deux visuels).
const incompletes = entrees.filter(([, v]) => !v.carte || !v.frontale).map(([nom]) => nom);
// les chemins à vérifier : les deux obligatoires + l'ombre quand elle est là
const cheminsDe = (v) => {
  const c = { carte: v.carte, frontale: v.frontale };
  if (v.ombre) c.ombre = v.ombre;
  return c;
};
verifier(`les ${entrees.length} entrées de la table ont leurs deux visuels`,
  incompletes.length === 0, "sans les deux : " + incompletes.join(", "));

// ---- 1. chaque chemin référencé existe sur le disque ----
const introuvables = [];
for (const [nom, v] of entrees) {
  for (const [cle, chemin] of Object.entries(cheminsDe(v))) {
    if (!fs.existsSync(path.join(racine, chemin))) introuvables.push(`${nom}/${cle} → ${chemin}`);
  }
}
verifier("chaque chemin de la table existe sur le disque", introuvables.length === 0, introuvables.slice(0, 5).join(" | "));

// ---- 2. aucun fichier attribué à deux joueurs ----
const proprietaire = new Map();
const doublons = [];
for (const [nom, v] of entrees) {
  for (const chemin of Object.values(cheminsDe(v))) {
    if (proprietaire.has(chemin)) doublons.push(`${chemin} : ${proprietaire.get(chemin)} et ${nom}`);
    else proprietaire.set(chemin, nom);
  }
}
verifier("aucun fichier n'est attribué à deux joueurs", doublons.length === 0, doublons.slice(0, 3).join(" | "));

// ---- 3. le numéro du fichier = l'IDENTIFIANT du joueur ----
//        C'EST le contrôle qui a attrapé Gorka (frontale n°63 au lieu de 29).
//        Étendu aux hors-roster : S1-S5 pour les cinq de départ, préfixe à
//        lettre pour les unités d'Icône.
const mauvaisNumero = [];
const mauvaisNom = [];
const parIdentifiant = new Map();     // identifiant → entrée qui le porte
const identifiantsMeles = [];
for (const [cle, v] of entrees) {
  const ident = identiteDe(cle);
  const idsDeLEntree = new Set();
  for (const [type, chemin] of Object.entries(cheminsDe(v))) {
    const fichier = path.basename(chemin).replace(/\.(webp|png|jpg)$/i, "");
    const m = /^ONZE_([A-Za-z0-9]+)_(.+?)(_frontale|_ombre)?$/.exec(fichier);
    if (!m) { mauvaisNom.push(`${cle}/${type} : « ${fichier} » hors convention ONZE_<id>_<Nom>`); continue; }
    const [, numero, nomFichier] = m;
    // le NOM doit se reconnaître dans les deux sens (Álvaro ⊂ Don_Álvaro,
    // Enfant_du_Pays ⊂ L'Enfant du Pays) — un fichier d'un autre joueur, lui,
    // ne se reconnaît dans aucun sens. On compare au nom SANS sa variante.
    const a = plier(nomFichier), b = plier(ident.nom);
    if (!a.includes(b) && !b.includes(a)) mauvaisNom.push(`${cle}/${type} → ${fichier}`);
    // « 08 » et « 8 » sont le même identifiant : c'est la graphie qui
    // varie d'un fichier à l'autre, pas le joueur.
    idsDeLEntree.add(/^\d+$/.test(numero) ? String(Number(numero)) : numero.toUpperCase());
    if (ident.attendu !== undefined) {
      const juste = ident.numerique
        ? /^\d+$/.test(numero) && Number(numero) === Number(ident.attendu)
        : numero === ident.attendu;
      if (!juste) mauvaisNumero.push(`${cle} (${ident.source}) attend l'identifiant ${ident.attendu} mais son ${type} porte ${numero}`);
    } else if (ident.motif && !ident.motif.test(numero)) {
      mauvaisNumero.push(`${cle} (${ident.source}) porte l'identifiant « ${numero} », hors forme ${ident.motif}`);
    }
  }
  // un identifiant par entrée…
  if (idsDeLEntree.size > 1) identifiantsMeles.push(`${cle} porte ${[...idsDeLEntree].join(" et ")}`);
  // …et jamais le même pour deux joueurs (c'est ce qui rend Gorka impossible)
  for (const id of idsDeLEntree) {
    if (parIdentifiant.has(id) && parIdentifiant.get(id) !== cle) {
      identifiantsMeles.push(`l'identifiant ${id} sert à ${parIdentifiant.get(id)} ET à ${cle}`);
    } else parIdentifiant.set(id, cle);
  }
}
verifier("l'identifiant de chaque fichier est celui du joueur (index au roster, S1-S5 au départ, préfixe d'Icône)",
  mauvaisNumero.length === 0, mauvaisNumero.slice(0, 5).join(" | "));
verifier("un identifiant par joueur, et jamais le même pour deux joueurs",
  identifiantsMeles.length === 0, identifiantsMeles.slice(0, 5).join(" | "));
verifier("le nom du fichier correspond au joueur de la table",
  mauvaisNom.length === 0, mauvaisNom.slice(0, 5).join(" | "));

// ---- 4. toute entrée est un joueur connu : roster, cinq de départ, ou Icône ----
const icones = fs.readFileSync(path.join(racine, "icones.js"), "utf8");
const horsRoster = entrees.map(([cle]) => cle).filter((cle) => identiteDe(cle).source === "icône");
const inconnues = horsRoster.filter((cle) => {
  const { nom } = decouper(cle);
  return !icones.includes(`"${nom}"`) && !icones.includes(`nom: "${nom}"`);
});
verifier(`les entrées d'Icône sont déclarées dans icones.js (${horsRoster.join(", ")})`,
  inconnues.length === 0, inconnues.join(" | "));

// ---- 4 bis. AUCUN JOUEUR DE LA FORMATION DE DÉPART SANS VISUEL ----
//        C'est l'assertion qui manquait : ce sont ces cinq-là qui
//        s'affichaient en rectangles vides sur le terrain.
const parNomDeTable = new Map(entrees.map(([cle, v]) => [plier(decouper(cle).nom) + (decouper(cle).variante ? "|" + plier(decouper(cle).variante) : ""), v]));
const departSansVisuel = starters.filter((nom) => {
  const v = parNomDeTable.get(plier(nom));
  return !v || !v.carte || !v.frontale;
});
verifier(`les ${starters.length} joueurs de la formation de départ ont leurs deux visuels`,
  starters.length > 0 && departSansVisuel.length === 0, "sans visuel : " + departSansVisuel.join(", "));

// ---- 4 ter. les DOUBLES VERSIONS sont bien deux entrées distinctes ----
//        Gus et Titi jouent en maillot du club au coup d'envoi et en violet
//        du Douzième Homme une fois l'Icône signée : si l'une des deux clés
//        disparaît, le jeu servirait le mauvais maillot sans rien casser.
const duo = [...icones.matchAll(/nom:\s*"([^"]+)",\s*cout:\s*\d+,\s*poste:\s*"[^"]+",\s*ecole:\s*"([^"]+)"/g)]
  .map(([, nom, ecole]) => ({ nom, ecole }))
  .filter((u) => indexStarter.has(plier(u.nom)));
const versionsManquantes = [];
for (const u of duo) {
  if (!parNomDeTable.has(plier(u.nom))) versionsManquantes.push(`${u.nom} (maillot du club)`);
  if (!parNomDeTable.has(plier(u.nom) + "|" + plier(u.ecole))) versionsManquantes.push(`${u.nom} · ${u.ecole}`);
}
verifier(`les joueurs à deux visages ont leurs deux entrées (${duo.map((u) => u.nom).join(", ") || "aucun"})`,
  duo.length > 0 && versionsManquantes.length === 0, versionsManquantes.join(" | "));

// ---- 5. aucun fichier orphelin dans da/ (poids mort dans le dépôt) ----
const surDisque = [];
for (const d of ["da/keyarts", "da/frontales"]) {
  for (const f of fs.readdirSync(path.join(racine, d))) surDisque.push(`${d}/${f}`);
}
const orphelins = surDisque.filter((f) => !proprietaire.has(f));
verifier(`aucun visuel orphelin dans da/ (${surDisque.length} fichiers, tous référencés)`,
  orphelins.length === 0, orphelins.slice(0, 5).join(" | "));

// ---- 6. l'inventaire : qui n'a pas encore de visage ----
const parNomPlie = new Map(entrees.map(([nom, v]) => [plier(nom), v]));
const sansCarte = roster.filter((j) => !(parNomPlie.get(plier(j.nom)) || {}).carte).map((j) => j.nom);
const sansFrontale = roster.filter((j) => !(parNomPlie.get(plier(j.nom)) || {}).frontale).map((j) => j.nom);
console.log(`   inventaire : ${roster.length - sansCarte.length}/${roster.length} joueurs illustrés, ` +
  `${roster.length - sansFrontale.length}/${roster.length} en silhouette` +
  (sansCarte.length ? ` · sans illustration : ${sansCarte.join(", ")}` : "") +
  (sansFrontale.length ? ` · sans silhouette : ${sansFrontale.join(", ")}` : ""));

// ---- 7. le poids de la banque, et celui d'une carte moyenne ----
let total = 0, pire = { nom: "", ko: 0 };
for (const f of surDisque) {
  const ko = fs.statSync(path.join(racine, f)).size / 1024;
  total += ko;
  if (ko > pire.ko) pire = { nom: f, ko };
}
const arenes = fs.readdirSync(path.join(racine, "da/arenes"))
  .reduce((t, f) => t + fs.statSync(path.join(racine, "da/arenes", f)).size / 1024, 0);
console.log(`   poids : banque ${(total / 1024).toFixed(1)} Mo + arènes ${Math.round(arenes)} Ko · ` +
  `le plus lourd ${pire.nom} (${Math.round(pire.ko)} Ko)`);
verifier("aucun visuel ne dépasse 150 Ko (budget mobile)", pire.ko <= 150, `${pire.nom} : ${Math.round(pire.ko)} Ko`);

console.log(echecs ? `\n${echecs} échec(s)` : "\nIntégrité des portraits ✅");
process.exit(echecs ? 1 : 0);
