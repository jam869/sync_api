const { formaterDateVersClient } = require("./formaterDateVersClient");

function retourConflit(res, e) {
    return res.status(409).json({
        message: 'Un évènement existe déjà',
        evenement: {
            id:e.id_publique,
            titre: e.titre,
            description: e.description,
            regle_recurrence: e.regle_recurrence,
            type: e.type,
            prive: e.prive,
            fuseau_horaire: e.fuseau_horaire,
            debut: formaterDateVersClient(e.debut),
            fin: formaterDateVersClient(e.fin),
            url:{
                method:'GET',
                string: e.string??`/evenements/${e.id_publique}`
            }
        }
    });
}

module.exports = retourConflit