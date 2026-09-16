const http = require("http");
const app = require("./app");
require("dotenv").config();

const port = process.env.PORT;
const ip = '0.0.0.0'

app.listen(port, ip, () => {
    console.log(`Serveur roule sur ${ip}:${port}`);
  });
