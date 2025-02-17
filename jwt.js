const jwt = require('jsonwebtoken');
require('dotenv').config();



const jwtAuthMiddleware= (req, res, next) => {
  try {
    
    const token = req.headers.authorization?.split(' ')[1]; // "Bearer <token>"
    if (!token) {
      return res.status(403).json({ error: 'Token is required' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // Payload data ko request me save kar do
    req.user = decoded; // decoded payload: { userId, email, userRole }

    next(); // Aage badho
  } catch (error) {
    console.error(error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
module.exports = {jwtAuthMiddleware, };
