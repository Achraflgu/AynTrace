import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/knex.js';
import bcrypt from 'bcryptjs';
import { logAudit } from '../utils/auditLogger.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const user = await db('users').where('email', email).first();
        if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Identifiants invalides' });

        if (!user.email_verified || user.is_initial_password) {
            return res.json({
                success: true,
                needsVerification: true,
                email: user.email,
                needsPasswordSetup: user.is_initial_password,
                emailVerified: user.email_verified,
                user: {
                    id: user.id, name: user.name, role: user.role, plan: user.plan || 'starter',
                    enterpriseId: user.enterprise_id, enterpriseName: user.enterprise_name,
                    emailVerified: user.email_verified, isInitialPassword: user.is_initial_password,
                    billingStatus: user.billing_status || 'active',
                    billingNextDue: user.billing_next_due || null,
                }
            });
        }

        await db('users').where('id', user.id).update({ last_login: new Date() });

        await logAudit('user.login', user.name, { ip: req.ip || 'unknown' });

        // Sign a JWT with user identity
        const token = jwt.sign(
            { id: user.id, email: user.email, name: user.name, role: user.role, enterpriseId: user.enterprise_id },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id, email: user.email, name: user.name, role: user.role,
                plan: user.plan || 'starter', enterpriseId: user.enterprise_id,
                enterpriseName: user.enterprise_name, avatar: user.avatar,
                lastLogin: new Date(), emailVerified: user.email_verified,
                billingStatus: user.billing_status || 'active',
                billingNextDue: user.billing_next_due || null,
                emailAlertPrefs: typeof user.email_alert_prefs === 'string' ? JSON.parse(user.email_alert_prefs) : user.email_alert_prefs || { enabled: false, types: [] },
            }
        });
    } catch (error) {
        console.error('[Auth] Login error:', error);
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
});

// Check if email already exists in users or orders (public endpoint)
router.post('/check-email', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const emailLower = email.trim().toLowerCase();

        // 1. Check users
        const userExists = await db('users').where('email', emailLower).first();
        if (userExists) {
            return res.json({ exists: true, source: 'users' });
        }

        // 2. Check orders (excluding cancelled orders)
        const orderExists = await db('orders')
            .where('email', emailLower)
            .whereNot('status', 'cancelled')
            .first();

        if (orderExists) {
            return res.json({ exists: true, source: 'orders' });
        }

        res.json({ exists: false });
    } catch (error) {
        console.error('[Auth] Check email error:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification de l\'adresse email' });
    }
});

// Forgot Password: Send Code
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await db('users').where('email', email).first();
        if (!user) {
            return res.status(404).json({ error: "Aucun compte n'est associé à cet email" });
        }

        const { generateVerificationCode, sendPasswordResetEmail } = await import('../utils/mailjet.js');
        const code = generateVerificationCode();
        const expiry = new Date(Date.now() + 10 * 60 * 1000);

        await db('users').where('id', user.id).update({
            verification_code: code,
            verification_code_expiry: expiry
        });

        await sendPasswordResetEmail(user.email, user.name, code);
        res.json({ success: true, message: 'Password reset code sent' });
    } catch (error) {
        console.error('[Auth] Forgot password error:', error);
        res.status(500).json({ error: 'Erreur lors de la demande de réinitialisation' });
    }
});

// Forgot Password: Verify Code Without Consuming It
router.post('/forgot-password/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });

        const user = await db('users').where('email', email).first();
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        
        if (user.verification_code !== code) return res.status(400).json({ error: 'Code invalide' });
        if (new Date(user.verification_code_expiry) < new Date()) return res.status(400).json({ error: 'Code expiré' });

        res.json({ success: true, verified: true });
    } catch (error) {
        console.error('[Auth] Verify reset code error:', error);
        res.status(500).json({ error: 'Erreur lors de la vérification' });
    }
});

// Forgot Password: Reset Password
router.post('/forgot-password/reset', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) return res.status(400).json({ error: 'Email, code and new password required' });

        const user = await db('users').where('email', email).first();
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        
        if (user.verification_code !== code) return res.status(400).json({ error: 'Code invalide' });
        if (new Date(user.verification_code_expiry) < new Date()) return res.status(400).json({ error: 'Code expiré' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await db('users').where('id', user.id).update({
            password: hashedPassword,
            verification_code: null,
            verification_code_expiry: null,
            is_initial_password: false // Ensure they don't get trapped in initial setup
        });

        await logAudit('user.reset_password', user.name, {
            targetId: user.id, targetName: user.email
        });

        res.json({ success: true, message: 'Mot de passe réinitialisé avec succès' });
    } catch (error) {
        console.error('[Auth] Password reset error:', error);
        res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
    }
});

// Set temporary password (Used only during initial account setup)
router.post('/set-password', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

        const user = await db('users').where('email', email).first();
        if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
        if (!user.email_verified) return res.status(403).json({ error: 'Email non vérifié' });
        
        // SECURITY FIX: Only allow this endpoint for users who are setting up their initial password
        if (!user.is_initial_password) {
            return res.status(403).json({ error: 'Opération non autorisée.' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db('users').where('id', user.id).update({
            password: hashedPassword,
            is_initial_password: false
        });

        await logAudit('user.set_password', user.name, {
            targetId: user.id, targetName: user.email
        });

        res.json({ success: true, message: 'Mot de passe mis à jour avec succès' });
    } catch (error) {
        console.error('[Auth] Set password error:', error);
        res.status(500).json({ error: 'Erreur lors de la mise à jour du mot de passe' });
    }
});

export default router;
