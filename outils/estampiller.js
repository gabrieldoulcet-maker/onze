/* ============================================================
   ONZE — L'ESTAMPILLE DE VERSION.
   ------------------------------------------------------------
   Pourquoi ce fichier existe. Le même jour, la même erreur des
   deux côtés : j'ai annoncé une recette rouge en relisant un
   RAPPORT plus vieux que le code, et Gabriel a redemandé un
   correctif livré depuis deux jours en mesurant une CAPTURE plus
   vieille que le code. Un artefact qui ne dit pas de quand il
   date ne prouve rien sur aujourd'hui (règle M3 ter).

   Le lanceur de recettes s'estampille déjà. Ce script fait le
   miroir pour le jeu : il écrit `version.js`, que la page affiche
   dans le bandeau du haut — la zone présente sur TOUTES les
   captures. Huit caractères suffisent à supprimer toute cette
   classe d'erreur.

   Il se lance AVANT chaque commit de livraison :
     node outils/estampiller.js

   Et il ne peut pas pourrir en silence : `tests/zones.spec.js`
   échoue si l'estampille est plus VIEILLE que le fichier de jeu
   le plus récemment modifié.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const racine = path.join(__dirname, "..");
const git = (...a) => (spawnSync("git", a, { encoding: "utf8", cwd: racine }).stdout || "").trim();

const revision = git("rev-parse", "--short", "HEAD") || "local";
const sale = !!git("status", "--porcelain");
const maintenant = new Date();
const deuxChiffres = (n) => String(n).padStart(2, "0");
/* La date est en heure UTC et au format court : c'est un repère de
   comparaison avec l'historique du dépôt, pas une information de jeu. */
const build = `${deuxChiffres(maintenant.getUTCDate())}/${deuxChiffres(maintenant.getUTCMonth() + 1)} ` +
  `${deuxChiffres(maintenant.getUTCHours())}:${deuxChiffres(maintenant.getUTCMinutes())}`;

const contenu = `/* ÉCRIT PAR outils/estampiller.js — ne pas éditer à la main.
   L'estampille que porte le bandeau du haut : elle dit de quand date
   la version qu'une capture d'écran montre (règle M3 ter). */
window.ONZE_VERSION = {
  revision: ${JSON.stringify(revision + (sale ? "+" : ""))},
  build: ${JSON.stringify(build)},
  horodatage: ${JSON.stringify(maintenant.toISOString())},
};
`;
fs.writeFileSync(path.join(racine, "version.js"), contenu);
console.log(`estampille écrite : ${revision}${sale ? "+" : ""} · ${build} UTC`);
