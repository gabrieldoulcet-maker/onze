# Étape 1 — les recettes vérifiées CONTRE le code d'avant

Règle de méthode, apprise sur les chantiers précédents : *une recette neuve
qui ne sort pas rouge sur le défaut qu'elle prétend attraper n'est pas un
garde-fou.* Voici donc, pour chaque recette de l'étape 1, la panne qu'on a
volontairement réintroduite et le chiffre qu'elle a produit.

Protocole : un match complet mesuré sur ~25 000 ticks de physique, terrain
70 × 46 m (5 contre 5), relevés pris au tick pour l'accélération et toutes
les 50 ms pour les distributions.

| Recette | Borne | Code livré | Panne réintroduite | Mesure sous panne |
|---|---|---|---|---|
| Plafond de vitesse (VIT) | 0 tick au-dessus de la pointe | **0** / 25 460 | on retire le plafond `Math.min(p.vMax, …)` | **4 437 ticks**, pic à **11,6 m/s** |
| Inertie (accélération bornée) | pic < 6 m/s², 0 tick au-dessus | **5,0 m/s²**, 0 tick | on retire le budget d'accélération (`k = 1`) | pic **479 m/s²**, **6 847 ticks** fautifs |
| Vitesse de course (médiane ~5 m/s) | 3 ≤ médiane ≤ 6,5 | **4,1 m/s** | on tourne à pleine vitesse (pas de couplage virage/vitesse) | **7,7 m/s** |
| Allure (part de la pointe) | médiane ≤ 75 % | **52 %** | idem | **99,9 %** |
| Le porteur n'est pas un sprinteur | médiane ≤ 4 m/s | **3,4 m/s** | la cible redevient une direction (« 2 m devant moi » recalculé chaque frame) | **4,5 m/s** |
| Aucune vitesse hors du réel | 0 tick non fini | **0** | pas de garde sur un pas de temps négatif | 2 ticks NaN (bug réel, corrigé) |

Les trois pannes réintroduites ne sont pas des inventions : ce sont
exactement les trois défauts trouvés dans la scène pendant l'étape 1.

1. **Le virage gratuit.** Faire pivoter la vitesse *voulue* en lui gardant
   sa norme revient à demander à un joueur qui doit faire demi-tour
   d'accélérer dans le mauvais sens. Le gardien partait à 7 m/s le long de
   sa ligne de touche et n'en revenait jamais.
2. **La carotte au bout du bâton.** Une cible recalculée « deux mètres
   devant moi » à chaque frame n'est jamais atteinte : l'arrivée douce ne
   s'enclenche pas, et le pion court à fond du début à la fin.
3. **Le pas de temps négatif.** L'horodatage de `requestAnimationFrame`
   peut précéder le `performance.now()` qui initialise l'horloge : la
   physique se retournait et fabriquait des NaN.
