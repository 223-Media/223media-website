// ================================================================
// 223 MEDIA CLIENT PORTAL CONTROLLER
// Complete client-facing API for dashboard, episodes, and file management
// ================================================================

const { validationResult } = require('express-validator');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ================================================================
// CONFIGURATION
// ================================================================

const clientConfig = {
    // Package configurations
    packages: {
        growth: {
            name: 'Growth Package',
            price: 497,
            episodesPerMonth: 4,
            revisionsPerEpisode: 2,
            turnaroundDays: 5,
            features: ['Podcast Production', 'Basic Editing', 'Show Notes', 'Email Support'],
            storageLimit: 1024 * 1024 * 1024 // 1GB
        },
        scale: {
            name: 'Scale Package',
            price: 997,
            episodesPerMonth: 8,
            revisionsPerEpisode: 3,
            turnaroundDays: 3,
            features: ['Advanced Editing', 'Audiograms', 'Social Media Assets', 'Priority Support', 'Analytics'],
            storageLimit: 5 * 1024 * 1024 * 1024 // 5GB
        },
        enterprise: {
            name: 'Enterprise-Lite Package',
            price: 1497,
            episodesPerMonth: 12,
            revisionsPerEpisode: 5,
            turnaroundDays: 2,
            features: ['Premium Editing', 'Custom Branding', 'Dedicated Support', 'Advanced Analytics', 'Content Strategy'],
            storageLimit: 20 * 1024 * 1024 * 1024 // 20GB
        },
        website: {
            name: 'Website Management',
            price: 297,
            episodesPerMonth: 0,
            revisionsPerEpisode: 0,
            turnaroundDays: 7,
            features: ['Monthly Website Updates', 'Content Management', 'Basic SEO', 'Support'],
            storageLimit: 512 * 1024 * 1024 // 512MB
        },
        single: {
            name: 'Single Episode',
            price: 110,
            episodesPerMonth: 1,
            revisionsPerEpisode: 1,
            turnaroundDays: 7,
            features: ['Single Episode Production', 'Basic Editing', 'Show Notes'],
            storageLimit: 256 * 1024 * 1024 // 256MB
        }
    }
};

// ================================================================
// IN-MEMORY DATA STORES (Replace with database in production)
// ================================================================

// Client data
const clients = new Map();
const episodes = new Map();
const projects = new Map();
const files = new Map();
const notifications = new Map();

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Generate unique IDs
 */
function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `${prefix}_${timestamp}_${random}`;
}

/**
 * Calculate due date based on package
 */
function calculateDueDate(packageType, startDate = new Date()) {
    const packageInfo = clientConfig.packages[packageType];
    if (!packageInfo) return null;
    
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + packageInfo.turnaroundDays);
    
    // Skip weekends for business days
    while (dueDate.getDay() === 0 || dueDate.getDay() === 6) {
        dueDate.setDate(dueDate.getDate() + 1);
    }
    
    return dueDate.toISOString();
}

/**
 * Check if client can create more episodes this month
 */
function canCreateEpisode(clientId, packageType) {
    const packageInfo = clientConfig.packages[packageType];
    if (!packageInfo) return false;
    
    // Count episodes created this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    let episodeCount = 0;
    for (const episode of episodes.values()) {
        if (episode.clientId === clientId) {
            const createdDate = new Date(episode.createdAt);
            if (createdDate >= monthStart) {
                episodeCount++;
            }
        }
    }
    
    return episodeCount < packageInfo.episodesPerMonth;
}

/**
 * Calculate client health score
 */
function calculateHealthScore(clientId) {
    const client = clients.get(clientId);
    if (!client) return 0;
    
    let score = 100;
    const now = new Date();
    
    // Check for overdue episodes
    const clientEpisodes = Array.from(episodes.values())
        .filter(ep => ep.clientId === clientId);
    
    const overdueCount = clientEpisodes.filter(ep => {
        return ep.dueDate && new Date(ep.dueDate) < now && ep.status !== 'completed';
    }).length;
    
    // Reduce score for overdue episodes
    score -= overdueCount * 15;
    
    // Check revision usage
    const highRevisionCount = clientEpisodes.filter(ep => 
        ep.revisionCount > clientConfig.packages[client.packageType]?.revisionsPerEpisode
    ).length;
    
    score -= highRevisionCount * 10;
    
    // Check communication responsiveness (placeholder)
    // In production, track response times to feedback requests
    
    return Math.max(0, Math.min(100, score));
}

// ================================================================
// DASHBOARD ENDPOINTS
// ================================================================

/**
 * Get client dashboard data
 */
async function getDashboard(req, res) {
    try {
        const clientId = req.user.id;
        const packageType = req.user.packageType;
        
        // Get client episodes
        const clientEpisodes = Array.from(episodes.values())
            .filter(episode => episode.clientId === clientId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Calculate statistics
        const totalEpisodes = clientEpisodes.length;
        const completedEpisodes = clientEpisodes.filter(ep => ep.status === 'completed').length;
        const inProgressEpisodes = clientEpisodes.filter(ep => 
            ['in-progress', 'client-review', 'revision'].includes(ep.status)
        ).length;
        
        // Get current month episode count
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEpisodes = clientEpisodes.filter(ep => 
            new Date(ep.createdAt) >= monthStart
        ).length;
        
        // Get package information
        const packageInfo = clientConfig.packages[packageType] || clientConfig.packages.growth;
        
        // Calculate remaining episodes for this month
        const remainingEpisodes = Math.max(0, packageInfo.episodesPerMonth - thisMonthEpisodes);
        
        // Get recent episodes (last 5)
        const recentEpisodes = clientEpisodes.slice(0, 5).map(episode => ({
            id: episode.id,
            title: episode.title,
            status: episode.status,
            dueDate: episode.dueDate,
            createdAt: episode.createdAt,
            priority: episode.priority || 'medium'
        }));
        
        // Get client notifications
        const clientNotifications = Array.from(notifications.values())
            .filter(notif => notif.clientId === clientId && !notif.read)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);
        
        // Calculate health score
        const healthScore = calculateHealthScore(clientId);
        
        res.json({
            success: true,
            dashboard: {
                client: {
                    id: req.user.id,
                    name: req.user.name,
                    companyName: req.user.companyName,
                    packageType: packageType,
                    healthScore: healthScore
                },
                package: {
                    ...packageInfo,
                    remainingEpisodes: remainingEpisodes,
                    episodesUsed: thisMonthEpisodes
                },
                statistics: {
                    totalEpisodes,
                    completedEpisodes,
                    inProgressEpisodes,
                    thisMonthEpisodes,
                    remainingEpisodes
                },
                recentEpisodes,
                notifications: clientNotifications,
                canCreateEpisode: canCreateEpisode(clientId, packageType)
            }
        });
        
    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({
            error: 'Failed to load dashboard',
            code: 'DASHBOARD_ERROR'
        });
    }
}

/**
 * Get client statistics
 */
async function getClientStats(req, res) {
    try {
        const clientId = req.user.id;
        
        // Get all client episodes
        const clientEpisodes = Array.from(episodes.values())
            .filter(episode => episode.clientId === clientId);
        
        // Calculate detailed statistics
        const stats = {
            episodes: {
                total: clientEpisodes.length,
                completed: clientEpisodes.filter(ep => ep.status === 'completed').length,
                inProgress: clientEpisodes.filter(ep => ep.status === 'in-progress').length,
                pending: clientEpisodes.filter(ep => ep.status === 'pending').length,
                revision: clientEpisodes.filter(ep => ep.status === 'revision').length
            },
            monthly: {},
            average: {
                turnaroundTime: 0,
                revisions: 0,
                satisfaction: 0
            },
            trends: {
                episodeGrowth: 0,
                completionRate: 0
            }
        };
        
        // Calculate monthly breakdown (last 6 months)
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const monthKey = date.toISOString().substr(0, 7); // YYYY-MM format
            
            const monthEpisodes = clientEpisodes.filter(ep => 
                ep.createdAt.substr(0, 7) === monthKey
            );
            
            stats.monthly[monthKey] = {
                created: monthEpisodes.length,
                completed: monthEpisodes.filter(ep => ep.status === 'completed').length
            };
        }
        
        // Calculate averages
        if (clientEpisodes.length > 0) {
            const completedEpisodes = clientEpisodes.filter(ep => ep.status === 'completed');
            
            if (completedEpisodes.length > 0) {
                // Average turnaround time (placeholder calculation)
                stats.average.turnaroundTime = 3.5; // days
                
                // Average revisions
                const totalRevisions = completedEpisodes.reduce((sum, ep) => sum + (ep.revisionCount || 0), 0);
                stats.average.revisions = Math.round((totalRevisions / completedEpisodes.length) * 10) / 10;
                
                // Satisfaction score (placeholder)
                stats.average.satisfaction = 4.7; // out of 5
            }
        }
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Get client stats error:', error);
        res.status(500).json({
            error: 'Failed to load statistics',
            code: 'STATS_ERROR'
        });
    }
}

// ================================================================
// EPISODE MANAGEMENT
// ================================================================

/**
 * Get client episodes
 */
async function getEpisodes(req, res) {
    try {
        const clientId = req.user.id;
        const { page = 1, limit = 10, status, search } = req.query;
        
        let clientEpisodes = Array.from(episodes.values())
            .filter(episode => episode.clientId === clientId);
        
        // Apply filters
        if (status) {
            clientEpisodes = clientEpisodes.filter(ep => ep.status === status);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            clientEpisodes = clientEpisodes.filter(ep => 
                ep.title.toLowerCase().includes(searchLower) ||
                ep.description?.toLowerCase().includes(searchLower)
            );
        }
        
        // Sort by creation date (newest first)
        clientEpisodes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedEpisodes = clientEpisodes.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            episodes: paginatedEpisodes,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(clientEpisodes.length / limit),
                totalEpisodes: clientEpisodes.length,
                hasNext: endIndex < clientEpisodes.length,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Get episodes error:', error);
        res.status(500).json({
            error: 'Failed to load episodes',
            code: 'EPISODES_ERROR'
        });
    }
}

/**
 * Get single episode
 */
async function getEpisode(req, res) {
    try {
        const { episodeId } = req.params;
        const clientId = req.user.id;
        
        const episode = episodes.get(episodeId);
        
        if (!episode) {
            return res.status(404).json({
                error: 'Episode not found',
                code: 'EPISODE_NOT_FOUND'
            });
        }
        
        // Check if client owns this episode (or is admin)
        if (episode.clientId !== clientId && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                code: 'ACCESS_DENIED'
            });
        }
        
        // Get episode files
        const episodeFiles = Array.from(files.values())
            .filter(file => file.episodeId === episodeId)
            .map(file => ({
                id: file.id,
                name: file.originalName,
                size: file.size,
                type: file.category,
                uploadedAt: file.uploadedAt,
                downloadUrl: `/api/client/files/${file.id}/download`
            }));
        
        res.json({
            success: true,
            episode: {
                ...episode,
                files: episodeFiles
            }
        });
        
    } catch (error) {
        console.error('Get episode error:', error);
        res.status(500).json({
            error: 'Failed to load episode',
            code: 'EPISODE_ERROR'
        });
    }
}

/**
 * Create new episode
 */
async function createEpisode(req, res) {
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
        
        const clientId = req.user.id;
        const packageType = req.user.packageType;
        
        // Check if client can create more episodes
        if (!canCreateEpisode(clientId, packageType)) {
            const packageInfo = clientConfig.packages[packageType];
            return res.status(403).json({
                error: `Monthly episode limit reached. Your ${packageInfo.name} includes ${packageInfo.episodesPerMonth} episodes per month.`,
                code: 'EPISODE_LIMIT_REACHED',
                limit: packageInfo.episodesPerMonth
            });
        }
        
        const { title, description, notes, priority = 'medium', targetDate } = req.body;
        
        // Generate episode ID
        const episodeId = generateId('ep');
        
        // Calculate due date
        const dueDate = calculateDueDate(packageType);
        
        // Create episode
        const episode = {
            id: episodeId,
            clientId: clientId,
            title: title.trim(),
            description: description?.trim() || '',
            notes: notes?.trim() || '',
            status: 'pending',
            priority: priority,
            packageType: packageType,
            dueDate: dueDate,
            targetDate: targetDate || null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            revisionCount: 0,
            files: [],
            timeline: [
                {
                    id: generateId('timeline'),
                    status: 'pending',
                    timestamp: new Date().toISOString(),
                    message: 'Episode created',
                    user: req.user.name
                }
            ]
        };
        
        episodes.set(episodeId, episode);
        
        // Create notification
        const notificationId = generateId('notif');
        notifications.set(notificationId, {
            id: notificationId,
            clientId: clientId,
            type: 'episode_created',
            title: 'Episode Created',
            message: `New episode "${title}" has been created and is pending production.`,
            createdAt: new Date().toISOString(),
            read: false,
            episodeId: episodeId
        });
        
        console.log(`🎙️ Episode created: ${title} for client ${req.user.companyName}`);
        
        res.status(201).json({
            success: true,
            message: 'Episode created successfully',
            episode: episode
        });
        
    } catch (error) {
        console.error('Create episode error:', error);
        res.status(500).json({
            error: 'Failed to create episode',
            code: 'CREATE_EPISODE_ERROR'
        });
    }
}

/**
 * Update episode (client can update certain fields)
 */
async function updateEpisode(req, res) {
    try {
        const { episodeId } = req.params;
        const clientId = req.user.id;
        
        const episode = episodes.get(episodeId);
        
        if (!episode) {
            return res.status(404).json({
                error: 'Episode not found',
                code: 'EPISODE_NOT_FOUND'
            });
        }
        
        // Check ownership
        if (episode.clientId !== clientId) {
            return res.status(403).json({
                error: 'Access denied',
                code: 'ACCESS_DENIED'
            });
        }
        
        // Only allow updates to certain fields and only in certain statuses
        const allowedStatuses = ['pending', 'client-review'];
        if (!allowedStatuses.includes(episode.status)) {
            return res.status(400).json({
                error: 'Episode cannot be modified in its current status',
                code: 'INVALID_STATUS_FOR_UPDATE',
                currentStatus: episode.status
            });
        }
        
        const { title, description, notes, priority } = req.body;
        const updatedFields = {};
        
        if (title && title.trim() !== episode.title) {
            updatedFields.title = title.trim();
        }
        
        if (description !== undefined && description.trim() !== episode.description) {
            updatedFields.description = description.trim();
        }
        
        if (notes !== undefined && notes.trim() !== episode.notes) {
            updatedFields.notes = notes.trim();
        }
        
        if (priority && ['low', 'medium', 'high', 'urgent'].includes(priority) && priority !== episode.priority) {
            updatedFields.priority = priority;
        }
        
        // Apply updates
        Object.assign(episode, updatedFields);
        episode.updatedAt = new Date().toISOString();
        
        // Add timeline entry
        if (Object.keys(updatedFields).length > 0) {
            episode.timeline.push({
                id: generateId('timeline'),
                status: episode.status,
                timestamp: new Date().toISOString(),
                message: `Episode updated: ${Object.keys(updatedFields).join(', ')}`,
                user: req.user.name
            });
        }
        
        episodes.set(episodeId, episode);
        
        res.json({
            success: true,
            message: 'Episode updated successfully',
            episode: episode,
            updatedFields: Object.keys(updatedFields)
        });
        
    } catch (error) {
        console.error('Update episode error:', error);
        res.status(500).json({
            error: 'Failed to update episode',
            code: 'UPDATE_EPISODE_ERROR'
        });
    }
}

// ================================================================
// FILE MANAGEMENT
// ================================================================

/**
 * Upload files for episode
 */
async function uploadFiles(req, res) {
    try {
        const { episodeId } = req.params;
        const clientId = req.user.id;
        
        // Verify episode exists and belongs to client
        const episode = episodes.get(episodeId);
        if (!episode || episode.clientId !== clientId) {
            return res.status(404).json({
                error: 'Episode not found',
                code: 'EPISODE_NOT_FOUND'
            });
        }
        
        // Check if files were processed by middleware
        if (!req.processedFiles || req.processedFiles.length === 0) {
            return res.status(400).json({
                error: 'No files were uploaded',
                code: 'NO_FILES'
            });
        }
        
        // Store file metadata
        const uploadedFiles = [];
        
        for (const fileData of req.processedFiles) {
            fileData.episodeId = episodeId;
            fileData.clientId = clientId;
            
            files.set(fileData.id, fileData);
            uploadedFiles.push({
                id: fileData.id,
                name: fileData.originalName,
                size: fileData.size,
                type: fileData.category,
                uploadedAt: fileData.uploadedAt
            });
        }
        
        // Update episode
        episode.files = episode.files || [];
        episode.files.push(...req.processedFiles.map(f => f.id));
        episode.updatedAt = new Date().toISOString();
        
        // Add timeline entry
        episode.timeline.push({
            id: generateId('timeline'),
            status: episode.status,
            timestamp: new Date().toISOString(),
            message: `${uploadedFiles.length} file(s) uploaded: ${uploadedFiles.map(f => f.name).join(', ')}`,
            user: req.user.name
        });
        
        episodes.set(episodeId, episode);
        
        // Create notification
        const notificationId = generateId('notif');
        notifications.set(notificationId, {
            id: notificationId,
            clientId: clientId,
            type: 'files_uploaded',
            title: 'Files Uploaded',
            message: `${uploadedFiles.length} file(s) uploaded to episode "${episode.title}"`,
            createdAt: new Date().toISOString(),
            read: false,
            episodeId: episodeId
        });
        
        console.log(`📁 Files uploaded: ${uploadedFiles.length} files for episode ${episode.title}`);
        
        res.json({
            success: true,
            message: `${uploadedFiles.length} file(s) uploaded successfully`,
            files: uploadedFiles,
            episodeId: episodeId
        });
        
    } catch (error) {
        console.error('Upload files error:', error);
        res.status(500).json({
            error: 'Failed to upload files',
            code: 'UPLOAD_ERROR'
        });
    }
}

/**
 * Get client files
 */
async function getFiles(req, res) {
    try {
        const clientId = req.user.id;
        const { episodeId, type, page = 1, limit = 20 } = req.query;
        
        let clientFiles = Array.from(files.values())
            .filter(file => file.clientId === clientId);
        
        // Filter by episode if specified
        if (episodeId) {
            clientFiles = clientFiles.filter(file => file.episodeId === episodeId);
        }
        
        // Filter by file type if specified
        if (type) {
            clientFiles = clientFiles.filter(file => file.category === type);
        }
        
        // Sort by upload date (newest first)
        clientFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedFiles = clientFiles.slice(startIndex, endIndex);
        
        // Format file data
        const formattedFiles = paginatedFiles.map(file => ({
            id: file.id,
            name: file.originalName,
            size: file.size,
            type: file.category,
            mimetype: file.mimetype,
            episodeId: file.episodeId,
            uploadedAt: file.uploadedAt,
            downloadUrl: `/api/client/files/${file.id}/download`,
            thumbnailUrl: file.thumbnailPath ? `/api/client/files/${file.id}/thumbnail` : null
        }));
        
        res.json({
            success: true,
            files: formattedFiles,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(clientFiles.length / limit),
                totalFiles: clientFiles.length,
                hasNext: endIndex < clientFiles.length,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('Get files error:', error);
        res.status(500).json({
            error: 'Failed to load files',
            code: 'FILES_ERROR'
        });
    }
}

/**
 * Download file
 */
async function downloadFile(req, res) {
    try {
        const { fileId } = req.params;
        const clientId = req.user.id;
        
        const file = files.get(fileId);
        
        if (!file) {
            return res.status(404).json({
                error: 'File not found',
                code: 'FILE_NOT_FOUND'
            });
        }
        
        // Check ownership
        if (file.clientId !== clientId && req.user.role !== 'admin') {
            return res.status(403).json({
                error: 'Access denied',
                code: 'ACCESS_DENIED'
            });
        }
        
        // Use secure download from file upload middleware
        // This would decrypt and serve the file
        res.json({
            success: true,
            message: 'File download endpoint - implementation pending',
            file: {
                id: file.id,
                name: file.originalName,
                size: file.size
            }
        });
        
    } catch (error) {
        console.error('Download file error:', error);
        res.status(500).json({
            error: 'Failed to download file',
            code: 'DOWNLOAD_ERROR'
        });
    }
}

// ================================================================
// NOTIFICATIONS
// ================================================================

/**
 * Get client notifications
 */
async function getNotifications(req, res) {
    try {
        const clientId = req.user.id;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        
        let clientNotifications = Array.from(notifications.values())
            .filter(notif => notif.clientId === clientId);
        
        if (unreadOnly === 'true') {
            clientNotifications = clientNotifications.filter(notif => !notif.read);
        }
        
        // Sort by creation date (newest first)
        clientNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // Pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedNotifications = clientNotifications.slice(startIndex, endIndex);
        
        const unreadCount = clientNotifications.filter(notif => !notif.read).length;
        
        res.json({
            success: true,
            notifications: paginatedNotifications,
            unreadCount: unreadCount,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(clientNotifications.length / limit),
                totalNotifications: clientNotifications.length
            }
        });
        
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            error: 'Failed to load notifications',
            code: 'NOTIFICATIONS_ERROR'
        });
    }
}

/**
 * Mark notification as read
 */
async function markNotificationRead(req, res) {
    try {
        const { notificationId } = req.params;
        const clientId = req.user.id;
        
        const notification = notifications.get(notificationId);
        
        if (!notification || notification.clientId !== clientId) {
            return res.status(404).json({
                error: 'Notification not found',
                code: 'NOTIFICATION_NOT_FOUND'
            });
        }
        
        notification.read = true;
        notification.readAt = new Date().toISOString();
        notifications.set(notificationId, notification);
        
        res.json({
            success: true,
            message: 'Notification marked as read'
        });
        
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({
            error: 'Failed to mark notification as read',
            code: 'NOTIFICATION_UPDATE_ERROR'
        });
    }
}

// ================================================================
// ACCOUNT MANAGEMENT
// ================================================================

/**
 * Get account information
 */
async function getAccount(req, res) {
    try {
        const user = req.user;
        const packageInfo = clientConfig.packages[user.packageType] || clientConfig.packages.growth;
        
        // Calculate usage statistics
        const clientEpisodes = Array.from(episodes.values())
            .filter(episode => episode.clientId === user.id);
        
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthEpisodes = clientEpisodes.filter(ep => 
            new Date(ep.createdAt) >= monthStart
        ).length;
        
        // Calculate storage usage (placeholder)
        const storageUsed = 0; // Would calculate from actual file sizes
        
        const accountInfo = {
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                companyName: user.companyName,
                packageType: user.packageType,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            },
            package: {
                ...packageInfo,
                episodesUsedThisMonth: thisMonthEpisodes,
                episodesRemainingThisMonth: Math.max(0, packageInfo.episodesPerMonth - thisMonthEpisodes)
            },
            usage: {
                totalEpisodes: clientEpisodes.length,
                completedEpisodes: clientEpisodes.filter(ep => ep.status === 'completed').length,
                storageUsed: storageUsed,
                storageLimit: packageInfo.storageLimit,
                storageUsedPercent: Math.round((storageUsed / packageInfo.storageLimit) * 100)
            },
            healthScore: calculateHealthScore(user.id)
        };
        
        res.json({
            success: true,
            account: accountInfo
        });
        
    } catch (error) {
        console.error('Get account error:', error);
        res.status(500).json({
            error: 'Failed to load account information',
            code: 'ACCOUNT_ERROR'
        });
    }
}

// ================================================================
// INITIALIZATION & DEMO DATA
// ================================================================

/**
 * Initialize demo data for testing
 */
function initializeDemoData() {
    // This would be removed in production - just for testing
    if (process.env.NODE_ENV === 'development') {
        console.log('📊 Initializing demo client data...');
        
        // Demo episodes for testing
        const demoEpisode = {
            id: 'ep_demo_001',
            clientId: 'client_001', // Would match a real client ID
            title: 'Getting Started with Content Marketing',
            description: 'An introduction to building a content marketing strategy that drives results.',
            notes: 'Focus on actionable tips and real-world examples.',
            status: 'completed',
            priority: 'medium',
            packageType: 'scale',
            dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days ago
            updatedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            revisionCount: 1,
            files: [],
            timeline: [
                {
                    id: 'timeline_001',
                    status: 'pending',
                    timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
                    message: 'Episode created',
                    user: 'Demo Client'
                },
                {
                    id: 'timeline_002',
                    status: 'completed',
                    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    message: 'Episode completed and delivered',
                    user: '223 Media Team'
                }
            ]
        };
        
        episodes.set(demoEpisode.id, demoEpisode);
    }
}

// Initialize demo data on module load
initializeDemoData();

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    // Dashboard
    getDashboard,
    getClientStats,
    
    // Episode management
    getEpisodes,
    getEpisode,
    createEpisode,
    updateEpisode,
    
    // File management
    uploadFiles,
    getFiles,
    downloadFile,
    
    // Notifications
    getNotifications,
    markNotificationRead,
    
    // Account
    getAccount,
    
    // Utilities (for testing/admin)
    generateId,
    calculateDueDate,
    canCreateEpisode,
    calculateHealthScore,
    
    // Data access (for admin dashboard)
    getAllEpisodes: () => Array.from(episodes.values()),
    getAllFiles: () => Array.from(files.values()),
    getAllNotifications: () => Array.from(notifications.values()),
    
    // Configuration
    clientConfig
};
