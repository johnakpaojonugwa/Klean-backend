import Order from "../models/order.model.js";
import Branch from "../models/branch.model.js";
import Employee from "../models/employee.model.js";
import Inventory from "../models/inventory.model.js";
import StockLog from "../models/stockLog.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";

// Inventory Deductions
const INVENTORY_TRANSITIONS = [
  {
    from: "PENDING",
    to: "WASHING",
    category: "detergent",
    quantity: 1,
    reason: (orderNumber) => `Order ${orderNumber} - Wash Started`,
  },
  {
    from: "WASHING",
    to: "DRYING",
    category: "softener",
    quantity: 1,
    reason: (orderNumber) => `Order ${orderNumber} - Drying Started`,
  },
  {
    from: "IRONING",
    to: "READY",
    category: "packaging",
    quantity: 1,
    reason: (orderNumber) => `Order ${orderNumber} - Packaged for Pickup`,
  },
];

// HELPER: Deduct inventory for a given transition
const deductInventoryForTransition = async (oldStatus, newStatus, order, session, performedBy) => {
  const rule = INVENTORY_TRANSITIONS.find(
    (t) => t.from === oldStatus && t.to === newStatus
  );

  if (!rule) return null;

  const item = await Inventory.findOne({
    branchId: order.branchId,
    category: { $regex: new RegExp(`^${rule.category}$`, "i") },
    isActive: true,
  }).session(session);

  if (!item || item.currentStock < rule.quantity) {
    const friendlyCategory = rule.category.charAt(0).toUpperCase() + rule.category.slice(1);
    throw {
      statusCode: 400,
      message: `Insufficient ${friendlyCategory} in stock. Please restock before proceeding to ${newStatus}.`,
    };
  }

  item.currentStock -= rule.quantity;
  await item.save({ session });

  await StockLog.create(
    [
      {
        inventoryId: item._id,
        branchId: order.branchId,
        performedBy,
        changeType: "USAGE",
        quantityChanged: -rule.quantity,
        reason: rule.reason(order.orderNumber),
        orderId: order._id,
      },
    ],
    { session }
  );

  return item;
};

// Create Order
export const createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      customerId, branchId, customerName, customerPhone,
      items, pickupDate, deliveryDate, priority, discount, totalAmount,
    } = req.body;

    const effectiveBranchId = req.user.role === "CUSTOMER" ? req.user.branchId : branchId;
    const effectiveCustomerId = req.user.role === "CUSTOMER" ? req.user.id : customerId;

    if (!effectiveBranchId) {
      await session.abortTransaction();
      return sendError(res, 400, "Branch assignment is required.");
    }

    const order = new Order({
      customerId: effectiveCustomerId,
      customerName,
      customerPhone,
      branchId: effectiveBranchId,
      items,
      pickupDate,
      deliveryDate,
      priority: priority?.toUpperCase() || "NORMAL",
      discount: discount || 0,
      totalAmount: totalAmount || 0,
      createdBy: req.user.id || req.user._id,
      status: "PENDING",
      paymentStatus: "UNPAID",
    });

    await order.save({ session });
    
    await Branch.findByIdAndUpdate(
      effectiveBranchId,
      { $inc: { totalOrders: 1 } },
      { session }
    );

    await session.commitTransaction();

    const populatedOrder = await Order.findById(order._id).populate([
      "customerId", "branchId", "assignedEmployee", "createdBy",
    ]);

    return sendResponse(res, 201, true, "Order created successfully", { order: populatedOrder });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Get Orders
export const getOrders = async (req, res, next) => {
  try {
    const { status, branchId, customerId, search, page = 1, limit = 10, paymentStatus } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));

    let query = {};

    if (req.user.role === "CUSTOMER") {
      query.customerId = req.user.id;
    } else if (req.user.role === "BRANCH_MANAGER") {
      query.branchId = req.user.branchId;
    } else if (req.user.role === "SUPER_ADMIN" && branchId) {
      query.branchId = branchId;
    }

    if (req.user.role !== "CUSTOMER" && customerId) query.customerId = customerId;
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
      ];
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate(
          req.user.role === "CUSTOMER"
            ? ["assignedEmployee"]
            : ["customerId", "branchId", "assignedEmployee"]
        )
        .limit(limitNum)
        .skip((pageNum - 1) * limitNum)
        .sort({ createdAt: -1 }),
      Order.countDocuments(query),
    ]);

    return sendResponse(res, 200, true, "Orders retrieved", {
      orders,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    next(error);
  }
};

// Get Single Order
export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId).populate([
      "customerId", 
      "branchId", 
      "assignedEmployee", 
      "createdBy", 
      "statusHistory.updatedBy",
    ]);

    if (!order) return sendError(res, 404, "Order not found");

    // Permissions Check
    const isCustomerOwner =
      req.user.role === "CUSTOMER" &&
      order.customerId?._id?.toString() === req.user.id;
      
    const isBranchStaff =
      (req.user.role === "BRANCH_MANAGER" || req.user.role === "STAFF") &&
      order.branchId?._id?.toString() === req.user.branchId?.toString();
      
    const isSuperAdmin = req.user.role === "SUPER_ADMIN";

    if (!isCustomerOwner && !isBranchStaff && !isSuperAdmin) {
      return sendError(res, 403, "You do not have permission to view this order.");
    }

    return sendResponse(res, 200, true, "Order retrieved", { order });
  } catch (error) {
    next(error);
  }
};

// Update Order (General)
export const updateOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { orderId } = req.params;
    const updates = req.body;

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      return sendError(res, 404, "Order not found");
    }

    const wasAlreadyPaid = order.paymentStatus === "PAID";
    const oldTotal = order.totalAmount;

    // Handle Revenue adjustments if payment status changes
    if (updates.paymentStatus === "PAID" && !wasAlreadyPaid) {
      await Branch.findByIdAndUpdate(
        order.branchId,
        { $inc: { totalRevenue: order.totalAmount } },
        { session }
      );
    }

    // Handle Employee Task count adjustments
    if (updates.assignedEmployee && order.assignedEmployee?.toString() !== updates.assignedEmployee) {
      if (order.assignedEmployee) {
        await Employee.findOneAndUpdate(
          { userId: order.assignedEmployee },
          { $inc: { assignedTasks: -1 } },
          { session }
        );
      }
      await Employee.findOneAndUpdate(
        { userId: updates.assignedEmployee },
        { $inc: { assignedTasks: 1 } },
        { session }
      );
    }

    Object.assign(order, updates);

    if (updates.status && updates.status !== order.status) {
      order.statusHistory.push({ status: updates.status, updatedBy: req.user.id });
    }

    await order.validate();

    if (wasAlreadyPaid && order.totalAmount !== oldTotal) {
      const difference = order.totalAmount - oldTotal;
      await Branch.findByIdAndUpdate(
        order.branchId,
        { $inc: { totalRevenue: difference } },
        { session }
      );
    }

    await order.save({ session });
    await session.commitTransaction();

    const updatedOrder = await Order.findById(orderId).populate(["customerId", "branchId", "assignedEmployee"]);

    return sendResponse(res, 200, true, "Order updated successfully", { order: updatedOrder });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// Update Order Status (With Inventory Deduction)
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
    if (oldStatus === status) {
        await session.abortTransaction();
        return sendResponse(res, 200, true, `Status is already ${status}`, { order });
    }

    // Inventory Deduction Logic
    try {
      await deductInventoryForTransition(oldStatus, status, order, session, req.user.id);
    } catch (stockError) {
      await session.abortTransaction();
      return sendError(res, stockError.statusCode || 400, stockError.message);
    }

    // Status Update
    order.status = status;
    order.statusHistory.push({ status, updatedBy: req.user.id });

    // Task Tracking 
    if (order.assignedEmployee && ["READY", "DELIVERED"].includes(status) && !["READY", "DELIVERED"].includes(oldStatus)) {
      await Employee.findOneAndUpdate(
        { userId: order.assignedEmployee },
        { $inc: { completedTasks: 1, assignedTasks: -1 } },
        { session }
      );
    }

    // Revenue Recognition 
    if (status === "DELIVERED" && oldStatus !== "DELIVERED") {
      await Branch.findByIdAndUpdate(
        order.branchId,
        { $inc: { totalRevenue: order.totalAmount } },
        { session }
      );
    }

    await order.save({ session });
    await session.commitTransaction();

    logger.info(`Order ${order.orderNumber} transitioned ${oldStatus} -> ${status} by ${req.user.id}`);

    const finalOrder = await Order.findById(orderId).populate(["customerId", "branchId", "assignedEmployee"]);

    return sendResponse(res, 200, true, `Status changed to ${status}`, { order: finalOrder });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
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

    // Adjust branch stats if deleting an active order
    if (!["CANCELLED", "DELIVERED"].includes(order.status)) {
      await Branch.findByIdAndUpdate(
        order.branchId,
        { $inc: { totalOrders: -1 } },
        { session }
      );

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

    logger.info(`Order ${orderId} deleted by ${req.user.id}`);
    return sendResponse(res, 200, true, "Order deleted successfully");
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};