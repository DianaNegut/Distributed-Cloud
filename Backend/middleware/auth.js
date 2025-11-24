module.exports = (req, res, next) => {
  const openPaths = [
    '/api/health', 
    '/api/join-network', 
    '/api/bootstrap-info',
    '/api/cluster/status' 
  ];

  if (openPaths.includes(req.path)) return next();

  // Verifică API key din header sau query string
  const token = req.headers['x-api-key'] || req.query['api-key'];
  const expected = process.env.API_KEY || 'supersecret';

  if (!token || token !== expected) {
    console.warn(`[AUTH] Acces interzis pentru ${req.method} ${req.originalUrl}`);
    return res.status(403).json({ success: false, error: 'Acces interzis' });
  }

  next();
};