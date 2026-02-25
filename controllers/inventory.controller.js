import Inventory from "../models/inventory.model.js";
import StockLog from "../models/stockLog.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

// Add Inventory Item
export const addInventoryItem = async (req, res, next) => {
    try {
        const { branchId, itemName, category, currentStock, unit, reorderLevel, supplierContact, lastRestocked } = req.body;

        const item = await Inventory.create({
            branchId,
            itemName,
            category,
            currentStock,
            unit,
            reorderLevel,
            supplierContact,
            lastRestocked,
        });

        logger.info(`Inventory item added: ${itemName} in branch ${branchId}`);
        return sendResponse(res, 201, true, "Inventory item created", { item });
    } catch (error) {
        logger.error("Add inventory item error:", error.message);
        next(error);
    }
};

// Adjust Stock Levels
export const adjustStock = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { itemId } = req.params;
        const { amount, changeType, reason, orderId } = req.body;

        // Fetch item within session to prevent race conditions
        const item = await Inventory.findById(itemId).session(session);
        if (!item) {
            await session.abortTransaction();
            return sendError(res, 404, "Inventory item not found");
        }

        // Prevent negative stock levels
        if (amount < 0 && (item.currentStock + amount) < 0) {
            await session.abortTransaction();
            return sendError(res, 400, "Insufficient stock", [
                `Current level: ${item.currentStock} ${item.unit}. Requested reduction: ${Math.abs(amount)}`
            ]);
        }

        // Automatic Timestamp
        if (amount > 0) {
            item.lastRestocked = new Date();
        };

        // Update stock and reorder flag
        item.currentStock += amount;
        item.reorderPending = item.currentStock <= item.reorderLevel;
        await item.save({ session });

        // Create Stock Log (Audit Trail)
        await StockLog.create([{
            inventoryId: item._id,
            branchId: item.branchId,
            performedBy: req.user.id,
            changeType: changeType || (amount > 0 ? 'RESTOCK' : 'USAGE'),
            quantityChanged: amount,
            newStockLevel: item.currentStock,
            reason: reason || "Manual Adjustment",
            orderId
        }], { session });

        await session.commitTransaction();

        logger.info(`Stock adjusted for ${item.itemName}: ${amount > 0 ? '+' : ''}${amount} by User ${req.user.id}`);
        return sendResponse(res, 200, true, "Stock adjusted successfully", { item });

    } catch (error) {
        await session.abortTransaction();
        logger.error("Adjust stock error:", error.message);
        next(error);
    } finally {
        session.endSession();
    }
};

// Get Inventory by Branch with Filters
export const getInventoryByBranch = async (req, res, next) => {
    try {
        const { branchId } = req.params;
        const { category, page = 1, limit = 10, lowStock = false } = req.query;

        let query = { branchId };
        if (category) query.category = category;
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$currentStock', '$reorderLevel'] };
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const [items, total] = await Promise.all([
            Inventory.find(query)
                .populate('branchId', 'name')
                .limit(limitNum)
                .skip((pageNum - 1) * limitNum)
                .sort({ currentStock: 1 }), // Sort by lowest stock first
            Inventory.countDocuments(query)
        ]);

        return sendResponse(res, 200, true, "Inventory items retrieved", {
            items,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        next(error);
    }
};

// Update Inventory Item
export const updateInventoryItem = async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const {
            itemName,
            category,
            sku,
            unit,
            costPerUnit,
            reorderLevel,
            supplierContact,
            lastRestocked
        } = req.body;

        const item = await Inventory.findByIdAndUpdate(
            itemId,
            {
                itemName,
                category,
                sku,
                unit,
                costPerUnit,
                reorderLevel,
                supplierContact,
                lastRestocked
            },
            { new: true, runValidators: true }
        ).populate('branchId', 'name');

        if (!item) {
            return sendError(res, 404, "Inventory item not found");
        }

        const isLow = item.currentStock <= item.reorderLevel;
        if (item.reorderPending !== isLow) {
            item.reorderPending = isLow;
            await item.save();
        }

        logger.info(`Inventory item [${item.itemName}] updated at branch [${item.branchId.name}]`);

        return sendResponse(res, 200, true, "Inventory item updated successfully", { item });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return sendError(res, 400, "Invalid unit or category selection");
        }
        next(error);
    }
};

// Delete Inventory Item
export const deleteInventoryItem = async (req, res, next) => {
    try {
        const { itemId } = req.params;

        const item = await Inventory.findByIdAndDelete(itemId);

        if (!item) {
            return sendError(res, 404, "Inventory item not found");
        }

        logger.info(`Inventory item deleted: ${item.itemName}`);
        return sendResponse(res, 200, true, "Inventory item deleted");
    } catch (error) {
        logger.error("Delete inventory item error:", error.message);
        next(error);
    }
};

export const getLowStockItems = async (req, res, next) => {
    try {
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;
        const items = await Inventory.find({
            $expr: { $lte: ['$currentStock', '$reorderLevel'] }
        })
            .populate('branchId', 'name')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ currentStock: 1 });

        const total = await Inventory.countDocuments({
            $expr: { $lte: ['$currentStock', '$reorderLevel'] }
        });

        logger.info(`Low stock items fetched: ${items.length}`);
        return sendResponse(res, 200, true, "Low stock items retrieved", {
            items,
            pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error("Get low stock items error:", error.message);
        next(error);
    }
};
