# AynTrace

GPS tracking and fleet management platform. PFE academic project.

---

## 📸 Platform Overview

<div align="center">
  <p><strong>Main Platform Overview</strong></p>
  <img src="public/screenshots/image170.png" alt="AynTrace Main Platform Banner" width="100%"/>
  <br/><br/>
  <p><strong>Live GPS Tracking & Fleet Map</strong></p>
  <img src="public/screenshots/image166.png" alt="Live GPS Tracking & Fleet Map" width="100%"/>
  <br/><br/>
  <p><strong>Dashboard & Device Monitoring</strong></p>
  <img src="public/screenshots/image120.png" alt="AynTrace Dashboard & Live Tracking" width="49%"/>
  <img src="public/screenshots/image123.png" alt="Fleet Map & Real-Time Monitoring" width="49%"/>
  <br/><br/>
  <p><strong>Analytics & Fleet Operations</strong></p>
  <img src="public/screenshots/image171.png" alt="Analytics & Statistics" width="49%"/>
  <img src="public/screenshots/image164.png" alt="Device & Fleet Management" width="49%"/>
  <br/><br/>
  <p><strong>Geofencing, Security & Settings</strong></p>
  <img src="public/screenshots/image086.png" alt="Geofence Management" width="49%"/>
  <img src="public/screenshots/image141.png" alt="Security & Audit Logs" width="49%"/>
</div>

---

## 🚀 Option 1: Run with Docker (Easiest — No PostgreSQL installation needed)

Requires **Docker Desktop**. The database, backend, and frontend start automatically with demo data.

```bash
# 1. Clone the repository
git clone https://github.com/Achraflgu/AynTrace.git
cd AynTrace

# 2. Start all services
docker compose up --build
```

- **Application UI:** http://localhost
- **Backend API:** http://localhost/api
- **Health check:** http://localhost/api/health

---

## 💻 Option 2: Run Locally (Node.js + Local PostgreSQL)

**Prerequisites:** Node.js 20+ and PostgreSQL 14+ installed and running locally.

```bash
# 1. Clone the repository
git clone https://github.com/Achraflgu/AynTrace.git
cd AynTrace

# 2. Install dependencies (Root + Server)
npm install
cd server && npm install && cd ..

# 3. Set up environment file
cp server/.env.example server/.env
# Edit server/.env if your local PostgreSQL user/password differ

# 4. Create database, tables, and demo data automatically
npm run db:setup

# 5. Start frontend & backend together
npm run dev:all
```

- **Frontend:** http://localhost:8080
- **Backend API:** http://localhost:3001

---

## 🔑 Demo Accounts

| Role       | Email                          | Password          |
|------------|--------------------------------|-------------------|
| Admin      | `ach45gu14@gmail.com`          | `PFE-Admin-6B2794` |
| Operator   | `achrafguemati557@gmail.com`   | `PFE-Oper-8C15B7`  |
| Supervisor | `supervisor@ayntrace.tn`       | `PFE-Super-C20650` |

---

## 📁 Project Structure

```
src/              React frontend (Vite + TypeScript + Tailwind CSS)
server/           Express backend (Node.js + Knex + PostgreSQL)
server/routes/    API routes
server/db/        Database migrations and seed scripts
server/simulation/GPS simulation engine
tracker-page/     External GPS tracker page
cypress/          E2E tests
```

---

## 🛠️ Available Commands

| Command              | Description                        |
|----------------------|------------------------------------|
| `npm run dev:all`    | Start frontend + backend together  |
| `npm run db:setup`   | Create database + tables + demo data |
| `npm run build`      | Build frontend for production      |
| `npm run dev`        | Start frontend only                |
| `npm run db:migrate` | Create database tables only        |
| `npm run db:seed`    | Seed demo data only                |

---

## ⚡ Technologies

**Frontend:** React, TypeScript, Vite, Tailwind CSS, Leaflet, shadcn/ui, Zustand, React Query

**Backend:** Node.js, Express, Knex, PostgreSQL, WebSocket, JWT
