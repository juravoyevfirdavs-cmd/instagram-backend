const express = require('express');
const router = express.Router();
const { register, login, getMe, searchUsers, getProfile, toggleFollow } = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getMe);
router.get('/search', auth, searchUsers);
router.get('/profile/:username', auth, getProfile);
router.put('/follow/:id', auth, toggleFollow);

module.exports = router;