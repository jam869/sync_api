const express = require("express");
const { authentifierToken } = require("../functions/authenticate");
const router = express.Router();
require("dotenv").config();

const crypto = require('crypto')
const {pool} = require('../PDO');
const envoyerEmail = require("../functions/envoyerEmail")
const { DateTime } = require("luxon");
const jwt = require('jsonwebtoken')

//Test du nouveau workflow

router.post('/generer_token_recuperation',authentifierToken, async(req, res, next)=>{
    const {est_admin} = req.membre
    const pseudoRecupere = req.body.pseudo
    if(!est_admin) return res.status(401);


    const token = crypto.randomBytes(32).toString('hex')
    const exp = DateTime.now()
        .toUTC()
        .plus({ hours: 1 })
        .toFormat('yyyy-MM-dd HH:mm:ss')

    const sql = "INSERT INTO tokens_recuperation(id_membre, token, expiration) VALUES (?, ?, ?)";
    const sqlId = "SELECT id FROM membres WHERE pseudo = ?"
    try {
        const [rId] = await pool.query(sqlId, [pseudoRecupere])
        await pool.query(sql, [rId[0].id, token, exp])
        return res.status(201).json({
            message:'lien créé',
            url:{
                method:'GET',
                string:`/recuperation/${token}`
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            message: "Une erreur au niveau de la base de donnée est survenue",
            erreur: error,
        });
    }

})

router.post("/envoyer_email", authentifierToken, async(req, res, next)=>{
    const {id, est_admin} = req.membre
    const {pseudo} = req.body
    if(!est_admin) return res.status(401);

    const sqlEmail = "SELECT courriel FROM membres WHERE id = ?"
    try {
        const [rEmail] = await pool.query(sqlEmail, [id])
        const token = jwt.sign({id_membre:id, type:"email_confirmation"}, process.env.EMAIL_CONF_TOKEN_SECRET, {expiresIn:"1H"})
        const baseURL = process.env.BASE_URL + '/confirmation'
        const lien = new URL(baseURL)
        const query={
            token:token
        }
        Object.keys(query).forEach(key => {
            lien.searchParams.set(key, [query[key]])
        })
        const data = await envoyerEmail(
            rEmail[0].courriel, 
            "confirmation du courriel",
            `Salut ${pseudo}!

Je te demanderais de cliquer sur le lien ci-dessous pour confirmer ton courriel. C’est juste une mesure de prévention pour éviter d’avoir 3000 comptes pour la même personne…

Je voulais aussi poser le cadre de Sync :
    Sync est un réseau social qui met en avant l’utilisateur. Ici, aucun doomscroll toxique, juste un encouragement à voir les personnes qui te tiennent à cœur.

Bref, je parle trop, voilà ton lien :

${lien}

Merci d’être là, et bienvenue dans la communauté !
- Alkemist`,
        `<p>Salut ${pseudo}!</p>

<p>
Je te demanderais de cliquer sur le lien ci-dessous pour confirmer ton courriel.
C’est une mesure de prévention pour éviter d’avoir 3000 comptes pour la même personne…
</p>

<p>
Je voulais aussi poser le cadre de Sync :<br>
    Sync est un réseau social qui met en avant l’utilisateur. Ici, aucun doomscroll toxique,
juste un encouragement à voir les personnes qui te tiennent à cœur.
</p>

<p>
Bref, je parle trop, voilà ton lien :
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
        font-family: sans-serif;
        font-weight:500;
     ">
     confirmer mon compte
  </a>
</div>

<p>Merci d’être là, et bienvenue dans la communauté !</p>
<p>- <em>Alkemist</em></p>`
        )
        if(data)
            return res.status(201).json({data})
        else
            return res.status(500).json({
                message:"un probleme est survenu a l'envoie du courriel"
            })
    } catch (error) {
        return res.status(500).json({
            erreur:error,
            message:"un probleme est survenu a l'envoie du courriel"
        })
    }
})

module.exports = router

