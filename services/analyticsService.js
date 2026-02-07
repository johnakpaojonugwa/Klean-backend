import mongoose from "mongoose";
import Analytics from "../models/analytics.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Inventory from "../models/inventory.model.js";
import Branch from "../models/branch.model.js";
import { logger } from "../utils/logger.js";

export const analyticsService = {
    // Generates or updates daily analytics for a specific date and branch
    generateDailyAnalytics: async (date = new Date(), branchId = null) => {
        try {
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const matchStage = {
                createdAt: { $gte: startOfDay, $lte: endOfDay },
                ...(branchId && { branchId: new mongoose.Types.ObjectId(branchId) })
            };

            // Single Aggregation Pipeline for all Order Metrics
            const orderMetrics = await Order.aggregate([
                { $match: matchStage },
                {
                    $facet: {
                        totals: [
                            {
                                $group: {
                                    _id: null,
                                    count: { $sum: 1 },
                                    totalValue: { $sum: "$totalAmount" },
                                    revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "PAID"] }, "$totalAmount", 0] } }
                                }
                            }
                        ],
                        statusCounts: [
                            { $group: { _id: "$status", count: { $sum: 1 } } }
                        ],
                        paymentCounts: [
                            { $group: { _id: "$paymentStatus", count: { $sum: 1 } } }
                        ],
                        peakHours: [
                            { $group: { _id: { $hour: "$createdAt" }, count: { $sum: 1 } } },
                            { $sort: { count: -1 } },
                            { $limit: 3 }
                        ]
                    }
                }
            ]);

            const m = orderMetrics[0];
            const totals = m.totals[0] || { count: 0, totalValue: 0, revenue: 0 };

            // Fetch Customer Metrics
            const newCustomers = await User.countDocuments({
                role: 'CUSTOMER',
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            });

            // Fetch Stock Metrics (Scoped)
            const lowStockCount = await Inventory.countDocuments({
                ...(branchId && { branchId }),
                $expr: { $lte: ['$currentStock', '$reorderLevel'] }
            });

            const analyticsData = {
                date: startOfDay,
                branchId: branchId || null,
                totalOrders: totals.count,
                totalOrderValue: totals.totalValue,
                totalRevenue: totals.revenue,
                averageOrderValue: totals.count > 0 ? totals.totalValue / totals.count : 0,
                ordersByStatus: m.statusCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
                paidOrders: m.paymentCounts.find(p => p._id === 'PAID')?.count || 0,
                unpaidOrders: m.paymentCounts.find(p => p._id === 'UNPAID')?.count || 0,
                newCustomers,
                lowStockAlerts: lowStockCount,
                peakOrderHours: m.peakHours.map(h => h._id).join(',')
            };

            return await Analytics.findOneAndUpdate(
                { date: startOfDay, branchId: branchId || null },
                analyticsData,
                { upsert: true, new: true }
            );
        } catch (error) {
            logger.error("Daily Analytics Error:", error.message);
            throw error;
        }
    },

    // GET DASHBOARD SUMMARY
    // Merges current Branch stats with today's activity.
    
    getDashboardSummary: async (branchId = null) => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Get Live Branch Data (Real-time totals)
            const branchQuery = branchId ? { _id: branchId } : {};
            const branches = await Branch.find(branchQuery).select('totalRevenue totalOrders name');

            // Get Today's specific performance
            const todayData = await Analytics.findOne({ date: today, branchId });

            // Get Pending Workload (Live from Orders)
            const pendingStatus = ['PENDING', 'PROCESSING', 'WASHING', 'DRYING', 'IRONING'];
            const pendingCount = await Order.countDocuments({
                ...(branchId && { branchId }),
                status: { $in: pendingStatus }
            });

            // NEW: Get Inventory alerts for this specific view
            const lowStock = await Inventory.find({
                ...(branchId && { branchId }),
                $expr: { $lte: ["$currentStock", "$reorderLevel"] }
            }).select('name currentStock unit');

            return {
                branchInfo: branchId ? branches[0] : { name: "All Branches" },
                liveTotals: {
                    revenue: branches.reduce((sum, b) => sum + b.totalRevenue, 0),
                    orders: branches.reduce((sum, b) => sum + b.totalOrders, 0)
                },
                today: todayData || { totalOrders: 0, totalRevenue: 0 },
                pendingWorkload: pendingCount,
                inventoryAlerts: lowStock,
                branchCount: branches.length
            };
        } catch (error) {
            logger.error("Dashboard Summary Error:", error.message);
            throw error;
        }
    },

    getSuperAdminSummary: async () => {
        try {
            // Overall Company Totals (Aggregated from Branch models)
            const companyTotals = await Branch.aggregate([
                {
                    $group: {
                        _id: null,
                        totalCompanyRevenue: { $sum: "$totalRevenue" },
                        totalCompanyOrders: { $sum: "$totalOrders" },
                        branchCount: { $sum: 1 }
                    }
                }
            ]);

            // System-Wide Low Stock (Critical Supply Chain)
            const criticalInventory = await Inventory.find({
                $expr: { $lte: ["$currentStock", "$reorderLevel"] }
            })
                .populate('branchId', 'name')
                .select('name currentStock unit branchId')
                .limit(10);

            // Recent Activity (Last 24 Hours)
            const recentBigOrders = await Order.find({
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            })
                .populate('branchId', 'name')
                .populate('customerId', 'fullname')
                .sort({ totalAmount: -1 })
                .limit(5);

            return {
                overview: companyTotals[0] || { totalCompanyRevenue: 0, totalCompanyOrders: 0, branchCount: 0 },
                criticalStockAlerts: criticalInventory,
                recentActivity: recentBigOrders
            };
        } catch (error) {
            logger.error("SuperAdmin Summary Error:", error.message);
            throw error;
        }
    },

    getAnalyticsPeriod: async (startDate, endDate, branchId = null) => {
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const query = {
                date: { $gte: start, $lte: end },
                ...(branchId && { branchId: new mongoose.Types.ObjectId(branchId) })
            };

            const analytics = await Analytics.find(query).sort({ date: 1 });

            // Calculate totals for the period
            const totals = analytics.reduce((acc, curr) => {
                acc.totalOrders += curr.totalOrders || 0;
                acc.totalRevenue += curr.totalRevenue || 0;
                acc.newCustomers += curr.newCustomers || 0;
                return acc;
            }, { totalOrders: 0, totalRevenue: 0, newCustomers: 0 });

            return {
                analytics,
                totals
            };
        } catch (error) {
            logger.error("Get Analytics Period Error:", error.message);
            throw error;
        }
    },
};

