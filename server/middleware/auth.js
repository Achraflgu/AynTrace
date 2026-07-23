import jwt from 'jsonwebtoken';
import db from '../db/knex.js';

const JWT_SECRET = process.env.JWT_SECRET || 'geotrack-secret-key-2024';

/**
 * verifyToken — Middleware that reads the JWT from Authorization header,
 * validates it, and injects req.user = { id, role, enterpriseId, email, name }
 * 
 * If the token is missing or invalid → 401 Unauthorized
 */
export function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Accès non autorisé — token manquant' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, role, enterpriseId, email, name }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

/**
 * requireRole — Middleware factory that checks if req.user.role
 * is in the list of allowed roles.
 * 
 * Usage: requireRole(['admin'])  or  requireRole(['admin', 'supervisor'])
 * 
 * If the role is not allowed → 403 Forbidden
 */
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Accès non autorisé' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès interdit — permissions insuffisantes' });
        }
        next();
    };
}

export { JWT_SECRET };
