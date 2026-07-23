// API Service Layer - Connect frontend to PostgreSQL backend
import { useAuthStore, useAppStore } from './store';
import { toast } from 'sonner';

const API_BASE = '/api';

// Generic fetch wrapper with error handling
export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options?.method || 'GET');

    // --- DEMO MODE RESTRICTION ---
    // If the authenticated user is the demo user, block all mutations
    // Exception: Allow them to simulate logging in, which we intercept in store.ts anyway, 
    // but we need to let the fetchApi proceed if it's the custom bypass (though bypass doesn't call fetchApi).
    // We just block everything else.
    if (isMutation) {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            toast.error('Action non autorisée en mode démo', {
                description: 'Vous naviguez en mode lecture seule.'
            });
            throw new Error('DEMO_MODE_ERROR'); // Prevent the fetch from happening
        }
    }
    // -----------------------------
    // Inject JWT token from auth store
    const authState = useAuthStore.getState();
    const authHeaders: Record<string, string> = {};
    if (authState.token) {
        authHeaders['Authorization'] = `Bearer ${authState.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...authHeaders,
            ...options?.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || 'API request failed');
    }

    return response.json();
}

// Devices API
export const devicesApi = {
    getAll: (enterpriseId?: string, status?: string) => {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            return Promise.resolve(useAppStore.getState().devices);
        }
        
        let targetEnterpriseId = enterpriseId;
        if (!targetEnterpriseId && state.user?.role !== 'admin' && state.user?.enterpriseId) {
            targetEnterpriseId = state.user.enterpriseId;
        }

        const query = new URLSearchParams();
        if (targetEnterpriseId) query.append('enterpriseId', targetEnterpriseId);
        if (status && status !== 'all') query.append('status', status);
        
        const qs = query.toString();
        return fetchApi<any[]>(`/devices${qs ? `?${qs}` : ''}`);
    },
    getById: (id: string) => fetchApi<any>(`/devices/${id}`),
    create: (device: any) => fetchApi<any>('/devices', {
        method: 'POST',
        body: JSON.stringify(device),
    }),
    update: (id: string, updates: any) => fetchApi<any>(`/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    }),
    delete: (id: string) => fetchApi<void>(`/devices/${id}`, { method: 'DELETE' }),
    getHistory: (id: string, start?: string, end?: string) => {
        const params = new URLSearchParams();
        if (start) params.set('start', start);
        if (end) params.set('end', end);
        return fetchApi<any[]>(`/devices/${id}/history?${params}`);
    },
};

// Enterprises API
export const enterprisesApi = {
    getAll: () => {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            return Promise.resolve([{
                _id: 'demo-enterprise',
                name: 'Demo Transport',
                contactEmail: 'contact@demotransport.tn',
                phone: '+216 20 000 000',
                address: 'Tunis, Tunisie',
                createdAt: new Date().toISOString()
            }]);
        }
        return fetchApi<any[]>('/enterprises');
    },
    getById: (id: string) => fetchApi<any>(`/enterprises/${id}`),
    create: (enterprise: any) => fetchApi<any>('/enterprises', {
        method: 'POST',
        body: JSON.stringify(enterprise),
    }),
    getNextIds: (id: string) => fetchApi<{ serialNumber: string; imei: string; subscriberNumber: string }>(`/enterprises/${id}/next-ids`),
    update: (id: string, updates: any) => fetchApi<any>(`/enterprises/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    }),
    delete: (id: string) => fetchApi<void>(`/enterprises/${id}`, { method: 'DELETE' }),
};

// Users API
export const usersApi = {
    getAll: () => {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            return Promise.resolve([state.user]);
        }
        return fetchApi<any[]>('/users');
    },
    getById: (id: string) => fetchApi<any>(`/users/${id}`),
    create: (user: any) => fetchApi<any>('/users', {
        method: 'POST',
        body: JSON.stringify(user),
    }),
    update: (id: string, updates: any) => fetchApi<any>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
    }),
    updatePrefs: (emailAlertPrefs: any) => fetchApi<any>('/users/me/prefs', {
        method: 'PUT',
        body: JSON.stringify({ emailAlertPrefs }),
    }),
    delete: (id: string) => fetchApi<void>(`/users/${id}`, { method: 'DELETE' }),
    // Email verification
    sendVerification: (email: string) => fetchApi<any>('/users/send-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
    }),
    verifyEmail: (email: string, code: string) => fetchApi<any>('/users/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
    }),
};

// Stats API
export const statsApi = {
    getDashboardStats: (enterpriseId?: string) => {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            return Promise.resolve({
                stats: {
                    total: 2,
                    online: 1,
                    moving: 0,
                    offline: 1,
                    alerts: 0
                }
            });
        }
        const params = enterpriseId ? `?enterpriseId=${enterpriseId}` : '';
        return fetchApi<any>(`/stats${params}`);
    },
    getPublic: () => fetchApi<any>('/stats/public'),
};

// Alerts API
export const alertsApi = {
    getAll: (enterpriseId?: string, userId?: string) => {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            return Promise.resolve([]);
        }
        
        let targetEnterpriseId = enterpriseId;
        if (!targetEnterpriseId && state.user?.role !== 'admin' && state.user?.enterpriseId) {
            targetEnterpriseId = state.user.enterpriseId;
        }

        const query = new URLSearchParams();
        if (targetEnterpriseId) query.append('enterpriseId', targetEnterpriseId);
        if (userId) query.append('userId', userId);
        const params = query.toString() ? `?${query.toString()}` : '';
        return fetchApi<any[]>(`/alerts${params}`);
    },
    create: (alert: any) => fetchApi<any>('/alerts', {
        method: 'POST',
        body: JSON.stringify(alert),
    }),
    markRead: (id: string, userId: string) => fetchApi<any>(`/alerts/${id}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ userId }),
    }),
    markAllRead: (enterpriseId?: string, userId?: string) => fetchApi<any>('/alerts/read-all', {
        method: 'PATCH',
        body: JSON.stringify({ enterpriseId, userId }),
    }),
    delete: (id: string) => fetchApi<void>(`/alerts/${id}`, { method: 'DELETE' }),
};

// Audit Logs API
export const auditApi = {
    getAll: (action?: string) => {
        const query = new URLSearchParams();
        if (action && action !== 'all') query.append('action', action);
        query.append('limit', '0'); // Unlimited
        const qs = query.toString();
        return fetchApi<any[]>(`/audit?${qs}`);
    },
    create: (log: any) => fetchApi<any>('/audit', {
        method: 'POST',
        body: JSON.stringify(log),
    }),
};

// Auth API
export const authApi = {
    login: (credentials: any) => fetchApi<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
    }),
    setPassword: (data: any) => fetchApi<any>('/auth/set-password', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    forgotPassword: (data: { email: string }) => fetchApi<any>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    verifyResetCode: (data: { email: string, code: string }) => fetchApi<any>('/auth/forgot-password/verify-code', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    resetPassword: (data: { email: string; code: string; newPassword: string }) => fetchApi<any>('/auth/forgot-password/reset', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
};

// Support API
export const supportApi = {
    getTickets: (userId?: string, role?: string, enterpriseId?: string) => {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            return Promise.resolve([]);
        }
        const query = new URLSearchParams();
        if (userId) query.append('userId', userId);
        if (role) query.append('role', role);
        if (enterpriseId) query.append('enterpriseId', enterpriseId);
        return fetchApi<any[]>(`/support/tickets?${query.toString()}`);
    },
    createTicket: (ticket: any) => fetchApi<any>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify(ticket),
    }),
    getMessages: (ticketId: string) => fetchApi<any[]>(`/support/tickets/${ticketId}/messages`),
    sendMessage: (ticketId: string, message: any) => fetchApi<any>(`/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: JSON.stringify(message),
    }),
    updateStatus: (ticketId: string, status: string, adminName: string) => fetchApi<any>(`/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminName }),
    }),
};

// WebSocket connection for real-time updates
export function createWebSocket(
    onUpdate: (devices: any[]) => void,
    onAlert: (alert: any) => void,
    onSupportMessage: (message: any) => void,
    onTicketUpdate: (ticket: any) => void,
    identifyData: { enterpriseId?: string; role: string; userId?: string },
    shouldReconnect: () => boolean = () => true,
    onConnect?: (ws: WebSocket) => void,
    onEntityChange?: (change: { entity: string; action: string; item: any; id: string; message: string }) => void
): WebSocket | null {
    try {
        const state = useAuthStore.getState();
        if (state.user?.email === 'demo@ayntrace.tn') {
            console.log('[WebSocket] Simulated connection for demo mode');
            return {
                close: () => console.log('[WebSocket] Simulated disconnect'),
                send: () => { },
            } as unknown as WebSocket;
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${wsProtocol}://${window.location.host}/ws`);

        ws.onopen = () => {
            console.log('[WebSocket] Connected');
            // Identify self to the server for role-based updates
            ws.send(JSON.stringify({
                type: 'identify',
                data: identifyData
            }));
            if (onConnect) {
                onConnect(ws);
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'devices-update') {
                    onUpdate(message.data);
                } else if (message.type === 'alert-new') {
                    onAlert(message.data);
                } else if (message.type === 'support_message') {
                    onSupportMessage(message.data);
                } else if (message.type === 'support_ticket_update') {
                    onTicketUpdate(message.data);
                } else if (message.type === 'entity-change' && onEntityChange) {
                    onEntityChange(message.data);
                }
            } catch (e) {
                console.error('[WebSocket] Parse error:', e);
            }
        };

        ws.onerror = (error) => {
            console.error('[WebSocket] Error:', error);
        };

        ws.onclose = () => {
            console.log('[WebSocket] Disconnected');
            // Attempt to reconnect after 5 seconds if still allowed
            if (shouldReconnect()) {
                console.log('[WebSocket] Reconnecting in 5s...');
                setTimeout(() => {
                    if (shouldReconnect()) {
                        createWebSocket(onUpdate, onAlert, onSupportMessage, onTicketUpdate, identifyData, shouldReconnect, onConnect, onEntityChange);
                    } else {
                        console.log('[WebSocket] Reconnection cancelled (user state changed)');
                    }
                }, 5000);
            } else {
                console.log('[WebSocket] Reconnection disabled (likely logged out)');
            }
        };

        return ws;
    } catch (error) {
        console.error('[WebSocket] Failed to connect:', error);
        return null;
    }
}

// Orders API
export const ordersApi = {
    getAll: (params?: { status?: string; source?: string; search?: string; email?: string; enterpriseId?: string }) => {
        const query = new URLSearchParams();
        if (params?.status) query.set('status', params.status);
        if (params?.source) query.set('source', params.source);
        if (params?.search) query.set('search', params.search);
        if (params?.email) query.set('email', params.email);
        if (params?.enterpriseId) query.set('enterpriseId', params.enterpriseId);
        const qs = query.toString();
        return fetchApi<any[]>(`/orders${qs ? `?${qs}` : ''}`);
    },
    // Operator-safe: fetch the logged-in user's own orders (no admin role required)
    getMyOrders: (source?: string) => {
        const query = new URLSearchParams();
        if (source) query.set('source', source);
        const qs = query.toString();
        return fetchApi<any[]>(`/orders/my-orders${qs ? `?${qs}` : ''}`);
    },
    getStats: () => fetchApi<any>('/orders/stats'),
    create: (data: any) => fetchApi<any>('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    updateStatus: (id: string, data: { status?: string; adminNotes?: string }) =>
        fetchApi<any>(`/orders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        }),
    delete: (id: string) => fetchApi<any>(`/orders/${id}`, { method: 'DELETE' }),
    process: (id: string, payload?: any) => fetchApi<any>(`/orders/${id}/process`, { method: 'POST', ...(payload && { body: JSON.stringify(payload) }) }),
    track: (ref: string) => fetchApi<any>(`/orders/track/${ref}`),
};

// Geofences API
export const geofencesApi = {
    getAll: (enterpriseId?: string) => {
        const state = useAuthStore.getState();
        let targetEnterpriseId = enterpriseId;
        if (!targetEnterpriseId && state.user?.role !== 'admin' && state.user?.enterpriseId) {
            targetEnterpriseId = state.user.enterpriseId;
        }

        const query = new URLSearchParams();
        if (targetEnterpriseId) query.append('enterpriseId', targetEnterpriseId);
        // NOTE: Do NOT pass userId — operators should see all zones in their enterprise,
        // including admin-created ones scoped to their enterprise.
        const qs = query.toString();
        return fetchApi<any[]>(`/geofences${qs ? `?${qs}` : ''}`);
    },
    getOne: (id: string) => fetchApi<any>(`/geofences/${id}`),
    create: (data: any) => fetchApi<any>('/geofences', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id: string, data: any) => fetchApi<any>(`/geofences/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id: string) => fetchApi<void>(`/geofences/${id}`, { method: 'DELETE' }),
    checkAll: (enterpriseId?: string) => {
        const state = useAuthStore.getState();
        const targetEnterpriseId = enterpriseId ||
            (state.user?.role !== 'admin' ? state.user?.enterpriseId : undefined);
        return fetchApi<any>('/geofences/check', {
            method: 'POST',
            body: JSON.stringify({ enterpriseId: targetEnterpriseId }),
        });
    },
};

// Dashboard AI Chat API
export const dashboardChatApi = {
    send: (message: string, sessionId: string | null, user: any, language?: string) =>
        fetchApi<{ reply: string; sessionId: string }>('/dashboard-chat', {
            method: 'POST',
            body: JSON.stringify({ message, sessionId, user, language }),
        }),
};

// Billing API
export const billingApi = {
    getPrices: () => fetchApi<any>('/billing/prices'),
    getPayments: (userId: string) => fetchApi<any[]>(`/billing/payments?userId=${userId}`),
    getCurrentPlan: (userId: string) => fetchApi<any>(`/billing/plan/${userId}`),
    requestUpgrade: (data: { userId: string; targetPlan: string; billingCycle: string; method: string }) =>
        fetchApi<any>('/billing/upgrade', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updatePaymentStatus: (id: string, status: string) =>
        fetchApi<any>(`/billing/payments/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status }),
        }),
    cancelPlan: (userId: string) =>
        fetchApi<any>('/billing/cancel-plan', {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),
    resumePlan: (userId: string) =>
        fetchApi<any>('/billing/resume-plan', {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),
    removeMethod: (userId: string) =>
        fetchApi<any>('/billing/remove-method', {
            method: 'POST',
            body: JSON.stringify({ userId }),
        }),
    // Admin endpoints
    checkDue: () => fetchApi<any>('/billing/check-due'),
    adminPay: (data: { userId: string; amount?: number; dueMode?: string; dueValue?: number; method?: string; adminName?: string }) =>
        fetchApi<any>('/billing/admin-pay', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    adminChangePlan: (data: { userId: string; plan: string; billingCycle?: string; adminName?: string }) =>
        fetchApi<any>('/billing/admin-change-plan', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    adminUnblock: (data: { userId: string; graceDays?: number; adminName?: string; preserveDue?: boolean }) =>
        fetchApi<any>('/billing/admin-unblock', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    adminBlock: (data: { userId: string; adminName?: string; reason: 'payment' | 'personal' }) =>
        fetchApi<any>('/billing/admin-block', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
};

// Notification Rules API
export const notificationRulesApi = {
    getAll: (enterpriseId?: string) => {
        const query = new URLSearchParams();
        if (enterpriseId) query.append('enterpriseId', enterpriseId);
        const qs = query.toString();
        return fetchApi<any[]>(`/notification-rules${qs ? `?${qs}` : ''}`);
    },
    create: (data: any) => fetchApi<any>('/notification-rules', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id: string, data: any) => fetchApi<any>(`/notification-rules/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id: string) => fetchApi<void>(`/notification-rules/${id}`, { method: 'DELETE' }),
};

// Pricing Config API
export const pricingApi = {
    getAll: () => fetchApi<{ config: Record<string, number>; rows: any[] }>('/pricing'),
    update: (updates: { key: string; value: number }[]) =>
        fetchApi<{ success: boolean; config: Record<string, number>; rows: any[] }>('/pricing', {
            method: 'PUT',
            body: JSON.stringify({ updates }),
        }),
};
