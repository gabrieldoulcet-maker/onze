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
