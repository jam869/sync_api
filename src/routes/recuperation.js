const express = require("express");
const router = express.Router();
require("dotenv").config();

const {pool} = require('../PDO')
const crypto =  require("crypto")
const { DateTime } = require("luxon");
const envoyerEmail = require("../functions/envoyerEmail");
const hashToken = require("../functions/tokens");

router.get('/', async(req, res, next)=>{
    const {token} = req.query

    const tokenHashed = hashToken(token)
    console.log("token", token)

    const sql = 'SELECT expiration, utilise, id_membre FROM tokens_recuperation WHERE token = ?'
    const now = DateTime.now().toUTC().toMillis()

    try{
        const [rToken] = await pool.query(sql, [tokenHashed])
        console.log(rToken)

        //vérifier l'integrité du token
        if(rToken.length == 0) return res.status(401).json({message:'lien invalide; il nexiste pas faut croire...'})

        if(rToken[0].utilise == 1) return res.status(401).json({message:'lien utilisé; demandes en un autre...'})

        const exp = DateTime.fromSQL(rToken[0].expiration).toMillis()
        if(now > exp) return res.status(401).json({message:'lien expiré; demandes en un autre...'})

        //si le token est bon
        return res.status(200).render('reinitialisation_mdp', {token})
        
    }catch(error){
        console.log(error)
        return res.status(500).json({
            message: "Une erreur au niveau de la base de donnée est survenue",
            erreur: error,
        });
    }
})

router.post('/demande', async(req, res, next)=>{
    const {courriel} = req.body

    //console.log("courriel", courriel)
    const sqlCourriel = "SELECT id, pseudo FROM membres WHERE courriel = ?"
    const sqlInsrtTkn = "INSERT INTO tokens_recuperation(id_membre, token, expiration) VALUES (?, ?, ?)";
    try {
        const [rCourriel] = await pool.query(sqlCourriel, [courriel])
        //console.log('rCourriel', rCourriel[0])
        const pseudo = rCourriel[0]?.pseudo
        if(pseudo == undefined){
            return res.status(400).json({
                message:"il faut croire que ton courriel n'existe pas..."
            })
        }
        if(rCourriel.length > 0){
            const token = crypto.randomBytes(32).toString('hex')
            
            const exp = DateTime.now()
                .toUTC()
                .plus({ hours: 1 })
                .toFormat('yyyy-MM-dd HH:mm:ss')
            //créer le lien
            const baseURL = process.env.BASE_URL + '/recuperation'
            const lien = new URL(baseURL)
            const query = {
                token:token
            }
            Object.keys(query).forEach(key => {
                lien.searchParams.set(key, [query[key]])
            })
            //linserer
            const [rInsrtTkn] = await pool.query(sqlInsrtTkn, [rCourriel[0].id, hashToken(token), exp])
            
            console.log('token inseré', rInsrtTkn.affectedRows)
            //crée le courriel avec le lien
            const text = `Salut ${pseudo}!

On a reçu une demande pour réinitialiser ton mot de passe. 
Si c’est vraiment toi, clique sur le lien ci-dessous pour en choisir un nouveau.

C’est une procédure de sécurité normale — ça protège ton compte si quelqu’un essaie de se connecter à ta place.

Ton lien de réinitialisation :
${lien}

Si tu n’es pas à l’origine de cette demande, ignore simplement ce courriel et écris-moi sur Instagram (@sync_dispo_findr).
Rien ne sera modifié sur ton compte, et je vérifierai personnellement que tout est intact de ton côté.

Merci de faire partie de Sync.
- Alkemist
                `;
            const html = `<p>Salut ${pseudo}!</p>

<p>
On a reçu une demande pour réinitialiser ton mot de passe.<br>
Si c’est vraiment toi, clique sur le bouton ci-dessous pour en choisir un nouveau.
</p>

<p>
C’est une procédure de sécurité normale — ça protège ton compte si quelqu’un essaie de se connecter à ta place.
</p>

<div style="
        text-align:center; 
        margin:24px 0;
">
  <a href="${lien}"
     style="
        display:inline-block;
        width:72%;
        max-width:320px;
        padding:18px 0;
        border-radius:12px;
        background:hsla(248, 40%, 45%, 0.3);
        color:hsl(0, 0%, 95%);
        text-decoration:none;
        font-size:16px;
        font-family:sans-serif;
        font-weight:500;
     ">
     réinitialiser mon mot de passe
  </a>
</div>

<p>
Si tu n’es pas à l’origine de cette demande, ignore simplement ce courriel et écris-moi sur Instagram (@sync_dispo_findr).
Rien ne sera modifié sur ton compte, et je vérifierai personnellement que tout est intact de ton côté.
</p>

<p>Merci de faire partie de Sync.</p>
                <p>- <em>Alkemist</em></p>`
            //envoyer le courriel
            const data = await envoyerEmail(courriel, "récupération de mot de passe", text, html)
            if(data)
                return res.status(201).json({
                    message:'courriel envoyé; ça peut prendre du temps avant que tu le reçoives',
                    data:data
                })
            
            return res.status(503).json({
                message:"problème à l'envoie du courriel"
            })
        }else
            return res.status(401).json({
                message:"tu ne peux pas récupérer ton mot de passe"
            })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message:"une erreur à la base de données est survenue",
            erreur:error
        })
    }
})

module.exports = router