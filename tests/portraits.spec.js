/* ============================================================
   ONZE — L'INTÉGRITÉ DE LA TABLE DES PORTRAITS (DA S2, brief §8).
   ------------------------------------------------------------
   Des contrôles STATIQUES, sans navigateur : ils tournent en une
   seconde et rendent impossible la classe de défaut attrapée à
   l'intégration (la frontale de Gorka portait le numéro 63 — celui
   de Salvatore — au lieu de son numéro de roster, 29).

   La convention de nommage, vérifiée sur les 146 fichiers :
     ONZE_<n>_<Nom>[_frontale].webp
   où <n> est l'INDEX DU JOUEUR dans design/joueurs.json (1-based).
   Les deux Icônes de design/icones.md (Le Fidèle, Gus) ne sont pas
   au roster : elles portent le préfixe de Gabriel (I1, H1) et sont
   donc exemptes du contrôle de numéro — jamais de celui du nom.

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

const entrees = Object.entries(table);
// pas de nombre magique : la table grandit quand Gabriel produit un visuel.
// Ce qui doit tenir, c'est que chaque entrée soit COMPLÈTE (les deux visuels).
const incompletes = entrees.filter(([, v]) => !v.carte || !v.frontale).map(([nom]) => nom);
verifier(`les ${entrees.length} entrées de la table ont leurs deux visuels`,
  incompletes.length === 0, "sans les deux : " + incompletes.join(", "));

// ---- 1. chaque chemin référencé existe sur le disque ----
const introuvables = [];
for (const [nom, v] of entrees) {
  for (const [cle, chemin] of Object.entries(v)) {
    if (!fs.existsSync(path.join(racine, chemin))) introuvables.push(`${nom}/${cle} → ${chemin}`);
  }
}
verifier("chaque chemin de la table existe sur le disque", introuvables.length === 0, introuvables.slice(0, 5).join(" | "));

// ---- 2. aucun fichier attribué à deux joueurs ----
const proprietaire = new Map();
const doublons = [];
for (const [nom, v] of entrees) {
  for (const chemin of Object.values(v)) {
    if (proprietaire.has(chemin)) doublons.push(`${chemin} : ${proprietaire.get(chemin)} et ${nom}`);
    else proprietaire.set(chemin, nom);
  }
}
verifier("aucun fichier n'est attribué à deux joueurs", doublons.length === 0, doublons.slice(0, 3).join(" | "));

// ---- 3. le numéro du fichier = l'identifiant du joueur (son index au roster) ----
//        C'EST le contrôle qui aurait attrapé Gorka.
const mauvaisNumero = [];
const mauvaisNom = [];
for (const [nom, v] of entrees) {
  const attendu = entreeDe(nom);                 // undefined pour les 2 Icônes
  for (const [cle, chemin] of Object.entries(v)) {
    const fichier = path.basename(chemin).replace(/\.(webp|png|jpg)$/i, "");
    const m = /^ONZE_([A-Za-z0-9]+)_(.+?)(_frontale)?$/.exec(fichier);
    if (!m) { mauvaisNom.push(`${nom}/${cle} : « ${fichier} » hors convention ONZE_<n>_<Nom>`); continue; }
    const [, numero, nomFichier] = m;
    // le NOM doit se reconnaître dans les deux sens (Álvaro ⊂ Don_Álvaro,
    // Enfant_du_Pays ⊂ L'Enfant du Pays) — un fichier d'un autre joueur, lui,
    // ne se reconnaît dans aucun sens.
    const a = plier(nomFichier), b = plier(nom);
    if (!a.includes(b) && !b.includes(a)) mauvaisNom.push(`${nom}/${cle} → ${fichier}`);
    if (attendu === undefined) continue;         // Icône hors roster : pas de numéro à vérifier
    if (!/^\d+$/.test(numero) || Number(numero) !== attendu) mauvaisNumero.push(`${nom} est le n°${attendu} du roster mais son ${cle} porte le n°${numero}`);
  }
}
verifier("le numéro de chaque fichier est l'index du joueur au roster",
  mauvaisNumero.length === 0, mauvaisNumero.slice(0, 5).join(" | "));
verifier("le nom du fichier correspond au joueur de la table",
  mauvaisNom.length === 0, mauvaisNom.slice(0, 5).join(" | "));

// ---- 4. toute entrée est soit un joueur du roster, soit une Icône connue ----
const icones = fs.readFileSync(path.join(racine, "icones.js"), "utf8");
const horsRoster = entrees.map(([nom]) => nom).filter((nom) => entreeDe(nom) === undefined);
const inconnues = horsRoster.filter((nom) => !icones.includes(`"${nom}"`) && !icones.includes(`nom: "${nom}"`));
verifier(`les entrées hors roster sont des Icônes déclarées (${horsRoster.join(", ")})`,
  inconnues.length === 0, inconnues.join(" | "));

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
