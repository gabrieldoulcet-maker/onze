/* ============================================================
   ONZE — LE LANCEUR DE LA SUITE.
   ------------------------------------------------------------
   Il existe pour une seule raison : « suite complète verte »
   n'est pas vérifiable tant que le DÉNOMINATEUR bouge. Trois
   comptes différents circulaient (13, 14, 15) pendant que le
   disque en portait 16 — et une recette entière (les tirs au
   but) n'était lancée par personne.

   La règle, tenue par ce fichier : la liste des recettes se lit
   sur le DISQUE, jamais dans une liste écrite à la main. Ajouter
   un fichier `tests/*.spec.js` suffit à l'inclure ; en oublier
   un devient impossible. Le compte rendu annonce N/N avec le
   détail, pas un adjectif.

   Usage : NODE_PATH=<scratchpad>/node_modules node tests/lancer-tout.js
           (option : node tests/lancer-tout.js --sauf marathon,scene)
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

/* UNE SUITE QUI NE PEUT PAS TOURNER NE PRODUIT PAS DE CHIFFRE.
   J'ai annoncé « 2/18 vertes » sur un passage de 14 secondes : le serveur
   local était tombé, et chaque recette échouait à la première navigation.
   Ce n'était pas un résultat de test, c'était une panne d'environnement
   rapportée comme un score — et un zéro ne ressemble à un « impossible de
   mesurer » que pour qui lit vite. Le temps de passage me l'a montré,
   mais à l'œil, et cette fois-là. On ne se fie pas à ce qu'on remarquera :
   on ping le serveur avant de commencer, et on s'arrête net. */
const ping = spawnSync("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}",
  "--max-time", "5", "http://localhost:8123/partie.html"], { encoding: "utf8" });
if ((ping.stdout || "").trim() !== "200") {
  console.error(`\nIMPOSSIBLE DE MESURER — le serveur local ne répond pas ` +
    `(http://localhost:8123 → ${(ping.stdout || "aucune réponse").trim()}).`);
  console.error(`Lance-le d'abord :  python3 -m http.server 8123`);
  console.error(`Aucun chiffre n'est produit : une suite qui ne peut pas tourner n'a pas de score.\n`);
  process.exit(2);
}


const dossier = __dirname;
const sauf = (process.argv.find((a) => a.startsWith("--sauf=")) || "").slice(7)
  .split(",").map((s) => s.trim()).filter(Boolean);

const recettes = fs.readdirSync(dossier).filter((f) => f.endsWith(".spec.js")).sort();
const retenues = recettes.filter((f) => !sauf.some((s) => f.startsWith(s)));

/* L'IDENTIFIANT DE PASSAGE (règle M3 ter, deuxième occurrence).
   « layout est verte seule, l'échec venait d'une exécution antérieure » :
   le mélange ne s'est PAS fait à l'écriture — ce lanceur capture chaque
   sortie en mémoire et ne partage aucun fichier — mais À LA LECTURE, en
   relisant un rapport plus vieux que le code. Une règle qu'on doit se
   rappeler deux fois demande un mécanisme, pas une troisième formulation.
   Chaque rapport porte donc un identifiant et un horodatage, EN TÊTE ET
   EN PIED, plus la révision du dépôt : un chiffre s'annonce en citant
   cette ligne, et un rapport qui ne s'identifie pas ne prouve rien sur
   l'état d'aujourd'hui. */
const debutPassage = new Date();
const revision = (() => {
  const r = spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8", cwd: path.join(dossier, "..") });
  const sale = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8", cwd: path.join(dossier, "..") });
  const propre = !(sale.stdout || "").trim();
  return (r.status === 0 ? (r.stdout || "").trim() : "révision inconnue") + (propre ? "" : " + modifications non commitées");
})();
const idPassage = "P-" + debutPassage.toISOString().slice(2, 19).replace(/[-:]/g, "").replace("T", "-");
/* UN SEUL PASSAGE À LA FOIS.
   Deux lanceurs ont tourné ensemble — un ancien resté détaché, un neuf —
   et leurs sorties se sont entrelacées dans le même journal : tête au nom
   d'un passage, pied au nom de l'autre, « 22 recettes » en haut et
   « 16/20 » en bas, avec quatre rouges venus du code d'avant. Un rapport
   qui mélange deux passages est pire qu'absent : il a l'air d'un résultat.
   L'identifiant de passage n'y suffisait pas — il identifie une SORTIE,
   pas un FICHIER partagé. Le verrou, lui, empêche le mélange d'exister.
   Un verrou dont le processus est mort ne bloque rien : sinon on
   apprendrait vite à le supprimer sans le lire.
   Garde-fou : tests/lanceur.spec.js */
const cheminVerrou = process.env.ONZE_VERROU || path.join(os.tmpdir(), "onze-lancer-tout.lock");
const vivant = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
(() => {
  let tenu = null;
  try { tenu = JSON.parse(fs.readFileSync(cheminVerrou, "utf8")); } catch (e) { tenu = null; }
  if (tenu && tenu.pid && tenu.pid !== process.pid && vivant(tenu.pid)) {
    console.error(`\nUN AUTRE PASSAGE EST EN COURS — ${tenu.passage || "passage sans nom"} ` +
      `(processus ${tenu.pid}, démarré ${tenu.debut || "à une heure inconnue"}).`);
    console.error(`Deux lanceurs à la fois produisent un rapport mélangé : tête d'un passage, pied de l'autre.`);
    console.error(`Attends qu'il finisse, ou arrête-le :  kill ${tenu.pid}`);
    console.error(`Aucun chiffre n'est produit.\n`);
    process.exit(3);
  }
})();
try {
  fs.writeFileSync(cheminVerrou, JSON.stringify({ pid: process.pid, passage: idPassage, debut: debutPassage.toISOString() }));
} catch (e) { /* pas de verrou possible : on mesure quand même, on ne bloque pas sur l'outil */ }
const libererVerrou = () => {
  try {
    const tenu = JSON.parse(fs.readFileSync(cheminVerrou, "utf8"));
    if (tenu && tenu.pid === process.pid) fs.unlinkSync(cheminVerrou);
  } catch (e) { /* déjà parti */ }
};
process.on("exit", libererVerrou);
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
  process.on(signal, () => { libererVerrou(); process.exit(130); });

const enTete = `passage ${idPassage} · ${debutPassage.toISOString().slice(0, 19).replace("T", " ")} UTC · ${revision}`;

console.log(enTete);
console.log(`${recettes.length} recette(s) sur le disque` +
  (sauf.length ? ` · ${recettes.length - retenues.length} écartée(s) : ${sauf.join(", ")}` : "") + "\n");

const resultats = [];
for (const f of retenues) {
  const debut = process.hrtime.bigint();
  const r = spawnSync(process.execPath, [path.join(dossier, f)], {
    encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024,
  });
  const secondes = Number(process.hrtime.bigint() - debut) / 1e9;
  const sortie = (r.stdout || "") + (r.stderr || "");
  const rouges = (sortie.match(/^❌/gm) || []).length;
  const vertes = (sortie.match(/^✅/gm) || []).length;
  const fatal = /ÉCHEC FATAL|Error:|Timeout/.test(sortie) && r.status !== 0;
  const ok = r.status === 0 && rouges === 0;
  resultats.push({ f, ok, rouges, vertes, secondes, fatal, sortie });
  console.log(`${ok ? "✅" : "❌"} ${f.padEnd(24)} ${String(vertes).padStart(3)} vertes · ` +
    `${rouges} rouge(s)${fatal ? " · ÉCHEC FATAL" : ""} · ${secondes.toFixed(0)} s`);
}

const casses = resultats.filter((r) => !r.ok);
console.log("");
for (const r of casses) {
  console.log(`--- ${r.f} ---`);
  const lignes = r.sortie.split("\n").filter((l) => l.startsWith("❌") || /ÉCHEC FATAL/.test(l));
  console.log(lignes.slice(0, 6).join("\n") || r.sortie.split("\n").slice(-6).join("\n"));
  console.log("");
}
const total = resultats.reduce((n, r) => n + r.vertes, 0);
console.log(casses.length
  ? `${retenues.length - casses.length}/${retenues.length} recettes vertes — ${casses.map((r) => r.f).join(", ")} au rouge`
  : `${retenues.length}/${retenues.length} recettes vertes · ${total} assertions`);
const fin = new Date();
console.log(`${enTete} · terminé ${fin.toISOString().slice(11, 19)} UTC ` +
  `en ${Math.round((fin - debutPassage) / 1000)} s`);
process.exit(casses.length ? 1 : 0);
