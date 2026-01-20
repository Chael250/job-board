# Job Board Backend

NestJS backend API for the Job Board Application.

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- Redis (v6 or higher)

## Installation

```bash
npm install
```

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Update the `.env` file with your database and Redis credentials.

## Database Setup

1. Create a PostgreSQL database named `job_board`
2. Run migrations:
```bash
npm run migration:run
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## API Documentation

The API will be available at `http://localhost:3001/api/v1`

### Health Check
- `GET /api/v1/health` - Returns API health status

## Project Structure

```
src/
├── auth/           # Authentication module
├── users/          # User management module
├── jobs/           # Job listing module
├── applications/   # Job application module
├── files/          # File storage module
├── notifications/  # Email notification module
├── admin/          # Admin management module
├── common/         # Shared utilities and types
├── config/         # Configuration files
└── migrations/     # Database migrations
```

## Environment Variables

See `.env.example` for all available configuration options.

## Security Features

- JWT authentication with refresh tokens
- Rate limiting
- Input validation and sanitization
- Security headers with Helmet
- CORS configuration
- Password hashing with bcrypt