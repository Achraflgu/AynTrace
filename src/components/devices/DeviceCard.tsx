import { Device } from '@/lib/types';
import { getStatusColor, getStatusLabel, formatDate, getDeviceIcon } from '@/lib/utils-geo';
import { cn } from '@/lib/utils';
import { MapPin, Battery, Signal, Gauge, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DeviceCardProps {
  device: Device;
  isSelected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

const DeviceCard = ({ device, isSelected, onClick, compact = false }: DeviceCardProps) => {
  const DeviceIcon = getDeviceIcon(device.deviceType);
  const navigate = useNavigate();

  const handleDetailClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/devices/${device.imei}`);
  };

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200",
          "hover:bg-secondary/80",
          isSelected ? "bg-primary/10 border border-primary/30" : "bg-card border border-transparent"
        )}
      >
        <div className={cn("w-3 h-3 rounded-full", getStatusColor(device.status))} />
        <DeviceIcon className="w-4 h-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{device.name}</p>
        </div>
        {device.status === 'moving' && (
          <span className="text-xs text-primary font-medium">{device.speed} km/h</span>
        )}
        <button
          onClick={handleDetailClick}
          className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
          title="Voir les détails"
        >
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "glass-card p-4 cursor-pointer transition-all duration-300 hover:shadow-lg",
        isSelected && "ring-2 ring-primary glow-primary"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            device.status === 'alert' ? 'bg-destructive/10' : 'bg-primary/10'
          )}>
            <DeviceIcon className={cn(
              "w-5 h-5",
              device.status === 'alert' ? 'text-destructive' : 'text-primary'
            )} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{device.name}</h3>
          </div>
           <p className="text-xs text-muted-foreground">
              
              {device.serialNumber} {device.subscriberNumber && `• SIM: ${device.subscriberNumber}`}
            </p>
        </div>
        <div className={cn(
          "inline-flex max-w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap shadow-sm",
          getStatusColor(device.status),
          device.status === 'offline' ? 'text-muted-foreground dark:text-slate-300' : 'text-white dark:text-white'
        )}>
          {getStatusLabel(device.status)}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
          <MapPin className="w-4 h-4" />
          <span className="line-clamp-2 break-words">{device.location.address}</span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Gauge className="w-3.5 h-3.5" />
            <span>{device.speed} km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <Battery className="w-3.5 h-3.5" />
            <span>{device.battery}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Signal className="w-3.5 h-3.5" />
            <span>{device.signal}%</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
          {device.enterpriseName} • {formatDate(device.lastUpdate)}
        </p>
      </div>
    </div>
  );
};

export default DeviceCard;
