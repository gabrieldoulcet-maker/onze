/* ============================================================
   ONZE — Affichage d'un match (partagé par match.html, draft.html
   et la vraie partie). Le calcul vit dans match-moteur.js : ici on
   rejoue le résultat au rythme du direct, accélérable ×2 à tout
   moment (décision n°13 : le match reste court et accélérable).

   Utilisation :
     ONZE_UI.rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet)
     ONZE_UI.basculerVitesse() → renvoie la nouvelle vitesse (1 ou 2)
   `elements` = { chrono, scoreA, scoreB, recit } (éléments du DOM).
   ============================================================ */

const ONZE_UI = (() => {
  /* Les glyphes de familles — un par École et par archétype, uniques,
     sans conflit avec 🧰⭐🧪🛂🌍🔥🎯🏆🎁😱. Même code visuel partout :
     jetons, boutique, scouting, badges de synergies. */
  const GLYPHES = {
    postes: { "GAR": "G", "DÉF": "D", "MIL": "M", "ATT": "A" },
    ecoles: {
      "Tiki-Taka": "🎹", "Catenaccio": "🛡️", "Kick & Rush": "🚀", "École de la Rue": "🛹",
      "La Grinta": "🐺", "Football Total": "🌀", "L'Académie": "📚", "Les Internationaux": "✈️",
      "Le Douzième Homme": "📣", "Les Pros": "💼", "Les Revanchards": "🥊",
    },
    archetypes: {
      "Mur": "🗿", "Moteur": "🔋", "Sentinelle": "👁️", "Virtuose": "🎩", "Finisseur": "🥅",
      "Créateur": "🪄", "Piston": "💨", "Renard": "🦊", "Chanceux": "🍀", "Guerrier": "💪",
      "Mentor": "🦉", "Capitaine": "🎖️",
    },
  };
  const glyphe = (nom) =>
    (typeof ONZE_ECUSSONS !== "undefined" && ONZE_ECUSSONS.idDe(nom)) ? ONZE_ECUSSONS.mini(nom)
    : (GLYPHES.ecoles[nom] || GLYPHES.archetypes[nom] || "");
  const DELAI_PHASE_MS = 5000;     // 8 phases → ~40 s de match
  const DELAI_EVENEMENT_MS = 1400; // les actions d'une phase s'égrènent
  let vitesse = 1;                 // 1 = direct, 2 = accéléré
  let evenementsJoues = [];        // le fil du match EN COURS (recap live, sans spoiler)

  function basculerVitesse() { vitesse = vitesse === 1 ? 2 : 1; return vitesse; }

  /* Les badges de synergies : compte / seuil suivant (« 3/5 »), et un
     badge éteint ✨ quand il ne manque qu'UN joueur pour allumer une
     famille — l'appel d'achat le plus efficace du mercato. */
  function badges(equipe) {
    const paliersDe = (nom, type) =>
      (type === "ecole" ? ONZE.PALIERS_ECOLES[nom] : ONZE.PALIERS_ARCHETYPES[nom]) || null;
    const rendus = [];
    const vus = new Set();
    for (const sy of equipe.synergies) {
      vus.add(sy.nom);
      const paliers = paliersDe(sy.nom, sy.type);
      const prochain = paliers ? paliers.find((p) => p > sy.nb) : null;
      const libelle = prochain ? `${sy.nb}/${prochain}` : `${sy.nb}`;
      const presque = prochain && prochain - sy.nb === 1 ? " presque" : "";
      const ecusson = typeof ONZE_ECUSSONS !== "undefined" ? ONZE_ECUSSONS.badge(sy.nom, true, 18) : glyphe(sy.nom);
      rendus.push(`<span class="badge synergie-active${presque}" data-famille="${sy.nom}">${ecusson} <span class="badge-texte">${sy.nom}<small>${libelle}${presque ? " ✨" : ""}</small></span></span>`);
    }
    // familles pas encore actives mais à UN joueur du premier palier
    const comptes = {};
    for (const j of equipe.joueurs) {
      if (j.ecole) comptes[j.ecole + "|ecole"] = (comptes[j.ecole + "|ecole"] || 0) + 1;
      if (j.archetype) comptes[j.archetype + "|archetype"] = (comptes[j.archetype + "|archetype"] || 0) + 1;
    }
    for (const [cle, nb] of Object.entries(comptes)) {
      const [nom, type] = cle.split("|");
      if (vus.has(nom) || nom === "Capitaine") continue;
      const paliers = paliersDe(nom, type);
      if (paliers && paliers[0] - nb === 1) {
        const ecussonEteint = typeof ONZE_ECUSSONS !== "undefined" ? ONZE_ECUSSONS.badge(nom, false, 18) : glyphe(nom);
        rendus.push(`<span class="badge inactif" data-famille="${nom}">${ecussonEteint} <span class="badge-texte">${nom}<small>${nb}/${paliers[0]} ✨</small></span></span>`);
      }
    }
    return rendus.join("");
  }

  function blocPhase(recit, minute, numero, total) {
    const bloc = document.createElement("div");
    bloc.className = "phase";
    bloc.innerHTML = `<div class="titre-phase">${minute}ᵉ — Phase ${numero}</div>`;
    recit.appendChild(bloc);
    bloc.scrollIntoView({ behavior: "smooth", block: "end" });
    return bloc;
  }

  function ajouterEvenement(elements, bloc, ev, scores) {
    const ligne = document.createElement("div");
    ligne.className = "evenement";
    let html = ev.texte;
    if (ev.synergie) html += ` <span class="tag-synergie">✦ ${ev.synergie}</span>`;
    if (ev.but) {
      bloc.classList.add("but");
      html += `<br><span class="cri">⚽ ${ev.cri}</span> <strong>${scores.a} – ${scores.b}</strong>`;
      elements.scoreA.textContent = scores.a;
      elements.scoreB.textContent = scores.b;
    }
    ligne.innerHTML = html;
    bloc.appendChild(ligne);
    ligne.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  /* ============================================================
     LE TEMPO DU MATCH — grammaire Football Manager.
     Manuel : design/scene-fm.md · décision 26.
     R2 : un match = 2 à 4 TEMPS FORTS rendus, séparés par des CUTS
          secs (carton minute + score). Le régime « domination » a
          disparu : entre deux temps forts, on ne montre RIEN.
     R3 : un temps fort = cut → mise en place (~3 s, les 22 pions
          glissent) → 4 à 8 temps, l'issue au dernier seulement.
     R9 : budgets stricts (amical 1 temps fort, manches 4-9 : 2-3,
          match plein : 3-5). Si ça ne rentre pas, on réduit le
          NOMBRE de temps forts, JAMAIS leur lisibilité.
     ============================================================ */
  const TEMPS_MS = 800;           // plancher de lisibilité — l'arbitrage
                                  // automatique ne descend jamais dessous
  const TEMPS_DECISIF_MS = 1000;  // l'armement de la frappe s'étire
  const TEMPS_ISSUE_MS = 1300;    // la frappe voyage, PUIS l'issue tombe
  const CUT_MS = 900;             // le carton minute + score
  const RESPIRATION_MS = 700;     // le souffle après une issue
  const dureeMiseEnPlace = (nbPhases) => nbPhases <= 4 ? 1500 : nbPhases <= 6 ? 2200 : 3000;
  const dureeTemps = (t) => t.issue ? TEMPS_ISSUE_MS : t.decisif ? TEMPS_DECISIF_MS : TEMPS_MS;

  const estChaude = (phase) => phase.evenements.some((ev) =>
    ev.but || ev.type === "arret" || ev.type === "blocage" || ev.type === "rebond");
  const aBut = (phase) => phase.evenements.some((ev) => ev.but);
  const prioriteDe = (phase) => Math.max(...phase.evenements.map((ev) =>
    ev.but ? 100 : ev.type === "arret" ? (ev.pres ? 60 : 40) : ev.type === "blocage" ? 30 : ev.type === "rebond" ? 20 : 0));
  const coutTempsFort = (action, miseEnPlaceMs) =>
    CUT_MS + miseEnPlaceMs + RESPIRATION_MS + action.reduce((t, tp) => t + dureeTemps(tp), 0);

  /* Le texte de repli quand un temps n'a ni promesse ni événement */
  const texteDuTemps = (t) => {
    if (t.promesse) return t.promesse;
    if (t.ev) return t.ev.texte;
    if (t.type === "relais") return `${t.de || "Le bloc"} cherche ${t.vers}…`;
    if (t.type === "relais_long") return `Long ballon vers ${t.vers} !`;
    if (t.type === "conduite") return `${t.acteur} porte le ballon et fixe la défense…`;
    if (t.type === "frappe") return `${t.tireur ? t.tireur + " arme sa frappe…" : "La frappe part…"}`;
    return null;
  };

  function rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet, options = {}) {
    const delaiPhase = options.delaiPhase || DELAI_PHASE_MS;
    const delaiEvenement = options.delaiEvenement || DELAI_EVENEMENT_MS;
    elements.recit.innerHTML = "";
    elements.scoreA.textContent = "0";
    elements.scoreB.textContent = "0";
    evenementsJoues = [];
    const scores = { a: 0, b: 0 };
    const etapes = [];
    let blocCourant = null;

    // le facteur de vitesse d'une étape : les froides se sautent en ×2
    /* Les deux vitesses INDÉPENDANTES de FM (R10) : temps forts et
       temps morts. Le bouton ×2 du jeu se multiplie par-dessus. */
    const regVitesse = (typeof ONZE_SCENE !== "undefined") ? ONZE_SCENE.reglages() : { vitesseFort: 1, vitesseMort: 1 };
    const facteurFort = () => (regVitesse.vitesseFort || 1) * (vitesse === 2 ? 1.6 : 1);
    const facteurMort = () => (regVitesse.vitesseMort || 1) * (vitesse === 2 ? 4 : 1);

    const jouerEvenement = (ev) => {
      evenementsJoues.push(ev);
      if (ev.but) { if (ev.equipe === equipeA.nom) scores.a++; else scores.b++; }
      ajouterEvenement(elements, blocCourant, ev, scores);
      if (elements.bandeau && !options.scene) {   // sans scène, le bandeau porte le récit
        const chip = ev.synergie
          ? ` <span class="tag-synergie" style="color:${typeof ONZE_SCENE !== "undefined" ? ONZE_SCENE.couleurFamille(ev.synergie) : "var(--or-trophee)"}">✦ ${ev.synergie}</span>` : "";
        elements.bandeau.innerHTML = (ev.but ? `⚽ ${ev.cri} <strong>${scores.a} – ${scores.b}</strong>` : ev.texte) + chip;
      }
      if (typeof ONZE_JUICE !== "undefined") {
        if (ev.but && ev.equipe === equipeA.nom) ONZE_JUICE.but(options.enjeu || 2, options.scene && options.scene.racine);
        else if (ev.but) ONZE_JUICE.jouer("defaite");
        else if (ev.type === "arret") ONZE_JUICE.jouer("arret");
      }
    };

    if (options.scene) {
      /* ---- Le tempo « moments-clés » (R2/R3/R9) ----
         1. Chaque phase à occasion devient un TEMPS FORT construit
            (4-8 temps) via ONZE_SCENE.construireAction.
         2. Sélection par budget : TOUS les buts sont rendus d'office
            (un but ne se compresse jamais — décision 25), puis les
            meilleures occasions (presque-but > arrêt > blocage) tant
            que le budget ET le plafond de format le permettent.
         3. Les phases NON rendues ne sont pas mises en scène du tout :
            elles filent au journal 📜 avec leur accent sonore, et la
            minute avance. C'est ça, le filtre « moments-clés ».
         4. Réglage « Résumé complet » (R10) : le plafond saute, tout
            ce qui porte une occasion est rendu. ---- */
      const reg = ONZE_SCENE.reglages();
      const budgetTotal = delaiPhase * resultat.phases.length;
      const nbPhases = resultat.phases.length;
      const miseEnPlaceMs = dureeMiseEnPlace(nbPhases);
      const resume = reg.filtre === "resume";
      // le plafond de format (R9) — en ×2, seuls les buts sont rendus
      const maxRendus = resume ? 99 : vitesse === 2 ? 0
        : nbPhases <= 4 ? 1 : nbPhases <= 6 ? 3 : 5;
      const actions = new Map();
      for (const phase of resultat.phases) {
        if (estChaude(phase)) actions.set(phase, ONZE_SCENE.construireAction(phase, equipeA, equipeB));
      }
      const candidates = [...actions.keys()]
        .sort((a, b) => (aBut(b) - aBut(a)) || (prioriteDe(b) - prioriteDe(a)));
      const rendues = new Set();
      let coutTotal = 0;
      for (const phase of candidates) {
        const cout = coutTempsFort(actions.get(phase), miseEnPlaceMs);
        if (aBut(phase)) { rendues.add(phase); coutTotal += cout; continue; }
        if (rendues.size < maxRendus && (resume || coutTotal + cout <= budgetTotal)) {
          rendues.add(phase); coutTotal += cout;
        }
      }
      // le temps mort restant se répartit sur les phases non rendues
      const nbMortes = nbPhases - rendues.size;
      const dureeMorte = Math.max(500, Math.min(1600,
        nbMortes ? (budgetTotal - coutTotal) / nbMortes : 900));
      const scoresLobby = (options.scoresLobby || []).slice();
      // la possession affichée vient des VRAIS gains de balle du moteur
      const comptePossession = { moi: 0, eux: 0 };
      const compter = (phase) => {
        for (const ev of phase.evenements) {
          if (ev.type !== "possession" && ev.type !== "contre") continue;
          if (ev.equipe === equipeA.nom) comptePossession.moi++; else comptePossession.eux++;
        }
        options.scene.majPossession(comptePossession);
      };

      resultat.phases.forEach((phase) => {
        if (!rendues.has(phase)) {
          /* --- TEMPS MORT : rien à l'écran (R2). Le journal encaisse. --- */
          etapes.push({
            delai: dureeMorte, mort: true,
            action: () => {
              blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
              options.scene.reglerMinute(phase.minute, dureeMorte);
              options.scene.majJaugeCible(phase);
              phase.evenements.forEach((ev) => { jouerEvenement(ev); options.scene.accent(ev); });
              compter(phase);
              if (scoresLobby.length) options.scene.notifierLobby(scoresLobby.shift());
            },
          });
          return;
        }

        /* --- TEMPS FORT --- */
        const action = actions.get(phase);
        const couverts = new Set(action.map((t) => t.ev).filter(Boolean));
        // 1. le CUT sec : carton minute + score
        etapes.push({
          delai: CUT_MS, mort: true,
          action: () => {
            blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
            options.scene.cut({ minute: phase.minute, scoreA: scores.a, scoreB: scores.b,
              nomA: equipeA.nom, nomB: equipeB.nom }, CUT_MS);
            options.scene.majJaugeCible(phase);
            compter(phase);
          },
        });
        // 2. la MISE EN PLACE : les 22 pions glissent, la promesse tombe
        //    et l'horloge se remet à courir pendant tout le temps fort
        //    (R8) — 3 minutes de jeu, jamais plus : au-delà, la scène
        //    dépasserait la minute de la phase suivante et MENTIRAIT.
        const dureeJouee = action.reduce((t, tp) => t + dureeTemps(tp), 0) + RESPIRATION_MS;
        etapes.push({
          delai: miseEnPlaceMs,
          action: () => {
            options.scene.miseEnPlace(action, miseEnPlaceMs);
            options.scene.reglerMinute(phase.minute + 3, miseEnPlaceMs + dureeJouee);
          },
        });
        // 3. les temps du temps fort
        action.forEach((t) => {
          etapes.push({
            delai: dureeTemps(t), plancher: 640,
            action: () => {
              const duree = dureeTemps(t);
              if (t.issue) {
                // l'issue : le journal et le score n'arrivent qu'à la
                // RÉVÉLATION — sinon le tableau spoile la frappe (R7)
                options.scene.jouerTemps(t, duree, () => { if (t.ev) jouerEvenement(t.ev); });
              } else {
                options.scene.jouerTemps(t, duree);
                options.scene.commentaire(texteDuTemps(t));
                if (t.ev) jouerEvenement(t.ev);
              }
            },
          });
        });
        // 4. le solde (les événements hors chorégraphie) et la respiration
        etapes.push({
          delai: RESPIRATION_MS,
          action: () => {
            phase.evenements.forEach((ev) => { if (!couverts.has(ev)) jouerEvenement(ev); });
            options.scene.repos();
          },
        });
      });
    } else resultat.phases.forEach((phase) => {
      // ---- Sans scène (match.html, draft.html) : le tempo historique ----
      etapes.push({
        delai: 400,
        action: () => {
          elements.chrono.textContent = `⏱ ${phase.minute}ᵉ minute — phase ${phase.numero}/${resultat.phases.length}`;
          blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
        },
      });
      phase.evenements.forEach((ev) => {
        etapes.push({ delai: delaiEvenement, action: () => jouerEvenement(ev) });
      });
      const reste = delaiPhase - 400 - phase.evenements.length * delaiEvenement;
      etapes.push({ delai: Math.max(reste, 200), action: () => {} });
    });

    etapes.push({
      delai: 600,
      action: () => {
        if (options.scene && options.scene.fin) options.scene.fin();
        elements.chrono.textContent = "⏱ Coup de sifflet final";
        const bloc = document.createElement("div");
        bloc.className = "phase final";
        let verdict;
        if (resultat.scoreA > resultat.scoreB) verdict = `🏆 Victoire de ${equipeA.nom} !`;
        else if (resultat.scoreB > resultat.scoreA) verdict = `🏆 Victoire de ${equipeB.nom} !`;
        else verdict = "🤝 Match nul !";
        const prestige = resultat.ecart > 0 && !options.sansPrestige
          ? `<br><small style="color:var(--craie-sourde)">Dégâts de prestige : ${ONZE.degatsPrestige(resultat.ecart, options.manche)} (base de période + ${resultat.ecart} d'écart)</small>` : "";
        const hdm = ONZE.statsDuMatch ? ONZE.statsDuMatch(resultat, equipeA, equipeB).hommeDuMatch : null;
        const ligneHdm = hdm ? `<br><small style="color:var(--or-trophee)">🌟 Homme du match : ${hdm.nom} (${hdm.equipe}) — le ⚔️ en haut détaille chaque joueur</small>` : "";
        bloc.innerHTML = `Score final : <strong>${resultat.scoreA} – ${resultat.scoreB}</strong><br>${verdict}${ligneHdm}${prestige}`;
        elements.recit.appendChild(bloc);
        bloc.scrollIntoView({ behavior: "smooth", block: "end" });
        if (auCoupDeSifflet) auCoupDeSifflet();
      },
    });

    (function suivante() {
      const etape = etapes.shift();
      if (!etape) return;
      const diviseur = options.scene ? (etape.mort ? facteurMort() : facteurFort()) : vitesse;
      // Le plancher de lisibilité (R9) : un temps de temps fort ne se
      // brouille jamais. L'arbitrage automatique reste à 0,8 s ; seul
      // le réglage explicite « plus vite » peut descendre à 0,64 s.
      const delai = Math.max(etape.plancher || 0, etape.delai / diviseur);
      setTimeout(() => { etape.action(); suivante(); }, delai);
    })();
  }

  /* ⚔️ Le recap du match — contributions par joueur (buts, passes
     décisives, duels gagnés, arrêts), barres proportionnelles,
     extensible au camp adverse par les onglets. Ouvrable PENDANT le
     match (il lit le résultat déjà calculé — on n'affiche que le
     récap final, comme l'épée de TFT). */
  function ouvrirRecap(resultat, equipeA, equipeB, opts = {}) {
    // Pendant le match : le recap ne lit QUE les événements déjà joués
    // (zéro spoiler) — les notes sur 10 évoluent en direct, comme FM.
    const source = opts.enCours ? { phases: [{ evenements: evenementsJoues }] } : resultat;
    const stats = ONZE.statsDuMatch(source, equipeA, equipeB);
    const note10 = (l) => Math.min(10, Math.max(5,
      6 + l.buts * 1.5 + l.passes * 0.8 + l.duels * 0.35 + l.arrets * 0.8)).toFixed(1);
    const couleurNote = (n) => n >= 7.5 ? "var(--gazon-electrique)" : n >= 6.5 ? "var(--or-trophee)" : "var(--craie-sourde)";
    const voile = document.createElement("div");
    voile.className = "voile-fiche";
    let campActif = equipeA.nom;
    const rendre = () => {
      const lignes = stats.parEquipe[campActif];
      const maxScore = Math.max(...lignes.map((l) => l.score), 1);
      const hdm = stats.hommeDuMatch;
      voile.innerHTML = `<div class="fiche-joueur" style="max-width:460px">
        <h3>⚔️ Le recap du match${opts.enCours ? " <small style='color:var(--craie-sourde)'>(en direct)</small>" : ""}</h3>
        <div class="sous-titre">${hdm ? `🌟 Homme du match${opts.enCours ? " provisoire" : ""} : <strong>${hdm.nom}</strong> (${hdm.equipe})` : "Personne ne s'est encore illustré…"}</div>
        <div style="margin:6px 0">
          ${[equipeA, equipeB].map((eq) =>
            `<button class="onglet-recap" data-camp="${eq.nom.replace(/"/g, "&quot;")}" style="width:auto;margin:0 4px 0 0;padding:5px 10px;font-size:0.7rem;${eq.nom === campActif ? "background:var(--ligne-forte);border-color:var(--gazon-electrique)" : ""}">${eq.nom}</button>`).join("")}
        </div>
        ${lignes.map((l) => `<div class="ligne-stat">
          <span class="note-recap" style="color:${couleurNote(Number(note10(l)))}">${note10(l)}</span>
          <span class="nom-stat">${hdm && l.nom === hdm.nom && campActif === hdm.equipe ? "🌟 " : ""}${l.nom}</span>
          <span class="barre-stat"><div style="width:${Math.round(100 * l.score / maxScore)}%"></div></span>
          <span style="font-size:0.64rem;color:var(--craie-claire);white-space:nowrap">${[
            l.buts ? `⚽×${l.buts}` : "", l.passes ? `🎯×${l.passes}` : "",
            l.duels ? `⚔️×${l.duels}` : "", l.arrets ? `🧤×${l.arrets}` : "",
          ].filter(Boolean).join(" ") || "—"}</span>
        </div>`).join("")}
        <div style="color:var(--craie-sourde);font-size:0.66rem;margin-top:8px">⚽ buts · 🎯 passes décisives · ⚔️ duels gagnés · 🧤 arrêts</div>
        <button class="fermer">Fermer</button>
      </div>`;
    };
    rendre();
    voile.addEventListener("click", (e) => {
      const onglet = e.target.closest(".onglet-recap");
      if (onglet) { campActif = onglet.dataset.camp; rendre(); return; }
      if (e.target === voile || e.target.classList.contains("fermer")) voile.remove();
    });
    (document.getElementById("app") || document.body).appendChild(voile);
  }

  /* La fiche complète d'un joueur (au tap sur une carte).
     `calcule` : le joueur passé par equipeDepuisFiches si dispo
     (stats boostées en vert) ; sinon on génère les stats de base. */
  function ouvrirFiche(fiche, calcule) {
    const statsBase = calcule ? calcule.statsBase : ONZE.genererStats(fiche);
    const stats = calcule ? calcule.stats : statsBase;
    const boosts = calcule ? calcule.boosts : {};
    const note = ONZE.noteGlobale(stats);
    const etoiles = (fiche.etoiles || 1) >= 2 ? " " + "★".repeat(fiche.etoiles) : "";
    const voile = document.createElement("div");
    voile.className = "voile-fiche";
    // les 2 stats signatures sont DORÉES (l'affiche de héros, Lot 3)
    const signatures = new Set(ONZE.statsSignatures(stats).map((x) => x.nom));
    const lignes = Object.entries(stats).map(([stat, valeur]) => {
      const boost = boosts[stat] || 0;
      const classe = boost > 0 ? "boostee" : boost < 0 ? "malussee" : "";
      const detail = boost ? ` (${statsBase[stat]}${boost > 0 ? "+" : ""}${boost})` : "";
      const sig = signatures.has(ONZE.NOMS_STATS[stat]);
      return `<div class="ligne-stat${sig ? " signature" : ""}"><span class="nom-stat">${ONZE.NOMS_STATS[stat]}</span>` +
        `<span class="valeur-stat ${classe}">${valeur}</span>` +
        `<span class="barre-stat"><div style="width:${valeur}%"></div></span>` +
        `<span style="font-size:0.66rem;color:var(--craie-sourde)">${detail}</span></div>`;
    }).join("");
    const coutCadre = fiche.icone || fiche.cout === 5 ? "var(--cout-5)" : `var(--cout-${fiche.cout || 1}, var(--ligne-forte))`;
    const pilule = (contenu) => `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--nuit-profonde);border-radius:var(--r-pilule);padding:2px 8px;font-size:0.66rem;font-weight:700;color:var(--craie-claire)">${contenu}</span>`;
    voile.innerHTML = `<div class="fiche-joueur" style="position:relative;overflow:hidden;border:2.5px solid ${coutCadre}">
      <div class="filigrane-note">${note}</div>
      <div style="display:flex;align-items:center;gap:9px;position:relative">
        <span class="note-heros" style="border-top-color:${coutCadre}">${note}</span>
        <h3 style="flex:1">${fiche.nom}${etoiles}</h3>
        <span class="pastille p-${fiche.poste}" style="font-size:0.8rem;min-width:24px;padding:3px 4px">${GLYPHES.postes[fiche.poste] || fiche.poste}</span>
      </div>
      ${fiche.unique ? `<div class="sous-titre" style="color:var(--or-trophee);font-weight:800;font-style:italic">✦ ${fiche.unique} — UNIQUE</div>` : ""}
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin:4px 0 8px;position:relative">
        ${fiche.ecole ? pilule(glyphe(fiche.ecole) + " " + fiche.ecole) : ""}
        ${fiche.archetype ? pilule(glyphe(fiche.archetype) + " " + fiche.archetype) : ""}
        ${pilule(`<span style="color:${coutCadre}">coût ${fiche.cout}</span>`)}
      </div>
      ${fiche.description ? `<div class="description">${fiche.description}</div>` : ""}
      ${fiche.ecoleBonus ? `<div class="sous-titre">🛂 Emblème : compte aussi comme <strong>${fiche.ecoleBonus}</strong></div>` : ""}
      ${fiche.citoyenDuMonde ? `<div class="sous-titre">🌍 Citoyen du monde : +1 dans toutes tes Écoles actives</div>` : ""}
      ${fiche.relique ? `<div class="sous-titre" style="color:var(--or-trophee)">🏺 <strong>${fiche.relique}</strong> — Relique (définitive)</div>` : ""}
      ${(fiche.specialisations || []).map((nom) => {
        const spec = Object.values(ONZE.SPECIALISATIONS).find((x) => x.nom === nom);
        const iconique = (fiche.specsIconiques || []).includes(nom);
        return `<div class="sous-titre">${iconique ? "🌟" : "🧪"} <strong>${nom}${iconique ? " (Iconique ×1,5)" : ""}</strong>${spec && spec.effet ? " — " + spec.effet : ""}</div>`;
      }).join("")}
      ${(fiche.staffCartes || []).map((c) => `<div class="sous-titre">🧰 ${c} <small>(en attente d'une 2ᵉ carte)</small></div>`).join("")}
      ${lignes}
      <div style="color:var(--craie-sourde);font-size:0.68rem;margin-top:8px">Valeur <span style="color:var(--gazon-electrique)">verte</span> = boostée par tes synergies. Chaque duel du match lit 2 de ces stats.</div>
      <button class="fermer">Fermer</button>
    </div>`;
    voile.addEventListener("click", (e) => { if (e.target === voile || e.target.classList.contains("fermer")) voile.remove(); });
    (document.getElementById("app") || document.body).appendChild(voile);
  }

  return { rejouer, badges, basculerVitesse, ouvrirFiche, ouvrirRecap, GLYPHES, glyphe };
})();
