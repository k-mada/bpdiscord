# BPDiscord

A full-stack TypeScript web application for scraping and analyzing Letterboxd user rating data. Features user comparison tools, hater rankings, and comprehensive rating statistics with a modern React frontend and Express.js backend.

## Project Overview

BPDiscord provides powerful tools for analyzing Letterboxd movie rating data:

- **User Comparison**: Compare rating statistics between any two users
- **Hater Rankings**: Rank users by average rating (lowest = biggest "hater")
- **Profile Analysis**: Display user profiles with followers, following, and lists
- **Rating Distributions**: Visual histograms of rating patterns
- **Data Scraping**: Automated extraction of Letterboxd profile data

## Project Structure

```
bpdiscord/
├── src/
│   ├── server/           # Backend API (Express + TypeScript)
│   │   ├── config/       # Database and Supabase configuration
│   │   ├── controllers/  # Business logic controllers
│   │   │   ├── authController.ts
│   │   │   ├── comparisonController.ts
│   │   │   ├── dataController.ts        # Database operations
│   │   │   ├── filmUserController.ts    # Database-first user operations
│   │   │   ├── scraperController.ts     # Force-scraping endpoints (module exports)
│   │   │   └── userController.ts
│   │   ├── middleware/   # Authentication, validation, error handling
│   │   ├── routes/       # API route definitions
│   │   │   ├── authRoutes.ts
│   │   │   ├── comparisonRoutes.ts
│   │   │   ├── filmUserRoutes.ts        # Database-first endpoints
│   │   │   ├── scraperRoutes.ts         # Force-scraping endpoints
│   │   │   └── userRoutes.ts
│   │   ├── scraperFunctions.ts # Core scraping logic (browser, page management)
│   │   ├── utilities.ts  # Helper functions and parsers
│   │   ├── constants.ts  # Configuration constants
│   │   ├── types.ts      # Server-specific TypeScript definitions
│   │   ├── server.ts     # Main server file
│   │   ├── package.json  # Server dependencies
│   │   └── dist/         # Compiled TypeScript output
│   ├── client/           # Frontend (Vite + React + TypeScript)
│   │   ├── components/   # React components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── HaterRankings.tsx
│   │   │   ├── UserComparison.tsx
│   │   │   ├── PublicUserComparison.tsx
│   │   │   ├── ScraperInterface.tsx
│   │   │   └── UserProfile.tsx
│   │   ├── services/     # API service layer
│   │   ├── types.ts      # Client-specific TypeScript definitions
│   │   ├── index.tsx     # Main React app entry point
│   │   ├── vite.config.js # Vite configuration
│   │   ├── tailwind.config.js # Tailwind CSS configuration
│   │   ├── package.json  # Client dependencies
│   │   └── build/        # Vite build output
├── CLAUDE.md            # Comprehensive technical documentation
├── package.json         # Root orchestration + shared dependencies
├── vercel.json          # Deployment configuration
└── tsconfig.json       # TypeScript configuration
```

## Features

### Public Features (No Authentication Required)

#### User Comparison (`/compare`)

- Compare rating statistics between any two Letterboxd users
- Side-by-side profile metrics (followers, following, lists, total films)
- Visual rating distribution comparison with percentages
- Highlighting of higher values for easy comparison

#### Hater Rankings (`/hater-rankings`)

- Rank all users by average movie rating (lowest first)
- Visual rating distribution histograms
- Trophy icon for the biggest "hater" (lowest average rating)
- Display names with username fallbacks

### Protected Features (Authentication Required)

#### Dashboard (`/dashboard`)

- **Profile Management**: View and manage user account
- **Data Fetcher**: Scrape Letterboxd user data
- **Enhanced Comparison**: Full comparison tools
- **Private Rankings**: Authenticated hater rankings view

#### Data Scraping

- Extract user rating distributions from Letterboxd profiles
- Scrape user profile data (display name, followers, following, lists)
- Get complete film lists with ratings
- Database storage with intelligent upserts

### Backend API

#### Authentication & Security

- JWT token-based authentication via Supabase
- Row Level Security (RLS) with service role bypass
- Rate limiting (100 requests/15min general, 20 requests/15min scraping)
- CORS protection and security headers
- Input validation and sanitization

#### Web Scraping

- Puppeteer browser automation for data extraction
- Cheerio HTML parsing for structured data extraction
- Retry mechanisms and error handling
- Data validation and normalization

### Frontend

#### Modern React Application

- TypeScript for type safety
- Tailwind CSS for responsive design
- React Router for navigation
- Local storage for authentication state
- Real-time feedback and loading states

#### User Experience

- Responsive design for mobile and desktop
- Visual highlighting of comparison data
- Interactive histograms and charts
- Progressive enhancement with fallbacks

## Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- Supabase account and project

## Environment Variables

### Backend (.env)

Create a `.env` file in the project root:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
NODE_ENV=development
CRON_SECRET=your_random_secret_key  # For manual cron triggers
```

### Frontend (.env)

Create a `.env` file in `src/client/`:

```env
# VITE_API_URL=/api  # Uses proxy in development, override for production
VITE_HOT_RELOAD=true
```

### Security Notice

⚠️ **Important**: Never commit your `.env` files to version control! Both `.env` files are in `.gitignore`.

For production deployment, use environment variables. See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

## Installation

### Quick Install (All Dependencies)

```bash
yarn install:all
```

### Manual Installation

#### 1. Install Root Dependencies

```bash
yarn install
```

#### 2. Install Server Dependencies

```bash
cd src/server
yarn install
cd ../..
```

#### 3. Install Client Dependencies

```bash
cd src/client
yarn install
cd ../..
```

### Database Setup

1. Create a Supabase project
2. Set up the required tables:

#### Users Table

```sql
CREATE TABLE "Users" (
  "lbusername" VARCHAR PRIMARY KEY,
  "display_name" VARCHAR,
  "followers" INTEGER DEFAULT 0,
  "following" INTEGER DEFAULT 0,
  "number_of_lists" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

#### UserRatings Table

```sql
CREATE TABLE "UserRatings" (
  "username" VARCHAR,
  "rating" DECIMAL(2,1),
  "count" INTEGER,
  "created_at" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY ("username", "rating")
);
```

3. Configure Row Level Security (RLS) policies as needed
4. Note your service role key for admin operations

## Running the Application

### Development Mode

#### Option 1: Start Both (Concurrent - Recommended)

```bash
yarn dev
```

- Server runs on `http://localhost:3001`
- Client runs on `http://localhost:5173` (or 5174 if 5173 is in use)

#### Option 2: Start Individually

**Start the Server**

```bash
yarn dev:server
```

Server runs on `http://localhost:3001`

**Start the Client (new terminal)**

```bash
yarn dev:client
```

Client runs on `http://localhost:5173`

### Production Mode

#### Build and Start

```bash
# Build both server and client
yarn build

# Or build individually
yarn build:server
yarn build:client

# Start production server
yarn start
```

## API Endpoints

### Public Endpoints

#### Film User API (`/api/film-users`) - Database-First

- `GET /` - Get all users with display names
- `GET /:username/ratings` - Get user's ratings (database only)
- `GET /:username/profile` - Get user's profile (database only)
- `GET /:username/complete` - Get complete user data (database only)
- Add `?fallback=scrape` to any endpoint to scrape if data missing

#### Comparison API (`/api/comparison`)

- `GET /usernames` - Get list of users with display names
- `POST /user-ratings` - Get user's ratings and profile data
- `POST /compare` - Compare two users' data
- `GET /hater-rankings` - Get all users ranked by average rating

### Protected Endpoints (Require Authentication)

#### Authentication (`/api/auth`)

- `POST /signup` - User registration
- `POST /login` - User login
- `POST /logout` - Session termination
- `POST /password-reset` - Password reset

#### Scraper API (`/api/scraper`) - Force-Scraping Only

- `POST /getUserRatings` - Force scrape user's rating distribution
- `POST /getUserProfile` - Force scrape complete profile + ratings
- `POST /getAllFilms` - Force scrape user's film list
- `POST /getData` - Generic scraping with custom selectors
- **Note**: Disabled in production unless `ENABLE_SCRAPER=true`

#### Cron API (`/api/cron`) - Automated Data Refresh

- `POST /refresh-all-users` - Refresh all users' data from Letterboxd
- `POST /refresh-user/:username` - Refresh specific user's data
- **Authentication**: Vercel Cron header or Bearer token
- **Schedule**: Daily at 2 AM (configurable in vercel.json)

#### User Management (`/api/users`)

- `GET /` - Get all users
- `GET /me` - Get current user profile
- `GET /:id` - Get specific user
- `PUT /:id` - Update user
- `DELETE /:id` - Delete user

### Health Check

- `GET /api/health` - Server status

## Usage

### Public Access

1. Visit `http://localhost:5173/compare` for user comparison
2. Visit `http://localhost:5173/hater-rankings` for rankings
3. No authentication required for public features

### Authenticated Access

1. Start the application (see Running section)
2. Navigate to `http://localhost:5173` (redirects to login)
3. Sign up or log in to access dashboard
4. Use the Data Fetcher to scrape Letterboxd profiles
5. View comparisons and rankings with your data

### Testing Cron Job Endpoints

The cron endpoints allow automated data refresh for all users. Here's how to test them:

#### Prerequisites

1. Make sure you have a `CRON_SECRET` in your `.env` file:
   ```bash
   CRON_SECRET=your_random_secret_key
   ```

2. Generate a secure secret (optional):
   ```bash
   # Using OpenSSL (Mac/Linux)
   openssl rand -base64 32

   # Or using Node.js
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

#### Testing in Development

**1. Start the development server:**
```bash
yarn dev:server
```

**2. Test refresh all users:**
```bash
curl -X POST http://localhost:3001/api/cron/refresh-all-users \
  -H "Authorization: Bearer your_cron_secret" \
  -H "Content-Type: application/json"
```

**3. Test refresh specific user:**
```bash
curl -X POST http://localhost:3001/api/cron/refresh-user/username \
  -H "Authorization: Bearer your_cron_secret" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "message": "Refresh completed",
  "duration": "45.23s",
  "results": {
    "totalUsers": 5,
    "success": 5,
    "failed": 0,
    "skipped": 0,
    "errors": []
  }
}
```

#### Testing in Production (Vercel)

**1. Set `CRON_SECRET` in Vercel Dashboard:**
- Go to your project → Settings → Environment Variables
- Add `CRON_SECRET` with a secure value
- Redeploy if needed

**2. Test the production endpoint:**
```bash
curl -X POST https://your-app.vercel.app/api/cron/refresh-all-users \
  -H "Authorization: Bearer your_cron_secret" \
  -H "Content-Type: application/json"
```

**3. Check Vercel Logs:**
- Go to your project dashboard
- Click **Functions** or **Logs**
- Look for `/api/cron/refresh-all-users` executions
- View detailed logs including:
  - Start time and duration
  - Success/failure counts
  - Individual user refresh status
  - Any error messages

#### Automatic Cron Execution (Production Only)

Once deployed to Vercel (Pro plan or higher):

1. **Cron runs automatically** at the scheduled time (default: 2 AM UTC daily)
2. **No authentication needed** - Vercel adds the `x-vercel-cron-signature` header automatically
3. **View cron status:**
   - Vercel Dashboard → Your Project → Settings → Cron Jobs
   - See scheduled jobs, last run time, and execution history

#### Monitoring Cron Job Results

**View detailed logs:**
```bash
# In development - check terminal output
yarn dev:server

# In production - check Vercel logs:
# 1. Vercel Dashboard → Your Project → Functions
# 2. Filter by "/api/cron/refresh-all-users"
# 3. Click any execution to see full logs
```

**Log output includes:**
```
=== Starting scheduled refresh of all users ===
Found 5 users to refresh
[1/5] Refreshing data for: username1
[1/5] ✓ Successfully refreshed username1
[2/5] Refreshing data for: username2
...
=== Refresh Summary ===
Total users: 5
✓ Success: 5
✗ Failed: 0
Duration: 45.23s
```

#### Troubleshooting

**401 Unauthorized Error:**
- Check that `CRON_SECRET` matches in `.env` and your request
- Ensure the `Authorization` header is formatted correctly: `Bearer your_secret`

**Timeout Errors:**
- Vercel Hobby plan has 10-second timeout (won't work for many users)
- Vercel Pro plan has 300-second timeout (5 minutes)
- Consider reducing the number of users or optimizing scraping

**Rate Limiting:**
- The refresh includes 2-second delays between users to avoid being blocked
- If you have many users, the process will take time
- Monitor logs to see progress

## Data Processing

### Scraping Architecture

The scraping system is organized into modular, reusable components:

#### Core Scraping Functions (`scraperFunctions.ts`)

- **Browser Management**: Shared browser instances with automatic cleanup
- **Page Creation**: Optimized Puppeteer page setup with stealth measures
- **User Profile Scraping**: Extract display name, followers, following, lists
- **Rating Scraping**: Parse rating histogram from user profile
- **Film Scraping**: Multi-page film list extraction with progress tracking
- **Memory Management**: Aggressive cleanup and garbage collection

#### Utility Functions (`utilities.ts`)

- **parseStarRating()**: Self-contained star rating parser (works in browser context)
- **detectLikedStatus()**: Detect liked films from DOM structure
- **parseNumberFromText()**: Handle K/M suffixes (1.2K → 1200)
- **validateUserProfile()**: Verify page content and detect 404s
- **Data Formatters**: Consistent API response formatting

#### Configuration (`constants.ts`)

- **LETTERBOXD_SELECTORS**: CSS selectors for Letterboxd elements
- **BROWSER_CONFIG**: Timeouts, delays, and resource limits
- **STAR_PATTERNS**: Star rating patterns for parsing
- **BLOCKED_RESOURCES**: Resources to block for performance

### Scraping Algorithm

1. **Input Validation**: Verify Letterboxd username format
2. **Browser Launch**: Shared Puppeteer browser with stealth configuration
3. **Page Navigation**: Load user's Letterboxd profile with retry strategies
4. **Data Extraction**: Parse HTML using CSS selectors (Cheerio or browser context)
5. **Data Validation**: Ensure extracted data is valid and complete
6. **Database Storage**: Upsert data with conflict resolution
7. **Cleanup**: Close pages and manage memory

### Rating Calculations

- **Average Rating**: Σ(rating × count) / Σ(count)
- **Percentage Distribution**: (count / total) × 100
- **Hater Rankings**: Sort by ascending average rating

### Number Parsing

- Handles abbreviated formats: "1.2K" → 1200, "2.5M" → 2500000
- Removes commas and normalizes text
- Graceful fallback to 0 for invalid data

## Development

### Available Scripts

#### Root Scripts

- `yarn dev` - Start both server and client concurrently
- `yarn build` - Build both server and client
- `yarn build:server` - Build server only
- `yarn build:client` - Build client only
- `yarn start` - Start production server
- `yarn install:all` - Install all dependencies
- `yarn clean` - Clean build directories

#### Server Scripts (run from src/server/)

- `yarn dev` - Development server with hot reload
- `yarn build` - Build TypeScript to JavaScript
- `yarn start` - Start production server
- `yarn watch` - Build in watch mode
- `yarn clean` - Clean build directory

#### Client Scripts (run from src/client/)

- `yarn dev` - Vite development server with hot reload
- `yarn build` - Build for production with Vite
- `yarn preview` - Preview production build locally

### Code Organization

#### Backend Architecture

- **Controllers**: Handle business logic and HTTP request/response
  - **scraperController.ts**: Force-scraping endpoints (module exports pattern)
  - **filmUserController.ts**: Database-first operations with fallback
  - **dataController.ts**: Database CRUD operations
  - **comparisonController.ts**: User comparison logic
- **Core Modules**:
  - **scraperFunctions.ts**: Browser automation, page management, scraping logic
  - **utilities.ts**: Helper functions (parsers, validators, formatters)
  - **constants.ts**: Configuration constants (selectors, timeouts, patterns)
- **Routes**: Define API endpoints and middleware
- **Middleware**: Authentication, validation, error handling
- **Types**: Shared TypeScript interfaces

#### Frontend Architecture

- **Components**: Reusable React components
- **Services**: API client and utility functions
- **Types**: Client-specific TypeScript definitions

## Technologies Used

### Backend

- **Express.js** - Web framework
- **TypeScript** - Type safety and modular architecture
- **Supabase** - PostgreSQL database and authentication
- **Puppeteer** - Browser automation for web scraping
- **Cheerio** - Server-side HTML parsing
- **JWT** - Authentication tokens
- **Helmet** - Security headers
- **Express Rate Limit** - API rate limiting
- **@sparticuz/chromium** - Serverless Chrome for Vercel deployment

### Frontend

- **Vite** - Fast build tool and dev server
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **Heroicons** - Icon library

### Database

- **PostgreSQL** (via Supabase) - Primary database
- **Row Level Security** - Data access control
- **Real-time subscriptions** - Live data updates

## Error Handling

### Backend

- Global error middleware with structured responses
- Retry mechanisms for scraping failures
- Graceful degradation for external service issues
- Detailed logging for debugging

### Frontend

- Error boundaries for React component errors
- User-friendly error messages
- Loading states and retry options
- Fallback UI for missing data

## Performance Optimizations

- **Database**: Efficient indexes and parallel queries
- **Frontend**: Component memoization and lazy loading
- **Scraping**: Resource blocking and browser reuse
- **API**: Rate limiting and response caching
- **Modular Architecture**: Separated scraping logic into reusable functions

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Deployment to Vercel

### Full-Stack Deployment Configuration

This project is configured for Vercel deployment with both frontend and backend. Here's the complete setup:

#### Project Structure for Deployment

```
project/
├── package.json              # Root orchestration
├── vercel.json               # Deployment configuration
├── tsconfig.json             # Root TypeScript config
└── src/
    ├── client/               # Frontend (React/Vite)
    │   ├── package.json
    │   ├── vite.config.js
    │   └── build/            # Generated by Vite
    └── server/               # Backend (Express/Node)
        ├── package.json
        ├── tsconfig.json     # Server-specific config
        └── dist/             # Generated by TypeScript
```

#### Critical Configuration Files

**1. Root `package.json` Build Script**

```json
{
  "scripts": {
    "build": "cd src/server && tsc"
  }
}
```

**Important**: Root build script should ONLY build the server. Vercel handles client building separately.

**2. Server `tsconfig.json` (`src/server/tsconfig.json`)**

```json
{
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./"
    // ... other options
  },
  "include": ["./**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Critical**: Server needs its own `tsconfig.json` to prevent compiling client files.

#### Route Configuration Explained

Routes are processed **in order**:

1. **API Routes** (`/api/(.*)`) → Server function
2. **Asset Routes** (`/assets/(.*)`) → Static files
3. **Specific Static Files** → favicon, manifest, etc.
4. **Catch-All** (`/(.*)`) → React app (SPA routing)

#### Common Deployment Issues and Solutions

**Problem: 404 Errors on Deployment**

- **Cause**: Routes pointing to wrong file locations
- **Solution**: Ensure routes match actual build output structure (`/src/client/index.html`)

**Problem: Static Assets Getting 401/404 Errors**

- **Cause**: All requests routed to index.html instead of serving static files
- **Solution**: Add specific routes for assets before catch-all route

**Problem: Build Conflicts**

- **Cause**: Multiple `vercel.json` files or incorrect TypeScript compilation scope
- **Solution**:
  - Remove any `vercel.json` files from subdirectories
  - Ensure server has its own `tsconfig.json`
  - Root build script should only build server

**Problem: Mysterious Build Artifacts**

- **Cause**: Root build script building both client and server
- **Solution**: Let Vercel handle client build via `@vercel/static-build`

#### Deployment Process

1. **Root Build**: `yarn build` → Compiles server TypeScript only
2. **Client Build**: Vercel runs `@vercel/static-build` → Builds React app separately
3. **Deployment**: Routes configured to serve from correct locations

#### Environment Variables for Production

Set these in your Vercel dashboard:

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
NODE_ENV=production
ENABLE_SCRAPER=true  # Optional: Enable scraping in production
CRON_SECRET=your_random_secret_key  # For manual cron triggers (optional)
```

#### Verification Steps

1. **Check build logs**: No conflicting configurations mentioned
2. **Verify file structure**: Static files in expected locations
3. **Test routes**: API calls work, static assets load, SPA routing works
4. **No build artifacts**: Clean deployment output

This configuration enables true full-stack deployment where both frontend and backend are deployed from a single repository while maintaining proper separation and build processes.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive technical documentation
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide

## License

MIT License - see LICENSE file for details
