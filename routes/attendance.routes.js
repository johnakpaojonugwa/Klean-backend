import express from 'express';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import {
    markAttendance,
    updateAttendance,
    getAttendance,
    getSingleAttendance,
    checkIn,
    checkOut,
    getAttendanceSummary,
    approveAttendance
} from '../controllers/attendance.controller.js';

const router = express.Router();

// Attendance Marking Routes
router.post('/mark', auth, markAttendance);
router.put('/:attendanceId', auth, updateAttendance);
router.get('/list', auth, getAttendance);
router.get('/:attendanceId', auth, getSingleAttendance);

// Digital Check-in/Check-out Routes
router.post('/checkin', auth, checkIn);
router.post('/checkout', auth, checkOut);

// Summary and Approval Routes
router.get('/summary/:employeeId', auth, getAttendanceSummary);
router.put('/:attendanceId/approve', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), approveAttendance);

export default router;
