# Rapport de méta — Saison 1 (bloc G)

*Écrit à l'issue du sprint d'équilibrage du 21 août 2026. Méthode : la boucle
TFT « mesure → patch → re-mesure », 8 itérations de retouches de VALEURS
(jamais les mécaniques), trois instruments de mesure créés pour l'occasion.*

---

## 1. Les trois instruments (et ce que chacun mesure vraiment)

| Instrument | Ce qu'il fait | Ce qu'il mesure | Son biais connu |
|---|---|---|---|
| `simulations/meta.js` (round-robin) | 400 lobbies de 8 bots archétypaux à économie complète : pool partagé, boutique aux vraies odds, XP, séries, staff, Reliques, hivers, clone fantôme, éliminations réelles | La force des **stratégies complètes** (École × courbe d'économie) | Les bots n'adaptent ni leur formation ni leur pivot d'École : un vrai joueur répondrait |
| `simulations/meta.js … ecoles` | Les 11 Écoles jouées en mono, **même courbe économique pour toutes** | La force des Écoles à compétence égale | Mesure aussi la **démographie** (une École nombreuse et bon marché fusionne plus vite) |
| `simulations/familles.js` | Duel : équipe typée (palier actif) contre référence sans synergie à budget égal | La force **brute** des boosts et des procs | Petits budgets, référence sous-optimale : lecture directionnelle seulement |

Garde-fous re-vérifiés après chaque itération : buts/match **2,76** (cible 2-3),
fusion 2★ avant M4 **52 %** (cible ~50), top 4 du joueur simulé **48,4 %**
(cible 45-50), fin de partie **M17,9** (cible 15-19), écarts >3 buts **3,9 %**.
Rien n'a dérivé : l'équilibrage n'a pas cassé la calibration globale.

## 2. Tier-list interne — Écoles (saison 1)

Jugement croisé des trois instruments (le mode `ecoles` en chiffres) :

| Tier | École | top4 mono | Lecture |
|---|---|---|---|
| **S — à surveiller** | Catenaccio | 69 % | Solide partout : paliers profonds, proc de contre, et le placement compte double (interception + défense) |
| **S** | Les Pros | 74 % | Boosts quasi nuls après nerfs… et toujours fort : c'est la **démographie** (6 joueurs bon marché = fusions faciles) |
| **S** | Tiki-Taka | 69 % | La passe/vision gagne le duel du milieu ; nerfé trois fois, toujours au-dessus |
| **S** | Kick & Rush | 67 % | Ballon long + école bon marché (coût moyen 2,3) |
| **A — méta saine** | École de la Rue | 60 % | Le meilleur plateau du jeu (Flow + 10 joueurs), conversion moyenne |
| **A** | Les Internationaux | 56 % | Splash par excellence — paliers relevés à [3,4] pour la faire payer |
| **A** | L'Académie | 46 % | École de reroll : 3 joueurs coût ~1, portée par les 3★ |
| **B — situationnelle** | Les Revanchards | 35 % | Correcte en appoint, faible en mono (5 joueurs) |
| **B** | Football Total | 32 % | Buffée quatre fois (boosts ET seuils) ; son identité vision/vitesse paie moins que la passe |
| **C — par design** | La Grinta | 29 % | École **late** par démographie (coût moyen 3,5, le plus cher) : injouable tôt, proc de remontada +10×s pour le rush final |
| **C** | Le Douzième Homme | 6 % | École d'**appoint** par design : 3 joueurs, tous défenseurs — jamais une compo principale |

**Verdict contre les cibles.** Le centre du tableau s'est resserré (6 Écoles
entre 35 et 60 %, contre un grand écart au départ), et il y a bien ≥4 compos
au coude à coude en haut. Mais deux cibles ne sont **pas atteintes** : le
quatuor de tête reste au-dessus de ~55 %, et Grinta/Douzième restent sous 40 %
en mono. La section 5 explique pourquoi les valeurs seules n'iront pas plus loin.

## 3. Tier-list interne — Archétypes

Duel de force brute (cible 46-58 %) : **forts** — Créateur 85 %, Mur 81 %,
Moteur 77 %, Sentinelle 64 % (tous boostent passe/vision/placement, les stats
qui décident les duels du moteur). **Sains** — Renard 50 %, Finisseur 45 %,
Virtuose 43 %, Chanceux 43 %. **Faibles** — Piston 27 %, Mentor 20 %,
Guerrier 14 % (identités bâties sur mental/vitesse, stats à faible levier
depuis le nerf du mental).

Aucune spécialisation du staff n'est un auto-include : la plus présente chez
les gagnants (Ironman) est à 23 % (cible < 60 %). Les 7 Reliques tiennent dans
une bande de 49-60 % — la Chaussure Dépareillée est la plus forte, la Cage
Immaculée la plus faible, rien d'alarmant.

## 4. Ce qui a été changé (avant → après, tout le bloc G)

### Le moteur (les grands leviers)
| Valeur | Avant | Après | Pourquoi |
|---|---|---|---|
| Dé du duel du milieu | de(70) | **de(150)** | LE levier de la méta : sans lui, passe/vision gagnait ~95 % des phases |
| Poids de l'interception | ×0,7 | **×0,9** | Le placement/vitesse défensif pèse davantage |
| Mental (moments chauds) | 0,88 + 0,24×mental | **0,95 + 0,10×mental** | Le mental décidait trop de matchs à lui seul |
| Grinta menée | +6×s | **+10×s** | La remontada est son identité — assumée |
| Kick & Rush : ballon long | 15 % | **12 %** | Trop de phases volées |
| Kick & Rush : bonus M3+ | +8 | **+6** | idem |
| Catenaccio : contre éclair | 5 %×s | **4 %×s** | Cumul boosts défensifs + contre trop rentable |

### Les seuils de paliers (Écoles)
La Grinta [3,6,9] → **[2,4,6]** · Football Total [3,5,7,10] → **[2,4,6,9]**
(buffs) · Les Internationaux [2,3] → **[3,4]** · Les Pros [2,3] → **[2,4]** (nerfs).

### Les boosts de paliers et touches d'École (résumé)
Nerfs nets : Tiki-Taka (passe 5→1 au palier, touche 6→2), Catenaccio,
Les Pros (quasi à zéro), Les Internationaux, Créateur (passe 4→1), Mur,
Moteur, Sentinelle, Kick & Rush. Buffs nets : Football Total (+passe 5,
vision 6, vitesse 5), École de la Rue (+passe 3), La Grinta (+tacle),
Le Douzième Homme, Les Revanchards (+placement), Virtuose, Finisseur (tir 7),
Piston (vitesse 7/endurance 5), Chanceux (+vitesse), Guerrier (+tacle 5),
Mentor (vision 6). Profils retouchés : Créateur adouci, Virtuose et Piston
relevés. Le détail exact vit dans `match-moteur.js`
(`TOUCHES_ECOLES`, `PALIERS_ECOLES`, `BOOSTS_FAMILLES`, `PROFILS_ARCHETYPES`).

## 5. Le diagnostic franc : où les valeurs s'arrêtent

Huit itérations l'ont prouvé par la mesure : au-delà du resserrement obtenu,
**les écarts restants ne viennent pas des tables de valeurs**. Trois causes
structurelles, chiffrées :

1. **Le duel du milieu récompense l'empilement.** La force collective croît
   en √n du nombre de milieux : une équipe à 6 MIL passe/vision (Tiki+Inter)
   surclasse de ~100 points une équipe à 3 MIL — même un dé de 150 ne laisse
   que ~15 % de phases à l'adversaire. Qui gagne le milieu attaque ; qui
   attaque ne défend jamais. Les nerfs de tables (±2 points de stats) sont
   invisibles à cette échelle.
2. **La démographie fait la moitié du classement mono-École.** Les Pros à
   74 % avec des boosts presque nuls, le Douzième Homme à 6 % avec de bons
   boosts : nombre de joueurs, coût moyen et couverture des postes pèsent
   plus que les valeurs. C'est un levier de **contenu** (recomposer l'effectif
   des 71), pas de chiffres.
3. **Les stats n'ont pas le même levier.** Passe/vision/placement participent
   à tous les duels ; dribble/tir seulement après une percée ; le mental
   presque plus depuis son nerf (nécessaire). Les familles bâties sur les
   stats faibles (Guerrier, Mentor, Piston, Grinta) ne remonteront pas par
   leurs tables.

À noter aussi : dans le round-robin, les bots ne pivotent jamais et ne
répondent pas tactiquement — les ~85 % des stratégies tempo y sont un
majorant, pas une prédiction du jeu réel contre des humains.

## 6. Trois recommandations (mécaniques — décision à prendre, hors bloc G)

1. **Plafonner le rendement du milieu surchargé** : au-delà de 4 milieux,
   les suivants comptent à 50 % dans le duel du milieu (comme la dilution
   défensive existante). Corrige la cause n°1 avec dix lignes.
2. **Généraliser le contre** : l'équipe qui perd le duel du milieu garde une
   petite chance de contre (~5 %, portée par vitesse/tacle). Les identités
   défensives et physiques (Catenaccio déjà servi, mais aussi Piston,
   Guerrier, Moteur) convertiraient enfin leurs stats.
3. **Recomposer la démographie en saison 2** : donner au Douzième Homme et à
   l'Académie 2-3 joueurs de plus (dont un MIL/ATT), lisser le coût moyen de
   la Grinta — l'équilibrage par le contenu, comme TFT le fait à chaque set.

## 7. Limites d'instrumentation (assumées et documentées)

- **Icônes approximées** dans les simulations (une unité bonifiée à M8/M12,
  pas les 40 quêtes réelles) — le « chasseur d'Icônes » est mesuré avec cette
  approximation, ses 79 % sont à confirmer en jeu réel.
- **Une Relique par bot** à M12 (le jeu réel n'en donne qu'une par partie via
  l'orbe de coupe) — l'instrument compare les Reliques entre elles, pas leur
  rareté réelle.
- Les **courbes économiques des bots** (éco, late, fast8) restent des
  approximations d'un joueur moyen ; la dépense panique à prestige bas a été
  ajoutée, mais un humain jouerait mieux ces lignes.
