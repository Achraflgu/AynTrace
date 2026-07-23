type Role = 'admin' | 'supervisor' | 'operator';

/**
 * Permission helpers for role-based access control.
 */

// Check if user can edit devices (admin and operators)
export const canEditDevices = (role: Role | undefined): boolean => {
    return role === 'admin' || role === 'operator';
};

// Check if user can delete devices (admin only)
export const canDeleteDevices = (role: Role | undefined): boolean => {
    return role === 'admin';
};

// Check if user can edit enterprises (admin only)
export const canEditEnterprises = (role: Role | undefined): boolean => {
    return role === 'admin';
};

// Check if user can delete enterprises (admin only)
export const canDeleteEnterprises = (role: Role | undefined): boolean => {
    return role === 'admin';
};

// Check if user can manage users (admin only)
export const canManageUsers = (role: Role | undefined): boolean => {
    return role === 'admin';
};

// Check if user is supervisor (read-only)
export const isSupervisor = (role: Role | undefined): boolean => {
    return role === 'supervisor';
};

// Check if user can view all enterprises (admin and supervisor)
export const canViewAllEnterprises = (role: Role | undefined): boolean => {
    return role === 'admin' || role === 'supervisor';
};

// Check if user can create devices (admin only)
export const canCreateDevices = (role: Role | undefined): boolean => {
    return role === 'admin';
};

// Check if user can create enterprises (admin only)
export const canCreateEnterprises = (role: Role | undefined): boolean => {
    return role === 'admin';
};

// Get role display name
export const getRoleDisplayName = (role: Role | undefined): string => {
    switch (role) {
        case 'admin':
            return 'Administrateur';
        case 'supervisor':
            return 'Superviseur';
        case 'operator':
            return 'Opérateur';
        default:
            return 'Inconnu';
    }
};

// Get role badge color
export const getRoleBadgeColor = (role: Role | undefined): string => {
    switch (role) {
        case 'admin':
            return 'bg-primary';
        case 'supervisor':
            return 'bg-warning';
        case 'operator':
            return 'bg-success';
        default:
            return 'bg-muted';
    }
};
