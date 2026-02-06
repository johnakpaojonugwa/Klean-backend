import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import * as Sentry from '@sentry/node';
import { connectDB } from './config/db.js';
import { specs } from './config/swagger.js';
import { logger } from './utils/logger.js';
import { requestLogger, logErrorContext } from './middlewares/loggingMiddleware.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { initializeScheduledJobs } from './utils/scheduledJobs.js';
import { compressionMiddleware, performanceMonitor, memoryMonitor, recordResponseTime, getPerformanceStats } from './middlewares/performanceOptimization.js';
import { cacheMiddleware, invalidateCacheOnWrite, getCacheStats, invalidateCacheManually } from './middlewares/caching.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import orderRoutes from './routes/order.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import branchRoutes from './routes/branch.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import payrollRoutes from './routes/payroll.routes.js';
import leaveRoutes from './routes/leave.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';

dotenv.config();

// Initialize Sentry for error tracking
if (process.env.NODE_ENV === 'production') {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV,
        tracesSampleRate: 0.1,
        integrations: [
            new Sentry.Integrations.Http({ tracing: true }),
            new Sentry.Integrations.Express({
                request: true,
                serverName: true,
                version: true
            })
        ]
    });
}

const app = express();

// Sentry request handler (must be first)
if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.requestHandler());
}

// Security Middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.'
});

// API rate limiter for regular endpoints (100 requests per 15 minutes)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => {
        // Don't rate limit health checks
        return req.path === '/api/v1/health';
    }
});

app.use(limiter);

// Request logging middleware
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));

// Performance Optimization Middleware
app.use(compressionMiddleware);
app.use(recordResponseTime);
app.use(performanceMonitor);

// Caching Middleware (for GET requests)
app.use(cacheMiddleware);

// Cache invalidation middleware (for write operations)
app.use(invalidateCacheOnWrite);

// Health check route
app.get('/api/v1/health', (req, res) => {
    res.status(200).json({ success: true, message: 'Server is running' });
});

// Swagger Documentation
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(specs, {
    swaggerOptions: {
        url: '/api/v1/docs.json'
    }
}));

// Swagger JSON endpoint
app.get('/api/v1/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
});

// Performance Stats Endpoint
app.get('/api/v1/stats/performance', (req, res) => {
    const stats = getPerformanceStats();
    res.status(200).json({
        success: true,
        data: stats
    });
});

// Cache Stats Endpoint
app.get('/api/v1/stats/cache', (req, res) => {
    const stats = getCacheStats();
    res.status(200).json({
        success: true,
        data: stats
    });
});

// Manual Cache Invalidation Endpoint (admin only)
app.post('/api/v1/admin/cache/invalidate', (req, res) => {
    invalidateCacheManually(req, res);
});

// Connect to database
connectDB();

// Initialize scheduled jobs
initializeScheduledJobs();

// Start memory monitoring
memoryMonitor();

// Initialize database indexes (async, runs in background)
import { createOptimizedIndexes } from './utils/queryOptimizer.js';
createOptimizedIndexes().catch(err => {
    logger.error('Failed to create database indexes:', err);
});

// Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/users', apiLimiter, userRoutes);
app.use('/api/v1/orders', apiLimiter, orderRoutes);
app.use('/api/v1/inventory', apiLimiter, inventoryRoutes);
app.use('/api/v1/notifications', apiLimiter, notificationRoutes);
app.use('/api/v1/analytics', apiLimiter, analyticsRoutes);
app.use('/api/v1/branch', apiLimiter, branchRoutes);

// HR Management Routes
app.use('/api/v1/employees', apiLimiter, employeeRoutes);
app.use('/api/v1/payroll', apiLimiter, payrollRoutes);
app.use('/api/v1/leaves', apiLimiter, leaveRoutes);
app.use('/api/v1/attendance', apiLimiter, attendanceRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

// Error logging middleware
app.use(logErrorContext);

// Sentry error handler (must be before other error handlers)
if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.errorHandler());
}

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    logger.info(`🚀 Server is running on port http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', { promise, reason });
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

export default app;