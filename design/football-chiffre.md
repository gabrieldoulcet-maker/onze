# La carte d'identité chiffrée du football

**Ce document remplace mon jugement par des mesures.** Tout ce qui suit est extrait de **dix vrais matchs professionnels** (championnat australien 2024/25, données de tracking SkillCorner ouvertes) : 47 853 événements, 9 566 possessions individuelles, 5 002 courses sans ballon, 4 581 phases de jeu, sur un terrain de 104 × 68 m.

Il sert deux usages : **c'est la spec** de la scène de match, et **c'est la recette** — chaque chiffre devient une assertion vérifiable. La scène ne sera plus jugée sur « est-ce que ça fait vrai », mais sur « est-ce que nos distributions ressemblent à celles du football réel ».

Une convention de lecture : les mesures sont données en **p10 · médiane · p90**, parce qu'un football réaliste n'est pas un football moyen — c'est un football qui a la bonne *dispersion*.

---

## 0 · Les quatre décisions de Gabriel

Elles encadrent tout le reste et ne se renégocient pas.

**Le rendu.** Tous les buts sont rendus, plus environ 30 % de rendus supplémentaires tirés des occasions les plus dangereuses non converties. Aucun but dans le match : on rend la meilleure occasion. Aucune occasion chaude : on ne rend que les buts. Jamais d'écran vide. Conséquence recherchée : le spectateur qui parie « ça rentre » se trompe **trois fois sur dix**, par composition de l'ensemble et non par tricherie sur une action.

**La surface.** Densité constante du football réel — **324 m² par joueur** — calculée sur le **total des joueurs présents**, les deux équipes confondues. Le terrain grandit au fil de la partie, et l'asymétrie des effectifs (8 contre 11, 6 contre 12) se voit.

**Le mouvement.** Calibré sur les chiffres de ce document, pas sur de la prose.

**L'architecture.** On passe de la chorégraphie à la simulation : chaque pion a une vitesse issue de sa stat, une inertie et une raison d'être là. On donne l'issue au système, il trouve comment y arriver.

---

## 1 · La surface de jeu, effectif par effectif

324 m² par joueur, en gardant le rapport longueur/largeur du football (1,53).

| Joueurs sur le terrain | Surface | Dimensions |
|---|---|---|
| 10 (5 v 5) | 3 240 m² | 70 × 46 m |
| 12 (6 v 6) | 3 890 m² | 77 × 51 m |
| 14 (7 v 7) | 4 540 m² | 83 × 55 m |
| 16 (8 v 8) | 5 180 m² | 89 × 58 m |
| 19 (8 v 11) | 6 160 m² | 97 × 64 m |
| 22 (11 v 11) | 7 130 m² | 104 × 68 m |
| 23 (11 v 12) | 7 450 m² | 107 × 70 m |

Au-delà de 22 joueurs, on ne dépasse pas le rectangle peint : on garde 104 × 68 et on accepte une densité légèrement supérieure — c'est ce que fait le football réel avec le Douzième Homme.

**Toutes les mesures de mouvement ci-dessous sont exprimées en mètres et restent valables à tous les effectifs**, puisque la densité est conservée. C'est tout l'intérêt de la règle.

---

## 2 · Le porteur de balle

C'est la mesure la plus contre-intuitive du lot, et celle qui va le plus changer notre scène.

| Mesure | p10 | médiane | p90 |
|---|---|---|---|
| Durée d'une possession individuelle | 0,0 s | **1,0 s** | 3,4 s |
| Distance parcourue avec le ballon | 0,0 m | **1,75 m** | 11,3 m |
| Vitesse du porteur | 0,8 m/s | **2,5 m/s** | 5,0 m/s |
| Options de passe disponibles | 0 | **2** | 4 |

**Un joueur garde le ballon une seconde et parcourt moins de deux mètres.** Trente pour cent des possessions sont jouées en une touche, et 47 % comportent une conduite — mais une conduite courte. Le football réel est un jeu de remise, pas de dribble.

Comment finit une possession : **passe 90 %**, perte 5 %, **tir 2 %**, dégagement 1 %, faute subie 1 %.

Et le chiffre qui compte le plus pour la mise en scène : **le porteur n'a que deux options de passe.** Notre scène ne doit pas montrer dix coéquipiers disponibles — elle doit en montrer deux, et c'est ce qui crée la tension du choix.

---

## 3 · La passe

| Mesure | p10 | médiane | p90 |
|---|---|---|---|
| Distance de passe | 6,0 m | **12,9 m** | 23,3 m |

Portée : **courte 62 %**, moyenne 34 %, longue 4 %.
Direction : **latérale 56 %** (28 % à gauche, 28 % à droite), **vers l'avant 24 %**, **en arrière 19 %**.
Aériennes : **8 %** seulement.

**Plus d'une passe sur deux est latérale, et une sur cinq va en arrière.** Une scène où le ballon avance à chaque temps ne ressemble pas à du football — elle ressemble à un exercice. La progression est un résultat d'ensemble, pas une propriété de chaque passe.

---

## 4 · L'appel sans ballon

C'est le mouvement qui rend le jeu projetable : la course précède la passe. Voici les dix types réels, avec leur fréquence et leur géométrie. « Gain de ligne » indique de combien la course rapproche le joueur de la dernière ligne défensive adverse (valeur négative = il l'attaque).

| Type d'appel | Part | Longueur | Durée | Vitesse | Gain de ligne |
|---|---:|---:|---:|---:|---:|
| Course dans le dos du ballon | 28 % | 10,8 m | 2,1 s | 5,1 m/s | −3,7 m |
| Soutien | 15 % | 10,1 m | 2,0 s | 4,9 m/s | −3,0 m |
| Décrochage court | 14 % | 8,3 m | 1,8 s | 4,6 m/s | +2,6 m |
| Décrochage | 13 % | 8,5 m | 1,9 s | 4,7 m/s | +3,3 m |
| Receveur de centre | 8 % | 15,4 m | 2,8 s | 5,3 m/s | −1,5 m |
| Course en profondeur | 7 % | 13,9 m | 2,5 s | 5,7 m/s | −2,9 m |
| Écartement | 7 % | 10,8 m | 2,2 s | 4,8 m/s | −0,4 m |
| Débordement extérieur | 3 % | **19,4 m** | 3,2 s | 5,8 m/s | **−9,0 m** |
| Appel entre les lignes | 3 % | 8,9 m | 1,9 s | 4,8 m/s | +0,5 m |
| Débordement intérieur | 2 % | 15,0 m | 2,7 s | 5,4 m/s | −8,2 m |

Direction : **53 % vers l'avant**, le reste réparti également entre latéral et retour.

Deux chiffres décisifs pour la scène :

**Il n'y a qu'un seul appel à la fois** (médiane des courses simultanées : 1). Notre scène ne doit pas faire courir toute l'équipe — un appel tranchant, et les autres qui se replacent.

**Seuls 27 % des appels sont servis.** Les trois quarts des courses ne reçoivent jamais le ballon. C'est précisément ce qui crée le suspense : le spectateur voit l'appel, espère la passe, et elle ne vient pas toujours.

---

## 5 · Le bloc défensif et le pressing

| Mesure | p10 | médiane | p90 |
|---|---|---|---|
| Nombre de lignes défensives | 2 | **3** | 3 |
| Hauteur de la dernière ligne (depuis son but) | 0,3 m | **17,7 m** | 39,5 m |
| Distance du presseur au départ | 2,7 m | **5,9 m** | 9,5 m |
| Distance minimale atteinte par le presseur | 0,9 m | **2,6 m** | 5,2 m |
| Durée d'un pressing | 0,5 s | **1,6 s** | 3,9 s |
| Longueur d'une chaîne de pressing | 2 | **3** | 6 |

La défense est **organisée 48 % du temps** — le reste, c'est du replacement ou du chaos. Les structures les plus fréquentes : 4-4-2 (14 %), 4-2-4 (7 %), 5-4-1 (6 %), 5-2-3 (4 %).

Le comportement hors possession, par fréquence : **bloc médian 32 %**, chaos 24 %, **bloc bas 16 %**, **bloc haut 13 %**, défense du jeu direct 8 %.

Et une leçon d'humilité pour nos scènes : **le pressing ne récupère le ballon que 19 % du temps** (16 % indirectement, 3 % directement). Presser, c'est surtout gêner.

---

## 6 · Les situations, et leur dangerosité réelle

C'est le cœur du document. Voici les huit situations que le football produit vraiment, leur fréquence, leur durée, et la probabilité qu'elles débouchent sur un tir puis sur un but.

| Situation | Part | Durée | → tir | → but | Progression | Vitesse de progression |
|---|---:|---:|---:|---:|---:|---:|
| **Contre rapide** | 1,2 % | 7,4 s | **42,1 %** | 3,5 % | +26,6 m | 4,2 m/s |
| **Transition** | 1,7 % | 10,9 s | **30,8 %** | **6,4 %** | +55,4 m | 5,4 m/s |
| **Coup de pied arrêté** | 3,8 % | 6,3 s | 23,0 % | 4,0 % | — | — |
| **Finition** | 16,0 % | 6,1 s | 16,9 % | 1,8 % | +5,3 m | — |
| **Création** | 31,8 % | 6,1 s | 7,6 % | 1,0 % | +8,2 m | 1,3 m/s |
| **Construction** | 13,5 % | 6,9 s | 6,1 % | 1,5 % | +0,2 m | 0,04 m/s |
| **Jeu direct** | 8,1 % | 3,2 s | 3,5 % | 0,8 % | — | 13,0 m/s |
| **Chaos** | 23,7 % | 2,6 s | 0,2 % | 0,2 % | +8,6 m | 3,3 m/s |

**Ce tableau dit une chose énorme : les situations dangereuses sont rares, et les situations fréquentes sont inoffensives.** Le contre rapide et la transition représentent 3 % du football et produisent les meilleures occasions ; le chaos en représente un quart et ne débouche presque jamais. Notre filtre de rendu n'a donc pas à inventer un critère de danger — **il doit reconnaître le type de situation**, et le danger suit.

**Et le tempo signe la situation.** La vitesse de progression du ballon vers le but distingue les jouées mieux que n'importe quelle description : la construction n'avance pas (0,04 m/s), la création avance doucement (1,3), le contre file (4,2), la transition fonce (5,4), et le jeu direct est une projection instantanée (13). **Un spectateur reconnaît un contre à sa vitesse, pas à sa forme.** C'est le paramètre unique qui doit piloter nos gabarits.

Une phase dure **4,7 s en médiane** et ne compte que **deux passes** (p90 : cinq). Une action de football réelle est bien plus courte que nos rendus actuels.

---

## 7 · La géométrie du danger

Sur un axe où 0 est le milieu du terrain et +52 la ligne de but adverse :

| | Départ | Fin | Progression | Écart à l'axe à l'arrivée |
|---|---:|---:|---:|---:|
| Une phase quelconque | −8,6 | +5,2 | +9,2 m | 19,7 m |
| Une phase qui finit en tir | +9,1 | +27,7 | +16,7 m | **9,0 m** |
| Une phase qui finit en but | −5,5 | **+35,4** | **+21,7 m** | **5,9 m** |

**Le danger converge vers l'axe.** Une action banale finit à vingt mètres du couloir central ; une action qui finit en but se termine à six mètres de l'axe, à trente-cinq mètres dans le camp adverse. C'est une règle de mise en scène directement implémentable : **plus l'action devient dangereuse, plus elle se resserre vers le centre**. Le spectateur le lit sans le savoir.

Par match, on compte **458 phases**, dont **37,6 débouchent sur un tir** et **5,5 sur un but** (les deux équipes confondues), et **13,5 contres ou transitions**.

---

## 8 · La sélection : quelle occasion mérite d'être rendue

Les données fournissent une probabilité de tir par possession. Sa distribution est extrêmement asymétrique : médiane 0,002, neuvième décile 0,13, et seul le centile supérieur dépasse 0,85.

| Seuil | Occasions retenues | Par match |
|---|---|---|
| 0,90 | les 0,5 % plus chaudes | 4 |
| 0,85 | le 1 % plus chaud | 9 |
| 0,74 | les 2 % plus chaudes | 18 |
| 0,40 | les 5 % plus chaudes | 44 |

**Traduction pour ONZE.** Notre moteur produit 2,4 buts par match. Avec la règle de Gabriel — tous les buts, plus 30 % de rendus supplémentaires — on rend trois à quatre actions par match. Le critère de sélection des non-buts doit donc être **le sommet absolu de la distribution de danger**, l'équivalent du seuil 0,90 : le poteau, l'arrêt réflexe, le sauvetage sur la ligne. **Une frappe de vingt mètres captée par le gardien n'est pas une occasion chaude** — si on la rend, le spectateur apprend à reconnaître les fausses alertes et le taux d'erreur s'effondre.

---

## 9 · Ce que ces chiffres imposent à notre scène

Douze conséquences directes, chacune vérifiable.

1. **Nos actions sont trop longues.** Une phase réelle dure 4,7 s et compte deux passes. Même en ne rendant que les transitions (10,9 s, cinq passes), nos rendus doivent viser **trois à cinq temps**, pas huit.
2. **Le porteur ne garde pas le ballon.** Une seconde, moins de deux mètres. Toute conduite de plus de quatre secondes est irréaliste.
3. **Deux options de passe, pas dix.** La scène montre deux solutions, et le choix se voit.
4. **Un seul appel tranchant à la fois.** Les autres se replacent.
5. **Les trois quarts des appels ne sont pas servis.** C'est la source principale du suspense, et elle est gratuite.
6. **Plus d'une passe sur deux est latérale, une sur cinq recule.** La progression est un résultat d'ensemble.
7. **Le tempo signe la situation** : construction 0 m/s, création 1,3, contre 4,2, transition 5,4, jeu direct 13. Un seul paramètre pilote les gabarits.
8. **Le danger converge vers l'axe** : de 20 m d'écart pour une action banale à 6 m pour un but.
9. **La défense a trois lignes**, sa dernière ligne vit à 18 m de son but, et elle n'est organisée qu'une fois sur deux.
10. **Le pressing part de 6 m, ferme à 2,6 m, dure 1,6 s, et échoue quatre fois sur cinq.**
11. **Seules les situations rares sont dangereuses.** Reconnaître la situation suffit à doser le danger.
12. **Les vitesses réelles sont modestes** : un appel court à 5 m/s, un porteur avance à 2,5 m/s. Nos pions ne doivent pas filer.

---

## 10 · Les recettes

Chaque chiffre ci-dessus devient une assertion. La scène est instrumentée pour relever ses propres mesures sur un échantillon de matchs simulés, et la recette compare les distributions à celles du football réel, avec une tolérance déclarée.

**Distributions à comparer** (tolérance suggérée : médiane à ±25 %, p90 à ±35 %) : durée de possession individuelle · distance parcourue par le porteur · distance de passe · répartition courte/moyenne/longue · répartition avant/latérale/arrière · longueur d'appel · durée d'appel · vitesse d'appel · nombre d'options de passe · nombre d'appels simultanés · distance de pressing au départ et au minimum · durée de pressing.

**Assertions binaires** : aucune conduite ne dépasse 4 s · aucune position ne dépend d'une fonction périodique du temps · le receveur est en mouvement avant le départ de la passe · la vitesse de progression du ballon distingue les gabarits dans le bon ordre · l'action se resserre vers l'axe à mesure qu'elle devient dangereuse · la surface de jeu suit la table de densité à ±5 % · tous les buts du moteur sont rendus · la proportion de rendus non convertis est de 30 % ± 10.

**La métrique souveraine** : sur trente actions rendues, un spectateur qui parie « ça rentre » doit se tromper **neuf fois** (30 %, tolérance 20-40 %). C'est la seule mesure qui juge le résultat plutôt que le procédé, et c'est celle qui compte.

---

*Source : SkillCorner Open Data (10 matchs, A-League 2024/25), publiée avec PySport. Analyse : 47 853 événements, 4 581 phases, 5 002 courses.*
