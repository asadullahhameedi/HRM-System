const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { isAuthenticated } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const { attendanceRules, attendanceUpdateRules, leaveRules, leaveUpdateRules, leaveReviewRules, holidayRules } = require('../validators/attendance.validator');

router.use(isAuthenticated);

// Attendance
router.get('/attendance', requireRole('admin', 'hr'), attendanceController.index);
router.post('/attendance', requireRole('admin', 'hr'), attendanceRules, validate, attendanceController.store);
router.put('/attendance/:id', requireRole('admin', 'hr'), attendanceUpdateRules, validate, attendanceController.update);
router.delete('/attendance/:id', requireRole('admin', 'hr'), attendanceController.destroy);

// Leave
router.get('/leave', attendanceController.leaveIndex);
router.post('/leave', leaveRules, validate, attendanceController.leaveStore);
router.put('/leave/:id', leaveUpdateRules, validate, attendanceController.leaveUpdate);
router.delete('/leave/:id', attendanceController.leaveDestroy);
router.post('/leave/:id/review', requireRole('admin', 'hr'), leaveReviewRules, validate, attendanceController.leaveReview);

// Holidays
router.get('/holidays', requireRole('admin', 'hr'), attendanceController.holidayIndex);
router.post('/holidays', requireRole('admin', 'hr'), holidayRules, validate, attendanceController.holidayStore);
router.put('/holidays/:id', requireRole('admin', 'hr'), holidayRules, validate, attendanceController.holidayUpdate);
router.delete('/holidays/:id', requireRole('admin', 'hr'), attendanceController.holidayDestroy);

module.exports = router;
