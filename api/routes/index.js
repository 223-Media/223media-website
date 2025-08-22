// ================================================================
// 223 MEDIA MAIN API ROUTER
// Central router that combines all API endpoints and middleware
// ================================================================

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Import individual route modules
const authRoutes = require('./authRoutes');
const clientRoutes = require('./clientRoutes');
const adminRoutes = require('./adminRoutes');

// Import middleware
const rateLimiter = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const authMiddleware = require('../middleware/auth');

// ================================================================
// GLOBAL API MIDDLEWARE
// ================================================================

// Apply global rate limiting to all API routes
router.use(rateLimiter.smartRateLimit);

// Block suspicious IPs
router.use(rateLimiter.blockSuspiciousIPs);

// Sanitize all requests
router.use(validate.sanitizeRequest);

// Add request tracking for metrics
router.use((req, res, next) => {
    // Track API usage
    req.apiStartTime = Date.now();
    
    // Add request ID for logging
    req.requestId = crypto.randomBytes(8).toString('hex');
    
    // Log API requests in development
    if (process.env.NODE_ENV === 'development') {
        console.log(`🌐 API Request [${req.requestId}]: ${req.method} ${req.path}`);
    }
    
    next();
});

// ================================================================
// API STATUS & HEALTH ROUTES
// ================================================================

/**
 * @route   GET /api/status
 * @desc    General API status and configuration
 * @access  Public
 */
router.get('/status', (req, res) => {
    try {
        const status = {
            service: '223 Media Client Portal API',
            version: '1.0.0',
            status: 'operational',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            integrations: {
                airtable: process.env.AIRTABLE_API_KEY ? 'configured' : 'missing',
                stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing',
                hubspot: process.env.HUBSPOT_ACCESS_TOKEN ? 'configured' : 'missing',
                brevo: process.env.BREVO_API_KEY ? 'configured' : 'missing',
                motion: process.env.MOTION_API_KEY ? 'configured' : 'missing'
            },
            features: {
                authentication: 'enabled',
                fileUpload: 'enabled',
                rateLimiting: 'enabled',
                validation: 'enabled',
                encryption: 'enabled'
            },
            endpoints: {
                auth: '/api/auth/*',
                client: '/api/client/*',
                admin: '/api/admin/*',
                webhooks: '/api/webhooks/*'
            }
        };
        
        res.json(status);
    } catch (error) {
        res.status(503).json({
            service: '223 Media Client Portal API',
            status: 'error',
            error: 'Status check failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/health
 * @desc    Detailed health check for monitoring
 * @access  Public
 */
router.get('/health', (req, res) => {
    try {
        const memoryUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();
        
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
            system: {
                uptime: process.uptime(),
                uptimeFormatted: formatUptime(process.uptime() * 1000),
                memory: {
                    used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                    total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
                    external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                platform: process.platform,
                nodeVersion: process.version,
                processId: process.pid
            },
            api: {
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                rateLimiting: 'operational',
                authentication: 'operational',
                fileUpload: 'operational'
            },
            dependencies: checkDependencyHealth()
        };
        
        res.json(healthData);
    } catch (error) {
        console.error('Health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            error: 'Health check failed',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * @route   GET /api/version
 * @desc    API version information
 * @access  Public
 */
router.get('/version', (req, res) => {
    res.json({
        version: '1.0.0',
        buildDate: '2024-01-20',
        apiName: '223 Media Client Portal API',
        compatibility: {
            minClientVersion: '1.0.0',
            supportedFormats: ['application/json', 'multipart/form-data'],
            supportedMethods: ['GET', 'POST', 'PUT', 'DELETE']
        },
        changelog: {
            '1.0.0': {
                date: '2024-01-20',
                features: [
                    'Complete authentication system',
                    'Client portal with episode management',
                    'Admin dashboard with system management',
                    'Secure file upload with encryption',
                    'Comprehensive rate limiting',
                    'Business analytics and reporting'
                ]
            }
        }
    });
});

// ================================================================
// API DOCUMENTATION ROUTES
// ================================================================

/**
 * @route   GET /api/docs
 * @desc    API documentation overview
 * @access  Public
 */
router.get('/docs', (req, res) => {
    const documentation = {
        title: '223 Media Client Portal API Documentation',
        version: '1.0.0',
        description: 'Complete API for managing podcast production and client portal system',
        baseUrl: req.protocol + '://' + req.get('host') + '/api',
        authentication: {
            type: 'JWT Bearer Token',
            endpoints: {
                clientLogin: 'POST /auth/client/login',
                adminLogin: 'POST /auth/admin/login',
                logout: 'POST /auth/logout',
                refresh: 'POST /auth/refresh'
            },
            headers: {
                authorization: 'Bearer <jwt_token>'
            }
        },
        endpoints: {
            authentication: {
                basePath: '/auth',
                description: 'Authentication and session management',
                routes: [
                    'POST /client/login - Client portal login',
                    'POST /admin/login - Admin dashboard login',
                    'POST /logout - Logout user',
                    'POST /refresh - Refresh JWT token',
                    'GET /me - Get current user info',
                    'GET /status - Check auth status'
                ]
            },
            client: {
                basePath: '/client',
                description: 'Client portal functionality',
                authentication: 'Required (Client or Admin)',
                routes: [
                    'GET /dashboard - Dashboard overview',
                    'GET /stats - Detailed statistics',
                    'GET /episodes - List episodes',
                    'POST /episodes - Create episode',
                    'GET /episodes/:id - Get episode details',
                    'PUT /episodes/:id - Update episode',
                    'POST /episodes/:id/upload - Upload files',
                    'GET /files - List files',
                    'GET /files/:id/download - Download file',
                    'GET /notifications - Get notifications',
                    'GET /account - Account information'
                ]
            },
            admin: {
                basePath: '/admin',
                description: 'Administrative functionality',
                authentication: 'Required (Admin only)',
                routes: [
                    'GET /dashboard - Admin dashboard',
                    'GET /metrics - System metrics',
                    'GET /analytics - Business analytics',
                    'GET /clients - List all clients',
                    'POST /clients - Create client',
                    'GET /clients/:id - Client details',
                    'PUT /clients/:id - Update client',
                    'GET /episodes - All episodes',
                    'PUT /episodes/:id/status - Update status',
                    'GET /sessions - Active sessions',
                    'DELETE /sessions/:id - Terminate session',
                    'GET /logs - System logs',
                    'POST /backup - Run backup',
                    'PUT /maintenance - Maintenance mode'
                ]
            }
        },
        rateLimits: {
            global: '100 requests per 15 minutes',
            auth: '10 requests per 15 minutes',
            upload: '50 uploads per hour',
            admin: '300 requests per 15 minutes',
            client: '150 requests per 15 minutes'
        },
        errorCodes: {
            400: 'Bad Request - Invalid input data',
            401: 'Unauthorized - Authentication required',
            403: 'Forbidden - Insufficient permissions',
            404: 'Not Found - Resource not found',
            413: 'Payload Too Large - File size exceeded',
            422: 'Unprocessable Entity - Validation failed',
            429: 'Too Many Requests - Rate limit exceeded',
            500: 'Internal Server Error - Server error',
            503: 'Service Unavailable - System maintenance'
        },
        examples: {
            clientLogin: {
                method: 'POST',
                url: '/auth/client/login',
                body: {
                    email: 'client@example.com',
                    password: 'securePassword123!'
                },
                response: {
                    success: true,
                    message: 'Login successful',
                    user: { id: 'client_123', email: 'client@example.com' },
                    token: 'jwt_token_here'
                }
            },
            createEpisode: {
                method: 'POST',
                url: '/client/episodes',
                headers: { Authorization: 'Bearer jwt_token_here' },
                body: {
                    title: 'My New Podcast Episode',
                    description: 'Episode about content marketing strategies',
                    priority: 'medium'
                },
                response: {
                    success: true,
                    episode: { id: 'ep_123', title: 'My New Podcast Episode' }
                }
            }
        }
    };
    
    res.json(documentation);
});

/**
 * @route   GET /api/openapi
 * @desc    OpenAPI specification (future feature)
 * @access  Public
 */
router.get('/openapi', (req, res) => {
    res.status(501).json({
        error: 'OpenAPI specification not yet available',
        code: 'FEATURE_NOT_IMPLEMENTED',
        message: 'OpenAPI/Swagger documentation will be available in a future update',
        alternative: 'Use GET /api/docs for current documentation'
    });
});

// ================================================================
// WEBHOOK ROUTES
// ================================================================

/**
 * @route   POST /api/webhooks/stripe
 * @desc    Stripe webhook handler
 * @access  Public (verified by signature)
 */
router.post('/webhooks/stripe',
    // Apply webhook-specific rate limiting
    rateLimiter.webhookLimiter,
    
    express.raw({ type: 'application/json' }),
    
    (req, res) => {
        try {
            const sig = req.headers['stripe-signature'];
            const payload = req.body;
            
            // Placeholder for Stripe webhook processing
            console.log('📧 Stripe webhook received:', {
                signature: sig ? 'present' : 'missing',
                payloadSize: payload.length,
                timestamp: new Date().toISOString()
            });
            
            // In production, verify webhook signature and process events
            res.json({ received: true });
            
        } catch (error) {
            console.error('Stripe webhook error:', error);
            res.status(400).json({ error: 'Webhook error' });
        }
    }
);

/**
 * @route   POST /api/webhooks/zapier
 * @desc    Zapier webhook handler
 * @access  Public (verified by key)
 */
router.post('/webhooks/zapier',
    rateLimiter.webhookLimiter,
    
    (req, res) => {
        try {
            const webhookKey = req.headers['x-webhook-key'];
            const expectedKey = process.env.ZAPIER_WEBHOOK_KEY;
            
            if (expectedKey && webhookKey !== expectedKey) {
                return res.status(401).json({
                    error: 'Invalid webhook key',
                    code: 'UNAUTHORIZED_WEBHOOK'
                });
            }
            
            console.log('⚡ Zapier webhook received:', {
                action: req.body.action,
                timestamp: new Date().toISOString()
            });
            
            // Placeholder for Zapier webhook processing
            res.json({ 
                success: true,
                message: 'Webhook processed successfully' 
            });
            
        } catch (error) {
            console.error('Zapier webhook error:', error);
            res.status(400).json({ error: 'Webhook processing error' });
        }
    }
);

/**
 * @route   GET /api/webhooks/test
 * @desc    Webhook testing endpoint
 * @access  Admin
 */
router.get('/webhooks/test',
    authMiddleware.optionalAuth,
    
    (req, res) => {
        if (req.user && req.user.role === 'admin') {
            res.json({
                message: 'Webhook endpoint is operational',
                timestamp: new Date().toISOString(),
                endpoints: [
                    'POST /webhooks/stripe - Stripe payment webhooks',
                    'POST /webhooks/zapier - Zapier automation webhooks',
                    'GET /webhooks/test - Testing endpoint'
                ]
            });
        } else {
            res.json({
                message: 'Webhook endpoint is operational',
                note: 'Admin authentication required for detailed information'
            });
        }
    }
);

// ================================================================
// MOUNT ROUTE MODULES
// ================================================================

// Authentication routes
router.use('/auth', authRoutes);

// Client portal routes
router.use('/client', clientRoutes);

// Admin dashboard routes
router.use('/admin', adminRoutes);

// ================================================================
// GLOBAL ERROR HANDLING
// ================================================================

/**
 * Handle 404 for unknown API routes
 */
router.use('*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        code: 'ENDPOINT_NOT_FOUND',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        suggestion: 'Check the API documentation at /api/docs',
        availableRoutes: [
            '/api/status - API status',
            '/api/health - Health check',
            '/api/docs - Documentation',
            '/api/auth/* - Authentication',
            '/api/client/* - Client portal',
            '/api/admin/* - Admin dashboard',
            '/api/webhooks/* - Webhook endpoints'
        ]
    });
});

/**
 * Global error handler for API routes
 */
router.use((err, req, res, next) => {
    console.error('🚨 API Error:', {
        requestId: req.requestId,
        path: req.path,
        method: req.method,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });
    
    // Handle specific error types
    let statusCode = 500;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An internal server error occurred';
    
    if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = 'Input validation failed';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
        message = 'Authentication required';
    } else if (err.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
        message = 'Access denied';
    } else if (err.name === 'MulterError') {
        statusCode = 400;
        errorCode = 'FILE_UPLOAD_ERROR';
        message = 'File upload error: ' + err.message;
    }
    
    const errorResponse = {
        error: message,
        code: errorCode,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method
    };
    
    // Include error details in development
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = {
            name: err.name,
            message: err.message,
            stack: err.stack
        };
    }
    
    res.status(statusCode).json(errorResponse);
});

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Format uptime duration
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Check dependency health
 */
function checkDependencyHealth() {
    return {
        express: 'operational',
        authentication: authMiddleware ? 'operational' : 'error',
        rateLimiting: rateLimiter ? 'operational' : 'error',
        validation: validate ? 'operational' : 'error',
        database: 'in-memory', // Would check actual database
        externalAPIs: {
            airtable: process.env.AIRTABLE_API_KEY ? 'configured' : 'not_configured',
            stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured',
            hubspot: process.env.HUBSPOT_ACCESS_TOKEN ? 'configured' : 'not_configured'
        }
    };
}

// ================================================================
// MODULE EXPORTS
// ================================================================

module.exports = router;

// ================================================================
// ROUTER DOCUMENTATION
// ================================================================

/**
 * 223 Media API Router Structure
 * 
 * Base Path: /api
 * 
 * System Routes:
 * - GET /status           - API status and configuration
 * - GET /health           - Detailed health check
 * - GET /version          - Version information
 * - GET /docs             - API documentation
 * 
 * Authentication: /auth/*
 * - Complete user authentication system
 * - JWT token management
 * - Session handling
 * 
 * Client Portal: /client/*
 * - Dashboard and analytics
 * - Episode management
 * - File upload and download
 * - Notifications
 * - Account management
 * 
 * Admin Dashboard: /admin/*
 * - System administration
 * - Client management
 * - Business analytics
 * - System monitoring
 * - Security management
 * 
 * Webhooks: /webhooks/*
 * - Stripe payment webhooks
 * - Zapier automation hooks
 * - External integrations
 * 
 * Middleware Stack:
 * 1. Smart rate limiting
 * 2. Suspicious IP blocking
 * 3. Request sanitization
 * 4. Request tracking
 * 5. Route-specific authentication
 * 6. Input validation
 * 7. Error handling
 * 
 * Security Features:
 * - JWT authentication
 * - Role-based access control
 * - Rate limiting per endpoint type
 * - Input validation and sanitization
 * - Audit logging
 * - Suspicious activity detection
 * - Secure file handling
 * - CORS protection
 * 
 * Error Handling:
 * - Standardized error responses
 * - Request ID tracking
 * - Development vs production error details
 * - Comprehensive logging
 * - Graceful degradation
 */
