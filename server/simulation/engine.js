import db from '../db/knex.js';
import { routes, routeAddresses } from './routes.js';
import { sendAlertEmail } from '../utils/mailjet.js';

const addressCache = new Map();

let simulationInterval = null;
let wsClients = new Set();
let simulationCycleCount = 0;

// Cooldown map to prevent alert spam (deviceId -> { type -> timestamp })
const alertCooldowns = new Map();
const ALERT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between same alert type

// Track device zone state to detect transitions (enter/exit)
const deviceZoneState = new Map();

// Check if we should create an alert (respects cooldown)
function shouldCreateAlert(deviceId, alertType) {
    const key = `${deviceId}_${alertType}`;
    const now = Date.now();
    const lastAlert = alertCooldowns.get(key);

    if (!lastAlert || (now - lastAlert) > ALERT_COOLDOWN_MS) {
        alertCooldowns.set(key, now);
        return true;
    }
    return false;
}

// Register WebSocket client for real-time updates
export function registerClient(ws) {
    wsClients.add(ws);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'identify') {
                ws.user = data.data;  // { role, enterpriseId, userId }
                console.log(`[WebSocket] Client identified as ${ws.user.role} for enterprise ${ws.user.enterpriseId || 'global'}`);
            }
        } catch (e) {
            console.error('[WebSocket] Identify error:', e.message);
        }
    });

    ws.on('close', () => wsClients.delete(ws));
}

// Broadcast message to authorized clients
export function broadcast(type, data, enterpriseId = null) {
    const message = JSON.stringify({ type, data });
    wsClients.forEach(client => {
        if (client.readyState !== 1) return;
        const user = client.user;
        if (!user) return;

        // Admins & supervisors get everything
        if (user.role === 'admin' || user.role === 'supervisor') {
            client.send(message);
            return;
        }

        // Enterprise-scoped messages
        if (enterpriseId && user.enterpriseId === enterpriseId.toString()) {
            client.send(message);
            return;
        }

        // Operator device-update: filter to their enterprise only
        if (type === 'devices-update' && Array.isArray(data)) {
            const filteredData = data.filter(d =>
                (d.enterprise_id || d.enterpriseId)?.toString() === user.enterpriseId
            );
            if (filteredData.length > 0) {
                client.send(JSON.stringify({ type, data: filteredData }));
            }
        }
    });
}

// Broadcast support message: reaches ticket owner + all admins/supervisors
export function broadcastSupportMessage(type, data, ticketUserId = null, ticketEnterpriseId = null) {
    const message = JSON.stringify({ type, data });
    wsClients.forEach(client => {
        if (client.readyState !== 1) return;
        const user = client.user;
        if (!user) return;

        // Always send to admins/supervisors
        if (user.role === 'admin' || user.role === 'supervisor') {
            client.send(message);
            return;
        }

        // Send to the specific operator who owns the ticket
        if (ticketUserId && user.userId === ticketUserId.toString()) {
            client.send(message);
            return;
        }

        // Fallback: send to same enterprise
        if (ticketEnterpriseId && user.enterpriseId === ticketEnterpriseId.toString()) {
            client.send(message);
        }
    });
}

// Create an alert in the database and broadcast it
async function createAlert(device, type, severity, message) {
    try {
        if (!shouldCreateAlert(device.id.toString(), type)) {
            return;
        }

        const [alert] = await db('alerts').insert({
            device_id: device.id,
            device_name: device.name,
            enterprise_id: device.enterprise_id,
            type,
            severity,
            message
        }).returning('*');

        broadcast('alert-new', {
            _id: alert.id, id: alert.id,
            deviceId: alert.device_id, deviceName: alert.device_name,
            enterpriseId: alert.enterprise_id, type: alert.type,
            severity: alert.severity, message: alert.message,
            createdAt: alert.created_at
        }, device.enterprise_id);

        console.log(`[Alert] Created ${type} alerte for ${device.name}: ${message}`);
        
        // Dispatch emails for the alert
        dispatchAlertEmails(device, type, message);
    } catch (error) {
        console.error('[Alert] Failed to create alert:', error.message);
    }
}

// Check and send alert emails to relevant operators
async function dispatchAlertEmails(device, alertType, alertMessage) {
    if (!device.enterprise_id) return;
    try {
        const users = await db('users')
            .where('enterprise_id', device.enterprise_id)
            .where('role', 'operator')
            .whereIn('plan', ['pro', 'enterprise']);
            
        for (const user of users) {
             const prefs = typeof user.email_alert_prefs === 'string' ? JSON.parse(user.email_alert_prefs) : user.email_alert_prefs;
             if (prefs && prefs.enabled === true && Array.isArray(prefs.types) && prefs.types.includes(alertType)) {
                 sendAlertEmail(user.email, user.name, alertType, alertMessage, device.name);
             }
        }
    } catch (error) {
        console.error('[Dispatch Emails] Error:', error.message);
    }
}

// Calculate realistic speed based on route segment
function calculateSpeed(route, currentIndex) {
    let baseSpeed = 40 + Math.random() * 20;

    if (currentIndex > 0 && currentIndex < route.length - 1) {
        const prev = route[currentIndex - 1];
        const curr = route[currentIndex];
        const next = route[currentIndex + 1];

        const angle1 = Math.atan2(curr[1] - prev[1], curr[0] - prev[0]);
        const angle2 = Math.atan2(next[1] - curr[1], next[0] - curr[0]);
        const angleDiff = Math.abs(angle2 - angle1);

        if (angleDiff > 0.3) {
            baseSpeed *= 0.6;
        }
    }

    if (Math.random() < 0.05) {
        baseSpeed = 0;
    }

    return Math.round(baseSpeed);
}

// Calculate heading from two points
function calculateHeading(from, to) {
    const dLng = to[0] - from[0];
    const dLat = to[1] - from[1];
    let heading = Math.atan2(dLng, dLat) * (180 / Math.PI);
    if (heading < 0) heading += 360;
    return Math.round(heading);
}

// Get address for current position
function getAddress(routeId, index) {
    const addresses = routeAddresses[routeId];
    if (!addresses || addresses.length === 0) return 'Position inconnue';
    const addressIndex = Math.floor((index / routes[routeId].length) * addresses.length);
    return addresses[Math.min(addressIndex, addresses.length - 1)];
}

let lastRequestTime = 0;
let backoffUntil = 0;
const requestQueue = [];
let processingQueue = false;

async function processQueue() {
    if (processingQueue) return;
    processingQueue = true;
    while (requestQueue.length > 0) {
        const { lat, lng, routeId, index, resolve } = requestQueue.shift();
        
        // Respect backoff
        if (Date.now() < backoffUntil) {
            resolve(null);
            continue;
        }

        // Ensure 1.2s delay between Nominatim calls to be safe and respect policies
        const now = Date.now();
        const timeSinceLast = now - lastRequestTime;
        if (timeSinceLast < 1200) {
            await new Promise(r => setTimeout(r, 1200 - timeSinceLast));
        }
        
        lastRequestTime = Date.now();

        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&accept-language=fr`;
            const res = await fetch(url, {
                headers: { 'User-Agent': 'AynTrace-Geocoding-Service/1.0 (contact@ayntrace.com)' }
            });
            
            if (!res.ok) {
                console.warn(`[Geocoding] Nominatim returned status ${res.status}`);
                if (res.status === 429 || res.status === 403) {
                    console.warn(`[Geocoding] Backoff activated for 2 minutes due to status ${res.status}`);
                    backoffUntil = Date.now() + 2 * 60 * 1000; // 2 minutes backoff
                }
                resolve(null);
                continue;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await res.text();
                console.warn(`[Geocoding] Expected JSON, got ${contentType}. Response preview: ${text.substring(0, 100)}`);
                resolve(null);
                continue;
            }

            const data = await res.json();
            if (data && data.display_name) {
                const parts = data.display_name.split(',');
                const address = parts.slice(0, 3).join(', ').trim();
                resolve(address);
            } else {
                resolve(null);
            }
        } catch (e) {
            console.error('[Geocoding] Error during reverse geocoding:', e.message);
            resolve(null);
        }
    }
    processingQueue = false;
}

export async function getRealAddress(lat, lng, routeId, index) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCache.has(key)) {
        return addressCache.get(key);
    }

    // Call geocoding service via queue
    let address = null;
    if (Date.now() >= backoffUntil) {
        address = await new Promise((resolve) => {
            requestQueue.push({ lat, lng, routeId, index, resolve });
            processQueue();
        });
    }

    if (address) {
        addressCache.set(key, address);
        return address;
    }

    // Fallbacks
    if (routeId !== undefined && index !== undefined) {
        return getAddress(routeId, index);
    }
    return 'Position inconnue';
}

// Device type behavior profiles — 7 standardized types
const DEVICE_BEHAVIORS = {
    // New standardized types
    voiture:   { movingChance: 0.85, stopDurationMin: 2,   stopDurationMax: 10,   moveDurationMin: 20, moveDurationMax: 60  },
    camion:    { movingChance: 0.80, stopDurationMin: 5,   stopDurationMax: 15,   moveDurationMin: 30, moveDurationMax: 90  },
    moto:      { movingChance: 0.75, stopDurationMin: 3,   stopDurationMax: 10,   moveDurationMin: 15, moveDurationMax: 45  },
    mobilite:  { movingChance: 0.60, stopDurationMin: 5,   stopDurationMax: 20,   moveDurationMin: 10, moveDurationMax: 30  },
    personnel: { movingChance: 0.40, stopDurationMin: 15,  stopDurationMax: 60,   moveDurationMin: 5,  moveDurationMax: 15  },
    animal:    { movingChance: 0.30, stopDurationMin: 20,  stopDurationMax: 120,  moveDurationMin: 3,  moveDurationMax: 10  },
    objet:     { movingChance: 0.05, stopDurationMin: 200, stopDurationMax: 1000, moveDurationMin: 1,  moveDurationMax: 3   },
    // Legacy aliases for existing DB records
    vehicle:   { movingChance: 0.85, stopDurationMin: 2,   stopDurationMax: 10,   moveDurationMin: 20, moveDurationMax: 60  },
    tracker:   { movingChance: 0.60, stopDurationMin: 5,   stopDurationMax: 20,   moveDurationMin: 10, moveDurationMax: 30  },
    gps:       { movingChance: 0.75, stopDurationMin: 3,   stopDurationMax: 10,   moveDurationMin: 15, moveDurationMax: 40  },
    personal:  { movingChance: 0.40, stopDurationMin: 15,  stopDurationMax: 60,   moveDurationMin: 5,  moveDurationMax: 15  },
    asset:     { movingChance: 0.10, stopDurationMin: 50,  stopDurationMax: 200,  moveDurationMin: 3,  moveDurationMax: 10  },
};

// Reference coordinates for slow-moving device types to calculate 1km movement threshold
const slowDeviceStartCoords = new Map();

// Update a single fake device - all devices always move
async function updateFakeDevice(device, settingsCache) {
    try {
        const routeId = device.sim_route_id || 'tunis-ariana';
        const route = routes[routeId];

        if (!route || route.length < 2) {
            return;
        }

        let currentIndex = device.sim_current_index || 0;
        let direction = device.sim_direction || 1;

        // Determine device role based on device ID hash (~30% parked, ~70% moving)
        const deviceIdHash = device.id.toString().split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const isParkedDevice = deviceIdHash % 10 < 3;

        let speed = 0;
        let status = 'online';
        const isSlowType = ['personnel', 'animal', 'objet'].includes(device.device_type);

        if (isParkedDevice) {
            speed = 0;
            status = 'online';
            if (isSlowType) {
                const currentPos = route[currentIndex] || route[0];
                slowDeviceStartCoords.set(device.id.toString(), { lat: currentPos[1], lng: currentPos[0] });
            }
        } else {
            currentIndex = Math.max(0, Math.min(currentIndex, route.length - 1));
            currentIndex += direction;

            if (currentIndex >= route.length - 1) {
                direction = -1;
                currentIndex = route.length - 1;
            } else if (currentIndex <= 0) {
                direction = 1;
                currentIndex = 0;
            }

            const currentPos = route[currentIndex];

            if (isSlowType) {
                let startCoord = slowDeviceStartCoords.get(device.id.toString());
                if (!startCoord) {
                    startCoord = { lat: currentPos[1], lng: currentPos[0] };
                    slowDeviceStartCoords.set(device.id.toString(), startCoord);
                }

                const dist = haversineDistance(currentPos[1], currentPos[0], startCoord.lat, startCoord.lng);
                if (dist >= 1000) { // 1km threshold
                    status = 'moving';
                    if (device.device_type === 'personnel') {
                        speed = Math.max(3, Math.min(8, calculateSpeed(route, currentIndex) * 0.15));
                    } else if (device.device_type === 'animal') {
                        speed = Math.max(2, Math.min(12, calculateSpeed(route, currentIndex) * 0.20));
                    } else { // objet
                        speed = Math.max(1, Math.min(4, calculateSpeed(route, currentIndex) * 0.08));
                    }
                    speed = Math.round(speed);
                } else {
                    status = 'idle';
                    speed = 0;
                }
            } else {
                speed = calculateSpeed(route, currentIndex);
                speed = Math.max(5, speed + Math.floor((Math.random() - 0.5) * 10));
                status = speed > 15 ? 'moving' : 'idle';
            }
        }

        const currentPos = route[currentIndex];
        if (!currentPos) return;

        const realAddress = await getRealAddress(currentPos[1], currentPos[0], routeId, currentIndex);

        const prevIndex = Math.max(0, Math.min(currentIndex - direction, route.length - 1));
        const prevPos = route[prevIndex] || currentPos;

        const heading = calculateHeading(prevPos, currentPos);

        const batteryDrain = speed > 0 ? 0.3 + Math.random() * 0.4 : 0.05;
        const newBattery = Math.max(5, device.battery - batteryDrain);

        // Speed spike: 10% chance for moving devices (only for vehicles)
        if (!isParkedDevice && !isSlowType && Math.random() < 0.1) {
            speed = 80 + Math.floor(Math.random() * 40);
        }

        const signalBase = device.signal || 85;
        const signal = Math.max(50, Math.min(100, signalBase + (Math.random() - 0.5) * 5));

        // Update device in PostgreSQL
        await db('devices').where('id', device.id).update({
            location_lng: currentPos[0],
            location_lat: currentPos[1],
            address: realAddress,
            speed,
            heading,
            battery: Math.round(newBattery * 10) / 10,
            signal: Math.round(signal),
            status: (!isSlowType && speed > 70) ? 'moving' : status,
            last_update: new Date(),
            sim_current_index: currentIndex,
            sim_direction: direction,
        });

        // Save to history (every 3rd update)
        if (currentIndex % 3 === 0) {
            await db('device_history').insert({
                device_id: device.id,
                location_lng: currentPos[0],
                location_lat: currentPos[1],
                speed,
                heading,
                battery: Math.round(newBattery),
                signal: Math.round(signal),
                address: realAddress,
                status,
                timestamp: new Date(),
            });
        }

        // === AUTOMATIC ALERT DETECTION ===
        const alertSettings = settingsCache?.get(device.enterprise_id?.toString()) || {};

        // 1. Low battery alert
        const batteryConfig = alertSettings.battery || { enabled: true, threshold: 30 };
        if (batteryConfig.enabled && newBattery < batteryConfig.threshold) {
            const severity = newBattery < (batteryConfig.threshold / 2) ? 'high' : 'medium';
            await createAlert(device, 'battery', severity,
                `🔋 Batterie faible: ${device.name} (${Math.round(newBattery)}%)`);
        }

        // 2. Speeding alert
        const speedConfig = alertSettings.speed || { enabled: true, threshold: 70 };
        if (speedConfig.enabled && speed > speedConfig.threshold) {
            await createAlert(device, 'speed', speed > (speedConfig.threshold * 1.3) ? 'high' : 'medium',
                `🏎️ Vitesse excessive: ${device.name} (${Math.round(speed)} km/h)`);
        }

        // 3. Low signal alert
        const signalConfig = alertSettings.signal || { enabled: true, threshold: 55 };
        if (signalConfig.enabled && signal < signalConfig.threshold) {
            await createAlert(device, 'signal', 'medium',
                `📶 Signal faible: ${device.name} (${Math.round(signal)}%)`);
        }

        // 4. SOS alert
        const sosConfig = alertSettings.sos || { enabled: true };
        if (sosConfig.enabled && !isParkedDevice && speed > 20 && Math.random() < 0.01) {
            await createAlert(device, 'sos', 'high',
                `🆘 Alerte SOS: ${device.name} - Bouton SOS activé`);
        }

    } catch (error) {
        console.error(`[Simulation] Error updating device ${device.name}:`, error.message);
    }
}

// Mark devices as offline if they haven't sent updates recently
async function checkOfflineDevices(settingsCache) {
    try {
        const threshold = new Date(Date.now() - 10 * 1000); // 10 seconds ago

        const inactiveDevices = await db('devices')
            .whereNot('status', 'offline')
            .where('last_update', '<', threshold);

        if (inactiveDevices.length > 0) {
            for (const device of inactiveDevices) {
                const [updatedDevice] = await db('devices').where('id', device.id).update({
                    status: 'offline',
                    speed: 0,
                    updated_at: new Date(),
                }).returning('*');

                const formattedDevice = formatDeviceForFrontend(updatedDevice);
                broadcast('entity-change', {
                    entity: 'device',
                    action: 'update',
                    item: { ...formattedDevice, silent: true },
                    id: updatedDevice.id,
                    message: `Appareil hors ligne: ${updatedDevice.name}`,
                }, updatedDevice.enterprise_id);

                const alertSettings = settingsCache?.get(device.enterprise_id?.toString()) || {};
                const offlineConfig = alertSettings.offline || { enabled: true };
                
                if (offlineConfig.enabled) {
                    await createAlert(device, 'offline', 'high',
                        'Appareil hors ligne - Aucune mise à jour depuis plus de 10 secondes');
                }
            }
        }
    } catch (error) {
        console.error('[Health] Error checking offline devices:', error.message);
    }
}

// Convert PostgreSQL snake_case row to frontend-compatible camelCase format
export function formatDeviceForFrontend(d) {
    return {
        _id: d.id,
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
            type: 'Point',
            coordinates: [d.location_lng, d.location_lat]
        },
        address: d.address,
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
        ignition: d.ignition,
        simulation: {
            isRunning: d.sim_is_running,
            routeId: d.sim_route_id,
            currentIndex: d.sim_current_index,
            direction: d.sim_direction
        }
    };
}

// Run one simulation cycle
async function runSimulationCycle() {
    try {
        simulationCycleCount++;
        
        const enterprises = await db('enterprises').select('id', 'alert_settings');
        const settingsCache = new Map(enterprises.map(e => [
            e.id?.toString(),
            (typeof e.alert_settings === 'string' ? JSON.parse(e.alert_settings) : e.alert_settings) || {}
        ]));

        await checkOfflineDevices(settingsCache);

        // Get all fake devices that are running simulation
        const fakeDevices = await db('devices')
            .where('data_source', 'fake')
            .where('sim_is_running', true);

        // Update each fake device
        await Promise.all(fakeDevices.map(d => updateFakeDevice(d, settingsCache)));

        // Get all devices for broadcast — format for frontend compatibility
        const allDevices = await db('devices');
        const formatted = allDevices.map(formatDeviceForFrontend);
        broadcast('devices-update', formatted);

        // Log simulation cycle
        const enterpriseIds = new Set(allDevices.map(d => d.enterprise_id?.toString()));
        if (fakeDevices.length > 0) {
            console.log(`[Simulation] Updated ${fakeDevices.length} devices | ${enterpriseIds.size} enterprises | ${allDevices.length} total`);
        }

        // Check geofence boundaries
        await checkGeofences(allDevices, settingsCache);
    } catch (error) {
        console.error('[Simulation] Error:', error.message);
    }
}

// Start simulation engine
export function startSimulation(intervalMs = 5000) {
    if (simulationInterval) {
        console.log('[Simulation] Already running');
        return;
    }

    console.log(`[Simulation] Starting with ${intervalMs}ms interval`);
    simulationInterval = setInterval(runSimulationCycle, intervalMs);
    runSimulationCycle();
}

// Stop simulation
export function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
        console.log('[Simulation] Stopped');
    }
}

// ─── Geofence boundary checking ────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
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

async function checkGeofences(allDevices, settingsCache) {
    try {
        const geofences = await db('geofences').where('is_active', true);
        if (geofences.length === 0) {
            return;
        }

        // Fetch zone creator info (role + plan) from users table
        // Plan is stored at the USER level, not the enterprise level
        const zoneCreatorIds = geofences.map(z => z.created_by).filter(Boolean);
        const creatorUsers = zoneCreatorIds.length > 0
            ? await db('users').whereIn('id', zoneCreatorIds).select('id', 'role', 'plan')
            : [];
        const creatorMap = new Map(creatorUsers.map(u => [u.id?.toString(), u]));

        // Fetch geofence assigned devices
        const deviceMap = new Map(allDevices.map(d => [d.id.toString(), d]));
        const geofenceDevices = await db('geofence_devices');
        const geofenceToDevices = {};
        geofenceDevices.forEach(gd => {
            const zId = gd.geofence_id.toString();
            if (!geofenceToDevices[zId]) geofenceToDevices[zId] = [];
            geofenceToDevices[zId].push(gd.device_id.toString());
        });

        for (const zone of geofences) {
            // Only enforce Pro plan for operator-created zones (admin zones always pass)
            const creator = creatorMap.get(zone.created_by?.toString());
            const createdByOperator = creator?.role === 'operator';
            if (createdByOperator) {
                // Check the CREATOR USER's plan (stored in users.plan, not enterprises.plan)
                const creatorPlan = (creator?.plan || '').toLowerCase();
                const isPro = creatorPlan === 'pro' || creatorPlan === 'enterprise';
                if (!isPro) {
                    continue; // Skip operator-created zones if user is not Pro
                }
            }

            const devicesInZone = geofenceToDevices[zone.id.toString()] || [];
            if (devicesInZone.length === 0) {
                continue; // Skip empty zones
            }

            for (const deviceId of devicesInZone) {
                const device = deviceMap.get(deviceId);
                if (!device || device.location_lng == null) {
                    continue;
                }

                // Check per-enterprise alert settings (geofence alerts enabled/disabled in settings)
                const alertSettings = settingsCache?.get(device.enterprise_id?.toString()) || {};
                const geofenceConfig = alertSettings.geofence || { enabled: true };
                if (!geofenceConfig.enabled) {
                    continue;
                }

                const lat = device.location_lat;
                const lng = device.location_lng;
                let isInside = false;

                if (zone.type === 'circle' && zone.center_lat && zone.radius) {
                    const dist = haversineDistance(lat, lng, zone.center_lat, zone.center_lng);
                    isInside = dist <= zone.radius;
                } else if (zone.type === 'polygon') {
                    const polygon = typeof zone.polygon === 'string' ? JSON.parse(zone.polygon) : zone.polygon;
                    if (polygon?.length >= 3) {
                        isInside = pointInPolygon(lat, lng, polygon);
                    }
                }

                const stateKey = `${device.id}_${zone.id}`;
                const wasInside = deviceZoneState.get(stateKey);

                // Detect EXIT transition
                if (wasInside === true && !isInside && zone.alert_on_exit) {
                    const cooldownKey = `geofence_exit_${zone.id}`;
                    if (shouldCreateAlert(device.id, cooldownKey)) {
                        const msg = `⚠️ Sortie de zone: ${device.name} a quitté la zone "${zone.name}"`;
                        await db('alerts').insert({
                            device_id: device.id,
                            device_name: device.name,
                            enterprise_id: device.enterprise_id,
                            type: 'geofence',
                            severity: 'high',
                            message: msg
                        });
                        broadcast('alert-new', {
                            deviceId: device.id, deviceName: device.name,
                            type: 'geofence', severity: 'high', message: msg
                        }, device.enterprise_id);
                        console.log(`[Geofence] 🚨 SORTIE alert fired: ${device.name} → "${zone.name}"`);
                        dispatchAlertEmails(device, 'geofence', msg);
                    }
                }

                // Detect ENTRY transition
                if (wasInside === false && isInside && zone.alert_on_entry) {
                    const cooldownKey = `geofence_entry_${zone.id}`;
                    if (shouldCreateAlert(device.id, cooldownKey)) {
                        const msg = `📍 Entrée de zone: ${device.name} est entré dans la zone "${zone.name}"`;
                        await db('alerts').insert({
                            device_id: device.id,
                            device_name: device.name,
                            enterprise_id: device.enterprise_id,
                            type: 'geofence',
                            severity: 'medium',
                            message: msg
                        });
                        broadcast('alert-new', {
                            deviceId: device.id, deviceName: device.name,
                            type: 'geofence', severity: 'medium', message: msg
                        }, device.enterprise_id);
                        console.log(`[Geofence] 📍 ENTRÉE alert fired: ${device.name} → "${zone.name}"`);
                        dispatchAlertEmails(device, 'geofence', msg);
                    }
                }

                deviceZoneState.set(stateKey, isInside);
            }
        }
    } catch (error) {

        console.error('[Geofence] Error checking boundaries:', error.message);
    }
}
