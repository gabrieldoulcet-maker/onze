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
