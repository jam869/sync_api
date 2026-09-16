//paquets npm
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const fs = require('fs')
const path = require('path')

//fonctions
const { generateSalt, hash, compare } = require("../functions/pass");
const { generateIdWithQueue } = require("../functions/idGen");
require("dotenv").config();
const { authentifierToken } = require("../functions/authenticate");
const verifierPseudo = require("../functions/verifierPseudo");
const {upload, uploadDir} = require('../functions/upload')

//PDO
let { pool } = require("../PDO");
const { formaterDateVersClient } = require("../functions/formaterDateVersClient");
const { DateTime } = require("luxon");
const envoyerEmail = require("../functions/envoyerEmail");
const sendConfirmationMail = require("../functions/sendConfirmationMail");
const hashToken = require("../functions/tokens");

const CHAMPS_MODIFIABLES = ['pseudo', 'nom', 'prenom', 'bio', 'mot_de_passe'];

function filtrerChampsAutorises(body) {
  const filtres = {};
  for (const cle of Object.keys(body)) {
    if (CHAMPS_MODIFIABLES.includes(cle)) filtres[cle] = body[cle];
  }
  return filtres;
}

router.post("/connexion", async (req, res, next) => {
  const mdp = req.body.mot_de_passe;
  const {pseudo} = req.body

  let sqlMdp = `
    SELECT mot_de_passe  
      FROM membres m
      WHERE m.id = ?
  `;
  let sqlPseudo = `
    SELECT id_publique, id, role FROM membres WHERE pseudo = ?
  `;
  
  console.log(pseudo)

  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const [resultatPseudo] = await conn.query(sqlPseudo, [pseudo]);
    if (resultatPseudo.length < 1){
      console.log('pseudo < 1')
      return res.status(403).json({ message: "Authentification échouée" });
    }

    const idMembre = resultatPseudo[0].id;
    const idPublique = resultatPseudo[0].id_publique;
    const estAdmin = resultatPseudo[0].role == 'admin'

    const [resultatMdp] = await conn.query(sqlMdp, [idMembre]);

    const valide = await compare(mdp, resultatMdp[0].mot_de_passe)

    if (!valide){
      console.log('mdp invalide')
      return res.status(403).json({ message: "Authentification échouée" });
    }

    const accessPayload = {
      id: idMembre,
      id_publique:idPublique,
      pseudo:pseudo,
      est_admin:estAdmin,
      type:'access'
    };

    const accessToken = jwt.sign(accessPayload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: "1H",
    });

    const refreshPayload = {id: idMembre, pseudo:pseudo, est_admin:estAdmin, type:'refresh'}
    const refreshToken = jwt.sign(refreshPayload, process.env.REFRESH_TOKEN_SECRET, {expiresIn:'30D'}) 

    const refreshTokenHashed = hashToken(refreshToken)

    await conn.execute('DELETE FROM tokens_rafraichissement WHERE id_membre = ? ', [idMembre]);

    const [insertRefTokRows] = await conn.execute('INSERT INTO tokens_rafraichissement (id_membre, token) VALUES (?, ?)', [idMembre, refreshTokenHashed]);
    if(insertRefTokRows.affectedRows === 0){
      throw Error("impossible de connecter le membre")
    }

    await conn.commit()

    //TODO: avoir un state logged in pour admin
    return res.status(200).json({
      cacheable: true,
      access_token: accessToken,
      refresh_token:refreshToken,
      timestamp_serveur: Date.now(),
      membre: {
        pseudo: pseudo,
        id_publique: idPublique,
      },
    });

  } catch (err) {
    await conn.rollback()
    console.log("connexion erreur", err)
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  } finally {
    conn.release()
  }
});

router.post("/inscription", verifierPseudo, async (req, res, next) => {
  const {pseudo, mot_de_passe, courriel, fuseau_horaire} = req.body
  console.log(pseudo, courriel, fuseau_horaire)

  if(!pseudo || !mot_de_passe || !courriel || !fuseau_horaire){
    return res.status(500).json({
      message:"Champs manquants"
    })
  }
  const conn = await pool.getConnection()

  try{
    await conn.beginTransaction()

    let idPublique = await generateIdWithQueue(
      8,
      false,
      true,
      "M" + pseudo.substring(0, 3),
      'membres'
    );
    let mdpHash = await hash(mot_de_passe);
    let temps_creation = DateTime.now().toUTC().toFormat('yyyy-MM-dd HH:mm:ss');

    // Sauvegarde du membre
    var sql = "INSERT INTO membres (id_publique, pseudo, mot_de_passe, courriel, temps_creation, fuseau_horaire) VALUES (?, ?, ?, ?, ?, ?)";
    const [resInsertMembre] = await conn.query(sql, [
        idPublique,
        pseudo,
        mdpHash,
        courriel,
        temps_creation,
        fuseau_horaire,
      ]
    );

    const membreInsertId = resInsertMembre.insertId   
    
    //envoi du mail de confirmation
    await sendConfirmationMail(courriel, pseudo, membreInsertId)
    
    await conn.commit()

    return res.status(201).json({
      message: "Membre créé",
    });
  } catch (err) {

    await conn.rollback()

    console.log(err)
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  } finally{
    conn.release()
  }
});

router.post('/deconnexion', authentifierToken, async(req, res, next)=>{
  idMembre = req.membre.id
  console.log('deconnexion idmembre', idMembre)
  //id_appareil = req.body.id_appareil?req.body.id_appareil:undefined
  const sql = `UPDATE tokens_rafraichissement SET blacklist = TRUE WHERE id_membre = ?`
  try {
    await pool.execute(sql,[idMembre])
    res.status(201).json({message:'déconnecté avec succès'})
  } catch (error) {
    res.status(500).json({erreur:error, message:'un problème est survenu au niveau de la base de données'})
  }
})

router.get("/", authentifierToken, async (req, res) => {
  const id = req.membre.id;
  var sql = `SELECT m.id_publique, m.pseudo, m.bio, m.courriel, i.url, m.temps_creation, m.role, m.email_confirme 
    FROM membres m 
      LEFT JOIN medias i ON i.id = m.id_fp 
    WHERE m.id = ?`;
  try {
    const [resultat] = await pool.query(sql, [id]);

    if (resultat.length < 1) {
      return res.status(404).json({
        message: `Rien n'a été trouvé avec le id: ${id}`,
      });
    }

    const r = resultat[0];
    return res.status(200).json({
      id_publique: r.id_publique,
      pseudo: r.pseudo,
      bio:r.bio,
      courriel: r.courriel,
      fp_url: r.url ?? null,
      temps_creation: formaterDateVersClient(r.temps_creation),
      role:r.role,
      email_confirme: r.email_confirme==1
    });
  } catch (err) {
    console.error(err)
    return res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});

router.get("/fuseau_horaire", authentifierToken, async (req, res) => {
  const idMembre = req.membre.id;
  try {
    const [resultats] = await pool.query(
      `SELECT fuseau_horaire FROM membres WHERE id = ?`,
      [idMembre]
    );

    if (resultats.length === 0) {
      return res
        .status(404)
        .json({ message: `membre introuvable avec le id ${idMembre}` });
    }

    return res
      .status(200)
      .json({ fuseau_horaire: resultats[0].fuseau_horaire });
  } catch (err) {
    console.error("/fuseau_horaire", err.message);
    return res.status(500).json({ erreur: err, message: err.message });
  }
});
// PUT /fuseau_horaire → modifier le timezone du membre
router.put("/fuseau_horaire", authentifierToken, async (req, res) => {
  const membreId = req.membre.id;
  const { fuseau_horaire } = req.body;

  if (!fuseau_horaire) {
    return res.status(400).json({ erreur: "Fuseau horaire requis" });
  }

  try {
    await pool.query("UPDATE membres SET fuseau_horaire = ? WHERE id = ?", [
      fuseau_horaire,
      membreId,
    ]);

    res.status(201).json({ message: "Fuseau horaire mis à jour avec succès" });
  } catch (erreur) {
    console.error(erreur);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

router.get("/:idmembre_publique", authentifierToken, async (req, res) => {
  try {
    const idMembrePublique = req.params.idmembre_publique;

    // Vérification que l'ID est fourni
    if (!idMembrePublique) {
      return res.status(400).json({ message: "ID du membre manquant" });
    }

    // Requête SQL pour récupérer les infos du membre
    const sql =
      "SELECT pseudo, i.url as fp_url, temps_creation, fuseau_horaire FROM membres m JOIN images i ON m.id_fp = i.id  WHERE id_publique = ?";
    const [resultat] = await pool.query(sql, [idMembrePublique]);

    if (resultat.length === 0) {
      return res
        .status(404)
        .json({ message: `rien a été trouvé avec le id ${idMembrePublique}` });
    }

    const membre = resultat[0];

    // Réponse avec les données trouvées
    res.status(200).json({
      id_publique: idMembrePublique,
      pseudo: membre.pseudo,
      fp_url:membre.fp_url ?? null,
      bio: membre.bio,
      widgets: [],
      temps_creation: formaterDateVersClient(membre.temps_creation),
      fuseau_horaire: membre.fuseau_horaire,
    });
    
  } catch (err) {
    res.status(500).json({
      message: "Une erreur est survenue lors de la récupération du membre",
      erreur: err.message,
    });
  }
});

router.patch('/profil',
authentifierToken,      
verifierPseudo,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  },
  async (req, res) => {
    const idMembre = req.membre.id;
    const updates = filtrerChampsAutorises({ ...req.body });

    const conn = await pool.getConnection();
    let ancienChemin = null;

    try {
      await conn.beginTransaction();

      // Pass
      if (updates.mot_de_passe) {
        const hashedPass = await hash(updates.mot_de_passe);
        updates.mot_de_passe = mdpHash; //Ajout dans les updates
      }

      // Image
      // Delete l'ancienne image lié au membre et upload la nouvelle
      if (req.file) {
        const [rows] = await conn.query(`
          SELECT i.id, i.url FROM images i
          INNER JOIN membres m ON m.id_fp = i.id
          WHERE m.id = ?
        `, [idMembre]);

        let diff = req.file.size;
        const ancIdImage = rows[0]?.id;
        const ancUrl = rows[0]?.url;

        if (ancUrl) {          
          const nomFichier = ancUrl.substring(ancUrl.lastIndexOf('/') + 1);
          
          ancienChemin = `${uploadDir}\\${nomFichier}`;
          console.log("ancien chemin", ancienChemin)
          if (fs.existsSync(ancienChemin)) {
            console.log("une ancienne image existe")
            diff -= fs.statSync(ancienChemin).size;            
          }
          await conn.query(`DELETE FROM images WHERE id = ?`, [ancIdImage]); //Delete de l'image niveau BD
        }

        const newId = await generateIdWithQueue(10, true, true, 'I');
        const newUrl = `/img/${req.file.filename}`;
        await conn.query(`INSERT INTO images (id, url) VALUES (?, ?)`, [newId, newUrl]); //Ajout niveau BD de la nouvelle image

        // Met a jour le stockage utilise en ajoutant la difference entre lancienne et la nouvelle image
        // Pour une future facturation de l'espage de stockage utilise
        await conn.query(`UPDATE membres SET stockage_utilise = stockage_utilise + ? WHERE id = ?`, [diff, idMembre]);
        updates.id_fp = newId; //Ajout dans les updates 
      }

      //Aucunes updates a faire
      if (Object.keys(updates).length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: "Aucun champ valide à mettre à jour" });
      }
      //Final MAJ
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const values = [...Object.values(updates), idMembre];
      const [result] = await conn.query(`UPDATE membres SET ${fields} WHERE id = ?`, values); //Updates centralisés dans une transaction BD (optimal)

      if (result.affectedRows === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: "Membre introuvable" });
      }

      await conn.commit();      

      // Suppression de limage physique SEULEMENT après commit réussi
      if (ancienChemin && fs.existsSync(ancienChemin)) {
        await fs.promises.unlink(ancienChemin);
      }

      conn.release();

      return res.status(200).json({
        message: "Membre mis à jour",
        mises_à_jours: updates
      });
    } catch (err) {
      await conn.rollback();
      conn.release();
      console.error(err);
      return res.status(500).json({ message: "Erreur serveur lors de la mise à jour du membre" });
    }
  }
);

router.delete("/profil", async (req, res) => {
  const id = req.params.idmembre_publique;
  var sql = "DELETE FROM membres WHERE id_publique = ?";

  try {
    await pool.query(sql, [id]);
    res.status(200).json({
      message: "Membre supprimé",
    });
  } catch (err) {
    res.status(500).json({
      message: "Une erreur au niveau de la base de donnée est survenue",
      erreur: err.message,
    });
  }
});
//recuperation du mdp
router.post('/mot_de_passe', async(req, res, next)=>{
  const {token, mdp, mdp_conf} = req.body

  if(mdp != mdp_conf){
    return res.status(400).json({
      message: "les mots de passe ne correspondent pas"
    });
  }

  const sqlIdMembre = "SELECT id_membre FROM tokens_recuperation WHERE token = ?"
  const sqlInvalideTkn = "UPDATE tokens_recuperation SET utilise = 1 WHERE token = ?"
  const sqlUpdateSalt = "UPDATE mot_de_passes SET salt = ? WHERE id_membre = ?"
  const sqlUpdateMdp = "UPDATE membres SET mot_de_passe = ? WHERE id = ?"
  const succesHtml = path.join(__dirname, "..","..", "views", "reinitialisation_succes.html")
  const erreurHtml = path.join(__dirname, "..","..", "views", "reinitialisation_erreur.html")
  const conn = await pool.getConnection()
  try {    
    await conn.beginTransaction()

    let salt = generateSalt(14);
    let { hashedPass: mdpHash } = hash(mdp, salt);
    const [rIdMembre] = await conn.execute(sqlIdMembre, [token])
    const id = rIdMembre[0].id_membre
    await conn.execute(sqlUpdateSalt, [salt, id])
    await conn.execute(sqlUpdateMdp, [mdpHash, id])
    await conn.execute(sqlInvalideTkn, [token])

    await conn.commit()
    
    return res.status(201).sendFile(succesHtml)
  } catch (error) {
    await conn.rollback()
    console.log(DateTime.now(), error)
    return res.status(500).sendFile(erreurHtml)
  }finally{
    conn.release()
  }
})

module.exports = router;
