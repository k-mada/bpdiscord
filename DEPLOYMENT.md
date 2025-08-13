# Deployment Guide

## Environment Variables Security

### Development

1. Copy `.env.example` to `.env`
2. Fill in your actual values in `.env`
3. Never commit `.env` to version control

### Production

**Never use .env files in production!** Instead, set environment variables through your deployment platform:

#### Heroku

```bash
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
heroku config:set JWT_SECRET=your_jwt_secret
```

#### Vercel

```bash
vercel env add SUPABASE_URL
vercel env add SUPABASE_ANON_KEY
vercel env add JWT_SECRET
```

#### Docker

```bash
docker run -e SUPABASE_URL=your_url -e SUPABASE_ANON_KEY=your_key your-app
```

#### System Environment

```bash
export SUPABASE_URL=your_supabase_url
export SUPABASE_ANON_KEY=your_supabase_anon_key
export JWT_SECRET=your_jwt_secret
```

## Required Environment Variables

### Server (.env)

```
PORT=3001
NODE_ENV=development
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret
```

### Client (.env)

```
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_SUPABASE_URL=your_supabase_url
REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Security Checklist

- [ ] `.env` file is in `.gitignore`
- [ ] `.env.example` shows required variables without real values
- [ ] Production uses system environment variables, not .env files
- [ ] Sensitive keys are rotated regularly
- [ ] Database connections use SSL in production
- [ ] API keys have minimal required permissions
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured for production domains

## Build Process

### Development

```bash
npm run dev          # Start server with hot reload
npm run dev:client   # Start client with hot reload
```

### Production

```bash
npm run build        # Build server
cd src/client && npm run build  # Build client
npm start            # Start production server
```

## File Structure Security

```
project/
├── .env              # ❌ Never commit this
├── .env.example      # ✅ Safe to commit
├── .gitignore        # ✅ Must include .env
├── src/
│   ├── server/       # ✅ Server code
│   └── client/       # ✅ Client code
└── dist/             # ❌ Build output (in .gitignore)
```
