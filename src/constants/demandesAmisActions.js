const actionsDemandeAmi = (idDemandePublique) => [
    {
        label:'accepter',
        method:'PATCH',
        url:`/amis/demandes/${idDemandePublique}`,
        body:{
            statut:'acceptee'
        }
    },
    {
        label:'refuser',
        method:'PATCH',
        url:`/amis/demandes/${idDemandePublique}`,
        body:{
            statut:'refusee'
        }
    }
]

module.exports = actionsDemandeAmi