const express = require("express");
const app = express();
app.set('etag', false)
const morgan = require("morgan");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require('path')

const membresRoutes = require("./routes/membres");
const notificationsRoutes = require("./routes/notifications");
const evenementsRoutes = require("./routes/evenements");
const conversationsRoutes = require("./routes/conversations");
const amisRoutes = require("./routes/amis")
const imagesRoutes = require("./routes/medias")
const tokenRoute = require('./routes/token')
const signalementsRoute = require('./routes/signalements')
const widgetsRoutes = require('./routes/widgets')
const adminRoutes = require('./routes/admin')
const recuperationRoutes = require('./routes/recuperation')
const confirmationRoutes = require('./routes/confirmation');
const blockScanners = require("./functions/blockScannersBots");

app.set('html', path.join(process.cwd(), 'html'));
app.set('view engine', 'ejs');

app.use(morgan("dev")); 

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//handling CORS errors
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "PUT, POST, PATCH, DELETE, GET");
    return res.status(200).json({});
  }
  next();
});

const imagePath = path.join(__dirname, 'public/img');

app.get("/", (req, res) => {
  res.status(201).send("dev server is running...");
}); 

//routes which should handle requests
app.use("/membres", membresRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/evenements", evenementsRoutes);
app.use("/conversations", conversationsRoutes);
app.use("/amis", amisRoutes)
app.use('/images', imagesRoutes);
app.use('/img', express.static(imagePath));
app.use('/token', tokenRoute)
app.use('/signalements', signalementsRoute)
app.use('/widgets', widgetsRoutes)
app.use('/admin', adminRoutes)
app.use('/recuperation', recuperationRoutes)
app.use('/confirmation', confirmationRoutes)

app.use(blockScanners)

//route for 404 not found
app.use((req, res, next) => {
  const error = new Error("Not found");
  error.status = 404;
  next(error);
});

//route for db not connected
app.use((error, req, res, next) => {
  return res.status(error.status || 500).json({
      message: error.message,
      erreur:error
  });
}); 

module.exports = app; 
