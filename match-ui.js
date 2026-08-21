/* ============================================================
   ONZE — Affichage d'un match dans la page (partagé par
   match.html et draft.html). Le calcul vit dans match-moteur.js :
   ici on ne fait que rejouer le résultat au rythme du direct.

   Utilisation :
     ONZE_UI.rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet)
   `elements` = { chrono, scoreA, scoreB, recit } (des éléments du DOM).
   ============================================================ */

const ONZE_UI = (() => {
  const DELAI_PHASE_MS = 5000;     // 8 phases → ~40 s de match
  const DELAI_EVENEMENT_MS = 1400; // les actions d'une phase s'égrènent

  // Les badges de synergies d'une équipe (ex : « Tiki-Taka 5 »)
  function badges(equipe) {
    return equipe.synergies
      .map((s) => `<span class="badge">${s.nom} ${s.nb}</span>`)
      .join("");
  }

  function blocPhase(recit, minute, numero) {
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

  function rejouer(resultat, equipeA, equipeB, elements, auCoupDeSifflet) {
    elements.recit.innerHTML = "";
    elements.scoreA.textContent = "0";
    elements.scoreB.textContent = "0";
    const scores = { a: 0, b: 0 };
    let attente = 300;

    resultat.phases.forEach((phase) => {
      let bloc = null;
      setTimeout(() => {
        elements.chrono.textContent = `⏱ ${phase.minute}ᵉ minute — phase ${phase.numero}/${resultat.phases.length}`;
        bloc = blocPhase(elements.recit, phase.minute, phase.numero);
      }, attente);
      phase.evenements.forEach((ev) => {
        attente += DELAI_EVENEMENT_MS;
        setTimeout(() => {
          if (ev.but) { if (ev.equipe === equipeA.nom) scores.a++; else scores.b++; }
          ajouterEvenement(elements, bloc, ev, scores);
        }, attente);
      });
      attente += Math.max(DELAI_PHASE_MS - phase.evenements.length * DELAI_EVENEMENT_MS, 600);
    });

    setTimeout(() => {
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
    }, attente + 400);
  }

  return { rejouer, badges };
})();
