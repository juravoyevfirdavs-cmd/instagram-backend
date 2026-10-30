const router = require('express').Router();
const auth = require('../middleware/auth');
const ctrl = require('../controllers/userController');

router.use(auth);

router.put('/profile', ctrl.updateProfile);
router.get('/suggested', ctrl.getSuggestedUsers);
router.get('/:id', ctrl.getUserById);
router.get('/profile/:username', ctrl.getProfile);
router.put('/:id/follow', ctrl.followUser);

module.exports = router;