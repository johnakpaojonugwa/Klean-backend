import Payroll from "../models/payroll.model.js";
import Employee from "../models/employee.model.js";
import SalaryStructure from "../models/salaryStructure.model.js";
import { payrollService } from "../services/payrollService.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

// Process Payroll for Employee
export const processPayroll = async (req, res, next) => {
    try {
        const { employeeId, payrollMonth } = req.body;

        if (!employeeId || !payrollMonth) {
            return sendError(res, 400, "Employee ID and payroll month are required");
        }

        // Check if employee exists
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        // Check if salary structure exists
        if (!employee.salaryStructureId) {
            return sendError(res, 400, "Employee does not have a salary structure assigned");
        }

        // Check if payroll already exists for this month
        const existingPayroll = await Payroll.findOne({
            employeeId,
            payrollMonth: new Date(payrollMonth)
        });

        if (existingPayroll) {
            return sendError(res, 409, "Payroll already processed for this month");
        }

        // Calculate salary
        const salaryData = await payrollService.calculateSalary(employeeId, new Date(payrollMonth));

        // Create payroll record
        const payroll = await Payroll.create({
            employeeId,
            salaryStructureId: employee.salaryStructureId,
            branchId: employee.branchId,
            payrollMonth: new Date(payrollMonth),
            ...salaryData,
            processedBy: req.user.id
        });

        logger.info(`Payroll processed for employee ${employee.employeeNumber}`);

        return sendResponse(res, 201, true, "Payroll processed successfully", { payroll });
    } catch (error) {
        logger.error("Process payroll error:", error.message);
        next(error);
    }
};

// Process Payroll for Branch
export const processPayrollForBranch = async (req, res, next) => {
    try {
        const { branchId, payrollMonth } = req.body;

        if (!branchId || !payrollMonth) {
            return sendError(res, 400, "Branch ID and payroll month are required");
        }

        const payrolls = await payrollService.processPayrollForBranch(
            branchId,
            new Date(payrollMonth),
            req.user.id
        );

        logger.info(`Payroll processed for branch ${branchId}`);

        return sendResponse(res, 201, true, "Payroll processed for branch", {
            count: payrolls.length,
            payrolls
        });
    } catch (error) {
        logger.error("Process branch payroll error:", error.message);
        next(error);
    }
};

// Get Payroll Records
export const getPayrolls = async (req, res, next) => {
    try {
        const { employeeId, branchId, month, status, page = 1, limit = 10 } = req.query;

        // Validate and safe pagination parameters
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const skip = (pageNum - 1) * limitNum;

        let query = {};
        if (employeeId) query.employeeId = employeeId;
        if (branchId) query.branchId = branchId;
        if (status) query.paymentStatus = status;
        
        // Filter by month if provided
        if (month) {
            const [year, monthNum] = month.split('-');
            const startDate = new Date(year, monthNum - 1, 1);
            const endDate = new Date(year, monthNum, 0);
            query.payrollMonth = { $gte: startDate, $lte: endDate };
        }

        const payrolls = await Payroll.find(query)
            .populate('employeeId', 'employeeNumber')
            .populate('salaryStructureId')
            .skip(skip)
            .limit(limitNum)
            .sort({ payrollMonth: -1 });

        const total = await Payroll.countDocuments(query);

        return sendResponse(res, 200, true, "Payrolls retrieved", {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum),
            payrolls
        });
    } catch (error) {
        logger.error("Get payrolls error:", error.message);
        next(error);
    }
};

// Get Single Payroll
export const getPayroll = async (req, res, next) => {
    try {
        const { payrollId } = req.params;

        const payroll = await Payroll.findById(payrollId)
            .populate('employeeId')
            .populate('salaryStructureId')
            .populate('processedBy', 'fullname')
            .populate('approvedBy', 'fullname');

        if (!payroll) {
            return sendError(res, 404, "Payroll not found");
        }

        return sendResponse(res, 200, true, "Payroll retrieved", { payroll });
    } catch (error) {
        logger.error("Get payroll error:", error.message);
        next(error);
    }
};

// Approve Payroll
export const approvePayroll = async (req, res, next) => {
    try {
        const { payrollId } = req.params;

        const payroll = await Payroll.findByIdAndUpdate(
            payrollId,
            { $set: { paymentStatus: 'PROCESSED', approvedBy: req.user.id } },
            { new: true }
        ).populate('employeeId');

        if (!payroll) {
            return sendError(res, 404, "Payroll not found");
        }

        logger.info(`Payroll approved for employee ${payroll.employeeId.employeeNumber}`);

        return sendResponse(res, 200, true, "Payroll approved", { payroll });
    } catch (error) {
        logger.error("Approve payroll error:", error.message);
        next(error);
    }
};

// Mark Payroll as Paid
export const markPayrollAsPaid = async (req, res, next) => {
    try {
        const { payrollId } = req.params;
        const { paymentDate, paymentMethod, bankTransactionId } = req.body;

        const payroll = await Payroll.findByIdAndUpdate(
            payrollId,
            {
                $set: {
                    paymentStatus: 'PAID',
                    paymentDate,
                    paymentMethod,
                    bankTransactionId
                }
            },
            { new: true }
        ).populate('employeeId');

        if (!payroll) {
            return sendError(res, 404, "Payroll not found");
        }

        logger.info(`Payroll marked as paid for employee ${payroll.employeeId.employeeNumber}`);

        return sendResponse(res, 200, true, "Payroll marked as paid", { payroll });
    } catch (error) {
        logger.error("Mark payroll as paid error:", error.message);
        next(error);
    }
};

// Generate Salary Slip
export const generateSalarySlip = async (req, res, next) => {
    try {
        const { payrollId } = req.params;

        const slip = await payrollService.generateSalarySlip(payrollId);

        return sendResponse(res, 200, true, "Salary slip generated", { slip });
    } catch (error) {
        logger.error("Generate salary slip error:", error.message);
        next(error);
    }
};

// Create/Update Salary Structure
export const createSalaryStructure = async (req, res, next) => {
    try {
        const { name, branchId, baseSalary, ...otherFields } = req.body;

        if (!name || !branchId || !baseSalary) {
            return sendError(res, 400, "Name, branch, and base salary are required");
        }

        const salaryStructure = await SalaryStructure.create({
            name,
            branchId,
            baseSalary,
            ...otherFields,
            createdBy: req.user.id
        });

        logger.info(`Salary structure created: ${salaryStructure.name}`);

        return sendResponse(res, 201, true, "Salary structure created", { salaryStructure });
    } catch (error) {
        logger.error("Create salary structure error:", error.message);
        next(error);
    }
};

// Get Salary Structures
export const getSalaryStructures = async (req, res, next) => {
    try {
        const { branchId, isActive } = req.query;

        let query = {};
        if (branchId) query.branchId = branchId;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const structures = await SalaryStructure.find(query);

        return sendResponse(res, 200, true, "Salary structures retrieved", { structures });
    } catch (error) {
        logger.error("Get salary structures error:", error.message);
        next(error);
    }
};

// Update Salary Structure
export const updateSalaryStructure = async (req, res, next) => {
    try {
        const { structureId } = req.params;

        const structure = await SalaryStructure.findByIdAndUpdate(
            structureId,
            { $set: { ...req.body, updatedBy: req.user.id } },
            { new: true, runValidators: true }
        );

        if (!structure) {
            return sendError(res, 404, "Salary structure not found");
        }

        logger.info(`Salary structure updated: ${structure.name}`);

        return sendResponse(res, 200, true, "Salary structure updated", { structure });
    } catch (error) {
        logger.error("Update salary structure error:", error.message);
        next(error);
    }
};
