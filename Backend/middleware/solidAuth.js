const SolidAuth = require('../models/SolidAuth');
// middleware care verifica daca utilizatorul e autentificat inainte sa acceseze api-urile solid


function requireAuth(req, res, next) {
  try {
    const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a session token'
      });
    }

    const user = SolidAuth.verifySession(token);

    req.user = user;
    req.sessionToken = token;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session',
      message: error.message
    });
  }
}

function optionalAuth(req, res, next) {
  try {
    const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');

    if (token) {
      const user = SolidAuth.verifySession(token);
      req.user = user;
      req.sessionToken = token;
    }

    next();
  } catch (error) {
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth
};
