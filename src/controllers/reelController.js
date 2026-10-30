const Reel = require('../models/Reel');

// Barcha videolarni olish
exports.getReels = async (req, res) => {
  try {
    const reels = await Reel.find()
      .populate('user', 'username profilePic')
      .populate('comments.user', 'username profilePic')
      .sort({ createdAt: -1 });
    res.json(reels);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Yangi video qo'shish
exports.createReel = async (req, res) => {
  try {
    const { videoUrl, caption } = req.body;
    const newReel = new Reel({ user: req.user.id, videoUrl, caption });
    await newReel.save();
    const populatedReel = await newReel.populate('user', 'username profilePic');
    res.status(201).json(populatedReel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// LAYK BOSISH / LAYKNI OLIB TASHLASH (Toggle)
exports.toggleLike = async (req, res) => {
  try {
    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Video topilmadi" });

    const userId = req.user.id;
    // Agar foydalanuvchi layk bosgan bo'lsa, olib tashlaymiz. Bo'lmasa qo'shamiz.
    const index = reel.likes.indexOf(userId);
    if (index === -1) {
      reel.likes.push(userId);
    } else {
      reel.likes.splice(index, 1);
    }

    await reel.save();
    res.json({ likes: reel.likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// KOMENTARIYA YOZISH
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ message: "Izoh bo'sh bo'lishi mumkin emas" });

    const reel = await Reel.findById(req.params.id);
    if (!reel) return res.status(404).json({ message: "Video topilmadi" });

    const newComment = {
      user: req.user.id,
      text: text
    };

    reel.comments.push(newComment);
    await reel.save();

    // Yangi komentariyani foydalanuvchi ma'lumotlari bilan qaytarish
    const updatedReel = await Reel.findById(req.params.id).populate('comments.user', 'username profilePic');
    const addedComment = updatedReel.comments[updatedReel.comments.length - 1];
    
    res.status(201).json(addedComment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};