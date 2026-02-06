import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { notificationService } from '../services/notificationService.js';
import { analyticsService } from '../services/analyticsService.js';

export const initializeScheduledJobs = () => {
    logger.info('Initializing scheduled jobs...');

    // Low-stock check - Every day at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        logger.info('Running scheduled low-stock check...');
        try {
            await notificationService.checkAndAlertLowStock();
            logger.info('Low-stock check completed successfully');
        } catch (error) {
            logger.error('Scheduled low-stock check failed:', error.message);
        }
    });

    // Generate daily analytics - Every day at 11:59 PM
    cron.schedule('59 23 * * *', async () => {
        logger.info('Generating daily analytics...');
        try {
            await analyticsService.generateDailyAnalytics(new Date());
            logger.info('Daily analytics generated successfully');
        } catch (error) {
            logger.error('Daily analytics generation failed:', error.message);
        }
    });

    // Payment reminders - Every day at 5:00 PM
    cron.schedule('0 17 * * *', async () => {
        logger.info('Sending payment reminders...');
        try {
            const Order = require('../models/order.model.js').default;
            
            // Find unpaid orders that are ready
            const readyOrders = await Order.find({
                status: 'READY',
                paymentStatus: { $ne: 'PAID' }
            });

            for (const order of readyOrders) {
                await notificationService.sendPaymentReminder(order._id);
            }

            logger.info(`Payment reminders sent for ${readyOrders.length} orders`);
        } catch (error) {
            logger.error('Payment reminders failed:', error.message);
        }
    });

    // Cleanup old notifications - Every Sunday at 2:00 AM
    cron.schedule('0 2 * * 0', async () => {
        logger.info('Cleaning up old notifications...');
        try {
            const Notification = require('../models/notification.model.js').default;
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const result = await Notification.deleteMany({
                createdAt: { $lt: thirtyDaysAgo },
                status: 'SENT'
            });

            logger.info(`Deleted ${result.deletedCount} old notifications`);
        } catch (error) {
            logger.error('Notification cleanup failed:', error.message);
        }
    });

    logger.info('Scheduled jobs initialized successfully');
};
