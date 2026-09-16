const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const fs = require('fs');

const {pool} = require('../PDO')

const { authentifierToken } = require("../functions/authenticate");

router.get('/', authentifierToken, async(req, res, next)=>{
    const {id, est_admin} = req.membre
    const sqlW = 'SELECT wt.type, wi.config, wi.ordre FROM widgets_types wt INNER JOIN widgets_instances wi ON wt.id = wi.id_type WHERE wi.id_proprietaire = ?'
    const sqlWA = 'SELECT type FROM widgets_types WHERE admin = 1'

    try {
        const [rWidget] = await pool.query(sqlW, [id])
        const widgets = []

        widgets.push(...rWidget)

        if(est_admin){
            const [rAdmin] = await pool.query(sqlWA)
            widgets.push(...rAdmin)
        }

        return res.status(200).json({
            widgets
        })

    } catch (error) {
        return res.status(500).json({
            message:'une erreur est survenu au niveau de la base de donnée',
            erreur:error
        })
    }
})

module.exports = router