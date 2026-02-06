import Order from "../models/order.model.js";
import Inventory from "../models/inventory.model.js";
import StockLog from "../models/stockLog.model.js";
import Employee from "../models/employee.model.js";
import Branch from "../models/branch.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export const createOrder = async (req, res, next) => {
    try {
        const { customerId, branchId, items, dueDate } = req.body;

        const order = await Order.create({
            customerId,
            branchId,
            items,
            dueDate,
            status: 'PENDING',
            paymentStatus: 'UNPAID'
        });

        // Update Branch statistics automatically
        await Branch.findByIdAndUpdate(branchId, { 
            $inc: { totalOrders: 1 } 
        });

        const populatedOrder = await order.populate(['customerId', 'branchId', 'assignedStaff']);

        logger.info(`Order created: ${order.orderNumber}. Branch ${branchId} counter incremented.`);
        return sendResponse(res, 201, true, "Order created successfully", { order: populatedOrder });
    } catch (error) {
        logger.error("Create order error:", error.message);
        next(error);
    }
};

export const getOrders = async (req, res, next) => {
    try {
        const {
            status, branchId, customerId,
            search,
            dateType, startDate, endDate,
            page = 1, limit = 10
        } = req.query;

        // Validate and safe pagination parameters
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
        const skip = (pageNum - 1) * limitNum;

        let query = {};

        // SECURITY SCOPING
        if (req.user.role === 'CUSTOMER') {
            query.customerId = req.user.id;
        } 
        else if (req.user.role === 'BRANCH_MANAGER') {
            query.branchId = req.user.branchId;
        } 
        else if (branchId) {
            query.branchId = branchId;
        }

        // ADMINISTRATIVE FILTERS (Only if not a customer)
        if (req.user.role !== 'CUSTOMER' && customerId) {
            query.customerId = customerId;
        }

        // SEARCH & LOGISTICS FILTERS
        if (search) {
            query.orderNumber = { $regex: search, $options: 'i' };
        }

        if (status) query.status = status;

        if (dateType && startDate && endDate) {
            query[dateType] = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query)
            .populate(['customerId', 'branchId', 'assignedStaff'])
            .limit(limitNum)
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Order.countDocuments(query);

        return sendResponse(res, 200, true, "Orders retrieved", {
            orders,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        logger.error("Get orders error:", error.message);
        next(error);
    }
};

export const getOrderById = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate(['customerId', 'branchId', 'assignedStaff']);

        if (!order) return sendError(res, 404, "Order not found");

        // Permission Checks
        if (req.user.role === 'CUSTOMER' && order.customerId._id.toString() !== req.user.id) {
            return sendError(res, 403, "Access denied");
        }
        if (req.user.role === 'BRANCH_MANAGER' && order.branchId._id.toString() !== req.user.branchId) {
            return sendError(res, 403, "Access denied to this branch's data");
        }

        return sendResponse(res, 200, true, "Order retrieved", { order });
    } catch (error) {
        next(error);
    }
};

export const updateOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status, paymentStatus, assignedStaff, items } = req.body;

        const oldOrder = await Order.findById(orderId);
        if (!oldOrder) return sendError(res, 404, "Order not found");

        const order = await Order.findByIdAndUpdate(
            orderId,
            { status, paymentStatus, assignedStaff, items },
            { new: true, runValidators: true, context: 'query' }
        ).populate(['customerId', 'branchId', 'assignedStaff']);

        // REVENUE LOGIC: Update a branch revenue
        if (paymentStatus === 'PAID' && oldOrder.paymentStatus !== 'PAID') {
            await Branch.findByIdAndUpdate(order.branchId, { 
                $inc: { totalRevenue: order.totalAmount } 
            });
            logger.info(`Revenue updated for branch ${order.branchId}: +${order.totalAmount}`);
        }

        // LOGIC: Handle Staff Reassignment Task Counters
        if (assignedStaff && oldOrder.assignedStaff?.toString() !== assignedStaff) {
            // Remove task from old staff
            if (oldOrder.assignedStaff) {
                await Employee.findOneAndUpdate({ userId: oldOrder.assignedStaff }, { $inc: { assignedTasks: -1 } });
            }
            // Add task to new staff
            await Employee.findOneAndUpdate({ userId: assignedStaff }, { $inc: { assignedTasks: 1 } });
        }

        return sendResponse(res, 200, true, "Order updated successfully", { order });
    } catch (error) {
        next(error);
    }
};

export const updateOrderStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const oldOrder = await Order.findById(orderId);
        if (!oldOrder) return sendError(res, 404, "Order not found");

        const order = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true, runValidators: true, context: 'query' }
        ).populate(['customerId', 'branchId', 'assignedStaff']);

        // Employee Logic: Move from Assigned to Completed
        const isFinishing = ['READY', 'DELIVERED'].includes(status);
        const wasAlreadyFinished = ['READY', 'DELIVERED'].includes(oldOrder.status);

        if (order.assignedStaff && isFinishing && !wasAlreadyFinished) {
            await Employee.findOneAndUpdate(
                { userId: order.assignedStaff }, 
                { $inc: { completedTasks: 1, assignedTasks: -1 } }
            );
        }

        // Inventory Logic: Auto-consume Detergent
        if (status === 'WASHING' && oldOrder.status === 'PENDING') {
            const detergent = await Inventory.findOne({ branchId: order.branchId, category: 'DETERGENT' });
            if (detergent && detergent.currentStock > 0) {
                detergent.currentStock -= 1;
                detergent.reorderPending = detergent.currentStock <= detergent.reorderLevel;
                await detergent.save();

                await StockLog.create({
                    inventoryId: detergent._id,
                    branchId: order.branchId,
                    performedBy: req.user.id,
                    changeType: 'USAGE',
                    quantityChanged: -1,
                    newStockLevel: detergent.currentStock,
                    reason: `Order ${order.orderNumber} Wash`,
                    orderId: order._id
                });
            }
        }

        return sendResponse(res, 200, true, `Status updated to ${status}`, { order });
    } catch (error) {
        next(error);
    }
};

export const deleteOrder = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);
        if (!order) return sendError(res, 404, "Order not found");

        // REVENUE & STATS LOGIC: Reverse the branch impact
        const updateData = { $inc: { totalOrders: -1 } };

        // If it was already paid, we must subtract the revenue too
        if (order.paymentStatus === 'PAID') {
            updateData.$inc.totalRevenue = -order.totalAmount;
        }

        await Branch.findByIdAndUpdate(order.branchId, updateData);

        // Cleanup: If deleted, reduce assigned task count for the staff
        if (order.assignedStaff && !['READY', 'DELIVERED'].includes(order.status)) {
            await Employee.findOneAndUpdate(
                { userId: order.assignedStaff }, 
                { $inc: { assignedTasks: -1 } }
            );
        }

        await Order.findByIdAndDelete(orderId);

        logger.info(`Order ${order.orderNumber} deleted. Branch stats adjusted: ${JSON.stringify(updateData.$inc)}`)
        return sendResponse(res, 200, true, "Order deleted and branch stats adjusted");
    } catch (error) {
        next(error);
    }
};