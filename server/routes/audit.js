import express from 'express';
import db from '../db/knex.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { broadcast } from '../simulation/engine.js';

const router = express.Router();

// Format audit log → camelCase for frontend
function formatLog(log) {
    return {
        id: log.id,
        action: log.action,
        userId: log.user_id,
        userName: log.user_name,
        targetType: log.target_type,
        targetId: log.target_id,
        targetName: log.target_name,
        ip: log.ip,
        details: log.details,
        timestamp: log.created_at,   // frontend uses 'timestamp'
        createdAt: log.created_at,
    };
}

router.get('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { action, limit = 100 } = req.query;
        const limitNum = parseInt(limit);

        let query = db('audit_logs');
        if (action && action !== 'all') {
            query = query.where('action', 'ilike', `%${action}%`);
        }
        // limit=0 means "unlimited" in the frontend API client
        if (limitNum > 0) {
            query = query.limit(limitNum);
        }

        const logs = await query.orderBy('created_at', 'desc');
        res.json(logs.map(formatLog));
    } catch (error) {
        console.error('[Audit] Error fetching logs:', error.message);
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const [log] = await db('audit_logs').insert({
            action: req.body.action,
            user_id: req.body.userId || null,
            user_name: req.body.userName || 'System',
            target_type: req.body.targetType || null,
            target_id: req.body.targetId || null,
            target_name: req.body.targetName || null,
            ip: req.body.ip || null,
            details: req.body.details ? JSON.stringify(req.body.details) : null,
        }).returning('*');

        const actionType = log.action.includes('login') ? '🔐 LOGIN' :
            log.action.includes('logout') ? '🚪 LOGOUT' : '📝 AUDIT';
        console.log(`[${actionType}] ${log.user_name} | Action: ${log.action} | IP: ${log.ip || 'unknown'}`);

        const formatted = formatLog(log);
        broadcast('entity-change', {
            entity: 'audit',
            action: 'create',
            item: formatted,
            id: log.id,
            message: `Activité enregistrée: ${log.action} par ${log.user_name}`
        });

        res.status(201).json(formatted);
    } catch (error) {
        console.error('[Audit] Error creating log:', error.message);
        res.status(400).json({ error: error.message });
    }
});

export default router;
