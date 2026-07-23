import express from 'express';
import db from '../db/knex.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { broadcast } from '../simulation/engine.js';

const router = express.Router();

// Get all alerts
router.get('/', verifyToken, async (req, res) => {
    try {
        const { enterpriseId, userId } = req.query;
        let query = db('alerts');
        if (enterpriseId) query = query.where('enterprise_id', enterpriseId);

        const alerts = await query.orderBy('created_at', 'desc').limit(200);

        // For each alert, check if userId has read it
        let readAlertIds = new Set();
        if (userId) {
            const reads = await db('alert_reads').where('user_id', userId);
            readAlertIds = new Set(reads.map(r => r.alert_id));
        }

        res.json(alerts.map(a => ({
            id: a.id,
            deviceId: a.device_id,
            deviceName: a.device_name,
            enterpriseId: a.enterprise_id,
            type: a.type,
            severity: a.severity,
            message: a.message,
            read: readAlertIds.has(a.id),
            timestamp: a.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create alert
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { deviceId, deviceName, enterpriseId, type, severity, message } = req.body;
        const [alert] = await db('alerts').insert({
            device_id: deviceId,
            device_name: deviceName,
            enterprise_id: enterpriseId,
            type, severity, message
        }).returning('*');

        const formatted = {
            id: alert.id,
            deviceId: alert.device_id,
            deviceName: alert.device_name,
            enterpriseId: alert.enterprise_id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            read: false,
            timestamp: alert.created_at
        };

        // 1. Broadcast standard SOS alert toast popup
        broadcast('alert-new', {
            id: alert.id,
            _id: alert.id,
            deviceId: alert.device_id,
            deviceName: alert.device_name,
            enterpriseId: alert.enterprise_id,
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            read: false,
            createdAt: alert.created_at
        }, alert.enterprise_id);

        // 2. Broadcast entity-change for reactive logs list
        broadcast('entity-change', {
            entity: 'alert',
            action: 'create',
            item: formatted,
            id: alert.id,
            message: `Nouvelle alerte : ${alert.message}`
        }, alert.enterprise_id);

        res.status(201).json(formatted);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Mark alert as read
router.patch('/:id/read', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const alert = await db('alerts').where('id', req.params.id).first();
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        await db('alert_reads').insert({ alert_id: req.params.id, user_id: userId })
            .onConflict(['alert_id', 'user_id']).ignore();

        broadcast('entity-change', {
            entity: 'alert',
            action: 'update',
            item: { id: alert.id, read: true },
            id: alert.id,
            message: `Alerte marquée comme lue`
        }, alert.enterprise_id);

        res.json({ id: alert.id, read: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mark all alerts as read
router.patch('/read-all', verifyToken, async (req, res) => {
    try {
        const { enterpriseId, userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        let alertQuery = db('alerts');
        if (enterpriseId) alertQuery = alertQuery.where('enterprise_id', enterpriseId);
        const allAlerts = await alertQuery.select('id');

        for (const alert of allAlerts) {
            await db('alert_reads').insert({ alert_id: alert.id, user_id: userId })
                .onConflict(['alert_id', 'user_id']).ignore();
        }

        broadcast('entity-change', {
            entity: 'alert',
            action: 'update',
            item: { readAll: true, userId },
            message: `Toutes les alertes ont été marquées comme lues`
        }, enterpriseId || null);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete alert
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const alert = await db('alerts').where('id', req.params.id).first();
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        await db('alerts').where('id', req.params.id).del();

        broadcast('entity-change', {
            entity: 'alert',
            action: 'delete',
            id: alert.id,
            message: `Alerte supprimée`
        }, alert.enterprise_id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
