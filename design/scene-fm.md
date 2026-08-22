# La scène de match, grammaire FM — le manuel du chantier

> **Note de reprise (août 2026).** Ce fichier n'était pas dans le dépôt au moment
> de reprendre le chantier de la décision 26 : il a été **reconstruit** à partir
> du brief de passation de Gabriel et de ses deux captures FM26 Mobile (la vue de
> match, l'écran « Paramètres matchs »). Les 13 règles et les mesures ci-dessous
> sont donc celles du brief, remises en forme et complétées des chiffres
> d'implémentation. Si Gabriel retrouve sa version d'origine, elle fait foi.

Référence unique : **Football Manager 26 Mobile, vue 2D, filtre « Moments-clés »**.
Gabriel a la référence sous la main ; c'est lui qui juge « ça fait vrai match ».

---

## Les 13 règles

**R1 — Caméra fixe, terrain entier, toujours.** Aucun zoom, aucun travelling, à
aucun moment. Le terrain occupe le cadre en entier, tribunes floues au-dessus et
en dessous, projecteurs dans le cadre. Le spectateur ne cherche jamais où
regarder : il voit tout, tout le temps.

**R2 — Moments-clés uniquement.** Un match = 2 à 4 **temps forts** rendus,
séparés par des **cuts secs** (carton noir bref : minute + score). Le régime
« domination » de l'ancienne scène est **supprimé** : il n'existe plus de régime
intermédiaire. Entre deux temps forts, on ne montre rien d'autre que le cut.

**R3 — L'anatomie d'un temps fort.** Il commence par une **mise en place**
(~3 s : les 22 pions glissent vers leurs positions de situation, le ballon se
pose), puis se joue **en continu**, sans coupure : un événement lisible toutes
les ~1,5–2 s, **4 à 8 temps**, l'issue au **dernier temps seulement**.

**R4 — Du vrai football continu.** Les 22 pions dérivent en permanence ; les
blocs coulissent avec la possession ; la **conduite de balle** se voit (le pion
avance, le ballon devant lui) ; les passes **VOYAGENT** (temps de trajet réel,
dans l'espace, devant la course du receveur, jamais de téléportation) ; les
**mêlées sont autorisées dans la surface** (le chevauchement des pions est une
information : ça se bouscule) ; l'espacement se rétablit en jeu ouvert.

**R5 — Le commentaire écrit la promesse, au futur.** Une seule ligne, en bas.
Il annonce ce qui *va* se passer (« Ramos va essayer d'en prendre possession »),
il **quantifie le danger** (« Ils sont 3 face à 3 »), puis il **constate**
l'issue. Au repos, la ligne laisse la place à la **barre de possession**.

**R6 — Les noms suivent l'action.** Numéros par défaut ; **étiquettes** (nom) sur
les 2-3 protagonistes du moment ; **tous les noms** affichés au but.

**R7 — On ne rend que des promesses.** Seules les actions à enjeu réel sont
rendues. L'**issue est cachée** jusqu'au dernier temps : but, arrêt et poteau
partagent la même chorégraphie et la même énergie. Les **presque-buts se
célèbrent** (« OHHH ! »). Recette : sur 10 actions rendues, le spectateur doit se
tromper d'issue **3 ou 4 fois**. Ratio du moteur (~6 occasions pour ~2,7 buts) :
**déjà calibré, on n'y touche pas**.

**R8 — Les mesures de référence (vitesse minimum FM).**

| Mesure | Valeur |
|---|---|
| Temps fort complet | ~15 s (corner ~23 s) |
| Horloge de jeu pendant un temps fort | ≈ 2 min de jeu / seconde réelle |
| Montée du danger | 2/3 de la durée du temps fort |
| Résolution | brève (le dernier tiers) |
| Micro-ralenti sur une frappe de but | 0,5 s |
| Mise en place | ~3 s (compressée à ~1,5 s en format court) |
| Cut entre deux temps forts | ~0,9 s |

**R9 — Les budgets ONZE (inchangés, stricts).** Amical 10-15 s → **1** temps fort
rendu ; manches 4-9 ~25 s → **2-3** ; match plein ~40 s → **3-5**.
**Règle d'arbitrage : la LISIBILITÉ prime.** Si ça ne rentre pas, on réduit le
**NOMBRE** de rendus, jamais leur clarté. Plancher **0,8 s par temps** ; le temps
décisif peut s'étirer à ~1 s.

**R10 — Les réglages exposés** (calqués sur l'écran « Paramètres matchs » de FM) :
deux **vitesses indépendantes** (temps forts / temps morts), vue **Scène /
Bandeau seul**, **Moments-clés / Résumé complet**, **replay de but** on/off,
**étiquettes** on/off, **traînée du ballon** on/off.

**R11 — L'identité ONZE par-dessus la grammaire FM.** Déclenchements de synergies
visibles (écussons/auras des 23 familles, SVG dans `design/da/`) ; styles d'École
dans la **construction** des actions (Tiki passes courtes, Kick & Rush long ballon
→ remise, Rue conduite/dribbles, Catenaccio bloc bas → contre) ; célébrations
Arcade branchées sur les sons existants ; notes des joueurs en direct dans le
recap ⚔️ ; tirs au but pour les nuls du duel final.

**R12 — Fidélité au moteur, zéro cosmétique aléatoire (décision 24).** Chaque
chose montrée vient d'une donnée réelle : le vrai perceur, le vrai défenseur
battu, les attaques passent par les forces de l'équipe, les rendus adverses
ciblent tes faiblesses. Recette : en 3 matchs d'une équipe, on devine son ADN au
mouvement.

**R13 — Le stade est une couche de thème séparée.** Terrain, tribunes, éclairage,
couleur du gazon, filets = un **thème de stade** en config (`stade.js`), jamais en
dur dans la scène. Objectif : des skins de stade cosmétiques plus tard (comme les
arènes de TFT) sans retoucher la scène.

---

## Annexe — l'écran « Paramètres matchs » de FM26 Mobile

Relevé sur la capture de Gabriel, dans l'ordre :

- **Vue** : `Terrain` · `Commentaires seuls`
- **Temps forts** : `Résumé complet` · `Moments-clés`
- **Vitesse temps forts** : curseur `Plus lent` → `Plus vite`
- **Vitesse temps morts** : curseur `Plus lent` → `Plus vite`
- **Affichage** : `Derniers scores` · `Stats du match`
- Interrupteurs : `Calendrier` · `Ballon animé` · `Les deux` ·
  `Événements en match interactifs` · `Superpositions` · `Revoir les buts`
- Bouton `Confirmer`

ONZE reprend ce qui a du sens pour un auto-battler (R10) et laisse tomber le
reste (calendrier, événements interactifs — le match d'ONZE est sans action).

---

## Définition de « fini »

1. Un match plein se regarde **sans lire** : on comprend qui attaque, qui domine,
   et chaque action rendue, du terrain seul.
2. **Test des promesses** : sur 10 actions rendues, Gabriel se trompe d'issue 3-4 fois.
3. **Test de l'ADN** : 3 matchs d'un club suffisent à deviner son École dominante
   au mouvement.
4. Budgets tenus au chronomètre, 60 fps, réglages exposés, stade thémable, suite verte.
5. **Verdict souverain** : Gabriel regarde un match à côté de FM Touch et dit
   « ça fait vrai match ».
