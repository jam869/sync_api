const envoyerEmail = require("./envoyerEmail")
const jwt = require('jsonwebtoken')
const { emailConfSecret, baseUrl } = require('../config/env')

async function sendConfirmationMail(email, pseudo, id){
    const token = jwt.sign({id_membre:id, type:"email_confirmation"}, emailConfSecret, {expiresIn:"1H"})
    const baseURL = baseUrl + '/confirmation'
    const lien = new URL(baseURL)
    lien.searchParams.set("token", token)
    const html = `<p>Salut ${pseudo}!</p>

<p>
Je te demanderais de cliquer sur le lien ci-dessous pour confirmer ton courriel.
C’est une mesure de prévention pour éviter d’avoir 3000 comptes pour la même personne…
</p>

<p>
Je voulais aussi poser le cadre de Sync :<br>
Sync est un réseau social qui met en avant l’utilisateur. Ici, aucun doomscroll toxique,
juste un encouragement à voir les personnes qui te tiennent à cœur.
</p>

<p>
Bref, je parle trop, voilà ton lien :
</p>

<div style="
    text-align:center; 
    margin:24px 0;        
">
<a href="${lien}"
    style="
    display:inline-block;
    width:72%;
    max-width:320px;
    padding:18px 0;
    border-radius:12px;
    background:hsla(248, 40%, 45%, 0.3);
    color:hsl(0, 0%, 95%);
    text-decoration:none;
    font-size:16px;
    font-family: sans-serif;
    font-weight:500;
    ">
    confirmer mon compte
</a>
</div>

<p>Merci d’être là, et bienvenue dans la communauté !</p>
        <p>- <em>Alkemist</em></p>`
    const text = `Salut ${pseudo}!

Je te demanderais de cliquer sur le lien ci-dessous pour confirmer ton courriel. C’est juste une mesure de prévention pour éviter d’avoir 3000 comptes pour la même personne…

Je voulais aussi poser le cadre de Sync :
Sync est un réseau social qui met en avant l’utilisateur. Ici, aucun doomscroll toxique, juste un encouragement à voir les personnes qui te tiennent à cœur.

Bref, je parle trop, voilà ton lien :

${lien}

Merci d’être là, et bienvenue dans la communauté !
- Alkemist`
    try{
        const data = await envoyerEmail(
            email, 
            "confirmation du courriel",
            text,
            html        
        )
        if(!data)
            throw Error("un problème est survenu a l'envoie du courriel")
        return data
    }catch(err){
        console.error(err, 'à lenvoi dun courriel de confirmation')
        throw err
    }
}

module.exports = sendConfirmationMail 