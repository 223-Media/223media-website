// Portal API routes placeholder - will be added incrementally
app.use('/api/admin', (req, res) => {
    res.json({ message: 'Admin API routes coming soon' });
});

app.use('/api/client', (req, res) => {
    res.json({ message: 'Client portal API routes coming soon' });
});

app.use('/api/webhooks', (req, res) => {
    res.json({ message: 'Webhook endpoints coming soon' });
});

// ================================================================
// WEBSITE ROUTES (Existing Website Integration)
// ================================================================

// Main website homepage
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Client portal page
app.get('/portal', (req, res) => {
    res.sendFile(path.join(__dirname, 'portal.html'));
});

// Admin dashboard page  
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ================================================================
// ERROR HANDLING
// ================================================================

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});

// 404 handler for web pages
app.use('*', (req, res) => {
    // If it's an API request, return JSON
    if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found' });
    } else {
        // Otherwise, serve the main website
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('🚨 Server Error:', err);
    
    const isDev = NODE_ENV === 'development';
    const errorResponse = {
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        path: req.path
    };
    
    // Include stack trace in development
    if (isDev) {
        errorResponse.details = err.message;
        errorResponse.stack = err.stack;
    }
    
    res.status(500).json(errorResponse);
});

// ================================================================
// SERVER STARTUP
// ================================================================

const server = app.listen(PORT, () => {
    console.log('🎙️ ================================');
    console.log('🎙️  223 MEDIA CLIENT PORTAL');
    console.log('🎙️ ================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`📱 Website: http://localhost:${PORT}`);
    console.log(`🔧 Client Portal: http://localhost:${PORT}/portal`);
    console.log(`👑 Admin Panel: http://localhost:${PORT}/admin`);
    console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
    console.log('🎙️ ================================');
    
    // Log integration status
    console.log('🔌 Integration Status:');
    console.log(`   Airtable: ${process.env.AIRTABLE_API_KEY ? '✅' : '❌'}`);
    console.log(`   Stripe: ${process.env.STRIPE_SECRET_KEY ? '✅' : '❌'}`);
    console.log(`   HubSpot: ${process.env.HUBSPOT_ACCESS_TOKEN ? '✅' : '❌'}`);
    console.log(`   Brevo: ${process.env.BREVO_API_KEY ? '✅' : '❌'}`);
    console.log(`   Motion: ${process.env.MOTION_API_KEY ? '✅' : '❌'}`);
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('📴 Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('📴 Server closed');
        process.exit(0);
    });
});

// ================================================================
// MODULE EXPORTS (for testing)
// ================================================================

module.exports = app; ================================================================
// 223 MEDIA CLIENT PORTAL SERVER
// Main backend server for client portal integration
// ================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// ================================================================
// ENVIRONMENT & CONFIGURATION
// ================================================================

require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ================================================================
// MIDDLEWARE SETUP
// ================================================================

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://api.stripe.com"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: NODE_ENV === 'production' 
        ? ['https://2twenty3media.com', 'https://www.2twenty3media.com']
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================================================================
// STATIC FILE SERVING
// ================================================================

// Serve existing website files
app.use(express.static('./', {
    index: 'index.html',
    maxAge: NODE_ENV === 'production' ? '1d' : 0
}));

// Serve portal-specific assets
app.use('/portal', express.static('./portal', {
    maxAge: NODE_ENV === 'production' ? '1h' : 0
}));

// ================================================================
// LOGGING MIDDLEWARE
// ================================================================

app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;
    const ip = req.ip || req.connection.remoteAddress;
    
    console.log(`🔗 ${timestamp} | ${method} ${url} | IP: ${ip}`);
    
    // Log API requests with more detail
    if (req.url.startsWith('/api/')) {
        console.log(`📊 API Request: ${method} ${url}`, {
            headers: req.headers['user-agent'],
            body: method === 'POST' ? Object.keys(req.body) : null
        });
    }
    
    next();
});

// ================================================================
// API ROUTES (Portal Backend)
// ================================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: '223 Media Client Portal',
        version: '1.0.0',
        environment: NODE_ENV
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        server: 'online',
        integrations: {
            airtable: process.env.AIRTABLE_API_KEY ? 'configured' : 'missing',
            stripe: process.env.STRIPE_SECRET_KEY ? 'configured' : 'missing',
            hubspot: process.env.HUBSPOT_ACCESS_TOKEN ? 'configured' : 'missing',
            brevo: process.env.BREVO_API_KEY ? 'configured' : 'missing',
            motion: process.env.MOTION_API_KEY ? 'configured' : 'missing'
        },
        timestamp: new Date().toISOString()
    });
});

//
