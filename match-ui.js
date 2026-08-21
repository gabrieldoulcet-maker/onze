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
  const DELAI_PHASE_MS = 5000;     // 8 phases → ~40 s de match
  const DELAI_EVENEMENT_MS = 1400; // les actions d'une phase s'égrènent
  let vitesse = 1;                 // 1 = direct, 2 = accéléré

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
      rendus.push(`<span class="badge${presque}">${sy.nom} ${libelle}${presque ? " ✨" : ""}</span>`);
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
        rendus.push(`<span class="badge inactif">${nom} ${nb}/${paliers[0]} ✨</span>`);
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

  /* File d'étapes jouée en chaîne : la vitesse peut changer en cours
     de match, chaque étape relit `vitesse` au moment de s'armer. */
  function rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet, options = {}) {
    elements.recit.innerHTML = "";
    elements.scoreA.textContent = "0";
    elements.scoreB.textContent = "0";
    const scores = { a: 0, b: 0 };
    const etapes = [];
    let blocCourant = null;

    resultat.phases.forEach((phase) => {
      etapes.push({
        delai: 400,
        action: () => {
          elements.chrono.textContent = `⏱ ${phase.minute}ᵉ minute — phase ${phase.numero}/${resultat.phases.length}`;
          blocCourant = blocPhase(elements.recit, phase.minute, phase.numero);
        },
      });
      phase.evenements.forEach((ev) => {
        etapes.push({
          delai: DELAI_EVENEMENT_MS,
          action: () => {
            if (ev.but) { if (ev.equipe === equipeA.nom) scores.a++; else scores.b++; }
            ajouterEvenement(elements, blocCourant, ev, scores);
          },
        });
      });
      const reste = DELAI_PHASE_MS - 400 - phase.evenements.length * DELAI_EVENEMENT_MS;
      etapes.push({ delai: Math.max(reste, 200), action: () => {} });
    });

    etapes.push({
      delai: 600,
      action: () => {
        elements.chrono.textContent = "⏱ Coup de sifflet final";
        const bloc = document.createElement("div");
        bloc.className = "phase final";
        let verdict;
        if (resultat.scoreA > resultat.scoreB) verdict = `🏆 Victoire de ${equipeA.nom} !`;
        else if (resultat.scoreB > resultat.scoreA) verdict = `🏆 Victoire de ${equipeB.nom} !`;
        else verdict = "🤝 Match nul !";
        const prestige = resultat.ecart > 0 && !options.sansPrestige
          ? `<br><small style="color:#96A699">Dégâts de prestige : ${ONZE.degatsPrestige(resultat.ecart, options.manche)} (base de période + ${resultat.ecart} d'écart)</small>` : "";
        bloc.innerHTML = `Score final : <strong>${resultat.scoreA} – ${resultat.scoreB}</strong><br>${verdict}${prestige}`;
        elements.recit.appendChild(bloc);
        bloc.scrollIntoView({ behavior: "smooth", block: "end" });
        if (auCoupDeSifflet) auCoupDeSifflet();
      },
    });

    (function suivante() {
      const etape = etapes.shift();
      if (!etape) return;
      setTimeout(() => { etape.action(); suivante(); }, etape.delai / vitesse);
    })();
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
    const lignes = Object.entries(stats).map(([stat, valeur]) => {
      const boost = boosts[stat] || 0;
      const classe = boost > 0 ? "boostee" : boost < 0 ? "malussee" : "";
      const detail = boost ? ` (${statsBase[stat]}${boost > 0 ? "+" : ""}${boost})` : "";
      return `<div class="ligne-stat"><span class="nom-stat">${ONZE.NOMS_STATS[stat]}</span>` +
        `<span class="valeur-stat ${classe}">${valeur}</span>` +
        `<span class="barre-stat"><div style="width:${valeur}%"></div></span>` +
        `<span style="font-size:0.66rem;color:#96A699">${detail}</span></div>`;
    }).join("");
    voile.innerHTML = `<div class="fiche-joueur">
      <h3>${fiche.nom}${etoiles} <span style="float:right;color:#E8C547">${note}</span></h3>
      <div class="sous-titre">${fiche.poste} · ${fiche.cout}M${fiche.unique ? " · ⭐ " + fiche.unique : ""}${fiche.ecole ? " · " + fiche.ecole : ""}${fiche.archetype ? " · " + fiche.archetype : ""}</div>
      ${fiche.description ? `<div class="description">${fiche.description}</div>` : ""}
      ${fiche.ecoleBonus ? `<div class="sous-titre">🛂 Emblème : compte aussi comme <strong>${fiche.ecoleBonus}</strong></div>` : ""}
      ${fiche.citoyenDuMonde ? `<div class="sous-titre">🌍 Citoyen du monde : +1 dans toutes tes Écoles actives</div>` : ""}
      ${(fiche.specialisations || []).map((nom) => {
        const spec = Object.values(ONZE.SPECIALISATIONS).find((x) => x.nom === nom);
        return `<div class="sous-titre">🧪 <strong>${nom}</strong>${spec && spec.effet ? " — " + spec.effet : ""}</div>`;
      }).join("")}
      ${(fiche.staffCartes || []).map((c) => `<div class="sous-titre">🧰 ${c} <small>(en attente d'une 2ᵉ carte)</small></div>`).join("")}
      ${lignes}
      <div style="color:#96A699;font-size:0.68rem;margin-top:8px">Valeur <span style="color:#4FC57C">verte</span> = boostée par tes synergies. Chaque duel du match lit 2 de ces stats.</div>
      <button class="fermer">Fermer</button>
    </div>`;
    voile.addEventListener("click", (e) => { if (e.target === voile || e.target.classList.contains("fermer")) voile.remove(); });
    (document.getElementById("app") || document.body).appendChild(voile);
  }

  return { rejouer, badges, basculerVitesse, ouvrirFiche };
})();
