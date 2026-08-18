const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  // Jaan boojh kar koi default nahi rakha. Agar URI set na ho to app start hi na ho —
  // warna galti se ghalat database (khaas taur par production) se connect ho sakti hai.
  if (!uri) {
    console.error(
      "MONGODB_URI set nahi hai. .env me MONGODB_URI daalein (.env.example dekhein)."
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(uri);
    console.log("Database connected...");
  } catch (error) {
    // Pehle yahan sirf log hota tha aur server DB ke baghair hi chalta reh jata tha.
    console.error("Database connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = {
  connectDB,
};
