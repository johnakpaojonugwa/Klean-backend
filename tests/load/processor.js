/**
 * Load test processor - Custom setup/teardown and hooks
 */

module.exports = {
    /**
     * Set custom headers for all requests
     */
    setCustomHeaders: (requestParams, context, ee, next) => {
        // Add request ID for tracking
        requestParams.headers['X-Request-ID'] = context.vars.$uuid;
        
        // Add timestamp
        requestParams.headers['X-Request-Time'] = new Date().toISOString();
        
        // Simulate different user agents
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Mozilla/5.0 (Linux; Android 11)',
            'Artillery Load Test Bot'
        ];
        requestParams.headers['User-Agent'] = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        return next();
    },

    /**
     * Generate mock tokens for testing
     */
    generateToken: (context, ee, next) => {
        // Simulate JWT token generation
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
        const payload = Buffer.from(JSON.stringify({
            id: context.vars.$uuid,
            role: ['SUPER_ADMIN', 'BRANCH_MANAGER', 'STAFF', 'CUSTOMER'][Math.floor(Math.random() * 4)],
            iat: Math.floor(Date.now() / 1000)
        })).toString('base64');
        const signature = Buffer.from('test-signature').toString('base64');

        context.vars.token = `${header}.${payload}.${signature}`;
        return next();
    },

    /**
     * Log response metrics
     */
    logMetrics: (requestParams, responseParams, context, ee, next) => {
        const duration = responseParams.headers['x-response-time'] || 0;
        
        if (duration > 1000) {
            console.warn(`SLOW REQUEST: ${requestParams.method} ${requestParams.path} took ${duration}ms`);
        }
        
        return next();
    },

    /**
     * Validate response structure
     */
    validateResponse: (requestParams, responseParams, context, ee, next) => {
        if (responseParams.body) {
            try {
                const body = JSON.parse(responseParams.body);
                
                // Check for required fields in response
                if (body.success === undefined) {
                    console.warn('Missing "success" field in response');
                }
            } catch (e) {
                console.error('Invalid JSON response:', e.message);
            }
        }
        
        return next();
    }
};
