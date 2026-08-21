/* ============================================================
   ONZE — La scène animée du match (phase 3).
   ------------------------------------------------------------
   Rendu 2D par-dessus les ÉVÉNEMENTS du moteur, sans toucher au
   moteur : le terrain devient la scène, les pions des deux équipes
   se placent par lignes (mon but à gauche), et le BALLON est le
   seul point focal — tout se lit en le suivant.

   Budget lisibilité : transform/opacity uniquement (60 fps), les
   micro-événements durent ~1 s et se compriment avec l'accéléré ×2
   (la durée effective est passée par le rejoueur).

   Utilisation :
     const scene = ONZE_SCENE.creer(conteneur, eqA, eqB);
     scene.debutPhase(phase); scene.evenement(ev, dureeMs);
     scene.detruire();
   ============================================================ */

const ONZE_SCENE = (() => {
  /* L'identité visuelle des familles : une couleur par École et par
     archétype (les procs d'Uniques/staff retombent sur l'or). */
  const COULEURS_FAMILLES = {
    "Tiki-Taka": "#4F9EC5", "Catenaccio": "#8B9E8E", "Kick & Rush": "#E8654F",
    "École de la Rue": "#E8C547", "La Grinta": "#C54F5E", "Football Total": "#9CC4EF",
    "L'Académie": "#4FC57C", "Les Internationaux": "#A66BD4", "Le Douzième Homme": "#F0A055",
    "Les Pros": "#C0C8CC", "Les Revanchards": "#B5654F",
    "Mur": "#8B9E8E", "Moteur": "#4FC57C", "Sentinelle": "#4F9EC5", "Virtuose": "#A66BD4",
    "Finisseur": "#E8654F", "Créateur": "#9CC4EF", "Piston": "#F0A055", "Renard": "#E8C547",
    "Chanceux": "#6BD4A6", "Guerrier": "#C54F5E", "Mentor": "#C0C8CC", "Capitaine": "#E8C547",
  };
  const couleurFamille = (nom) => COULEURS_FAMILLES[nom] || "#E8C547";

  /* Position d'une ligne en % de la largeur : mon but à gauche. */
  const X_LIGNES = {
    moi: { "GAR": 6, "DÉF": 20, "MIL": 34, "ATT": 46 },
    eux: { "GAR": 94, "DÉF": 80, "MIL": 66, "ATT": 54 },
  };
  const BUTS = { moi: { x: 2.5, y: 50 }, eux: { x: 97.5, y: 50 } };
  const ligneDuJoueur = (j) => j.ligne || j.poste;

  function creer(conteneur, eqA, eqB) {
    const racine = document.createElement("div");
    racine.className = "scene-match";
    conteneur.appendChild(racine);

    // marquages sobres : rond central + surfaces
    racine.innerHTML = `<div class="marquage rond-central"></div>
      <div class="marquage surface gauche"></div><div class="marquage surface droite"></div>
      <div class="cage gauche">🥅</div><div class="cage droite">🥅</div>`;

    const pions = {}; // nom → { el, x, y, camp }
    const poserEquipe = (equipe, camp) => {
      const parLigne = {};
      for (const j of equipe.joueurs) {
        const ligne = ligneDuJoueur(j);
        (parLigne[ligne] = parLigne[ligne] || []).push(j);
      }
      for (const [ligne, joueurs] of Object.entries(parLigne)) {
        joueurs.forEach((j, i) => {
          const x = (X_LIGNES[camp] || X_LIGNES.moi)[ligne] || 50;
          const y = joueurs.length === 1 ? 50 : 14 + (72 * i) / (joueurs.length - 1);
          const el = document.createElement("div");
          el.className = "pion " + camp;
          el.textContent = j.nom.replace(/ ★+$/, "").slice(0, 2);
          el.style.left = x + "%";
          el.style.top = y + "%";
          racine.appendChild(el);
          pions[j.nom] = { el, x, y, camp };
        });
      }
    };
    poserEquipe(eqA, "moi");
    poserEquipe(eqB, "eux");

    const ballon = document.createElement("div");
    ballon.className = "ballon";
    racine.appendChild(ballon);
    let posBallon = { x: 50, y: 50 };
    const bougerBallon = (x, y, ms) => {
      ballon.style.transition = `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out`;
      ballon.style.left = x + "%";
      ballon.style.top = y + "%";
      posBallon = { x, y };
    };
    bougerBallon(50, 50, 0);

    const campDe = (nomEquipe) => (nomEquipe === eqA.nom ? "moi" : "eux");
    const campAdverse = (camp) => (camp === "moi" ? "eux" : "moi");
    const pionDe = (nom) => pions[nom] || null;
    const gardienDe = (camp) => {
      const equipe = camp === "moi" ? eqA : eqB;
      const g = equipe.joueurs.find((j) => ligneDuJoueur(j) === "GAR");
      return g ? pions[g.nom] : null;
    };

    /* Un effet ponctuel (anneau, éclat, chip de synergie) : créé,
       animé en CSS, retiré à la fin — jamais plus de quelques nœuds. */
    const ephemere = (classe, x, y, contenu, ms, style) => {
      const e = document.createElement("div");
      e.className = classe;
      if (contenu) e.innerHTML = contenu;
      e.style.left = x + "%";
      e.style.top = y + "%";
      if (style) Object.assign(e.style, style);
      racine.appendChild(e);
      setTimeout(() => e.remove(), ms);
      return e;
    };
    const pulser = (pion, ms) => {
      if (!pion) return;
      pion.el.classList.add("actif");
      setTimeout(() => pion.el.classList.remove("actif"), ms);
    };
    const chipSynergie = (nom, x, y, ms) => {
      const glyphe = (typeof ONZE_UI !== "undefined" && ONZE_UI.glyphe(nom)) || "✦";
      ephemere("chip-synergie", Math.min(Math.max(x, 12), 88), Math.max(y - 14, 6),
        `${glyphe} ${nom}`, ms, { borderColor: couleurFamille(nom), color: couleurFamille(nom) });
    };

    /* ---- La chorégraphie : un micro-événement ~1 s par type ---- */
    function evenement(ev, duree) {
      const ms = Math.max(240, Math.min(duree * 0.75, 950)); // le geste tient dans son créneau
      const camp = ev.equipe ? campDe(ev.equipe) : "moi";
      const acteur = ev.acteurs && ev.acteurs.length ? pionDe(ev.acteurs[0]) : null;

      switch (ev.type) {
        case "possession": {
          if (acteur) { bougerBallon(acteur.x, acteur.y, ms); pulser(acteur, ms); }
          break;
        }
        case "ballon_long":
        case "lambretta": {
          // la transversale : le ballon file d'un coup vers l'avant
          const cible = { x: camp === "moi" ? 62 : 38, y: 24 + Math.random() * 52 };
          bougerBallon(cible.x, cible.y, ms * 0.55);
          ephemere("trainee", cible.x, cible.y, "", ms);
          break;
        }
        case "geste": {
          if (acteur) {
            bougerBallon(acteur.x, acteur.y, ms * 0.4);
            pulser(acteur, ms);
            ephemere("eclat-geste", acteur.x, acteur.y, "✨", ms);
          }
          break;
        }
        case "percee_stoppee":
        case "interception": {
          // le duel défensif : le ballon avance… le défenseur surgit
          const defenseur = acteur;
          if (defenseur) {
            bougerBallon(defenseur.x + (defenseur.camp === "moi" ? 6 : -6), defenseur.y, ms * 0.45);
            setTimeout(() => {
              ephemere("anneau-defense", defenseur.x, defenseur.y, "", ms * 0.6);
              pulser(defenseur, ms * 0.6);
              bougerBallon(defenseur.x, defenseur.y, ms * 0.4);
            }, ms * 0.45);
          }
          break;
        }
        case "hors_jeu": {
          ephemere("chip-arbitre", camp === "moi" ? 70 : 30, 22, "🚩 Hors-jeu !", ms * 1.2);
          break;
        }
        case "contre": {
          // le contre éclair balaie tout le terrain
          const cible = { x: camp === "moi" ? 70 : 30, y: 36 + Math.random() * 28 };
          bougerBallon(cible.x, cible.y, ms * 0.5);
          ephemere("trainee", cible.x, cible.y, "", ms);
          break;
        }
        case "rebond": {
          if (acteur) { bougerBallon(acteur.x, acteur.y, ms * 0.4); pulser(acteur, ms); }
          break;
        }
        case "blocage": {
          const but = BUTS[campAdverse(camp)]; // le camp de l'événement est la DÉFENSE
          ephemere("mur-blocage", but.x + (but.x < 50 ? 6 : -6), 50, "🧱", ms);
          bougerBallon(but.x + (but.x < 50 ? 12 : -12), 40, ms * 0.6);
          break;
        }
        case "but": {
          const tireur = pionDe(ev.buteur) || acteur;
          const butCible = BUTS[campAdverse(camp)]; // on marque dans le but adverse
          const passeur = ev.passeur && pionDe(ev.passeur);
          if (passeur) pulser(passeur, ms * 0.4);
          if (tireur) { bougerBallon(tireur.x, tireur.y, ms * 0.3); pulser(tireur, ms); }
          setTimeout(() => {
            ballon.classList.add("tir");
            bougerBallon(butCible.x, butCible.y, ms * 0.28);
          }, ms * 0.34);
          setTimeout(() => {
            ballon.classList.remove("tir");
            ephemere("flash-but", butCible.x, butCible.y, "", ms);
            ephemere("cri-but", 50, 34, "⚽ BUUUT !", ms * 1.4);
            if (tireur) tireur.el.classList.add("celebre");
            setTimeout(() => tireur && tireur.el.classList.remove("celebre"), ms);
          }, ms * 0.62);
          break;
        }
        case "arret": {
          const tireur = acteur;
          const gardien = (ev.acteurs && ev.acteurs[1] && pionDe(ev.acteurs[1])) || gardienDe(camp);
          const butCible = BUTS[camp]; // la défense sauve SON but
          if (tireur) { bougerBallon(tireur.x, tireur.y, ms * 0.3); pulser(tireur, ms * 0.4); }
          setTimeout(() => {
            ballon.classList.add("tir");
            bougerBallon(butCible.x + (butCible.x < 50 ? 3 : -3), 42, ms * 0.26);
          }, ms * 0.34);
          setTimeout(() => {
            ballon.classList.remove("tir");
            if (gardien) {
              gardien.el.classList.add("plongeon");
              ephemere("anneau-defense", gardien.x, gardien.y, "", ms * 0.6);
              bougerBallon(gardien.x, gardien.y, ms * 0.3);
              setTimeout(() => gardien.el.classList.remove("plongeon"), ms * 0.6);
            }
          }, ms * 0.6);
          break;
        }
        default: {
          if (acteur) { bougerBallon(acteur.x, acteur.y, ms * 0.5); pulser(acteur, ms * 0.6); }
        }
      }
      if (ev.synergie) {
        const ancre = (ev.type === "but" || ev.type === "arret")
          ? BUTS[ev.type === "but" ? campAdverse(camp) : camp]
          : (acteur || posBallon);
        chipSynergie(ev.synergie, ancre.x, ancre.y, Math.max(ms, 700));
      }
    }

    function debutPhase() {
      // coup d'envoi de la phase : le ballon revient vers le centre
      bougerBallon(44 + Math.random() * 12, 40 + Math.random() * 20, 350);
    }

    return {
      evenement, debutPhase,
      detruire: () => racine.remove(),
      racine,
    };
  }

  return { creer, couleurFamille };
})();

if (typeof module !== "undefined") module.exports = ONZE_SCENE;
