# AynTrace

GPS tracking and fleet management platform. PFE academic project.

## Quick Start

**Prerequisites:** Node.js 20+, PostgreSQL 14+

```bash
# 1. Install all dependencies
npm install
cd server && npm install && cd ..

# 2. Set up environment
cp server/.env.example server/.env
# Edit server/.env if your PostgreSQL credentials differ

# 3. Create database tables and demo data
npm run db:setup

# 4. Start both frontend and backend
npm run dev:all
```

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3001
- **Health check:** http://localhost:3001/api/health

## Demo Accounts

| Role       | Email                          | Password          |
|------------|--------------------------------|-------------------|
| Admin      | ach45gu14@gmail.com            | PFE-Admin-6B2794  |
| Operator   | achrafguemati557@gmail.com     | PFE-Oper-8C15B7   |
| Supervisor | supervisor@ayntrace.tn         | PFE-Super-C20650  |

## Docker

```bash
docker compose up --build
```

- **App:** http://localhost
- **API:** http://localhost/api

## Project Structure

```
src/              React frontend (Vite + TypeScript + Tailwind CSS)
server/           Express backend (Node.js + Knex + PostgreSQL)
server/routes/    API routes
server/db/        Database migrations and scripts
server/simulation/GPS simulation engine
tracker-page/     External GPS tracker page
public/           Static assets
cypress/          E2E tests
```

## Available Commands

| Command              | Description                        |
|----------------------|------------------------------------|
| `npm run dev`        | Start frontend only                |
| `npm run dev:all`    | Start frontend + backend together  |
| `npm run build`      | Build frontend for production      |
| `npm run db:setup`   | Create tables + seed demo data     |
| `npm run db:migrate` | Create database tables only        |
| `npm run db:seed`    | Seed demo data only                |

## Technologies

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Leaflet, shadcn/ui, Zustand, React Query

**Backend:** Node.js, Express, Knex, PostgreSQL, WebSocket, JWT

## Notes

- The WebSocket server runs on path `/ws`
- GPS simulation sends updates every 5 seconds by default
- Optional Cloudflare tunnel: `npm run dev` in `server/` (requires `cloudflared` in PATH or set `CLOUDFLARED_PATH` env var)
- n8n and Ollama integrations are optional and disabled by default
