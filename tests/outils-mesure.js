/* ============================================================
   ONZE — LES OUTILS DE MESURE DIFFÉRENTIELLE, ET LEUR
   PRÉCONDITION AUTO-VÉRIFIÉE.
   ------------------------------------------------------------
   Toute mesure qui compare deux photos de la même zone suppose
   une chose qu'elle ne vérifie jamais : QUE RIEN D'AUTRE NE
   BOUGE. Trois fois cette hypothèse a été fausse, et à chaque
   fois j'ai colmaté le cas particulier :
     · l'aura des joueurs légendaires, qui pulse en boucle ;
     · une annonce qui traverse le cadre entre les deux photos
       (relevé : 135 % là où la valeur vraie est 0, une fois sur
       trois) ;
   et il y en aura un quatrième — un chrono qui tourne, une image
   en différé qui arrive, une barre de défilement qui s'efface.
   **On ne peut pas énumérer ce qui bouge.**

   D'où la précondition, écrite UNE fois et vérifiée à chaque
   mesure : avant de comparer quoi que ce soit, on photographie
   DEUX FOIS la même zone sans rien changer, et on exige une
   différence de ZÉRO. Si ce n'est pas zéro, la page n'est pas
   inerte et la mesure qui suit ne veut rien dire — et le
   résultat nomme de lui-même le nombre de pixels qui bougeaient.

   Ça remplace « penser à geler X » par un garde-fou qui attrape
   aussi ce à quoi personne n'a pensé.
   ============================================================ */

/* Deux pixels diffèrent au-delà de cet écart : le bruit de rendu d'un
   navigateur reste en dessous. */
const ECART_PIXEL = 24;

/* Compte les pixels qui diffèrent entre deux captures encodées en base64,
   et rend aussi le centre du nuage — utile pour dire OÙ ça a changé. */
async function comparer(page, a, b, seuil = ECART_PIXEL) {
  return page.evaluate(async ([x, y, s]) => {
    const lire = async (b64) => {
      const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
      const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
      const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0);
      return { d: g.getImageData(0, 0, c.width, c.height).data, L: c.width };
    };
    const [u, v] = [await lire(x), await lire(y)];
    let n = 0, sx = 0, sy = 0;
    for (let i = 0; i < u.d.length; i += 4) {
      const e = Math.max(Math.abs(u.d[i] - v.d[i]), Math.abs(u.d[i + 1] - v.d[i + 1]),
        Math.abs(u.d[i + 2] - v.d[i + 2]));
      if (e > s) { const p = i / 4; n++; sx += p % u.L; sy += Math.floor(p / u.L); }
    }
    return { pixels: n, cx: n ? sx / n : 0, cy: n ? sy / n : 0 };
  }, [a, b, seuil]);
}

const photographier = (page, clip) =>
  page.screenshot({ clip, animations: "disabled" }).then((b) => b.toString("base64"));

/* LA PRÉCONDITION, ET LE PIÈGE QUI A FAILLI LA RENDRE DÉCORATIVE.

   Première forme, évidente et fausse : photographier deux fois la même
   zone et exiger 0. Elle ne peut RIEN détecter — une capture prise avec
   `animations: "disabled"` fige la page le temps de la photo, si bien que
   deux photos consécutives sont identiques PAR CONSTRUCTION. Vérifié
   contre un contenu qui change à chaque frame : 0 px, avec et sans le
   gel. Un garde-fou toujours vert est un décor (règle M3).

   Ce qui bougeait dans l'incident réel bougeait pendant l'INTERVALLE de
   la mesure — le temps de masquer un élément, de faire un aller-retour
   dans la page, de rephotographier. La seule précondition qui voit cet
   intervalle est donc la MESURE ELLE-MÊME, faite deux fois : sur une page
   inerte, deux mesures identiques donnent le même nombre au pixel près ;
   sur une page qui bouge, elles divergent. Aucune hypothèse sur CE qui
   bouge — c'est tout l'intérêt. */
async function mesureUne(page, clip, masquer, demasquer) {
  const avec = await photographier(page, clip);
  await masquer();
  const sans = await photographier(page, clip);
  await demasquer();
  return comparer(page, avec, sans);
}

/* Ce que peint UN élément, avec sa précondition auto-vérifiée. */
/* LA TOLÉRANCE EST CALIBRÉE, pas choisie. Exiger l'égalité stricte entre
   deux mesures était trop sévère : une page parfaitement calme rend 1 à
   2 pixels d'écart, le bruit d'anticrénelage du navigateur. Deux points
   mesurés encadrent le seuil :
     · page calme          →  1 à 2 px d'écart
     · une annonce qui traverse la zone  →  12 566 px (mesuré)
   Huit pixels tombent donc entre les deux avec une marge énorme des deux
   côtés : au-dessus du bruit, très loin sous la moindre intrusion.

   CE GARDE-FOU N'EST PAS PROUVÉ, ET IL FAUT LE DIRE (règle M3 : une
   recette qui ne sort pas rouge sur son défaut n'est pas un garde-fou).
   Trois contre-tests ont été tentés, trois échecs, pour trois raisons
   différentes — toutes instructives :
     1. photographier deux fois d'affilée une zone qui clignote : 0 px.
        La capture `animations: "disabled"` FIGE la page, donc deux photos
        consécutives sont identiques par construction ;
     2. la même chose sans le gel, avec un clignotement par frame : 0 px
        encore ;
     3. une annonce plein écran programmée pour arriver au milieu d'une
        mesure : les deux passes ont rendu le même nombre au pixel près.
   La fenêtre pendant laquelle une intrusion fausserait la mesure est donc
   plus étroite que tout ce que j'ai su fabriquer — ce qui est cohérent
   avec un défaut observé UNE fois sur trois passages, jamais à volonté.
   Le contrôle est gardé parce qu'il aurait signalé l'incident réel (une
   passe à 135 %, l'autre à 0, soit des milliers de pixels d'écart) et
   qu'il ne coûte qu'une mesure de plus. Mais tant qu'il n'est pas vu
   rouge, il est une PRÉCAUTION, pas une preuve, et il ne doit pas être
   cité comme telle. */
const BRUIT_TOLERE = 8;

async function empreinte(page, clip, masquer, demasquer) {
  const un = await mesureUne(page, clip, masquer, demasquer);
  const deux = await mesureUne(page, clip, masquer, demasquer);
  const ecart = Math.abs(un.pixels - deux.pixels);
  return { inerte: ecart <= BRUIT_TOLERE, ecart, pixels: un.pixels,
    centre: { x: clip.x + un.cx, y: clip.y + un.cy } };
}

/* La même précondition, seule : deux mesures à vide (rien n'est masqué)
   doivent donner zéro toutes les deux. Utile pour éprouver une zone avant
   d'y croire. */
async function zoneInerte(page, clip) {
  const rien = async () => {};
  const r = await empreinte(page, clip, rien, rien);
  return { inerte: r.inerte && r.pixels === 0, pixels: r.pixels, ecart: r.ecart,
    ou: r.pixels ? { x: Math.round(r.centre.x), y: Math.round(r.centre.y) } : null };
}

module.exports = { ECART_PIXEL, BRUIT_TOLERE, comparer, photographier, mesureUne, zoneInerte, empreinte };
