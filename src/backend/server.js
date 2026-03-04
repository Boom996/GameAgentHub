// GameAgentHub Backend Server
// 网易游戏TA团队内部AI技能共享平台
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'GameAgentHub',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// GitLab OAuth routes
const authRouter = require('./routes/auth');
app.use('/auth', authRouter);

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   GameAgentHub - 网易游戏TA团队内部AI技能共享平台      ║
  ║                                                       ║
  ║   Server running at http://localhost:${PORT}            ║
  ║   API available at http://localhost:${PORT}/api         ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;