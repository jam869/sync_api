//paquets npm
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
require("dotenv").config();

//fonctions
const { authentifierToken } = require("../functions/authenticate");
const resoudreAmis = require("../functions/fetchAmis")

//PDO
let { pool } = require("../PDO");
const envoyerNotification = require("../functions/envoyerNotification");
const { generateIdWithQueue } = require("../functions/idGen");
const { formaterDateVersClient } = require("../functions/formaterDateVersClient");
const { getDemandesAmisByDestinataire } = require("../functions/resolveNotifsMetier");

// Récupérer la liste des amis d'un membre
router.get("/", authentifierToken, async (req, res, next) => {
  try {
    const idMembre = req.membre.id;
    const sql = `SELECT id_publique, pseudo, i.url, a.temps_creation
                    FROM amis a
                    JOIN membres m ON a.id_ami = m.id
                    LEFT JOIN images i ON m.id_fp = i.id
                    WHERE a.id_membre_a = ? OR a.id_membre_b = ?`; 

    const {rows: amis} = await resoudreAmis(pool, { idMembre, friendsLimit: 100, friendsOffset: 0 });
    const resultat = amis.map((r, i)=>{
        return{
            id_publique:r.id_publique,
            pseudo:r.pseudo,
            fp_url:r.url ?? null,
            temps_amitie:formaterDateVersClient(r.temps_creation)
        } 
    })

    res.status(200).json(resultat);
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

// Modifier les informations personnalisées d'un ami
router.patch( "/:idmembre_publique", authentifierToken, async (req, res, next) => {
  try {
    const idAmi = req.params.id;
    const idMembre = req.membre.id;
    const { couleur } = req.body;

    const update = `UPDATE membres SET nom = ?, prenom = ?
                      WHERE id = (
                        SELECT id_ami FROM amis WHERE id_membre = ? AND id_ami = ?
                      )`;
    await pool.query(update, [nom, prenom, idMembre, idAmi]);

    res.status(200).json({ message: "Ami mis à jour avec succès" });
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

// Supprimer un ami
router.delete("/:idami_publique", authentifierToken, async (req, res, next) => {
  const idMembre = req.membre.id
  const idAmiPublique = req.params.idami_publique;

  const sqlDeleteAmitie = `DELETE FROM amis WHERE (id_membre = ? AND id_ami = ?) OR (id_membre = ? AND id_ami = ?)`;
  const sqlDeleteOrphelins = `DELETE a FROM amis a LEFT JOIN membres m1 ON a.id_membre = m1.id LEFT JOIN membres m2 ON a.id_ami = m2.id WHERE (a.id_membre = ? OR a.id_ami = ?) AND (m1.id IS NULL OR m2.id IS NULL)`
  const sqlUpdateDemande = `UPDATE demandes_amis SET statut = 'supprimee' WHERE (id_demandeur = ? AND id_destinataire = ?) OR (id_destinataire = ? AND id_demandeur = ?) LIMIT 1`
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [rIdAmiPrive] = await conn.query("SELECT id FROM membres WHERE id_publique = ?", [idAmiPublique])
    if(rIdAmiPrive.length == 0){
      await conn.query(sqlDeleteOrphelins, [idMembre, idMembre]);
      return res.status(400).json({ message: "l'ami n'existe plus, l'amitié a été supprimée" });
    }
    
    const idAmiPrive = rIdAmiPrive[0].id
    
    await conn.query(sqlDeleteAmitie, [idMembre, idAmiPrive, idAmiPrive, idMembre]);
    await conn.query(sqlUpdateDemande, [idMembre, idAmiPrive, idMembre, idAmiPrive])
    
    await conn.commit()
    return res.status(200).json({
      message: "amitié supprimée avec succès",
    });
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

//Get les demandes qui nous est envoyées
router.get("/demandes", authentifierToken, async (req, res, next) => {
  try {
    const idMembre = req.membre.id;

    const demandes = await getDemandesAmisByDestinataire(pool, idMembre)

    res.status(200).json({
      compte: demandes.length,
      demandes
    });
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

//Get les demandes selon un array de id publiques
router.get("/demandes/batch", authentifierToken, async (req, res, next) => {
  let ids = req.query.ids;
  if (typeof ids === 'string') {
    ids = ids.split(',').map(id => Number(id));
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "les identifiants ne sont pas un tableau ou sont vides" });
  }
  const sql = `
    SELECT id_publique, statut FROM demandes_amis WHERE id_publique IN (?)
  `
  try {
    const [rInvitations] = await pool.query(sql, [ids])
    
    const reponse = rInvitations.map(inv=>({
      id_metier: inv.id_publique,
      statut: inv.statut
    }))

    res.status(200).json(reponse)
  } catch (error) {
    res.status(500).json({
      message: "une erreur s'est produite au niveau de la base de donnée",
      erreur: error
    })
  }
})

router.post("/demandes", authentifierToken, async (req, res, next) => {
  
  const idDemandeurPrive = req.membre.id;
  const pseudoDemandeur = req.membre.pseudo;
  console.log('membre', req.membre)
  const idDestinatairePublique = req.body.id_destinataire;
  
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()
    //SELECT idDestinataire privé
    const [resIdDestinataire] = await conn.execute(
      "SELECT id FROM membres WHERE id_publique = ?",
      [idDestinatairePublique]
    );
    if (!resIdDestinataire.length) {
      await conn.rollback()
      return res.status(404).json({ message: "Destinataire non trouvé" });
    }
    const idDestinatairePrive = resIdDestinataire[0].id;

    //Verification d'amitié
    if (idDemandeurPrive === idDestinatairePrive) {
      await conn.rollback()
      return res.status(400).json({
        message: "Impossible de s'ajouter sois-même en ami",
      });
    }
    //Vérifier si la demande existe deja 
    const [rDemande] = await conn.execute(
      `SELECT 1 FROM demandes_amis 
      WHERE statut != 'supprimee' AND (
        (id_demandeur = ? AND id_destinataire = ?)
        OR
        (id_destinataire = ? AND id_demandeur = ?)
      )
      LIMIT 1`,
      [idDemandeurPrive, idDestinatairePrive, idDemandeurPrive, idDestinatairePrive])
    if (rDemande.length > 0) {
      await conn.rollback()
      return res.status(400).json({ message: "demande envoyée; sois patient!" })
    }
    console.log(
      "post /demandes -> idDestinatairePublique",
      idDestinatairePublique,
      "idDestinatairePrivé",
      idDestinatairePrive
    );
    //INSERT dans la table demandes_amis
    const idDemandePublique = await generateIdWithQueue(10, true, true, 'D', "demandes_amis")
    sql = `INSERT INTO demandes_amis (id_publique, id_demandeur, id_destinataire, statut)
            VALUES (?, ?, ?, 'en_attente')
            ON DUPLICATE KEY UPDATE 
              statut = IF(statut IN ('refusee','supprimee'), 'en_attente', statut),
              temps_creation = IF(statut IN ('refusee','supprimee'), CURRENT_TIMESTAMP, temps_creation);
          `;
    const [resDemande] = await conn.execute(sql, [idDemandePublique, idDemandeurPrive, idDestinatairePrive]);
    
    //Envoyer une notif
    const [reponsePushToken] = await conn.execute(
      "SELECT push_token FROM membres WHERE id = ?",
      [idDestinatairePrive]
    );
    const { push_token } = reponsePushToken[0];

    const data = await envoyerNotification(
      conn,
      {
        token: push_token,
        type: "demande_ami",
        titre: `une belle rencontre commence`,
        corps: `${pseudoDemandeur} veut devenir ton ami`,
        source: idDemandeurPrive,
        destinataire: idDestinatairePrive,        
        idMetierPrive: resDemande.insertId
      }
    );
    await conn.commit()
    return res
      .status(201)
      .json({
        notif_feedback: data,
        message: "demande d'ami envoyée; curieux de voir ou ça mènera"
      });
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

router.patch("/demandes/:idDemandePublique", authentifierToken, async (req, res, next) => {
  const { statut } = req.body; 
  const {id, pseudo} = req.membre
  const idDemandePublique = req.params.idDemandePublique;
  
  const verifSql = "SELECT id_destinataire  FROM demandes_amis WHERE id_publique = ? AND id_destinataire = ?"

  // Vérifiez si le statut est valide
  if (!["acceptee", "refusee"].includes(statut)) {
    return res
      .status(400)
      .json({
        message:
          'statut invalide',
      });
  }
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()

    const [verifRows] = await conn.query(verifSql, [idDemandePublique, id])
    if (verifRows.length === 0) {
      await conn.rollback()      
      return res.status(403).json({message:"Cette demande ne t'appartient pas"})
    }

    const sql = `UPDATE demandes_amis SET statut = ? WHERE id_publique = ? AND id_destinataire = ?`;
    const [statutUpdateRows] = await conn.query(sql, [statut, idDemandePublique, id]);

    if(statutUpdateRows.affectedRows == 0){
      return res.status(404).json({
        message:"demande introuvable"
      })
    }

    //envoie une notification au demandeur pour confirmer la nouvelle amitiee 
    if (statut === "acceptee") {
      const [reponsePriveeEtDemandeur] = await conn.query(
        "SELECT da.id, id_demandeur, id_destinataire, m.push_token, m.id_publique FROM demandes_amis da INNER JOIN membres m ON m.id = da.id_demandeur WHERE da.id_publique = ?",
        [idDemandePublique]
      );
      const id_membre_a = Math.min(reponsePriveeEtDemandeur[0].id_destinataire, reponsePriveeEtDemandeur[0].id_demandeur) 
      const id_membre_b = Math.max(reponsePriveeEtDemandeur[0].id_destinataire, reponsePriveeEtDemandeur[0].id_demandeur)
      await conn.query("INSERT INTO amis (id_membre_a, id_membre_b) VALUES (?,?)", [
        id_membre_a,
        id_membre_b,
      ]);
      //envoyer au demandeur la reponse positive!
      await envoyerNotification(
        conn, 
        reponsePriveeEtDemandeur[0].push_token, 
        "amis",
        "nouvelle amitié",
        `${pseudo} et toi êtes maintenant copain-copain`,
        id,
        reponsePriveeEtDemandeur[0].id_demandeur,
        {
          type:["get", "profil"],
          url:{
            method:"GET",
            string:`membres/${reponsePriveeEtDemandeur[0].id_publique}`
          }
        },
        reponsePriveeEtDemandeur[0].id_publique
      )      
    }
    await conn.commit()
    return res
      .status(200)
      .json({
        message: `Statut de la demande mis à jour avec succès. Demande ${statut}`,
      });
    
  } catch (error) {
    await conn.rollback()
    console.log(error)
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: error,
    });
  }finally{
    conn.release()
  }
});

router.delete("/demandes/:idDemandePublique", authentifierToken, async (req, res, next) => {
    try {
      const idDemande = req.params.idDemandePublique;
      const {id} = req.membre

      const [demandeRow] = await pool.query("SELECT id_demandeur, id_receveur FROM demandes_amis WHERE id_publique = ? AND (id_demandeur = ? OR id_receveur = ?) ", [idDemande, id, id])

      if(!demandeRow.length || demandeRow.length == 0)
        return res.status(403)
          .json({
            message:"Tu n'as pas accès a cette demande"
          })

      const sqlDemandeur = `DELETE FROM demandes_amis WHERE id_publique = ? AND id_demandeur = ?`; //Check sur id_demandeur seulement, si un receveur delete, une erreur est levee
      const sqlDestinataire =  `UPDATE demandes_amis SET statut = 'supprimee' WHERE id_publique = ? AND id_destinataire = ?`

      let sql = sqlDemandeur

      if(demandeRow[0].id_receveur == id) //si le destinataire supprime la demande
        sql = sqlDestinataire


      const [rows] = await pool.query(sql, [idDemande, id]);

      if (rows.affectedRows == 0) {
        return res.status(400).json({message: "impossible de supprimer la demande d'ami"})
      }
      return res.status(200).json({ message: "demande d'ami supprimée avec succès." });
    } catch (error) {
      return res.status(500).json({
        message: "Une erreur au niveau de la base de donnée est survenue",
        erreur: error.message,
      });
    }
  }
);

module.exports = router;