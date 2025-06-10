const jwt = require('jsonwebtoken');
require('dotenv').config();



const jwtAuthMiddleware= (req, res, next) => {
  try {
    
    const token = req.headers.authorization?.split(' ')[1]; 
    if (!token) {
      return res.status(403).json({ error: 'Token is required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

   
    req.user = decoded; 

    next(); 
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
module.exports = {jwtAuthMiddleware, };
