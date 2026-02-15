import User from "../models/user.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

// Get all users
export const getAllUsers = async (req, res, next) => {
    try {
        let query = {};

        // Branch isolation for managers
        if (req.user.role === "BRANCH_MANAGER") {
            query.branchId = req.user.branchId;
        }

        // Only SUPER_ADMIN & BRANCH_MANAGER allowed
        if (!["SUPER_ADMIN", "BRANCH_MANAGER"].includes(req.user.role)) {
            return sendError(res, 403, "You are not authorized to view users");
        }

        const users = await User.find(query).select("-password");

        if (!users.length) {
            return sendError(res, 404, "No users found");
        }

        logger.info(`Users fetched: ${users.length}`);
        return sendResponse(res, 200, true, "Users retrieved successfully", {
            total: users.length,
            users
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

        // Search by name or email
        if (search) {
            query.$or = [
                { fullname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const customers = await User.find(query)
            .select("-password")
            .limit(limitNum)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await User.countDocuments(query);

        logger.info(`Customers fetched: ${customers.length}`);
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

        const user = await User.findById(userId).select("-password");

        if (!user) {
            return sendError(res, 404, "User not found");
        }

        // Allow user to view own profile
        if (req.user.id === user._id.toString()) {
            logger.info(`User ${userId} accessed own profile`);
            return sendResponse(res, 200, true, "User retrieved", { user });
        }

        // SUPER_ADMIN can view anyone
        if (req.user.role === "SUPER_ADMIN") {
            logger.info(`SUPER_ADMIN accessed user ${userId}`);
            return sendResponse(res, 200, true, "User retrieved", { user });
        }

        // Branch isolation for managers
        if (
            req.user.role === "BRANCH_MANAGER" &&
            user.branchId?.toString() === req.user.branchId?.toString()
        ) {
            logger.info(`Branch manager accessed user ${userId} in their branch`);
            return sendResponse(res, 200, true, "User retrieved", { user });
        }

        return sendError(res, 403, "You are not authorized to view this user");
    } catch (error) {
        logger.error("Get single user error:", error.message);
        next(error);
    }
};

export const updateUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { fullname, email, role } = req.body || {};
        const avatar = req.files?.avatar?.[0]?.path;
        
        const updates = {};

        if (fullname) updates.fullname = fullname.trim();
        if (email) updates.email = email.trim().toLowerCase();
        if (avatar) updates.avatar = avatar;

        // Only SUPER_ADMIN can change roles
        if (role) {
            if (req.user.role !== "SUPER_ADMIN") {
                return sendError(res, 403, "Only SUPER_ADMIN can change user roles");
            }
            updates.role = role;
        }

        if (Object.keys(updates).length === 0) {
            return sendError(res, 400, "No fields to update");
        }

        // Fetch user first for authorization checks
        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 404, "User not found");
        }

        // Branch isolation: managers can only manage their branch
        if (
            req.user.role === "BRANCH_MANAGER" &&
            user.branchId?.toString() !== req.user.branchId?.toString()
        ) {
            return sendError(res, 403, "You can only update users in your branch");
        }

        // Apply updates
        Object.assign(user, updates);
        await user.save();

        logger.info(`User ${userId} updated successfully`);
        return sendResponse(res, 200, true, "User updated successfully", {
            user: user.toJSON()
        });

    } catch (error) {
        logger.error("Update user error:", error.message);
        next(error);
    }
};

export const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return sendError(res, 404, "User not found");
        }

        // SUPER_ADMIN protection
        if (user.role === "SUPER_ADMIN" && req.user.role !== "SUPER_ADMIN") {
            return sendError(res, 403, "You cannot delete a SUPER_ADMIN");
        }

        // Branch isolation
        if (
            req.user.role === "BRANCH_MANAGER" &&
            user.branchId?.toString() !== req.user.branchId?.toString()
        ) {
            return sendError(res, 403, "You can only delete users in your branch");
        }

        // Self-deletion protection
        if (req.user.id === user._id.toString()) {
            return sendError(res, 403, "You cannot delete your own account");
        }

        await user.deleteOne();

        logger.info(`User ${userId} deleted successfully`);
        return sendResponse(res, 200, true, "User deleted successfully");

    } catch (error) {
        logger.error("Delete user error:", error.message);
        next(error);
    }
};
