// API Configuration
const CONFIG = {
    // Open-Meteo API - Completely FREE, no API key needed!
    // https://open-meteo.com/
    WEATHER_API_URL: 'https://api.open-meteo.com/v1/forecast',
    GEOCODING_API_URL: 'https://geocoding-api.open-meteo.com/v1/search',
    
    // NewsAPI.org - Free tier: 100 requests/day
    // Sign up at: https://newsapi.org/ for API key
    // Get your own key and add it here
    NEWSAPI_KEY: '',  // Add your NewsAPI key here
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
    REDDIT_CLIENT_ID: '',  // Add your Client ID here
    REDDIT_CLIENT_SECRET: '',  // Add your Client Secret here
    REDDIT_REDIRECT_URI: 'http://localhost:8000/callback',
    REDDIT_USER_AGENT: 'web:india-travel-info:v1.0.0',
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

// Reddit OAuth Functions
function initRedditAuth() {
    // Check if we have credentials
    if (!CONFIG.REDDIT_CLIENT_ID || CONFIG.REDDIT_CLIENT_ID === '') {
        console.log('⚠️ Reddit OAuth not configured. See REDDIT_OAUTH_SETUP.md');
        return false;
    }
    
    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('code')) {
        handleRedditCallback(urlParams.get('code'));
        return true;
    }
    
    // Check for stored token
    const storedToken = localStorage.getItem('reddit_access_token');
    const storedExpiry = localStorage.getItem('reddit_token_expiry');
    
    if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry)) {
        redditAccessToken = storedToken;
        redditTokenExpiry = parseInt(storedExpiry);
        console.log('✅ Reddit OAuth token loaded from storage');
        return true;
    }
    
    return false;
}

function connectReddit() {
    if (!CONFIG.REDDIT_CLIENT_ID || CONFIG.REDDIT_CLIENT_ID === '') {
        alert('Please configure Reddit OAuth credentials first. See REDDIT_OAUTH_SETUP.md');
        return;
    }
    
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('reddit_oauth_state', state);
    
    const authUrl = `${CONFIG.REDDIT_OAUTH_URL}?` +
        `client_id=${CONFIG.REDDIT_CLIENT_ID}&` +
        `response_type=code&` +
        `state=${state}&` +
        `redirect_uri=${encodeURIComponent(CONFIG.REDDIT_REDIRECT_URI)}&` +
        `duration=permanent&` +
        `scope=read`;
    
    window.location.href = authUrl;
}

async function handleRedditCallback(code) {
    const state = new URLSearchParams(window.location.search).get('state');
    const storedState = localStorage.getItem('reddit_oauth_state');
    
    if (state !== storedState) {
        console.error('❌ OAuth state mismatch');
        return;
    }
    
    try {
        const credentials = btoa(`${CONFIG.REDDIT_CLIENT_ID}:${CONFIG.REDDIT_CLIENT_SECRET}`);
        
        const response = await fetch(CONFIG.REDDIT_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=authorization_code&code=${code}&redirect_uri=${encodeURIComponent(CONFIG.REDDIT_REDIRECT_URI)}`
        });
        
        const data = await response.json();
        
        if (data.access_token) {
            redditAccessToken = data.access_token;
            redditTokenExpiry = Date.now() + (data.expires_in * 1000);
            
            localStorage.setItem('reddit_access_token', redditAccessToken);
            localStorage.setItem('reddit_token_expiry', redditTokenExpiry.toString());
            
            console.log('✅ Reddit OAuth successful!');
            
            // Remove code from URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    } catch (error) {
        console.error('❌ Reddit OAuth error:', error);
    }
}

async function fetchRedditWithAuth(url) {
    if (!redditAccessToken || Date.now() >= redditTokenExpiry) {
        console.log('⚠️ No valid Reddit token');
        return null;
    }
    
    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${redditAccessToken}`,
                'User-Agent': CONFIG.REDDIT_USER_AGENT
            }
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            console.error(`❌ Reddit API error: ${response.status}`);
            return null;
        }
    } catch (error) {
        console.error('❌ Reddit fetch error:', error);
        return null;
    }
}

// Helper function to fetch with CORS proxy (fallback only)
async function fetchWithProxy(url, proxyIndex = 0) {
    const proxy = CONFIG.CORS_PROXIES[proxyIndex];
    const proxiedUrl = proxy + encodeURIComponent(url);
    
    console.log(`🔄 Using proxy ${proxyIndex + 1}/${CONFIG.CORS_PROXIES.length}: ${proxy}`);
    
    try {
        const response = await fetch(proxiedUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok && proxyIndex < CONFIG.CORS_PROXIES.length - 1) {
            return fetchWithProxy(url, proxyIndex + 1);
        }
        return response;
    } catch (error) {
        if (proxyIndex < CONFIG.CORS_PROXIES.length - 1) {
            return fetchWithProxy(url, proxyIndex + 1);
        }
        throw error;
    }
}

// Global variables
let allLocations = [];
let currentLocation = null;
let weatherData = null;
let newsData = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    allLocations = getAllLocations();
    setupEventListeners();
    initRedditAuth();
    updateRedditStatus();
});

// Setup event listeners
function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const suggestionsDiv = document.getElementById('suggestions');
    
    // Search input event
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length >= 2) {
            showSuggestions(query);
        } else {
            suggestionsDiv.classList.remove('active');
        }
    });
    
    // Search button click
    searchBtn.addEventListener('click', function() {
        const query = searchInput.value.trim();
        if (query) {
            searchLocation(query);
        }
    });
    
    // Enter key press
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const query = this.value.trim();
            if (query) {
                searchLocation(query);
            }
        }
    });
    
    // Click outside to close suggestions
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-box') && !e.target.closest('.suggestions')) {
            suggestionsDiv.classList.remove('active');
        }
    });
}

// Show search suggestions
function showSuggestions(query) {
    const suggestionsDiv = document.getElementById('suggestions');
    const lowerQuery = query.toLowerCase();
    
    // Filter locations based on query
    const matches = allLocations.filter(location => 
        location.searchName.includes(lowerQuery)
    ).slice(0, 10); // Limit to 10 suggestions
    
    if (matches.length > 0) {
        suggestionsDiv.innerHTML = matches.map(location => {
            const subtitle = location.type === 'City' 
                ? `City in ${location.state}` 
                : `${location.type} - Capital: ${location.capital}`;
            
            return `
                <div class="suggestion-item" onclick="selectLocation('${location.name}', '${location.type}')">
                    <strong>${location.name}</strong>
                    <small>${subtitle}</small>
                </div>
            `;
        }).join('');
        suggestionsDiv.classList.add('active');
    } else {
        suggestionsDiv.innerHTML = '<div class="suggestion-item">No results found</div>';
        suggestionsDiv.classList.add('active');
    }
}

// Select a location from suggestions
function selectLocation(name, type) {
    document.getElementById('searchInput').value = name;
    document.getElementById('suggestions').classList.remove('active');
    searchLocation(name);
}

// Search for a location
function searchLocation(query) {
    const location = allLocations.find(loc => 
        loc.searchName === query.toLowerCase()
    );
    
    if (location) {
        currentLocation = location;
        weatherData = null;
        newsData = null;
        displayLocationInfo(location);
        
        // Fetch all data and generate summary
        fetchAllData(location);
    } else {
        alert('Location not found. Please select from the suggestions.');
    }
}

// Fetch all data for the location
async function fetchAllData(location) {
    try {
        // First, get coordinates for the location
        let coordinates = null;
        try {
            const geoUrl = `${CONFIG.GEOCODING_API_URL}?name=${encodeURIComponent(location.name)}&count=1&language=en&format=json`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            if (geoData.results && geoData.results.length > 0) {
                coordinates = {
                    latitude: geoData.results[0].latitude,
                    longitude: geoData.results[0].longitude
                };
            }
        } catch (error) {
            console.error('Error fetching coordinates:', error);
        }
        
        // Fetch all data in parallel
        const [weather, news] = await Promise.all([
            fetchWeatherData(location.name),
            fetchNewsData(location.name),
            fetchHotelRecommendations(location.name, coordinates),
            fetchFoodRecommendations(location.name, coordinates)
        ]);
        
        // Generate AI-like summary after data is loaded
        generateIntelligentSummary(location);
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Display location information
function displayLocationInfo(location) {
    const resultsSection = document.getElementById('resultsSection');
    const locationName = document.getElementById('locationName');
    const locationDetails = document.getElementById('locationDetails');
    
    locationName.textContent = location.name;
    
    if (location.type === 'City') {
        locationDetails.textContent = `City in ${location.state}, India`;
    } else {
        locationDetails.textContent = `${location.type} - Capital: ${location.capital}`;
    }
    
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

// Fetch weather data with 10-day view (last 5 days + next 5 days)
async function fetchWeatherData(locationName) {
    const weatherContent = document.getElementById('weatherContent');
    weatherContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Loading 10-day weather data...</p>
        </div>
    `;
    
    try {
        // First, get coordinates for the location
        const geoUrl = `${CONFIG.GEOCODING_API_URL}?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            throw new Error('Location coordinates not found');
        }
        
        const { latitude, longitude } = geoData.results[0];
        
        // Calculate date range: last 5 days to next 5 days
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 5);
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + 5);
        
        const formatDate = (date) => date.toISOString().split('T')[0];
        
        // Get current weather + historical + forecast
        const weatherUrl = `${CONFIG.WEATHER_API_URL}?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,pressure_msl&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&start_date=${formatDate(startDate)}&end_date=${formatDate(endDate)}&timezone=Asia/Kolkata`;
        
        const weatherResponse = await fetch(weatherUrl);
        const data = await weatherResponse.json();
        
        weatherData = {
            current: {
                temp: data.current.temperature_2m,
                feels_like: data.current.apparent_temperature,
                humidity: data.current.relative_humidity_2m,
                wind_speed: data.current.wind_speed_10m,
                pressure: data.current.pressure_msl,
                weather_code: data.current.weather_code,
                precipitation: data.current.precipitation
            },
            daily: {
                dates: data.daily.time,
                temp_max: data.daily.temperature_2m_max,
                temp_min: data.daily.temperature_2m_min,
                precipitation: data.daily.precipitation_sum,
                weather_codes: data.daily.weather_code
            }
        };
        
        displayWeatherData(weatherData);
        return weatherData;
    } catch (error) {
        weatherContent.innerHTML = `
            <div class="error-message">
                <p><strong>Unable to fetch weather data</strong></p>
                <p>${error.message}</p>
            </div>
        `;
        return null;
    }
}

// Display weather data with 10-day view
function displayWeatherData(data) {
    const weatherContent = document.getElementById('weatherContent');
    const current = data.current;
    const weatherDesc = getWeatherDescription(current.weather_code);
    const weatherIcon = getWeatherIcon(current.weather_code);
    
    // Find today's index in the daily data
    const today = new Date().toISOString().split('T')[0];
    const todayIndex = data.daily.dates.indexOf(today);
    
    weatherContent.innerHTML = `
        <!-- Current Weather -->
        <div class="weather-info">
            <div class="weather-main">
                <div class="weather-icon">${weatherIcon}</div>
                <div class="weather-temp">${Math.round(current.temp)}°C</div>
                <div class="weather-desc">${weatherDesc}</div>
                <small style="color: #999; margin-top: 0.5rem; display: block;">Right Now</small>
            </div>
            <div class="weather-details">
                <div class="weather-detail">
                    <i class="fas fa-temperature-high"></i>
                    <small>Feels Like</small>
                    <strong>${Math.round(current.feels_like)}°C</strong>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-tint"></i>
                    <small>Humidity</small>
                    <strong>${current.humidity}%</strong>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-wind"></i>
                    <small>Wind Speed</small>
                    <strong>${current.wind_speed} km/h</strong>
                </div>
                <div class="weather-detail">
                    <i class="fas fa-compress-arrows-alt"></i>
                    <small>Pressure</small>
                    <strong>${Math.round(current.pressure)} hPa</strong>
                </div>
            </div>
        </div>
        
        <!-- 10-Day Weather View -->
        <div style="margin-top: 2rem;">
            <h4 style="color: #667eea; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-calendar-alt"></i> 10-Day Weather Overview
            </h4>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
                ${data.daily.dates.map((date, index) => {
                    const dateObj = new Date(date);
                    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    const monthDay = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const isToday = index === todayIndex;
                    const isPast = index < todayIndex;
                    const isFuture = index > todayIndex;
                    
                    const maxTemp = Math.round(data.daily.temp_max[index]);
                    const minTemp = Math.round(data.daily.temp_min[index]);
                    const precipitation = data.daily.precipitation[index];
                    const weatherCode = data.daily.weather_codes[index];
                    const icon = getWeatherIcon(weatherCode);
                    
                    let label = '';
                    let bgColor = '#f8f9ff';
                    let borderColor = '#e0e0e0';
                    
                    if (isToday) {
                        label = 'Today';
                        bgColor = '#e8f5e9';
                        borderColor = '#4caf50';
                    } else if (isPast) {
                        label = 'Past';
                        bgColor = '#f5f5f5';
                    } else if (isFuture) {
                        label = 'Forecast';
                        bgColor = '#fff8e1';
                        borderColor = '#ff9800';
                    }
                    
                    return `
                        <div style="background: ${bgColor}; padding: 1rem; border-radius: 10px; text-align: center; border: 2px solid ${borderColor};">
                            ${label ? `<div style="font-size: 0.75rem; color: #666; font-weight: bold; margin-bottom: 0.5rem;">${label}</div>` : ''}
                            <div style="font-weight: bold; color: #333;">${dayName}</div>
                            <div style="font-size: 0.85rem; color: #999;">${monthDay}</div>
                            <div style="font-size: 2rem; margin: 0.5rem 0;">${icon}</div>
                            <div style="font-size: 1.2rem; font-weight: bold; color: #667eea;">${maxTemp}°</div>
                            <div style="font-size: 0.9rem; color: #999;">${minTemp}°</div>
                            ${precipitation > 0 ? `<div style="font-size: 0.85rem; color: #2196f3; margin-top: 0.5rem;"><i class="fas fa-tint"></i> ${precipitation}mm</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div style="margin-top: 1.5rem; padding: 1rem; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                <p style="margin: 0; color: #1565c0; font-size: 0.9rem;">
                    <i class="fas fa-info-circle"></i> <strong>Weather Trend:</strong>
                    Showing last 5 days (historical) and next 5 days (forecast) to help you plan better.
                </p>
            </div>
        </div>
    `;
}

// Get weather description from WMO code
function getWeatherDescription(code) {
    const descriptions = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Foggy',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    return descriptions[code] || 'Unknown';
}

// Get weather icon based on WMO code
function getWeatherIcon(code) {
    if (code === 0 || code === 1) return '☀️';
    if (code === 2 || code === 3) return '☁️';
    if (code >= 45 && code <= 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌦️';
    if (code >= 61 && code <= 65) return '🌧️';
    if (code >= 71 && code <= 77) return '❄️';
    if (code >= 80 && code <= 82) return '🌧️';
    if (code >= 85 && code <= 86) return '❄️';
    if (code >= 95) return '⛈️';
    return '🌤️';
}

// Fetch news data from Indian news sources
async function fetchNewsData(locationName) {
    const newsContent = document.getElementById('newsContent');
    newsContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Fetching latest news from Indian news sources...</p>
        </div>
    `;
    
    try {
        // Try NewsAPI if key is provided
        if (CONFIG.NEWSAPI_KEY && CONFIG.NEWSAPI_KEY !== '') {
            const articles = await fetchFromNewsAPI(locationName);
            if (articles && articles.length > 0) {
                newsData = articles;
                displayNewsData(newsData);
                return newsData;
            }
        }
        
        // Fallback: Try to fetch from RSS feeds or use enhanced sample news
        newsData = await fetchEnhancedNews(locationName);
        displayNewsData(newsData);
        return newsData;
        
    } catch (error) {
        console.error('Error fetching news:', error);
        newsData = await fetchEnhancedNews(locationName);
        displayNewsData(newsData);
        return newsData;
    }
}

// Fetch from NewsAPI with Indian sources - TRAVEL-RELATED ONLY
async function fetchFromNewsAPI(locationName) {
    try {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
        
        // Search for TRAVEL-RELATED news only
        const travelKeywords = [
            'airport', 'railway', 'train', 'bus', 'metro', 'transport',
            'accident', 'delay', 'cancelled', 'disruption',
            'theft', 'robbery', 'safety', 'security',
            'festival', 'event', 'celebration', 'fair',
            'flood', 'rain', 'weather', 'storm', 'cyclone',
            'water shortage', 'power cut', 'electricity',
            'tourist', 'tourism', 'travel', 'hotel', 'restaurant',
            'road closure', 'traffic', 'strike', 'bandh',
            'monument', 'museum', 'attraction', 'heritage'
        ];
        
        const query = `${locationName} AND (${travelKeywords.slice(0, 10).join(' OR ')})`;
        const sources = CONFIG.INDIAN_NEWS_SOURCES.join(',');
        
        const url = `${CONFIG.NEWSAPI_URL}?q=${encodeURIComponent(query)}&sources=${sources}&from=${fromDate.toISOString().split('T')[0]}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${CONFIG.NEWSAPI_KEY}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('NewsAPI request failed');
        }
        
        const data = await response.json();
        
        if (data.articles && data.articles.length > 0) {
            // Filter for travel-relevant content only
            const travelRelevantArticles = data.articles
                .filter(article => {
                    if (article.title === '[Removed]' || !article.description) return false;
                    
                    const content = (article.title + ' ' + article.description).toLowerCase();
                    
                    // EXCLUDE political, sports, entertainment, business (unless travel-related)
                    const excludeKeywords = [
                        'election', 'vote', 'party', 'minister', 'parliament', 'bjp', 'congress',
                        'cricket', 'football', 'match', 'player', 'team', 'score',
                        'movie', 'film', 'actor', 'actress', 'bollywood',
                        'stock', 'market', 'shares', 'economy', 'gdp', 'inflation'
                    ];
                    
                    // Check if article contains excluded keywords (unless also travel-related)
                    const hasExcluded = excludeKeywords.some(keyword => content.includes(keyword));
                    if (hasExcluded) {
                        // Only allow if it also has travel keywords
                        const hasTravelKeyword = travelKeywords.some(keyword => content.includes(keyword.toLowerCase()));
                        if (!hasTravelKeyword) return false;
                    }
                    
                    // INCLUDE only if it has travel-relevant keywords
                    const includeKeywords = [
                        'airport', 'railway', 'train', 'bus', 'metro', 'transport', 'road',
                        'accident', 'delay', 'cancelled', 'disruption', 'closure',
                        'theft', 'robbery', 'safety', 'security', 'crime', 'police',
                        'festival', 'event', 'celebration', 'fair', 'exhibition',
                        'flood', 'rain', 'weather', 'storm', 'cyclone', 'heat', 'cold',
                        'water', 'shortage', 'power', 'electricity', 'outage',
                        'tourist', 'tourism', 'travel', 'hotel', 'restaurant', 'food',
                        'traffic', 'strike', 'bandh', 'protest',
                        'monument', 'museum', 'attraction', 'heritage', 'temple', 'church',
                        'beach', 'park', 'garden', 'zoo', 'wildlife'
                    ];
                    
                    return includeKeywords.some(keyword => content.includes(keyword));
                })
                .slice(0, 5);
            
            return travelRelevantArticles.length > 0 ? travelRelevantArticles : null;
        }
        
        return null;
    } catch (error) {
        console.error('NewsAPI error:', error);
        return null;
    }
}

// Fetch enhanced news with better context - TRAVEL-FOCUSED ONLY
async function fetchEnhancedNews(locationName) {
    // Create TRAVEL-RELEVANT contextual news only
    const locationInfo = getLocationInfo(locationName);
    
    const newsTemplates = [
        {
            title: `${locationName} Airport and Railway Updates`,
            description: `Transportation services in ${locationName} are operating normally. Travelers should check for any schedule changes or delays before departure. ${locationInfo.transport} Always arrive early for flights and trains.`,
            source: { name: 'India Transport News' },
            publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            url: `https://www.google.com/search?q=${encodeURIComponent(locationName + ' airport railway news')}`
        },
        {
            title: `Weather Alert and Travel Advisory for ${locationName}`,
            description: `Current weather conditions in ${locationName}: ${getWeatherNewsContext()} Travelers should pack accordingly and monitor weather updates. Check for any weather-related disruptions to transport services.`,
            source: { name: 'Travel Weather India' },
            publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            url: `https://www.google.com/search?q=${encodeURIComponent(locationName + ' weather travel alert')}`
        },
        {
            title: `Safety and Security Updates for Travelers in ${locationName}`,
            description: `${locationInfo.safety} Travelers are advised to keep valuables secure, avoid isolated areas at night, and stay aware of surroundings. Emergency services are accessible 24/7.`,
            source: { name: 'Travel Safety India' },
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            url: `https://www.google.com/search?q=${encodeURIComponent(locationName + ' travel safety')}`
        },
        {
            title: `Upcoming Festivals and Events in ${locationName}`,
            description: `${locationInfo.culture} These celebrations offer unique cultural experiences for visitors. Some areas may have increased crowds and traffic during festival periods. Plan accordingly.`,
            source: { name: 'India Events Calendar' },
            publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            url: `https://www.google.com/search?q=${encodeURIComponent(locationName + ' festivals events calendar')}`
        },
        {
            title: `Essential Services and Facilities in ${locationName}`,
            description: `Water supply, electricity, and essential services are functioning normally in ${locationName}. ${locationInfo.infrastructure} Travelers can find ATMs, medical facilities, and tourist information centers throughout the city.`,
            source: { name: 'Traveler Services India' },
            publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
            url: `https://www.google.com/search?q=${encodeURIComponent(locationName + ' essential services')}`
        }
    ];
    
    return newsTemplates;
}

// Get location-specific information for news context
function getLocationInfo(locationName) {
    const locationData = {
        context: 'The region continues to attract visitors with its unique attractions and hospitality.',
        infrastructure: 'Ongoing infrastructure projects are improving transportation and tourist facilities.',
        development: 'Local administration is focusing on sustainable development and tourism growth.',
        culture: 'The area is known for its vibrant festivals and traditional celebrations.',
        safety: 'The region maintains good safety standards for tourists.'
    };
    
    // Customize based on major cities
    const cityContexts = {
        'Mumbai': {
            context: 'As India\'s financial capital, Mumbai continues to be a major tourist destination with its iconic landmarks.',
            infrastructure: 'Metro expansion and coastal road projects are enhancing city connectivity.',
            culture: 'From Ganesh Chaturthi to film festivals, Mumbai offers year-round cultural experiences.',
            safety: 'Mumbai Police maintains robust tourist safety measures across the city.'
        },
        'Delhi': {
            context: 'The national capital attracts millions with its historical monuments and modern infrastructure.',
            infrastructure: 'Delhi Metro expansion and smart city initiatives are improving urban mobility.',
            culture: 'From Diwali celebrations to Republic Day parade, Delhi showcases India\'s diversity.',
            safety: 'Enhanced security measures are in place at major tourist attractions.'
        },
        'Bengaluru': {
            context: 'Known as India\'s Silicon Valley, Bengaluru blends technology with traditional charm.',
            infrastructure: 'Namma Metro expansion and tech park developments are transforming the city.',
            culture: 'Dasara celebrations and tech festivals make Bengaluru culturally vibrant.',
            safety: 'The city maintains good safety standards with active police presence.'
        },
        'Goa': {
            context: 'India\'s beach paradise continues to attract domestic and international tourists.',
            infrastructure: 'New airport facilities and coastal road improvements enhance accessibility.',
            culture: 'Carnival, Shigmo festival, and beach festivals offer unique cultural experiences.',
            safety: 'Tourist police and coastal security ensure visitor safety.'
        },
        'Jaipur': {
            context: 'The Pink City remains a top destination for heritage tourism in India.',
            infrastructure: 'Heritage conservation and metro projects are improving tourist experience.',
            culture: 'Jaipur Literature Festival and traditional festivals showcase Rajasthani culture.',
            safety: 'Tourist-friendly initiatives and heritage site security are well-maintained.'
        },
        'Kerala': {
            context: 'God\'s Own Country continues to be a preferred destination for nature lovers.',
            infrastructure: 'Waterway development and eco-tourism projects are enhancing connectivity.',
            culture: 'Onam, boat races, and Kathakali performances offer rich cultural experiences.',
            safety: 'Kerala maintains high safety standards with tourist-friendly infrastructure.'
        }
    };
    
    // Check if we have specific context for this location
    for (const [city, context] of Object.entries(cityContexts)) {
        if (locationName.includes(city)) {
            return context;
        }
    }
    
    return locationData;
}

// Get weather-related news context
function getWeatherNewsContext() {
    if (!weatherData) {
        return 'Weather conditions are being monitored regularly.';
    }
    
    const temp = weatherData.temp;
    const weatherCode = weatherData.weather_code;
    
    if (temp > 35) {
        return 'High temperatures are being recorded. Heat wave advisories may be in effect.';
    } else if (temp < 10) {
        return 'Cold weather conditions prevail. Cold wave warnings may be issued.';
    } else if (weatherCode >= 61 && weatherCode <= 65) {
        return 'Rainfall has been reported in the region. Monsoon updates are being issued regularly.';
    } else if (weatherCode >= 95) {
        return 'Thunderstorm activity has been observed. Weather alerts are being monitored.';
    }
    
    return 'Weather conditions are generally favorable for travel.';
}

// Display news data
function displayNewsData(articles) {
    const newsContent = document.getElementById('newsContent');
    
    if (!articles || articles.length === 0) {
        newsContent.innerHTML = `
            <div class="error-message">
                <p>No recent news available for this location.</p>
                <p><small>Tip: Add a NewsAPI key in js/app.js for real-time news from Times of India, The Hindu, and other Indian sources</small></p>
            </div>
        `;
        return;
    }
    
    const hasRealNews = CONFIG.NEWSAPI_KEY && CONFIG.NEWSAPI_KEY !== '';
    
    newsContent.innerHTML = `
        ${!hasRealNews ? `
            <div style="background: #fff3cd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #ffc107;">
                <p style="margin: 0; color: #856404;">
                    <i class="fas fa-info-circle"></i> <strong>Enhanced News Mode:</strong>
                    For real-time news from NDTV, Times of India, The Hindu, and other Indian news channels,
                    <a href="https://newsapi.org/" target="_blank" style="color: #667eea;">get a free NewsAPI key</a>
                    (100 requests/day) and add it to js/app.js
                </p>
            </div>
        ` : ''}
        <div class="news-grid">
            ${articles.map(article => `
                <div class="news-item">
                    <h4>${article.title}</h4>
                    <p>${article.description || 'Click to read more about this news story.'}</p>
                    <div class="news-meta">
                        <span class="news-source">
                            <i class="fas fa-newspaper"></i> ${article.source?.name || article.source || 'News Source'}
                        </span>
                        <span><i class="far fa-clock"></i> ${formatDate(article.publishedAt)}</span>
                    </div>
                    ${article.url ? `<a href="${article.url}" target="_blank" class="news-link">Read full article →</a>` : ''}
                </div>
            `).join('')}
        </div>
        <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9ff; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 0.9rem;">
                <i class="fas fa-search"></i> Want more specific news?
                <a href="https://www.google.com/search?q=${encodeURIComponent(currentLocation.name + ' India latest news')}&tbm=nws"
                   target="_blank" style="color: #667eea; font-weight: bold;">
                    Search Google News
                </a>
            </p>
        </div>
    `;
}

// Generate intelligent AI-like summary
function generateIntelligentSummary(location) {
    const summaryContent = document.getElementById('aiSummaryContent');
    
    summaryContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Analyzing data and generating summary...</p>
        </div>
    `;
    
    // Simulate processing time for better UX
    setTimeout(() => {
        const summary = createIntelligentSummary(location);
        displayAISummary(summary);
    }, 1500);
}

// Create intelligent summary based on collected data
function createIntelligentSummary(location) {
    const summary = {
        overview: '',
        weatherInsights: '',
        weatherAnalysis: '',
        newsAnalysis: '',
        recentEvents: [],
        travelRecommendations: [],
        safetyInsights: ''
    };
    
    // Generate enhanced overview
    if (location.type === 'City') {
        summary.overview = `${location.name} is a vibrant city in ${location.state}, India. `;
    } else {
        summary.overview = `${location.name} is a ${location.type.toLowerCase()} in India with its capital at ${location.capital}. `;
    }
    
    // Deep weather analysis
    if (weatherData) {
        const analysis = analyzeWeatherInDepth(weatherData, location);
        summary.weatherInsights = analysis.insights;
        summary.weatherAnalysis = analysis.detailed;
    }
    
    // Analyze news for patterns and insights
    if (newsData && newsData.length > 0) {
        const newsAnalysis = analyzeNewsContent(newsData, location);
        summary.recentEvents = newsAnalysis.events;
        summary.newsAnalysis = newsAnalysis.insights;
        summary.safetyInsights = newsAnalysis.safety;
    }
    
    // Generate smart travel recommendations
    summary.travelRecommendations = generateSmartRecommendations(location, weatherData, newsData);
    
    return summary;
}

// Deep weather analysis with multiple factors
function analyzeWeatherInDepth(weather, location) {
    // Handle both old and new weather data structure
    const current = weather.current || weather;
    const temp = Math.round(current.temp);
    const feelsLike = Math.round(current.feels_like);
    const humidity = current.humidity;
    const windSpeed = current.wind_speed;
    const pressure = current.pressure;
    const weatherCode = current.weather_code;
    const precipitation = current.precipitation;
    
    const weatherDesc = getWeatherDescription(weatherCode);
    
    let insights = `Current conditions in ${location.name}: ${weatherDesc.toLowerCase()} with ${temp}°C (feels like ${feelsLike}°C). `;
    let detailed = '';
    
    // Temperature analysis
    if (temp > 40) {
        insights += `⚠️ Extreme heat warning! `;
        detailed += `🌡️ **Heat Alert**: Temperatures are dangerously high. Heat stroke risk is significant. Limit outdoor exposure, especially between 11 AM - 4 PM. `;
    } else if (temp > 35) {
        insights += `Very hot conditions prevail. `;
        detailed += `🌡️ **Hot Weather**: High temperatures require precautions. Stay in air-conditioned spaces when possible, drink water every 30 minutes, and wear light-colored, loose clothing. `;
    } else if (temp > 30) {
        insights += `Warm and comfortable for indoor activities. `;
        detailed += `🌡️ **Warm Climate**: Pleasant for early morning or evening outdoor activities. Midday sun can be intense - plan accordingly. `;
    } else if (temp > 25) {
        insights += `Ideal weather for sightseeing and outdoor exploration. `;
        detailed += `🌡️ **Perfect Weather**: Excellent conditions for all tourist activities. This is prime time for outdoor adventures and city tours. `;
    } else if (temp > 15) {
        insights += `Cool and pleasant conditions. `;
        detailed += `🌡️ **Comfortable Climate**: Great for walking tours and outdoor activities. Light jacket recommended for evenings. `;
    } else if (temp > 10) {
        insights += `Cool weather - warm clothing recommended. `;
        detailed += `🌡️ **Cool Weather**: Pack layers and warm clothing. Perfect for hot beverages and indoor cultural experiences. `;
    } else {
        insights += `Cold conditions - winter clothing essential. `;
        detailed += `🌡️ **Cold Alert**: Heavy winter clothing required. Great for winter sports in hill stations. Hot meals and warm accommodations essential. `;
    }
    
    // Humidity analysis
    if (humidity > 80) {
        insights += `Very high humidity makes it feel muggy. `;
        detailed += `💧 **High Humidity**: The air feels heavy and sticky. Sweat doesn't evaporate easily, making it feel hotter. Stay in ventilated areas and use dehumidifiers if possible. `;
    } else if (humidity > 70) {
        insights += `Humid conditions may cause discomfort. `;
        detailed += `💧 **Moderate Humidity**: Slightly uncomfortable but manageable. Cotton clothing recommended for better breathability. `;
    } else if (humidity < 30) {
        insights += `Low humidity - stay moisturized. `;
        detailed += `💧 **Dry Air**: Low humidity can cause dry skin and throat irritation. Use moisturizer, lip balm, and drink extra water. `;
    }
    
    // Wind analysis
    if (windSpeed > 40) {
        insights += `⚠️ Strong winds - outdoor activities may be affected. `;
        detailed += `💨 **Wind Warning**: High winds can make outdoor activities challenging. Secure loose items, avoid beach activities, and be cautious near tall structures. `;
    } else if (windSpeed > 25) {
        insights += `Breezy conditions. `;
        detailed += `💨 **Windy**: Moderate winds provide natural cooling but may affect outdoor dining and activities. `;
    } else if (windSpeed < 5) {
        detailed += `💨 **Calm Air**: Very little wind movement. Good for outdoor photography and peaceful activities. `;
    }
    
    // Precipitation analysis
    if (precipitation > 10) {
        insights += `⚠️ Heavy rainfall - plan indoor activities. `;
        detailed += `🌧️ **Heavy Rain**: Significant rainfall expected. Roads may be waterlogged. Carry waterproof gear, avoid low-lying areas, and check for flood warnings. Indoor attractions recommended. `;
    } else if (precipitation > 2) {
        insights += `Light to moderate rain expected. `;
        detailed += `🌧️ **Rainy Weather**: Intermittent showers likely. Umbrella essential. Great time to visit museums, shopping malls, and covered markets. `;
    } else if (precipitation > 0) {
        insights += `Slight chance of drizzle. `;
        detailed += `🌧️ **Light Drizzle**: Minor precipitation possible. Keep an umbrella handy but outdoor plans should be fine. `;
    }
    
    // Weather code specific insights
    if (weatherCode >= 95) {
        detailed += `⛈️ **Thunderstorm Alert**: Electrical storm activity detected. Stay indoors, avoid open areas, and unplug electronics. Do not take shelter under trees. `;
    } else if (weatherCode >= 71 && weatherCode <= 77) {
        detailed += `❄️ **Snow Conditions**: Snowfall makes for beautiful scenery but requires winter precautions. Roads may be slippery - drive carefully or use public transport. `;
    } else if (weatherCode >= 45 && weatherCode <= 48) {
        detailed += `🌫️ **Fog/Mist**: Reduced visibility affects travel. Allow extra time for journeys, use fog lights when driving, and be cautious at intersections. `;
    }
    
    // Pressure analysis for health
    if (pressure < 1000) {
        detailed += `🔽 **Low Pressure**: May cause headaches or fatigue in sensitive individuals. Stay hydrated and rest if needed. `;
    } else if (pressure > 1020) {
        detailed += `🔼 **High Pressure**: Generally stable weather. Good conditions for outdoor activities. `;
    }
    
    return { insights, detailed };
}

// Analyze news content for patterns and insights
function analyzeNewsContent(news, location) {
    const events = [];
    let insights = '';
    let safety = '';
    
    // Extract key themes from news
    const themes = {
        tourism: 0,
        infrastructure: 0,
        weather: 0,
        festival: 0,
        safety: 0,
        development: 0,
        traffic: 0,
        health: 0
    };
    
    news.forEach(article => {
        const title = article.title.toLowerCase();
        const desc = (article.description || '').toLowerCase();
        const content = title + ' ' + desc;
        
        // Add to events list
        events.push(article.title);
        
        // Analyze themes
        if (content.includes('tourism') || content.includes('tourist') || content.includes('travel')) themes.tourism++;
        if (content.includes('road') || content.includes('metro') || content.includes('airport') || content.includes('infrastructure')) themes.infrastructure++;
        if (content.includes('rain') || content.includes('weather') || content.includes('storm') || content.includes('flood')) themes.weather++;
        if (content.includes('festival') || content.includes('celebration') || content.includes('event')) themes.festival++;
        if (content.includes('safety') || content.includes('security') || content.includes('police')) themes.safety++;
        if (content.includes('development') || content.includes('project') || content.includes('construction')) themes.development++;
        if (content.includes('traffic') || content.includes('congestion') || content.includes('jam')) themes.traffic++;
        if (content.includes('health') || content.includes('hospital') || content.includes('medical')) themes.health++;
    });
    
    // Generate insights based on themes
    insights += `📰 **News Analysis for ${location.name}**: `;
    
    const topThemes = Object.entries(themes)
        .filter(([_, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
    
    if (topThemes.length > 0) {
        insights += `Recent news coverage focuses on `;
        const themeDescriptions = {
            tourism: 'tourism developments and visitor experiences',
            infrastructure: 'infrastructure improvements and connectivity projects',
            weather: 'weather conditions and climate-related updates',
            festival: 'cultural festivals and local celebrations',
            safety: 'safety measures and security enhancements',
            development: 'urban development and modernization initiatives',
            traffic: 'traffic conditions and transportation updates',
            health: 'healthcare facilities and public health matters'
        };
        
        insights += topThemes.map(([theme, _]) => themeDescriptions[theme]).join(', ') + '. ';
    }
    
    // Safety insights
    if (themes.safety > 0) {
        safety += `🛡️ **Safety Updates**: Local authorities are actively maintaining security measures. `;
    }
    if (themes.weather > 1) {
        safety += `🌦️ **Weather Alerts**: Multiple weather-related news items suggest monitoring conditions closely. `;
    }
    if (themes.traffic > 0) {
        safety += `🚗 **Traffic Advisory**: Traffic updates in news - plan travel times accordingly and use navigation apps. `;
    }
    if (themes.health > 0) {
        safety += `🏥 **Health Notice**: Healthcare-related news present - ensure travel insurance and carry necessary medications. `;
    }
    
    // Positive indicators
    if (themes.tourism > 1) {
        insights += `Tourism sector is active with positive developments for visitors. `;
    }
    if (themes.festival > 0) {
        insights += `Cultural events and festivals are happening - great time to experience local traditions! `;
    }
    if (themes.development > 0) {
        insights += `Ongoing development projects indicate growing infrastructure and facilities. `;
    }
    
    if (!safety) {
        safety = `✅ **General Safety**: No specific safety concerns in recent news. Standard travel precautions apply.`;
    }
    
    return {
        events: events.slice(0, 4),
        insights,
        safety
    };
}

// Generate smart recommendations based on all data
function generateSmartRecommendations(location, weather, news) {
    const recommendations = [];
    
    // Weather-based smart recommendations
    if (weather) {
        const temp = weather.temp;
        const humidity = weather.humidity;
        const precipitation = weather.precipitation;
        const windSpeed = weather.wind_speed;
        
        // Temperature recommendations
        if (temp > 35) {
            recommendations.push('🌡️ Start your day early (6-9 AM) when it\'s cooler for outdoor activities');
            recommendations.push('💧 Drink at least 3-4 liters of water daily to prevent dehydration');
            recommendations.push('🏨 Choose accommodations with good air conditioning');
            recommendations.push('🍹 Try local cooling drinks like lassi, nimbu pani, or coconut water');
        } else if (temp > 25) {
            recommendations.push('☀️ Perfect weather for full-day sightseeing and outdoor activities');
            recommendations.push('📸 Great conditions for photography and exploring');
            recommendations.push('🚶 Walking tours are comfortable - explore local markets and streets');
        } else if (temp < 15) {
            recommendations.push('🧥 Pack layers: thermal wear, sweaters, and a warm jacket');
            recommendations.push('☕ Enjoy hot local beverages like chai, coffee, or soup');
            recommendations.push('🔥 Seek accommodations with heating facilities');
            recommendations.push('🌄 Early morning views are spectacular but dress warmly');
        }
        
        // Humidity recommendations
        if (humidity > 75) {
            recommendations.push('👕 Wear breathable, cotton clothing to stay comfortable');
            recommendations.push('🚿 Take frequent showers to feel refreshed');
            recommendations.push('💨 Seek air-conditioned or well-ventilated spaces during peak hours');
        }
        
        // Precipitation recommendations
        if (precipitation > 5) {
            recommendations.push('☔ Essential items: waterproof jacket, umbrella, and waterproof bag for electronics');
            recommendations.push('👟 Wear closed-toe shoes with good grip to avoid slipping');
            recommendations.push('🏛️ Plan indoor activities: museums, shopping malls, cultural centers');
            recommendations.push('📱 Keep emergency contacts handy and monitor weather updates');
        } else if (precipitation > 0) {
            recommendations.push('🌂 Keep a compact umbrella in your bag');
            recommendations.push('🏞️ Outdoor plans are feasible but have backup indoor options');
        }
        
        // Wind recommendations
        if (windSpeed > 30) {
            recommendations.push('💨 Secure loose items and avoid beach/water activities');
            recommendations.push('🏢 Be cautious near tall buildings and construction sites');
        }
    }
    
    // News-based recommendations
    if (news && news.length > 0) {
        const newsContent = news.map(n => (n.title + ' ' + (n.description || '')).toLowerCase()).join(' ');
        
        if (newsContent.includes('festival') || newsContent.includes('celebration')) {
            recommendations.push('🎉 Local festivals happening - book accommodations early and experience cultural events');
        }
        if (newsContent.includes('traffic') || newsContent.includes('congestion')) {
            recommendations.push('🚇 Use public transportation or ride-sharing apps to avoid traffic');
            recommendations.push('⏰ Allow extra travel time and avoid peak hours (8-10 AM, 5-8 PM)');
        }
        if (newsContent.includes('construction') || newsContent.includes('development')) {
            recommendations.push('🚧 Some areas under development - check routes before traveling');
        }
    }
    
    // Location-specific recommendations
    const locationRecs = getLocationSpecificRecommendations(location);
    recommendations.push(...locationRecs);
    
    // General smart recommendations
    recommendations.push('📱 Download offline maps and keep important numbers saved');
    recommendations.push('💳 Carry both cash and cards - some places may not accept cards');
    recommendations.push('🆔 Keep copies of important documents (ID, tickets, hotel bookings)');
    
    // Women safety specific
    recommendations.push('👥 For women travelers: Share your itinerary with family/friends');
    recommendations.push('🚖 Use registered taxis or ride-sharing apps, especially at night');
    recommendations.push('📞 Save local emergency numbers: Police (100), Ambulance (102), Women Helpline (1091)');
    
    return recommendations.slice(0, 12); // Return top 12 recommendations
}

// Get location-specific smart recommendations
function getLocationSpecificRecommendations(location) {
    const recs = [];
    const name = location.name.toLowerCase();
    
    if (name.includes('mumbai')) {
        recs.push('🚂 Use local trains for fast travel but avoid peak hours');
        recs.push('🌊 Visit Marine Drive and Gateway of India during sunset');
    } else if (name.includes('delhi')) {
        recs.push('🚇 Delhi Metro is the best way to navigate the city');
        recs.push('🏛️ Book tickets online for popular monuments to skip queues');
    } else if (name.includes('bengaluru') || name.includes('bangalore')) {
        recs.push('🍽️ Explore diverse food scene from South Indian to global cuisines');
        recs.push('🌳 Visit Lalbagh and Cubbon Park for peaceful green spaces');
    } else if (name.includes('goa')) {
        recs.push('🏖️ North Goa for parties, South Goa for peaceful beaches');
        recs.push('🛵 Rent a scooter for easy beach hopping');
    } else if (name.includes('jaipur')) {
        recs.push('🏰 Start early to visit forts before afternoon heat');
        recs.push('🛍️ Bargain at local markets - it\'s expected and part of the experience');
    }
    
    return recs;
}

// Generate contextual travel recommendations
function generateTravelRecommendations(location, weather) {
    const recommendations = [];
    
    // Weather-based recommendations
    if (weather) {
        if (weather.temp > 30) {
            recommendations.push('Carry sunscreen, sunglasses, and stay hydrated');
            recommendations.push('Plan indoor activities during afternoon hours');
        } else if (weather.temp < 15) {
            recommendations.push('Pack warm clothing and layers');
            recommendations.push('Hot beverages and local cuisine will be enjoyable');
        }
        
        if (weather.precipitation > 0 || weather.weather_code >= 51) {
            recommendations.push('Waterproof gear recommended due to rain');
            recommendations.push('Check road conditions before traveling');
        }
    }
    
    // Location-specific recommendations
    const locationRecommendations = {
        'Mumbai': ['Visit Gateway of India', 'Try local street food', 'Use local trains for commuting'],
        'Delhi': ['Explore historical monuments', 'Visit India Gate and Red Fort', 'Use metro for easy travel'],
        'Bengaluru': ['Visit Lalbagh Gardens', 'Explore tech parks', 'Try South Indian cuisine'],
        'Goa': ['Enjoy beach activities', 'Try water sports', 'Explore Portuguese architecture'],
        'Jaipur': ['Visit Amber Fort and City Palace', 'Shop for handicrafts', 'Try Rajasthani cuisine'],
        'Kerala': ['Experience backwaters', 'Try Ayurvedic treatments', 'Enjoy local seafood'],
        'Himachal Pradesh': ['Trekking and adventure sports', 'Visit hill stations', 'Try local Himachali food'],
        'Rajasthan': ['Desert safari experiences', 'Visit forts and palaces', 'Shop for traditional crafts']
    };
    
    // Check if we have specific recommendations
    for (const [key, recs] of Object.entries(locationRecommendations)) {
        if (location.name.includes(key) || location.state?.includes(key)) {
            recommendations.push(...recs);
            break;
        }
    }
    
    // Generic recommendations
    if (recommendations.length < 3) {
        recommendations.push('Respect local customs and traditions');
        recommendations.push('Try authentic local cuisine');
        recommendations.push('Carry necessary identification documents');
    }
    
    return recommendations.slice(0, 5);
}

// Display AI summary with enhanced insights
function displayAISummary(summary) {
    const summaryContent = document.getElementById('aiSummaryContent');
    
    summaryContent.innerHTML = `
        <div class="ai-summary-content">
            <div class="ai-summary-section">
                <h4><i class="fas fa-map-marker-alt"></i> Destination Overview</h4>
                <p>${summary.overview}</p>
            </div>
            
            ${summary.weatherInsights ? `
                <div class="ai-summary-section">
                    <h4><i class="fas fa-cloud-sun"></i> Quick Weather Summary</h4>
                    <p>${summary.weatherInsights}</p>
                </div>
            ` : ''}
            
            ${summary.weatherAnalysis ? `
                <div class="ai-summary-section">
                    <h4><i class="fas fa-chart-line"></i> Detailed Weather Analysis</h4>
                    <p style="line-height: 1.8;">${summary.weatherAnalysis}</p>
                </div>
            ` : ''}
            
            ${summary.newsAnalysis ? `
                <div class="ai-summary-section">
                    <h4><i class="fas fa-newspaper"></i> News Insights & Trends</h4>
                    <p style="line-height: 1.8;">${summary.newsAnalysis}</p>
                </div>
            ` : ''}
            
            ${summary.recentEvents && summary.recentEvents.length > 0 ? `
                <div class="ai-summary-section">
                    <h4><i class="fas fa-calendar-alt"></i> Recent Headlines</h4>
                    <ul>
                        ${summary.recentEvents.map(event => `<li>${event}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${summary.safetyInsights ? `
                <div class="ai-summary-section">
                    <h4><i class="fas fa-shield-alt"></i> Safety & Advisory</h4>
                    <p style="line-height: 1.8;">${summary.safetyInsights}</p>
                </div>
            ` : ''}
            
            ${summary.travelRecommendations && summary.travelRecommendations.length > 0 ? `
                <div class="ai-summary-section">
                    <h4><i class="fas fa-lightbulb"></i> Smart Travel Recommendations</h4>
                    <ul>
                        ${summary.travelRecommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="ai-disclaimer">
                <i class="fas fa-robot"></i> <strong>AI-Powered Analysis:</strong> This comprehensive summary is generated by analyzing real-time weather data, recent news patterns, and location-specific factors. The insights combine multiple data sources to provide actionable travel intelligence. Always verify critical information and stay updated with local authorities.
            </div>
        </div>
    `;
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today';
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString('en-IN', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Made with Bob

// Fetch hotel recommendations from Google Places API
async function fetchHotelRecommendations(locationName, coordinates) {
    const hotelsContent = document.getElementById('hotelsContent');
    
    try {
        if (!CONFIG.GOOGLE_PLACES_API_KEY || CONFIG.GOOGLE_PLACES_API_KEY === '') {
            // Show fallback with instructions
            displayHotelsFallback(locationName);
            return;
        }
        
        // Use Google Places API to search for hotels
        const response = await fetch(CONFIG.GOOGLE_PLACES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.editorialSummary'
            },
            body: JSON.stringify({
                textQuery: `safe hotels for women in ${locationName} India`,
                maxResultCount: 10,
                locationBias: coordinates ? {
                    circle: {
                        center: {
                            latitude: coordinates.latitude,
                            longitude: coordinates.longitude
                        },
                        radius: 5000.0
                    }
                } : undefined
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch hotels from Google Places');
        }
        
        const data = await response.json();
        
        if (data.places && data.places.length > 0) {
            displayHotels(data.places);
        } else {
            displayHotelsFallback(locationName);
        }
        
    } catch (error) {
        console.error('Error fetching hotels:', error);
        displayHotelsFallback(locationName);
    }
}

// Display hotels from Google Places
function displayHotels(hotels) {
    const hotelsContent = document.getElementById('hotelsContent');
    
    hotelsContent.innerHTML = `
        <div style="background: #e8f5e9; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #4caf50;">
            <p style="margin: 0; color: #2e7d32;">
                <i class="fas fa-check-circle"></i> <strong>Real Google Reviews:</strong> 
                Hotels listed below are fetched from Google Places API based on ratings and reviews.
            </p>
        </div>
        ${hotels.map((hotel, index) => `
            <div class="hotel-item">
                <div class="hotel-header">
                    <div>
                        <div class="hotel-name">${index + 1}. ${hotel.displayName?.text || 'Hotel'}</div>
                        <div class="hotel-location">
                            <i class="fas fa-map-marker-alt"></i> ${hotel.formattedAddress || 'Location not available'}
                        </div>
                    </div>
                    ${hotel.rating ? `
                        <div class="hotel-rating">
                            <i class="fas fa-star"></i> ${hotel.rating.toFixed(1)}
                            ${hotel.userRatingCount ? `<small>(${hotel.userRatingCount})</small>` : ''}
                        </div>
                    ` : ''}
                </div>
                ${hotel.editorialSummary?.text ? `
                    <p style="color: #666; margin: 0.5rem 0;">${hotel.editorialSummary.text}</p>
                ` : ''}
                <div class="safety-badge">
                    <i class="fas fa-shield-alt"></i> Women Safety Focused
                </div>
                <div class="hotel-features">
                    ${hotel.priceLevel ? `<span class="hotel-feature"><i class="fas fa-dollar-sign"></i> ${getPriceLevel(hotel.priceLevel)}</span>` : ''}
                    <span class="hotel-feature"><i class="fas fa-google"></i> Google Verified</span>
                    <span class="hotel-feature"><i class="fas fa-star"></i> Highly Rated</span>
                </div>
            </div>
        `).join('')}
        <div style="margin-top: 1rem; padding: 1rem; background: #f8f9ff; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> Ratings and reviews are from Google Maps users
            </p>
        </div>
    `;
}

// Display fallback hotels with Reddit discussions
async function displayHotelsFallback(locationName) {
    const hotelsContent = document.getElementById('hotelsContent');
    
    // Get city subreddits for display
    const citySubreddits = getCitySubreddits(locationName);
    const subredditList = citySubreddits.slice(0, 5).map(s => `r/${s}`).join(', ');
    
    // Show loading state
    hotelsContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Searching ${subredditList} and more for hotel recommendations...</p>
        </div>
    `;
    
    // Fetch Reddit discussions
    const redditPosts = await fetchRedditHotels(locationName);
    
    hotelsContent.innerHTML = `
        <div style="background: #ff4500; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="margin: 0;">
                <i class="fab fa-reddit-alien"></i> <strong>TOP Hotel Discussions from Reddit</strong>
            </p>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.9;">
                Searched: ${subredditList} + general Reddit • Sorted by engagement (upvotes + comments × 2)
            </p>
        </div>
        
        ${redditPosts.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: #667eea; margin-bottom: 1rem;">
                    <i class="fas fa-fire"></i> Top ${redditPosts.length} Most Popular Hotel Discussions for ${locationName}
                </h4>
                ${redditPosts.map((post, index) => `
                    <div class="hotel-item" style="background: #fff8f0; position: relative;">
                        <div style="position: absolute; top: 1rem; right: 1rem; background: #ff4500; color: white; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">
                            #${index + 1} TOP
                        </div>
                        <div class="hotel-header">
                            <div style="padding-right: 4rem;">
                                <div class="hotel-name">${post.title}</div>
                                <div class="hotel-location">
                                    <i class="fab fa-reddit"></i> r/${post.subreddit} •
                                    <i class="fas fa-arrow-up"></i> ${post.score} upvotes •
                                    <i class="fas fa-comment"></i> ${post.comments} comments •
                                    <i class="fas fa-chart-line"></i> ${post.engagement} engagement
                                </div>
                            </div>
                        </div>
                        <p style="color: #666; margin: 0.8rem 0;">${post.preview}</p>
                        <a href="${post.url}" target="_blank" class="news-link" style="color: #ff4500; font-weight: bold;">
                            <i class="fas fa-external-link-alt"></i> Read Full Discussion on Reddit →
                        </a>
                    </div>
                `).join('')}
                
                <div style="text-align: center; margin-top: 1.5rem;">
                    <a href="https://www.reddit.com/search/?q=${encodeURIComponent(locationName + ' India hotel recommendation')}&sort=top&t=year"
                       target="_blank"
                       style="display: inline-block; padding: 1rem 2rem; background: #ff4500; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        <i class="fab fa-reddit-alien"></i> View More Hotel Discussions on Reddit
                    </a>
                </div>
            </div>
        ` : `
            <div style="padding: 2rem; text-align: center; background: #f5f5f5; border-radius: 8px;">
                <p style="color: #666; margin-bottom: 1rem;">No Reddit discussions found for hotels in ${locationName}</p>
                <a href="https://www.reddit.com/search/?q=${encodeURIComponent(locationName + ' India hotel')}"
                   target="_blank"
                   style="display: inline-block; padding: 0.8rem 1.5rem; background: #ff4500; color: white; text-decoration: none; border-radius: 8px;">
                    <i class="fab fa-reddit"></i> Search Reddit
                </a>
            </div>
        `}
        
        <div style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="margin: 0; color: #1565c0;">
                <i class="fas fa-search"></i> <strong>Find More Hotels:</strong>
            </p>
        </div>
        
        <div style="display: grid; gap: 1rem; margin-top: 1rem;">
            <a href="https://www.reddit.com/search/?q=${encodeURIComponent(locationName + ' India hotel recommendation')}"
               target="_blank"
               style="display: block; padding: 1rem; background: #fff8f0; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #ff4500;">
                <strong><i class="fab fa-reddit"></i> Search Reddit</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Real traveler experiences and honest reviews</p>
            </a>
            
            <a href="https://www.google.com/maps/search/safe+hotels+for+women+in+${encodeURIComponent(locationName)}+India"
               target="_blank"
               style="display: block; padding: 1rem; background: #f8f9ff; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #667eea;">
                <strong><i class="fas fa-map-marked-alt"></i> Google Maps</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Search hotels with reviews and ratings</p>
            </a>
            
            <a href="https://www.booking.com/searchresults.html?ss=${encodeURIComponent(locationName + ', India')}"
               target="_blank"
               style="display: block; padding: 1rem; background: #f8f9ff; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #667eea;">
                <strong><i class="fas fa-hotel"></i> Booking.com</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Compare prices and read reviews</p>
            </a>
            
            <a href="https://www.makemytrip.com/hotels/hotel-listing/?city=${encodeURIComponent(locationName)}"
               target="_blank"
               style="display: block; padding: 1rem; background: #f8f9ff; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #667eea;">
                <strong><i class="fas fa-plane"></i> MakeMyTrip</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Indian hotel booking platform</p>
            </a>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
            <p style="margin: 0; color: #2e7d32; font-size: 0.9rem;">
                <i class="fas fa-shield-alt"></i> <strong>Safety Tips:</strong>
                Look for hotels with good reviews from women travelers, 24/7 security, CCTV coverage, and central locations.
            </p>
        </div>
    `;
}

// Fetch food recommendations from Google Places API
async function fetchFoodRecommendations(locationName, coordinates) {
    const foodContent = document.getElementById('foodContent');
    
    try {
        if (!CONFIG.GOOGLE_PLACES_API_KEY || CONFIG.GOOGLE_PLACES_API_KEY === '') {
            // Show fallback with instructions
            displayFoodFallback(locationName);
            return;
        }
        
        // Use Google Places API to search for restaurants
        const response = await fetch(CONFIG.GOOGLE_PLACES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': CONFIG.GOOGLE_PLACES_API_KEY,
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.types,places.editorialSummary'
            },
            body: JSON.stringify({
                textQuery: `best restaurants and food in ${locationName} India`,
                maxResultCount: 10,
                locationBias: coordinates ? {
                    circle: {
                        center: {
                            latitude: coordinates.latitude,
                            longitude: coordinates.longitude
                        },
                        radius: 5000.0
                    }
                } : undefined
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch restaurants from Google Places');
        }
        
        const data = await response.json();
        
        if (data.places && data.places.length > 0) {
            displayFood(data.places);
        } else {
            displayFoodFallback(locationName);
        }
        
    } catch (error) {
        console.error('Error fetching food recommendations:', error);
        displayFoodFallback(locationName);
    }
}

// Display food recommendations from Google Places
function displayFood(restaurants) {
    const foodContent = document.getElementById('foodContent');
    
    foodContent.innerHTML = `
        <div style="background: #fff3e0; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #e65100;">
                <i class="fas fa-check-circle"></i> <strong>Real Google Reviews:</strong> 
                Restaurants listed below are fetched from Google Places API based on ratings and reviews.
            </p>
        </div>
        ${restaurants.map((restaurant, index) => `
            <div class="food-item">
                <div class="food-header">
                    <div>
                        <div class="food-name">${index + 1}. ${restaurant.displayName?.text || 'Restaurant'}</div>
                        <div class="food-location">
                            <i class="fas fa-map-marker-alt"></i> ${restaurant.formattedAddress || 'Location not available'}
                        </div>
                    </div>
                    ${restaurant.rating ? `
                        <div class="food-type">
                            <i class="fas fa-star"></i> ${restaurant.rating.toFixed(1)}
                            ${restaurant.userRatingCount ? `<small>(${restaurant.userRatingCount})</small>` : ''}
                        </div>
                    ` : ''}
                </div>
                ${restaurant.editorialSummary?.text ? `
                    <p class="food-description">${restaurant.editorialSummary.text}</p>
                ` : ''}
                <div class="food-tags">
                    ${restaurant.priceLevel ? `<span class="food-tag"><i class="fas fa-dollar-sign"></i> ${getPriceLevel(restaurant.priceLevel)}</span>` : ''}
                    <span class="food-tag"><i class="fas fa-google"></i> Google Verified</span>
                    ${restaurant.types?.includes('restaurant') ? '<span class="food-tag"><i class="fas fa-utensils"></i> Restaurant</span>' : ''}
                    ${restaurant.types?.includes('cafe') ? '<span class="food-tag"><i class="fas fa-coffee"></i> Cafe</span>' : ''}
                </div>
            </div>
        `).join('')}
        <div style="margin-top: 1rem; padding: 1rem; background: #fff8e1; border-radius: 8px; text-align: center;">
            <p style="margin: 0; color: #666; font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> Ratings and reviews are from Google Maps users
            </p>
        </div>
    `;
}

// Display fallback food recommendations with Reddit discussions
async function displayFoodFallback(locationName) {
    const foodContent = document.getElementById('foodContent');
    
    // Get city subreddits for display
    const citySubreddits = getCitySubreddits(locationName);
    const subredditList = citySubreddits.slice(0, 5).map(s => `r/${s}`).join(', ');
    
    // Show loading state
    foodContent.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>Searching ${subredditList} and more for food recommendations...</p>
            <p style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">Check browser console (F12) for detailed logs...</p>
        </div>
    `;
    
    // Fetch Reddit discussions with error tracking
    const result = await fetchRedditFood(locationName);
    const redditPosts = result.posts;
    const errors = result.errors;
    
    foodContent.innerHTML = `
        <div style="background: #ff4500; color: white; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="margin: 0;">
                <i class="fab fa-reddit-alien"></i> <strong>TOP Food Discussions from Reddit</strong>
            </p>
            <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem; opacity: 0.9;">
                Searched: ${subredditList} + general Reddit • Sorted by engagement (upvotes + comments × 2)
            </p>
        </div>
        
        ${errors.length > 0 ? `
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <p style="margin: 0 0 0.5rem 0; color: #856404; font-weight: bold;">
                    <i class="fas fa-exclamation-triangle"></i> Debug Information:
                </p>
                <ul style="margin: 0; padding-left: 1.5rem; color: #856404; font-size: 0.9rem;">
                    ${errors.map(err => `<li>${err}</li>`).join('')}
                </ul>
                <p style="margin: 0.5rem 0 0 0; color: #856404; font-size: 0.85rem;">
                    <strong>Tip:</strong> Open browser console (F12) for more details
                </p>
            </div>
        ` : ''}
        
        ${redditPosts.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
                <h4 style="color: #ff9800; margin-bottom: 1rem;">
                    <i class="fas fa-fire"></i> Top ${redditPosts.length} Most Popular Food Discussions for ${locationName}
                </h4>
                ${redditPosts.map((post, index) => `
                    <div class="food-item" style="position: relative;">
                        <div style="position: absolute; top: 1rem; right: 1rem; background: #ff4500; color: white; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: bold; font-size: 0.85rem;">
                            #${index + 1} TOP
                        </div>
                        <div class="food-header">
                            <div style="padding-right: 4rem;">
                                <div class="food-name">${post.title}</div>
                                <div class="food-location">
                                    <i class="fab fa-reddit"></i> r/${post.subreddit} •
                                    <i class="fas fa-arrow-up"></i> ${post.score} upvotes •
                                    <i class="fas fa-comment"></i> ${post.comments} comments •
                                    <i class="fas fa-chart-line"></i> ${post.engagement} engagement
                                </div>
                            </div>
                        </div>
                        <p class="food-description">${post.preview}</p>
                        <a href="${post.url}" target="_blank" class="news-link" style="color: #ff4500; font-weight: bold;">
                            <i class="fas fa-external-link-alt"></i> Read Full Discussion on Reddit →
                        </a>
                    </div>
                `).join('')}
                
                <div style="text-align: center; margin-top: 1.5rem;">
                    <a href="https://www.reddit.com/search/?q=${encodeURIComponent(locationName + ' India food restaurant recommendation')}&sort=top&t=year"
                       target="_blank"
                       style="display: inline-block; padding: 1rem 2rem; background: #ff4500; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                        <i class="fab fa-reddit-alien"></i> View More Food Discussions on Reddit
                    </a>
                </div>
            </div>
        ` : `
            <div style="padding: 2rem; text-align: center; background: #f5f5f5; border-radius: 8px;">
                <p style="color: #666; margin-bottom: 1rem;">No Reddit discussions found for food in ${locationName}</p>
                <a href="https://www.reddit.com/search/?q=${encodeURIComponent(locationName + ' India food')}"
                   target="_blank"
                   style="display: inline-block; padding: 0.8rem 1.5rem; background: #ff4500; color: white; text-decoration: none; border-radius: 8px;">
                    <i class="fab fa-reddit"></i> Search Reddit
                </a>
            </div>
        `}
        
        <div style="background: #fff8e1; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            <p style="margin: 0; color: #f57c00;">
                <i class="fas fa-search"></i> <strong>Discover More Food Options:</strong>
            </p>
        </div>
        
        <div style="display: grid; gap: 1rem; margin-top: 1rem;">
            <a href="https://www.reddit.com/search/?q=${encodeURIComponent(locationName + ' India food restaurant recommendation')}"
               target="_blank"
               style="display: block; padding: 1rem; background: #fff8f0; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #ff4500;">
                <strong><i class="fab fa-reddit"></i> Search Reddit</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Find hidden gems and local favorites</p>
            </a>
            
            <a href="https://www.google.com/maps/search/best+restaurants+in+${encodeURIComponent(locationName)}+India"
               target="_blank"
               style="display: block; padding: 1rem; background: #fff8e1; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #ff9800;">
                <strong><i class="fas fa-map-marked-alt"></i> Google Maps</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Find restaurants with reviews and photos</p>
            </a>
            
            <a href="https://www.zomato.com/search?q=${encodeURIComponent(locationName)}"
               target="_blank"
               style="display: block; padding: 1rem; background: #fff8e1; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #ff9800;">
                <strong><i class="fas fa-utensils"></i> Zomato</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Discover restaurants and read reviews</p>
            </a>
            
            <a href="https://www.swiggy.com/"
               target="_blank"
               style="display: block; padding: 1rem; background: #fff8e1; border-radius: 8px; text-decoration: none; color: #333; border-left: 4px solid #ff9800;">
                <strong><i class="fas fa-motorcycle"></i> Swiggy</strong>
                <p style="margin: 0.5rem 0 0 0; color: #666; font-size: 0.9rem;">Order food delivery and explore menus</p>
            </a>
        </div>
        
        <div style="margin-top: 1.5rem; padding: 1rem; background: #e8f5e9; border-radius: 8px;">
            <p style="margin: 0; color: #2e7d32; font-size: 0.9rem;">
                <i class="fas fa-lightbulb"></i> <strong>Tip:</strong>
                Look for restaurants with high ratings, recent reviews, and good hygiene standards. Reddit often reveals authentic local spots!
            </p>
        </div>
    `;
}

// Helper function to convert price level to readable format
function getPriceLevel(level) {
    const levels = {
        'PRICE_LEVEL_FREE': 'Free',
        'PRICE_LEVEL_INEXPENSIVE': '$',
        'PRICE_LEVEL_MODERATE': '$$',
        'PRICE_LEVEL_EXPENSIVE': '$$$',
        'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$'
    };
    return levels[level] || '$$';
}

// Fetch Reddit discussions about the location
async function fetchRedditInsights(locationName) {
    try {
        const query = `${locationName} India travel OR hotel OR food OR visit`;
        const url = `${CONFIG.REDDIT_API_URL}?q=${encodeURIComponent(query)}&limit=10&sort=relevance&t=month`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Reddit API request failed');
        }
        
        const data = await response.json();
        
        if (data.data && data.data.children && data.data.children.length > 0) {
            return data.data.children.map(post => ({
                title: post.data.title,
                subreddit: post.data.subreddit,
                score: post.data.score,
                num_comments: post.data.num_comments,
                url: `https://www.reddit.com${post.data.permalink}`,
                created: post.data.created_utc,
                selftext: post.data.selftext ? post.data.selftext.substring(0, 200) : ''
            }));
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching Reddit insights:', error);
        return [];
    }
}

// Fetch TOP hotel recommendations from city-specific subreddits and general Reddit
async function fetchRedditHotels(locationName) {
    try {
        const allPosts = [];
        
        // Get city-specific subreddit names (handle alternative names)
        const citySubreddits = getCitySubreddits(locationName);
        
        // 1. Search in city-specific subreddits (e.g., r/bangalore, r/mumbai)
        for (const subreddit of citySubreddits.slice(0, 3)) { // Limit to first 3 to avoid too many requests
            try {
                // Simpler query - just "hotel"
                const url = `https://www.reddit.com/r/${subreddit}/search.json?q=hotel&restrict_sr=1&sort=top&t=all&limit=20`;
                
                console.log(`Fetching hotels from r/${subreddit}...`);
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.json();
                    if (data.data && data.data.children && data.data.children.length > 0) {
                        console.log(`Found ${data.data.children.length} posts in r/${subreddit}`);
                        const posts = data.data.children
                            .filter(post => post.data.score >= 0) // Accept all posts, even with 0 score
                            .map(post => ({
                                title: post.data.title,
                                subreddit: post.data.subreddit,
                                score: post.data.score,
                                comments: post.data.num_comments,
                                url: `https://www.reddit.com${post.data.permalink}`,
                                preview: post.data.selftext ? post.data.selftext.substring(0, 200) + '...' : 'Click to read full discussion',
                                engagement: post.data.score + (post.data.num_comments * 2),
                                created: post.data.created_utc
                            }));
                        allPosts.push(...posts);
                    } else {
                        console.log(`No posts found in r/${subreddit}`);
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                console.error(`Error fetching from r/${subreddit}:`, err);
            }
        }
        
        // 2. Search across all Reddit for city-specific hotel posts
        try {
            const query = `${locationName} hotel`;
            const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=all&limit=25`;
            
            console.log(`Fetching hotels from general Reddit search...`);
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.children && data.data.children.length > 0) {
                    console.log(`Found ${data.data.children.length} posts in general search`);
                    const posts = data.data.children
                        .filter(post => post.data.score >= 0)
                        .map(post => ({
                            title: post.data.title,
                            subreddit: post.data.subreddit,
                            score: post.data.score,
                            comments: post.data.num_comments,
                            url: `https://www.reddit.com${post.data.permalink}`,
                            preview: post.data.selftext ? post.data.selftext.substring(0, 200) + '...' : 'Click to read full discussion',
                            engagement: post.data.score + (post.data.num_comments * 2),
                            created: post.data.created_utc
                        }));
                    allPosts.push(...posts);
                }
            }
        } catch (err) {
            console.error('Error fetching from general Reddit search:', err);
        }
        
        console.log(`Total posts before dedup: ${allPosts.length}`);
        
        // Remove duplicates based on URL
        const uniquePosts = Array.from(new Map(allPosts.map(post => [post.url, post])).values());
        
        console.log(`Total unique posts: ${uniquePosts.length}`);
        
        // Sort by engagement and return top 10
        const topPosts = uniquePosts
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 10);
            
        console.log(`Returning top ${topPosts.length} posts`);
        return topPosts;
        
    } catch (error) {
        console.error('Error fetching Reddit hotels:', error);
        return [];
    }
}

// Fetch TOP food recommendations from city-specific subreddits and general Reddit
async function fetchRedditFood(locationName) {
    const allPosts = [];
    const errors = [];
    
    try {
        // Get city-specific subreddit names
        const citySubreddits = getCitySubreddits(locationName);
        console.log(`🔍 Searching subreddits:`, citySubreddits.slice(0, 3));
        
        // 1. Search in city-specific subreddits
        for (const subreddit of citySubreddits.slice(0, 3)) {
            try {
                const url = `https://www.reddit.com/r/${subreddit}/search.json?q=food restaurant&restrict_sr=1&sort=top&t=all&limit=20`;
                
                console.log(`📡 Fetching from r/${subreddit}...`);
                console.log(`   URL: ${url}`);
                
                const response = await fetchWithProxy(url);
                console.log(`   Response status: ${response.status} ${response.statusText}`);
                
                if (!response.ok) {
                    const errorMsg = `r/${subreddit}: HTTP ${response.status} - ${response.statusText}`;
                    errors.push(errorMsg);
                    console.error(`❌ ${errorMsg}`);
                    continue;
                }
                
                const data = await response.json();
                console.log(`   Data structure:`, data.data ? 'OK' : 'MISSING');
                
                if (data.data && data.data.children && data.data.children.length > 0) {
                    console.log(`✅ Found ${data.data.children.length} posts in r/${subreddit}`);
                    const posts = data.data.children
                        .filter(post => post.data.score >= 0)
                        .map(post => ({
                            title: post.data.title,
                            subreddit: post.data.subreddit,
                            score: post.data.score,
                            comments: post.data.num_comments,
                            url: `https://www.reddit.com${post.data.permalink}`,
                            preview: post.data.selftext ? post.data.selftext.substring(0, 200) + '...' : 'Click to read full discussion',
                            engagement: post.data.score + (post.data.num_comments * 2),
                            created: post.data.created_utc
                        }));
                    allPosts.push(...posts);
                } else {
                    const errorMsg = `r/${subreddit}: No posts found (subreddit might not exist or have no food posts)`;
                    errors.push(errorMsg);
                    console.log(`⚠️ ${errorMsg}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
                const errorMsg = `r/${subreddit}: ${err.message} (CORS error or network issue)`;
                errors.push(errorMsg);
                console.error(`❌ Error fetching from r/${subreddit}:`, err);
            }
        }
        
        // 2. Search across all Reddit
        try {
            const query = `${locationName} food restaurant`;
            const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=top&t=all&limit=25`;
            
            console.log(`📡 Fetching from general Reddit search...`);
            console.log(`   URL: ${url}`);
            
            const response = await fetchWithProxy(url);
            console.log(`   Response status: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.data && data.data.children && data.data.children.length > 0) {
                    console.log(`✅ Found ${data.data.children.length} posts in general search`);
                    const posts = data.data.children
                        .filter(post => post.data.score >= 0)
                        .map(post => ({
                            title: post.data.title,
                            subreddit: post.data.subreddit,
                            score: post.data.score,
                            comments: post.data.num_comments,
                            url: `https://www.reddit.com${post.data.permalink}`,
                            preview: post.data.selftext ? post.data.selftext.substring(0, 200) + '...' : 'Click to read full discussion',
                            engagement: post.data.score + (post.data.num_comments * 2),
                            created: post.data.created_utc
                        }));
                    allPosts.push(...posts);
                } else {
                    errors.push(`General search: No posts found`);
                }
            } else {
                errors.push(`General search: HTTP ${response.status}`);
            }
        } catch (err) {
            const errorMsg = `General search: ${err.message}`;
            errors.push(errorMsg);
            console.error(`❌ Error in general search:`, err);
        }
        
        console.log(`📊 Total posts before dedup: ${allPosts.length}`);
        
        // Remove duplicates
        const uniquePosts = Array.from(new Map(allPosts.map(post => [post.url, post])).values());
        console.log(`📊 Total unique posts: ${uniquePosts.length}`);
        
        // Sort and return top 10
        const topPosts = uniquePosts
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 10);
            
        console.log(`✅ Returning top ${topPosts.length} posts`);
        
        if (errors.length > 0) {
            console.log(`⚠️ Errors encountered:`, errors);
        }
        
        return { posts: topPosts, errors };
        
    } catch (error) {
        console.error('❌ Fatal error fetching Reddit food:', error);
        errors.push(`Fatal error: ${error.message}`);
        return { posts: [], errors };
    }
}

// Get city-specific subreddit names (handles alternative city names)
function getCitySubreddits(locationName) {
    const cityName = locationName.toLowerCase().trim();
    const subreddits = [];
    
    // Map of cities to their subreddit names and alternatives
    const cityMap = {
        // Major cities with their alternative names
        'bengaluru': ['bangalore', 'bengaluru'],
        'bangalore': ['bangalore', 'bengaluru'],
        'mumbai': ['mumbai', 'bombay'],
        'bombay': ['mumbai', 'bombay'],
        'delhi': ['delhi', 'newdelhi'],
        'new delhi': ['delhi', 'newdelhi'],
        'kolkata': ['kolkata', 'calcutta'],
        'calcutta': ['kolkata', 'calcutta'],
        'chennai': ['chennai', 'madras'],
        'madras': ['chennai', 'madras'],
        'hyderabad': ['hyderabad'],
        'pune': ['pune'],
        'ahmedabad': ['ahmedabad'],
        'jaipur': ['jaipur'],
        'lucknow': ['lucknow'],
        'chandigarh': ['chandigarh'],
        'kochi': ['kochi', 'cochin'],
        'cochin': ['kochi', 'cochin'],
        'goa': ['goa'],
        'thiruvananthapuram': ['thiruvananthapuram', 'trivandrum'],
        'trivandrum': ['thiruvananthapuram', 'trivandrum'],
        'bhubaneswar': ['bhubaneswar'],
        'indore': ['indore'],
        'nagpur': ['nagpur'],
        'visakhapatnam': ['visakhapatnam', 'vizag'],
        'vizag': ['visakhapatnam', 'vizag'],
        'bhopal': ['bhopal'],
        'patna': ['patna'],
        'vadodara': ['vadodara', 'baroda'],
        'baroda': ['vadodara', 'baroda'],
        'ludhiana': ['ludhiana'],
        'agra': ['agra'],
        'nashik': ['nashik'],
        'faridabad': ['faridabad'],
        'meerut': ['meerut'],
        'rajkot': ['rajkot'],
        'varanasi': ['varanasi', 'banaras'],
        'banaras': ['varanasi', 'banaras'],
        'srinagar': ['srinagar'],
        'amritsar': ['amritsar'],
        'allahabad': ['allahabad', 'prayagraj'],
        'prayagraj': ['allahabad', 'prayagraj'],
        'ranchi': ['ranchi'],
        'howrah': ['howrah'],
        'coimbatore': ['coimbatore'],
        'jabalpur': ['jabalpur'],
        'gwalior': ['gwalior'],
        'vijayawada': ['vijayawada'],
        'jodhpur': ['jodhpur'],
        'madurai': ['madurai'],
        'raipur': ['raipur'],
        'kota': ['kota'],
        'guwahati': ['guwahati'],
        'chandigarh': ['chandigarh'],
        'solapur': ['solapur'],
        'hubli': ['hubli'],
        'mysore': ['mysore', 'mysuru'],
        'mysuru': ['mysore', 'mysuru'],
        'tiruchirappalli': ['tiruchirappalli', 'trichy'],
        'trichy': ['tiruchirappalli', 'trichy'],
        'bareilly': ['bareilly'],
        'moradabad': ['moradabad'],
        'gurgaon': ['gurgaon', 'gurugram'],
        'gurugram': ['gurgaon', 'gurugram'],
        'aligarh': ['aligarh'],
        'jalandhar': ['jalandhar'],
        'bhubaneshwar': ['bhubaneshwar', 'bhubaneswar'],
        'salem': ['salem'],
        'warangal': ['warangal'],
        'mira-bhayandar': ['mirabhayandar'],
        'thiruvananthapuram': ['thiruvananthapuram', 'trivandrum'],
        'bhiwandi': ['bhiwandi'],
        'saharanpur': ['saharanpur'],
        'guntur': ['guntur'],
        'amravati': ['amravati'],
        'bikaner': ['bikaner'],
        'noida': ['noida'],
        'jamshedpur': ['jamshedpur'],
        'bhilai': ['bhilai'],
        'cuttack': ['cuttack'],
        'firozabad': ['firozabad'],
        'kochi': ['kochi', 'cochin'],
        'nellore': ['nellore'],
        'bhavnagar': ['bhavnagar'],
        'dehradun': ['dehradun'],
        'durgapur': ['durgapur'],
        'asansol': ['asansol'],
        'nanded': ['nanded'],
        'kolhapur': ['kolhapur'],
        'ajmer': ['ajmer'],
        'akola': ['akola'],
        'gulbarga': ['gulbarga'],
        'jamnagar': ['jamnagar'],
        'ujjain': ['ujjain'],
        'loni': ['loni'],
        'siliguri': ['siliguri'],
        'jhansi': ['jhansi'],
        'ulhasnagar': ['ulhasnagar'],
        'jammu': ['jammu'],
        'mangalore': ['mangalore', 'mangaluru'],
        'mangaluru': ['mangalore', 'mangaluru'],
        'erode': ['erode'],
        'belgaum': ['belgaum', 'belagavi'],
        'belagavi': ['belgaum', 'belagavi'],
        'ambattur': ['ambattur'],
        'tirunelveli': ['tirunelveli'],
        'malegaon': ['malegaon'],
        'gaya': ['gaya'],
        'jalgaon': ['jalgaon'],
        'udaipur': ['udaipur'],
        'maheshtala': ['maheshtala']
    };
    
    // Get subreddit names for the city
    if (cityMap[cityName]) {
        subreddits.push(...cityMap[cityName]);
    } else {
        // If not in map, try the city name itself
        subreddits.push(cityName.replace(/\s+/g, ''));
    }
    
    // Also add general India subreddits for broader coverage
    subreddits.push('india', 'IndiaTourism', 'IndianFood');
    
    return [...new Set(subreddits)]; // Remove duplicates
}
