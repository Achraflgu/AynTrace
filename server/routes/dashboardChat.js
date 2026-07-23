import express from 'express';
import db from '../db/knex.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

const chatSessions = new Map();
const SESSION_TTL = 2 * 60 * 60 * 1000;
const N8N_TIMEOUT_MS = Number(process.env.N8N_DASHBOARD_CHAT_TIMEOUT_MS || 15000);

setInterval(() => {
    const now = Date.now();
    for (const [sid, session] of chatSessions.entries()) {
        if (now - session.lastActive > SESSION_TTL) chatSessions.delete(sid);
    }
}, 10 * 60 * 1000);

// ─── Build rich context based on role ──────────────────────────────────
async function buildFleetContext(user) {
    const isAdmin = user.role === 'admin' || user.role === 'supervisor';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Devices ──
    let devicesQuery = db('devices');
    if (!isAdmin && user.enterpriseId) devicesQuery = devicesQuery.where('enterprise_id', user.enterpriseId);
    const devices = await devicesQuery;

    const online = devices.filter(d => d.status === 'online' || d.status === 'moving').length;
    const moving = devices.filter(d => d.status === 'moving').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    const idle = devices.filter(d => d.status === 'idle').length;

    // ── Alerts ──
    let alertQuery = db('alerts').where('created_at', '>=', today);
    if (!isAdmin && user.enterpriseId) alertQuery = alertQuery.where('enterprise_id', user.enterpriseId);
    const alerts = await alertQuery.orderBy('created_at', 'desc').limit(20);
    const alertsByType = {};
    alerts.forEach(a => { alertsByType[a.type] = (alertsByType[a.type] || 0) + 1; });

    // ── Zones ──
    let zoneQuery = db('geofences');
    if (!isAdmin && user.enterpriseId) zoneQuery = zoneQuery.where('enterprise_id', user.enterpriseId);
    const zones = await zoneQuery;

    // ── Low battery / speeding ──
    const lowBatteryDevices = devices.filter(d => d.battery < 30).map(d => ({
        name: d.name, battery: Math.round(d.battery), status: d.status
    }));
    const speedingDevices = devices.filter(d => d.speed > 70).map(d => ({
        name: d.name, speed: d.speed, address: d.address
    }));

    // ── Pricing ──
    let pricing = { starter_monthly: 29, pro_monthly: 39 }; // defaults
    try {
        const pricingRows = await db('pricing_config').select('key', 'value');
        for (const row of pricingRows) pricing[row.key] = row.value;
    } catch(e) {}

    let context = {
        role: user.role, userName: user.name,
        pricing,
        enterprise: user.enterpriseName || 'Admin Global',
        devices: {
            total: devices.length, online, moving, idle, offline,
            list: devices.slice(0, 15).map(d => ({
                name: d.name, status: d.status, speed: d.speed,
                battery: Math.round(d.battery || 0), address: d.address
            }))
        },
        alerts: { today: alerts.length, byType: alertsByType },
        zones: { total: zones.length, active: zones.filter(z => z.is_active).length },
        lowBatteryDevices, speedingDevices,
        recentAlerts: alerts.slice(0, 8).map(a => ({
            type: a.type, severity: a.severity, device: a.device_name,
            message: a.message, time: a.created_at,
        })),
    };

    // ═══ ADMIN-ONLY: full platform data ═══
    if (isAdmin) {
        try {
            // Orders breakdown
            const allOrders = await db('orders').orderBy('created_at', 'desc').limit(30);
            const pendingOrders = allOrders.filter(o => o.status === 'pending');
            const confirmedOrders = allOrders.filter(o => o.status === 'confirmed');
            const installedOrders = allOrders.filter(o => o.status === 'installed');
            const cancelledOrders = allOrders.filter(o => o.status === 'cancelled');

            context.orders = {
                total: allOrders.length,
                pending: pendingOrders.length,
                confirmed: confirmedOrders.length,
                installed: installedOrders.length,
                cancelled: cancelledOrders.length,
                recent: allOrders.slice(0, 5).map(o => ({
                    ref: o.order_ref, name: o.full_name, company: o.company,
                    gpsCount: o.gps_count, plan: o.plan, status: o.status,
                    total: o.total_due_today, date: o.created_at
                }))
            };

            // Users/operators summary
            const users = await db('users').select('id', 'name', 'email', 'role', 'plan', 'enterprise_id', 'created_at');
            const operators = users.filter(u => u.role === 'operator');
            const admins = users.filter(u => u.role === 'admin');
            context.users = {
                total: users.length,
                admins: admins.length,
                operators: operators.length,
                byPlan: {
                    starter: operators.filter(u => u.plan === 'starter').length,
                    pro: operators.filter(u => u.plan === 'pro').length,
                    enterprise: operators.filter(u => u.plan === 'enterprise').length,
                },
                recent: operators.slice(0, 5).map(u => ({
                    name: u.name, email: u.email, plan: u.plan, status: u.status
                }))
            };

            // Enterprises summary
            const enterprises = await db('enterprises');
            context.enterprises = {
                total: enterprises.length,
                list: enterprises.map(e => ({ 
                    name: e.name,
                    devicesCount: devices.filter(d => d.enterprise_id === e.id).length
                }))
            };

            // Payments summary
            try {
                const payments = await db('payments').orderBy('created_at', 'desc').limit(10);
                const [{ sum: totalRevenue }] = await db('payments').where('status', 'paid').sum('amount as sum');
                context.payments = {
                    recent: payments.slice(0, 5).map(p => ({
                        user: p.user_name, amount: p.amount, plan: p.plan,
                        status: p.status, date: p.created_at
                    })),
                    totalRevenue: totalRevenue || 0,
                    pendingCount: payments.filter(p => p.status === 'pending').length
                };
            } catch (e) { /* payments table may not exist */ }

            // Support tickets
            try {
                const [{ count: openTickets }] = await db('support_tickets').where('status', 'open').count('id as count');
                context.support = { openTickets: parseInt(openTickets) };
            } catch (e) { /* support_tickets table may not exist */ }

        } catch (e) {
            console.error('[DashChat] Admin context error:', e.message);
        }
    }

    // ═══ OPERATOR: private data about their account ═══
    if (!isAdmin && user.enterpriseId) {
        try {
            const operatorUser = await db('users').where('email', user.email || '').first();
            if (operatorUser) {
                context.myAccount = {
                    plan: operatorUser.plan || 'starter',
                    billingStatus: operatorUser.billing_status || 'N/A',
                    billingNextDue: operatorUser.billing_next_due || null,
                    devicesCount: devices.length,
                    activeZones: zones.filter(z => z.is_active).length,
                };
            }
        } catch (e) { /* ignore */ }
    }

    return context;
}

// Compact system prompt optimized for small local Ollama models.
function getDashboardPages(user) {
    const role = user.role;
    const plan = user.plan || 'starter';

    if (role === 'admin') {
        return [
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Carte', path: '/map' },
            { label: 'Zones', path: '/geofences' },
            { label: 'Appareils', path: '/devices' },
            { label: 'Entreprises', path: '/enterprises' },
            { label: 'Utilisateurs', path: '/users' },
            { label: 'Alertes', path: '/alerts' },
            { label: 'Support', path: '/support' },
            { label: 'Commandes', path: '/admin/orders' },
            { label: 'Audit logs', path: '/admin/logs' },
            { label: 'Parametres', path: '/settings' },
            { label: 'Profil', path: '/profile' },
        ];
    }

    if (role === 'supervisor') {
        return [
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Carte', path: '/map' },
            { label: 'Appareils', path: '/devices' },
            { label: 'Entreprises', path: '/enterprises' },
            { label: 'Alertes', path: '/alerts' },
            { label: 'Support', path: '/support' },
            { label: 'Parametres', path: '/settings' },
            { label: 'Profil', path: '/profile' },
        ];
    }

    const pages = [
        { label: 'Dashboard', path: '/dashboard' },
        { label: 'Carte', path: '/map' },
        { label: 'Appareils', path: '/devices' },
        { label: 'Alertes', path: '/alerts' },
        { label: 'Support', path: '/support' },
        { label: 'Facturation', path: '/billing' },
        { label: 'Parametres', path: '/settings' },
        { label: 'Profil', path: '/profile' },
    ];

    if (plan === 'pro' || plan === 'enterprise') {
        pages.splice(2, 0, { label: 'Zones', path: '/geofences' });
    }

    return pages;
}

function buildSystemPrompt(user, fleetContext, language = 'fr') {
    const isAdmin = user.role === 'admin' || user.role === 'supervisor';
    const scope = isAdmin ? 'admin_global_platform' : 'operator_own_enterprise_only';
    const pages = getDashboardPages(user);
    const modelContext = buildModelContext(fleetContext, isAdmin);
    const languageName = language === 'en' ? 'English' : 'French';

    return `/no_think
You are AynTrace AI, a fast GPS fleet dashboard assistant.
User: ${user.name || 'User'}
Role: ${user.role}
Scope: ${scope}
Useful pages: ${pages.map(page => `[${page.label}](${page.path})`).join(', ')}
Reply language: ${languageName}

Rules:
- Reply only in ${languageName}. Match the user's current message language, not the dashboard UI.
- Respond with plain text only. Never return JSON.
- In French always say "appareils", never "vehicules" or "véhicules".
- In English always say "devices", never "vehicles".
- All money amounts are Tunisian dinars: use TND only. Never use €, EUR, $, or USD.
- Use only CONTEXT. Do not invent numbers, devices, alerts, users, orders, payments, or locations.
- Keep it short: 1-2 lines normally; max 4 bullets for summaries.
- Use markdown for lists when helpful: "- **Label:** value". The UI renders bullets automatically.
- Use markdown links for dashboard pages when helpful, e.g. [Support](/support), [Parametres](/settings), [Facturation](/billing), [Appareils](/devices), [Zones](/geofences), [Alertes](/alerts).
- For user-management questions, use [Utilisateurs](/users). Use [Profil](/profile) only for personal account information.
- For enterprise-management questions, use [Entreprises](/enterprises). Use [Profil](/profile) only for personal account information.
- If you mention a dashboard path, always format it as a markdown link, not bare text.
- Never write "Support [/support]", "Support ([/support])", or "Support (/support)". Correct format is [Support](/support).
- Only recommend pages listed in Useful pages for this user role/plan.
- Email, mail, alert notification, or no-email settings are in [Parametres](/settings), never in [Facturation](/billing).
- Support tickets, contact team, FAQ, technical issues, and custom requests are in [Support](/support).
- If the user says only "Support" or asks how to contact support/open a ticket, answer about the [Support](/support) page only. Do not answer with alerts, SOS, devices, or locations.
- Do not confuse the Support page with device names that contain "Support". Use device data only when the user clearly asks about that device.
- Lead with the answer. Include exact names, counts, statuses, and paths when useful.
- If requested data is missing from CONTEXT, say it is unavailable.
- You cannot change data. For actions, tell the user where to click.
- Operators must never see or hear about admin-only data outside their CONTEXT.
- For Starter operators asking about Pro features, mention upgrade via [Facturation](/billing) once.
- Do not explain your reasoning. Do not output <think>.
- If the user says "hi", greet briefly and offer help with dashboard data.

CONTEXT:
${JSON.stringify(modelContext)}`;
}

function buildModelContext(ctx, isAdmin) {
    const compact = {
        role: ctx.role,
        enterprise: ctx.enterprise,
        devices: {
            total: ctx.devices.total,
            online: ctx.devices.online,
            moving: ctx.devices.moving,
            idle: ctx.devices.idle,
            offline: ctx.devices.offline,
            sample: ctx.devices.list.slice(0, 6),
        },
        alerts: {
            today: ctx.alerts.today,
            byType: ctx.alerts.byType,
            recent: ctx.recentAlerts.slice(0, 3),
        },
        zones: ctx.zones,
        lowBatteryDevices: ctx.lowBatteryDevices.slice(0, 5),
        speedingDevices: ctx.speedingDevices.slice(0, 5),
        myAccount: ctx.myAccount,
        pricing: ctx.pricing,
    };

    if (isAdmin) {
        compact.orders = ctx.orders && {
            total: ctx.orders.total,
            pending: ctx.orders.pending,
            confirmed: ctx.orders.confirmed,
            installed: ctx.orders.installed,
            cancelled: ctx.orders.cancelled,
            recent: ctx.orders.recent.slice(0, 3),
        };
        compact.users = ctx.users && {
            total: ctx.users.total,
            admins: ctx.users.admins,
            operators: ctx.users.operators,
            byPlan: ctx.users.byPlan,
        };
        compact.enterprises = ctx.enterprises && {
            total: ctx.enterprises.total,
            list: ctx.enterprises.list.slice(0, 8),
        };
        compact.payments = ctx.payments && {
            totalRevenue: ctx.payments.totalRevenue,
            pendingCount: ctx.payments.pendingCount,
        };
        compact.support = ctx.support;
    }

    return compact;
}

function normalizeMessage(message) {
    return message
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function detectLanguage(message, fallback = 'fr') {
    const msg = normalizeMessage(message || '');
    const fallbackLang = fallback === 'en' ? 'en' : 'fr';

    if (/^(hi|hello|hey)\b/.test(msg)) return 'en';
    if (/^(salut|bonjour|bonsoir)\b/.test(msg)) return 'fr';

    const englishWords = [
        'show', 'what', 'how', 'list', 'give', 'get', 'tell', 'my',
        'summary', 'alerts', 'alert', 'devices', 'device', 'battery', 'batteries',
        'account', 'billing', 'support', 'help', 'orders', 'users',
        'speed', 'speeding', 'online', 'offline', 'moving', 'idle', 'today'
    ];
    const frenchWords = [
        'montre', 'affiche', 'liste', 'resume', 'alertes', 'alerte',
        'appareils', 'appareil', 'batterie', 'batteries', 'compte',
        'facturation', 'aide', 'commandes', 'utilisateurs', 'vitesse',
        'ligne', 'hors ligne', 'mouvement', 'inactifs', 'aujourd hui'
    ];

    const score = (words) => words.reduce((total, word) => {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
        return total + (new RegExp(`\\b${escaped}\\b`, 'i').test(msg) ? 1 : 0);
    }, 0);

    const englishScore = score(englishWords);
    const frenchScore = score(frenchWords);

    if (englishScore > frenchScore) return 'en';
    if (frenchScore > englishScore) return 'fr';
    return fallbackLang;
}

function cleanAiText(value) {
    if (typeof value !== 'string') return '';
    return value
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```(?:json|text)?/gi, '')
        .replace(/```/g, '')
        .trim();
}

function extractN8nReply(data) {
    if (typeof data === 'string') return cleanAiText(data);
    if (Array.isArray(data)) {
        for (const item of data) {
            const reply = extractN8nReply(item);
            if (reply) return reply;
        }
        return '';
    }
    if (!data || typeof data !== 'object') return '';

    const candidates = [
        data.output,
        data.text,
        data.response,
        data.message,
        data.reply,
        data.answer,
        data.result,
        data.data?.output,
        data.data?.text,
        data.data?.response,
    ];

    for (const candidate of candidates) {
        const reply = extractN8nReply(candidate);
        if (reply) return reply;
    }

    return '';
}

function rewriteDashboardLinks(text) {
    if (!text) return '';
    const labels = {
        '/dashboard': 'Dashboard',
        '/map': 'Carte',
        '/devices': 'Appareils',
        '/alerts': 'Alertes',
        '/geofences': 'Zones',
        '/billing': 'Facturation',
        '/settings': 'Parametres',
        '/support': 'Support',
        '/admin/orders': 'Commandes',
        '/users': 'Utilisateurs',
        '/enterprises': 'Entreprises',
        '/admin/logs': 'Audit logs',
        '/profile': 'Profil',
    };

    let rewritten = text
        .replace(/\]\(\/admin\/logs\)/g, '](/admin/logs)')
        .replace(/\]\(\/audit-logs\)/g, '](/admin/logs)')
        .replace(/\]\(\/orders\)/g, '](/admin/orders)')
        .replace(/\b(?:Support|Assistance)\s*(?:\(\s*)?\[?\/support\]?(?:\s*\))?/gi, '[Support](/support)')
        .replace(/\b(?:Settings|Param[eè]tres)\s*(?:\(\s*)?\[?\/settings\]?(?:\s*\))?/gi, '[Parametres](/settings)')
        .replace(/\b(?:Billing|Facturation)\s*(?:\(\s*)?\[?\/billing\]?(?:\s*\))?/gi, '[Facturation](/billing)')
        .replace(/\b(?:Devices|Appareils)\s*(?:\(\s*)?\[?\/devices\]?(?:\s*\))?/gi, '[Appareils](/devices)')
        .replace(/\b(?:Alerts|Alertes)\s*(?:\(\s*)?\[?\/alerts\]?(?:\s*\))?/gi, '[Alertes](/alerts)')
        .replace(/\b(?:Geofences|Zones(?:\s+geographiques)?)\s*(?:\(\s*)?\[?\/geofences\]?(?:\s*\))?/gi, '[Zones](/geofences)')
        .replace(/\b(?:Profile|Profil)\s*(?:\(\s*)?\[?\/profile\]?(?:\s*\))?/gi, '[Profil](/profile)')
        .replace(/\b(?:Dashboard|Tableau de bord)\s*(?:\(\s*)?\[?\/dashboard\]?(?:\s*\))?/gi, '[Dashboard](/dashboard)')
        .replace(/\b(?:Map|Carte)\s*(?:\(\s*)?\[?\/map\]?(?:\s*\))?/gi, '[Carte](/map)');

    for (const [path, label] of Object.entries(labels).sort((a, b) => b[0].length - a[0].length)) {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        rewritten = rewritten.replace(new RegExp(`(^|[\\s:>])(${escaped})(?=$|[\\s.,;:!?)]|\\u2192)`, 'g'), `$1[${label}](${path})`);
    }

    return rewritten;
}

function correctDashboardAnswer(text, message) {
    if (!text) return '';
    const msg = normalizeMessage(message || '');
    if (!/(email|e-mail|mail|mails|notification|notifications|alerte par email|alertes par email)/.test(msg)) {
        return text;
    }

    return text
        .replace(/\[Facturation\]\(\/billing\)\s*(?:→|->)?\s*(?:Param[eè]tres de facturation\s*)?(?:→|->)?\s*(?:Notifications)?/gi, '[Parametres](/settings)')
        .replace(/\[Billing\]\(\/billing\)\s*(?:→|->)?\s*(?:Billing settings\s*)?(?:→|->)?\s*(?:Notifications)?/gi, '[Settings](/settings)')
        .replace(/Facturation\s*(?:→|->)\s*Param[eè]tres de facturation\s*(?:→|->)\s*Notifications/gi, '[Parametres](/settings)')
        .replace(/Billing\s*(?:→|->)\s*Billing settings\s*(?:→|->)\s*Notifications/gi, '[Settings](/settings)')
        .replace(/\[Facturation\]\(\/billing\)/gi, '[Parametres](/settings)')
        .replace(/\[Billing\]\(\/billing\)/gi, '[Settings](/settings)');
}

function formatDashboardPages(user, isFr) {
    const pages = getDashboardPages(user).map(page => `- **${page.label}:** [${page.label}](${page.path})`);
    const title = isFr ? '**Pages disponibles**' : '**Available pages**';
    return `${title}\n${pages.join('\n')}`;
}

function isSupportPageIntent(message) {
    const msg = normalizeMessage(message || '').trim();
    if (/^(support|assistance|aide|help|contact|ticket|tickets)$/.test(msg)) return true;
    if (/\b(open|create|submit|send|contact|message|chat)\b.*\b(support|ticket|team)\b/.test(msg)) return true;
    if (/\b(support|ticket|team)\b.*\b(open|create|submit|send|contact|message|chat)\b/.test(msg)) return true;
    if (/\b(ouvrir|creer|envoyer|contacter|message|discussion|chat)\b.*\b(support|ticket|assistance|equipe)\b/.test(msg)) return true;
    if (/\b(support|ticket|assistance|equipe)\b.*\b(ouvrir|creer|envoyer|contacter|message|discussion|chat)\b/.test(msg)) return true;
    return false;
}

function isUsersPageIntent(message) {
    const msg = normalizeMessage(message || '').trim();
    if (/^(utilisateurs|users|user|operateurs|operators|equipe|team)$/.test(msg)) return true;
    if (/\b(liste|voir|afficher|gerer|g[ée]rer|consulter|modifier|ajouter|cr[eé]er|administrer)\b.*\b(utilisateurs|users|user|operateurs|operators|equipe|team)\b/.test(msg)) return true;
    if (/\b(utilisateurs|users|user|operateurs|operators|equipe|team)\b.*\b(liste|voir|afficher|gerer|g[ée]rer|consulter|modifier|ajouter|cr[eé]er|administrer)\b/.test(msg)) return true;
    return false;
}

function isEnterprisesPageIntent(message) {
    const msg = normalizeMessage(message || '').trim();
    if (/^(entreprises|enterprises|entreprise|company|companies|societe|societes)$/.test(msg)) return true;
    if (/\b(liste|voir|afficher|gerer|g[ée]rer|consulter|modifier|ajouter|cr[eé]er|administrer)\b.*\b(entreprises|enterprises|entreprise|company|companies|societe|societes)\b/.test(msg)) return true;
    if (/\b(entreprises|enterprises|entreprise|company|companies|societe|societes)\b.*\b(liste|voir|afficher|gerer|g[ée]rer|consulter|modifier|ajouter|cr[eé]er|administrer)\b/.test(msg)) return true;
    return false;
}

function formatSupportResponse(user, isFr) {
    const isAdmin = user.role === 'admin' || user.role === 'supervisor';
    if (isAdmin) {
        return isFr
            ? `**Support AynTrace**\n- **Tickets:** allez dans [Support](/support) pour voir les demandes clients.\n- **Chat:** ouvrez un ticket et repondez directement dans la discussion.\n- **Suivi:** marquez le ticket resolu quand le probleme est traite.`
            : `**AynTrace support**\n- **Tickets:** go to [Support](/support) to review customer requests.\n- **Chat:** open a ticket and reply directly in the conversation.\n- **Follow-up:** mark the ticket resolved when the issue is handled.`;
    }

    return isFr
        ? `**Support AynTrace**\n- **Contacter l'equipe:** ouvrez [Support](/support).\n- **Nouveau ticket:** cliquez sur "Ouvrir un ticket", ajoutez le sujet et votre message.\n- **Discussion:** suivez la reponse de l'equipe dans le meme ticket.`
        : `**AynTrace support**\n- **Contact the team:** open [Support](/support).\n- **New ticket:** click "Open a ticket", add the subject and your message.\n- **Conversation:** follow the team's reply in the same ticket.`;
}

router.post('/', verifyToken, async (req, res) => {
    try {
        const { message, sessionId, language } = req.body;
        if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });
        if (!req.user || !req.user.role) return res.status(401).json({ error: 'Authenticated user required' });

        const user = {
            ...req.user,
            name: req.user.name || 'User',
            enterpriseName: req.user.enterpriseName || '',
        };
        const isAdmin = user.role === 'admin' || user.role === 'supervisor';
        if (!isAdmin && !user.enterpriseId) {
            return res.status(403).json({ error: 'Enterprise scope required' });
        }

        const sid = sessionId || `dash-${user.role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        if (!chatSessions.has(sid)) {
            chatSessions.set(sid, { messageCount: 0, lastActive: Date.now(), user: user.name });
        }
        const session = chatSessions.get(sid);
        session.messageCount++;
        session.lastActive = Date.now();

        const fleetContext = await buildFleetContext(user);
        const replyLanguage = detectLanguage(message, language);
        const systemPrompt = buildSystemPrompt(user, fleetContext, replyLanguage);
        const modelContext = buildModelContext(fleetContext, isAdmin);

        const webhookUrl = process.env.N8N_DASHBOARD_CHAT_WEBHOOK || 'http://localhost:5678/webhook/dashboard-chat';
        if (!webhookUrl) {
            const localReply = generateLocalResponse(message, fleetContext, user, replyLanguage);
            return res.json({ reply: localReply, sessionId: sid, context: fleetContext });
        }

        console.log(`[DashChat] ${user.name} (${user.role}): "${message.substring(0, 60)}..." (msg #${session.messageCount})`);

        let n8nResponse;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
        try {
            n8nResponse = await fetch(webhookUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chatInput: message, sessionId: sid, systemPrompt, context: modelContext }),
                signal: controller.signal,
            });
        } catch (n8nError) {
            console.warn('[DashChat] n8n unavailable, using local fallback:', n8nError.message);
            const localReply = generateLocalResponse(message, fleetContext, user, replyLanguage);
            return res.json({ reply: localReply, sessionId: sid });
        } finally {
            clearTimeout(timeout);
        }

        if (!n8nResponse.ok) {
            const localReply = generateLocalResponse(message, fleetContext, user, replyLanguage);
            return res.json({ reply: localReply, sessionId: sid });
        }

        let data;
        try {
            data = await n8nResponse.json();
        } catch (parseError) {
            console.warn('[DashChat] Invalid n8n response, using local fallback:', parseError.message);
            const localReply = generateLocalResponse(message, fleetContext, user, replyLanguage);
            return res.json({ reply: localReply, sessionId: sid });
        }
        const reply = isSupportPageIntent(message)
            ? formatSupportResponse(user, replyLanguage !== 'en')
            : correctDashboardAnswer(rewriteDashboardLinks(extractN8nReply(data)), message);
        if (!reply) {
            console.warn('[DashChat] Empty n8n response, using local fallback:', JSON.stringify(data).slice(0, 300));
            const localReply = generateLocalResponse(message, fleetContext, user, replyLanguage);
            return res.json({ reply: localReply, sessionId: sid });
        }

        res.json({ reply, sessionId: sid });
    } catch (err) {
        console.error('[DashChat] Error:', err.message);
        res.status(500).json({ reply: "❌ Erreur de connexion IA. Réessayez." });
    }
});

// ─── Local fallback responses ──────────────────────────────────────────
function generateLocalResponse(message, ctx, user, language = 'fr') {
    const msg = normalizeMessage(message);
    const isFr = language !== 'en';
    const isAdmin = user.role === 'admin' || user.role === 'supervisor';

    if (isAdmin && isUsersPageIntent(message)) {
        return isFr
            ? `Pour gerer les utilisateurs, ouvrez [Utilisateurs](/users).\n- Consultez la liste des comptes\n- Creez ou modifiez un utilisateur depuis cette page\n- Gardez [Profil](/profile) pour vos informations personnelles`
            : `To manage users, open [Users](/users).\n- View the account list\n- Create or edit a user from that page\n- Keep [Profile](/profile) for your personal information`;
    }

    if (isAdmin && isEnterprisesPageIntent(message)) {
        return isFr
            ? `Pour gerer les entreprises, ouvrez [Entreprises](/enterprises).\n- Consultez la liste des comptes clients\n- Creez ou modifiez une entreprise depuis cette page\n- Gardez [Profil](/profile) pour vos informations personnelles`
            : `To manage enterprises, open [Enterprises](/enterprises).\n- View the client list\n- Create or edit an enterprise from that page\n- Keep [Profile](/profile) for your personal information`;
    }

    if (/^(hi|hello|hey|salut|bonjour|bonsoir)$/.test(msg.trim())) {
        return isFr
            ? `Bonjour ${user.name}! Je peux vous aider avec le résumé, les alertes, les appareils, les batteries, les zones ou votre compte.\n- **Support:** [ouvrir un ticket](/support)\n- **Facturation:** [voir votre plan](/billing)`
            : `Hi ${user.name}! I can help with summary, alerts, devices, batteries, zones, or your account.\n- **Support:** [open a ticket](/support)\n- **Billing:** [view your plan](/billing)`;
    }

    if (isSupportPageIntent(message)) {
        return formatSupportResponse(user, isFr);
    }

    if (/(email|e-mail|mail|mails|notification|notifications|alerte par email|alertes par email)/.test(msg)) {
        return isFr
            ? `Pour couper les emails, allez dans [Parametres](/settings), ouvrez les notifications d'alertes, desactivez l'email puis enregistrez.`
            : `To stop email notifications, go to [Settings](/settings), open alert notifications, disable email, then save.`;
    }

    if (msg.includes('page') || msg.includes('pages') || msg.includes('menu') || msg.includes('sidebar') || msg.includes('navigation')) {
        return formatDashboardPages(user, isFr);
    }

    if (msg.includes('resume') || msg.includes('summary') || msg.includes('dashboard') || msg.includes('tableau')) {
        const lines = isFr
            ? [
                '**Resume appareils**',
                `${ctx.devices.total} appareils: ${ctx.devices.online} en ligne, ${ctx.devices.moving} en mouvement, ${ctx.devices.offline} hors ligne.`,
                `${ctx.alerts.today} alertes aujourd'hui. Zones GPS: ${ctx.zones.active}/${ctx.zones.total} actives.`,
            ]
            : [
                '**Device summary**',
                `${ctx.devices.total} devices: ${ctx.devices.online} online, ${ctx.devices.moving} moving, ${ctx.devices.offline} offline.`,
                `${ctx.alerts.today} alerts today. GPS zones: ${ctx.zones.active}/${ctx.zones.total} active.`,
            ];
        if (ctx.myAccount) {
            lines.push(isFr
                ? `Compte: plan ${ctx.myAccount.plan}, facturation ${ctx.myAccount.billingStatus}.`
                : `Account: ${ctx.myAccount.plan} plan, billing ${ctx.myAccount.billingStatus}.`);
        }
        if (isAdmin && ctx.orders) {
            lines.push(isFr
                ? `Commandes: ${ctx.orders.pending} en attente sur ${ctx.orders.total}.`
                : `Orders: ${ctx.orders.pending} pending out of ${ctx.orders.total}.`);
        }
        return lines.join('\n');
    }

    if (msg.includes('alerte') || msg.includes('alert')) {
        if (!ctx.recentAlerts.length) return isFr ? "Aucune alerte aujourd'hui." : 'No alerts today.';
        const list = ctx.recentAlerts.slice(0, 4).map(a => `- ${a.type} (${a.severity}) - ${a.device}: ${a.message}`).join('\n');
        return isFr ? `**${ctx.alerts.today} alertes aujourd'hui**\n${list}` : `**${ctx.alerts.today} alerts today**\n${list}`;
    }

    if (msg.includes('appareil') || msg.includes('device') || msg.includes('gps') || msg.includes('vehicule')) {
        const reply = isFr
            ? `**${ctx.devices.total} appareils**\n- **En ligne:** ${ctx.devices.online}\n- **En mouvement:** ${ctx.devices.moving}\n- **Inactifs:** ${ctx.devices.idle}\n- **Hors ligne:** ${ctx.devices.offline}`
            : `**${ctx.devices.total} devices**\n- **Online:** ${ctx.devices.online}\n- **Moving:** ${ctx.devices.moving}\n- **Idle:** ${ctx.devices.idle}\n- **Offline:** ${ctx.devices.offline}`;
        if (!ctx.lowBatteryDevices.length) return reply;
        const low = ctx.lowBatteryDevices.slice(0, 4).map(d => `${d.name} (${d.battery}%)`).join(', ');
        return reply + (isFr ? `\nBatteries faibles: ${low}` : `\nLow batteries: ${low}`);
    }

    if (msg.includes('batterie') || msg.includes('battery')) {
        if (!ctx.lowBatteryDevices.length) return isFr ? 'Toutes les batteries sont OK (>30%).' : 'All batteries are OK (>30%).';
        const list = ctx.lowBatteryDevices.slice(0, 5).map(d => `- ${d.name}: ${d.battery}%`).join('\n');
        return isFr ? `**Batteries faibles**\n${list}` : `**Low batteries**\n${list}`;
    }

    if (msg.includes('vitesse') || msg.includes('speed')) {
        if (!ctx.speedingDevices.length) return isFr ? 'Aucun exces de vitesse detecte.' : 'No speeding detected.';
        const list = ctx.speedingDevices.slice(0, 5).map(d => `- ${d.name}: ${d.speed} km/h`).join('\n');
        return isFr ? `**Exces de vitesse**\n${list}` : `**Speeding devices**\n${list}`;
    }

    if (msg.includes('zone') || msg.includes('geofence')) {
        return isFr
            ? `**Zones GPS:** ${ctx.zones.active}/${ctx.zones.total} actives.`
            : `**GPS zones:** ${ctx.zones.active}/${ctx.zones.total} active.`;
    }

    if (msg.includes('mon compte') || msg.includes('my account') || msg.includes('mon plan') || msg.includes('my plan') || msg.includes('facturation') || msg.includes('billing')) {
        if (ctx.myAccount) {
            return isFr
                ? `**Votre compte**\n- **Plan:** ${ctx.myAccount.plan}\n- **Facturation:** ${ctx.myAccount.billingStatus}\n- **Appareils:** ${ctx.myAccount.devicesCount}\n- **Lien:** [Facturation](/billing)`
                : `**Your account**\n- **Plan:** ${ctx.myAccount.plan}\n- **Billing:** ${ctx.myAccount.billingStatus}\n- **Devices:** ${ctx.myAccount.devicesCount}\n- **Link:** [Billing](/billing)`;
        }
        if (isAdmin && ctx.payments) {
            return isFr
                ? `**Facturation**\n- **Revenu total:** ${ctx.payments.totalRevenue} TND\n- **Paiements en attente:** ${ctx.payments.pendingCount}\n- **Lien:** [Facturation](/billing)`
                : `**Billing**\n- **Total revenue:** ${ctx.payments.totalRevenue} TND\n- **Pending payments:** ${ctx.payments.pendingCount}\n- **Link:** [Billing](/billing)`;
        }
        return isFr ? 'Facturation indisponible.' : 'Billing data unavailable.';
    }

    if (msg.includes('commande') || msg.includes('order')) {
        if (!isAdmin || !ctx.orders) return isFr ? 'Commandes reservees aux administrateurs.' : 'Orders are admin-only.';
        return isFr
            ? `**Commandes:** ${ctx.orders.total} total, ${ctx.orders.pending} en attente, ${ctx.orders.confirmed} confirmees, ${ctx.orders.installed} installees.`
            : `**Orders:** ${ctx.orders.total} total, ${ctx.orders.pending} pending, ${ctx.orders.confirmed} confirmed, ${ctx.orders.installed} installed.`;
    }

    if (msg.includes('utilisateur') || msg.includes('user') || msg.includes('operateur') || msg.includes('operator')) {
        if (!isAdmin || !ctx.users) return isFr ? 'Donnees utilisateurs reservees aux administrateurs.' : 'User data is admin-only.';
        return isFr
            ? `**Utilisateurs:** ${ctx.users.total} total, ${ctx.users.admins} admins, ${ctx.users.operators} operateurs.`
            : `**Users:** ${ctx.users.total} total, ${ctx.users.admins} admins, ${ctx.users.operators} operators.`;
    }

    const tips = isAdmin
        ? (isFr ? '"Resume", "Alertes", "Appareils", "Commandes", "Utilisateurs", "Facturation", "Zones"' : '"Summary", "Alerts", "Devices", "Orders", "Users", "Billing", "Zones"')
        : (isFr ? '"Resume", "Alertes", "Appareils", "Batteries", "Mon compte", "Zones"' : '"Summary", "Alerts", "Devices", "Battery", "My account", "Zones"');
    return isFr ? `Essayez: ${tips}` : `Try: ${tips}`;
}

export default router;
