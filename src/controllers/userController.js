const User = require('../models/User');
const Post = require('../models/Post');

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', 'username avatar')
      .populate('following', 'username avatar');

    if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

    const postsCount = await Post.countDocuments({ user: user._id });
    const posts = await Post.find({ user: user._id })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('user', 'username avatar');

    const isFollowing = user.followers.some(f => f._id.toString() === req.user._id.toString());

    res.json({
      user: { ...user.toObject(), postsCount },
      posts,
      isFollowing,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.followUser = async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString())
      return res.status(400).json({ message: 'O\'zingizni obuna bo\'lolmaysiz' });

    const target = await User.findById(targetId);
    const me = await User.findById(req.user._id);
    if (!target) return res.status(404).json({ message: 'Topilmadi' });

    const idx = me.following.indexOf(targetId);
    if (idx > -1) {
      me.following.splice(idx, 1);
      const fIdx = target.followers.indexOf(req.user._id);
      if (fIdx > -1) target.followers.splice(fIdx, 1);
    } else {
      me.following.push(targetId);
      target.followers.push(req.user._id);
    }

    await me.save();
    await target.save();
    res.json({ following: idx === -1, followersCount: target.followers.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const allowed = ['fullName', 'bio', 'avatar', 'website', 'phone', 'gender', 'isPrivate', 'notificationsEnabled', 'language'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getSuggestedUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id);
    const users = await User.find({
      _id: { $nin: [...me.following, me._id] },
    })
      .select('username fullName avatar bio followers')
      .limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'Topilmadi' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};