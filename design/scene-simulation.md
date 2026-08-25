# La scène de match, refondée en simulation

Ce document dit **comment construire** la scène. Il s'appuie entièrement sur `FOOTBALL-CHIFFRE.md`, qui contient les mesures tirées de dix vrais matchs — les chiffres cités ici en viennent tous. Les deux documents forment un tout : celui-là est la mesure, celui-ci est le plan.

**Le moteur reste intouchable.** Il décide qui marque, qui est battu, quel est le score. La scène ne fait que rendre ses décisions. Si une règle d'ici semble exiger un changement de moteur, on s'arrête et on remonte le point.

---

## 1 · Le principe : l'issue est fixée, le chemin est libre

C'est le renversement qui fait tout le document.

Aujourd'hui, la scène **chorégraphie** : elle décide qu'à la seconde 3 le pion A est ici, qu'à la seconde 5 le ballon part vers B. Le mouvement est écrit, donc il a l'air écrit.

Désormais, la scène **simule sous contrainte** : le moteur donne l'issue (« Malandro marque, Ratko est battu »), et le système trouve tout seul un chemin plausible pour y arriver. Chaque pion est un agent avec une vitesse, une inertie et une raison d'être là ; le ballon est un objet physique. Personne ne suit de trajectoire écrite.

Ce n'est pas une simulation libre — ce serait ingérable et infidèle au moteur. C'est une **simulation guidée** : les cibles des agents sont choisies pour que l'action converge vers l'issue décidée, mais le mouvement qui en résulte est produit, pas dessiné.

Une bonne nouvelle tombée de l'analyse : **la scène peut tourner en temps réel.** Une transition réelle dure 10,9 s, un contre 7,4 s ; nos budgets prévoient 10 à 15 s par rendu. Aucune compression temporelle n'est nécessaire — et c'est autant de faux mouvement en moins.

---

## 2 · Le terrain et les unités

**Tout se calcule en mètres**, jamais en pixels. La conversion en pixels n'intervient qu'au dessin. C'est ce qui rend les chiffres du football directement utilisables et le rendu indépendant de la taille d'écran.

La surface suit la règle de densité — **324 m² par joueur, sur le total des deux équipes** — d'après la table du document de mesures : 70 × 46 m à cinq contre cinq, 89 × 58 à huit contre huit, 97 × 64 à huit contre onze, 104 × 68 au complet. Plafonné au rectangle peint au-delà de 22 joueurs.

Le repère : origine au centre, x vers le but adverse (positif), y latéral. C'est le repère des données réelles, donc les mesures s'appliquent sans conversion.

---

## 3 · Le pion : une physique de course

Chaque joueur est un point matériel avec quatre paramètres et aucune trajectoire écrite.

**Vitesse de pointe** issue de sa stat VIT : `6,5 + (VIT / 100) × 3` m/s, soit 6,5 m/s pour un lent et 9,5 pour un rapide. Ce sont des pointes ; la moyenne sur une course doit retomber autour de **5 m/s**, ce que la recette vérifie.

**Accélération** bornée à environ 3,5 m/s², **décélération** à 5 m/s². Un joueur ne démarre pas ni ne s'arrête instantanément — c'est l'inertie qui fait la différence entre un footballeur et un curseur.

**Rayon de braquage** : la direction ne change pas plus vite qu'environ 180°/s à pleine vitesse, davantage à l'arrêt. Un joueur lancé ne pivote pas sur place.

**Une cible et une raison.** À chaque tick, le pion reçoit un point à atteindre et un rôle nommé. Il s'y dirige avec arrivée douce — il ralentit en approchant plutôt que de s'arrêter net.

**Interdiction formelle** : aucune position ne peut dépendre d'une fonction périodique du temps. La dérive sinusoïdale actuelle disparaît. Le mouvement permanent doit émerger des micro-réajustements des rôles — c'est ça, la différence entre du bruit et de l'intention.

---

## 4 · Le ballon

Le ballon est un objet physique, jamais téléporté.

**La passe** part d'où le ballon est réellement et vise un point, pas un joueur : le point où le receveur *sera*, devant sa course. Distance de référence **12,9 m** (p10 6, p90 23). Vitesse au sol de l'ordre de 15 à 20 m/s selon la distance — une passe de 13 m met donc moins d'une seconde.

**Le centre** est une passe haute vers la surface : 8 % des passes réelles sont aériennes, et le centre en fait partie.

**La frappe** part de la zone de frappe, plus vite (25 à 30 m/s), et son issue est celle que le moteur a décidée.

**La conduite** : le ballon reste devant le pied du porteur, avec un léger décalage dans sa direction de course. C'est ce décalage qui fait lire « il conduit » plutôt que « il glisse ».

---

## 5 · Le cerveau de placement : huit rôles, une priorité

À chaque tick, chaque pion reçoit exactement un rôle. Le premier qui s'applique gagne. **Le rôle est exposé dans le diagnostic de la scène** — c'est ce qui permet la recette « on met pause, on pointe un pion, il s'explique en un mot de football ».

**1. Le porteur.** Conduit vers l'espace libre, en fuyant le presseur le plus proche. Contrainte dure issue des mesures : **il garde le ballon 1 s en médiane et parcourt moins de 2 m**. Au-delà de 4 s de conduite, la recette échoue.

**2. L'appel.** **Un seul à la fois** — la médiane réelle des courses simultanées est de 1. Le receveur du temps suivant commence sa course **avant** le départ de la passe : c'est elle qui rend l'action projetable. Longueur et durée selon le type d'appel (table des dix types dans le document de mesures) : de 8,3 m en 1,8 s pour un décrochage à 19,4 m en 3,2 s pour un débordement. L'appel contourne la ligne défensive, il ne la traverse pas.

**3. Les soutiens.** Les deux coéquipiers les plus proches se placent à distance de passe (6 à 23 m) dans un **angle ouvert** — aucun défenseur sur la ligne entre eux et le porteur. Si la ligne se ferme, ils se déplacent pour la rouvrir. **Deux, pas dix** : le porteur réel n'a que deux options, et c'est ce qui crée la tension du choix.

**4. Le pressing.** Le défenseur le plus proche vient sur le porteur, côté but. Il **part de 6 m, ferme à 2,6 m, en 1,6 s**. Les chaînes de pressing comptent trois joueurs en médiane. Fidélité au moteur : le défenseur que le moteur a désigné comme battu est celui qui arrive en retard.

**5. Le marquage.** Chaque défenseur prend l'adversaire le plus dangereux de sa zone et se place **entre lui et son propre but**, à deux ou trois mètres.

**6. La ligne.** Les défenseurs hors pressing partagent une **hauteur commune** et montent ou descendent ensemble. Hauteur de référence : **18 m devant leur but**, remontée quand le ballon s'éloigne, écrasée quand il approche. Trois lignes défensives en médiane.

**7. L'équilibre.** Tous les autres tiennent la forme : bloc qui coulisse avec le ballon, compression du côté du ballon, attaquants qui étirent en profondeur.

**8. Le gardien.** Sur l'axe ballon-but, sort sur les ballons proches.

---

## 6 · Les gabarits de situation, pilotés par le tempo

C'est la trouvaille centrale de l'analyse : **la vitesse de progression du ballon vers le but distingue les situations mieux que leur forme.** Un spectateur reconnaît un contre à sa vitesse. Un seul paramètre pilote donc tous les gabarits.

| Gabarit | Tempo | Durée | Départ | Posture défensive adverse |
|---|---:|---:|---|---|
| **Construction** | 0,04 m/s | 6,9 s | son propre tiers | bloc médian, organisé |
| **Création** | 1,3 m/s | 6,1 s | milieu | bloc médian ou bas, organisé |
| **Chaos** | 3,3 m/s | 2,6 s | n'importe où | désorganisée |
| **Contre rapide** | 4,2 m/s | 7,4 s | son camp, après récupération | haute et clairsemée, en retard |
| **Transition** | 5,4 m/s | 10,9 s | très bas | étirée sur toute la longueur |
| **Jeu direct** | 13 m/s | 3,2 s | son tiers | bloc bas, prête |
| **Coup de pied arrêté** | — | 6,3 s | position de la faute | grappe dans la surface |
| **Finition** | — | 6,1 s | tiers adverse | bloc bas, dense |

**Le choix du gabarit vient des données du moteur** — zone de récupération, École de l'équipe, postes des protagonistes, type d'événements. C'est ce qui fait qu'une Catenaccio joue des contres et une Tiki-Taka des créations, sans qu'on l'ait scripté.

**Deux invariants de géométrie**, tirés des mesures et valables dans tous les gabarits :

**Le danger converge vers l'axe.** Une action banale finit à 20 m du couloir central, une action qui finit en but à 6 m. Le resserrement doit être progressif et visible.

**La progression est un résultat d'ensemble, pas une propriété de chaque passe.** 56 % des passes réelles sont latérales et 19 % reculent. Une action où le ballon avance à chaque temps ne ressemble pas à du football. Ce qui reste interdit, c'est le ping-pong sans récit.

---

## 7 · Le séquenceur : du moteur à la scène

1. **Le moteur** livre ses phases et leur chaîne causale.
2. **La sélection** retient les phases à rendre (section 8).
3. **Le casting** attribue un gabarit à chaque phase retenue, d'après ses données réelles.
4. **La génération** produit la suite des temps : trois à cinq temps — une phase réelle n'en compte que deux, une transition cinq —, chacun étant un objectif intermédiaire donné au cerveau de placement, pas une chorégraphie.
5. **Le jeu** déroule la simulation à l'écran, en temps réel, jusqu'à l'issue décidée par le moteur.

**La chorégraphie reste honnête** : jusqu'au dernier temps, un but et un arrêt se déroulent identiquement. Le spectateur ne doit jamais pouvoir lire l'issue dans la mise en scène — sinon il lit le rendu au lieu de lire le football, et la tension retombe.

---

## 8 · La sélection : ce qu'on rend

La règle de Gabriel, appliquée telle quelle :

**Tous les buts sont rendus**, sans exception. **Plus environ 30 % de rendus supplémentaires**, tirés des occasions non converties les plus dangereuses. Si le match n'a produit aucune occasion chaude, on ne rend que les buts. S'il n'a produit aucun but, on rend la meilleure occasion. **Jamais d'écran vide.**

Le moteur produisant 2,4 buts par match, cela donne trois à quatre rendus par match — exactement le budget en place, avec ses deux formats de temps fort.

**Le seuil de « chaude » doit être très haut.** Dans le football réel, seul le centile supérieur des possessions dépasse une probabilité de tir de 0,85. Nos non-buts rendus doivent être l'équivalent : le poteau, l'arrêt réflexe, le sauvetage sur la ligne. **Une frappe lointaine captée par le gardien n'est pas une occasion chaude** — si on la rend, le spectateur apprend à reconnaître les fausses alertes, et le taux de surprise s'effondre.

Conséquence recherchée, et c'est la métrique souveraine : **le spectateur qui parie « ça rentre » se trompe trois fois sur dix.**

---

## 9 · Le commentaire

Il reste ce qu'il était — la promesse au futur, le danger quantifié, une seule ligne en bas — avec deux ajouts issus de l'observation et des mesures.

**Nommer la situation.** Sur toute situation arrêtée, la première ligne dit ce que c'est (« C'est un coup franc indirect »). C'est le raccourci le plus direct vers la reconnaissance en deux secondes.

**Le ton comme jauge de danger.** Les verbes disent le niveau : « joue tranquillement en retrait » pour une circulation calme, « les défenseurs le laissent avancer » quand la tension monte, l'exclamation quand ça brûle. Le spectateur doit sentir le danger monter rien qu'au ton, avant même la promesse.

---

## 10 · Les recettes

Les mesures deviennent des assertions. La scène s'instrumente pour relever ses propres chiffres sur un échantillon de matchs simulés, et la recette compare ses distributions à celles du football réel.

**Distributions comparées** — tolérance suggérée : médiane à ±25 %, p90 à ±35 %. Durée de possession individuelle (réel : 1,0 s) · distance parcourue par le porteur (1,75 m) · distance de passe (12,9 m) · répartition courte/moyenne/longue (62/34/4) · répartition avant/latérale/arrière (24/56/19) · longueur d'appel (10,7 m) · durée d'appel (2,1 s) · vitesse moyenne d'appel (5 m/s) · options de passe offertes (2) · appels simultanés (1) · distance de pressing au départ et au minimum (5,9 → 2,6 m) · durée de pressing (1,6 s) · lignes défensives (3) · hauteur de la dernière ligne (18 m).

**Assertions binaires.** Aucune conduite ne dépasse 4 s · aucune position ne dépend d'une fonction périodique du temps · le receveur est en mouvement avant le départ de la passe · les tempos de progression classent les gabarits dans le bon ordre · l'action se resserre vers l'axe à mesure qu'elle devient dangereuse · la surface suit la table de densité à ±5 % à tous les effectifs, y compris asymétriques · tous les buts du moteur sont rendus · la part de rendus non convertis vaut 30 % ± 10 · à tout instant, chaque pion porte un rôle nommé · but et arrêt partagent la même chorégraphie jusqu'au dernier temps.

**La métrique souveraine.** Sur trente actions rendues, le spectateur qui parie « ça rentre » doit se tromper **neuf fois** (tolérance 20 à 40 %). C'est la seule qui juge le résultat plutôt que le procédé.

**Garde-fous inchangés.** 60 fps mesurés · budgets de durée tenus · le moteur intouché · pendant le match, les pastilles actuelles restent.

---

## 11 · Le plan de livraison

Cinq étapes, chacune livrée seule, testable, et jugée sur capture avant de passer à la suivante.

**Étape 1 — La physique.** Le pion devient un agent : vitesse issue de VIT, accélération, inertie, braquage, cible et rôle nommé. Mort de la sinusoïde. Le ballon devient physique. Aucun gabarit encore, mais le mouvement change déjà de nature. Recettes : distributions de vitesse et d'accélération, zéro fonction périodique, chaque pion porte un rôle.

**Étape 2 — Le terrain élastique.** La surface suit la table de densité, à tous les effectifs, y compris asymétriques. Le décor peint est cadré sur la portion utile. Recettes : dimensions à ±5 %, pions lisibles à tous les effectifs.

**Étape 3 — Le cerveau de placement.** Les huit rôles, dans l'ordre de priorité. Recettes : les distributions d'appel, de soutien, de pressing, de ligne défensive.

**Étape 4 — Les gabarits.** Les huit situations, pilotées par le tempo, castées d'après les données du moteur. Recettes : les tempos classent dans le bon ordre, le resserrement vers l'axe, les longueurs d'action.

**Étape 5 — La sélection et le commentaire.** Tous les buts plus 30 % de chaudes, la nomination des situations, le ton comme jauge. Recette : la métrique souveraine.

À la fin de chaque étape, une capture et un verdict de Gabriel. **Une étape mal partie coûte moins cher à reprendre qu'un chantier entier** — c'est la leçon des chantiers précédents.
