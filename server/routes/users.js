import express from 'express';
import db from '../db/knex.js';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';
import { generateVerificationCode, sendVerificationEmail, sendWelcomeEmail } from '../utils/mailjet.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { broadcast } from '../simulation/engine.js';

const router = express.Router();

function formatUser(u) {
    return {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        plan: u.plan || 'starter',
        enterpriseId: u.enterprise_id,
        enterpriseName: u.enterprise_name,
        avatar: u.avatar,
        emailVerified: u.email_verified,
        lastLogin: u.last_login,
        createdAt: u.created_at,
        billingStatus: u.billing_status || 'active',
        billingNextDue: u.billing_next_due || null,
        savedBillingCycle: u.saved_billing_cycle || 'monthly',
        savedPaymentMethod: u.saved_payment_method || '',
    };
}

// Get all users
router.get('/', verifyToken, async (req, res) => {
    try {
        const { role, enterpriseId } = req.user;
        let query = db('users').orderBy('created_at', 'desc');
        
        if (role !== 'admin') {
            query = query.where('enterprise_id', enterpriseId);
        }
        
        const users = await query;
        const formatted = users.map(u => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            plan: u.plan || 'starter',
            enterpriseId: u.enterprise_id,
            enterpriseName: u.enterprise_name,
            avatar: u.avatar,
            emailVerified: u.email_verified,
            lastLogin: u.last_login,
            createdAt: u.created_at,
            billingStatus: u.billing_status || 'active',
            billingNextDue: u.billing_next_due || null,
            savedBillingCycle: u.saved_billing_cycle || 'monthly',
            savedPaymentMethod: u.saved_payment_method || '',
        }));
        res.json(formatted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single user
router.get('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const user = await db('users').where('id', req.params.id).first();
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plan: user.plan || 'starter',
            enterpriseId: user.enterprise_id,
            enterpriseName: user.enterprise_name,
            avatar: user.avatar,
            emailVerified: user.email_verified,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            billingStatus: user.billing_status || 'active',
            billingNextDue: user.billing_next_due || null,
            billingWarnedAt: user.billing_warned_at || null,
            savedBillingCycle: user.saved_billing_cycle || 'monthly',
            savedPaymentMethod: user.saved_payment_method || '',
            cancelAtPeriodEnd: user.cancel_at_period_end || false,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comprehensive user profile (admin)
router.get('/:id/profile', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const user = await db('users').where('id', req.params.id).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Payments history
        const payments = await db('payments')
            .where('user_id', req.params.id)
            .orderBy('created_at', 'desc')
            .limit(10);

        // Device count for enterprise
        let deviceCount = 0;
        if (user.enterprise_id) {
            const [{ count }] = await db('devices').where('enterprise_id', user.enterprise_id).count('id as count');
            deviceCount = parseInt(count);
        }

        res.json({
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            plan: user.plan || 'starter',
            enterpriseId: user.enterprise_id,
            enterpriseName: user.enterprise_name,
            avatar: user.avatar,
            emailVerified: user.email_verified,
            lastLogin: user.last_login,
            createdAt: user.created_at,
            billingStatus: user.billing_status || 'active',
            billingNextDue: user.billing_next_due || null,
            billingWarnedAt: user.billing_warned_at || null,
            savedBillingCycle: user.saved_billing_cycle || 'monthly',
            savedPaymentMethod: user.saved_payment_method || '',
            cancelAtPeriodEnd: user.cancel_at_period_end || false,
            deviceCount,
            payments: payments.map(p => ({
                id: p.id,
                invoiceRef: p.invoice_ref,
                plan: p.plan,
                previousPlan: p.previous_plan,
                amount: p.amount,
                billingCycle: p.billing_cycle,
                status: p.status,
                method: p.method,
                dueDate: p.due_date,
                paidAt: p.paid_at,
                description: p.description,
                createdAt: p.created_at,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create user
router.post('/', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const password = req.body.password || 'demo123';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const [user] = await db('users').insert({
            email: req.body.email,
            password: hashedPassword,
            name: req.body.name,
            role: req.body.role || 'operator',
            plan: req.body.plan || 'starter',
            enterprise_id: req.body.enterpriseId || null,
            enterprise_name: req.body.enterpriseName || null,
            avatar: req.body.avatar || null,
            email_verified: false,
            is_initial_password: true,
        }).returning('*');

        await logAudit('user.create', 'Admin', {
            targetType: 'user', targetId: user.id, targetName: user.name
        });

        broadcast('entity-change', {
            entity: 'user',
            action: 'create',
            item: formatUser(user),
            id: user.id,
            message: `Nouvel utilisateur créé: ${user.name}`
        }, user.enterprise_id);

        // Send welcome email with credentials (fire-and-forget)
        sendWelcomeEmail(
            user.email,
            user.name,
            password,
            user.plan || 'starter',
            user.enterprise_name || null,
            req.body.loginUrl || null
        ).then(sent => {
            if (sent) console.log(`[✅ WELCOME] Email sent to ${user.email}`);
            else console.log(`[⚠️ WELCOME] Email failed for ${user.email}`);
        }).catch(() => {});

        res.status(201).json({
            id: user.id, email: user.email, name: user.name, role: user.role,
            plan: user.plan, enterpriseName: user.enterprise_name,
            emailVerified: user.email_verified,
            // Return plaintext password ONLY on creation so admin can show it in the popup
            generatedPassword: password,
            welcomeEmailSent: true,
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Send verification code
router.post('/send-verification', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await db('users').where('email', email).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.email_verified) return res.json({ message: 'Email already verified', verified: true });

        const code = generateVerificationCode();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await db('users').where('id', user.id).update({
            verification_code: code,
            verification_code_expiry: expiry
        });

        const emailSent = await sendVerificationEmail(user.email, user.name, code);
        if (emailSent) {
            console.log(`[🔑 VERIFY] Code sent to ${email}: ${code}`);
            res.json({ message: 'Verification code sent', sent: true });
        } else {
            res.status(500).json({ error: 'Failed to send email' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify email with code
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

        const user = await db('users').where('email', email).first();
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.email_verified) return res.json({ message: 'Email already verified', verified: true });
        if (user.verification_code !== code) return res.status(400).json({ error: 'Invalid verification code' });
        if (new Date(user.verification_code_expiry) < new Date()) return res.status(400).json({ error: 'Verification code expired' });

        await db('users').where('id', user.id).update({
            email_verified: true,
            verification_code: null,
            verification_code_expiry: null
        });

        await logAudit('user.email_verified', user.name, {
            targetType: 'user', targetId: user.id, targetName: user.email
        });

        console.log(`[✅ VERIFIED] ${email} email verified successfully`);
        res.json({ message: 'Email verified successfully', verified: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update own preferences
router.put('/me/prefs', verifyToken, async (req, res) => {
    try {
        const { emailAlertPrefs } = req.body;
        if (!emailAlertPrefs) return res.status(400).json({ error: 'emailAlertPrefs is required' });

        const [user] = await db('users')
            .where('id', req.user.id)
            .update({
                email_alert_prefs: JSON.stringify(emailAlertPrefs),
                updated_at: new Date()
            })
            .returning('*');

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ email_alert_prefs: emailAlertPrefs });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update user
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const isSelf = req.user.id == req.params.id;
        const isAdmin = req.user.role === 'admin';

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }

        const userToUpdate = await db('users').where('id', req.params.id).first();
        if (!userToUpdate) return res.status(404).json({ error: 'User not found' });

        const updates = {};
        
        // 1. Handle sensitive fields (Admin ONLY)
        if (isAdmin) {
            if (req.body.role !== undefined) updates.role = req.body.role;
            if (req.body.plan !== undefined) updates.plan = req.body.plan;
            if (req.body.enterpriseId !== undefined) updates.enterprise_id = req.body.enterpriseId;
            if (req.body.enterpriseName !== undefined) updates.enterprise_name = req.body.enterpriseName;
        }

        // 2. Handle common profile fields
        if (req.body.name !== undefined) updates.name = req.body.name;
        if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;

        // 3. Handle Email change with password verification
        const currentEmail = userToUpdate.email.trim().toLowerCase();
        const newEmail = req.body.email ? req.body.email.trim().toLowerCase() : undefined;

        if (newEmail && newEmail !== currentEmail) {
            // Require password verification for email change
            if (!req.body.currentPassword) {
                return res.status(400).json({ error: 'Mot de passe actuel requis pour changer l\'adresse email' });
            }
            
            const isMatch = await bcrypt.compare(req.body.currentPassword, userToUpdate.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
            }

            // Check if new email is taken
            const existing = await db('users').where('email', req.body.email).whereNot('id', req.params.id).first();
            if (existing) {
                return res.status(400).json({ error: 'Cette adresse email est déjà utilisée' });
            }

            updates.email = req.body.email;
        }

        // 4. Handle Password change
        if (req.body.newPassword !== undefined) {
             if (!req.body.currentPassword) {
                return res.status(400).json({ error: 'Mot de passe actuel requis pour changer le mot de passe' });
            }
            const isMatch = await bcrypt.compare(req.body.currentPassword, userToUpdate.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
            }

            const salt = await bcrypt.genSalt(10);
            updates.password = await bcrypt.hash(req.body.newPassword, salt);
        }

        updates.updated_at = new Date();

        const [updatedUser] = await db('users').where('id', req.params.id).update(updates).returning('*');
        
        await logAudit('user.update', isAdmin ? 'Admin' : updatedUser.name, {
            targetType: 'user', targetId: updatedUser.id, targetName: updatedUser.name,
            fields: Object.keys(updates).filter(k => k !== 'password')
        });

        broadcast('entity-change', {
            entity: 'user',
            action: 'update',
            item: formatUser(updatedUser),
            id: updatedUser.id,
            message: `Utilisateur mis à jour: ${updatedUser.name}`
        }, updatedUser.enterprise_id);

        const { password, verification_code, verification_code_expiry, ...safeUser } = updatedUser;
        res.json(safeUser);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete user
router.delete('/:id', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const user = await db('users').where('id', req.params.id).first();
        if (!user) return res.status(404).json({ error: 'User not found' });

        await db('users').where('id', req.params.id).del();

        await logAudit('user.delete', 'Admin', {
            targetType: 'user', targetId: user.id, targetName: user.name
        });

        broadcast('entity-change', {
            entity: 'user',
            action: 'delete',
            id: user.id,
            message: `Utilisateur supprimé: ${user.name}`
        }, user.enterprise_id);

        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
