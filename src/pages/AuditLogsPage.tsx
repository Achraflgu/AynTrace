import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore, useAppStore } from '@/lib/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
    Search, Download, History, User, Building2, Radio, Shield,
    LogIn, LogOut, Trash2, Edit, Loader2, X, ShoppingCart,
    HeadphonesIcon, CreditCard, MapPin, Bell, FileText
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { auditApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AuditLog {
    id: string;
    action: string;
    userId: string;
    userName: string;
    targetType: string | null;
    targetId: string | null;
    targetName: string | null;
    timestamp: string;
    ip: string;
}

const ACTION_CATEGORIES = [
    { value: 'all',        label: 'Toutes les actions',  color: '' },
    { value: 'login',      label: '🔐 Connexions',        color: 'text-green-500' },
    { value: 'logout',     label: '🚪 Déconnexions',      color: 'text-slate-400' },
    { value: 'create',     label: '➕ Créations',         color: 'text-blue-500' },
    { value: 'update',     label: '✏️ Modifications',     color: 'text-yellow-500' },
    { value: 'delete',     label: '🗑️ Suppressions',      color: 'text-red-500' },
    { value: 'device',     label: '📡 Appareils',         color: 'text-primary' },
    { value: 'enterprise', label: '🏢 Entreprises',       color: 'text-purple-500' },
    { value: 'user',       label: '👤 Utilisateurs',      color: 'text-cyan-500' },
    { value: 'order',      label: '🛒 Commandes',         color: 'text-[#142945]' },
    { value: 'support',    label: '🎧 Support',           color: 'text-pink-500' },
    { value: 'geofence',   label: '📍 Geofences',         color: 'text-teal-500' },
    { value: 'alert',      label: '🔔 Alertes',           color: 'text-[#142945]' },
];

const getActionIcon = (action: string) => {
    if (action.includes('login'))      return <LogIn className="w-3.5 h-3.5" />;
    if (action.includes('logout'))     return <LogOut className="w-3.5 h-3.5" />;
    if (action.includes('delete'))     return <Trash2 className="w-3.5 h-3.5" />;
    if (action.includes('update') || action.includes('edit')) return <Edit className="w-3.5 h-3.5" />;
    if (action.includes('device'))     return <Radio className="w-3.5 h-3.5" />;
    if (action.includes('enterprise')) return <Building2 className="w-3.5 h-3.5" />;
    if (action.includes('user'))       return <User className="w-3.5 h-3.5" />;
    if (action.includes('order'))      return <ShoppingCart className="w-3.5 h-3.5" />;
    if (action.includes('support'))    return <HeadphonesIcon className="w-3.5 h-3.5" />;
    if (action.includes('billing') || action.includes('payment')) return <CreditCard className="w-3.5 h-3.5" />;
    if (action.includes('geofence'))   return <MapPin className="w-3.5 h-3.5" />;
    if (action.includes('alert'))      return <Bell className="w-3.5 h-3.5" />;
    if (action.includes('supervisor')) return <Shield className="w-3.5 h-3.5" />;
    if (action.includes('create'))     return <FileText className="w-3.5 h-3.5" />;
    return <History className="w-3.5 h-3.5" />;
};

const getActionBadge = (action: string) => {
    if (action.includes('login'))   return <Badge className="bg-green-500/15 text-green-400 border-green-500/20">Connexion</Badge>;
    if (action.includes('logout'))  return <Badge className="bg-slate-500/15 text-slate-400 border-slate-500/20">Déconnexion</Badge>;
    if (action.includes('create'))  return <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20">Création</Badge>;
    if (action.includes('update'))  return <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/20">Modification</Badge>;
    if (action.includes('delete'))  return <Badge className="bg-red-500/15 text-red-400 border-red-500/20">Suppression</Badge>;
    if (action.includes('view'))    return <Badge className="bg-secondary text-muted-foreground">Consultation</Badge>;
    return <Badge variant="secondary" className="text-xs">{action.replace('.', ' › ')}</Badge>;
};

const AuditLogsPage = () => {
    const { user } = useAuthStore();
    const [actionFilter, setActionFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const auditLogs = useAppStore(s => s.auditLogs);
    const fetchAuditLogs = useAppStore(s => s.fetchAuditLogs);
    const [isLoading, setIsLoading] = useState(true);
    const [displayedCount, setDisplayedCount] = useState(50);

    useEffect(() => {
        setDisplayedCount(50);
    }, [searchQuery, actionFilter, userFilter]);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                await fetchAuditLogs();
            } catch (error) {
                console.error('Failed to fetch audit logs:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLogs();
    }, [fetchAuditLogs]);

    // Unique users from logs for filter dropdown
    const uniqueUsers = useMemo(() => {
        const map = new Map<string, string>();
        auditLogs.forEach(l => {
            if (l.userName) map.set(l.userName, l.userName);
        });
        return Array.from(map.values()).sort();
    }, [auditLogs]);

    const filteredLogs = useMemo(() => auditLogs.filter(log => {
        if (actionFilter !== 'all' && !log.action?.toLowerCase().includes(actionFilter.toLowerCase())) return false;
        if (userFilter !== 'all' && log.userName !== userFilter) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                log.userName?.toLowerCase().includes(q) ||
                log.action?.toLowerCase().includes(q) ||
                log.targetName?.toLowerCase().includes(q) ||
                log.ip?.toLowerCase().includes(q)
            );
        }
        return true;
    }), [auditLogs, actionFilter, userFilter, searchQuery]);

    const visibleLogs = filteredLogs.slice(0, displayedCount);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop <= el.clientHeight + 150) {
            if (displayedCount < filteredLogs.length) {
                setDisplayedCount(prev => prev + 50);
            }
        }
    };

    const clearFilters = () => {
        setActionFilter('all');
        setUserFilter('all');
        setSearchQuery('');
    };

    const hasFilters = actionFilter !== 'all' || userFilter !== 'all' || searchQuery;

    const formatTimestamp = (ts: string) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleString('fr-FR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Export CSV
    const handleExport = () => {
        const headers = ['Date/Heure', 'Utilisateur', 'Action', 'Cible', 'IP'];
        const rows = filteredLogs.map(l => [
            formatTimestamp(l.timestamp),
            l.userName || '',
            l.action || '',
            l.targetName || '',
            l.ip || ''
        ]);
        const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (user?.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return (
        <DashboardLayout>
            <div className="h-screen flex flex-col">
                {/* Header */}
                <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-xl font-bold">Journal d'audit</h1>
                            <p className="text-sm text-muted-foreground">
                                <span className="font-semibold text-foreground">{filteredLogs.length}</span>
                                {filteredLogs.length !== auditLogs.length && (
                                    <span className="text-muted-foreground/60"> / {auditLogs.length}</span>
                                )}
                                {' '}événements enregistrés
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {hasFilters && (
                                <Button
                                    variant="ghost" size="sm"
                                    onClick={clearFilters}
                                    className="text-muted-foreground hover:text-destructive gap-1.5"
                                >
                                    <X className="w-3.5 h-3.5" />
                                    Effacer filtres
                                </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <Download className="w-4 h-4 mr-2" />
                                Exporter CSV
                            </Button>
                        </div>
                    </div>

                    {/* Filters row */}
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Search */}
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-secondary/50 border-0 h-9"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Action filter */}
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className={cn(
                                "w-52 bg-secondary/50 border-0 h-9",
                                actionFilter !== 'all' && "ring-1 ring-primary/50 bg-primary/5"
                            )}>
                                <SelectValue placeholder="Type d'action" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72">
                                {ACTION_CATEGORIES.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        <span className={cat.color}>{cat.label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* User filter */}
                        <Select value={userFilter} onValueChange={setUserFilter}>
                            <SelectTrigger className={cn(
                                "w-48 bg-secondary/50 border-0 h-9",
                                userFilter !== 'all' && "ring-1 ring-primary/50 bg-primary/5"
                            )}>
                                <User className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                <SelectValue placeholder="Utilisateur" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                <SelectItem value="all">Tous les utilisateurs</SelectItem>
                                {uniqueUsers.map(u => (
                                    <SelectItem key={u} value={u}>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                                {u.charAt(0).toUpperCase()}
                                            </div>
                                            {u}
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Active filter badges */}
                        {actionFilter !== 'all' && (
                            <Badge
                                className="bg-primary/10 text-primary border-primary/20 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setActionFilter('all')}
                            >
                                {ACTION_CATEGORIES.find(c => c.value === actionFilter)?.label}
                                <X className="w-3 h-3" />
                            </Badge>
                        )}
                        {userFilter !== 'all' && (
                            <Badge
                                className="bg-primary/10 text-primary border-primary/20 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => setUserFilter('all')}
                            >
                                👤 {userFilter}
                                <X className="w-3 h-3" />
                            </Badge>
                        )}
                    </div>
                </header>

                {/* Table */}
                <div className="flex-1 overflow-auto p-6 scroll-smooth" onScroll={handleScroll}>
                    <Card className="glass-card border-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border/50 hover:bg-transparent">
                                    <TableHead className="text-muted-foreground w-40">Date/Heure</TableHead>
                                    <TableHead className="text-muted-foreground w-44">Utilisateur</TableHead>
                                    <TableHead className="text-muted-foreground">Action</TableHead>
                                    <TableHead className="text-muted-foreground">Cible</TableHead>
                                    <TableHead className="text-muted-foreground w-28">IP</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visibleLogs.map((log) => (
                                    <TableRow key={log.id} className="border-border/50 hover:bg-muted/20 transition-colors">
                                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                            {formatTimestamp(log.timestamp)}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                    {log.userName?.charAt(0)?.toUpperCase() || '?'}
                                                </div>
                                                <button
                                                    className="font-medium text-sm hover:text-primary transition-colors text-left"
                                                    onClick={() => setUserFilter(log.userName)}
                                                >
                                                    {log.userName || '—'}
                                                </button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground">{getActionIcon(log.action)}</span>
                                                {getActionBadge(log.action)}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {log.targetName ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    {log.targetType === 'device' && <Radio className="w-3.5 h-3.5 text-muted-foreground" />}
                                                    {log.targetType === 'enterprise' && <Building2 className="w-3.5 h-3.5 text-muted-foreground" />}
                                                    {log.targetType === 'user' && <User className="w-3.5 h-3.5 text-muted-foreground" />}
                                                    <span>{log.targetName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground/40">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {log.ip || '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        {isLoading && (
                            <div className="flex justify-center py-10">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        )}
                        {!isLoading && displayedCount < filteredLogs.length && (
                            <div className="flex flex-col items-center py-4 border-t border-border/50 gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground/50" />
                                <p className="text-xs text-muted-foreground/50">
                                    {visibleLogs.length} / {filteredLogs.length} — Scroller pour charger plus
                                </p>
                            </div>
                        )}
                        {!isLoading && filteredLogs.length === 0 && (
                            <div className="text-center py-16">
                                <History className="w-10 h-10 mx-auto text-muted-foreground/20 mb-3" />
                                <p className="text-muted-foreground font-medium">Aucun journal trouvé</p>
                                <p className="text-xs text-muted-foreground/60 mt-1">Essayez de modifier vos filtres</p>
                                {hasFilters && (
                                    <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-3 text-xs">
                                        Effacer les filtres
                                    </Button>
                                )}
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AuditLogsPage;
