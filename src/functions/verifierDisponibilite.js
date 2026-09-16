const { DateTime } = require('luxon');
let {pool} = require('../PDO')
const retourConflit  = require('./retourConflit');
const simulerOccurrencesNouvelEvenement = require('./simulerOccNouvEv');
const simulerOccurrencesParentsAvecExceptions = require('./simulerOccParentsExceptions');
const trouverChevauchement = require('./trouverChevauchement');
const { RRule } = require('rrule');
 
async function verifierDisponibilite(req, res, next) {
  const idEv = req.params.idevenement || null
  const ev = {
    ...req.body,
    createur_id: req.membre.id,
  };

  console.log('nouvel evenement:', ev)

  try {
    //Vérification simple : événements non récurrents
    const [simples] = await pool.query(`
      SELECT e.id_publique, e.debut, e.fin
      FROM evenements e
      LEFT JOIN participants_evenements p ON p.id_evenement = e.id
      WHERE (e.createur_id = ? OR p.id_membre = ?)
        AND e.regle_recurrence IS NULL
        AND e.debut < ?
        AND e.fin > ?
        AND e.id_publique != ?
        AND e.deleted_at IS NULL
    `, [ev.createur_id, ev.createur_id, ev.fin, ev.debut, idEv]);

    if (simples.length > 0) {
      return retourConflit(res, simples[0]);
    }

    //Charger les parents récurrents
    const [parents] = await pool.query(`
      SELECT e.id, e.id_publique, titre, description, debut, fin, regle_recurrence, prive, m.fuseau_horaire
      FROM evenements e INNER JOIN membres m ON e.createur_id = m.id
      WHERE createur_id = ?
        AND regle_recurrence IS NOT NULL
        AND debut <= ?
        AND e.id_publique != ?
        AND e.deleted_at IS NULL
    `, [ev.createur_id, ev.fin, idEv]);

    //console.log('verifier dispo parents', parents)

    //Charger leurs exceptions
    const parentIds = parents.map(p => p.id);
    const [exceptions] = parentIds.length === 0 
      ? [[]] 
      : await pool.query(`
          SELECT *
          FROM evenements_exceptions
          WHERE id_parent IN (${parentIds.map(() => '?').join(',')}) 
            AND deleted_at IS NULL
        `, parentIds);
    //console.log('verifier dispo exceptions: ', exceptions)

    //Définir fenêtre de génération
    const fenetreDebut = DateTime.fromSQL(ev.debut).startOf('day');
    const fenetreFin = DateTime.fromSQL(ev.fin, {zone:'utc'}).endOf('day');

    //Générer occurrences parents et appliquer exceptions
    const occParents = simulerOccurrencesParentsAvecExceptions(parents, fenetreDebut, fenetreFin, exceptions);

    //console.log("verifier dispo occParents:", occParents)
    // Vérifier conflit même si le nouvel événement n’est pas récurrent
    let conflit = trouverChevauchement(occParents, ev.debut, ev.fin);
    if (conflit) return retourConflit(res, conflit);

    //Si le nouvel événement est récurrent, générer ses occurrences et vérifier chevauchement
    if (ev.regle_recurrence) {
    // Crée la RRule à partir de la règle de l'événement
    const rule = RRule.fromString(ev.regle_recurrence);
    
    // Début et fin de la fenêtre pour la simulation

    // Utilise le UNTIL de la règle s'il existe, sinon ta fenêtre max
    const fenetreFinRec = rule.options.until && rule.options.until < fenetreFin
                          ? DateTime.fromJSDate(rule.options.until)
                          : fenetreFin;
    const occParentsRec = simulerOccurrencesParentsAvecExceptions(parents, fenetreDebut, fenetreFinRec);

    const occNew = simulerOccurrencesNouvelEvenement(ev, fenetreDebut, fenetreFinRec);

    let conflit = false;
    for (const newOcc of occNew) {
        conflit = trouverChevauchement(occParentsRec, newOcc.debut, newOcc.fin)
        if (conflit) break;
    }

    if (conflit) return retourConflit(res, conflit);
}
    console.log('verif dispos end')
    return next();
  } catch (err) {
    return res.status(500).json({ erreur: err.message });
  }
}
module.exports = {verifierDisponibilite}