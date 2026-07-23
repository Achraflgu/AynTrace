import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Navigation, AlertTriangle, Activity } from 'lucide-react';
import { Device } from '@/lib/types';

// Calculate stats from devices array
const getStats = (devices: Device[]) => {
  const total = devices.length;
  const online = devices.filter(d => d.status === 'online' || d.status === 'moving' || d.status === 'idle').length;
  const offline = devices.filter(d => d.status === 'offline').length;
  const moving = devices.filter(d => d.status === 'moving').length;
  return { total, online, offline, moving };
};

const StatsBar = () => {
  const { devices, alerts } = useAppStore();
  const stats = getStats(devices);
  // Calculate unread alerts directly from alerts array
  const unreadAlerts = alerts.filter(a => !a.read).length;

  const statItems = [
    {
      label: 'Total',
      value: stats.total,
      icon: Activity,
      color: 'text-foreground',
      bgColor: 'bg-secondary'
    },
    {
      label: 'En ligne',
      value: stats.online,
      icon: Wifi,
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      label: 'En mouvement',
      value: stats.moving,
      icon: Navigation,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      label: 'Hors ligne',
      value: stats.offline,
      icon: WifiOff,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted'
    },
    {
      label: 'Alertes',
      value: unreadAlerts,
      icon: AlertTriangle,
      color: unreadAlerts > 0 ? 'text-destructive' : 'text-muted-foreground',
      bgColor: unreadAlerts > 0 ? 'bg-destructive/10' : 'bg-muted'
    },
  ];

  return (
    <div className="flex items-center gap-2 p-2 bg-card/50 backdrop-blur-sm rounded-xl border border-border/50">
      {statItems.map((item, index) => (
        <div
          key={item.label}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
            item.bgColor
          )}
        >
          <item.icon className={cn("w-4 h-4", item.color)} />
          <div className="flex flex-col">
            <span className={cn("text-lg font-bold leading-none", item.color)}>
              {item.value}
            </span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsBar;
