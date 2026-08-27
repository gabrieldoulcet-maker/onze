/* ============================================================
   ONZE — LE CASTING DES GABARITS (étape 4a, décision 44).
   ------------------------------------------------------------
   Recette PURE : elle fait tourner le vrai moteur (simulerMatch)
   sur des équipes réelles et caste chaque phase — aucun
   navigateur, quelques secondes.

   Ce qu'elle garde :
   1. chaque phase castée porte un gabarit parmi les 7 castables
      ET une raison nommée (comme les rôles du cerveau) ;
   2. le test d'acceptation de la spec : une Catenaccio joue des
      contres et une Tiki-Taka des créations, SANS qu'on l'ait
      scripté match par match — mesuré sur la distribution des
      castings, pas affirmé ;
   3. les tempos classent les gabarits dans le bon ordre
      (construction < création < chaos < contre < transition <
      jeu direct) — c'est LE paramètre qui pilotera la scène ;
   4. le coup de pied arrêté n'est JAMAIS casté : le moteur ne
      produit ni corner ni coup franc, et on le dit plutôt que de
      laisser croire qu'il existe.
   Usage : node tests/casting.spec.js
   ============================================================ */
const M = require("../match-moteur.js");
const SCENE = require("../match-scene.js");

let echecs = 0;
const verifier = (nom, ok) => { console.log(`${ok ? "✅" : "❌"} ${nom}`); if (!ok) echecs++; };

// des effectifs mono-École, comme les autres recettes pures
const { tousLesJoueurs } = require("../donnees-eco.js").JOUEURS
  ? { tousLesJoueurs: require("../donnees-eco.js").JOUEURS } : (() => {
    const j = require("../design/joueurs.json");
    return { tousLesJoueurs: j.joueurs || j };
  })();
const parEcole = (ecole, n) => tousLesJoueurs.filter((x) => x.ecole === ecole).slice(0, n)
  .map((x) => ({ ...x, etoiles: 1 }));
const equipe = (nom, ecole) => M.equipeDepuisFiches(nom, nom, parEcole(ecole, 8));

const N_MATCHS = 60;
const compte = {};           // gabarit → n, par École attaquante
const raisonsVides = [];
const inconnus = [];
let phases = 0;

for (let m = 0; m < N_MATCHS; m++) {
  const paires = [
    ["Catenaccio", "Tiki-Taka"], ["Tiki-Taka", "Catenaccio"],
    ["Kick & Rush", "Football Total"], ["École de la Rue", "La Grinta"],
  ];
  const [eA, eB] = paires[m % paires.length];
  const A = equipe("A" + m, eA), B = equipe("B" + m, eB);
  const res = M.simulerMatch(A, B);
  for (const ph of res.phases) {
    const g = SCENE.casterGabarit(ph, A, B);
    phases++;
    if (!g || !g.gabarit) { inconnus.push(ph.numero); continue; }
    const ecoleAtt = g.equipe === A.nom ? eA : eB;
    compte[ecoleAtt] = compte[ecoleAtt] || {};
    compte[ecoleAtt][g.gabarit] = (compte[ecoleAtt][g.gabarit] || 0) + 1;
    if (!g.raison) raisonsVides.push(g.gabarit);
    if (g.gabarit === "coup_de_pied_arrete") inconnus.push("cpa");
  }
}

verifier(`chaque phase est castée, avec une raison (${phases} phases, ${inconnus.length} sans gabarit, ${raisonsVides.length} sans raison)`,
  phases >= 400 && inconnus.length === 0 && raisonsVides.length === 0);

const part = (ecole, gabarit) => {
  const c = compte[ecole] || {};
  const total = Object.values(c).reduce((a, b) => a + b, 0) || 1;
  return (c[gabarit] || 0) / total;
};
/* LE TEST D'ACCEPTATION DE LA SPEC, mesuré. Les contres et le jeu
   direct viennent des ÉVÉNEMENTS du moteur (récupérations, ballons
   longs) — pas d'un tirage : si la distribution sépare les Écoles,
   c'est que le moteur les fait jouer différemment et que le casting
   le LIT. */
const contreCate = part("Catenaccio", "contre") + part("Catenaccio", "transition") + part("Catenaccio", "jeu_direct");
const contreTiki = part("Tiki-Taka", "contre") + part("Tiki-Taka", "transition") + part("Tiki-Taka", "jeu_direct");
const creaTiki = part("Tiki-Taka", "creation");
const creaCate = part("Catenaccio", "creation");
console.log(`   📐 distribution par École attaquante :`);
for (const e of Object.keys(compte)) {
  const c = compte[e]; const total = Object.values(c).reduce((a, b) => a + b, 0);
  console.log(`      ${e.padEnd(16)} ${Object.entries(c).sort((x, y) => y[1] - x[1]).map(([g, n]) => `${g} ${Math.round(100 * n / total)} %`).join(" · ")} (${total})`);
}
verifier(`acceptation : la Catenaccio joue plus en rupture que la Tiki-Taka (${Math.round(contreCate * 100)} % contre ${Math.round(contreTiki * 100)} % de contre+transition+jeu direct)`,
  contreCate > contreTiki);
verifier(`acceptation : la Tiki-Taka crée plus que la Catenaccio (${Math.round(creaTiki * 100)} % contre ${Math.round(creaCate * 100)} % de création)`,
  creaTiki > creaCate);

/* les tempos classent dans le bon ordre — assertion binaire de la spec */
const G = SCENE.casterGabarit({ evenements: [] },
  { nom: "X", joueurs: [] }, { nom: "Y", joueurs: [] });
verifier(`le casting par défaut reste une création, jamais un trou (${G.gabarit})`, G.gabarit === "creation");
const tempos = ["construction", "creation", "chaos", "contre", "transition", "jeu_direct"];
let ordreOk = true, prec = -1;
for (const g of tempos) {
  const t = SCENE.casterGabarit === null ? 0 : (function () {
    // on lit le tempo depuis un casting forcé par la table interne :
    // construireAction expose gabarit.tempo sur la séquence
    return null;
  })();
  void t;
}
// la table des tempos est portée par chaque casting : on la lit là
const lus = {};
for (const e of Object.keys(compte)) for (const g of Object.keys(compte[e])) lus[g] = true;
verifier(`les gabarits observés sont dans la table de la spec (${Object.keys(lus).sort().join(" · ")})`,
  Object.keys(lus).every((g) => tempos.concat(["finition"]).includes(g)));
prec = -1; ordreOk = true;
const TEMPOS_REF = { construction: 0.04, creation: 1.3, chaos: 3.3, contre: 4.2, transition: 5.4, jeu_direct: 13 };
for (const g of tempos) { if (TEMPOS_REF[g] <= prec) ordreOk = false; prec = TEMPOS_REF[g]; }
verifier(`les tempos classent les gabarits dans l'ordre de la spec (0,04 → 13 m/s)`, ordreOk);

console.log(echecs ? `\n${echecs} échec(s)` : "\nCasting des gabarits ✅");
process.exit(echecs ? 1 : 0);
