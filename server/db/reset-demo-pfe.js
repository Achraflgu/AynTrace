import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from './knex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEMO_PASSWORDS = {
    admin: 'PFE-Admin-6B2794',
    supervisor: 'PFE-Super-C20650',
    mainOperator: 'PFE-Oper-8C15B7',
    transportOperator: 'PFE-Trans-5FC3FC',
    deliveryOperator: 'PFE-Deliv-E87D00',
};

const now = () => new Date();
const day = 24 * 60 * 60 * 1000;

function uuid() {
    return crypto.randomUUID();
}

function addDays(days) {
    return new Date(Date.now() + days * day);
}

function pastHours(hours) {
    return new Date(Date.now() - hours * 60 * 60 * 1000);
}

async function hash(password) {
    return bcrypt.hash(password, 10);
}

async function tableExists(tableName) {
    return db.schema.hasTable(tableName);
}

async function backupDatabase() {
    const tables = await db('information_schema.tables')
        .select('table_name')
        .where({ table_schema: 'public', table_type: 'BASE TABLE' })
        .orderBy('table_name');

    const backup = {
        createdAt: new Date().toISOString(),
        note: 'Automatic backup before PFE demo reset',
        tables: {},
    };

    for (const { table_name } of tables) {
        backup.tables[table_name] = await db(table_name).select('*');
    }

    const backupDir = path.resolve(__dirname, 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `geotrack-before-pfe-reset-${stamp}.json`);
    await fs.writeFile(backupPath, JSON.stringify(backup, null, 2), 'utf8');
    return backupPath;
}

function enterpriseRows(ids) {
    const alertSettings = {
        battery: { enabled: true, threshold: 30 },
        speed: { enabled: true, threshold: 70 },
        signal: { enabled: true, threshold: 55 },
        sos: { enabled: true },
        offline: { enabled: true },
        geofence: { enabled: true },
    };

    return [
        {
            id: ids.smartFleet,
            name: 'Smart Fleet Tunisia',
            contact_email: 'achrafguemati557@gmail.com',
            contact_phone: '+216 22 557 557',
            phone: '+216 22 557 557',
            address: 'Avenue Habib Bourguiba, Tunis',
            status: 'active',
            serial_prefix: 'SFT',
            last_serial_counter: 7,
            imei_prefix: '359071',
            last_imei_counter: 7,
            subscriber_prefix: '500',
            last_subscriber_counter: 7,
            alert_settings: JSON.stringify(alertSettings),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.logitrans,
            name: 'LogiTrans Pro',
            contact_email: 'client.transport@ayntrace.tn',
            contact_phone: '+216 31 404 100',
            phone: '+216 31 404 100',
            address: 'Zone Industrielle Ben Arous',
            status: 'active',
            serial_prefix: 'LTP',
            last_serial_counter: 2,
            imei_prefix: '359072',
            last_imei_counter: 2,
            subscriber_prefix: '501',
            last_subscriber_counter: 2,
            alert_settings: JSON.stringify(alertSettings),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.delivery,
            name: 'Medina Delivery',
            contact_email: 'client.delivery@ayntrace.tn',
            contact_phone: '+216 27 808 300',
            phone: '+216 27 808 300',
            address: 'Ariana, Tunisie',
            status: 'active',
            serial_prefix: 'MD',
            last_serial_counter: 2,
            imei_prefix: '359073',
            last_imei_counter: 2,
            subscriber_prefix: '502',
            last_subscriber_counter: 2,
            alert_settings: JSON.stringify(alertSettings),
            created_at: now(),
            updated_at: now(),
        },
    ];
}

async function userRows(ids, passwords) {
    return [
        {
            id: ids.admin,
            email: 'ach45gu14@gmail.com',
            password: await hash(passwords.admin),
            name: 'Achraf Guemati',
            role: 'admin',
            plan: 'enterprise',
            enterprise_id: null,
            enterprise_name: null,
            email_verified: true,
            is_initial_password: false,
            billing_status: 'active',
            email_alert_prefs: JSON.stringify({ enabled: false, types: [] }),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.supervisor,
            email: 'supervisor@ayntrace.tn',
            password: await hash(passwords.supervisor),
            name: 'Superviseur Demo',
            role: 'supervisor',
            plan: 'enterprise',
            enterprise_id: null,
            enterprise_name: null,
            email_verified: true,
            is_initial_password: false,
            billing_status: 'active',
            email_alert_prefs: JSON.stringify({ enabled: false, types: [] }),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.mainOperator,
            email: 'achrafguemati557@gmail.com',
            password: await hash(passwords.mainOperator),
            name: 'Achraf Operateur',
            role: 'operator',
            plan: 'pro',
            enterprise_id: ids.smartFleet,
            enterprise_name: 'Smart Fleet Tunisia',
            email_verified: true,
            is_initial_password: false,
            saved_payment_method: 'd17',
            saved_billing_cycle: 'monthly',
            billing_status: 'active',
            billing_next_due: addDays(26),
            email_alert_prefs: JSON.stringify({ enabled: true, types: ['battery', 'speed', 'geofence', 'offline'] }),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.transportOperator,
            email: 'client.transport@ayntrace.tn',
            password: await hash(passwords.transportOperator),
            name: 'Karim Ben Ali',
            role: 'operator',
            plan: 'starter',
            enterprise_id: ids.logitrans,
            enterprise_name: 'LogiTrans Pro',
            email_verified: true,
            is_initial_password: false,
            saved_payment_method: 'bank_transfer',
            saved_billing_cycle: 'monthly',
            billing_status: 'warning',
            billing_next_due: addDays(2),
            email_alert_prefs: JSON.stringify({ enabled: false, types: [] }),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.deliveryOperator,
            email: 'client.delivery@ayntrace.tn',
            password: await hash(passwords.deliveryOperator),
            name: 'Nour Delivery',
            role: 'operator',
            plan: 'pro',
            enterprise_id: ids.delivery,
            enterprise_name: 'Medina Delivery',
            email_verified: true,
            is_initial_password: false,
            saved_payment_method: 'mastercard',
            saved_billing_cycle: 'biannual',
            billing_status: 'active',
            billing_next_due: addDays(75),
            email_alert_prefs: JSON.stringify({ enabled: true, types: ['battery', 'offline'] }),
            created_at: now(),
            updated_at: now(),
        },
    ];
}

function deviceRows(ids) {
    const mainDevices = [
        ['Toyota Corolla - Sales 01', 'voiture', 'moving', 36.8065, 10.1815, 52, 78, 92, 'Avenue Habib Bourguiba, Tunis', 'tunis-marsa', 'TU-145-AF', 'Toyota', 'essence'],
        ['Camion Isuzu - Livraison', 'camion', 'moving', 36.8400, 10.2100, 46, 64, 88, 'Zone Industrielle Ben Arous', 'industrial-loop', 'TU-922-LG', 'Isuzu', 'diesel'],
        ['Moto Livraison Express', 'moto', 'online', 36.8540, 10.1600, 0, 18, 81, 'Ariana Centre', 'tunis-ariana', 'TU-331-MT', 'Yamaha', 'essence'],
        ['Agent Terrain - Badge GPS', 'personnel', 'idle', 36.8180, 10.1950, 0, 73, 94, 'Belvedere, Tunis', 'tunis-ariana', null, 'Teltonika', null],
        ['Colis VIP - Tracker Objet', 'objet', 'offline', 36.8300, 10.2640, 0, 41, 0, 'Le Kram, Tunis', 'goulette-port', null, 'MiniTracker', null],
        ['Trottinette GPS - Mobilite', 'mobilite', 'idle', 36.8120, 10.1830, 0, 86, 89, 'Rue de Marseille, Tunis', 'tunis-marsa', null, 'Xiaomi', 'electrique'],
        ['Peugeot Partner - Support', 'voiture', 'online', 36.8230, 10.2870, 0, 67, 76, 'La Goulette, Tunis', 'goulette-port', 'TU-741-SP', 'Peugeot', 'diesel'],
    ];

    const rows = mainDevices.map((d, index) => ({
        id: ids.mainDevices[index],
        imei: `35907100000000${index + 1}`,
        name: d[0],
        device_type: d[1],
        serial_number: `SFT${String(index + 1).padStart(4, '0')}`,
        subscriber_number: `5000000${index + 1}`,
        plate_id: d[10],
        assigned_to: index < 3 ? 'Equipe commerciale' : 'Operations terrain',
        enterprise_id: ids.smartFleet,
        enterprise_name: 'Smart Fleet Tunisia',
        data_source: 'fake',
        tracking_token: crypto.randomBytes(16).toString('hex'),
        status: d[2],
        location_lat: d[3],
        location_lng: d[4],
        speed: d[5],
        battery: d[6],
        signal: d[7],
        address: d[8],
        sim_route_id: d[9],
        sim_current_index: index * 2,
        sim_direction: 1,
        sim_is_running: d[2] !== 'offline',
        heading: 45 + index * 30,
        fuel_level: index < 3 ? 68 - index * 9 : null,
        odometer: 12000 + index * 830,
        ignition: ['moving', 'online'].includes(d[2]),
        brand: d[11],
        fuel_type: d[12],
        last_update: d[2] === 'offline' ? pastHours(3) : now(),
        created_at: now(),
        updated_at: now(),
    }));

    rows.push(
        {
            id: ids.otherDevices[0],
            imei: '359072000000001',
            name: 'Camion Mercedes - Nord',
            device_type: 'camion',
            serial_number: 'LTP0001',
            subscriber_number: '50100001',
            plate_id: 'TU-202-TR',
            assigned_to: 'Logistique Nord',
            enterprise_id: ids.logitrans,
            enterprise_name: 'LogiTrans Pro',
            data_source: 'fake',
            status: 'moving',
            location_lat: 36.8400,
            location_lng: 10.2100,
            speed: 44,
            battery: 82,
            signal: 91,
            address: 'Zone Industrielle Ben Arous',
            sim_route_id: 'industrial-loop',
            sim_current_index: 4,
            sim_is_running: true,
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.otherDevices[1],
            imei: '359072000000002',
            name: 'Voiture Commerciale - Sfax',
            device_type: 'voiture',
            serial_number: 'LTP0002',
            subscriber_number: '50100002',
            plate_id: 'TU-303-TR',
            assigned_to: 'Commercial',
            enterprise_id: ids.logitrans,
            enterprise_name: 'LogiTrans Pro',
            data_source: 'fake',
            status: 'online',
            location_lat: 36.8065,
            location_lng: 10.1815,
            speed: 0,
            battery: 76,
            signal: 84,
            address: 'Tunis Centre',
            sim_route_id: 'tunis-marsa',
            sim_current_index: 1,
            sim_is_running: true,
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.otherDevices[2],
            imei: '359073000000001',
            name: 'Scooter Medina 01',
            device_type: 'moto',
            serial_number: 'MD0001',
            subscriber_number: '50200001',
            plate_id: 'TU-404-DL',
            assigned_to: 'Livreur A',
            enterprise_id: ids.delivery,
            enterprise_name: 'Medina Delivery',
            data_source: 'fake',
            status: 'moving',
            location_lat: 36.8540,
            location_lng: 10.1600,
            speed: 38,
            battery: 63,
            signal: 90,
            address: 'Ariana Centre',
            sim_route_id: 'tunis-ariana',
            sim_current_index: 9,
            sim_is_running: true,
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.otherDevices[3],
            imei: '359073000000002',
            name: 'Scooter Medina 02',
            device_type: 'moto',
            serial_number: 'MD0002',
            subscriber_number: '50200002',
            plate_id: 'TU-405-DL',
            assigned_to: 'Livreur B',
            enterprise_id: ids.delivery,
            enterprise_name: 'Medina Delivery',
            data_source: 'fake',
            status: 'idle',
            location_lat: 36.8180,
            location_lng: 10.3050,
            speed: 0,
            battery: 58,
            signal: 77,
            address: 'Port de La Goulette',
            sim_route_id: 'goulette-port',
            sim_current_index: 0,
            sim_is_running: true,
            created_at: now(),
            updated_at: now(),
        }
    );

    return rows;
}

function historyRows(ids) {
    const rows = [];
    ids.mainDevices.forEach((deviceId, deviceIndex) => {
        const baseLat = 36.8065 + deviceIndex * 0.006;
        const baseLng = 10.1815 + deviceIndex * 0.009;

        for (let i = 0; i < 18; i++) {
            rows.push({
                id: uuid(),
                device_id: deviceId,
                location_lat: baseLat + i * 0.0011,
                location_lng: baseLng + i * 0.0014,
                speed: deviceIndex === 4 ? 0 : Math.max(0, 24 + deviceIndex * 4 + (i % 5) * 3),
                heading: (40 + i * 8) % 360,
                battery: Math.max(10, 90 - i - deviceIndex * 2),
                signal: Math.max(45, 92 - (i % 7) * 3),
                address: `Point demo ${i + 1}`,
                status: deviceIndex === 4 ? 'offline' : (i % 4 === 0 ? 'idle' : 'moving'),
                timestamp: new Date(Date.now() - (18 - i) * 15 * 60 * 1000),
            });
        }
    });
    return rows;
}

function geofenceRows(ids) {
    return [
        {
            id: ids.geofences[0],
            name: 'Zone Tunis Centre',
            enterprise_id: ids.smartFleet,
            type: 'circle',
            center_lat: 36.8065,
            center_lng: 10.1815,
            radius: 1800,
            polygon: JSON.stringify([]),
            color: '#00A86B',
            alert_on_exit: true,
            alert_on_entry: false,
            is_active: true,
            created_by: ids.mainOperator,
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.geofences[1],
            name: 'Zone Ariana Operations',
            enterprise_id: ids.smartFleet,
            type: 'circle',
            center_lat: 36.8540,
            center_lng: 10.1600,
            radius: 2200,
            polygon: JSON.stringify([]),
            color: '#2563EB',
            alert_on_exit: true,
            alert_on_entry: true,
            is_active: true,
            created_by: ids.mainOperator,
            created_at: now(),
            updated_at: now(),
        },
        {
            id: ids.geofences[2],
            name: 'Zone Port Livraison',
            enterprise_id: ids.smartFleet,
            type: 'polygon',
            center_lat: null,
            center_lng: null,
            radius: null,
            polygon: JSON.stringify([
                { lat: 36.8120, lng: 10.2860 },
                { lat: 36.8270, lng: 10.3060 },
                { lat: 36.8200, lng: 10.3260 },
                { lat: 36.8020, lng: 10.3120 },
            ]),
            color: '#F59E0B',
            alert_on_exit: true,
            alert_on_entry: true,
            is_active: true,
            created_by: ids.admin,
            created_at: now(),
            updated_at: now(),
        },
    ];
}

function geofenceDeviceRows(ids) {
    return [
        { geofence_id: ids.geofences[0], device_id: ids.mainDevices[0] },
        { geofence_id: ids.geofences[0], device_id: ids.mainDevices[3] },
        { geofence_id: ids.geofences[0], device_id: ids.mainDevices[5] },
        { geofence_id: ids.geofences[1], device_id: ids.mainDevices[2] },
        { geofence_id: ids.geofences[1], device_id: ids.mainDevices[6] },
        { geofence_id: ids.geofences[2], device_id: ids.mainDevices[4] },
        { geofence_id: ids.geofences[2], device_id: ids.mainDevices[6] },
    ];
}

function alertRows(ids) {
    const templates = [
        [ids.mainDevices[2], 'Moto Livraison Express', 'battery', 'medium', 'Batterie faible: Moto Livraison Express (18%)', 5],
        [ids.mainDevices[0], 'Toyota Corolla - Sales 01', 'speed', 'high', 'Vitesse excessive: Toyota Corolla - Sales 01 (92 km/h)', 4],
        [ids.mainDevices[4], 'Colis VIP - Tracker Objet', 'offline', 'high', 'Appareil hors ligne depuis plus de 3 heures', 3],
        [ids.mainDevices[6], 'Peugeot Partner - Support', 'geofence', 'medium', 'Entree dans la zone "Zone Port Livraison"', 2],
        [ids.mainDevices[1], 'Camion Isuzu - Livraison', 'signal', 'medium', 'Signal faible: Camion Isuzu - Livraison (52%)', 1],
        [ids.otherDevices[0], 'Camion Mercedes - Nord', 'speed', 'medium', 'Vitesse elevee detectee sur Camion Mercedes - Nord', 7],
        [ids.otherDevices[2], 'Scooter Medina 01', 'battery', 'medium', 'Batterie faible: Scooter Medina 01 (26%)', 8],
    ];

    return templates.map(([deviceId, deviceName, type, severity, message, hours]) => ({
        id: uuid(),
        device_id: deviceId,
        device_name: deviceName,
        enterprise_id: [ids.otherDevices[0], ids.otherDevices[1]].includes(deviceId) ? ids.logitrans :
            [ids.otherDevices[2], ids.otherDevices[3]].includes(deviceId) ? ids.delivery : ids.smartFleet,
        type,
        severity,
        message,
        created_at: pastHours(hours),
        updated_at: pastHours(hours),
    }));
}

function supportRows(ids) {
    const ticket1 = uuid();
    const ticket2 = uuid();

    return {
        tickets: [
            {
                id: ticket1,
                user_id: ids.mainOperator,
                user_name: 'Achraf Operateur',
                enterprise_id: ids.smartFleet,
                subject: 'Verifier le GPS du camion',
                status: 'open',
                last_message: 'Le camion ne remonte pas toujours la vitesse.',
                last_message_at: pastHours(6),
                created_at: pastHours(8),
                updated_at: pastHours(6),
            },
            {
                id: ticket2,
                user_id: ids.deliveryOperator,
                user_name: 'Nour Delivery',
                enterprise_id: ids.delivery,
                subject: 'Question sur les alertes email',
                status: 'closed',
                last_message: 'Merci, le probleme est resolu.',
                last_message_at: pastHours(20),
                created_at: pastHours(30),
                updated_at: pastHours(20),
            },
        ],
        messages: [
            {
                id: uuid(),
                ticket_id: ticket1,
                sender_id: ids.mainOperator,
                sender_name: 'Achraf Operateur',
                sender_role: 'operator',
                message: 'Le camion ne remonte pas toujours la vitesse.',
                created_at: pastHours(8),
                updated_at: pastHours(8),
            },
            {
                id: uuid(),
                ticket_id: ticket1,
                sender_id: ids.admin,
                sender_name: 'Achraf Guemati',
                sender_role: 'admin',
                message: 'Nous allons verifier la configuration de simulation.',
                created_at: pastHours(6),
                updated_at: pastHours(6),
            },
            {
                id: uuid(),
                ticket_id: ticket2,
                sender_id: ids.deliveryOperator,
                sender_name: 'Nour Delivery',
                sender_role: 'operator',
                message: 'Comment activer les emails pour batterie faible ?',
                created_at: pastHours(30),
                updated_at: pastHours(30),
            },
            {
                id: uuid(),
                ticket_id: ticket2,
                sender_id: ids.admin,
                sender_name: 'Achraf Guemati',
                sender_role: 'admin',
                message: 'Depuis Parametres, activez les alertes email du plan Pro.',
                created_at: pastHours(20),
                updated_at: pastHours(20),
            },
        ],
    };
}

function orderRows(ids) {
    return [
        {
            id: uuid(),
            full_name: 'Sami Trabelsi',
            email: 'sami.trabelsi@example.tn',
            phone: '+216 20 111 222',
            company: 'Cargo Express',
            usage_type: 'professional',
            gps_count: 3,
            gps_types: JSON.stringify(['camion', 'voiture']),
            plan: 'pro',
            billing_cycle: 'monthly',
            total_due_today: 450,
            recurring_cost: 117,
            payment_method: 'bank_transfer',
            source: 'landing_page',
            status: 'pending',
            order_ref: 'GT-PFE-001',
            notes: 'Client interesse par le suivi camion.',
            created_at: pastHours(28),
            updated_at: pastHours(28),
        },
        {
            id: uuid(),
            full_name: 'Ines Mansouri',
            email: 'ines.mansouri@example.tn',
            phone: '+216 25 333 444',
            company: 'Med Services',
            usage_type: 'professional',
            gps_count: 2,
            gps_types: JSON.stringify(['voiture']),
            plan: 'starter',
            billing_cycle: 'monthly',
            total_due_today: 300,
            recurring_cost: 58,
            payment_method: 'd17',
            source: 'popup',
            status: 'confirmed',
            order_ref: 'GT-PFE-002',
            confirmed_at: pastHours(12),
            created_at: pastHours(24),
            updated_at: pastHours(12),
        },
        {
            id: uuid(),
            full_name: 'Achraf Operateur',
            email: 'achrafguemati557@gmail.com',
            phone: '+216 22 557 557',
            company: 'Smart Fleet Tunisia',
            usage_type: 'professional',
            gps_count: 2,
            gps_types: JSON.stringify(['moto', 'objet']),
            plan: 'pro',
            billing_cycle: 'annual',
            total_due_today: 220,
            recurring_cost: 748,
            payment_method: 'mastercard',
            source: 'client_upgrade',
            status: 'active',
            order_ref: 'GT-PFE-003',
            enterprise_id: null,
            user_id: ids.mainOperator,
            activated_at: pastHours(5),
            created_at: pastHours(18),
            updated_at: pastHours(5),
        },
    ];
}

function paymentRows(ids) {
    return [
        {
            id: uuid(),
            user_id: ids.mainOperator,
            user_name: 'Achraf Operateur',
            enterprise_id: ids.smartFleet,
            plan: 'pro',
            previous_plan: 'starter',
            amount: 39,
            billing_cycle: 'monthly',
            status: 'paid',
            method: 'd17',
            due_date: addDays(26),
            paid_at: pastHours(20),
            invoice_ref: 'INV-PFE-001',
            description: 'Paiement abonnement Pro - demo PFE',
            created_at: pastHours(20),
            updated_at: pastHours(20),
        },
        {
            id: uuid(),
            user_id: ids.transportOperator,
            user_name: 'Karim Ben Ali',
            enterprise_id: ids.logitrans,
            plan: 'starter',
            previous_plan: 'starter',
            amount: 29,
            billing_cycle: 'monthly',
            status: 'pending',
            method: 'bank_transfer',
            due_date: addDays(2),
            invoice_ref: 'INV-PFE-002',
            description: 'Paiement en attente - presentation',
            created_at: pastHours(10),
            updated_at: pastHours(10),
        },
        {
            id: uuid(),
            user_id: ids.deliveryOperator,
            user_name: 'Nour Delivery',
            enterprise_id: ids.delivery,
            plan: 'pro',
            previous_plan: 'pro',
            amount: 210,
            billing_cycle: 'biannual',
            status: 'paid',
            method: 'mastercard',
            due_date: addDays(75),
            paid_at: pastHours(40),
            invoice_ref: 'INV-PFE-003',
            description: 'Paiement semestriel Pro',
            created_at: pastHours(40),
            updated_at: pastHours(40),
        },
    ];
}

function auditRows(ids) {
    return [
        {
            id: uuid(),
            action: 'pfe.demo_reset',
            user_id: ids.admin,
            user_name: 'Achraf Guemati',
            target_type: 'database',
            target_name: 'PFE demo dataset',
            ip: 'local',
            details: JSON.stringify({ note: 'Clean demo data inserted' }),
            created_at: now(),
            updated_at: now(),
        },
        {
            id: uuid(),
            action: 'device.create',
            user_id: ids.admin,
            user_name: 'Achraf Guemati',
            target_type: 'device',
            target_id: ids.mainDevices[0],
            target_name: 'Toyota Corolla - Sales 01',
            ip: 'local',
            details: JSON.stringify({ source: 'PFE seed' }),
            created_at: pastHours(2),
            updated_at: pastHours(2),
        },
    ];
}

async function insertIfTable(trx, table, rows) {
    if (!rows || rows.length === 0) return;
    if (await tableExists(table)) {
        await trx(table).insert(rows);
    }
}

async function main() {
    console.log('Starting PFE demo reset...');
    const backupPath = await backupDatabase();
    console.log(`Backup created: ${backupPath}`);

    const ids = {
        smartFleet: uuid(),
        logitrans: uuid(),
        delivery: uuid(),
        admin: uuid(),
        supervisor: uuid(),
        mainOperator: uuid(),
        transportOperator: uuid(),
        deliveryOperator: uuid(),
        mainDevices: Array.from({ length: 7 }, uuid),
        otherDevices: Array.from({ length: 4 }, uuid),
        geofences: Array.from({ length: 3 }, uuid),
    };

    const passwords = {
        admin: process.env.DEMO_ADMIN_PASSWORD || DEMO_PASSWORDS.admin,
        supervisor: process.env.DEMO_SUPERVISOR_PASSWORD || DEMO_PASSWORDS.supervisor,
        mainOperator: process.env.DEMO_OPERATOR_PASSWORD || DEMO_PASSWORDS.mainOperator,
        transportOperator: process.env.DEMO_TRANSPORT_PASSWORD || DEMO_PASSWORDS.transportOperator,
        deliveryOperator: process.env.DEMO_DELIVERY_PASSWORD || DEMO_PASSWORDS.deliveryOperator,
    };

    const targetTables = [
        'alert_reads',
        'alerts',
        'audit_logs',
        'device_history',
        'geofence_devices',
        'geofences',
        'notification_rules',
        'support_messages',
        'support_tickets',
        'payments',
        'orders',
        'devices',
        'users',
        'enterprises',
    ];

    await db.transaction(async (trx) => {
        const existingTables = [];
        for (const table of targetTables) {
            if (await tableExists(table)) existingTables.push(table);
        }

        if (existingTables.length > 0) {
            const quoted = existingTables.map((table) => `"${table}"`).join(', ');
            await trx.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
        }

        await trx('enterprises').insert(enterpriseRows(ids));
        await trx('users').insert(await userRows(ids, passwords));
        await trx('devices').insert(deviceRows(ids));
        await trx('device_history').insert(historyRows(ids));
        await trx('geofences').insert(geofenceRows(ids));
        await trx('geofence_devices').insert(geofenceDeviceRows(ids));
        await trx('alerts').insert(alertRows(ids));

        const support = supportRows(ids);
        await trx('support_tickets').insert(support.tickets);
        await trx('support_messages').insert(support.messages);

        await trx('orders').insert(orderRows(ids));
        await trx('payments').insert(paymentRows(ids));
        await insertIfTable(trx, 'audit_logs', auditRows(ids));
    });

    const credentials = [
        ['Admin', 'ach45gu14@gmail.com', passwords.admin],
        ['Supervisor', 'supervisor@ayntrace.tn', passwords.supervisor],
        ['Operator principal', 'achrafguemati557@gmail.com', passwords.mainOperator],
        ['Operator transport', 'client.transport@ayntrace.tn', passwords.transportOperator],
        ['Operator delivery', 'client.delivery@ayntrace.tn', passwords.deliveryOperator],
    ];

    const credentialText = [
        '# PFE Demo Credentials',
        '',
        `Generated at: ${new Date().toISOString()}`,
        '',
        '| Role | Email | Password |',
        '|---|---|---|',
        ...credentials.map(([role, email, password]) => `| ${role} | ${email} | ${password} |`),
        '',
        `Backup: ${backupPath}`,
        '',
    ].join('\n');

    const credentialsPath = path.resolve(__dirname, 'backups/pfe-demo-credentials-latest.md');
    await fs.writeFile(credentialsPath, credentialText, 'utf8');

    const countTables = ['enterprises', 'users', 'devices', 'geofences', 'alerts', 'device_history', 'orders', 'payments', 'support_tickets'];
    console.log('\nDemo database ready.');
    for (const table of countTables) {
        const [{ count }] = await db(table).count('* as count');
        console.log(`${table}: ${count}`);
    }

    console.log('\nCredentials:');
    for (const [role, email, password] of credentials) {
        console.log(`${role}: ${email} / ${password}`);
    }
    console.log(`\nCredentials saved to: ${credentialsPath}`);
}

main()
    .catch((error) => {
        console.error('PFE demo reset failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await db.destroy();
    });
