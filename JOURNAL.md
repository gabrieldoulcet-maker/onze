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

## Session 10 — 21 août 2026 : les Icônes v1

- **Fait :** le système de quêtes et d'Icônes (design/icones.md, groupes I-II + le duo prioritaire). **23 Icônes** implémentées : les 12 d'ouverture (Globe-Trotteur, Patient, Trader, Enfant Gâté, Banquier, Fidèle, Bourreau des Petits, Espion, Repêché, Chouchou, Surdoué, La Tour), les 10 de milieu de partie (Héritier, Idole des Ultras, Mur Originel, Éternel Revenant, Cobaye, Binational, Système, Comptable, Phénix, Serrurier) et **Gus & Titi — les Increvables** (garder un réserviste titulaire jusqu'à la manche 10 → le duo revient en Icônes coût 4). **3 quêtes visibles** à la fois (le duo d'office au départ), remplacées quand elles se débloquent ou deviennent impossibles ; déblocage = bannière 🏆, et l'Icône est **garantie à la prochaine relance** (première carte de la boutique, dorée). **La Ferveur est un compteur réel** (🔥 dans la barre) : gestes de rue, buts d'anthologie (Virtuose/Chanceux/Pantera), arrêts décisifs, remontadas — elle nourrit l'Idole des Ultras (20 🔥). Les Icônes valent **+15 % de stats**, sont des copies uniques (jamais de fusion) et comptent dans les familles. Le moteur compte maintenant les duels aériens gagnés (La Tour) et expose l'état de match. Testé : déblocages forcés et organiques (2 Icônes tombées naturellement en 4 manches de test), duo signé, sauvegarde migrée.
- **Bloqué :** rien.
- **Prochaine tâche :** les groupes III-V des Icônes (fin de partie, Légendes 6-7, autres Duos — besoin des passifs spécifiques à trancher), les identités passives des Icônes v1 (Chouchou +1 slot staff, Banquier +1M…), et le polish mercato / animation 2D.

## Session 10 (suite) — 21 août 2026 : la garantie staff des amicaux

- **Fait :** retour du playtest complet de Gabriel (tout validé) → un seul correctif, appliqué : **la présence des cartes staff n'est plus une loterie**. Le PLAN de butin des 3 amicaux garantit désormais **au moins 2 orbes-staff** à chaque coach (règle TFT du stage 1) — la variance porte sur lesquels des 5 orbes les portent et sur le reste du butin, jamais sur leur présence. Vérifié sur 1 000 parties simulées : minimum 2 cartes staff reçues avant la manche 4, zéro exception (et les premières fusions restent à ~53 % avant la manche 4). Migration des sauvegardes en cours.
- **Bloqué :** rien.

## Session 11 — 21 août 2026 : la durée progressive des matchs

- **Fait :** décision 20 actée et appliquée — **la durée d'un match est proportionnelle à ses enjeux**. Amicaux (manches 1-3) : 4 phases, ~14 s mesurées (l'essentiel est le butin). Premières manches PvP (4-9) : 6 phases, ~25 s. Pleine durée (8 phases, ~40 s) dès la manche 10. L'accélérateur ×2 reste partout. Le moteur prend le nombre de phases en paramètre (minutes affichées, fatigue, mi-temps des Murs/El Santo et Pantera calées sur le format) et les matchs courts sont des condensés (conversion relevée pour garder un rythme de buts par match). Corrigé au passage : la Sélection du District (amical 3) n'aligne plus que 2 vrais joueurs — un cran au-dessus, pas un mur (93 % de victoires pour une équipe de manche 3 réaliste, 32 % par 3+ pour la quête du Bourreau). Calibrage re-vérifié avec les formats progressifs : top 4 à 48 %, fin de partie manche ~18, écarts > 3 : 9,8 %.
- **Bloqué :** rien.

## Session 12 — 21 août 2026 : formation libre, lisibilité totale, panneaux de familles

- **Fait :** trois chantiers issus du playtest de Gabriel. (1) **Formation libre** (décision 21) : seule contrainte, 1 joueur max dans les buts — bus 1+4, zéro milieu, tout est permis. Tap-tap pour échanger deux joueurs (halo doré), re-tap pour le menu (avec choix de ligne). **Hors-poste autorisé avec malus** : −10 % ligne adjacente, −25 % à deux lignes, −50 % et réflexes plancher pour un joueur de champ dans les buts (😱). **Le Football Total devient l'École qui ignore les postes** (paliers ×0,6 / ×0,3 / annulé pour toute l'équipe — fiche mise à jour dans design/synergies.md), Ruud immunisé. Moteur : duels par ligne jouée, attaque improvisée (personne devant) à −50 %, surnombre défensif saturé et dilué. Sim du bus 1+4 : 43 % V / 57 % N contre une compo équilibrée, battu par une attaque investie — **viable, pas dominant** ; équilibre général intact (1,86 buts, 29/37). (2) **Lisibilité totale** : pastille de poste G/D/M/A colorée partout (poste JOUÉ + liseré d'alerte hors-poste), 23 glyphes uniques d'Écoles et archétypes sur les jetons, cartes, scouting et badges, légende ？. (3) **Panneau de familles** : tap sur n'importe quel badge (actif, éteint ✨, ou dans le scouting adverse) → identité en une phrase, paliers avec l'actif en surbrillance, contributeurs terrain+banc, teaser du palier suivant (« Encore 1 — Nino (3M) est en boutique ! » ou le compte du pool). Textes dans synergies-data.js, extrait de design/synergies.md.
- **Bloqué :** rien.

## Session 13 — 21 août 2026 : le grand lot UI/gameplay du playtest

- **Fait :** six chantiers. (1) **Déblocage** : bouton 🧹 Réinitialiser sur l'accueil + sauvegardes versionnées (une sauvegarde d'un ancien schéma est écartée — plus jamais de partie coincée). (2) **Verrou 1 gardien** sur tous les chemins (placerAuClub, point d'entrée unique des acquisitions ; titularisation d'un 2ᵉ GAR = échange intelligent ; l'auto-complétion n'en monte jamais un 2ᵉ) + **auto-complétion au coup d'envoi** façon TFT (banc, gauche d'abord, ligne naturelle, réservistes seulement si banc vide, montée visible) + banc réordonnable + test anti-régression tests/gardien.spec.js. (3) **Ligne de progression des manches** (barre de stage TFT) : pastilles 🤝⚔️🧭❄️🏆, courante en surbrillance, tap = un mot ; remplace le M du bandeau. (4) **Matchs de coupe** PvE (6/9/12/15, Loups du Comté & cie, aucun dégât, 2 composants staff garantis chacun) + amicaux à 3 composants garantis → **12-14 composants par partie** (minimum vérifié : 11), design/economie.md à jour. (5) **Chrono de préparation** : 35 s (20 s amicaux), barre sous les pastilles, urgence sonore/visuelle, coup d'envoi auto, ~30 s sur les événements avec résolution auto, pause en arrière-plan, mode détente en option (décision 22). (6) **Drag & drop tactile** (pointer events, fantôme 60 fps) : banc→terrain (échange auto si plein), terrain↔terrain, terrain→banc, glisser vers la boutique = zone « Vendre X — nM », cibles surlignées, malus hors-poste prévisualisé sur la ligne survolée, tap-tap conservé en secours.
- **Bloqué :** rien.
- **Prochaine tâche :** retours de Gabriel ; en file : Icônes groupes III-V, passifs d'Icônes, polish mercato, animation 2D.

## Session 14 — 21 août 2026 : le sprint UI-TFT (écran rogné + les 6 chantiers)

- **Fait :** (0) **Le bug bloquant de l'écran rogné** : cause = hauteurs en `100vh` alors que la barre du navigateur ampute la hauteur réelle. Corrigé en `100dvh` + `safe-area-inset` partout, plus **compression du terrain** (jamais de la boutique : les boutons Recruter gardent leur hauteur de contenu). Verrouillé par tests/layout.spec.js : visibilité des contrôles critiques sur 5 tailles réelles (844×390, 667×375, 812×375, 844×340, 667×320). Au passage : **plein écran** (bouton ⛶ + manifest PWA, invite « Ajouter à l'écran d'accueil »). Puis les 6 chantiers de design/ui-tft.md, dans l'ordre : (1) **Le Calepin du recruteur** 📝 : galerie des 71 joueurs, compo rêvée épinglée (≤11), « Photographier mon équipe », paliers prévisionnels — et les joueurs planifiés **brillent en boutique** (liseré bleu). (2) **L'éclat de fusion** : 2 copies possédées → la carte pulse ★★ en vert (or ★★★ si elle complète une 3★), badge •2/3 dès la première copie. (3) **Le recap du match** ⚔️ : contributions par joueur (⚽ buts, 🎯 passes décisives — le moteur crédite le porteur de la phase, ⚔️ duels gagnés, 🧤 arrêts), barres, onglets vers le camp adverse, 🌟 homme du match annoncé au coup de sifflet — consultable pendant ET après le match. (4) **La boutique escamotable** 🪙 : tap sur le sac d'or, il reste or + Actualiser + verrou, le terrain respire. (5) **Le scouting fluide** : un panneau navigable entre les 8 clubs (swipe ou ◀ ▶), liseré jaune « tu visites » (panneau + classement), retour bleu fixe, disponible pendant le match et le Mercato d'hiver (bandeau 🔎). (6) **La bascule du panneau gauche** : synergies + ADN ⇄ staff + quêtes, les pages se remplacent, le bouton compte les cartes staff en attente. Et l'**arbre du staff** : tap sur une carte → ses 9 combos, aperçu en direct par joueur, confirmation avant fusion, Labo 🧪 des 36. Clôture : simulations re-validées (fusion avant M4 : 50,3 % ; staff garanti ≥2 : zéro exception ; **top 4 : 48 %**, première élim M12,4, fin M17,2) + **parcours automatisé de bout en bout** (tests/parcours.spec.js : 5 manches jouées au navigateur, tous les panneaux ouverts, sauvegarde/reload, zéro erreur JS).
- **Bloqué :** rien.
- **Prochaine tâche :** retours de playtest de Gabriel sur le sprint ; en file : Icônes groupes III-V et leurs passifs, animation 2D du terrain (phase 3).
