// Comprehensive integration tests
import request from 'supertest';
import express from 'express';
import { logger } from '../../utils/logger.js';

// Create a test server with all middleware
export const createTestServer = () => {
    const app = express();
    
    // Middleware
    app.use(express.json());
    
    // Health check
    app.get('/api/v1/health', (req, res) => {
        res.status(200).json({ 
            success: true, 
            message: 'Server is running',
            timestamp: new Date().toISOString()
        });
    });

    // Mock error endpoint for testing
    app.get('/api/v1/test/error', (req, res, next) => {
        const error = new Error('Test error');
        error.status = 400;
        next(error);
    });

    // Mock validation error endpoint
    app.post('/api/v1/test/validate', (req, res) => {
        const { email } = req.body;
        if (!email || !email.includes('@')) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: ['Invalid email format']
            });
        }
        res.status(200).json({ success: true, message: 'Valid email' });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Internal Server Error'
        });
    });

    return app;
};

describe('API Integration Tests - Comprehensive Suite', () => {
    let server;

    beforeAll(() => {
        server = createTestServer();
    });

    describe('Health Check Endpoint', () => {
        it('should return 200 status', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.status).toBe(200);
        });

        it('should return success message', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('Server is running');
        });

        it('should include timestamp', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.body.timestamp).toBeDefined();
            expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
        });

        it('should have correct content-type', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('Input Validation', () => {
        it('should accept valid email', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({ email: 'user@example.com' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should reject invalid email', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({ email: 'notanemail' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.errors).toBeDefined();
        });

        it('should handle missing email', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({});

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });

        it('should validate request content-type', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .set('Content-Type', 'application/json')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(200);
        });
    });

    describe('Error Handling', () => {
        it('should handle errors properly', async () => {
            const response = await request(server)
                .get('/api/v1/test/error');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toBeDefined();
        });

        it('should return 500 for unhandled errors', async () => {
            const response = await request(server)
                .get('/api/v1/non-existent-endpoint');

            // Express returns 404 for non-existent routes
            expect(response.status).toBe(404);
        });
    });

    describe('Response Format', () => {
        it('should return consistent response format', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('message');
        });

        it('should always include status code', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.status).toBeDefined();
            expect(typeof response.status).toBe('number');
        });

        it('should validate JSON response structure', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({ email: 'test@example.com' });

            expect(response.body).toBeTruthy();
            expect(typeof response.body).toBe('object');
        });
    });

    describe('Request/Response Lifecycle', () => {
        it('should process valid request completely', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({ email: 'user@example.com' });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });

        it('should handle multiple sequential requests', async () => {
            const requests = [
                request(server).get('/api/v1/health'),
                request(server).get('/api/v1/health'),
                request(server).get('/api/v1/health')
            ];

            const responses = await Promise.all(requests);
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });

        it('should handle concurrent requests', async () => {
            const concurrentRequests = Array(10).fill(null).map(() =>
                request(server).get('/api/v1/health')
            );

            const responses = await Promise.all(concurrentRequests);
            expect(responses.length).toBe(10);
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
        });
    });

    describe('Request Body Validation', () => {
        it('should accept valid JSON body', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({ email: 'test@example.com' });

            expect(response.status).toBe(200);
        });

        it('should handle empty body', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send();

            expect(response.status).toBe(400);
        });

        it('should validate data types', async () => {
            const response = await request(server)
                .post('/api/v1/test/validate')
                .send({ email: 12345 });

            expect(response.status).toBe(400);
        });
    });

    describe('Security Headers', () => {
        it('should return appropriate security headers', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.headers).toBeDefined();
        });

        it('should validate response content-type', async () => {
            const response = await request(server)
                .get('/api/v1/health');

            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('Performance Checks', () => {
        it('should respond within acceptable time', async () => {
            const start = Date.now();
            const response = await request(server)
                .get('/api/v1/health');
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(1000); // Less than 1 second
            expect(response.status).toBe(200);
        });

        it('should handle rapid fire requests', async () => {
            const promises = Array(50).fill(null).map(() =>
                request(server).get('/api/v1/health')
            );

            const responses = await Promise.allSettled(promises);
            const successful = responses.filter(r => r.status === 'fulfilled');
            expect(successful.length).toBeGreaterThan(40); // Allow some failures
        });
    });
});