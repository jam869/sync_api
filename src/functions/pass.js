"use strict";
const bcrypt = require("bcrypt");

const COST_FACTOR = 12; // rounds de bcrypt

/**
 * Hash un mot de passe. Retourne directement la string à stocker en DB.
 * bcrypt génère et embarque le salt DANS le hash retourné.
 */
let hash = async (password) => {
  if (password == null || typeof password !== "string")
    throw new Error(`Must provide a password string (reçu: ${password})`);
  return await bcrypt.hash(password, COST_FACTOR);
};

/**
 * Compare un mot de passe en clair au hash stocké en DB.
 * hashedPassword = la string complète venant de la colonne mot_de_passe.
 */
let compare = async (password, hashedPassword) => {
  if (password == null || hashedPassword == null)
    throw new Error("password et hashedPassword sont requis pour comparer");
  if (typeof password !== "string" || typeof hashedPassword !== "string")
    throw new Error("password et hashedPassword doivent être des strings");
  return await bcrypt.compare(password, hashedPassword);
};

module.exports = {
  hash,
  compare,
};
