const { DateTime } = require("luxon");
const { pool } = require("../PDO");

const HEADERS_304 = {
    'X-Data-Changed': 'false',
    'Cache-Control': 'no-cache'          
}

/**
 * Retourne True si la ressource a changée ou False si elle n'a pas changé ou si dernierTimestamp est undefined 
 * @param {string} nomRessource nom de la table ou vue a verifier l'etat 
 * @param {string | undefined} derniereVersionClient DateTime(6) UTC en format SQL obtenu de la base de donnee
 * @param {Array} owners tableau des ids des proprietaires de la ressource
 * @param {string | number | undefined} ressourceId id de la ressource exact 
 * @returns 
 */
async function resChanged(nomRessource, derniereVersionClient, owners, ressourceId = undefined) {    
    const sqlVersion = "SELECT SUM(version) as version, updated_at FROM versions_donnees WHERE nom_table = ? AND id_membre IN (?) "

    const [rows] = await pool.query(sqlVersion,[ nomRessource, owners]);
    const version = rows[0].version;

    console.log(nomRessource, 'derniere version', version)
    if (!version) return false; // rien de pertinent pour cet utilisateur
    console.log(nomRessource, 'dernierTimestampClient:', derniereVersionClient)
    if (!derniereVersionClient) return true; // client n'a jamais fetché
   
    const changed = derniereVersionClient < version
    
    console.log(nomRessource, changed ? "changed" : "!changed")
    
    return changed
}

module.exports = { resChanged, HEADERS_304 }