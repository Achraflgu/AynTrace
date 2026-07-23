import DashboardLayout from '@/components/layout/DashboardLayout';
import DeviceCard from '@/components/devices/DeviceCard';
import { useAppStore, useAuthStore } from '@/lib/store';
import { useIsDemo, guardDemoAction } from '@/lib/demoGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Filter, Download, Grid3X3, List, Building2, ShoppingCart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import DeviceFormModal from '@/components/modals/DeviceFormModal';
import UpgradeOrderModal from '@/components/modals/UpgradeOrderModal';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStatusColor, getStatusLabel, getDeviceIcon, formatDate } from '@/lib/utils-geo';
import { MapPin, Battery, Signal, Gauge, ExternalLink, MoreHorizontal, Eye } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useI18n } from '@/lib/i18n';

const DevicesPage = () => {
  const { user } = useAuthStore();
  const isDemo = useIsDemo();
  const { t } = useI18n();
  const { devices, enterprises, searchQuery, setSearchQuery, statusFilter, setStatusFilter, selectedDevice } = useAppStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [enterpriseFilter, setEnterpriseFilter] = useState<string>('all');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL parameters when they change
  useEffect(() => {
    const defaultEnterpriseId = searchParams.get('enterpriseId');
    const defaultStatus = searchParams.get('status');
    
    if (defaultEnterpriseId && defaultEnterpriseId !== 'all') {
      setEnterpriseFilter(defaultEnterpriseId);
    }
    if (defaultStatus && defaultStatus !== 'all') {
      setStatusFilter(defaultStatus as any);
    }
  }, [searchParams, setStatusFilter]);

  // Filter devices based on enterprise filter and other filters
  const getFilteredDevices = () => {
    let filtered = devices;

    // Filter by user's enterprise if operator
    if (user?.role === 'operator' && user.enterpriseId) {
      filtered = filtered.filter(d => d.enterpriseId === user.enterpriseId);
    }

    // Filter by selected enterprise
    if (enterpriseFilter !== 'all') {
      filtered = filtered.filter(d => d.enterpriseId === enterpriseFilter);
    }

    // Filter by search query (includes IMEI, subscriberNumber)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d =>
        d.name.toLowerCase().includes(query) ||
        d.imei.toLowerCase().includes(query) ||
        d.serialNumber.toLowerCase().includes(query) ||
        (d.subscriberNumber && d.subscriberNumber.toLowerCase().includes(query)) ||
        d.enterpriseName.toLowerCase().includes(query) ||
        d.location.address.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter === 'connected' || statusFilter === 'online') {
      filtered = filtered.filter(d => ['online', 'moving', 'idle'].includes(d.status));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter);
    }

    return filtered;
  };

  const filteredDevices = getFilteredDevices();

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">
                {user?.role === 'operator' ? t('dash.myDevices') : t('devices.title')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {filteredDevices.length} {filteredDevices.length !== 1 ? t('devicesPage.deviceCountPlural') : t('devicesPage.deviceCount')}
                {enterpriseFilter !== 'all' && ` • ${enterprises.find(e => e.id === enterpriseFilter)?.name}`}
                {user?.enterpriseName && ` • ${user.enterpriseName}`}
              </p>
            </div>
            {user?.role === 'admin' && (
              <Button variant="hero" onClick={() => guardDemoAction(isDemo, () => setAddModalOpen(true))}>
                <Plus className="w-4 h-4 mr-2" />
                {t('devicesPage.addDevice')}
              </Button>
            )}
            {user?.role === 'operator' && (
              <Button
                variant="hero"
                className="gap-2 shadow-lg"
                onClick={() => guardDemoAction(isDemo, () => setUpgradeModalOpen(true))}
              >
                <ShoppingCart className="w-4 h-4" />
                {t('devicesPage.orderDevices')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-0"
              />
            </div>

            {/* Enterprise Filter */}
            {user?.role !== 'operator' && (
              <Select value={enterpriseFilter} onValueChange={setEnterpriseFilter}>
                <SelectTrigger className="w-56 bg-secondary/50 border-0">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('devicesPage.enterprise')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('devicesPage.allEnterprises')}</SelectItem>
                  {enterprises.map((ent) => (
                    <SelectItem key={ent.id} value={ent.id}>
                      {ent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-secondary/50 border-0">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('devicesPage.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="connected">Tous Connectés</SelectItem>
                <SelectItem value="online">En ligne</SelectItem>
                <SelectItem value="moving">En mouvement</SelectItem>
                <SelectItem value="idle">À l'arrêt</SelectItem>
                <SelectItem value="offline">Hors ligne</SelectItem>
                <SelectItem value="alert">Alerte</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center border border-border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              {t('devicesPage.export')}
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {filteredDevices.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Aucun appareil trouvé</h3>
              <p className="text-muted-foreground max-w-md">
                Modifiez vos filtres ou ajoutez de nouveaux appareils.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  isSelected={selectedDevice?.id === device.id}
                  onClick={() => navigate(`/devices/${device.imei}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-[250px]">{t('devicesPage.tableDevice')}</TableHead>
                    <TableHead className="text-muted-foreground">Localisation</TableHead>
                    <TableHead className="text-muted-foreground">Télémétrie</TableHead>
                    <TableHead className="text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-muted-foreground text-right">{t('devicesPage.tableActions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((device) => {
                    const DeviceIcon = getDeviceIcon(device.deviceType);
                    return (
                      <TableRow
                        key={device.id}
                        className="border-border/50 cursor-pointer hover:bg-secondary/50 group"
                        onClick={() => navigate(`/devices/${device.imei}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform",
                              device.status === 'alert' ? 'bg-destructive/10' : 'bg-primary/10'
                            )}>
                              <DeviceIcon className={cn(
                                "w-5 h-5",
                                device.status === 'alert' ? 'text-destructive' : 'text-primary'
                              )} />
                            </div>
                            <div>
                              <p className="font-semibold line-clamp-1">{device.name}</p>
                              <div className="flex flex-col gap-0.5 mt-1">
                                <span className="text-xs text-muted-foreground">IMEI: {device.imei}</span>
                                {device.subscriberNumber && <span className="text-xs text-muted-foreground">SIM: {device.subscriberNumber}</span>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 w-full max-w-[420px] min-w-0">
                            <div className="flex items-start gap-1.5 text-sm min-w-0">
                              <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                              <span className="line-clamp-2 text-muted-foreground break-words">{device.location.address}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 pl-5">
                              Relevé: {formatDate(device.lastUpdate)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground bg-secondary/10 px-3 py-2 rounded-lg ring-1 ring-border/50 inline-flex group-hover:bg-secondary/30 transition-colors shadow-sm">
                            <div className="flex items-center gap-1.5">
                              <Gauge className="w-3.5 h-3.5 text-primary" />
                              <span className="font-medium">{device.speed} <span className="text-[10px]">km/h</span></span>
                            </div>
                            <div className="w-px h-3 bg-border" />
                            <div className="flex items-center gap-1.5">
                              <Battery className="w-3.5 h-3.5 text-success" />
                              <span className="font-medium">{device.battery}%</span>
                            </div>
                            <div className="w-px h-3 bg-border" />
                            <div className="flex items-center gap-1.5">
                              <Signal className="w-3.5 h-3.5 text-info" />
                              <span className="font-medium">{device.signal}%</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary" 
                            className={cn(getStatusColor(device.status), device.status === 'offline' ? 'text-muted-foreground opacity-80' : 'text-white')}
                          >
                            {getStatusLabel(device.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="hover:bg-background h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/devices/${device.imei}`); }}>
                                <Eye className="w-4 h-4 mr-2" />
                                Ouvrir
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${device.location.lat},${device.location.lng}`, '_blank'); }}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Google Maps
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <DeviceFormModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />
      <UpgradeOrderModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
      />
    </DashboardLayout>
  );
};

export default DevicesPage;
