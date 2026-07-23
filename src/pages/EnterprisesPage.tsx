import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAppStore, useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Building2, Radio, MoreHorizontal, Eye, Edit, Trash2, Filter, Grid3X3, List, Download } from 'lucide-react';
import EnterpriseCard from '@/components/enterprises/EnterpriseCard';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Navigate, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import EnterpriseFormModal from '@/components/modals/EnterpriseFormModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import { Enterprise } from '@/lib/types';
import { toast } from 'sonner';
import { toEnterpriseSlug } from '@/lib/utils-geo';


const EnterprisesPage = () => {
  const { user } = useAuthStore();
  const { enterprises, devices, deleteEnterprise } = useAppStore();
  const navigate = useNavigate();
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const filteredEnterprises = enterprises.filter((ent) => {
    const matchesSearch = ent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ent.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Only admin and supervisor can access
  if (user?.role === 'operator') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleEdit = (enterprise: Enterprise) => {
    setSelectedEnterprise(enterprise);
    setFormModalOpen(true);
  };

  const handleDelete = (enterprise: Enterprise) => {
    setSelectedEnterprise(enterprise);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedEnterprise) {
      deleteEnterprise(selectedEnterprise.id);
      toast.success('Entreprise supprimée');
      setDeleteModalOpen(false);
    }
  };

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

  const exportCSV = () => {
    const headers = ['Entreprise', 'Email', 'Téléphone', 'Adresse', 'Statut', 'Date Inscription', 'Préfixe IMEI', 'Préfixe Série'];
    const rows = filteredEnterprises.map(e => [
      e.name, e.contactEmail, e.phone, e.address, e.status, new Date(e.createdAt).toLocaleDateString('fr-FR'), e.imeiPrefix || '', e.serialPrefix || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `enterprises_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Entreprises</h1>
              <p className="text-sm text-muted-foreground">
                {enterprises.length} entreprise{enterprises.length !== 1 ? 's' : ''} enregistrée{enterprises.length !== 1 ? 's' : ''}
              </p>
            </div>
            {user?.role === 'admin' && (
              <Button variant="hero" onClick={() => { setSelectedEnterprise(null); setFormModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle entreprise
              </Button>
            )}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, email, adresse)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-secondary/50 border-0"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48 bg-secondary/50 border-0">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="suspended">Suspendu</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center border border-border rounded-lg p-1 shrink-0">
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

            <Button variant="outline" className="shrink-0" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exporter
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {filteredEnterprises.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-20">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Aucune entreprise trouvée</h3>
              <p className="text-muted-foreground max-w-md">
                Essayez de modifier vos filtres ou ajoutez une nouvelle entreprise.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredEnterprises.map((enterprise) => (
                <EnterpriseCard
                  key={enterprise.id}
                  enterprise={enterprise}
                  onClick={() => navigate(`/enterprises/${toEnterpriseSlug(enterprise.name, enterprise.imeiPrefix)}`)}
                />
              ))}
            </div>
          ) : (
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Entreprise</TableHead>
                    <TableHead className="text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-muted-foreground">Appareils</TableHead>
                    <TableHead className="text-muted-foreground">Statut</TableHead>
                    <TableHead className="text-muted-foreground">Date d'inscription</TableHead>
                    {user?.role === 'admin' && (
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnterprises.map((enterprise) => {
                    const entDevices = devices.filter(d => d.enterpriseId === enterprise.id);
                    const online = entDevices.filter(d => ['online', 'moving', 'idle'].includes(d.status)).length;
                    const offline = entDevices.length - online;

                    return (
                      <TableRow
                        key={enterprise.id}
                        className="border-border/50 cursor-pointer hover:bg-secondary/50 group"
                        onClick={() => navigate(`/enterprises/${toEnterpriseSlug(enterprise.name, enterprise.imeiPrefix)}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                              <Building2 className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-semibold">{enterprise.name}</p>
                              <p className="text-sm text-muted-foreground line-clamp-1">{enterprise.address}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-sm">{enterprise.contactEmail}</p>
                            <p className="text-sm text-muted-foreground">{enterprise.phone}</p>
                            <div className="flex flex-wrap gap-1 mt-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground bg-secondary/30">IMEI: {enterprise.imeiPrefix || '35907'}</Badge>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground bg-secondary/30">SÉRIE: {enterprise.serialPrefix || 'GT'}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 text-sm bg-secondary/10 px-3 py-2 rounded-lg ring-1 ring-border/50 inline-block w-full max-w-[150px] group-hover:bg-secondary/30 transition-colors shadow-sm">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total</span>
                              <span className="font-bold text-xs">{entDevices.length}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">En ligne</span>
                              <span className="font-bold text-success text-xs">{online}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Hors ligne</span>
                              <span className="font-bold text-destructive text-xs">{offline}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(enterprise.status)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-medium">
                          {new Date(enterprise.createdAt).toLocaleDateString('fr-FR')}
                        </TableCell>
                        {user?.role === 'admin' && (
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="hover:bg-background">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/enterprises/${toEnterpriseSlug(enterprise.name, enterprise.imeiPrefix)}`); }}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  Voir les détails
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(enterprise); }}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Modifier
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleDelete(enterprise); }}>
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <EnterpriseFormModal
        open={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        enterprise={selectedEnterprise}
      />

      <ConfirmDeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer l'entreprise"
        description={`Êtes-vous sûr de vouloir supprimer "${selectedEnterprise?.name}" ?`}
      />
    </DashboardLayout>
  );
};

export default EnterprisesPage;
