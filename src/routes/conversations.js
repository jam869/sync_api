//paquets npm
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");

//fonctions
const { generateSalt, hash, compare } = require("../functions/pass");
const { generateIdWithQueue } = require("../functions/idGen");
require("dotenv").config();
const { selectQueryBuilder } = require("../functions/sqlquerybuilder");
const {
  authentifierToken,
  verifierAccesConversation,
  verifierAmitieParticipants,
} = require("../functions/authenticate");
const FactoriserTimestamp = require("../functions/factoriserTimestamp");

//PDO
let { pool } = require("../PDO");
const envoyerNotification = require("../functions/envoyerNotification");
const { formaterDateVersClient } = require("../functions/formaterDateVersClient");
const { DateTime } = require("luxon");
const formaterMessages = require("../functions/formaterMessages");

// Récupérer toutes les conversations avec limite et offset
router.get("/", authentifierToken, async (req, res) => {
  const limite = 10
  const offset = parseInt(req.query.offset, 10) || 0;
  const idMembre = req.membre.id;
  try {
    const [conversations] = await pool.query(
      `
      SELECT c.id, c.id_publique, c.titre, c.couverture_url
      FROM conversations c
      INNER JOIN participants_conversations pc ON c.id = pc.id_conversation
      WHERE pc.id_membre = ?
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
      `,
      [idMembre, limite, offset]
    );

    if (conversations.length === 0) {
      return res.status(200).json({ message:'aucune conversation trouvée', conversations: [] });
    }

    const conversationIds = conversations.map(c => c.id);

    //Récupérer les participants pour les titres et couvertures vides
    const [participants] = await pool.query(
      `
      SELECT pc.id_conversation, m.pseudo, m.id_publique, i.url
      FROM participants_conversations pc
      INNER JOIN membres m ON pc.id_membre = m.id
      LEFT JOIN images i ON m.id_fp = i.id
      WHERE pc.id_conversation IN (?) AND pc.id_membre != ?
      `,
      [conversationIds, idMembre]
    );
    // Group participants par conversation
    const participantsMap = {};
    participants.forEach(p => {
      if (!p.id_conversation) return; 
      if (!participantsMap[p.id_conversation]) participantsMap[p.id_conversation] = [];
      participantsMap[p.id_conversation].push({ id:p.id_publique, pseudo: p.pseudo, fp_url: p.url });
    });

    //Récupérer le dernier message de chaque conversation
    const [lastMessages] = await pool.query(      `
      SELECT m.id_conversation, m.message, m.temps_envoi, m.id_auteur,
        CASE 
          WHEN m.id_auteur = ? THEN 'lu'
          WHEN ml.id_message IS NULL THEN 'non_lu'
          ELSE 'lu'
        END AS statut
      FROM messages_texte m
      
      LEFT JOIN messages_texte_lus ml ON ml.id_message = m.id
      
      INNER JOIN (
        SELECT id_conversation, MAX(temps_envoi) AS dernier_timestamp
        FROM messages_texte

        WHERE id_conversation IN (?)
        GROUP BY id_conversation
      ) AS last_msgs
      ON m.id_conversation = last_msgs.id_conversation
      AND m.temps_envoi = last_msgs.dernier_timestamp
      `,
      [idMembre, conversationIds]
    );

    const lastMessagesMap = {};
    lastMessages.forEach(msg => {
      lastMessagesMap[msg.id_conversation] = {
        message: msg.message,
        temps_envoi: formaterDateVersClient(msg.temps_envoi),
        statut: msg.statut,
        envoye_par_membre: msg.id_auteur == idMembre
      };
    });

    //Construire la réponse finale
    const reponse = conversations.map(conv => {
      const participants = participantsMap[conv.id] || [];
      const titre = conv.titre || 
        participants
          .filter(p => p.id !== idMembre)
          .map(p => p.pseudo)
          .join(", ") ||
          'toi';
      let couvertureUrl 
      if(conv.couverture_url)
        couvertureUrl = conv.couverture_url
      else{
        const participantsDestinataires = participants.filter(p => p.id != idMembre)
        if(participantsDestinataires.length > 0){
          couvertureUrl = participantsDestinataires[0].fp_url
        }else
          couvertureUrl = 'fp_membre'
      }

      return {
        id: conv.id_publique,
        titre,
        couverture_url: couvertureUrl,
        dernier_message: lastMessagesMap[conv.id] || null,
        participants // tu peux aussi renvoyer la liste complète si utile
      };
    });

    res.status(200).json({ cacheable: true, conversations: reponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: err
    });
  }
});

// Créer une conversation
router.post("/", authentifierToken, verifierAmitieParticipants, async (req, res) => {
  const {id:idCreateur, pseudo:pseudoCreateur} = req.membre;
  const participantsIdsPrives = req.participantsIdsPrives || []
  const { titre, couverture_url, message_bienvenu } = req.body;

  const idConversation = await generateIdWithQueue(10, true, true, "C");

  const sqlInsrtConv =
    "INSERT INTO conversations (couverture_url, id_publique, titre) VALUES (?,?,?)";
  const sqlInsrtPartConv = 
    "INSERT INTO participants_conversations (id_conversation, id_membre, role) VALUES" 
  const sqlSlctPushTkns = 
    "SELECT push_token, id FROM membres WHERE id IN (?)"
  const sqlMessageBienvenu = 
    "INSERT INTO messages_textes (id_conversation, id_auteur, message) VALUES(?, ?, ?)"  

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    
    const [rInsrtConv] = await conn.execute(sqlInsrtConv, [couverture_url, idConversation, titre])  
    const idPriveConv = rInsrtConv.insertId
    if(message_bienvenu != null)
      await conn.execute(sqlMessageBienvenu, [idPriveConv, idCreateur, message_bienvenu])

    let valeursParticipants = []
    let placeholdersParticipants = []
    if(participantsIdsPrives.length>0){
      placeholdersParticipants = participantsIdsPrives.map(()=>'(?, ?, ?)')
      participantsIdsPrives.forEach((p) => valeursParticipants.push(idPriveConv, p.id, p.privilege));  
    }
    placeholdersParticipants.push('(?, ?, ?)')
    valeursParticipants.push(idPriveConv, idCreateur, "editeur")
    
    await conn.execute(`${sqlInsrtPartConv} ${placeholdersParticipants.join(',')}`, valeursParticipants)  

    await conn.commit()

    if(participantsIdsPrives.length > 0){
      const idsParticipant = participantsIdsPrives.map((p)=>p.id)
      const [resPushToken] = await conn.query(sqlSlctPushTkns, [idsParticipant]);
      resPushToken.forEach((r)=>{
        envoyerNotification(
          conn, 
          r.push_token,
          'messages',
          "groupe conversationnel",
          `${pseudoCreateur} vous invite à converser`,
          idCreateur,
          r.id,
          {
            screen: "conversation",
            params:{
              conversationId: idConversation,
            },
            titre: titre
          },
          null
          ) 
      });
    }    

    return res.status(201).json({
      message: "nouvelle conversation créée; que les idées circulent librement!",
      conversation_id: idConversation
    });
    
  } catch (error) {
    await conn.rollback()
    console.error("Erreur inattendue :", error);
    return res
      .status(500)
      .json({
        erreur: error,
        message: "Une erreur au niveau de la base de données est survenue",
      });
  }finally{
    conn.release()
  }
});

// Créer un nouveau message
router.post("/:id_conversation/messages", authentifierToken, verifierAccesConversation, async (req, res) => {
  const { id_conversation, message, temps_envoi } = req.body;
  const id_auteur = req.membre.id;
  console.log('body', id_conversation, message, temps_envoi)
  const conn = await pool.getConnection()
  
  try {
    await conn.beginTransaction()
    const idPubliqueMessTexte = await generateIdWithQueue(10, true, true,'T', 'messages_texte')
    const [idPriveConv] = await conn.query('SELECT id FROM conversations WHERE id_publique = ?', [id_conversation])
    
    const [insertMessage] = await conn.query(
      "INSERT INTO messages_texte (id_conversation, id_auteur, id_publique, message, temps_envoi) VALUES (?, ?, ?, ?, ?)",
      [idPriveConv[0].id, id_auteur, idPubliqueMessTexte, message, temps_envoi]
    );

    const [responseParticipantsConversation] = await conn.query(
      `SELECT push_token, m.id, m.pseudo, c.titre
       FROM membres m
       INNER JOIN participants_conversations pc ON m.id = pc.id_membre
       INNER JOIN conversations c ON pc.id_conversation = c.id
       WHERE c.id = ?`,
      [idPriveConv[0].id]
    );

    const [resultPseudoAuteur] = await conn.query(
      "SELECT pseudo FROM membres WHERE id = ?",
      [id_auteur]
    );
    const pseudoAuteur = resultPseudoAuteur[0]?.pseudo || "quelqu'un";
    
    const participantsMap = [];
    
    responseParticipantsConversation.forEach(ligne => {
      if (!ligne.pseudo) return;
      participantsMap.push({ id: ligne.id, pseudo: ligne.pseudo });
    });

    const titre =
      (responseParticipantsConversation[0]?.titre?.trim()) ||
      participantsMap.filter(p => p.id !== id_auteur).map(p => p.pseudo).join(", ") ||
      "toi";
    
    for (const ligne of responseParticipantsConversation) {
      if (ligne.id == id_auteur) continue;

      const token = ligne.push_token
      const message = {
        to: token,
        sound: 'default',
        title: titre,
        body: corps,
        data: JSON.stringify(data),        
      }

      if(token != null && token.includes('ExponentPushToken')){            
        axios.post('https://exp.host/--/api/v2/push/send', message, {
            headers: {'Content-Type': 'application/json'},
        })
        .then(res => console.log("notification envoyée: ", res.data))
        .catch(e => {
          console.log("erreur d'envoie de la notification:", e)
          throw Error("erreur d'envoie de la notification:", e)
        })        
      }else{
        console.log("push token du destinataire indsponible", message)
        throw Error("push token du destinataire indsponible")
      }    
    }

    await conn.commit()
    return res.status(201).send();
  } catch (err) {
    await conn.rollback()
    return res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: err,
    });
  }finally{
    conn.release()
  }
});

// Modifier un message existant
router.patch("/:id_conversation/messages/:idmessage_publique", authentifierToken, verifierAccesConversation, async (req, res) => {
  const idMessagePublique = req.params.idmessage_publique;
  const updates = req.body;
  const idMembre = req.membre.id;
  const champsAutorises = ['message', 'statut']
  const updatesFiltrees = Object.fromEntries(
    Object.entries(updates).filter(([key]) => champsAutorises.includes(key))
  );
  try {
    if (Object.keys(updatesFiltrees).length === 0) {
      return res.status(400).json({ message: "Aucun champ à mettre à jour" });
    }

    const [auteur] = await pool.query(
      "SELECT id_auteur FROM messages_texte WHERE id_publique = ?",
      [idMessagePublique]
    );

    if (auteur[0].id_auteur !== idMembre) {
      res
        .status(401)
        .json({ message: "Vous n'êtes pas l'auteur de ce message" });
    }

    const fields = Object.keys(updatesFiltrees).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updatesFiltrees), idMessagePublique]

    const [resultat] = await pool.query(
      `UPDATE messages_texte SET ${fields} WHERE id_publique = ?`,
      values
    );
    if (resultat.affectedRows === 0)
      return res.status(404).json({ message: "Message non trouvé" });

    res.status(200).json({ message: "Message mis à jour avec succès", mises_a_jours: updatesFiltrees});
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: {
        message: err.message,
        sql: err.sql,
      },
    });
  }
});

// Supprimer un message
router.delete("/:id_conversation/messages/:idmessage_publique", authentifierToken, verifierAccesConversation, async (req, res) => {
  const idMessage = req.params.idmessage_publique;
  const idMembre = req.membre.id;

  try {
    const [message] = await pool.query(
      "SELECT id_auteur FROM messages_texte WHERE id = ?",
      [idMessage]
    );

    if (message.id_auteur !== idMembre) {
      res.status(401).json[
        { message: "Vous n'êtes pas l'auteur de ce message" }
      ];
    }

    const [result] = await pool.query(
      "DELETE FROM messages_texte WHERE id = ?",
      [idMessage]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Message non trouvé" });

    res.status(204).send();
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: {
        message: err.message,
        sql: err.sql,
      },
    });
  }
});

// Récupérer tous les messages d'une conversation avec limite et offset
router.get("/:id_conversation/messages/historique", authentifierToken, verifierAccesConversation, async (req, res) => {
  const limite = 25
  const page = parseInt(req.query.offset) || 0;
  const offset = page*limite
  const idPriveConv = req.id_prive_conversation;
  const idMembre = req.membre.id
  const fuseauHoraire = req.query.fuseau_horaire

  try {
    // Récupérer les messages pour cette conversation
    const sqlMessages = `
       SELECT 
        c.serial_number,
        m.id AS id_prive,
        m.id_publique as id_publique,
        m.message,
        m.id_auteur as auteur_id_prive,
        m_auteur.id_publique as auteur_id_publique,
        m.temps_envoi,
        ml.id_membre AS lecteur_id_prive,
        m_lecteur.id_publique as lecteur_id_publique,
        m_lecteur.pseudo AS lecteur_pseudo

      FROM messages_texte m

      INNER JOIN conversations c
        ON c.id = m.id_conversation
      
      INNER JOIN membres m_auteur
        ON m.id_auteur = m_auteur.id

      LEFT JOIN messages_texte_lus ml 
          ON ml.id_message = m.id

      LEFT JOIN membres m_lecteur 
        ON m_lecteur.id = ml.id_membre

      WHERE m.id_conversation = ?

      ORDER BY m.temps_envoi ASC
      LIMIT ? OFFSET ?;
    `;
    const [resultats] = await pool.query(sqlMessages, [idPriveConv, limite, offset]);    

    if (resultats.length === 0) {
      return res.status(200).json({ serial_number: resultats[0].serial_number, messages: [] });
    }

    const idsNonLus = resultats
      .filter(m => !m.lecteur_id_prive || m.lecteur_id_prive !== idMembre)
      .map(m => m.id_prive);

    if(idsNonLus.length > 0){
      let placeholdersMessLus = []
      let valuesMessLus = []
      const nowUtcSql = DateTime.now().toUTC().toSQL({includeOffset:false, includeZone:false})
      idsNonLus.forEach((idNonLu)=>{
        placeholdersMessLus.push("(?, ?, ?)")
        valuesMessLus.push(idMembre, idNonLu, nowUtcSql)
      })
      const insrtMessLus = `INSERT INTO messages_texte_lus (id_membre, id_message, lu_a) VALUES ${placeholdersMessLus.join(',')}`
      await pool.query(insrtMessLus, valuesMessLus)
    }

    const reponse = formaterMessages(resultats, fuseauHoraire, idMembre)

    return res.status(200).json({  serial_number:resultats[0].serial_number, messages: reponse });
  } catch (err) {
    console.log("erreur:", err)
    return res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: err
    });
  }
});

// Récupérer tous les messages d'une conversation après dernier_timestamp
router.get("/:id_conversation/messages/nouveaux", authentifierToken, verifierAccesConversation, async (req, res) => {
  const limite = 25
  const page = parseInt(req.query.offset) || 0;
  const offset = page*limite
  const idPriveConv = req.id_prive_conversation;
  const dernierTimestamp = req.query.dernier_timestamp || DateTime.now().toUTC().toSQL({includeOffset:false, includeZone:false})
  const idMembre = req.membre.id
  const fuseauHoraire = req.query.fuseau_horaire
  const clientSerial = parseInt(req.query.serial_number)

  try {
    const sqlSerial = `
      SELECT serial_number FROM conversations WHERE id = ?  `

    const [rSerial] = await pool.query(sqlSerial, [idPriveConv])

    if(!rSerial.length) return res.status(404).json({message:"conversation introuvable"})

    const serverSerial = rSerial[0].serial_number

    if(serverSerial == clientSerial) return res.status(200).json({serial_number:serverSerial, messages:[]})
    
    // Récupérer les messages pour cette conversation
    const sqlMessages = `
      SELECT 
        m.id AS id_prive,
        m.id_publique as id_publique,
        m.message,
        m.id_auteur as auteur_id_prive,
        m_auteur.id_publique as auteur_id_publique,
        m.temps_envoi,
        ml.id_membre AS lecteur_id_prive,
        m_lecteur.id_publique as lecteur_id_publique,
        m_lecteur.pseudo AS lecteur_pseudo

      FROM messages_texte m

      INNER JOIN membres m_auteur
        ON m.id_auteur = m_auteur.id

      LEFT JOIN messages_texte_lus ml 
          ON ml.id_message = m.id
        AND ml.lu_a > ?  -- delta de lecture

      LEFT JOIN membres m_lecteur 
        ON m_lecteur.id = ml.id_membre

      WHERE m.id_conversation = ?
        AND m.temps_envoi > ?   -- messages nouveaux depuis lastFetch

      ORDER BY m.temps_envoi ASC; 
    `;
    const [resultats] = await pool.query(sqlMessages, [dernierTimestamp, idPriveConv, dernierTimestamp]);

    if (resultats.length === 0) {
      return res.status(200).json({ serial_number:serverSerial, messages: [] });
    }

    const idsNonLus = resultats
      .filter(m => !m.lecteur_id_prive)
      .map(m => m.id_prive);

    if(idsNonLus.length > 0){
      let placeholdersMessLus = []
      let valuesMessLus = []
      const nowUtcSql = DateTime.now().toUTC().toSQL({includeOffset:false, includeZone:false})
      idsNonLus.forEach((idNonLu)=>{
        placeholdersMessLus.push("(?, ?, ?)")
        valuesMessLus.push(idMembre, idNonLu, nowUtcSql)
      })
      const insrtMessLus = `INSERT INTO messages_texte_lus (id_membre, id_message, lu_a) VALUES ${placeholdersMessLus.join(',')}`
      await pool.query(insrtMessLus, valuesMessLus)
    }

    const reponse = formaterMessages(resultats, fuseauHoraire)
    return res.status(200).json({ serial_number:serverSerial, messages: reponse });

  } catch (err) {
    console.log("erreur:", err)
    return res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: err
    });
  }
});

//marquer lu les messages non-lus d'une conversation
router.post("/:id_conversation/marquer_lu",authentifierToken, verifierAccesConversation, async(req,res,next)=>{
  const dernierTimestamp = req.query.dernier_timestamp
  const idReceveur = req.membre.id

  try {
    const sqlMessages = "SELECT id, temps_envoi FROM messages_texte WHERE temps_envoi < ? AND id_auteur != ? AND statut = 'non_lu'"

    const [rMessages] = await pool.query(sqlMessages, [dernierTimestamp, idReceveur])

    const messagesNonLusBrute = rMessages.map(m=> ({      
        id_message: m.id,
        lu_a:m.temps_envoi
    }))
    const messagesNonLus = messagesNonLusBrute.filter(v => v != undefined)

    const placeholders = messagesNonLus.map(m=>'(?, ?, ?)').join(',')
    const values = messagesNonLus

    const sqlSetLu = "INSERT INTO messages_texte_lus(id_message, id_membre, lu_a) VALUES "
    if(messagesNonLus.length > 0)
      await pool.query(sqlSetLu, [messagesNonLus])
  } catch (error) {
    return res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: err
    });
  }
})

//modifier les paramètres d'une conversation
router.patch("/:id_conversation", authentifierToken, verifierAccesConversation, async (req, res) => {
    const idMembre = req.membre.id;
    const idConversation = req.params.id_conversation;

    const champs = [];
    const valeurs = [];

    if (req.body.titre != undefined) {
      champs.push("titre = ?");
      valeurs.push(req.body.titre);
    }
    if (req.body.couverture_url != undefined) {
      champs.push("couverture_url = ?");
      valeurs.push(req.body.couverture_url);
    }

    try {
      await pool.query(
        `UPDATE conversations SET ${champs.join(
          ", "
        )} WHERE id_conversation = ?`,
        [valeurs, idConversation]
      );
      const [rows] = await pool.query(
        "SELECT * FROM conversations WHERE id = ?",
        [idConversation]
      );
      return res.status(204);
    } catch (error) {
      return res.status(500).json({
        erreur: error.message,
        message: "une erreur au niveau de la base de données est survenue",
      });
    }
  }
);

//supprimer une conversation
router.delete("/:id_conversation", authentifierToken, verifierAccesConversation, async (req, res, next)=>{
  const idConversation = req.params.id_conversation

  try {
    await pool.query('DELETE FROM conversations WHERE id_publique = ?', idConversation)
    res.status(200).json({
      message:"conversation supprimée"
    })
  } catch (error) {
    console.log('DELETE conv:', error)
    res.status(500).json({
      message:"une erreur au niveau de la base de données est survenue",
      erreur:error
    })
  }
})

//ajouter un participant
router.post( "/:id_conversation/participants", authentifierToken, verifierAccesConversation, verifierAmitieParticipants, async (req, res) => {
    const idConversation = req.params.id_conversation;
    const nouvParticipants = req.participantsIdsPrives; //[]
    const valeursParticipants = nouvParticipants.map((p) => [
      idConversation,
      p.id,
      p.privilege,
    ]);
    const sql =
      "INSERT INTO participants_conversations (id_conversation, id_membre, role) VALUES ?";
    try {
      await pool.query(sql, [valeursParticipants]);
      return res
        .status(201)
        .json({
          message: "de nouveaux participants prennent part à la conversation!",
        });
    } catch (error) {}
  }
);

// Rechercher des messages par contenu
router.get("/search", async (req, res) => {
  const { query } = req.query; // Requête à rechercher
  const limite = parseInt(req.query.limite, 10) || 10;
  const offset = parseInt(req.query.offset, 10) || 0;

  try {
    const sqlSearch = `
        SELECT * FROM messages_texte
        WHERE message LIKE ? 
        LIMIT ? OFFSET ?
      `;
    const [resultats] = await pool.query(sqlSearch, [
      `%${query}%`,
      limite,
      offset,
    ]);

    res.status(200).json(resultats);
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de données est survenue",
      erreur: {
        message: err.message,
        sql: err.sql,
      },
    });
  }
});

module.exports = router;
