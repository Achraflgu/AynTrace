import { useState, useEffect, useCallback, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { geofencesApi, devicesApi } from '@/lib/api';
import { useAppStore, useAuthStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Hexagon, Plus, Trash2, X, Edit3, Eye, EyeOff, MapPin, Radio,
    Shield, RefreshCw, CircleDot, Pentagon, CheckCircle2, AlertTriangle,
    ChevronDown, ChevronUp, Layers, Satellite, Mountain, Map as MapIcon, Search
} from 'lucide-react';

const ZONE_COLORS = ['#039C51', '#FF6B6B', '#4ECDC4', '#FFE66D', '#A78BFA', '#F472B6', '#34D399', '#60A5FA', '#FBBF24', '#FB923C'];

const MAP_LAYERS = {
    dark: {
        name: 'Sombre',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    },
    street: {
        name: 'Standard',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
    satellite: {
        name: 'Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
    },
    terrain: {
        name: 'Terrain',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    },
};
type MapLayerType = keyof typeof MAP_LAYERS;

const GeofencesPage = () => {
    const { user } = useAuthStore();
    const { lang } = useI18n();

    // Admins always have full access. Operators need pro or enterprise plan.
    const isPro = user?.role === 'admin' || (user as any)?.plan === 'pro' || (user as any)?.plan === 'enterprise';

    const t = lang === 'fr' ? {
        title: 'Zones GPS (Geofences)',
        subtitle: 'Créez des zones et recevez des alertes quand vos appareils en sortent.',
        newZone: 'Nouvelle Zone',
        zoneName: 'Nom de la zone',
        zoneType: 'Type',
        circle: 'Cercle',
        polygon: 'Polygone',
        radius: 'Rayon (m)',
        color: 'Couleur',
        devices: 'Appareils',
        selectDevices: 'Sélectionner les appareils...',
        alertExit: 'Alerte sortie',
        alertEntry: 'Alerte entrée',
        drawOnMap: 'Dessinez sur la carte →',
        drawCircle: 'Cliquez sur la carte pour placer le centre du cercle',
        drawPolygon: 'Cliquez les points du polygone, puis fermez-le',
        save: 'Enregistrer',
        cancel: 'Annuler',
        delete: 'Supprimer',
        edit: 'Modifier',
        noZones: 'Aucune zone créée',
        noZonesDesc: 'Cliquez sur "+ Nouvelle Zone" pour commencer',
        checkDevices: 'Vérifier les appareils',
        active: 'Active',
        inactive: 'Inactive',
        zoneCount: 'zones',
        deviceCount: 'appareils assignés',
    } : {
        title: 'GPS Zones (Geofences)',
        subtitle: 'Create zones and get alerts when your devices leave them.',
        newZone: 'New Zone',
        zoneName: 'Zone name',
        zoneType: 'Type',
        circle: 'Circle',
        polygon: 'Polygon',
        radius: 'Radius (m)',
        color: 'Color',
        devices: 'Devices',
        selectDevices: 'Select devices...',
        alertExit: 'Exit alert',
        alertEntry: 'Entry alert',
        drawOnMap: 'Draw on the map →',
        drawCircle: 'Click on the map to place the circle center',
        drawPolygon: 'Click polygon points, then close the shape',
        drawCircleHint: 'Click map to place center',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        noZones: 'No zones created',
        noZonesDesc: 'Click "+ New Zone" to get started',
        checkDevices: 'Check devices',
        active: 'Active',
        inactive: 'Inactive',
        zoneCount: 'zones',
        deviceCount: 'assigned devices',
    };

    const geofences = useAppStore(s => s.geofences);
    const fetchGeofences = useAppStore(s => s.fetchGeofences);
    const [allDevices, setAllDevices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [expandedZone, setExpandedZone] = useState<string | null>(null);
    const [drawMode, setDrawMode] = useState<'idle' | 'circle' | 'polygon'>('idle');
    const [mapLayer, setMapLayer] = useState<MapLayerType>(() => {
        return (localStorage.getItem('ayntrace_map_type') as MapLayerType) || 'street';
    });
    const [showLayerMenu, setShowLayerMenu] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        type: 'circle' as 'circle' | 'polygon',
        color: ZONE_COLORS[0],
        center: null as { lat: number; lng: number } | null,
        radius: 500,
        polygon: [] as { lat: number; lng: number }[],
        devices: [] as string[],
        alertOnExit: true,
        alertOnEntry: false,
        isActive: true,
        enterpriseId: '',
    });

    const mapRef = useRef<L.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const zonesLayerRef = useRef<L.LayerGroup | null>(null);
    const drawLayerRef = useRef<L.LayerGroup | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const devicesLayerRef = useRef<L.LayerGroup | null>(null);
    const outOfZoneLinesLayerRef = useRef<L.LayerGroup | null>(null);
    const leafletLayersRef = useRef<Record<string, L.Layer>>({});
    const deviceMarkersRef = useRef<Record<string, L.Marker>>({});
    const autoFitDone = useRef(false);

    // Live devices from app store (same as /map page)
    const storeDevices = useAppStore(s => s.devices);
    const storeEnterprises = useAppStore(s => s.enterprises);

    // Filters state
    const [searchQuery, setSearchQuery] = useState('');
    const [enterpriseFilter, setFilterEnterprise] = useState('all');
    const [statusFilter, setFilterStatus] = useState('all');

    const filteredGeofences = geofences.filter(z => {
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const matchesName = z.name.toLowerCase().includes(query);
            const matchesDevice = z.devices?.some((dev: any) => dev.name?.toLowerCase().includes(query) || dev.serialNumber?.toLowerCase().includes(query));
            if (!matchesName && !matchesDevice) return false;
        }
        if (enterpriseFilter !== 'all' && z.enterpriseId !== enterpriseFilter) return false;
        if (statusFilter !== 'all') {
            const isActiveFilter = statusFilter === 'active';
            if (z.isActive !== isActiveFilter) return false;
        }
        return true;
    });

    const filteredStoreDevices = storeDevices.filter(d => {
        if (enterpriseFilter !== 'all' && d.enterpriseId !== enterpriseFilter) return false;
        return true;
    });

    const checkInside = useCallback((dev: any, zone: any) => {
        const liveDev = storeDevices.find((d: any) => d.id === dev._id || d.id === dev.id || d.imei === dev.imei);
        const lat = liveDev?.location?.lat || dev.location_lat;
        const lng = liveDev?.location?.lng || dev.location_lng;
        if (!lat || !lng || !zone) return false;

        if (zone.type === 'circle' && zone.center) {
            const R = 6371e3;
            const lat1 = zone.center.lat * Math.PI / 180;
            const lat2 = lat * Math.PI / 180;
            const dLat = (lat - zone.center.lat) * Math.PI / 180;
            const dLng = (lng - zone.center.lng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return (R * c) <= zone.radius;
        } else {
            let inside = false;
            const poly = zone.polygon || [];
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const xi = poly[i].lng, yi = poly[i].lat;
                const xj = poly[j].lng, yj = poly[j].lat;
                const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }
    }, [storeDevices]);

    const getDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number) => {
        const R = 6371e3; // meters
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaPhi = (lat2 - lat1) * Math.PI / 180;
        const deltaLambda = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }, []);

    const focusZone = useCallback((zone: any) => {
        if (!mapRef.current) return;

        const layer = leafletLayersRef.current[zone._id];
        const openPopup = () => {
            if (layer) {
                layer.openPopup();
            }
        };

        mapRef.current.once('moveend', openPopup);

        // Fly to zone bounds or center
        if (zone.type === 'circle' && zone.center) {
            mapRef.current.flyTo([zone.center.lat, zone.center.lng], 14);
        } else if (zone.polygon?.length) {
            const bounds = L.latLngBounds(zone.polygon.map((p: any) => [p.lat, p.lng]));
            mapRef.current.flyToBounds(bounds, { padding: [50, 50] });
        }
    }, []);

    const focusDevice = useCallback((deviceId: string) => {
        if (!mapRef.current) return;
        const liveDev = storeDevices.find((d: any) => d.id === deviceId || d._id === deviceId || d.imei === deviceId);
        const lat = liveDev?.location?.lat;
        const lng = liveDev?.location?.lng;
        if (!lat || !lng) return;

        const marker = deviceMarkersRef.current[deviceId];
        const openPopup = () => {
            if (marker) {
                marker.openPopup();
            }
        };

        mapRef.current.once('moveend', openPopup);
        mapRef.current.flyTo([lat, lng], 15);
    }, [storeDevices]);

    // ─── Fetch data ────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const user = useAuthStore.getState().user as any;
            const enterpriseId = user?.role !== 'admin' ? user?.enterpriseId : undefined;

            const [, devices] = await Promise.all([
                fetchGeofences(),
                devicesApi.getAll(),
            ]);

            // Only show devices from operator's enterprise
            const allowedDevices = enterpriseId
                ? devices.filter((d: any) => d.enterpriseId === enterpriseId)
                : devices;

            setAllDevices(allowedDevices);
        } catch (err: any) {
            toast.error('Error loading data', { description: err.message });
        } finally {
            setLoading(false);
        }
    }, [fetchGeofences]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Initialize map ────────────────────────────────────────────
    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) return;

        let resizeFrame = 0;
        let resizeObserver: ResizeObserver | null = null;
        let mapInitialized = false;

        const invalidateMapSize = () => {
            if (!mapRef.current) return;
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                mapRef.current?.invalidateSize();
            });
        };

        const initializeMap = () => {
            const container = mapContainerRef.current;
            if (!container || mapRef.current) return false;

            const { width, height } = container.getBoundingClientRect();
            if (width === 0 || height === 0) return false;

            const map = L.map(container, {
                center: [34.0, 9.5], // Tunisia center
                zoom: 7,
                zoomControl: false,
            });

            L.control.zoom({ position: 'bottomright' }).addTo(map);

            const layer = MAP_LAYERS[mapLayer];
            tileLayerRef.current = L.tileLayer(layer.url, {
                attribution: layer.attribution,
                maxZoom: 19,
            }).addTo(map);

            zonesLayerRef.current = L.layerGroup().addTo(map);
            drawLayerRef.current = L.layerGroup().addTo(map);
            devicesLayerRef.current = L.layerGroup().addTo(map);
            outOfZoneLinesLayerRef.current = L.layerGroup().addTo(map);

            mapRef.current = map;
            mapInitialized = true;

            requestAnimationFrame(() => {
                invalidateMapSize();
                requestAnimationFrame(invalidateMapSize);
            });

            return true;
        };

        if (!initializeMap()) {
            resizeObserver = new ResizeObserver(() => {
                if (initializeMap() && resizeObserver) {
                    resizeObserver.disconnect();
                    resizeObserver = null;
                }
                invalidateMapSize();
            });
            resizeObserver.observe(mapContainerRef.current);
        }

        const handleWindowResize = () => {
            invalidateMapSize();
        };
        window.addEventListener('resize', handleWindowResize);

        return () => {
            window.removeEventListener('resize', handleWindowResize);
            resizeObserver?.disconnect();
            cancelAnimationFrame(resizeFrame);
            if (mapInitialized && mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [mapLayer]);

    // ─── Switch tile layer ─────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !tileLayerRef.current) return;
        const layer = MAP_LAYERS[mapLayer];
        tileLayerRef.current.remove();
        tileLayerRef.current = L.tileLayer(layer.url, {
            attribution: layer.attribution,
            maxZoom: 19,
        }).addTo(mapRef.current);
    }, [mapLayer]);

    // ─── Render zones on map ───────────────────────────────────────
    useEffect(() => {
        if (!zonesLayerRef.current) return;
        zonesLayerRef.current.clearLayers();
        leafletLayersRef.current = {};

        const isInteractive = drawMode === 'idle';

        filteredGeofences.forEach((zone) => {
            if (!zone.isActive) return;

            let layer: L.Layer;

            if (zone.type === 'circle' && zone.center) {
                layer = L.circle([zone.center.lat, zone.center.lng], {
                    radius: zone.radius,
                    color: zone.color,
                    fillColor: zone.color,
                    fillOpacity: 0.15,
                    weight: 2,
                    interactive: isInteractive,
                });
            } else if (zone.type === 'polygon' && zone.polygon?.length >= 3) {
                layer = L.polygon(
                    zone.polygon.map((p: any) => [p.lat, p.lng]),
                    {
                        color: zone.color,
                        fillColor: zone.color,
                        fillOpacity: 0.15,
                        weight: 2,
                        interactive: isInteractive,
                    }
                );
            } else {
                return;
            }

            layer.addTo(zonesLayerRef.current!)
                .bindPopup(`<b>${zone.name}</b><br>${zone.devices?.length || 0} ${t.devices}`);

            leafletLayersRef.current[zone._id] = layer;
        });
    }, [filteredGeofences, drawMode]);

    // ─── Render device markers (like /map) ──────────────────────────
    useEffect(() => {
        if (!devicesLayerRef.current) return;
        devicesLayerRef.current.clearLayers();

        const statusColors: Record<string, string> = {
            online: '#22c55e', moving: '#10b981', idle: '#f59e0b',
            offline: '#6b7280', alert: '#ef4444',
        };

        // CSS for marker animations (inject once)
        if (!document.getElementById('geofence-marker-animations')) {
            const style = document.createElement('style');
            style.id = 'geofence-marker-animations';
            style.textContent = `
                @keyframes gf-ping { 75%, 100% { transform: scale(2); opacity: 0; } }
                @keyframes gf-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
            `;
            document.head.appendChild(style);
        }

        deviceMarkersRef.current = {};

        filteredStoreDevices.forEach(device => {
            if (!device.location) return;

            const color = statusColors[device.status] || '#6b7280';

            let assignedZoneColor: string | null = null;
            filteredGeofences.forEach(zone => {
                if (zone.isActive && zone.devices) {
                    const isAssigned = zone.devices.some((d: any) => {
                        const devId = typeof d === 'string' ? d : (d._id || d.id);
                        const storeDevId = (device as any)._id || device.id;
                        return devId === storeDevId;
                    });
                    if (isAssigned && !assignedZoneColor) {
                        assignedZoneColor = zone.color;
                    }
                }
            });

            const isMoving = device.status === 'moving';

            const icon = L.divIcon({
                className: 'custom-marker',
                html: `
                    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
                        ${assignedZoneColor
                        ? `<div style="position:absolute;width:22px;height:22px;border-radius:50%;border:3px solid ${assignedZoneColor};box-shadow:0 0 10px ${assignedZoneColor}, inset 0 0 5px ${assignedZoneColor}; opacity: 0.9;"></div>`
                        : `<div style="position:absolute;width:18px;height:18px;border-radius:50%;border:2.5px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.3);"></div>`}
                        <div style="width:12px;height:12px;background:${color};border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.8);
                            ${isMoving ? 'animation:gf-pulse 2s infinite;' : ''}"></div>
                        ${isMoving ? `<div style="position:absolute;width:28px;height:28px;background:${color};border-radius:50%;opacity:0.3;animation:gf-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''}
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });

            const statusLabel = device.status === 'moving' ? (lang === 'fr' ? 'En mouvement' : 'Moving') :
                device.status === 'online' ? (lang === 'fr' ? 'En ligne' : 'Online') :
                    device.status === 'idle' ? (lang === 'fr' ? 'Inactif' : 'Idle') :
                        device.status === 'offline' ? (lang === 'fr' ? 'Hors ligne' : 'Offline') :
                            (lang === 'fr' ? 'Alerte' : 'Alert');

            const lastUpdate = new Date(device.lastUpdate || new Date());
            const timeAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
            const lastUpdateText = timeAgo < 1 ? (lang === 'fr' ? "À l'instant" : "Just now") : timeAgo < 60 ? (lang === 'fr' ? `Il y a ${timeAgo} min` : `${timeAgo} min ago`) : (lang === 'fr' ? `Il y a ${Math.floor(timeAgo / 60)}h` : `${Math.floor(timeAgo / 60)}h ago`);

            const popup = `
                <div style="min-width:220px;font-family:Inter,sans-serif;">
                    <h3 style="margin:0 0 4px;font-weight:600;font-size:14px;">${device.name}</h3>
                    <p style="margin:0 0 8px;font-size:12px;color:#666;">${device.assignedTo || device.serialNumber} • ${device.enterpriseName || ''}</p>
                    <p style="margin:0 0 8px;font-size:12px;color:#888;">${device.location?.address || 'Localisation inconnue'}</p>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;margin-bottom:10px;">
                        <span style="color:${color};font-weight:500;">${statusLabel}</span>
                        <span>${device.speed || 0} km/h</span>
                        <span>🔋 ${device.battery || 0}%</span>
                        <span>📶 ${device.signal || 0}%</span>
                        <span style="color:#888;">🕐 ${lastUpdateText}</span>
                    </div>
                    <div style="display:flex;gap:8px;padding-top:8px;border-top:1px solid #333;">
                        <a href="/devices/${device.imei}" style="flex:1;text-align:center;padding:6px 12px;background:#3b82f6;color:white;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500;">${lang === 'fr' ? 'Détails' : 'Details'}</a>
                        <a href="/devices/${device.imei}?tab=historique" style="flex:1;text-align:center;padding:6px 12px;background:#1e293b;color:white;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500;">${lang === 'fr' ? 'Historique' : 'History'}</a>
                    </div>
                </div>
            `;

            const marker = L.marker([device.location.lat, device.location.lng], {
                icon,
                interactive: drawMode === 'idle',
            });
            marker.addTo(devicesLayerRef.current!)
                .bindPopup(popup);

            const devId = device.id;
            deviceMarkersRef.current[devId] = marker;
        });

        // Auto-fit bounds on first load ONLY
        if (filteredStoreDevices.length > 0 && mapRef.current && !autoFitDone.current) {
            const validDevices = filteredStoreDevices.filter(d => d.location?.lat && d.location?.lng);
            if (validDevices.length > 0) {
                const bounds = L.latLngBounds(validDevices.map(d => [d.location.lat, d.location.lng]));
                mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
                autoFitDone.current = true;
            }
        }
    }, [filteredStoreDevices, filteredGeofences, lang, drawMode]);

    // ─── Render Out of Zone Connection Lines ───────────────────────
    useEffect(() => {
        if (!outOfZoneLinesLayerRef.current || !mapRef.current) return;
        outOfZoneLinesLayerRef.current.clearLayers();

        if (drawMode !== 'idle') return;

        filteredGeofences.forEach((zone) => {
            if (!zone.isActive || !zone.devices || zone.devices.length === 0) return;

            zone.devices.forEach((dev: any) => {
                const liveDev = storeDevices.find((d: any) => d.id === dev._id || d.id === dev.id || d.imei === dev.imei);
                const devLat = liveDev?.location?.lat || dev.location_lat;
                const devLng = liveDev?.location?.lng || dev.location_lng;

                if (!devLat || !devLng) return;

                const isInside = checkInside(dev, zone);
                if (!isInside) {
                    let targetLat = zone.center?.lat;
                    let targetLng = zone.center?.lng;

                    if (zone.type === 'polygon' && zone.polygon?.length > 0) {
                        const lats = zone.polygon.map((p: any) => p.lat);
                        const lngs = zone.polygon.map((p: any) => p.lng);
                        targetLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
                        targetLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
                    }

                    if (targetLat && targetLng) {
                        const distanceMeters = getDistance(devLat, devLng, targetLat, targetLng);
                        let netDistance = distanceMeters;

                        if (zone.type === 'circle' && zone.radius) {
                            netDistance = Math.max(0, distanceMeters - zone.radius);
                        }

                        const distanceText = netDistance < 1000
                            ? `${Math.round(netDistance)} m`
                            : `${(netDistance / 1000).toFixed(2)} km`;

                        // Draw dashed line
                        const line = L.polyline([[devLat, devLng], [targetLat, targetLng]], {
                            color: zone.color || '#ef4444',
                            weight: 1.5,
                            dashArray: '6, 6',
                            interactive: true,
                        }).addTo(outOfZoneLinesLayerRef.current!);

                        line.bindTooltip(
                            `<b>${liveDev?.name || dev.name}</b> ${lang === 'fr' ? 'hors zone' : 'out of zone'} <b>${zone.name}</b> (${distanceText})`,
                            {
                                sticky: true,
                                direction: 'top',
                            }
                        );
                    }
                }
            });
        });
    }, [filteredGeofences, storeDevices, drawMode, checkInside, getDistance, lang]);

    // ─── Drawing mode ──────────────────────────────────────────────
    useEffect(() => {
        if (!mapRef.current || !drawLayerRef.current) return;
        const map = mapRef.current;
        drawLayerRef.current.clearLayers();

        if (drawMode === 'idle') {
            map.getContainer().style.cursor = '';
            return;
        }

        map.getContainer().style.cursor = 'crosshair';

        if (drawMode === 'circle') {
            const handler = (e: L.LeafletMouseEvent) => {
                const { lat, lng } = e.latlng;
                setForm(prev => ({ ...prev, center: { lat, lng } }));
                drawLayerRef.current!.clearLayers();
                L.circle([lat, lng], {
                    radius: form.radius,
                    color: form.color,
                    fillColor: form.color,
                    fillOpacity: 0.2,
                    weight: 2,
                    dashArray: '6 4',
                }).addTo(drawLayerRef.current!);
                setDrawMode('idle');
                map.getContainer().style.cursor = '';
            };
            map.once('click', handler);
            return () => { map.off('click', handler); };
        }

        if (drawMode === 'polygon') {
            const points: L.LatLng[] = [];
            let polyline: L.Polyline | null = null;
            let polygon: L.Polygon | null = null;

            const handler = (e: L.LeafletMouseEvent) => {
                points.push(e.latlng);

                drawLayerRef.current!.clearLayers();
                points.forEach(p => {
                    L.circleMarker(p, { radius: 5, color: form.color, fillColor: form.color, fillOpacity: 1 })
                        .addTo(drawLayerRef.current!);
                });

                if (points.length >= 2) {
                    polyline = L.polyline(points, { color: form.color, dashArray: '6 4' })
                        .addTo(drawLayerRef.current!);
                }

                if (points.length >= 3) {
                    // Double click to finish
                    polygon = L.polygon(points, {
                        color: form.color,
                        fillColor: form.color,
                        fillOpacity: 0.15,
                        weight: 2,
                        dashArray: '6 4',
                    });
                }
            };

            const finishHandler = () => {
                if (points.length >= 3) {
                    drawLayerRef.current!.clearLayers();
                    polygon?.addTo(drawLayerRef.current!);
                    setForm(prev => ({
                        ...prev,
                        polygon: points.map(p => ({ lat: p.lat, lng: p.lng })),
                    }));
                    map.off('click', handler);
                    setDrawMode('idle');
                    map.getContainer().style.cursor = '';
                }
            };

            map.on('click', handler);
            map.on('dblclick', finishHandler);
            return () => {
                map.off('click', handler);
                map.off('dblclick', finishHandler);
            };
        }
    }, [drawMode, form.radius, form.color]);

    // ─── Preview drawn shape when radius changes ───────────────────
    useEffect(() => {
        if (!drawLayerRef.current || !form.center) return;
        drawLayerRef.current.clearLayers();
        L.circle([form.center.lat, form.center.lng], {
            radius: form.radius,
            color: form.color,
            fillColor: form.color,
            fillOpacity: 0.2,
            weight: 2,
            dashArray: '6 4',
        }).addTo(drawLayerRef.current);
    }, [form.radius, form.color, form.center]);

    // ─── CRUD ──────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.name.trim()) { toast.error(lang === 'fr' ? 'Nom requis' : 'Name required'); return; }
        if (form.type === 'circle' && !form.center) { toast.error(lang === 'fr' ? 'Placez le centre sur la carte' : 'Place the center on the map'); return; }
        if (form.type === 'polygon' && form.polygon.length < 3) { toast.error(lang === 'fr' ? 'Dessinez au moins 3 points' : 'Draw at least 3 points'); return; }

        const payload: any = {
            name: form.name,
            type: form.type,
            color: form.color,
            devices: form.devices,
            alertOnExit: form.alertOnExit,
            alertOnEntry: form.alertOnEntry,
            isActive: isPro ? form.isActive : false,
            enterpriseId: form.enterpriseId || (useAuthStore.getState().user as any)?.enterpriseId || (allDevices[0] as any)?.enterpriseId,
            createdBy: (useAuthStore.getState().user as any)?.id,
        };
        if (form.type === 'circle') {
            payload.center = form.center;
            payload.radius = form.radius;
        } else {
            payload.polygon = form.polygon;
        }

        try {
            if (!isPro && form.isActive) {
                toast.info(lang === 'fr' ? 'La zone sera inactive (Nécessite le Plan Pro)' : 'Zone will be inactive (Pro Plan required)');
            }
            if (editingId) {
                await geofencesApi.update(editingId, payload);
                toast.success(lang === 'fr' ? 'Zone mise à jour' : 'Zone updated');
            } else {
                await geofencesApi.create(payload);
                toast.success(lang === 'fr' ? 'Zone créée' : 'Zone created');
            }
            resetForm();
            fetchData();
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(lang === 'fr' ? 'Supprimer cette zone ?' : 'Delete this zone?')) return;
        try {
            await geofencesApi.delete(id);
            toast.success(lang === 'fr' ? 'Zone supprimée' : 'Zone deleted');
            fetchData();
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        }
    };

    const handleEdit = (zone: any) => {
        setForm({
            name: zone.name,
            type: zone.type,
            color: zone.color,
            center: zone.center || null,
            radius: zone.radius || 500,
            polygon: zone.polygon || [],
            devices: zone.devices?.map((d: any) => d._id || d) || [],
            alertOnExit: zone.alertOnExit,
            alertOnEntry: zone.alertOnEntry,
            isActive: zone.isActive,
            enterpriseId: zone.enterpriseId,
        });
        setEditingId(zone._id);
        setShowForm(true);

        // Center map on zone
        if (zone.type === 'circle' && zone.center) {
            mapRef.current?.flyTo([zone.center.lat, zone.center.lng], 14);
        } else if (zone.polygon?.length) {
            const bounds = L.latLngBounds(zone.polygon.map((p: any) => [p.lat, p.lng]));
            mapRef.current?.flyToBounds(bounds, { padding: [50, 50] });
        }
    };

    const handleToggleActive = async (zone: any) => {
        if (!isPro && !zone.isActive) {
            toast.error(lang === 'fr' ? 'Plan Pro requis pour activer les alertes de zone' : 'Pro plan required to activate zone alerts');
            return;
        }
        try {
            await geofencesApi.update(zone._id, { isActive: !zone.isActive });
            fetchData();
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        }
    };

    const handleCheckDevices = async () => {
        try {
            const result = await geofencesApi.checkAll();
            toast.success(
                lang === 'fr'
                    ? `${result.checked} zones vérifiées, ${result.alertsCreated} alertes créées`
                    : `${result.checked} zones checked, ${result.alertsCreated} alerts created`
            );
        } catch (err: any) {
            toast.error('Error', { description: err.message });
        }
    };

    const resetForm = () => {
        setForm({
            name: '', type: 'circle', color: ZONE_COLORS[Math.floor(Math.random() * ZONE_COLORS.length)],
            center: null, radius: 500, polygon: [], devices: [], alertOnExit: true,
            alertOnEntry: false, isActive: isPro ? true : false, enterpriseId: '',
        });
        setShowForm(false);
        setEditingId(null);
        setDrawMode('idle');
        drawLayerRef.current?.clearLayers();
    };

    const toggleDevice = (deviceId: string) => {
        setForm(prev => ({
            ...prev,
            devices: prev.devices.includes(deviceId)
                ? prev.devices.filter(d => d !== deviceId)
                : [...prev.devices, deviceId],
        }));
    };

    const firstSelectedDevice = form.devices.length > 0
        ? allDevices.find(d => (d._id || d.id) === form.devices[0])
        : null;

    const displayDevices = (user?.role === 'admin' && firstSelectedDevice)
        ? allDevices.filter(d => d.enterpriseId === firstSelectedDevice.enterpriseId)
        : allDevices;

    const totalAssigned = filteredGeofences.reduce((sum, z) => sum + (z.devices?.length || 0), 0);

    return (
        <DashboardLayout>
            <div className="flex h-screen overflow-hidden">
                {/* ── Left Panel ──────────────────────────────────── */}
                <div className="w-[380px] shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-border space-y-3 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-lg font-bold flex items-center gap-2">
                                    <Hexagon className="w-5 h-5 text-[#039C51]" />
                                    {t.title}
                                </h1>
                                <p className="text-xs text-muted-foreground mt-0.5">{t.subtitle}</p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex gap-2">
                            <div className="flex-1 rounded-lg bg-muted/30 border border-border px-3 py-2">
                                <p className="text-xl font-bold">{filteredGeofences.length}</p>
                                <p className="text-[10px] text-muted-foreground">{t.zoneCount}</p>
                            </div>
                            <div className="flex-1 rounded-lg bg-muted/30 border border-border px-3 py-2">
                                <p className="text-xl font-bold text-[#039C51]">{totalAssigned}</p>
                                <p className="text-[10px] text-muted-foreground">{t.deviceCount}</p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            {user?.email !== 'demo@ayntrace.tn' && (
                                <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}
                                    className="flex-1 bg-[#039C51] text-white hover:bg-[#00D48A] gap-1">
                                    <Plus className="w-4 h-4" /> {t.newZone}
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={handleCheckDevices} className="gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> {t.checkDevices}
                            </Button>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                <Input
                                    placeholder={lang === 'fr' ? "Rechercher une zone ou appareil..." : "Search zone or device..."}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="h-8 pl-8 text-xs bg-muted/40 border-border/50"
                                />
                            </div>
                            <div className="flex gap-2">
                                {user?.role === 'admin' && (
                                    <select
                                        className="flex-1 h-8 px-2 rounded-md bg-muted/40 border border-border/50 text-xs text-foreground focus:ring-1 focus:ring-[#039C51]"
                                        value={enterpriseFilter}
                                        onChange={e => setFilterEnterprise(e.target.value)}
                                    >
                                        <option value="all">{lang === 'fr' ? 'Tous les opérateurs' : 'All operators'}</option>
                                        {storeEnterprises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                    </select>
                                )}
                                <select
                                    className="flex-1 h-8 px-2 rounded-md bg-muted/40 border border-border/50 text-xs text-foreground focus:ring-1 focus:ring-[#039C51]"
                                    value={statusFilter}
                                    onChange={e => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">{lang === 'fr' ? 'Tous les statuts' : 'All statuses'}</option>
                                    <option value="active">{lang === 'fr' ? 'Actives' : 'Active'}</option>
                                    <option value="inactive">{lang === 'fr' ? 'Inactives' : 'Inactive'}</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Zone List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredGeofences.length === 0 ? (
                            <div className="text-center py-12">
                                <Hexagon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                                <p className="text-sm font-medium text-muted-foreground">{t.noZones}</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">{t.noZonesDesc}</p>
                            </div>
                        ) : filteredGeofences.map(zone => {
                            let inZoneCount = 0;
                            const totalAssigned = zone.devices?.length || 0;

                            if (totalAssigned > 0) {
                                zone.devices.forEach((dev: any) => {
                                    if (checkInside(dev, zone)) inZoneCount++;
                                });
                            }

                            return (
                                <div key={zone._id}
                                    className="rounded-xl border border-border bg-card hover:border-[#039C51]/20 transition-all group">
                                    {/* Zone header */}
                                    <div className="px-3 py-2.5 flex items-center gap-2.5 cursor-pointer"
                                        onClick={() => {
                                            setExpandedZone(expandedZone === zone._id ? null : zone._id);
                                            focusZone(zone);
                                        }}>
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: zone.color }} />
                                        {/* Main Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <p className="text-[15px] font-bold text-foreground truncate">{zone.name}</p>
                                                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${zone.isActive
                                                    ? 'bg-[#039C51]/10 text-[#039C51] border border-[#039C51]/20'
                                                    : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                                    }`}>
                                                    {zone.isActive ? t.active : t.inactive}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium mb-3">
                                                <div className="flex items-center gap-1.5 bg-muted/50 dark:bg-black/20 px-2 py-0.5 rounded-md border border-border/50 dark:border-white/5">
                                                    {zone.type === 'circle' ? <CircleDot className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> : <Pentagon className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />}
                                                    {zone.type === 'circle' ? `${t.circle} · ${zone.radius}m` : `${t.polygon} · ${zone.polygon?.length || 0} pts`}
                                                </div>
                                            </div>

                                            {/* Creative Devices Live Progress (Compact) */}
                                            <div className="mt-2 bg-muted/30 dark:bg-black/10 rounded-md p-1.5 border border-border/50 dark:border-white/5">
                                                <div className="flex justify-between items-center mb-1">
                                                    <span className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                                        <Radio className={`w-3 h-3 ${inZoneCount > 0 ? 'text-[#039C51] animate-pulse' : 'text-muted-foreground/50'}`} />
                                                        {inZoneCount} / {totalAssigned} {lang === 'fr' ? 'en zone' : 'inside'}
                                                    </span>
                                                    {totalAssigned > 0 && (
                                                        <span className={`text-[9px] font-black ${inZoneCount > 0 ? 'text-[#039C51]' : 'text-muted-foreground/50'}`}>
                                                            {Math.round((inZoneCount / totalAssigned) * 100)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="w-full bg-muted dark:bg-black/30 rounded-full h-1 overflow-hidden">
                                                    {totalAssigned > 0 && (
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-700 ${inZoneCount === totalAssigned ? 'bg-[#039C51]' : inZoneCount > 0 ? 'bg-orange-500' : 'bg-transparent'}`}
                                                            style={{ width: `${(inZoneCount / totalAssigned) * 100}%` }}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {expandedZone === zone._id ? <ChevronUp className="w-5 h-5 text-muted-foreground ml-1" /> : <ChevronDown className="w-5 h-5 text-muted-foreground ml-1" />}
                                    </div>

                                    {/* Expanded details */}
                                    {expandedZone === zone._id && (
                                        <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2">
                                            {zone.devices?.length > 0 && (
                                                <div className="space-y-1.5 mb-3">
                                                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-border/30">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Appareils assignés</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${inZoneCount > 0 ? 'bg-[#039C51]/10 text-[#039C51]' : 'bg-muted/50 text-muted-foreground'}`}>
                                                                {inZoneCount} / {totalAssigned} en zone
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {zone.devices.map((dev: any) => {
                                                        const isInside = checkInside(dev, zone);
                                                        const status = (storeDevices.find(d => d.id === dev.id || d.id === dev._id || d.imei === dev.imei)?.status) || dev.status;
                                                        const devId = dev.id || dev._id;
                                                        return (
                                                            <div 
                                                                key={dev._id || dev.id} 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    focusDevice(devId);
                                                                }}
                                                                className={`flex justify-between items-center text-xs py-1.5 px-2.5 rounded-md border transition-all cursor-pointer hover:bg-[#039C51]/10 hover:border-[#039C51]/30 active:scale-[0.98] ${isInside ? 'bg-[#039C51]/5 border-[#039C51]/20' : 'bg-muted/20 dark:bg-muted/10 border-border/50 dark:border-border/20'}`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${status === 'online' || status === 'moving' ? 'bg-emerald-500 dark:bg-emerald-400 shadow-emerald-500/50' : 'bg-red-500 dark:bg-red-400'}`} />
                                                                    <span className={`font-medium ${isInside ? 'text-[#039C51]' : 'text-foreground'}`}>{dev.name}</span>
                                                                </div>
                                                                <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${isInside ? 'bg-[#039C51] text-white shadow-[0_0_8px_rgba(3,156,81,0.3)]' : 'bg-muted/50 text-muted-foreground/60 border border-border/50'}`}>
                                                                    {isInside ? (lang === 'fr' ? 'En zone' : 'Inside') : (lang === 'fr' ? 'Hors zone' : 'Outside')}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1.5 pt-1">
                                                {user?.email !== 'demo@ayntrace.tn' && (
                                                    <>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleEdit(zone)}>
                                                            <Edit3 className="w-3 h-3" /> {t.edit}
                                                        </Button>
                                                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => handleToggleActive(zone)}>
                                                            {zone.isActive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                            {zone.isActive ? t.inactive : t.active}
                                                        </Button>
                                                        {(user?.role === 'admin' || zone.enterpriseId === user?.enterpriseId) && (
                                                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-400 hover:text-red-300 ml-auto" onClick={() => handleDelete(zone._id)}>
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Right Panel: Map ────────────────────────────── */}
                <div className="map-container flex-1 relative overflow-hidden">
                    <div ref={mapContainerRef} className="absolute inset-0 z-0" />

                    {/* Map Layer Switcher */}
                    <div className="absolute top-3 right-3 z-[500]" onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                        <div className="relative">
                            <button
                                onClick={() => setShowLayerMenu(!showLayerMenu)}
                                className="flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg hover:bg-card transition-colors"
                            >
                                <Layers className="w-4 h-4" />
                                <span className="text-sm font-medium">{MAP_LAYERS[mapLayer].name}</span>
                            </button>

                            {showLayerMenu && (
                                <div className="absolute top-full right-0 mt-2 w-40 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden">
                                    {(Object.keys(MAP_LAYERS) as MapLayerType[]).map((type) => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                setMapLayer(type);
                                                localStorage.setItem('ayntrace_map_type', type);
                                                setShowLayerMenu(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/50 transition-colors ${mapLayer === type ? 'bg-primary/10 text-primary' : ''
                                                }`}
                                        >
                                            {type === 'satellite' && <Satellite className="w-4 h-4" />}
                                            {type === 'terrain' && <Mountain className="w-4 h-4" />}
                                            {type === 'street' && <MapIcon className="w-4 h-4" />}
                                            {type === 'dark' && <Layers className="w-4 h-4" />}
                                            <span>{MAP_LAYERS[type].name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Device count + live indicator */}
                    <div className="absolute bottom-4 left-4 z-[500] flex items-center gap-2">
                        <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{storeDevices.length}</span> {lang === 'fr' ? 'appareils' : 'devices'}
                                {geofences.length > 0 && <> · <span className="text-[#039C51] font-semibold">{geofences.length}</span> zones</>}
                            </p>
                        </div>
                        <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-sm font-medium">Live</span>
                        </div>
                    </div>

                    {/* Draw hint banner */}
                    {drawMode !== 'idle' && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-xl bg-[#039C51] text-white font-semibold text-sm shadow-lg flex items-center gap-2 animate-in fade-in"
                            onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                            <MapPin className="w-4 h-4" />
                            {drawMode === 'circle' ? t.drawCircle : t.drawPolygon}
                            <Button size="sm" variant="ghost" className="h-6 ml-2 text-white/60 hover:text-white" onClick={() => setDrawMode('idle')}>
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    {/* ── Create/Edit Form (Overlay) ──────────────── */}
                    {showForm && (
                        <div className="absolute bottom-4 left-4 z-[500] w-[360px] bg-card border border-border rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onDoubleClick={e => e.stopPropagation()}>
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h3 className="font-bold text-sm flex items-center gap-2">
                                    <Hexagon className="w-4 h-4 text-[#039C51]" />
                                    {editingId ? t.edit : t.newZone}
                                </h3>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetForm}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                                {/* Name */}
                                <div className="space-y-1">
                                    <label className="text-xs font-medium">{t.zoneName}</label>
                                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                        placeholder={lang === 'fr' ? 'Ex: Zone Tunis Centre' : 'Ex: Tunis Center Zone'}
                                        className="bg-background h-9 text-sm" />
                                </div>

                                {/* Color */}
                                <div className="space-y-1 w-full">
                                    <label className="text-xs font-medium">{t.color}</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {ZONE_COLORS.slice(0, 5).map(c => (
                                            <button key={c} onClick={() => setForm({ ...form, color: c, type: 'circle' })}
                                                className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm ${form.color === c ? 'border-foreground scale-110 shadow-md ring-2 ring-foreground/20' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>

                                {/* Draw button */}
                                <Button variant="outline" size="sm" className="w-full gap-2 border-dashed bg-secondary/30 hover:bg-secondary/50"
                                    onClick={() => { setForm({ ...form, type: 'circle' }); setDrawMode('circle'); }}>
                                    <MapPin className="w-4 h-4 text-[#039C51]" /> {t.drawOnMap}
                                </Button>

                                {/* Radius */}
                                <div className="space-y-1 bg-secondary/20 p-3 rounded-lg border border-border/50">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-muted-foreground">{t.radius}</label>
                                        <span className="text-xs font-bold text-foreground">{form.radius}m</span>
                                    </div>
                                    <input type="range" min={100} max={5000} step={100} value={form.radius}
                                        onChange={e => setForm({ ...form, radius: parseInt(e.target.value) })}
                                        className="w-full accent-[#039C51] h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer" />
                                </div>

                                {/* Status indicator */}
                                {form.center && (
                                    <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                                        <CheckCircle2 className="w-4 h-4" />
                                        {lang === 'fr' ? 'Centre placé avec succès' : 'Center placed successfully'} ({form.center.lat.toFixed(4)}, {form.center.lng.toFixed(4)})
                                    </div>
                                )}

                                {/* Alert toggles */}
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input type="checkbox" checked={form.alertOnExit}
                                            onChange={e => setForm({ ...form, alertOnExit: e.target.checked })}
                                            className="accent-[#039C51]" />
                                        {t.alertExit}
                                    </label>
                                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                                        <input type="checkbox" checked={form.alertOnEntry}
                                            onChange={e => setForm({ ...form, alertOnEntry: e.target.checked })}
                                            className="accent-[#039C51]" />
                                        {t.alertEntry}
                                    </label>
                                </div>

                                {/* Device selection */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">{t.devices}</label>
                                    <div className="max-h-[140px] overflow-y-auto rounded-lg border border-border divide-y divide-border">
                                        {displayDevices.map(dev => (
                                            <label key={dev._id || dev.id}
                                                className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/30 cursor-pointer transition-colors">
                                                <input type="checkbox"
                                                    checked={form.devices.includes(dev._id || dev.id)}
                                                    onChange={() => toggleDevice(dev._id || dev.id)}
                                                    className="accent-[#039C51]" />
                                                <div className={`w-2 h-2 rounded-full ${dev.status === 'online' || dev.status === 'moving' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                                <span className="text-xs flex-1 truncate">{dev.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{dev.imei?.slice(-6)}</span>
                                            </label>
                                        ))}
                                        {displayDevices.length === 0 && (
                                            <p className="text-xs text-muted-foreground p-3">{lang === 'fr' ? 'Aucun appareil' : 'No devices'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Form buttons */}
                            <div className="p-4 border-t border-border flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={resetForm}>{t.cancel}</Button>
                                <Button size="sm" className="flex-1 bg-[#039C51] text-white hover:bg-[#00D48A]" onClick={handleSave}>{t.save}</Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
};

export default GeofencesPage;
