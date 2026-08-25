# Les recettes d'ONZE — le dénominateur

**19 fichiers de recette.** Ce nombre est le dénominateur de « suite complète
verte » : une livraison le cite, et un écart entre le nombre cité et le nombre sur le
disque est un **échec de livraison**, pas un détail de rédaction (règle M5).

Deux conversations ont annoncé « 13 suites vertes » et « 14 recettes » le même jour, pour
15 fichiers réels — puis ce fichier lui-même a dit 15 pendant que le disque en portait
18. **Le mécanisme a fonctionné : la recette est sortie rouge à la fusion.** C'est
exactement ce pour quoi elle est écrite, et c'est pour ça qu'on ne la désactive pas.

Il a fonctionné une seconde fois le même jour : `tests/orbes.spec.js` est arrivée par
l'autre côté et ce fichier annonçait encore 18. **Deux fois en une journée, sur deux
conversations différentes** — c'est la démonstration que le dénominateur ne se tient pas
à la main.

**Ce fichier est un inventaire, pas un compteur.** Mettre le nombre à jour sans écrire ce
que garde la nouvelle recette le transformerait en compteur — précisément ce que la règle
M5 veut empêcher. Une ligne s'ajoute avec sa raison d'être, ou elle ne s'ajoute pas.

Deux garde-fous, complémentaires :

- **`tests/lancer-tout.js`** lit la liste **sur le disque** et annonce N/N avec le détail.
  Ajouter un `tests/*.spec.js` suffit à l'inclure ; en oublier un devient impossible.
  C'est le lanceur à utiliser.
- **`tests/scene.spec.js`** compare le nombre et la liste **publiés ici** au contenu du
  disque : si ce fichier prend du retard, il sort rouge.

| Recette | Ce qu'elle garde |
|---|---|
| `tests/accueil.spec.js` | la home : contraste de chaque texte, invite d'installation, matière des composants |
| `tests/achat.spec.js` | l'achat au tap, l'appui long, la modale de première partie |
| `tests/da.spec.js` | la direction artistique : luminosité des illustrations, arène, épuration |
| `tests/drag.spec.js` | le glisser-déposer JOUÉ AU POINTEUR, du pointerdown au pointerup (règle M1) |
| `tests/gardien.spec.js` | un seul gardien sur le terrain |
| `tests/hierarchie.spec.js` | la hiérarchie visuelle : le banc ne dépasse jamais le terrain (P4) |
| `tests/layout.spec.js` | la mise en page sur cinq écrans, l'échelle des pions, le portrait |
| `tests/marathon.spec.js` | une partie entière, du premier tour au champion |
| `tests/matieres.spec.js` | le système de matières : plus aucun aplat |
| `tests/orbes.spec.js` | la cérémonie de butin : le match rangé AVANT (P2), la taille de l'orbe face à un joueur, sa place hors des colonnes sur 20 tirages — le `Math.random()` rend le défaut intermittent — et aucune attente muette (P3) |
| `tests/parcours.spec.js` | le parcours complet du joueur, sans erreur JS |
| `tests/perf.spec.js` | 60 fps tenus |
| `tests/portraits.spec.js` | l'intégrité de la table de portraits |
| `tests/rendu.spec.js` | un seul chemin de rendu hors match |
| `tests/scene.spec.js` | la scène de match : physique, terrain, cerveau, figurines |
| `tests/terrains.spec.js` | les terrains d'entraînement et leur géométrie |
| `tests/tirs-au-but.spec.js` | la séance de tirs au but |
| `tests/unites.spec.js` | les figurines de l'écran de mise en place |
| `tests/zones.spec.js` | la grille de zones : rien ne flotte, rien n'en recouvre une autre (P1) |

## Les dettes assumées

Une recette qu'on **sait** rouge s'écrit quand même (règle M3) : elle porte la dette à
l'écran et retombe verte toute seule le jour où le défaut est réparé. Elle ne compte pas
dans les échecs — sans quoi on ne distinguerait plus une dette connue d'une régression —
mais elle s'affiche en rouge et **prévient quand elle devient verte**, pour qu'on la
promeuve en vraie assertion.

**Une dette porte une échéance ET sa cible chiffrée.** Un rouge toléré sans date devient
du mobilier ; un rouge sans cible ne dit pas quand il sera payé.

| Dette | Mesuré | Cible | Échéance |
|---|---|---|---|
| 1 à 3 options de passe ouvertes | 54-62 % des passes | **88 %** (médiane 2) | étape 4 |
| Distance minimale d'un pressing | 2,1-3,1 m selon l'exécution | **2,61 m** (±15 %) | étape 4 |

### La distance minimale du pressing : le second nombre existe encore

Le test décisif est revenu **partagé**, pas unanime. Remettre la mission de pressing à
1,6 s a réparé la **durée** exactement (2,0 → 1,6, cible 1,6) mais le **minimum** n'a bougé
que de 2,0 à 2,1 pour une cible de 2,61 : il n'est pas remonté, il a frémi. Il **oscille
autour du seuil** d'une exécution à l'autre (2,1 · 2,2 · 3,1 mesurés), donc la dette
s'affiche verte certains jours — ce n'est pas une dette payée, c'est une dette instable.
Un des deux nombres est trouvé, le second existe toujours : il n'est pas classé.

### Deux tableaux qui ne se comparent plus

La population de mesure du **minimum** a changé le 25 août 2026 : elle ne retient plus que
les pressings **qui ont duré au moins une seconde** (les amorces ne sont pas des pressings
ratés, ce sont des pressings qui n'ont pas eu lieu). Les chiffres relevés avant ce
changement ne sont **pas lisibles** contre ceux d'après — notamment la durée « 0,8 s »
citée dans un tableau antérieur, qui valait 1,6 s sur l'ancienne population. Règle M2 : la
transformation se déclare à côté du chiffre.
