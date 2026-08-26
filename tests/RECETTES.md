# Les recettes d'ONZE — le dénominateur

**21 fichiers de recette.** Ce nombre est le dénominateur de « suite complète
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

## Ce qui est écarté, et pourquoi

**« 18 lancées sur 19 » sans dire laquelle rouvre exactement ce que M5 avait fermé.**
Un dénominateur n'est complet que si les absences sont nommées. Le lanceur imprime la
ligne à recopier telle quelle dans tout compte rendu :

```
19 recette(s) sur le disque · 1 écartée(s) : scene
```

| Recette | Écartée quand | Pourquoi | Qui la lance |
|---|---|---|---|
| `tests/scene.spec.js` | quand la livraison ne touche ni `match-scene.js`, ni `stade.js`, ni la couche de match | elle appartient à la **conversation scène**, dure ~6 min, et porte ses propres dettes (le marquage à 68 %) — la lancer depuis l'écran de placement mélangerait deux verdicts | la conversation scène à chaque étape, et **toute livraison qui touche à la couture** (`design/contrat-scene.md`) |

Écarter n'est pas ignorer : `--sauf=scene` doit apparaître dans le rapport, et une
livraison qui touche à la scène ou à sa couche la relance **sans l'option**.

## Le rituel de livraison

Trois gestes, dans cet ordre, avant tout commit qui part sur `main` :

1. `node outils/estampiller.js` — l'estampille que porte le bandeau du jeu. Une capture
   d'écran doit dire de quelle version elle date (règle M3 ter). Elle ne porte **qu'un
   horodatage** : le script tourne avant le commit qui la contient, donc toute révision
   affichée serait celle du parent. Oublier ce geste **sort rouge** : `zones.spec.js`
   compare l'estampille aux **dates de commit** — pas aux `mtime`, qu'un `pull` ou un
   `checkout` réécrivent tous.
2. `node tests/lancer-tout.js` — le rapport porte son identifiant de passage, son
   horodatage et la révision. **C'est cette ligne qu'on cite en annonçant un chiffre.**
3. Le compte rendu recopie la ligne du lanceur, écartées comprises.

Deux garde-fous, complémentaires :

- **`tests/lancer-tout.js`** lit la liste **sur le disque** et annonce N/N avec le détail.
  Ajouter un `tests/*.spec.js` suffit à l'inclure ; en oublier un devient impossible.
  C'est le lanceur à utiliser.
- **`tests/scene.spec.js`** compare le nombre et la liste **publiés ici** au contenu du
  disque : si ce fichier prend du retard, il sort rouge.

| Recette | Ce qu'elle garde |
|---|---|
| `tests/carnet.spec.js` | le carnet façon TFT : 30 joueurs vus d'un coup, aucun nom coupé, colonnes par coût, filtre permanent, détail à côté de la grille, épinglage |
| `tests/quetes-lien.spec.js` | le lien quête ↔ joueur : aucune quête muette, la relation symétrique dans les deux sens, la fiche qui liste ses quêtes, le retour cliquable |
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

| Dette | Mesuré (cumul) | Cible | Échéance |
|---|---|---|---|
| 1 à 3 options de passe ouvertes | **53 %** sur 142 passes | **88 %** (médiane 2) | étape 4 |
| Densité de pressing | **5,50/min** sur 2 150 s · 197 épisodes pour 251 attendus | **7,01/min** (borne basse) | étape 4 |
| Part des pressings fermant sous 3 m | **53 %** sur 197 épisodes — *n ≥ 160 atteint, la dette est DÉMONTRÉE* | **65,9 %** (épisodes ≥ 1 s) | étape 4 |
| Dispersion des pressings entre matchs | 0,64 à 1,16 selon le cumul | **≈ 1,05** (le vrai football : 5,56 sur des matchs entiers) | étape 4 — *la seule qui se mesure sur n = MATCHS* |

### Ce que le cumul a changé, en chiffres

Sur un passage isolé, la densité pouvait sortir **verte** : le premier passage d'une série
donnait 62 épisodes pour 63,9 attendus, p = 0,437. Quatre passages cumulés donnent
**197 épisodes pour 251,2 attendus**, p = 0,0002 — la dette est **démontrée**. Le vert isolé
était du bruit, et seule l'addition des **données** (pas des verdicts) a donné au test la
puissance de trancher.

> **Deux séries, deux populations.** Le « 62 pour 63,9 » ci-dessus vient d'une série
> antérieure (empreinte `7112792c`, deux passages) ; le tableau ci-dessous vient de la série
> retenue (empreinte `a317db02`, quatre passages), où le premier passage vaut 52 épisodes
> sur 531 s. Les deux sont exacts séparément et la conclusion ne bouge pas — mais racontés
> dans le même paragraphe ils ne se réconcilient pas, et c'est la famille M2 : deux
> populations présentées comme une seule.

| | épisodes | fermés < 3 m | secondes | taux |
|---|---:|---:|---:|---:|
| passage 1 | 52 | 25 | 531 | 5,88/min |
| passage 2 | 45 | 22 | 535 | 5,05/min |
| passage 3 | 45 | 26 | 542 | 4,99/min |
| passage 4 | 55 | 31 | 542 | 6,09/min |
| **cumul** | **197** | **104** | **2 150** | **5,50/min** |

Deux conséquences immédiates :

- la dette de **fermeture** franchit son seuil de puissance — **n = 197 ≥ 160** — et
  **53 % contre 65,9 % est désormais démontré**, non plus « non concluant » ;
- l'assertion de **stabilité de l'instrument** apparaît au troisième passage et passe :
  *5,9 · 5,0 · 5,0 · 6,1 épisodes/min, cumul 5,50, plancher à la moitié*. La recette est
  fiable ; c'est la scène qui manque de pressing.

**Et il faut savoir avec quelle marge elle passe.** L'écart-type de ces quatre taux vaut
**0,564**, là où le bruit de Poisson pur à ~49 épisodes par passage en prédirait **0,784** :
nos passages varient **deux fois moins que le hasard seul** — cohérent avec la
sous-dispersion de la scène. Cette assertion ne se déclenchera donc que sur un passage
franchement **cassé**. C'est exactement ce qu'on lui demande — un garde-fou de **fiabilité**,
pas de justesse — mais sans cette note, quelqu'un lira un jour ce vert comme une garantie
d'exactitude. **Un vert dit « rien ne s'est effondré », jamais « la valeur est juste » :
c'est le cumul, et lui seul, qui répond de la justesse.**

### Le cumul dit combien, la répétition dit si la mesure est fiable

Le mécanisme de dette a d'abord annoncé « DETTE PAYÉE, à promouvoir » **dès qu'une exécution
passait** — deux fois le même jour, et deux fois à tort : sur un p = 0,15 obtenu **faute de
puissance**, puis sur un taux qui oscille de 4,57 à 5,96 par minute. Le piège nommé par la
règle M6 quater était posé **dans l'outil qui sert à l'éviter**.

Le remède d'abord retenu — « trois exécutions vertes d'affilée » — était **le mauvais** : il
agrège des **verdicts** au lieu d'agréger des **données**, et trois tests à n = 50 n'auront
jamais la puissance d'un test à n = 150. C'est composer deux médianes, une strate plus haut.

Les deux questions sont donc séparées, parce qu'elles n'ont pas le même remède :

- **contre le bruit d'échantillon, on CUMULE.** `tests/.cumul-scene.json` persiste les
  comptages entre exécutions — épisodes, fermetures, secondes rendues, épisodes par match,
  passes et options — et les quatre dettes tranchent sur le **n cumulé**. La dette de
  fermeture demande 160 épisodes : à ~55 par passage, **trois passages les donnent**, et
  seulement si on les additionne.
- **contre la volatilité de l'instrument, on RÉPÈTE**, et la question n'est pas « trois
  verts » mais **« aucun passage ne s'effondre »** — plancher à la moitié du taux cumulé.
  Une recette peut osciller pour des raisons qui ne sont pas de l'échantillonnage : un
  tirage qui change l'ordre des phases, une image qui charge plus tard, un temps fort qui se
  coupe. Seule la répétition l'attrape.

**Le sac porte l'empreinte du code qu'il mesure** — un SHA-1 de `match-scene.js`,
`match-ui.js` et de la recette — et se vide dès que l'un d'eux change : un cumul qui
traverserait un changement de code mesurerait deux comportements différents. C'est M2
appliqué au **temps** plutôt qu'à la population. *(Le fichier est ignoré par git : c'est une
mesure locale, pas un artefact du dépôt.)*

### Deux tests plutôt que deux fourchettes — et ce que chacun achète

**La densité.** Un plancher « référence −15 % » supposait les deux nombres bruités, et à
N ≈ 31 épisodes le bruit d'un taux vaut ±29,5 % : le plancher n'était pas soutenu par
l'échantillon. *(Au passage : « un taux se stabilise sur le nombre de matchs » est faux — la
précision suit le nombre d'**épisodes**, en 1/√N, exactement comme une médiane.)* Mais la
référence, elle, est **exacte** : 7,01 épisode/minute vient de 6 306 épisodes réels. La
question devient un **test unilatéral** — *ce comptage est-il trop bas pour une espérance
connue ?*

```
380 s rendues → attendu λ = 44,4 · observé 29 → p = 0,009
```

Décidable, là où le plancher ne l'était pas. Et il **se renforce tout seul** quand la durée
rendue s'accumule : 368 s → 0,035 · 500 s → 0,015 · 700 s → 0,005 · 900 s → 0,002. La même
assertion devient de plus en plus dure sans qu'on y touche.

**L'hypothèse est vérifiée, pas supposée.** Poisson suppose l'indépendance ; des pressings
groupés dans un même temps fort rendraient le p optimiste. L'indice de dispersion est mesuré
à chaque exécution et surveillé **d'un seul côté** : sous 1 le test est conservateur, donc
sans risque ; au-delà de 2 il devient optimiste.

**La fermeture — et la limite du procédé.** Le même raisonnement s'applique à la part sous
3 m (proportion contre une référence exacte de 65,9 %), et il a été **vérifié avant d'être
attendu**. Verdict : le test binomial tranche **immédiatement quand l'écart est grand**
(9/25, soit 36 % → p = 0,002) mais **pas à l'écart réel** (16/29, soit 55 % → p = 0,15).
Pour *détecter* onze points d'écart à 80 % de puissance il faut n ≈ 120 — exactement le
nombre que l'argument de bruit donnait.

**Un test réfute plus vite qu'il ne conclut.** « p ≥ 0,05 » à n = 29 ne dit pas que le
pressing est conforme, il dit qu'on n'a pas de quoi l'affirmer. La dette reste donc ouverte
et ne se paiera qu'avec la **puissance de conclure** — jamais avec un vert obtenu faute
d'échantillon.

### Le pressing : la dette change d'instrument, et son blocage est l'ÉCHANTILLON

**La dette « minimum 2,1 contre 2,61 » est close** — 2,61 est la médiane sur la population
**entière**, or nous mesurons les **épisodes ≥ 1 s**, dont la médiane réelle vaut **2,27**.
Notre 2,1 est à −7,5 %, dans la tolérance. Le changement de population avait été déclaré,
et la comparaison se faisait quand même contre l'ancien chiffre : *une note à côté d'un
chiffre faux laisse le chiffre faux* (M2 bis). Trois conséquences, toutes dans le code : la
**mission de pressing revient à 2,0 s** (elle avait été ramenée à 1,6 contre le mauvais
repère, alors que 2,0 était juste — un *épisode* réel dure 2,10 s, pas 1,60) ; le **départ
était exact** (6,4 contre 6,41) ; la **durée passe à ±15 %** parce que son erreur se propage
dans le minimum, pas parce qu'un rythme se ressent.

**Une nouvelle dette la remplace, et elle peut décider** : la **part des épisodes qui
ferment sous 3 m**. Référence **65,9 %** — sur les pressings ≥ 1 s, la population que nous
mesurons ; ce serait 58,7 % sur la population entière, et l'écrire serait refaire la même
faute. Nous sommes à **54-55 %**, soit −17 % en relatif : la dette existe.

Pourquoi la proportion et plus la médiane : le bruit se chiffre.

| n | bruit d'une médiane | bruit d'une proportion |
|---:|---:|---:|
| 30 | ±27 % | ±21,7 % |
| 60 | ±19,6 % | ±16,4 % |
| 120 | ±14,1 % | **±10,7 %** |
| 240 | ±10,3 % | ±7,6 % |

**Ce qui bloque n'est plus le code, c'est le nombre d'épisodes.** Il en faut **120** pour
que le bruit (±10,7 %) passe sous la tolérance (±15 %) — règle M6 bis. Or le rendement
mesuré est de **3,4 épisodes de pressing par match** (31 épisodes sur 9 matchs, relevé le
26 août), pas la trentaine espérée : atteindre 120 demande donc **~35 matchs, soit ~26
minutes** de recette. La recette de scène en dure aujourd'hui 7.

Un banc dédié — jouer des temps à la chaîne sans cut ni célébration — a été prototypé et
**écarté** : sans le séquenceur réel, le rôle « pressing » ne s'allume jamais (48 temps
joués, 0 épisode). Il aurait mesuré autre chose (M6).

**La décision est donc un arbitrage de temps de recette, pas de code**, et elle appartient
à Gabriel : soit une recette longue dédiée, lancée à la demande plutôt qu'à chaque
livraison, soit on garde la dette affichée avec son échéance à l'étape 4 — les gabarits
changeront de toute façon la fréquence des pressings, et le rendement par match avec elle.

### Deux tableaux qui ne se comparent plus

La population de mesure du **minimum** a changé le 25 août 2026 : elle ne retient plus que
les pressings **qui ont duré au moins une seconde** (les amorces ne sont pas des pressings
ratés, ce sont des pressings qui n'ont pas eu lieu). Les chiffres relevés avant ce
changement ne sont **pas lisibles** contre ceux d'après — notamment la durée « 0,8 s »
citée dans un tableau antérieur, qui valait 1,6 s sur l'ancienne population. Règle M2 : la
transformation se déclare à côté du chiffre.
