const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

const USER_FIELDS = 'username fullName avatar isOnline lastSeen';

const populateChat = (query) =>
  query.populate('participants', USER_FIELDS).populate({
    path: 'lastMessage',
    populate: { path: 'sender', select: 'username' },
  });

const findUserChat = (chatId, userId) =>
  Chat.findOne({ _id: chatId, participants: userId });

// GET /api/chats — список чатов текущего пользователя
exports.getChats = async (req, res) => {
  try {
    const chats = await populateChat(
      Chat.find({ participants: req.user._id }).sort({ updatedAt: -1 })
    );

    const unread = await Message.aggregate([
      {
        $match: {
          chat: { $in: chats.map((c) => c._id) },
          sender: { $ne: req.user._id },
          readBy: { $ne: req.user._id },
        },
      },
      { $group: { _id: '$chat', count: { $sum: 1 } } },
    ]);
    const unreadMap = Object.fromEntries(unread.map((u) => [u._id.toString(), u.count]));

    res.json({
      chats: chats.map((c) => ({
        ...c.toObject(),
        unreadCount: unreadMap[c._id.toString()] || 0,
      })),
    });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// POST /api/chats { userId } — открыть (или создать) диалог с пользователем
exports.accessChat = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Некорректный userId' });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'Нельзя создать чат с самим собой' });
    }
    const other = await User.findById(userId);
    if (!other) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }

    let chat = await populateChat(
      Chat.findOne({
        participants: { $all: [req.user._id, other._id], $size: 2 },
      })
    );

    if (!chat) {
      const created = await Chat.create({ participants: [req.user._id, other._id] });
      chat = await populateChat(Chat.findById(created._id));
    }

    res.json({ chat: { ...chat.toObject(), unreadCount: 0 } });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// GET /api/chats/:chatId/messages?before=<ISO date>&limit=30
exports.getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ message: 'Некорректный chatId' });
    }
    const chat = await findUserChat(chatId, req.user._id);
    if (!chat) {
      return res.status(404).json({ message: 'Чат не найден' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const filter = { chat: chatId };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'username avatar');

    res.json({ messages: messages.reverse(), hasMore: messages.length === limit });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};

// Общая логика отправки — используется и в REST, и в сокетах
exports.createMessage = async (userId, chatId, text) => {
  const clean = (text || '').trim();
  if (!clean) throw Object.assign(new Error('Пустое сообщение'), { status: 400 });
  if (!mongoose.isValidObjectId(chatId)) {
    throw Object.assign(new Error('Некорректный chatId'), { status: 400 });
  }

  const chat = await findUserChat(chatId, userId);
  if (!chat) throw Object.assign(new Error('Чат не найден'), { status: 404 });

  const message = await Message.create({
    chat: chatId,
    sender: userId,
    text: clean,
    readBy: [userId],
  });
  chat.lastMessage = message._id;
  await chat.save();

  await message.populate('sender', 'username avatar');
  return { message, chat };
};

// POST /api/chats/:chatId/messages { text }
exports.sendMessage = async (req, res) => {
  try {
    const { message, chat } = await exports.createMessage(
      req.user._id,
      req.params.chatId,
      req.body.text
    );

    const io = req.app.get('io');
    if (io) {
      chat.participants.forEach((p) => io.to(p.toString()).emit('message:new', message));
    }

    res.status(201).json({ message });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Ошибка сервера' });
  }
};

// PUT /api/chats/:chatId/read — отметить сообщения прочитанными
exports.markAsRead = async (req, res) => {
  try {
    const chat = await findUserChat(req.params.chatId, req.user._id);
    if (!chat) return res.status(404).json({ message: 'Чат не найден' });

    await Message.updateMany(
      { chat: chat._id, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    const io = req.app.get('io');
    if (io) {
      chat.participants.forEach((p) =>
        io.to(p.toString()).emit('message:read', {
          chatId: chat._id.toString(),
          userId: req.user._id.toString(),
        })
      );
    }

    res.json({ ok: true });
  } catch {
    res.status(500).json({ message: 'Ошибка сервера' });
  }
};
