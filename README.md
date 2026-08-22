# ⚽ ONZE — l'auto-battler du football

> Huit coachs. Un mercato partagé. Des matchs automatiques de 40 secondes.
> La victoire se gagne avant le coup d'envoi.

Projet solo de Gabriel — objectif : un jeu **vraiment fun, rejouable, cool à jouer**, publié sur l'App Store et Google Play. Ce dépôt est la mémoire du projet : tout ce qui compte finit ici.

## 📍 Où on en est

- **Phase actuelle : 0 — L'équipement**
- **Jalon en cours :** une page en ligne sur GitHub Pages, créée depuis un PC, modifiée depuis un autre, ouverte sur mon téléphone.

## 📚 Les documents de référence

| Document | Contenu |
|---|---|
| [Le concept](https://claude.ai/code/artifact/c5929035-3627-4c54-8b7c-16d5c4679698) | Vision produit complète, les 3 tests du fun, les 11 sections |
| [L'effectif Saison 1](https://claude.ai/code/artifact/00ecaa80-6c02-45f7-bc80-f333ded40501) | 71 joueurs, écoles, archétypes, chiffres calés sur TFT |
| [La feuille de route](https://claude.ai/code/artifact/184331e0-a16d-4397-a55f-af31843d5b86) | 8 phases, jalons, organisation, méthode avec l'IA |

## 🗂️ Structure du dépôt

- `index.html` — la page du jeu (à la racine pour l'instant : c'est ce que GitHub Pages publie le plus simplement ; on structurera en phase 2)
- `partie.html` — l'écran unique de la Partie (paysage) : mercato, terrain, match
- `match-moteur.js` — le moteur de match (les règles). **Intouchable sans décision de Gabriel.**
- `match-scene.js` — la scène de match : elle met en scène ce que le moteur décide
- `stade.js` — le décor du match en couche de thème (skins de stade)
- `design/` — les décisions de game design, en texte, versionnées
  (`decisions.md` = le résumé opposable ; `scene-fm.md` = le manuel de la scène de match)
- `JOURNAL.md` — trois lignes par session de travail
- `CLAUDE.md` — le briefing que Claude Code lit automatiquement à chaque session

## 🎯 Les trois tests du fun (juge de paix de toute décision)

1. **Le re-clic** — une partie finie donne envie d'en relancer une, là, maintenant.
2. **Le récit** — chaque partie peut se raconter en une phrase.
3. **Le spectacle** — regarder un match est un plaisir, pas une attente.

Une feature qui n'aide aucun des trois n'entre pas dans le jeu.
