import express from "express";
import {
    getDashboard,
    getAnalyticsPeriod,
    getDailyAnalytics,
    getOrderTrends,
    getRevenueAnalytics,
    getCustomerAnalytics
} from "../controllers/analytics.controller.js";
import { auth, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Dashboard (overview)
router.get('/dashboard', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getDashboard);

// Analytics endpoints
router.get('/period', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getAnalyticsPeriod);
router.get('/daily', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getDailyAnalytics);

// Specific analytics
router.get('/orders/trends', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getOrderTrends);
router.get('/revenue', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getRevenueAnalytics);
router.get('/customers', auth, authorize('SUPER_ADMIN', 'BRANCH_MANAGER'), getCustomerAnalytics);

export default router;
