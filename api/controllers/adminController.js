// ================================================================
// 223 MEDIA ADMIN DASHBOARD CONTROLLER
// Comprehensive admin API for system management and business operations
// ================================================================

const { validationResult } = require('express-validator');
const crypto = require('crypto');
const authMiddleware = require('../middleware/auth');
const clientController = require('./clientController');
const authController = require('./authController');

// ================================================================
// CONFIGURATION
// ================================================================

const adminConfig = {
    // System metrics
    systemMetrics: {
        startTime: Date.now(),
        apiCalls: 0,
        errors: 0,
        lastBackup: null,
        maintenanceMode: false
    },
    
    // Business metrics
    businessMetrics: {
        monthlyRevenue: 0,
        totalClients: 0,
        activeProjects: 0,
        completedEpisodes: 0,
        churnRate: 0,
        avgClientSatisfaction: 4.5
    },
    
    // Integration status
    integrationStatus: {
        airtable: 'unknown',
        stripe: 'unknown',
        hubspot: 'unknown',
        brevo: 'unknown',
        motion: 'unknown',
        lastChecked: null
    }
};

// ================================================================
// IN-MEMORY ADMIN DATA (Replace with database in production)
// ================================================================

const systemLogs = [];
const businessEvents = [];
const adminActions = [];

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Log admin action
 */
function logAdminAction(adminId, action, details = {}) {
    const logEntry = {
        id: crypto.randomBytes(8).toString('hex'),
        adminId,
        action,
        details,
        timestamp: new Date().toISOString(),
        ipAddress: details.ipAddress || 'unknown'
    };
    
    adminActions.push(logEntry);
    
    // Keep only last 1000 actions
    if (adminActions.length > 1000) {
        adminActions.splice(0, adminActions.length - 1000);
    }
    
    console.log(`👑 Admin Action [${action}]:`, { adminId, details });
    return logEntry;
}

/**
 * Calculate system health score
 */
function calculateSystemHealth() {
    const now = Date.now();
    const uptime = now - adminConfig.systemMetrics.startTime;
    
    let healthScore = 100;
    
    // Reduce score for recent errors
    const recentErrors = systemLogs.filter(log => 
        log.level === 'error' && 
        (now - new Date(log.timestamp).getTime()) < (60 * 60 * 1000) // Last hour
    ).length;
    
    healthScore -= recentErrors * 5;
    
    // Check integration status
    const downIntegrations = Object.values(adminConfig.integrationStatus)
        .filter(status => status === 'error').length;
    
    healthScore -= downIntegrations * 10;
    
    // Minimum score is 0
    return Math.max(0, Math.min(100, healthScore));
}

/**
 * Check integration status
 */
async function checkIntegrations() {
    const integrations = {
        airtable: process.env.AIRTABLE_API_KEY ? 'configured' : 'missing',
        stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing',
        hubspot: process.env.HUBSPOT_ACCESS_TOKEN ? 'configured' : 'missing',
        brevo: process.env.BREVO_API_KEY ? 'configured' : 'missing',
        motion: process.env.MOTION_API_KEY ? 'configured' : 'missing'
    };
    
    adminConfig.integrationStatus = {
        ...integrations,
        lastChecked: new Date().toISOString()
    };
    
    return integrations;
}

/**
 * Generate business reports data
 */
function generateBusinessReport() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Get all episodes and clients
    const allEpisodes = clientController.getAllEpisodes();
    const allClients = Array.from(authMiddleware.getUserByEmail ? [] : []); // Would get from actual user store
    
    // Calculate monthly revenue (simplified)
    const packagePricing = {
        growth: 497,
        scale: 997,
        enterprise: 1497,
        website: 297,
        single: 110
    };
    
    let monthlyRevenue = 0;
    const monthlyStats = {
        newClients: 0,
        completedEpisodes: 0,
        activeClients: 0,
        churnedClients: 0
    };
    
    // This would be calculated from actual client and billing data
    monthlyRevenue = 12940; // Demo value
    monthlyStats.newClients = 3;
    monthlyStats.completedEpisodes = 28;
    monthlyStats.activeClients = 15;
    monthlyStats.churnedClients = 1;
    
    return {
        monthlyRevenue,
        monthlyStats,
        growthRate: 15.2, // percentage
        clientSatisfaction: 4.7,
        avgEpisodeDeliveryTime: 3.2 // days
    };
}

// ================================================================
// DASHBOARD & METRICS
// ================================================================

/**
 * Get admin dashboard overview
 */
async function getDashboard(req, res) {
    try {
        const adminId = req.user.id;
        
        // Log admin access
        logAdminAction(adminId, 'DASHBOARD_ACCESS', {
            ipAddress: req.ip
        });
        
        // Get system metrics
        const uptime = Date.now() - adminConfig.systemMetrics.startTime;
        const systemHealth = calculateSystemHealth();
        
        // Get integration status
        const integrations = await checkIntegrations();
        
        // Get business metrics
        const businessReport = generateBusinessReport();
        
        // Get recent episodes
        const allEpisodes = clientController.getAllEpisodes();
        const recentEpisodes = allEpisodes
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);
        
        // Get system statistics
        const stats = {
            system: {
                uptime: Math.floor(uptime / 1000), // seconds
                uptimeFormatted: formatUptime(uptime),
                health: systemHealth,
                apiCalls: adminConfig.systemMetrics.apiCalls,
                errors: adminConfig.systemMetrics.errors,
                lastBackup: adminConfig.systemMetrics.lastBackup,
                maintenanceMode: adminConfig.systemMetrics.maintenanceMode
            },
            business: {
                totalClients: businessReport.monthlyStats.activeClients,
                activeProjects: allEpisodes.filter(ep => 
                    ['pending', 'in-progress', 'client-review', 'revision'].includes(ep.status)
                ).length,
                completedEpisodes: allEpisodes.filter(ep => ep.status === 'completed').length,
                monthlyRevenue: businessReport.monthlyRevenue,
                growthRate: businessReport.growthRate,
                clientSatisfaction: businessReport.clientSatisfaction
            },
            integrations
        };
        
        res.json({
            success: true,
            dashboard: {
                stats,
                recentEpisodes: recentEpisodes.slice(0, 5),
                recentActions: adminActions.slice(-10).reverse(),
                systemAlerts: getSystemAlerts()
            }
        });
        
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            error: 'Failed to load admin dashboard',
            code: 'DASHBOARD_ERROR'
        });
    }
}

/**
 * Get detailed system metrics
 */
async function getSystemMetrics(req, res) {
    try {
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'SYSTEM_METRICS_ACCESS', {
            ipAddress: req.ip
        });
        
        // Get active sessions
        const activeSessions = authController.getActiveSessions();
        
        // Get rate limiting stats
        const rateLimitStats = {
            suspiciousIPs: 0, // Would get from rate limiter
            blockedRequests: 0,
            topIPs: []
        };
        
        // Calculate detailed metrics
        const metrics = {
            performance: {
                uptime: Date.now() - adminConfig.systemMetrics.startTime,
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                avgResponseTime: 45 // ms, would track actual response times
            },
            security: {
                activeSessions: activeSessions.length,
                failedLogins: authController.getLoginAttempts ? Object.keys(authController.getLoginAttempts()).length : 0,
                suspiciousActivity: authController.getSuspiciousActivity ? authController.getSuspiciousActivity().length : 0,
                rateLimitHits: rateLimitStats.blockedRequests
            },
            business: generateBusinessReport(),
            integrations: await checkIntegrations()
        };
        
        res.json({
            success: true,
            metrics
        });
        
    } catch (error) {
        console.error('System metrics error:', error);
        res.status(500).json({
            error: 'Failed to load system metrics',
            code: 'METRICS_ERROR'
        });
    }
}

/**
 * Get business analytics
 */
async function getBusinessAnalytics(req, res) {
    try {
        const { timeframe = '30d' } = req.query;
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'ANALYTICS_ACCESS', {
            timeframe,
            ipAddress: req.ip
        });
        
        // Generate analytics based on timeframe
        const analytics = {
            revenue: {
                total: 12940,
                growth: 15.2,
                byPackage: {
                    growth: 2485, // 5 * 497
                    scale: 7979,  // 8 * 997
                    enterprise: 2994, // 2 * 1497
                    website: 891,  // 3 * 297
                    single: 220    // 2 * 110
                }
            },
            clients: {
                total: 15,
                new: 3,
                active: 13,
                churned: 1,
                churnRate: 7.1,
                ltv: 2847 // average lifetime value
            },
            episodes: {
                total: 124,
                completed: 112,
                inProgress: 8,
                pending: 4,
                avgTurnaroundTime: 3.2,
                revisionRate: 0.23
            },
            satisfaction: {
                average: 4.7,
                responseRate: 78,
                nps: 67
            },
            trends: {
                revenueGrowth: [8500, 9200, 10100, 11400, 12940], // Last 5 months
                clientGrowth: [8, 10, 12, 14, 15],
                episodeGrowth: [20, 24, 28, 32, 28] // This month shows slight decline
            }
        };
        
        res.json({
            success: true,
            analytics,
            timeframe,
            generatedAt: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Business analytics error:', error);
        res.status(500).json({
            error: 'Failed to load business analytics',
            code: 'ANALYTICS_ERROR'
        });
    }
}

// ================================================================
// CLIENT MANAGEMENT
// ================================================================

/**
 * Get all clients (admin view)
 */
async function getAllClients(req, res) {
    try {
        const { page = 1, limit = 20, status, package: packageFilter, search } = req.query;
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'CLIENTS_VIEW', {
            filters: { status, packageFilter, search },
            ipAddress: req.ip
        });
        
        // This would get from actual user database
        // For now, return demo data
        const demoClients = [
            {
                id: 'client_001',
                email: 'john@techstartup.com',
                name: 'John Smith',
                companyName: 'Tech Startup Co',
                packageType: 'scale',
                status: 'active',
                createdAt: '2024-01-15T10:00:00Z',
                lastLogin: '2024-01-20T14:30:00Z',
                episodeCount: 12,
                healthScore: 95
            },
            {
                id: 'client_002',
                email: 'sarah@marketingpro.com',
                name: 'Sarah Johnson',
                companyName: 'Marketing Pro Agency',
                packageType: 'enterprise',
                status: 'active',
                createdAt: '2024-01-10T09:00:00Z',
                lastLogin: '2024-01-21T11:15:00Z',
                episodeCount: 18,
                healthScore: 88
            },
            {
                id: 'client_003',
                email: 'mike@contentcorp.com',
                name: 'Mike Wilson',
                companyName: 'Content Corp',
                packageType: 'growth',
                status: 'paused',
                createdAt: '2024-01-05T16:20:00Z',
                lastLogin: '2024-01-18T08:45:00Z',
                episodeCount: 8,
                healthScore: 72
            }
        ];
        
        let clients = [...demoClients];
        
        // Apply filters
        if (status) {
            clients = clients.filter(client => client.status === status);
        }
        
        if (packageFilter) {
            clients = clients.filter(client => client.packageType === packageFilter);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            clients = clients.filter(client => 
                client.name.toLowerCase().includes(searchLower) ||
                client.companyName.toLowerCase().includes(searchLower) ||
                client.email.toLowerCase().includes(searchLower)
            );
        }
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedClients = clients.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            clients: paginatedClients,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(clients.length / limit),
                totalClients: clients.length,
                hasNext: endIndex < clients.length,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Get all clients error:', error);
        res.status(500).json({
            error: 'Failed to load clients',
            code: 'CLIENTS_ERROR'
        });
    }
}

/**
 * Get detailed client information
 */
async function getClientDetails(req, res) {
    try {
        const { clientId } = req.params;
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'CLIENT_DETAILS_VIEW', {
            clientId,
            ipAddress: req.ip
        });
        
        // Get client basic info
        const client = authMiddleware.getUserByEmail ? null : {
            id: clientId,
            email: 'demo@client.com',
            name: 'Demo Client',
            companyName: 'Demo Company',
            packageType: 'scale',
            status: 'active',
            createdAt: '2024-01-15T10:00:00Z',
            lastLogin: '2024-01-20T14:30:00Z'
        };
        
        if (!client) {
            return res.status(404).json({
                error: 'Client not found',
                code: 'CLIENT_NOT_FOUND'
            });
        }
        
        // Get client episodes
        const allEpisodes = clientController.getAllEpisodes();
        const clientEpisodes = allEpisodes.filter(ep => ep.clientId === clientId);
        
        // Get client files
        const allFiles = clientController.getAllFiles();
        const clientFiles = allFiles.filter(file => file.clientId === clientId);
        
        // Calculate detailed statistics
        const stats = {
            episodes: {
                total: clientEpisodes.length,
                completed: clientEpisodes.filter(ep => ep.status === 'completed').length,
                inProgress: clientEpisodes.filter(ep => ['in-progress', 'client-review', 'revision'].includes(ep.status)).length,
                overdue: clientEpisodes.filter(ep => 
                    ep.dueDate && new Date(ep.dueDate) < new Date() && ep.status !== 'completed'
                ).length
            },
            files: {
                total: clientFiles.length,
                totalSize: clientFiles.reduce((sum, file) => sum + (file.size || 0), 0)
            },
            health: clientController.calculateHealthScore(clientId),
            billing: {
                currentPackage: client.packageType,
                monthlyValue: clientController.clientConfig.packages[client.packageType]?.price || 0,
                paymentStatus: 'current',
                nextBillDate: '2024-02-01T00:00:00Z'
            }
        };
        
        res.json({
            success: true,
            client: {
                ...client,
                stats,
                recentEpisodes: clientEpisodes.slice(0, 5),
                recentFiles: clientFiles.slice(0, 10)
            }
        });
        
    } catch (error) {
        console.error('Get client details error:', error);
        res.status(500).json({
            error: 'Failed to load client details',
            code: 'CLIENT_DETAILS_ERROR'
        });
    }
}

/**
 * Create new client account
 */
async function createClient(req, res) {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors.array()
            });
        }
        
        const adminId = req.user.id;
        const { email, name, companyName, packageType, phone, website, notes } = req.body;
        
        // Check if user already exists
        const existingUser = authMiddleware.getUserByEmail(email);
        if (existingUser) {
            return res.status(400).json({
                error: 'User with this email already exists',
                code: 'USER_EXISTS'
            });
        }
        
        // Generate temporary password
        const tempPassword = crypto.randomBytes(8).toString('hex');
        
        // Create user using auth middleware
        const userData = {
            email,
            password: tempPassword,
            name,
            companyName,
            packageType,
            phone,
            website,
            notes,
            role: 'client'
        };
        
        const newUser = authMiddleware.addUser(userData);
        
        // Log admin action
        logAdminAction(adminId, 'CLIENT_CREATED', {
            clientId: newUser.id,
            email,
            companyName,
            packageType,
            ipAddress: req.ip
        });
        
        console.log(`👤 Client created: ${companyName} (${email}) by admin ${req.user.email}`);
        
        res.status(201).json({
            success: true,
            message: 'Client created successfully',
            client: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name,
                companyName: newUser.companyName,
                packageType: newUser.packageType,
                role: newUser.role,
                createdAt: newUser.createdAt
            },
            tempPassword: tempPassword, // In production, this would be sent via email
            note: 'Temporary password should be sent to client via secure channel'
        });
        
    } catch (error) {
        console.error('Create client error:', error);
        res.status(500).json({
            error: 'Failed to create client',
            code: 'CREATE_CLIENT_ERROR'
        });
    }
}

/**
 * Update client information
 */
async function updateClient(req, res) {
    try {
        const { clientId } = req.params;
        const adminId = req.user.id;
        
        // This would update client in database
        // For now, just log the action
        logAdminAction(adminId, 'CLIENT_UPDATED', {
            clientId,
            updates: Object.keys(req.body),
            ipAddress: req.ip
        });
        
        res.json({
            success: true,
            message: 'Client updated successfully',
            note: 'Client update functionality to be implemented with database integration'
        });
        
    } catch (error) {
        console.error('Update client error:', error);
        res.status(500).json({
            error: 'Failed to update client',
            code: 'UPDATE_CLIENT_ERROR'
        });
    }
}

// ================================================================
// EPISODE MANAGEMENT (ADMIN VIEW)
// ================================================================

/**
 * Get all episodes across all clients
 */
async function getAllEpisodes(req, res) {
    try {
        const { page = 1, limit = 20, status, priority, client: clientFilter } = req.query;
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'EPISODES_VIEW_ALL', {
            filters: { status, priority, clientFilter },
            ipAddress: req.ip
        });
        
        let allEpisodes = clientController.getAllEpisodes();
        
        // Apply filters
        if (status) {
            allEpisodes = allEpisodes.filter(ep => ep.status === status);
        }
        
        if (priority) {
            allEpisodes = allEpisodes.filter(ep => ep.priority === priority);
        }
        
        if (clientFilter) {
            allEpisodes = allEpisodes.filter(ep => ep.clientId === clientFilter);
        }
        
        // Sort by creation date (newest first)
        allEpisodes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedEpisodes = allEpisodes.slice(startIndex, endIndex);
        
        // Add client information to episodes
        const episodesWithClientInfo = paginatedEpisodes.map(episode => ({
            ...episode,
            clientName: 'Demo Client', // Would get from client data
            clientCompany: 'Demo Company'
        }));
        
        res.json({
            success: true,
            episodes: episodesWithClientInfo,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(allEpisodes.length / limit),
                totalEpisodes: allEpisodes.length
            }
        });
        
    } catch (error) {
        console.error('Get all episodes error:', error);
        res.status(500).json({
            error: 'Failed to load episodes',
            code: 'EPISODES_ERROR'
        });
    }
}

/**
 * Update episode status (admin only)
 */
async function updateEpisodeStatus(req, res) {
    try {
        const { episodeId } = req.params;
        const { status, notes } = req.body;
        const adminId = req.user.id;
        
        // Validate status
        const validStatuses = ['pending', 'in-progress', 'client-review', 'revision', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid episode status',
                code: 'INVALID_STATUS',
                validStatuses
            });
        }
        
        // This would update episode in database
        // For now, just log the action
        logAdminAction(adminId, 'EPISODE_STATUS_UPDATED', {
            episodeId,
            newStatus: status,
            notes,
            ipAddress: req.ip
        });
        
        res.json({
            success: true,
            message: 'Episode status updated successfully',
            episodeId,
            newStatus: status,
            note: 'Episode update functionality to be implemented with database integration'
        });
        
    } catch (error) {
        console.error('Update episode status error:', error);
        res.status(500).json({
            error: 'Failed to update episode status',
            code: 'UPDATE_EPISODE_ERROR'
        });
    }
}

// ================================================================
// SYSTEM MANAGEMENT
// ================================================================

/**
 * Get system logs
 */
async function getSystemLogs(req, res) {
    try {
        const { level, page = 1, limit = 50 } = req.query;
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'SYSTEM_LOGS_ACCESS', {
            level,
            ipAddress: req.ip
        });
        
        let logs = [...systemLogs];
        
        if (level) {
            logs = logs.filter(log => log.level === level);
        }
        
        // Sort by timestamp (newest first)
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedLogs = logs.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            logs: paginatedLogs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(logs.length / limit),
                totalLogs: logs.length
            }
        });
        
    } catch (error) {
        console.error('Get system logs error:', error);
        res.status(500).json({
            error: 'Failed to load system logs',
            code: 'LOGS_ERROR'
        });
    }
}

/**
 * Run system backup
 */
async function runBackup(req, res) {
    try {
        const adminId = req.user.id;
        
        logAdminAction(adminId, 'BACKUP_INITIATED', {
            ipAddress: req.ip
        });
        
        // Simulate backup process
        const backupId = crypto.randomBytes(8).toString('hex');
        
        // In production, this would trigger the actual backup script
        console.log(`💾 Backup initiated by admin ${req.user.email}`);
        
        adminConfig.systemMetrics.lastBackup = new Date().toISOString();
        
        res.json({
            success: true,
            message: 'Backup initiated successfully',
            backupId,
            note: 'Backup functionality to be implemented with actual data storage'
        });
        
    } catch (error) {
        console.error('Run backup error:', error);
        res.status(500).json({
            error: 'Failed to initiate backup',
            code: 'BACKUP_ERROR'
        });
    }
}

/**
 * Toggle maintenance mode
 */
async function toggleMaintenanceMode(req, res) {
    try {
        const adminId = req.user.id;
        const { enabled, message } = req.body;
        
        adminConfig.systemMetrics.maintenanceMode = enabled;
        
        logAdminAction(adminId, 'MAINTENANCE_MODE_TOGGLE', {
            enabled,
            message,
            ipAddress: req.ip
        });
        
        console.log(`🔧 Maintenance mode ${enabled ? 'enabled' : 'disabled'} by admin ${req.user.email}`);
        
        res.json({
            success: true,
            message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
            maintenanceMode: enabled
        });
        
    } catch (error) {
        console.error('Toggle maintenance mode error:', error);
        res.status(500).json({
            error: 'Failed to toggle maintenance mode',
            code: 'MAINTENANCE_ERROR'
        });
    }
}

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
 * Get system alerts
 */
function getSystemAlerts() {
    const alerts = [];
    
    // Check for high error rate
    const recentErrors = systemLogs.filter(log => 
        log.level === 'error' && 
        (Date.now() - new Date(log.timestamp).getTime()) < (60 * 60 * 1000)
    );
    
    if (recentErrors.length > 10) {
        alerts.push({
            type: 'error',
            message: `High error rate: ${recentErrors.length} errors in the last hour`,
            severity: 'high'
        });
    }
    
    // Check backup status
    if (!adminConfig.systemMetrics.lastBackup) {
        alerts.push({
            type: 'warning',
            message: 'No recent backup found',
            severity: 'medium'
        });
    }
    
    // Check integration status
    const downIntegrations = Object.entries(adminConfig.integrationStatus)
        .filter(([key, status]) => status === 'error' && key !== 'lastChecked')
        .map(([key]) => key);
    
    if (downIntegrations.length > 0) {
        alerts.push({
            type: 'warning',
            message: `Integration issues: ${downIntegrations.join(', ')}`,
            severity: 'medium'
        });
    }
    
    return alerts;
}

// ================================================================
// MIDDLEWARE TO TRACK API CALLS
// ================================================================

/**
 * Middleware to track API calls for metrics
 */
function trackApiCall(req, res, next) {
    adminConfig.systemMetrics.apiCalls++;
    next();
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    // Dashboard & metrics
    getDashboard,
    getSystemMetrics,
    getBusinessAnalytics,
    
    // Client management
    getAllClients,
    getClientDetails,
    createClient,
    updateClient,
    
    // Episode management
    getAllEpisodes,
    updateEpisodeStatus,
    
    // System management
    getSystemLogs,
    runBackup,
    toggleMaintenanceMode,
    
    // Utilities
    logAdminAction,
    calculateSystemHealth,
    checkIntegrations,
    trackApiCall,
    
    // Data access (for other modules)
    getAdminActions: () => adminActions,
    getSystemConfig: () => adminConfig,
    getBusinessReport: generateBusinessReport
};
