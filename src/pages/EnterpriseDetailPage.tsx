import { useParams, useNavigate } from 'react-router-dom';
import { findEnterpriseBySlug, toEnterpriseSlug } from '@/lib/utils-geo';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAppStore, useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ArrowLeft,
    Building2,
    Mail,
    Phone,
    MapPin,
    Calendar,
    Radio,
    Edit,
    Trash2,
    Users,
    Plus
} from 'lucide-react';
import DeviceCard from '@/components/devices/DeviceCard';
import { useState } from 'react';
import EnterpriseFormModal from '@/components/modals/EnterpriseFormModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import DeviceFormModal from '@/components/modals/DeviceFormModal';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EnterpriseDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const { enterprises, devices, deleteEnterprise, alerts } = useAppStore();

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deviceModalOpen, setDeviceModalOpen] = useState(false);

    const enterprise = findEnterpriseBySlug(enterprises, id || '');
    const enterpriseDevices = devices.filter(d => d.enterpriseId === enterprise?.id);

    if (!enterprise) {
        return (
            <DashboardLayout>
                <div className="h-screen flex items-center justify-center">
                    <div className="text-center">
                        <h2 className="text-xl font-bold mb-2">Entreprise non trouvée</h2>
                        <Button onClick={() => navigate('/enterprises')}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Retour aux entreprises
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        );
    }

    const handleDelete = () => {
        deleteEnterprise(enterprise.id);
        toast.success('Entreprise supprimée avec succès');
        navigate('/enterprises');
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-success text-success-foreground">Actif</Badge>;
            case 'suspended':
                return <Badge className="bg-destructive text-destructive-foreground">Suspendu</Badge>;
            case 'pending':
                return <Badge className="bg-warning text-warning-foreground">En attente</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const onlineDevices = enterpriseDevices.filter(d => d.status === 'online' || d.status === 'moving' || d.status === 'idle').length;
    const enterpriseAlertsCount = alerts.filter(a => !a.read && enterpriseDevices.some(d => d.id === a.deviceId || d.imei === a.deviceId)).length;

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
                                    <Building2 className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h1 className="text-xl font-bold">{enterprise.name}</h1>
                                        {getStatusBadge(enterprise.status)}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{enterprise.address}</p>
                                </div>
                            </div>
                        </div>

                        {user?.role === 'admin' && (
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => setEditModalOpen(true)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Modifier
                                </Button>
                                <Button variant="destructive" onClick={() => setDeleteModalOpen(true)}>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer
                                </Button>
                            </div>
                        )}
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="glass-card border-0 cursor-pointer hover:bg-secondary/20 transition-all hover:scale-[1.02] ring-1 ring-transparent hover:ring-primary/30" onClick={() => navigate(`/devices?enterpriseId=${enterprise.id}`)}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Radio className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Appareils</p>
                                        <p className="font-medium text-2xl">{enterpriseDevices.length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="glass-card border-0 cursor-pointer hover:bg-secondary/20 transition-all hover:scale-[1.02] ring-1 ring-transparent hover:ring-success/30" onClick={() => navigate(`/devices?enterpriseId=${enterprise.id}&status=connected`)}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                                        <Radio className="w-5 h-5 text-success" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">En ligne</p>
                                        <p className="font-medium text-2xl">{onlineDevices}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="glass-card border-0 cursor-pointer hover:bg-secondary/20 transition-all hover:scale-[1.02] ring-1 ring-transparent hover:ring-destructive/30" onClick={() => navigate(`/alerts?enterpriseId=${enterprise.id}`)}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                                        <Radio className="w-5 h-5 text-destructive" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Alertes non lues</p>
                                        <p className="font-medium text-2xl">{enterpriseAlertsCount}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="glass-card border-0">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <Users className="w-5 h-5 text-primary" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Statut</p>
                                        <p className="font-medium capitalize">{enterprise.status === 'active' ? 'Actif' : enterprise.status === 'pending' ? 'En attente' : 'Suspendu'}</p>
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
                                <div className="flex items-center gap-3">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <span>{enterprise.contactEmail}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <span>{enterprise.phone}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <MapPin className="w-4 h-4 text-muted-foreground" />
                                    <span>{enterprise.address}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="w-4 h-4 text-muted-foreground" />
                                    <span>Inscrit le {new Date(enterprise.createdAt).toLocaleDateString('fr-FR')}</span>
                                </div>

                                <div className="pt-3 mt-3 border-t border-border/50">
                                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Configuration Identifiants</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="bg-muted/30 p-2 rounded-lg text-center border border-border/30">
                                            <span className="text-xs text-muted-foreground block mb-1">Série</span>
                                            <span className="font-mono font-medium">{enterprise.serialPrefix || 'GT'}</span>
                                        </div>
                                        <div className="bg-muted/30 p-2 rounded-lg text-center border border-border/30">
                                            <span className="text-xs text-muted-foreground block mb-1">IMEI</span>
                                            <span className="font-mono font-medium">{enterprise.imeiPrefix || '35907'}</span>
                                        </div>
                                        <div className="bg-muted/30 p-2 rounded-lg text-center border border-border/30">
                                            <span className="text-xs text-muted-foreground block mb-1">Abonné</span>
                                            <span className="font-mono font-medium">{enterprise.subscriberPrefix || '500'}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="glass-card border-0">
                            <CardHeader>
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Radio className="w-5 h-5" />
                                    Résumé des appareils
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Total</span>
                                    <span className="font-medium">{enterpriseDevices.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">En ligne</span>
                                    <span className="font-medium text-success">{onlineDevices}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Hors ligne</span>
                                    <span className="font-medium">{enterpriseDevices.filter(d => d.status === 'offline').length}</span>
                                </div>
                                <div className="flex justify-between items-center group cursor-pointer hover:bg-secondary/30 p-1 -mx-1 rounded transition-colors" onClick={() => navigate(`/alerts?enterpriseId=${enterprise.id}`)}>
                                    <span className="text-muted-foreground group-hover:text-foreground">Alertes non lues</span>
                                    <span className="font-medium text-destructive">{enterpriseAlertsCount}</span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Devices */}
                    <Card className="glass-card border-0">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Radio className="w-5 h-5" />
                                Appareils ({enterpriseDevices.length})
                            </CardTitle>
                            {user?.role === 'admin' && (
                                <Button size="sm" onClick={() => setDeviceModalOpen(true)} className="bg-[#039C51] text-white hover:bg-[#00D48A] gap-1.5 h-8">
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Ajouter un appareil</span>
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent>
                            {enterpriseDevices.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">
                                    Aucun appareil pour cette entreprise
                                </p>
                            ) : (
                                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                                    {enterpriseDevices.map((device) => (
                                        <DeviceCard
                                            key={device.id}
                                            device={device}
                                            onClick={() => navigate(`/devices/${device.imei}`)}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            <EnterpriseFormModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                enterprise={enterprise}
            />

            <DeviceFormModal
                open={deviceModalOpen}
                onClose={() => setDeviceModalOpen(false)}
                initialEnterpriseId={enterprise.id}
            />

            <ConfirmDeleteModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="Supprimer l'entreprise"
                description={`Êtes-vous sûr de vouloir supprimer "${enterprise.name}" ? Cette action est irréversible.`}
            />
        </DashboardLayout >
    );
};

export default EnterpriseDetailPage;
