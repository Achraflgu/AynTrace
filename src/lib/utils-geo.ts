import { LucideIcon, Car, Truck, Bike, Zap, User, Dog, Package } from "lucide-react";

// Standardized device types with icons and labels
export const DEVICE_TYPES = [
  { value: 'personnel', label: 'Personnel',  icon: User  },
  { value: 'voiture',   label: 'Voiture',    icon: Car   },
  { value: 'camion',    label: 'Camion',     icon: Truck },
  { value: 'moto',      label: 'Moto',       icon: Bike  },
  { value: 'mobilite',  label: 'Mobilité',   icon: Zap   },
  { value: 'animal',    label: 'Animal',     icon: Dog   },
  { value: 'objet',     label: 'Objet',      icon: Package },
] as const;

export const getDeviceIcon = (type: string): LucideIcon => {
  switch (type) {
    case 'personnel': return User;
    case 'voiture':   return Car;
    case 'camion':    return Truck;
    case 'moto':      return Bike;
    case 'mobilite':  return Zap;
    case 'animal':    return Dog;
    case 'objet':     return Package;
    default:          return Package;
  }
};

export const getDeviceTypeLabel = (type: string): string => {
  const found = DEVICE_TYPES.find(t => t.value === type);
  return found ? found.label : type;
};

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'online':
      return 'bg-success';
    case 'moving':
      return 'bg-primary';
    case 'idle':
      return 'bg-warning';
    case 'offline':
      return 'bg-muted';
    case 'alert':
      return 'bg-destructive';
    case 'stolen':
      return 'bg-destructive text-destructive-foreground ring-2 ring-destructive ring-offset-2';
    case 'lost':
      return 'bg-orange-500 text-white';
    case 'maintenance':
      return 'bg-purple-500 text-white';
    default:
      return 'bg-muted';
  }
};

export const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'online':
      return 'En ligne';
    case 'moving':
      return 'En mouvement';
    case 'idle':
      return 'À l\'arrêt';
    case 'offline':
      return 'Hors ligne';
    case 'alert':
      return 'Alerte';
    case 'stolen':
      return 'Volé';
    case 'lost':
      return 'Perdu';
    case 'maintenance':
      return 'En panne';
    default:
      return status;
  }
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatSpeed = (speed: number): string => {
  return `${speed} km/h`;
};

export const formatBattery = (battery: number): string => {
  return `${battery}%`;
};

export const getRoleName = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'Administrateur';
    case 'operator':
      return 'Opérateur';
    case 'supervisor':
      return 'Superviseur';
    default:
      return role;
  }
};

export const getRoleColor = (role: string): string => {
  switch (role) {
    case 'admin':
      return 'bg-destructive text-destructive-foreground';
    case 'operator':
      return 'bg-primary text-primary-foreground';
    case 'supervisor':
      return 'bg-warning text-warning-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export const calculateTotalDistance = (points: { lat: number; lng: number }[]): number => {
  if (points.length < 2) return 0;

  let totalDistance = 0;
  const R = 6371; // Earth's radius in km

  for (let i = 0; i < points.length - 1; i++) {
    const lat1 = points[i].lat;
    const lon1 = points[i].lng;
    const lat2 = points[i + 1].lat;
    const lon2 = points[i + 1].lng;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    totalDistance += d;
  }

  return totalDistance;
};

/**
 * Converts an enterprise name + imeiPrefix into a URL-friendly slug.
 * E.g. "Transport Tunis" + "35908" → "transport-tunis-35908"
 * The imeiPrefix ensures global uniqueness across enterprises.
 */
export const toEnterpriseSlug = (name: string, imeiPrefix?: string): string => {
  const namePart = name
    .toLowerCase()
    .normalize('NFD')                        // decompose accented chars
    .replace(/[\u0300-\u036f]/g, '')         // strip diacritics
    .replace(/[^a-z0-9\s-]/g, '')           // keep alphanumeric, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-')                   // spaces → hyphens
    .replace(/-+/g, '-');                   // collapse duplicate hyphens

  const prefix = imeiPrefix || '';
  return prefix ? `${namePart}-${prefix}` : namePart;
};

/**
 * Finds an enterprise by its slug from a list of enterprises.
 * Supports both slug-based lookup and UUID fallback (for backward compatibility).
 */
export const findEnterpriseBySlug = <T extends { id: string; name: string; imeiPrefix?: string }>(
  enterprises: T[],
  slug: string
): T | undefined => {
  // First try slug match
  const bySlug = enterprises.find(e => toEnterpriseSlug(e.name, e.imeiPrefix) === slug);
  if (bySlug) return bySlug;
  // Fallback: direct UUID match (backward compat with old bookmarks)
  return enterprises.find(e => e.id === slug);
};
