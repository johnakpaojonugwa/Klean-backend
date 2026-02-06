import express from 'express';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import {
    onboardEmployee,
    getAllEmployees,
    getEmployee,
    updateEmployee,
    terminateEmployee,
    deleteEmployee,
    getEmployeeByUserId
} from '../controllers/employee.controller.js';

const router = express.Router();

// Create Employee (SUPER_ADMIN, BRANCH_MANAGER)
router.post('/', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), onboardEmployee);

// Get All Employees
router.get('/', auth, getAllEmployees);

// Get Employee by User ID
router.get('/user/:userId', auth, getEmployeeByUserId);

// Get Single Employee
router.get('/:employeeId', auth, getEmployee);

// Update Employee
router.put('/:employeeId', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), updateEmployee);

// Terminate Employee (SUPER_ADMIN and BRANCH_MANAGER)
router.post('/:employeeId/terminate', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), terminateEmployee);

// Delete Employee (SUPER_ADMIN only)
router.delete('/:employeeId', auth, authorize('SUPER_ADMIN'), deleteEmployee);

export default router;
