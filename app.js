const express = require('express');
const bodyParser  = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require("./lib/db.js");
const  CustomRoutes  = require("./routes/routes.js");

// Zaroori env variables start par hi check ho jate hain. JWT_SECRET_KEY missing ho to
// server chal to jata tha lekin login ke waqt fail hota — behtar hai abhi pata chal jaye.
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET_KEY'];
const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name]);

if (missingEnvVars.length) {
  console.error(
    `Ye env variables set nahi hain: ${missingEnvVars.join(', ')}. ` +
    `.env me daalein (.env.example dekhein).`
  );
  process.exit(1);
}

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
