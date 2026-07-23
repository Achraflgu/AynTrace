import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db/knex.js';

import devicesRouter from './routes/devices.js';
import enterprisesRouter from './routes/enterprises.js';
import usersRouter from './routes/users.js';
import statsRouter from './routes/stats.js';
import trackRouter from './routes/track.js';
import alertsRouter from './routes/alerts.js';
import auditRouter from './routes/audit.js';
import authRouter from './routes/auth.js';
import supportRouter from './routes/support.js';
import ordersRouter from './routes/orders.js';
import chatRouter from './routes/chat.js';
import geofencesRouter from './routes/geofences.js';
import dashboardChatRouter from './routes/dashboardChat.js';
import billingRouter, { performBillingCheck } from './routes/billing.js';
import notificationRulesRouter from './routes/notificationRules.js';
import pricingRouter from './routes/pricing.js';
import { startSimulation, registerClient, broadcast } from './simulation/engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: '*',
    credentials: true
}));
app.use(express.json());

// Serve tracker page as static files
app.use('/tracker', express.static(path.join(__dirname, '../tracker-page')));

// API Routes
app.use('/api/devices', devicesRouter);
app.use('/api/enterprises', enterprisesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/users', usersRouter);
app.use('/api/track', trackRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/auth', authRouter);
app.use('/api/support', supportRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/chat', chatRouter);
app.use('/api/geofences', geofencesRouter);
app.use('/api/dashboard-chat', dashboardChatRouter);
app.use('/api/billing', billingRouter);
app.use('/api/notification-rules', notificationRulesRouter);
app.use('/api/pricing', pricingRouter);

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await db.raw('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date(), database: 'connected (PostgreSQL)' });
    } catch (e) {
        res.json({ status: 'error', timestamp: new Date(), database: 'disconnected' });
    }
});

// Config endpoint
app.get('/api/config', (req, res) => {
    res.json({
        trackerUrl: process.env.TRACKER_URL || `http://localhost:${PORT}`,
        apiUrl: `http://localhost:${PORT}`
    });
});

// Start server
async function startServer() {
    try {
        // Test PostgreSQL connection
        console.log('[PostgreSQL] Connecting...');
        await db.raw('SELECT 1');
        console.log('[PostgreSQL] Connected successfully ✅');

        const server = http.createServer(app);

        // WebSocket server
        const wss = new WebSocketServer({ server, path: '/ws' });
        wss.on('connection', (ws) => {
            console.log('[WebSocket] Client connected');
            registerClient(ws);
            ws.on('close', () => console.log('[WebSocket] Client disconnected'));
        });

        server.listen(PORT, () => {
            console.log(`[Server] Running on http://localhost:${PORT}`);
            const trackerUrl = process.env.TRACKER_URL || `http://localhost:${PORT}`;
            console.log(`[Tracker] Available at ${trackerUrl}/tracker/`);
            startSimulation(5000);
        });

    } catch (error) {
        console.error('[Server] Failed to start:', error);
        process.exit(1);
    }
}

startServer().then(() => {
    // ── Billing Scheduler (runs every hour) ──────────────────────────────────
    const runBillingCheck = async () => {
        try {
            const { warned, renewed, suspended } = await performBillingCheck();
            if (warned > 0 || renewed > 0 || suspended > 0) {
                console.log(`[Billing Scheduler] ⚠️ ${warned} warned | 🔄 ${renewed} renewed | 🔴 ${suspended} expired & suspended`);
            }
        } catch (err) {
            console.error('[Billing Scheduler] Error:', err.message);
        }
    };

    // Run immediately on startup, then every hour
    runBillingCheck();
    setInterval(runBillingCheck, 60 * 60 * 1000);
    console.log('[Billing Scheduler] ✅ Running (hourly)');
});
