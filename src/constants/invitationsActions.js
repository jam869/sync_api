const actionsInvitation = (idPubliqueEv) => [
    {
        label: "accepter",
        method: "PATCH",
        url: `/evenements/invitations/${idPubliqueInv}`,
        body: {
            id_evenement: idPubliqueEv,
            statut: "acceptee",
        },
    },
    {
        label: "refuser",
        method: "PATCH",
        url: `/evenements/invitations/${idPubliqueInv}`,
        body: {
            id_evenement: idPubliqueEv,
            statut: "refusee",
        },
    },
]

module.exports = actionsInvitation