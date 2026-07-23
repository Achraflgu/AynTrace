import express from 'express';
import db from '../db/knex.js';
import { verifyToken } from '../middleware/auth.js';
import { broadcast } from '../simulation/engine.js';

const router = express.Router();

function canManageEnterprise(user, enterpriseId) {
    if (user.role === 'admin') return true;
    return !!user.enterpriseId && String(user.enterpriseId) === String(enterpriseId);
}

// GET all geofences
router.get('/', verifyToken, async (req, res) => {
    try {
        const { enterpriseId } = req.query;

        // Load ALL zones — no filter on zone.enterprise_id
        // Visibility is determined by whether the operator's devices are assigned to the zone
        const geofences = await db('geofences').orderBy('created_at', 'desc');

        // Pre-load all geofence-device assignments in one query
        const allGD = await db('geofence_devices');
        const zoneDeviceMap = {};
        allGD.forEach(gd => {
            const zId = gd.geofence_id.toString();
            if (!zoneDeviceMap[zId]) zoneDeviceMap[zId] = [];
            zoneDeviceMap[zId].push(gd.device_id.toString());
        });

        // Pre-load all devices assigned to any zone
        const allDeviceIds = allGD.map(gd => gd.device_id);
        const allDevices = allDeviceIds.length > 0
            ? await db('devices').whereIn('id', allDeviceIds)
                .select('id', 'name', 'imei', 'status', 'location_lat', 'location_lng', 'device_type', 'enterprise_id')
            : [];
        const deviceMap = new Map(allDevices.map(d => [d.id.toString(), d]));

        const result = [];
        for (const g of geofences) {
            const assignedIds = zoneDeviceMap[g.id.toString()] || [];
            const assignedDevices = assignedIds.map(id => deviceMap.get(id)).filter(Boolean);

            let visibleDevices;
            if (enterpriseId) {
                // OPERATOR: only show devices belonging to their enterprise
                visibleDevices = assignedDevices.filter(d => d.enterprise_id?.toString() === enterpriseId);
                // Skip zone entirely if none of the operator's devices are in it
                if (visibleDevices.length === 0) continue;
            } else {
                // ADMIN: see all zones with all assigned devices
                visibleDevices = assignedDevices;
            }

            result.push({
                _id: g.id, id: g.id,
                name: g.name,
                enterpriseId: g.enterprise_id,
                type: g.type,
                center: g.center_lat ? { lat: g.center_lat, lng: g.center_lng } : undefined,
                radius: g.radius,
                polygon: typeof g.polygon === 'string' ? JSON.parse(g.polygon) : g.polygon,
                color: g.color,
                devices: visibleDevices.map(d => ({
                    _id: d.id, id: d.id, name: d.name, imei: d.imei, status: d.status,
                    deviceType: d.device_type,
                    location: { type: 'Point', coordinates: [d.location_lng, d.location_lat] }
                })),
                alertOnExit: g.alert_on_exit,
                alertOnEntry: g.alert_on_entry,
                isActive: g.is_active,
                createdBy: g.created_by,
                createdAt: g.created_at,
                updatedAt: g.updated_at,
            });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET single geofence
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const g = await db('geofences').where('id', req.params.id).first();
        if (!g) return res.status(404).json({ error: 'Geofence not found' });

        const deviceIds = await db('geofence_devices').where('geofence_id', g.id).select('device_id');
        const devices = deviceIds.length > 0
            ? await db('devices').whereIn('id', deviceIds.map(d => d.device_id))
            : [];

        res.json({
            ...g, _id: g.id,
            polygon: typeof g.polygon === 'string' ? JSON.parse(g.polygon) : g.polygon,
            devices
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CREATE geofence
router.post('/', verifyToken, async (req, res) => {
    try {
        const { devices, ...data } = req.body;
        const targetEnterpriseId = req.user.role === 'admin' ? (data.enterpriseId ?? null) : req.user.enterpriseId;

        if (req.user.role !== 'admin' && !canManageEnterprise(req.user, targetEnterpriseId)) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const [geofence] = await db('geofences').insert({
            name: data.name,
            enterprise_id: targetEnterpriseId,
            type: data.type,
            center_lat: data.center?.lat,
            center_lng: data.center?.lng,
            radius: data.radius,
            polygon: JSON.stringify(data.polygon || []),
            color: data.color || '#00E599',
            alert_on_exit: data.alertOnExit ?? true,
            alert_on_entry: data.alertOnEntry ?? false,
            is_active: data.isActive ?? true,
            created_by: req.user.id,
        }).returning('*');

        // Insert device associations
        if (devices?.length > 0) {
            await db('geofence_devices').insert(
                devices.map(deviceId => ({ geofence_id: geofence.id, device_id: deviceId }))
            );
        }

        // Return populated
        const populatedDevices = devices?.length > 0
            ? await db('devices').whereIn('id', devices)
                .select('id', 'name', 'imei', 'status', 'location_lat', 'location_lng', 'device_type')
            : [];

        const responseData = {
            ...geofence, _id: geofence.id,
            polygon: typeof geofence.polygon === 'string' ? JSON.parse(geofence.polygon) : geofence.polygon,
            center: geofence.center_lat ? { lat: geofence.center_lat, lng: geofence.center_lng } : undefined,
            devices: populatedDevices.map(d => ({
                _id: d.id, id: d.id, name: d.name, imei: d.imei, status: d.status,
                deviceType: d.device_type,
                location: { type: 'Point', coordinates: [d.location_lng, d.location_lat] }
            }))
        };

        broadcast('entity-change', {
            entity: 'geofence',
            action: 'create',
            item: responseData,
            id: geofence.id,
            message: `Nouvelle zone GPS créée: ${geofence.name}`
        }, geofence.enterprise_id);

        res.status(201).json(responseData);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// UPDATE geofence
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { devices, ...data } = req.body;
        const existing = await db('geofences').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Geofence not found' });
        if (!canManageEnterprise(req.user, existing.enterprise_id)) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const updates = {};
        if (data.name !== undefined) updates.name = data.name;
        if (data.type !== undefined) updates.type = data.type;
        if (data.center) { updates.center_lat = data.center.lat; updates.center_lng = data.center.lng; }
        if (data.radius !== undefined) updates.radius = data.radius;
        if (data.polygon !== undefined) updates.polygon = JSON.stringify(data.polygon);
        if (data.color !== undefined) updates.color = data.color;
        if (data.alertOnExit !== undefined) updates.alert_on_exit = data.alertOnExit;
        if (data.alertOnEntry !== undefined) updates.alert_on_entry = data.alertOnEntry;
        if (data.isActive !== undefined) updates.is_active = data.isActive;
        updates.updated_at = new Date();

        const [geofence] = await db('geofences').where('id', req.params.id).update(updates).returning('*');

        // Update device associations
        if (devices !== undefined) {
            await db('geofence_devices').where('geofence_id', req.params.id).del();
            if (devices.length > 0) {
                await db('geofence_devices').insert(
                    devices.map(deviceId => ({ geofence_id: req.params.id, device_id: deviceId }))
                );
            }
        }

        const deviceIds = await db('geofence_devices').where('geofence_id', req.params.id).select('device_id');
        const populatedDevices = deviceIds.length > 0
            ? await db('devices').whereIn('id', deviceIds.map(d => d.device_id))
                .select('id', 'name', 'imei', 'status', 'location_lat', 'location_lng', 'device_type')
            : [];

        const responseData = {
            ...geofence, _id: geofence.id,
            polygon: typeof geofence.polygon === 'string' ? JSON.parse(geofence.polygon) : geofence.polygon,
            center: geofence.center_lat ? { lat: geofence.center_lat, lng: geofence.center_lng } : undefined,
            devices: populatedDevices.map(d => ({
                _id: d.id, id: d.id, name: d.name, imei: d.imei, status: d.status,
                deviceType: d.device_type,
                location: { type: 'Point', coordinates: [d.location_lng, d.location_lat] }
            }))
        };

        broadcast('entity-change', {
            entity: 'geofence',
            action: 'update',
            item: responseData,
            id: geofence.id,
            message: `Zone GPS mise à jour: ${geofence.name}`
        }, geofence.enterprise_id);

        res.json(responseData);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE geofence
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const existing = await db('geofences').where('id', req.params.id).first();
        if (!existing) return res.status(404).json({ error: 'Geofence not found' });
        if (!canManageEnterprise(req.user, existing.enterprise_id)) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const deleted = await db('geofences').where('id', req.params.id).del();
        if (!deleted) return res.status(404).json({ error: 'Geofence not found' });

        broadcast('entity-change', {
            entity: 'geofence',
            action: 'delete',
            id: existing.id,
            message: `Zone GPS supprimée: ${existing.name}`
        }, existing.enterprise_id);

        res.json({ message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CHECK geofences
router.post('/check', verifyToken, async (req, res) => {
    try {
        const { enterpriseId } = req.body;

        // Scope to the calling user's enterprise if provided
        let zonesQuery = db('geofences').where('is_active', true);
        if (enterpriseId) zonesQuery = zonesQuery.where('enterprise_id', enterpriseId);
        const geofences = await zonesQuery;

        let alertsCreated = 0;

        // Get creator roles AND plans for zones (plan lives on user, not enterprise)
        const zoneCreatorIds = geofences.map(z => z.created_by).filter(Boolean);
        const creatorData = zoneCreatorIds.length > 0
            ? await db('users').whereIn('id', zoneCreatorIds).select('id', 'role', 'plan')
            : [];
        const creatorRoleMap = new Map(creatorData.map(u => [u.id?.toString(), u.role]));
        const creatorPlanMap = new Map(creatorData.map(u => [u.id?.toString(), u.plan]));

        for (const zone of geofences) {
            // Only enforce Pro plan if zone was created by an operator (not admin)
            const creatorRole = creatorRoleMap.get(zone.created_by?.toString());
            const createdByOperator = creatorRole === 'operator';
            if (createdByOperator) {
                // Use creator's plan (user.plan is the real access control field)
                const plan = creatorPlanMap.get(zone.created_by?.toString());
                const isPro = plan === 'pro' || plan === 'enterprise';
                if (!isPro) continue; // Skip non-pro operator zones
            }

            const deviceIds = await db('geofence_devices').where('geofence_id', zone.id).select('device_id');
            if (deviceIds.length === 0) continue;

            // If scoped to an enterprise, also filter devices to only that enterprise
            let devicesQuery = db('devices').whereIn('id', deviceIds.map(d => d.device_id));
            if (enterpriseId) devicesQuery = devicesQuery.where('enterprise_id', enterpriseId);
            const devices = await devicesQuery;

            for (const device of devices) {
                const lat = device.location_lat;
                const lng = device.location_lng;
                if (!lat || !lng) continue;

                let isInside = false;
                if (zone.type === 'circle' && zone.center_lat && zone.radius) {
                    const dist = haversine(lat, lng, zone.center_lat, zone.center_lng);
                    isInside = dist <= zone.radius;
                } else if (zone.type === 'polygon') {
                    const polygon = typeof zone.polygon === 'string' ? JSON.parse(zone.polygon) : zone.polygon;
                    if (polygon?.length >= 3) isInside = pointInPolygon(lat, lng, polygon);
                }

                if (!isInside && zone.alert_on_exit) {
                    await db('alerts').insert({
                        device_id: device.id, device_name: device.name,
                        enterprise_id: device.enterprise_id, type: 'geofence', severity: 'high',
                        message: `${device.name} a quitté la zone "${zone.name}"`
                    });
                    alertsCreated++;
                }
                if (isInside && zone.alert_on_entry) {
                    await db('alerts').insert({
                        device_id: device.id, device_name: device.name,
                        enterprise_id: device.enterprise_id, type: 'geofence', severity: 'medium',
                        message: `${device.name} est entré dans la zone "${zone.name}"`
                    });
                    alertsCreated++;
                }
            }
        }

        res.json({ checked: geofences.length, alertsCreated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Helpers
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;
        const intersect = ((yi > lng) !== (yj > lng)) &&
            (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export default router;
