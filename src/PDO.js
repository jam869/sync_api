const mysql = require("mysql2/promise.js");
require("dotenv").config();

const poolConfig = {
  connectionLimit: 100,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  dateStrings: true,
}

const pool = mysql.createPool(poolConfig)
 
pool.getConnection()
  .then((conn) => {
    console.log('db connected.');
    conn.release();
  })
  .catch(err => {
    console.log('db connection failed:', err.message);
  })

module.exports = { pool, poolConfig }