import express from 'express';
import db from '../db/knex.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

const PLAN_PRICING = {
    starter: { monthly: 29, biannual: 156, annual: 278 },
    pro:     { monthly: 39, biannual: 210, annual: 374 },
};

function generateInvoiceRef() {
    const d = new Date();
    const y = d.getFullYear().toString().slice(-2);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const r = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `INV-${y}${m}-${r}`;
}

/** Calculate next due date from a base date + cycle */
function nextDueFromCycle(baseDate, billingCycle) {
    const d = new Date(baseDate);
    if (billingCycle === 'annual')   d.setFullYear(d.getFullYear() + 1);
    else if (billingCycle === 'biannual') d.setMonth(d.getMonth() + 6);
    else                             d.setMonth(d.getMonth() + 1);
    return d;
}

/** Calculate next due date from mode + value */
function calcNextDue(mode, value, billingCycle, currentDue) {
    const now = new Date();
    // If we have a current due date, base it on that to keep the cycle date fixed
    const baseDate = currentDue ? new Date(currentDue) : new Date();
    
    if (mode === 'add_days') {
        baseDate.setDate(baseDate.getDate() + (value || 30));
        return baseDate;
    }
    if (mode === 'add_months') {
        baseDate.setMonth(baseDate.getMonth() + (value || 1));
        return baseDate;
    }
    if (mode === 'set_days') {
        const d = new Date();
        d.setDate(d.getDate() + (value || 0));
        return d;
    }
    // mode === 'cycle' or fallback: use billing cycle
    const cycle = billingCycle || 'monthly';
    let nextDue = nextDueFromCycle(baseDate, cycle);
    // If the next due date is still in the past, keep adding cycles until it is in the future
    while (nextDue <= now) {
        nextDue = nextDueFromCycle(nextDue, cycle);
    }
    return nextDue;
}


function nextDueAfterPayment(payment, fallbackCycle) {
    const cycle = payment?.billing_cycle || fallbackCycle || 'monthly';
    const baseDate = payment?.due_date ? new Date(payment.due_date) : new Date();
    return nextDueFromCycle(baseDate, cycle);
}

// ── Format payment → camelCase ─────────────────────────────────
function formatPayment(p) {
    return {
        _id: p.id, id: p.id,
        userId: p.user_id,
        userName: p.user_name,
        plan: p.plan,
        previousPlan: p.previous_plan,
        amount: p.amount,
        billingCycle: p.billing_cycle,
        status: p.status,
        method: p.method,
        dueDate: p.due_date,
        paidAt: p.paid_at,
        invoiceRef: p.invoice_ref,
        adminNotes: p.admin_notes,
        description: p.description,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
    };
}

// ── Format plan info ───────────────────────────────────────────
function formatPlanInfo(user, lastPayment) {
    const currentPlan = user.plan || 'starter';
    return {
        plan: currentPlan,
        pricing: PLAN_PRICING[currentPlan] || PLAN_PRICING.starter,
        lastPayment: lastPayment ? formatPayment(lastPayment) : null,
        nextDueDate: user.billing_next_due || lastPayment?.due_date || null,
        savedPaymentMethod: user.saved_payment_method || '',
        savedBillingCycle: user.saved_billing_cycle || 'monthly',
        cancelAtPeriodEnd: user.cancel_at_period_end || false,
        billingStatus: user.billing_status || 'active',
        billingNextDue: user.billing_next_due || null,
        billingWarnedAt: user.billing_warned_at || null,
        pendingPlan: user.pending_plan || null,
        pendingBillingCycle: user.pending_billing_cycle || null,
    };
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════

router.get('/prices', (req, res) => res.json(PLAN_PRICING));

router.get('/payments', verifyToken, async (req, res) => {
    try {
        let query = db('payments');
        if (req.query.userId) query = query.where('user_id', req.query.userId);
        const payments = await query.orderBy('created_at', 'desc');
        res.json(payments.map(formatPayment));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/plan/:userId', verifyToken, async (req, res) => {
    try {
        const user = await db('users')
            .where('id', req.params.userId)
            .select('plan', 'name', 'email', 'enterprise_id',
                'saved_payment_method', 'saved_billing_cycle', 'cancel_at_period_end',
                'billing_status', 'billing_next_due', 'billing_warned_at', 'pending_plan', 'pending_billing_cycle')
            .first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const lastPayment = await db('payments')
            .where('user_id', req.params.userId)
            .orderBy('created_at', 'desc')
            .first();

        res.json(formatPlanInfo(user, lastPayment));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Operator upgrade / downgrade / cycle change ────────────────
router.post('/upgrade', verifyToken, async (req, res) => {
    try {
        const { userId, targetPlan, billingCycle, method } = req.body;
        if (!userId || !targetPlan || !billingCycle || !method)
            return res.status(400).json({ error: 'Missing required fields' });

        const user = await db('users').where('id', userId).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const previousPlan = user.plan || 'starter';
        const pricing = PLAN_PRICING[targetPlan];
        if (!pricing) return res.status(400).json({ error: 'Invalid plan' });

        const isUpgrade   = previousPlan === 'starter' && targetPlan === 'pro';
        const isDowngrade = previousPlan === 'pro'     && targetPlan === 'starter';
        const currentCycle = user.saved_billing_cycle || 'monthly';
        const isRenewal = previousPlan === targetPlan && billingCycle === currentCycle;
        const isCycleChange = previousPlan === targetPlan && billingCycle !== currentCycle;

        // ─── SAME PLAN + SAME CYCLE: this is a renewal/payment ───────
        if (isRenewal) {
            const amount = pricing[billingCycle] || pricing.monthly;

            // ── STEP 1: Find the oldest unpaid invoice to settle ──────────
            // This is the invoice the suspended user is paying right now.
            const overduePayment = await db('payments')
                .where({ user_id: userId, plan: targetPlan, billing_cycle: billingCycle })
                .whereIn('status', ['pending', 'overdue'])
                .orderBy('created_at', 'asc')
                .first();

            // Base the NEXT due date on the original overdue due_date (not today).
            // If the user was suspended on Jan 15 (due date), their next period starts
            // Feb 15 — not "today + 1 month".
            const originalDueDate = overduePayment?.due_date
                ? new Date(overduePayment.due_date)
                : (user.billing_next_due ? new Date(user.billing_next_due) : new Date());
            let nextDue = nextDueFromCycle(originalDueDate, billingCycle);
            const now = new Date();
            while (nextDue <= now) {
                nextDue = nextDueFromCycle(nextDue, billingCycle);
            }

            // ── STEP 2: Pay the overdue invoice ───────────────────────────
            let payment;
            if (overduePayment) {
                // Mark it paid — keep its original due_date (it represents the settled period).
                [payment] = await db('payments').where('id', overduePayment.id).update({
                    status: 'paid',
                    paid_at: new Date(),
                    amount,
                    method,
                    description: `Reactivation payment — period settled (${billingCycle})`,
                }).returning('*');

                // Cancel every other stale pending to avoid ghost "en attente" entries.
                await db('payments')
                    .where({ user_id: userId, status: 'pending' })
                    .whereNot('id', overduePayment.id)
                    .update({
                        status: 'cancelled',
                        description: 'Cancelled: superseded by reactivation payment',
                    });
            } else {
                // No pre-existing overdue invoice — create a fresh paid one.
                [payment] = await db('payments').insert({
                    user_id: userId, user_name: user.name, enterprise_id: user.enterprise_id,
                    plan: targetPlan, previous_plan: previousPlan, amount, billing_cycle: billingCycle,
                    method, status: 'paid', paid_at: new Date(), due_date: originalDueDate,
                    invoice_ref: generateInvoiceRef(),
                    description: `Renewal payment confirmed (${billingCycle})`,
                }).returning('*');
            }

            // ── STEP 3: Auto-renewal — create next "en attente" invoice ───
            // Only when the user has a saved payment method AND has NOT clicked
            // "Retirer (non-renouvellement)" (cancel_at_period_end = false).
            // This gives the user visibility of the upcoming charge date.
            const savedMethod = method || user.saved_payment_method || '';
            const willAutoRenew = savedMethod && !user.cancel_at_period_end;
            if (willAutoRenew) {
                await db('payments').insert({
                    user_id: userId,
                    user_name: user.name,
                    enterprise_id: user.enterprise_id,
                    plan: targetPlan,
                    previous_plan: targetPlan,
                    amount,
                    billing_cycle: billingCycle,
                    method: savedMethod,
                    status: 'pending',
                    due_date: nextDue,
                    invoice_ref: generateInvoiceRef(),
                    description: `Upcoming auto-renewal (${billingCycle}) — due ${nextDue.toISOString().slice(0, 10)}`,
                });
            }

            // ── STEP 4: Activate the user ─────────────────────────────────
            await db('users').where('id', userId).update({
                plan: targetPlan,
                saved_payment_method: savedMethod,
                saved_billing_cycle: billingCycle,
                cancel_at_period_end: false,
                pending_plan: null,
                pending_billing_cycle: null,
                billing_next_due: nextDue,
                billing_status: 'active',
                billing_warned_at: null,
            });

            return res.json({
                success: true,
                immediate: true,
                payment: formatPayment(payment),
                newPlan: targetPlan,
                billingStatus: 'active',
                billingNextDue: nextDue,
            });
        }

        // ─── DOWNGRADE or CYCLE CHANGE: schedule for next period ───────
        if (isDowngrade || isCycleChange) {
            // Cancel any previously scheduled pending payments so they don't stack up
            await db('payments').where({ user_id: userId, status: 'pending' })
                .update({ status: 'cancelled', description: 'Cancelled due to new scheduled change' });

            const now = new Date();
            const currentDue = user.billing_next_due ? new Date(user.billing_next_due) : now;
            const effectiveDate = currentDue > now ? currentDue : nextDueFromCycle(now, billingCycle || user.saved_billing_cycle || 'monthly');
            const actionText = isDowngrade ? 'Downgrade to Starter' : `Cycle change to ${billingCycle}`;
            const amount = pricing[billingCycle] || pricing.monthly;

            // Record a pending entry showing the scheduled change
            const [payment] = await db('payments').insert({
                user_id: userId, user_name: user.name, enterprise_id: user.enterprise_id,
                plan: targetPlan, previous_plan: previousPlan, amount, billing_cycle: billingCycle,
                method, status: 'pending', due_date: effectiveDate,
                invoice_ref: generateInvoiceRef(),
                description: `${actionText} scheduled at period end (${effectiveDate.toISOString().slice(0,10)})`,
            }).returning('*');

            // Mark the user: keep current plan now, switch at period end
            await db('users').where('id', userId).update({
                pending_plan: targetPlan,
                pending_billing_cycle: billingCycle,
                saved_payment_method: method,
                billing_status: 'active',
                billing_next_due: effectiveDate,
                billing_warned_at: null,
                cancel_at_period_end: false,
            });

            return res.json({
                success: true,
                immediate: false,
                payment: formatPayment(payment),
                newPlan: previousPlan,
                pendingPlan: targetPlan,
                effectiveDate: effectiveDate.toISOString(),
            });
        }

        // ─── UPGRADE: apply immediately, charge now ───
        const amount  = pricing[billingCycle] || pricing.monthly;
        const dueDate = nextDueFromCycle(new Date(), billingCycle);

        const [payment] = await db('payments').insert({
            user_id: userId, user_name: user.name, enterprise_id: user.enterprise_id,
            plan: targetPlan, previous_plan: previousPlan, amount, billing_cycle: billingCycle,
            method, status: 'paid', paid_at: new Date(), due_date: dueDate,
            invoice_ref: generateInvoiceRef(),
            description: `Upgrade from ${previousPlan} to ${targetPlan} (${billingCycle})`,
        }).returning('*');

        await db('users').where('id', userId).update({
            plan: targetPlan,
            saved_payment_method: method,
            saved_billing_cycle: billingCycle,
            cancel_at_period_end: false,
            pending_plan: null,
            pending_billing_cycle: null,
            billing_next_due: dueDate,
            billing_status: 'active',
        });

        return res.json({ success: true, immediate: true, payment: formatPayment(payment), newPlan: targetPlan });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


router.post('/cancel-plan', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;
        await db('users').where('id', userId).update({ 
            cancel_at_period_end: true,
            pending_plan: null,
            pending_billing_cycle: null
        });
        await db('payments').where({ user_id: userId, status: 'pending' })
            .update({ status: 'cancelled', description: 'Cancelled along with plan cancellation' });
        res.json({ success: true, cancelAtPeriodEnd: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/resume-plan', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;
        await db('users').where('id', userId).update({ cancel_at_period_end: false });
        res.json({ success: true, cancelAtPeriodEnd: false });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/remove-method', verifyToken, async (req, res) => {
    try {
        const { userId } = req.body;
        // Removing the payment method cancels auto-renewal and clears any pending changes
        await db('users').where('id', userId).update({
            saved_payment_method: '',
            cancel_at_period_end: true,
            pending_plan: null,
            pending_billing_cycle: null
        });
        await db('payments').where({ user_id: userId, status: 'pending' })
            .update({ status: 'cancelled', description: 'Cancelled along with payment method removal' });
        res.json({ success: true, cancelAtPeriodEnd: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/payments/:id/status', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { status } = req.body;
        const payment = await db('payments').where('id', req.params.id).first();
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        const update = { status };
        if (status === 'paid') update.paid_at = new Date();

        const [updatedPayment] = await db('payments').where('id', req.params.id).update(update).returning('*');
        let billingStatus;
        let billingNextDue;

        if (status === 'paid' && payment.user_id) {
            const user = await db('users').where('id', payment.user_id).first();
            if (user) {
                let nextDue = nextDueAfterPayment(payment, user.saved_billing_cycle);
                const now = new Date();
                while (nextDue <= now) {
                    nextDue = nextDueFromCycle(nextDue, payment.billing_cycle || user.saved_billing_cycle || 'monthly');
                }
                const bStatus = nextDue < now ? 'suspended' : 'active';
                await db('users').where('id', payment.user_id).update({
                    billing_status: bStatus,
                    billing_next_due: nextDue,
                    billing_warned_at: null,
                    cancel_at_period_end: false,
                });
                billingStatus = bStatus;
                billingNextDue = nextDue;
            }
        }

        res.json({
            payment: formatPayment(updatedPayment),
            billingStatus,
            billingNextDue,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ═══════════════════════════════════════════════════════════════
//  ADMIN ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export async function performBillingCheck() {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    // 1. Warn: billing_next_due is within 3 days AND status is still 'active'
    const warned = await db('users')
        .where('role', 'operator')
        .where('billing_status', 'active')
        .whereNotNull('billing_next_due')
        .where('billing_next_due', '<=', threeDaysFromNow)
        .where('billing_next_due', '>', now)
        .update({ billing_status: 'warning', billing_warned_at: now });

    // 2. Auto-renew users who have a saved payment method and haven't cancelled
    const usersToRenew = await db('users')
        .where('role', 'operator')
        .whereIn('billing_status', ['active', 'warning'])
        .whereNotNull('billing_next_due')
        .where('billing_next_due', '<', now)
        .where('cancel_at_period_end', false)
        .where('saved_payment_method', '!=', '');

    let renewed = 0;
    for (const u of usersToRenew) {
        const newPlan = u.pending_plan || u.plan;
        const newCycle = u.pending_billing_cycle || u.saved_billing_cycle;
        
        let nextDue = nextDueFromCycle(u.billing_next_due, newCycle);
        while (nextDue <= now) {
            nextDue = nextDueFromCycle(nextDue, newCycle);
        }

        await db('users').where('id', u.id).update({
            plan: newPlan,
            saved_billing_cycle: newCycle,
            billing_next_due: nextDue,
            billing_status: 'active',
            pending_plan: null,
            pending_billing_cycle: null,
            billing_warned_at: null,
        });

        const pendingPayment = await db('payments')
            .where({ user_id: u.id, status: 'pending' })
            .first();
        
        if (pendingPayment) {
            await db('payments').where('id', pendingPayment.id).update({
                status: 'paid', paid_at: now, due_date: nextDue
            });
        } else {
            const pricing = PLAN_PRICING[newPlan] || PLAN_PRICING.starter;
            const amount = pricing[newCycle] || pricing.monthly;
            await db('payments').insert({
                user_id: u.id, user_name: u.name, enterprise_id: u.enterprise_id,
                plan: newPlan, previous_plan: u.plan, amount, billing_cycle: newCycle,
                method: u.saved_payment_method, status: 'paid', paid_at: now, due_date: nextDue,
                invoice_ref: generateInvoiceRef(),
                description: `Auto-renewal payment confirmed (${newCycle})`,
            });
        }
        renewed++;
    }

    // 3. Suspend remaining users whose due date has passed (no card, or cancelled)
    const suspended = await db('users')
        .where('role', 'operator')
        .whereIn('billing_status', ['active', 'warning'])
        .whereNotNull('billing_next_due')
        .where('billing_next_due', '<', now)
        .update({
            plan: db.raw("COALESCE(pending_plan, plan)"),
            saved_billing_cycle: db.raw("COALESCE(pending_billing_cycle, saved_billing_cycle)"),
            billing_status: 'suspended',
            cancel_at_period_end: false,
            pending_plan: null,
            pending_billing_cycle: null,
        });

    return { warned, renewed, suspended };
}

// ── Check billing due dates (cron-like) ────────────────────────
router.get('/check-due', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { warned, renewed, suspended } = await performBillingCheck();
        console.log(`[Billing] Check-due API: ${warned} warned, ${renewed} renewed, ${suspended} suspended`);
        res.json({ success: true, warned, renewed, suspended });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Admin: record a payment for a user ─────────────────────────
router.post('/admin-pay', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId, amount, dueMode, dueValue, method, adminId, adminName } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const user = await db('users').where('id', userId).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const plan = user.plan || 'starter';
        const cycle = user.saved_billing_cycle || 'monthly';
        const pricing = PLAN_PRICING[plan] || PLAN_PRICING.starter;
        const finalAmount = amount !== undefined ? amount : (pricing[cycle] || pricing.monthly);
        const nextDue = calcNextDue(dueMode || 'cycle', dueValue, cycle, user.billing_next_due);

        // Create payment record
        const [payment] = await db('payments').insert({
            user_id: userId, user_name: user.name, enterprise_id: user.enterprise_id,
            plan, previous_plan: plan, amount: finalAmount, billing_cycle: cycle,
            method: method || user.saved_payment_method || 'admin',
            status: 'paid', paid_at: new Date(), due_date: nextDue,
            invoice_ref: generateInvoiceRef(),
            description: `Admin payment — next due: ${nextDue.toISOString().slice(0, 10)}`,
        }).returning('*');

        const now = new Date();
        const billingStatus = nextDue < now ? 'suspended' : 'active';

        // Update user
        await db('users').where('id', userId).update({
            billing_status: billingStatus,
            billing_next_due: nextDue,
            billing_warned_at: null,
        });

        // Audit log
        await db('audit_logs').insert({
            action: 'billing.admin_pay',
            user_name: adminName || 'Admin',
            target_type: 'user',
            target_id: userId,
            target_name: user.name,
            details: { amount: finalAmount, nextDue, dueMode, dueValue }
        });

        res.json({ success: true, payment: formatPayment(payment), billingNextDue: nextDue, billingStatus });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Admin: change user plan ────────────────────────────────────
router.post('/admin-change-plan', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId, plan, billingCycle, adminName } = req.body;
        if (!userId || !plan) return res.status(400).json({ error: 'userId and plan required' });

        const user = await db('users').where('id', userId).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const previousPlan = user.plan || 'starter';
        const cycle = billingCycle || user.saved_billing_cycle || 'monthly';
        const nextDue = nextDueFromCycle(new Date(), cycle);
        const pricing = PLAN_PRICING[plan] || PLAN_PRICING.starter;
        const amount = pricing[cycle] || pricing.monthly;

        // Create billing event record
        const [payment] = await db('payments').insert({
            user_id: userId, user_name: user.name, enterprise_id: user.enterprise_id,
            plan, previous_plan: previousPlan, amount, billing_cycle: cycle,
            method: 'admin', status: 'paid', paid_at: new Date(), due_date: nextDue,
            invoice_ref: generateInvoiceRef(),
            description: previousPlan === plan
                ? `Admin: cycle changed to ${cycle}`
                : `Admin: plan changed ${previousPlan} → ${plan} (${cycle})`,
        }).returning('*');

        // Update user
        await db('users').where('id', userId).update({
            plan,
            saved_billing_cycle: cycle,
            billing_next_due: nextDue,
            billing_status: 'active',
            billing_warned_at: null,
        });

        // Audit log
        await db('audit_logs').insert({
            action: 'billing.admin_change_plan',
            user_name: adminName || 'Admin',
            target_type: 'user',
            target_id: userId,
            target_name: user.name,
            details: { previousPlan, newPlan: plan, billingCycle: cycle, nextDue }
        });

        res.json({
            success: true, payment: formatPayment(payment),
            newPlan: plan, billingCycle: cycle, billingNextDue: nextDue,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Admin: unblock a suspended user ────────────────────────────
router.post('/admin-unblock', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId, graceDays, adminName, preserveDue } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const user = await db('users').where('id', userId).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        const days = graceDays || 0;
        let nextDue = user.billing_next_due;

        if (!preserveDue) {
            nextDue = new Date();
            nextDue.setDate(nextDue.getDate() + days);
        }

        // Create audit / payment record
        await db('payments').insert({
            user_id: userId, user_name: user.name, enterprise_id: user.enterprise_id,
            plan: user.plan || 'starter', previous_plan: user.plan || 'starter',
            amount: 0, billing_cycle: user.saved_billing_cycle || 'monthly',
            method: 'admin', status: 'paid', paid_at: new Date(), due_date: nextDue,
            invoice_ref: generateInvoiceRef(),
            description: preserveDue 
                ? `Admin: account unblocked — échéance conservée` 
                : `Admin: account unblocked — grace period ${days} days`,
        });

        await db('users').where('id', userId).update({
            billing_status: 'active',
            billing_next_due: nextDue,
            billing_warned_at: null,
        });

        // Audit log
        await db('audit_logs').insert({
            action: 'billing.admin_unblock',
            user_name: adminName || 'Admin',
            target_type: 'user',
            target_id: userId,
            target_name: user.name,
            details: { graceDays: days, nextDue }
        });

        res.json({ success: true, billingStatus: 'active', billingNextDue: nextDue });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Admin: manually block a user ───────────────────────────────
router.post('/admin-block', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { userId, adminName, reason } = req.body;
        if (!userId) return res.status(400).json({ error: 'userId required' });

        const user = await db('users').where('id', userId).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (reason === 'payment') {
            await db('users').where('id', userId).update({
                billing_status: 'suspended',
                billing_next_due: new Date(), // Reset due date to now
            });
        } else {
            // personal / generic intervention
            await db('users').where('id', userId).update({
                billing_status: 'suspended',
                // Keep the existing billing_next_due
            });
        }

        // Audit log
        await db('audit_logs').insert({
            action: 'billing.admin_block',
            user_name: adminName || 'Admin',
            target_type: 'user',
            target_id: userId,
            target_name: user.name,
            details: { reason }
        });

        res.json({ success: true, billingStatus: 'suspended' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
