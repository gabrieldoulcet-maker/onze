/* ============================================================
   ONZE — Le DUEL DES FAMILLES : la force brute de chaque École
   et archétype, isolée de toute stratégie économique.
   Équipe « typée » (palier atteint, budget contrôlé) contre une
   référence SANS synergie de même budget — le winrate mesure la
   valeur pure des boosts et des procs de la famille.
   Cible : toutes les familles entre ~46 et ~58 % (le palier doit
   payer, aucune ne doit écraser).
   Usage : node simulations/familles.js [matchsParFamille=1500]
   ============================================================ */
const M = require("../match-moteur.js");
const joueurs = JSON.parse(require("fs").readFileSync(__dirname + "/../design/joueurs.json", "utf8"));
const N = Number(process.argv[2]) || 1500;

const budgetDe = (fiches) => fiches.reduce((t, j) => t + j.cout, 0);

/* une équipe de référence : 9 joueurs choisis pour NE RIEN activer
   (une seule occurrence par École et par archétype), budget ~cible */
function referenceNeutre(budgetCible) {
  const prises = { ecole: new Set(), arch: new Set() };
  const compo = [];
  const besoins = ["GAR", "DÉF", "DÉF", "DÉF", "MIL", "MIL", "MIL", "ATT", "ATT"];
  for (const poste of besoins) {
    const budgetRestant = budgetCible - budgetDe(compo);
    const slots = besoins.length - compo.length;
    const coutMax = Math.max(1, Math.min(5, Math.round(budgetRestant / Math.max(slots, 1)) + 1));
    const candidats = joueurs.filter((j) => j.poste === poste && j.cout <= coutMax &&
      !prises.ecole.has(j.ecole) && !prises.arch.has(j.archetype));
    const choix = candidats.sort((a, b) => Math.abs(a.cout - budgetRestant / slots) - Math.abs(b.cout - budgetRestant / slots))[0]
      || joueurs.filter((j) => j.poste === poste)[0];
    compo.push(choix);
    if (choix.ecole) prises.ecole.add(choix.ecole);
    if (choix.archetype) prises.arch.add(choix.archetype);
  }
  return compo;
}

/* une équipe typée École : 6 membres (palier 2 sûr, souvent 4-6) +
   complément neutre aux postes manquants */
function equipeEcole(ecole) {
  // un mix de postes RÉALISTE dans l'École (jamais 4 attaquants sans
  // défense), les Uniques NEUTRALISÉS : on mesure l'École, pas ses stars
  const duClub = joueurs.filter((j) => j.ecole === ecole).sort((a, b) => a.cout - b.cout);
  const compo = [];
  const prendre = (poste, n) => {
    for (const j of duClub) {
      if (n <= 0) break;
      if (j.poste === poste && !compo.includes(j)) { compo.push(j); n--; }
    }
  };
  prendre("GAR", 1); prendre("DÉF", 2); prendre("MIL", 2); prendre("ATT", 2);
  for (const j of duClub) if (compo.length < 6 && !compo.includes(j)) compo.push(j);
  const postes = (p) => compo.filter((j) => j.poste === p).length;
  for (const [poste, minimum] of [["GAR", 1], ["DÉF", 3], ["MIL", 2], ["ATT", 2]]) {
    while (postes(poste) < minimum && compo.length < 9) {
      const c = joueurs.find((j) => j.poste === poste && j.ecole !== ecole && j.cout <= 2 && !compo.includes(j));
      if (!c) break;
      compo.push(c);
    }
  }
  return compo.slice(0, 9).map((j) => ({ ...j, unique: null }));
}
/* une équipe typée archétype : 4 porteurs (palier 2) + complément */
function equipeArchetype(arch) {
  const porteurs = joueurs.filter((j) => j.archetype === arch).sort((a, b) => a.cout - b.cout).slice(0, 4);
  const compo = [...porteurs];
  const postes = (p) => compo.filter((j) => j.poste === p).length;
  for (const [poste, minimum] of [["GAR", 1], ["DÉF", 3], ["MIL", 2], ["ATT", 2]]) {
    while (postes(poste) < minimum && compo.length < 9) {
      const c = joueurs.find((j) => j.poste === poste && j.archetype !== arch && j.cout <= 2 && !compo.includes(j));
      if (!c) break;
      compo.push(c);
    }
  }
  return compo.slice(0, 9).map((j) => ({ ...j, unique: null }));
}

function duel(fichesTypees, etiquette) {
  const budget = budgetDe(fichesTypees);
  const reference = referenceNeutre(budget);
  const typee = M.equipeDepuisFiches("Typée", "T", fichesTypees.map((j) => ({ ...j, etoiles: 1 })));
  const neutre = M.equipeDepuisFiches("Neutre", "N", reference.map((j) => ({ ...j, etoiles: 1, unique: null })));
  let v = 0, n = 0;
  for (let i = 0; i < N; i++) {
    const r = M.simulerMatch(typee, neutre, 8);
    if (r.scoreA > r.scoreB) v++;
    else if (r.scoreA === r.scoreB) n++;
  }
  const scoreDuel = v + n / 2;
  return { etiquette, winrate: 100 * scoreDuel / N, budget, budgetRef: budgetDe(reference),
    paliers: typee.synergies.map((s) => s.nom + s.s).join(" ") };
}

const ECOLES = ["Tiki-Taka", "Catenaccio", "Kick & Rush", "École de la Rue", "La Grinta",
  "Football Total", "L'Académie", "Les Internationaux", "Le Douzième Homme", "Les Pros", "Les Revanchards"];
const ARCHETYPES = ["Mur", "Moteur", "Sentinelle", "Virtuose", "Finisseur", "Créateur",
  "Piston", "Renard", "Chanceux", "Guerrier", "Mentor"];

console.log(`Duel des familles — ${N} matchs par famille (cible 46-58 %)\n`);
console.log("ÉCOLES (6 membres + complément neutre) :");
for (const e of ECOLES) {
  const r = duel(equipeEcole(e), e);
  const verdict = r.winrate > 58 ? "⚠️ trop forte" : r.winrate < 46 ? "⚠️ trop faible" : "✓";
  console.log(`  ${e.padEnd(20)} ${r.winrate.toFixed(1).padStart(5)} % (budget ${r.budget} vs ${r.budgetRef}) [${r.paliers}] ${verdict}`);
}
console.log("\nARCHÉTYPES (4 porteurs + complément neutre) :");
for (const a of ARCHETYPES) {
  const r = duel(equipeArchetype(a), a);
  const verdict = r.winrate > 58 ? "⚠️ trop fort" : r.winrate < 46 ? "⚠️ trop faible" : "✓";
  console.log(`  ${a.padEnd(20)} ${r.winrate.toFixed(1).padStart(5)} % (budget ${r.budget} vs ${r.budgetRef}) [${r.paliers}] ${verdict}`);
}
