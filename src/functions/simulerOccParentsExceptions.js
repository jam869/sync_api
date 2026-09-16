const GenererOccurrences = require("./genererOccurences");
const AppliquerExceptions = require("./appliquerExceptions");
const { DateTime } = require("luxon");

function simulerOccurrencesParentsAvecExceptions(parents, fenetreDebutSQL, fenetreFinSQL, exceptions = []) {
    //console.log('simulerOccurrencesParentsAvecExceptions parents: ', parents.length, parents)
    if (!parents || parents.length === 0) return [];

    //Générer occurrences des parents
    let occurrences = GenererOccurrences(
        fenetreDebutSQL, 
        fenetreFinSQL, 
        parents);
    //Appliquer les exceptions existantes
    if (exceptions && exceptions.length > 0) {
        occurrences = AppliquerExceptions(occurrences, exceptions);
    }
    //console.log('simulerOccurrencesParentsAvecExceptions occurences:', occurrences, 'debutSQL', fenetreDebutSQL, 'finSQL', fenetreFinSQL)
    return occurrences; 
}

module.exports = simulerOccurrencesParentsAvecExceptions