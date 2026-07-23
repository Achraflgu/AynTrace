// Database migration script — creates all tables in PostgreSQL
import pg from 'pg';
import Knex from 'knex';
import dotenv from 'dotenv';
dotenv.config();

function getDatabaseConfig() {
    if (process.env.DATABASE_URL) {
        const url = new URL(process.env.DATABASE_URL);
        return {
            host: url.hostname,
            port: Number(url.port || 5432),
            user: decodeURIComponent(url.username || 'postgres'),
            password: decodeURIComponent(url.password || 'postgres'),
            database: url.pathname.replace(/^\//, '') || 'geotrack',
        };
    }

    return {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'geotrack',
    };
}

async function migrate() {
    console.log('╔═══════════════════════════════════════════════════════╗');
    console.log('║     🐘 GeoTrack PostgreSQL Migration                  ║');
    console.log('╚═══════════════════════════════════════════════════════╝');
    console.log('');

    // 1. Create database if it doesn't exist
    const dbConfig = getDatabaseConfig();
    const client = new pg.Client({ ...dbConfig, database: 'postgres' });
    await client.connect();

    const dbCheck = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbConfig.database]);
    if (dbCheck.rows.length === 0) {
        await client.query(`CREATE DATABASE "${dbConfig.database.replace(/"/g, '""')}"`);
        console.log('[✅] Database "geotrack" created');
    } else {
        console.log('[✅] Database "geotrack" already exists');
    }
    await client.end();

    // 2. Connect to geotrack database
    const db = Knex({
        client: 'pg',
        connection: dbConfig,
    });

    // Enable uuid extension
    await db.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    console.log('[✅] uuid-ossp extension enabled');

    // ─── ENTERPRISES ──────────────────────────────────────────────
    if (!(await db.schema.hasTable('enterprises'))) {
        await db.schema.createTable('enterprises', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.text('name').notNullable();
            t.text('contact_email').notNullable();
            t.text('contact_phone');
            t.text('phone');
            t.text('address');
            t.text('status').defaultTo('active');
            t.text('serial_prefix').defaultTo('GT');
            t.integer('last_serial_counter').defaultTo(0);
            t.text('imei_prefix').defaultTo('35907');
            t.integer('last_imei_counter').defaultTo(0);
            t.text('subscriber_prefix').defaultTo('500');
            t.integer('last_subscriber_counter').defaultTo(8000);
            t.jsonb('alert_settings').defaultTo(JSON.stringify({
                battery: { enabled: true, threshold: 30 },
                speed: { enabled: true, threshold: 70 },
                signal: { enabled: true, threshold: 55 },
                sos: { enabled: true },
                offline: { enabled: true },
                geofence: { enabled: true }
            }));
            t.timestamps(true, true);
        });
        console.log('[✅] Table "enterprises" created');
    } else {
        console.log('[--] Table "enterprises" exists');
    }

    // ─── USERS ───────────────────────────────────────────────────
    if (!(await db.schema.hasTable('users'))) {
        await db.schema.createTable('users', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.text('email').notNullable().unique();
            t.text('password').notNullable();
            t.text('name').notNullable();
            t.text('role').defaultTo('operator');
            t.text('plan').defaultTo('starter');
            t.uuid('enterprise_id').references('id').inTable('enterprises').onDelete('SET NULL');
            t.text('enterprise_name');
            t.text('avatar');
            t.timestamp('last_login');
            t.text('saved_payment_method').defaultTo('');
            t.text('saved_billing_cycle').defaultTo('monthly');
            t.boolean('cancel_at_period_end').defaultTo(false);
            t.text('pending_plan');
            t.text('pending_billing_cycle');
            t.boolean('email_verified').defaultTo(false);
            t.boolean('is_initial_password').defaultTo(true);
            t.text('verification_code');
            t.timestamp('verification_code_expiry');
            t.text('billing_status').defaultTo('active');
            t.timestamp('billing_next_due');
            t.timestamp('billing_warned_at');
            t.jsonb('email_alert_prefs').defaultTo(JSON.stringify({ enabled: false, types: [] }));
            t.timestamps(true, true);
        });
        console.log('[✅] Table "users" created');
    } else {
        console.log('[--] Table "users" exists');
    }

    // ─── DEVICES ─────────────────────────────────────────────────
    if (!(await db.schema.hasTable('devices'))) {
        await db.schema.createTable('devices', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.text('imei').notNullable().unique();
            t.text('name').notNullable();
            t.text('device_type').defaultTo('voiture');
            t.text('serial_number').notNullable();
            t.text('subscriber_number');
            t.text('plate_id');
            t.text('assigned_to');
            t.uuid('enterprise_id').references('id').inTable('enterprises').onDelete('CASCADE');
            t.text('enterprise_name');
            t.text('data_source').defaultTo('fake');
            t.text('tracking_token');
            t.text('status').defaultTo('offline');
            // Location as separate lat/lng (no PostGIS needed)
            t.double('location_lng').defaultTo(10.1815);
            t.double('location_lat').defaultTo(36.8065);
            t.text('address').defaultTo('');
            t.double('speed').defaultTo(0);
            t.double('heading').defaultTo(0);
            t.double('battery').defaultTo(100);
            t.double('signal').defaultTo(100);
            t.double('altitude');
            t.double('temperature');
            t.double('fuel_level');
            t.double('odometer');
            t.boolean('ignition');
            // Simulation fields (flattened)
            t.text('sim_route_id').defaultTo('tunis-ariana');
            t.integer('sim_current_index').defaultTo(0);
            t.integer('sim_direction').defaultTo(1);
            t.boolean('sim_is_running').defaultTo(true);
            t.timestamp('last_update').defaultTo(db.fn.now());
            t.timestamps(true, true);
        });
        await db.schema.raw('CREATE INDEX idx_devices_enterprise ON devices(enterprise_id)');
        await db.schema.raw('CREATE INDEX idx_devices_status ON devices(status)');
        console.log('[✅] Table "devices" created');
    } else {
        console.log('[--] Table "devices" exists');
    }

    // Add fuel_type and brand columns if they do not exist
    const hasFuelType = await db.schema.hasColumn('devices', 'fuel_type');
    if (!hasFuelType) {
        await db.schema.alterTable('devices', (t) => {
            t.text('fuel_type');
        });
        console.log('[✅] Column "fuel_type" added to table "devices"');
    }
    const hasBrand = await db.schema.hasColumn('devices', 'brand');
    if (!hasBrand) {
        await db.schema.alterTable('devices', (t) => {
            t.text('brand');
        });
        console.log('[✅] Column "brand" added to table "devices"');
    }

    // ─── DEVICE HISTORY ──────────────────────────────────────────
    if (!(await db.schema.hasTable('device_history'))) {
        await db.schema.createTable('device_history', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.uuid('device_id').notNullable().references('id').inTable('devices').onDelete('CASCADE');
            t.double('location_lng').notNullable();
            t.double('location_lat').notNullable();
            t.double('speed');
            t.double('heading');
            t.double('battery');
            t.double('signal');
            t.text('address');
            t.text('status');
            t.timestamp('timestamp').defaultTo(db.fn.now());
        });
        await db.schema.raw('CREATE INDEX idx_device_history_device_time ON device_history(device_id, timestamp DESC)');
        console.log('[✅] Table "device_history" created');
    } else {
        console.log('[--] Table "device_history" exists');
    }

    // ─── ALERTS ──────────────────────────────────────────────────
    if (!(await db.schema.hasTable('alerts'))) {
        await db.schema.createTable('alerts', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.uuid('device_id').notNullable().references('id').inTable('devices').onDelete('CASCADE');
            t.text('device_name').notNullable();
            t.uuid('enterprise_id').notNullable().references('id').inTable('enterprises').onDelete('CASCADE');
            t.text('type').notNullable(); // battery, offline, geofence, speed, sos
            t.text('severity').defaultTo('medium');
            t.text('message').notNullable();
            t.timestamps(true, true);
        });
        await db.schema.raw('CREATE INDEX idx_alerts_enterprise ON alerts(enterprise_id)');
        await db.schema.raw('CREATE INDEX idx_alerts_created ON alerts(created_at DESC)');
        console.log('[✅] Table "alerts" created');
    } else {
        console.log('[--] Table "alerts" exists');
    }

    // ─── ALERT READS (replaces readBy array) ─────────────────────
    if (!(await db.schema.hasTable('alert_reads'))) {
        await db.schema.createTable('alert_reads', (t) => {
            t.uuid('alert_id').notNullable().references('id').inTable('alerts').onDelete('CASCADE');
            t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            t.primary(['alert_id', 'user_id']);
        });
        console.log('[✅] Table "alert_reads" created');
    } else {
        console.log('[--] Table "alert_reads" exists');
    }

    // ─── GEOFENCES ───────────────────────────────────────────────
    if (!(await db.schema.hasTable('geofences'))) {
        await db.schema.createTable('geofences', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.text('name').notNullable();
            t.uuid('enterprise_id').notNullable().references('id').inTable('enterprises').onDelete('CASCADE');
            t.text('type').notNullable(); // circle or polygon
            t.double('center_lat');
            t.double('center_lng');
            t.double('radius');
            t.jsonb('polygon').defaultTo('[]'); // array of {lat, lng}
            t.text('color').defaultTo('#00E599');
            t.boolean('alert_on_exit').defaultTo(true);
            t.boolean('alert_on_entry').defaultTo(false);
            t.boolean('is_active').defaultTo(true);
            t.uuid('created_by').references('id').inTable('users').onDelete('SET NULL');
            t.timestamps(true, true);
        });
        console.log('[✅] Table "geofences" created');
    } else {
        console.log('[--] Table "geofences" exists');
    }

    // ─── GEOFENCE DEVICES (junction table) ───────────────────────
    if (!(await db.schema.hasTable('geofence_devices'))) {
        await db.schema.createTable('geofence_devices', (t) => {
            t.uuid('geofence_id').notNullable().references('id').inTable('geofences').onDelete('CASCADE');
            t.uuid('device_id').notNullable().references('id').inTable('devices').onDelete('CASCADE');
            t.primary(['geofence_id', 'device_id']);
        });
        console.log('[✅] Table "geofence_devices" created');
    } else {
        console.log('[--] Table "geofence_devices" exists');
    }

    // ─── ORDERS ──────────────────────────────────────────────────
    if (!(await db.schema.hasTable('orders'))) {
        await db.schema.createTable('orders', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.text('full_name').notNullable();
            t.text('email').notNullable();
            t.text('phone').notNullable();
            t.text('company').defaultTo('');
            t.text('usage_type').defaultTo('professional');
            t.integer('gps_count').notNullable().defaultTo(1);
            t.jsonb('gps_types').defaultTo('[]');
            t.text('plan').defaultTo('starter');
            t.text('billing_cycle').defaultTo('monthly');
            t.double('total_due_today').defaultTo(0);
            t.double('recurring_cost').defaultTo(0);
            t.text('payment_method').defaultTo('');
            t.text('source').defaultTo('popup');
            t.text('status').defaultTo('pending');
            t.text('admin_notes').defaultTo('');
            t.timestamp('confirmed_at');
            t.timestamp('installed_at');
            t.timestamp('activated_at');
            t.timestamp('cancelled_at');
            t.text('order_ref').unique();
            t.text('notes');
            t.uuid('enterprise_id').references('id').inTable('enterprises').onDelete('SET NULL');
            t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
            t.timestamps(true, true);
        });
        console.log('[✅] Table "orders" created');
    } else {
        console.log('[--] Table "orders" exists');
    }

    // ─── PAYMENTS ────────────────────────────────────────────────
    if (!(await db.schema.hasTable('payments'))) {
        await db.schema.createTable('payments', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            t.text('user_name').notNullable();
            t.uuid('enterprise_id').references('id').inTable('enterprises').onDelete('SET NULL');
            t.text('plan').notNullable();
            t.text('previous_plan').defaultTo('');
            t.double('amount').notNullable();
            t.text('billing_cycle').defaultTo('monthly');
            t.text('status').defaultTo('pending');
            t.text('method').defaultTo('');
            t.timestamp('due_date');
            t.timestamp('paid_at');
            t.text('invoice_ref').unique();
            t.text('admin_notes').defaultTo('');
            t.text('description').defaultTo('');
            t.timestamps(true, true);
        });
        console.log('[✅] Table "payments" created');
    } else {
        console.log('[--] Table "payments" exists');
    }

    // ─── SUPPORT TICKETS ─────────────────────────────────────────
    if (!(await db.schema.hasTable('support_tickets'))) {
        await db.schema.createTable('support_tickets', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            t.text('user_name').notNullable();
            t.uuid('enterprise_id').references('id').inTable('enterprises').onDelete('SET NULL');
            t.text('subject').notNullable();
            t.text('status').defaultTo('open');
            t.text('last_message');
            t.timestamp('last_message_at').defaultTo(db.fn.now());
            t.timestamps(true, true);
        });
        console.log('[✅] Table "support_tickets" created');
    } else {
        console.log('[--] Table "support_tickets" exists');
    }

    // ─── SUPPORT MESSAGES ────────────────────────────────────────
    if (!(await db.schema.hasTable('support_messages'))) {
        await db.schema.createTable('support_messages', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.uuid('ticket_id').notNullable().references('id').inTable('support_tickets').onDelete('CASCADE');
            t.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
            t.text('sender_name').notNullable();
            t.text('sender_role').notNullable();
            t.text('message').notNullable();
            t.timestamps(true, true);
        });
        console.log('[✅] Table "support_messages" created');
    } else {
        console.log('[--] Table "support_messages" exists');
    }

    // ─── AUDIT LOGS ──────────────────────────────────────────────
    if (!(await db.schema.hasTable('audit_logs'))) {
        await db.schema.createTable('audit_logs', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.text('action').notNullable();
            t.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
            t.text('user_name').notNullable();
            t.text('target_type');
            t.uuid('target_id');
            t.text('target_name');
            t.text('ip');
            t.jsonb('details');
            t.timestamps(true, true);
        });
        await db.schema.raw('CREATE INDEX idx_audit_created ON audit_logs(created_at DESC)');
        await db.schema.raw('CREATE INDEX idx_audit_action ON audit_logs(action)');
        console.log('[✅] Table "audit_logs" created');
    } else {
        console.log('[--] Table "audit_logs" exists');
    }

    // ─── NOTIFICATION RULES ──────────────────────────────────────
    if (!(await db.schema.hasTable('notification_rules'))) {
        await db.schema.createTable('notification_rules', (t) => {
            t.uuid('id').primary().defaultTo(db.raw('uuid_generate_v4()'));
            t.uuid('enterprise_id').notNullable().references('id').inTable('enterprises').onDelete('CASCADE');
            t.text('alert_type').notNullable();
            t.text('severity_target').defaultTo('all');
            t.specificType('emails', 'text[]').notNullable();
            t.boolean('is_active').defaultTo(true);
            t.timestamps(true, true);
        });
        console.log('[✅] Table "notification_rules" created');
    } else {
        console.log('[--] Table "notification_rules" exists');
    }

    // ─── PRICING CONFIG ─────────────────────────────────────────
    if (!(await db.schema.hasTable('pricing_config'))) {
        await db.schema.createTable('pricing_config', (t) => {
            t.text('key').primary();
            t.double('value').notNullable();
            t.text('label').notNullable();
            t.text('category').notNullable(); // subscription, hardware, discount
            t.timestamp('updated_at').defaultTo(db.fn.now());
        });

        // Seed default pricing values
        await db('pricing_config').insert([
            { key: 'starter_monthly',    value: 29,  label: 'Starter — Mensuel',          category: 'subscription' },
            { key: 'starter_biannual',   value: 156, label: 'Starter — 6 Mois',           category: 'subscription' },
            { key: 'starter_annual',     value: 278, label: 'Starter — Annuel',            category: 'subscription' },
            { key: 'pro_monthly',        value: 39,  label: 'Pro — Mensuel',               category: 'subscription' },
            { key: 'pro_biannual',       value: 210, label: 'Pro — 6 Mois',                category: 'subscription' },
            { key: 'pro_annual',         value: 374, label: 'Pro — Annuel',                 category: 'subscription' },
            { key: 'device_price',       value: 110, label: 'Prix matériel / GPS',          category: 'hardware' },
            { key: 'installation_fee',   value: 40,  label: "Frais d'installation",        category: 'hardware' },
            { key: 'deposit_amount',     value: 0,   label: 'Dépôt de garantie',           category: 'hardware' },
            { key: 'advance_months',     value: 3,   label: "Mois d'avance exigés",        category: 'hardware' },
            { key: 'biannual_discount',  value: 10,  label: 'Réduction 6 mois (%)',        category: 'discount' },
            { key: 'annual_discount',    value: 20,  label: 'Réduction annuelle (%)',      category: 'discount' },
        ]);
        console.log('[✅] Table "pricing_config" created & seeded');
    } else {
        console.log('[--] Table "pricing_config" exists');
    }

    console.log('');
    console.log('✅ All tables ready!');
    await db.destroy();
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
});
