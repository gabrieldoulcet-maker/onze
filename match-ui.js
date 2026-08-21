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

  // Les badges de synergies d'une équipe (ex : « Tiki-Taka 5 »)
  function badges(equipe) {
    return equipe.synergies
      .map((s) => `<span class="badge">${s.nom} ${s.nb}</span>`)
      .join("");
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
  function rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet) {
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
        const prestige = resultat.ecart > 0
          ? `<br><small style="color:#96A699">Dégâts de prestige : ${resultat.ecart} (écart de buts)</small>` : "";
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

  return { rejouer, badges, basculerVitesse };
})();
