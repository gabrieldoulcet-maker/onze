/* ============================================================
   ONZE — LES TIRS AU BUT (décision n°28), test du moteur pur.
   1. Une séance rend TOUJOURS un vainqueur (le duel final ne
      peut plus s'éterniser en nuls), en un nombre borné de tirs.
   2. Le Capitaine tire en premier s'il y en a un.
   3. El Santo arrête d'office le premier tir adverse, et le
      récit le raconte.
   4. Sonde d'équilibrage : fréquence des nuls entre deux équipes
      optimisées de fin de partie (le symptôme du playtest).
   Usage : node tests/tirs-au-but.spec.js
   ============================================================ */
const ONZE = require("../match-moteur.js");
const joueurs = JSON.parse(require("fs").readFileSync(__dirname + "/../design/joueurs.json", "utf8"));

let echecs = 0;
function verifier(nom, ok, detail) {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
}

/* Une équipe « optimisée fin de partie » : gardien + les plus chers, en 2★.
   SANS La Pantera : son Unique marque d'office quand le match allait finir
   nul (anti-nul existant) — la sonde mesure les nuls hors Pantera. */
function equipeForte(nom, sansSanto) {
  const gardien = joueurs.find((j) => j.poste === "GAR" && (sansSanto ? j.unique !== "El Santo" : j.unique === "El Santo"));
  const champ = joueurs.filter((j) => j.poste !== "GAR" && j.unique !== "La Pantera")
    .sort((a, b) => b.cout - a.cout).slice(0, 10);
  return ONZE.equipeDepuisFiches(nom, nom, [gardien, ...champ].map((j) => ({ ...j, etoiles: 2 })));
}
const eqSansSanto = equipeForte("Les Blancs", true);
const eqSansSanto2 = equipeForte("Les Rouges", true);
const eqAvecSanto = equipeForte("Les Saints", false);

// ---- 1. Toujours un vainqueur, jamais l'éternité ----
let toujoursDecide = true, maxTirs = 0, minTirs = 99;
for (let i = 0; i < 2000; i++) {
  const s = ONZE.tirsAuBut(eqSansSanto, eqSansSanto2);
  if (s.scoreA === s.scoreB || !["A", "B"].includes(s.vainqueur)) toujoursDecide = false;
  maxTirs = Math.max(maxTirs, s.tirs.length);
  minTirs = Math.min(minTirs, s.tirs.length);
}
verifier(`2000 séances : toujours un vainqueur, ${minTirs} à ${maxTirs} tirs (borné)`,
  toujoursDecide && maxTirs <= 90 && minTirs >= 6);

// ---- 2. Le Capitaine ouvre la séance ----
// le Capitaine de CHAMP tire en premier (un gardien-capitaine ne tire pas)
const capitaine = joueurs.find((j) => j.archetype === "Capitaine" && j.poste !== "GAR");
const avecCapitaine = ONZE.equipeDepuisFiches("Capitaines", "T", [
  joueurs.find((j) => j.poste === "GAR" && !j.unique),
  capitaine,
  ...joueurs.filter((j) => j.poste === "ATT" && j.archetype !== "Capitaine").slice(0, 4),
].map((j) => ({ ...j, etoiles: 1 })));
const seanceCap = ONZE.tirsAuBut(avecCapitaine, eqSansSanto2);
verifier(`le Capitaine (${capitaine.nom}) tire en premier`,
  seanceCap.tirs.find((t) => t.camp === "A").tireur === capitaine.nom,
  seanceCap.tirs.find((t) => t.camp === "A").tireur);

// ---- 3. El Santo arrête d'office le premier tir adverse ----
let santoJoue = true, santoRaconte = true, santoUneFois = true;
for (let i = 0; i < 200; i++) {
  const s = ONZE.tirsAuBut(eqSansSanto, eqAvecSanto); // El Santo garde la cage B
  const premierContre = s.tirs.find((t) => t.camp === "A");
  if (!premierContre.santo || premierContre.marque) santoJoue = false;
  if (!premierContre.texte.includes("El Santo")) santoRaconte = false;
  if (s.tirs.filter((t) => t.santo).length !== 1) santoUneFois = false;
}
verifier("El Santo : le premier tir adverse est arrêté d'office, raconté, et une seule fois",
  santoJoue && santoRaconte && santoUneFois);

// ---- 4. Sonde : fréquence des nuls entre équipes optimisées (duel final) ----
let nuls = 0;
const N = 1500;
for (let i = 0; i < N; i++) {
  const r = ONZE.simulerMatch(eqSansSanto, eqSansSanto2, 8);
  if (r.scoreA === r.scoreB) nuls++;
}
const taux = (100 * nuls / N).toFixed(1);
console.log(`   sonde : ${taux} % de nuls entre deux équipes optimisées sur 8 phases (symptôme du playtest — la séance les tranche désormais)`);
verifier("la sonde tourne (taux mesurable)", nuls > 0 && nuls < N);

console.log(echecs ? `\n${echecs} échec(s)` : "\nTirs au but ✅");
process.exit(echecs ? 1 : 0);
