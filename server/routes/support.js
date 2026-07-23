import express from 'express';
import db from '../db/knex.js';
import { logAudit } from '../utils/auditLogger.js';
import { broadcast, broadcastSupportMessage } from '../simulation/engine.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Format ticket for frontend (snake_case → camelCase)
function formatTicket(t) {
    return {
        _id: t.id, id: t.id,
        userId: t.user_id,
        userName: t.user_name,
        enterpriseId: t.enterprise_id,
        subject: t.subject,
        status: t.status,
        lastMessage: t.last_message,
        lastMessageAt: t.last_message_at,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
    };
}

// Format message for frontend
function formatMessage(m) {
    return {
        _id: m.id, id: m.id,
        ticketId: m.ticket_id,
        senderId: m.sender_id,
        senderName: m.sender_name,
        senderRole: m.sender_role,
        message: m.message,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
    };
}

// GET all tickets (admin gets all, operator gets own)
router.get('/tickets', verifyToken, async (req, res) => {
    try {
        const { userId, role, enterpriseId } = req.query;
        let query = db('support_tickets');
        if (role === 'operator' || role === 'supervisor') {
            query = query.where('user_id', userId);
        }
        const tickets = await query.orderBy('updated_at', 'desc');
        res.json(tickets.map(formatTicket));
    } catch (error) {
        console.error('[Support] Error fetching tickets:', error);
        res.status(500).json({ error: 'Failed to fetch tickets' });
    }
});

// POST create ticket
router.post('/tickets', verifyToken, async (req, res) => {
    try {
        const { userId, userName, enterpriseId, subject, message } = req.body;

        const [ticket] = await db('support_tickets').insert({
            user_id: userId,
            user_name: userName,
            enterprise_id: enterpriseId || null,
            subject,
            last_message: message,
            last_message_at: new Date(),
        }).returning('*');

        await db('support_messages').insert({
            ticket_id: ticket.id,
            sender_id: userId,
            sender_name: userName,
            sender_role: 'user',
            message,
        });

        await logAudit('support.ticket_created', userName, {
            ticketId: ticket.id, subject
        });

        const formatted = formatTicket(ticket);
        // Notify admins of new ticket
        broadcastSupportMessage('support_ticket_update', formatted, userId, enterpriseId);

        res.status(201).json(formatted);
    } catch (error) {
        console.error('[Support] Error creating ticket:', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

// GET messages for a ticket
router.get('/tickets/:id/messages', verifyToken, async (req, res) => {
    try {
        const messages = await db('support_messages')
            .where('ticket_id', req.params.id)
            .orderBy('created_at', 'asc');
        res.json(messages.map(formatMessage));
    } catch (error) {
        console.error('[Support] Error fetching messages:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// POST send a message
router.post('/tickets/:id/messages', verifyToken, async (req, res) => {
    try {
        const { senderId, senderName, senderRole, message } = req.body;
        const ticketId = req.params.id;

        // Get ticket to know owner's userId and enterpriseId for targeting
        const ticket = await db('support_tickets').where('id', ticketId).first();
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        // Save message
        const [newMessage] = await db('support_messages').insert({
            ticket_id: ticketId,
            sender_id: senderId,
            sender_name: senderName,
            sender_role: senderRole,
            message,
        }).returning('*');

        // Update ticket's last_message so list updates
        await db('support_tickets').where('id', ticketId).update({
            last_message: message,
            last_message_at: new Date(),
            updated_at: new Date(),
        });

        const formatted = formatMessage(newMessage);

        // Broadcast to ticket owner + all admins/supervisors
        broadcastSupportMessage(
            'support_message',
            formatted,
            ticket.user_id,         // ticket owner's userId
            ticket.enterprise_id    // ticket owner's enterpriseId (fallback)
        );

        // Also send ticket update so sidebar refreshes last message
        const updatedTicket = await db('support_tickets').where('id', ticketId).first();
        broadcastSupportMessage(
            'support_ticket_update',
            formatTicket(updatedTicket),
            ticket.user_id,
            ticket.enterprise_id
        );

        console.log(`[Support] Message sent | ticket=${ticketId} | from=${senderName}(${senderRole}) | to owner=${ticket.user_name}`);

        res.status(201).json(formatted);
    } catch (error) {
        console.error('[Support] Error sending message:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// PATCH close/update ticket status
router.patch('/tickets/:id/status', verifyToken, requireRole(['admin']), async (req, res) => {
    try {
        const { status, adminName } = req.body;
        const [ticket] = await db('support_tickets')
            .where('id', req.params.id)
            .update({ status, updated_at: new Date() })
            .returning('*');

        await logAudit('support.ticket_updated', adminName, {
            ticketId: ticket.id, status
        });

        const formatted = formatTicket(ticket);
        // Targeted broadcast: ticket owner + admins
        broadcastSupportMessage('support_ticket_update', formatted, ticket.user_id, ticket.enterprise_id);
        res.json(formatted);
    } catch (error) {
        console.error('[Support] Error updating ticket status:', error);
        res.status(500).json({ error: 'Failed to update ticket status' });
    }
});

export default router;
