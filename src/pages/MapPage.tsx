import DashboardLayout from '@/components/layout/DashboardLayout';
import MapView from '@/components/map/MapView';
import EnterpriseDevicesSection from '@/components/dashboard/EnterpriseDevicesSection';
import { useAppStore, useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PanelRightClose, PanelRight, Search, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';

const MapPage = () => {
  const { user } = useAuthStore();
  const { devices, selectedDevice, setSelectedDevice, getFilteredDevices, searchQuery, setSearchQuery } = useAppStore();

  // Filter devices by operator's enterprise
  const roleDevices = user?.role === 'operator' && user?.enterpriseId
    ? devices.filter(d => d.enterpriseId === user.enterpriseId)
    : devices;

  const filteredDevices = user?.role === 'operator' && user?.enterpriseId
    ? getFilteredDevices().filter(d => d.enterpriseId === user.enterpriseId)
    : getFilteredDevices();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [focusEnterpriseId, setFocusEnterpriseId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Handle device query parameter - auto-select device from URL
  useEffect(() => {
    const deviceId = searchParams.get('device');
    if (deviceId) {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        setSelectedDevice(device);
      }
    }
  }, [searchParams, devices, setSelectedDevice]);

  return (
    <DashboardLayout>
      <div className="h-screen flex relative">
        {/* Map Container - always takes full width, sidebar overlays */}
        <div className="flex-1 relative">
          {/* Full screen map */}
          <MapView
            devices={filteredDevices}
            selectedDevice={selectedDevice}
            onDeviceSelect={setSelectedDevice}
            focusEnterpriseId={focusEnterpriseId}
            sidebarOpen={sidebarOpen}
            className="h-full w-full rounded-none"
          />

          {/* Floating controls - positioned above map */}
          <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
            {/* Toggle Sidebar Button */}
            <Button
              variant="secondary"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-card/95 backdrop-blur-sm shadow-lg hover:bg-card"
              title={sidebarOpen ? "Masquer le panneau" : "Afficher le panneau"}
            >
              {sidebarOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            </Button>

            {/* Search Bar */}
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" />
              <Input
                placeholder="Rechercher un appareil..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10 bg-card/95 backdrop-blur-sm border-0 shadow-lg"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-secondary"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Device count badge + Real-time indicator */}
          <div className="absolute bottom-4 left-4 z-50 flex items-center gap-2">
            <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredDevices.length}</span> appareil{filteredDevices.length !== 1 ? 's' : ''} sur la carte
                {searchQuery && <span className="text-primary"> (filtré)</span>}
              </p>
            </div>

            {/* Real-time delay indicator */}
            <div className="bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-medium">25s</span>
            </div>
          </div>
        </div>

        {/* Sidebar - Overlay on right side */}
        <div className={cn(
          "absolute top-0 right-0 bottom-0 w-96 bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-in-out z-40",
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        )}>
          {/* Sidebar Header */}
          <div className="h-14 px-4 flex items-center justify-between border-b border-border/50 bg-card">
            <h2 className="font-semibold">
              {user?.role === 'operator' ? 'Mes Appareils' : 'Appareils & Entreprises'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Sidebar Content - uses filtered devices from store */}
          <div className="h-[calc(100%-3.5rem)]">
            <EnterpriseDevicesSection
              selectedDevice={selectedDevice}
              onDeviceSelect={setSelectedDevice}
              onEnterpriseToggle={setFocusEnterpriseId}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MapPage;
