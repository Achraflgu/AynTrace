import express from 'express';
import db from '../db/knex.js';
import { logAudit } from '../utils/auditLogger.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { enterpriseId } = req.query;
        let query = db('notification_rules');
        if (enterpriseId) query = query.where('enterprise_id', enterpriseId);
        const rules = await query.orderBy('created_at', 'desc');
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const [rule] = await db('notification_rules').insert({
            enterprise_id: req.body.enterpriseId,
            alert_type: req.body.alertType,
            severity_target: req.body.severityTarget || 'all',
            emails: req.body.emails || [],
            is_active: req.body.isActive ?? true,
        }).returning('*');
        await logAudit('notification_rule.create', 'Admin', {
            targetType: 'notification_rule', targetId: rule.id,
        });
        res.status(201).json(rule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.put('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const updates = {};
        if (req.body.alertType !== undefined) updates.alert_type = req.body.alertType;
        if (req.body.severityTarget !== undefined) updates.severity_target = req.body.severityTarget;
        if (req.body.emails !== undefined) updates.emails = req.body.emails;
        if (req.body.isActive !== undefined) updates.is_active = req.body.isActive;
        updates.updated_at = new Date();

        const [rule] = await db('notification_rules').where('id', req.params.id).update(updates).returning('*');
        if (!rule) return res.status(404).json({ error: 'Rule not found' });
        await logAudit('notification_rule.update', 'Admin', {
            targetType: 'notification_rule', targetId: rule.id,
        });
        res.json(rule);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const deleted = await db('notification_rules').where('id', req.params.id).del();
        if (!deleted) return res.status(404).json({ error: 'Rule not found' });
        await logAudit('notification_rule.delete', 'Admin', {
            targetType: 'notification_rule', targetId: req.params.id,
        });
        res.json({ message: 'Rule deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
