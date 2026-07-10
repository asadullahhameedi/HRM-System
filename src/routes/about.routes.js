const express = require('express');
const router = express.Router();
const aboutController = require('../controllers/about.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', aboutController.index);

module.exports = router;
