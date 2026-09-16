require('dotenv').config();

const required = ['DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_PORT', 'BASE_URL', 'PORT', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'EMAIL_CONF_SECRET', 'ID_ADMIN', 'MAIL_KEY', 'NODE_ENV', 'Test'];

for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Variable d'environnement manquante: ${key}`);
    }
}


module.exports = {
    dbHost: process.env.DB_HOST,
    dbUser: process.env.DB_USER,
    dbPass: process.env.DB_PASS,
    dbName: process.env.DB_NAME,
    dbPort: process.env.DB_PORT,
    baseUrl: process.env.BASE_URL,
    port: process.env.PORT,
    accessTokenSecret: process.env.ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    emailConfSecret: process.env.EMAIL_CONF_SECRET,
    idAdmin: process.env.ID_ADMIN,
    mailKey: process.env.MAIL_KEY,
    nodeEnv: process.env.NODE_ENV,
    test: process.env.Test
};