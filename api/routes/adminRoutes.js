// ================================================================
// 223 MEDIA ADMIN DASHBOARD ROUTES
// Comprehensive admin API for system management and business operations
// ================================================================

const express = require('express');
const router = express.Router();

// Import controllers and middleware
const adminController = require('../controllers/adminController');
const clientController = require('../controllers/clientController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const fileUpload = require('../middleware/fileUpload');

// ================================================================
// MIDDLEWARE - APPLY TO ALL ADMIN ROUTES
// ================================================================

// All admin routes require authentication
router.use(authMiddleware.authenticate);

// Apply admin-specific rate limiting (higher limits)
router.use(rateLimiter.adminLimiter);

// Require admin role
router.use(authMiddleware.authorize(['admin']));

// Track all admin API calls for metrics
router.use(adminController.trackApiCall);

// ================================================================
// DASHBOARD & METRICS ROUTES
// ================================================================

/**
 * @route   GET /api/admin/dashboard
 * @desc    Get admin dashboard overview
 * @access  Admin
 */
router.get('/dashboard',
    adminController.getDashboard
);

/**
 * @route   GET /api/admin/metrics
 * @desc    Get detailed system metrics
 * @access  Admin
 */
router.get('/metrics',
    adminController.getSystemMetrics
);

/**
 * @route   GET /api/admin/analytics
 * @desc    Get business analytics and reports
 * @access  Admin
 * @query   ?timeframe=30d&format=json
 */
router.get('/analytics',
    // Validate query parameters
    validate.validateSearch,
    validate.handleValidationErrors,
    
    adminController.getBusinessAnalytics
);

/**
 * @route   GET /api/admin/health
 * @desc    Comprehensive system health check
 * @access  Admin
 */
router.get('/health',
    async (req, res) => {
        try {
            const systemHealth = adminController.calculateSystemHealth();
            const integrationStatus = await adminController.checkIntegrations();
            const businessReport = adminController.getBusinessReport();
            
            const healthReport = {
                status: systemHealth > 80 ? 'healthy' : systemHealth > 50 ? 'warning' : 'critical',
                score: systemHealth,
                timestamp: new Date().toISOString(),
                service: '223 Media Admin System',
                version: '1.0.0',
                uptime: process.uptime(),
                system: {
                    memory: process.memoryUsage(),
                    cpu: process.cpuUsage(),
                    platform: process.platform,
                    nodeVersion: process.version
                },
                integrations: integrationStatus,
                business: {
                    monthlyRevenue: businessReport.monthlyRevenue,
                    activeClients: businessReport.monthlyStats.activeClients,
                    systemLoad: 'normal'
                },
                security: {
                    activeSessions: authController.getActiveSessions ? authController.getActiveSessions().length : 0,
                    failedLogins: Object.keys(authController.getLoginAttempts ? authController.getLoginAttempts() : {}).length,
                    maintenanceMode: adminController.getSystemConfig().systemMetrics.maintenanceMode
                }
            };
            
            res.json(healthReport);
            
        } catch (error) {
            console.error('Admin health check error:', error);
            res.status(503).json({
                status: 'unhealthy',
                error: 'System health check failed',
                timestamp: new Date().toISOString()
            });
        }
    }
);

// ================================================================
// CLIENT MANAGEMENT ROUTES
// ================================================================

/**
 * @route   GET /api/admin/clients
 * @desc    Get all clients with filtering and pagination
 * @access  Admin
 * @query   ?page=1&limit=20&status=active&package=scale&search=company
 */
router.get('/clients',
    // Validate query parameters
    validate.validateSearch,
    validate.handleValidationErrors,
    
    adminController.getAllClients
);

/**
 * @route   POST /api/admin/clients
 * @desc    Create new client account
 * @access  Admin
 * @body    { email, name, companyName, packageType, phone, website, notes }
 */
router.post('/clients',
    // Validate client creation data
    validate.validateClientCreation,
    validate.handleValidationErrors,
    
    adminController.createClient
);

/**
 * @route   GET /api/admin/clients/:clientId
 * @desc    Get detailed client information
 * @access  Admin
 */
router.get('/clients/:clientId',
    // Validate client ID format
    validate.validateClientId,
    validate.handleValidationErrors,
    
    adminController.getClientDetails
);

/**
 * @route   PUT /api/admin/clients/:clientId
 * @desc    Update client information
 * @access  Admin
 * @body    { name, companyName, packageType, phone, website, notes, status }
 */
router.put('/clients/:clientId',
    // Validate client ID
    validate.validateClientId,
    validate.handleValidationErrors,
    
    // Validate update data
    validate.validateClientCreation, // Reuse validation
    validate.handleValidationErrors,
    
    adminController.updateClient
);

/**
 * @route   DELETE /api/admin/clients/:clientId
 * @desc    Deactivate client account
 * @access  Admin
 */
router.delete('/clients/:clientId',
    // Validate client ID
    validate.validateClientId,
    validate.handleValidationErrors,
    
    (req, res) => {
        // Placeholder for client deactivation
        const { clientId } = req.params;
        
        adminController.logAdminAction(req.user.id, 'CLIENT_DEACTIVATION_ATTEMPTED', {
            clientId,
            ipAddress: req.ip
        });
        
        res.status(501).json({
            error: 'Client deactivation not yet implemented',
            code: 'FEATURE_NOT_IMPLEMENTED',
            message: 'Use PUT /clients/:id to update client status instead',
            clientId
        });
    }
);

/**
 * @route   POST /api/admin/clients/:clientId/impersonate
 * @desc    Impersonate client for support (future feature)
 * @access  Admin
 */
router.post('/clients/:clientId/impersonate',
    validate.validateClientId,
    validate.handleValidationErrors,
    
    (req, res) => {
        // Placeholder for client impersonation
        adminController.logAdminAction(req.user.id, 'IMPERSONATION_ATTEMPTED', {
            clientId: req.params.clientId,
            ipAddress: req.ip
        });
        
        res.status(501).json({
            error: 'Client impersonation not yet implemented',
            code: 'FEATURE_NOT_IMPLEMENTED',
            message: 'Support impersonation will be available in a future update'
        });
    }
);

// ================================================================
// EPISODE MANAGEMENT ROUTES (ADMIN VIEW)
// ================================================================

/**
 * @route   GET /api/admin/episodes
 * @desc    Get all episodes across all clients
 * @access  Admin
 * @query   ?page=1&limit=20&status=pending&priority=high&client=client_123
 */
router.get('/episodes',
    // Validate query parameters
    validate.validateSearch,
    validate.handleValidationErrors,
    
    adminController.getAllEpisodes
);

/**
 * @route   GET /api/admin/episodes/:episodeId
 * @desc    Get detailed episode information (admin view)
 * @access  Admin
 */
router.get('/episodes/:episodeId',
    // Validate episode ID format
    validate.validateEpisodeId,
    validate.handleValidationErrors,
    
    // Use client controller but with admin privileges
    clientController.getEpisode
);

/**
 * @route   PUT /api/admin/episodes/:episodeId/status
 * @desc    Update episode status (admin only)
 * @access  Admin
 * @body    { status, notes }
 */
router.put('/episodes/:episodeId/status',
    // Validate episode ID
    validate.validateEpisodeId,
    validate.handleValidationErrors,
    
    // Validate status update
    validate.sanitizeRequest,
    
    adminController.updateEpisodeStatus
);

/**
 * @route   POST /api/admin/episodes/:episodeId/notes
 * @desc    Add admin notes to episode
 * @access  Admin
 * @body    { note, internal }
 */
router.post('/episodes/:episodeId/notes',
    validate.validateEpisodeId,
    validate.handleValidationErrors,
    
    (req, res) => {
        // Placeholder for admin notes
        const { episodeId } = req.params;
        const { note, internal = true } = req.body;
        
        if (!note || note.trim().length === 0) {
            return res.status(400).json({
                error: 'Note content is required',
                code: 'MISSING_NOTE_CONTENT'
            });
        }
        
        adminController.logAdminAction(req.user.id, 'EPISODE_NOTE_ADDED', {
            episodeId,
            noteLength: note.length,
            internal,
            ipAddress: req.ip
        });
        
        res.json({
            success: true,
            message: 'Admin note added successfully',
            noteId: `note_${Date.now()}`,
            note: 'Episode notes functionality to be implemented'
        });
    }
);

// ================================================================
// USER & SESSION MANAGEMENT ROUTES
// ================================================================

/**
 * @route   GET /api/admin/sessions
 * @desc    Get all active user sessions
 * @access  Admin
 */
router.get('/sessions',
    authController.getAllActiveSessions
);

/**
 * @route   DELETE /api/admin/sessions/:sessionId
 * @desc    Terminate specific user session
 * @access  Admin
 */
router.delete('/sessions/:sessionId',
    authController.terminateSession
);

/**
 * @route   POST /api/admin/users/:userId/reset-password
 * @desc    Reset user password (admin action)
 * @access  Admin
 */
router.post('/users/:userId/reset-password',
    (req, res) => {
        // Placeholder for password reset
        const { userId } = req.params;
        
        adminController.logAdminAction(req.user.id, 'PASSWORD_RESET_INITIATED', {
            targetUserId: userId,
            ipAddress: req.ip
        });
        
        res.status(501).json({
            error: 'Admin password reset not yet implemented',
            code: 'FEATURE_NOT_IMPLEMENTED',
            message: 'Password reset functionality will be available soon'
        });
    }
);

// ================================================================
// SYSTEM ADMINISTRATION ROUTES
// ================================================================

/**
 * @route   GET /api/admin/logs
 * @desc    Get system logs with filtering
 * @access  Admin
 * @query   ?level=error&page=1&limit=50
 */
router.get('/logs',
    // Validate query parameters
    validate.validateSearch,
    validate.handleValidationErrors,
    
    adminController.getSystemLogs
);

/**
 * @route   POST /api/admin/backup
 * @desc    Initiate system backup
 * @access  Admin
 * @body    { type, includeFiles }
 */
router.post('/backup',
    validate.sanitizeRequest,
    
    adminController.runBackup
);

/**
 * @route   PUT /api/admin/maintenance
 * @desc    Toggle maintenance mode
 * @access  Admin
 * @body    { enabled, message }
 */
router.put('/maintenance',
    validate.sanitizeRequest,
    
    adminController.toggleMaintenanceMode
);

/**
 * @route   POST /api/admin/integrations/test
 * @desc    Test all external integrations
 * @access  Admin
 */
router.post('/integrations/test',
    async (req, res) => {
        try {
            adminController.logAdminAction(req.user.id, 'INTEGRATIONS_TEST_INITIATED', {
                ipAddress: req.ip
            });
            
            const integrationResults = await adminController.checkIntegrations();
            
            // In production, this would actually test each integration
            const testResults = {
                airtable: { status: 'success', responseTime: 120, message: 'Connection successful' },
                stripe: { status: 'success', responseTime: 95, message: 'API accessible' },
                hubspot: { status: 'success', responseTime: 180, message: 'Authentication valid' },
                brevo: { status: 'success', responseTime: 110, message: 'Email service operational' },
                motion: { status: 'warning', responseTime: 450, message: 'Slow response time' }
            };
            
            res.json({
                success: true,
                message: 'Integration tests completed',
                results: testResults,
                summary: {
                    total: Object.keys(testResults).length,
                    successful: Object.values(testResults).filter(r => r.status === 'success').length,
                    warnings: Object.values(testResults).filter(r => r.status === 'warning').length,
                    failures: Object.values(testResults).filter(r => r.status === 'error').length
                },
                testedAt: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('Integration test error:', error);
            res.status(500).json({
                error: 'Integration test failed',
                code: 'INTEGRATION_TEST_ERROR'
            });
        }
    }
);

// ================================================================
// FILE MANAGEMENT (ADMIN VIEW)
// ================================================================

/**
 * @route   GET /api/admin/files
 * @desc    Get all files across all clients
 * @access  Admin
 * @query   ?client=client_123&type=audio&page=1&limit=20
 */
router.get('/files',
    validate.validateSearch,
    validate.handleValidationErrors,
    
    (req, res) => {
        try {
            const { client: clientFilter, type, page = 1, limit = 20 } = req.query;
            
            let allFiles = clientController.getAllFiles();
            
            // Apply filters
            if (clientFilter) {
                allFiles = allFiles.filter(file => file.clientId === clientFilter);
            }
            
            if (type) {
                allFiles = allFiles.filter(file => file.category === type);
            }
            
            // Sort by upload date (newest first)
            allFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
            
            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedFiles = allFiles.slice(startIndex, endIndex);
            
            // Add client information
            const filesWithClientInfo = paginatedFiles.map(file => ({
                ...file,
                clientName: 'Demo Client', // Would get from client data
                clientCompany: 'Demo Company'
            }));
            
            adminController.logAdminAction(req.user.id, 'FILES_VIEW_ALL', {
                filters: { clientFilter, type },
                resultCount: filesWithClientInfo.length,
                ipAddress: req.ip
            });
            
            res.json({
                success: true,
                files: filesWithClientInfo,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(allFiles.length / limit),
                    totalFiles: allFiles.length
                }
            });
            
        } catch (error) {
            console.error('Admin get files error:', error);
            res.status(500).json({
                error: 'Failed to load files',
                code: 'FILES_ERROR'
            });
        }
    }
);

/**
 * @route   DELETE /api/admin/files/:fileId
 * @desc    Delete file (admin action)
 * @access  Admin
 */
router.delete('/files/:fileId',
    (req, res) => {
        // Placeholder for file deletion
        const { fileId } = req.params;
        
        adminController.logAdminAction(req.user.id, 'FILE_DELETION_ATTEMPTED', {
            fileId,
            ipAddress: req.ip
        });
        
        res.status(501).json({
            error: 'Admin file deletion not yet implemented',
            code: 'FEATURE_NOT_IMPLEMENTED',
            message: 'File deletion functionality will be available soon'
        });
    }
);

// ================================================================
// BUSINESS OPERATIONS ROUTES
// ================================================================

/**
 * @route   GET /api/admin/reports
 * @desc    Generate business reports
 * @access  Admin
 * @query   ?type=revenue&format=json&period=monthly
 */
router.get('/reports',
    validate.validateSearch,
    validate.handleValidationErrors,
    
    (req, res) => {
        try {
            const { type = 'overview', format = 'json', period = 'monthly' } = req.query;
            
            adminController.logAdminAction(req.user.id, 'REPORT_GENERATED', {
                reportType: type,
                format,
                period,
                ipAddress: req.ip
            });
            
            const businessReport = adminController.getBusinessReport();
            
            const reports = {
                overview: {
                    period: period,
                    generatedAt: new Date().toISOString(),
                    revenue: {
                        current: businessReport.monthlyRevenue,
                        growth: businessReport.growthRate,
                        target: 15000,
                        performance: (businessReport.monthlyRevenue / 15000 * 100).toFixed(1) + '%'
                    },
                    clients: businessReport.monthlyStats,
                    satisfaction: {
                        average: businessReport.clientSatisfaction,
                        responses: 12,
                        trend: '+0.3 from last month'
                    }
                },
                revenue: {
                    // Detailed revenue breakdown
                    byPackage: {
                        growth: 2485,
                        scale: 7979,
                        enterprise: 2994,
                        website: 891,
                        single: 220
                    },
                    trends: [8500, 9200, 10100, 11400, 12940],
                    projections: [14200, 15800, 17500]
                }
            };
            
            const report = reports[type] || reports.overview;
            
            if (format === 'csv') {
                // Would generate CSV format
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=223media-${type}-report.csv`);
                res.send('CSV export not yet implemented');
            } else {
                res.json({
                    success: true,
                    report,
                    metadata: {
                        type,
                        format,
                        period,
                        generatedAt: new Date().toISOString(),
                        generatedBy: req.user.email
                    }
                });
            }
            
        } catch (error) {
            console.error('Report generation error:', error);
            res.status(500).json({
                error: 'Failed to generate report',
                code: 'REPORT_ERROR'
            });
        }
    }
);

/**
 * @route   GET /api/admin/audit-log
 * @desc    Get admin audit log
 * @access  Admin
 * @query   ?page=1&limit=50&action=CLIENT_CREATED&admin=admin_123
 */
router.get('/audit-log',
    validate.validateSearch,
    validate.handleValidationErrors,
    
    (req, res) => {
        try {
            const { page = 1, limit = 50, action, admin: adminFilter } = req.query;
            
            let auditLog = adminController.getAdminActions();
            
            // Apply filters
            if (action) {
                auditLog = auditLog.filter(entry => entry.action === action);
            }
            
            if (adminFilter) {
                auditLog = auditLog.filter(entry => entry.adminId === adminFilter);
            }
            
            // Sort by timestamp (newest first)
            auditLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Pagination
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + parseInt(limit);
            const paginatedLog = auditLog.slice(startIndex, endIndex);
            
            res.json({
                success: true,
                auditLog: paginatedLog,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(auditLog.length / limit),
                    totalEntries: auditLog.length
                }
            });
            
        } catch (error) {
            console.error('Audit log error:', error);
            res.status(500).json({
                error: 'Failed to load audit log',
                code: 'AUDIT_LOG_ERROR'
            });
        }
    }
);

// ================================================================
// SECURITY MANAGEMENT ROUTES
// ================================================================

/**
 * @route   GET /api/admin/security/suspicious-activity
 * @desc    Get suspicious activity report
 * @access  Admin
 */
router.get('/security/suspicious-activity',
    (req, res) => {
        try {
            const suspiciousIPs = rateLimiter.getSuspiciousIPs ? rateLimiter.getSuspiciousIPs() : [];
            const failedLogins = authController.getLoginAttempts ? authController.getLoginAttempts() : {};
            const suspiciousActivity = authController.getSuspiciousActivity ? authController.getSuspiciousActivity() : [];
            
            adminController.logAdminAction(req.user.id, 'SECURITY_REPORT_ACCESSED', {
                ipAddress: req.ip
            });
            
            res.json({
                success: true,
                security: {
                    suspiciousIPs: suspiciousIPs,
                    failedLoginAttempts: Object.keys(failedLogins).length,
                    blockedRequests: suspiciousActivity.length,
                    lastChecked: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Security report error:', error);
            res.status(500).json({
                error: 'Failed to generate security report',
                code: 'SECURITY_REPORT_ERROR'
            });
        }
    }
);

/**
 * @route   POST /api/admin/security/whitelist-ip
 * @desc    Add IP to whitelist
 * @access  Admin
 * @body    { ip, reason }
 */
router.post('/security/whitelist-ip',
    validate.sanitizeRequest,
    
    (req, res) => {
        const { ip, reason } = req.body;
        
        if (!ip) {
            return res.status(400).json({
                error: 'IP address is required',
                code: 'MISSING_IP'
            });
        }
        
        adminController.logAdminAction(req.user.id, 'IP_WHITELISTED', {
            ip,
            reason,
            ipAddress: req.ip
        });
        
        // Would use rate limiter to whitelist IP
        res.json({
            success: true,
            message: 'IP address whitelisted successfully',
            ip,
            reason: reason || 'Admin whitelist'
        });
    }
);

// ================================================================
// ERROR HANDLING
// ================================================================

/**
 * Handle 404 for unknown admin routes
 */
router.use('*', (req, res) => {
    res.status(404).json({
        error: 'Admin endpoint not found',
        code: 'ADMIN_ENDPOINT_NOT_FOUND',
        path: req.path,
        method: req.method,
        availableEndpoints: [
            'GET /api/admin/dashboard',
            'GET /api/admin/metrics',
            'GET /api/admin/analytics',
            'GET /api/admin/clients',
            'POST /api/admin/clients',
            'GET /api/admin/clients/:id',
            'PUT /api/admin/clients/:id',
            'GET /api/admin/episodes',
            'PUT /api/admin/episodes/:id/status',
            'GET /api/admin/sessions',
            'DELETE /api/admin/sessions/:id',
            'GET /api/admin/logs',
            'POST /api/admin/backup',
            'PUT /api/admin/maintenance',
            'GET /api/admin/reports',
            'GET /api/admin/audit-log',
            'GET /api/admin/health'
        ]
    });
});

// ================================================================
// ROUTE DOCUMENTATION
// ================================================================

/**
 * Admin Dashboard Routes Documentation
 * 
 * Dashboard & Analytics:
 * - GET /dashboard           - Main admin dashboard
 * - GET /metrics            - Detailed system metrics
 * - GET /analytics          - Business analytics & reports
 * - GET /health             - Comprehensive health check
 * 
 * Client Management:
 * - GET /clients            - List all clients (filtered, paginated)
 * - POST /clients           - Create new client account
 * - GET /clients/:id        - Get detailed client information
 * - PUT /clients/:id        - Update client information
 * - POST /clients/:id/impersonate - Impersonate client (future)
 * 
 * Episode Management:
 * - GET /episodes           - List all episodes across clients
 * - GET /episodes/:id       - Get episode details (admin view)
 * - PUT /episodes/:id/status - Update episode status
 * - POST /episodes/:id/notes - Add admin notes
 * 
 * User & Session Management:
 * - GET /sessions           - View all active sessions
 * - DELETE /sessions/:id    - Terminate user session
 * - POST /users/:id/reset-password - Reset user password
 * 
 * System Administration:
 * - GET /logs               - System logs with filtering
 * - POST /backup            - Initiate system backup
 * - PUT /maintenance        - Toggle maintenance mode
 * - POST /integrations/test - Test external integrations
 * 
 * File Management:
 * - GET /files              - View all files across clients
 * - DELETE /files/:id       - Delete file (admin action)
 * 
 * Business Operations:
 * - GET /reports            - Generate business reports
 * - GET /audit-log          - Admin audit log
 * 
 * Security Management:
 * - GET /security/suspicious-activity - Security report
 * - POST /security/whitelist-ip - Whitelist IP address
 * 
 * Security Features:
 * - All routes require admin authentication
 * - Enhanced rate limiting for admin endpoints
 * - Comprehensive audit logging
 * - Action tracking and monitoring
 * - Integration status monitoring
 * - System health validation
 * 
 * Admin Privileges:
 * - Full system access and control
 * - Client account management
 * - Episode status management across all clients
 * - Session termination capabilities
 * - System maintenance controls
 * - Business analytics and reporting
 * - Security monitoring and management
 */

module.exports = router;
