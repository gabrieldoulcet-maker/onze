/* ============================================================
   ONZE — Les fiches des familles pour l'interface.
   EXTRAIT de design/synergies.md (la source de vérité) : identité
   en une phrase + paliers avec effets. À RESYNCHRONISER à chaque
   évolution du document de design.
   ============================================================ */

const ONZE_FAMILLES = {
  /* ---------- Les 11 Écoles ---------- */
  "La Grinta": { identite: "L'École des séries de défaites : plus fort quand le club est mené — la rage du vestiaire se charge.",
    paliers: [[2, "Bonus de duel quand le club est mené"], [4, "La rage explose : gros bonus sous 50 de prestige, les buts en étant mené rendent du prestige"], [6, "La remontada permanente — chaque phase se joue comme une fin de finale"]] },
  "Catenaccio": { identite: "L'usure qui achève : défendre, user l'attaquant, punir en contre éclair.",
    paliers: [[2, "Bonus défensif (tacle et placement)"], [4, "Les duels défensifs usent l'attaquant, les contres gagnent en danger"], [6, "Un attaquant usé qui perd son duel sort de la phase — contre en supériorité"], [9, "Le bus stellaire : chaque récupération est un contre assassin"]] },
  "Kick & Rush": { identite: "La déferlante : ballons longs par-dessus tout le monde, duels aériens, remises.",
    paliers: [[2, "Un ballon long par match qui saute le milieu"], [5, "LA déferlante : dès la 3ᵉ phase, chaque relance devient un assaut direct"]] },
  "École de la Rue": { identite: "Le Flow : le talent s'exprime, chaque geste réussi nourrit le suivant.",
    paliers: [[1, "Un geste technique possible par match"], [3, "Le Flow monte à chaque geste réussi (bonus cumulatif)"], [5, "Un geste réussi enchaîne un duel bonus"], [7, "Le public est acquis : +prestige par action d'anthologie"], [10, "Le Carnaval — le match devient un show permanent"]] },
  "Tiki-Taka": { identite: "Les zones de rondo : la possession comme une toile qui se resserre.",
    paliers: [[3, "Duels de possession bonifiés (passe et technique)"], [5, "Le tempo se conserve de phase en phase"], [7, "Le terrain entier : les égalités en possession sont toujours gagnées"]] },
  "Football Total": { identite: "L'École qui ignore les postes : la permutation permanente (décision n°21).",
    paliers: [[2, "Malus hors-poste réduits (×0,6) pour toute l'équipe"], [4, "Quasi annulés (×0,3) + surnombre dans la zone du ballon"], [6, "Malus hors-poste ANNULÉS — la formation devient totalement libre"], [9, "Le Onze Total : chaque duel utilise la meilleure stat de l'équipe"]] },
  "L'Académie": { identite: "Le centre qui produit : les Espoirs poussent et les Académiciens progressent.",
    paliers: [[2, "Le centre envoie un Espoir gratuit sur le banc chaque manche"], [3, "L'Espoir arrive avec une étoile de plus, les Académiciens gagnent +stats"]] },
  "Les Internationaux": { identite: "La sélection au choix : toute l'équipe adopte un style de jeu.",
    paliers: [[3, "Choisis une « sélection nationale » : un style pour toute l'équipe"], [4, "La sélection s'améliore, changeable au Mercato d'hiver"]] },
  "Le Douzième Homme": { identite: "Le public entre en jeu : le bloc se soude et le stade gronde.",
    paliers: [[3, "Les trois forment un bloc : leurs zones se défendent ensemble"], [4, "Le stade gronde : bonus quand le club défend son avantage"], [6, "Le public devient le douzième joueur : +1 titulaire sur le terrain"]] },
  "Les Pros": { identite: "Le staff sublimé : l'École qui parle au système d'objets.",
    paliers: [[2, "Les cartes staff portées par les Pros gagnent un effet bonus"], [4, "Une carte staff gratuite à chaque palier de partie, spécialisations améliorées"]] },
  "Les Revanchards": { identite: "La défaite qui paie : perdre petit, économiser, pivoter armé.",
    paliers: [[2, "Chaque défaite donne une relance de mercato gratuite"], [3, "Deux relances, et une victoire après défaite rapporte +2M"], [4, "Les défaites donnent aussi +1 XP — perdre devient un plan"]] },

  /* ---------- Les 12 archétypes ---------- */
  "Mur": { identite: "Les remparts : leur surface est une zone interdite.",
    paliers: [[2, "Malus d'xG adverse dans leur zone (placement, réflexes)"], [4, "Bloquent le premier tir cadré de chaque mi-temps"], [6, "Plus aucun tir hors occasion nette n'est cadré"]] },
  "Moteur": { identite: "Les poumons de l'équipe : jamais de baisse de régime.",
    paliers: [[2, "Pas de malus de fin de match (endurance, vitesse)"], [4, "Un duel bonus par transition"], [6, "Présents dans leur zone ET celle du ballon"]] },
  "Sentinelle": { identite: "Les anticipateurs : couper les trajectoires avant qu'elles existent.",
    paliers: [[2, "+interceptions (placement, tacle)"], [4, "Leur zone coupe les synergies adverses"], [6, "Chaque récupération remonte le ballon d'une zone"]] },
  "Virtuose": { identite: "Le geste : l'imprévisible qui cloue les gardiens sur place.",
    paliers: [[2, "Un geste garanti par match"], [3, "Le geste monte en puissance"], [4, "Esquive de duel"], [5, "+1 prestige par geste"]] },
  "Finisseur": { identite: "Les tueurs de surface : chaque occasion pèse plus lourd.",
    paliers: [[2, "+xG sur leurs tirs"], [3, "+xG encore"], [4, "Toujours plus"], [5, "Chaque occasion nette est au minimum cadrée"]] },
  "Créateur": { identite: "Les passeurs : les occasions naissent dans leurs pieds.",
    paliers: [[2, "+occasions créées (passe, vision)"], [3, "+encore"], [4, "Un caviar par match qui saute la défense"], [5, "Le jeu passe par eux"]] },
  "Piston": { identite: "Les couloirs : cent allers-retours par match.",
    paliers: [[2, "Bonus de couloir (vitesse, endurance)"], [3, "+encore"], [4, "Les centres pleuvent"], [5, "Surnombre permanent sur les deux ailes"]] },
  "Renard": { identite: "Les opportunistes : ils n'existent que là où le ballon traîne.",
    paliers: [[2, "Surgissent sur chaque ballon qui traîne"], [3, "+souvent"], [4, "+dangereux"], [5, "Chaque but de l'équipe les replace en position"]] },
  "Chanceux": { identite: "Les bénis : les poteaux rentrent, les déviations sourient.",
    paliers: [[2, "Les rebonds leur sourient (poteaux rentrants)"], [4, "La chance devient insolente — et ça se voit dans le récit"]] },
  "Guerrier": { identite: "La confiance : chaque duel gagné rend le suivant plus facile.",
    paliers: [[2, "Bonus cumulatif à chaque duel gagné (mental)"], [4, "La confiance monte plus vite"], [6, "Elle devient contagieuse : toute l'équipe en profite"]] },
  "Mentor": { identite: "Les sages : l'équipe joue plus juste autour d'eux.",
    paliers: [[3, "Bonus de vision et de mental"], [5, "La doublure du banc grandit avec eux"], [7, "L'équipe entière joue un cran au-dessus"]] },
  "Capitaine": { identite: "Le brassard ne se partage pas : UN capitaine élève l'équipe — deux la déchirent.",
    paliers: [[1, "Aura : bonus de mental à toute l'équipe (à 2+ : guerre des égos, MALUS)"]] },
  "Guerre des égos": { identite: "Deux brassards, zéro vestiaire : les auras s'annulent, l'équipe perd les égalités.",
    paliers: [[1, "Malus de mental pour toute l'équipe"]] },
};
if (typeof module !== "undefined") module.exports = ONZE_FAMILLES;
