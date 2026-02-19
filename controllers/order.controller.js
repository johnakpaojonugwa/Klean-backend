import Order from "../models/order.model.js";
import Branch from "../models/branch.model.js";
import Employee from "../models/employee.model.js";
import Inventory from "../models/inventory.model.js";
import StockLog from "../models/stockLog.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

// Create Order
export const createOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const {
            customerId, branchId, customerName, customerPhone,
            items, pickupDate, deliveryDate, priority, discount, totalAmount
        } = req.body;

        const effectiveBranchId = req.user.role === 'CUSTOMER' ? req.user.branchId : branchId;
        const effectiveCustomerId = req.user.role === 'CUSTOMER' ? req.user.id : customerId;

        if (!effectiveBranchId) return sendError(res, 400, "Branch assignment is required.");

        const order = new Order({
            customerId: effectiveCustomerId,
            customerName,
            customerPhone,
            branchId: effectiveBranchId,
            items,
            pickupDate,
            deliveryDate,
            priority: priority?.toUpperCase() || 'NORMAL',
            discount: discount || 0,
            totalAmount: totalAmount || 0,
            createdBy: req.user.id,
            status: 'PENDING',
            paymentStatus: 'UNPAID'
        });

        await order.save({ session });
        await Branch.findByIdAndUpdate(effectiveBranchId, { $inc: { totalOrders: 1 } }, { session });

        await session.commitTransaction();
        session.endSession();

        const populatedOrder = await Order.findById(order._id)
            .populate(['customerId', 'branchId', 'assignedEmployee', 'createdBy']);

        return sendResponse(res, 201, true, "Order created successfully", { order: populatedOrder });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

// Get Orders
export const getOrders = async (req, res, next) => {
    try {
        const { status, branchId, customerId, search, page = 1, limit = 10, paymentStatus } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, parseInt(limit));

        let query = {};

        // SECURITY SCOPING
        if (req.user.role === 'CUSTOMER') {
            query.customerId = req.user.id;
        } else if (req.user.role === 'BRANCH_MANAGER') {
            query.branchId = req.user.branchId;
        } else if (req.user.role === 'SUPER_ADMIN' && branchId) {
            query.branchId = branchId;
        }

        // ADDITIONAL FILTERS
        if (req.user.role !== 'CUSTOMER' && customerId) query.customerId = customerId;
        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;

        // Search by Order Number or Customer Name
        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } }
            ];
        }

        // EXECUTION
        const [orders, total] = await Promise.all([
            Order.find(query)
                .populate(req.user.role === 'CUSTOMER' ? ['assignedEmployee'] : ['customerId', 'branchId', 'assignedEmployee'])
                .limit(limitNum)
                .skip((pageNum - 1) * limitNum)
                .sort({ createdAt: -1 }),
            Order.countDocuments(query)
        ]);

        return sendResponse(res, 200, true, "Orders retrieved", {
            orders,
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        next(error);
    }
};

// Get single order 
export const getOrderById = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate(['customerId', 'branchId', 'assignedEmployee', 'createdBy', 'statusHistory.updatedBy']);

        if (!order) return sendError(res, 404, "Order not found");

        // Permission Guard
        const isCustomerOwner = req.user.role === 'CUSTOMER' && order.customerId._id.toString() === req.user.id;
        const isBranchStaff = (req.user.role === 'BRANCH_MANAGER' || req.user.role === 'STAFF') &&
            order.branchId._id.toString() === req.user.branchId?.toString();
        const isSuperAdmin = req.user.role === 'SUPER_ADMIN';

        if (!isCustomerOwner && !isBranchStaff && !isSuperAdmin) {
            return sendError(res, 403, "You do not have permission to view this order.");
        }

        return sendResponse(res, 200, true, "Order retrieved", { order });
    } catch (error) {
        next(error);
    }
};

// Update Order 
export const updateOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction(); // Start the "All or Nothing" block
    try {
        const { orderId } = req.params;
        const updates = req.body;

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return sendError(res, 404, "Order not found");
        }

        const wasAlreadyPaid = order.paymentStatus === 'PAID';
        const oldTotal = order.totalAmount;

        // 1. Initial Revenue Capture
        if (updates.paymentStatus === 'PAID' && !wasAlreadyPaid) {
            await Branch.findByIdAndUpdate(order.branchId, 
                { $inc: { totalRevenue: order.totalAmount } }, 
                { session }
            );
        }

        // 2. Staff Task Balancing
        if (updates.assignedEmployee && order.assignedEmployee?.toString() !== updates.assignedEmployee) {
            if (order.assignedEmployee) {
                await Employee.findOneAndUpdate({ userId: order.assignedEmployee }, { $inc: { assignedTasks: -1 } }, { session });
            }
            await Employee.findOneAndUpdate({ userId: updates.assignedEmployee }, { $inc: { assignedTasks: 1 } }, { session });
        }

        // 3. Apply updates
        Object.assign(order, updates);

        if (updates.status && updates.status !== order.status) {
            order.statusHistory.push({ status: updates.status, updatedBy: req.user.id });
        }

        // 4. Price Delta Adjustment (The most important part of your logic)
        await order.validate();
        if (wasAlreadyPaid && (order.totalAmount !== oldTotal)) {
            const difference = order.totalAmount - oldTotal;
            await Branch.findByIdAndUpdate(order.branchId, 
                { $inc: { totalRevenue: difference } }, 
                { session }
            );
        }

        await order.save({ session });
        
        // If everything above succeeded, commit the changes to the DB
        await session.commitTransaction(); 
        session.endSession();

        return sendResponse(res, 200, true, "Order updated successfully", { order });
    } catch (error) {
        // If ANY step failed, cancel everything to keep data clean
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};

// Update Order Status 
export const updateOrderStatus = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return sendError(res, 404, "Order not found");
        }

        const oldStatus = order.status;
        order.status = status;
        order.statusHistory.push({ status, updatedBy: req.user.id });

        // Logic for Task Completion
        if (order.assignedEmployee && ['READY', 'DELIVERED'].includes(status) && !['READY', 'DELIVERED'].includes(oldStatus)) {
            await Employee.findOneAndUpdate(
                { userId: order.assignedEmployee },
                { $inc: { completedTasks: 1, assignedTasks: -1 } },
                { session }
            );
        }

        // Auto-Inventory Usage with Safety Check
        if (status === 'WASHING' && oldStatus === 'PENDING') {
            const detergent = await Inventory.findOne({ branchId: order.branchId, category: 'DETERGENT' }).session(session);
            
            if (!detergent || detergent.currentStock <= 0) {
                // Professional touch: Prevent washing if there's no detergent
                await session.abortTransaction();
                return sendError(res, 400, "Insufficient detergent in stock to begin washing.");
            }

            detergent.currentStock -= 1;
            await detergent.save({ session });
            await StockLog.create([{
                inventoryId: detergent._id,
                branchId: order.branchId,
                performedBy: req.user.id,
                changeType: 'USAGE',
                quantityChanged: -1,
                reason: `Order ${order.orderNumber} Wash`,
                orderId: order._id
            }], { session });
        }

        await order.save({ session });
        await session.commitTransaction();
        return sendResponse(res, 200, true, `Status changed to ${status}`, { order });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

// Delete Order
export const deleteOrder = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            return sendError(res, 404, "Order not found");
        }

        // Rollback Stats if the order wasn't finished/cancelled yet
        if (!['CANCELLED', 'DELIVERED'].includes(order.status)) {
            await Branch.findByIdAndUpdate(order.branchId, { $inc: { totalOrders: -1 } }, { session });
            
            if (order.assignedEmployee) {
                await Employee.findOneAndUpdate(
                    { userId: order.assignedEmployee }, 
                    { $inc: { assignedTasks: -1 } }, 
                    { session }
                );
            }
        }

        await Order.findByIdAndDelete(orderId).session(session);

        await session.commitTransaction();
        session.endSession();

        logger.info(`Order ${orderId} deleted by ${req.user.id}`);
        return sendResponse(res, 200, true, "Order deleted successfully");
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        next(error);
    }
};