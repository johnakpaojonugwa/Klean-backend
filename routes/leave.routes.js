import express from 'express';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import {
    createLeaveType,
    getLeaveTypes,
    requestLeave,
    getLeaves,
    getLeave,
    approveLeave,
    rejectLeave,
    cancelLeave,
    getLeaveBalance
} from '../controllers/leave.controller.js';

const router = express.Router();

// Leave Type Routes
router.post('/type/create', auth, authorize('SUPER_ADMIN'), createLeaveType);
router.get('/type/list', auth, getLeaveTypes);

// Leave Request Routes
router.post('/request', auth, requestLeave);
router.get('/list', auth, getLeaves);
router.get('/:leaveId', auth, getLeave);
router.put('/:leaveId/approve', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), approveLeave);
router.put('/:leaveId/reject', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), rejectLeave);
router.put('/:leaveId/cancel', auth, cancelLeave);

// Leave Balance Route
router.get('/balance/:employeeId', auth, getLeaveBalance);

export default router;
