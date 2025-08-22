// ================================================================
// 223 MEDIA SECURE FILE UPLOAD MIDDLEWARE
// Encrypted file handling with package-based access control
// ================================================================

const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

// ================================================================
// CONFIGURATION
// ================================================================

const uploadConfig = {
    // Base upload directory
    uploadDir: process.env.UPLOAD_PATH || './uploads',
    tempDir: process.env.TEMP_PATH || './temp',
    
    // Encryption settings
    encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
        key: process.env.FILE_ENCRYPTION_KEY || crypto.randomBytes(32)
    },
    
    // Package-based limits
    packageLimits: {
        growth: {
            maxFileSize: 25 * 1024 * 1024, // 25MB
            maxTotalStorage: 1024 * 1024 * 1024, // 1GB
            maxFilesPerUpload: 5,
            allowedTypes: ['mp3', 'wav', 'pdf', 'docx', 'txt', 'jpg', 'png'],
            compressionEnabled: true
        },
        scale: {
            maxFileSize: 50 * 1024 * 1024, // 50MB
            maxTotalStorage: 5 * 1024 * 1024 * 1024, // 5GB
            maxFilesPerUpload: 10,
            allowedTypes: ['mp3', 'wav', 'mp4', 'mov', 'pdf', 'docx', 'txt', 'jpg', 'png', 'gif'],
            compressionEnabled: true
        },
        enterprise: {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            maxTotalStorage: 20 * 1024 * 1024 * 1024, // 20GB
            maxFilesPerUpload: 20,
            allowedTypes: ['mp3', 'wav', 'mp4', 'mov', 'avi', 'pdf', 'docx', 'txt', 'jpg', 'png', 'gif', 'psd', 'ai', 'zip'],
            compressionEnabled: false // High quality for enterprise
        },
        admin: {
            maxFileSize: 500 * 1024 * 1024, // 500MB
            maxTotalStorage: 100 * 1024 * 1024 * 1024, // 100GB
            maxFilesPerUpload: 50,
            allowedTypes: '*', // All types allowed
            compressionEnabled: false
        }
    },
    
    // File type categories
    fileTypes: {
        audio: ['mp3', 'wav', 'aac', 'flac', 'm4a'],
        video: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
        document: ['pdf', 'docx', 'doc', 'txt', 'rtf'],
        image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
        design: ['psd', 'ai', 'sketch', 'figma'],
        archive: ['zip', 'rar', '7z', 'tar', 'gz']
    }
};

// ================================================================
// FILE STORAGE SYSTEM
// ================================================================

/**
 * Create secure storage structure
 */
async function initializeStorage() {
    const directories = [
        uploadConfig.uploadDir,
        uploadConfig.tempDir,
        path.join(uploadConfig.uploadDir, 'clients'),
        path.join(uploadConfig.uploadDir, 'episodes'),
        path.join(uploadConfig.uploadDir, 'projects'),
        path.join(uploadConfig.uploadDir, 'thumbnails'),
        path.join(uploadConfig.uploadDir, 'processed')
    ];
    
    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
        } catch (error) {
            console.error(`Failed to create directory ${dir}:`, error);
        }
    }
    
    console.log('📁 Storage directories initialized');
}

/**
 * Generate secure file path
 */
function generateSecureFilePath(clientId, category, originalFilename) {
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalFilename);
    const sanitizedName = originalFilename.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
    
    const filename = `${timestamp}_${randomId}_${sanitizedName}`;
    return path.join(uploadConfig.uploadDir, category, clientId, filename);
}

/**
 * Get file metadata
 */
function getFileMetadata(file, clientId, category) {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const fileType = getFileTypeCategory(ext);
    
    return {
        id: crypto.randomBytes(16).toString('hex'),
        originalName: file.originalname,
        filename: file.filename,
        mimetype: file.mimetype,
        size: file.size,
        extension: ext,
        category: fileType,
        clientId: clientId,
        uploadCategory: category,
        uploadedAt: new Date().toISOString(),
        uploadedBy: clientId,
        encrypted: true,
        metadata: {
            checksum: null, // Will be calculated after encryption
            virus_scanned: false,
            processed: false
        }
    };
}

/**
 * Get file type category
 */
function getFileTypeCategory(extension) {
    for (const [category, extensions] of Object.entries(uploadConfig.fileTypes)) {
        if (extensions.includes(extension)) {
            return category;
        }
    }
    return 'other';
}

// ================================================================
// FILE ENCRYPTION
// ================================================================

/**
 * Encrypt file content
 */
async function encryptFile(inputPath, outputPath) {
    try {
        const data = await fs.readFile(inputPath);
        const iv = crypto.randomBytes(uploadConfig.encryption.ivLength);
        const cipher = crypto.createCipher(uploadConfig.encryption.algorithm, uploadConfig.encryption.key, iv);
        
        let encrypted = cipher.update(data);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        
        const tag = cipher.getAuthTag();
        const encryptedData = Buffer.concat([iv, tag, encrypted]);
        
        await fs.writeFile(outputPath, encryptedData);
        
        // Calculate checksum
        const checksum = crypto.createHash('sha256').update(encryptedData).digest('hex');
        
        return {
            success: true,
            checksum: checksum,
            size: encryptedData.length
        };
    } catch (error) {
        console.error('File encryption error:', error);
        throw new Error('File encryption failed');
    }
}

/**
 * Decrypt file content
 */
async function decryptFile(inputPath) {
    try {
        const encryptedData = await fs.readFile(inputPath);
        
        const iv = encryptedData.slice(0, uploadConfig.encryption.ivLength);
        const tag = encryptedData.slice(uploadConfig.encryption.ivLength, uploadConfig.encryption.ivLength + uploadConfig.encryption.tagLength);
        const encrypted = encryptedData.slice(uploadConfig.encryption.ivLength + uploadConfig.encryption.tagLength);
        
        const decipher = crypto.createDecipher(uploadConfig.encryption.algorithm, uploadConfig.encryption.key, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encrypted);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        
        return decrypted;
    } catch (error) {
        console.error('File decryption error:', error);
        throw new Error('File decryption failed');
    }
}

// ================================================================
// FILE PROCESSING
// ================================================================

/**
 * Process image files (thumbnails, optimization)
 */
async function processImage(inputPath, outputDir, options = {}) {
    try {
        const filename = path.basename(inputPath, path.extname(inputPath));
        
        // Create thumbnail
        const thumbnailPath = path.join(outputDir, `${filename}_thumb.jpg`);
        await sharp(inputPath)
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);
        
        // Create optimized version if compression is enabled
        if (options.compressionEnabled) {
            const optimizedPath = path.join(outputDir, `${filename}_optimized.jpg`);
            await sharp(inputPath)
                .jpeg({ quality: 85 })
                .toFile(optimizedPath);
            
            return {
                thumbnail: thumbnailPath,
                optimized: optimizedPath
            };
        }
        
        return {
            thumbnail: thumbnailPath
        };
    } catch (error) {
        console.error('Image processing error:', error);
        return null;
    }
}

/**
 * Generate audio waveform (placeholder for future implementation)
 */
async function processAudio(inputPath, outputDir) {
    // Placeholder for audio processing
    // Could integrate with ffmpeg or similar tools
    console.log('Audio processing not yet implemented for:', inputPath);
    return null;
}

// ================================================================
// MULTER CONFIGURATION
// ================================================================

/**
 * Dynamic storage configuration based on user package
 */
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            const clientId = req.user?.id || 'anonymous';
            const category = req.body.category || 'general';
            
            const uploadPath = path.join(uploadConfig.tempDir, clientId, category);
            await fs.mkdir(uploadPath, { recursive: true });
            
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const randomId = crypto.randomBytes(8).toString('hex');
        const ext = path.extname(file.originalname);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9\-_\.]/g, '_');
        
        const filename = `${timestamp}_${randomId}_${sanitizedName}`;
        cb(null, filename);
    }
});

/**
 * File filter based on package type
 */
const fileFilter = (req, file, cb) => {
    const userPackage = req.user?.packageType || 'growth';
    const limits = uploadConfig.packageLimits[userPackage];
    
    // Check if file type is allowed
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    
    if (limits.allowedTypes === '*' || limits.allowedTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`File type .${ext} not allowed for ${userPackage} package`), false);
    }
};

/**
 * Create multer upload middleware
 */
function createUploadMiddleware(options = {}) {
    return (req, res, next) => {
        const userPackage = req.user?.packageType || 'growth';
        const limits = uploadConfig.packageLimits[userPackage];
        
        const upload = multer({
            storage: storage,
            fileFilter: fileFilter,
            limits: {
                fileSize: limits.maxFileSize,
                files: limits.maxFilesPerUpload,
                fields: 10,
                fieldSize: 1024 * 1024 // 1MB for text fields
            },
            ...options
        });
        
        // Handle single or multiple files
        const uploadHandler = options.multiple 
            ? upload.array('files', limits.maxFilesPerUpload)
            : upload.single('file');
        
        uploadHandler(req, res, (err) => {
            if (err) {
                console.error('Upload error:', err);
                
                if (err instanceof multer.MulterError) {
                    let errorMessage = 'Upload failed';
                    let errorCode = 'UPLOAD_ERROR';
                    
                    switch (err.code) {
                        case 'LIMIT_FILE_SIZE':
                            errorMessage = `File too large. Maximum size: ${Math.round(limits.maxFileSize / 1024 / 1024)}MB`;
                            errorCode = 'FILE_TOO_LARGE';
                            break;
                        case 'LIMIT_FILE_COUNT':
                            errorMessage = `Too many files. Maximum: ${limits.maxFilesPerUpload}`;
                            errorCode = 'TOO_MANY_FILES';
                            break;
                        case 'LIMIT_UNEXPECTED_FILE':
                            errorMessage = 'Unexpected file field';
                            errorCode = 'UNEXPECTED_FILE';
                            break;
                    }
                    
                    return res.status(400).json({
                        error: errorMessage,
                        code: errorCode,
                        package: userPackage,
                        limits: {
                            maxFileSize: limits.maxFileSize,
                            maxFiles: limits.maxFilesPerUpload,
                            allowedTypes: limits.allowedTypes
                        }
                    });
                }
                
                return res.status(400).json({
                    error: err.message,
                    code: 'UPLOAD_ERROR'
                });
            }
            
            next();
        });
    };
}

// ================================================================
// FILE UPLOAD PROCESSING
// ================================================================

/**
 * Process uploaded files (encrypt, move to permanent storage)
 */
async function processUploadedFiles(req, res, next) {
    try {
        if (!req.file && !req.files) {
            return next();
        }
        
        const files = req.files || [req.file];
        const processedFiles = [];
        const clientId = req.user.id;
        const category = req.body.category || 'general';
        
        for (const file of files) {
            try {
                // Generate secure permanent path
                const permanentPath = generateSecureFilePath(clientId, category, file.originalname);
                await fs.mkdir(path.dirname(permanentPath), { recursive: true });
                
                // Encrypt and move file
                const encryptionResult = await encryptFile(file.path, permanentPath);
                
                // Generate metadata
                const metadata = getFileMetadata(file, clientId, category);
                metadata.metadata.checksum = encryptionResult.checksum;
                metadata.encryptedSize = encryptionResult.size;
                metadata.storagePath = permanentPath;
                
                // Process file based on type
                const fileType = getFileTypeCategory(metadata.extension);
                const userPackage = req.user.packageType;
                const packageLimits = uploadConfig.packageLimits[userPackage];
                
                if (fileType === 'image') {
                    const thumbnailDir = path.join(uploadConfig.uploadDir, 'thumbnails', clientId);
                    await fs.mkdir(thumbnailDir, { recursive: true });
                    
                    const processed = await processImage(file.path, thumbnailDir, {
                        compressionEnabled: packageLimits.compressionEnabled
                    });
                    
                    if (processed) {
                        metadata.thumbnailPath = processed.thumbnail;
                        if (processed.optimized) {
                            metadata.optimizedPath = processed.optimized;
                        }
                    }
                } else if (fileType === 'audio') {
                    const processedDir = path.join(uploadConfig.uploadDir, 'processed', clientId);
                    await fs.mkdir(processedDir, { recursive: true });
                    
                    await processAudio(file.path, processedDir);
                }
                
                // Clean up temporary file
                await fs.unlink(file.path);
                
                processedFiles.push(metadata);
                
                console.log(`📁 File processed: ${file.originalname} -> ${metadata.id}`);
                
            } catch (error) {
                console.error(`Failed to process file ${file.originalname}:`, error);
                
                // Clean up on error
                try {
                    await fs.unlink(file.path);
                } catch (cleanupError) {
                    console.error('Cleanup error:', cleanupError);
                }
                
                throw error;
            }
        }
        
        // Add processed files to request
        req.processedFiles = processedFiles;
        
        next();
        
    } catch (error) {
        console.error('File processing error:', error);
        res.status(500).json({
            error: 'File processing failed',
            code: 'PROCESSING_ERROR'
        });
    }
}

// ================================================================
// FILE ACCESS CONTROL
// ================================================================

/**
 * Check if user can access file
 */
function canAccessFile(user, fileMetadata) {
    // Admin can access all files
    if (user.role === 'admin') {
        return true;
    }
    
    // Users can only access their own files
    return user.id === fileMetadata.clientId;
}

/**
 * Secure file download middleware
 */
async function secureDownload(req, res, next) {
    try {
        const fileId = req.params.fileId;
        const user = req.user;
        
        // Get file metadata (this would come from database in production)
        const fileMetadata = await getFileMetadataById(fileId);
        
        if (!fileMetadata) {
            return res.status(404).json({
                error: 'File not found',
                code: 'FILE_NOT_FOUND'
            });
        }
        
        // Check access permissions
        if (!canAccessFile(user, fileMetadata)) {
            return res.status(403).json({
                error: 'Access denied',
                code: 'ACCESS_DENIED'
            });
        }
        
        // Decrypt and serve file
        const decryptedData = await decryptFile(fileMetadata.storagePath);
        
        res.set({
            'Content-Type': fileMetadata.mimetype,
            'Content-Length': decryptedData.length,
            'Content-Disposition': `attachment; filename="${fileMetadata.originalName}"`,
            'Cache-Control': 'private, no-cache'
        });
        
        res.send(decryptedData);
        
        console.log(`📥 File downloaded: ${fileMetadata.originalName} by ${user.email}`);
        
    } catch (error) {
        console.error('Secure download error:', error);
        res.status(500).json({
            error: 'Download failed',
            code: 'DOWNLOAD_ERROR'
        });
    }
}

// ================================================================
// STORAGE MANAGEMENT
// ================================================================

/**
 * Calculate user storage usage
 */
async function calculateStorageUsage(clientId) {
    // This would query the database in production
    // For now, return a placeholder
    return {
        used: 0,
        limit: uploadConfig.packageLimits.growth.maxTotalStorage,
        files: 0
    };
}

/**
 * Check storage quota
 */
async function checkStorageQuota(req, res, next) {
    try {
        const clientId = req.user.id;
        const userPackage = req.user.packageType;
        const limits = uploadConfig.packageLimits[userPackage];
        
        const usage = await calculateStorageUsage(clientId);
        
        // Calculate size of files being uploaded
        const files = req.files || [req.file];
        const uploadSize = files.reduce((total, file) => total + (file?.size || 0), 0);
        
        if (usage.used + uploadSize > limits.maxTotalStorage) {
            return res.status(413).json({
                error: 'Storage quota exceeded',
                code: 'QUOTA_EXCEEDED',
                usage: usage,
                attempted: uploadSize,
                limit: limits.maxTotalStorage
            });
        }
        
        next();
    } catch (error) {
        console.error('Storage quota check error:', error);
        next();
    }
}

// ================================================================
// UTILITY FUNCTIONS
// ================================================================

/**
 * Get file metadata by ID (placeholder for database query)
 */
async function getFileMetadataById(fileId) {
    // This would be a database query in production
    // For now, return null to indicate not found
    return null;
}

/**
 * Delete file securely
 */
async function deleteFile(fileId, userId) {
    try {
        const fileMetadata = await getFileMetadataById(fileId);
        
        if (!fileMetadata) {
            throw new Error('File not found');
        }
        
        // Check permissions
        if (userId !== fileMetadata.clientId && req.user?.role !== 'admin') {
            throw new Error('Access denied');
        }
        
        // Delete encrypted file
        await fs.unlink(fileMetadata.storagePath);
        
        // Delete thumbnails if they exist
        if (fileMetadata.thumbnailPath) {
            await fs.unlink(fileMetadata.thumbnailPath);
        }
        
        if (fileMetadata.optimizedPath) {
            await fs.unlink(fileMetadata.optimizedPath);
        }
        
        console.log(`🗑️ File deleted: ${fileMetadata.originalName}`);
        
        return true;
    } catch (error) {
        console.error('File deletion error:', error);
        throw error;
    }
}

// ================================================================
// INITIALIZATION
// ================================================================

// Initialize storage on module load
initializeStorage().catch(console.error);

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
    // Middleware
    createUploadMiddleware,
    processUploadedFiles,
    secureDownload,
    checkStorageQuota,
    
    // File management
    encryptFile,
    decryptFile,
    deleteFile,
    canAccessFile,
    
    // Processing
    processImage,
    processAudio,
    
    // Utilities
    generateSecureFilePath,
    getFileMetadata,
    getFileTypeCategory,
    calculateStorageUsage,
    getFileMetadataById,
    
    // Configuration
    uploadConfig
};
