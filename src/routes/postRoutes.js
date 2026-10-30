const express = require('express');
const router = express.Router();
const { getPosts, createPost, likePost, getUserProfile } = require('../controllers/postController');
const auth = require('../middleware/auth');

router.get('/', auth, getPosts);
router.post('/', auth, createPost);
router.put('/:id/like', auth, likePost);
router.get('/profile/:username', auth, getUserProfile);

module.exports = router;