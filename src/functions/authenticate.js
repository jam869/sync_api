const { response } = require('express')
const jwt = require('jsonwebtoken')
const {pool} = require('../PDO')
const path = require('path')
const hashToken = require('./tokens')
require('dotenv').config()
const {accessTokenSecret, refreshTokenSecret, emailConfSecret} = require('../config/env')

/**
 * @returns req.membre  {id:'privé', pseudo:...}
 */
function authentifierToken(req, res, next){
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if(!token) return res.status(401).json({ message: 'Un token est necéssaire'})
    
    jwt.verify(token, accessTokenSecret, (err, payload) => {
        if(err){
          console.log('erreur authentifier acc. token', err.message)
          return res.status(401).json({
          erreur:err,
          message: 'Votre token n\'est plus valide'})
        }
        
        req.membre = payload
        next()
    })
}

async function authentifierRefreshToken(req, res, next){
    const { refresh_token } = req.body
    if(!refresh_token) return res.status(401).json({ message: 'Refresh token requis' })
    
      const refreshTokenHashed = hashToken(refresh_token)

    jwt.verify(refresh_token, refreshTokenSecret, async (err, payload) => {
        if(err) return res.status(401).json({ message: 'Refresh token invalide' })

        const sqlVerif = `
          SELECT blacklist FROM tokens_rafraichissement WHERE id_membre = ?
        ` 
        const [verifRows] = await pool.query(sqlVerif, [payload.id])

        if(verifRows.length && verifRows.blacklist === 1){
          return res.status(401).json({message:"refresh token révoqué"})
        }

        req.payload = payload
        req.refreshTokenHashed = refreshTokenHashed
        next()
    })
}

// Middleware pour vérifier que l'utilisateur a accès à la conversation
async function verifierAccesConversation(req, res, next) {
    const membreId = req.membre.id; // ID du membre récupéré via authentifierToken()
    const { id_conversation } = req.params;
  
    try {
      const [reponseIdConv] = await pool.query('SELECT id FROM conversations WHERE id_publique = ?', [id_conversation])
      const sqlParticipants = `
        SELECT pc.id_membre
        FROM participants_conversations pc
        WHERE pc.id_conversation = ?
      `;
  
      const [resultats] = await pool.query(sqlParticipants, [reponseIdConv[0].id]);
      const idMembres = resultats.map((row) => row.id_membre);
      
      // Vérification si l'ID du membre fait partie des participants
      if (idMembres.includes(membreId)) {
        req.id_prive_conversation = reponseIdConv[0].id
        next();  // Le membre a accès à la conversation, on passe au middleware suivant
      } else {
        return res.status(403).json({ message: "Accès refusé à cette conversation" });
      }
    } catch (err) {
      res.status(500).json({
        message: 'Une erreur au niveau de la base de données est survenue',
        erreur: {
          message: err.message,
          sql: err.sql,
        },
      });
    }
}
/**
 * Vérifie l'accès d'un membre à un évènement
 * @param {*} req a besoin de req.membre.id et req.params.idevenement 
 * @param {*} res 
 * @param {*} next 
 * @returns req.accesEvenement {privilege, prive}
 */
async function verifierAccesEvenement(req, res, next) {
  const membreId = req.membre.id;
  const idEvenement = req.params.idevenement;
  //console.log('verifier acces evenement membreId', membreId, 'id evenement', idEvenement)
  try {
    const [resultats] = await pool.query(`
      SELECT
        e.createur_id,
        CASE
          WHEN e.createur_id = ? THEN 'editeur'
          WHEN pe.id_membre IS NOT NULL THEN pe.privilege
          WHEN ie.id_invite IS NOT NULL THEN 'lecteur'
          ELSE 'visiteur'
        END AS privilege,
        e.prive
      FROM evenements e
      LEFT JOIN participants_evenements pe
        ON pe.id_evenement = e.id AND pe.id_membre = ?
      LEFT JOIN invitations_evenement ie
        ON ie.id_evenement = e.id AND ie.id_invite = ?
      LEFT JOIN evenements_exceptions ex
        ON ex.id_parent = e.id
      WHERE (e.id_publique = ? OR ex.id_publique = ?)
      LIMIT 1;
    `, [membreId, membreId, membreId, idEvenement, idEvenement]);
    console.log('verifier acces evenement', resultats[0])

    const resultat = resultats[0];

    if (!resultat || resultat.privilege === 'aucun' || (resultat.prive == 1 && resultat.privilege === 'visiteur')) {
      return res.status(403).json({
          message: 'Accès à l’évènement refusé'
      });
    }

    // injection des infos
    req.accesEvenement = {
      privilege: resultat.privilege,
      prive: resultat.prive == 1
    };
    next();

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Erreur lors de la vérification des privilèges'
    });
  }
}

/**
 * Vérifie l'accès d'un membre à une exception de reccurences d'évènements
 * @param {*} req a besoin de req.membre.id et req.params.idevenement comme idParent
 * @param {*} res 
 * @param {*} next 
 * @returns req.accesEvenement {privilege: "lecteur" | "editeur"}
 */
async function verifierAccesException(req, res, next) {
  const membreId = req.membre.id;
  const idParent = req.params.idevenement;
  //console.log('verifier acces evenement membreId', membreId, 'id evenement', idEvenement)
  try {
    const [resultats] = await pool.query(`
      SELECT
        e.createur_id,
        CASE
          WHEN e.createur_id = ? THEN 'editeur'
          WHEN pe.id_membre IS NOT NULL THEN pe.privilege
          WHEN ie.id_invite IS NOT NULL THEN 'lecteur'
          ELSE 'aucun'
        END AS privilege
      FROM evenements e
      LEFT JOIN participants_evenements pe
        ON pe.id_evenement = e.id AND pe.id_membre = ?
      LEFT JOIN invitations_evenement ie
        ON ie.id_evenement = e.id AND ie.id_invite = ?
      WHERE e.id_parent = ?
      LIMIT 1;
    `, [membreId, membreId, membreId, idParent]);
    console.log('verifier acces evenement', resultats[0])
    if (resultats.length === 0 || resultats[0].privilege === 'aucun') {
      return res.status(403).json({
        message: 'Accès à l’évènement refusé'
      });
    }

    // on injecte les privilèges directement
    req.accesEvenement = {
      privilege: resultats[0].privilege
    };

    next();

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Erreur lors de la vérification des privilèges'
    });
  }
}

function authentifierConfirmationToken(req, res, next){
  const erreurHtml = path.join(__dirname, "..", "views", "confirmation_erreur.ejs")
    
  let token = req.query.token || req.body.token

  if(!token) return res.status(401).render(erreurHtml, { error: 'Un token est necéssaire'})   

  jwt.verify(token, emailConfSecret, (err, payload) => {
      if(err){
        console.error('erreur authentifier acc. token', err.message, token)
        let errorMessage = 'La demande est invalide.'
        if (err.name === 'TokenExpiredError')
          errorMessage = "Le temps pour confirmer est écoulé. Vous aviez 1h."        

        return res.status(401).render(erreurHtml, {
          error: errorMessage
        })
      }else if(payload.type !== "email_confirmation"){
          res.status(403).render(erreurHtml, {
            error: "Vous n'avez pas le droit d'être ici."
          })
      }  

      req.token = {
        ...payload,
        token: token
      }
      next()
  })
}
/**
 * Prend un array de participants [{id:..., privilege:...}, ...] 
 * et vérifie si chaque participants sont amis avec le membre connecté
 * 
 * Privilege est soit 'lecteur' | 'editeur'
 * 
 * return req.participantsIdsPrives  [ { id:..., privilege:... }, ... ]
 */
async function  verifierAmitieParticipants(req, res, next) {
  const idCreateur = req.membre.id;
  const { participants } = req.body;
  req.participantsIdsPrives = []

  //Validation du array
  if (!Array.isArray(participants)) {
    return res.status(400).json({
      message: "La liste des participants est invalide ou vide.",
    });
  }

  if (participants.length > 20) {
    return res.status(403).json({ message: "limite de 20 invitations" });
  }

  const idsPubliques = [];

  for (const p of participants) {
    if (!p.id || !p.privilege) {
      return res.status(400).json({
        message: "Chaque participant doit contenir un id et un privilege.",
      });
    }

    if (p.privilege !== "lecteur" && p.privilege !== "editeur") {
      return res.status(400).json({
        message:
          "Tous les participants doivent avoir comme privilege lecteur ou editeur.",
      });
    }

    idsPubliques.push(p.id);
  }

  //Verification des doublons
  if (new Set(idsPubliques).size !== idsPubliques.length) {
    return res.status(400).json({
      message: "La liste de participants contient des doublons.",
    });
  }
  
  try {
    if(participants.length>0){
      const placeholders = participants.map((p)=>"(?)").join(",")
      //Mapping public → privé
      const [rowsMembres] = await pool.execute(
        `SELECT id, id_publique FROM membres WHERE id_publique IN (${placeholders})`,
        idsPubliques
      );

      if (rowsMembres.length !== participants.length) {
        return res.status(400).json({
          message: `Un ou plusieurs participants sont invalides: ${rowsMembres.length}, ${idsPubliques.length}`,
        });
      }

      const mapIdsPublicVersPrives = {};
      const participantsIdsPrives = [];

      for (const r of rowsMembres) {
        if (r.id === idCreateur) {
          return res.status(400).json({
            message:
              "Le créateur ne peut pas faire partie des participants invités.",
          });
        }

        mapIdsPublicVersPrives[r.id_publique] = r.id;
        participantsIdsPrives.push(r.id);
      }

      const sqlAmitie = `
        SELECT
          CASE WHEN id_membre_a = ? THEN id_membre_b ELSE id_membre_a END AS id_ami
        FROM amities
        WHERE (id_membre_a = ? AND id_membre_b IN (?))
          OR (id_membre_b = ? AND id_membre_a IN (?))
      `;

      const [rowsAmitie] = await pool.query(sqlAmitie, [
        idCreateur,
        idCreateur, participantsIdsPrives,
        idCreateur, participantsIdsPrives,
      ]);

      if (rowsAmitie.length !== participantsIdsPrives.length) {
        return res.status(404).json({
          message: "tous les invités doivent être des amis du créateur",
        });
      }

      req.participantsIdsPrives = participants.map(p => ({
        id: mapIdsPublicVersPrives[p.id],
        privilege: p.privilege,
      }));
    }
    return next();

  } catch (error) {
    console.error("Erreur verification amitie:", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la vérification des amitiés.",
    });
  }
}

module.exports = {
  authentifierToken,
  authentifierRefreshToken,
  verifierAccesConversation,
  verifierAccesEvenement,
  verifierAccesException,
  authentifierConfirmationToken,
  verifierAmitieParticipants
}