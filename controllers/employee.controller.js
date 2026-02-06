import mongoose from "mongoose";
import Employee from "../models/employee.model.js";
import User from "../models/user.model.js";
import SalaryStructure from "../models/salaryStructure.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

// Create Employee
export const onboardEmployee = async (req, res, next) => {
    // Start a MongoDB Session for the Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            email, password, fullname, role, // User Data
            employeeJobRole, designation, department, branchId, joinDate, salaryStructureId, // Employee Data
            ...otherData
        } = req.body;
        // Validate salary structure if provided
        if (salaryStructureId) {
            const salaryStructure = await SalaryStructure.findById(salaryStructureId).session(session);
            if (!salaryStructure) {
                await session.abortTransaction();
                session.endSession();
                return sendError(res, 404, "Salary structure not found");
            }
        }
        // Inside onboardEmployee controller
        if (req.user.role === 'BRANCH_MANAGER' && role === 'SUPER_ADMIN') {
            await session.abortTransaction();
            session.endSession();
            return sendError(res, 403, "Managers cannot create Super Admin accounts");
        }

        // Create the User Account
        const [newUser] = await User.create([{
            email,
            password,
            fullname,
            role: role || 'STAFF', 
            branchId
        }], { session });

        // Create the Employee Profile linked to that User
        const [newEmployee] = await Employee.create([{
            userId: newUser._id,
            designation,
            department,
            branchId,
            joinDate,
            salaryStructureId,
            employeeJobRole,
            ...otherData
        }], { session });

        // If everything is successful, commit the changes to the DB
        await session.commitTransaction();
        session.endSession();

        logger.info(`Onboarded new employee: ${newEmployee.employeeNumber}`);

        return sendResponse(res, 201, true, "Employee onboarded successfully", {
            user: { id: newUser._id, email: newUser.email },
            employee: newEmployee
        });

    } catch (error) {
        // If ANY step fails, abort the transaction and undo all changes
        await session.abortTransaction();
        session.endSession();

        logger.error("Onboarding error, transaction rolled back:", error.message);

        // Handle duplicate email errors specifically
        if (error.code === 11000) {
            return sendError(res, 409, "Email or Employee Number already exists");
        }

        next(error);
    }
};

// Get All Employees
export const getAllEmployees = async (req, res, next) => {
    try {
        const { branchId, status, department, search, page = 1, limit = 10 } = req.query;

        let query = {};
        if (branchId) query.branchId = branchId;
        if (status) query.status = status;
        if (department) query.department = department;
        if (search) {
            query.$or = [
                { employeeNumber: { $regex: search, $options: 'i' } },
                { designation: { $regex: search, $options: 'i' } }
            ];
        }

        // RBAC: Only admins can see all, managers see their branch
        if (req.user.role === 'BRANCH_MANAGER') {
            query.branchId = req.user.branchId;
        }

        const skip = (page - 1) * limit;

        const employees = await Employee.find(query)
            .populate('userId', 'fullname email')
            .populate('salaryStructureId')
            .populate('reportingManagerId', 'fullname')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Employee.countDocuments(query);

        logger.info(`Fetched ${employees.length} employees`);

        return sendResponse(res, 200, true, "Employees retrieved", {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            employees
        });
    } catch (error) {
        logger.error("Get employees error:", error.message);
        next(error);
    }
};

// Get Single Employee
export const getEmployee = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        const employee = await Employee.findById(employeeId)
            .populate('userId', 'fullname email')
            .populate('salaryStructureId')
            .populate('reportingManagerId', 'fullname designation');

        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        logger.info(`Employee retrieved: ${employee.employeeNumber}`);

        return sendResponse(res, 200, true, "Employee retrieved", { employee });
    } catch (error) {
        logger.error("Get employee error:", error.message);
        next(error);
    }
};

// Update Employee
export const updateEmployee = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const updates = req.body;

        // Don't allow updating certain fields
        delete updates.employeeNumber;
        delete updates.userId;
        delete updates.joinDate;

        const employee = await Employee.findByIdAndUpdate(
            employeeId,
            { $set: updates },
            { new: true, runValidators: true }
        ).populate('userId').populate('salaryStructureId');

        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        logger.info(`Employee updated: ${employee.employeeNumber}`);

        return sendResponse(res, 200, true, "Employee updated successfully", { employee });
    } catch (error) {
        logger.error("Update employee error:", error.message);
        next(error);
    }
};

// Terminate Employee
export const terminateEmployee = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { terminationDate, terminationReason, exitNotes } = req.body;

        if (!terminationDate || !terminationReason) {
            return sendError(res, 400, "Termination date and reason are required");
        }

        const employee = await Employee.findByIdAndUpdate(
            employeeId,
            {
                $set: {
                    status: 'TERMINATED',
                    terminationDate,
                    terminationReason,
                    exitNotes
                }
            },
            { new: true }
        );

        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        logger.info(`Employee terminated: ${employee.employeeNumber}`);

        return sendResponse(res, 200, true, "Employee terminated successfully", { employee });
    } catch (error) {
        logger.error("Terminate employee error:", error.message);
        next(error);
    }
};

// Delete Employee
export const deleteEmployee = async (req, res, next) => {
    try {
        const { employeeId } = req.params;

        const employee = await Employee.findByIdAndDelete(employeeId);

        if (!employee) {
            return sendError(res, 404, "Employee not found");
        }

        logger.info(`Employee deleted: ${employee.employeeNumber}`);

        return sendResponse(res, 200, true, "Employee deleted successfully");
    } catch (error) {
        logger.error("Delete employee error:", error.message);
        next(error);
    }
};

// Get Employee By User ID
export const getEmployeeByUserId = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const employee = await Employee.findOne({ userId })
            .populate('userId')
            .populate('salaryStructureId')
            .populate('reportingManagerId');

        if (!employee) {
            return sendError(res, 404, "Employee record not found for this user");
        }

        return sendResponse(res, 200, true, "Employee retrieved", { employee });
    } catch (error) {
        logger.error("Get employee by user error:", error.message);
        next(error);
    }
};
