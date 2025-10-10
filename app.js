const express = require('express');
const bodyParser  = require('body-parser');
const cors = require('cors');
const { connectDB } = require("./lib/db.js");
const  CustomRoutes  = require("./routes/routes.js");

const app = express();
const port = 3004;

app.use(cors());
app.use(express.static('public'));

app.use(express.json({ limit: '50mb' }));


connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });
});


CustomRoutes(app, express);
