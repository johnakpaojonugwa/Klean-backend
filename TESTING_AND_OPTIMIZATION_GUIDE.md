# Testing and Performance Optimization Guide

## Overview

This document guides you through running the comprehensive test suite, load testing, and performance optimization features that have been integrated into the Klean backend. All testing infrastructure has been configured and is ready to execute.

## Prerequisites

Ensure you have installed all dependencies:
```bash
npm install
```

This installs all required packages including:
- **jest** (29.7.0) - Unit testing framework
- **supertest** (6.3.3) - HTTP testing library
- **artillery** (2.0.0) - Load testing tool
- **compression** (1.7.4) - Response compression middleware
- **redis** (4.6.11) - Optional caching backend

## Phase 1: Unit Tests

### What's Tested
**File:** `tests/unit/validators.test.js` (147 lines, 40+ test cases)

- Email validation (valid/invalid formats, edge cases, null handling)
- Password strength (8+ chars, uppercase, number, special character)
- Phone number validation (7-15 digits, international formats)
- Input sanitization (XSS prevention, whitespace handling, unicode support)
- Edge cases (very long strings, unicode characters, special patterns)

### Run Tests
```bash
npm run test:unit
```

### Expected Output
```
PASS  tests/unit/validators.test.js
  Email Validation
    ✓ should validate correct email addresses (XX ms)
    ✓ should reject invalid email addresses (XX ms)
    ✓ should handle edge cases (XX ms)
    ...
  
  Password Validation
    ✓ should validate strong passwords (XX ms)
    ✓ should reject weak passwords (XX ms)
    ...

Test Suites: 1 passed, 1 total
Tests: 40+ passed, 40+ total
```

---

## Phase 2: Integration Tests

### What's Tested
**File:** `tests/integration/comprehensive.test.js` (400+ lines, 50+ test cases)

- Health check endpoint (status, message, timestamp validation)
- Input validation (valid/invalid data, missing fields, type checking)
- Error handling (error response formats, 500 error scenarios)
- Response format (consistent structure, correct status codes)
- Request/response lifecycle (sequential requests, data persistence)
- Concurrent request handling (parallel requests, race conditions)
- Security headers (proper headers set on responses)
- Performance checks (response time < 1 second, 50 concurrent requests)

### Run Tests
```bash
npm run test:integration
```

### Prerequisites for Integration Tests

1. **Test Database Setup**: Create a MongoDB database for testing:
   ```bash
   # Update .env.test with test database connection
   MONGODB_URI=mongodb://localhost:27017/klean-test
   ```

2. **Start MongoDB** (if using local instance):
   ```bash
   # On Windows
   mongod
   
   # On Mac/Linux
   mongod --dbpath /path/to/db
   ```

3. **Ensure Server is Stopped**: Don't run the normal server before integration tests

### Expected Output
```
PASS  tests/integration/comprehensive.test.js
  Integration Tests
    Health Check
      ✓ should return 200 status (XX ms)
      ✓ should include success message (XX ms)
      ...
    
    Input Validation
      ✓ should accept valid input (XX ms)
      ✓ should reject invalid input (XX ms)
      ...
    
    Concurrent Requests
      ✓ should handle 50 concurrent requests (XXms)
      ...

Test Suites: 1 passed, 1 total
Tests: 50+ passed, 50+ total
Time: X.XXXs
```

---

## Phase 3: Load Testing (Normal Conditions)

### What's Tested
**File:** `tests/load/load-test.yml` with 5 realistic scenarios:

1. **Health Check Spike** (30% weight) - Rapid health check requests
2. **Order Creation** (25% weight) - Simulates order placement workflow
3. **Inventory Management** (20% weight) - Stock checking and updates
4. **User Listing** (15% weight) - Pagination-heavy read operations
5. **Analytics Retrieval** (10% weight) - Complex dashboard queries

### Load Profile
```
Phase 1: Warm-up       (60s)  - 10 req/s
Phase 2: Ramp-up       (120s) - Gradually increase to 50 req/s
Phase 3: High Load      (120s) - Sustain 100 req/s
Phase 4: Cool-down      (60s)  - Decrease to 50 req/s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Duration: ~6 minutes
Total Requests: ~15,000 requests
```

### Prerequisites

1. **Start the Server**:
   ```bash
   npm start
   # Or in another terminal
   node server.js
   ```

2. **Ensure Database is Running**:
   ```bash
   # Start MongoDB
   mongod
   ```

3. **Optional: Configure Redis** (for caching tests):
   ```bash
   # Start Redis
   redis-server
   
   # Or set environment variable to skip Redis
   REDIS_DISABLED=true npm start
   ```

### Run Load Tests
```bash
npm run load:test
```

### Expected Output
```
loaded configuration from load-test.yml
completed warm up (0 to 10 req/s) in 60 seconds
ramped to 50 req/s
✓ Health Check Spike (30%)
  ✓ p95: 45ms
  ✓ p99: 120ms
✓ Order Creation (25%)
  ✓ p95: 250ms
  ✓ p99: 450ms
✓ Inventory Management (20%)
  ✓ p95: 180ms
  ✓ p99: 350ms
✓ User Listing (15%)
  ✓ p95: 220ms
  ✓ p99: 380ms
✓ Analytics Retrieval (10%)
  ✓ p95: 380ms
  ✓ p99: 650ms

All virtual users: 100
Completed requests: 15,000
Mean latency: 320ms
95th percentile latency: 250ms
99th percentile latency: 650ms
Error rate: < 0.1%
```

### Key Metrics to Monitor
- **p95 latency**: 95% of requests below this time (target: < 300ms)
- **p99 latency**: 99% of requests below this time (target: < 500ms)
- **Mean latency**: Average response time (target: < 200ms)
- **Error rate**: Percentage of failed requests (target: < 0.5%)
- **Throughput**: Requests per second (baseline for capacity planning)

---

## Phase 4: Stress Testing (Extreme Conditions)

### What's Tested
**File:** `tests/load/stress-test.yml` with extreme load:

1. **Database Stress** (40% weight) - Heavy database operations
2. **Concurrent Writes** (30% weight) - Multiple simultaneous updates
3. **Connection Pool** (20% weight) - Maximum connection utilization
4. **Large Payloads** (10% weight) - High-volume data transfers

### Stress Profile
```
Extreme Load Phase (120s) - Ramp to 300+ req/s
   Target throughput: 300+ requests per second
   Virtual users: 500
   Iterations per scenario: 3-5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Duration: ~2 minutes
Total Requests: ~36,000+ requests
```

### Prerequisites

Same as load testing:
- Server running
- Database running
- Optional: Redis for caching

### Run Stress Tests
```bash
npm run load:stress
```

### Expected Output
```
loaded configuration from stress-test.yml
ramped to 300 req/s over 120 seconds...
✓ Database Stress (40%)
  ✓ p95: 180ms
  ✓ p99: 420ms
✓ Concurrent Writes (30%)
  ✓ p95: 250ms
  ✓ p99: 550ms
✓ Connection Pool (20%)
  ✓ p95: 220ms
  ✓ p99: 480ms
✓ Large Payloads (10%)
  ✓ p95: 380ms
  ✓ p99: 750ms

All virtual users: 500
Completed requests: 36,000
Mean latency: 385ms
95th percentile latency: 280ms
99th percentile latency: 750ms
Error rate: < 1%  ← May see slightly higher errors under extreme load
Successful requests: ~35,640 (99% success rate)
```

### What to Watch For
- 🟢 **Good**: p99 latency < 1000ms, error rate < 1%
- 🟡 **Warning**: p99 latency 1000-2000ms, error rate 1-5%
- 🔴 **Critical**: p99 latency > 2000ms, error rate > 5%

---

## Phase 5: Full Test Suite

### Run All Tests
```bash
npm test
```

This executes:
1. Unit tests (validators)
2. Integration tests (API)
3. All test suites in sequence

### Expected Time
- Unit tests: ~5-10 seconds
- Integration tests: ~30-60 seconds
- **Total**: ~1-2 minutes

---

## Performance Features Integrated

### 1. Response Compression
**Location:** `middlewares/performanceOptimization.js`

- Gzip compression for JSON responses > 1KB
- Compression level: 6 (good balance of CPU vs. ratio)
- Automatically reduces payload size by 60-80% for typical JSON

**Verification:**
```bash
# Check response headers
curl -i http://localhost:3000/api/v1/health

# Should show:
# Content-Encoding: gzip
```

### 2. Performance Monitoring
**Endpoint:** `/api/v1/stats/performance`

Tracks:
- Response time histogram (6 buckets: 0-50ms, 50-100ms, 100-500ms, 500-1000ms, 1000-2000ms, 2000+ms)
- Slow request detection (> 500ms warning, > 2000ms critical)
- Total requests processed
- Average response time

**Example Response:**
```json
{
  "success": true,
  "data": {
    "totalRequests": 15420,
    "averageResponseTime": 245,
    "histogram": {
      "0-50ms": 3200,
      "50-100ms": 4100,
      "100-500ms": 5800,
      "500-1000ms": 1900,
      "1000-2000ms": 370,
      "2000+ms": 50
    },
    "slowRequests": 420,
    "criticalRequests": 50,
    "uptime": 1285,
    "memoryUsage": {
      "heapUsed": 145,
      "heapTotal": 512,
      "external": 23
    }
  }
}
```

### 3. Memory Monitoring
**Automatic Alerts** (checks every 30 seconds):

- 🟡 **Warning**: At 75% heap usage - logs warning
- 🔴 **Critical**: At 90% heap usage - logs critical alert

View memory stats:
```bash
# Check server logs for memory warnings
# Or fetch performance stats endpoint
curl http://localhost:3000/api/v1/stats/performance | jq '.data.memoryUsage'
```

### 4. Caching Layer
**Location:** `middlewares/caching.js`

- **Default**: Redis-backed distributed cache (when available)
- **Fallback**: In-memory cache (when Redis unavailable)
- **TTL**: 3600 seconds (1 hour) default
- **Automatic Invalidation**: On POST/PUT/PATCH/DELETE operations

**Cached Routes by Prefix:**
- `orders:*` for GET /orders endpoints
- `inventory:*` for GET /inventory endpoints
- `users:*` for GET /users endpoints
- `branches:*` for GET /branch endpoints
- `payroll:*` for GET /payroll endpoints
- `analytics:*` for GET /analytics endpoints

**Cache Endpoints:**

1. **View Cache Statistics**:
```bash
curl http://localhost:3000/api/v1/stats/cache
```

2. **Manual Cache Invalidation**:
```bash
curl -X POST http://localhost:3000/api/v1/admin/cache/invalidate \
  -H "Content-Type: application/json" \
  -d '{"pattern": "orders:*"}'
```

**Example Cache Response:**
```json
{
  "success": true,
  "data": {
    "hitRate": 0.65,
    "hits": 1300,
    "misses": 700,
    "itemsInCache": 450,
    "backend": "redis"
  }
}
```

### 5. Database Query Optimization
**Location:** `utils/queryOptimizer.js`

**Recommended Indexes** (24 total):

| Collection | Indexes |
|-----------|---------|
| users | email (unique), role, branchId, isActive |
| orders | orderNumber (unique), (customerId, createdAt), (branchId, status, createdAt), (paymentStatus, status), pickupDate |
| inventory | (itemName, branchId), (branchId, reorderPending), currentStock, category |
| payroll | (employeeId, payrollMonth unique), (branchId, paymentStatus), (paymentStatus, paymentDate) |
| employees | userId (unique), employeeNumber (unique), (branchId, status), status |
| notifications | (userId, createdAt), (status, sentAt), (isRead, createdAt) |

**Index Creation** (automatic on server startup):
```javascript
// Done automatically when server starts
// Check MongoDB logs for index creation messages
```

**Verify Indexes Were Created**:
```bash
# In MongoDB shell
use klean-production
db.orders.getIndexes()
# Should show all recommended indexes
```

---

## Complete Testing Workflow

### Step 1: Setup Phase (5 minutes)
```bash
# 1. Install dependencies
npm install

# 2. Create .env.test file with test database
# MONGODB_URI=mongodb://localhost:27017/klean-test

# 3. Start MongoDB
mongod

# 4. Ensure .env has correct values
cat .env
```

### Step 2: Unit Testing (5-10 minutes)
```bash
# Run unit tests
npm run test:unit

# Expected: 40+ tests pass in ~5-10 seconds
# Check: All validators working correctly
```

### Step 3: Integration Testing (30-60 minutes)
```bash
# Run integration tests
npm run test:integration

# Expected: 50+ tests pass in ~30-60 seconds
# Check: API endpoints working end-to-end
```

### Step 4: Load Testing (6 minutes)
```bash
# In one terminal: Start the server
npm start

# Wait for "Server is running on port..."

# In another terminal: Run load test
npm run load:test

# Expected: See throughput increase over 6 minutes
# Analyze: p95/p99 latencies, error rate
```

### Step 5: Stress Testing (2 minutes)
```bash
# Server should still be running

# Run stress test in another terminal
npm run load:stress

# Expected: High throughput (300+ req/s), acceptable error rate (< 1%)
# Monitor: System resources (CPU, Memory)
```

### Step 6: Performance Analysis (5 minutes)
```bash
# Check performance stats while server is running
curl http://localhost:3000/api/v1/stats/performance | jq

# Check cache stats
curl http://localhost:3000/api/v1/stats/cache | jq

# Review server logs for warnings
tail -f logs/*.log
```

---

## Results Interpretation Guide

### Load Test Results

**Good Response Times** (Load Test - 100 req/s):
- p95 latency: 200-350ms
- p99 latency: 400-700ms
- Mean latency: 150-250ms
- Error rate: < 0.5%

**Good Stress Test Results** (Stress Test - 300+ req/s):
- p95 latency: 300-600ms
- p99 latency: 700-1500ms
- Mean latency: 250-450ms
- Error rate: < 1.0%
- Success rate: > 99%

**Performance Improvements to Note:**
- Cache hit rate: 40-70% (should increase after warm-up)
- Response compression: 60-80% size reduction
- Memory usage: Should remain stable (not growing)
- Slow requests: Should be < 5% of total

### What Each Test Tells You

| Test | Tells You |
|------|-----------|
| Unit tests | Input validation and data processing work correctly |
| Integration tests | API endpoints work end-to-end, responses are correct |
| Load tests | System handles normal production load (100 req/s) |
| Stress tests | System gracefully degrades under extreme load (300+ req/s) |
| Performance stats | Real-time system health and bottlenecks |

---

## Next Steps After Testing

### If All Tests Pass ✅
1. **Document baseline metrics**: Save load test results
2. **Enable Redis**: Configure Redis for distributed caching
3. **Create production indexes**: Run index creation on production database
4. **Deploy to staging**: Test in staging environment with real data volume
5. **Monitor production**: Set up alerts for performance degradation
6. **Plan optimization**: Use load test results to identify bottlenecks

### If Tests Show Issues ⚠️

**High Error Rate (> 2%)**
- Check server logs for errors
- Verify database is running and has correct credentials
- Check network connectivity
- Increase timeout values if needed

**High Latency (p99 > 1500ms)**
- Check database indexes are created
- Monitor CPU and memory during tests
- Enable Redis caching
- Look for slow queries in logs
- Consider query optimization

**Memory Growing During Tests**
- Check for memory leaks in code
- Monitor garbage collection
- Reduce cache TTL
- Consider reducing batch sizes

---

## Troubleshooting

### "Cannot find module" Errors
```bash
# Reinstall dependencies
npm install

# Clear npm cache
npm cache clean --force
npm install
```

### Database Connection Errors
```bash
# Verify MongoDB is running
# Check connection string in .env
# Try connecting manually:
mongo "mongodb://localhost:27017/klean-test"
```

### Load Test Failures
```bash
# Check server is running on correct port
curl http://localhost:3000/api/v1/health

# Check logs
tail -f logs/app.log

# Reduce load if server is overloaded
# Edit load-test.yml and reduce arrive-rate values
```

### Redis Connection Issues
```bash
# Option 1: Start Redis
redis-server

# Option 2: Disable Redis (use in-memory cache)
REDIS_DISABLED=true npm start
```

---

## Production Checklist

Before deploying to production:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Load test successful (p99 < 800ms)
- [ ] Stress test baseline established
- [ ] Database indexes created and verified
- [ ] Redis configured and tested (optional)
- [ ] Response compression verified
- [ ] Rate limiting verified
- [ ] Error handling tested
- [ ] Performance baseline documented
- [ ] Monitoring/alerting configured
- [ ] Security audit completed
- [ ] Documentation reviewed and updated

---

## Support and Diagnostics

### Check Server Health
```bash
curl -v http://localhost:3000/api/v1/health
```

### View Real-time Performance
```bash
# Terminal 1: Start server with monitoring
npm start

# Terminal 2: Watch performance metrics
watch -n 1 'curl -s http://localhost:3000/api/v1/stats/performance | jq'
```

### Analyze Database Performance
```bash
# In MongoDB shell
db.currentOp()
# Shows active operations
```

### Check Logs
```bash
# View application logs
tail -f logs/app.log

# View error logs
tail -f logs/error.log
```

---

## Summary

Your Klean backend now has:
- ✅ Comprehensive unit and integration test suite (90+ tests)
- ✅ Load testing configuration (normal conditions)
- ✅ Stress testing configuration (extreme conditions)
- ✅ Response compression middleware
- ✅ Performance monitoring with stats endpoints
- ✅ Memory monitoring with alerts
- ✅ Distributed caching with automatic invalidation
- ✅ Database query optimization utilities
- ✅ Recommended indexes for all collections

**Next Action**: Run the complete test suite to establish baseline metrics and identify any optimization opportunities!
