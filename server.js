require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const chatRoutes = require('./src/routes/chatRoutes');
const reelRoutes = require('./src/routes/reelRoutes');
const postRoutes = require('./src/routes/postRoutes');
const userRoutes = require('./src/routes/userRoutes');
const socketHandler = require('./src/socket/socketHandler');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const server = http.createServer(app);

// Socket.io sozlamalari
const io = new Server(server, {
  cors: { origin: CLIENT_URL, credentials: true },
});
app.set('io', io);

// Middleware
app.use(cors({ origin: CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));

// Marshrutlar (Routes)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/reels', reelRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/users', userRoutes);

// 404 - Topilmadi
app.use((req, res) => res.status(404).json({ message: 'Маршрут не найден' }));

// Xatolarni ushlash (Error handling)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Ошибка сервера' });
});

// Socket handler
socketHandler(io);

// Bazaga ulanish va serverni ishga tushirish
connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`🌐 Ruxsat berilgan frontend manzili (CORS): ${CLIENT_URL}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB ulanishida xatolik yuz berdi:', err);
    process.exit(1); // Xato bo'lsa jarayonni to'xtatish
  });
