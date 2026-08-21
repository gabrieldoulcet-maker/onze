/* ============================================================
   ONZE — La scène animée du match, façon Football Manager Touch
   (vue 2D classique). Décision n°24 : l'animation est une
   PROJECTION FIDÈLE du moteur — zéro cosmétique aléatoire.
   ------------------------------------------------------------
   - Canvas 2D, 60 fps : terrain épuré vu de dessus, joueurs =
     disques numérotés aux couleurs du club (gardien distinct),
     ballon = petit disque blanc avec traînée, anneau sur le
     porteur. Interpolation fluide partout, jamais de téléportation,
     petites dérives de formation entre les événements.
   - Deux régimes : la DOMINATION (tissu compressé entre les temps
     forts — circulation stylée par École, jauge sous le score,
     minute qui défile) et le RENDU complet (occasions : chorégraphie
     temps réel, micro-ralenti de 0,5 s sur les buts).
   - Les attaques passent par où l'équipe est forte : le style de
     mouvement de chaque École se voit dans la circulation même.
   - La chaîne causale du moteur (événement `percee` : quel perceur,
     quel défenseur battu, quel type de duel) devient la chorégraphie.

   API (pilotée par ONZE_UI.rejouer) :
     const scene = ONZE_SCENE.creer(conteneur, eqA, eqB, {chrono, jauge});
     scene.debutPhase(phase, {regime, duree, minuteDe, minuteA});
     scene.tension(duree); scene.evenement(ev, duree);
     scene.evenementDomination(ev); scene.diagnostic(); scene.detruire();
   ============================================================ */

const ONZE_SCENE = (() => {
  /* L'identité visuelle des familles : une couleur par École et archétype. */
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

  /* Le style de jeu d'une équipe = son École dominante (synergie active
     la plus haute, sinon la plus représentée) + le goût des couloirs
     (≥ 2 Pistons). C'est LA traduction visuelle de l'ADN (décision 24b). */
  const STYLES_ECOLES = {
    "Tiki-Taka": "tiki", "Kick & Rush": "kickrush", "École de la Rue": "rue",
    "Catenaccio": "catenaccio", "Football Total": "total", "La Grinta": "grinta",
  };
  function styleDe(equipe) {
    let ecole = null, meilleurS = 0;
    for (const sy of equipe.synergies || []) {
      if (sy.type === "ecole" && sy.s > meilleurS) { meilleurS = sy.s; ecole = sy.nom; }
    }
    if (!ecole) {
      const comptes = {};
      for (const j of equipe.joueurs) if (j.ecole) comptes[j.ecole] = (comptes[j.ecole] || 0) + 1;
      ecole = Object.entries(comptes).sort((a, b) => b[1] - a[1]).map(([n]) => n)[0] || null;
    }
    const pistons = equipe.joueurs.filter((j) => j.archetype === "Piston").length;
    return { ecole, style: STYLES_ECOLES[ecole] || "defaut", couloirs: pistons >= 2 };
  }

  const ligneDuJoueur = (j) => j.ligne || j.poste;
  const lerp = (a, b, t) => a + (b - a) * t;

  function creer(conteneur, eqA, eqB, options = {}) {
    const racine = document.createElement("div");
    racine.className = "scene-match";
    const canvas = document.createElement("canvas");
    canvas.className = "toile-match";
    racine.appendChild(canvas);
    const couche = document.createElement("div"); // chips, cris — DOM par-dessus
    couche.className = "couche-scene";
    racine.appendChild(couche);
    conteneur.appendChild(racine);
    const ctx = canvas.getContext("2d");

    const styles = { moi: styleDe(eqA), eux: styleDe(eqB) };

    /* ---- Placement : mon but à gauche ; le style décale les lignes
       (Catenaccio se replie bas, le pivot du Kick & Rush avance). ---- */
    const xLigne = (camp, ligne) => {
      const base = { "GAR": 6, "DÉF": 20, "MIL": 35, "ATT": 46 }[ligne] || 40;
      const st = styles[camp];
      let x = base;
      if (st.style === "catenaccio" && ligne !== "GAR") x -= 5;      // bloc bas
      if (st.style === "kickrush" && ligne === "ATT") x += 4;         // pivot avancé
      if (st.style === "grinta" && ligne !== "GAR") x += 2;           // pressing haut
      return camp === "moi" ? x : 100 - x;
    };
    const BUTS = { moi: { x: 2, y: 50 }, eux: { x: 98, y: 50 } };

    const disques = {}; // nom → disque
    const listeDisques = [];
    const poserEquipe = (equipe, camp) => {
      const parLigne = {};
      for (const j of equipe.joueurs) (parLigne[ligneDuJoueur(j)] = parLigne[ligneDuJoueur(j)] || []).push(j);
      let numero = 1;
      for (const ligne of ["GAR", "DÉF", "MIL", "ATT"]) {
        for (let i = 0; i < (parLigne[ligne] || []).length; i++) {
          const j = parLigne[ligne][i];
          const n = parLigne[ligne].length;
          const st = styles[camp];
          let y = n === 1 ? 50 : 16 + (68 * i) / (n - 1);
          if (st.couloirs && n >= 2 && (i === 0 || i === n - 1)) y = i === 0 ? 10 : 90; // les Pistons collent aux lignes
          const d = {
            nom: j.nom, num: numero++, camp, gardien: ligneDuJoueur(j) === "GAR",
            ecole: j.ecole, archetype: j.archetype,
            baseX: xLigne(camp, ligne), baseY: y,
            x: xLigne(camp, ligne), y, cx: null, cy: null,
            aura: 0, auraCouleur: null, flash: 0, echelle: 1, phase: Math.random() * 6.28,
          };
          disques[j.nom] = d;
          listeDisques.push(d);
        }
      }
    };
    poserEquipe(eqA, "moi");
    poserEquipe(eqB, "eux");

    const ballon = { x: 50, y: 50, cx: 50, cy: 50, vitesse: 5, trainee: [], suspendu: false };
    const campDe = (nomEquipe) => (nomEquipe === eqA.nom ? "moi" : "eux");
    const adverse = (camp) => (camp === "moi" ? "eux" : "moi");
    const equipeDe = (camp) => (camp === "moi" ? eqA : eqB);
    const disqueDe = (nom) => disques[nom] || null;
    const gardienDe = (camp) => listeDisques.find((d) => d.camp === camp && d.gardien) || null;

    /* ---- État de régime ---- */
    let regime = "domination"; // domination | tension | rendu | ralenti
    let facteurTemps = 1;      // le micro-ralenti des buts (0.15)
    const jauge = { affichee: 0, cible: 0, pulse: false }; // +1 = moi domine
    const minute = { affichee: 0, cible: 0, duree: 1, depart: 0, t0: 0 };
    let circulation = null; // { camp, style, prochainePasse, porteur }
    let tremblementCage = { camp: null, force: 0 };
    let detruit = false;
    let finDeMatch = false; // le coup de sifflet final rend la main au chrono texte

    /* ---- La domination d'une phase : les VRAIS événements, pas un
       effet. Possession/percée/tir pèsent pour leur camp. ---- */
    function dominationDe(phase) {
      let score = 0, poids = 0;
      for (const ev of phase.evenements) {
        const signe = ev.equipe ? (campDe(ev.equipe) === "moi" ? 1 : -1) : 0;
        const p = { possession: 0.5, percee: 0.7, percee_stoppee: 0.45, interception: 0.45,
          geste: 0.3, contre: 0.5, ballon_long: 0.3, lambretta: 0.4, rebond: 0.5, blocage: 0.4 }[ev.type]
          || (ev.but ? 1 : ev.type === "arret" ? 0.7 : 0.2);
        // un arrêt/blocage est un point pour la DÉFENSE mais l'occasion
        // était à l'attaque : l'attaque a dominé la phase pour l'obtenir
        const signeCorrige = (ev.type === "arret" || ev.type === "blocage") ? -signe : signe;
        score += signeCorrige * p; poids += p;
      }
      return poids ? Math.max(-1, Math.min(1, score / poids)) : 0;
    }

    /* ---- La circulation stylée du régime domination : le camp qui
       pousse fait circuler SELON SON ÉCOLE (décision 24b). ---- */
    function lancerCirculation(camp) {
      const st = styles[camp];
      circulation = { camp, style: st.style, couloirs: st.couloirs, prochainePasse: 0, porteur: null };
    }
    function passeSuivante(temps) {
      if (!circulation) return;
      const c = circulation;
      const candidats = listeDisques.filter((d) => d.camp === c.camp && !d.gardien);
      if (!candidats.length) return;
      const CADENCES = { tiki: 420, kickrush: 950, rue: 800, catenaccio: 900, total: 600, grinta: 550, defaut: 650 };
      c.prochainePasse = temps + (CADENCES[c.style] || 650) * (0.85 + Math.random() * 0.3);
      const porteurActuel = c.porteur && disques[c.porteur];
      let suivant = null;
      if (c.style === "rue" && porteurActuel && Math.random() < 0.6) {
        // la Rue garde le ballon : le porteur serpente au lieu de passer
        porteurActuel.cx = porteurActuel.baseX + (Math.random() * 10 - 5);
        porteurActuel.cy = Math.max(8, Math.min(92, porteurActuel.baseY + (Math.random() * 26 - 13)));
        ballon.cx = porteurActuel.cx; ballon.cy = porteurActuel.cy; ballon.vitesse = 3;
        return;
      }
      if (c.style === "tiki" && porteurActuel) {
        // passes courtes : le voisin le plus proche
        suivant = candidats.filter((d) => d !== porteurActuel)
          .sort((a, b) => Math.hypot(a.x - porteurActuel.x, a.y - porteurActuel.y) -
                          Math.hypot(b.x - porteurActuel.x, b.y - porteurActuel.y))[0];
        ballon.vitesse = 7;
      } else if (c.style === "kickrush") {
        // le ballon long : alterner l'arrière et le pivot
        const arriere = candidats.filter((d) => ligneApprox(d) !== "ATT");
        const avants = candidats.filter((d) => ligneApprox(d) === "ATT");
        suivant = (porteurActuel && avants.includes(porteurActuel) ? arriere : avants)[0] || candidats[0];
        ballon.vitesse = 9;
      } else if (c.style === "catenaccio") {
        // circulation basse et patiente
        suivant = candidats.filter((d) => ligneApprox(d) !== "ATT")
          .sort(() => Math.random() - 0.5)[0] || candidats[0];
        ballon.vitesse = 4.5;
      } else if (c.couloirs && Math.random() < 0.55) {
        // les Pistons : l'attaque passe par les ailes, et on le voit
        suivant = candidats.filter((d) => d.y < 22 || d.y > 78).sort(() => Math.random() - 0.5)[0]
          || candidats[Math.floor(Math.random() * candidats.length)];
        ballon.vitesse = 7;
      } else {
        suivant = candidats[Math.floor(Math.random() * candidats.length)];
        ballon.vitesse = 6;
      }
      if (c.style === "total" && porteurActuel && suivant) {
        // Football Total : les positions tournent — échange visible
        const bx = porteurActuel.baseX, by = porteurActuel.baseY;
        porteurActuel.baseX = suivant.baseX; porteurActuel.baseY = suivant.baseY;
        suivant.baseX = bx; suivant.baseY = by;
      }
      if (c.style === "grinta") {
        // la Grinta presse : deux adversaires proches convergent vers le ballon
        listeDisques.filter((d) => d.camp === adverse(c.camp) && !d.gardien)
          .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))
          .slice(0, 2).forEach((d) => { d.cx = lerp(d.x, ballon.x, 0.4); d.cy = lerp(d.y, ballon.y, 0.4); });
      }
      if (suivant) {
        c.porteur = suivant.nom;
        ballon.cx = suivant.x + (Math.random() * 2 - 1);
        ballon.cy = suivant.y + (Math.random() * 2 - 1);
      }
    }
    const ligneApprox = (d) => {
      const xMoi = d.camp === "moi" ? d.baseX : 100 - d.baseX;
      return xMoi < 12 ? "GAR" : xMoi < 28 ? "DÉF" : xMoi < 42 ? "MIL" : "ATT";
    };

    /* ---- Les effets DOM ponctuels (réutilisent le CSS existant) ---- */
    const ephemere = (classe, x, y, contenu, ms, style) => {
      const e = document.createElement("div");
      e.className = classe;
      if (contenu) e.innerHTML = contenu;
      e.style.left = x + "%";
      e.style.top = y + "%";
      if (style) Object.assign(e.style, style);
      couche.appendChild(e);
      setTimeout(() => e.remove(), ms);
    };
    const chipSynergie = (nom, x, y, ms) => {
      const glyphe = (typeof ONZE_UI !== "undefined" && ONZE_UI.glyphe(nom)) || "✦";
      ephemere("chip-synergie", Math.min(Math.max(x, 12), 88), Math.max(y - 13, 6),
        `${glyphe} ${nom}`, ms, { borderColor: couleurFamille(nom), color: couleurFamille(nom) });
    };
    /* L'aura de famille : les joueurs CONCERNÉS s'illuminent. */
    const auraFamille = (nomFamille, camp, ms) => {
      for (const d of listeDisques) {
        if (d.camp !== camp) continue;
        if (d.ecole === nomFamille || d.archetype === nomFamille) {
          d.aura = ms; d.auraCouleur = couleurFamille(nomFamille);
        }
      }
    };

    /* ---- Les chorégraphies du RENDU complet ---- */
    function evenement(ev, duree) {
      regime = "rendu";
      circulation = null;
      const ms = Math.max(300, duree);
      const camp = ev.equipe ? campDe(ev.equipe) : "moi";
      const acteur = ev.acteurs && ev.acteurs.length ? disqueDe(ev.acteurs[0]) : null;

      switch (ev.type) {
        case "possession": {
          if (acteur) { ballon.cx = acteur.x; ballon.cy = acteur.y; ballon.vitesse = 6; circulationPorteur(acteur); }
          break;
        }
        case "percee": {
          // LA chaîne causale : le perceur du moteur bat le défenseur du
          // moteur, par le chemin de son type de duel (couloir, crochet…)
          const perceur = acteur;
          const battu = ev.acteurs[1] && disqueDe(ev.acteurs[1]);
          if (!perceur) break;
          const versX = camp === "moi" ? Math.min(perceur.x + 22, 84) : Math.max(perceur.x - 22, 16);
          if (ev.sousType === "course" || ev.sousType === "centre") {
            // le débordement : passage par le couloir le plus proche
            const couloir = perceur.y < 50 ? 12 : 88;
            perceur.cx = versX; perceur.cy = couloir;
            setTimeout(() => { if (!detruit) { ballon.cx = versX; ballon.cy = couloir; ballon.vitesse = 8; } }, ms * 0.2);
          } else if (ev.sousType === "dribble" && battu) {
            // le crochet : le perceur contourne SON vis-à-vis
            perceur.cx = battu.x - (camp === "moi" ? 4 : -4); perceur.cy = battu.y - 7;
            setTimeout(() => { if (!detruit) { perceur.cx = versX; perceur.cy = battu.y + 4; ballon.cx = versX; ballon.cy = battu.y + 4; ballon.vitesse = 7; } }, ms * 0.42);
          } else {
            perceur.cx = versX; perceur.cy = lerp(perceur.y, 50, 0.3);
            ballon.cx = versX; ballon.cy = perceur.cy; ballon.vitesse = ev.sousType === "aerien" ? 9 : 7;
          }
          circulationPorteur(perceur);
          if (battu) { battu.flash = 600; battu.cx = battu.x + (camp === "moi" ? -3 : 3); }
          break;
        }
        case "percee_stoppee":
        case "interception": {
          const defenseur = acteur;
          if (defenseur) {
            // duel : rapprochement puis flash de résolution côté défense
            ballon.cx = lerp(ballon.x, defenseur.x, 0.7); ballon.cy = lerp(ballon.y, defenseur.y, 0.7); ballon.vitesse = 6;
            setTimeout(() => {
              if (detruit) return;
              defenseur.flash = 500; defenseur.echelle = 1.35;
              ballon.cx = defenseur.x; ballon.cy = defenseur.y;
              setTimeout(() => { defenseur.echelle = 1; }, 420);
            }, ms * 0.45);
          }
          break;
        }
        case "geste": {
          if (acteur) {
            ballon.cx = acteur.x; ballon.cy = acteur.y; ballon.vitesse = 6;
            acteur.cx = acteur.x + (Math.random() * 8 - 4); acteur.cy = acteur.y + (Math.random() * 8 - 4);
            ephemere("eclat-geste", acteur.x, acteur.y, "✨", ms);
            circulationPorteur(acteur);
          }
          break;
        }
        case "ballon_long":
        case "lambretta": {
          const cible = { x: camp === "moi" ? 72 : 28, y: 24 + Math.random() * 52 };
          ballon.cx = cible.x; ballon.cy = cible.y; ballon.vitesse = 10;
          break;
        }
        case "contre": {
          // le contre éclair : tout le camp avance d'un bloc
          const cible = { x: camp === "moi" ? 74 : 26, y: 34 + Math.random() * 32 };
          ballon.cx = cible.x; ballon.cy = cible.y; ballon.vitesse = 11;
          for (const d of listeDisques) if (d.camp === camp && !d.gardien) d.cx = d.baseX + (camp === "moi" ? 10 : -10);
          break;
        }
        case "hors_jeu": {
          ephemere("chip-arbitre", camp === "moi" ? 72 : 28, 20, "🚩 Hors-jeu !", ms);
          break;
        }
        case "rebond": {
          if (acteur) { ballon.cx = acteur.x; ballon.cy = acteur.y; ballon.vitesse = 8; circulationPorteur(acteur); }
          break;
        }
        case "blocage": {
          const but = BUTS[camp]; // le camp de l'événement est la défense
          const murs = listeDisques.filter((d) => d.camp === camp && !d.gardien)
            .sort((a, b) => Math.hypot(a.x - but.x, a.y - 50) - Math.hypot(b.x - but.x, b.y - 50)).slice(0, 2);
          for (const m of murs) { m.cx = but.x + (but.x < 50 ? 7 : -7); m.cy = 44 + Math.random() * 12; m.flash = 500; }
          ballon.cx = but.x + (but.x < 50 ? 13 : -13); ballon.cy = 40; ballon.vitesse = 9;
          break;
        }
        case "but": {
          const buteur = disqueDe(ev.buteur) || acteur;
          const passeur = ev.passeur && disqueDe(ev.passeur);
          const butCible = BUTS[adverse(camp)];
          const t0 = passeur ? ms * 0.16 : 0;
          if (passeur) { ballon.cx = passeur.x; ballon.cy = passeur.y; ballon.vitesse = 8; }
          setTimeout(() => {
            if (detruit || !buteur) return;
            ballon.cx = buteur.x; ballon.cy = buteur.y; ballon.vitesse = 8;
            circulationPorteur(buteur);
          }, t0);
          // le micro-ralenti : 0,5 s de suspension au moment d'armer la frappe
          setTimeout(() => { if (!detruit) { regime = "ralenti"; facteurTemps = 0.12; ballon.suspendu = true; } }, t0 + ms * 0.22);
          setTimeout(() => {
            if (detruit) return;
            regime = "rendu"; facteurTemps = 1; ballon.suspendu = false;
            ballon.cx = butCible.x; ballon.cy = butCible.y + (Math.random() * 10 - 5); ballon.vitesse = 16;
          }, t0 + ms * 0.22 + 500);
          setTimeout(() => {
            if (detruit) return;
            tremblementCage = { camp: adverse(camp), force: 1 };
            ephemere("flash-but", butCible.x, 50, "", 800);
            ephemere("cri-but", 50, 30, "⚽ BUUUT !", 1300);
            // la convergence : les coéquipiers proches viennent célébrer
            if (buteur) {
              listeDisques.filter((d) => d.camp === camp && d !== buteur && !d.gardien)
                .sort((a, b) => Math.hypot(a.x - buteur.x, a.y - buteur.y) - Math.hypot(b.x - buteur.x, b.y - buteur.y))
                .slice(0, 4).forEach((d, i) => { d.cx = buteur.x + Math.cos(i * 1.7) * 6; d.cy = buteur.y + Math.sin(i * 1.7) * 6; });
              buteur.echelle = 1.5;
              setTimeout(() => { if (!detruit) { buteur.echelle = 1; retourFormation(); } }, 1100);
            }
          }, t0 + ms * 0.22 + 500 + 240);
          break;
        }
        case "arret": {
          const tireur = acteur;
          const gardien = (ev.acteurs[1] && disqueDe(ev.acteurs[1])) || gardienDe(camp);
          const but = BUTS[camp];
          if (tireur) { ballon.cx = tireur.x; ballon.cy = tireur.y; ballon.vitesse = 8; }
          setTimeout(() => {
            if (detruit) return;
            const impactY = 42 + Math.random() * 16;
            ballon.cx = but.x + (but.x < 50 ? 2.5 : -2.5); ballon.cy = impactY; ballon.vitesse = 15;
            if (gardien) { gardien.cx = but.x + (but.x < 50 ? 4 : -4); gardien.cy = impactY; gardien.echelle = 1.4; }
          }, ms * 0.35);
          setTimeout(() => {
            if (detruit || !gardien) return;
            gardien.flash = 500; gardien.echelle = 1;
            ballon.cx = gardien.x; ballon.cy = gardien.y; ballon.vitesse = 8;
          }, ms * 0.68);
          break;
        }
        default: {
          if (acteur) { ballon.cx = acteur.x; ballon.cy = acteur.y; ballon.vitesse = 6; }
        }
      }
      if (ev.synergie) {
        const campAura = (ev.type === "arret" || ev.type === "blocage" || ev.type === "percee_stoppee" ||
          ev.type === "interception" || ev.type === "hors_jeu" || ev.type === "contre") ? camp : camp;
        aurafamilleSure(ev.synergie, campAura, 1200);
        const ancre = acteur || ballon;
        chipSynergie(ev.synergie, ancre.x, ancre.y, Math.max(ms, 800));
      }
    }
    const aurafamilleSure = (nom, camp, ms) => { try { auraFamille(nom, camp, ms); } catch (e) {} };
    const circulationPorteur = (d) => { porteurAnneau = d ? d.nom : null; };
    let porteurAnneau = null;
    const retourFormation = () => { for (const d of listeDisques) { d.cx = null; d.cy = null; } };

    /* ---- Régime domination : accents légers sur les événements ---- */
    function evenementDomination(ev) {
      const acteur = ev.acteurs && ev.acteurs.length && disqueDe(ev.acteurs[0]);
      if (ev.type === "possession" && acteur) {
        lancerCirculation(acteur.camp);
        circulation.porteur = acteur.nom;
        porteurAnneau = acteur.nom;
        ballon.cx = acteur.x; ballon.cy = acteur.y; ballon.vitesse = 6;
      } else if ((ev.type === "percee_stoppee" || ev.type === "interception") && acteur) {
        acteur.flash = 450;
        ballon.cx = acteur.x; ballon.cy = acteur.y; ballon.vitesse = 6;
        lancerCirculation(acteur.camp); // la défense récupère et circule
        circulation.porteur = acteur.nom;
      }
      if (ev.synergie) aurafamilleSure(ev.synergie, ev.equipe ? campDe(ev.equipe) : "moi", 900);
    }

    /* ---- API de phase ---- */
    function debutPhase(phase, info = {}) {
      regime = info.regime || "domination";
      facteurTemps = 1;
      retourFormation();
      const dom = dominationDe(phase);
      jauge.cible = dom;
      jauge.pulse = false;
      minute.depart = minute.cible;
      minute.cible = phase.minute;
      minute.duree = Math.max(info.duree || 2000, 400);
      minute.t0 = performance.now();
      if (regime === "domination") {
        // le camp qui a VRAIMENT dominé la phase fait circuler
        lancerCirculation(dom >= 0 ? "moi" : "eux");
      } else {
        circulation = null;
      }
      ballon.suspendu = false;
    }
    function tension(duree = 500) {
      regime = "tension";
      jauge.pulse = true;
      if (circulation) circulation.prochainePasse = Infinity; // le temps s'étire
      setTimeout(() => { jauge.pulse = false; }, duree + 400);
    }

    /* ---- Le dessin ---- */
    let largeur = 0, hauteur = 0, dpr = 1;
    function dimensionner() {
      const boite = racine.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      largeur = Math.max(boite.width, 40); hauteur = Math.max(boite.height, 30);
      canvas.width = largeur * dpr; canvas.height = hauteur * dpr;
      canvas.style.width = largeur + "px"; canvas.style.height = hauteur + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    dimensionner();
    const surResize = () => dimensionner();
    window.addEventListener("resize", surResize);
    const px = (xPct) => (xPct / 100) * largeur;
    const py = (yPct) => (yPct / 100) * hauteur;

    function dessinerTerrain(temps) {
      ctx.clearRect(0, 0, largeur, hauteur);
      // pelouse épurée : deux moitiés
      ctx.fillStyle = "#17501F"; ctx.fillRect(0, 0, largeur / 2, hauteur);
      ctx.fillStyle = "#1B5827"; ctx.fillRect(largeur / 2, 0, largeur / 2, hauteur);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, largeur - 2, hauteur - 2);
      ctx.beginPath(); ctx.moveTo(largeur / 2, 0); ctx.lineTo(largeur / 2, hauteur); ctx.stroke();
      ctx.beginPath(); ctx.arc(largeur / 2, hauteur / 2, hauteur * 0.17, 0, 6.283); ctx.stroke();
      // surfaces
      ctx.strokeRect(0, py(24), px(11), py(52));
      ctx.strokeRect(largeur - px(11), py(24), px(11), py(52));
      // cages (avec tremblement de filet sur but)
      for (const camp of ["moi", "eux"]) {
        const tremble = tremblementCage.camp === camp ? tremblementCage.force : 0;
        const dx = tremble ? Math.sin(temps * 0.09) * 3 * tremble : 0;
        ctx.strokeStyle = tremble ? "#E8C547" : "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        const xc = camp === "moi" ? 2 : largeur - 2;
        ctx.beginPath();
        ctx.moveTo(xc + dx, py(42)); ctx.lineTo(xc + dx, py(58));
        ctx.stroke();
      }
      if (tremblementCage.force > 0) tremblementCage.force = Math.max(0, tremblementCage.force - 0.02);
    }

    function dessinerDisque(d, temps) {
      const r = Math.max(hauteur * 0.045, 8) * d.echelle;
      const X = px(d.x), Y = py(d.y);
      ctx.save();
      if (d.aura > 0) { ctx.shadowColor = d.auraCouleur; ctx.shadowBlur = 14; }
      else if (d.flash > 0) { ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.283);
      ctx.fillStyle = d.camp === "moi" ? (d.gardien ? "#1E4030" : "#14301C") : (d.gardien ? "#402A14" : "#33150F");
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = d.gardien ? "#E8C547" : d.camp === "moi" ? "#4FC57C" : "#E8654F";
      ctx.stroke();
      // l'anneau lumineux du porteur
      if (porteurAnneau === d.nom) {
        ctx.beginPath(); ctx.arc(X, Y, r + 3.5 + Math.sin(temps * 0.008) * 1.2, 0, 6.283);
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 1.6; ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#E7EEE7";
      ctx.font = `700 ${Math.max(r * 0.9, 7)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(d.num), X, Y + 0.5);
      ctx.restore();
    }

    function dessinerBallon() {
      // la traînée
      for (let i = 0; i < ballon.trainee.length; i++) {
        const t = ballon.trainee[i];
        const alpha = (i + 1) / ballon.trainee.length * 0.4;
        ctx.beginPath(); ctx.arc(px(t.x), py(t.y), 2.4, 0, 6.283);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
      }
      const r = ballon.suspendu ? 5.5 : 4;
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = ballon.suspendu ? 16 : 8;
      ctx.beginPath(); ctx.arc(px(ballon.x), py(ballon.y), r, 0, 6.283);
      ctx.fillStyle = "#FFFFFF"; ctx.fill();
      ctx.restore();
    }

    function majJauge(dt) {
      jauge.affichee = lerp(jauge.affichee, jauge.cible, Math.min(1, dt * 2.2));
      if (options.jauge) {
        const v = jauge.affichee;
        const moitie = Math.min(Math.abs(v), 1) * 50;
        options.jauge.style.left = v >= 0 ? (50 - moitie) + "%" : "50%";
        options.jauge.style.width = moitie + "%";
        options.jauge.style.background = v >= 0 ? "#4FC57C" : "#E8654F";
        options.jauge.classList.toggle("pulse", jauge.pulse);
      }
    }
    function majMinute(temps) {
      const t = Math.min(1, (temps - minute.t0) / minute.duree);
      minute.affichee = lerp(minute.depart, minute.cible, t);
      if (options.chrono && !finDeMatch) {
        options.chrono.textContent = `⏱ ${Math.max(1, Math.round(minute.affichee))}ᵉ`;
      }
    }

    let precedent = performance.now();
    function boucle(temps) {
      if (detruit) return;
      const dtBrut = Math.min((temps - precedent) / 1000, 0.05);
      precedent = temps;
      const dt = dtBrut * facteurTemps;

      // la circulation de la domination
      if (regime === "domination" && circulation && temps >= circulation.prochainePasse) passeSuivante(temps);
      if (regime === "domination" && circulation && !circulation.prochainePasse) passeSuivante(temps);

      // interpolation des disques : cible d'événement, sinon dérive douce
      for (const d of listeDisques) {
        const derive = regime === "domination" ? (styles[d.camp].style === "total" ? 2.2 : 1.2) : 0.6;
        const ox = d.cx !== null ? d.cx : d.baseX + Math.sin(temps * 0.0011 + d.phase) * derive;
        const oy = d.cy !== null ? d.cy : d.baseY + Math.cos(temps * 0.0009 + d.phase * 1.3) * derive;
        d.x = lerp(d.x, ox, Math.min(1, dt * 5));
        d.y = lerp(d.y, oy, Math.min(1, dt * 5));
        if (d.aura > 0) d.aura -= dtBrut * 1000;
        if (d.flash > 0) d.flash -= dtBrut * 1000;
      }
      // le ballon (jamais de téléportation)
      if (!ballon.suspendu) {
        ballon.x = lerp(ballon.x, ballon.cx, Math.min(1, dt * ballon.vitesse));
        ballon.y = lerp(ballon.y, ballon.cy, Math.min(1, dt * ballon.vitesse));
        ballon.trainee.push({ x: ballon.x, y: ballon.y });
        if (ballon.trainee.length > 9) ballon.trainee.shift();
      }

      dessinerTerrain(temps);
      // voile léger pendant le micro-ralenti — le moment se suspend
      for (const d of listeDisques) dessinerDisque(d, temps);
      dessinerBallon();
      if (regime === "ralenti") {
        ctx.fillStyle = "rgba(6, 12, 8, 0.28)";
        ctx.fillRect(0, 0, largeur, hauteur);
        dessinerBallon();
      }
      majJauge(dtBrut);
      majMinute(temps);
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);

    return {
      debutPhase, tension, evenement, evenementDomination,
      fin: () => { finDeMatch = true; jauge.pulse = false; regime = "domination"; circulation = null; },
      racine,
      diagnostic: () => ({
        styles, regime, jauge: { affichee: jauge.affichee, cible: jauge.cible },
        nbDisques: listeDisques.length, ballon: { x: ballon.x, y: ballon.y },
        minute: minute.affichee, porteur: porteurAnneau,
        positions: listeDisques.map((d) => ({ nom: d.nom, camp: d.camp, x: d.x, y: d.y, base: d.baseX })),
      }),
      dominationDe, // exposé pour les tests de fidélité
      detruire: () => { detruit = true; window.removeEventListener("resize", surResize); racine.remove(); },
    };
  }

  return { creer, couleurFamille, styleDe };
})();

if (typeof module !== "undefined") module.exports = ONZE_SCENE;
