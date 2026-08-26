/* ============================================================
   ONZE — LE LANCEUR NE PRODUIT PAS DE RAPPORT MÉLANGÉ.
   ------------------------------------------------------------
   L'incident : deux lanceurs ont tourné en même temps, un
   ancien resté détaché et un neuf. Leurs sorties se sont
   entrelacées dans le même journal, et le rapport final
   annonçait « 16/20 recettes vertes » avec une TÊTE au nom d'un
   passage et un PIED au nom de l'autre — dont quatre rouges qui
   venaient du code d'avant. Le compte des recettes lui-même se
   contredisait (22 en tête, 20 en pied).

   C'est exactement la panne que la règle M3 ter attaque : un
   rapport qui ne peut pas dire de quel passage il parle ne
   prouve rien. L'identifiant de passage ne suffisait pas —
   il identifie une SORTIE, pas un FICHIER partagé.

   ⚠ ÉCRITE AVANT LE CORRECTIF, elle doit sortir ROUGE.

   Les trois contrats :
     1. UN PASSAGE VIVANT BLOQUE LE SUIVANT — le second refuse
        de démarrer et ne produit AUCUN chiffre ;
     2. IL DIT POURQUOI ET QUI — le refus nomme le passage en
        cours, sinon on croit à une panne ;
     3. UN VERROU MORT NE BLOQUE RIEN — un lanceur tué laisse
        son verrou derrière lui ; s'il condamnait la suite,
        on apprendrait vite à le supprimer sans lire.
   Usage : NODE_PATH=<scratchpad>/node_modules node tests/lanceur.spec.js
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

let echecs = 0;
const verifier = (nom, ok, detail) => {
  console.log(`${ok ? "✅" : "❌"} ${nom}${!ok && detail ? " — " + detail : ""}`);
  if (!ok) echecs++;
};

const verrou = path.join(os.tmpdir(), "onze-verrou-recette-" + process.pid + ".lock");
const lancer = () => spawnSync(process.execPath,
  [path.join(__dirname, "lancer-tout.js"), "--sauf=a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z"],
  { encoding: "utf8", env: { ...process.env, ONZE_VERROU: verrou } });

try { fs.unlinkSync(verrou); } catch (e) {}

/* ---- 1 et 2 · UN PASSAGE VIVANT BLOQUE LE SUIVANT ---- */
// notre propre PID est forcément vivant : c'est un passage en cours crédible
fs.writeFileSync(verrou, JSON.stringify({ pid: process.pid, passage: "P-TEST-000000", debut: new Date().toISOString() }));
const bloque = lancer();
const sortieBloquee = (bloque.stdout || "") + (bloque.stderr || "");
verifier(`un passage vivant bloque le suivant (code ${bloque.status})`,
  bloque.status !== 0, sortieBloquee.slice(0, 160));
verifier("le second ne produit aucun chiffre",
  !/recettes? vertes|\d+ vertes/.test(sortieBloquee), sortieBloquee.slice(0, 160));
verifier("le refus nomme le passage en cours",
  sortieBloquee.includes("P-TEST-000000") && /en cours|autre passage/i.test(sortieBloquee),
  sortieBloquee.slice(0, 200));

/* ---- 3 · UN VERROU MORT NE BLOQUE RIEN ---- */
// un PID libre : on prend un très grand numéro, jamais attribué ici
fs.writeFileSync(verrou, JSON.stringify({ pid: 4194303, passage: "P-MORT-000000", debut: new Date().toISOString() }));
const passe = lancer();
const sortiePasse = (passe.stdout || "") + (passe.stderr || "");
verifier(`un verrou mort ne bloque rien (code ${passe.status})`,
  passe.status === 0 && sortiePasse.includes("passage P-"), sortiePasse.slice(0, 200));
verifier("le lanceur libère son verrou en partant", !fs.existsSync(verrou),
  fs.existsSync(verrou) ? fs.readFileSync(verrou, "utf8") : "");

try { fs.unlinkSync(verrou); } catch (e) {}
console.log(echecs ? `\n${echecs} échec(s) — le verrou du lanceur` : "\nLe verrou du lanceur ✅");
process.exit(echecs ? 1 : 0);
