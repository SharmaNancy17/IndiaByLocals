// API Configuration Template
// Copy this file to config.js and add your actual API keys
// config.js is in .gitignore and will not be committed to GitHub

const CONFIG = {
    // Open-Meteo API - Completely FREE, no API key needed!
    // https://open-meteo.com/
    WEATHER_API_URL: 'https://api.open-meteo.com/v1/forecast',
    GEOCODING_API_URL: 'https://geocoding-api.open-meteo.com/v1/search',
    
    // NewsAPI.org - Free tier: 100 requests/day
    // Sign up at: https://newsapi.org/ for API key
    // Get your key from: https://newsapi.org/account
    NEWSAPI_KEY: 'YOUR_NEWSAPI_KEY_HERE',
    NEWSAPI_URL: 'https://newsapi.org/v2/everything',
    
    // Indian News Sources for better local coverage
    INDIAN_NEWS_SOURCES: [
        'the-times-of-india',
        'the-hindu',
        'google-news-in'
    ],
    
    // Reddit OAuth Configuration
    // See REDDIT_OAUTH_SETUP.md for setup instructions
    // Get credentials from: https://www.reddit.com/prefs/apps
    REDDIT_CLIENT_ID: 'YOUR_REDDIT_CLIENT_ID_HERE',
    REDDIT_CLIENT_SECRET: 'YOUR_REDDIT_CLIENT_SECRET_HERE',
    REDDIT_REDIRECT_URI: 'http://localhost:8000/callback',
    REDDIT_USER_AGENT: 'web:explorebypeople:v1.0.0',
    REDDIT_OAUTH_URL: 'https://www.reddit.com/api/v1/authorize',
    REDDIT_TOKEN_URL: 'https://www.reddit.com/api/v1/access_token',
    REDDIT_API_URL: 'https://oauth.reddit.com',
    
    // Reddit fallback (no auth) - Will show 403 errors
    REDDIT_PUBLIC_URL: 'https://www.reddit.com',
    
    // CORS Proxy - For fallback only
    CORS_PROXIES: [
        'https://corsproxy.io/?',
        'https://api.allorigins.win/raw?url='
    ]
};

// Reddit OAuth State
let redditAccessToken = null;
let redditTokenExpiry = null;

// Made with Bob
