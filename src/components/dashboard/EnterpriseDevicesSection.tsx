import { useState, useEffect } from 'react';
import { Enterprise, Device } from '@/lib/types';
import { useAppStore, useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { getStatusColor, toEnterpriseSlug } from '@/lib/utils-geo';
import { Building2, ChevronDown, ChevronRight, Radio, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DeviceCard from '@/components/devices/DeviceCard';
import { useNavigate } from 'react-router-dom';

interface EnterpriseDevicesSectionProps {
    onDeviceSelect?: (device: Device) => void;
    selectedDevice?: Device | null;
    onEnterpriseToggle?: (enterpriseId: string | null) => void;
}

const EnterpriseDevicesSection = ({ onDeviceSelect, selectedDevice, onEnterpriseToggle }: EnterpriseDevicesSectionProps) => {
    const { enterprises, getFilteredDevices, searchQuery, statusFilter } = useAppStore();
    const { user } = useAuthStore();
    const navigate = useNavigate();

    // Get filtered devices (includes search and status filter from store)
    const allFilteredDevices = getFilteredDevices();

    // Filter enterprises and devices based on user role
    const isOperator = user?.role === 'operator';
    const userEnterpriseId = user?.enterpriseId;

    // For operators, only show their enterprise
    const availableEnterprises = isOperator && userEnterpriseId
        ? enterprises.filter(e => e.id === userEnterpriseId)
        : enterprises;

    // Use filtered devices (already filtered by search/status in store)
    const availableDevices = isOperator && userEnterpriseId
        ? allFilteredDevices.filter(d => d.enterpriseId === userEnterpriseId)
        : allFilteredDevices;

    // Only one enterprise expanded at a time (accordion behavior)
    const [expandedEnterprise, setExpandedEnterprise] = useState<string | null>(null);

    // Use store's enterprise filter
    const { enterpriseFilter, setEnterpriseFilter } = useAppStore();

    // Auto-expand enterprise when a device is selected
    useEffect(() => {
        if (selectedDevice && selectedDevice.enterpriseId !== expandedEnterprise) {
            setExpandedEnterprise(selectedDevice.enterpriseId);
            onEnterpriseToggle?.(selectedDevice.enterpriseId);
        }
    }, [selectedDevice]);

    const toggleEnterprise = (enterpriseId: string) => {
        // Accordion behavior: clicking same enterprise closes it, different one opens it
        const newExpanded = expandedEnterprise === enterpriseId ? null : enterpriseId;
        setExpandedEnterprise(newExpanded);
        onEnterpriseToggle?.(newExpanded);
    };

    const getDevicesForEnterprise = (enterpriseId: string) => {
        return availableDevices.filter(d => d.enterpriseId === enterpriseId);
    };

    const getDeviceStats = (enterpriseDevices: Device[]) => {
        const online = enterpriseDevices.filter(d => d.status === 'online' || d.status === 'moving' || d.status === 'idle').length;
        const alerts = enterpriseDevices.filter(d => d.status === 'alert').length;
        return { total: enterpriseDevices.length, online, alerts };
    };

    // Filter enterprises - when enterprise filter is selected, show only that one
    // When searching/status filtering, only show enterprises with matching devices
    const filteredEnterprises = enterpriseFilter !== 'all'
        ? availableEnterprises.filter(e => e.id === enterpriseFilter)
        : availableEnterprises.filter(e => {
            if (searchQuery || statusFilter !== 'all') {
                return getDevicesForEnterprise(e.id).length > 0;
            }
            return true;
        });

    return (
        <div className="flex flex-col h-full">
            {/* Filter - only show for non-operators */}
            {!isOperator && (
                <div className="p-4 border-b border-border/50">
                    <Select value={enterpriseFilter} onValueChange={setEnterpriseFilter}>
                        <SelectTrigger className="bg-secondary/50 border-0">
                            <Building2 className="w-4 h-4 mr-2" />
                            <SelectValue placeholder="Filtrer par entreprise" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toutes les entreprises</SelectItem>
                            {availableEnterprises.map(enterprise => (
                                <SelectItem key={enterprise.id} value={enterprise.id}>
                                    {enterprise.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Header for operators */}
            {isOperator && user?.enterpriseName && (
                <div className="p-4 border-b border-border/50 bg-primary/5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{user.enterpriseName}</h3>
                            <p className="text-xs text-muted-foreground">{availableDevices.length} appareil{availableDevices.length !== 1 ? 's' : ''}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* List - Different view for operator vs admin/supervisor */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                    {isOperator ? (
                        // Operator: Flat device list (no enterprise grouping)
                        availableDevices.length > 0 ? (
                            availableDevices.map(device => (
                                <DeviceCard
                                    key={device.id}
                                    device={device}
                                    isSelected={selectedDevice?.id === device.id}
                                    onClick={() => onDeviceSelect?.(device)}
                                    compact
                                />
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">
                                Aucun appareil trouvé
                            </p>
                        )
                    ) : (
                        // Admin/Supervisor: Enterprise grouping
                        filteredEnterprises.map(enterprise => {
                            const enterpriseDevices = getDevicesForEnterprise(enterprise.id);
                            const stats = getDeviceStats(enterpriseDevices);
                            const isExpanded = expandedEnterprise === enterprise.id;

                            return (
                                <div key={enterprise.id} className="rounded-lg border border-border/50 overflow-hidden bg-card/50">
                                    {/* Enterprise Header - simpler */}
                                    <div
                                        className="p-3 cursor-pointer hover:bg-secondary/30 transition-colors flex items-center justify-between"
                                        onClick={() => toggleEnterprise(enterprise.id)}
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                                            )}
                                            <Building2 className="w-4 h-4 text-primary shrink-0" />
                                            <span className="font-medium text-sm truncate">{enterprise.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge variant="outline" className="text-xs">
                                                {stats.total}
                                            </Badge>
                                            {stats.online > 0 && (
                                                <span className="w-2 h-2 rounded-full bg-success" title={`${stats.online} en ligne`} />
                                            )}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/enterprises/${toEnterpriseSlug(enterprise.name, enterprise.imeiPrefix)}`);
                                                }}
                                                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"
                                                title="Voir les détails"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Devices List */}
                                    {isExpanded && enterpriseDevices.length > 0 && (
                                        <div className="border-t border-border/50 p-3 bg-secondary/10 space-y-2">
                                            {enterpriseDevices.map(device => (
                                                <DeviceCard
                                                    key={device.id}
                                                    device={device}
                                                    isSelected={selectedDevice?.id === device.id}
                                                    onClick={() => onDeviceSelect?.(device)}
                                                    compact
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {isExpanded && enterpriseDevices.length === 0 && (
                                        <div className="border-t border-border/50 p-4 bg-secondary/10">
                                            <p className="text-sm text-muted-foreground text-center">
                                                Aucun appareil pour cette entreprise
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>

            {/* Footer */}
            <div className="p-3 border-t border-border/50 bg-secondary/30">
                <p className="text-xs text-muted-foreground text-center">
                    {isOperator
                        ? `${availableDevices.length} appareil${availableDevices.length !== 1 ? 's' : ''}`
                        : `${filteredEnterprises.length} entreprise${filteredEnterprises.length !== 1 ? 's' : ''} • ${availableDevices.length} appareil${availableDevices.length !== 1 ? 's' : ''}`
                    }
                </p>
            </div>
        </div>
    );
};

export default EnterpriseDevicesSection;
