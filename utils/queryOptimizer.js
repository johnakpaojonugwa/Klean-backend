/**
 * Database Query Optimization Utilities
 * Provides best practices for MongoDB operations
 */

import { logger } from '../utils/logger.js';

/**
 * Query execution analyzer
 * Logs slow queries and provides optimization recommendations
 */
export class QueryOptimizer {
    constructor(slowQueryThreshold = 100) {
        this.slowQueryThreshold = slowQueryThreshold;
        this.queryStats = {
            total: 0,
            slow: 0,
            fast: 0,
            average: 0
        };
    }

    /**
     * Analyze query execution time
     */
    recordQuery(operationType, collection, duration, query = {}) {
        this.queryStats.total++;
        const isSlowQuery = duration > this.slowQueryThreshold;

        if (isSlowQuery) {
            this.queryStats.slow++;
            logger.warn(`SLOW QUERY: ${collection}.${operationType}`, {
                duration: `${duration}ms`,
                operationType,
                collection,
                threshold: `${this.slowQueryThreshold}ms`,
                query: JSON.stringify(query)
            });

            this.suggestOptimization(collection, operationType, query);
        } else {
            this.queryStats.fast++;
        }

        // Update average
        this.queryStats.average = (
            (this.queryStats.average * (this.queryStats.total - 1) + duration) /
            this.queryStats.total
        ).toFixed(2);
    }

    /**
     * Suggest optimization strategies
     */
    suggestOptimization(collection, operation, query) {
        const suggestions = [];

        if (operation === 'find' && Object.keys(query).length > 3) {
            suggestions.push('Consider reducing the number of query conditions or use indexed fields');
        }

        if (operation === 'find' && !query.limit) {
            suggestions.push('Add pagination using limit() and skip() to reduce memory usage');
        }

        if (operation.includes('sort') && Object.keys(query).length > 2) {
            suggestions.push('Ensure sort fields are indexed for better performance');
        }

        if (suggestions.length > 0) {
            logger.info(`Optimization suggestions for ${collection}`, suggestions);
        }
    }

    getStats() {
        return { ...this.queryStats };
    }

    reset() {
        this.queryStats = { total: 0, slow: 0, fast: 0, average: 0 };
    }
}

/**
 * Connection pooling configuration for Mongoose
 */
export const getOptimalConnectionConfig = () => {
    return {
        maxPoolSize: parseInt(process.env.DB_POOL_SIZE) || 10,
        minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
        maxIdleTimeMS: 60000,
        serverSelectionTimeoutMS: 5000,
        retryWrites: true
    };
};

/**
 * Indexes that should exist on collections for optimal performance
 */
export const RECOMMENDED_INDEXES = {
    users: [
        { fields: { email: 1 }, unique: true },
        { fields: { role: 1 } },
        { fields: { branchId: 1 } },
        { fields: { isActive: 1 } }
    ],
    orders: [
        { fields: { orderNumber: 1 }, unique: true },
        { fields: { customerId: 1, createdAt: -1 } },
        { fields: { branchId: 1, status: 1, createdAt: -1 } },
        { fields: { paymentStatus: 1, status: 1 } },
        { fields: { pickupDate: 1 } }
    ],
    inventory: [
        { fields: { itemName: 1, branchId: 1 } },
        { fields: { branchId: 1, reorderPending: 1 } },
        { fields: { currentStock: 1 } },
        { fields: { category: 1 } }
    ],
    payroll: [
        { fields: { employeeId: 1, payrollMonth: 1 }, unique: true },
        { fields: { branchId: 1, paymentStatus: 1 } },
        { fields: { paymentStatus: 1, paymentDate: 1 } }
    ],
    employees: [
        { fields: { userId: 1 }, unique: true },
        { fields: { employeeNumber: 1 }, unique: true },
        { fields: { branchId: 1, status: 1 } },
        { fields: { status: 1 } }
    ],
    notifications: [
        { fields: { userId: 1, createdAt: -1 } },
        { fields: { status: 1, sentAt: 1 } },
        { fields: { isRead: 1, createdAt: -1 } }
    ]
};

/**
 * Create indexes on collections
 */
export const createOptimizedIndexes = async (models = null) => {
    try {
        let modelsToUse = models;

        // If no models provided, try to get them from mongoose
        if (!modelsToUse || Object.keys(modelsToUse).length === 0) {
            try {
                const mongoose = (await import('mongoose')).default;
                
                // Wait a bit for models to be registered
                await new Promise(resolve => setTimeout(resolve, 500));
                
                const modelNames = mongoose.modelNames();
                if (modelNames.length === 0) {
                    logger.info('Skipping index creation - no mongoose models registered yet');
                    return;
                }

                modelsToUse = {};
                for (const modelName of modelNames) {
                    const model = mongoose.model(modelName);
                    modelsToUse[modelName.toLowerCase()] = model;
                }
            } catch (e) {
                logger.warn('Could not auto-load models for index creation:', e.message);
                return;
            }
        }

        if (!modelsToUse || Object.keys(modelsToUse).length === 0) {
            logger.info('Skipping index creation - no models available');
            return;
        }

        let indexedCount = 0;
        for (const [collection, indexes] of Object.entries(RECOMMENDED_INDEXES)) {
            // Find model by collection name (case-insensitive)
            const model = Object.values(modelsToUse).find(m => 
                m.collection.name === collection || 
                m.modelName?.toLowerCase() === collection
            ) || modelsToUse[collection];

            if (!model) {
                logger.debug(`No model found for collection ${collection}`);
                continue;
            }

            for (const indexSpec of indexes) {
                try {
                    await model.collection.createIndex(
                        indexSpec.fields,
                        { unique: indexSpec.unique || false, background: true }
                    );
                    indexedCount++;
                } catch (error) {
                    if (!error.message.includes('already exists')) {
                        logger.warn(`Failed to create index on ${collection}`, error.message);
                    }
                }
            }
        }
        
        if (indexedCount > 0) {
            logger.info(`Database indexes created/verified: ${indexedCount} indexes`);
        }
    } catch (error) {
        logger.error('Index creation error:', error.message);
    }
};

/**
 * Query building utility with performance best practices
 */
export class OptimizedQuery {
    constructor(model) {
        this.model = model;
        this.query = model.find({});
    }

    /**
     * Add filter conditions
     */
    filter(conditions) {
        this.query = this.query.where(conditions);
        return this;
    }

    /**
     * Add indexed sort
     */
    sortByIndexed(field, direction = 1) {
        this.query = this.query.sort({ [field]: direction });
        return this;
    }

    /**
     * Add pagination
     */
    paginate(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        this.query = this.query.skip(skip).limit(limit);
        return this;
    }

    /**
     * Select specific fields to reduce document size
     */
    selectFields(fields) {
        this.query = this.query.select(fields);
        return this;
    }

    /**
     * Populate references with field selection
     */
    populateOptimized(path, selectFields) {
        this.query = this.query.populate(path, selectFields);
        return this;
    }

    /**
     * Lean for read-only operations (faster)
     */
    lean() {
        this.query = this.query.lean();
        return this;
    }

    /**
     * Execute query and track performance
     */
    async execute() {
        const startTime = Date.now();
        const result = await this.query.exec();
        const duration = Date.now() - startTime;

        if (duration > 100) {
            logger.warn(`Slow query executed in ${duration}ms`);
        }

        return result;
    }

    /**
     * Execute count query
     */
    async count() {
        return this.query.countDocuments();
    }

    /**
     * Get query with pagination metadata
     */
    async executeWithMetadata(page = 1, limit = 10) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.query.skip(skip).limit(limit).exec(),
            this.query.countDocuments()
        ]);

        return {
            data,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            }
        };
    }
}

/**
 * Bulk operation helper for maintaining consistency
 */
export class BulkOperationHelper {
    constructor(model) {
        this.model = model;
        this.operations = [];
    }

    /**
     * Add insert operation
     */
    addInsert(document) {
        this.operations.push({ insertOne: { document } });
        return this;
    }

    /**
     * Add update operation
     */
    addUpdate(filter, update) {
        this.operations.push({ updateOne: { filter, update: { $set: update } } });
        return this;
    }

    /**
     * Add delete operation
     */
    addDelete(filter) {
        this.operations.push({ deleteOne: { filter } });
        return this;
    }

    /**
     * Execute all operations in batch
     */
    async executeBatch() {
        if (this.operations.length === 0) {
            return { acknowledged: true, modifiedCount: 0 };
        }

        try {
            const result = await this.model.collection.bulkWrite(this.operations);
            logger.info(`Bulk operation completed: ${this.operations.length} operations`);
            return result;
        } catch (error) {
            logger.error('Bulk operation failed:', error.message);
            throw error;
        }
    }

    /**
     * Clear operations
     */
    clear() {
        this.operations = [];
        return this;
    }
}

export const queryOptimizer = new QueryOptimizer();
