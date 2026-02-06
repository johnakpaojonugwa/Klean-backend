import express from "express";
import {
    addInventoryItem,
    adjustStock,
    getInventoryByBranch,
    updateInventoryItem,
    deleteInventoryItem,
    getLowStockItems
} from "../controllers/inventory.controller.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import {
    validateInventoryItem,
    validateStockAdjustment,
    validatePaginationParams
} from "../middlewares/validateRequest.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

// Get low stock items (admin/manager view)
router.get('/low-stock', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), validatePaginationParams, asyncHandler(getLowStockItems));

// Add inventory item
router.post('/', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), validateInventoryItem, asyncHandler(addInventoryItem));

// Adjust stock (with atomic operations to prevent race conditions)
router.patch('/:itemId/adjust', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF'), validateStockAdjustment, asyncHandler(adjustStock));

// Get inventory by branch
router.get('/branch/:branchId', auth, validatePaginationParams, asyncHandler(getInventoryByBranch));

// Update inventory item
router.put('/:itemId', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), validateInventoryItem, asyncHandler(updateInventoryItem));

// Delete inventory item
router.delete('/:itemId', auth, authorize('SUPER_ADMIN'), asyncHandler(deleteInventoryItem));

export default router;
