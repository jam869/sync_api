const express = require("express");
const { authentifierToken } = require("../functions/authenticate");
const { DateTime } = require("luxon");
const { getBitmaskUser, maskToInterval, intersectMasks, findDisposFriend } = require("../functions/getBitmaskUser");
const { resoudreEvenements, formaterEvenement } = require("../functions/fetchEvenements");
const { pool } = require("../PDO");
const { use } = require("react");
const resoudreAmis = require("../functions/fetchAmis");
const router = express.Router();
require("dotenv").config();

// Phase MVP : toujours régénéré
// Phase 2 : const cached = await cache.get(getCleCache(userId, windowStart, windowEnd));
// Phase 2 : if (cached) return cached;


router.get('/', authentifierToken, async (req, res, next) => {
    const { id:idMembre } = req.membre
    const debut = DateTime.fromSQL(req.query.debut, {zone:'utc'}) || DateTime.now().toUTC()
    const fin = debut.plus({days:7})
    try {        
        const evenements = await resoudreEvenements(pool, {idsMembres:[idMembre], debut:debut.toSQL(), fin: fin.toSQL()})
        const mask = await getBitmaskUser(evenements.map(e => formaterEvenement(e)), debut.toMillis(), fin.toMillis());
        
        return res.status(200).json({
            disponibilites: maskToIntervals(mask, windowStart)
        });    
    } catch (err) {
        console.error(err)
        return res.status(500)
            .json({
                message: "impossible de trouver tes disponibilités",
                erreur:err.message
            })
    }    
})

router.get('/amis', authentifierToken, async (req, res, next) => {
    const {id: idMembre} = req.membre
    const { ids, offsetFin } = req.query; // ids = "4,7,12"
    const userIdsPubliques = ids.split(',');

    try {
        const fenetreDebut = DateTime.fromSQL(req.query.debut, {zone:'utc'}) || DateTime.now().toUTC()
        const fenetreFin = DateTime.fromSQL(req.query.fin, {zone:'utc'}) || fenetreDebut.plus({ days: 7 * (offsetFin ?? 1) })      
        
        //TODO: verifier l'amitie
        const [rows] = pool.query("SELECT id FROM membres WHERE id_publique IN (?)", [userIdsPubliques])
        const idsPrives = rows.map(r => r.id).push(idMembre)
        const evenements = await resoudreEvenements(pool, {idsMembres: idsPrives, debut:fenetreDebut.toSQL(), fin: fenetreFin.toSQL()})

        const masks = await Promise.all(            
            idsPrives.map(uId => {
                const eventsUser = evenements.filter(e => e.id_proprietaire == uId).map(e => formaterEvenement(e))
                return getBitmaskUser(eventsUser, fenetreDebut.toMillis(), fenetreFin.toMillis())
            })
        );

        const commun = intersectMasks(masks);
        
        return res.status(200).json({ disponibilites: maskToIntervals(commun, fenetreDebut.toMillis()) });
    } catch (err) {
        console.error(err)
        return res.status(500)
            .json({
                message: "impossible de trouver une disponibilité commune entre " + (userIdsPubliques.length + 1) + " personnes",
                erreur:err.message
            })
    }
})

router.get('/amis/:idpublique', async (req, res, next) => {
    const { id:idMembre } = req.membre
    const { offsetFin } = req.query;
    const idPubliqueAmi = req.params.idpublique 
    
    const fenetreDebut = DateTime.fromSQL(req.query.debut, {zone:'utc'}) || DateTime.now().toUTC()
    const fenetreFin = DateTime.fromSQL(req.query.fin, {zone:'utc'}) || fenetreDebut.plus({ days: 7 * (offsetFin ?? 1) })
    try {
        //TODO: verifier lamitie
        const [idPriveAmi] = await pool.query("SELECT id FROM membres WHERE id_publique = ?", [idPubliqueAmi])
        const idsPrives = [idMembre, idPriveAmi[0].id]
        
        const evenements = await resoudreEvenements(pool, { idsMembres: idsPrives, debut:fenetreDebut.toSQL(), fin: fenetreFin.toSQL() })
        
        const masks = await Promise.all(
            idsPrives.map(uId => {
                const eventsUser = evenements.filter(e => e.id_proprietaire == uId).map(e => formaterEvenement(e))
                return getBitmaskUser(eventsUser, fenetreDebut.toMillis(), fenetreFin.toMillis())
            })            
        )
        return res.status(200).json({ disponibilites: maskToInterval(intersectMasks(masks), fenetreDebut) });    
    } catch (err) {
        console.error(err)
        return res.status(500)
            .json({
                message: "impossible de trouver une disponibilité commune avec " + idPubliqueAmi,
                erreur:err.message
            })
    }
    
})

router.get('/suggestions', async (req, res, next) => {
    const { id: idMembre } = req.membre;
    const { debut, fin, offset_ami, seuil } = req.query;

    if (!debut || !fin)
        return res.status(400).json({ message: `${debut ? 'fin' : 'debut'} obligatoire` });

    const fenetreDebut = DateTime.fromSQL(debut, { zone: 'utc' });
    const fenetreFin = DateTime.fromSQL(fin, { zone: 'utc' });
    const eventStart = fenetreDebut.toMillis();
    const eventEnd = fenetreFin.toMillis();
    const seuilRatio = seuil ? Number(seuil) : 0.6;

    try {
        const { ids: idsAmis, rows } = await resoudreAmis(pool, {
        idMembre, friendsLimit: 5, friendsOffset: offset_ami ?? 0
        });
        const evenements = await resoudreEvenements(pool, {
        idsMembres: idsAmis, debut: fenetreDebut.toSQL(), fin: fenetreFin.toSQL()
        });

        const evenementsParAmi = new Map();
        for (const e of evenements) {
        const liste = evenementsParAmi.get(e.id_proprietaire) ?? [];
        liste.push(e);
        evenementsParAmi.set(e.id_proprietaire, liste);
        }

        const resultats = [];
        for (const ami of rows) {
        const amiEvenements = (evenementsParAmi.get(ami.id) ?? []).map(e => formaterEvenement(e));
        const plages = trouverDispoAmi(amiEvenements, eventStart, eventEnd, seuilRatio);

        if (plages.length) resultats.push({ ...ami, plages });
        }

        return res.status(200).json(resultats);
    } catch (err) {
        console.error(err);
        return res.status(500).json({
        message: "impossible de trouver une suggestion de disponibilité commune",
        erreur: err.message
        });
    }
});