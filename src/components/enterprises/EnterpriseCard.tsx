import { Enterprise } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Mail, Phone, MapPin, Radio, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/store';

interface EnterpriseCardProps {
    enterprise: Enterprise;
    onClick: () => void;
}

const EnterpriseCard = ({ enterprise, onClick }: EnterpriseCardProps) => {
    const { devices } = useAppStore();
    const entDevices = devices.filter(d => d.enterpriseId === enterprise.id);
    const online = entDevices.filter(d => ['online', 'moving', 'idle'].includes(d.status)).length;
    const offline = entDevices.length - online;

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-success text-success-foreground hover:bg-success">Actif</Badge>;
            case 'suspended':
                return <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">Suspendu</Badge>;
            case 'pending':
                return <Badge className="bg-warning text-warning-foreground hover:bg-warning">En attente</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <Card
            className="group cursor-pointer glass-card border-0 hover:ring-1 hover:ring-primary/30 transition-all hover:-translate-y-1"
            onClick={onClick}
        >
            <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg line-clamp-1">{enterprise.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                                {getStatusBadge(enterprise.status)}
                                <span className="text-[10px] text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full">
                                    <Calendar className="w-3 h-3 inline mr-1" />
                                    {new Date(enterprise.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="line-clamp-1">{enterprise.address}</span>
                    </div>
                    {(enterprise.contactEmail || enterprise.phone) && (
                        <div className="flex items-center gap-4 text-sm text-muted-foreground border-t border-border/50 pt-3">
                            {enterprise.contactEmail && (
                                <div className="flex items-center gap-1.5 line-clamp-1 flex-1">
                                    <Mail className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{enterprise.contactEmail}</span>
                                </div>
                            )}
                            {enterprise.phone && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Phone className="w-3 h-3" />
                                    <span>{enterprise.phone}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Device Stats Footer */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-secondary/10 border border-border/30">
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] text-muted-foreground uppercase mb-0.5 flex items-center gap-1"><Radio className="w-3 h-3" /> Total</span>
                        <span className="font-bold text-base leading-none">{entDevices.length}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border/50">
                        <span className="text-[10px] text-success uppercase mb-0.5">En Ligne</span>
                        <span className="font-bold text-base leading-none text-success">{online}</span>
                    </div>
                    <div className="flex flex-col items-center border-l border-border/50">
                        <span className="text-[10px] text-destructive uppercase mb-0.5">Hors Ligne</span>
                        <span className="font-bold text-base leading-none text-destructive">{offline}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default EnterpriseCard;
