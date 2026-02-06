import Notification from "../models/notification.model.js";
import LowStockAlert from "../models/lowStockAlert.model.js";
import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { notificationService } from "../services/notificationService.js";

export const getNotifications = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, category } = req.query;
        const userId = req.user.id;

        let query = { userId };
        if (status) query.status = status;
        if (category) query.category = category;

        const skip = (page - 1) * limit;
        const notifications = await Notification.find(query)
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({
            userId,
            isRead: false
        });

        logger.info(`Notifications retrieved for user: ${userId}`);
        return sendResponse(res, 200, true, "Notifications retrieved", {
            notifications,
            unreadCount,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error("Get notifications error:", error.message);
        next(error);
    }
};

export const markNotificationAsRead = async (req, res, next) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findByIdAndUpdate(
            notificationId,
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return sendError(res, 404, "Notification not found");
        }

        logger.info(`Notification marked as read: ${notificationId}`);
        return sendResponse(res, 200, true, "Notification marked as read", {
            notification
        });
    } catch (error) {
        logger.error("Mark notification as read error:", error.message);
        next(error);
    }
};

export const markAllNotificationsAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id;

        await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        logger.info(`All notifications marked as read for user: ${userId}`);
        return sendResponse(res, 200, true, "All notifications marked as read");
    } catch (error) {
        logger.error("Mark all notifications as read error:", error.message);
        next(error);
    }
};

export const deleteNotification = async (req, res, next) => {
    try {
        const { notificationId } = req.params;

        const notification = await Notification.findByIdAndDelete(notificationId);

        if (!notification) {
            return sendError(res, 404, "Notification not found");
        }

        logger.info(`Notification deleted: ${notificationId}`);
        return sendResponse(res, 200, true, "Notification deleted");
    } catch (error) {
        logger.error("Delete notification error:", error.message);
        next(error);
    }
};

export const getLowStockAlerts = async (req, res, next) => {
    try {
        const { branchId, page = 1, limit = 10, isResolved = false } = req.query;

        let query = { isResolved: isResolved === 'true' };
        if (branchId) query.branchId = branchId;

        const skip = (page - 1) * limit;
        const alerts = await LowStockAlert.find(query)
            .populate('inventoryId')
            .populate('branchId')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ alertSentAt: -1 });

        const total = await LowStockAlert.countDocuments(query);

        logger.info(`Low-stock alerts retrieved: ${alerts.length}`);
        return sendResponse(res, 200, true, "Low-stock alerts retrieved", {
            alerts,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        logger.error("Get low-stock alerts error:", error.message);
        next(error);
    }
};

export const resolveLowStockAlert = async (req, res, next) => {
    try {
        const { alertId } = req.params;

        const alert = await LowStockAlert.findByIdAndUpdate(
            alertId,
            { isResolved: true, resolvedAt: new Date() },
            { new: true }
        ).populate('inventoryId').populate('branchId');

        if (!alert) {
            return sendError(res, 404, "Alert not found");
        }

        logger.info(`Low-stock alert resolved: ${alertId}`);
        return sendResponse(res, 200, true, "Alert marked as resolved", {
            alert
        });
    } catch (error) {
        logger.error("Resolve alert error:", error.message);
        next(error);
    }
};

export const manuallyTriggerLowStockCheck = async (req, res, next) => {
    try {
        // Only SUPER_ADMIN can trigger this
        if (req.user.role !== 'SUPER_ADMIN') {
            return sendError(res, 403, "Only SUPER_ADMIN can trigger low-stock check");
        }

        logger.info("Manual low-stock check triggered");
        
        // Trigger async check (don't await)
        notificationService.checkAndAlertLowStock();

        return sendResponse(res, 202, true, "Low-stock check started");
    } catch (error) {
        logger.error("Manual low-stock check error:", error.message);
        next(error);
    }
};
