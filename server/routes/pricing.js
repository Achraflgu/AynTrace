import express from 'express';
import db from '../db/knex.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
const router = express.Router();

// GET /api/pricing — Public (needed for landing page pricing display)
router.get('/', async (req, res) => {
    try {
        const rows = await db('pricing_config').orderBy('category').orderBy('key');
        // Transform to a convenient object map AND return the full rows
        const config = {};
        rows.forEach(r => {
            config[r.key] = r.value;
        });
        res.json({ config, rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/pricing — Admin only
router.put('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { updates } = req.body; // [{ key, value }, ...]
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        const now = new Date();
        for (const { key, value } of updates) {
            if (key && value !== undefined && value !== null) {
                await db('pricing_config')
                    .where('key', key)
                    .update({ value: parseFloat(value), updated_at: now });
            }
        }

        // Return updated config
        const rows = await db('pricing_config').orderBy('category').orderBy('key');
        const config = {};
        rows.forEach(r => { config[r.key] = r.value; });
        res.json({ success: true, config, rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
