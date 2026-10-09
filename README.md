# RonoJobs REST API Backend

RonoJobs Hiring Platform backend service built with Node.js, Express, TypeScript, and PostgreSQL.

## Features
- Complete Authentication with JWT & Role-Based Access Control (RBAC)
- Candidate and Employer Profile Management
- Job Postings & Public Filter/Search API
- Application Lifecycle Management
- PostgreSQL Database Integration
- Automated QA Test Suite (14 End-to-End Test Cases)

---

## Getting Started

### 1. Prerequisites
- Node.js (v18 or higher)
- PostgreSQL database

### 2. Installation
```bash
npm install
```

### 3. Environment Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Update your database credentials and secret key in `.env`.

### 4. Database Setup & Seeding
To run migrations and populate sample test jobs/categories:
```bash
npm run db:setup
```

### 5. Running Automated QA Tests
```bash
npm test
```
*Executes all 14 automated QA test cases verifying system health, authentication security, role guarding, search/filter APIs, and the full employer job lifecycle.*

### 6. Running the Development Server (for Postman / Manual Testing)
```bash
npm run dev
```
The server will start on `http://localhost:5000`.
All API routes are mounted at `/api/v1`.

---

## API Endpoints Overview
- **Health Check:** `GET /api/v1/health`
- **Auth:** `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`
- **Jobs:** `GET /api/v1/jobs`, `GET /api/v1/jobs/:id`, `POST /api/v1/jobs`, `PUT /api/v1/jobs/:id`, `DELETE /api/v1/jobs/:id`
- **Applications:** `GET /api/v1/applications`, `POST /api/v1/jobs/:id/apply`
- **Employer:** `GET /api/v1/employer/jobs`, `GET /api/v1/employer/stats`
- **Metadata:** `GET /api/v1/meta/skills`, `GET /api/v1/meta/categories`
