import express from "express";
import {
    createOrder,
    getOrders,
    getOrderById,
    updateOrder,
    updateOrderStatus,
    deleteOrder
} from "../controllers/order.controller.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";
import { validatePaginationParams } from "../middlewares/validateRequest.js";
import { validateCreateOrder } from "../middlewares/validationMiddleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();

// Customer can create orders
router.post('/', auth, validateCreateOrder, asyncHandler(createOrder));

// Get orders (with pagination validation)
router.get('/', auth, validatePaginationParams, asyncHandler(getOrders));

// Get single order
router.get('/:orderId', auth, asyncHandler(getOrderById));

// Update order (admin/manager)
router.put('/:orderId', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), asyncHandler(updateOrder));

// Update order status (admin/manager/staff)
router.patch('/:orderId/status', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF'), asyncHandler(updateOrderStatus));

// Delete order (admin only)
router.delete('/:orderId', auth, authorize('SUPER_ADMIN'), asyncHandler(deleteOrder));

export default router;
