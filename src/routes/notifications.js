//paquets npm
const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken')

//fonctions
const { generateId: generateIdWithQueue } = require('../functions/idGen')
require("dotenv").config();
const {authentifierToken}  = require('../functions/authenticate')

//PDO
let { pool } = require('../PDO');
const { DateTime } = require("luxon");
const { resChanged, HEADERS_304 } = require("../functions/verifyChanges");
const tablesParType = require("../constants/tablesParType");
const { resolveInvitationsEvenements, resolveDemandesAmis } = require("../functions/resolveNotifsMetier");

// 1. Endpoint GET pour récupérer les notifications
router.get('/', authentifierToken, async (req, res) => {
  const { last_checked, force_refresh } = req.query;
  const { id: idReceveur } = req.membre;

  let query = `
    SELECT
      n.id_publique AS id_notification_publique,
      n.id AS id_notification_prive,
      n.statut,
      n.date_envoi,
      n.message,
      n.source,
      n.payload,
      m.id_publique as id_publique_source,
      (
        SELECT SUM(version)
          FROM versions_donnees
          WHERE nom_table = 'notifications' AND id_membre = ?
      ) AS last_update
    FROM notifications n
    INNER JOIN membres m ON m.id = n.source
    WHERE n.id_receveur = ?
      AND n.deleted_at IS NULL
  `;

  try {
    const hasChanged = await resChanged('notifications', last_checked, idReceveur);

    if (!hasChanged && force_refresh !== 'true') {
      return res.status(200).json({ has_changed: hasChanged });
    }

    const [rowsNotifs] = await pool.query(query, [idReceveur, idReceveur]);

    if (rowsNotifs.length === 0) {
      return res.status(200).json({ compte: 0, notifications: [], last_checked: undefined });
    }

    const idsNotifs = rowsNotifs.map(n => n.id_notification_prive);
    const mapIdNotifIdSource = new Map();
    rowsNotifs.forEach(row => mapIdNotifIdSource.set(row.id_notification_prive, row.id_publique_source));

    await pool.query(
      "UPDATE notifications SET statut = 'lue' WHERE id IN (?) AND statut = 'non_lue'",
      [idsNotifs]
    );

    // --- Étape 1: grouper par type, à partir du payload ---
    const idsParType = {}; // { demande_ami: [12, 45], invitation_evenement: [7] }
    const payloadParNotif = new Map();

    rowsNotifs.forEach(n => {
      const payload = typeof n.payload === 'string' ? JSON.parse(n.payload) : n.payload;
      payloadParNotif.set(n.id_notification_prive, payload);
      if (!payload?.type || !payload?.id_metier) return;
      (idsParType[payload.type] ??= []).push(payload.id_metier);
    });

    // résoudre chaque type (un seul type pour l'instant)

    const resoluParType = {
      demandesAmis: await resolveDemandesAmis(pool, idsParType.demande_ami ?? []),
      invitationsEvenements:await resolveInvitationsEvenements(pool, idsParType.invitation_evenement),
    }
    // plus tard: const invitationsResolues = await resolveInvitations(pool, idsParType.invitation_evenement ?? []);

    // merge dans la réponse finale 
    const notifications = rowsNotifs.map(r => {
      const payload = payloadParNotif.get(r.id_notification_prive);
      const resolu = type ? resolusParType[type]?.get(payload.id_metier) : undefined;

      return {
        id: r.id_notification_publique,
        statut_notification: r.statut,           // lu/non-lu de la notif elle-même
        date_envoie: r.date_envoi,
        message: r.message,
        source_url: { method: 'GET', url: `/membres/${mapIdNotifIdSource.get(r.id_notification_prive)}` },
        type: payload?.type ?? null,
        // Tout ce qui suit vient du resolver, pas du payload figé:
        statut_metier: resolu?.statut_metier ?? null,
        actions: resolu?.actions ?? {},
        details: resolu
          ? { id_demandeur: resolu.id_demandeur, pseudo_demandeur: resolu.pseudo_demandeur }
          : null,
        expiration: resolu?.expiration ?? null
      };
    });

    return res.status(200).json({
      compte: notifications.length,
      notifications,
      has_changed: true,
      last_checked: rowsNotifs[0].last_update ?? undefined
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Erreur lors de la récupération des notifications', erreur: error.sql });
  }
});

// 2. Endpoint POST pour ajouter une nouvelle notification
router.post('/', authentifierToken, async (req, res) => {
  const { type, message, status, destinataires } = req.body;
  const {id: idSource} = req.membre
  
  if (!destinataires || !Array.isArray(destinataires) || destinataires.length === 0) {
      return res.status(400).json({ message: 'Une liste de destinataires est requise.' });
    }

  if (!type || !message || !status) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }

  const [receveursIdsPrives] = pool.query('SELECT id FROM membres WHERE id_publique IN (?)', destinataires)
  const query = 'INSERT INTO notifications (id_receveur, source, type, message, status, timestamp) VALUES ?';

  const values = destinatairesIdsPrive.map(row => [
      row.id, idSource, type, message, status, new Date()  // Crée une ligne pour chaque destinataire
  ]);

  try {      
      const [result] = await pool.query(query, [values]);

      res.status(201).json({ 
          message: 'Notifications envoyées avec succès', 
          lignes_inserees: result.affectedRows,
          completes: destinataires == result.affectedRows
      });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout de la notification', error });
  }
});

router.post('/push_token', authentifierToken, async (req, res)=>{
  const {push_token} = req.body
  if(!push_token)
    return res.status(400).json({message:'push token manquant'})

  const idMembre = req.membre.id
  const sql = 'UPDATE membres SET push_token = ? WHERE id = ?'
  try {
    await pool.query(sql,[push_token, idMembre])
    return res.status(201).json({message:'push token sauvegardé'})
  } catch (error) {
    return res.status(500).json({erreur:error, message:'problème survenu lors de l\'enregistrement du push token'})
  }
})

// 3. Endpoint PATCH pour mettre à jour le statut d'une notification
router.patch('/:notificationId', authentifierToken, async (req, res) => {
  const { notificationId } = req.params;
  const { statut } = req.body;

  if (!statut) {
    return res.status(400).json({ message: 'le champs statut est requis.' });
  }

  try {
    const query = 'UPDATE notifications SET statut = ? WHERE id_publique = ? AND id_receveur = ?';
    const params = [statut, notificationId, req.membre.id]; 

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'notification non trouvée' });
    }

    res.status(200).json({ message: 'statut mis à jour avec succès.' });
  } catch (error) {
    res.status(500).json({ message: 'erreur lors de la mise à jour du statut', error });
  }
});

router.delete('/:notificationId', authentifierToken, async (req,res,next)=>{
  const {id} = req.membre
  const { notificationId } = req.params
  const now = DateTime.now().toUTC().toSQL()
  const sql = 'UPDATE notifications SET deleted_at = ? WHERE id_publique = ? AND id_receveur = ? AND deleted_at IS NULL'
  try {
    const [rows] = await pool.execute(sql, [now, notificationId, id])
    if (rows.affectedRows === 0) {
      return res.status(404).json({message:'notification introuvable'})
    }
    return res.status(200).json({message:"on l'a rangé ou personne ne regarde; rangé quoi?"})
  } catch (error) {
    return res.status(500).json({ message: 'erreur lors de la suppression de la notification', error });
  }
})

module.exports = router;