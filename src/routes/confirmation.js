const express = require("express");
const router = express.Router();
require("dotenv").config();
const jwt = require('jsonwebtoken')

const {pool} = require('../PDO')

const { DateTime } = require("luxon");
const { authentifierConfirmationToken, authentifierToken } = require("../functions/authenticate");
const path = require('path') 
const envoyerEmail = require('../functions/envoyerEmail');
const sendConfirmationMail = require("../functions/sendConfirmationMail");

router.get('/', authentifierConfirmationToken, async(req, res, next)=>{
    const {id_membre, token} = req.token    
    const action = process.env.BASE_URL + '/confirmation'
    const sql = "SELECT courriel, email_confirme FROM membres WHERE id = ?"
    const confirmerHTML = path.join(__dirname, "..","..", "views", "confirmer_courriel.ejs")
    const erreurHtml = path.join(__dirname, "..","..", "views", "confirmation_erreur.ejs")
    try {   
        const [rows] = await pool.query(sql, [id_membre])
        if(!rows.length)
            return res.status(404).render(erreurHtml, {error: "Membre introuvable"})          
        else
            return res.status(201).render(confirmerHTML, {courriel: rows[0].courriel, token:token, action:action})
            
    } catch (error) {
        console.error(DateTime.now(), error)
        return res.status(500).render(erreurHtml, {error: "Un problème est survenu à l'accès au formulaire de confirmation"})
    }
    
})
router.post("/", authentifierConfirmationToken, async(req, res, next)=>{
    const {id_membre} = req.token    
    
    const sql = "UPDATE membres SET email_confirme = 1 WHERE id = ?"
    const succesHtml = path.join(__dirname, "..","..", "views", "confirmation_succes.html")
    const erreurHtml = path.join(__dirname, "..","..", "views", "confirmation_erreur.ejs")
    try {   
        const [rConfirmation] = await pool.query(sql, [id_membre])
        if(rConfirmation.affectedRows > 0) 
            return res.status(201).sendFile(succesHtml)
        else
            return res.status(500).sendFile(erreurHtml, {error: "Impossible de confirmer votre courriel"})
    } catch (error) {
        console.error(DateTime.now(), error)
        return res.status(500).sendFile(erreurHtml)
    }
})
router.post("/envoyer_email", authentifierToken, async(req, res, next)=>{
    const {id} = req.membre
    const {pseudo} = req.body

    const sqlEmail = "SELECT courriel FROM membres WHERE id = ?"
    try {
        const [rEmail] = await pool.query(sqlEmail, [id])

        const data = await sendConfirmationMail(rEmail[0].courriel, pseudo, id)
        console.log("sendConfirmationMail done")
        return res.status(data.status).json({
            message:"email envoyé à ton adresse courriel"
        })
    } catch (error) {
        console.error(error, "un probleme est survenu a l'envoie du courriel")
        return res.status(500).json({
            erreur:error,
            message:"un probleme est survenu a l'envoie du courriel"
        })
    } 
})
module.exports = router