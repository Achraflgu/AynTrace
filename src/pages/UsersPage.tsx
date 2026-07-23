import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore, useAppStore } from '@/lib/store';
import { billingApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Plus, Search, MoreHorizontal, Edit, Trash2, Shield, UserCircle,
  X, CreditCard, Calendar, Clock, CheckCircle2, AlertTriangle, Lock,
  Building2, Mail, Radio, ChevronRight, Zap, Crown, RefreshCw, Unlock,
  Banknote, CalendarDays, FileText
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Navigate } from 'react-router-dom';
import { getRoleName, getRoleColor, formatDate } from '@/lib/utils-geo';
import { fetchApi, pricingApi } from '@/lib/api';
import UserFormModal from '@/components/modals/UserFormModal';
import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import { User } from '@/lib/types';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

/* ── Plan pricing defaults (overridden by API) ────────────────── */
const DEFAULT_PLAN_PRICING: Record<string, Record<string, number>> = {
  starter: { monthly: 29, biannual: 156, annual: 278 },
  pro:     { monthly: 39, biannual: 210, annual: 374 },
};

/* ── Helpers ──────────────────────────────────────────────────── */
const daysUntil = (date: string | null) => {
  if (!date) return null;
  const diff = (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return Math.ceil(diff);
};

const billingBadge = (status: string, nextDue: string | null) => {
  const days = daysUntil(nextDue);
  if (status === 'suspended') return { label: 'Suspendu', color: 'bg-red-500/10 text-red-400 border-red-500/20', dot: 'bg-red-400', icon: Lock };
  if (status === 'warning')   return { label: `Échéance ${days != null ? `(${days}j)` : ''}`, color: 'bg-[#142945]/10 text-[#142945] border-[#142945]/20', dot: 'bg-[#142945]', icon: AlertTriangle };
  return { label: days != null ? `${days}j restants` : 'Actif', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400', icon: CheckCircle2 };
};

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
};

const getPlanMeta = (p: string) => {
  if (p === 'pro') {
    return {
      label: 'Pro',
      icon: Crown,
      className: 'bg-[#142945]/5 text-[#142945] border-[#142945]/15',
    };
  }

  if (p === 'enterprise') {
    return {
      label: 'Enterprise',
      icon: Crown,
      className: 'bg-violet-500/10 text-violet-500 border-violet-500/15',
    };
  }

  return {
    label: 'Starter',
    icon: Zap,
    className: 'bg-secondary/70 text-foreground border-border/50',
  };
};

const planLabel = (p: string) => getPlanMeta(p).label;

const cycleLabel = (c: string) =>
  c === 'annual' ? 'Annuel' : c === 'biannual' ? 'Semestriel' : 'Mensuel';

const methodLabel = (m: string) => {
  const l: Record<string, string> = { d17: 'D17', mastercard: 'Mastercard', bank_transfer: 'Virement', admin: 'Admin', invoice: 'Facture' };
  return l[m] || m || '—';
};

/* ═══════════════════════════════════════════════════════════════ */
const UsersPage = () => {
  const { user } = useAuthStore();
  const { users, deleteUser, fetchUsers } = useAppStore();

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [PLAN_PRICING, setPlanPricing] = useState(DEFAULT_PLAN_PRICING);

  /* ── Profile panel ────────────────────────────────────────── */
  const [profileUser, setProfileUser]   = useState<any>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  /* ── Admin action forms ───────────────────────────────────── */
  const [payMode, setPayMode]           = useState<'cycle' | 'add_days' | 'add_months' | 'set_days'>('cycle');
  const [payValue, setPayValue]         = useState<number | string>(30);
  const [payAmount, setPayAmount]       = useState('');
  const [payLoading, setPayLoading]     = useState(false);

  const [changePlan, setChangePlan]     = useState('');
  const [changeCycle, setChangeCycle]   = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  const [graceDays, setGraceDays]       = useState(7);
  const [unblockPreserve, setUnblockPreserve] = useState(false);
  const [unblockLoading, setUnblockLoading] = useState(false);
  const [blockReason, setBlockReason]   = useState<'payment' | 'personal'>('payment');
  const [blockLoading, setBlockLoading]   = useState(false);

  // Load dynamic pricing
  useEffect(() => {
    pricingApi.getAll().then(data => {
      const c = data.config;
      const sM = c.starter_monthly || 29;
      const pM = c.pro_monthly || 39;
      const bD = c.biannual_discount || 10;
      const aD = c.annual_discount || 20;

      setPlanPricing({
        starter: { 
            monthly: sM, 
            biannual: Math.round(sM * 6 * (1 - bD / 100)), 
            annual: Math.round(sM * 12 * (1 - aD / 100)) 
        },
        pro: { 
            monthly: pM, 
            biannual: Math.round(pM * 6 * (1 - bD / 100)), 
            annual: Math.round(pM * 12 * (1 - aD / 100)) 
        },
      });
    }).catch(() => {});
  }, []);

  if (!user || user.role === 'operator') return <Navigate to="/dashboard" replace />;

  const filteredUsers = users.filter(u =>
    (user?.role === 'admin' || u.enterpriseId === user?.enterpriseId) &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     u.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  /* ── Load profile ─────────────────────────────────────────── */
  const loadProfile = async (u: User) => {
    setProfileUser(null);
    setProfileLoading(true);
    try {
      const data = await fetchApi<any>(`/users/${u.id}/profile`);
      setProfileUser(data);
      // Init form defaults
      setChangePlan(data.plan || 'starter');
      setChangeCycle(data.savedBillingCycle || 'monthly');
      setPayAmount('');
      setPayMode('cycle');
      setPayValue(30);
      setGraceDays(7);
    } catch { toast.error('Erreur de chargement du profil'); }
    finally { setProfileLoading(false); }
  };

  const closeProfile = () => setProfileUser(null);

  /* ── Admin actions ────────────────────────────────────────── */
  const handleAdminPay = async () => {
    if (!profileUser) return;
    setPayLoading(true);
    try {
      const res = await billingApi.adminPay({
        userId: profileUser.id,
        dueMode: payMode,
        dueValue: payMode === 'cycle' ? undefined : (typeof payValue === 'number' ? payValue : parseInt(payValue) || 0),
        amount: payAmount ? parseFloat(payAmount) : undefined,
        adminName: user?.name
      });
      toast.success(`Paiement enregistré — prochain: ${fmtDate(res.billingNextDue)}`);
      loadProfile(profileUser);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
    finally { setPayLoading(false); }
  };

  const handleChangePlan = async () => {
    if (!profileUser) return;
    setChangeLoading(true);
    try {
      const res = await billingApi.adminChangePlan({
        userId: profileUser.id,
        plan: changePlan,
        billingCycle: changeCycle,
        adminName: user?.name
      });
      toast.success(`Plan changé → ${planLabel(changePlan)} (${cycleLabel(changeCycle)})`);
      loadProfile(profileUser);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
    finally { setChangeLoading(false); }
  };

  const handleUnblock = async () => {
    if (!profileUser) return;
    setUnblockLoading(true);
    try {
      await billingApi.adminUnblock({ userId: profileUser.id, graceDays, adminName: user?.name, preserveDue: unblockPreserve });
      toast.success(unblockPreserve ? `Compte débloqué — échéance conservée` : `Compte débloqué — grâce de ${graceDays} jours`);
      loadProfile(profileUser);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
    finally { setUnblockLoading(false); }
  };

  const handleBlock = async () => {
    if (!profileUser) return;
    setBlockLoading(true);
    try {
      await billingApi.adminBlock({ userId: profileUser.id, adminName: user?.name, reason: blockReason });
      toast.success(blockReason === 'payment' ? 'Compte suspendu pour non-paiement' : 'Compte suspendu (intervention)');
      loadProfile(profileUser);
      fetchUsers();
    } catch (e: any) { toast.error(e.message); }
    finally { setBlockLoading(false); }
  };

  const handleEdit = (u: User) => { setSelectedUser(u); setFormModalOpen(true); };
  const handleDelete = (u: User) => { setSelectedUser(u); setDeleteModalOpen(true); };
  const confirmDelete = () => { if (selectedUser) { deleteUser(selectedUser.id); toast.success('Utilisateur supprimé'); setDeleteModalOpen(false); } };

  const getRoleIcon = (role: string) => role === 'admin' ? Shield : UserCircle;
  const planOptions = [
    { value: 'starter', label: 'Starter', icon: Zap },
    { value: 'pro', label: 'Pro', icon: Crown },
  ] as const;

  /* ── Computed price preview ───────────────────────────────── */
  const previewPrice = profileUser
    ? (PLAN_PRICING[changePlan as keyof typeof PLAN_PRICING]?.[changeCycle as keyof (typeof PLAN_PRICING)[keyof typeof PLAN_PRICING]] || PLAN_PRICING.starter.monthly)
    : 0;

  const autoPayAmount = profileUser
    ? ((PLAN_PRICING[profileUser.plan as keyof typeof PLAN_PRICING]?.[profileUser.savedBillingCycle as keyof (typeof PLAN_PRICING)[keyof typeof PLAN_PRICING]]) || PLAN_PRICING.starter.monthly)
    : 0;

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold">Utilisateurs</h1>
              <p className="text-sm text-muted-foreground">
                {users.length} utilisateur{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {user?.role === 'admin' && (
                <>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try { const r = await billingApi.checkDue(); toast.success(`Vérification: ${r.warned} avertis, ${r.suspended} suspendus`); fetchUsers(); }
                    catch { toast.error('Erreur de vérification'); }
                  }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Vérifier échéances
                  </Button>
                  <Button variant="hero" onClick={() => { setSelectedUser(null); setFormModalOpen(true); }}>
                    <Plus className="w-4 h-4 mr-2" />Nouvel utilisateur
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher un utilisateur..." className="pl-10 bg-secondary/50 border-0" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex relative">
          {profileUser && (
            <div
              className="fixed inset-0 z-[60] bg-black/35 backdrop-blur-[2px]"
              onClick={closeProfile}
              aria-hidden="true"
            />
          )}
          {/* Table */}
          <div className={`flex-1 overflow-auto p-6 transition-all ${profileUser ? 'pr-0' : ''}`}>
            <div className="glass-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Utilisateur</TableHead>
                    <TableHead className="text-muted-foreground">Rôle</TableHead>
                    <TableHead className="text-muted-foreground">Plan</TableHead>
                    <TableHead className="text-muted-foreground">Facturation</TableHead>
                    <TableHead className="text-muted-foreground">Entreprise</TableHead>
                    <TableHead className="text-muted-foreground">Dernière connexion</TableHead>
                    {user?.role === 'admin' && <TableHead className="text-muted-foreground text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(u => {
                    const RoleIcon = getRoleIcon(u.role);
                    const billing = billingBadge((u as any).billingStatus || 'active', (u as any).billingNextDue);
                    const BillingIcon = billing.icon;
                    const isSelected = profileUser?.id === u.id;
                    return (
                      <TableRow
                        key={u.id}
                        className={`border-border/50 cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/30'}`}
                        onClick={() => loadProfile(u)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar><AvatarFallback className="bg-primary/10 text-primary">{u.name.split(' ').map(n => n[0]).join('')}</AvatarFallback></Avatar>
                            <div>
                              <p className="font-medium">{u.name}</p>
                              <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getRoleColor(u.role)}>
                            <RoleIcon className="w-3 h-3 mr-1" />{getRoleName(u.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {u.role === 'operator' ? (
                            <Badge variant="outline" className={`gap-1.5 px-2.5 py-1 ${getPlanMeta((u as any).plan || 'starter').className}`}>
                              {(() => {
                                const PlanIcon = getPlanMeta((u as any).plan || 'starter').icon;
                                return <PlanIcon className="w-3.5 h-3.5" />;
                              })()}
                              <span>{planLabel((u as any).plan || 'starter')}</span>
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>
                          {u.role === 'operator' ? (
                            <Badge variant="outline" className={billing.color}>
                              <BillingIcon className="w-3 h-3 mr-1" />{billing.label}
                            </Badge>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </TableCell>
                        <TableCell>{u.enterpriseName || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{u.lastLogin ? formatDate(u.lastLogin) : 'Jamais'}</TableCell>
                        {user?.role === 'admin' && (
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(u)}><Edit className="w-4 h-4 mr-2" />Modifier</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(u)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</DropdownMenuItem>
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
          </div>

          {/* ═══ PROFILE PANEL ═══════════════════════════════════ */}
          {profileUser && (
            <div className="fixed right-0 top-0 z-[70] h-screen w-[420px] border-l border-border bg-card/90 backdrop-blur-md overflow-y-auto shadow-2xl animate-in slide-in-from-right-4 duration-300">
              {profileLoading ? (
                <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="p-5 space-y-5">
                  {/* Close button */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">Profil utilisateur</h3>
                    <button onClick={closeProfile} className="p-1 hover:bg-secondary rounded-lg transition-colors"><X className="w-4 h-4" /></button>
                  </div>

                  {/* ── Identity Card ──────────────────────────── */}
                  <div className="rounded-xl bg-gradient-to-br from-secondary/50 to-secondary/20 border border-border/40 p-4 flex items-center gap-4">
                    <Avatar className="w-14 h-14">
                      <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                        {profileUser.name?.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-base truncate">{profileUser.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{profileUser.email}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge className={getRoleColor(profileUser.role)} variant="outline">
                          {getRoleName(profileUser.role)}
                        </Badge>
                        {profileUser.enterpriseName && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{profileUser.enterpriseName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Plan & Billing ─────────────────────────── */}
                  {profileUser.role === 'operator' && (
                    <>
                      {/* Status hero */}
                      {(() => {
                        const b = billingBadge(profileUser.billingStatus, profileUser.billingNextDue);
                        const BIcon = b.icon;
                        const days = daysUntil(profileUser.billingNextDue);
                        return (
                          <div className={`rounded-xl border p-4 ${b.color}`}>
                            <div className="flex items-center gap-3">
                              <BIcon className="w-6 h-6 shrink-0" />
                              <div className="flex-1">
                                <p className="font-bold text-sm">
                                  {profileUser.billingStatus === 'suspended' ? 'Compte suspendu' :
                                   profileUser.billingStatus === 'warning' ? 'Paiement bientôt dû' : 'Facturation active'}
                                </p>
                                {profileUser.billingNextDue && (
                                  <p className="text-xs mt-0.5 opacity-80">
                                    Échéance: {fmtDate(profileUser.billingNextDue)}
                                    {days != null && ` (${days > 0 ? `dans ${days}j` : days === 0 ? "aujourd'hui" : `${Math.abs(days)}j en retard`})`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Plan info cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Plan</p>
                          <p className="font-bold text-sm">{planLabel(profileUser.plan)}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Cycle</p>
                          <p className="font-bold text-sm">{cycleLabel(profileUser.savedBillingCycle)}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Paiement</p>
                          <p className="font-bold text-sm">{methodLabel(profileUser.savedPaymentMethod)}</p>
                        </div>
                        <div className="rounded-lg bg-secondary/30 border border-border/30 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Appareils</p>
                          <p className="font-bold text-sm flex items-center gap-1"><Radio className="w-3.5 h-3.5 text-primary" />{profileUser.deviceCount || 0}</p>
                        </div>
                      </div>

                      {/* ── Admin Actions ─────────────────────── */}
                      {user?.role === 'admin' && (
                        <div className="space-y-4">
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border/30 pb-2">Actions admin</p>

                          {/* 1. Record Payment */}
                          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3 space-y-3">
                            <p className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                              <Banknote className="w-3.5 h-3.5" />Enregistrer un paiement
                            </p>

                            {/* Due mode selector */}
                            <div>
                              <Label className="text-[10px] text-muted-foreground mb-1 block">Prochaine échéance dans</Label>
                              <div className="flex flex-wrap gap-1 bg-secondary/50 rounded-lg p-0.5">
                                {([
                                  { mode: 'cycle', label: 'Auto (cycle)' },
                                  { mode: 'add_days', label: '+ Jours' },
                                  { mode: 'add_months', label: '+ Mois' },
                                  { mode: 'set_days', label: 'Exact (Jours)' }
                                ] as const).map(m => (
                                  <button key={m.mode} onClick={() => setPayMode(m.mode)}
                                    className={`flex-1 min-w-[70px] text-[10px] font-semibold py-1.5 rounded-md transition-all ${payMode === m.mode ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                    {m.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {payMode !== 'cycle' && (
                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">
                                  {payMode === 'set_days' ? 'Définir exact' : 'Ajouter'} ({payMode.includes('month') ? 'Mois' : 'Jours'})
                                </Label>
                                <Input 
                                  type="number" 
                                  min={payMode === 'set_days' ? undefined : 0} 
                                  value={payValue} 
                                  onChange={e => setPayValue(e.target.value)} 
                                  className="h-8 text-sm" 
                                />
                              </div>
                            )}

                            <div>
                              <Label className="text-[10px] text-muted-foreground mb-1 block">
                                Montant <span className="text-muted-foreground/50">(auto: {autoPayAmount} TND)</span>
                              </Label>
                              <Input type="number" placeholder={`${autoPayAmount}`} value={payAmount} onChange={e => setPayAmount(e.target.value)} className="h-8 text-sm" />
                            </div>

                            <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 h-8 text-xs font-bold"
                              disabled={payLoading} onClick={handleAdminPay}>
                              {payLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                              Confirmer le paiement
                            </Button>
                          </div>

                          {/* 2. Change Plan */}
                          <div className="rounded-xl bg-[#142945]/5 border border-[#142945]/15 p-3 space-y-3">
                            <p className="text-xs font-bold text-[#142945] flex items-center gap-1.5">
                              <Crown className="w-3.5 h-3.5" />Changer le plan
                            </p>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Plan</Label>
                                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/50 bg-secondary/40 p-1">
                                  {planOptions.map(option => {
                                    const OptionIcon = option.icon;
                                    const active = changePlan === option.value;
                                    return (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setChangePlan(option.value)}
                                        className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                      >
                                        <OptionIcon className="w-3.5 h-3.5" />
                                        <span>{option.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Cycle</Label>
                                <select value={changeCycle} onChange={e => setChangeCycle(e.target.value)}
                                  className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-primary">
                                  <option value="monthly">Mensuel</option>
                                  <option value="biannual">Semestriel</option>
                                  <option value="annual">Annuel</option>
                                </select>
                              </div>
                            </div>

                            <div className="text-xs text-muted-foreground text-center py-1 bg-secondary/30 rounded-lg">
                              Prix: <strong className="text-foreground">{previewPrice} TND</strong> / {cycleLabel(changeCycle).toLowerCase()}
                            </div>

                            <Button size="sm" variant="outline" className="w-full h-8 text-xs font-bold border-[#142945]/30 text-[#142945] hover:bg-[#142945]/10"
                              disabled={changeLoading} onClick={handleChangePlan}>
                              {changeLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                              Appliquer
                            </Button>
                          </div>

                          {/* 3. Unblock / Block */}
                          {profileUser.billingStatus === 'suspended' ? (
                            <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3 space-y-3">
                              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                                <Unlock className="w-3.5 h-3.5" />Débloquer le compte
                              </p>

                              {daysUntil(profileUser.billingNextDue) !== null && daysUntil(profileUser.billingNextDue)! > 0 ? (
                                <div>
                                  <Label className="text-[10px] text-muted-foreground mb-1 block">Mode de déblocage</Label>
                                  <div className="flex gap-1 p-0.5 bg-secondary/50 rounded-lg">
                                    <button onClick={() => setUnblockPreserve(true)}
                                      className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all ${unblockPreserve ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                                      Garder échéance existante
                                    </button>
                                    <button onClick={() => setUnblockPreserve(false)}
                                      className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all ${!unblockPreserve ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                                      Redéfinir période grâce
                                    </button>
                                  </div>
                                </div>
                              ) : null}

                              {!unblockPreserve && (
                                <div>
                                  <Label className="text-[10px] text-muted-foreground mb-1 block">Période de grâce (jours)</Label>
                                  <Input type="number" min="1" value={graceDays} onChange={e => setGraceDays(parseInt(e.target.value) || 0)} className="h-8 text-sm" />
                                </div>
                              )}
                              <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-white border-0 h-8 text-xs font-bold"
                                disabled={unblockLoading} onClick={handleUnblock}>
                                {unblockLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
                                {unblockPreserve ? 'Débloquer (Préserver jours restants)' : `Débloquer (${graceDays}j de grâce)`}
                              </Button>
                            </div>
                          ) : (
                            <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3 space-y-3">
                              <p className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5" />Bloquer le compte
                              </p>
                              <div>
                                <Label className="text-[10px] text-muted-foreground mb-1 block">Raison du blocage</Label>
                                <div className="flex gap-1 p-0.5 bg-secondary/50 rounded-lg">
                                  <button onClick={() => setBlockReason('payment')}
                                    className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all ${blockReason === 'payment' ? 'bg-red-500 shadow-sm text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    Non-paiement (Reset jours)
                                  </button>
                                  <button onClick={() => setBlockReason('personal')}
                                    className={`flex-1 text-[10px] font-semibold py-1.5 rounded-md transition-all ${blockReason === 'personal' ? 'bg-[#142945] shadow-sm text-white' : 'text-muted-foreground hover:text-foreground'}`}>
                                    Intervention (Garder jours)
                                  </button>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground leading-tight">
                                {blockReason === 'payment' 
                                  ? 'Force la suspension immédiate et remet les jours restants à 0.' 
                                  : 'Suspend l\'accès sans altérer le crédit des jours restants.'}
                              </p>
                              <Button size="sm" className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 h-8 text-xs font-bold"
                                disabled={blockLoading} onClick={handleBlock}>
                                {blockLoading ? <RefreshCw className="w-3 h-3 animate-spin mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                                Suspendre immédiatement
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Payment History ───────────────────── */}
                      {profileUser.payments?.length > 0 && (
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />Historique des paiements
                          </p>
                          <div className="space-y-2">
                            {profileUser.payments.map((p: any) => (
                              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  p.status === 'paid' ? 'bg-emerald-500/10' : p.status === 'cancelled' ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                                  <CreditCard className={`w-4 h-4 ${
                                    p.status === 'paid' ? 'text-emerald-400' : p.status === 'cancelled' ? 'text-red-400' : 'text-amber-400'}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[11px] font-semibold">{p.invoiceRef}</span>
                                    <span className={`text-[9px] px-1.5 py-0 rounded-full font-bold ${
                                      p.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : p.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 'bg-[#142945]/10 text-[#142945]'}`}>
                                      {p.status === 'paid' ? 'Payé' : p.status === 'cancelled' ? 'Annulé' : 'En attente'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{fmtDate(p.createdAt)} • {methodLabel(p.method)}</p>
                                </div>
                                <span className="font-bold text-sm shrink-0">{p.amount} <span className="text-[10px] text-muted-foreground">TND</span></span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Non-operator info */}
                  {profileUser.role !== 'operator' && (
                    <div className="rounded-xl bg-secondary/20 border border-border/30 p-4 text-center">
                      <Shield className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Les paramètres de facturation ne s'appliquent qu'aux opérateurs.</p>
                    </div>
                  )}

                  {/* Footer info */}
                  <div className="text-[10px] text-muted-foreground text-center space-y-0.5 pt-2 border-t border-border/30">
                    <p>Créé le {fmtDate(profileUser.createdAt)}</p>
                    {profileUser.lastLogin && <p>Dernière connexion: {fmtDate(profileUser.lastLogin)}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <UserFormModal open={formModalOpen} onClose={() => setFormModalOpen(false)} user={selectedUser} />
      <ConfirmDeleteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onConfirm={confirmDelete}
        title="Supprimer l'utilisateur" description={`Êtes-vous sûr de vouloir supprimer "${selectedUser?.name}" ?`} />
    </DashboardLayout>
  );
};

export default UsersPage;
