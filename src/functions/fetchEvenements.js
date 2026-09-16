const { DateTime } = require("luxon");
const AppliquerExceptions = require("./appliquerExceptions");
const GenererOccurrences = require("./genererOccurences");
const { formaterDateVersClient } = require("./formaterDateVersClient");

/**
 * Résout les événements (simples + récurrents avec exceptions) pour une liste de membres.
 * Ne fait AUCUN formattage de réponse — retourne des lignes brutes dédupliquées,
 * chaque ligne portant `proprietaire_id` pour que l'appelant sache à qui l'associer.
 */
async function resoudreEvenements(pool, { idsMembres, debut, fin, limite = 20, offset = 0 }) {
  if (!idsMembres.length) return [];

  const sqlEvenements = `
    SELECT
      p.id_membre AS proprietaire_id,
      m.id_publique AS proprietaire_id_publique,
      e.*,
      (
        SELECT SUM(version)
          FROM versions_donnees
          WHERE nom_table = 'evenements' AND id_membre IN (?)
        ) AS last_update
    FROM participants_evenements p
    INNER JOIN evenements e ON e.id = p.id_evenement
    INNER JOIN membres m ON p.id_membre = m.id
    WHERE p.id_membre IN (?) AND p.statut = 'acceptee'
      AND e.deleted_at IS NULL
      AND e.regle_recurrence IS NULL
      AND (e.fin >= ?) AND (e.debut <= ?)
    ORDER BY e.debut
    LIMIT ? OFFSET ?`;

  const sqlEvenementsRecc = `
    SELECT
      p.id_membre AS proprietaire_id,
      m.id_publique AS proprietaire_id_publique,
      e.*
    FROM participants_evenements p
    INNER JOIN evenements e ON e.id = p.id_evenement
    INNER JOIN membres m ON p.id_membre = m.id
    WHERE p.id_membre IN (?) AND p.statut = 'acceptee'
      AND e.deleted_at IS NULL
      AND e.regle_recurrence IS NOT NULL
      AND (e.fin >= ?)
    ORDER BY e.debut`;
    // Note : pas de LIMIT ici -- voir remarque plus bas sur la pagination

  const sqlExceptions = `
    SELECT * FROM evenements_exceptions
    WHERE id_parent IN (?) AND deleted_at IS NULL
      AND (fin >= ?) AND (debut <= ?)`;

  const [resultatsSansRecc] = await pool.query(sqlEvenements, [
    idsMembres, idsMembres, debut, fin, limite, offset,
  ]);

  const [resultatsRecc] = await pool.query(sqlEvenementsRecc, [
    idsMembres, debut,
  ]);

  let occurencesEx = [];
  const occurences = GenererOccurrences(
    DateTime.fromSQL(debut, { zone: "utc" }),
    DateTime.fromSQL(fin, { zone: "utc" }),
    resultatsRecc
  );

  const idsParents = occurences.map((o) => o.id);
  if (idsParents.length > 0) {
    const [resultatsExceptions] = await pool.query(sqlExceptions, [
      idsParents, debut, fin,
    ]);
    occurencesEx = AppliquerExceptions(occurences, resultatsExceptions);
  }

  const resultatFinal = [...resultatsSansRecc, ...occurencesEx];

  // Deduplication with id + start as key
  const uniques = new Map();
  resultatFinal.forEach((ev) => {
    const key = (ev.id ?? ev.id_publique) + String(ev.debut);
    if (!uniques.has(key)) uniques.set(key, ev);
  });

  return Array.from(uniques.values());
}
/**
 * 
 * @param pool 
 * @param options {idsMembre, debut, fin, limite = 20, offset = 0}
 * @returns {Object} ev {id_publique, titre, description, debut, fin, regle_recurrence, type: "evenement" | "recurrence"}
 */
function formaterEvenement(ev) {
  return {
    id_publique: ev.id_publique,
    titre: ev.titre,
    description: ev.description,
    debut: formaterDateVersClient(ev.debut),
    fin: formaterDateVersClient(ev.fin),
    recurrence: ev.regle_recurrence ?? null,
    type: ev.type ?? "evenement",
    url: {
      method: "GET",
      string: ev.string ?? `/evenements/${ev.id_publique}`,
    },
  };
}

module.exports = { resoudreEvenements, formaterEvenement };