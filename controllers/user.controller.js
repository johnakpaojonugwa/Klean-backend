import User from "../models/user.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

// Get all users
export const getAllUsers = async (req, res, next) => {
    try {
        let query = {};

        // Role filtering based on user type
        if (req.user.role === "BRANCH_MANAGER") {
            // Branch managers should only see STAFF, not other managers or admins
            query.role = { $in: ['STAFF'] };
            // Convert branchId to ObjectId for proper MongoDB comparison
            if (req.user.branchId) {
                query.branchId = new mongoose.Types.ObjectId(req.user.branchId);
            }
        } else if (req.user.role === "SUPER_ADMIN") {
            // Super admins see all non-customer roles
            query.role = { $ne: 'CUSTOMER' };
            if (req.query.branchId) {
                query.branchId = new mongoose.Types.ObjectId(req.query.branchId);
            }
        }

        // Search Logic
        if (req.query.search) {
            query.$or = [
                { fullname: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Pagination Logic
        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100);
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            User.find(query)
                .select("-password -__v")
                .populate("branchId", "name location")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            User.countDocuments(query)
        ]);

        logger.info(`Users fetched by ${req.user.role}: ${users.length}`);

        return sendResponse(res, 200, true, "Users retrieved successfully", {
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            },
            employees: users
        });
    } catch (error) {
        logger.error("Get all users error:", error.message);
        next(error);
    }
};

// Get all customers
export const getCustomers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search = '' } = req.query;

        // Validate and safe pagination parameters
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const skip = (pageNum - 1) * limitNum;

        let query = { role: 'CUSTOMER' };

        // Branch isolation for Customers
        if (req.user.role === "BRANCH_MANAGER") {
            if (req.user.branchId) {
                // Only assigned customers
                query.branchId = new mongoose.Types.ObjectId(req.user.branchId);
            }
        }

        // Search by name or email
        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const [customers, total] = await Promise.all([
            User.find(query)
                .select("-password")
                .limit(limitNum)
                .skip(skip)
                .sort({ createdAt: -1 }),
            User.countDocuments(query)
        ]);

        return sendResponse(res, 200, true, "Customers retrieved successfully", {
            customers,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        logger.error("Get customers error:", error.message);
        next(error);
    }
};

// Get single user
export const getSingleUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select("-password").populate("branchId", "name");

        if (!user) {
            return sendError(res, 404, "User not found");
        }

        // Authorization checks
        const isOwnProfile = req.user.id === user._id.toString();
        const isSuperAdmin = req.user.role === "SUPER_ADMIN";
        const isBranchManager = req.user.role === "BRANCH_MANAGER" &&
            user.branchId?._id.toString() === req.user.branchId?.toString();

        if (isOwnProfile || isSuperAdmin || isBranchManager) {
            return sendResponse(res, 200, true, "User details retrieved", { user });
        }

        return sendError(res, 403, "Access denied: Unauthorized profile access");
    } catch (error) {
        next(error);
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { fullname, email, role, designation, department } = req.body;
        const avatar = req.files?.avatar?.[0]?.path;

        const user = await User.findById(userId);
        if (!user) return sendError(res, 404, "User not found");

        // Branch Manager Protection Logic
        if (req.user.role === "BRANCH_MANAGER") {
            if (user.branchId?.toString() !== req.user.branchId?.toString()) {
                return sendError(res, 403, "Managers can only update staff in their own branch");
            }
            if (user.role === "SUPER_ADMIN") {
                return sendError(res, 403, "Managers cannot modify Super Admins");
            }
        }

        // Prepare Updates
        const updates = {};
        if (fullname) updates.fullname = fullname.trim();
        if (email) updates.email = email.trim().toLowerCase();
        if (avatar) updates.avatar = avatar;
        if (designation) updates.designation = designation;
        if (department) updates.department = department;

        if (role && req.user.role === "SUPER_ADMIN") {
            updates.role = role;
        }

        if (Object.keys(updates).length === 0) return sendError(res, 400, "No changes detected");

        Object.assign(user, updates);
        await user.save();

        return sendResponse(res, 200, true, "Update successful", { user });
    } catch (error) {
        next(error);
    }
};

// Soft delete user (deactivate)
export const softDelete = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        
        if (!user) return sendError(res, 404, "User not found");

        // Protection: Can't deactivate yourself
        if (req.user.id === user._id.toString()) {
            return sendError(res, 400, "You cannot deactivate your own account");
        }

        // Branch Isolation for status change
        if (req.user.role === "BRANCH_MANAGER" && user.branchId?.toString() !== req.user.branchId?.toString()) {
            return sendError(res, 403, "You can only manage status for staff in your branch");
        }

        // Flip status logic
        user.status = user.status === "active" ? "inactive" : "active";
        await user.save();

        logger.info(`User ${userId} status set to ${user.status} by ${req.user.id}`);
        return sendResponse(res, 200, true, `Account status changed to ${user.status}`, { status: user.status });
    } catch (error) {
        next(error);
    }
};

// Permanent delete user
export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user) return sendError(res, 404, "User not found");

        if (req.user.role !== "SUPER_ADMIN") {
            return sendError(res, 403, "Hard deletion is restricted to SUPER_ADMIN");
        }

        if (req.user.id === user._id.toString()) {
            return sendError(res, 400, "Self-deletion is not permitted");
        }

        await user.deleteOne();
        return sendResponse(res, 200, true, "User permanently removed from system");
    } catch (error) {
        next(error);
    }
};
