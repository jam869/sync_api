const { DateTime } = require("luxon");
const { formaterDateVersClient } = require("./formaterDateVersClient");

function formaterMessages(messagesBrutes, timezoneMembre='local', idMembre){
    //ajouter les mentions lu_par et enlever les doublons
    
    let messagesMap = new Map()

    messagesBrutes.forEach((m) => {
        let message

        if (!messagesMap.has(m.id_prive)) {
            message = {
                id: m.id_publique,
                message: m.message,
                temps_envoi: formaterDateVersClient(m.temps_envoi),
                id_auteur: m.auteur_id_publique,
                id_auteur_prive:m.auteur_id_prive,
                lu_par: []
            }

            if (m.lecteur_id_publique != null) {
                message.lu_par.push({
                    id: m.lecteur_id_publique,
                    id_prive: m.lecteur_id_prive,
                    pseudo: m.lecteur_pseudo
                })
            }

            message.statut = (message.id_auteur_prive === idMembre ||
                message.lu_par.some(u => u.id_prive === idMembre)
                ? 'lu'
                : 'non_lu'
            )

            messagesMap.set(m.id_prive, message)
        } else {
            message = messagesMap.get(m.id_prive)

            if (m.lecteur_id_publique != null) {
            if (!message.lu_par.some(lp => lp.id === m.lecteur_id_publique)) { //si lu_par ne contient pas deja le id du lecteur
                message.lu_par.push({
                    id: m.lecteur_id_publique,
                    pseudo: m.lecteur_pseudo
                })
            }
            }
        }
    })

    const messagesArray = Array.from(messagesMap.values())

    // Filtrer les messages non lus
    const chapitreNonLu = messagesArray
        .filter(m => m.statut === 'non_lu')        
        .map((m)=>m)
    
    //console.log("chapitreNonLu", chapitreNonLu)

    const autresMessages = messagesArray
        .filter(m => m.statut !== 'non_lu')
        .map((m)=>(m))
    
    //console.log('autresMessages', autresMessages)
    // Grouper les autres par jour (ou selon ta logique timestamp maison)
    const chapitres = {};
    autresMessages.forEach(m => {
        console.log("temps_envoi", m.temps_envoi)
        const tsJour = DateTime.fromISO(m.temps_envoi, {zone:'utc'}).setZone(timezoneMembre).startOf('day'); // à adapter si tu as ta logique
        
        if (!chapitres[tsJour]) chapitres[tsJour] = [];
        chapitres[tsJour].push(m);
    });

    const retour = [];

    if (chapitreNonLu.length > 0) {
        retour.push({ chapitre: "non_lu", 
            messages: chapitreNonLu
        });  
    }

    Object.keys(chapitres)
    .sort((a, b) => DateTime.fromISO(b).toMillis() - DateTime.fromISO(a).toMillis())                            // plus récent au plus ancien
        .forEach(ts => {
            retour.push({ chapitre: ts, 
                messages: chapitres[ts]
            });     
        });        
    //console.log('retour', retour)
    return retour
}

module.exports = formaterMessages