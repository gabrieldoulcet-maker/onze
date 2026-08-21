# 📓 Journal de bord — ONZE

Trois lignes par session : **fait / bloqué / prochaine tâche**. C'est ce qui permet de reprendre sans friction après une pause — et le futur devlog public est déjà en train de s'écrire ici.

---

## Session 1 — (date)

- **Fait :** créé le dépôt, déposé le kit de démarrage, activé GitHub Pages.
- **Bloqué :** rien.
- **Prochaine tâche :** modifier index.html depuis une AUTRE machine (ou github.dev) pour valider le studio nomade, puis commencer les bases HTML/CSS avec Claude.

## Session 2 — 21 août 2026

- **Fait :** créé `match.html`, premier prototype de la résolution de match par phases de possession — 2 équipes de test de 5 joueurs, 8 phases en ~40 s, récit phase par phase (duels milieu/défense/tir façon xG), score final et dégâts de prestige. Réglages calibrés sur 2000 simulations (~2,4 buts/match).
- **Bloqué :** rien.
- **Prochaine tâche :** faire jouer Gabriel sur téléphone, ajuster le rythme/le récit selon son ressenti, puis brancher les synergies École/archétype sur les duels.

## Session 3 — 21 août 2026

- **Fait :** les vraies données sont dans le jeu. `design/joueurs.json` (71 joueurs) et `design/staff.md` déposés ; `decisions.md` déplacé dans `design/` (+ décisions 11 et 12 : cœur du fun = draft + synergies + staff en phase 4, match animé 2D en phase 3). Le match utilise maintenant deux équipes tirées des vrais joueurs (La Masia Rebelle, Tiki-Taka vs Fortezza Nero, Catenaccio) et les synergies Écoles/archétypes paliers 2/4/6 sont branchées sur les duels, avec une ligne de récit quand une synergie fait la différence. Moteur isolé dans `match-moteur.js` pour les tests en masse.
- **Bloqué :** rien. (Équilibrage volontairement sommaire : les paramètres bougeront beaucoup, on affinera quand tout sera en place.)
- **Prochaine tâche :** retours de Gabriel sur les synergies + son plu/ennuyé du prototype v1, puis prochaine brique (draft/boutique ou montée 5→11 ?).

## Session 4 — 21 août 2026

- **Fait :** le jeu devient jouable. Nouvelle page `draft.html` (le Mercato) : 30M d'or, boutique de 5 cartes aux couleurs du coût, refresh 2M, pool 30/25/18/10/9 et odds TFT niveau 5, achat/vente/banc/titularisation, synergies visibles en direct, contrainte de formation (1 GAR, au moins 1 DÉF/MIL/ATT), puis match contre un adversaire aléatoire (3 compos IA) et retour au mercato. `index.html` devient le menu du jeu. Style commun extrait dans `onze.css`, affichage du match partagé dans `match-ui.js`. Parcours complet testé en navigateur automatisé (mobile portrait) : achat → formation valide → match → retour, zéro erreur.
- **Bloqué :** rien. Gabriel retravaille joueurs et synergies dans une autre conversation → tout est piloté par `design/joueurs.json`, prêt à réadapter.
- **Prochaine tâche :** intégrer les nouveaux joueurs/synergies de Gabriel dès qu'ils arrivent ; ensuite enchaîner les manches (XP, intérêts, prestige, élimination) pour une vraie partie.

## Session 5 — 21 août 2026

- **Fait :** grosse journée. (1) Synergies **v2** intégrées : 11 Écoles aux paliers variés, 12 archétypes (Capitaine unique sinon guerre des égos), traits Uniques joués dans le match (El Santo, La Pantera, The Hammer…), jouer sans gardien permis, match accélérable ×2. (2) **La montée en étoiles** : 3 copies → Titulaire 2★, 3 × 2★ → Légende 3★, fusion automatique banc+terrain confondus, mise en scène (bannière dorée), étoiles affichées partout, revente au prix des copies. (3) **La vraie partie** (`partie.html`) : 8 coachs, économie TFT réelle (3M de départ, revenu 5M + intérêts + séries + victoire, XP 4M et +2/manche, niveaux 3→10, 5→11 titulaires), boutique aux odds par niveau, adversaires IA à thème d'École qui montent en puissance, matchs IA joués pour de vrai, prestige (dégâts 6+3×écart), élimination, classement, écran de fin. Jeu en sous-effectif permis (on démarre pauvre). Le 30M reste dans le bac à sable. Décisions 13-15 actées dans design/decisions.md.
- **Bloqué :** rien. Équilibrage volontairement sommaire partout (Tiki > Catenaccio connu ; courbe IA à peaufiner) — la vraie séance d'équilibrage viendra quand tout sera posé.
- **Prochaine tâche :** retours de Gabriel sur la vraie partie (durée, difficulté, moments de fun), puis au choix : quêtes/Icônes + staff (manche d'après, dixit la direction), ou polish du mercato (écran prioritaire, décision 13).

## Session 5 (suite) — 21 août 2026

- **Fait :** l'équipe starter — la vraie partie démarre avec 5 réservistes gratuits (Gus, Marcel, Rachid, Momo, Titi), un par ligne, sans École ni archétype (zéro synergie, stats minimales). Plus de blocage « pas de gardien en boutique » : la manche 1 se joue direct, chaque recrue améliore l'équipe.
- **Bloqué :** rien.
- **Prochaine tâche :** inchangée — retours de Gabriel sur la vraie partie, puis quêtes/Icônes + staff ou polish du mercato.

## Session 6 — 21 août 2026

- **Fait :** retours de playtest traités + économie définitive. (1) Variété dans le MOTEUR : casting tournant (tous les joueurs sont mis en scène, plus de radotage), les milieux et défenseurs marquent/défendent aussi, textes élargis — et surtout **événements typés** (type + acteurs) : l'architecture moteur → liste d'événements → rendu est propre, l'animation 2D de la phase 3 se branchera sans toucher au moteur. (2) Bug d'affichage corrigé : les dégâts de prestige affichent le vrai calcul (6 + 3 × écart), formule unique dans le moteur. (3) **Économie TFT exacte** (design/economie.md) : départ 0M, manches 1-3 amicales PvE sans dégâts (adversaires scriptés), droits TV 2/2/3/4→5M, sponsors avant revenu de base, séries 3-4/5/6+, table XP officielle (onze complet au niveau 9). (4) **Butin des amicaux façon orbes TFT** : valeur totale identique pour tous (7M), composition aléatoire (or / joueur gratuit / carte Staff), chaque orbe s'ouvre comme un événement, orbes-joueurs orientés vers les copies possédées + duo du centre de formation à la manche 3. (5) Simulation `simulations/fusions.js` : **84 % des parties obtiennent leur fusion 2★ avant la manche 4** (500 parties, bot chasseur de paires). (6) decisions.md : décisions 16-17 + idées pour plus tard (masse salariale, blessures/cartons, valeur marchande).
- **Bloqué :** rien.
- **Prochaine tâche :** la refonte des stats (design/stats.md) — matrice de duels à 2 stats, génération par formule, boosts ciblés, ADN du club au mercato.

## Session 6 (suite) — 21 août 2026 : la refonte des stats (sur branche, non publiée)

- **Fait :** moteur v3 selon design/stats.md. Les 13 stats (10 de champ + 3 de gardien) générées par formule — profil d'archétype × budget de coût × touche d'École, ×1,5 par étoile, variation déterministe par nom (jamais deux joueurs interchangeables), ajustements réservés aux Uniques. Matrice des duels : milieu = Passe+Vision contre Placement+Vitesse (interception) ; percée typée (dribble / course / duel aérien / centre) lisant 2 stats de chaque côté ; tir = Tir+Placement contre Réflexes (+ malus Placement des Murs). L'endurance fatigue en fin de match, le mental joue dans les moments chauds. Boosts de synergies sur stats PRÉCISES (affichées en vert). Interface : cartes note globale + 2 stats signatures, fiche complète au tap, panneau 🧬 ADN du club (6 axes en direct, force verte / trou rouge) au mercato de la partie ET du bac à sable. Décision 18 actée. Premier sondage hyper-spé vs équilibre : l'hyper-spé gagne (61/14) — contre-mesure à chercher en playtest.
- **Bloqué :** rien — en attente du go de Gabriel pour publier (il teste la version d'avant sur le site public).
- **Prochaine tâche :** publier la refonte des stats sur son go, puis prendre ses retours de jeu.

## Session 7 — 21 août 2026 : calibrage de la difficulté

- **Fait :** (1) **Dégâts de prestige = copie TFT** (design/economie.md mis à jour) : base par blocs de 3 manches (2/5/8/10/12/17) + 1 par but d'écart, amicaux toujours à zéro — et la ligne « dégâts » est masquée sur les résultats d'amicaux. (2) **Anti-emballement** dans le moteur : une équipe qui mène de 3+ lève le pied (qualité de tir et pressing réduits) — les 0-8 deviennent rares. (3) **Grande simulation** `simulations/parties.js` : un bot chasseur de paires et de synergies joue des parties complètes contre les 7 IA. Calibrage final : prestige de départ 40, courbe IA ralentie (niveau 3+manche/4 plafonné à 9, budget 1+1,35×manche plafonné à 21). Résultats sur 400 parties : **top 4 à 50,8 %** (cible 45-50 ✅), fin de partie manche ~18 (cible 15-19 ✅), première élimination manche ~12 (cible 9-11, un cran tard — à revoir avec les données de vrai jeu), écarts > 3 buts : 10 % des matchs. (4) Bot « loss-streak éco » : 75 % vivant à la manche 10 — la stratégie des Revanchards/Grinta est viable.
- **Bloqué :** rien.
- **Prochaine tâche :** la liste TFT-itude (scouting du classement, appariement sans revanche immédiate + annonce de l'adversaire, verrou de boutique, banc à 9, orbes à raretés, badges « encore 1 », historique des manches), puis staff jouable / Philosophies / Mercato d'hiver / quêtes.

## Session 7 (suite) — 21 août 2026 : la TFT-itude

- **Fait :** les 7 points de la liste. (1) **Scouting** : taper un club du classement ouvre son vestiaire — onze complet, synergies, ADN. (2) **Appariement façon TFT** : jamais deux fois le même adversaire de suite, et le prochain adversaire est annoncé au mercato (tap = scouting direct). Les équipes IA sont figées à la préparation de manche : ce que tu scoutes est ce que tu affrontes. (3) **Verrou de boutique** 🔒 : la boutique t'attend à la manche suivante. (4) **Banc à 9 places** exactement. (5) **Orbes à trois raretés** (gris/bleu/or) avec tables croissantes — plan commun aux 8 coachs : gris+gris, gris+bleu, or (le duo du centre vit dans l'orbe or à 60 %) ; premières fusions avant la manche 4 : ~67 % (79 % avant la 5). (6) **Badges de synergies avec seuil** (« 3/5 ») + badge éteint ✨ quand il ne manque qu'un joueur. (7) **Historique des manches** consultable (section repliable).
- **Bloqué :** rien.
- **Prochaine tâche :** les gros morceaux spécifiés : staff jouable, Philosophies, Mercato d'hiver, quêtes.

## Session 8 — 21 août 2026 : l'écran unique (décision 19)

- **Fait :** la Partie passe à la **structure d'écran unique de TFT mobile**. Le **terrain de foot** (lignes GAR/DÉF/MIL/ATT sur une vraie pelouse dessinée) est la scène permanente : les titulaires y sont des jetons (note + nom + étoiles, tap = fiche/banc/vendre). La **boutique est un tiroir permanent** en bas (cartes à défilement horizontal, banc au-dessus, refresh/verrou/XP), le **classement/scouting un volet** (bouton 🏆). Le **match se joue sur le terrain** — tableau d'affichage et journal du récit par-dessus la pelouse — et pendant qu'il se joue, la boutique reste ouverte : les achats vont au banc, les changements de compo attendent la manche suivante. Les résultats et les orbes arrivent en panneau par-dessus le terrain. C'est l'architecture cible du match animé 2D : il ne restera qu'à animer la pelouse.
- **Bloqué :** rien.
- **Prochaine tâche :** staff jouable, Philosophies, Mercato d'hiver, quêtes — et l'animation 2D du terrain quand son heure viendra (phase 3).

## Session 8 (suite) — 21 août 2026 : le paysage façon TFT

- **Fait :** la Partie est une **copie de l'interface TFT mobile, en paysage** (décision 19 amendée, CLAUDE.md mis à jour) : synergies + ADN en colonne gauche, terrain horizontal au centre (gardien à gauche, attaque à droite), banc sous le terrain, **classement des 8 coachs toujours visible à droite** (barres de prestige, tap = scouting), boutique en barre du bas avec Or/XP/Actualiser à gauche des 5 cartes et le verrou à droite. C'est une app : **pas d'invite de rotation — l'interface se rend toujours en horizontal**, même téléphone tenu en portrait (rotation logicielle en attendant le verrouillage natif Capacitor). Corrigés au passage (retours playtest) : le 404 console (favicon manquant, ajouté sur les 4 pages), les noms d'amicaux dans le récit (nom seul, sans « Amical — »).
- **Bloqué :** rien. Gabriel absent 4-5 h → je poursuis en continu : staff jouable, Philosophies, Mercato d'hiver, sauvegarde.

## Session 9 — 21 août 2026 : le sprint autonome (Gabriel absent)

- **Fait :** les quatre gros morceaux, en continu. (1) **Le staff jouable** : les cartes gagnées aux orbes s'assignent (colonne gauche → tap → choisir le joueur), 2 cartes sur le même joueur fusionnent en **spécialisation** (les 36 de design/staff.md, boosts de stats précises + procs de match : Double détente, Professeur, Contre-attaquant, Charognard), le **Passeport** combiné donne un **emblème d'École** (le joueur compte dans l'École) et Passeport+Passeport le **Citoyen du monde** ; le staff suit les fusions d'étoiles et revient à l'inventaire à la vente ; marqueurs 🧪🧰🛂 sur les jetons, tout est détaillé dans la fiche. (2) **Les Philosophies de club** (augments) : un choix parmi 3 aux manches 4, 7 et 10 — 13 Philosophies (économie, staff, boosts d'équipe ciblés), volet bloquant, effets définitifs. (3) **Le Mercato d'hiver** (carrousel) : manches 8 et 13, un joueur offert (parfois avec carte staff), les clubs en difficulté servis d'abord (moins de choix si tu es bien classé). (4) **Sauvegarde locale** : la partie survit au rechargement (reprise automatique, jamais en plein match), « Nouvelle partie » dans le volet 🏆. Testé sur une partie de 9 manches automatisée (philosophies aux bonnes manches, hiver à la 8, reload → reprise manche 10, zéro erreur JS) ; calibrage re-vérifié : top 4 à 50 %, fin de partie manche 18.
- **Bloqué :** rien.
- **Prochaine tâche :** les quêtes/Icônes (en attente des fiches des 40 Icônes), le polish du mercato (décision 13) et l'animation 2D du terrain (phase 3). Retours de Gabriel sur l'ensemble à son retour.
