require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*', // Adjust to specific frontend URL in production
    methods: ['GET', 'POST']
  }
});
app.set('socketio', io);

// Middleware
const path = require('path');
app.use(cors());
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/firs', require('./routes/firs'));
app.use('/api/criminals', require('./routes/criminals'));
app.use('/api/officers', require('./routes/officers'));
app.use('/api/cases', require('./routes/cases'));
app.use('/api/challans', require('./routes/challans'));
app.use('/api/emergency', require('./routes/emergency'));

// Health Check API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    service: 'CIPMS Backend API Server'
  }); 
});

// Real-Time Socket Connections for Data Syncing
io.on('connection', (socket) => {
  console.log(`New socket connection established: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  console.log(`Criminal Management record system Backend listening on port ...${PORT}`);
  
  // Run database migrations on start
  try {
    const runMigrations = require('./config/migrate');
    await runMigrations();
  } catch (error) {
    console.error('Failed to run database migrations on server start:', error);
  }
});
