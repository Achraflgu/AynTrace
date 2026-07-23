import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAppStore, useAuthStore, Alert } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Bell, 
  Battery, 
  Wifi, 
  MapPin, 
  Gauge, 
  AlertTriangle, 
  Search,
  Check,
  CheckCheck,
  Trash2,
  Filter,
  Building2,
  Calendar,
  Clock
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AlertsPage = () => {
  const { alerts, devices, enterprises, markAlertRead, markAllAlertsRead, deleteAlert } = useAppStore();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const deviceIdParam = searchParams.get('deviceId');
  const enterpriseIdParam = searchParams.get('enterpriseId');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [displayedCount, setDisplayedCount] = useState(10);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Reset pagination when filters change
  useEffect(() => {
    setDisplayedCount(10);
  }, [searchQuery, typeFilter, statusFilter]);


  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'battery': return Battery;
      case 'offline': return Wifi;
      case 'geofence': return MapPin;
      case 'speed': return Gauge;
      case 'sos': return AlertTriangle;
      default: return Bell;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high': return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'medium': return 'bg-warning/10 text-warning border-warning/20';
      case 'low': return 'bg-muted text-muted-foreground border-border';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getSeverityBadge = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high': return <Badge className="bg-destructive text-destructive-foreground">Haute</Badge>;
      case 'medium': return <Badge className="bg-warning text-warning-foreground">Moyenne</Badge>;
      case 'low': return <Badge variant="secondary">Basse</Badge>;
      default: return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getTypeName = (type: Alert['type']) => {
    switch (type) {
      case 'battery': return 'Batterie';
      case 'offline': return 'Hors ligne';
      case 'geofence': return 'Géofence';
      case 'speed': return 'Vitesse';
      case 'sos': return 'SOS';
      default: return type;
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    // Active URL filters check
    if (deviceIdParam && alert.deviceId !== deviceIdParam) return false;
    
    if (enterpriseIdParam) {
      const device = devices.find(d => d.id === alert.deviceId || d.imei === alert.deviceId);
      if (!device || device.enterpriseId !== enterpriseIdParam) return false;
    }

    const matchesSearch = 
      alert.deviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      alert.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || alert.type === typeFilter;
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'unread' && !alert.read) ||
      (statusFilter === 'read' && alert.read);
    
    return matchesSearch && matchesType && matchesStatus;
  });

  const visibleAlerts = filteredAlerts.slice(0, displayedCount);
  const unreadCount = alerts.filter(a => !a.read).length;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const bottom = e.currentTarget.scrollHeight - e.currentTarget.scrollTop <= e.currentTarget.clientHeight + 100;
    if (bottom && displayedCount < filteredAlerts.length) {
      setDisplayedCount(prev => prev + 10);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Bell className="w-6 h-6" />
                Alertes
              </h1>
              <p className="text-sm text-muted-foreground">
                {alerts.length} alerte{alerts.length !== 1 ? 's' : ''} • {unreadCount} non lue{unreadCount !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  disabled={markingAllRead}
                  onClick={async () => {
                    setMarkingAllRead(true);
                    try {
                      await markAllAlertsRead();
                      toast.success('Toutes les alertes ont été marquées comme lues');
                    } finally {
                      setMarkingAllRead(false);
                    }
                  }}
                >
                  <CheckCheck className="w-4 h-4 mr-2" />
                  {markingAllRead ? 'Marquage...' : 'Tout marquer comme lu'}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-0"
              />
            </div>

            {/* Enterprise Filter */}
            {user?.role !== 'operator' && (
              <Select value={enterpriseIdParam || 'all'} onValueChange={(val) => {
                  if(val === 'all') { searchParams.delete('enterpriseId'); } else { searchParams.set('enterpriseId', val); }
                  searchParams.delete('deviceId'); // reset device when changing enterprise
                  setSearchParams(searchParams);
              }}>
                <SelectTrigger className="w-56 bg-secondary/50 border-0">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Entreprise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les entreprises</SelectItem>
                  {enterprises.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Device Filter */}
            <Select value={deviceIdParam || 'all'} onValueChange={(val) => {
                if(val === 'all') searchParams.delete('deviceId'); else searchParams.set('deviceId', val);
                setSearchParams(searchParams);
            }}>
              <SelectTrigger className="w-56 bg-secondary/50 border-0 truncate">
                <MapPin className="w-4 h-4 mr-2 shrink-0" />
                <SelectValue placeholder="Appareil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les appareils</SelectItem>
                {devices
                  .filter(d => {
                    if (user?.role === 'operator' && user.enterpriseId) return d.enterpriseId === user.enterpriseId;
                    if (enterpriseIdParam) return d.enterpriseId === enterpriseIdParam;
                    return true;
                  })
                  .map((dev) => (
                  <SelectItem key={dev.id} value={dev.id}>
                    {dev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 bg-secondary/50 border-0">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="battery">Batterie</SelectItem>
                <SelectItem value="offline">Hors ligne</SelectItem>
                <SelectItem value="geofence">Géofence</SelectItem>
                <SelectItem value="speed">Vitesse</SelectItem>
                <SelectItem value="sos">SOS</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-secondary/50 border-0">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="unread">Non lues</SelectItem>
                <SelectItem value="read">Lues</SelectItem>
              </SelectContent>
            </Select>
          </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 scroll-smooth" onScroll={handleScroll}>
          {filteredAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Aucune alerte</h3>
              <p className="text-muted-foreground max-w-md">
                Toutes vos alertes apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleAlerts.map((alert, idx) => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <Card 
                    key={`${alert.id}-${idx}`}
                    className={cn(
                      "glass-card group border transition-all cursor-pointer hover:shadow-md",
                      getSeverityColor(alert.severity),
                      !alert.read && "ring-2 ring-primary/20"
                    )}
                    onClick={() => markAlertRead(alert.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          alert.severity === 'high' && "bg-destructive/20",
                          alert.severity === 'medium' && "bg-warning/20",
                          alert.severity === 'low' && "bg-muted"
                        )}>
                          <Icon className="w-6 h-6" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold">{alert.deviceName}</h3>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getSeverityBadge(alert.severity)}
                              <Badge variant="outline">{getTypeName(alert.type)}</Badge>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                              {/* Relative Time Badge */}
                              <div className="font-medium bg-background/40 px-2 py-0.5 rounded text-[11px] border border-border/30">
                                {formatDistanceToNow(new Date(alert.timestamp), { 
                                  addSuffix: true, 
                                  locale: fr 
                                })}
                              </div>
                              
                              <span className="opacity-30">•</span>

                              {/* Exact Precision Date & Time */}
                              <div className="flex items-center gap-1.5 text-[11px] font-medium bg-background/60 px-2.5 py-1 rounded-md border border-border/50 shadow-sm w-fit group-hover:border-primary/30 transition-colors">
                                <Calendar className="w-3 h-3 opacity-70" />
                                <span>{format(new Date(alert.timestamp), "d MMM yyyy", { locale: fr })}</span>
                                <span className="opacity-40 mx-0.5">|</span>
                                <Clock className="w-3 h-3 opacity-70 text-primary" />
                                <span className="font-mono font-semibold tracking-tight">{format(new Date(alert.timestamp), "HH:mm:ss")}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!alert.read && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAlertRead(alert.id);
                                  }}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Marquer lu
                                </Button>
                              )}
                              {user?.role === 'admin' && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteAlert(alert.id);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              
              {displayedCount < filteredAlerts.length && (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

    </DashboardLayout>
  );
};

export default AlertsPage;
