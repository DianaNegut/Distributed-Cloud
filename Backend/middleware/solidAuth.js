/**
 * Authentication Middleware pentru Solid PODs
 * Verifică token-urile de sesiune
 */

const SolidAuth = require('../models/SolidAuth');

/**
 * Middleware pentru verificarea autentificării
 */
function requireAuth(req, res, next) {
  try {
    // Caută token în header
    const token = req.headers['x-session-token'] || req.headers['authorization']?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please provide a session token'
      });
    }

    // Verifică sesiunea
    const user = SolidAuth.verifySession(token);
    
    // Adaugă user în request
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

/**
 * Middleware opțional - verifică autentificarea dacă există token
 */
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
    // Nu returnăm eroare, doar continuăm fără user
    next();
  }
}

module.exports = {
  requireAuth,
  optionalAuth
};
