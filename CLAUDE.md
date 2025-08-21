# BPDiscord Application Documentation

## Overview

BPDiscord is a full-stack TypeScript web application that scrapes and analyzes Letterboxd user rating data. It provides user comparison features, hater rankings, and comprehensive rating statistics through a modern React frontend and Express.js backend.

## Architecture

### Technology Stack

- **Frontend**: Vite + React 18 + TypeScript, Tailwind CSS
- **Backend**: Express.js + TypeScript, Puppeteer for web scraping
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens via Supabase Auth
- **Web Scraping**: Puppeteer + Cheerio for HTML parsing
- **Package Manager**: Yarn (consistent across all projects)
- **Development**: Vite proxy for CORS-free development

### Project Structure

```
bpdiscord/
├── src/
│   ├── client/           # Vite + React frontend application
│   │   ├── components/   # React components
│   │   ├── services/     # API client services
│   │   ├── types.ts      # Client-specific TypeScript types
│   │   ├── vite.config.js # Vite configuration with proxy
│   │   ├── tailwind.config.js # Tailwind CSS configuration
│   │   ├── tsconfig.json # Client-specific TypeScript configuration
│   │   ├── package.json  # Client dependencies
│   │   └── build/        # Vite build output
│   ├── server/           # Express.js backend
│   │   ├── config/       # Database and configuration
│   │   ├── controllers/  # Business logic controllers
│   │   │   ├── filmUserController.ts # Database-first operations
│   │   │   └── scraperController.ts  # Force-scraping operations
│   │   ├── middleware/   # Authentication, validation, error handling
│   │   ├── routes/       # API route definitions
│   │   │   ├── filmUserRoutes.ts     # Database-first endpoints
│   │   │   └── scraperRoutes.ts      # Force-scraping endpoints
│   │   ├── types.ts      # Server-specific TypeScript types
│   │   ├── tsconfig.json # Server-specific TypeScript configuration
│   │   ├── package.json  # Server dependencies
│   │   └── dist/         # TypeScript compilation output
├── package.json          # Root orchestration + shared dependencies
├── tsconfig.json         # Root TypeScript configuration
├── vercel.json           # Deployment configuration
└── yarn.lock             # Lockfile for consistent dependencies
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

### Film User Routes (`/api/film-users`) - Public, Database-First

- `GET /` - Get all users with display names
- `GET /:username/ratings` - Get user's ratings (database only)
- `GET /:username/profile` - Get user's profile (database only)
- `GET /:username/complete` - Get complete user data (database only)
- **Fallback Parameter**: Add `?fallback=scrape` to any endpoint to scrape if data missing

### Scraper Routes (`/api/scraper`) - Protected, Force-Scraping Only

- `POST /getUserRatings` - Force scrape user's rating distribution
- `POST /getUserProfile` - Force scrape complete user profile + ratings
- `POST /getAllFilms` - Force scrape user's complete film list
- `POST /getData` - Generic data scraping with custom selectors
- **Production**: Disabled unless `ENABLE_SCRAPER=true` environment variable set

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
- **Compare** (`/compare`) - Enhanced user comparison
- **Hater Rankings** (`/dashboard/hater-rankings`) - Private rankings view

#### 4. Data Fetcher (`/dashboard/fetcher`)

**Purpose**: Interface for accessing and scraping Letterboxd data

**Enhanced Interface**:

1. User enters Letterboxd username
2. Two operation modes available:
   - **"Check Database"**: Uses database-first endpoints (`/api/film-users`)
   - **"Force Scrape"**: Uses force-scraping endpoints (`/api/scraper`)
3. Database operations show data source (database vs scraped vs fallback)
4. Real-time feedback during all operations
5. Results displayed with detailed metadata
6. Error handling for invalid users or scraping failures

**Technical Process**:

- **Database-First**: Queries existing data, optional fallback to scraping
- **Force-Scraping**: Always scrapes fresh data from Letterboxd
- Validates Letterboxd username format
- Launches Puppeteer browser instance (scraping mode only)
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
const averageRating =
  ratings.reduce((sum, item) => sum + item.rating * item.count, 0) /
  ratings.reduce((sum, item) => sum + item.count, 0);

// Calculate percentage distribution
const percentage = (count / totalRatings) * 100;
```

### Hater Rankings Algorithm

```typescript
// Sort users by average rating (ascending = biggest haters first)
const rankings = users
  .map((user) => ({
    username: user.username,
    displayName: user.displayName,
    averageRating: calculateAverage(user.ratings),
    totalRatings: calculateTotal(user.ratings),
    ratingDistribution: user.ratings.sort((a, b) => a.rating - b.rating),
  }))
  .sort((a, b) => a.averageRating - b.averageRating);
```

### Number Parsing (Handles K/M suffixes)

```typescript
const parseNumberFromText = (text: string): number => {
  const cleanText = text.replace(/,/g, "").toLowerCase();

  if (cleanText.includes("k")) {
    return Math.round(parseFloat(cleanText.replace("k", "")) * 1000);
  }
  if (cleanText.includes("m")) {
    return Math.round(parseFloat(cleanText.replace("m", "")) * 1000000);
  }

  return parseInt(cleanText, 10) || 0;
};
```

## Database-First Architecture

### Design Philosophy

BPDiscord implements a **database-first architecture** optimized for production deployment:

1. **Primary Access**: Database queries for maximum performance and reliability
2. **Fallback Scraping**: Optional scraping when data is missing
3. **Force Scraping**: Explicit scraping for data updates
4. **Production Optimization**: Scraping disabled by default in production

### API Architecture Separation

#### Database-First Endpoints (`/api/film-users`)

- **Purpose**: Fast, reliable access to existing data
- **Authentication**: Public (no authentication required)
- **Performance**: Optimized database queries with indexes
- **Fallback**: Optional `?fallback=scrape` parameter
- **Use Case**: Public pages, user comparisons, rankings

#### Force-Scraping Endpoints (`/api/scraper`)

- **Purpose**: Fresh data extraction from Letterboxd
- **Authentication**: Protected (requires JWT token)
- **Performance**: Slower due to browser automation
- **Production**: Disabled unless `ENABLE_SCRAPER=true`
- **Use Case**: Administrative data updates, new user addition

### Data Flow Examples

#### Public User Comparison

```
User Request → /api/film-users/:username/complete
    ↓
Database Query (fast)
    ↓
Return Cached Data
```

#### Admin Data Update

```
Admin Request → /api/scraper/getUserProfile + JWT
    ↓
Puppeteer Browser Launch
    ↓
Letterboxd Scraping
    ↓
Database Upsert
    ↓
Return Fresh Data
```

#### Fallback Pattern

```
User Request → /api/film-users/:username/complete?fallback=scrape
    ↓
Database Query → No Data Found
    ↓
Automatic Scraping
    ↓
Database Storage
    ↓
Return Scraped Data
```

### Production Benefits

1. **Serverless Compatibility**: No memory-intensive scraping by default
2. **Fast Response Times**: Database queries return in milliseconds
3. **Cost Optimization**: Reduced compute usage and function timeouts
4. **Reliability**: No dependency on external site stability
5. **Scalability**: Database can handle high concurrent loads

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
# Install all dependencies
yarn install:all

# Start both server and client concurrently (recommended)
yarn dev

# Or start individually:
# Backend development server
yarn dev:server

# Frontend development server (separate terminal)
yarn dev:client

# Build for production
yarn build
```

### Environment Variables

```bash
# Backend (.env)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development
ENABLE_SCRAPER=true  # Enable scraping in production (optional)

# Frontend (.env)
# VITE_API_URL=/api  # Uses proxy in development, override for production
VITE_HOT_RELOAD=true
```

### Vite Development Benefits

- **Fast HMR**: Hot module replacement for instant updates
- **Proxy Configuration**: CORS-free API calls via `/api` proxy to `:3001`
- **Environment Variables**: Use `VITE_` prefix instead of `REACT_APP_`
- **Build Speed**: Significantly faster than Create React App
- **Modern Tooling**: ESBuild for lightning-fast TypeScript compilation

### Database Setup

1. Create Supabase project
2. Set up tables with appropriate RLS policies
3. Configure service role for admin operations
4. Set up proper indexes for performance

## Production Deployment to Vercel

### Full-Stack Deployment Architecture

BPDiscord is configured for seamless Vercel deployment with both frontend and backend components. This setup enables true full-stack deployment from a single repository while maintaining proper separation and build processes.

### Critical Configuration Requirements

#### 1. Build Script Separation

**Root `package.json` Build Script**

```json
{
  "scripts": {
    "build": "cd src/server && tsc"
  }
}
```

**Critical**: Root build script must ONLY build the server. Vercel handles client building separately via `@vercel/static-build`.

#### 2. TypeScript Configuration Isolation

**Server-Specific `tsconfig.json` (`src/server/tsconfig.json`)**

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "target": "ES2020",
    "module": "commonjs"
  },
  "include": ["./**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Purpose**: Prevents server TypeScript compilation from interfering with client files and causing build artifacts.

#### 3. Vercel Configuration

**Complete `vercel.json` Setup**

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/server/server.ts",
      "use": "@vercel/node"
    },
    {
      "src": "src/client/package.json",
      "use": "@vercel/static-build",
      "config": {
        "distDir": "build"
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/src/server/server.ts"
    },
    {
      "src": "/assets/(.*)",
      "dest": "/src/client/assets/$1"
    },
    {
      "src": "/(favicon\\.ico|manifest\\.json|logo.*\\.png|robots\\.txt)",
      "dest": "/src/client/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/src/client/index.html"
    }
  ],
  "env": {
    "NODE_ENV": "production",
    "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD": "true"
  }
}
```

### Route Processing Order

Routes are processed sequentially and must be ordered correctly:

1. **API Routes** (`/api/(.*)`) → Route to server function
2. **Asset Routes** (`/assets/(.*)`) → Serve static assets (CSS, JS, images)
3. **Static Files** → Serve favicon, manifest, logos, robots.txt
4. **Catch-All** (`/(.*)`) → Route to React app for SPA client-side routing

### Deployment Process Flow

```
1. Root Build → TypeScript compiles server only (src/server/dist/)
2. Client Build → Vercel runs @vercel/static-build (src/client/build/)
3. Function Creation → Server becomes serverless function
4. Static Deployment → Client files served from correct paths
5. Route Configuration → Requests routed to appropriate destinations
```

### Common Deployment Issues and Solutions

#### Problem: 404 Errors on All Routes

**Cause**: Routes pointing to incorrect file locations
**Solution**: Ensure routes match deployment structure (`/src/client/index.html`)

#### Problem: Static Assets Return 401/404 Errors

**Cause**: Asset requests routed to server instead of static files
**Solution**: Add specific asset routes before catch-all route

#### Problem: Build Conflicts and Mysterious Files

**Cause**: Multiple build processes or conflicting configurations
**Solutions**:

- Remove any `vercel.json` files from subdirectories
- Ensure server has dedicated `tsconfig.json`
- Root build script handles server only
- Let Vercel manage client build independently

#### Problem: TypeScript Compilation Errors

**Cause**: Root TypeScript config trying to compile client files
**Solution**: Create isolated server `tsconfig.json` with proper `include`/`exclude`

### Production Environment Variables

Configure in Vercel dashboard:

```bash
SUPABASE_URL=your_production_supabase_url
SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_key
NODE_ENV=production
ENABLE_SCRAPER=true  # Optional: Enable scraping in production
```

### Deployment Verification

1. **Build Logs**: Clean compilation without conflicts
2. **File Structure**: Static files in expected locations (`src/client/`)
3. **Route Testing**:
   - API calls work (`/api/*`)
   - Static assets load (`/assets/*`, `/favicon.ico`)
   - SPA routing functional (`/*`)
4. **No Build Artifacts**: Clean deployment without mysterious files

### Performance Optimizations for Production

- **Serverless Functions**: API routes become auto-scaling functions
- **Edge CDN**: Static files served from global edge locations
- **Build Caching**: Vercel caches builds for faster deployments
- **Asset Optimization**: Automatic compression and optimization
- **Database Connection Pooling**: Supabase handles connection management

This deployment architecture provides production-ready scalability while maintaining development simplicity.

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

### Development Issues

1. **Scraping Failures**: Often due to Letterboxd changes or rate limiting
2. **Authentication Errors**: Check token expiration and Supabase configuration
3. **Database Connection Issues**: Verify Supabase credentials and network access
4. **CORS Errors**: Ensure frontend URL is in allowed origins (now includes :5173, :5174)
5. **Vite Build Errors**: Check Tailwind content paths and environment variables
6. **Process Not Defined**: Use `import.meta.env.VITE_*` instead of `process.env.REACT_APP_*`
7. **Yarn Lock Conflicts**: Delete `package-lock.json` files if mixing npm/yarn

### Deployment Issues (Vercel)

#### 404 Not Found on Deployment

**Symptoms**: Site returns 404 for all routes after successful build
**Causes**:

- Routes in `vercel.json` pointing to wrong file locations
- Incorrect build output structure
  **Solutions**:
- Verify routes point to `/src/client/index.html`
- Check deployment file structure matches route configuration
- Ensure static build completes successfully

#### Static Assets Return 401/404 Errors

**Symptoms**: HTML loads but CSS, JS, images fail to load
**Causes**:

- Asset requests being routed to server function instead of static files
- Missing or incorrect asset route configuration
  **Solutions**:
- Add specific asset routes before catch-all route in `vercel.json`
- Verify asset paths match actual build output structure
- Test asset routes independently

#### Build Conflicts and Mysterious Files

**Symptoms**: Unexpected files in deployment output, build failures
**Causes**:

- Multiple `vercel.json` files creating conflicts
- Root TypeScript config compiling client files
- Root build script building both server and client
  **Solutions**:
- Remove any `vercel.json` files from subdirectories
- Create server-specific `tsconfig.json` in `src/server/`
- Update root build script to only compile server
- Let Vercel handle client build via `@vercel/static-build`

#### TypeScript Compilation Errors

**Symptoms**: Build fails with TypeScript errors from client files
**Causes**:

- Root `tsconfig.json` trying to compile entire `src/` directory
- Missing isolation between server and client TypeScript configs
  **Solutions**:
- Create dedicated `src/server/tsconfig.json`
- Update server config to only include server files
- Exclude client directory from server compilation

### Debug Information

- Enable verbose logging in development
- Check browser network tab for API call details
- Verify database records after scraping operations
- Monitor Supabase logs for authentication issues
- Review Vercel build logs for deployment issues
- Test routes individually using browser dev tools

---

This application demonstrates modern full-stack development practices with TypeScript, combining web scraping capabilities with a polished user interface for data analysis and comparison.
