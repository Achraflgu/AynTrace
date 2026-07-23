import express from 'express';
import db from '../db/knex.js';
import { broadcast, formatDeviceForFrontend } from '../simulation/engine.js';
import { logAudit } from '../utils/auditLogger.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { getNextDeviceIds, validateDeviceUniqueness } from '../utils/deviceIdHelper.js';
import crypto from 'crypto';

const router = express.Router();

async function findDeviceByKey(key) {
    return db('devices').where('id', key).orWhere('imei', key).first();
}

// Helper: convert snake_case DB row to frontend-compatible format
function formatDevice(d) {
    return {
        _id: d.id, id: d.id, imei: d.imei, name: d.name,
        deviceType: d.device_type, serialNumber: d.serial_number,
        subscriberNumber: d.subscriber_number, plateId: d.plate_id,
        assignedTo: d.assigned_to, enterpriseId: d.enterprise_id,
        enterpriseName: d.enterprise_name, dataSource: d.data_source,
        trackingToken: d.tracking_token, status: d.status, lastUpdate: d.last_update,
        location: { type: 'Point', coordinates: [d.location_lng, d.location_lat] },
        address: d.address, speed: d.speed, heading: d.heading, battery: d.battery,
        signal: d.signal, altitude: d.altitude, temperature: d.temperature,
        fuelLevel: d.fuel_level, fuelType: d.fuel_type, brand: d.brand,
        odometer: d.odometer, ignition: d.ignition,
        simulation: { isRunning: d.sim_is_running, routeId: d.sim_route_id }
    };
}

// Get all devices
router.get('/', verifyToken, async (req, res) => {
    try {
        const { enterpriseId, status } = req.query;
        let query = db('devices');
        if (enterpriseId) query = query.where('enterprise_id', enterpriseId);
        if (status && status !== 'all') query = query.where('status', status);

        const devices = await query.orderBy('updated_at', 'desc');

        const formatted = devices.map(d => ({
            id: d.id,
            imei: d.imei,
            name: d.name,
            deviceType: d.device_type,
            serialNumber: d.serial_number,
            subscriberNumber: d.subscriber_number,
            plateId: d.plate_id,
            assignedTo: d.assigned_to,
            enterpriseId: d.enterprise_id,
            enterpriseName: d.enterprise_name,
            dataSource: d.data_source,
            trackingToken: d.tracking_token,
            status: d.status,
            lastUpdate: d.last_update,
            location: {
                lat: d.location_lat,
                lng: d.location_lng,
                address: d.address
            },
            speed: d.speed,
            heading: d.heading,
            battery: d.battery,
            signal: d.signal,
            altitude: d.altitude,
            temperature: d.temperature,
            fuelLevel: d.fuel_level,
            fuelType: d.fuel_type,
            brand: d.brand,
            odometer: d.odometer,
            ignition: d.ignition
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single device
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const device = await findDeviceByKey(req.params.id);
        if (!device) return res.status(404).json({ error: 'Device not found' });
        res.json(formatDevice(device));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create device
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        let deviceData = {
            name: req.body.name,
            imei: req.body.imei,
            device_type: req.body.deviceType || 'voiture',
            serial_number: req.body.serialNumber,
            subscriber_number: req.body.subscriberNumber,
            plate_id: req.body.plateId,
            assigned_to: req.body.assignedTo,
            enterprise_id: req.body.enterpriseId,
            enterprise_name: req.body.enterpriseName,
            data_source: req.body.dataSource || 'fake',
            location_lng: req.body.location?.lng || 10.1815,
            location_lat: req.body.location?.lat || 36.8065,
            address: req.body.location?.address || '',
            fuel_type: req.body.fuelType,
            brand: req.body.brand,
        };

        // Auto-generate missing IDs using the enterprise's prefixes
        if (!deviceData.serial_number || !deviceData.imei || !deviceData.subscriber_number) {
            const nextIds = await getNextDeviceIds(deviceData.enterprise_id);
            if (!deviceData.serial_number) deviceData.serial_number = nextIds.serialNumber;
            if (!deviceData.imei) deviceData.imei = nextIds.imei;
            if (!deviceData.subscriber_number) deviceData.subscriber_number = nextIds.subscriberNumber;
        }

        // Validate uniqueness of IMEI, serial number, and subscriber number
        await validateDeviceUniqueness({
            imei: deviceData.imei,
            serialNumber: deviceData.serial_number,
            subscriberNumber: deviceData.subscriber_number,
        });

        if (deviceData.data_source === 'real') {
            deviceData.tracking_token = crypto.randomBytes(16).toString('hex');
        }

        const [device] = await db('devices').insert(deviceData).returning('*');

        await logAudit('device.create', 'Admin', {
            targetType: 'device', targetId: device.id, targetName: device.name
        });

        broadcast('entity-change', {
            entity: 'device',
            action: 'create',
            item: formatDeviceForFrontend(device),
            id: device.id,
            message: `Nouvel appareil créé: ${device.name}`
        }, device.enterprise_id);

        res.status(201).json(formatDevice(device));
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message });
    }
});

// Update device
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { role, enterpriseId } = req.user;
        const deviceId = req.params.id;

        const existingDevice = await findDeviceByKey(deviceId);
        if (!existingDevice) return res.status(404).json({ error: 'Device not found' });

        if (role !== 'admin' && existingDevice.enterprise_id !== enterpriseId) {
            return res.status(403).json({ error: 'Forbidden. Apparatus belongs to another enterprise.' });
        }

        const updates = {};
        
        // Both Admin and Operator can update Name, DeviceType, and type-specific fields
        if (req.body.name !== undefined) updates.name = req.body.name;
        if (req.body.deviceType !== undefined) updates.device_type = req.body.deviceType;
        if (req.body.plateId !== undefined) updates.plate_id = req.body.plateId;
        if (req.body.fuelType !== undefined) updates.fuel_type = req.body.fuelType;
        if (req.body.brand !== undefined) updates.brand = req.body.brand;
        if (req.body.assignedTo !== undefined) updates.assigned_to = req.body.assignedTo;

        // Only Admin can update other sensitive fields
        if (role === 'admin') {
            if (req.body.status !== undefined) updates.status = req.body.status;
            if (req.body.enterpriseId !== undefined) updates.enterprise_id = req.body.enterpriseId;
            if (req.body.imei !== undefined) updates.imei = req.body.imei;
            if (req.body.serialNumber !== undefined) updates.serial_number = req.body.serialNumber;
            if (req.body.subscriberNumber !== undefined) updates.subscriber_number = req.body.subscriberNumber;
            if (req.body.enterpriseName !== undefined) updates.enterprise_name = req.body.enterpriseName;
            if (req.body.location) {
                updates.location_lng = req.body.location.lng;
                updates.location_lat = req.body.location.lat;
                updates.address = req.body.location.address;
            }
            if (req.body.dataSource !== undefined) {
                updates.data_source = req.body.dataSource;
                if (req.body.dataSource === 'fake') {
                    updates.sim_is_running = true;
                    updates.sim_current_index = 0;
                    updates.sim_direction = 1;
                    updates.sim_route_id = 'tunis-ariana';
                } else if (req.body.dataSource === 'real') {
                    updates.sim_is_running = false;
                    if (!existingDevice.tracking_token) {
                        updates.tracking_token = crypto.randomBytes(16).toString('hex');
                    }
                }
            }
        }

        // Validate uniqueness for any changed IMEI, serial, or subscriber
        await validateDeviceUniqueness({
            imei: updates.imei,
            serialNumber: updates.serial_number,
            subscriberNumber: updates.subscriber_number,
        }, existingDevice.id);
        
        updates.updated_at = new Date();

        const [device] = await db('devices').where('id', existingDevice.id).update(updates).returning('*');

        // If status changed to stolen or lost, create alert
        if (updates.status === 'stolen' || updates.status === 'lost') {
            const message = updates.status === 'stolen'
                ? `🚨 ALERTE VOL : L'appareil "${device.name}" a été déclaré volé !`
                : `⚠️ ALERTE PERTE : L'appareil "${device.name}" a été déclaré perdu !`;

            const [alert] = await db('alerts').insert({
                device_id: device.id,
                device_name: device.name,
                enterprise_id: device.enterprise_id,
                type: 'sos',
                severity: 'high',
                message
            }).returning('*');
            
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
            }, device.enterprise_id);
        }

        await logAudit('device.update', 'Admin', {
            targetType: 'device', targetId: device.id, targetName: device.name
        });

        broadcast('entity-change', {
            entity: 'device',
            action: 'update',
            item: formatDeviceForFrontend(device),
            id: device.id,
            message: `Appareil mis à jour: ${device.name}`
        }, device.enterprise_id);

        res.json(formatDevice(device));
    } catch (error) {
        const status = error.statusCode || 400;
        res.status(status).json({ error: error.message });
    }
});

// Delete device
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const device = await findDeviceByKey(req.params.id);
        if (!device) return res.status(404).json({ error: 'Device not found' });

        await db('devices').where('id', device.id).del();

        await logAudit('device.delete', 'Admin', {
            targetType: 'device', targetId: device.id, targetName: device.name
        });

        broadcast('entity-change', {
            entity: 'device',
            action: 'delete',
            id: device.id,
            message: `Appareil supprimé: ${device.name}`
        }, device.enterprise_id);

        res.json({ message: 'Device deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get device history
router.get('/:id/history', verifyToken, async (req, res) => {
    try {
        const { start, end, limit = 1000 } = req.query;
        const device = await findDeviceByKey(req.params.id);
        if (!device) return res.status(404).json({ error: 'Device not found' });

        let query = db('device_history').where('device_id', device.id);

        if (start) query = query.where('timestamp', '>=', new Date(start));
        if (end) query = query.where('timestamp', '<=', new Date(end));

        const history = await query.orderBy('timestamp', 'desc').limit(parseInt(limit));

        // Map database rows to the frontend response format
        const formatted = history.map(h => ({
            _id: h.id,
            deviceId: h.device_id,
            location: {
                type: 'Point',
                coordinates: [h.location_lng, h.location_lat]
            },
            speed: h.speed,
            heading: h.heading,
            battery: h.battery,
            signal: h.signal,
            address: h.address,
            status: h.status,
            timestamp: h.timestamp,
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
