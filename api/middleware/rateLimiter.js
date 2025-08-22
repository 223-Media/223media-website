// ================================================================
// 223 MEDIA RATE LIMITING MIDDLEWARE
// Advanced request rate limiting with role-based and endpoint-specific limits
// ================================================================

const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// ================================================================
// CONFIGURATION
// ================================================================

const rateLimitConfig = {
    // Global API limits
    global: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // requests per window
        message: 'Too many requests from this IP, please try again later.'
    },
    
    // Authentication endpoints (stricter)
    auth: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // login attempts per window
        skipSuccessfulRequests: true,
        message: 'Too many login attempts, please try again later.'
    },
    
    // File upload limits
    upload: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 50, // uploads per hour
        message: 'Upload limit exceeded, please try again later.'
    },
    
    // Admin API limits (more generous)
    admin: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 300, // requests per window
        message: 'Admin rate limit exceeded.'
    },
    
    // Client portal limits
    client: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 150, // requests per window
        message: 'Client portal rate limit exceeded.'
    },
    
    // Public endpoints (website)
    public: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // requests per window
        message: 'Too many requests, please try again later.'
    },
    
    // Webhook endpoints
    webhook: {
        windowMs: 5 * 60 * 1000, // 5 minutes
        max: 100, // webhooks per window
        message: 'Webhook rate limit exceeded.'
    }
};

// ================================================================
// IN-MEMORY STORES
// ================================================================

// Request tracking for custom logic
const requestCounts = new Map();
const suspiciousIPs = new Set();
const whitelistedIPs = new Set([
    '127.0.0.1',
    '::1',
    // Add your trusted IPs here
]);

// Package-based limits
const packageLimits = {
    growth: {
        uploads: 20, // per hour
        apiCalls: 100 // per 15 minutes
    },
    scale: {
        uploads: 40, // per hour
        apiCalls: 200 // per 15 minutes
    },
    enterprise: {
        uploads: 100, // per hour
        apiCalls: 500 // per 15 minutes
    },
    admin: {
        uploads: 1000, // per hour
        apiCalls: 1000 // per 15 minutes
    }
};

// ================================================================
// CUSTOM KEY GENERATORS
// ================================================================

/**
 * Generate rate limit key based on IP and user
 */
function generateKey(req) {
    const ip = req.ip || req.connection.remoteAddress;
    
    // If user is authenticated, use user ID + IP
    if (req.user) {
        return `${req.user.id}:${ip}`;
    }
    
    // Otherwise use just IP
    return ip;
}

/**
 * Generate key for role-based limiting
 */
function generateRoleKey(req) {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (req.user) {
        return `${req.user.role}:${req.user.id}:${ip}`;
    }
    
    return `anonymous:${ip}`;
}

/**
 * Generate key for package-based limiting
 */
function generatePackageKey(req) {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (req.user && req.user.packageType) {
        return `${req.user.packageType}:${req.user.id}:${ip}`;
    }
    
    return `free:${ip}`;
}

// ================================================================
// CUSTOM RATE LIMIT HANDLERS
// ================================================================

/**
 * Enhanced rate limit handler with logging
 */
function createRateLimitHandler(limitType) {
    return (req, res) => {
        const ip = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent') || 'unknown';
        const endpoint = req.path;
        
        // Log rate limit hit
        console.log(`🚨 Rate limit hit [${limitType}]:`, {
            ip,
            userAgent,
            endpoint,
            user: req.user ? req.user.email : 'anonymous',
            timestamp: new Date().toISOString()
        });
        
        // Track suspicious activity
        trackSuspiciousActivity(ip, limitType);
        
        const config = rateLimitConfig[limitType] || rateLimitConfig.global;
        
        res.status(429).json({
            error: config.message,
            code: 'RATE_LIMIT_EXCEEDED',
            type: limitType,
            retryAfter: Math.ceil(config.windowMs / 1000), // seconds
            timestamp: new Date().toISOString(),
            endpoint: endpoint
        });
    };
}

/**
 * Track suspicious activity patterns
 */
function trackSuspiciousActivity(ip, limitType) {
    const key = `${ip}:${limitType}`;
    const now = Date.now();
    
    if (!requestCounts.has(key)) {
        requestCounts.set(key, { count: 1, firstSeen: now, lastSeen: now });
    } else {
        const data = requestCounts.get(key);
        data.count++;
        data.lastSeen = now;
        
        // Mark as suspicious after multiple rate limit hits
        if (data.count > 5) {
            suspiciousIPs.add(ip);
            console.log(`⚠️ Suspicious activity detected from IP: ${ip}`);
        }
    }
}

/**
 * Skip rate limiting for whitelisted IPs
 */
function skipWhitelisted(req) {
    const ip = req.ip || req.connection.remoteAddress;
    return whitelistedIPs.has(ip);
}

/**
 * Skip rate limiting for successful authentication requests
 */
function skipSuccessfulAuth(req, res) {
    return res.statusCode < 400;
}

// ================================================================
// RATE LIMITERS
// ================================================================

/**
 * Global API rate limiter
 */
const globalLimiter = rateLimit({
    windowMs: rateLimitConfig.global.windowMs,
    max: rateLimitConfig.global.max,
    keyGenerator: generateKey,
    skip: skipWhitelisted,
    handler: createRateLimitHandler('global'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.global.message
});

/**
 * Authentication rate limiter (stricter)
 */
const authLimiter = rateLimit({
    windowMs: rateLimitConfig.auth.windowMs,
    max: rateLimitConfig.auth.max,
    keyGenerator: generateKey,
    skip: skipWhitelisted,
    skipSuccessfulRequests: true,
    handler: createRateLimitHandler('auth'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.auth.message
});

/**
 * File upload rate limiter
 */
const uploadLimiter = rateLimit({
    windowMs: rateLimitConfig.upload.windowMs,
    max: (req) => {
        // Package-based upload limits
        if (req.user && req.user.packageType) {
            return packageLimits[req.user.packageType]?.uploads || packageLimits.growth.uploads;
        }
        return 5; // Very limited for unauthenticated users
    },
    keyGenerator: generatePackageKey,
    skip: skipWhitelisted,
    handler: createRateLimitHandler('upload'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.upload.message
});

/**
 * Admin API rate limiter (more generous)
 */
const adminLimiter = rateLimit({
    windowMs: rateLimitConfig.admin.windowMs,
    max: rateLimitConfig.admin.max,
    keyGenerator: generateRoleKey,
    skip: (req) => {
        // Skip if not admin or whitelisted
        return skipWhitelisted(req) || (req.user && req.user.role !== 'admin');
    },
    handler: createRateLimitHandler('admin'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.admin.message
});

/**
 * Client portal rate limiter
 */
const clientLimiter = rateLimit({
    windowMs: rateLimitConfig.client.windowMs,
    max: (req) => {
        // Package-based API limits
        if (req.user && req.user.packageType) {
            return packageLimits[req.user.packageType]?.apiCalls || packageLimits.growth.apiCalls;
        }
        return 50; // Default for authenticated clients
    },
    keyGenerator: generatePackageKey,
    skip: (req) => {
        // Skip if not client or whitelisted
        return skipWhitelisted(req) || (req.user && req.user.role === 'admin');
    },
    handler: createRateLimitHandler('client'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.client.message
});

/**
 * Public website rate limiter
 */
const publicLimiter = rateLimit({
    windowMs: rateLimitConfig.public.windowMs,
    max: rateLimitConfig.public.max,
    keyGenerator: generateKey,
    skip: skipWhitelisted,
    handler: createRateLimitHandler('public'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.public.message
});

/**
 * Webhook rate limiter
 */
const webhookLimiter = rateLimit({
    windowMs: rateLimitConfig.webhook.windowMs,
    max: rateLimitConfig.webhook.max,
    keyGenerator: generateKey,
    skip: skipWhitelisted,
    handler: createRateLimitHandler('webhook'),
    standardHeaders: true,
    legacyHeaders: false,
    message: rateLimitConfig.webhook.message
});

// ================================================================
// SPEED LIMITERS (Slow down instead of block)
// ================================================================

/**
 * Progressive speed limiter for high-traffic endpoints
 */
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // allow 50 requests per windowMs without delay
    delayMs: 500, // add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // max delay of 20 seconds
    keyGenerator: generateKey,
    skip: skipWhitelisted
});

/**
 * Authentication speed limiter (progressive delays)
 */
const authSpeedLimiter = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 3, // allow 3 requests without delay
    delayMs: 1000, // add 1 second delay per request after delayAfter
    maxDelayMs: 30000, // max delay of 30 seconds
    keyGenerator: generateKey,
    skip: skipWhitelisted
});

// ================================================================
// MIDDLEWARE FUNCTIONS
// ================================================================

/**
 * Apply rate limiting based on route type
 */
function smartRateLimit(req, res, next) {
    const path = req.path;
    const method = req.method;
    
    // Skip OPTIONS requests (CORS preflight)
    if (method === 'OPTIONS') {
        return next();
    }
    
    // Determine which limiter to use based on route
    if (path.startsWith('/api/admin/')) {
        return adminLimiter(req, res, next);
    } else if (path.startsWith('/api/client/')) {
        return clientLimiter(req, res, next);
    } else if (path.includes('/upload')) {
        return uploadLimiter(req, res, next);
    } else if (path.includes('/login') || path.includes('/auth')) {
        return authLimiter(req, res, next);
    } else if (path.startsWith('/api/webhook/')) {
        return webhookLimiter(req, res, next);
    } else if (path.startsWith('/api/')) {
        return globalLimiter(req, res, next);
    } else {
        return publicLimiter(req, res, next);
    }
}

/**
 * Block suspicious IPs
 */
function blockSuspiciousIPs(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    if (suspiciousIPs.has(ip) && !whitelistedIPs.has(ip)) {
        console.log(`🚫 Blocked suspicious IP: ${ip}`);
        
        return res.status(429).json({
            error: 'IP temporarily blocked due to suspicious activity.',
            code: 'IP_BLOCKED',
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

/**
 * Custom package-based rate limiter
 */
function packageBasedLimit(req, res, next) {
    if (!req.user) {
        return next();
    }
    
    const packageType = req.user.packageType;
    const limits = packageLimits[packageType] || packageLimits.growth;
    
    // This is a simplified check - in production you'd want more sophisticated tracking
    const key = `package:${req.user.id}`;
    const now = Date.now();
    const windowStart = now - (15 * 60 * 1000); // 15 minutes ago
    
    // Add request tracking logic here
    // For now, we'll just pass through
    next();
}

/**
 * Log rate limit statistics
 */
function logRateLimitStats() {
    const stats = {
        suspiciousIPs: suspiciousIPs.size,
        trackedRequests: requestCounts.size,
        timestamp: new Date().toISOString()
    };
    
    console.log('📊 Rate limit stats:', stats);
}

// ================================================================
// CLEANUP AND MAINTENANCE
// ================================================================

/**
 * Clean up old tracking data
 */
function cleanupTrackingData() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean up old request counts
    for (const [key, data] of requestCounts.entries()) {
        if (data.lastSeen < oneHourAgo) {
            requestCounts.delete(key);
        }
    }
    
    // Clean up suspicious IPs after 24 hours
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    for (const [key, data] of requestCounts.entries()) {
        if (data.firstSeen < oneDayAgo) {
            const ip = key.split(':')[0];
            suspiciousIPs.delete(ip);
        }
    }
}

// Run cleanup every hour
setInterval(cleanupTrackingData, 60 * 60 * 1000);

// Log stats every 15 minutes
setInterval(logRateLimitStats, 15 * 60 * 1000);

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Add IP to whitelist
 */
function whitelistIP(ip) {
    whitelistedIPs.add(ip);
    suspiciousIPs.delete(ip);
    console.log(`✅ IP whitelisted: ${ip}`);
}

/**
 * Remove IP from whitelist
 */
function removeFromWhitelist(ip) {
    whitelistedIPs.delete(ip);
    console.log(`❌ IP removed from whitelist: ${ip}`);
}

/**
 * Block IP manually
 */
function blockIP(ip) {
    suspiciousIPs.add(ip);
    console.log(`🚫 IP manually blocked: ${ip}`);
}

/**
 * Unblock IP
 */
function unblockIP(ip) {
    suspiciousIPs.delete(ip);
    console.log(`✅ IP unblocked: ${ip}`);
}

/**
 * Get rate limit status for IP/user
 */
function getRateLimitStatus(identifier) {
    return {
        suspicious: suspiciousIPs.has(identifier),
        whitelisted: whitelistedIPs.has(identifier),
        requestData: requestCounts.get(identifier) || null
    };
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    // Primary middleware
    smartRateLimit,
    blockSuspiciousIPs,
    packageBasedLimit,
    
    // Individual rate limiters
    globalLimiter,
    authLimiter,
    uploadLimiter,
    adminLimiter,
    clientLimiter,
    publicLimiter,
    webhookLimiter,
    
    // Speed limiters
    speedLimiter,
    authSpeedLimiter,
    
    // Utility functions
    whitelistIP,
    removeFromWhitelist,
    blockIP,
    unblockIP,
    getRateLimitStatus,
    logRateLimitStats,
    cleanupTrackingData,
    
    // Configuration
    rateLimitConfig,
    packageLimits,
    
    // Data access (for admin dashboard)
    getSuspiciousIPs: () => Array.from(suspiciousIPs),
    getWhitelistedIPs: () => Array.from(whitelistedIPs),
    getRequestCounts: () => Object.fromEntries(requestCounts)
};
