import express from 'express';
import db from '../db/knex.js';
import { sendStatusUpdateEmail, sendUpgradeConfirmEmail, sendWelcomeEmail } from '../utils/mailjet.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { broadcast, formatDeviceForFrontend } from '../simulation/engine.js';
import { getNextDeviceIds, validateDeviceUniqueness } from '../utils/deviceIdHelper.js';
const router = express.Router();

// Format order row → camelCase for frontend
function formatOrder(o) {
    return {
        _id: o.id, id: o.id,
        orderRef: o.order_ref,
        fullName: o.full_name,
        email: o.email,
        phone: o.phone,
        company: o.company,
        usageType: o.usage_type,
        gpsCount: o.gps_count,
        gpsTypes: typeof o.gps_types === 'string' ? JSON.parse(o.gps_types || '[]') : (o.gps_types || []),
        plan: o.plan,
        billingCycle: o.billing_cycle,
        totalDueToday: o.total_due_today,
        recurringCost: o.recurring_cost,
        paymentMethod: o.payment_method,
        source: o.source,
        status: o.status,
        adminNotes: o.admin_notes,
        notes: o.notes,
        enterpriseId: o.enterprise_id,
        userId: o.user_id,
        confirmedAt: o.confirmed_at,
        installedAt: o.installed_at,
        activatedAt: o.activated_at,
        cancelledAt: o.cancelled_at,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
    };
}

function generateOrderRef() {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GT-${y}${m}-${rand}`;
}

function generateInvoiceRef() {
    const date = new Date();
    const y = date.getFullYear().toString().slice(-2);
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${y}${m}-${rand}`;
}

function nextDueFromCycle(baseDate, billingCycle) {
    const d = new Date(baseDate);
    if (billingCycle === 'annual') d.setFullYear(d.getFullYear() + 1);
    else if (billingCycle === 'biannual') d.setMonth(d.getMonth() + 6);
    else d.setMonth(d.getMonth() + 1);
    return d;
}

async function getOrderBillingAmount(order) {
    if (Number(order.total_due_today) > 0) return Math.round(Number(order.total_due_today));
    if (Number(order.recurring_cost) > 0) return Math.round(Number(order.recurring_cost));

    const plan = order.plan || 'starter';
    const cycle = order.billing_cycle || 'monthly';
    const monthlyRow = await db('pricing_config').where('key', `${plan}_monthly`).first().catch(() => null);
    const monthly = Number(monthlyRow?.value) || (plan === 'pro' ? 39 : plan === 'enterprise' ? 30 : 29);
    const biannualDiscount = Number((await db('pricing_config').where('key', 'biannual_discount').first().catch(() => null))?.value) || 10;
    const annualDiscount = Number((await db('pricing_config').where('key', 'annual_discount').first().catch(() => null))?.value) || 20;
    const deviceCount = Math.max(1, Number(order.gps_count) || 1);

    if (cycle === 'annual') return Math.round(monthly * deviceCount * 12 * (1 - annualDiscount / 100));
    if (cycle === 'biannual') return Math.round(monthly * deviceCount * 6 * (1 - biannualDiscount / 100));
    return Math.round(monthly * deviceCount);
}

async function resolveEnterprisePrefixes(companyName, providedPrefixes = {}) {
    const safeCompanyName = (companyName || 'GT').trim() || 'GT';

    const serialPrefix = (providedPrefixes?.serie || '').trim();
    if (serialPrefix) {
        const exists = await db('enterprises').where('serial_prefix', serialPrefix).first();
        if (exists) {
            throw new Error(`Le préfixe série '${serialPrefix}' est déjà utilisé.`);
        }
    }

    let imeiPrefix = (providedPrefixes?.imei || '').trim();
    if (imeiPrefix) {
        const exists = await db('enterprises').where('imei_prefix', imeiPrefix).first();
        if (exists) {
            throw new Error(`Le préfixe IMEI '${imeiPrefix}' est déjà utilisé.`);
        }
    } else {
        const ent = await db('enterprises').orderByRaw("CAST(imei_prefix AS INTEGER) DESC").first();
        const maxImei = ent && !isNaN(parseInt(ent.imei_prefix)) ? parseInt(ent.imei_prefix) : 35907;
        imeiPrefix = (maxImei + 1).toString();
    }

    let subscriberPrefix = (providedPrefixes?.sim || '').trim();
    if (subscriberPrefix) {
        const exists = await db('enterprises').where('subscriber_prefix', subscriberPrefix).first();
        if (exists) {
            throw new Error(`Le préfixe Abonné '${subscriberPrefix}' est déjà utilisé.`);
        }
    } else {
        const ent = await db('enterprises').orderByRaw("CAST(subscriber_prefix AS INTEGER) DESC").first();
        const maxSub = ent && !isNaN(parseInt(ent.subscriber_prefix)) ? parseInt(ent.subscriber_prefix) : 500;
        subscriberPrefix = (maxSub + 1).toString();
    }

    return {
        serialPrefix: serialPrefix || safeCompanyName.substring(0, 3).toUpperCase() || 'GT',
        imeiPrefix,
        subscriberPrefix,
    };
}

function normalizeDeviceType(value) {
    const map = {
        vehicules: 'voiture',
        personnes: 'personnel',
        animaux: 'animal',
        enfants: 'personnel',
        objets: 'objet',
        motos: 'moto',
        camions: 'camion',
    };

    return map[value] || value || 'voiture';
}

function buildDeviceTypePlan(order) {
    let gpsTypes = [];
    try {
        gpsTypes = typeof order?.gps_types === 'string'
            ? JSON.parse(order.gps_types || '[]')
            : (order?.gps_types || []);
    } catch {
        gpsTypes = [];
    }

    const plan = [];
    for (const entry of gpsTypes) {
        const count = Math.max(0, Number(entry.count) || 0);
        const deviceType = normalizeDeviceType(entry.type);
        for (let i = 0; i < count; i++) plan.push(deviceType);
    }

    while (plan.length < (order?.gps_count || 0)) {
        plan.push('voiture');
    }

    return plan.slice(0, order?.gps_count || plan.length);
}

// GET all orders
router.get('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { status, source, search, email, enterpriseId } = req.query;
        let query = db('orders');
        if (status && status !== 'all') query = query.where('status', status);
        if (source && source !== 'all') query = query.where('source', source);
        if (email) query = query.where('email', email);
        if (enterpriseId) query = query.where('enterprise_id', parseInt(enterpriseId, 10));
        if (search) {
            query = query.where(function () {
                this.where('full_name', 'ilike', `%${search}%`)
                    .orWhere('email', 'ilike', `%${search}%`)
                    .orWhere('company', 'ilike', `%${search}%`)
                    .orWhere('order_ref', 'ilike', `%${search}%`);
            });
        }
        const orders = await query.orderBy('created_at', 'desc');
        res.json(orders.map(formatOrder));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET my orders (for operators — fetch their own orders by userId or email)
router.get('/my-orders', verifyToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        const email = req.user?.email;
        if (!userId && !email) return res.status(400).json({ error: 'User identity required' });

        let query = db('orders');
        // Match by userId OR email so we find orders placed before the user had an account too
        query = query.where(function () {
            if (userId) this.where('user_id', userId);
            if (email)  this.orWhere('email', email);
        });

        const { source } = req.query;
        if (source && source !== 'all') query = query.where('source', source);

        const orders = await query.orderBy('created_at', 'desc');
        res.json(orders.map(formatOrder));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET order tracking
router.get('/track/:ref', async (req, res) => {
    try {
        const order = await db('orders')
            .where('order_ref', req.params.ref)
            .select('status', 'order_ref', 'created_at', 'full_name', 'email', 'company')
            .first();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(formatOrder(order));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET order stats
router.get('/stats', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const [
            [{ count: total }], [{ count: pending }], [{ count: confirmed }],
            [{ count: installing }], [{ count: active }], [{ count: cancelled }]
        ] = await Promise.all([
            db('orders').count('id as count'),
            db('orders').where('status', 'pending').count('id as count'),
            db('orders').where('status', 'confirmed').count('id as count'),
            db('orders').where('status', 'installing').count('id as count'),
            db('orders').where('status', 'active').count('id as count'),
            db('orders').where('status', 'cancelled').count('id as count'),
        ]);
        res.json({
            total: parseInt(total), pending: parseInt(pending), confirmed: parseInt(confirmed),
            installing: parseInt(installing), active: parseInt(active), cancelled: parseInt(cancelled)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST create order
router.post('/', async (req, res) => {
    try {
        const body = req.body;
        const isUpgrade = (body.source || '') === 'client_upgrade';
        const emailLower = (body.email || '').trim().toLowerCase();

        if (!isUpgrade) {
            const userExists = await db('users').where('email', emailLower).first();
            if (userExists) {
                return res.status(400).json({ error: 'Cette adresse email est déjà associée à un compte AynTrace.' });
            }

            const orderExists = await db('orders')
                .where('email', emailLower)
                .whereNot('status', 'cancelled')
                .first();
            if (orderExists) {
                return res.status(400).json({ error: 'Une commande en cours d\'installation ou d\'activation existe déjà pour cet email.' });
            }
        }

        const [order] = await db('orders').insert({
            full_name: body.fullName,
            email: body.email,
            phone: body.phone,
            company: body.company,
            usage_type: body.usageType || 'professional',
            gps_count: body.gpsCount || 1,
            gps_types: JSON.stringify(body.gpsTypes || []),
            plan: body.plan || 'starter',
            billing_cycle: body.billingCycle || 'monthly',
            total_due_today: body.totalDueToday || 0,
            recurring_cost: body.recurringCost || 0,
            payment_method: body.paymentMethod || '',
            source: body.source || 'manual',
            notes: body.notes || null,
            enterprise_id: body.enterpriseId ? (parseInt(body.enterpriseId, 10) || null) : null,
            user_id: body.userId ? String(body.userId) : null,
            status: 'pending',
            order_ref: generateOrderRef(),
        }).returning('*');

        // Send appropriate confirmation email
        if (isUpgrade) {
            await sendUpgradeConfirmEmail(order.email, order.full_name, order.order_ref, order.gps_count, order.plan).catch(console.error);
        } else {
            sendStatusUpdateEmail(order.email, order.full_name, order.order_ref, 'pending');
        }

        const webhookUrl = process.env.N8N_ORDER_WEBHOOK;
        if (webhookUrl) {
            try {
                await fetch(webhookUrl, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: isUpgrade ? 'upgrade_order_created' : 'order_created', order: formatOrder(order) }),
                });
            } catch (whErr) { console.warn('[n8n] Webhook failed:', whErr.message); }
        }

        broadcast('entity-change', {
            entity: 'order',
            action: 'create',
            item: formatOrder(order),
            id: order.id,
            message: `Nouvelle commande reçue: ${order.order_ref} (${order.full_name})`
        });

        res.status(201).json(formatOrder(order));
    } catch (err) {
        console.error('[POST /orders] Error:', err.message, err.code);
        res.status(400).json({ error: err.message });
    }
});

// PATCH update order
router.patch('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const update = { updated_at: new Date() };
        if (adminNotes !== undefined) update.admin_notes = adminNotes;
        if (status) {
            update.status = status;
            if (status === 'confirmed') update.confirmed_at = new Date();
            if (status === 'installing') update.installed_at = new Date();
            if (status === 'active') update.activated_at = new Date();
            if (status === 'cancelled') update.cancelled_at = new Date();
        }

        const [order] = await db('orders').where('id', req.params.id).update(update).returning('*');
        if (!order) return res.status(404).json({ error: 'Order not found' });

        if (status && ['confirmed', 'installing', 'cancelled'].includes(status)) {
            await sendStatusUpdateEmail(order.email, order.full_name, order.order_ref, status).catch(console.error);
        }

        broadcast('entity-change', {
            entity: 'order',
            action: 'update',
            item: formatOrder(order),
            id: order.id,
            message: `Commande mise à jour: ${order.order_ref} (${order.status})`
        });

        res.json(formatOrder(order));
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE order
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const order = await db('orders').where('id', req.params.id).first();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        await db('orders').where('id', req.params.id).del();

        broadcast('entity-change', {
            entity: 'order',
            action: 'delete',
            id: order.id,
            message: `Commande supprimée: ${order.order_ref}`
        });

        res.json({ message: 'Order deleted', order: formatOrder(order) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST webhook
router.post('/webhook', async (req, res) => {
    try {
        const { orderId, action, data } = req.body;
        if (orderId && action === 'update_status' && data?.status) {
            const [order] = await db('orders').where('id', orderId).update({ status: data.status }).returning('*');
            return res.json({ success: true, order: formatOrder(order) });
        }
        res.json({ success: true, message: 'Webhook received' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST process order (auto-create enterprise + user + devices)
router.post('/:id/process', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { prefixes = {}, devices: deviceOverrides = [] } = req.body || {};
        const order = await db('orders').where('id', req.params.id).first();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.status === 'active') return res.status(400).json({ error: 'Order already processed' });
        if (order.status !== 'installing') return res.status(400).json({ error: 'Order must be in installing status before AI activation' });

        const steps = [];
        const companyName = order.company || `${order.full_name} Enterprise`;
        const isUpgrade = order.source === 'client_upgrade';
        const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
        const orderPlan = order.plan || 'starter';
        const orderBillingCycle = order.billing_cycle || 'monthly';
        const orderPaymentMethod = order.payment_method || 'on_installation';
        const orderBillingNextDue = nextDueFromCycle(new Date(), orderBillingCycle);

        // 1. Create or find Enterprise
        let enterprise;
        if (isUpgrade) {
            // For upgrades, find existing enterprise via the user's email
            const existingUser = await db('users').where('email', order.email).first();
            if (existingUser?.enterprise_id) {
                enterprise = await db('enterprises').where('id', existingUser.enterprise_id).first();
            }
            if (!enterprise) {
                enterprise = await db('enterprises').where('name', companyName).first();
            }
            if (!enterprise) {
                return res.status(400).json({ error: `Aucune entreprise trouvée pour le client ${order.email}. Vérifiez le compte.` });
            }
            steps.push({ step: 'enterprise', status: 'exists', name: enterprise.name, id: enterprise.id });
        } else {
            enterprise = await db('enterprises').where('name', companyName).first();
            if (!enterprise) {
                const resolvedPrefixes = await resolveEnterprisePrefixes(companyName, prefixes);
                [enterprise] = await db('enterprises').insert({
                    name: companyName, contact_email: order.email,
                    contact_phone: order.phone, phone: order.phone,
                    status: 'active',
                    serial_prefix: resolvedPrefixes.serialPrefix,
                    imei_prefix: resolvedPrefixes.imeiPrefix,
                    subscriber_prefix: resolvedPrefixes.subscriberPrefix,
                }).returning('*');
                steps.push({ step: 'enterprise', status: 'created', name: enterprise.name, id: enterprise.id });
            } else {
                steps.push({ step: 'enterprise', status: 'exists', name: enterprise.name, id: enterprise.id });
            }
        }

        // 2. Create or update User
        let userAccount = await db('users').where('email', order.email).first();
        const tempPassword = 'GT-' + Math.random().toString(36).slice(2, 8).toUpperCase();
        const bcrypt = (await import('bcryptjs')).default;
        let createdTempPassword = undefined;
        let welcomeEmailSent = false;

        if (!userAccount) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(tempPassword, salt);
            [userAccount] = await db('users').insert({
                email: order.email, password: hashedPassword, name: order.full_name,
                role: 'operator', plan: orderPlan,
                enterprise_id: enterprise.id, enterprise_name: enterprise.name,
                email_verified: true, is_initial_password: true,
                saved_payment_method: isUpgrade ? '' : orderPaymentMethod,
                saved_billing_cycle: orderBillingCycle,
                billing_status: 'active',
                billing_next_due: isUpgrade ? null : orderBillingNextDue,
                billing_warned_at: null,
                cancel_at_period_end: false,
            }).returning('*');
            createdTempPassword = tempPassword;
            try {
                welcomeEmailSent = await sendWelcomeEmail(
                    order.email,
                    order.full_name,
                    tempPassword,
                    orderPlan,
                    enterprise.name,
                    `${frontendUrl}/login`
                );
            } catch (emailErr) {
                console.warn('[Order] Welcome email failed:', emailErr.message);
            }
            steps.push({ step: 'user', status: 'created', email: order.email, tempPassword, welcomeEmailSent });
        } else {
            const userUpdate = {
                enterprise_id: enterprise.id, enterprise_name: enterprise.name
            };
            if (!isUpgrade) {
                Object.assign(userUpdate, {
                    plan: orderPlan,
                    saved_payment_method: orderPaymentMethod,
                    saved_billing_cycle: orderBillingCycle,
                    billing_status: 'active',
                    billing_next_due: orderBillingNextDue,
                    billing_warned_at: null,
                    cancel_at_period_end: false,
                    pending_plan: null,
                    pending_billing_cycle: null,
                });
            }
            await db('users').where('id', userAccount.id).update(userUpdate);
            userAccount = { ...userAccount, ...userUpdate };
            steps.push({ step: 'user', status: 'exists', email: order.email });
        }

        // 2b. Seed billing immediately for Join Us/manual activations so the
        // operator sees a current plan and paid invoice on the Billing page.
        let initialPayment = null;
        if (!isUpgrade) {
            const initialAmount = await getOrderBillingAmount(order);
            const existingInitialPayment = await db('payments')
                .where({ user_id: userAccount.id })
                .where('description', 'like', `%${order.order_ref}%`)
                .first();

            if (!existingInitialPayment) {
                [initialPayment] = await db('payments').insert({
                    user_id: userAccount.id,
                    user_name: userAccount.name,
                    enterprise_id: enterprise.id,
                    plan: orderPlan,
                    previous_plan: orderPlan,
                    amount: initialAmount,
                    billing_cycle: orderBillingCycle,
                    method: orderPaymentMethod,
                    status: 'paid',
                    paid_at: new Date(),
                    due_date: orderBillingNextDue,
                    invoice_ref: generateInvoiceRef(),
                    description: `Initial order payment ${order.order_ref} (${orderBillingCycle})`,
                }).returning('*');
            } else {
                initialPayment = existingInitialPayment;
            }

            steps.push({
                step: 'billing',
                status: 'created',
                amount: initialPayment.amount,
                cycle: orderBillingCycle,
                nextDue: orderBillingNextDue,
            });
        }

        // 3. Create Devices using the same rules as manual device creation
        const deviceCount = order.gps_count || 1;
        const createdDevices = [];
        const overrideRows = Array.isArray(deviceOverrides) ? deviceOverrides : [];
        const plannedDeviceTypes = buildDeviceTypePlan(order);

        for (let i = 0; i < deviceCount; i++) {
            const override = overrideRows[i] || {};
            const generatedIds = await getNextDeviceIds(enterprise.id);
            const overrideType = override.deviceType || override.device_type || override.type;
            const nextIds = {
                serialNumber: (override.serie || override.serialNumber || '').trim() || generatedIds.serialNumber,
                imei: (override.imei || '').trim() || generatedIds.imei,
                subscriberNumber: (override.sim || override.subscriberNumber || '').trim() || generatedIds.subscriberNumber,
            };
            const deviceType = normalizeDeviceType(overrideType || plannedDeviceTypes[i]);

            await validateDeviceUniqueness({
                imei: nextIds.imei,
                serialNumber: nextIds.serialNumber,
                subscriberNumber: nextIds.subscriberNumber,
            });

            const [device] = await db('devices').insert({
                name: `GPS-${String(i + 1).padStart(4, '0')}`,
                device_type: deviceType,
                imei: nextIds.imei,
                serial_number: nextIds.serialNumber,
                subscriber_number: nextIds.subscriberNumber,
                enterprise_id: enterprise.id, enterprise_name: enterprise.name,
                status: 'online', battery: 100, signal: 95, speed: 0,
                location_lng: 10.1815, location_lat: 36.8065,
                address: 'Tunis, Tunisia', data_source: 'fake',
                sim_is_running: true, sim_route_id: 'tunis-ariana',
            }).returning('*');
            createdDevices.push({ name: device.name, imei: device.imei, serial: device.serial_number, id: device.id, deviceType: device.device_type });

            // Broadcast device creation
            broadcast('entity-change', {
                entity: 'device',
                action: 'create',
                item: formatDeviceForFrontend(device),
                id: device.id,
                message: `Nouvel appareil auto-généré: ${device.name}`
            }, device.enterprise_id);
        }
        steps.push({ step: 'devices', status: 'created', count: createdDevices.length, devices: createdDevices,
            note: isUpgrade ? `Ajoutés à l'entreprise existante avec les mêmes règles que la création manuelle` : 'Créés avec les règles de création manuelle'
        });

        // Broadcast Enterprise creation if applicable
        if (steps.some(s => s.step === 'enterprise' && s.status === 'created')) {
            broadcast('entity-change', {
                entity: 'enterprise',
                action: 'create',
                item: {
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
                },
                id: enterprise.id,
                message: `Nouvelle entreprise créée via commande: ${enterprise.name}`
            });
        }

        // Broadcast User creation or update
        const userFormatted = {
            id: userAccount.id,
            email: userAccount.email,
            name: userAccount.name,
            role: userAccount.role,
            plan: userAccount.plan || 'starter',
            enterpriseId: userAccount.enterprise_id,
            enterpriseName: userAccount.enterprise_name,
            avatar: userAccount.avatar,
            emailVerified: userAccount.email_verified,
            lastLogin: userAccount.last_login,
            createdAt: userAccount.created_at,
            billingStatus: userAccount.billing_status || 'active',
            billingNextDue: userAccount.billing_next_due || null,
            savedBillingCycle: userAccount.saved_billing_cycle || 'monthly',
            savedPaymentMethod: userAccount.saved_payment_method || '',
        };

        if (steps.some(s => s.step === 'user' && s.status === 'created')) {
            broadcast('entity-change', {
                entity: 'user',
                action: 'create',
                item: userFormatted,
                id: userAccount.id,
                message: `Nouvel utilisateur créé via commande: ${userAccount.name}`
            }, userAccount.enterprise_id);
        } else {
            broadcast('entity-change', {
                entity: 'user',
                action: 'update',
                item: userFormatted,
                id: userAccount.id,
                message: `Utilisateur rattaché à l'entreprise via commande: ${userAccount.name}`
            }, userAccount.enterprise_id);
        }

        // 6. Activate order
        const [updatedOrder] = await db('orders').where('id', order.id).update({
            status: 'active', activated_at: new Date(),
            admin_notes: (order.admin_notes || '') + `\n[Auto] Processed: ${enterprise.name}, ${createdDevices.length} devices, user: ${order.email}` + (isUpgrade ? ' (upgrade continuation)' : '')
        }).returning('*');
        steps.push({ step: 'order', status: 'activated' });

        broadcast('entity-change', {
            entity: 'order',
            action: 'update',
            item: formatOrder(updatedOrder),
            id: updatedOrder.id,
            message: `Commande traitée et activée: ${updatedOrder.order_ref}`
        });

        res.json({
            success: true, orderRef: order.order_ref,
            enterprise: { name: enterprise.name, id: enterprise.id },
            user: { email: order.email, name: order.full_name, tempPassword: createdTempPassword, welcomeEmailSent },
            billing: initialPayment ? {
                invoiceRef: initialPayment.invoice_ref,
                amount: initialPayment.amount,
                billingCycle: initialPayment.billing_cycle,
                nextDue: orderBillingNextDue,
            } : null,
            devices: createdDevices, steps,
        });
    } catch (err) {
        console.error('[Order] Process error:', err);
        res.status(err.statusCode || 400).json({ error: err.message });
    }
});

export default router;
