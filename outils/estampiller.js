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

/* PAS DE SHA DANS LE BANDEAU, et c'est un choix mesuré, pas une
   simplification. `estampiller.js` lit `HEAD` AVANT le commit qui
   contiendra `version.js` : la révision affichée serait donc toujours le
   PARENT du code effectivement joué. Une capture marquée `55f3e02+`
   obligerait à chercher « le commit dont le parent est 55f3e02 » —
   exactement l'indirection que l'estampille existe pour supprimer.
   L'horodatage, lui, est exact : il dit quand ce build a été fabriqué, et
   il se compare sans ambiguïté à `git log -1 --format=%cI`. */
const maintenant = new Date();
const deuxChiffres = (n) => String(n).padStart(2, "0");
/* La date est en heure UTC et au format court : c'est un repère de
   comparaison avec l'historique du dépôt, pas une information de jeu. */
const build = `${deuxChiffres(maintenant.getUTCDate())}/${deuxChiffres(maintenant.getUTCMonth() + 1)} ` +
  `${deuxChiffres(maintenant.getUTCHours())}:${deuxChiffres(maintenant.getUTCMinutes())}`;

const contenu = `/* ÉCRIT PAR outils/estampiller.js — ne pas éditer à la main.
   L'estampille que porte le bandeau du haut : elle dit QUAND ce build a
   été fabriqué, et rien d'autre (règle M3 ter). Elle ne nomme pas de
   révision : \`estampiller.js\` tourne AVANT le commit qui la contient,
   la révision serait donc toujours celle du parent. */
window.ONZE_VERSION = {
  build: ${JSON.stringify(build)},
  horodatage: ${JSON.stringify(maintenant.toISOString())},
};
`;
fs.writeFileSync(path.join(racine, "version.js"), contenu);
const tete = git("log", "-1", "--format=%cI") || "aucun commit";
console.log(`estampille écrite : ${build} UTC · dernier commit ${tete}`);
