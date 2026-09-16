const { DateTime } = require("luxon");
const actionsDemandeAmi = require("../constants/demandesAmisActions");
const actionsInvitation = require("../constants/invitationsActions");
const validateExpiration = require("./validateExpiration");

async function getDemandesAmisByDestinataire(pdo, idDestinataire) {
    const sql = `SELECT d.id_publique, d.statut, m.pseudo, m.id_publique as id_demandeur
                FROM demandes_amis d
                JOIN membres m ON d.id_demandeur = m.id
                WHERE d.id_destinataire = ?`;
    const [rows] = await pdo.query(sql, [idsMetier]);

    return rows.map(r => ({
        id: r.id_publique,
        statut: r.statut,
        id_demandeur: r.id_demandeur,
        pseudo_demandeur: r.pseudo,
        titre_type: "demande d'ami",
        // Les actions dépendent du statut RÉSOLU, pas de ce qui était vrai à la création
        actions: r.statut === 'en_attente' ? actionsDemandeAmi(r.id_publique) : {} // déjà résolue → pas d'action, le client affiche juste le statut
    }));
}

async function resolveDemandesAmis(pdo, idsMetier, idDestinataire) {
    const sql = `SELECT d.id_publique, d.statut, m.pseudo, m.id_publique as id_demandeur
                FROM demandes_amis d
                JOIN membres m ON d.id_demandeur = m.id
                WHERE d.id IN (?) AND id_destinataire = ?`;
    const [rows] = await pdo.query(sql, [idsMetier, idDestinataire]);

    return rows.map(r => ({
        id: r.id_publique,
        statut: r.statut,
        id_demandeur: r.id_demandeur,
        pseudo_demandeur: r.pseudo,
        titre_type: "demande d'ami",
        // Les actions dépendent du statut RÉSOLU, pas de ce qui était vrai à la création
        actions: r.statut === 'en_attente' ? actionsDemandeAmi(r.id_publique) : {} // déjà résolue → pas d'action, le client affiche juste le statut
    }));
}

async function getInvitationsEvenementsByInvite(pdo, idInvite) {
    const sql = `
        SELECT i.id_publique, i.statut, m.pseudo, m.id_publique as id_invitant, i.expiration, i.id_evenement
            FROM invitations_evenement i
            JOIN membres m ON i.id_invitant = m.id
            WHERE i.id_invite = ?`
    
    const [rows] = await pdo.query(sql, [idInvite])

    return rows.map(r => ({
        id: r.id_publique,
        statut: r.statut,
        id_invitant: r.id_invitant,
        pseudo_invitant: r.pseudo,
        titre_type: "invitation",
        actions: r.statut === "en_attente" ? actionsInvitation(r.id_publique) : {},
        expiration: validateExpiration(DateTime.fromSQL(r.expiration)),
        evenement_url: {
            method: "GET",
            url: `/evenements/${r.id_evenement}`,
        },
    }))
}

async function resolveInvitationsEvenements(pdo, { idsMetier, idInvite }) {
    const sql = `
        SELECT i.id_publique, i.statut, m.pseudo, m.id_publique as id_invitant, i.expiration, i.id_evenement
            FROM invitations_evenement i
            JOIN membres m ON i.id_invitant = m.id
            WHERE i.id IN (?) AND id_invite = ?
    `
    const [rows] = await pdo.query(sql, [idsMetier, idInvite])
    
    return rows.map(r => ({
        id: r.id_publique,
        statut: r.statut,
        id_invitant: r.id_invitant,
        pseudo_invitant: r.pseudo,
        titre_type: "invitation",
        actions: r.statut === "en_attente" ? actionsInvitation(r.id_publique) : {},
        expiration: validateExpiration(DateTime.fromSQL(r.expiration)),
        evenement_url: {
            method: "GET",
            url: `/evenements/${r.id_evenement}`,
        },
    }))
}

module.exports = {resolveDemandesAmis, resolveInvitationsEvenements, getDemandesAmisByDestinataire, getInvitationsEvenementsByInvite}