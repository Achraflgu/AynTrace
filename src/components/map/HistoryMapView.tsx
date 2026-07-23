import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationHistory } from '@/lib/types';

interface HistoryMapViewProps {
    history: LocationHistory[];
    currentIndex: number;
    className?: string;
}

const HistoryMapView = ({ history, currentIndex, className = '' }: HistoryMapViewProps) => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const startMarkerRef = useRef<L.CircleMarker | null>(null);
    const endMarkerRef = useRef<L.CircleMarker | null>(null);
    const currentMarkerRef = useRef<L.CircleMarker | null>(null);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || map.current) return;

        map.current = L.map(mapContainer.current, {
            center: [36.8, 10.18], // Tunisia center
            zoom: 12,
            zoomControl: false,
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map.current);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(map.current);

        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, []);

    // Update route when history changes
    useEffect(() => {
        if (!map.current) return;

        // Cleanup function to remove all layers
        const cleanupLayers = () => {
            if (polylineRef.current) {
                polylineRef.current.remove();
                polylineRef.current = null;
            }
            if (startMarkerRef.current) {
                startMarkerRef.current.remove();
                startMarkerRef.current = null;
            }
            if (endMarkerRef.current) {
                endMarkerRef.current.remove();
                endMarkerRef.current = null;
            }
            if (currentMarkerRef.current) {
                currentMarkerRef.current.remove();
                currentMarkerRef.current = null;
            }
        };

        cleanupLayers();

        if (history.length === 0) return;

        // Create route coordinates
        const coords: L.LatLngExpression[] = history.map(h => [h.lat, h.lng]);

        // Draw polyline
        polylineRef.current = L.polyline(coords, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            smoothFactor: 1,
        }).addTo(map.current);

        // Start marker (green)
        const start = history[0];
        startMarkerRef.current = L.circleMarker([start.lat, start.lng], {
            radius: 8,
            fillColor: '#22c55e',
            fillOpacity: 1,
            color: '#fff',
            weight: 2,
        }).addTo(map.current);
        startMarkerRef.current.bindTooltip('Départ', { permanent: true, direction: 'top' });

        // End marker (red)
        if (history.length > 1) {
            const end = history[history.length - 1];
            endMarkerRef.current = L.circleMarker([end.lat, end.lng], {
                radius: 8,
                fillColor: '#ef4444',
                fillOpacity: 1,
                color: '#fff',
                weight: 2,
            }).addTo(map.current);
            endMarkerRef.current.bindTooltip('Arrivée', { permanent: true, direction: 'top' });
        }

        // Fit map to route
        const bounds = L.latLngBounds(coords);
        if (bounds.isValid()) {
            map.current.fitBounds(bounds, { padding: [50, 50] });
        }

    }, [history]);

    // Update current position marker
    useEffect(() => {
        if (!map.current || history.length === 0) return;

        // Remove existing current marker
        if (currentMarkerRef.current) {
            currentMarkerRef.current.remove();
            currentMarkerRef.current = null;
        }

        // Only show if not at start or end
        if (currentIndex > 0 && currentIndex < history.length - 1) {
            const current = history[currentIndex];
            currentMarkerRef.current = L.circleMarker([current.lat, current.lng], {
                radius: 6,
                fillColor: '#f59e0b',
                fillOpacity: 1,
                color: '#fff',
                weight: 2,
            }).addTo(map.current);

            // Pan to current position if needed, but smooth pan might fight with fitBounds
            // map.current.panTo([current.lat, current.lng], { animate: true });
        }
    }, [currentIndex, history]);

    return (
        <div className={`relative w-full h-full rounded-xl overflow-hidden ${className}`}>
            <div ref={mapContainer} className="absolute inset-0" />
            <div className="absolute inset-0 pointer-events-none rounded-xl ring-1 ring-inset ring-border/20" />
        </div>
    );
};

export default HistoryMapView;
