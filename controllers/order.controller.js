import Order from "../models/order.model.js";
import Branch from "../models/branch.model.js";
import Employee from "../models/employee.model.js";
import Inventory from "../models/inventory.model.js";
import StockLog from "../models/stockLog.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

export const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { 
            customerId, branchId, customerName, customerPhone, 
            items, pickupDate, deliveryDate, priority, discount, serviceType 
        } = req.body;

        // --- ROLE BASED SECURITY ENFORCEMENT ---
        // Customers cannot choose their branch; it's taken from their profile.
        const effectiveBranchId = req.user.role === 'CUSTOMER' ? req.user.branchId : branchId;
        const effectiveCustomerId = req.user.role === 'CUSTOMER' ? req.user.id : customerId;

        if (!effectiveBranchId) return sendError(res, 400, "Branch assignment is required.");

        const order = await Order.create([{
            customerId: effectiveCustomerId,
            customerName,
            customerPhone,
            branchId: effectiveBranchId,
            items,
            pickupDate,
            deliveryDate,
            serviceType,
            priority: priority?.toUpperCase() || 'NORMAL',
            discount: discount || 0,
            status: 'PENDING',       
            paymentStatus: 'UNPAID'   
        }], { session });

        // Update branch order count
        await Branch.findByIdAndUpdate(effectiveBranchId, { $inc: { totalOrders: 1 } }, { session });

        await session.commitTransaction();
        session.endSession();

        const populatedOrder = await Order.findById(order[0]._id)
            .populate(['customerId', 'branchId', 'assignedEmployee']);

        logger.info(`Order created: ${populatedOrder.orderNumber}`);
        return sendResponse(res, 201, true, "Order created successfully", { order: populatedOrder });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        logger.error("Create order error:", error.message);
        next(error);
    }
};

export const getOrders = async (req, res, next) => {
    try {
        const { status, branchId, customerId, search, page = 1, limit = 10 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, parseInt(limit));

        let query = {};

        // Security Scoping
        if (req.user.role === 'CUSTOMER') {
            query.customerId = req.user.id;
        } else if (req.user.role === 'BRANCH_MANAGER') {
            query.branchId = req.user.branchId;
        } else if (branchId) {
            query.branchId = branchId;
        }

        if (req.user.role !== 'CUSTOMER' && customerId) query.customerId = customerId;
        if (search) query.orderNumber = { $regex: search, $options: 'i' };
        if (status) query.status = status;

        // Hide sensitive branch data from customers by not fully populating it
        const populationFields = req.user.role === 'CUSTOMER' 
            ? ['assignedEmployee'] 
            : ['customerId', 'branchId', 'assignedEmployee'];

        const orders = await Order.find(query)
            .populate(populationFields)
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum)
            .sort({ createdAt: -1 });

        const total = await Order.countDocuments(query);

        return sendResponse(res, 200, true, "Orders retrieved", {
            orders,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        next(error);
    }
};

export const getOrderById = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate(['customerId', 'branchId', 'assignedEmployee']);

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
        const { status, paymentStatus, assignedEmployee, items, priority, discount } = req.body;

        const oldOrder = await Order.findById(orderId);
        if (!oldOrder) return sendError(res, 404, "Order not found");

        const order = await Order.findByIdAndUpdate(
            orderId,
            { status, paymentStatus, assignedEmployee, items, priority, discount },
            { new: true, runValidators: true, context: 'query' }
        ).populate(['customerId', 'branchId', 'assignedEmployee']);

        if (paymentStatus === 'PAID' && oldOrder.paymentStatus !== 'PAID') {
            await Branch.findByIdAndUpdate(order.branchId, { 
                $inc: { totalRevenue: order.totalAmount } 
            });
        }

        if (assignedEmployee && oldOrder.assignedEmployee?.toString() !== assignedEmployee) {
            if (oldOrder.assignedEmployee) {
                await Employee.findOneAndUpdate({ userId: oldOrder.assignedEmployee }, { $inc: { assignedTasks: -1 } });
            }
            await Employee.findOneAndUpdate({ userId: assignedEmployee }, { $inc: { assignedTasks: 1 } });
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
        ).populate(['customerId', 'branchId', 'assignedEmployee']);

        // Employee Logic: Move from Assigned to Completed
        const isFinishing = ['READY', 'DELIVERED'].includes(status);
        const wasAlreadyFinished = ['READY', 'DELIVERED'].includes(oldOrder.status);

        if (order.assignedEmployee && isFinishing && !wasAlreadyFinished) {
            await Employee.findOneAndUpdate(
                { userId: order.assignedEmployee }, 
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
        if (order.assignedEmployee && !['READY', 'DELIVERED'].includes(order.status)) {
            await Employee.findOneAndUpdate(
                { userId: order.assignedEmployee }, 
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