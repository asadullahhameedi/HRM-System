const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const { isAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(isAuthenticated);
router.get('/', profileController.profile);
router.post('/', upload.single('avatar'), profileController.updateProfile);
router.post('/password', profileController.changePassword);

module.exports = router;
