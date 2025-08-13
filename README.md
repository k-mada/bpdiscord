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
│   │   │   ├── dataController.ts
│   │   │   ├── scraperController.ts
│   │   │   └── userController.ts
│   │   ├── middleware/   # Authentication, validation, error handling
│   │   ├── routes/       # API route definitions
│   │   ├── types/        # TypeScript type definitions
│   │   └── server.ts     # Main server file
│   ├── client/           # Frontend (React + TypeScript)
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── HaterRankings.tsx
│   │   │   │   ├── UserComparison.tsx
│   │   │   │   ├── PublicUserComparison.tsx
│   │   │   │   ├── ScraperInterface.tsx
│   │   │   │   └── UserProfile.tsx
│   │   │   ├── services/    # API service layer
│   │   │   └── App.tsx      # Main React app with routing
│   │   └── package.json     # Client dependencies
│   └── shared/           # Shared types between client/server
├── CLAUDE.md            # Comprehensive technical documentation
├── package.json         # Server dependencies
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

- Node.js (v16 or higher)
- npm or yarn
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
```

### Frontend (.env)

Create a `.env` file in `src/client/`:

```env
REACT_APP_API_URL=http://localhost:3001/api
```

### Security Notice

⚠️ **Important**: Never commit your `.env` files to version control! Both `.env` files are in `.gitignore`.

For production deployment, use environment variables. See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

## Installation

### 1. Install Server Dependencies

```bash
npm install
```

### 2. Install Client Dependencies

```bash
cd src/client
npm install
cd ../..
```

### 3. Database Setup

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

#### Start the Server
```bash
npm run dev
```
Server runs on `http://localhost:3001`

#### Start the Client (new terminal)
```bash
npm run dev:client
```
Client runs on `http://localhost:3000`

### Production Mode

#### Build and Start
```bash
# Build both server and client
npm run build
npm run build:client

# Start production server
npm start
```

## API Endpoints

### Public Endpoints

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

#### Scraper API (`/api/scraper`)
- `POST /getUserRatings` - Scrape user's rating distribution
- `POST /getUserProfile` - Scrape complete profile + ratings
- `POST /getAllFilms` - Scrape user's film list
- `POST /getData` - Generic scraping with custom selectors

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
1. Visit `http://localhost:3000/compare` for user comparison
2. Visit `http://localhost:3000/hater-rankings` for rankings
3. No authentication required for public features

### Authenticated Access
1. Start the application (see Running section)
2. Navigate to `http://localhost:3000` (redirects to login)
3. Sign up or log in to access dashboard
4. Use the Data Fetcher to scrape Letterboxd profiles
5. View comparisons and rankings with your data

## Data Processing

### Scraping Algorithm
1. **Input Validation**: Verify Letterboxd username format
2. **Browser Launch**: Automated Puppeteer browser session
3. **Page Navigation**: Load user's Letterboxd profile
4. **Data Extraction**: Parse HTML using CSS selectors
5. **Data Validation**: Ensure extracted data is valid
6. **Database Storage**: Upsert data with conflict resolution

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

#### Server
- `npm run dev` - Development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run watch` - Build in watch mode
- `npm run clean` - Clean build directory

#### Client
- `npm run dev:client` - Development server with hot reload
- `npm run build:client` - Build for production

### Code Organization

- **Controllers**: Handle business logic and database operations
- **Routes**: Define API endpoints and middleware
- **Middleware**: Authentication, validation, error handling
- **Types**: Shared TypeScript interfaces
- **Components**: Reusable React components
- **Services**: API client and utility functions

## Technologies Used

### Backend
- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Supabase** - PostgreSQL database and authentication
- **Puppeteer** - Browser automation
- **Cheerio** - HTML parsing
- **JWT** - Authentication tokens
- **Helmet** - Security headers
- **Express Rate Limit** - API rate limiting

### Frontend
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

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Comprehensive technical documentation
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide

## License

MIT License - see LICENSE file for details

## Troubleshooting

### Common Issues

1. **Scraping Failures**: Usually due to Letterboxd changes or rate limiting
2. **Authentication Errors**: Check Supabase configuration and token expiration
3. **Database Errors**: Verify Supabase credentials and RLS policies
4. **CORS Issues**: Ensure frontend URL is in allowed origins

### Debug Information

- Enable verbose logging in development mode
- Check browser network tab for API request details
- Monitor Supabase dashboard for database and auth logs
- Verify environment variables are properly set