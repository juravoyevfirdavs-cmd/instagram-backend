const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Post = require('../models/Post'); 

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

exports.register = async (req, res) => {
  try {
    const { email, username, password, fullName } = req.body;

    // Email va username tekshiruvi
    if (await User.findOne({ email }))
      return res.status(400).json({ message: 'Bu email allaqachon ro\'yxatdan o\'tgan' });
    if (await User.findOne({ username }))
      return res.status(400).json({ message: 'Bu username band' });

    // Yangi foydalanuvchi yaratish
    const user = await User.create({ email, username, password, fullName });
    
    // Javob qaytarishda parolni olib tashlaymiz
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({ token: generateToken(user._id), user: userResponse });
  } catch (err) {
    console.error("Register xatosi:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;
    
    // Bazadan foydalanuvchini paroli bilan birga olamiz
    const user = await User.findOne({
      $or: [{ email: login?.toLowerCase() }, { username: login?.toLowerCase() }],
    }).select('+password');

    if (!user) {
      return res.status(401).json({ message: 'Login yoki parol noto\'g\'ri' });
    }

    // Parolni tekshiramiz
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Login yoki parol noto\'g\'ri' });
    }

    // Javobda parolni yubormaymiz
    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({ token: generateToken(user._id), user: userResponse });
  } catch (err) {
    console.error("Login xatosi:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.searchUsers = async (req, res) => {
  try {
    const { search, query } = req.query;
    const q = search || query || '';
    if (!q.trim()) return res.json({ users: [] });

    const users = await User.find({
      $and: [
        { _id: { $ne: req.user._id } },
        {
          $or: [
            { username: { $regex: q, $options: 'i' } },
            { fullName: { $regex: q, $options: 'i' } },
          ],
        },
      ],
    }).select('username fullName avatar bio').limit(20);

    res.json({ users, results: users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username })
      .select('-password')
      .populate('followers', 'username profilePic')
      .populate('following', 'username profilePic');
      
    if (!user) return res.status(404).json({ message: 'Foydalanuvchi topilmadi' });

    const posts = await Post.find({ user: user._id }).sort({ createdAt: -1 });

    res.json({ user, posts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.toggleFollow = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: "O'zingizga obuna bo'la olmaysiz" });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ message: "Foydalanuvchi topilmadi" });
    }

    const isFollowing = currentUser.following.includes(targetUserId);

    if (isFollowing) {
      currentUser.following.pull(targetUserId);
      targetUser.followers.pull(currentUserId);
    } else {
      currentUser.following.push(targetUserId);
      targetUser.followers.push(currentUserId);
    }

    await currentUser.save();
    await targetUser.save();

    res.json({ 
      isFollowing: !isFollowing, 
      followersCount: targetUser.followers.length 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};