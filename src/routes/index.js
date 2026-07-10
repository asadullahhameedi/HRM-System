const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, (req, res) => res.redirect('/dashboard'));

module.exports = router;
