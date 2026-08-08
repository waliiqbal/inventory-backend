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

const normalizeRole = (role = '') => {
  const normalizedRole = String(role).trim().toLowerCase();

  if (normalizedRole === 'menager') return 'manager';
  if (normalizedRole === 'superadmin' || normalizedRole === 'super_admin') return 'admin';
  if (normalizedRole === 'account') return 'accounts';

  return normalizedRole;
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = normalizeRole(req.user.userRole);
    const normalizedAllowedRoles = allowedRoles.map(normalizeRole);

    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    req.user.userRole = userRole;
    next();
  };
};

module.exports = {jwtAuthMiddleware, authorizeRoles };
