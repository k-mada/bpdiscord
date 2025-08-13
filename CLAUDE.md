# BPDiscord Application Documentation

## Overview

BPDiscord is a full-stack TypeScript web application that scrapes and analyzes Letterboxd user rating data. It provides user comparison features, hater rankings, and comprehensive rating statistics through a modern React frontend and Express.js backend.

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript, Tailwind CSS
- **Backend**: Express.js + TypeScript, Puppeteer for web scraping
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens via Supabase Auth
- **Web Scraping**: Puppeteer + Cheerio for HTML parsing

### Project Structure
```
bpdiscord/
├── src/
│   ├── client/           # React frontend application
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   └── services/     # API client services
│   │   └── public/
│   ├── server/           # Express.js backend
│   │   ├── config/       # Database and configuration
│   │   ├── controllers/  # Business logic controllers
│   │   ├── middleware/   # Authentication, validation, error handling
│   │   ├── routes/       # API route definitions
│   │   └── types/        # TypeScript type definitions
│   └── shared/           # Shared types between client/server
└── dist/                 # Compiled TypeScript output
```

## Data Flow Architecture

### Database Schema

#### Core Tables
1. **Users** - Letterboxd user profile data
   - `lbusername` (primary key) - Letterboxd username
   - `display_name` - User's display name
   - `followers` - Follower count
   - `following` - Following count  
   - `number_of_lists` - Number of lists created
   - `created_at`, `updated_at` - Timestamps

2. **UserRatings** - Individual rating data points
   - `username` - Links to Users.lbusername
   - `rating` - Rating value (0.5-5.0)
   - `count` - Number of movies rated at this level
   - Primary key: (`username`, `rating`)

3. **Films** (future use) - Individual film data
   - Film metadata and user-specific rating information

### Data Sources and Processing

#### 1. Web Scraping Pipeline
```
Letterboxd Profile URL
    ↓ (Puppeteer)
HTML Content
    ↓ (Cheerio parsing)
Structured Data
    ↓ (Data validation)
Database Storage
```

**Scraping Process:**
- Uses Puppeteer for automated browser interactions
- Targets specific CSS selectors for rating histogram data
- Extracts follower/following counts and user profile information
- Implements retry mechanisms and error handling
- Validates scraped data before database insertion

#### 2. Data Processing Flow
```
Raw Letterboxd Data → Validation → Transformation → Database Storage → API Response
```

**Key Processing Steps:**
- **Profile Data Extraction**: Display name, followers, following, lists
- **Rating Histogram Parsing**: Extracts count for each 0.5-5.0 rating level
- **Data Normalization**: Converts various number formats (e.g., "1.2K" → 1200)
- **Database Upserts**: Updates existing data or inserts new records

## API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /signup` - User registration
- `POST /login` - User authentication  
- `POST /logout` - Session termination
- `POST /password-reset` - Password reset initiation

### Scraper Routes (`/api/scraper`) - Protected
- `POST /getUserRatings` - Scrape user's rating distribution
- `POST /getUserProfile` - Scrape complete user profile + ratings
- `POST /getAllFilms` - Scrape user's complete film list
- `POST /getData` - Generic data scraping with custom selectors

### Comparison Routes (`/api/comparison`) - Public
- `GET /usernames` - Get list of available users with display names
- `POST /user-ratings` - Get specific user's ratings and profile data
- `POST /compare` - Compare two users' rating data
- `GET /hater-rankings` - Get all users ranked by average rating

### User Routes (`/api/users`) - Protected
- `GET /` - Get all users
- `GET /me` - Get current user profile
- `GET /:id` - Get specific user
- `PUT /:id` - Update user profile
- `DELETE /:id` - Delete user account

## User Experience Flow

### Public Routes (No Authentication Required)

#### 1. User Comparison (`/compare`)
**Purpose**: Compare rating statistics between any two Letterboxd users

**Flow**:
1. User visits public comparison page
2. Two dropdown menus populated with available users (showing display names)
3. User selects two different users to compare
4. System fetches both users' data (ratings + profile info)
5. Displays two sections:
   - **Profile Comparison Table**: Total films, followers, following, lists
   - **Rating Distribution Table**: Side-by-side rating counts with percentages
6. Visual highlighting shows which user has higher counts for each metric
7. Summary section shows aggregate statistics

**Data Sources**: 
- UserRatings table for rating data
- Users table for profile information

#### 2. Hater Rankings (`/hater-rankings`)
**Purpose**: Rank all users by average rating (lowest = biggest "hater")

**Flow**:
1. User visits hater rankings page
2. System calculates average ratings for all users
3. Displays sortable table with:
   - Rank position (with trophy icon for #1)
   - Display name/username
   - Total movies rated
   - Average rating (formatted to 2 decimals)
   - Rating distribution histogram (visual bars)
4. Rankings sorted ascending (lowest average = biggest hater)
5. Visual histogram shows distribution across 0.5-5.0 rating scale

**Calculations**:
- Average rating = Σ(rating × count) / Σ(count) for each user
- Distribution bars scaled relative to maximum count

### Protected Routes (Authentication Required)

#### 3. Dashboard (`/dashboard`)
**Purpose**: Main authenticated user interface

**Navigation Structure**:
- **Profile** (`/dashboard/profile`) - User profile management
- **Data Fetcher** (`/dashboard/fetcher`) - Scraping interface  
- **Compare** (`/dashboard/compare`) - Enhanced user comparison
- **Hater Rankings** (`/dashboard/hater-rankings`) - Private rankings view

#### 4. Data Fetcher (`/dashboard/fetcher`)
**Purpose**: Interface for scraping Letterboxd data

**Flow**:
1. User enters Letterboxd username
2. Selects scraping operation:
   - Get user ratings only
   - Get complete user profile
   - Get all films (paginated)
3. System validates input and initiates scraping
4. Real-time feedback during scraping process
5. Results displayed with option to save to database
6. Error handling for invalid users or scraping failures

**Technical Process**:
- Validates Letterboxd username format
- Launches Puppeteer browser instance
- Navigates to user's Letterboxd profile
- Extracts data using CSS selectors
- Validates extracted data
- Stores in database with upsert logic

#### 5. User Profile (`/dashboard/profile`)
**Purpose**: Manage user account and view personal statistics

**Features**:
- View account information
- Update profile settings
- View personal scraping history
- Account management (logout, delete account)

### Authentication Flow

#### Login Process
1. User enters email/password on login page
2. Credentials sent to `/api/auth/login`
3. Backend validates via Supabase Auth
4. JWT token returned and stored in localStorage
5. User redirected to dashboard
6. All subsequent API calls include Authorization header

#### Protected Route Access
1. Component checks for token in localStorage
2. If no token, redirects to login page
3. Token included in API request headers
4. Backend middleware validates token
5. Request proceeds if valid, returns 401 if invalid

## Data Processing Algorithms

### Rating Distribution Calculation
```typescript
// Calculate average rating for user
const averageRating = ratings.reduce((sum, item) => 
  sum + (item.rating * item.count), 0
) / ratings.reduce((sum, item) => sum + item.count, 0);

// Calculate percentage distribution
const percentage = (count / totalRatings) * 100;
```

### Hater Rankings Algorithm
```typescript
// Sort users by average rating (ascending = biggest haters first)
const rankings = users
  .map(user => ({
    username: user.username,
    displayName: user.displayName,
    averageRating: calculateAverage(user.ratings),
    totalRatings: calculateTotal(user.ratings),
    ratingDistribution: user.ratings.sort((a, b) => a.rating - b.rating)
  }))
  .sort((a, b) => a.averageRating - b.averageRating);
```

### Number Parsing (Handles K/M suffixes)
```typescript
const parseNumberFromText = (text: string): number => {
  const cleanText = text.replace(/,/g, '').toLowerCase();
  
  if (cleanText.includes('k')) {
    return Math.round(parseFloat(cleanText.replace('k', '')) * 1000);
  }
  if (cleanText.includes('m')) {
    return Math.round(parseFloat(cleanText.replace('m', '')) * 1000000);
  }
  
  return parseInt(cleanText, 10) || 0;
};
```

## Security Features

### Authentication & Authorization
- JWT token-based authentication via Supabase
- Row Level Security (RLS) policies on database tables
- Service role key for admin operations (bypasses RLS)
- Protected routes require valid authentication

### Web Scraping Security
- Puppeteer browser automation for data extraction
- Rate limiting on scraping endpoints (20 requests per 15 minutes)
- User agent rotation and realistic headers
- Error handling for blocked requests

### API Security  
- Helmet.js for security headers
- CORS configuration for frontend domains
- Express rate limiting (100 requests per 15 minutes)
- Input validation on all endpoints
- SQL injection prevention via parameterized queries

## Performance Optimizations

### Database
- Efficient indexes on primary keys and foreign keys
- Upsert operations to handle duplicate data
- Parallel queries for fetching related data
- Connection pooling via Supabase

### Frontend
- Lazy loading of components
- Efficient state management with React hooks
- Memoization of expensive calculations
- Optimized re-rendering with proper dependency arrays

### Scraping
- Page resource blocking (images, fonts) for faster loading
- Multiple retry strategies for failed page loads
- Concurrent scraping operations where possible
- Browser instance reuse and cleanup

## Error Handling

### Frontend Error Boundaries
- Global error handling for React components
- User-friendly error messages
- Fallback UI states for failed operations
- Retry mechanisms for failed API calls

### Backend Error Handling
- Global error middleware for Express
- Structured error responses with consistent format
- Detailed logging for debugging
- Graceful degradation for external service failures

### Scraping Error Recovery
- Multiple page load strategies (networkidle2, domcontentloaded, load)
- Retry mechanisms for failed scraping attempts
- Validation of scraped data before processing
- Fallback selectors for HTML structure changes

## Development & Deployment

### Development Setup
```bash
# Install dependencies
npm install

# Start backend development server
npm run dev

# Start frontend development server (separate terminal)
npm run dev:client

# Build for production
npm run build
npm run build:client
```

### Environment Variables
```bash
# Backend (.env)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development

# Frontend (.env)
REACT_APP_API_URL=http://localhost:3001/api
```

### Database Setup
1. Create Supabase project
2. Set up tables with appropriate RLS policies
3. Configure service role for admin operations
4. Set up proper indexes for performance

## Future Enhancements

### Planned Features
- **Film-level Analysis**: Individual movie rating comparisons
- **Trend Analysis**: Rating patterns over time
- **Social Features**: Follow users, rating notifications
- **Export Functionality**: CSV/JSON data exports
- **Advanced Filtering**: Filter by genre, year, rating range
- **Caching Layer**: Redis for improved performance
- **Real-time Updates**: WebSocket connections for live data

### Technical Improvements
- **Microservices Architecture**: Separate scraping service
- **Queue System**: Background job processing for scraping
- **CDN Integration**: Static asset optimization
- **Monitoring**: Application performance monitoring
- **Testing**: Comprehensive unit and integration tests

## Troubleshooting

### Common Issues
1. **Scraping Failures**: Often due to Letterboxd changes or rate limiting
2. **Authentication Errors**: Check token expiration and Supabase configuration
3. **Database Connection Issues**: Verify Supabase credentials and network access
4. **CORS Errors**: Ensure frontend URL is in allowed origins

### Debug Information
- Enable verbose logging in development
- Check browser network tab for API call details
- Verify database records after scraping operations
- Monitor Supabase logs for authentication issues

---

This application demonstrates modern full-stack development practices with TypeScript, combining web scraping capabilities with a polished user interface for data analysis and comparison.