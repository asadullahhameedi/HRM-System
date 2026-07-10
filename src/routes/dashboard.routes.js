const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);
router.get('/', dashboardController.index);

module.exports = router;
