/* ============================================================
   ONZE — La scène animée du match, façon Football Manager Touch.
   Décisions n°24 et n°25 : l'animation projette FIDÈLEMENT le
   moteur (zéro cosmétique aléatoire), et ON NE REND QUE DES
   PROMESSES — une action rendue pose une question (« ça passe ou
   pas ? ») et ne révèle son issue qu'au dernier temps.
   ------------------------------------------------------------
   - Canvas 60 fps. Les joueurs BOUGENT en permanence : dérive
     constante, et le bloc entier coulisse avec la possession
     (l'équipe qui attaque monte, celle qui défend recule et se
     resserre). Courses d'appel pendant les actions.
   - Un rendu = une ACTION CONSTRUITE de 3 à 6 temps (récupération
     → relais stylés → percée → frappe → issue), jouée en entier
     depuis la construction. Plancher 0,8 s par temps, temps décisif
     étiré (~1 s), issue identique en chorégraphie jusqu'au bout.
   - Entre les actions : les « zones d'action » FM — tiers actif
     surligné, mini-barre du temps par tiers, circulation stylée
     par École, jauge de domination, minute qui ne défile QUE là.
   - Replay de but ~2 s au ralenti (coupable d'un tap), toasts des
     scores du lobby, célébration qui chevauche la reprise.

   API (pilotée par ONZE_UI.rejouer) :
     ONZE_SCENE.construireAction(phase, eqA, eqB) → [temps]
     scene.debutPhase(phase, {regime, duree})
     scene.tension(duree) · scene.jouerTemps(temps, duree)
     scene.evenementDomination(ev) · scene.notifierLobby(texte)
     scene.fin() · scene.diagnostic() · scene.detruire()
   ============================================================ */

const ONZE_SCENE = (() => {
  const COULEURS_FAMILLES = {
    "Tiki-Taka": "#3E9BE0", "Catenaccio": "#98A79D", "Kick & Rush": "#E8503F",
    "École de la Rue": "#F2C14E", "La Grinta": "#C54F5E", "Football Total": "#9CC4EF",
    "L'Académie": "#3DE26B", "Les Internationaux": "#A85CE8", "Le Douzième Homme": "#F0A055",
    "Les Pros": "#C0C8CC", "Les Revanchards": "#B5654F",
    "Mur": "#98A79D", "Moteur": "#3DE26B", "Sentinelle": "#3E9BE0", "Virtuose": "#A85CE8",
    "Finisseur": "#E8503F", "Créateur": "#9CC4EF", "Piston": "#F0A055", "Renard": "#F2C14E",
    "Chanceux": "#6BD4A6", "Guerrier": "#C54F5E", "Mentor": "#C0C8CC", "Capitaine": "#F2C14E",
  };
  const couleurFamille = (nom) => COULEURS_FAMILLES[nom] || "#F2C14E";

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

  /* ============================================================
     LE DÉCOUPAGE D'UNE ACTION (décision 25) — pur et testable.
     À partir des événements RÉELS d'une phase chaude, construit la
     séquence de 3 à 6 temps : récupération → relais de construction
     (l'expression du style : Tiki 2 passes courtes, Kick & Rush le
     long ballon, la Rue la conduite) → percée (le vrai perceur, le
     vrai battu) → frappe (temps décisif) → issue (cachée jusque-là).
     Les relais sont des JOUEURS RÉELS de l'équipe ; les acteurs de
     la chaîne causale (récupérateur, perceur, battu, passeur,
     buteur, gardien) sont ceux du moteur.
     ============================================================ */
  function construireAction(phase, eqA, eqB) {
    const evts = phase.evenements;
    const temps = [];
    const evPossession = evts.find((e) => e.type === "possession");
    const evPercee = evts.find((e) => e.type === "percee");
    const evGeste = evts.find((e) => e.type === "geste");
    const evContre = evts.find((e) => e.type === "contre");
    const evLong = evts.find((e) => e.type === "ballon_long" || e.type === "lambretta");
    const evFinal = evts.find((e) => e.but || e.type === "arret" || e.type === "blocage");
    const evStop = evts.find((e) => e.type === "percee_stoppee" || e.type === "interception");
    const evHorsJeu = evts.find((e) => e.type === "hors_jeu");
    const evRebonds = evts.filter((e) => e.type === "rebond");
    const equipeAttaque = evFinal ? (evFinal.but ? evFinal.equipe : (eqA.nom === evFinal.equipe ? eqB.nom : eqA.nom))
      : evPercee ? evPercee.equipe : evContre ? evContre.equipe : evPossession ? evPossession.equipe : eqA.nom;
    const equipe = eqA.nom === equipeAttaque ? eqA : eqB;
    const style = styleDe(equipe).style;

    // 1. la récupération (l'action commence à sa naissance, jamais au tir)
    if (evPossession) temps.push({ type: "recuperation", ev: evPossession, acteur: evPossession.acteurs[0], equipe: equipeAttaque });
    if (evContre) temps.push({ type: "contre", ev: evContre, equipe: evContre.equipe });

    // 2. les relais de construction — l'ADN se lit ici
    const porteur = evPossession && evPossession.acteurs[0];
    const finisseur = evFinal && (evFinal.buteur || (evFinal.acteurs && evFinal.acteurs[0]));
    const perceur = evPercee && evPercee.acteurs[0];
    const passeur = evFinal && evFinal.passeur;
    const relaisPossibles = equipe.joueurs
      .map((j) => j.nom)
      .filter((n) => n !== porteur && n !== finisseur && n !== perceur && ligneDuJoueur(equipe.joueurs.find((j) => j.nom === n)) !== "GAR");
    if (evLong) {
      temps.push({ type: "relais_long", ev: evLong, de: porteur, vers: perceur || finisseur || relaisPossibles[0], equipe: equipeAttaque });
    } else if (style === "tiki" && relaisPossibles.length >= 1) {
      temps.push({ type: "relais", de: porteur, vers: relaisPossibles[0], equipe: equipeAttaque, texte: null });
      if (relaisPossibles.length >= 2 && evts.length <= 3) // 6 temps max
        temps.push({ type: "relais", de: relaisPossibles[0], vers: passeur || relaisPossibles[1], equipe: equipeAttaque });
    } else if (style === "kickrush") {
      temps.push({ type: "relais_long", de: porteur, vers: perceur || finisseur || relaisPossibles[0], equipe: equipeAttaque });
    } else if (style === "rue") {
      temps.push({ type: "conduite", acteur: porteur || perceur, equipe: equipeAttaque });
    } else if (relaisPossibles.length) {
      temps.push({ type: "relais", de: porteur, vers: passeur || relaisPossibles[0], equipe: equipeAttaque });
    }
    if (evGeste) temps.push({ type: "geste", ev: evGeste, acteur: evGeste.acteurs[0], equipe: evGeste.equipe });

    // 3. la percée : la chaîne causale du moteur
    if (evPercee) temps.push({ type: "percee", ev: evPercee, sousType: evPercee.sousType,
      acteur: evPercee.acteurs[0], battu: evPercee.acteurs[1], equipe: evPercee.equipe });
    if (evStop) temps.push({ type: "stop", ev: evStop, acteur: evStop.acteurs[0], equipe: evStop.equipe });
    if (evHorsJeu) temps.push({ type: "hors_jeu", ev: evHorsJeu, equipe: evHorsJeu.equipe });

    // 4-5. la frappe (temps DÉCISIF, étiré) puis les issues — même
    // chorégraphie jusqu'au bout : le suspense est la règle. Une phase
    // peut porter PLUSIEURS finitions (double détente, renard) : chaque
    // tir a son issue, les rebonds font la couture.
    const finitions = evts.filter((e) => e.but || e.type === "arret" || e.type === "blocage");
    if (finitions.length) {
      temps.push({ type: "frappe", decisif: true, tireur: finisseur, passeur, equipe: equipeAttaque });
      finitions.forEach((f, i) => {
        if (i > 0) {
          const rb = evRebonds[i - 1];
          temps.push({ type: "rebond", ev: rb || null,
            acteur: rb ? rb.acteurs[0] : (f.buteur || (f.acteurs && f.acteurs[0])), equipe: rb ? rb.equipe : f.equipe });
        }
        temps.push({
          type: f.but ? "issue_but" : f.type === "arret" ? "issue_arret" : "issue_blocage",
          ev: f, tireur: f.buteur || (f.acteurs && f.acteurs[0]), equipe: f.equipe, pres: !!f.pres,
        });
      });
    }

    // bornage 3-6 temps : on coupe les relais du milieu, JAMAIS une issue
    while (temps.length > 6) {
      const idx = temps.findIndex((t) => t.type === "relais" || t.type === "conduite");
      if (idx === -1) break;
      temps.splice(idx, 1);
    }
    return temps;
  }

  function creer(conteneur, eqA, eqB, options = {}) {
    const racine = document.createElement("div");
    racine.className = "scene-match";
    const canvas = document.createElement("canvas");
    canvas.className = "toile-match";
    racine.appendChild(canvas);
    const couche = document.createElement("div");
    couche.className = "couche-scene";
    racine.appendChild(couche);
    conteneur.appendChild(racine);
    const ctx = canvas.getContext("2d");

    const styles = { moi: styleDe(eqA), eux: styleDe(eqB) };

    const xLigne = (camp, ligne) => {
      const base = { "GAR": 6, "DÉF": 20, "MIL": 35, "ATT": 46 }[ligne] || 40;
      const st = styles[camp];
      let x = base;
      if (st.style === "catenaccio" && ligne !== "GAR") x -= 5;
      if (st.style === "kickrush" && ligne === "ATT") x += 4;
      if (st.style === "grinta" && ligne !== "GAR") x += 2;
      return camp === "moi" ? x : 100 - x;
    };
    const BUTS = { moi: { x: 2, y: 50 }, eux: { x: 98, y: 50 } };

    const disques = {};
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
          if (st.couloirs && n >= 2 && (i === 0 || i === n - 1)) y = i === 0 ? 10 : 90;
          const d = {
            nom: j.nom, num: numero++, camp, gardien: ligneDuJoueur(j) === "GAR",
            etoiles: j.etoiles || 1,
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
    const disqueDe = (nom) => disques[nom] || null;
    const gardienDe = (camp) => listeDisques.find((d) => d.camp === camp && d.gardien) || null;

    /* ---- État ---- */
    let regime = "domination"; // domination | tension | rendu | ralenti | replay
    let facteurTemps = 1;
    let possession = null; // le camp qui a le ballon → les BLOCS COULISSENT
    const jauge = { affichee: 0, cible: 0, pulse: false };
    const minute = { affichee: 0, cible: 0, duree: 1, depart: 0, t0: 0 };
    let circulation = null;
    let porteurAnneau = null;
    let tremblementCage = { camp: null, force: 0 };
    let detruit = false;
    let finDeMatch = false;
    // les zones d'action FM : temps de ballon par tiers du terrain
    const tempsParTiers = [0.001, 0.001, 0.001];
    // le replay : ring buffer des dernières ~3,5 s (60 états/s max)
    const REPLAY_ACTIF = (() => { try { return localStorage.getItem("onze-replay") !== "off"; } catch (e) { return true; } })();
    const tampon = [];
    let replay = null; // { etats, indice, t0 }

    function dominationDe(phase) {
      let score = 0, poids = 0;
      for (const ev of phase.evenements) {
        const signe = ev.equipe ? (campDe(ev.equipe) === "moi" ? 1 : -1) : 0;
        const p = { possession: 0.5, percee: 0.7, percee_stoppee: 0.45, interception: 0.45,
          geste: 0.3, contre: 0.5, ballon_long: 0.3, lambretta: 0.4, rebond: 0.5, blocage: 0.4 }[ev.type]
          || (ev.but ? 1 : ev.type === "arret" ? 0.7 : 0.2);
        const signeCorrige = (ev.type === "arret" || ev.type === "blocage") ? -signe : signe;
        score += signeCorrige * p; poids += p;
      }
      return poids ? Math.max(-1, Math.min(1, score / poids)) : 0;
    }

    /* ---- La circulation stylée (régime domination) ---- */
    function lancerCirculation(camp) {
      const st = styles[camp];
      possession = camp;
      circulation = { camp, style: st.style, couloirs: st.couloirs, prochainePasse: 0, porteur: null };
    }
    const ligneApprox = (d) => {
      const xMoi = d.camp === "moi" ? d.baseX : 100 - d.baseX;
      return xMoi < 12 ? "GAR" : xMoi < 28 ? "DÉF" : xMoi < 42 ? "MIL" : "ATT";
    };
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
        porteurActuel.cx = porteurActuel.baseX + (Math.random() * 10 - 5);
        porteurActuel.cy = Math.max(8, Math.min(92, porteurActuel.baseY + (Math.random() * 26 - 13)));
        ballon.cx = porteurActuel.cx; ballon.cy = porteurActuel.cy; ballon.vitesse = 3;
        return;
      }
      if (c.style === "tiki" && porteurActuel) {
        suivant = candidats.filter((d) => d !== porteurActuel)
          .sort((a, b) => Math.hypot(a.x - porteurActuel.x, a.y - porteurActuel.y) -
                          Math.hypot(b.x - porteurActuel.x, b.y - porteurActuel.y))[0];
        ballon.vitesse = 7;
      } else if (c.style === "kickrush") {
        const arriere = candidats.filter((d) => ligneApprox(d) !== "ATT");
        const avants = candidats.filter((d) => ligneApprox(d) === "ATT");
        suivant = (porteurActuel && avants.includes(porteurActuel) ? arriere : avants)[0] || candidats[0];
        ballon.vitesse = 9;
      } else if (c.style === "catenaccio") {
        suivant = candidats.filter((d) => ligneApprox(d) !== "ATT").sort(() => Math.random() - 0.5)[0] || candidats[0];
        ballon.vitesse = 4.5;
      } else if (c.couloirs && Math.random() < 0.55) {
        suivant = candidats.filter((d) => d.y < 22 || d.y > 78).sort(() => Math.random() - 0.5)[0]
          || candidats[Math.floor(Math.random() * candidats.length)];
        ballon.vitesse = 7;
      } else {
        suivant = candidats[Math.floor(Math.random() * candidats.length)];
        ballon.vitesse = 6;
      }
      if (c.style === "total" && porteurActuel && suivant) {
        const bx = porteurActuel.baseX, by = porteurActuel.baseY;
        porteurActuel.baseX = suivant.baseX; porteurActuel.baseY = suivant.baseY;
        suivant.baseX = bx; suivant.baseY = by;
      }
      if (c.style === "grinta") {
        listeDisques.filter((d) => d.camp === adverse(c.camp) && !d.gardien)
          .sort((a, b) => Math.hypot(a.x - ballon.x, a.y - ballon.y) - Math.hypot(b.x - ballon.x, b.y - ballon.y))
          .slice(0, 2).forEach((d) => { d.cx = lerp(d.x, ballon.x, 0.4); d.cy = lerp(d.y, ballon.y, 0.4); });
      }
      if (suivant) {
        c.porteur = suivant.nom;
        porteurAnneau = suivant.nom;
        ballon.cx = suivant.x + (Math.random() * 2 - 1);
        ballon.cy = suivant.y + (Math.random() * 2 - 1);
      }
    }

    /* ---- Effets DOM ---- */
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
    const auraFamille = (nomFamille, camp, ms) => {
      for (const d of listeDisques) {
        if (d.camp !== camp) continue;
        if (d.ecole === nomFamille || d.archetype === nomFamille) {
          d.aura = ms; d.auraCouleur = couleurFamille(nomFamille);
        }
      }
    };
    const chipEtSynergie = (ev, ancre, ms) => {
      if (!ev || !ev.synergie) return;
      auraFamille(ev.synergie, ev.equipe ? campDe(ev.equipe) : "moi", 1100);
      chipSynergie(ev.synergie, ancre.x, ancre.y, Math.max(ms, 800));
    };

    /* Les courses d'appel : pendant une action, 2 coéquipiers sans le
       ballon plongent vers l'avant — le terrain vit autour du porteur. */
    function coursesAppel(camp, saufNoms) {
      const sens = camp === "moi" ? 1 : -1;
      listeDisques.filter((d) => d.camp === camp && !d.gardien && !saufNoms.includes(d.nom))
        .sort(() => Math.random() - 0.5).slice(0, 2)
        .forEach((d) => {
          d.cx = Math.max(6, Math.min(94, d.x + sens * (8 + Math.random() * 8)));
          d.cy = Math.max(8, Math.min(92, d.y + (Math.random() * 16 - 8)));
        });
    }
    const retourFormation = () => { for (const d of listeDisques) { d.cx = null; d.cy = null; } };

    /* ============================================================
       JOUER UN TEMPS d'action construite (le RENDU).
       Chaque temps est un geste lisible ; l'issue reste cachée
       jusqu'au temps issue_*.
       ============================================================ */
    function jouerTemps(t, duree) {
      regime = t.decisif ? regime : "rendu";
      circulation = null;
      const ms = Math.max(400, duree);
      const camp = t.equipe ? campDe(t.equipe) : "moi";
      possession = camp;

      switch (t.type) {
        case "recuperation": {
          const d = disqueDe(t.acteur);
          if (d) {
            ballon.cx = d.x; ballon.cy = d.y; ballon.vitesse = 7;
            porteurAnneau = d.nom;
            d.flash = 400;
            coursesAppel(camp, [d.nom]);
          }
          break;
        }
        case "contre": {
          const cible = { x: camp === "moi" ? 66 : 34, y: 34 + Math.random() * 32 };
          ballon.cx = cible.x; ballon.cy = cible.y; ballon.vitesse = 11;
          for (const d of listeDisques) if (d.camp === camp && !d.gardien) d.cx = d.baseX + (camp === "moi" ? 12 : -12);
          break;
        }
        case "relais": {
          const de = disqueDe(t.de), vers = disqueDe(t.vers);
          if (vers) {
            ballon.cx = vers.x; ballon.cy = vers.y; ballon.vitesse = 8;
            porteurAnneau = vers.nom;
            if (de) de.cx = de.x + (camp === "moi" ? 4 : -4); // il suit son ballon
            coursesAppel(camp, [t.de, t.vers].filter(Boolean));
          }
          break;
        }
        case "relais_long": {
          const vers = disqueDe(t.vers);
          const cible = vers ? { x: vers.x, y: vers.y } : { x: camp === "moi" ? 70 : 30, y: 30 + Math.random() * 40 };
          ballon.cx = cible.x; ballon.cy = cible.y; ballon.vitesse = 12;
          if (vers) porteurAnneau = vers.nom;
          ephemere("trainee", cible.x, cible.y, "", ms * 0.7);
          coursesAppel(camp, [t.vers].filter(Boolean));
          break;
        }
        case "conduite": {
          const d = disqueDe(t.acteur);
          if (d) {
            const sens = camp === "moi" ? 1 : -1;
            d.cx = Math.min(88, Math.max(12, d.x + sens * 10));
            d.cy = Math.max(10, Math.min(90, d.y + (Math.random() * 20 - 10)));
            ballon.cx = d.cx; ballon.cy = d.cy; ballon.vitesse = 5;
            porteurAnneau = d.nom;
            coursesAppel(camp, [d.nom]);
          }
          break;
        }
        case "geste": {
          const d = disqueDe(t.acteur);
          if (d) {
            ballon.cx = d.x; ballon.cy = d.y; ballon.vitesse = 6;
            d.cx = d.x + (Math.random() * 8 - 4); d.cy = d.y + (Math.random() * 8 - 4);
            ephemere("eclat-geste", d.x, d.y, "✨", ms);
            porteurAnneau = d.nom;
          }
          chipEtSynergie(t.ev, d || ballon, ms);
          break;
        }
        case "percee": {
          const perceur = disqueDe(t.acteur);
          const battu = t.battu && disqueDe(t.battu);
          if (!perceur) break;
          const versX = camp === "moi" ? Math.min(perceur.x + 22, 84) : Math.max(perceur.x - 22, 16);
          if (t.sousType === "course" || t.sousType === "centre") {
            const couloir = perceur.y < 50 ? 12 : 88;
            perceur.cx = versX; perceur.cy = couloir;
            setTimeout(() => { if (!detruit) { ballon.cx = versX; ballon.cy = couloir; ballon.vitesse = 9; } }, ms * 0.25);
          } else if (t.sousType === "dribble" && battu) {
            perceur.cx = battu.x - (camp === "moi" ? 4 : -4); perceur.cy = battu.y - 7;
            setTimeout(() => { if (!detruit) { perceur.cx = versX; perceur.cy = battu.y + 4; ballon.cx = versX; ballon.cy = battu.y + 4; ballon.vitesse = 8; } }, ms * 0.45);
          } else {
            perceur.cx = versX; perceur.cy = lerp(perceur.y, 50, 0.3);
            ballon.cx = versX; ballon.cy = perceur.cy; ballon.vitesse = t.sousType === "aerien" ? 10 : 8;
          }
          porteurAnneau = perceur.nom;
          if (battu) { battu.flash = 600; battu.cx = battu.x + (camp === "moi" ? -3 : 3); }
          coursesAppel(camp, [t.acteur, t.battu].filter(Boolean));
          chipEtSynergie(t.ev, perceur, ms);
          break;
        }
        case "stop": {
          const d = disqueDe(t.acteur);
          if (d) {
            ballon.cx = lerp(ballon.x, d.x, 0.7); ballon.cy = lerp(ballon.y, d.y, 0.7); ballon.vitesse = 7;
            setTimeout(() => {
              if (detruit) return;
              d.flash = 500; d.echelle = 1.35;
              ballon.cx = d.x; ballon.cy = d.y;
              porteurAnneau = d.nom;
              setTimeout(() => { d.echelle = 1; }, 420);
            }, ms * 0.45);
            chipEtSynergie(t.ev, d, ms);
          }
          break;
        }
        case "hors_jeu": {
          ephemere("chip-arbitre", camp === "moi" ? 72 : 28, 20, "🚩 Hors-jeu !", ms);
          chipEtSynergie(t.ev, { x: camp === "moi" ? 72 : 28, y: 30 }, ms);
          break;
        }
        case "frappe": {
          // LE TEMPS DÉCISIF — étiré, identique quel que soit le sort du
          // ballon : suspension, voile, l'œil retient son souffle
          const tireur = disqueDe(t.tireur);
          const passeurD = t.passeur && disqueDe(t.passeur);
          if (passeurD) { ballon.cx = passeurD.x; ballon.cy = passeurD.y; ballon.vitesse = 9; }
          setTimeout(() => {
            if (detruit || !tireur) return;
            ballon.cx = tireur.x; ballon.cy = tireur.y; ballon.vitesse = 9;
            porteurAnneau = tireur.nom;
            tireur.echelle = 1.25;
          }, passeurD ? ms * 0.25 : 0);
          setTimeout(() => {
            if (detruit) return;
            regime = "ralenti"; facteurTemps = 0.12; ballon.suspendu = true;
          }, ms * 0.5);
          break;
        }
        case "issue_but": {
          const camp2 = campDe(t.ev.equipe);
          const butCible = BUTS[adverse(camp2)];
          const tireur = disqueDe(t.ev.buteur);
          regime = "rendu"; facteurTemps = 1; ballon.suspendu = false;
          if (tireur) tireur.echelle = 1;
          ballon.cx = butCible.x; ballon.cy = butCible.y + (Math.random() * 10 - 5); ballon.vitesse = 18;
          setTimeout(() => {
            if (detruit) return;
            tremblementCage = { camp: adverse(camp2), force: 1 };
            ephemere("flash-but", butCible.x, 50, "", 800);
            ephemere("cri-but", 50, 30, "⚽ BUUUT !", 1300);
            if (tireur) {
              listeDisques.filter((d) => d.camp === camp2 && d !== tireur && !d.gardien)
                .sort((a, b) => Math.hypot(a.x - tireur.x, a.y - tireur.y) - Math.hypot(b.x - tireur.x, b.y - tireur.y))
                .slice(0, 4).forEach((d, i) => { d.cx = tireur.x + Math.cos(i * 1.7) * 6; d.cy = tireur.y + Math.sin(i * 1.7) * 6; });
              tireur.echelle = 1.5;
              // la célébration CHEVAUCHE la reprise : on rend la main vite
              setTimeout(() => {
                if (detruit) return;
                tireur.echelle = 1; retourFormation();
                if (REPLAY_ACTIF) lancerReplay();
              }, 800);
            }
          }, 220);
          chipEtSynergie(t.ev, BUTS[adverse(camp2)], 1200);
          break;
        }
        case "issue_arret": {
          const campDef = campDe(t.ev.equipe); // l'arrêt appartient à la défense
          const but = BUTS[campDef];
          const gardien = (t.ev.acteurs[1] && disqueDe(t.ev.acteurs[1])) || gardienDe(campDef);
          const tireur = disqueDe(t.ev.acteurs[0]);
          regime = "rendu"; facteurTemps = 1; ballon.suspendu = false;
          if (tireur) tireur.echelle = 1;
          const impactY = 42 + Math.random() * 16;
          ballon.cx = but.x + (but.x < 50 ? 2.5 : -2.5); ballon.cy = impactY; ballon.vitesse = 17;
          if (gardien) { gardien.cx = but.x + (but.x < 50 ? 4 : -4); gardien.cy = impactY; gardien.echelle = 1.4; }
          setTimeout(() => {
            if (detruit || !gardien) return;
            gardien.flash = 500; gardien.echelle = 1;
            ballon.cx = gardien.x; ballon.cy = gardien.y; ballon.vitesse = 8;
            porteurAnneau = gardien.nom;
            if (t.pres) { // le presque-but : OHHH du stade
              ephemere("cri-but", 50, 30, "OHHH !", 1100);
              if (typeof ONZE_JUICE !== "undefined") ONZE_JUICE.jouer("ohhh");
            }
          }, 260);
          chipEtSynergie(t.ev, but, 1100);
          break;
        }
        case "issue_blocage": {
          const campDef = campDe(t.ev.equipe);
          const but = BUTS[campDef];
          regime = "rendu"; facteurTemps = 1; ballon.suspendu = false;
          const murs = listeDisques.filter((d) => d.camp === campDef && !d.gardien)
            .sort((a, b) => Math.hypot(a.x - but.x, a.y - 50) - Math.hypot(b.x - but.x, b.y - 50)).slice(0, 2);
          for (const m of murs) { m.cx = but.x + (but.x < 50 ? 7 : -7); m.cy = 44 + Math.random() * 12; m.flash = 500; }
          ballon.cx = but.x + (but.x < 50 ? 13 : -13); ballon.cy = 40; ballon.vitesse = 10;
          ephemere("cri-but", 50, 30, "OHHH !", 1000);
          if (typeof ONZE_JUICE !== "undefined") ONZE_JUICE.jouer("ohhh");
          chipEtSynergie(t.ev, but, 1100);
          break;
        }
        case "rebond": {
          const d = disqueDe(t.acteur);
          if (d) { ballon.cx = d.x; ballon.cy = d.y; ballon.vitesse = 9; porteurAnneau = d.nom; d.flash = 400; }
          chipEtSynergie(t.ev, d || ballon, ms);
          break;
        }
        default: {
          const d = t.acteur && disqueDe(t.acteur);
          if (d) { ballon.cx = d.x; ballon.cy = d.y; ballon.vitesse = 6; }
        }
      }
    }

    /* ---- Le replay de but : lecture ralentie du tampon (~2 s),
       coupable d'un tap. Le flux du match continue en fond — le
       replay occupe l'écran pendant la respiration suivante. ---- */
    function lancerReplay() {
      if (!tampon.length || replay) return;
      replay = { etats: tampon.slice(-100), indice: 0 };
      const bandeau = document.createElement("div");
      bandeau.className = "chip-arbitre bandeau-replay";
      bandeau.style.left = "50%";
      bandeau.style.top = "8%";
      bandeau.textContent = "🔁 Replay — touche pour passer";
      couche.appendChild(bandeau);
      const couper = () => { replay = null; bandeau.remove(); racine.removeEventListener("pointerdown", couper); };
      racine.addEventListener("pointerdown", couper);
      setTimeout(couper, 2300);
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
      // l'horloge FM : elle ne défile QU'ENTRE les temps forts — en
      // rendu, la minute est atteinte pendant la montée de tension
      minute.duree = info.regime === "rendu" ? 500 : Math.max(info.duree || 2000, 400);
      minute.t0 = performance.now();
      if (regime === "domination") lancerCirculation(dom >= 0 ? "moi" : "eux");
      else circulation = null;
      ballon.suspendu = false;
    }
    function tension(duree = 500) {
      regime = "tension";
      jauge.pulse = true;
      if (circulation) circulation.prochainePasse = Infinity;
      setTimeout(() => { jauge.pulse = false; }, duree + 400);
    }
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
        lancerCirculation(acteur.camp);
        circulation.porteur = acteur.nom;
      } else if (ev.type === "arret" || ev.type === "blocage") {
        // une occasion NON rendue (l'arbitrage du budget) : accent bref
        const d = acteur || gardienDe(ev.equipe ? campDe(ev.equipe) : "moi");
        if (d) { d.flash = 500; ballon.cx = d.x; ballon.cy = d.y; ballon.vitesse = 9; }
        if (typeof ONZE_JUICE !== "undefined" && ev.pres) ONZE_JUICE.jouer("ohhh");
      }
      if (ev.synergie) chipEtSynergie(ev, acteur || ballon, 900);
    }
    /* Les autres scores du lobby, en toast discret (régime compressé) */
    function notifierLobby(texte) {
      const toast = document.createElement("div");
      toast.className = "toast-lobby";
      toast.textContent = texte;
      couche.appendChild(toast);
      setTimeout(() => toast.classList.add("visible"), 30);
      setTimeout(() => { toast.classList.remove("visible"); setTimeout(() => toast.remove(), 400); }, 2300);
    }

    /* ---- Dessin ---- */
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
      ctx.fillStyle = "#135223"; ctx.fillRect(0, 0, largeur / 2, hauteur);
      ctx.fillStyle = "#1B5827"; ctx.fillRect(largeur / 2, 0, largeur / 2, hauteur);
      // la ZONE D'ACTION : le tiers où vit le ballon est surligné
      const tiers = ballon.x < 33.3 ? 0 : ballon.x < 66.6 ? 1 : 2;
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect((tiers * largeur) / 3, 0, largeur / 3, hauteur);
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 1.5;
      ctx.strokeRect(1, 1, largeur - 2, hauteur - 2);
      ctx.beginPath(); ctx.moveTo(largeur / 2, 0); ctx.lineTo(largeur / 2, hauteur); ctx.stroke();
      ctx.beginPath(); ctx.arc(largeur / 2, hauteur / 2, hauteur * 0.17, 0, 6.283); ctx.stroke();
      ctx.strokeRect(0, py(24), px(11), py(52));
      ctx.strokeRect(largeur - px(11), py(24), px(11), py(52));
      for (const camp of ["moi", "eux"]) {
        const tremble = tremblementCage.camp === camp ? tremblementCage.force : 0;
        const dx = tremble ? Math.sin(temps * 0.09) * 3 * tremble : 0;
        ctx.strokeStyle = tremble ? "#F2C14E" : "rgba(255,255,255,0.75)";
        ctx.lineWidth = 2;
        const xc = camp === "moi" ? 2 : largeur - 2;
        ctx.beginPath(); ctx.moveTo(xc + dx, py(42)); ctx.lineTo(xc + dx, py(58)); ctx.stroke();
      }
      if (tremblementCage.force > 0) tremblementCage.force = Math.max(0, tremblementCage.force - 0.02);
      // la mini-barre FM : la répartition du temps par tiers
      const total = tempsParTiers[0] + tempsParTiers[1] + tempsParTiers[2];
      const yBarre = hauteur - 4;
      let xCourant = largeur * 0.25;
      const largeurBarre = largeur * 0.5;
      const teintes = ["#3DE26B", "#C0C8CC", "#E8503F"];
      for (let i = 0; i < 3; i++) {
        const l = (tempsParTiers[i] / total) * largeurBarre;
        ctx.fillStyle = teintes[i];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(xCourant, yBarre, l, 2.5);
        ctx.globalAlpha = 1;
        xCourant += l;
      }
    }

    /* Le pion DA (Lot 3) : disque en relief — lumière haut-gauche,
       ombre interne basse, gardien or — un jeton de plateau lisible
       à 60 fps (dégradés recréés par frame : coût négligeable). */
    function dessinerDisque(d, temps) {
      const r = Math.max(hauteur * 0.045, 8) * d.echelle;
      const X = px(d.x), Y = py(d.y);
      ctx.save();
      if (d.aura > 0) { ctx.shadowColor = d.auraCouleur; ctx.shadowBlur = 14; }
      else if (d.flash > 0) { ctx.shadowColor = "#FFFFFF"; ctx.shadowBlur = 10; }
      else { ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3; }
      // la matière : radial éclairé à 32 % / 26 % (comme l'artboard)
      const grad = ctx.createRadialGradient(X - r * 0.36, Y - r * 0.48, r * 0.15, X, Y, r);
      if (d.gardien) { grad.addColorStop(0, "#F8DE8E"); grad.addColorStop(1, "#B8860B"); }
      else if (d.camp === "moi") { grad.addColorStop(0, "#4FE07E"); grad.addColorStop(1, "#1B7A3A"); }
      else { grad.addColorStop(0, "#E87F6F"); grad.addColorStop(1, "#8E2E1F"); }
      ctx.beginPath(); ctx.arc(X, Y, r, 0, 6.283);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // l'ombre interne basse (le relief du jeton)
      const ombre = ctx.createLinearGradient(X, Y - r, X, Y + r);
      ombre.addColorStop(0.55, "rgba(0,0,0,0)");
      ombre.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = ombre;
      ctx.fill();
      if (porteurAnneau === d.nom) {
        ctx.beginPath(); ctx.arc(X, Y, r + 3.5 + Math.sin(temps * 0.008) * 1.2, 0, 6.283);
        ctx.strokeStyle = "rgba(253,248,234,0.9)"; ctx.lineWidth = 1.8; ctx.stroke();
      }
      ctx.fillStyle = d.gardien ? "#1A1405" : d.camp === "moi" ? "#04240E" : "#1F0704";
      ctx.font = `800 ${Math.max(r * 0.9, 7)}px Archivo, system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(d.num), X, Y + 0.5);
      // les étoiles au-dessus du pion (or dès ★★, comme l'artboard)
      if (d.etoiles >= 2) {
        ctx.fillStyle = "#F2C14E";
        ctx.font = `${Math.max(r * 0.55, 6)}px system-ui, sans-serif`;
        ctx.fillText("★".repeat(Math.min(d.etoiles, 3)), X, Y - r - 4);
      }
      ctx.restore();
    }

    function dessinerBallonA(x, y, suspendu, trainee) {
      for (let i = 0; i < trainee.length; i++) {
        const t = trainee[i];
        const alpha = (i + 1) / trainee.length * 0.4;
        ctx.beginPath(); ctx.arc(px(t.x), py(t.y), 2.4, 0, 6.283);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
      }
      const r = suspendu ? 5.5 : 4;
      ctx.save();
      ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = suspendu ? 16 : 8;
      ctx.beginPath(); ctx.arc(px(x), py(y), r, 0, 6.283);
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
        options.jauge.style.background = v >= 0 ? "#3DE26B" : "#E8503F";
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

    /* Le COULISSEMENT DES BLOCS : l'équipe en possession monte, l'autre
       recule et se resserre — deux formations qui respirent. */
    function offsetsBloc(d) {
      if (!possession) return { dx: 0, resserre: 1 };
      if (d.gardien) return { dx: 0, resserre: 1 };
      const sens = d.camp === "moi" ? 1 : -1;
      if (d.camp === possession) return { dx: sens * 6, resserre: 1 };
      return { dx: -sens * 4, resserre: 0.82 };
    }

    let precedent = performance.now();
    function boucle(temps) {
      if (detruit) return;
      const dtBrut = Math.min((temps - precedent) / 1000, 0.05);
      precedent = temps;
      const dt = dtBrut * facteurTemps;

      if (regime === "domination" && circulation && temps >= circulation.prochainePasse) passeSuivante(temps);
      if (regime === "domination" && circulation && !circulation.prochainePasse) passeSuivante(temps);

      for (const d of listeDisques) {
        const derive = regime === "domination" ? (styles[d.camp].style === "total" ? 2.2 : 1.3) : 0.7;
        const bloc = offsetsBloc(d);
        const baseX = d.baseX + bloc.dx;
        const baseY = 50 + (d.baseY - 50) * bloc.resserre;
        const ox = d.cx !== null ? d.cx : baseX + Math.sin(temps * 0.0011 + d.phase) * derive;
        const oy = d.cy !== null ? d.cy : baseY + Math.cos(temps * 0.0009 + d.phase * 1.3) * derive;
        d.x = lerp(d.x, ox, Math.min(1, dt * 4.5));
        d.y = lerp(d.y, oy, Math.min(1, dt * 4.5));
        if (d.aura > 0) d.aura -= dtBrut * 1000;
        if (d.flash > 0) d.flash -= dtBrut * 1000;
      }
      // Répulsion minimale entre pions (fonction pure, voir plus bas) :
      // dans les mêlées, aucun disque ne recouvre un autre à plus de ~20 %.
      separerDisques(listeDisques, largeur, hauteur, Math.max(hauteur * 0.045, 8));
      if (!ballon.suspendu) {
        ballon.x = lerp(ballon.x, ballon.cx, Math.min(1, dt * ballon.vitesse));
        ballon.y = lerp(ballon.y, ballon.cy, Math.min(1, dt * ballon.vitesse));
        ballon.trainee.push({ x: ballon.x, y: ballon.y });
        if (ballon.trainee.length > 9) ballon.trainee.shift();
      }
      // le temps par tiers (les zones d'action FM)
      const tiers = ballon.x < 33.3 ? 0 : ballon.x < 66.6 ? 1 : 2;
      tempsParTiers[tiers] += dtBrut;
      // le tampon du replay (~3,5 s à 30 états/s)
      if (!replay && (!tampon.length || temps - tampon[tampon.length - 1].t > 33)) {
        tampon.push({ t: temps, bx: ballon.x, by: ballon.y,
          pos: listeDisques.map((d) => [d.x, d.y]) });
        if (tampon.length > 105) tampon.shift();
      }

      dessinerTerrain(temps);
      if (replay) {
        // lecture ralentie du tampon : un état sur deux frames (÷2)
        const etat = replay.etats[Math.min(Math.floor(replay.indice), replay.etats.length - 1)];
        replay.indice += 0.5;
        if (replay.indice >= replay.etats.length) replay = null;
        if (etat) {
          listeDisques.forEach((d, i) => {
            const fantome = { ...d, x: etat.pos[i][0], y: etat.pos[i][1] };
            dessinerDisque(fantome, temps);
          });
          dessinerBallonA(etat.bx, etat.by, false, []);
          ctx.fillStyle = "rgba(6, 12, 8, 0.12)";
          ctx.fillRect(0, 0, largeur, hauteur);
        }
      } else {
        for (const d of listeDisques) dessinerDisque(d, temps);
        dessinerBallonA(ballon.x, ballon.y, ballon.suspendu, ballon.trainee);
        if (regime === "ralenti") {
          ctx.fillStyle = "rgba(6, 12, 8, 0.28)";
          ctx.fillRect(0, 0, largeur, hauteur);
          dessinerBallonA(ballon.x, ballon.y, true, []);
        }
      }
      majJauge(dtBrut);
      majMinute(temps);
      requestAnimationFrame(boucle);
    }
    requestAnimationFrame(boucle);

    return {
      debutPhase, tension, jouerTemps, evenementDomination, notifierLobby,
      fin: () => { finDeMatch = true; jauge.pulse = false; regime = "domination"; circulation = null; replay = null; },
      racine,
      diagnostic: () => ({
        styles, regime, possession, jauge: { affichee: jauge.affichee, cible: jauge.cible },
        nbDisques: listeDisques.length, ballon: { x: ballon.x, y: ballon.y },
        minute: minute.affichee, porteur: porteurAnneau, tempsParTiers: [...tempsParTiers],
        replayEnCours: !!replay,
        positions: listeDisques.map((d) => ({ nom: d.nom, camp: d.camp, x: d.x, y: d.y, base: d.baseX })),
      }),
      dominationDe,
      detruire: () => { detruit = true; window.removeEventListener("resize", surResize); racine.remove(); },
    };
  }

  /* ============================================================
     RÉPULSION MINIMALE entre pions : chaque paire trop proche
     (recouvrement > ~20 %, soit une distance < 1,6 rayon) est écartée
     symétriquement d'un demi-déficit — micro-décalage par frame, la
     poursuite des cibles reprend le dessus dès que ça respire.
     Pure et testable : appelée à chaque frame par la boucle de scène.
     ============================================================ */
  function separerDisques(disques, largeur, hauteur, rayonPx) {
    for (let i = 0; i < disques.length; i++) {
      for (let j = i + 1; j < disques.length; j++) {
        const a = disques[i], b = disques[j];
        const minDist = 0.8 * (rayonPx * (a.echelle || 1) + rayonPx * (b.echelle || 1));
        let dxPx = (b.x - a.x) * largeur / 100, dyPx = (b.y - a.y) * hauteur / 100;
        const dist = Math.hypot(dxPx, dyPx);
        if (dist >= minDist) continue;
        if (dist < 0.01) { dxPx = Math.cos((a.phase || 0) + i); dyPx = Math.sin((a.phase || 0) + i); } // pile superposés : axe déterministe
        const norme = Math.hypot(dxPx, dyPx);
        const pousse = (minDist - dist) / 2;
        const uxPct = (dxPx / norme) * pousse * 100 / largeur;
        const uyPct = (dyPx / norme) * pousse * 100 / hauteur;
        a.x -= uxPct; a.y -= uyPct;
        b.x += uxPct; b.y += uyPct;
      }
    }
    // personne ne sort du terrain en se faisant pousser
    for (const d of disques) { d.x = Math.max(1, Math.min(99, d.x)); d.y = Math.max(2, Math.min(98, d.y)); }
  }

  return { creer, couleurFamille, styleDe, construireAction, separerDisques };
})();

if (typeof module !== "undefined") module.exports = ONZE_SCENE;
