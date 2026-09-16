const { DateTime } = require("luxon")
const { formaterDateVersClient } = require("./formaterDateVersClient")

function validateExpiration(expirationDt) {
    const now = DateTime.now().toUTC()
    const expiration = expirationDt.setZone('utc')
    const diff = now.diff(expiration, 'minutes').minutes
    if (diff >= 0)
        return "expired"

    return formaterDateVersClient(expiration.toSQL())
    
}

module.exports = validateExpiration