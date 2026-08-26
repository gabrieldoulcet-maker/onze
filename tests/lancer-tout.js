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
const path = require("path");
const { spawnSync } = require("child_process");

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
