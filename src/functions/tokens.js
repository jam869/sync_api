const crypto = require("crypto");

let hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

module.exports = hashToken