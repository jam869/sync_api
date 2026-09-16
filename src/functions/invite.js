/**
 * Invites an array of Paricipants into an event. 
 * Inserts into participants_evenenements and invitations_evenement at the same time and sends notifications
 * always call it in a transaction and pass it a connection
 * @param {import("mysql2").PoolConnection} db 
 * @param {Array} participants 
 * @param {*} param2 {createur: {id, pseudo}, idPubliqueEnv: string, idPriveEnv: number, debut: DateTime, fin: DateTime}
 * @returns void
 */

const { DateTime } = require("luxon");
const envoyerNotification = require("./envoyerNotification");
const { generateIdWithQueue } = require("./idGen");

async function inviteParticipants(db, participants, { createur, idPubliqueEv, idPriveEv, debut, fin, titre }) {  
    try {
        const idsPrives = participants.map((p) => p.id);
        const [rMembres] = await db.query(
            "SELECT id, push_token, fuseau_horaire FROM membres WHERE id IN (?)",
            [idsPrives]
        );

        let mapIdPushTokenTimezone = new Map() // links a push token and a timezone to a member's id
        for (const membre of rMembres) {
            console.log("rMembre", membre)
            mapIdPushTokenTimezone.set(membre.id, {
                push_token: membre.push_token,
                timezone: membre.fuseau_horaire
            })
        }

        let mapInvIdPubParticipant = new Map()

        let insertsInvitation = []
        let insertsParticipation = []
        let valuesInvitation = []
        let valuesParticipation = [];

        const now = DateTime.now().toUTC()
        let exp = 24 //h
        let expDt = now.plus({ hours: exp })
        if (fin.diffNow('hours').hours < exp) {
            expDt = fin
        }

        for (let p of participants) {
            if (!p || p.id === createur.id) {
                throw new Error("liste des participants invalide")
            }

            p.push_token = mapIdPushTokenTimezone.get(p.id)?.push_token

            const idPubliqueInv = await generateIdWithQueue(10, true, true, 'I', 'invitations_evenement')
            mapInvIdPubParticipant.set(idPubliqueInv, { participant: { ...p } })

            insertsInvitation.push("(?, ?, ?, ?, ?)");
            insertsParticipation.push("(?, ?, ?)");            
            
            valuesInvitation.push(idPubliqueInv, idPriveEv, createur.id, p.id, expDt.toSQL({ includeZone: false, includeOffset: false }));
            valuesParticipation.push(p.id, idPriveEv, "lecteur");
            //console.log("values", valuesInvitation); 
        }

        // multiple inserts into invitations_evenement
        if (insertsInvitation.length > 0) {
            const sqlInsertInvitations =
                "INSERT INTO invitations_evenement (id_publique, id_evenement, id_invitant, id_invite, expiration) VALUES " +
                insertsInvitation.join(", ");
            await db.execute(sqlInsertInvitations, valuesInvitation);

            // Re-fetch explicite — garantit le bon mapping peu importe l'ordre réel d'insertion
            const idsPubliques = [...mapInvIdPubParticipant.keys()];
            const [rowsInserees] = await db.query(
                "SELECT id, id_publique FROM invitations_evenement WHERE id_publique IN (?)",
                [idsPubliques]
            );

            rowsInserees.forEach(r => {
                mapInvIdPubParticipant.get(r.id_publique).idPriveInv = r.id;
            });
        }

        // multiple inserts into participants_evenements
        if (insertsParticipation.length > 0) {
            const sqlInsertParticipants =
                "INSERT INTO participants_evenements(id_membre, id_evenement, privilege) VALUES " +
                insertsParticipation.join(", ")
            await db.execute(
                sqlInsertParticipants,
                valuesParticipation
            )
        }    

        //Sending notifications
        for (const [idPubliqueInv, obj] of mapInvIdPubParticipant) {
            const participant = obj.participant;
            console.log("participant", participant)
            if (!participant || participant.id === createur.id) continue;
            const data = {
                onPress: {
                    type: "fetch",
                    method: "GET",
                    string: `/evenements/${idPubliqueEv}`,
                }
            };

            const participantTimezone = mapIdPushTokenTimezone.get(participant.id).timezone

            const dateFormat = debut.setZone(participantTimezone).toFormat('d MMM')
            const debutFormat = debut.setZone(participantTimezone).toFormat('H:m')
            const finFormat = fin.setZone(participantTimezone).toFormat('H:m')

            await envoyerNotification(
                db,
                {
                    token:participant.push_token,
                    type:"invitationsEvenements",
                    titre: "invitation",
                    corps: `${createur.pseudo} t'invite à ${titre} le ${dateFormat} de ${debutFormat} à ${finFormat}`,
                    source: createur.id,
                    destinataire: participant.id,
                    data,
                    idMetierPrive: obj.idPriveInv
                }
            );
        }
    } catch (err) {
        console.error("impossible d'inviter les participants", err)
        throw err
    }
}

module.exports = inviteParticipants