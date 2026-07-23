import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAppStore, useAuthStore } from '@/lib/store';
import { devicesApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  MapPin,
  Battery,
  Signal,
  Gauge,
  Clock,
  Building2,
  Navigation,
  Edit,
  Trash2,
  History,
  Route,
  Download,
  Thermometer,
  Mountain,
  Fuel,
  Car,
  Radio,
  Fingerprint,
  Phone,
  Link,
  Copy,
  ExternalLink,
  Bell,
  BellOff,
  FileText,
  AlertTriangle,
  MessageSquare,
  Tag
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getDeviceIcon, getStatusColor, getStatusLabel, formatDate, formatSpeed, formatBattery, calculateTotalDistance, getDeviceTypeLabel, toEnterpriseSlug } from '@/lib/utils-geo';
import { cn } from '@/lib/utils';
import MapView from '@/components/map/MapView';
import HistoryMapView from '@/components/map/HistoryMapView';
import { useState, useEffect, useMemo } from 'react';

import { toast } from 'sonner';
import DeviceFormModal from '@/components/modals/DeviceFormModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QRCodeSVG } from 'qrcode.react';

export default function DeviceDetailPage() {
  const { deviceKey } = useParams<{ deviceKey: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'historique' ? 'history' : (rawTab === 'history' || rawTab === 'map' ? rawTab : 'overview');
  const { devices, deleteDevice, updateDevice, alerts, createTicket, supportTickets, enterprises } = useAppStore();
  const { user } = useAuthStore();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [trackerModalOpen, setTrackerModalOpen] = useState(false);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentOption, setIncidentOption] = useState<'stolen' | 'lost' | 'maintenance'>('stolen');
  const [incidentText, setIncidentText] = useState('');
  const [trackerUrl, setTrackerUrl] = useState('');

  // History state with lazy initialization
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 1);
    return d.toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 1);
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endTime, setEndTime] = useState(() => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

  const [dbHistory, setDbHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const device = devices.find(d => d.id === deviceKey || d.imei === deviceKey);
  const deviceAlerts = alerts.filter(a => a.deviceId === device?.id || a.deviceId === device?.imei);

  const openTicketForDevice = supportTickets.find(t => 
    t.status === 'open' && device && (t.subject.includes(device.name) || t.subject.includes(device.imei))
  );

  // Use DB history if available, else empty (no more hardcoded mock generator)
  const history = useMemo(() => dbHistory.map(h => ({
    timestamp: h.timestamp,
    lat: h.location.coordinates[1],
    lng: h.location.coordinates[0],
    speed: h.speed || 0,
    address: (!h.address || h.address === 'Position initiale' || h.address === 'Position inconnue') 
       ? `Coord: ${h.location.coordinates[1].toFixed(5)}, ${h.location.coordinates[0].toFixed(5)}` 
       : h.address
  })).reverse(), [dbHistory]); // Reverse because API returns newest first

  // Calculate real stats
  const { totalDistance, totalDuration, avgSpeed } = useMemo(() => {
    if (history.length < 2) return { totalDistance: 0, totalDuration: '0m', avgSpeed: 0 };

    const dist = calculateTotalDistance(history);

    // Duration: last point - first point
    const start = new Date(history[0].timestamp).getTime();
    const end = new Date(history[history.length - 1].timestamp).getTime();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const avg = history.reduce((acc, h) => acc + h.speed, 0) / history.length;

    return {
      totalDistance: dist.toFixed(2),
      totalDuration: durationStr,
      avgSpeed: Math.floor(avg)
    };
  }, [history]);

  // Fetch tracker URL for real devices
  useEffect(() => {
    if (trackerModalOpen && device) {
      fetch('/api/config')
        .then(res => res.json())
        .then(config => {
          if (device?.trackingToken && config.trackerUrl) {
            setTrackerUrl(`${config.trackerUrl}/tracker/?token=${device.trackingToken}`);
          }
        })
        .catch(err => console.warn('Could not fetch tracker config:', err));
    }
  }, [trackerModalOpen, device]);

  // Playback effect
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentHistoryIndex(prev => {
        if (prev >= history.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying, history.length]);

  const handleDelete = () => {
    if (!device) return;
    deleteDevice(device.id);
    toast.success('Appareil supprimé avec succès');
    navigate('/devices');
  };

  const handleSendIncident = () => {
    if (!device) return;
    
    let title = '';
    let msg = '';
    if (incidentOption === 'stolen') {
      title = `🚨 Vol signalé - ${device.name}`;
      msg = `Le véhicule/équipement "${device.name}" (IMEI: ${device.imei}) a fait l'objet d'un signalement de VOL.\n\n`;
    } else if (incidentOption === 'lost') {
      title = `📍 Équipement Perdu - ${device.name}`;
      msg = `Le véhicule/équipement "${device.name}" (IMEI: ${device.imei}) a été déclaré PERDU.\n\n`;
    } else {
      title = `🔧 Panne / Maintenance - ${device.name}`;
      msg = `Le véhicule/équipement "${device.name}" (IMEI: ${device.imei}) a été signalé en PANNE ou nécessite une MAINTENANCE.\n\n`;
    }

    if (incidentText.trim()) {
      msg += `Détails supplémentaires de l'utilisateur :\n"${incidentText.trim()}"\n\n`;
    }

    msg += `Dernière position connue: ${device.location?.address || 'Non trouvée'}\nCoordonnées: ${device.location?.lat}, ${device.location?.lng}`;

    createTicket(title, msg);
    setIncidentModalOpen(false);
    setIncidentText('');
    setIncidentOption('stolen');
    toast.success("Rapport envoyé à l'équipe support avec succès.");
  };

  // Load history with selected date range from API
  const loadHistory = async () => {
    if (!device) return;

    setIsLoadingHistory(true);
    try {
      const startIso = new Date(`${startDate}T${startTime}`).toISOString();
      const endIso = new Date(`${endDate}T${endTime}`).toISOString();

      const data = await devicesApi.getHistory(device.id, startIso, endIso);
      setDbHistory(data);
      setCurrentHistoryIndex(0);
      setIsPlaying(false);

      if (data.length === 0) {
        toast.info('Aucun historique trouvé pour cette période');
      } else {
        toast.success(`${data.length} points d'historique chargés`);
      }

      // ----------------------------------------------------
      // Background Reverse Geocoding for Unknown Addresses
      // ----------------------------------------------------
      (async () => {
        const coordsToGeocode = new Map<string, { lat: number, lng: number }>();
        data.forEach((h: any) => {
          if (!h.address || h.address === 'Position initiale' || h.address === 'Position inconnue') {
            const lat = h.location.coordinates[1];
            const lng = h.location.coordinates[0];
            const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
            if (!coordsToGeocode.has(key)) {
              coordsToGeocode.set(key, { lat, lng });
            }
          }
        });

        if (coordsToGeocode.size > 0 && coordsToGeocode.size <= 50) {
          // Si on a moins de 50 points uniques, on peut géocoder (pour pas surcharger Nominatim)
          let resolvedCount = 0;
          const resolvedAddrs = new Map<string, string>();
          
          for (const [key, { lat, lng }] of coordsToGeocode.entries()) {
            try {
              const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=fr`);
              if (!res.ok) {
                console.warn(`[Geocoding] Nominatim returned status ${res.status}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              const contentType = res.headers.get('content-type') || '';
              if (!contentType.includes('application/json')) {
                console.warn(`[Geocoding] Expected JSON, got ${contentType}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
              }
              const geodata = await res.json();
              if (geodata && geodata.display_name) {
                const parts = geodata.display_name.split(',');
                resolvedAddrs.set(key, parts.slice(0, 3).join(', ').trim());
                resolvedCount++;
              }
              // Throttle to respect OpenStreetMap's 1 req/sec policy
              await new Promise(resolve => setTimeout(resolve, 1100));
            } catch (err) {
              console.warn("Geocodage echoué pour", lat, lng);
            }
          }

          if (resolvedCount > 0) {
            setDbHistory(prev => prev.map(h => {
              if (!h.address || h.address === 'Position initiale' || h.address === 'Position inconnue') {
                const hLat = h.location.coordinates[1];
                const hLng = h.location.coordinates[0];
                const key = `${hLat.toFixed(4)},${hLng.toFixed(4)}`;
                if (resolvedAddrs.has(key)) {
                  return { ...h, address: resolvedAddrs.get(key) };
                }
              }
              return h;
            }));
            toast.success(`${resolvedCount} adresses ont été traduites sur la carte !`);
          }
        }
      })();

    } catch (err) {
      console.error('Error loading history:', err);
      toast.error("Échec du chargement de l'historique");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Initial load of history if on the history tab
  useEffect(() => {
    if (activeTab === 'history' && device) {
      loadHistory();
    }
  }, [activeTab, deviceKey]);

  // Early return for device not found - MUST be after all hooks
  if (!device) {
    return (
      <DashboardLayout>
        <div className="h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Appareil non trouvé</h2>
            <Button onClick={() => navigate('/devices')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour aux appareils
            </Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const DeviceIcon = getDeviceIcon(device.deviceType);
  const isVehicleDevice = ['voiture', 'camion', 'moto', 'vehicle'].includes((device.deviceType || '').toLowerCase());
  const hasVehicleTelemetry = isVehicleDevice && (
    device.ignition !== undefined ||
    device.fuelLevel !== undefined ||
    device.odometer !== undefined ||
    device.temperature !== undefined
  );

  // Export history to CSV
  const exportCSV = () => {
    const headers = ['Timestamp', 'Latitude', 'Longitude', 'Vitesse (km/h)', 'Adresse'];
    const rows = history.map(h => [
      new Date(h.timestamp).toLocaleString('fr-FR'),
      typeof h.lat === 'number' ? h.lat.toFixed(6) : (!isNaN(Number(h.lat)) ? Number(h.lat).toFixed(6) : 'N/A'),
      typeof h.lng === 'number' ? h.lng.toFixed(6) : (!isNaN(Number(h.lng)) ? Number(h.lng).toFixed(6) : 'N/A'),
      h.speed.toString(),
      `"${h.address}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique_${device.name}_${startDate}.csv`;
    link.click();
    toast.success('Fichier CSV téléchargé');
  };

  // Export history to KML
  const exportKML = () => {
    const coordinates = history.map(h => `${h.lng},${h.lat},0`).join(' ');
    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Historique ${device.name}</name>
    <description>Trajet du ${startDate} ${startTime} au ${endDate} ${endTime}</description>
    <Placemark>
      <name>Trajet</name>
      <LineString>
        <coordinates>${coordinates}</coordinates>
      </LineString>
    </Placemark>
    ${history.map((h, i) => `
    <Placemark>
      <name>Point ${i + 1}</name>
      <description>${h.speed} km/h - ${h.address}</description>
      <Point><coordinates>${h.lng},${h.lat},0</coordinates></Point>
    </Placemark>`).join('')}
  </Document>
</kml>`;
    const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique_${device.name}_${startDate}.kml`;
    link.click();
    toast.success('Fichier KML téléchargé');
  };

  // Export history to XLS
  const exportXLS = () => {
    const rows = history.map(h => ({
      Timestamp: new Date(h.timestamp).toLocaleString('fr-FR'),
      Latitude: h.lat,
      Longitude: h.lng,
      'Vitesse (km/h)': h.speed,
      Adresse: h.address
    }));
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Historique');
    XLSX.writeFile(workbook, `historique_${device.name}_${startDate}.xlsx`);
    toast.success('Fichier Excel téléchargé');
  };

  // Export history to PDF
  const exportPDF = () => {
    if (history.length === 0) {
      toast.error("Aucune donnée disponible pour l'export");
      return;
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(0, 229, 153); // Primary color
    doc.text("AYNTRACE", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(60, 60, 60);
    doc.text("Rapport d'activité détaillé", 14, 30);
    
    // Meta Info
    doc.setFontSize(10);
    doc.text(`Appareil : ${device.name} (${device.serialNumber})`, 14, 45);
    doc.text(`Entreprise : ${device.enterpriseName}`, 14, 52);
    doc.text(`Période : Du ${startDate} au ${endDate}`, 14, 59);
    doc.text(`Généré le : ${new Date().toLocaleString()}`, 14, 66);

    // Summary Stats Box
    doc.setDrawColor(200);
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(14, 75, 180, 25, 3, 3, 'FD');
    
    const maxSpeed = Math.max(...history.map(h => h.speed || 0));
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Distance Totale : ${totalDistance} km`, 20, 85);
    doc.text(`Vitesse Max : ${Math.round(maxSpeed)} km/h`, 80, 85);
    doc.text(`Durée du trajet : ${totalDuration}`, 140, 85);

    // Table
    const tableData = history.map(h => [
      new Date(h.timestamp).toLocaleString(),
      `${typeof h.lat === 'number' ? h.lat.toFixed(5) : (!isNaN(Number(h.lat)) ? Number(h.lat).toFixed(5) : 'N/A')}, ${typeof h.lng === 'number' ? h.lng.toFixed(5) : (!isNaN(Number(h.lng)) ? Number(h.lng).toFixed(5) : 'N/A')}`,
      `${Math.round(h.speed || 0)} km/h`,
      h.address || 'N/A'
    ]);

    autoTable(doc, {
      startY: 110,
      head: [['Date/Heure', 'Coordonnées', 'Vitesse', 'Adresse / Lieu']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 229, 153] },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { top: 20 },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    doc.setFontSize(8);
    for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Page ${i} sur ${pageCount} - Système analytique AynTrace`, 14, doc.internal.pageSize.height - 10);
    }

    doc.save(`Rapport_${device.name}_${startDate}.pdf`);
    toast.success("Fichier PDF téléchargé");
  };

  const exportSOSReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(220, 38, 38);
    doc.text("RAPPORT DE PERTE / VOL", 14, 20);
    
    doc.setFontSize(14);
    doc.setTextColor(60, 60, 60);
    doc.text(`Document généré le : ${new Date().toLocaleString()}`, 14, 30);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Identifiant (IMEI) : ${device.imei}`, 14, 45);
    doc.text(`Nom de l'appareil : ${device.name}`, 14, 52);
    doc.text(`Numéro de série : ${device.serialNumber || 'N/A'}`, 14, 59);
    doc.text(`Propriétaire / Entreprise : ${device.enterpriseName}`, 14, 66);
    doc.text(`Plaque d'immatriculation : ${device.plateId || 'N/A'}`, 14, 73);
    doc.text(`Statut actuel : ${device.status === 'stolen' ? 'VOLÉ' : 'PERDU'}`, 14, 80);

    doc.setFontSize(14);
    doc.text("Dernière position connue :", 14, 95);
    doc.setFontSize(11);
    const addressLines = doc.splitTextToSize(`Adresse : ${device.location.address}`, 180);
    doc.text(addressLines, 14, 105);
    const latStr = typeof device.location?.lat === 'number' ? device.location.lat.toFixed(6) : (!isNaN(Number(device.location?.lat)) ? Number(device.location?.lat).toFixed(6) : 'N/A');
    const lngStr = typeof device.location?.lng === 'number' ? device.location.lng.toFixed(6) : (!isNaN(Number(device.location?.lng)) ? Number(device.location?.lng).toFixed(6) : 'N/A');
    doc.text(`Coordonnées GPS : ${latStr}, ${lngStr}`, 14, 105 + (addressLines.length * 7));
    doc.text(`Dernier relevé : ${new Date(device.lastUpdate).toLocaleString('fr-FR')}`, 14, 105 + (addressLines.length * 7) + 7);
    
    doc.setFontSize(10);
    doc.setTextColor(150, 150, 150);
    doc.text("Ce document atteste de la dernière position enregistrée par le système AynTrace.", 14, 160);

    doc.save(`Rapport_Police_${device.name}.pdf`);
    toast.success("Rapport généré avec succès");
  };

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DeviceIcon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">{device.name}</h1>
                    <Badge
                      className={cn(
                        getStatusColor(device.status),
                        device.status === 'offline'
                          ? 'text-muted-foreground dark:text-foreground'
                          : 'text-white'
                      )}
                    >
                      {getStatusLabel(device.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
                    
                    {(device.brand || device.plateId || device.fuelType) && (
                      <span className="text-muted-foreground/30">•</span>
                    )}
                    <span>{device.assignedTo || device.serialNumber}</span>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="font-mono text-xs">{device.imei}</span>
                  </p>
                </div>
              </div>
            </div>

            {(user?.role === 'admin' || user?.role === 'operator') && (
              <div className="flex items-center gap-2">
                {device.dataSource === 'real' && device.trackingToken && (
                  <Button variant="hero" onClick={() => setTrackerModalOpen(true)}>
                    <Link className="w-4 h-4 mr-2" />
                    Lien Tracker
                  </Button>
                )}
                {user?.role === 'admin' ? (
                  openTicketForDevice && (
                    <Button
                      variant="outline"
                      className="bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20"
                      onClick={() => {
                        useAppStore.getState().setActiveTicketId(openTicketForDevice.id);
                        navigate('/support');
                      }}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Voir le ticket support
                    </Button>
                  )
                ) : (
                  device.status !== 'stolen' && device.status !== 'lost' && device.status !== 'maintenance' && (
                    openTicketForDevice ? (
                      <Button variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 hover:bg-orange-500/20" onClick={() => {
                          useAppStore.getState().setActiveTicketId(openTicketForDevice.id);
                          navigate('/support');
                        }}>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        En cours (Ticket)
                      </Button>
                    ) : (
                      <Button variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-0" onClick={() => setIncidentModalOpen(true)}>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Signaler Incident
                      </Button>
                    )
                  )
                )}
                {(device.status === 'stolen' || device.status === 'lost') && (
                  <Button variant="outline" className="border-destructive text-destructive bg-destructive/10" onClick={exportSOSReport}>
                    <FileText className="w-4 h-4 mr-2" />
                    Rapport Police / Assurance
                  </Button>
                )}
                <Button variant="outline" onClick={() => setEditModalOpen(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </Button>
                {user?.role === 'admin' && (
                  <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer
                  </Button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              const nextParams = new URLSearchParams(searchParams);
              if (value === 'overview') {
                nextParams.delete('tab');
              } else {
                nextParams.set('tab', value);
              }
              setSearchParams(nextParams, { replace: true });
            }}
            className="h-full"
          >
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
              <TabsTrigger value="map">Carte</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card className="glass-card border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Position</p>
                        <p className="font-medium line-clamp-2 break-words">{device.location.address}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Gauge className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Vitesse</p>
                        <p className="font-medium">{formatSpeed(device.speed)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Battery className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Batterie</p>
                        <p className="font-medium">{formatBattery(device.battery)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-0">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Signal className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Signal</p>
                        <p className="font-medium">{device.signal}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card border-0 cursor-pointer hover:bg-secondary/20 transition-all hover:scale-[1.02] ring-1 ring-transparent hover:ring-destructive/30" onClick={() => navigate(`/alerts?deviceId=${device.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Alertes non lues</p>
                        <p className="font-medium text-2xl">{deviceAlerts.filter(a => !a.read).length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="glass-card border-0">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      Informations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Entreprise</span>
                      {user?.role !== 'operator' ? (
                        <span
                          className="font-medium text-primary hover:underline cursor-pointer"
                          onClick={() => {
                            const ent = enterprises.find(e => e.id === device.enterpriseId);
                            const slug = ent ? toEnterpriseSlug(ent.name, ent.imeiPrefix) : device.enterpriseId;
                            navigate(`/enterprises/${slug}`);
                          }}
                        >
                          {device.enterpriseName}
                        </span>
                      ) : (
                        <span className="font-medium">{device.enterpriseName}</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium">{getDeviceTypeLabel(device.deviceType)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1"><Fingerprint className="w-4 h-4" /> IMEI</span>
                      <span className="font-medium font-mono text-sm">{device.imei}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground flex items-center gap-1"><Radio className="w-4 h-4" /> N° Série</span>
                      <span className="font-medium">{device.serialNumber}</span>
                    </div>
                    {device.subscriberNumber && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><Phone className="w-4 h-4" /> N° SIM</span>
                        <span className="font-medium">{device.subscriberNumber}</span>
                      </div>
                    )}
                    {device.plateId && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><Car className="w-4 h-4" /> Plaque</span>
                        <span className="font-mono bg-secondary px-2 py-0.5 rounded">{device.plateId}</span>
                      </div>
                    )}
                    {device.brand && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><Tag className="w-4 h-4" /> Marque / Modèle</span>
                        <span className="font-medium">{device.brand}</span>
                      </div>
                    )}
                    {device.fuelType && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><Fuel className="w-4 h-4" /> Carburant</span>
                        <span className="font-medium">
                          {device.fuelType === 'electrique' ? 'Électrique' : 
                           device.fuelType.charAt(0).toUpperCase() + device.fuelType.slice(1)}
                        </span>
                      </div>
                    )}
                    {device.assignedTo && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Assigné à</span>
                        <span className="font-medium">{device.assignedTo}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="glass-card border-0">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Navigation className="w-5 h-5" />
                      Navigation & GPS
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Latitude</span>
                      <span className="font-medium font-mono text-sm">{typeof device.location?.lat === 'number' ? device.location.lat.toFixed(6) : (!isNaN(Number(device.location?.lat)) ? Number(device.location?.lat).toFixed(6) : 'N/A')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Longitude</span>
                      <span className="font-medium font-mono text-sm">{typeof device.location?.lng === 'number' ? device.location.lng.toFixed(6) : (!isNaN(Number(device.location?.lng)) ? Number(device.location?.lng).toFixed(6) : 'N/A')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Direction</span>
                      <span className="font-medium">{device.heading}°</span>
                    </div>
                    {device.altitude !== undefined && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1"><Mountain className="w-4 h-4" /> Altitude</span>
                        <span className="font-medium">{device.altitude} m</span>
                      </div>
                    )}
                    {device.hdop !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Précision GPS (HDOP)</span>
                        <span className="font-medium">{device.hdop}</span>
                      </div>
                    )}
                    {device.gpsValidMode && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">GPS Valide</span>
                        <Badge variant={device.gpsValidMode === 'A' ? 'default' : 'secondary'}>
                          {device.gpsValidMode === 'A' ? 'Oui' : 'Non'}
                        </Badge>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dernière MAJ</span>
                      <span className="font-medium text-sm">{formatDate(device.lastUpdate)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Vehicle & Sensor Info */}
              {hasVehicleTelemetry && (
                <Card className="glass-card border-0">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Car className="w-5 h-5" />
                      Véhicule & Capteurs
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      {device.ignition !== undefined && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${device.ignition ? 'bg-success/10' : 'bg-muted'}`}>
                            <Car className={`w-5 h-5 ${device.ignition ? 'text-success' : 'text-muted-foreground'}`} />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Moteur</p>
                            <p className={`font-medium ${device.ignition ? 'text-success' : ''}`}>
                              {device.ignition ? 'Allumé' : 'Éteint'}
                            </p>
                          </div>
                        </div>
                      )}
                      {device.fuelLevel !== undefined && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Fuel className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Carburant</p>
                            <p className="font-medium">{device.fuelLevel}%</p>
                          </div>
                        </div>
                      )}
                      {device.odometer !== undefined && device.odometer !== null && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Navigation className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Compteur</p>
                            <p className="font-medium">{device.odometer.toLocaleString()} km</p>
                          </div>
                        </div>
                      )}
                      {device.temperature !== undefined && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Thermometer className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Température</p>
                            <p className="font-medium">{device.temperature}°C</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Mini Map */}
              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Position actuelle
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/map?device=${device.id}`)}
                  >
                    Voir la carte complète
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] rounded-lg overflow-hidden">
                    <MapView devices={[device]} selectedDevice={device} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {/* Date Range Selector */}
              <Card className="glass-card border-0">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Du:</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm"
                      />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Au:</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm"
                      />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="hero"
                      onClick={loadHistory}
                      disabled={isLoadingHistory}
                    >
                      {isLoadingHistory ? 'Chargement...' : 'Afficher le trajet'}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      ({totalDuration} • {history.length} points)
                    </span>
                    <div className="flex gap-2 ml-auto">
                      <Button size="sm" variant="outline" onClick={exportCSV}>
                        <Download className="w-4 h-4 mr-1" />
                        CSV
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportKML}>
                        <Download className="w-4 h-4 mr-1" />
                        KML
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportXLS}>
                        <Download className="w-4 h-4 mr-1" />
                        XLS
                      </Button>
                      <Button size="sm" variant="outline" onClick={exportPDF}>
                        <Download className="w-4 h-4 mr-1" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Route Map */}
              <Card className="glass-card border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Route className="w-5 h-5" />
                    Trajet parcouru
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[350px] rounded-lg overflow-hidden">
                    <HistoryMapView
                      history={history}
                      currentIndex={currentHistoryIndex}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Timeline Slider */}
              <Card className="glass-card border-0">
                <CardContent className="p-4">
                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div className="relative h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${(currentHistoryIndex / (history.length - 1)) * 100}%` }}
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => setCurrentHistoryIndex(0)}
                        >
                          ⏮
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => setCurrentHistoryIndex(Math.max(0, currentHistoryIndex - 1))}
                        >
                          ◀
                        </Button>
                        <Button
                          variant={isPlaying ? "destructive" : "hero"}
                          size="icon"
                          className="h-12 w-12"
                          onClick={() => setIsPlaying(!isPlaying)}
                        >
                          {isPlaying ? "⏸" : "▶"}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => setCurrentHistoryIndex(Math.min(history.length - 1, currentHistoryIndex + 1))}
                        >
                          ▶
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => setCurrentHistoryIndex(history.length - 1)}
                        >
                          ⏭
                        </Button>
                      </div>

                      <div className="flex-1 px-4">
                        <input
                          type="range"
                          min={0}
                          max={history.length - 1}
                          value={currentHistoryIndex}
                          onChange={(e) => setCurrentHistoryIndex(parseInt(e.target.value))}
                          className="w-full h-2 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                      </div>

                      <div className="text-sm font-mono text-muted-foreground">
                        {currentHistoryIndex + 1} / {history.length}
                      </div>
                    </div>

                    {/* Current Position Info */}
                    {history[currentHistoryIndex] && (
                      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-secondary/50 to-secondary/30 border border-border/30">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Point {currentHistoryIndex + 1}</p>
                            <p className="text-sm text-muted-foreground">{history[currentHistoryIndex].address}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-primary">{history[currentHistoryIndex].speed}</p>
                            <p className="text-xs text-muted-foreground">km/h</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatDate(history[currentHistoryIndex].timestamp)}</p>
                            <p className="text-xs text-muted-foreground">Horodatage</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Statistics */}
              <div className="grid gap-4 grid-cols-3">
                <Card className="glass-card border-0">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{totalDistance} km</p>
                    <p className="text-sm text-muted-foreground">Distance totale</p>
                  </CardContent>
                </Card>
                <Card className="glass-card border-0">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{totalDuration}</p>
                    <p className="text-sm text-muted-foreground">Durée</p>
                  </CardContent>
                </Card>
                <Card className="glass-card border-0">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-primary">{avgSpeed} km/h</p>
                    <p className="text-sm text-muted-foreground">Vitesse moyenne</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="map" className="h-[calc(100vh-280px)]">
              <Card className="glass-card border-0 h-full">
                <CardContent className="p-0 h-full">
                  <MapView devices={[device]} selectedDevice={device} />
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        </div>
      </div>
      <DeviceFormModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        device={device}
      />

      <ConfirmDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer l'appareil"
        description={`Êtes-vous sûr de vouloir supprimer "${device.name}" ? Cette action est irréversible.`}
      />

      {/* Tracker Link Modal */}
      <Dialog open={trackerModalOpen} onOpenChange={setTrackerModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-primary" />
              Lien de suivi GPS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex flex-col items-center pt-2">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-border/50 shrink-0">
                <QRCodeSVG value={trackerUrl || window.location.origin} size={160} />
              </div>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                Scannez le QR code ou ouvrez le lien sur un appareil mobile pour activer le suivi en temps réel.
              </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={trackerUrl}
                className="font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(trackerUrl);
                  toast.success('Lien copié!');
                }}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => window.open(trackerUrl, '_blank')}
                className="flex-1"
                variant="hero"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir
              </Button>
              <Button
                onClick={() => setTrackerModalOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Fermer
              </Button>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Incident Modal */}
      <Dialog open={incidentModalOpen} onOpenChange={setIncidentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Signaler un Événement
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Veuillez sélectionner le type d'événement pour remonter cet appareil à l'équipe technique. Le statut de l'appareil ne sera pas modifié.
            </p>
            <div className="grid grid-cols-1 gap-3">
              {(['stolen', 'lost', 'maintenance'] as const).map(option => (
                <button 
                  key={option}
                  className={cn(
                    "flex items-center text-left w-full h-auto py-2.5 px-4 rounded-xl border-2 transition-all",
                    incidentOption === option 
                      ? (option === 'stolen' ? 'border-destructive bg-destructive/5' : option === 'lost' ? 'border-orange-500 bg-orange-500/5' : 'border-purple-500 bg-purple-500/5')
                      : "border-border/50 hover:bg-secondary/30"
                  )}
                  onClick={() => setIncidentOption(option)}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center mr-4 shrink-0 transition-colors",
                    incidentOption === option 
                      ? (option === 'stolen' ? 'bg-destructive text-white' : option === 'lost' ? 'bg-orange-500 text-white' : 'bg-purple-500 text-white')
                      : "bg-secondary text-muted-foreground"
                  )}>
                    {option === 'stolen' && <AlertTriangle className="w-5 h-5" />}
                    {option === 'lost' && <MapPin className="w-5 h-5" />}
                    {option === 'maintenance' && <Edit className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className={cn(
                      "font-semibold text-sm",
                      incidentOption === option && option === 'stolen' ? 'text-destructive' : incidentOption === option && option === 'lost' ? 'text-orange-500' : incidentOption === option && option === 'maintenance' ? 'text-purple-500' : ''
                    )}>
                      {option === 'stolen' ? 'Déclarer comme Volé' : option === 'lost' ? 'Déclarer comme Perdu' : 'En Panne / Maintenance'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {option === 'stolen' ? 'Alerte critique immédiate' : option === 'lost' ? 'Appareil égaré' : 'Nécessite réparation'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Détails (Optionnel)</label>
              <textarea
                value={incidentText}
                onChange={(e) => setIncidentText(e.target.value)}
                placeholder="Décrivez les circonstances supplémentaires..."
                className="w-full min-h-[90px] p-3 rounded-lg bg-secondary/30 border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIncidentModalOpen(false)}>
                Annuler
              </Button>
              <Button type="button" className="flex-1 bg-primary text-white shadow-glow" onClick={handleSendIncident}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Ouvrir un ticket
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};


