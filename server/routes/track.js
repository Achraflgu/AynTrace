import express from 'express';
import db from '../db/knex.js';
import { broadcast, formatDeviceForFrontend, getRealAddress } from '../simulation/engine.js';

const router = express.Router();

function trackerStatusFromSpeed(speed, explicitStatus = null) {
    if (explicitStatus) return explicitStatus;
    return (Number(speed) || 0) > 0 ? 'moving' : 'online';
}

function broadcastDeviceUpdate(device) {
    const formatted = formatDeviceForFrontend(device);
    broadcast('entity-change', {
        entity: 'device',
        action: 'update',
        item: { ...formatted, silent: true },
        id: device.id,
        message: `Mise à jour tracker: ${device.name}`,
    }, device.enterprise_id);
}

// Start live tracking immediately, before the first GPS fix arrives.
router.post('/:token/start', async (req, res) => {
    try {
        const { token } = req.params;
        const device = await db('devices')
            .where({ tracking_token: token, data_source: 'real' })
            .first();

        if (!device) return res.status(404).json({ error: 'Device not found or invalid token' });

        const [updatedDevice] = await db('devices').where('id', device.id).update({
            status: 'online',
            speed: 0,
            last_update: new Date(),
            updated_at: new Date(),
        }).returning('*');

        broadcastDeviceUpdate(updatedDevice);
        res.json({ success: true, deviceId: device.id, deviceName: device.name, status: 'online' });
    } catch (error) {
        console.error('[Track] Start Error:', error.message || error);
        res.status(500).json({ error: error.message || String(error) });
    }
});

// Stop live tracking immediately and broadcast offline state to open dashboards.
router.post('/:token/stop', async (req, res) => {
    try {
        const { token } = req.params;
        const device = await db('devices')
            .where({ tracking_token: token, data_source: 'real' })
            .first();

        if (!device) return res.status(404).json({ error: 'Device not found or invalid token' });

        const [updatedDevice] = await db('devices').where('id', device.id).update({
            status: 'offline',
            speed: 0,
            updated_at: new Date(),
        }).returning('*');

        broadcastDeviceUpdate(updatedDevice);
        res.json({ success: true, deviceId: device.id, deviceName: device.name, status: 'offline' });
    } catch (error) {
        console.error('[Track] Stop Error:', error.message || error);
        res.status(500).json({ error: error.message || String(error) });
    }
});

// Receive GPS update from phone tracker
router.post('/:token', async (req, res) => {
    const { token } = req.params;
    // Log if the client aborts the request early
    req.on('aborted', () => {
        console.warn(`[Track] Request aborted by client for token ${token}`);
    });

    try {
        const { lat, lng, speed, heading, battery, altitude, accuracy } = req.body || {};

        const device = await db('devices')
            .where({ tracking_token: token, data_source: 'real' })
            .first();

        if (!device) {
            console.log(`[Track] ❌ Invalid token: ${token ? token.substring(0, 8) + '...' : token}`);
            return res.status(404).json({ error: 'Device not found or invalid token' });
        }

        // Any positive speed means the tracker is moving.
        const status = trackerStatusFromSpeed(speed, req.body?.status);
        const now = new Date();

        // Insert history and update device quickly without waiting for reverse-geocoding
        const [history] = await db('device_history').insert({
            device_id: device.id,
            location_lng: lng,
            location_lat: lat,
            speed: speed || 0,
            heading: heading || 0,
            battery: battery,
            address: null,
            status: status,
            timestamp: now,
        }).returning('*');

        const [updatedDevice] = await db('devices').where('id', device.id).update({
            location_lng: lng,
            location_lat: lat,
            speed: speed || 0,
            heading: heading || 0,
            battery: battery ?? device.battery,
            altitude: altitude,
            status: status,
            last_update: now,
            updated_at: now,
        }).returning('*');

        broadcastDeviceUpdate(updatedDevice);

        console.log(`[Track] 📱 ${device.name} | ${lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'no-coords'} | ${speed || 0} km/h | 🔋 ${battery || '--'}%`);

        // Respond quickly to minimize client timeouts / tunnel aborts
        res.json({
            success: true,
            deviceId: device.id,
            deviceName: device.name
        });

        // Resolve address asynchronously and update records when available
        (async () => {
            try {
                const address = await getRealAddress(lat, lng);
                if (address) {
                    await db('devices').where('id', device.id).update({ address });
                    if (history && history.id) {
                        await db('device_history').where('id', history.id).update({ address });
                    }
                }
            } catch (e) {
                console.error('[Track] async address update error:', e.message || e);
            }
        })();

    } catch (error) {
        console.error('[Track] Error:', error.message || error);
        res.status(500).json({ error: error.message || String(error) });
    }
});

// Support simple GET updates as a fallback (query params) for environments where POSTs may be unstable
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const speed = req.query.speed ? parseFloat(req.query.speed) : 0;
        const heading = req.query.heading ? parseFloat(req.query.heading) : 0;
        const battery = req.query.battery ? parseInt(req.query.battery) : null;
        const altitude = req.query.altitude ? parseFloat(req.query.altitude) : null;

        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return res.status(400).json({ error: 'Missing lat/lng' });
        }

        const device = await db('devices')
            .where({ tracking_token: token, data_source: 'real' })
            .first();

        if (!device) return res.status(404).json({ error: 'Device not found or invalid token' });

        const status = trackerStatusFromSpeed(speed);
        const now = new Date();

        const [history] = await db('device_history').insert({
            device_id: device.id,
            location_lng: lng,
            location_lat: lat,
            speed: speed || 0,
            heading: heading || 0,
            battery: battery,
            address: null,
            status: status,
            timestamp: now,
        }).returning('*');

        const [updatedDevice] = await db('devices').where('id', device.id).update({
            location_lng: lng,
            location_lat: lat,
            speed: speed || 0,
            heading: heading || 0,
            battery: battery ?? device.battery,
            altitude: altitude,
            status: status,
            last_update: now,
            updated_at: now,
        }).returning('*');

        broadcastDeviceUpdate(updatedDevice);

        res.json({ success: true, deviceId: device.id, deviceName: device.name });

        // background address resolution
        (async () => {
            try {
                const address = await getRealAddress(lat, lng);
                if (address) {
                    await db('devices').where('id', device.id).update({ address });
                    if (history && history.id) await db('device_history').where('id', history.id).update({ address });
                }
            } catch (e) {
                console.error('[Track] async GET address update error:', e.message || e);
            }
        })();

    } catch (error) {
        console.error('[Track] GET Error:', error.message || error);
        res.status(500).json({ error: error.message || String(error) });
    }
});

// Receive SOS from tracker page
router.post('/:token/sos', async (req, res) => {
    try {
        const { token } = req.params;
        const device = await db('devices')
            .where({ tracking_token: token, data_source: 'real' })
            .first();

        if (!device) {
            return res.status(404).json({ error: 'Device not found or invalid token' });
        }

        const message = `🚨 ALERTE SOS : ${device.name} a envoyé un signal d'urgence !`;

        const [alert] = await db('alerts').insert({
            device_id: device.id,
            device_name: device.name,
            enterprise_id: device.enterprise_id,
            type: 'sos',
            severity: 'high',
            message: message
        }).returning('*');

        const formattedAlert = {
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

        // Broadcast standard SOS alert toast popup
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

        // Broadcast entity-change for reactive logs list
        broadcast('entity-change', {
            entity: 'alert',
            action: 'create',
            item: formattedAlert,
            id: alert.id,
            message: message
        }, alert.enterprise_id);

        res.json({
            success: true,
            alert: formattedAlert
        });
    } catch (error) {
        console.error('[Track] SOS Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Get tracking info
router.get('/:token/info', async (req, res) => {
    try {
        const device = await db('devices')
            .where({ tracking_token: req.params.token, data_source: 'real' })
            .first();

        if (!device) return res.status(404).json({ error: 'Invalid tracking token' });

        res.json({
            deviceName: device.name,
            enterpriseName: device.enterprise_name,
            lastUpdate: device.last_update
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
