// ================================================================
// 223 MEDIA AUTHENTICATION MIDDLEWARE
// JWT-based authentication system with role-based access control
// ================================================================

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

// ================================================================
// CONFIGURATION
// ================================================================

const authConfig = {
    jwtSecret: process.env.JWT_SECRET || 'fallback_secret_for_development_only',
    jwtExpiresIn: '15m',
    refreshTokenExpiresIn: '7d',
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes in milliseconds
    bcryptSaltRounds: 12
};

// ================================================================
// IN-MEMORY STORES (Replace with database in production)
// ================================================================

// User store - replace with database
const users = new Map();
const refreshTokens = new Map();
const loginAttempts = new Map();
const blacklistedTokens = new Set();

// ================================================================
// USER MANAGEMENT
// ================================================================

/**
 * Initialize default admin user
 */
function initializeDefaultUsers() {
    const adminEmail = process.env.ADMIN_EMAIL || '2twenty3media@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    
    if (!users.has(adminEmail)) {
        const hashedPassword = bcryptjs.hashSync(adminPassword, authConfig.bcryptSaltRounds);
        
        users.set(adminEmail, {
            id: 'admin_001',
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
            name: '223 Media Admin',
            companyName: '223 Media',
            packageType: 'admin',
            permissions: ['admin', 'client'],
            createdAt: new Date().toISOString(),
            lastLogin: null,
            isActive: true
        });
        
        console.log('🔑 Default admin user initialized:', adminEmail);
    }
}

/**
 * Add a new user to the system
 */
function addUser(userData) {
    const hashedPassword = bcryptjs.hashSync(userData.password, authConfig.bcryptSaltRounds);
    
    const user = {
        id: userData.id || `client_${Date.now()}`,
        email: userData.email,
        password: hashedPassword,
        role: userData.role || 'client',
        name: userData.name,
        companyName: userData.companyName,
        packageType: userData.packageType || 'growth',
        permissions: userData.role === 'admin' ? ['admin', 'client'] : ['client'],
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isActive: true
    };
    
    users.set(userData.email, user);
    console.log(`👤 User added: ${userData.email} (${userData.role})`);
    return user;
}

/**
 * Get user by email (without password)
 */
function getUserByEmail(email) {
    const user = users.get(email);
    if (user) {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
    }
    return null;
}

/**
 * Verify user credentials
 */
function verifyCredentials(email, password) {
    const user = users.get(email);
    if (!user || !user.isActive) {
        return null;
    }
    
    const isValidPassword = bcryptjs.compareSync(password, user.password);
    if (!isValidPassword) {
        return null;
    }
    
    // Update last login
    user.lastLogin = new Date().toISOString();
    users.set(email, user);
    
    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

// ================================================================
// TOKEN MANAGEMENT
// ================================================================

/**
 * Generate JWT access token
 */
function generateAccessToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        packageType: user.packageType,
        permissions: user.permissions,
        type: 'access'
    };
    
    return jwt.sign(payload, authConfig.jwtSecret, {
        expiresIn: authConfig.jwtExpiresIn,
        issuer: '223media-portal',
        audience: user.role
    });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(user) {
    const payload = {
        id: user.id,
        email: user.email,
        type: 'refresh'
    };
    
    const refreshToken = jwt.sign(payload, authConfig.jwtSecret, {
        expiresIn: authConfig.refreshTokenExpiresIn,
        issuer: '223media-portal'
    });
    
    // Store refresh token
    refreshTokens.set(refreshToken, {
        userId: user.id,
        email: user.email,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    
    return refreshToken;
}

/**
 * Verify and decode JWT token
 */
function verifyToken(token) {
    try {
        // Check if token is blacklisted
        if (blacklistedTokens.has(token)) {
            throw new Error('Token has been revoked');
        }
        
        const decoded = jwt.verify(token, authConfig.jwtSecret);
        return decoded;
    } catch (error) {
        throw new Error(`Invalid token: ${error.message}`);
    }
}

/**
 * Refresh access token using refresh token
 */
function refreshAccessToken(refreshToken) {
    try {
        const decoded = verifyToken(refreshToken);
        
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid refresh token type');
        }
        
        // Check if refresh token exists in store
        const storedToken = refreshTokens.get(refreshToken);
        if (!storedToken) {
            throw new Error('Refresh token not found');
        }
        
        // Get current user data
        const user = getUserByEmail(decoded.email);
        if (!user || !user.isActive) {
            throw new Error('User not found or inactive');
        }
        
        // Generate new access token
        const newAccessToken = generateAccessToken(user);
        
        return {
            accessToken: newAccessToken,
            user: user
        };
    } catch (error) {
        throw new Error(`Refresh token error: ${error.message}`);
    }
}

/**
 * Revoke refresh token
 */
function revokeRefreshToken(refreshToken) {
    refreshTokens.delete(refreshToken);
}

/**
 * Blacklist access token
 */
function blacklistToken(token) {
    blacklistedTokens.add(token);
    
    // Clean up blacklisted tokens periodically
    if (blacklistedTokens.size > 1000) {
        cleanupBlacklistedTokens();
    }
}

/**
 * Clean up expired blacklisted tokens
 */
function cleanupBlacklistedTokens() {
    // In a real implementation, you'd check token expiration
    // For now, we'll just keep the most recent 500 tokens
    if (blacklistedTokens.size > 500) {
        const tokensArray = Array.from(blacklistedTokens);
        blacklistedTokens.clear();
        tokensArray.slice(-500).forEach(token => blacklistedTokens.add(token));
    }
}

// ================================================================
// BRUTE FORCE PROTECTION
// ================================================================

/**
 * Check if IP/email is locked out due to failed attempts
 */
function isLockedOut(identifier) {
    const attempts = loginAttempts.get(identifier);
    if (!attempts) return false;
    
    const now = Date.now();
    if (attempts.lockedUntil && now < attempts.lockedUntil) {
        return true;
    }
    
    // Reset if lockout period has passed
    if (attempts.lockedUntil && now >= attempts.lockedUntil) {
        loginAttempts.delete(identifier);
    }
    
    return false;
}

/**
 * Record failed login attempt
 */
function recordFailedAttempt(identifier) {
    const now = Date.now();
    const attempts = loginAttempts.get(identifier) || { count: 0, firstAttempt: now };
    
    attempts.count++;
    attempts.lastAttempt = now;
    
    // Lock account if too many attempts
    if (attempts.count >= authConfig.maxLoginAttempts) {
        attempts.lockedUntil = now + authConfig.lockoutDuration;
        console.log(`🔒 Account locked due to failed attempts: ${identifier}`);
    }
    
    loginAttempts.set(identifier, attempts);
}

/**
 * Reset login attempts on successful login
 */
function resetLoginAttempts(identifier) {
    loginAttempts.delete(identifier);
}

// ================================================================
// MIDDLEWARE FUNCTIONS
// ================================================================

/**
 * Authentication middleware - verify JWT token
 */
function authenticate(req, res, next) {
    try {
        // Extract token from Authorization header or cookies
        let token = null;
        
        // Check Authorization header (Bearer token)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        
        // Check cookies as fallback
        if (!token && req.cookies && req.cookies['223media_token']) {
            token = req.cookies['223media_token'];
        }
        
        // No token provided
        if (!token) {
            return res.status(401).json({
                error: 'Access denied. No token provided.',
                code: 'NO_TOKEN'
            });
        }
        
        // Verify token
        const decoded = verifyToken(token);
        
        // Get current user data
        const user = getUserByEmail(decoded.email);
        if (!user || !user.isActive) {
            return res.status(401).json({
                error: 'User not found or inactive.',
                code: 'INVALID_USER'
            });
        }
        
        // Add user data to request
        req.user = user;
        req.token = token;
        
        next();
    } catch (error) {
        console.error('Authentication error:', error.message);
        
        return res.status(401).json({
            error: 'Invalid token.',
            code: 'INVALID_TOKEN',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

/**
 * Authorization middleware - check user roles and permissions
 */
function authorize(allowedRoles = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
        }
        
        // Admin users have access to everything
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Check if user role is allowed
        if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions.',
                code: 'FORBIDDEN',
                required: allowedRoles,
                current: req.user.role
            });
        }
        
        next();
    };
}

/**
 * Package-based authorization middleware
 */
function requirePackage(requiredPackages = []) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required.',
                code: 'AUTH_REQUIRED'
            });
        }
        
        // Admin users bypass package restrictions
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Check package access
        if (requiredPackages.length > 0 && !requiredPackages.includes(req.user.packageType)) {
            return res.status(403).json({
                error: 'Package upgrade required for this feature.',
                code: 'PACKAGE_REQUIRED',
                required: requiredPackages,
                current: req.user.packageType
            });
        }
        
        next();
    };
}

/**
 * Optional authentication - don't fail if no token
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        // Use regular authentication if token is provided
        return authenticate(req, res, next);
    }
    
    // Continue without authentication
    req.user = null;
    next();
}

// ================================================================
// AUTHENTICATION ENDPOINTS
// ================================================================

/**
 * Login endpoint
 */
async function login(req, res) {
    try {
        const { email, password } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;
        
        // Basic validation
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email and password are required.',
                code: 'MISSING_CREDENTIALS'
            });
        }
        
        // Check for lockout
        if (isLockedOut(email) || isLockedOut(clientIP)) {
            return res.status(429).json({
                error: 'Account temporarily locked due to too many failed attempts.',
                code: 'ACCOUNT_LOCKED',
                retryAfter: Math.ceil(authConfig.lockoutDuration / 60000) // minutes
            });
        }
        
        // Verify credentials
        const user = verifyCredentials(email, password);
        if (!user) {
            recordFailedAttempt(email);
            recordFailedAttempt(clientIP);
            
            return res.status(401).json({
                error: 'Invalid email or password.',
                code: 'INVALID_CREDENTIALS'
            });
        }
        
        // Reset failed attempts on successful login
        resetLoginAttempts(email);
        resetLoginAttempts(clientIP);
        
        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        
        // Set secure cookie
        res.cookie('223media_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });
        
        res.cookie('223media_refresh', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        console.log(`✅ Login successful: ${email} (${user.role})`);
        
        res.json({
            success: true,
            message: 'Login successful',
            user: user,
            token: accessToken,
            refreshToken: refreshToken,
            expiresIn: authConfig.jwtExpiresIn
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error during login.',
            code: 'LOGIN_ERROR'
        });
    }
}

/**
 * Logout endpoint
 */
function logout(req, res) {
    try {
        // Blacklist the current token
        if (req.token) {
            blacklistToken(req.token);
        }
        
        // Revoke refresh token if provided
        const refreshToken = req.cookies['223media_refresh'] || req.body.refreshToken;
        if (refreshToken) {
            revokeRefreshToken(refreshToken);
        }
        
        // Clear cookies
        res.clearCookie('223media_token');
        res.clearCookie('223media_refresh');
        
        console.log(`📤 Logout: ${req.user ? req.user.email : 'unknown'}`);
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            error: 'Error during logout.',
            code: 'LOGOUT_ERROR'
        });
    }
}

/**
 * Refresh token endpoint
 */
function refresh(req, res) {
    try {
        const refreshToken = req.cookies['223media_refresh'] || req.body.refreshToken;
        
        if (!refreshToken) {
            return res.status(401).json({
                error: 'Refresh token required.',
                code: 'NO_REFRESH_TOKEN'
            });
        }
        
        const result = refreshAccessToken(refreshToken);
        
        // Set new access token cookie
        res.cookie('223media_token', result.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000 // 15 minutes
        });
        
        res.json({
            success: true,
            message: 'Token refreshed successfully',
            user: result.user,
            token: result.accessToken,
            expiresIn: authConfig.jwtExpiresIn
        });
        
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(401).json({
            error: 'Invalid or expired refresh token.',
            code: 'INVALID_REFRESH_TOKEN'
        });
    }
}

/**
 * Get current user info
 */
function getCurrentUser(req, res) {
    res.json({
        success: true,
        user: req.user
    });
}

// ================================================================
// INITIALIZATION
// ================================================================

// Initialize default users on module load
initializeDefaultUsers();

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    // Middleware
    authenticate,
    authorize,
    requirePackage,
    optionalAuth,
    
    // Endpoints
    login,
    logout,
    refresh,
    getCurrentUser,
    
    // User management
    addUser,
    getUserByEmail,
    verifyCredentials,
    
    // Token management
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    blacklistToken,
    
    // Security utilities
    isLockedOut,
    recordFailedAttempt,
    resetLoginAttempts,
    
    // Configuration
    authConfig
};
