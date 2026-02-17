import { sendResponse, sendError } from '../../utils/response.js';

// Helper function to create mock objects for ES modules
const createMockResponse = () => {
    const mockRes = {
        statusCode: null,
        body: null
    };
    
    mockRes.status = function(code) {
        this.statusCode = code;
        return this;
    };
    
    mockRes.json = function(data) {
        this.body = data;
        return this;
    };
    
    return mockRes;
};

describe('Response Utilities', () => {
    describe('sendResponse', () => {
        it('should format success response correctly', () => {
            const res = createMockResponse();

            sendResponse(res, 200, true, 'Success', { data: 'test' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({
                success: true,
                message: 'Success',
                data: { data: 'test' }
            });
        });

        it('should set correct status code', () => {
            const res = createMockResponse();

            sendResponse(res, 201, true, 'Created', {});

            expect(res.statusCode).toBe(201);
        });
    });

    describe('sendError', () => {
        it('should format error response correctly', () => {
            const res = createMockResponse();

            sendError(res, 400, 'Bad Request', ['Field required']);

            expect(res.statusCode).toBe(400);
            expect(res.body).toEqual({
                success: false,
                message: 'Bad Request',
                errors: ['Field required']
            });
        });

        it('should handle errors without details', () => {
            const res = createMockResponse();

            sendError(res, 500, 'Server Error');

            expect(res.statusCode).toBe(500);
        });
    });
});
