import { sendResponse, sendError } from "../utils/response.js";
import { logger } from "../utils/logger.js";
import { analyticsService } from "../services/analyticsService.js";
import Branch from "../models/branch.model.js";

const getQueryBranchId = (user, queryId) => {
    if (user.role === 'BRANCH_MANAGER') return user.branchId;
    if (user.role === 'SUPER_ADMIN') return queryId || null;
    return null;
}

export const getDashboard = async (req, res, next) => {
    try {
        const branchId = getQueryBranchId(req.user, req.query.branchId);

        // Get the standard summary from the service
        const summary = await analyticsService.getDashboardSummary(branchId);

        // EXTRA: If Super Admin and no specific branch is selected, add the Leaderboard
        if (req.user.role === 'SUPER_ADMIN' && !req.query.branchId) {
            summary.branchLeaderboard = await Branch.find({})
                .select('name branchCode totalRevenue totalOrders')
                .sort({ totalRevenue: -1 })
                .limit(5);
        }

        logger.info(`Dashboard retrieved for user: ${req.user.id}`);
        return sendResponse(res, 200, true, "Dashboard data retrieved", summary);
    } catch (error) {
        logger.error("Get dashboard error:", error.message);
        next(error);
    }
};

export const getAnalyticsPeriod = async (req, res, next) => {
    try {
        const { startDate, endDate, branchId } = req.query;
        if (!startDate || !endDate) return sendError(res, 400, "Dates are required");

        const queryBranchId = getQueryBranchId(req.user, branchId);

        const analytics = await analyticsService.getAnalyticsPeriod(
            new Date(startDate),
            new Date(endDate),
            queryBranchId
        );

        return sendResponse(res, 200, true, "Analytics retrieved", analytics);
    } catch (error) {
        next(error);
    }
};

export const getDailyAnalytics = async (req, res, next) => {
    try {
        const { date, branchId } = req.query; 
        const queryBranchId = getQueryBranchId(req.user, branchId);

        // Fallback to today if no date is provided
        const analyticsDate = date ? new Date(date) : new Date();

        const analytics = await analyticsService.generateDailyAnalytics(
            analyticsDate,
            queryBranchId
        );

        logger.info(`Daily analytics generated for: ${analyticsDate.toDateString()}`);
        return sendResponse(res, 200, true, "Daily analytics retrieved", {
            date: analyticsDate,
            analytics
        });
    } catch (error) {
        logger.error("Get daily analytics error:", error.message);
        next(error);
    }
};

export const getOrderTrends = async (req, res, next) => {
    try {
        const { startDate, endDate, branchId } = req.query;
        if (!startDate || !endDate) return sendError(res, 400, "Dates are required");

        const queryBranchId = getQueryBranchId(req.user, branchId);
        const result = await analyticsService.getAnalyticsPeriod(
            new Date(startDate),
            new Date(endDate),
            queryBranchId
        );

        const trends = {
            dailyOrders: result.analytics.map(a => ({
                date: a.date,
                orders: a.totalOrders,
                revenue: a.totalRevenue
            })),
            statusBreakdown: result.analytics.reduce((acc, a) => {
                Object.keys(a.ordersByStatus).forEach(status => {
                    acc[status] = (acc[status] || 0) + a.ordersByStatus[status];
                });
                return acc;
            }, {}),
            summary: result.totals
        };

        return sendResponse(res, 200, true, "Order trends retrieved", trends);
    } catch (error) {
        next(error);
    }
};

export const getRevenueAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, branchId } = req.query;
        if (!startDate || !endDate) return sendError(res, 400, "Dates are required");

        const queryBranchId = getQueryBranchId(req.user, branchId);

        const result = await analyticsService.getAnalyticsPeriod(
            new Date(startDate),
            new Date(endDate),
            queryBranchId
        );

        const revenue = {
            dailyRevenue: result.analytics.map(a => ({
                date: a.date,
                revenue: a.totalRevenue,
                paid: a.paidOrders,
                unpaid: a.unpaidOrders
            })),
            totalRevenue: result.totals.totalRevenue,
            averageOrderValue: (result.totals.totalRevenue / (result.totals.totalOrders - result.totals.ordersCancelled || 1)).toFixed(2)
        };

        return sendResponse(res, 200, true, "Revenue analytics retrieved", revenue);
    } catch (error) {
        next(error);
    }
};

export const getCustomerAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate, branchId } = req.query;

        if (!startDate || !endDate) {
            return sendError(res, 400, "startDate and endDate are required");
        }

        const queryBranchId = getQueryBranchId(req.user, branchId);

        const result = await analyticsService.getAnalyticsPeriod(
            new Date(startDate),
            new Date(endDate),
            queryBranchId
        );

        const customers = {
            newCustomersPerDay: result.analytics.map(a => ({
                date: a.date,
                newCustomers: a.newCustomers,
                active: a.totalActiveCustomers
            })),
            totalNewCustomers: result.totals.newCustomers,
            averageNewCustomersPerDay: result.totals.newCustomers / (result.analytics.length || 1),
            growth: result.analytics.length > 1 && result.analytics[0].totalActiveCustomers > 0
                ? (((result.analytics[result.analytics.length - 1].totalActiveCustomers - result.analytics[0].totalActiveCustomers) / result.analytics[0].totalActiveCustomers) * 100).toFixed(2)
                : 0
        };

        logger.info(`Customer analytics retrieved`);
        return sendResponse(res, 200, true, "Customer analytics retrieved", customers);
    } catch (error) {
        logger.error("Get customer analytics error:", error.message);
        next(error);
    }
};
