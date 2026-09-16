const axios = require('axios')
const { generateIdWithQueue } = require('./idGen');
const { composer } = require('googleapis/build/src/apis/composer');
const {Pool} = require('mysql2') 

async function envoyerNotification(pdo, { token, type, titre, corps, source, destinataire, data: {}, idMetierPrive }){   

    data.type = type
    data.id_metier = idMetierPublique 

    const pushMessage = {
        to: token,
        sound: 'default',
        title: titre,
        body: corps,
        data: JSON.stringify(data),        
    }

    let notif_sent = true
    let message = ''

    try {        
        const notificationId = await generateIdWithQueue(10, true, true, 'N', "notifications")
        const [rNotifs] = await pdo.execute(
            `INSERT INTO notifications (id_publique, id_receveur, message, source, payload) VALUES (?, ?, ?, ?, ?)`,
            [
                notificationId,
                destinataire, 
                corps,
                source,
                JSON.stringify(data)
            ]
        );
        
        if (rNotifs.affectedRows == 0) {
            notif_sent = false
            message = "impossible d'envoyer la notification"
        }

        else if(token != null && token.includes('ExponentPushToken')){            
            try {
                const res = await axios.post('https://exp.host/--/api/v2/push/send', pushMessage, {
                    headers: { 'Content-Type': 'application/json' },
                })
                console.log("notification envoyée: ", res.data)
            }catch(e){
                console.log("erreur d'envoie de la notification:", e)
                message = 'service Expo Push injoignable'
                notif_sent = false
            }     
        } else{
            console.error("push token du destinataire indsponible", pushMessage)
            message = "adresse de push du destinataire indsponible"
            notif_sent = false
        }     
        console.log("notification envoyee", titre, ' : ', pushMessage)

        const statutEnvoi = notif_sent ? 'envoyee' : 'echouee'

        await pdo.query("UPDATE notifications SET statut_envoi = ? WHERE id = ?", [ statutEnvoi, rNotifs.insertId])        
    } catch (error) {
        console.error("Erreur d'envoi de notification:", error);
        message = "erreur à l'envoie de la notification"
        notif_sent = false
    }

    return {notifSent: notif_sent, message}    
}

module.exports = envoyerNotification