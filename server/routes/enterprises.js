import express from 'express';
import db from '../db/knex.js';
import { logAudit } from '../utils/auditLogger.js';
import { broadcast } from '../simulation/engine.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getNextDeviceIds } from '../utils/deviceIdHelper.js';

const router = express.Router();

// Get all enterprises
router.get('/', verifyToken, async (req, res) => {
    try {
        const { role, enterpriseId } = req.user;
        let query = db('enterprises').orderBy('created_at', 'desc');
        
        if (role !== 'admin' && role !== 'supervisor') {
            query = query.where('id', enterpriseId);
        }

        const enterprises = await query;
        const formatted = enterprises.map(e => ({
            id: e.id,
            name: e.name,
            contactEmail: e.contact_email,
            phone: e.phone,
            address: e.address,
            status: e.status,
            createdAt: e.created_at,
            serialPrefix: e.serial_prefix,
            imeiPrefix: e.imei_prefix,
            subscriberPrefix: e.subscriber_prefix,
            alertSettings: e.alert_settings
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single enterprise
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const { role, enterpriseId } = req.user;
        if (role !== 'admin' && enterpriseId !== req.params.id) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const enterprise = await db('enterprises').where('id', req.params.id).first();
        if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });
        
        enterprise.alertSettings = enterprise.alert_settings;
        delete enterprise.alert_settings;

        res.json(enterprise);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get next available IDs
router.get('/:id/next-ids', verifyToken, async (req, res) => {
    try {
        const { role, enterpriseId } = req.user;
        if (role !== 'admin' && enterpriseId !== req.params.id) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const enterprise = await db('enterprises').where('id', req.params.id).first();
        if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });

        const nextIds = await getNextDeviceIds(req.params.id);
        res.json(nextIds);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get next available prefix suggestions
router.get('/suggestions/next-prefixes', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const enterprises = await db('enterprises').select('imei_prefix', 'subscriber_prefix');
        let maxImei = 35907;
        let maxSubscriber = 500;
        enterprises.forEach(e => {
            const imei = parseInt(e.imei_prefix);
            const sub = parseInt(e.subscriber_prefix);
            if (!isNaN(imei) && imei >= maxImei) maxImei = imei;
            if (!isNaN(sub) && sub >= maxSubscriber) maxSubscriber = sub;
        });
        res.json({
            imeiPrefix: (maxImei + 1).toString(),
            subscriberPrefix: (maxSubscriber + 1).toString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create enterprise
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { serialPrefix, imeiPrefix, subscriberPrefix } = req.body;

        if (serialPrefix) {
            const exists = await db('enterprises').where('serial_prefix', serialPrefix).first();
            if (exists) return res.status(400).json({ error: `Le préfixe série '${serialPrefix}' est déjà utilisé.` });
        }

        let finalImeiPrefix = imeiPrefix;
        if (!finalImeiPrefix) {
            const ent = await db('enterprises').orderByRaw("CAST(imei_prefix AS INTEGER) DESC").first();
            const maxImei = ent && !isNaN(parseInt(ent.imei_prefix)) ? parseInt(ent.imei_prefix) : 35907;
            finalImeiPrefix = (maxImei + 1).toString();
        } else {
            const exists = await db('enterprises').where('imei_prefix', imeiPrefix).first();
            if (exists) return res.status(400).json({ error: `Le préfixe IMEI '${imeiPrefix}' est déjà utilisé.` });
        }

        let finalSubscriberPrefix = subscriberPrefix;
        if (!finalSubscriberPrefix) {
            const ent = await db('enterprises').orderByRaw("CAST(subscriber_prefix AS INTEGER) DESC").first();
            const maxSub = ent && !isNaN(parseInt(ent.subscriber_prefix)) ? parseInt(ent.subscriber_prefix) : 500;
            finalSubscriberPrefix = (maxSub + 1).toString();
        } else {
            const exists = await db('enterprises').where('subscriber_prefix', subscriberPrefix).first();
            if (exists) return res.status(400).json({ error: `Le préfixe Abonné '${subscriberPrefix}' est déjà utilisé.` });
        }

        const [enterprise] = await db('enterprises').insert({
            name: req.body.name,
            contact_email: req.body.contactEmail,
            contact_phone: req.body.contactPhone,
            phone: req.body.phone,
            address: req.body.address,
            status: req.body.status || 'active',
            serial_prefix: serialPrefix || req.body.name.substring(0, 3).toUpperCase(),
            imei_prefix: finalImeiPrefix,
            subscriber_prefix: finalSubscriberPrefix
        }).returning('*');

        await logAudit('enterprise.create', 'Admin', {
            targetType: 'enterprise', targetId: enterprise.id, targetName: enterprise.name
        });

        const formatted = {
            id: enterprise.id,
            name: enterprise.name,
            contactEmail: enterprise.contact_email,
            phone: enterprise.phone,
            address: enterprise.address,
            status: enterprise.status,
            createdAt: enterprise.created_at,
            serialPrefix: enterprise.serial_prefix,
            imeiPrefix: enterprise.imei_prefix,
            subscriberPrefix: enterprise.subscriber_prefix,
            alertSettings: enterprise.alert_settings
        };

        broadcast('entity-change', {
            entity: 'enterprise',
            action: 'create',
            item: formatted,
            id: enterprise.id,
            message: `Nouvelle entreprise créée: ${enterprise.name}`
        });

        res.status(201).json(enterprise);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update enterprise
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { role, enterpriseId } = req.user;
        if (role !== 'admin' && enterpriseId !== req.params.id) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const updates = {};
        if (role === 'admin') {
            if (req.body.name !== undefined) updates.name = req.body.name;
            if (req.body.contactEmail !== undefined) updates.contact_email = req.body.contactEmail;
            if (req.body.phone !== undefined) updates.phone = req.body.phone;
            if (req.body.address !== undefined) updates.address = req.body.address;
            if (req.body.status !== undefined) updates.status = req.body.status;
            if (req.body.serialPrefix !== undefined) updates.serial_prefix = req.body.serialPrefix;
            if (req.body.imeiPrefix !== undefined) updates.imei_prefix = req.body.imeiPrefix;
            if (req.body.subscriberPrefix !== undefined) updates.subscriber_prefix = req.body.subscriberPrefix;
        }
        
        // Operators can only update alertSettings
        if (req.body.alertSettings !== undefined) updates.alert_settings = req.body.alertSettings;
        updates.updated_at = new Date();

        const [enterprise] = await db('enterprises').where('id', req.params.id).update(updates).returning('*');
        if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });

        await logAudit('enterprise.update', 'Admin', {
            targetType: 'enterprise', targetId: enterprise.id, targetName: enterprise.name
        });

        const formatted = {
            id: enterprise.id,
            name: enterprise.name,
            contactEmail: enterprise.contact_email,
            phone: enterprise.phone,
            address: enterprise.address,
            status: enterprise.status,
            createdAt: enterprise.created_at,
            serialPrefix: enterprise.serial_prefix,
            imeiPrefix: enterprise.imei_prefix,
            subscriberPrefix: enterprise.subscriber_prefix,
            alertSettings: enterprise.alert_settings
        };

        broadcast('entity-change', {
            entity: 'enterprise',
            action: 'update',
            item: formatted,
            id: enterprise.id,
            message: `Entreprise mise à jour: ${enterprise.name}`
        });

        res.json(enterprise);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete enterprise
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const enterprise = await db('enterprises').where('id', req.params.id).first();
        if (!enterprise) return res.status(404).json({ error: 'Enterprise not found' });

        await db('enterprises').where('id', req.params.id).del();

        await logAudit('enterprise.delete', 'Admin', {
            targetType: 'enterprise', targetId: enterprise.id, targetName: enterprise.name
        });

        broadcast('entity-change', {
            entity: 'enterprise',
            action: 'delete',
            id: enterprise.id,
            message: `Entreprise supprimée: ${enterprise.name}`
        });

        res.json({ message: 'Enterprise deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
