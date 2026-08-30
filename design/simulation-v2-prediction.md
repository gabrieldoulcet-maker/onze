# Prédictions — simulation v2, écrites AVANT le premier passage

**Date : 30 août 2026. Poussé avant toute exécution de
`simulations/v2.js` — ce fichier existe pour qu'aucun critère ne
devienne une explication d'après coup (brief v2, règle des
prédictions ; même discipline que `design/etape4-prediction.md`).**

Le montage expérimental est décrit ici avec ses **paramètres de
départ** : chaque retouche ultérieure sera consignée dans le rapport
(règle M2 — valeur avant → après → effet mesuré).

---

## 0. Le montage, et les paramètres de départ

- **Structure de partie inchangée** : 8 coachs, prestige de départ et
  dégâts `ECO`/`degatsPrestige` actuels, manches 1–3 amicales avec flux
  de butin (re-signifié centre de formation), appariement aléatoire
  entre vivants, élimination à 0 — la partie dure ce qu'elle dure
  aujourd'hui (première élimination ~9–11, fin ~15–19).
- **Joueurs générés** : tier 1–5 par la table d'odds existante par
  niveau ; note actuelle par tier (t1 40–55 · t2 48–62 · t3 55–70 ·
  t4 62–78 · t5 70–88) ; **plafond** = note + tirage (0–30, les petits
  tiers tirent les plus grandes fourchettes) ; famille (École +
  archétype) tirée des listes existantes ; effectif de départ : 11
  joueurs ~40 (plafonds variés), plafond d'effectif 15.
- **Le match** : `ONZE.simulerMatch` inchangé — les stats d'un joueur
  sont celles du moteur, multipliées par `note / 58` (la note est la
  force ; les paliers de synergies s'appliquent par-dessus, tels
  quels).
- **La note de match** (depuis `statsDuMatch` : buts, passes, arrêts,
  duels) : base 6, pondérations de départ — but +1,2 · passe +0,8 ·
  arrêt +0,55 · duel +0,35 · victoire +0,3 / défaite −0,3 · gardien :
  clean sheet +0,8, −0,25 par but encaissé au-delà du premier ;
  bornes 3–10.
- **Progression par match joué** : (0,55 + 0,3 × (note_match − 6) +
  0,18 × copains_de_famille_dans_le_onze) × marge_vers_plafond, où
  marge = min(1, (plafond − note) / 12). Ne joue pas = ne progresse
  pas.
- **Valeur marchande** : base par tier [2, 4, 8, 14, 22] M ×
  (1 + 0,12 × (forme − 6)) × (1 + 0,03 × points_de_progression_acquis),
  forme = moyenne des 3 dernières notes. Vente toujours possible au
  prix courant.
- **Masse salariale (départ)** : chaque manche, revenus −
  arrondi(0,06 × valeur_totale_effectif) M.
- **Suffisance (départ)** : série ≥ 4 ET force propre > 1,15 × force
  adverse ET moins de 3 changements dans le onze → notes du match
  ×0,88 pour l'équipe suffisante. Le signal et le remède (rotation)
  sont dans la boucle de décision des stratégies.
- **Sponsors** aux manches 4/7/10 (trois offres, une prise) ;
  **centre de formation** : aux manches 2/5/8/11, un jeune gratuit
  tier 1–2 à grand plafond (+20 à +30).
- **Les cinq stratégies-instruments** : talent brut · synergies
  d'abord · trader (pépites → minutes → revente) · rotation jeunesse ·
  passif (témoin).

## M7 — les tailles d'échantillon, calculées avant

Un critère en % de parties : IC 95 % ≈ ±1,96·√(p(1−p)/n).
- p ≈ 0,5 : ±3 % → **n ≥ 1 067** ; ±2,5 % → **n ≥ 1 537** ;
  ±1,5 % → **n ≥ 4 268**.
- Critère 3 (< 65 % / > 25 %) : bande de décision large (10+ points)
  → **n = 2 000 parties** par configuration suffit (IC ≤ ±2,2 %).
- Critère 5 (bande 45–55 %) : la bande fait ±5 → **n = 2 000
  confrontations** (IC ≤ ±2,2 %) tranche.
- Critères 1–2 : par joueur-match — des centaines de milliers de notes
  en 2 000 parties, l'IC est négligeable ; on publie les distributions.
- Critère 4 : par match leader-vs-faible — plusieurs milliers
  d'occurrences en 2 000 parties ; si < 800 occurrences, on monte à
  5 000 parties (décision consignée d'avance).

Chaque chiffre du rapport paraîtra avec son n et son IC.

---

## Critère 1 — la note de match

**Cibles** : médiane ~6 ; notes ≥ 8 < 10 % ; un gardien peut être la
meilleure note d'un match perdu.
**Prédictions** :
- La médiane sortira entre **5,8 et 6,4** dès le premier passage (la
  base 6 l'y ancre) — c'est le critère le moins risqué.
- Les ≥ 8 sortiront **trop rares chez les défenseurs** (< 3 %) et
  corrects chez les attaquants (~8–12 %) : le moteur trace peu
  d'événements défensifs nominatifs. Une retouche de pondération duel
  est probable (M2).
- Le « gardien meilleure note d'un match perdu » existera dans
  **5–15 %** des défaites — les arrêts s'accumulent justement quand on
  subit.

## Critère 2 — la progression

**Cibles** : titulaire moyen **+10–15** points par partie ; pépite bien
gérée **~+25** ; jamais aligné **~0**.
**Prédictions** :
- Titulaire moyen : **+9 à +16** sur une partie de ~14 matchs
  (0,7–1,1/match) — dans la cible ou juste dessous au premier passage.
- Pépite (grand plafond + minutes + copains) : **+20 à +28**.
- Jamais aligné : **0 exactement** (par construction — le contre-test
  est que le banc du « passif » ne bouge pas).
- Risque déclaré : la marge_vers_plafond peut freiner trop tôt les
  pépites (elles finiraient à +15) — si ça arrive, la molette sera le
  diviseur 12, consigné.

## Critère 3 — valeur + masse salariale (anti-boule de neige n°1)

**Cibles** : le 1ᵉʳ de la manche 5 gagne **< 65 %** ; un club moyen à
mi-partie atteint le top 4 **> 25 %** ; le trader top 4 **40–60 %**.
**Prédictions** :
- Premier passage : la boule de neige sera **trop forte** — le 1ᵉʳ de
  la manche 5 gagnera **70–80 %** des parties, parce que la masse
  salariale à 6 % ne mord pas assez. Le réglage attendu est vers
  **8–10 %** (chaque tour consigné).
- Club moyen (rangs 4–5 à la manche 5) → top 4 : **20–30 %** dès le
  départ.
- Trader : **35–55 %** de top 4 — compétitif mais pas dominant ; s'il
  sort < 30 %, c'est que la revente rapporte trop peu (molette : le
  multiplicateur de forme).
- **Contre-test M6 (avant de croire le critère)** : masse salariale à
  **zéro** → le taux de victoire du 1ᵉʳ de la manche 5 doit BONDIR
  (> +8 points). S'il ne bouge pas, l'instrument est mort.

## Critère 4 — la suffisance (anti-boule de neige n°2)

**Cibles** : le leader en série qui ne tourne pas perd **~1 match sur
3** contre un faible ; celui qui tourne n'en perd presque aucun
(< 10 %) ; la rotation a un coût réel ailleurs.
**Prédictions** :
- Sans rotation : le leader suffisant perdra **25–40 %** de ces
  matchs-pièges au premier passage (le ×0,88 est calibré au doigt
  mouillé — molette probable).
- Avec rotation : **5–15 %** de défaites (les remplaçants sont plus
  faibles : ce n'est jamais 0).
- Le coût de la rotation se lira ailleurs : la force moyenne du onze
  aligné en rotation sera **3 à 8 %** plus basse — si ce n'est pas
  mesurable, la rotation est gratuite et le triangle ne tient pas.
- **Contre-test M6** : suffisance à **zéro** → les défaites du leader
  contre les faibles tombent sous 10 % quoi qu'il fasse. Sinon,
  l'instrument est mort.

## Critère 5 — synergies vs talent brut

**Cible** : l'équipe à synergies bat l'équipe de mercenaires plus
chers **45–55 %** du temps.
**Prédictions** :
- Premier passage : **40–50 %** — je prédis un léger avantage aux
  mercenaires, parce que la note-force est multiplicative et que les
  paliers du moteur ont été calibrés pour des équipes v1 aux stats
  plus resserrées.
- Si < 40 % : la molette déclarée est l'écart de budget entre les deux
  équipes-test (les mercenaires « plus chers » le seront de 20 %).
- En stratégies mêlées sur parties complètes : « synergies d'abord »
  et « talent brut » finiront à **moins de 8 points de top 4 d'écart**
  — au-delà, un axe d'achat est mort.

## Les surprises que je m'engage à rapporter telles quelles

Tout chiffre hors des fourchettes ci-dessus est un résultat, pas un
échec de la simulation : il paraît au rapport avec son écart à la
prédiction. Les trois zones où je me trompe le plus probablement :
la fréquence des 8+ par poste (le moteur nomme peu les défenseurs),
la force réelle de la boule de neige, et le point d'équilibre
synergies/mercenaires.
