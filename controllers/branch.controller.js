import Branch from "../models/branch.model.js";
import User from "../models/user.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const createBranch = async (req, res, next) => {
    try {
        const { name, address, email, contactNumber, manager, branchCode, servicesOffered, operatingHours } = req.body;

        // Validate branch doesn't exist
        const existingBranch = await Branch.findOne({ $or: [{ name }, { branchCode }] });
        if (existingBranch) {
            return sendError(res, 409, "Branch with this name already exists");
        }

        // Validate manager exists if provided
        if (manager) {
            const managerUser = await User.findById(manager);
            if (!managerUser) {
                return sendError(res, 404, "Manager user not found");
            }
        }

        const branch = await Branch.create({
            name,
            address,
            email,
            contactNumber,
            manager,
            branchCode,
            servicesOffered,
            operatingHours
        });

        logger.info(`Branch created: ${branch.name} (${branch.branchCode})`);
        return sendResponse(res, 201, true, "Branch created successfully", { branch });
    } catch (error) {
        logger.error("Create branch error:", error.message);
        next(error);
    }
};

export const getAllBranches = async (req, res, next) => {
    try {
        const { isActive, page = 1, limit = 10 } = req.query;

        let query = {};
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const skip = (page - 1) * limit;
        const branches = await Branch.find(query)
            .populate('manager', 'fullname email')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Branch.countDocuments(query);

        logger.info(`Branches fetched: ${branches.length}`);
        return sendResponse(res, 200, true, "Branches retrieved", {
            branches,
            pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error("Get all branches error:", error.message);
        next(error);
    }
};

export const getBranchById = async (req, res, next) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findById(branchId).populate('manager', 'fullname email');

        if (!branch) {
            return sendError(res, 404, "Branch not found");
        }

        return sendResponse(res, 200, true, "Branch retrieved", { branch });
    } catch (error) {
        logger.error("Get branch error:", error.message);
        next(error);
    }
};

export const updateBranch = async (req, res, next) => {
    try {
        const { branchId } = req.params;
        const { name, address, contactNumber, manager, isActive, servicesOffered, operatingHours } = req.body;

        const branch = await Branch.findByIdAndUpdate(
            branchId,
            { name, address, contactNumber, manager, isActive, servicesOffered, operatingHours },
            { new: true, runValidators: true }
        ).populate('manager', 'fullname email');

        if (!branch) {
            return sendError(res, 404, "Branch not found");
        }

        logger.info(`Branch updated: ${branch.name}`);
        return sendResponse(res, 200, true, "Branch updated successfully", { branch });
    } catch (error) {
        logger.error("Update branch error:", error.message);
        next(error);
    }
};

export const deleteBranch = async (req, res, next) => {
    try {
        const { branchId } = req.params;

        const branch = await Branch.findByIdAndDelete(branchId);

        if (!branch) {
            return sendError(res, 404, "Branch not found");
        }

        logger.info(`Branch deleted: ${branch.name}`);
        return sendResponse(res, 200, true, "Branch deleted successfully");
    } catch (error) {
        logger.error("Delete branch error:", error.message);
        next(error);
    }
};
