# La logique football : le cerveau de placement (décision 26, étape 2)

Verdict du playtest de Gabriel sur la scène FM livrée : « C'est pas réaliste. Les pions ne bougent pas comme des vrais joueurs, ce que FM a réussi à faire. On voit des passes, des situations et des tirs, mais on ne peut pas se projeter car ça ne suit aucune logique football. »

Le diagnostic est confirmé dans le code : le mouvement hors-ballon actuel est un **bruit** (glissement de bloc + compression + une dérive sinusoïdale `sin/cos(performance.now())`). Les pions bougent pour bouger. Chez FM, chaque joueur court vers une **cible qui a une raison** — et c'est cette raison que le spectateur lit quand il « se projette ». Ce chantier remplace le bruit par de l'intention. Le moteur reste intouchable : tout se joue dans la scène.

## Le principe unique

**À tout instant, chaque pion doit pouvoir répondre à la question « pourquoi es-tu là ? »** — et la réponse doit être un mot de football : « je marque le 9 », « je propose une solution », « je tiens la ligne », « j'attaque la profondeur ». Concrètement : à chaque tick, un cerveau de placement assigne à chacun des 22 pions une **cible** et une **raison** (un rôle nommé, exposé dans le diagnostic de la scène). Le rendu ne fait plus que courir vers ces cibles avec une physique de course.

## Les rôles, par priorité (le premier qui s'applique gagne)

1. **Le porteur** : conduit vers l'avant, vers l'espace libre (fuit le presseur le plus proche, dévie plutôt que traverser). Déjà largement en place.
2. **L'appel en profondeur** — LA règle de la projection. La scène connaît la chorégraphie à l'avance : au temps N, le receveur du temps N+1 **commence sa course** vers le point de chute. La course PRÉCÈDE la passe — c'est elle qui permet au spectateur d'anticiper (« il va la donner dans l'espace ! »). Un seul appel tranchant à la fois ; l'appel contourne la ligne (arc dans le dos du défenseur), il ne la traverse pas.
3. **Les soutiens** (les 2 coéquipiers les plus proches du porteur) : se placent à distance de passe (12-18 % du terrain) dans un angle **ouvert** — pas de défenseur sur la ligne entre eux et le porteur ; si la ligne se ferme, ils se déplacent pour la rouvrir. C'est le triangle permanent du football, et c'est ce micro-réajustement continu qui remplace la sinusoïde.
4. **Le pressing** (existant, à garder) : le défenseur le plus proche vient sur le porteur, côté but. Fidélité moteur : quand le moteur désigne un défenseur battu, c'est LUI le presseur qui arrive en retard.
5. **Le marquage** : chaque défenseur du bloc prend l'adversaire le plus dangereux de sa zone et se place **entre lui et son propre but** (goal-side), à 2-3 % de terrain. Un attaquant adverse dans notre tiers sans défenseur goal-side = un trou dans la défense, et ça doit se voir PARCE QUE c'est une information.
6. **La ligne défensive** : les défenseurs hors pressing partagent une **hauteur commune** — ils montent et descendent ENSEMBLE (la hauteur suit le ballon : basse quand il approche, remontée quand il s'éloigne). Jamais un défenseur qui traîne seul sans raison de football.
7. **L'équilibre** : tous les autres tiennent la forme actuelle (bloc qui coulisse, compression côté ballon, attaquants qui étirent) — elle est bonne, elle devient le rôle par défaut au lieu d'être le seul comportement.
8. **Le gardien** : sur l'axe ballon-but, sort sur les ballons proches (existant, à conserver).

## La physique de course (la fin du bruit)

- **Supprimer la dérive sinusoïdale.** Le mouvement permanent doit émerger des micro-décisions (le marquage qui se réajuste, l'angle de passe qui se rouvre, la ligne qui respire) — plus jamais d'une fonction du temps. Interdit : `sin`/`cos` de l'horloge dans le calcul d'une position.
- **Chaque pion court, il ne glisse pas** : vitesse et accélération bornées, il accélère, freine et tourne avec de l'inertie. Cible atteinte = il décélère et se replace, il ne s'arrête pas net.
- **La vitesse max vient de la stat VIT du joueur** (données déjà dans la scène) : un défenseur lent se fait déborder VISIBLEMENT par un ailier rapide — fidélité moteur (décision 24) : le duel que le moteur a tranché se lit dans la course.

## Ce que ça change à l'écran (les tests d'acceptation)

1. **Le test de pause** : on met pause à n'importe quel instant, on pointe n'importe quel pion, et on peut expliquer sa position avec un mot de football. Recette : à N instants aléatoires, chaque pion est à moins de X % de sa cible ET porte une raison nommée (`role` dans le diagnostic).
2. **Le test de projection (celui de Gabriel)** : sur les passes de construction, le receveur est DÉJÀ en course vers le point de chute avant le départ du ballon (vitesse orientée mesurable). Le spectateur peut deviner où va la passe en regardant les courses.
3. **Zéro sinusoïde** : recette par inspection — aucune position ne dépend d'une fonction périodique du temps.
4. **La ligne se voit** : écart-type de la hauteur des défenseurs hors pressing sous un seuil, et la ligne remonte quand le ballon recule.
5. **Le marquage se voit** : dans son propre tiers, chaque attaquant adverse a un défenseur goal-side à moins d'un seuil — sauf quand le moteur a décidé qu'il était battu.
6. Les recettes existantes restent vertes (pas de téléportation, mêlées permises dans la surface sur corner — le marquage devient marquage individuel serré dans la boîte, budgets tenus, 60 fps : le cerveau tourne sur 22 pions, c'est trivial en calcul, mais mesurer).

## Méthode

Itérations courtes, une par groupe de règles : (a) physique de course + suppression du bruit ; (b) soutiens + appels branchés sur la chorégraphie ; (c) marquage + ligne. Après chaque itération, Gabriel compare sur téléphone avec FM Touch. Les identités d'École existantes (Tiki passes courtes, etc.) se branchent naturellement par-dessus : elles paramètrent les rôles (distances de soutien courtes en Tiki, ligne très basse en Catenaccio, appels permanents en Kick & Rush) — c'est le test de l'ADN qui en sortira renforcé.

Calibrage : commencer avec les valeurs standard ci-dessus ; si un comportement semble faux, une capture FM ciblée « joueurs loin du ballon » tranchera (Gabriel peut la fournir — ne pas bloquer dessus).

À consigner dans decisions.md comme l'étape 2 de la décision 26. La timeline/arbitre/temps morts (itération prévue) passent APRÈS ce chantier : l'intention prime sur le décor.

## Ajout — l'échelle des pions de scène (mesuré sur les clips FM, 2ᵉ campagne)

FM affiche des disques d'un **diamètre ≈ 5 % de la hauteur du terrain**. Notre scène était à **≈ 10,4 %** (rayon `geo.h * 0.052`) — le double, et ça compte : des pions trop gros écrasent l'espace et cassent la lecture des blocs et des courses.

- **Cible** : diamètre de scène ≈ **5-6 %** de la hauteur du terrain (rayon ≈ `geo.h * 0.027`), avec un **plancher de lisibilité** pour les très petits écrans.
- **Habillage allégé à cette taille** : anneau + numéro, comme FM. Les étoiles et les détails passent sur l'**étiquette** ou dans la **fiche joueur**, plus sur le disque.
- **Ne change RIEN aux pions de la grille de placement** : eux sont des **cibles tactiles (≥ 44 px)**, c'est un autre composant.
- **Recette** : le ratio diamètre/hauteur de scène est mesuré et **borné (4,5-6,5 %)** sur les 5 tailles d'écran du test de layout, et le **gardien** comme le **porteur** restent identifiables à la nouvelle taille.
