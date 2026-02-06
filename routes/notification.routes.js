import express from "express";
import {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    getLowStockAlerts,
    resolveLowStockAlert,
    manuallyTriggerLowStockCheck
} from "../controllers/notification.controller.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Notification endpoints
router.get('/', auth, getNotifications);
router.put('/:notificationId/read', auth, markNotificationAsRead);
router.put('/mark-all-read', auth, markAllNotificationsAsRead);
router.delete('/:notificationId', auth, deleteNotification);

// Low-stock alerts
router.get('/low-stock/alerts', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getLowStockAlerts);
router.put('/low-stock/alerts/:alertId/resolve', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), resolveLowStockAlert);

// Trigger check (admin only)
router.post('/low-stock/check', auth, authorize('SUPER_ADMIN'), manuallyTriggerLowStockCheck);

export default router;
