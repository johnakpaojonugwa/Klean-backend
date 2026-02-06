import Inventory from "../models/inventory.model.js";
import StockLog from "../models/stockLog.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const addInventoryItem = async (req, res, next) => {
    try {
        const { branchId, itemName, category, currentStock, unit, reorderLevel, supplierContact } = req.body;

        const item = await Inventory.create({
            branchId,
            itemName,
            category,
            currentStock,
            unit,
            reorderLevel,
            supplierContact
        });

        logger.info(`Inventory item added: ${itemName} in branch ${branchId}`);
        return sendResponse(res, 201, true, "Inventory item created", { item });
    } catch (error) {
        logger.error("Add inventory item error:", error.message);
        next(error);
    }
};

export const adjustStock = async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const { amount, changeType, reason, orderId } = req.body;

        // Fetch item first to get current stock
        const currentItem = await Inventory.findById(itemId);
        if (!currentItem) {
            return sendError(res, 404, "Inventory item not found");
        }

        // Check if adjustment would go negative
        if (amount < 0 && (currentItem.currentStock + amount) < 0) {
            return sendError(
                res,
                400,
                "Insufficient stock",
                [`Cannot reduce stock below 0. Available: ${currentItem.currentStock} ${currentItem.unit}`]
            );
        }

        // Use ATOMIC operation to avoid race conditions
        const updatedItem = await Inventory.findByIdAndUpdate(
            itemId,
            {
                $inc: { currentStock: amount },
                $set: {
                    reorderPending: (currentItem.currentStock + amount) <= currentItem.reorderLevel,
                    updatedAt: new Date()
                }
            },
            { new: true, runValidators: false }
        ).select('-__v');

        if (!updatedItem) {
            return sendError(res, 404, "Inventory item not found");
        }

        // Verify the operation didn't result in negative stock
        if (updatedItem.currentStock < 0) {
            // Rollback if somehow it went negative 
            await Inventory.findByIdAndUpdate(itemId, {
                $inc: { currentStock: -amount }
            });
            return sendError(
                res,
                400,
                "Insufficient stock for this adjustment"
            );
        }

        // Create the log entry - this tracks the change
        await StockLog.create({
            inventoryId: updatedItem._id,
            branchId: updatedItem.branchId,
            performedBy: req.user.id,
            changeType: changeType || (amount > 0 ? 'RESTOCK' : 'USAGE'),
            quantityChanged: amount,
            newStockLevel: updatedItem.currentStock,
            reason,
            orderId
        });

        logger.info(`Stock adjusted for ${updatedItem.itemName}: ${amount > 0 ? '+' : ''}${amount} (New level: ${updatedItem.currentStock})`);
        return sendResponse(res, 200, true, "Stock adjusted successfully", { item: updatedItem });

    } catch (error) {
        logger.error("Adjust stock error:", error.message);
        next(error);
    }
};

export const getInventoryByBranch = async (req, res, next) => {
    try {
        const { branchId } = req.params;
        const { category, page = 1, limit = 10, lowStock = false } = req.query;

        let query = { branchId };
        if (category) query.category = category;
        if (lowStock === 'true') {
            query.$expr = { $lte: ['$currentStock', '$reorderLevel'] };
        }

        const skip = (page - 1) * limit;
        const items = await Inventory.find(query)
            .populate('branchId', 'name')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Inventory.countDocuments(query);

        logger.info(`Inventory items fetched from branch ${branchId}: ${items.length}`);
        return sendResponse(res, 200, true, "Inventory items retrieved", {
            items,
            pagination: { total, page: parseInt(page), pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        logger.error("Get inventory error:", error.message);
        next(error);
    }
};

export const updateInventoryItem = async (req, res, next) => {
    try {
        const { itemId } = req.params;
        const { currentStock, reorderLevel, supplierContact } = req.body;

        const item = await Inventory.findByIdAndUpdate(
            itemId,
            { currentStock, reorderLevel, supplierContact },
            { new: true, runValidators: true }
        ).populate('branchId', 'name');

        if (!item) {
            return sendError(res, 404, "Inventory item not found");
        }

        logger.info(`Inventory item updated: ${item.itemName}`);
        return sendResponse(res, 200, true, "Inventory item updated", { item });
    } catch (error) {
        logger.error("Update inventory item error:", error.message);
        next(error);
    }
};

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
