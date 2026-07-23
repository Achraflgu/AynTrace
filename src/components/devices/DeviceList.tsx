import { Device } from '@/lib/types';
import DeviceCard from './DeviceCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';

interface DeviceListProps {
  devices: Device[];
  selectedDevice?: Device | null;
  onDeviceSelect?: (device: Device) => void;
  compact?: boolean;
}

const DeviceList = ({ devices, selectedDevice, onDeviceSelect, compact = false }: DeviceListProps) => {
  const { searchQuery, setSearchQuery, statusFilter, setStatusFilter } = useAppStore();

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 space-y-3 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un appareil..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50 border-0 focus-visible:ring-1"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="bg-secondary/50 border-0">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filtrer par statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="online">En ligne</SelectItem>
            <SelectItem value="moving">En mouvement</SelectItem>
            <SelectItem value="idle">À l'arrêt</SelectItem>
            <SelectItem value="offline">Hors ligne</SelectItem>
            <SelectItem value="alert">Alerte</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1">
        <div className={compact ? "p-2 space-y-1" : "p-4 space-y-3"}>
          {devices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aucun appareil trouvé
            </p>
          ) : (
            devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isSelected={selectedDevice?.id === device.id}
                onClick={() => onDeviceSelect?.(device)}
                compact={compact}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border/50 bg-secondary/30">
        <p className="text-xs text-muted-foreground text-center">
          {devices.length} appareil{devices.length !== 1 ? 's' : ''} affiché{devices.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default DeviceList;
