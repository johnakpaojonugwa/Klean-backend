import express from 'express';
import { auth, authorize } from '../middlewares/authMiddleware.js';
import {
    processPayroll,
    processPayrollForBranch,
    getPayrolls,
    getPayroll,
    approvePayroll,
    markPayrollAsPaid,
    generateSalarySlip,
    createSalaryStructure,
    getSalaryStructures,
    updateSalaryStructure
} from '../controllers/payroll.controller.js';

const router = express.Router();

// Salary Structure Routes
router.post('/structure/create', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), createSalaryStructure);
router.get('/structure/list', auth, getSalaryStructures);
router.put('/structure/:structureId', auth, authorize('SUPER_ADMIN'), updateSalaryStructure);

// Payroll Routes
router.post('/process', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), processPayroll);
router.post('/process-branch', auth, authorize('SUPER_ADMIN'), processPayrollForBranch);
router.get('/list', auth, getPayrolls);
router.get('/:payrollId', auth, getPayroll);
router.put('/:payrollId/approve', auth, authorize('SUPER_ADMIN'), approvePayroll);
router.put('/:payrollId/mark-paid', auth, authorize('SUPER_ADMIN'), markPayrollAsPaid);
router.get('/:payrollId/salary-slip', auth, generateSalarySlip);

export default router;
