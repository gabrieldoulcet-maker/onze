/* ============================================================
   ONZE — CALIBRAGE DE LA DIFFICULTÉ (sprint post-playtest, 1c).
   Un « HUMAIN OPTIMISEUR » agressif (chasse aux paires, pivot vers
   l'École la plus fournie de son effectif, économie disciplinée,
   relances larges — les règles « légende » d'ia-coach.js) affronte
   les 7 IA de la partie réelle à la difficulté demandée, à économie
   complète et pool partagé.
   Cible (mode PRO) : l'optimiseur finit top 4 ~50-60 % du temps.
   Usage : node simulations/difficulte.js [parties=300] [difficulte=pro]
   ============================================================ */
const M = require("../match-moteur.js");
const ECO = require("../donnees-eco.js");
const IA = require("../ia-coach.js");
const joueurs = JSON.parse(require("fs").readFileSync(__dirname + "/../design/joueurs.json", "utf8"));

const N = Number(process.argv[2]) || 300;
const DIFFICULTE = process.argv[3] || "pro";
const NOMS_IA = Object.keys(IA.STRATEGIES);

function unePartie(mesures) {
  const pool = [];
  for (const j of joueurs) for (let c = 0; c < ECO.POOL_PAR_COUT[j.cout]; c++) pool.push(j);

  const humain = { nom: "Optimiseur", ia: true, prestige: ECO.PRESTIGE_DEPART, serie: 0, vivant: true,
    difficultePerso: "optimiseur", strategiePerso: { ecoles: [], courbe: "flex" } };
  const coachs = [humain, ...NOMS_IA.map((nom) => ({
    nom, ia: true, prestige: ECO.PRESTIGE_DEPART, serie: 0, vivant: true }))];
  for (const c of coachs) IA.initCoach(c);

  const eliminer = (c) => { c.vivant = false; c.place = coachs.filter((x) => x.vivant).length + 1; IA.liberer(c, pool); };
  const appliquer = (gagnant, perdant, ecart, manche) => {
    if (ecart === 0) return;
    gagnant.serie = gagnant.serie > 0 ? gagnant.serie + 1 : 1;
    perdant.serie = perdant.serie < 0 ? perdant.serie - 1 : -1;
    if (perdant.fantome) return;
    perdant.prestige = Math.max(0, perdant.prestige - M.degatsPrestige(ecart, manche));
    if (perdant.prestige === 0 && perdant.vivant) eliminer(perdant);
  };

  let manche = 1;
  for (; manche <= 30; manche++) {
    const vivants = coachs.filter((c) => c.vivant);
    if (vivants.length <= 1) break;
    // le PIVOT de l'optimiseur : il vise les 2 Écoles les plus fournies
    // de son effectif (il lit son plateau — ce qu'un humain fait)
    const comptes = {};
    for (const j of humain.etatIA.effectif) if (j.ecole) comptes[j.ecole] = (comptes[j.ecole] || 0) + 1;
    humain.strategiePerso.ecoles = Object.keys(comptes).sort((a, b) => comptes[b] - comptes[a]).slice(0, 2);

    for (const c of [...vivants].sort(() => Math.random() - 0.5))
      IA.jouerManche(c, pool, manche, { ECO, M, difficulte: DIFFICULTE });

    if (manche > 3 && !ECO.MANCHES_COUPE.includes(manche)) {
      const enLice = [...coachs.filter((c) => c.vivant)].sort(() => Math.random() - 0.5);
      const paires = [];
      while (enLice.length >= 2) paires.push([enLice.shift(), enLice.shift()]);
      if (enLice.length) {
        const seul = enLice[0];
        const source = coachs.filter((c) => c.vivant && c !== seul)[0];
        paires.push([seul, { nom: "B-" + source.nom, fantome: true, serie: 0, etatIA: source.etatIA, vivant: true }]);
      }
      // les équipes se FIGENT avant les matchs : une élimination en
      // cours de manche (liberer vide l'effectif) ne doit pas priver
      // un match suivant de ses joueurs
      const ctx = { ECO, M, difficulte: DIFFICULTE };
      const rencontres = paires.map(([c1, c2]) => [c1, c2, IA.equipeDe(c1, ctx), IA.equipeDe(c2, ctx)]);
      for (const [c1, c2, eq1, eq2] of rencontres) {
        const r = M.simulerMatch(eq1, eq2, ECO.phasesDeManche(manche));
        if (c1.nom === "Optimiseur" || c2.nom === "Optimiseur") {
          mesures.matchs++;
          const scoreOpti = c1.nom === "Optimiseur" ? r.scoreA : r.scoreB;
          const scoreAutre = c1.nom === "Optimiseur" ? r.scoreB : r.scoreA;
          if (scoreOpti > scoreAutre) mesures.matchsGagnes++;
        }
        if (r.scoreA > r.scoreB) appliquer(c1, c2, r.ecart, manche);
        else if (r.scoreB > r.scoreA) appliquer(c2, c1, r.ecart, manche);
      }
    }
  }
  const survivants = coachs.filter((c) => c.vivant).sort((a, b) => b.prestige - a.prestige);
  survivants.forEach((c, i) => { c.place = i + 1; });
  mesures.places.push(humain.place);
  if (humain.place === 1) mesures.victoires++;
  if (humain.place <= 4) mesures.top4++;
}

const mesures = { places: [], top4: 0, victoires: 0, matchs: 0, matchsGagnes: 0 };
for (let i = 0; i < N; i++) unePartie(mesures);
const placeMoy = mesures.places.reduce((t, p) => t + p, 0) / N;
console.log(`Difficulté « ${DIFFICULTE} » — ${N} parties de l'OPTIMISEUR contre les 7 IA :`);
console.log(`  top 4 : ${(100 * mesures.top4 / N).toFixed(1)} % (cible en pro : 50-60) · victoires : ${(100 * mesures.victoires / N).toFixed(1)} % · place moyenne : ${placeMoy.toFixed(2)} · matchs gagnés : ${(100 * mesures.matchsGagnes / Math.max(1, mesures.matchs)).toFixed(1)} %`);
