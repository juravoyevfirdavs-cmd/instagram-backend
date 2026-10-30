const Post = require('../models/Post');
const User = require('../models/User');

exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find().populate('user', 'username profilePic').sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.createPost = async (req, res) => {
  try {
    const { imageUrl, caption } = req.body;
    const newPost = new Post({ user: req.user.id, imageUrl, caption });
    await newPost.save();
    const populated = await newPost.populate('user', 'username profilePic');
    res.status(201).json(populated);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const index = post.likes.indexOf(req.user.id);
    if (index === -1) post.likes.push(req.user.id);
    else post.likes.splice(index, 1);
    await post.save();
    res.json({ likes: post.likes });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('-password');
    if (!user) return res.status(404).json({ message: 'User topilmadi' });
    const posts = await Post.find({ user: user._id }).sort({ createdAt: -1 });
    res.json({ user, posts });
  } catch (err) { res.status(500).json({ error: err.message }); }
};