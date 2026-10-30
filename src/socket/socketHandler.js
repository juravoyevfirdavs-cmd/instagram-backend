const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const { createMessage } = require('../controllers/chatController');

// userId -> количество открытых вкладок/подключений
const onlineUsers = new Map();

const socketHandler = (io) => {
  // Авторизация сокета по JWT: io({ auth: { token } })
  io.use(async (socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      if (!token) return next(new Error('Нет токена'));
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(id);
      if (!user) return next(new Error('Пользователь не найден'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Недействительный токен'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // Личная комната пользователя — все события ему шлём сюда
    socket.join(userId);

    const count = (onlineUsers.get(userId) || 0) + 1;
    onlineUsers.set(userId, count);
    if (count === 1) {
      await User.findByIdAndUpdate(userId, { isOnline: true });
      socket.broadcast.emit('user:online', { userId });
    }

    socket.emit('users:online', [...onlineUsers.keys()]);

    // Отправка сообщения
    socket.on('message:send', async ({ chatId, text } = {}, ack) => {
      try {
        const { message, chat } = await createMessage(userId, chatId, text);
        chat.participants.forEach((p) => io.to(p.toString()).emit('message:new', message));
        if (typeof ack === 'function') ack({ ok: true, message });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    // Индикатор «печатает…»
    const relayTyping = (event) => async ({ chatId } = {}) => {
      try {
        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) return;
        chat.participants
          .filter((p) => p.toString() !== userId)
          .forEach((p) => io.to(p.toString()).emit(event, { chatId, userId }));
      } catch {
        /* игнорируем некорректный chatId */
      }
    };
    socket.on('typing:start', relayTyping('typing:start'));
    socket.on('typing:stop', relayTyping('typing:stop'));

    socket.on('disconnect', async () => {
      const left = (onlineUsers.get(userId) || 1) - 1;
      if (left > 0) {
        onlineUsers.set(userId, left);
        return;
      }
      onlineUsers.delete(userId);
      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen });
      socket.broadcast.emit('user:offline', { userId, lastSeen });
    });
  });
};

module.exports = socketHandler;
