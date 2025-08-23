// ================================================================
// 223 MEDIA CLIENT PORTAL SERVER - FIXED ROUTING
// Main backend server for client portal integration
// ================================================================

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ================================================================
// SECURITY MIDDLEWARE
// ================================================================

// Basic security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
            mediaSrc: ["'self'", "https:"],
        },
    },
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://2twenty3media.com', 'https://www.2twenty3media.com']
        : true,
    credentials: true
}));

// Request parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// ================================================================
// STATIC FILE SERVING
// ================================================================

// Serve static assets
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/examples', express.static(path.join(__dirname, 'examples')));

// ================================================================
// MAIN WEBSITE ROUTES
// ================================================================

// Serve main website
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ================================================================
// PORTAL ROUTES - FIXED
// ================================================================

// Serve client portal
app.get('/portal', (req, res) => {
    const portalPath = path.join(__dirname, 'portal.html');
    if (fs.existsSync(portalPath)) {
        res.sendFile(portalPath);
    } else {
        res.status(404).send(`
            <h1>Portal Not Found</h1>
            <p>The portal.html file is missing. Please ensure it exists in the root directory.</p>
            <p>Looking for: ${portalPath}</p>
            <a href="/">← Back to Homepage</a>
        `);
    }
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    const adminPath = path.join(__dirname, 'admin.html');
    if (fs.existsSync(adminPath)) {
        res.sendFile(adminPath);
    } else {
        res.status(404).send(`
            <h1>Admin Dashboard Not Found</h1>
            <p>The admin.html file is missing. Please ensure it exists in the root directory.</p>
            <p>Looking for: ${adminPath}</p>
            <a href="/">← Back to Homepage</a>
        `);
    }
});

// ================================================================
// LEGAL PAGES
// ================================================================

// Privacy Policy
app.get('/privacy.html', (req, res) => {
    const privacyPath = path.join(__dirname, 'privacy.html');
    if (fs.existsSync(privacyPath)) {
        res.sendFile(privacyPath);
    } else {
        res.redirect('/');
    }
});

// Terms & Conditions
app.get('/terms.html', (req, res) => {
    const termsPath = path.join(__dirname, 'terms.html');
    if (fs.existsSync(termsPath)) {
        res.sendFile(termsPath);
    } else {
        res.redirect('/');
    }
});

// ================================================================
// API ROUTES PLACEHOLDER
// ================================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: '223 Media Portal',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API status endpoint
app.get('/api/status', (req, res) => {
    res.json({
        message: '223 Media API is running',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        features: {
            portal: fs.existsSync(path.join(__dirname, 'portal.html')),
            admin: fs.existsSync(path.join(__dirname, 'admin.html')),
            privacy: fs.existsSync(path.join(__dirname, 'privacy.html')),
            terms: fs.existsSync(path.join(__dirname, 'terms.html'))
        }
    });
});

// Future API routes will be mounted here
app.use('/api/auth', (req, res) => {
    res.status(501).json({ 
        message: 'Authentication API coming soon',
        endpoint: req.path 
    });
});

app.use('/api/client', (req, res) => {
    res.status(501).json({ 
        message: 'Client portal API coming soon',
        endpoint: req.path 
    });
});

app.use('/api/admin', (req, res) => {
    res.status(501).json({ 
        message: 'Admin API coming soon',
        endpoint: req.path 
    });
});

// ================================================================
// ERROR HANDLING
// ================================================================

// 404 handler for unknown routes
app.use((req, res) => {
    // If it's an API request, return JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            error: 'API endpoint not found',
            path: req.path,
            method: req.method
        });
    }
