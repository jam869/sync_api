//paquets npm
const express = require("express");
const router = express.Router();
require("dotenv").config();
const { RRule, rrulestr, datetime } = require('rrule');

//fonctions
const { authentifierToken, verifierAccesEvenement, verifierAccesException, verifierAmitie, verifierAmitieParticipants } = require("../functions/authenticate");
const { generateIdWithQueue } = require("../functions/idGen");
const FactoriserTimestamp = require("../functions/factoriserTimestamp");
const { formaterEvenement, resoudreEvenements } = require("../functions/fetchEvenements")

//PDO
let { pool } = require("../PDO");
const { getNow } = require("../functions/getNow");
const { DateTime } = require("luxon");
const { formaterDates } = require("../functions/verifierEtFormaterDateUTC");
const {
  formaterDateVersClient,
} = require("../functions/formaterDateVersClient");
const {
  verifierDisponibilite,
} = require("../functions/verifierDisponibilite");
const envoyerNotification = require("../functions/envoyerNotification");
const {
  default: genererSlugAvecQueue,
} = require("../functions/genereSlugAvecQueue");
const GenererOccurrences = require("../functions/genererOccurences");
const AppliquerExceptions = require("../functions/appliquerExceptions");
const { resChanged, HEADERS_304 } = require("../functions/verifyChanges");
const inviteParticipants = require("../functions/invite");
const validateExpiration = require("../functions/validateExpiration");
const resoudreAmis = require("../functions/fetchAmis");
const { resolveInvitationsEvenements, getInvitationsEvenementsByInvite } = require("../functions/resolveNotifsMetier");

///retourne plusieurs objets 'evenement' selon un idmembre donné par un JWT
/// res.json: {compte|evenement[id|titre|description|debut|fin|reccurence]}
/// req.query: {limite=5|offset=0|debut|fin}
router.get( "/", authentifierToken, async (req, res, next) => {
  let idProprietaire = req.membre.id;
  let limite = req.query.limite || 20;
  let offset = req.query.offset || 0;
  let { last_checked, force_refresh } = req.query
  const now = DateTime.now();
  let debut = req.query.debut || now.startOf('day').toSQL();
  let fin = req.query.fin || now.endOf('day').toSQL();
  //console.log("get evenements/", debut, fin);
  
  try {
    const hasChanged = await resChanged('evenements_membre', last_checked, idProprietaire)
    if (hasChanged || force_refresh === 'true') {
      const evenements = await resoudreEvenements(pool, {
        idsMembres: [idProprietaire],
        debut,
        fin,
        limite,
        offset
      })
        
      const reponse = evenements.map((ev) => formaterEvenement(ev))
      
      return res.status(200).json({
        compte: reponse.length,
        evenements: reponse,
        has_changed: hasChanged || force_refresh === 'true',
        last_checked: evenements[0]?.last_update ?? undefined
      });
    }

    return res.status(200).json({has_changed:hasChanged || force_refresh === 'true'}).end()
  } catch (err) {
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});
///Insert un objet 'evenement' dans la table 'evenements' et permet la redirection vers '/evenements/:idevenement' pour une éventuelle modification
///req.body: {participants}  
router.post("/", authentifierToken, formaterDates, verifierDisponibilite, verifierAmitieParticipants, async (req, res, next) => {
  const createurId = req.membre.id;
  const debutEv = req.body.debut;
  const finEv = req.body.fin;
  const titre = req.body.titre || undefined;
  const description = req.body.description || null;
  const prive = req.body.prive !== undefined ? req.body.prive : true;
  const regleRecurrence = req.body.regle_recurrence || null;
  const participants = req.participantsIdsPrives
  
  if (!titre || titre.length < 4) {
    return res.status(400).json({message: "l'évènement se doit d'avoir un titre"})
  }

    const idPubliqueEvenement = await generateIdWithQueue(10, true, true, "E");
    const slug = await genererSlugAvecQueue(titre, idPubliqueEvenement);

    const conn = await pool.getConnection();
    
    try {
      await conn.beginTransaction();

      const [responsePostEv] = await conn.execute(
        `INSERT INTO evenements(id_publique, debut, fin, titre, description, prive, regle_recurrence, createur_id, slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          idPubliqueEvenement,
          debutEv,
          finEv,
          titre,
          description,
          prive,
          regleRecurrence,
          createurId,
          slug,
        ]
      );
      const idPriveEvenement = responsePostEv.insertId

      //insérer créateur dans les participants
      await conn.execute(
        `INSERT INTO participants_evenements (id_evenement, id_membre, privilege, statut) VALUES (?, ?, ?, ?)`,
        [idPriveEvenement, createurId, "editeur", "acceptee"]
      );
      
      if(participants && participants.length > 0){
        await inviteParticipants(conn, participants, {
          createur: req.membre,
          idPriveEv: idPriveEvenement,
          idPubliqueEv: idPubliqueEvenement,
          debut: DateTime.fromSQL(debutEv, { zone: 'utc' }),
          fin: DateTime.fromSQL(finEv, { zone: 'utc' }),
          titre: titre
        })
      }
      await conn.commit();

      return res.status(201).json({
        message: "évènement créé",
        url: { method: "GET", string: `/evenements/${idPubliqueEvenement}` },
      });
    } catch (err) {
      await conn.rollback();
      return res.status(500).json({
        erreur: err,
        message: err.message,
      });
    } finally {
      conn.release();
    }
  }
);

router.get("/amis", authentifierToken, async (req, res, next) => {
  const idMembre = req.membre.id;
  const now = DateTime.now().toUTC()
  const start = req.query.debut || now.startOf("day").toSQL();
  const end = req.query.fin || now.endOf("day").toSQL();
  const { last_checked, force_refresh } = req.query 

  const friendsLimit = parseInt(req.query.limiteAmi) || 10;
  const friendsOffset = parseInt(req.query.offset) * friendsLimit || 0;

  if(friendsOffset < 0){
    return res.status(400).json({message:"la pagination est plus petite que 0"})
  }

  try {
    
    const { ids: idsAmis, rows: resultatsAmis} = await resoudreAmis(pool, { idMembre, friendsOffset, friendsLimit })
    if (!idsAmis.length) return res.status(200).json({ compte: 0, resultat: [] });

    // Dict : id_ami -> infos + tableau d'évènements
      const groupes = new Map();
      for (const row of resultatsAmis) {
        groupes.set(row.id_ami, {
          fp_url: `${row.fp_url}`,
          pseudo: row.pseudo,
          id: row.ami_id_publique,
          temps_amitie: formaterDateVersClient(row.temps_creation),
          evenements: []
        });
      }

    const hasChangedEvents = await resChanged('evenements', last_checked, idsAmis);
    const hasChangedFriends = await resChanged('amities', last_checked, idsAmis)

    let resultat = Array.from(groupes.values()).map(data => ({
      ...data
    }));
    if (hasChanged || force_refresh === 'true') {

      const events = await resoudreEvenements(pool, {
        idsMembres: idsAmis,
        debut: start,
        fin: end,
        limite: 20,
        offset: 0
      });      

      // put events into right owner
      for (const ev of events) {
        const groupe = groupes.get(ev.proprietaire_id);
        if (groupe) groupe.evenements.push(ev);
      }

      const resultat = Array.from(groupes.values()).map(data => ({
        ...data,
        evenements: data.evenements
      }));

      return res.status(200).json({ compte: idsAmis.length, has_changed: hasChanged || force_refresh === 'true', last_checked:resultat[0].evenements.last_checked, resultat });
    }

    return res.status(200).json({has_changed:hasChanged || force_refresh === 'true', resultat})
  } catch (err) {
    console.error(err)
    return res.status(500).json({ message: "Erreur base de données", erreur: err.message });
  }
});

router.get("/amis/:idAmi", authentifierToken, async (req, res, next) => {
  const { idAmi } = req.params;
  const { debut, fin } = req.query;

  if (!debut || !fin) {
    return res.status(400).json({ erreur: "Paramètres start et end requis" });
  }

  try {
    // Query événements sans récurrence
    const evenementsSql = `
      SELECT 
        e.id, e.id_publique, e.debut, e.fin, e.prive
      FROM participants_evenements p
        JOIN evenements e ON e.id = p.id_evenement
      WHERE p.id_membre = ?
        AND e.fin >= ?
        AND e.debut <= ?
        AND e.regle_recurrence IS NULL
      ORDER BY e.debut
    `;

    // Query événements avec récurrence
    const evenementsRecc = `
      SELECT 
        e.id, e.id_publique, e.debut, e.fin, e.prive, e.regle_recurrence
      FROM participants_evenements p
        JOIN evenements e ON e.id = p.id_evenement
      WHERE p.id_membre = ?
        AND e.debut <= ?
        AND e.regle_recurrence IS NOT NULL
      ORDER BY e.debut
    `;

    // Query exceptions
    const exceptions = `
      SELECT *
      FROM evenements_exceptions 
      WHERE id_parent IN (?)
    `;

    // Exécuter queries
    const [resultatsEvSansRec] = await pool.query(evenementsSql, [
      idAmi,
      debut,
      fin,
    ]);

    const [resultatsEvRec] = await pool.query(evenementsRecc, [idAmi, debut]);

    let occurencesEx = [];
    if (resultatsEvRec.length > 0) {
      // Générer occurrences avec tes fonctions
      const occurences = GenererOccurrences(
        DateTime.fromSQL(debut, { zone: "utc" }),
        DateTime.fromSQL(fin, { zone: "utc" }),
        resultatsEvRec
      );

      const idsParents = occurences.map((o) => o.id);
      if (idsParents.length > 0) {
        const [resultatsExceptions] = await pool.query(exceptions, [
          idsParents,
        ]);
        occurencesEx = AppliquerExceptions(occurences, resultatsExceptions);
      } else {
        occurencesEx = occurences;
      }
    }

    // Fusionner résultats
    const resultatFinal = [...resultatsEvSansRec, ...occurencesEx];

    // Supprimer doublons
    const uniques = new Map();
    resultatFinal.forEach((evenement) => {
      const key = evenement.id + evenement.debut;
      if (!uniques.has(key)) {
        uniques.set(key, evenement);
      }
    });

    res.json(
      Array.from(uniques.values()).map((e) => ({
        debut: e.debut,
        fin: e.fin,
      }))
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

router.get("/:idevenement", authentifierToken, verifierAccesEvenement, async (req, res, next) => {
  const {privilege, prive} = req.accesEvenement

  console.log('get evenement/:idevenement: accès', privilege, "prive", prive)
  
  const sqlEvenement = `SELECT e.titre, e.description, e.debut, e.fin, e.prive, e.regle_recurrence, m.fuseau_horaire
                      FROM evenements e 
                      INNER JOIN membres m ON m.id = e.createur_id
                      WHERE e.id_publique = ? `;

  try {
    const [resultat] = await pool.query(sqlEvenement, [req.params.idevenement]);

    if (resultat.length === 0) {
      return res.status(404).json({ message: "Événement non trouvé" });
    }

    const [evenement] = resultat; // Puisque trouvé au moins un événement

    //console.log("/evenements/:idevenement", resultat[0]);

    res.status(200).json({
      id: req.params.idevenement,
      titre: evenement.titre,
      description: evenement.description,
      debut: formaterDateVersClient(evenement.debut),
      fin: formaterDateVersClient(evenement.fin),
      prive: evenement.prive,
      privilege_membre: privilege,
      fuseau_horaire: evenement.fuseau_horaire,
      regle_recurrence: evenement.regle_recurrence,
      last_checked:{resource:'evenement', timestamp:DateTime.now().toUTC()}
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération des événements." });
  }
});

router.patch("/:idevenement", authentifierToken, verifierAccesEvenement, formaterDates, verifierDisponibilite, async (req, res, next) => {
  const id = req.params.idevenement;
  const updates = req.body;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "Aucun champ à mettre à jour" });
  }

  const fields = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(updates);

  try {
    //Mettre à jour l'évènement
    values.push(id);
    let sql = `UPDATE evenements SET ${fields} WHERE id_publique = ?`;
    await pool.query(sql, values);

    res.status(201).json({
      message: "Évènement mis à jour",
      mises_à_jours: updates,
    });
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

router.delete("/:idevenement", async (req, res, next) => {
  const id = req.params.idevenement;
  var sql = "DELETE FROM evenements WHERE id_publique = ?";

  try {
    await pool.query(sql, [id]);
    res.status(200).json({
      message: "Évènement supprimé",
    });
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

router.get('/recurrences/:idevenement', authentifierToken, verifierAccesEvenement, async (req, res) => {7
  const {privilege, prive} = req.accesEvenement
  const idParent = req.params.idevenement;
  console.log('body', req.query)
  const { debut, fin } = req.query; // venant du client
  console.log('idaprent', idParent)
  try {
    const [rows] = await pool.query(
      'SELECT titre, description, regle_recurrence, m.id_publique, m.fuseau_horaire, prive FROM evenements e INNER JOIN membres m ON m.id = e.createur_id WHERE e.id_publique = ?',
      [idParent]
    );

    if (!rows.length)
      return res.status(404).json({ erreur: 'Événement parent introuvable' });

    const parent = rows[0];

    // Vérifier si la date correspond à une occurrence
    const rule = rrulestr(parent.regle_recurrence);
    console.log('dateDebut', debut)
    const dateDebut = DateTime.fromSQL(debut, {zone:'utc'}).toJSDate();
    console.log('dateDebut', dateDebut)

    // on "projette" le parent dans une occurrence concrète
    const evenement = {
      id: idParent,
      privilege_membre: privilege,
      ...parent,
      debut: debut,
      fin: fin,
      type: 'recurrence',
      url: `/evenements/reccurences/${idParent}`,
    };

    res.json(evenement);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur serveur' });
  }
});

router.post("/exceptions", authentifierToken, async (req, res) => {
  const { id_parent, debut_occurence, type, debut, fin, description } = req.body;
  const idMembre = req.membre.id;

  if (!id_parent || !debut_occurence || !type) {
    return res.status(400).json({
      message: "Champs requis manquants : id_parent, date_occurence, type",
    });
  }

  try {
    // Vérifier que l'évènement parent existe et que le membre y a accès
    const sqlVerif = `
            SELECT e.id, p.privilege
            FROM evenements e
            INNER JOIN participants_evenements p ON e.id = p.id_evenement
            WHERE e.id_publique = ? AND p.id_membre = ?
        `;
    const [verif] = await pool.query(sqlVerif, [id_parent, idMembre]);

    if (verif.length === 0) {
      return res.status(403).json({
        message: "Vous n'avez pas accès à cet évènement parent",
      });
    }

    // Insérer l’exception
    const sqlInsert = `
            INSERT INTO evenements_exceptions (id_parent, id_publique, debut_occurence,type, debut, fin, description)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
    const idPublique = await generateIdWithQueue(10, true, true, 'EX', 'evenements_exceptions')
    const [result] = await pool.query(sqlInsert, [
      verif[0].id,
      idPublique,
      debut_occurence,
      type,
      debut || null,
      fin || null,
      description
    ]);

    // Récupérer les infos de l’évènement parent (titre, description, fuseau_horaire, prive)
    const sqlParent = `
            SELECT e.titre, e.description, m.fuseau_horaire, e.prive
            FROM evenements e
            INNER JOIN membres m ON m.id = e.createur_id
            WHERE e.id_publique = ?
        `;
    const [parentInfos] = await pool.query(sqlParent, [id_parent]);

    const parent = parentInfos[0];

    // Construire la réponse finale
    return res.status(201).json({
      id_parent,
      type,
      date_occurence: debut_occurence,
      debut,
      fin,
      titre: parent.titre,
      description: parent.description,
      fuseau_horaire: parent.fuseau_horaire,
      prive: parent.prive,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Erreur lors de la création de l’exception",
      erreur: err.message,
    });
  }
});

router.get("/exceptions/:idevenement", authentifierToken, verifierAccesEvenement, async (req, res, next) => {
  const {privilege} = req.accesEvenement
  
  const sqlException = `
        SELECT ex.id_publique, e.id_publique as id_parent, ex.type, ex.debut_occurence, ex.debut AS ex_debut, ex.fin AS ex_fin,
               e.titre, ex.description, e.prive, m.fuseau_horaire
        FROM evenements_exceptions ex
        INNER JOIN evenements e ON e.id = ex.id_parent
        INNER JOIN membres m ON e.createur_id = m.id
        INNER JOIN participants_evenements p ON p.id_evenement = e.id
        WHERE ex.id_publique = ?;
    `;

  try {
    const [resultat] = await pool.query(sqlException, [req.params.idevenement]);

    if (resultat.length === 0) {
      return res.status(404).json({ message: "Exception non trouvée" });
    }

    const [exception] = resultat;

    res.status(200).json({
      id: exception.id_publique,
      id_parent:exception.id_parent,
      type:'exception',
      type_ex: exception.type, // 'modifie' ou 'annule'
      debut: formaterDateVersClient(exception.ex_debut),
      fin: formaterDateVersClient(exception.ex_fin),
      titre: exception.titre,
      description: exception.description,
      prive: exception.prive,
      fuseau_horaire: exception.fuseau_horaire,
      privilege_membre:privilege
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Erreur lors de la récupération de l'exception." });
  }
});

router.patch("/exceptions/:id", authentifierToken, async (req, res) => {
  const { debut, fin } = req.body;

  if (!debut && !fin) {
    return res
      .status(400)
      .json({ message: "Au moins 'debut' ou 'fin' doit être fourni" });
  }

  const updates = [];
  const params = [];

  if (debut) {
    updates.push("debut = ?");
    params.push(debut);
  }
  if (fin) {
    updates.push("fin = ?");
    params.push(fin);
  }

  params.push(req.params.id);

  const sql = `UPDATE evenements_exceptions SET ${updates.join(", ")} WHERE id_publique = ?`;

  try {
    const [result] = await pool.query(sql, params);
    res.status(201).json({ message: "Exception mise à jour" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la mise à jour de l'exception" });
  }
});

router.delete("/exceptions/:id", authentifierToken, async (req, res) => {
  const sql = `DELETE FROM exceptions WHERE id = ?`;

  try {
    const [result] = await pool.query(sql, [req.params.id]);
    res.status(200).json({ message: "Exception supprimée" });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Erreur lors de la suppression de l'exception" });
  }
});

router.get("/:idevenement/participants", authentifierToken, async (req, res, next) => {
  try {
    const limite = parseInt(req.query.limite) || 10;
    const offset = parseInt(req.query.offset) || 0;

    const sqlParticipants = `
      SELECT m.pseudo, i.url, p.privilege, m.id_publique, p.statut
      FROM participants_evenements p
      INNER JOIN membres m ON p.id_membre = m.id
      LEFT JOIN images i ON m.id_fp = i.id
      WHERE p.id_evenement = ?
      
      LIMIT ? OFFSET ?
    `;

    const [responseIdEv] = await pool.query('SELECT id FROM evenements WHERE id_publique = ?', [req.params.idevenement])

    const [resultats] = await pool.query(sqlParticipants, [
      responseIdEv[0].id,
      limite,
      offset,
    ]);

    const reponse = resultats.map((r) => {
      return {
        id:r.id_publique,
        pseudo: r.pseudo,
        statut:r.statut,
        privilege: r.privilege || 'lecteur', // peut être null si c’est un invité
        fp_url: `${r.url}`,
        url: {
          method: "GET",
          url: `/membres/${r.id_publique}`,
        },
      };
    });

    res.status(200).json({
      cacheable: true,
      participants: reponse,
    });
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: {
        message: err.message,
        sql: err.sql,
      },
    });
  }
}
);

router.post("/:idevenement/participants", authentifierToken, verifierAmitieParticipants, async (req, res, next) => {    
  const idEvenement = req.params.idevenement;
  const participants = req.participantsIdsPrives;
  
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    // Vérifier si l'événement existe
    const [evenement] = await conn.query(
      "SELECT id, titre, debut, fin FROM evenements WHERE id_publique = ?",
      [idEvenement]
    );

    if (evenement.length === 0) {
      return res.status(404).json({ message: "Événement non trouvé." });
    }

    await inviteParticipants(conn, participants, {
      createur: req.membre,
      idPriveEv: evenement[0].id,
      idPubliqueEv: idEvenement,
      debut: DateTime.fromSQL(evenement[0].debut, { zone: 'utc' }),
      fin: DateTime.fromSQL(evenement[0].fin, { zone: 'utc' }),
      titre: evenement[0].titre
    })
    
    await conn.commit()
    return res.status(201).json({
      message: "Participants ajoutés avec succès.",
      liste_participants: {
        method: "GET",
        url: `/evenements/${idEvenement}/participants`,
      },
    });
  } catch (error) {
    await conn.rollback()
    console.error("Erreur lors de l'ajout des participants:", error);
    return res.status(500).json({
      message: "Une erreur est survenue lors de l'ajout des participants.",
    });
  }finally{
    conn.release()
  }
});

router.patch("/:idevenement/participants", async (req, res, next) => {
  const idMembre = req.params.id_membre;
  const updates = req.body;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "Aucun champ à mettre à jour" });
  }

  const fields = Object.keys(updates)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = Object.values(updates);

  try {
    //Mettre à jour la liste de participants
    values.push(id);
    let sql = `UPDATE participants_evenements SET ${fields} WHERE id_membre = ?`;
    await pool.query(sql, values);

    //Retourner la liste de participants mise à jour
    sql = `SELECT * FROM membres WHERE id = ?`;
    const [resultat] = await pool.query(sql, [idMembre]);
    const r = resultat[0];
    res.status(201).json({
      message: "Un participant mis à jour",
      mises_à_jours: updates,
      Participant: {
        idMembre: r.id_membre,
        droit: r.droit,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

//quitter un evenement
router.post( "/:idevenement/quitter", authentifierToken, async (req, res, next) => {
    const idMembre = req.membre.id;
    const idEvenement = req.params.idevenement
    var sql = "DELETE pe FROM participants_evenements pe INNER JOIN evenements e ON e.id = pe.id_evenement WHERE id_membre = ? AND e.id_publique = ?";

    try {
      await pool.query(sql, [idMembre, idEvenement]);
      res.status(201).json({
        message: "évènement quitté",
      });
    } catch (err) {
      res.status(500).json({
        message: "Une erreur au niveau de la base de donnée est survenue",
        erreur: err.message,
      });
    }
  }
);

router.delete("/:idevenement/participants/:id_publique_membre", authentifierToken, verifierAccesEvenement, async (req, res, next) => {
  const idPubliqueParticipant = req.params.id_publique_membre;
  const idEvenement = req.params.idevenement
  const {privilege} = req.accesEvenement

  var sqlParticipant = `
    DELETE p FROM participants_evenements p
      INNER JOIN membres m ON m.id = p.id_membre
      INNER JOIN evenements e ON e.id = p.id_evenement
    WHERE m.id_publique = ? AND e.id_publique = ?`;
  
  var sqlNotification = `
    UPDATE notifications SET deleted_at = NOW(6)
      WHERE id_metier = (
        SELECT ie.id FROM invitations_evenement ie
          INNER JOIN membres m ON m.id = ie.id_invite
          INNER JOIN evenements e ON e.id = ie.id_evenement
          WHERE m.id_publique = ? AND e.id_publique = ?
        )
  `  

  if(privilege != 'editeur')
    return res.status(401).json({ message: 'impossible de modifier un évènement de la sorte' })
  
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    await conn.query(sqlNotification, [idPubliqueParticipant, idEvenement])
    await conn.query(sqlParticipant, [idPubliqueParticipant, idEvenement]);

    await conn.commit()

    return res.status(200).json({
      message: "Participant supprimé",
    });

  } catch (err) {
    await conn.rollback()

    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  } finally {
    conn.release()
  }
});

router.get("/invitations", authentifierToken, async (req, res, next) => {
  const idMembre = req.membre.id;
  try {
    const invitations = await getInvitationsEvenementsByInvite(pool, idMembre)

    return res.status(200).json({
      compte: invitations.length,
      invitations
    });
  } catch (err) {
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

//plus utilise
router.get("/invitations/batch", authentifierToken, async (req, res, next) =>{
  let ids = req.query.ids; 
  if (typeof ids === 'string') {
    ids = ids.split(',').map(id => Number(id));
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    console.log("les identifiants ne sont pas un tableau ou sont vides", ids)
    return res.status(400).json({ message: "les identifiants ne sont pas un tableau ou sont vides" });
  }
  const sql = `
    SELECT id_publique, expiration, statut FROM invitations_evenement WHERE id_publique IN (?)
  `
  try {
    const [rInvitations] = await pool.query(sql, [ids])
    
    const reponse = rInvitations.map(inv=>({
      id_metier: inv.id_publique,
      statut: inv.statut,
      expiration: validateExpiration(DateTime.fromSQL(inv.expiration)) 
    }))

    res.status(200).json(reponse)
  } catch (error) {
    res.status(500).json({
      message: "une erreur s'est produite au niveau de la base de donnée",
      erreur: error
    })
  }
})

//pas utilisée
router.post("/invitations", authentifierToken, verifierAmitieParticipants, verifierAccesEvenement, async (req, res, next) => {
  const idMembre = req.membre.id;
  const idPubliqueEvenement = req.body.id_evenement;
  const invitations = req.participantsIdsPrives;

  console.log('idMembre', idMembre, 'idPubliqueEv', idPubliqueEvenement, 'invitations', invitations)
  if (!Array.isArray(invitations))
    return res
      .status(400)
      .json({ message: "le champ invitations est invalide" });

  const idsInvites = invitations.map((i) => i.id_invite);
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    /* inviteParticipants(conn, invitations, {
      createur:req.membre, 
      idPriveEv: 
    }) */
    const [rEv] = await conn.query(
      "SELECT e.id, m.pseudo as pseudo, titre, debut, fin FROM evenements e JOIN membres m ON e.createur_id = m.id WHERE e.id_publique = ?",
      [idPubliqueEvenement]
    );
    if (!rEv.length)
      return res.status(404).json({ message: "évènement introuvable" });

    const [rInvites] = await conn.query(
      "SELECT id_publique, id FROM membres WHERE id_publique IN (?)",
      [idsInvites]
    );

    // Créer un mapping public -> privé
    const mappingIdPubliqueToPrive = Object.fromEntries(
      rInvites.map((m) => [m.id_publique, m.id])
    );

    // Puis générer les valeurs pour l'INSERT
    const valuesR = await Promise.all(
      invitations.map(async (invite) => {
        const idInvitation = await generateIdWithQueue(10, true, true, 'I', 'invitations_evenement');
        const idPrive = mappingIdPubliqueToPrive[invite.id_invite];
        if (!idPrive) throw new Error(`Membre ${invite.id_invite} introuvable`);
        return [
          idInvitation,
          rEv[0].id,
          idMembre,
          idPrive,
        ];
      })
    );

    const [rInsert] = await conn.query(
      "INSERT INTO invitations_evenement(id_publique, id_evenement, id_invitant, id_invite) VALUES ?",
      [valuesR]
    );
    console.log('INSERT INTO invitations')
    const idsInvitesPrives = idsInvites.map(pub => mappingIdPubliqueToPrive[pub]).filter(Boolean);
    console.log('idsPrives', idsInvitesPrives)
    const [rPushToken] = await conn.query(
      "SELECT push_token, id FROM membres WHERE id IN ?",
      [idsInvitesPrives]
    );
    console.log('SELECT push_tokens')

    rPushToken[0].forEach((i) =>{
      envoyerNotification(
        conn,
        i.push_token,
        "invitation_evenement",
        "un moment à partager t'est proposé",
        `${rEv[0].pseudo} souhaite t'inviter à ${rEv[0].titre} de ${rEv[0].debut} à ${rEv[0].fin}`,
        idMembre,
        i.id,
        {
          evenement_url: {
            method: "GET",
            url: `/evenements/${idPubliqueEvenement}`,
          },
        },
        rInsert.insertId
      )
    }
    );
    await conn.commit()
    return res.status(201).json({
      message:'invitations envoyées'
    })
  } catch (err) {
    await conn.rollback()
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
  finally{
    conn.release()
  }
});

router.patch( "/invitations/:idinvitation", authentifierToken, async (req, res, next) => { 
  const idMembre = req.membre.id;
  const idInvitationPublique = req.params.idinvitation
  const nouvStatut = req.body.statut;
  const { id_evenement } = req.body;
  const nowUTC = DateTime.now().toUTC().toSQL({ includeOffset: false, includeZone: false })
  
  console.log("nouvstatut", nouvStatut)
  if (!nouvStatut || !id_evenement)
    return res.status(400).json({ message: "body passé invalide" });

  if (nouvStatut !== 'acceptee' && nouvStatut !== 'refusee')
    return res.status(400).json({message:"nouveau statut invalide"})
  

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [r] = await conn.query(
      "UPDATE invitations_evenement SET statut = ? WHERE id_publique = ? AND expiration > ? AND id_invite = ?",
      [nouvStatut, idInvitationPublique, nowUTC, idMembre]
    );

    if (r.affectedRows < 1) {
      await conn.rollback()
      return res.status(404).json({ message: "invitation inexistante" });
    }

    let message;

    if (nouvStatut == "acceptee") {
      message = "ça y'est, ta présence est confirmé";
      //mentionner au createur qun ami sest joint
      const [inviteurRows] = await conn.query(
        `SELECT m.push_token, m.id AS id_invitant, e.titre, e.id_publique AS id_evenement_publique
        FROM invitations_evenement i
        INNER JOIN membres m ON m.id = i.id_invitant
        INNER JOIN evenements e ON e.id = i.id_evenement
        WHERE i.id_publique = ?`,
        [idInvitationPublique]
      );

      if (inviteurRows.length > 0) {
        const { push_token, id_invitant, titre, id_evenement_publique } = inviteurRows[0];

        await envoyerNotification(
          conn,
          push_token,
          'evenements',
          'invitation acceptée',
          `${req.membre.pseudo} se joint à ${titre}`,
          req.membre.id,        // source : l'invité qui vient d'accepter
          id_invitant,          // receveur : l'inviteur
          {
            url: { method: 'GET', string: `/evenements/${id_evenement_publique}` }
          },
          idInvitationPublique
        );
      }
    } else {
      message = "dire non c'est parfois se dire oui";
    }

    await conn.query(
      `UPDATE participants_evenements SET statut = ? 
        WHERE id_membre = ?
          AND id_evenement = (
            SELECT id FROM evenements WHERE id_publique = ?
          )`,
      [nouvStatut, idMembre, id_evenement]
    ); 

    await conn.commit()
    return res.status(200).json({ message: message });
  } catch (error) { 
    await conn.rollback()
    return res.status(500).json({
      message: "une erreur au niveau de la base de donnée est survenue",
      erreur: error.message,
    });
  }finally{
    conn.release()
  }
});

router.delete("invitations/:idinvitation",  authentifierToken, async (req, res, next) => {
    const idMembre = req.membre.id;

    try {
      const [r] = await pool.query(
        "DELETE FROM invitations_evenement WHERE id_publique = ? AND id_invite = ?; DELETE FROM notifications WHERE metier_id = ? AND id_receveur = ?",
        [req.params.idinvitation, idMembre, req.params.idinvitation, idMembre]
      );
      return res.send(200).json({ message: "on l'a enlevé de tes pattes" });
    } catch (error) {
      return res.send(500).json({
        message: "une erreur au niveau de la base de donnée est survenue",
      });
    }
  }
);

module.exports = router;
