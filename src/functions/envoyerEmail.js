const FormData = require("form-data"); // form-data v4.0.1

async function envoyerEmail(destinataire = "Gabriel Pereira Levesque <syncalkemy@proton.me>", objet, text, html) {
   const { default: Mailgun } = await import("mailgun.js");
  
    const mailgun = new Mailgun(FormData);
    const mg = mailgun.client({
        username: "api",
        key: process.env.MAIL_KEY,
    });
    try {
        const data = await mg.messages.create("mg.syncalkemy.ca", {
        from: "Sync - Alkemy <postmaster@mg.syncalkemy.ca>",
        to: [destinataire],
        subject: objet,
        text: text,
        html: html
        });
        return data
    } catch (error) {
        console.log(error); //logs any error
        return false
    }
}

module.exports = envoyerEmail