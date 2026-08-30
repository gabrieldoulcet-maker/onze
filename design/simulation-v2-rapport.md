# Rapport — simulation v2 (à valider par Gabriel avant toute ligne de jeu)

**30 août 2026 · `simulations/v2.js` · graine 76 (reproductible) ·
référence : 2 000 parties complètes (~168 000 matchs), contre-tests et
bancs d'essai à part. Prédictions déposées AVANT le premier passage :
`design/simulation-v2-prediction.md` — les écarts sont dits tels
quels.** Le jeu n'a pas bougé d'une ligne : la suite v1 reste verte.

## Les cinq verdicts, d'un coup d'œil

| # | Critère | Cible | Mesuré | Verdict |
|---|---|---|---|---|
| 1 | La note de match | médiane ~6 · ≥8 rares (<10 %) · un gardien peut briller en perdant | médiane **6,5** · ≥8 : **7,0 %** (IC ±0,03) · gardien meilleure note du perdant : **29,6 %** des défaites | ✅ |
| 2 | La progression | moyen +10–15 · pépite gérée ~+25 · jamais aligné ~0 | moyen **+9,2** · pépite **+22,1** · jamais **0,00** | ✅ (bord de bande, voir §2) |
| 3 | Anti-boule de neige n°1 | 1ᵉʳ manche 5 gagne <65 % · moyen→top 4 >25 % · trader 40–60 % | **22,1 %** (IC ±1,8) · **52,5 %** (IC ±1,5) · **43,4 %** (IC ±2,2) | ✅ mais PAS grâce à la masse salariale (§3 — la surprise n°1) |
| 4 | La suffisance | sans rotation perd ~33 % · avec <10 % · la rotation coûte | banc d'essai : **31,1 %** / **2,4 %** / coût **5,0 %** de force | ✅ |
| 5 | Synergies vs talent | 45–55 % contre +20 % de budget | **42,3 %** (IC ±2,5) au taux du marché ; 47,0 % à +10 % | 🟠 à un cheveu — molette identifiée, décision à prendre (§5) |

---

## 1 · La note de match — ✅

2 615 932 notes sur 2 000 parties. **Médiane 6,5, moyenne 6,65,
notes ≥ 8 : 7,0 %.** Par poste : GAR 6,9 (≥8 : 18,4 %) · DÉF 6,3
(3,4 %) · MIL 6,5 (6,7 %) · ATT 6,2 (8,3 %).

Le **gardien est la meilleure note de son équipe dans 29,6 % des
défaites** (n = 73 204, IC ±0,33) — j'avais prédit 5–15 % : c'est
bien plus courant, et c'est une excellente nouvelle pour le récit
(le gardien héroïque d'un match perdu est un archétype football).

Comme prédit, le moteur nomme peu les défenseurs (0,1 % de ≥8 au
premier passage) : le duel seul ne suffisait pas, c'est le **clean
sheet payé à toute la défense** (tour 5) qui a été la bonne molette —
et elle est football-vraie.

## 2 · La progression — ✅ (bord de bande)

Cohortes par NATURE (marge de talent à l'arrivée) et USAGE :
- **titulaire moyen** (marge 6–15, ≥8 matchs) : **+9,2** par partie
  (médiane +9,4, n = 7 610) — un cheveu sous la bande 10–15, et pour
  une raison STRUCTURELLE : cette cohorte atteint son plafond (la
  marge moyenne est ~10,5 — ils finissent la partie « finis »). Le
  plafond borne, pas la vitesse.
- **pépite bien gérée** (marge ≥18, ≥8 matchs, ≥1,5 copain de famille
  en moyenne) : **+22,1** (n = 46 571) — la cible ~25 est approchée.
- **jamais aligné : 0,00 exactement** (n = 12 392) — le contre-test
  par construction tient.

L'écart pépite/moyen (2,4×) ne s'est PAS ouvert tout seul : les deux
premiers réglages montaient tout le monde ensemble. Il s'est ouvert
quand la croissance a été transférée de la BASE vers la **marge**
(l'accélérateur de jeunesse) et les **copains** — exactement les deux
leviers que le concept nomme. C'est une confirmation de design.

## 3 · Valeur + masse salariale — ✅, avec LA surprise du chantier

- Le **1ᵉʳ de la manche 5 gagne 22,1 %** des parties (n = 2 000,
  IC ±1,8) — j'avais prédit 70–80 % : **faux, et de loin**. La boule
  de neige est douce PAR STRUCTURE (appariement aléatoire, élimination
  qui purge, boutique dont la qualité monte pour tout le monde), pas
  grâce à la masse salariale.
- **Contre-test M6 : masse à zéro → 23,4 %** (contre 22,1) : le
  critère du leader NE RÉAGIT PAS à la masse. L'instrument, lui, est
  vivant — à masse 0,25 tout se déforme (voir ci-dessous). Conclusion
  honnête : **dans cette économie, la masse salariale n'est pas un
  frein à boule de neige — c'est un égalisateur de stratégies.**
  - masse 0 : trader 36,6 % · passif 24,0 % (construire paie)
  - masse 0,06 (retenue) : trader 43,4 % · passif 31,6 %
  - masse 0,25 : trader 51,6 % · **passif 48,9 %** — construire un
    effectif ne rapporte presque plus : c'est le mode d'échec à éviter.
- Club **moyen** (rangs 4-5) à la manche 5 → top 4 : **52,5 %** ✓.
  **Trader : 43,4 % de top 4** ✓ (bande 40–60) — vendre sa pépite est
  un vrai choix, ni piège ni stratégie dominante.
- Stratégies, top 4 (n = 2 000–4 000 chacune) : talent 61,5 % ·
  synergies 59,4 % · trader 43,4 % · rotation 41,6 % · passif 31,6 %.
  L'écart talent/synergies : **2,1 points** — les deux axes d'achat
  vivent (critère 5, volet écologique).

## 4 · La suffisance — ✅ (le triangle se referme)

**Banc d'essai** (4 000 matchs-pièges construits : leader en série,
onze ~1,27× plus fort, malus proportionnel à l'arrogance) :
- **sans rotation : perd 31,1 %** (IC ±2,0) — cible ~33 ✓
- **avec rotation : perd 2,4 %** (IC ±0,7) — cible <10 ✓
- **coût de la rotation : 5,0 % de force alignée sacrifiée** — elle
  n'est pas gratuite, la suffisance décide donc de quelque chose ✓

**Contre-test M6 : suffisance coupée → 1,0 % / 2,0 %** — l'écart
disparaît, l'instrument discrimine. En écologique (pièges advenus
dans les vraies parties, ratios limites) : 51 % sans rotation
(n = 343) — plus dur qu'au banc, l'arrogance proportionnelle mord
fort près du seuil ; à considérer au réglage fin du jeu.

La forme retenue est **football-vraie et lisible** : le malus est
**proportionnel à l'écart de force** (plus tu prends l'adversaire de
haut, plus tu joues en marchant), borné à −30 %.

## 5 · Synergies vs mercenaires — 🟠 la seule décision ouverte

Tête-à-tête (2 000 matchs par point, IC ±2,5) — l'écart de notes des
mercenaires traduit leur budget AU TAUX DU MARCHÉ (~10 % de valeur
par point de note) :

| écart | budget équiv. | victoires synergies |
|---|---|---|
| +0 note | égal | **55,6 %** |
| +1 | ~+10 % | **47,0 %** |
| +2 | **~+20 %** | **42,3 %** |
| +3 | ~+30 % | 33,2 % |
| +4 | ~+40 % | 29,4 % |

Au point du critère (+20 %), **42,3 %** — sous la bande 45–55 de
2,7 points. L'axe n'est PAS mort (le concept fixait la mort hors
40–60 ; et en parties complètes l'écart talent/synergies n'est que de
2,1 points) — mais les paliers actuels, calibrés v1, valent **≈ +15 à
+20 % de budget**, pas tout à fait +20. Deux molettes possibles,
décision à Gabriel :
1. renforcer légèrement les paliers du moteur (~+15 % d'effet), ou
2. assumer 42 % : les synergies comme axe « astucieux mais pas
   équivalent », et le critère se réécrit.

## L'historique des molettes (M2) — 11 tours, aucun silencieux

| tour | molette | avant → après | déclencheur → effet mesuré |
|---|---|---|---|
| 1 | progression.jeunesse | 0 → 0,9 | pépites +10 (cible 25) → tout le monde monte (+16,7 le moyen) |
| 2 | note.duelDEF | 0,35 → 0,7 | DÉF ≥8 à 0,1 % → sans effet mesurable seul |
| 3 | suffisance malus·ratio | 0,88·1,15 → 0,84·1,20 | sans rotation 27 % (cible 33) → 36 % éco mais n minuscule |
| 4 | progression base·copains | 0,55·0,18 → 0,42·0,28 | l'écart pépite/moyen ne s'ouvre pas → toujours pas |
| 5 | note.cleanSheetDEF | 0 → 1,1 | DÉF ≥8 : 0,1 % → **10,4 %** (le collectif paie la défense) |
| 6 | **le châssis commun** | cout réel → cout 3 pour les stats | la qualité comptait DOUBLE (tier + note) : le banc des pièges sortait 0,3 % contre 36 % en éco — la note devient LA force |
| 7 | suffisance.malus | 0,84 → 0,78 | banc : 17,6 % → 36,4 % |
| 8 | note.base | 6 → 5,85 | médiane 6,6 · ≥8 10,1 % → 6,5 · 7,0 % |
| 9 | malus fixe → **proportionnel** | 0,78 → 1−0,75×(ratio−1), plancher 0,70 | un piège limite (1,2×) rendait le fort plus faible que le faible (64 % éco) |
| 10 | progression base·parNote·copains·jeunesse | 0,42·0,30·0,28·1,3 → 0,30·0,24·0,35·1,8 | l'écart s'ouvre : moyen +9,2 · pépite +22,1 |
| 11 | suffisance.pente | 0,5 → 0,75 | banc : 11,5 % → 31,1 % |

Et **un bogue d'instrument** attrapé par le diagnostic : le classement
des éliminés se départageait par prestige final — or il vaut 0 pour
tous, donc **l'ordre d'écriture du tableau décidait** ; le trader (3ᵉ
du tableau) sortait à « 99,7 % de top 4 ». Corrigé : les éliminés se
classent par manche d'élimination. Toute mesure de ce rapport est
postérieure au correctif.

## Les surprises (rapportées telles quelles)

1. **La boule de neige est douce par structure** (22 % contre 70–80
   prédits) : l'élimination, l'appariement aléatoire et la boutique
   qui monte pour tous suffisent. La masse salariale change de rôle :
   égalisateur de stratégies, pas frein — et trop haute, elle tue la
   construction (passif à 49 % à masse 0,25).
2. **Le gardien héroïque du match perdu est fréquent** (29,6 % des
   défaites), pas rare — cadeau pour le récit.
3. **Les parties durent ~21 manches** (médiane) contre 15–19 en v1 :
   les forces convergent, les écarts de buts se resserrent, le
   prestige s'érode plus lentement. À surveiller à l'implémentation
   (la cible v1 « fin 15–19 » reste souhaitable).
4. **Le plafond borne le titulaire moyen** (+9,2) : en fin de partie
   la cohorte moyenne est « finie » — c'est le moteur du dilemme de
   revente, pas un défaut.

## Ce que je recommande de trancher avant l'implémentation

1. Le point du critère 5 (renforcer les paliers ~15 %, ou assumer
   42 %).
2. La durée (accepter ~21 manches, ou resserrer les dégâts de
   prestige v2).
3. Le taux de masse salariale : 6 % retenu ici — c'est un choix de
   différenciation des stratégies, pas d'anti-boule de neige.

**Reproduction** : `node simulations/v2.js 2000 --graine=76` ·
contre-tests : `--masse=0`, `--masse=0.25`, `--suffisance=off` ·
bancs : `--pieges`, `--h2h --ecart=0..4` · trajectoires : `--diag`.
