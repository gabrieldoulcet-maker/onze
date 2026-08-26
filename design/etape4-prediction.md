# Étape 4 — la prédiction, écrite AVANT de commencer

*26 août 2026. Ce document est daté et poussé avant la première ligne de code de l'étape 4.
Il énonce une hypothèse de cause, et ce que chaque mesure devrait faire si cette cause est
la bonne. Le relire après coup n'a de valeur que parce qu'il a été écrit avant — c'est la
discipline du critère pré-enregistré (règle M2 bis), appliquée cette fois à un changement de
CONCEPTION et non à une mesure. Et cette fois la référence est déjà bonne.*

---

## L'hypothèse

**Trois des quatre dettes ont la même cause : pendant un temps fort, une grande partie des
pions est tenue par une chorégraphie écrite, donc indisponible pour presser, défendre ou se
proposer.**

Ce n'est pas une intuition, c'est un relevé. Sur 4 820 pions échantillonnés en régime
« action » (un match, 482 relevés) :

| rôle | part | qui le donne |
|---|---:|---|
| `scenario` | 26,3 % | la chorégraphie |
| `tireur` · `battu` · `percee` · `suit` | 14,9 % | la chorégraphie |
| gardien | 17,8 % | le cerveau |
| marquage · ligne · appel · équilibre | 33,9 % | le cerveau |
| **soutien** | **4,0 %** | le cerveau |
| **pressing** | **2,6 %** | le cerveau |
| porteur | 0,5 % | le cerveau |

**41,1 % des pions sont tenus par un scénario** — pas « la moitié », comme je l'ai écrit
d'abord. Et les deux rôles qui portent nos dettes sont les deux plus rares : soutien 4,0 %,
pressing 2,6 %.

---

## Les prédictions, par mesure

| Mesure | Aujourd'hui | Prédit après l'étape 4 | Confiance |
|---|---:|---|---|
| Options de passe ouvertes (1 à 3) | 53 % | **75 – 88 %** (+22 à +35 points) | forte |
| Densité de pressing | 5,50/min | **7,5 – 9,0/min** (+35 à +65 %) | forte |
| Fermeture sous 3 m | 53 % | **56 – 65 %** (+3 à +12 points) | **faible** |
| Dispersion entre matchs | 0,64 – 1,16 | **1,0 – 2,0** | moyenne |

**Pourquoi les deux premières sont fortes.** Elles mesurent une *disponibilité*. Un
coéquipier tenu par un scénario ne se propose pas ; un défenseur tenu par un scénario ne
presse pas. Libérer 41 % des pions doit augmenter mécaniquement le nombre de soutiens à
distance de passe et le nombre de défenseurs assez proches pour presser.

### Ce que l'instrument peut VOIR — la moitié basse de la troisième prédiction est invisible

Une prédiction n'a de valeur que si l'échantillon peut la distinguer de « rien n'a bougé ».
Puissance simulée pour détecter un mouvement depuis 53 % :

| mouvement | n = 200 | n = 400 | n = 600 |
|---|---:|---:|---:|
| 53 → 56 % | 17 % | 33 % | 42 % |
| 53 → 58 % | 36 % | 63 % | 79 % |
| 53 → 60 % | 59 % | 86 % | 97 % |
| 53 → 65 % | 95 % | 100 % | 100 % |

**À n ≈ 200, un atterrissage à 56 % n'a que 17 % de chances d'être vu.** Autrement dit, si
l'étape 4 produit exactement le bas de ma fourchette, je ne le saurai pas. Et le piège est
pire que l'absence de résultat : un 56 % mesuré se lirait spontanément comme *« ça a bougé
un peu, comme prévu, confiance faible »* — **une prédiction faible confirmée par du bruit**,
la forme la plus séduisante du faux positif, parce qu'elle a l'air modeste.

**Règle de lecture, fixée d'avance** : à n ≈ 200, seul un atterrissage **≥ 60 %** se
distingue de « rien n'a bougé ». Entre 53 et 58 %, la conclusion s'écrit **« non
mesurable »** — jamais « petit mouvement ». Pour conclure sur la moitié basse, il faudrait
n ≈ 600, soit une douzaine de passages cumulés.

**Pourquoi la troisième est faible, et c'est le point qui compte.** La fermeture ne mesure
pas une disponibilité mais une *réussite* : un presseur, par définition, n'a jamais de cible
imposée — la chorégraphie ne le retient pas. Ce qui devrait l'aider est autre chose : le
**tempo**. Une phase de construction (0,04 m/s) laisse à un défenseur le temps d'arriver au
contact ; une phase de jeu direct (13 m/s) ne le laisse pas. C'est un mécanisme différent, et
je m'attends donc à un mouvement plus petit et moins sûr.

---

## Ce que chaque issue voudra dire

- **Les trois bougent dans le sens prédit** → la cause commune est confirmée. On aura gagné
  plus qu'un correctif : on saura *pourquoi*.
- **Les deux premières bougent, la troisième peu ou pas** → la disponibilité était bien la
  cause commune de *deux* dettes, et la fermeture était un symptôme voisin avec sa propre
  cause. C'est l'issue que je considère la plus probable, et c'est pour ça que la troisième
  prédiction est déclarée faible **à l'avance** plutôt qu'expliquée après coup.
- **Seule la troisième bouge** → l'hypothèse est fausse. Ce n'était pas une cause commune,
  c'étaient trois symptômes qui se ressemblaient.
- **Aucune ne bouge** → les gabarits n'ont pas libéré les pions, et il faut chercher ailleurs
  que dans la chorégraphie.

## La règle de lecture

Une prédiction ratée qui a été écrite d'avance vaut mieux qu'une explication reconstruite
après coup. Le tableau ci-dessus ne se retouche pas : il se compare.


---

## Amendement du 26 août, AVANT de commencer : un second levier, et une question de référence

Un fil tiré avant d'écrire le premier gabarit — parce qu'une prédiction qui vise le mauvais
levier coûte plus cher à découvrir après huit gabarits qu'avant.

**Le soupçon de départ ne tient pas, et c'est une erreur de dénominateur.** L'idée était que
« deux tiers des pions mis en rôle de presseur ne produisent jamais d'engagement mesurable »,
d'après un rapport de 3,1× entre la part en rôle (2,6 %) et la part en engagement calculée
(0,83 %). Mais ce 0,83 % divisait par **22 joueurs**, alors que nos matchs de manche 10 en
comptent **dix**. Mesuré directement plutôt que calculé : **1,56 % du temps-joueur en rôle,
1,46 % en épisode ≥ 1 s — un rapport de 1,06×**. Le rôle se convertit presque entièrement.
*(C'est encore la famille M2 : un chiffre emprunté à une population de 22 appliqué à une
population de 10.)*

**Mais le fil menait ailleurs, et à deux choses réelles.**

**(a) 60 % du temps passé en rôle de presseur se joue alors que PERSONNE ne tient le
ballon** — il est en vol ou libre. La mission de pressing est un compte à rebours de deux
secondes qui ne regarde pas si le porteur existe encore : quand la passe part à 17 m/s, le
presseur continue de « presser » un ballon parti. D'où une distance au ballon pendant le
rôle de **p10 4,6 · médiane 7,9 · p90 29,4 m** — le p90 à trente mètres est la queue du
ballon en vol.

**(b) Nos durées de pressing sont un pic, pas une distribution.** Mesuré **p10 1,36 · médiane
2,01 · p90 2,02 s** contre un réel **1,10 · 2,10 · 4,40**. La médiane tombe juste *par
construction* — la mission dure 2,0 s en dur — et **le p90 est à 2,02 là où la réalité dit
4,40**. Aucun de nos pressings ne dure plus que le minuteur. C'est un défaut de **forme** que
la médiane cachait, et il est **indépendant de l'hypothèse de chorégraphie**.

**Conséquence sur la prédiction** : la densité de pressing a donc **deux leviers possibles**,
pas un. Si elle bouge après l'étape 4, il faudra distinguer lequel a joué — et c'est pour ça
que les deux sont écrits ici, avant.

**Et une question de référence que je ne tranche pas seul.** Les 7,01 épisodes/minute sont
mesurés sur du football à **22 joueurs**. Sur nos matchs à **dix**, la même densité de
surface est conservée (324 m²/joueur) mais il y a deux fois moins de défenseurs. Deux
lectures s'opposent, et elles ne donnent pas le même verdict :

| lecture | notre chiffre | le réel | verdict |
|---|---:|---:|---|
| **par match** (épisodes/minute) | 5,50 | 7,01 | nous sommes **22 % en dessous** |
| **par joueur** (part du temps-joueur) | 1,46 % | 1,12 % | nous sommes **31 % au-dessus** |

Les deux sont exacts ; ils ne mesurent pas la même chose. Tant que la question n'est pas
tranchée, **la dette de densité repose sur une référence dont la transférabilité n'est pas
établie** — et la règle est qu'une référence se remesure sur la population pertinente, elle
ne se réinterprète pas.


---

## Amendement II — trois leviers, trois prédictions séparées

*Écrit avant le premier gabarit. La version précédente traitait la densité et la fermeture
comme un seul phénomène à cause commune. C'est faux : il y a **trois mécanismes distincts**,
et ils ne bougent pas les mêmes chiffres. Les mélanger aurait rendu le résultat
ininterprétable, quel qu'il soit.*

### Levier A — la chorégraphie retient les pions (disponibilité)

41,1 % des pions sont tenus par un scénario pendant un temps fort. Un coéquipier tenu ne se
propose pas ; un défenseur tenu ne prend pas de rôle défensif. **Ce levier agit sur les
OPTIONS DE PASSE, et sur elles seules avec certitude.**

> **Prédiction A** : options ouvertes **53 % → 75-88 %**. Confiance **forte**.
> Mécanisme : libérer 41 % des pions multiplie les soutiens à distance de passe.

### Levier B — le plafond de 2 s tronque les pressings longs

Notre mission de pressing est un compte à rebours de deux secondes **en dur**. Mesuré :
durées p10 1,36 · médiane 2,01 · **p90 2,02 s**, contre un réel 1,10 · 2,10 · **4,40**.
Aucun pressing ne peut dépasser le minuteur.

Et ce n'est pas cosmétique — **un pressing qui dure ferme plus près**, et la relation est
monotone sur six bandes de durée (mesuré sur les 6 306 épisodes ≥ 1 s) :

| durée | n | minimum médian | part < 3 m |
|---|---:|---:|---:|
| 1,0–1,5 s | 1 549 | 2,73 m | 56,7 % |
| 1,5–2,0 s | 1 318 | 2,48 m | 62,2 % |
| 2,0–2,5 s | 993 | 2,35 m | 67,1 % |
| 2,5–3,5 s | 1 201 | 2,13 m | 67,5 % |
| 3,5–5,0 s | 831 | 1,67 m | 74,7 % |
| > 5 s | 414 | 1,28 m | **87,2 %** |

**Le chiffre décisif** : si on tronque le vrai football à notre plafond de 2,02 s, la part
sous 3 m tombe de **65,9 % à 59,6 %**. Notre minuteur explique donc **6 des ~13 points** de
la dette de fermeture, à lui seul — les pressings qui auraient fermé tard ne ferment jamais.

> **Prédiction B** : fermeture sous 3 m **53 % → 59-60 %** (**≈ +6 points**). Confiance
> **forte sur le mécanisme**, et c'est un changement par rapport à l'amendement I : j'avais
> déclaré cette prédiction faible en croyant que le levier était la chorégraphie. Le levier
> est le plafond, il est nommé, et sa taille est **calculée**, pas estimée.

> **⚠ La conséquence désagréable, écrite d'avance.** 59-60 % est **exactement** mon seuil de
> détectabilité : à n ≈ 200, un atterrissage à 60 % a 59 % de chances d'être vu, à 58 % il en
> a 36 %. **Même en réparant B parfaitement, je serai à la limite de ce que l'échantillon
> sait voir.** Il faut donc prévoir le cumul d'emblée : **n ≈ 600, soit une douzaine de
> passages**, pour trancher à 86-97 % de puissance. À défaut, j'écrirai « non mesurable » sur
> un correctif qui aura pourtant marché — et je préfère le dire maintenant que le découvrir
> comme une déception.

### Levier C — la mission survit au départ du ballon

**60 % du temps passé en rôle de presseur se joue alors que personne ne tient le ballon** :
il est en vol ou libre. Distance au ballon pendant le rôle : p10 4,6 · médiane 7,9 · **p90
29,4 m**. Un presseur qui poursuit un ballon parti à trente mètres n'est pas un presseur.

Ce levier est **indépendant des deux autres**. Il ne change ni le nombre d'épisodes ni leur
issue : il change ce que le mot « pressing » recouvre, et il fausse toute lecture de la part
du temps-joueur passée en engagement.

> **Prédiction C** : la part du temps de rôle passée sans porteur **60 % → sous 20 %**, et la
> distance au ballon p90 **29,4 m → sous 12 m**. Confiance **forte** (c'est une condition
> d'arrêt, pas un comportement émergent). Effet attendu sur la densité et la fermeture :
> **aucun** — et si l'un des deux bouge en réparant C seul, c'est que je n'avais pas compris
> le mécanisme.

### La densité, elle, reste SUSPENDUE — sa référence n'est pas transférable

Les 7,01 épisodes/minute sont mesurés à 22 joueurs, et il n'existe **aucune séquence à
effectif réduit** dans les dix matchs SkillCorner (zéro carton rouge). Tout taux « à effectif
réduit » serait une extrapolation — la faute payée trois fois cette semaine.

**Une dette dont la référence n'est pas transférable ne mesure rien.** Elle est donc
suspendue, pas rouge, jusqu'à ce que la question soit tranchée **chez nous** : nos matchs se
jouent de cinq contre cinq à onze contre onze, il suffit de mesurer les deux lectures à
travers nos propres effectifs.

- **la part par joueur est stable pendant que le taux par match bouge** → l'invariant du
  système est celui **par joueur**, la question est réglée sans rien emprunter ;
- **aucune des deux n'est stable** → il y a une dépendance à l'effectif à expliquer **avant**
  d'appliquer la moindre référence.

*(L'argument qui rend la seconde lecture plausible : la décision 50 fixe 324 m² par joueur,
et le vrai football en fait 321,5 — nos terrains réduits reproduisent **exprès** la densité
spatiale du football professionnel. Or un pressing est un événement **spatial** : il arrive
quand deux joueurs se rapprochent. Si la densité spatiale est tenue constante par
construction, c'est la grandeur **par joueur** qui se transfère. Sous cette lecture la dette
change de signe : 1,46 % contre 1,12 %, soit 31 % de pressing **en trop**. C'est un
raisonnement, pas une mesure — d'où la mesure.)*


---

## Amendement III — la mesure à travers les effectifs : ni l'une ni l'autre n'est stable, et un écart de 3× à expliquer

Trois effectifs, trois matchs chacun, relevés le 26 août :

| pions sur le terrain | secondes rendues | épisodes ≥ 1 s | **par match** | **par joueur** | fermés < 3 m |
|---:|---:|---:|---:|---:|---:|
| 11 | 102 | **3** | 1,76/min | 0,59 % | 67 % |
| 16 | 145 | 16 | 6,64/min | 1,43 % | 38 % |
| 22 | 143 | 27 | 11,31/min | 1,72 % | 52 % |
| *référence* | | | *7,01/min* | *1,12 %* | *65,9 %* |

**Aucune des deux lectures n'est stable.** Le taux par match croît d'un facteur 6,4 entre
onze et vingt-deux pions ; la part par joueur croît d'un facteur 2,9. L'invariant par joueur
qu'on espérait n'existe pas — c'est la seconde branche : *il y a une dépendance à l'effectif
qu'il faut expliquer avant d'appliquer la moindre référence.*

**Et une anomalie plus urgente que la question elle-même.** La ligne à onze pions donne
**1,76/min**, quand la recette mesure **5,50/min** sur des matchs de manche 10 nominalement
équivalents — un écart de **trois fois**, entre deux mesures de la même grandeur sur le même
code. Avec **3 épisodes** dans cette cellule, elle ne prouve rien ; mais l'écart, lui, doit
être expliqué. Deux différences connues entre les deux protocoles : ce relevé **force**
`partie.terrain` et le niveau de tous les coachs, là où la recette laisse l'état naturel du
jeu ; et il compte les épisodes depuis l'extérieur de la page plutôt qu'avec
l'instrumentation interne.

**Conséquence, et elle est nette : la dette de densité reste SUSPENDUE.** Pas rouge, pas
verte. Une dette dont la référence n'est pas transférable ne mesure rien — et ici, ce n'est
même plus seulement la référence qui est en cause, c'est la concordance de nos deux
instruments. Tant que 1,76 et 5,50 ne sont pas réconciliés, **aucun verdict de densité n'est
recevable**, quel que soit le dénominateur choisi.

C'est exactement le genre de chose qu'on préfère apprendre avant d'avoir écrit huit gabarits.


---

## Amendement IV — l'anomalie était un fantôme, et la comparaison appariée existait déjà

### 1. Mes deux colonnes n'étaient pas deux lectures, c'était une identité

Par construction : `part par joueur = taux × durée ÷ (60 × pions)`. En remontant la durée
implicite de mes trois cellules :

| pions | taux | part | **durée implicite** |
|---:|---:|---:|---:|
| 11 | 1,76/min | 0,59 % | 2,21 s |
| 16 | 6,64/min | 1,43 % | 2,07 s |
| 22 | 11,31/min | 1,72 % | 2,01 s |

C'est **mon minuteur de deux secondes** qui ressort dans les trois. « Aucune des deux
lectures n'est stable » était donc **un seul fait énoncé deux fois**. La vraie question n'a
jamais été « par match ou par joueur » : c'est **comment le taux monte avec l'effectif**, et
sur les cellules exploitables il monte en `P^1,67`.

### 2. La comparaison qui ne demande aucun argument de transférabilité était déjà dans la table

Le vrai football, c'est 22 joueurs sur 104 × 68. La décision 50 donne **exactement ce
terrain** à 22 pions. La cellule à 22 pions est donc **appariée**, sans rien transposer :

> **11,31/min chez nous contre 7,01/min réel.**

Même effectif, même terrain, même densité spatiale. Il n'y a pas de question de transfert :
il y a une cellule appariée, et elle dit que nous avons du pressing **en trop**, pas en
moins.

*Correction du 26 août, au standard de la cellule écartée : ce chiffre vient de **3 matchs
et 27 épisodes** (143 s). Le même critère qui a fait juger la cellule à 11 pions « sans
valeur » (3 épisodes) impose de qualifier celle-ci : IC exact de Poisson à 90 % sur
l'excédent = **+14 % à +123 %**. La **direction** est robuste — la borne basse (8,0/min)
reste au-dessus de 7,01 — mais l'**ampleur** est connue à un facteur deux près. On écrit
donc « excédent, ampleur à confirmer », jamais « +61 % » nu : personne ne doit calibrer les
gabarits pour retirer 61 % d'une grandeur connue à ±50 %.*

**Et la faute qui l'avait cachée est la nôtre de la semaine, une strate plus haut.** Le
« 5,50 contre 7,01 » comparait une **moyenne prise sur des effectifs mélangés** à une
référence à 22 joueurs. La moyenne est tirée vers le bas par les petits effectifs, et le
verdict **s'inverse dès qu'on apparie**. Cette fois ce n'était pas la population des
*épisodes* qui bougeait, c'était celle des **matchs**.

### 3. L'anomalie à 3× : classée, c'était un fantôme

Relevé demandé : la distribution d'effectifs des matchs que joue la recette (huit matchs,
protocole identique).

| match | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| pions | 10 | 11 | 11 | 13 | 13 | 14 | 14 | 13 |

**Médiane 13 pions**, étendue 10-14 — pas onze, et pas seize. En interpolant à 13 pions avec
la loi `P^1,67`, depuis la cellule à 16 comme depuis celle à 22, on attend **≈ 4,7/min**. La
recette mesure **5,50**. Écart : **+17 %**, un écart d'échantillon ordinaire.

**Il n'y a donc rien à réconcilier.** Le 3× était fabriqué par ma cellule à onze pions et ses
**trois épisodes** — un chiffre qui ne prouvait rien, opposé à un chiffre qui en valait onze.
Dix minutes de requête au lieu d'une journée d'enquête.

### Ce qui lève la suspension — et ce n'est pas ce que je croyais

La dette de densité **reste suspendue**, mais plus pour la raison écrite à l'amendement III.
Elle ne se lèvera pas en tranchant « par match ou par joueur » — cette question n'existe pas.
Elle se lèvera en **comparant à effectif égal**, et cette comparaison n'est anchrée qu'en un
point : **22 pions**, le seul endroit où notre terrain et le terrain réel coïncident.

**Conséquence pour la recette** : son assertion de densité compare aujourd'hui une **moyenne
sur 10-14 pions** à une référence à 22. Elle doit soit se restreindre aux matchs à
22 pions, soit ne rien affirmer. La première option coûte du temps de recette — il faut
forcer le niveau 9 et rejouer — et c'est un arbitrage à rendre. En attendant, la ligne
reste suspendue plutôt que rouge, et **le fait à retenir est celui de la cellule appariée :
un excédent démontré en direction, d'ampleur à confirmer** (IC 90 % : +14 à +123 %).
