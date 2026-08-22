# BRIEF DE PASSATION — Le chantier « scène de match » d'ONZE

Tu reprends un chantier précis d'un projet avancé. Ce document est autonome : tout ce qu'il faut savoir est dedans ou dans le dépôt.

## Le projet en bref

**ONZE** est un auto-battler de football (« le TFT du foot ») : 8 coachs, mercato partagé, synergies, matchs automatiques, un seul survivant. Le jeu est **complet et jouable** : 71 joueurs + 40 Icônes déblockables, 23 familles de synergies, objets, quêtes, Philosophies, économie copiée de TFT au chiffre près, équilibrage simulé sur 400 lobbies, DA « Arcade » implémentée (tokens CSS, carte Blason), tutoriel, sauvegarde, PWA.

- **Jouable** : https://gabrieldoulcet-maker.github.io/onze/
- **Dépôt** : github.com/gabrieldoulcet-maker/onze (branche main). LIS D'ABORD : `CLAUDE.md` (le contrat de travail), `design/decisions.md` (le registre des décisions), `design/scene-fm.md` (TA spec — le manuel du chantier).
- **Le contrat** (résumé de CLAUDE.md) : Gabriel est directeur de jeu, pas développeur — tu écris 100 % du code, tu expliques en langage clair (compte rendu de chantier, pas de cours), chaque livraison finit par « comment tester », tout en français, et tout ce qui compte se committe dans le dépôt.

## Ta mission : la refonte de la scène de match (décision 26)

Le match d'ONZE est simulé par un moteur par phases (sain, calibré — **interdiction absolue d'y toucher**) et rendu par une scène 2D Canvas actuellement insuffisante : des pions qui bougent peu, des événements flashés au lieu d'actions jouées. Le verdict du playtest : « il faut que ça fasse vrai match, comme FM Touch ».

Gabriel a fait un travail d'observation directe de FM26 Mobile (captures et GIF analysés image par image) qui a produit **`design/scene-fm.md` : 13 règles mesurées + les chiffres du mouvement + l'annexe des réglages FM**. Ce fichier est ta partition — implémente-le règle par règle. L'essentiel :

1. **Caméra fixe, terrain entier, toujours** — pas de zoom ; tribunes floues et projecteurs en cadre.
2. **« Moments-clés » uniquement** : un match = 2-4 temps forts rendus, séparés par des cuts secs (carton minute+score). Aucun régime intermédiaire de « domination » — supprimé.
3. **Un temps fort commence par une mise en place** (~3 s : les 22 pions glissent vers leurs positions de situation) puis se joue en continu : **un événement lisible toutes les ~1,5-2 s**, 4-8 temps, issue au dernier temps seulement.
4. **Du vrai football continu** : les 22 pions dérivent en permanence, les blocs coulissent avec la possession, la conduite de balle se voit (pion + ballon devant lui), les passes VOYAGENT (dans l'espace, devant la course du receveur), mêlées autorisées dans la surface (chevauchement = information), espacement en jeu ouvert.
5. **Le commentaire écrit la promesse, au futur** : « Ramos va essayer d'en prendre possession », « Ils sont 3 face à 3 » (il QUANTIFIE le danger) — puis constate l'issue. Une seule ligne en bas, remplacée par la barre de possession au repos.
6. **Les noms suivent l'action** : numéros par défaut, étiquettes sur les 2-3 protagonistes du moment, tous les noms au but.
7. **On ne rend que des promesses** : seules les actions à enjeu réel sont rendues ; l'issue est cachée jusqu'au dernier temps (même chorégraphie but/arrêt/poteau) ; les presque-buts sont célébrés (« OHHH ! ») ; sur 10 actions rendues, le spectateur doit se tromper d'issue 3-4 fois. Ratio du moteur : ~6 occasions pour 2,7 buts — déjà calibré, n'y touche pas.
8. **Mesures de référence (vitesse minimum FM)** : temps fort complet ~15 s (corner ~23 s), horloge de jeu ≈ 2 min/seconde réelle pendant les temps forts, la montée du danger = 2/3 du temps, résolution brève, micro-ralenti 0,5 s sur les frappes de but.
9. **Budgets ONZE (inchangés, stricts)** : amical 10-15 s = 1 rendu ; manches 4-9 ~25 s = 2-3 ; match plein ~40 s = 3-5. Règle d'arbitrage : la LISIBILITÉ prime — si ça ne rentre pas, on réduit le NOMBRE de rendus, jamais leur clarté (plancher 0,8 s/temps ; le temps décisif peut s'étirer à ~1 s).
10. **Réglages à exposer** (annexe FM) : deux vitesses indépendantes (temps forts / temps morts), vue Scène / Bandeau seul, Moments-clés / Résumé complet, replay de but on/off, étiquettes on/off, traînée du ballon on/off.
11. **L'identité ONZE par-dessus la grammaire FM** : déclenchements de synergies visibles (écussons/auras des familles — la DA Arcade fournit les 23 écussons SVG), styles d'École dans la construction des actions (Tiki passes courtes, Kick & Rush long → remise, Rue conduite/dribbles, Catenaccio bloc bas → contre), célébrations Arcade branchées sur les sons existants, notes des joueurs en direct dans le recap ⚔️, tirs au but pour les nuls du duel final (règle actée).
12. **Fidélité au moteur, zéro cosmétique aléatoire** (décision 24) : chaque chose montrée vient d'une donnée réelle (le vrai perceur, le vrai défenseur battu, les attaques passent par les forces de l'équipe, les rendus adverses ciblent tes faiblesses). Test : en 3 matchs d'une équipe, on devine son ADN au mouvement.

## Exigence d'architecture nouvelle : le stade thémable

Construis la scène avec **le stade en couche de thème séparée** (terrain, tribunes, éclairage, couleur du gazon, filets = un « thème de stade » en tokens/config, pas en dur). Objectif : permettre plus tard des **skins de stade** cosmétiques (comme les arènes de TFT) sans retoucher la scène. Livre le thème par défaut + la structure pour en ajouter. (Décision à consigner dans decisions.md.)

## Architecture et garde-fous

- Le moteur (`match-moteur.js`) émet la chaîne causale d'événements ; la scène (`match-scene.js`) la MET EN SCÈNE. Le moteur est intouchable — si une règle te semble exiger un changement de moteur, tu t'arrêtes et tu le remontes à Gabriel.
- Canvas 2D, 60 fps mesurés (budget actuel : 16,7 ms/frame pour 40 — garde cette marge), mobile paysage, DA Arcade (tokens CSS existants, écussons SVG dans design/da/).
- La suite de tests reste verte à chaque étape (marathon de parties, parcours, layout 5 tailles, fidélité de scène — étends `tests/scene.spec.js` avec une recette par règle du manuel : durées mesurées, taux de surprise sur l'issue, présence des étiquettes, etc.).
- Méthode : livre par itérations COURTES (une règle ou un groupe de règles à la fois), chaque livraison testable par Gabriel sur son téléphone avec « comment tester » — c'est lui qui juge le « ça fait vrai match », par comparaison directe avec FM Touch qu'il a sous la main.

## Définition de « fini »

1. Un match plein se regarde sans lire : on comprend qui attaque, qui domine, et chaque action rendue, du terrain seul.
2. Le test des promesses passe : sur 10 actions rendues, Gabriel se trompe d'issue 3-4 fois.
3. Le test de l'ADN passe : 3 matchs d'un club suffisent à deviner son École dominante au mouvement.
4. Les budgets de durée sont tenus au chronomètre, à 60 fps, réglages exposés, stade thémable en place, suite verte.
5. Et le verdict final, subjectif et souverain : Gabriel regarde un match à côté de FM Touch et dit « ça fait vrai match ».
