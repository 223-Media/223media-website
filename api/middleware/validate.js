// ================================================================
// 223 MEDIA INPUT VALIDATION MIDDLEWARE
// Comprehensive validation system with sanitization and business rules
// ================================================================

const { body, param, query, validationResult } = require('express-validator');
const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

// ================================================================
// CONFIGURATION
// ================================================================

const validationConfig = {
    // File upload limits by package
    fileLimits: {
        growth: {
            maxSize: 25 * 1024 * 1024, // 25MB
            maxFiles: 5,
            allowedTypes: ['mp3', 'wav', 'pdf', 'docx', 'txt']
        },
        scale: {
            maxSize: 50 * 1024 * 1024, // 50MB
            maxFiles: 10,
            allowedTypes: ['mp3', 'wav', 'mp4', 'mov', 'pdf', 'docx', 'txt', 'jpg', 'png']
        },
        enterprise: {
            maxSize: 100 * 1024 * 1024, // 100MB
            maxFiles: 20,
            allowedTypes: ['mp3', 'wav', 'mp4', 'mov', 'avi', 'pdf', 'docx', 'txt', 'jpg', 'png', 'gif', 'psd', 'ai']
        },
        admin: {
            maxSize: 500 * 1024 * 1024, // 500MB
            maxFiles: 50,
            allowedTypes: '*' // All types allowed for admin
        }
    },
    
    // Text field limits
    textLimits: {
        shortText: 100,
        mediumText: 500,
        longText: 2000,
        description: 5000,
        notes: 10000
    },
    
    // Business rules
    businessRules: {
        packageTypes: ['growth', 'scale', 'enterprise', 'website', 'single'],
        episodeStatuses: ['pending', 'in-progress', 'client-review', 'revision', 'completed'],
        projectStatuses: ['active', 'paused', 'completed', 'cancelled'],
        userRoles: ['admin', 'client'],
        priorities: ['low', 'medium', 'high', 'urgent']
    }
};

// ================================================================
// CUSTOM VALIDATORS
// ================================================================

/**
 * Validate 223 Media package type
 */
const isValidPackageType = (value) => {
    return validationConfig.businessRules.packageTypes.includes(value.toLowerCase());
};

/**
 * Validate episode status
 */
const isValidEpisodeStatus = (value) => {
    return validationConfig.businessRules.episodeStatuses.includes(value.toLowerCase());
};

/**
 * Validate project status
 */
const isValidProjectStatus = (value) => {
    return validationConfig.businessRules.projectStatuses.includes(value.toLowerCase());
};

/**
 * Validate user role
 */
const isValidUserRole = (value) => {
    return validationConfig.businessRules.userRoles.includes(value.toLowerCase());
};

/**
 * Validate priority level
 */
const isValidPriority = (value) => {
    return validationConfig.businessRules.priorities.includes(value.toLowerCase());
};

/**
 * Validate 223 Media client ID format
 */
const isValidClientId = (value) => {
    const clientIdPattern = /^client_[a-zA-Z0-9]{8,}$/;
    return clientIdPattern.test(value);
};

/**
 * Validate episode ID format
 */
const isValidEpisodeId = (value) => {
    const episodeIdPattern = /^ep_[a-zA-Z0-9]{8,}_\d+$/;
    return episodeIdPattern.test(value);
};

/**
 * Validate project ID format
 */
const isValidProjectId = (value) => {
    const projectIdPattern = /^proj_[a-zA-Z0-9]{8,}$/;
    return projectIdPattern.test(value);
};

/**
 * Validate phone number (flexible format)
 */
const isValidPhone = (value) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Check if it's a valid US/international phone number
    return digits.length >= 10 && digits.length <= 15;
};

/**
 * Validate company name (business rules)
 */
const isValidCompanyName = (value) => {
    // Must be 2-100 characters, allow letters, numbers, spaces, and common business punctuation
    const companyPattern = /^[a-zA-Z0-9\s\-\.\,\&\'\"]{2,100}$/;
    return companyPattern.test(value);
};

/**
 * Validate file extension
 */
const isValidFileExtension = (filename, allowedTypes) => {
    if (allowedTypes === '*') return true;
    
    const extension = filename.split('.').pop()?.toLowerCase();
    return allowedTypes.includes(extension);
};

/**
 * Validate password strength
 */
const isStrongPassword = (value) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordPattern.test(value);
};

/**
 * Validate URL format (for websites, social media, etc.)
 */
const isValidURL = (value) => {
    try {
        new URL(value);
        return true;
    } catch {
        return false;
    }
};

/**
 * Validate date range (due dates, etc.)
 */
const isValidDateRange = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    return start <= end && start >= now;
};

// ================================================================
// SANITIZATION FUNCTIONS
// ================================================================

/**
 * Sanitize HTML content
 */
function sanitizeHTML(html) {
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
        ALLOWED_ATTR: []
    });
}

/**
 * Sanitize text input (remove potentially dangerous characters)
 */
function sanitizeText(text) {
    if (typeof text !== 'string') return text;
    
    return text
        .trim()
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/on\w+\s*=/gi, ''); // Remove event handlers
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-zA-Z0-9\-_\.]/g, '_') // Replace special chars with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .substring(0, 100); // Limit length
}

/**
 * Sanitize search query
 */
function sanitizeSearchQuery(query) {
    return query
        .trim()
        .replace(/[<>'"]/g, '') // Remove potentially dangerous characters
        .substring(0, 200); // Limit length
}

// ================================================================
// VALIDATION CHAINS
// ================================================================

/**
 * Authentication validation
 */
const validateLogin = [
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail()
        .isLength({ max: 254 })
        .withMessage('Email too long'),
    
    body('password')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 1, max: 128 })
        .withMessage('Password length invalid'),
    
    // Sanitize inputs
    body('email').customSanitizer(sanitizeText),
    body('password').customSanitizer(sanitizeText)
];

/**
 * Registration validation
 */
const validateRegistration = [
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail()
        .isLength({ max: 254 })
        .withMessage('Email too long'),
    
    body('password')
        .custom(isStrongPassword)
        .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
    
    body('confirmPassword')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords do not match');
            }
            return true;
        }),
    
    body('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be 2-100 characters')
        .matches(/^[a-zA-Z\s\-\'\.]+$/)
        .withMessage('Name contains invalid characters'),
    
    body('companyName')
        .optional()
        .custom(isValidCompanyName)
        .withMessage('Invalid company name format'),
    
    body('phone')
        .optional()
        .custom(isValidPhone)
        .withMessage('Invalid phone number format'),
    
    body('packageType')
        .optional()
        .custom(isValidPackageType)
        .withMessage('Invalid package type'),
    
    // Sanitize inputs
    body('name').customSanitizer(sanitizeText),
    body('companyName').customSanitizer(sanitizeText),
    body('phone').customSanitizer(sanitizeText)
];

/**
 * Client creation validation (admin only)
 */
const validateClientCreation = [
    body('email')
        .isEmail()
        .withMessage('Valid email is required')
        .normalizeEmail(),
    
    body('name')
        .notEmpty()
        .withMessage('Name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be 2-100 characters'),
    
    body('companyName')
        .notEmpty()
        .withMessage('Company name is required')
        .custom(isValidCompanyName)
        .withMessage('Invalid company name format'),
    
    body('packageType')
        .custom(isValidPackageType)
        .withMessage('Invalid package type'),
    
    body('phone')
        .optional()
        .custom(isValidPhone)
        .withMessage('Invalid phone number format'),
    
    body('website')
        .optional()
        .custom(isValidURL)
        .withMessage('Invalid website URL'),
    
    body('notes')
        .optional()
        .isLength({ max: validationConfig.textLimits.notes })
        .withMessage(`Notes too long (max ${validationConfig.textLimits.notes} characters)`),
    
    // Sanitize inputs
    body('name').customSanitizer(sanitizeText),
    body('companyName').customSanitizer(sanitizeText),
    body('notes').customSanitizer(sanitizeHTML)
];

/**
 * Episode creation validation
 */
const validateEpisodeCreation = [
    body('title')
        .notEmpty()
        .withMessage('Episode title is required')
        .isLength({ min: 5, max: validationConfig.textLimits.mediumText })
        .withMessage(`Title must be 5-${validationConfig.textLimits.mediumText} characters`),
    
    body('description')
        .optional()
        .isLength({ max: validationConfig.textLimits.description })
        .withMessage(`Description too long (max ${validationConfig.textLimits.description} characters)`),
    
    body('clientId')
        .custom(isValidClientId)
        .withMessage('Invalid client ID format'),
    
    body('packageType')
        .custom(isValidPackageType)
        .withMessage('Invalid package type'),
    
    body('priority')
        .optional()
        .custom(isValidPriority)
        .withMessage('Invalid priority level'),
    
    body('dueDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid due date format')
        .custom((value) => {
            const dueDate = new Date(value);
            const now = new Date();
            return dueDate > now;
        })
        .withMessage('Due date must be in the future'),
    
    body('notes')
        .optional()
        .isLength({ max: validationConfig.textLimits.notes })
        .withMessage(`Notes too long (max ${validationConfig.textLimits.notes} characters)`),
    
    // Sanitize inputs
    body('title').customSanitizer(sanitizeText),
    body('description').customSanitizer(sanitizeHTML),
    body('notes').customSanitizer(sanitizeHTML)
];

/**
 * Project creation validation
 */
const validateProjectCreation = [
    body('name')
        .notEmpty()
        .withMessage('Project name is required')
        .isLength({ min: 3, max: validationConfig.textLimits.mediumText })
        .withMessage(`Name must be 3-${validationConfig.textLimits.mediumText} characters`),
    
    body('clientId')
        .custom(isValidClientId)
        .withMessage('Invalid client ID format'),
    
    body('packageType')
        .custom(isValidPackageType)
        .withMessage('Invalid package type'),
    
    body('startDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid start date format'),
    
    body('endDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid end date format')
        .custom((value, { req }) => {
            if (req.body.startDate && value) {
                return isValidDateRange(req.body.startDate, value);
            }
            return true;
        })
        .withMessage('End date must be after start date'),
    
    body('description')
        .optional()
        .isLength({ max: validationConfig.textLimits.description })
        .withMessage(`Description too long (max ${validationConfig.textLimits.description} characters)`),
    
    // Sanitize inputs
    body('name').customSanitizer(sanitizeText),
    body('description').customSanitizer(sanitizeHTML)
];

/**
 * File upload validation
 */
const validateFileUpload = (req, res, next) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({
            error: 'No files provided',
            code: 'NO_FILES'
        });
    }
    
    const userPackage = req.user?.packageType || 'growth';
    const limits = validationConfig.fileLimits[userPackage];
    
    // Check number of files
    if (req.files.length > limits.maxFiles) {
        return res.status(400).json({
            error: `Too many files. Maximum ${limits.maxFiles} files allowed for ${userPackage} package.`,
            code: 'TOO_MANY_FILES',
            maxFiles: limits.maxFiles,
            provided: req.files.length
        });
    }
    
    // Validate each file
    for (const file of req.files) {
        // Check file size
        if (file.size > limits.maxSize) {
            return res.status(400).json({
                error: `File "${file.originalname}" is too large. Maximum ${Math.round(limits.maxSize / 1024 / 1024)}MB allowed.`,
                code: 'FILE_TOO_LARGE',
                filename: file.originalname,
                maxSize: limits.maxSize,
                fileSize: file.size
            });
        }
        
        // Check file type
        if (!isValidFileExtension(file.originalname, limits.allowedTypes)) {
            return res.status(400).json({
                error: `File type not allowed for "${file.originalname}".`,
                code: 'INVALID_FILE_TYPE',
                filename: file.originalname,
                allowedTypes: limits.allowedTypes
            });
        }
        
        // Sanitize filename
        file.sanitizedName = sanitizeFilename(file.originalname);
    }
    
    next();
};

/**
 * Search query validation
 */
const validateSearch = [
    query('q')
        .optional()
        .isLength({ min: 1, max: 200 })
        .withMessage('Search query must be 1-200 characters')
        .customSanitizer(sanitizeSearchQuery),
    
    query('page')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Page must be between 1 and 1000'),
    
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    
    query('sortBy')
        .optional()
        .isIn(['name', 'date', 'status', 'priority'])
        .withMessage('Invalid sort field'),
    
    query('sortOrder')
        .optional()
        .isIn(['asc', 'desc'])
        .withMessage('Sort order must be asc or desc')
];

/**
 * ID parameter validation
 */
const validateClientId = [
    param('clientId')
        .custom(isValidClientId)
        .withMessage('Invalid client ID format')
];

const validateEpisodeId = [
    param('episodeId')
        .custom(isValidEpisodeId)
        .withMessage('Invalid episode ID format')
];

const validateProjectId = [
    param('projectId')
        .custom(isValidProjectId)
        .withMessage('Invalid project ID format')
];

// ================================================================
// VALIDATION RESULT HANDLER
// ================================================================

/**
 * Handle validation results and return errors
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const formattedErrors = errors.array().map(error => ({
            field: error.param,
            message: error.msg,
            value: error.value,
            location: error.location
        }));
        
        console.log('🚨 Validation errors:', {
            endpoint: req.path,
            method: req.method,
            errors: formattedErrors,
            user: req.user?.email || 'anonymous',
            timestamp: new Date().toISOString()
        });
        
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: formattedErrors,
            timestamp: new Date().toISOString()
        });
    }
    
    next();
}

/**
 * Sanitize all request data
 */
function sanitizeRequest(req, res, next) {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitizeText(req.body[key]);
            }
        }
    }
    
    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = sanitizeText(req.query[key]);
            }
        }
    }
    
    next();
}

// ================================================================
// BUSINESS LOGIC VALIDATORS
// ================================================================

/**
 * Validate package upgrade permissions
 */
function validatePackageUpgrade(currentPackage, targetPackage) {
    const packageHierarchy = ['growth', 'scale', 'enterprise'];
    const currentIndex = packageHierarchy.indexOf(currentPackage);
    const targetIndex = packageHierarchy.indexOf(targetPackage);
    
    return targetIndex >= currentIndex;
}

/**
 * Validate episode limits for package
 */
function validateEpisodeLimit(packageType, currentEpisodeCount) {
    const limits = {
        growth: 4,
        scale: 8,
        enterprise: 12,
        website: 0,
        single: 1
    };
    
    return currentEpisodeCount < (limits[packageType] || 0);
}

/**
 * Validate file upload limits for package
 */
function validateFileUploadLimits(packageType, fileSize, fileCount) {
    const limits = validationConfig.fileLimits[packageType] || validationConfig.fileLimits.growth;
    
    return {
        sizeValid: fileSize <= limits.maxSize,
        countValid: fileCount <= limits.maxFiles,
        limits: limits
    };
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    // Validation chains
    validateLogin,
    validateRegistration,
    validateClientCreation,
    validateEpisodeCreation,
    validateProjectCreation,
    validateFileUpload,
    validateSearch,
    validateClientId,
    validateEpisodeId,
    validateProjectId,
    
    // Middleware
    handleValidationErrors,
    sanitizeRequest,
    
    // Custom validators
    isValidPackageType,
    isValidEpisodeStatus,
    isValidProjectStatus,
    isValidUserRole,
    isValidPriority,
    isValidClientId,
    isValidEpisodeId,
    isValidProjectId,
    isValidPhone,
    isValidCompanyName,
    isValidFileExtension,
    isStrongPassword,
    isValidURL,
    isValidDateRange,
    
    // Sanitization functions
    sanitizeHTML,
    sanitizeText,
    sanitizeFilename,
    sanitizeSearchQuery,
    
    // Business logic validators
    validatePackageUpgrade,
    validateEpisodeLimit,
    validateFileUploadLimits,
    
    // Configuration
    validationConfig
};
