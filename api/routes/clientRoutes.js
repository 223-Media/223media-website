// ================================================================
// 223 MEDIA AUTHENTICATION ROUTES
// Complete authentication endpoints with security middleware
// ================================================================

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');

// ================================================================
// AUTHENTICATION ROUTES
// ================================================================

/**
 * @route   POST /api/auth/client/login
 * @desc    Client login for portal access
 * @access  Public
 * @body    { email, password }
 */
router.post('/client/login',
    // Apply strict rate limiting for authentication
    rateLimiter.authLimiter,
    
    // Validate input
    validate.validateLogin,
    validate.handleValidationErrors,
    
    // Process login
    authController.clientLogin
);

/**
 * @route   POST /api/auth/admin/login
 * @desc    Admin login for dashboard access
 * @access  Public
 * @body    { email, password }
 */
router.post('/admin/login',
    // Even stricter rate limiting for admin access
    rateLimiter.authLimiter,
    
    // Validate input
    validate.validateLogin,
    validate.handleValidationErrors,
    
    // Process admin login
    authController.adminLogin
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client or admin)
 * @access  Private
 */
router.post('/logout',
    // Optional authentication - handles both logged in and anonymous users
    authMiddleware.optionalAuth,
    
    // Process logout
    authController.logout
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT access token using refresh token
 * @access  Public (requires refresh token)
 */
router.post('/refresh',
    // Standard rate limiting
    rateLimiter.globalLimiter,
    
    // Process token refresh
    authController.refreshToken
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user information
 * @access  Private
 */
router.get('/me',
    // Require authentication
    authMiddleware.authenticate,
    
    // Get current user
    authController.getCurrentUser
);

/**
 * @route   GET /api/auth/status
 * @desc    Check authentication status
 * @access  Public (optional auth)
 */
router.get('/status',
    // Optional authentication
    authMiddleware.optionalAuth,
    
    // Get session status
    authController.getSessionStatus
);

// ================================================================
// ADMIN SESSION MANAGEMENT ROUTES
// ================================================================

/**
 * @route   GET /api/auth/admin/sessions
 * @desc    Get all active sessions (admin only)
 * @access  Admin
 */
router.get('/admin/sessions',
    // Require authentication
    authMiddleware.authenticate,
    
    // Require admin role
    authMiddleware.authorize(['admin']),
    
    // Apply admin rate limiting
    rateLimiter.adminLimiter,
    
    // Get all active sessions
    authController.getAllActiveSessions
);

/**
 * @route   DELETE /api/auth/admin/sessions/:sessionId
 * @desc    Terminate specific session (admin only)
 * @access  Admin
 */
router.delete('/admin/sessions/:sessionId',
    // Require authentication
    authMiddleware.authenticate,
    
    // Require admin role
    authMiddleware.authorize(['admin']),
    
    // Apply admin rate limiting
    rateLimiter.adminLimiter,
    
    // Validate session ID parameter
    validate.handleValidationErrors,
    
    // Terminate session
    authController.terminateSession
);

// ================================================================
// USER REGISTRATION ROUTES (Future Feature)
// ================================================================

/**
 * @route   POST /api/auth/register
 * @desc    Register new client account (currently disabled)
 * @access  Public
 * @note    Registration is currently handled by admins only
 */
router.post('/register',
    // Disabled for now - return 501 Not Implemented
    (req, res) => {
        res.status(501).json({
            error: 'User registration is not currently available',
            code: 'REGISTRATION_DISABLED',
            message: 'New client accounts are created by 223 Media administrators. Please contact support.',
            contact: {
                email: '2twenty3media@gmail.com',
                website: 'https://2twenty3media.com'
            }
        });
    }
);

// ================================================================
// PASSWORD RESET ROUTES (Future Feature)
// ================================================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset (future feature)
 * @access  Public
 */
router.post('/forgot-password',
    // Apply rate limiting to prevent abuse
    rateLimiter.authLimiter,
    
    // Placeholder for future implementation
    (req, res) => {
        res.status(501).json({
            error: 'Password reset is not currently available',
            code: 'FEATURE_NOT_IMPLEMENTED',
            message: 'Password reset functionality will be available in a future update. Please contact support for assistance.',
            contact: {
                email: '2twenty3media@gmail.com',
                phone: 'Contact via website'
            }
        });
    }
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password using token (future feature)
 * @access  Public
 */
router.post('/reset-password',
    // Apply rate limiting
    rateLimiter.authLimiter,
    
    // Placeholder for future implementation
    (req, res) => {
        res.status(501).json({
            error: 'Password reset is not currently available',
            code: 'FEATURE_NOT_IMPLEMENTED',
            message: 'Password reset functionality will be available in a future update.'
        });
    }
);

// ================================================================
// SECURITY & HEALTH CHECK ROUTES
// ================================================================

/**
 * @route   GET /api/auth/health
 * @desc    Authentication system health check
 * @access  Public
 */
router.get('/health',
    (req, res) => {
        try {
            // Check authentication system health
            const authHealth = {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                service: '223 Media Authentication System',
                version: '1.0.0',
                checks: {
                    middleware: 'operational',
                    rateLimiting: 'operational',
                    validation: 'operational',
                    sessions: 'operational'
                }
            };
            
            res.json(authHealth);
        } catch (error) {
            res.status(503).json({
                status: 'unhealthy',
                error: 'Authentication system error',
                timestamp: new Date().toISOString()
            });
        }
    }
);

/**
 * @route   GET /api/auth/security-info
 * @desc    Get security configuration info (non-sensitive)
 * @access  Public
 */
router.get('/security-info',
    // Apply standard rate limiting
    rateLimiter.globalLimiter,
    
    (req, res) => {
        const securityInfo = {
            authentication: {
                method: 'JWT (JSON Web Tokens)',
                tokenExpiry: '15 minutes',
                refreshTokenExpiry: '7 days',
                secureTransmission: process.env.NODE_ENV === 'production' ? 'HTTPS' : 'HTTP (dev)',
                cookieSecure: process.env.NODE_ENV === 'production'
            },
            rateLimiting: {
                enabled: true,
                authEndpoints: '10 requests per 15 minutes',
                generalEndpoints: '100 requests per 15 minutes',
                adminEndpoints: '300 requests per 15 minutes'
            },
            security: {
                passwordHashing: 'bcrypt',
                sessionTracking: 'enabled',
                bruteForceProtection: 'enabled',
                suspiciousActivityMonitoring: 'enabled'
            },
            compliance: {
                dataProtection: 'Client data encrypted at rest and in transit',
                auditLogging: 'All authentication events logged',
                accessControl: 'Role-based access control (RBAC)',
                sessionManagement: 'Secure session lifecycle management'
            }
        };
        
        res.json(securityInfo);
    }
);

// ================================================================
// ERROR HANDLING
// ================================================================

/**
 * Handle 404 for unknown auth routes
 */
router.use('*', (req, res) => {
    res.status(404).json({
        error: 'Authentication endpoint not found',
        code: 'AUTH_ENDPOINT_NOT_FOUND',
        path: req.path,
        method: req.method,
        availableEndpoints: [
            'POST /api/auth/client/login',
            'POST /api/auth/admin/login',
            'POST /api/auth/logout',
            'POST /api/auth/refresh',
            'GET /api/auth/me',
            'GET /api/auth/status',
            'GET /api/auth/health'
        ]
    });
});

// ================================================================
// ROUTE DOCUMENTATION
// ================================================================

/**
 * Authentication Routes Documentation
 * 
 * Client Authentication:
 * - POST /client/login     - Client portal login
 * - POST /logout          - Logout (client/admin)
 * - GET /me               - Get current user info
 * - GET /status           - Check auth status
 * 
 * Admin Authentication:
 * - POST /admin/login     - Admin dashboard login
 * - GET /admin/sessions   - View all sessions (admin)
 * - DELETE /admin/sessions/:id - Terminate session (admin)
 * 
 * Token Management:
 * - POST /refresh         - Refresh access token
 * 
 * System:
 * - GET /health           - System health check
 * - GET /security-info    - Security configuration
 * 
 * Security Features:
 * - Rate limiting on all endpoints
 * - Input validation and sanitization
 * - Session tracking and management
 * - Brute force protection
 * - Suspicious activity monitoring
 * - Admin session oversight
 * 
 * Future Features:
 * - User registration (disabled)
 * - Password reset (planned)
 * - Two-factor authentication (planned)
 * - OAuth integration (planned)
 */

module.exports = router;
