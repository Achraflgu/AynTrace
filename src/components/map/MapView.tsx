import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Device } from '@/lib/types';
import { getStatusColor } from '@/lib/utils-geo';
import { Map as MapIcon, Layers, Satellite, Mountain } from 'lucide-react';

// Map tile layer configurations
const MAP_LAYERS = {
  dark: {
    name: 'Sombre',
    icon: 'moon',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  street: {
    name: 'Standard',
    icon: 'map',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  satellite: {
    name: 'Satellite',
    icon: 'satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>',
  },
  terrain: {
    name: 'Terrain',
    icon: 'mountain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
  },
};

type MapLayerType = keyof typeof MAP_LAYERS;

interface MapViewProps {
  devices: Device[];
  selectedDevice?: Device | null;
  onDeviceSelect?: (device: Device) => void;
  className?: string;
  focusEnterpriseId?: string | null;
  sidebarOpen?: boolean;
}

const MapView = ({ devices, selectedDevice, onDeviceSelect, className = '', focusEnterpriseId, sidebarOpen = false }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());
  const lastSelectedDeviceId = useRef<string | null>(null);
  const hasInitialBounds = useRef(false);
  const lastFocusEnterpriseId = useRef<string | null | undefined>(undefined);

  const [mapType, setMapType] = useState<MapLayerType>(() => {
    return (localStorage.getItem('ayntrace_map_type') as MapLayerType) || 'street';
  });
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map centered on Tunisia
    map.current = L.map(mapContainer.current, {
      center: [34.0, 9.5], // Tunisia center
      zoom: 7,
      zoomControl: false,
    });

    // Add zoom control to bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map.current);

    // Add initial tile layer
    const layer = MAP_LAYERS[mapType];
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      maxZoom: 19,
    }).addTo(map.current);

    // Add custom CSS for sidebar-aware zoom control
    if (!document.getElementById('map-sidebar-styles')) {
      const style = document.createElement('style');
      style.id = 'map-sidebar-styles';
      style.textContent = `
        .leaflet-right .leaflet-control {
          transition: margin-right 0.3s ease-in-out;
        }
        .map-sidebar-open .leaflet-right .leaflet-control {
          margin-right: 25rem;
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update map container class based on sidebar state
  useEffect(() => {
    if (!mapContainer.current) return;
    const container = mapContainer.current.closest('.map-container');
    if (container) {
      if (sidebarOpen) {
        container.classList.add('map-sidebar-open');
      } else {
        container.classList.remove('map-sidebar-open');
      }
    }
  }, [sidebarOpen]);

  // Update tile layer when mapType changes
  useEffect(() => {
    if (!map.current || !tileLayerRef.current) return;

    const layer = MAP_LAYERS[mapType];

    // Remove old layer
    tileLayerRef.current.remove();

    // Add new layer
    tileLayerRef.current = L.tileLayer(layer.url, {
      attribution: layer.attribution,
      maxZoom: 19,
    }).addTo(map.current);
  }, [mapType]);

  // Update markers when devices change
  useEffect(() => {
    if (!map.current) return;

    const currentDeviceIds = new Set(devices.map(d => d.id));

    // Remove markers for devices that are no longer present
    markersRef.current.forEach((marker, id) => {
      if (!currentDeviceIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add or update markers
    devices.forEach(device => {
      const lat = Number(device.location?.lat);
      const lng = Number(device.location?.lng);
      
      if (isNaN(lat) || isNaN(lng)) {
        return; // Don't render markers with invalid coordinates
      }

      const statusColors: Record<string, string> = {
        online: '#22c55e',
        moving: '#10b981',
        idle: '#f59e0b',
        offline: '#6b7280',
        alert: '#ef4444',
        stolen: '#ef4444',
        lost: '#f97316',
        maintenance: '#a855f7'
      };

      const color = statusColors[device.status] || '#6b7280';

      const icon = L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="
              width: 16px;
              height: 16px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50%;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
              ${device.status === 'moving' ? 'animation: pulse 2s infinite;' : ''}
            "></div>
            ${device.status === 'moving' ? `
              <div style="
                position: absolute;
                width: 24px;
                height: 24px;
                background: ${color};
                border-radius: 50%;
                opacity: 0.3;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
            ` : ''}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const statusLabel = device.status === 'moving' ? 'En mouvement' :
        device.status === 'online' ? 'En ligne' :
          device.status === 'idle' ? 'Inactif' :
            device.status === 'offline' ? 'Hors ligne' : 
              device.status === 'stolen' ? 'Volé' :
                device.status === 'lost' ? 'Perdu' :
                  device.status === 'maintenance' ? 'En panne' : 'Alerte';

      // Format last update time
      const lastUpdate = new Date(device.lastUpdate);
      const timeAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);
      const lastUpdateText = timeAgo < 1 ? 'À l\'instant' : timeAgo < 60 ? `Il y a ${timeAgo} min` : `Il y a ${Math.floor(timeAgo / 60)}h`;

      const extraDetails = [
        device.brand ? `<strong style="color: #3b82f6;">${device.brand}</strong>` : '',
        device.plateId ? `<span style="background: #f1f5f9; color: #0f172a; padding: 1px 4px; border-radius: 4px; font-family: monospace; border: 1px solid #cbd5e1; font-weight: bold; font-size: 10px; margin-left: 4px;">🚗 ${device.plateId}</span>` : ''
      ].filter(Boolean).join(' ');

      const popupContent = `
        <div style="min-width: 220px; font-family: Inter, sans-serif;">
          <h3 style="margin: 0 0 4px 0; font-weight: 600; font-size: 14px;">${device.name}</h3>
          ${extraDetails ? `<p style="margin: 0 0 6px 0; font-size: 12px; display: flex; align-items: center; flex-wrap: wrap;">${extraDetails}</p>` : ''}
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${device.assignedTo || device.serialNumber} • ${device.enterpriseName}</p>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #888;">${device.location.address}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; margin-bottom: 10px;">
            <span style="color: ${color}; font-weight: 500;">${statusLabel}</span>
            <span>${device.speed} km/h</span>
            <span>🔋 ${device.battery}%</span>
            <span>📶 ${device.signal}%</span>
            <span style="color: #888;">🕐 ${lastUpdateText}</span>
          </div>
          <div style="display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #333;">
            <a href="/devices/${device.imei}" style="flex: 1; text-align: center; padding: 6px 12px; background: #3b82f6; color: white; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: 500;">Détails</a>
            <a href="/devices/${device.imei}?tab=historique" style="flex: 1; text-align: center; padding: 6px 12px; background: #1e293b; color: white; border-radius: 6px; font-size: 12px; text-decoration: none; font-weight: 500;">Historique</a>
          </div>
        </div>
      `;

      let marker = markersRef.current.get(device.id);

      if (marker) {
        // Update existing marker
        marker.setLatLng([lat, lng]);
        marker.setIcon(icon);
        marker.setPopupContent(popupContent);
      } else {
        // Create new marker
        marker = L.marker([lat, lng], { icon })
          .addTo(map.current!)
          .bindPopup(popupContent);

        marker.on('click', () => {
          onDeviceSelect?.(device);
        });

        markersRef.current.set(device.id, marker);
      }
    });

    // Add CSS animation (once)
    if (!document.getElementById('marker-animations')) {
      const style = document.createElement('style');
      style.id = 'marker-animations';
      style.textContent = `
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `;
      document.head.appendChild(style);
    }
  }, [devices, onDeviceSelect]);

  // Center on selected device and open popup
  useEffect(() => {
    if (!map.current || !selectedDevice) {
      lastSelectedDeviceId.current = null;
      return;
    }

    // Only fly to device if it's a new selection
    if (lastSelectedDeviceId.current !== selectedDevice.id) {
      map.current.flyTo(
        [selectedDevice.location.lat, selectedDevice.location.lng],
        14,
        { duration: 1 }
      );
      lastSelectedDeviceId.current = selectedDevice.id;
    }

    // Always try to open/refresh popup for the selected device
    const marker = markersRef.current.get(selectedDevice.id);
    if (marker && !marker.isPopupOpen()) {
      marker.openPopup();
    }
  }, [selectedDevice]);

  // Initial bounds fit and enterprise focus
  useEffect(() => {
    if (!map.current || devices.length === 0) return;

    const shouldFocus = focusEnterpriseId !== lastFocusEnterpriseId.current;

    if (!hasInitialBounds.current || shouldFocus) {
      if (focusEnterpriseId) {
        const enterpriseDevices = devices.filter(d => d.enterpriseId === focusEnterpriseId);
        if (enterpriseDevices.length > 0) {
          const bounds = L.latLngBounds(
            enterpriseDevices.map(d => [d.location.lat, d.location.lng] as L.LatLngExpression)
          );
          map.current.flyToBounds(bounds, {
            padding: [60, 60],
            duration: 1.5
          });
        }
      } else if (!hasInitialBounds.current) {
        // Fit all devices on first load
        const bounds = L.latLngBounds(
          devices.map(d => [d.location.lat, d.location.lng] as L.LatLngExpression)
        );
        map.current.fitBounds(bounds, {
          padding: [60, 60]
        });
        hasInitialBounds.current = true;
      }

      lastFocusEnterpriseId.current = focusEnterpriseId;
    }
  }, [focusEnterpriseId, devices.length]); // Only depend on count and id, not device data content

  const handleLayerChange = (type: MapLayerType) => {
    setMapType(type);
    localStorage.setItem('ayntrace_map_type', type);
    setShowLayerMenu(false);
  };

  return (
    <div className={`map-container ${className}`}>
      <div ref={mapContainer} className="absolute inset-0" />
      <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-border/20" />

      {/* Map Type Selector */}
      <div className={`absolute top-3 z-[1000] transition-all duration-300 ${sidebarOpen ? 'right-[25rem]' : 'right-3'}`}>
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="flex items-center gap-2 px-3 py-2 bg-card/90 backdrop-blur-sm border border-border rounded-lg shadow-lg hover:bg-card transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span className="text-sm font-medium">{MAP_LAYERS[mapType].name}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute top-full right-0 mt-2 w-40 bg-card/95 backdrop-blur-sm border border-border rounded-lg shadow-xl overflow-hidden">
              {(Object.keys(MAP_LAYERS) as MapLayerType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleLayerChange(type)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-secondary/50 transition-colors ${mapType === type ? 'bg-primary/10 text-primary' : ''
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
    </div>
  );
};

export default MapView;
