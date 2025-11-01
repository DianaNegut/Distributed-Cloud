const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors(require('./middleware/corsConfig')));
app.use(express.json());
app.use(require('./middleware/logger'));

// Auth middleware (se aplică după route-urile publice)
const authMiddleware = require('./middleware/auth');

// Routes publice (fără autentificare)
app.use('/api/health', require('./routes/health'));
app.use('/api/bootstrap-info', require('./routes/bootstrap'));
app.use('/api/join-network', require('./routes/join'));
app.use('/api/cluster/status', require('./routes/cluster'));

// Middleware de autentificare pentru route-urile protejate
app.use(authMiddleware);

// Routes protejate
app.use('/api/configure-network', require('./routes/configNetwork'));
app.use('/api/status', require('./routes/status'));
app.use('/api/peers', require('./routes/peers'));
app.use('/api/cluster', require('./routes/cluster'));
app.use('/api/files', require('./routes/files')); // ROUTE NOU pentru fișiere

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server pornit pe portul ${PORT}`);
  console.log(`📡 API disponibil la: http://localhost:${PORT}/api`);
  console.log(`🔒 Auth: x-api-key = ${process.env.API_KEY || 'supersecret'}\n`);
});