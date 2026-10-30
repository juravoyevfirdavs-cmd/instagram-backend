const express = require('express');
const router = express.Router();
const { getReels, createReel, toggleLike, addComment } = require('../controllers/reelController');
const auth = require('../middleware/auth');

router.get('/', auth, getReels);
router.post('/', auth, createReel);
router.put('/:id/like', auth, toggleLike); // Layk uchun
router.post('/:id/comment', auth, addComment); // Komentariya uchun

module.exports = router;