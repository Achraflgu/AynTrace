// TypeScript type definitions for AynTrace

export interface Enterprise {
    id: string;
    name: string;
    contactEmail: string;
    phone: string;
    address: string;
    createdAt: string;
    deviceCount?: number;
    status: 'active' | 'suspended' | 'pending';
    serialPrefix?: string;
    imeiPrefix?: string;
    subscriberPrefix?: string;
}

export interface Device {
    id: string;
    imei: string;
    name: string;
    deviceType: 'personnel' | 'voiture' | 'camion' | 'moto' | 'mobilite' | 'animal' | 'objet';
    serialNumber: string;
    subscriberNumber?: string;
    plateId?: string;
    assignedTo?: string;
    enterpriseId: string;
    enterpriseName: string;
    status: 'online' | 'offline' | 'moving' | 'idle' | 'alert' | 'stolen' | 'lost' | 'maintenance';
    lastUpdate: string;
    location: {
        lat: number;
        lng: number;
        address: string;
    };
    speed: number;
    heading: number;
    battery: number;
    signal: number;
    dataSource?: 'fake' | 'real';
    trackingToken?: string;
    altitude?: number;
    temperature?: number;
    hdop?: number;
    gpsValidMode?: 'A' | 'V';
    ignition?: boolean;
    odometer?: number;
    fuelLevel?: number;
    fuelType?: string;
    brand?: string;
}

export interface LocationHistory {
    timestamp: string;
    lat: number;
    lng: number;
    speed: number;
    address: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'supervisor' | 'operator';
    plan?: string;
    enterpriseId?: string;
    enterpriseName?: string;
    emailAlertPrefs?: any;
    avatar?: string;
    emailVerified?: boolean;
    isInitialPassword?: boolean;
    createdAt?: string;
    lastLogin?: string;
}

export interface Alert {
    id: string;
    type: 'battery' | 'offline' | 'geofence' | 'speed' | 'sos';
    deviceId: string;
    deviceName: string;
    message: string;
    timestamp: string;
    read: boolean;
    severity: 'low' | 'medium' | 'high';
}

export interface AuditLog {
    id: string;
    action: string;
    userId?: string;
    userName: string;
    targetType?: string;
    targetId?: string;
    targetName?: string;
    timestamp: string;
    ip: string;
    details?: any;
}

export interface SupportTicket {
    id: string;
    userId: string;
    userName: string;
    enterpriseId?: string;
    subject: string;
    status: 'open' | 'closed';
    lastMessage?: string;
    lastMessageAt: string;
    createdAt: string;
    updatedAt: string;
}

export interface SupportMessage {
    id: string;
    ticketId: string;
    senderId: string;
    senderName: string;
    senderRole: string;
    message: string;
    createdAt: string;
}
