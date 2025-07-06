/**
 * ===============================================
 * 223 Media - Main JavaScript File
 * The Content Ecosystem Company
 * ===============================================
 */

// Global variables and state management
const MediaWebsite = {
    // Application state
    state: {
        currentPage: 'home',
        selectedPackage: '',
        maxScrollDepth: 0,
        isPlaying: {},
        portfolioFilter: 'all'
    },
    
    // Configuration
    config: {
        animationDuration: 300,
        scrollThreshold: 0.1,
        autoSaveDelay: 1000,
        audioSampleDuration: 3000
    },
    
    // Initialize the application
    init() {
        this.setupEventListeners();
        this.initializeAnimations();
        this.initializeAnalytics();
        this.loadStoredState();
        console.log('223 Media website initialized successfully');
    }
};

/**
 * ===============================================
 * PAGE NAVIGATION SYSTEM
 * ===============================================
 */

// Show specific page and hide others
function showPage(pageId) {
    try {
        // Hide all pages
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.remove('active');
            page.style.opacity = '0';
        });
        
        // Show selected page with animation
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            setTimeout(() => {
                targetPage.classList.add('active');
                targetPage.style.opacity = '1';
            }, 150);
            
            // Update state
            MediaWebsite.state.currentPage = pageId;
            
            // Analytics tracking
            trackPageView(pageId);
            
            // Scroll to top
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            console.warn(`Page with ID '${pageId}' not found`);
        }
    } catch (error) {
        console.error('Error showing page:', error);
    }
}

// Navigate to onboarding with package pre-selection
function selectPackage(packageName) {
    showPage('onboarding');
    setTimeout(() => {
        selectPackageOption(packageName);
    }, 500);
}

/**
 * ===============================================
 * PACKAGE SELECTION SYSTEM
 * ===============================================
 */

function selectPackageOption(packageName) {
    try {
        // Remove previous selections
        const options = document.querySelectorAll('.package-option');
        options.forEach(option => option.classList.remove('selected'));
        
        // Find and select the clicked option
        const targetOption = Array.from(options).find(option => 
            option.textContent.toLowerCase().includes(packageName.toLowerCase())
        );
        
        if (targetOption) {
            targetOption.classList.add('selected');
            
            // Update hidden input if it exists
            const hiddenInput = document.getElementById('selectedPackage');
            if (hiddenInput) {
                hiddenInput.value = packageName;
            }
            
            // Update global state
            MediaWebsite.state.selectedPackage = packageName;
            
            // Update step indicator
            updateStepIndicator(2);
            
            // Analytics tracking
            trackEvent('package_selected', { package: packageName });
        }
    } catch (error) {
        console.error('Error selecting package:', error);
    }
}

// Update step indicator progress
function updateStepIndicator(activeStep) {
    try {
        const steps = document.querySelectorAll('.step');
        steps.forEach((step, index) => {
            step.classList.remove('active');
            if (index < activeStep) {
                step.classList.add('active');
            }
        });
    } catch (error) {
        console.error('Error updating step indicator:', error);
    }
}

/**
 * ===============================================
 * FORM HANDLING SYSTEM
 * ===============================================
 */

// Handle main onboarding form submission
function handleOnboardingForm(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const data = {};
        
        // Collect form data
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Add metadata
        data.submission_timestamp = new Date().toISOString();
        data.selected_package = MediaWebsite.state.selectedPackage;
        data.page_source = 'onboarding_form';
        
        // Validate required fields
        if (!validateOnboardingForm(data)) {
            return false;
        }
        
        // Submit form data
        submitOnboardingForm(data);
        
        // Update UI
        updateStepIndicator(4);
        showSuccessMessage('onboarding');
        
        // Analytics tracking
        trackEvent('form_submitted', { form_type: 'onboarding', package: data.package });
        
    } catch (error) {
        console.error('Error handling onboarding form:', error);
        showErrorMessage('An error occurred. Please try again.');
    }
}

// Handle blueprint download form
function handleBlueprintForm(event) {
    event.preventDefault();
    
    try {
        const formData = new FormData(event.target);
        const data = {};
        
        formData.forEach((value, key) => {
            data[key] = value;
        });
        
        // Add lead magnet tracking
        data.lead_source = 'content_ecosystem_blueprint';
        data.download_timestamp = new Date().toISOString();
        data.page_source = 'lead_magnet';
        
        // Submit lead magnet form
        submitBlueprintForm(data);
        
        // Show success and trigger download
        showSuccessMessage('blueprint');
        triggerBlueprintDownload();
        
        // Analytics tracking
        trackEvent('lead_magnet_downloaded', { source: 'blueprint', status: data.podcast_status });
        
    } catch (error) {
        console.error('Error handling blueprint form:', error);
        showErrorMessage('Download failed. Please try again.');
    }
}

// Form validation
function validateOnboardingForm(data) {
    const requiredFields = ['name', 'email', 'company'];
    const missingFields = requiredFields.filter(field => !data[field] || data[field].trim() === '');
    
    if (missingFields.length > 0) {
        showErrorMessage(`Please fill in: ${missingFields.join(', ')}`);
        return false;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showErrorMessage('Please enter a valid email address');
        return false;
    }
    
    // Package selection validation
    if (!data.package && !MediaWebsite.state.selectedPackage) {
        showErrorMessage('Please select a package');
        return false;
    }
    
    return true;
}

// Form submission functions
function submitOnboardingForm(data) {
    console.log('Onboarding form submitted:', data);
    
    // In production, this would:
    // 1. Submit to JotForms API
    // 2. Trigger Ontraport automation
    // 3. Create Usemotion project
    // 4. Set up HubSpot tracking
    // 5. Send calendar booking link
    
    // Simulate backend integration
    setTimeout(() => {
        console.log('Backend integration completed');
    }, 1000);
}

function submitBlueprintForm(data) {
    console.log('Blueprint form submitted:', data);
    
    // In production, this would:
    // 1. Submit to JotForms with lead magnet tag
    // 2. Trigger Ontraport automation sequence
    // 3. Send download link via email
    // 4. Track conversion in HubSpot
    // 5. Add to nurture sequence
}

function triggerBlueprintDownload() {
    // Simulate download (in real implementation, this would be an email link)
    setTimeout(() => {
        const downloadUrl = 'data:text/plain;charset=utf-8,Content Ecosystem Blueprint - This would be the actual PDF download link in production';
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'Content-Ecosystem-Blueprint.pdf';
        link.click();
    }, 1000);
}

/**
 * ===============================================
 * PORTFOLIO FILTERING SYSTEM
 * ===============================================
 */

function filterPortfolio(category) {
    try {
        const items = document.querySelectorAll('.portfolio-item');
        const tabs = document.querySelectorAll('.filter-tab');
        
        // Update active tab
        tabs.forEach(tab => tab.classList.remove('active'));
        if (event && event.target) {
            event.target.classList.add('active');
        }
        
        // Update state
        MediaWebsite.state.portfolioFilter = category;
        
        // Filter items with animation
        items.forEach((item, index) => {
            const shouldShow = category === 'all' || item.dataset.category === category;
            
            if (shouldShow) {
                item.style.display = 'block';
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 50); // Staggered animation
            } else {
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';
                setTimeout(() => {
                    item.style.display = 'none';
                }, MediaWebsite.config.animationDuration);
            }
        });
        
        // Analytics tracking
        trackEvent('portfolio_filtered', { category: category });
        
    } catch (error) {
        console.error('Error filtering portfolio:', error);
    }
}

/**
 * ===============================================
 * PROJECT VIEWING SYSTEM
 * ===============================================
 */

function viewProject(projectId) {
    try {
        console.log('Viewing project:', projectId);
        
        // In production, this would:
        // 1. Open a modal with detailed case study
        // 2. Navigate to a dedicated project page
        // 3. Show live site preview
        // 4. Display additional metrics and testimonials
        
        // For now, show alert (replace with modal in production)
        const projectData = getProjectData(projectId);
        showProjectModal(projectData);
        
        // Analytics tracking
        trackEvent('project_viewed', { project_id: projectId });
        
    } catch (error) {
        console.error('Error viewing project:', error);
    }
}

function getProjectData(projectId) {
    // Mock project data - in production, this would come from a CMS or API
    const projects = {
        'sarah-real-estate': {
            title: 'Sarah\'s Real Estate Empire',
            description: 'Complete digital transformation for a real estate professional',
            results: ['400% traffic increase', '8,500 new subscribers', '$47K revenue boost'],
            timeline: '6 months',
            services: ['Podcast Production', 'Website Development', 'SEO Integration']
        },
        'techconsult-platform': {
            title: 'TechConsult Pro Platform',
            description: 'Enterprise consulting platform with client portal',
            results: ['89% conversion rate', '2.3s load time', '245% lead quality'],
            timeline: '4 months',
            services: ['Website Development', 'Client Portal', 'Analytics Integration']
        }
        // Add more projects as needed
    };
    
    return projects[projectId] || { title: 'Project Details', description: 'Loading project information...' };
}

function showProjectModal(projectData) {
    // Create and show modal (simplified version)
    alert(`${projectData.title}\n\n${projectData.description}\n\nIn production, this would show a detailed modal with:\n- Live site preview\n- Detailed case study\n- Client testimonials\n- Additional metrics`);
}

/**
 * ===============================================
 * AUDIO PLAYER SYSTEM
 * ===============================================
 */

function playAudio(sampleId) {
    try {
        const button = event.target;
        const isCurrentlyPlaying = MediaWebsite.state.isPlaying[sampleId];
        
        // Stop all other audio first
        stopAllAudio();
        
        if (!isCurrentlyPlaying) {
            // Start playing
            button.textContent = '⏸';
            button.style.background = '#44ff44';
            MediaWebsite.state.isPlaying[sampleId] = true;
            
            // In production, this would actually play the audio file
            console.log(`Playing audio sample: ${sampleId}`);
            
            // Simulate playing for specified duration
            setTimeout(() => {
                stopAudio(sampleId, button);
            }, MediaWebsite.config.audioSampleDuration);
            
            // Analytics tracking
            trackEvent('audio_played', { sample_id: sampleId });
        } else {
            // Stop playing
            stopAudio(sampleId, button);
        }
        
    } catch (error) {
        console.error('Error playing audio:', error);
    }
}

function stopAudio(sampleId, button) {
    if (button) {
        button.textContent = '▶';
        button.style.background = '#f17000';
    }
    MediaWebsite.state.isPlaying[sampleId] = false;
}

function stopAllAudio() {
    Object.keys(MediaWebsite.state.isPlaying).forEach(sampleId => {
        if (MediaWebsite.state.isPlaying[sampleId]) {
            const button = document.querySelector(`[onclick="playAudio('${sampleId}')"]`);
            stopAudio(sampleId, button);
        }
    });
}

/**
 * ===============================================
 * ANIMATION SYSTEM
 * ===============================================
 */

function initializeAnimations() {
    // Intersection Observer for scroll animations
    const observerOptions = {
        threshold: MediaWebsite.config.scrollThreshold,
        rootMargin: '0px 0px -100px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll animations
    const animatedElements = document.querySelectorAll('.portfolio-item, .package-card, .advantage-card');
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
}

/**
 * ===============================================
 * ANALYTICS & TRACKING
 * ===============================================
 */

function initializeAnalytics() {
    // Track scroll depth
    window.addEventListener('scroll', throttle(() => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        if (scrollPercent > MediaWebsite.state.maxScrollDepth) {
            MediaWebsite.state.maxScrollDepth = scrollPercent;
            
            // Track milestone scroll depths
            if (scrollPercent % 25 === 0 && scrollPercent > 0) {
                trackEvent('scroll_depth', { depth: scrollPercent });
            }
        }
    }, 250));
    
    // Track time on page
    const startTime = Date.now();
    window.addEventListener('beforeunload', () => {
        const timeOnPage = Math.round((Date.now() - startTime) / 1000);
        trackEvent('time_on_page', { duration: timeOnPage, page: MediaWebsite.state.currentPage });
    });
}

function trackPageView(pageId) {
    console.log(`Page view: ${pageId}`);
    // In production, send to Google Analytics, HubSpot, etc.
}

function trackEvent(eventName, properties = {}) {
    console.log(`Event: ${eventName}`, properties);
    // In production, send to analytics platforms
}

/**
 * ===============================================
 * USER FEEDBACK SYSTEM
 * ===============================================
 */

function showSuccessMessage(type) {
    const messages = {
        'onboarding': 'Success! Your ecosystem setup is starting. Check your email for next steps and calendar booking link.',
        'blueprint': 'Success! Check your email for the Content Ecosystem Blueprint download link.',
        'contact': 'Thank you! We\'ll be in touch within 24 hours.'
    };
    
    const message = messages[type] || 'Success! Your request has been submitted.';
    
    // Create and show success notification
    showNotification(message, 'success');
}

function showErrorMessage(message) {
    showNotification(message, 'error');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 10px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        background: ${type === 'success' ? '#44ff44' : type === 'error' ? '#ff4444' : '#f17000'};
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 5000);
}

/**
 * ===============================================
 * UTILITY FUNCTIONS
 * ===============================================
 */

// Throttle function for performance optimization
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Debounce function for performance optimization
function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Local storage helpers
function saveToStorage(key, data) {
    try {
        localStorage.setItem(`223media_${key}`, JSON.stringify(data));
    } catch (error) {
        console.warn('Could not save to localStorage:', error);
    }
}

function loadFromStorage(key) {
    try {
        const data = localStorage.getItem(`223media_${key}`);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.warn('Could not load from localStorage:', error);
        return null;
    }
}

function loadStoredState() {
    const savedState = loadFromStorage('state');
    if (savedState) {
        Object.assign(MediaWebsite.state, savedState);
    }
}

function saveCurrentState() {
    saveToStorage('state', MediaWebsite.state);
}

/**
 * ===============================================
 * MOBILE MENU SYSTEM
 * ===============================================
 */

function initializeMobileMenu() {
    const menuToggle = document.createElement('button');
    menuToggle.className = 'mobile-menu-toggle';
    menuToggle.innerHTML = '☰';
    menuToggle.style.cssText = `
        display: none;
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 10px;
    `;
    
    // Add to navigation
    const navContainer = document.querySelector('.nav-container, .header-content');
    if (navContainer) {
        navContainer.appendChild(menuToggle);
    }
    
    // Mobile menu functionality
    menuToggle.addEventListener('click', toggleMobileMenu);
    
    // Show/hide based on screen size
    window.addEventListener('resize', updateMobileMenu);
    updateMobileMenu();
}

function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '100%';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.background = 'rgba(0, 0, 0, 0.9)';
        navLinks.style.padding = '20px';
    }
}

function updateMobileMenu() {
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (window.innerWidth <= 768) {
        if (menuToggle) menuToggle.style.display = 'block';
        if (navLinks) navLinks.style.display = 'none';
    } else {
        if (menuToggle) menuToggle.style.display = 'none';
        if (navLinks) {
            navLinks.style.display = 'flex';
            navLinks.style.position = 'static';
            navLinks.style.flexDirection = 'row';
            navLinks.style.background = 'none';
        }
    }
}

/**
 * ===============================================
 * EVENT LISTENERS SETUP
 * ===============================================
 */

MediaWebsite.setupEventListeners = function() {
    // Form submissions
    const onboardingForm = document.getElementById('onboardingForm');
    if (onboardingForm) {
        onboardingForm.addEventListener('submit', handleOnboardingForm);
    }
    
    const blueprintForm = document.getElementById('blueprintForm');
    if (blueprintForm) {
        blueprintForm.addEventListener('submit', handleBlueprintForm);
    }
    
    // Auto-save form data
    const formInputs = document.querySelectorAll('.form-input, .form-select, .form-textarea');
    formInputs.forEach(input => {
        input.addEventListener('input', debounce(() => {
            saveCurrentState();
        }, MediaWebsite.config.autoSaveDelay));
    });
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Close any open modals or menus
            const mobileNav = document.querySelector('.nav-links');
            if (mobileNav && window.innerWidth <= 768) {
                mobileNav.style.display = 'none';
            }
        }
    });
    
    // Save state before page unload
    window.addEventListener('beforeunload', saveCurrentState);
};

/**
 * ===============================================
 * INITIALIZATION
 * ===============================================
 */

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    MediaWebsite.init();
});

// Handle page load
window.addEventListener('load', () => {
    // Hide loading spinner if present
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.style.display = 'none';
    }
    
    // Initialize any remaining components
    console.log('223 Media website fully loaded');
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MediaWebsite;
}
