import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ordersApi, pricingApi, enterprisesApi } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import type { Device } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ShoppingCart, Search, Filter, Clock, CheckCircle2, Truck, Zap, XCircle, Eye, X, MessageSquare, Bot, User as UserIcon, Package, ArrowRight, RefreshCw, ChevronDown, Calendar, Mail, Phone, Building2, AlertCircle, Plus, PackagePlus, UserPlus, Boxes, Minus, Settings, Save, DollarSign, Route, LucideIcon } from 'lucide-react';
import { DEVICE_TYPES, getDeviceTypeLabel as getSharedDeviceTypeLabel } from '@/lib/utils-geo';

type GpsType = Device['deviceType'];
interface GpsAllocation {
    type: GpsType;
    icon: LucideIcon;
    label: string;
    count: number;
}
const defaultAllocation: GpsAllocation[] = DEVICE_TYPES.map((type) => ({
    type: type.value as GpsType,
    icon: type.icon,
    label: type.label,
    count: 0,
}));

const getGpsTypeMeta = (type: string) => {
    const legacyTypeMap: Record<string, GpsType> = {
        vehicules: 'voiture',
        personnes: 'personnel',
        animaux: 'animal',
        enfants: 'personnel',
        objets: 'objet',
        motos: 'moto',
        camions: 'camion',
    };
    const normalizedType = legacyTypeMap[type] || type;
    const found = DEVICE_TYPES.find(item => item.value === normalizedType);
    return found || { value: normalizedType, label: getSharedDeviceTypeLabel(normalizedType), icon: Package };
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    pending: { label: 'En attente', color: 'text-[#142945]', bg: 'bg-[#142945]/10 border-[#142945]/20', icon: Clock },
    confirmed: { label: 'Confirmée', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', icon: CheckCircle2 },
    installing: { label: 'Installation', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', icon: Truck },
    active: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', icon: Zap },
    cancelled: { label: 'Annulée', color: 'text-red-400', bg: 'bg-red-400/10 border-red-400/20', icon: XCircle },
};

const SOURCE_BADGE: Record<string, { label: string; icon: any; color: string }> = {
    popup: { label: 'Formulaire', icon: Package, color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' },
    manual: { label: 'Ajout Manuel', icon: Phone, color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
    client_upgrade: { label: 'Upgrade Client', icon: PackagePlus, color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
};

const PLAN_LABELS: Record<string, string> = { starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' };
const CYCLE_LABELS: Record<string, string> = { monthly: 'Mensuel', biannual: '6 Mois', annual: 'Annuel' };

type DeviceTypeValue = Device['deviceType'];
type DeviceIdentifierRow = { sim: string; serie: string; imei: string; deviceType: DeviceTypeValue };

const DEVICE_TYPE_OPTIONS: Array<{ value: DeviceTypeValue; label: string }> = [
    { value: 'voiture', label: 'Voiture' },
    { value: 'personnel', label: 'Personnel' },
    { value: 'camion', label: 'Camion' },
    { value: 'moto', label: 'Moto' },
    { value: 'mobilite', label: 'Mobilité' },
    { value: 'animal', label: 'Animal' },
    { value: 'objet', label: 'Objet' },
];

const ORDER_TYPE_TO_DEVICE_TYPE: Record<string, DeviceTypeValue> = {
    vehicules: 'voiture',
    personnes: 'personnel',
    animaux: 'animal',
    enfants: 'personnel',
    objets: 'objet',
    motos: 'moto',
    camions: 'camion',
};

const getDeviceTypeLabel = (value: DeviceTypeValue) => DEVICE_TYPE_OPTIONS.find(option => option.value === value)?.label || value;

const buildDeviceTypePlan = (gpsTypes: Array<{ type: string; count: number }> | undefined, fallbackCount: number) => {
    const plan: DeviceTypeValue[] = [];

    for (const group of gpsTypes || []) {
        const count = Math.max(0, Number(group.count) || 0);
        const mappedType = ORDER_TYPE_TO_DEVICE_TYPE[group.type] || (DEVICE_TYPES.some(type => type.value === group.type) ? group.type as DeviceTypeValue : 'voiture');
        for (let i = 0; i < count; i++) {
            plan.push(mappedType);
        }
    }

    while (plan.length < fallbackCount) {
        plan.push('voiture');
    }

    return plan.slice(0, fallbackCount);
};

const buildRowsFromPrefixes = (count: number, prefixes: { sim: string; serie: string; imei: string }, deviceTypes: DeviceTypeValue[]) => {
    return Array.from({ length: count }, (_, index) => ({
        sim: `${prefixes.sim}${String(index + 1).padStart(Math.max(1, 8 - prefixes.sim.length), '0')}`,
        serie: `${prefixes.serie}${String(index + 1).padStart(4, '0')}`,
        imei: `${prefixes.imei}${String(index + 1).padStart(3, '0')}`,
        deviceType: deviceTypes[index] || 'voiture',
    }));
};

const buildRowsFromSeeds = (count: number, seeds: { sim: string; serie: string; imei: string }, deviceTypes: DeviceTypeValue[]) => {
    const shift = (value: string, offset: number) => {
        const match = value.trim().match(/^(.*?)(\d+)$/);
        if (!match) return value;
        const [, prefix, digits] = match;
        return `${prefix}${String(parseInt(digits, 10) + offset).padStart(digits.length, '0')}`;
    };

    return Array.from({ length: count }, (_, index) => ({
        sim: shift(seeds.sim, index),
        serie: shift(seeds.serie, index),
        imei: shift(seeds.imei, index),
        deviceType: deviceTypes[index] || 'voiture',
    }));
};

const OrdersPage = () => {
    const { users, fetchUsers, enterprises, fetchEnterprises, devices } = useAppStore();
    const orders = useAppStore(s => s.orders);
    const fetchOrders = useAppStore(s => s.fetchOrders);
    const [stats, setStats] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');

    const filteredOrders = orders.filter(order => {
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;
        if (sourceFilter !== 'all' && order.source !== sourceFilter) return false;
        if (search) {
            const q = search.toLowerCase();
            return (
                order.orderRef?.toLowerCase().includes(q) ||
                order.fullName?.toLowerCase().includes(q) ||
                order.email?.toLowerCase().includes(q) ||
                order.company?.toLowerCase().includes(q)
            );
        }
        return true;
    });
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [adminNotes, setAdminNotes] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [orderMode, setOrderMode] = useState<'choose' | 'new' | 'upgrade'>('choose');
    const [currentOrderStep, setCurrentOrderStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processResult, setProcessResult] = useState<any>(null);
    const [isPrefixModalOpen, setIsPrefixModalOpen] = useState(false);
    const [prefixes, setPrefixes] = useState({ operator: 'Telecom', sim: '', serie: '', imei: '' });
    const [deviceRows, setDeviceRows] = useState<DeviceIdentifierRow[]>([]);
    const [activationPreview, setActivationPreview] = useState<{
        enterpriseId: string;
        enterpriseName: string;
        operatorName: string;
        deviceCount: number;
        nextIds?: { serialNumber: string; imei: string; subscriberNumber: string } | null;
    } | null>(null);
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', action: '', orderId: '' });
    const [pricing, setPricing] = useState<Record<string, number>>({});
    const [pricingRows, setPricingRows] = useState<any[]>([]);
    const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
    const [pricingEdits, setPricingEdits] = useState<Record<string, number>>({});
    const [savingPricing, setSavingPricing] = useState(false);
    const [newOrder, setNewOrder] = useState({
        fullName: '', phone: '', email: '', company: '',
        gpsCount: 0, plan: 'starter', billingCycle: 'monthly',
        gpsAllocation: defaultAllocation.map(a => ({ ...a }))
    });
    const [upgradeOrder, setUpgradeOrder] = useState({
        fullName: '', phone: '', email: '', company: '',
        gpsCount: 0, notes: '',
        gpsAllocation: defaultAllocation.map(a => ({ ...a }))
    });

    const allocatedTotalNew = newOrder.gpsAllocation.reduce((sum, a) => sum + a.count, 0);
    const remainingNew = newOrder.gpsCount - allocatedTotalNew;

    const allocatedTotalUpgrade = upgradeOrder.gpsAllocation.reduce((sum, a) => sum + a.count, 0);
    const remainingUpgrade = upgradeOrder.gpsCount - allocatedTotalUpgrade;

    const updateAllocation = (mode: 'new' | 'upgrade', type: GpsType, delta: number) => {
        if (mode === 'new') {
            setNewOrder(prev => ({
                ...prev,
                gpsAllocation: prev.gpsAllocation.map(a => a.type === type ? { ...a, count: Math.max(0, a.count + delta) } : a)
            }));
        } else {
            setUpgradeOrder(prev => ({
                ...prev,
                gpsAllocation: prev.gpsAllocation.map(a => a.type === type ? { ...a, count: Math.max(0, a.count + delta) } : a)
            }));
        }
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [, statsData] = await Promise.all([
                fetchOrders(),
                ordersApi.getStats(),
            ]);
            setStats(statsData);
        } catch (err: any) {
            toast.error('Erreur de chargement', { description: err.message });
        } finally {
            setLoading(false);
        }
    }, [fetchOrders]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Load pricing config
    useEffect(() => {
        pricingApi.getAll().then(data => {
            setPricing(data.config);
            setPricingRows(data.rows);
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (users.length === 0) fetchUsers();
        if (enterprises.length === 0) fetchEnterprises();
    }, [users.length, fetchUsers, enterprises.length, fetchEnterprises]);

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        try {
            await ordersApi.updateStatus(orderId, { status: newStatus });
            toast.success(`Statut mis à jour : ${STATUS_CONFIG[newStatus]?.label}`);
            fetchData();
            if (selectedOrder?._id === orderId) {
                setSelectedOrder((prev: any) => ({ ...prev, status: newStatus }));
            }
        } catch (err: any) {
            toast.error('Erreur', { description: err.message });
        }
    };

    const handleSaveNotes = async (orderId: string) => {
        try {
            await ordersApi.updateStatus(orderId, { adminNotes });
            toast.success('Notes sauvegardées');
            fetchData();
        } catch (err: any) {
            toast.error('Erreur', { description: err.message });
        }
    };

    const handleDelete = async (orderId: string) => {
        if (!confirm('Supprimer cette commande ?')) return;
        try {
            await ordersApi.delete(orderId);
            toast.success('Commande supprimée');
            setSelectedOrder(null);
            fetchData();
        } catch (err: any) {
            toast.error('Erreur', { description: err.message });
        }
    };

    const handleAddOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const monthlyPrice = pricing[`${newOrder.plan}_monthly`] || (newOrder.plan === 'starter' ? 29 : newOrder.plan === 'pro' ? 39 : 30);
            let recurringCost = newOrder.gpsCount * monthlyPrice;
            const biDiscount = (pricing.biannual_discount || 10) / 100;
            const anDiscount = (pricing.annual_discount || 20) / 100;
            if (newOrder.billingCycle === 'biannual') recurringCost *= (1 - biDiscount);
            if (newOrder.billingCycle === 'annual') recurringCost *= (1 - anDiscount);
            const devicePrice = pricing.device_price || 110;
            const installFee = pricing.installation_fee || 40;
            const depositAmt = pricing.deposit_amount || 0;
            const advMonths = pricing.advance_months || 3;
            const totalDueToday = (newOrder.gpsCount * devicePrice) + installFee + depositAmt + (recurringCost * advMonths);

            const gpsTypes = newOrder.gpsAllocation
                .filter(a => a.count > 0)
                .map(a => ({ type: a.type, count: a.count }));

            await ordersApi.create({
                ...newOrder,
                gpsTypes: gpsTypes.length > 0 ? gpsTypes : [{ type: 'voiture', count: newOrder.gpsCount, label: 'Voiture' }],
                totalDueToday: Math.round(totalDueToday),
                recurringCost: Math.round(recurringCost),
                source: 'manual',
                paymentMethod: 'on_installation'
            });
            toast.success('Nouvelle commande ajoutée avec succès !');
            setIsAddModalOpen(false);
            setOrderMode('choose');
            setNewOrder({ fullName: '', phone: '', email: '', company: '', gpsCount: 0, plan: 'starter', billingCycle: 'monthly', gpsAllocation: defaultAllocation.map(a => ({ ...a })) });
            fetchData();
        } catch (err: any) {
            toast.error('Erreur lors de la création', { description: err.message || 'Une erreur est survenue' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpgradeOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const devicePrice = pricing.device_price || 110;
            const installFee = pricing.installation_fee || 40;
            const depositAmt = pricing.deposit_amount || 0;
            const totalDueToday = (upgradeOrder.gpsCount * devicePrice) + installFee + depositAmt;
            const gpsTypes = upgradeOrder.gpsAllocation
                .filter(a => a.count > 0)
                .map(a => ({ type: a.type, count: a.count }));

            await ordersApi.create({
                ...upgradeOrder,
                gpsTypes: gpsTypes.length > 0 ? gpsTypes : [{ type: 'voiture', count: upgradeOrder.gpsCount, label: 'Voiture' }],
                totalDueToday: Math.round(totalDueToday),
                recurringCost: 0,
                source: 'client_upgrade',
                paymentMethod: 'on_installation'
            });
            toast.success('Commande de mise à jour ajoutée !');
            setIsAddModalOpen(false);
            setOrderMode('choose');
            setUpgradeOrder({ fullName: '', phone: '', email: '', company: '', gpsCount: 0, notes: '', gpsAllocation: defaultAllocation.map(a => ({ ...a })) });
            fetchData();
        } catch (err: any) {
            toast.error('Erreur', { description: err.message || 'Une erreur est survenue' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const getNextStatus = (current: string): string | null => {
        const flow: Record<string, string> = { pending: 'confirmed', confirmed: 'installing', installing: 'active' };
        return flow[current] || null;
    };

    const isUpgradeOrder = selectedOrder?.source === 'client_upgrade';

    const openActivationModal = async () => {
        if (!selectedOrder) return;

        setProcessResult(null);

        if (selectedOrder.source === 'client_upgrade') {
            const existingUser = users.find(u => u.email === selectedOrder.email);
            const existingEnt = (existingUser?.enterpriseId && enterprises.find(e => e.id === existingUser.enterpriseId)) ||
                enterprises.find(e => e.name === selectedOrder.company);

            if (!existingEnt) {
                toast.error('Entreprise introuvable', {
                    description: 'Cette mise à jour doit être rattachée à une entreprise existante.'
                });
                return;
            }

            const enterpriseDevices = devices.filter(d => d.enterpriseId === existingEnt.id);
            let nextIds: { serialNumber: string; imei: string; subscriberNumber: string } | null = null;

            try {
                nextIds = await enterprisesApi.getNextIds(existingEnt.id);
            } catch (err) {
                console.warn('[Orders] Could not fetch next IDs for upgrade activation:', err);
            }
            setActivationPreview({
                enterpriseId: existingEnt.id,
                enterpriseName: existingEnt.name,
                operatorName: existingUser?.name || selectedOrder.fullName,
                deviceCount: enterpriseDevices.length,
                nextIds,
            });

            setPrefixes({
                operator: 'Telecom',
                sim: existingEnt.subscriberPrefix || '500',
                serie: existingEnt.serialPrefix || 'GT-',
                imei: existingEnt.imeiPrefix || '35907',
            });
            const deviceTypes = buildDeviceTypePlan(selectedOrder.gpsTypes, selectedOrder.gpsCount || 0);
            const seedValues = nextIds
                ? { sim: nextIds.subscriberNumber, serie: nextIds.serialNumber, imei: nextIds.imei }
                : {
                    sim: `${existingEnt.subscriberPrefix || '500'}00001`,
                    serie: `${existingEnt.serialPrefix || 'GT-'}0001`,
                    imei: `${existingEnt.imeiPrefix || '35907'}001`,
                };
            setDeviceRows(buildRowsFromSeeds(selectedOrder.gpsCount || 0, seedValues, deviceTypes));

            setIsPrefixModalOpen(true);
            return;
        }

        const getPrefix = (name: string) => {
            if (!name) return 'GT-';
            const w = name.trim().split(/\s+/);
            return (w.length >= 2 ? w[0][0] + w[1][0] : name.substring(0, 2)).toUpperCase() + '-';
        };

        const basePrefixes = {
            operator: 'Telecom',
            sim: String(Math.floor(200 + Math.random() * 800)),
            serie: getPrefix(selectedOrder.company || selectedOrder.fullName),
            imei: String(Math.floor(10000 + Math.random() * 90000))
        };
        const deviceTypes = buildDeviceTypePlan(selectedOrder.gpsTypes, selectedOrder.gpsCount || 0);

        setActivationPreview(null);
        setPrefixes(basePrefixes);
        setDeviceRows(buildRowsFromPrefixes(selectedOrder.gpsCount || 0, {
            sim: basePrefixes.sim,
            serie: basePrefixes.serie,
            imei: basePrefixes.imei,
        }, deviceTypes));
        setIsPrefixModalOpen(true);
    };

    const ORDER_STATUS_FLOW = ['pending', 'confirmed', 'installing', 'active'] as const;

    const renderGpsAllocation = (mode: 'new' | 'upgrade') => {
        const order = mode === 'new' ? newOrder : upgradeOrder;
        const remaining = mode === 'new' ? remainingNew : remainingUpgrade;
        const setOrderCount = (val: number) => {
            if (mode === 'new') setNewOrder(prev => ({ ...prev, gpsCount: val }));
            else setUpgradeOrder(prev => ({ ...prev, gpsCount: val }));
        };

        return (
            <div className="col-span-full space-y-4">
                <div className="border border-border rounded-xl p-6 text-center bg-card shadow-sm">
                    <label className="block text-sm font-semibold mb-4 text-foreground/80">Nombre total de GPS</label>
                    <div className="flex items-center justify-center gap-6">
                        <button type="button" onClick={() => setOrderCount(Math.max(0, order.gpsCount - 1))} className="w-12 h-12 rounded-full border border-border bg-muted hover:bg-muted/80 flex items-center justify-center transition-all shadow-sm"><Minus className="w-5 h-5 text-muted-foreground" /></button>
                        <input type="number" min="0" value={order.gpsCount.toString()} onChange={(e) => setOrderCount(Math.max(0, parseInt(e.target.value) || 0))} className="text-4xl font-black text-[#039C51] tabular-nums w-20 text-center bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <button type="button" onClick={() => setOrderCount(order.gpsCount + 1)} className="w-12 h-12 rounded-full bg-[#039C51]/10 border border-[#039C51]/20 text-[#039C51] hover:bg-[#039C51]/20 flex items-center justify-center transition-all shadow-sm"><Plus className="w-5 h-5" /></button>
                    </div>
                </div>
                {order.gpsCount > 0 && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium">Répartition par type</label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${remaining === 0 ? 'bg-[#039C51]/10 border-[#039C51]/50 text-[#039C51]' : remaining < 0 ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-[#142945]/10 border-[#142945]/50 text-[#142945]'}`}>
                                {remaining === 0 ? '✓ Complet' : remaining > 0 ? `${remaining} restant${remaining > 1 ? 's' : ''}` : `${Math.abs(remaining)} en trop`}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {order.gpsAllocation.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <div key={item.type} className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 ${item.count > 0 ? 'bg-[#039C51]/5 border-[#039C51]/30 shadow-sm' : 'bg-card border-border shadow-sm hover:border-[#039C51]/25'}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${item.count > 0 ? 'bg-[#039C51]/15 text-[#039C51] ring-[#039C51]/20' : 'bg-muted text-muted-foreground ring-border/40'}`}>
                                                <Icon className="w-4 h-4 shrink-0" />
                                            </div>
                                            <span className="text-xs font-semibold text-foreground truncate">{item.label}</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-muted/70 rounded-lg p-1.5 border border-border/50">
                                            <button type="button" onClick={() => updateAllocation(mode, item.type, -1)} disabled={item.count === 0} className="w-6 h-6 rounded-md bg-background flex items-center justify-center text-muted-foreground hover:bg-background/80 disabled:opacity-40 transition-all border border-border shadow-sm"><Minus className="w-3.5 h-3.5" /></button>
                                            <span className={`text-sm font-bold tabular-nums ${item.count > 0 ? 'text-[#039C51]' : 'text-muted-foreground'}`}>{item.count}</span>
                                            <button type="button" onClick={() => updateAllocation(mode, item.type, 1)} disabled={remaining <= 0} className={`w-6 h-6 rounded-md flex items-center justify-center transition-all shadow-sm border ${remaining <= 0 ? 'bg-background text-muted-foreground border-border opacity-40' : 'bg-[#039C51]/20 text-[#039C51] hover:bg-[#039C51]/30 border-[#039C51]/30'}`}><Plus className="w-3.5 h-3.5" /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleProcessOrder = async (orderId: string) => {
        setIsPrefixModalOpen(false);
        setIsProcessing(true);
        setProcessResult(null);
        try {
            const result = await ordersApi.process(orderId, { prefixes, devices: deviceRows });
            setProcessResult(result);
            toast.success('✅ Commande activée avec succès!');
            fetchData();
        } catch (err: any) {
            toast.error('Erreur de traitement', { description: err.message });
            setIsProcessing(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 space-y-6">
                {/* Page Header */}
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <ShoppingCart className="w-7 h-7 text-[#039C51]" />
                        Gestion des Commandes
                    </h1>
                    <p className="text-sm text-muted-foreground">Gérez les demandes reçues via le chatbot IA et le formulaire de contact.</p>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[
                        { label: 'Total', value: stats.total || 0, icon: ShoppingCart, color: 'text-slate-700 dark:text-white', bg: 'bg-slate-100/90 border-slate-200 dark:bg-white/5 dark:border-white/10' },
                        { label: 'En attente', value: stats.pending || 0, icon: Clock, color: 'text-[#142945] dark:text-sky-200', bg: 'bg-[#142945]/5 border-[#142945]/10 dark:bg-slate-900/70 dark:border-slate-700/70' },
                        { label: 'Confirmées', value: stats.confirmed || 0, icon: CheckCircle2, color: 'text-blue-500 dark:text-blue-300', bg: 'bg-blue-500/5 border-blue-500/10 dark:bg-blue-500/10 dark:border-blue-400/20' },
                        { label: 'Installation', value: stats.installing || 0, icon: Truck, color: 'text-purple-500 dark:text-purple-300', bg: 'bg-purple-500/5 border-purple-500/10 dark:bg-purple-500/10 dark:border-purple-400/20' },
                        { label: 'Actives', value: stats.active || 0, icon: Zap, color: 'text-emerald-500 dark:text-emerald-300', bg: 'bg-emerald-500/5 border-emerald-500/10 dark:bg-emerald-500/10 dark:border-emerald-400/20' },
                        { label: 'Annulées', value: stats.cancelled || 0, icon: XCircle, color: 'text-red-500 dark:text-red-300', bg: 'bg-red-500/5 border-red-500/10 dark:bg-red-500/10 dark:border-red-400/20' },
                    ].map(s => (
                        <div key={s.label} className={`rounded-xl border ${s.bg} p-4 flex items-center gap-3 shadow-sm transition-colors`}>
                            <s.icon className={`w-5 h-5 ${s.color}`} />
                            <div>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-300">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-[350px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, email, référence..."
                            className="pl-9 bg-card border-border" />
                    </div>
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                        className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground">
                        <option value="all">Tous les statuts</option>
                        {Object.entries(STATUS_CONFIG).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                    <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                        className="h-10 px-3 rounded-md bg-card border border-border text-sm text-foreground">
                        <option value="all">Toutes les sources</option>
                        <option value="popup">Formulaire (nouveau client)</option>
                        <option value="manual">Saisie Manuelle</option>
                        <option value="client_upgrade">Upgrade Client</option>
                    </select>
                    <Button onClick={fetchData} variant="outline" size="sm" className="gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" /> Actualiser
                    </Button>
                    <Button onClick={() => { setPricingEdits({ ...pricing }); setIsPricingModalOpen(true); }} variant="outline" size="sm" className="gap-1.5 border-[#142945]/30 text-[#142945] hover:bg-[#142945]/10">
                        <Settings className="w-3.5 h-3.5" /> Tarification
                    </Button>
                    <Button onClick={() => { setOrderMode('choose'); setIsAddModalOpen(true); }} size="sm" className="gap-1.5 bg-[#039C51] text-white hover:bg-[#039C51]/90 ml-auto">
                        <Plus className="w-4 h-4 text-white" /> Nouvelle Commande
                    </Button>
                </div>

                {/* Orders Table */}
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 border-b border-border">
                                <tr>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Réf.</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">GPS</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plan</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" /> Chargement...
                                    </td></tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                                        <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        Aucune commande trouvée
                                    </td></tr>
                                ) : filteredOrders.map(order => {
                                    const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                                    const StatusIcon = statusCfg.icon;
                                    const sourceCfg = SOURCE_BADGE[order.source] || SOURCE_BADGE.popup;
                                    const SourceIcon = sourceCfg.icon;
                                    return (
                                        <tr key={order._id} className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                                            onClick={() => { setSelectedOrder(order); setAdminNotes(order.adminNotes || ''); }}>
                                            <td className="px-4 py-3 font-mono text-xs text-[#039C51]">{order.orderRef}</td>
                                            <td className="px-4 py-3">
                                                <p className="font-medium text-foreground">{order.fullName}</p>
                                                <p className="text-xs text-muted-foreground">{order.email}</p>
                                            </td>
                                            <td className="px-4 py-3 font-semibold">{order.gpsCount}</td>
                                            <td className="px-4 py-3 text-xs">{PLAN_LABELS[order.plan] || order.plan}</td>
                                            <td className="px-4 py-3 font-bold text-[#039C51]">{order.totalDueToday} TND</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sourceCfg.color}`}>
                                                    <SourceIcon className="w-3 h-3" /> {sourceCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.bg} ${statusCfg.color}`}>
                                                    <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                                    <Eye className="w-3.5 h-3.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Order Detail Panel (Slide-over) */}
                {selectedOrder && (
                    <div className="fixed inset-0 z-50 flex justify-end">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedOrder(null)} />
                        <div className="relative w-full max-w-lg bg-card border-l border-border h-full overflow-y-auto animate-in slide-in-from-right">
                            {/* Detail Header */}
                            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
                                <div>
                                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <ShoppingCart className="w-5 h-5 text-[#039C51]" />
                                        {selectedOrder.orderRef}
                                    </h2>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(selectedOrder.createdAt).toLocaleString('fr-FR')}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Status & Source */}
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const sc = STATUS_CONFIG[selectedOrder.status] || STATUS_CONFIG.pending;
                                        const SI = sc.icon;
                                        return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${sc.bg} ${sc.color}`}>
                                            <SI className="w-3.5 h-3.5" /> {sc.label}
                                        </span>;
                                    })()}
                                    {(() => {
                                        const src = SOURCE_BADGE[selectedOrder.source] || SOURCE_BADGE.popup;
                                        const SrcI = src.icon;
                                        return <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${src.color}`}>
                                            <SrcI className="w-3.5 h-3.5" /> {src.label}
                                        </span>;
                                    })()}
                                </div>

                                {/* Step-by-step progression */}
                                <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Route className="w-3.5 h-3.5" /> Progression de la commande
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {ORDER_STATUS_FLOW.map((status, index) => {
                                            const stepCfg = STATUS_CONFIG[status];
                                            const StepIcon = stepCfg.icon;
                                            const currentIndex = ORDER_STATUS_FLOW.indexOf(selectedOrder.status as typeof ORDER_STATUS_FLOW[number]);
                                            const isCurrent = selectedOrder.status === status;
                                            const isDone = currentIndex > index;
                                            return (
                                                <div
                                                    key={status}
                                                    className={`rounded-lg border p-2.5 transition-colors ${isCurrent
                                                            ? `${stepCfg.bg} ${stepCfg.color} border-current/30`
                                                            : isDone
                                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                                : 'bg-background border-border text-muted-foreground'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <StepIcon className="w-3.5 h-3.5 shrink-0" />
                                                        <span className="text-[11px] font-semibold truncate">{stepCfg.label}</span>
                                                    </div>
                                                    <p className="mt-1 text-[10px] opacity-80">
                                                        {index === 0 ? 'Demande reçue' : index === 1 ? 'Validation client' : index === 2 ? 'Mise en route' : 'Commande finalisée'}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Client Info */}
                                <div className="rounded-xl border border-border p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <UserIcon className="w-3.5 h-3.5" /> Informations Client
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <p className="font-semibold text-foreground text-base">{selectedOrder.fullName}</p>
                                        {selectedOrder.company && <p className="flex items-center gap-2 text-muted-foreground"><Building2 className="w-3.5 h-3.5" /> {selectedOrder.company}</p>}
                                        <p className="flex items-center gap-2 text-muted-foreground"><Mail className="w-3.5 h-3.5" /> {selectedOrder.email}</p>
                                        <p className="flex items-center gap-2 text-muted-foreground"><Phone className="w-3.5 h-3.5" /> {selectedOrder.phone}</p>
                                    </div>
                                </div>

                                {/* Order Details */}
                                <div className="rounded-xl border border-border p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" /> Détail Commande
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">GPS</span>
                                            <span className="font-semibold">{selectedOrder.gpsCount} appareil{selectedOrder.gpsCount > 1 ? 's' : ''}</span>
                                        </div>

                                        {/* Upgrade context vs new order */}
                                        {selectedOrder.source === 'client_upgrade' ? (
                                            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                                                <PackagePlus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-semibold text-emerald-400">Mise à jour du parc existant</p>
                                                    <p className="text-[10px] text-muted-foreground">Abonnement actuel conservé — matériel uniquement</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Plan</span>
                                                    <span className="font-semibold">{PLAN_LABELS[selectedOrder.plan] || selectedOrder.plan}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Cycle</span>
                                                    <span className="font-semibold">{CYCLE_LABELS[selectedOrder.billingCycle] || selectedOrder.billingCycle}</span>
                                                </div>
                                            </>
                                        )}

                                        {selectedOrder.gpsTypes?.length > 0 && (
                                            <div className="pt-2 border-t border-border">
                                                <p className="text-xs text-muted-foreground mb-1.5">Types :</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {selectedOrder.gpsTypes.map((t: any, i: number) => {
                                                        const meta = getGpsTypeMeta(t.type || String(t));
                                                        const Icon = meta.icon;

                                                        return (
                                                            <span key={i} className="px-2 py-0.5 rounded-md bg-muted text-xs flex items-center gap-1">
                                                                <Icon className="w-3 h-3 text-[#039C51]" />
                                                                {t.count || 1}x {t.label || meta.label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {selectedOrder.notes && (
                                            <div className="pt-2 border-t border-border">
                                                <p className="text-xs text-muted-foreground mb-1">Note du client :</p>
                                                <p className="text-xs bg-muted/40 rounded-lg p-2 italic">{selectedOrder.notes}</p>
                                            </div>
                                        )}

                                        <div className="pt-2 border-t border-border flex justify-between">
                                            <span className="font-semibold text-foreground">Total matériel</span>
                                            <span className="text-lg font-bold text-[#039C51]">{selectedOrder.totalDueToday} TND</span>
                                        </div>
                                        {selectedOrder.source !== 'client_upgrade' && selectedOrder.recurringCost > 0 && (
                                            <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Récurrent</span>
                                                <span className="font-medium">{selectedOrder.recurringCost} TND / cycle</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Admin Notes */}
                                <div className="rounded-xl border border-border p-4 space-y-3">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                        <MessageSquare className="w-3.5 h-3.5" /> Notes Admin
                                    </h3>
                                    <textarea
                                        value={adminNotes}
                                        onChange={e => setAdminNotes(e.target.value)}
                                        rows={3}
                                        placeholder="Ajouter des notes internes..."
                                        className="w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground resize-none"
                                    />
                                    <Button size="sm" onClick={() => handleSaveNotes(selectedOrder._id)} className="bg-[#039C51] text-white hover:bg-[#039C51]/90">
                                        Sauvegarder les notes
                                    </Button>
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedOrder.status === 'pending' && (
                                            <Button
                                                onClick={() => setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Confirmer la commande',
                                                    message: 'Êtes-vous sûr que la commande a été confirmée avec le client par téléphone ou email ?',
                                                    action: 'confirmed',
                                                    orderId: selectedOrder._id
                                                })}
                                                className="bg-blue-500 text-white hover:bg-blue-600 gap-1.5 shadow-md"
                                            >
                                                <CheckCircle2 className="w-4 h-4" /> Confirmer
                                            </Button>
                                        )}
                                        {selectedOrder.status === 'confirmed' && getNextStatus(selectedOrder.status) === 'installing' && (
                                            <Button
                                                onClick={() => setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Passer à l\'installation',
                                                    message: 'La commande a été confirmée. Voulez-vous la faire passer à l\'étape d\'installation ?',
                                                    action: 'installing',
                                                    orderId: selectedOrder._id
                                                })}
                                                className="bg-purple-500 text-white hover:bg-purple-600 gap-1.5 shadow-md"
                                            >
                                                <Truck className="w-4 h-4" /> Étape suivante
                                            </Button>
                                        )}
                                        {selectedOrder.status === 'installing' && (
                                            <>
                                                <Button onClick={openActivationModal}
                                                    disabled={isProcessing}
                                                    className="bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700 gap-1.5 shadow-lg">
                                                    <Zap className="w-4 h-4" />
                                                    {isProcessing ? 'Activation...' : isUpgradeOrder ? 'Continuer Smart Create' : 'Smart Create'}
                                                </Button>
                                                <Button onClick={() => setConfirmDialog({
                                                    isOpen: true,
                                                    title: 'Activation Manuelle',
                                                    message: 'Avez-vous créé le compte client et les appareils manuellement ? Confirmez-vous l\'activation définitive ?',
                                                    action: 'active',
                                                    orderId: selectedOrder._id
                                                })}
                                                    className="bg-[#039C51] text-white hover:bg-[#039C51]/90 gap-1.5">
                                                    <CheckCircle2 className="w-4 h-4" /> Marquer comme Actif
                                                </Button>
                                            </>
                                        )}
                                        {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'active' && (
                                            <Button variant="outline" onClick={() => setConfirmDialog({
                                                isOpen: true,
                                                title: 'Annuler la commande',
                                                message: 'Êtes-vous sûr de vouloir annuler définitivement cette commande ? Cette action est irréversible.',
                                                action: 'cancelled',
                                                orderId: selectedOrder._id
                                            })}
                                                className="text-red-400 border-red-400/20 hover:bg-red-400/10 gap-1.5">
                                                <XCircle className="w-4 h-4" /> Annuler
                                            </Button>
                                        )}
                                        <Button variant="outline" onClick={() => handleDelete(selectedOrder._id)}
                                            className="text-red-400 border-red-400/20 hover:bg-red-400/10 gap-1.5 ml-auto">
                                            Supprimer
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Process Result Modal */}
                {processResult && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="bg-card border border-border rounded-2xl shadow-2xl w-[500px] max-h-[80vh] overflow-y-auto">
                            <div className="p-6 border-b border-border bg-gradient-to-r from-violet-500/10 to-purple-600/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                        <Zap className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold">✅ Commande Activée!</h2>
                                        <p className="text-sm text-muted-foreground">Ref: {processResult.orderRef}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Steps */}
                                <div className="space-y-2">
                                    {processResult.steps?.map((s: any, i: number) => (
                                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${s.status === 'created' || s.status === 'activated' || s.status === 'sent'
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : s.status === 'exists' || s.status === 'skipped'
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'bg-red-500/20 text-red-400'
                                                }`}>
                                                {s.status === 'created' || s.status === 'activated' || s.status === 'sent' ? '✓' :
                                                    s.status === 'exists' ? '→' : '!'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium capitalize">{s.step}</p>
                                                <p className="text-xs text-muted-foreground">{s.status}{s.name ? `: ${s.name}` : ''}{s.count ? `: ${s.count} créés` : ''}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Credentials */}
                                {processResult.user?.tempPassword ? (
                                    <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
                                        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                                            <UserIcon className="w-4 h-4" /> Accès créés
                                        </h3>
                                        <div className="space-y-1.5 text-sm">
                                            <p><span className="text-muted-foreground">Email:</span> <code className="text-[#039C51]">{processResult.user.email}</code></p>
                                            <p><span className="text-muted-foreground">Mot de passe:</span> <code className="text-[#142945] font-bold">{processResult.user.tempPassword}</code></p>
                                            <p><span className="text-muted-foreground">Entreprise:</span> {processResult.enterprise?.name}</p>
                                            <p><span className="text-muted-foreground">Appareils:</span> {processResult.devices?.length} GPS créés</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
                                            <Building2 className="w-4 h-4" /> Parc existant mis à jour
                                        </h3>
                                        <div className="space-y-1.5 text-sm">
                                            <p><span className="text-muted-foreground">Entreprise:</span> {processResult.enterprise?.name}</p>
                                            <p><span className="text-muted-foreground">Compte opérateur:</span> {processResult.user?.email}</p>
                                            <p><span className="text-muted-foreground">Appareils ajoutés:</span> {processResult.devices?.length} GPS</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-border flex justify-end">
                                <Button onClick={() => { setProcessResult(null); setIsProcessing(false); setSelectedOrder(null); }}
                                    className="bg-[#039C51] text-white hover:bg-[#039C51]/90">
                                    Fermer
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Prefix Configuration Modal */}
                {isPrefixModalOpen && selectedOrder && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProcessing && setIsPrefixModalOpen(false)} />
                        <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-violet-400" />
                                    Configuration des Identifiants
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => !isProcessing && setIsPrefixModalOpen(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                                <p className="text-sm text-muted-foreground">
                                    {isUpgradeOrder
                                        ? 'Cette mise à jour complète un parc existant. Chaque GPS peut être ajusté individuellement avant validation.'
                                        : `Les identifiants proposés pour les ${selectedOrder.gpsCount} GPS sont générés automatiquement et peuvent être modifiés appareil par appareil.`}
                                </p>
                                {isUpgradeOrder ? (
                                    <div className="space-y-3">
                                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                                                <Building2 className="w-4 h-4" /> Parc existant détecté
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Entreprise</p>
                                                    <p className="font-medium text-foreground">{activationPreview?.enterpriseName || selectedOrder.company || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Opérateur</p>
                                                    <p className="font-medium text-foreground">{activationPreview?.operatorName || selectedOrder.fullName || '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Appareils existants</p>
                                                    <p className="font-medium text-foreground">{activationPreview?.deviceCount ?? 0}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Nouvelle commande</p>
                                                    <p className="font-medium text-foreground">{selectedOrder.gpsCount} GPS</p>
                                                </div>
                                            </div>
                                        </div>

                                        {activationPreview?.nextIds && (
                                            <div className="rounded-xl border border-border bg-background/70 p-4 space-y-2">
                                                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prochains identifiants calculés</p>
                                                <div className="space-y-1 text-sm">
                                                    <p><span className="text-muted-foreground">SIM:</span> <code className="text-[#039C51] font-semibold">{activationPreview.nextIds.subscriberNumber}</code></p>
                                                    <p><span className="text-muted-foreground">Série:</span> <code className="text-[#039C51] font-semibold">{activationPreview.nextIds.serialNumber}</code></p>
                                                    <p><span className="text-muted-foreground">IMEI:</span> <code className="text-[#039C51] font-semibold">{activationPreview.nextIds.imei}</code></p>
                                                </div>
                                            </div>
                                        )}

                                        <p className="text-xs text-muted-foreground">
                                            La création AI utilisera l’entreprise existante et continuera automatiquement la suite logique des appareils déjà en service.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                        Les identifiants proposés ci-dessous sont générés à partir des règles de départ et peuvent être ajustés appareil par appareil.
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold text-foreground">Identifiants par appareil</p>
                                        <span className="text-xs text-muted-foreground">{deviceRows.length} GPS</span>
                                    </div>

                                    <div className="space-y-3 max-h-[46vh] overflow-y-auto pr-1">
                                        {deviceRows.map((device, index) => (
                                            <div key={index} className="rounded-xl border border-border bg-background/80 p-4 space-y-3 shadow-sm">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-foreground">GPS {String(index + 1).padStart(2, '0')} - {getDeviceTypeLabel(device.deviceType)}</p>
                                                        <p className="text-xs text-muted-foreground">Modifier SIM, Série et IMEI pour cet appareil</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Type</label>
                                                        <select
                                                            value={device.deviceType}
                                                            onChange={e => setDeviceRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, deviceType: e.target.value as DeviceTypeValue } : row))}
                                                            className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                                                        >
                                                            {DEVICE_TYPE_OPTIONS.map(option => (
                                                                <option key={option.value} value={option.value}>{option.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">SIM</label>
                                                        <Input
                                                            value={device.sim}
                                                            onChange={e => setDeviceRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, sim: e.target.value } : row))}
                                                            className="bg-background"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Série</label>
                                                        <Input
                                                            value={device.serie}
                                                            onChange={e => setDeviceRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, serie: e.target.value } : row))}
                                                            className="bg-background"
                                                        />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">IMEI</label>
                                                        <Input
                                                            value={device.imei}
                                                            onChange={e => setDeviceRows(rows => rows.map((row, rowIndex) => rowIndex === index ? { ...row, imei: e.target.value } : row))}
                                                            className="bg-background"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 p-4 border-t border-border bg-muted/10 rounded-b-2xl">
                                <Button type="button" variant="outline" onClick={() => setIsPrefixModalOpen(false)} disabled={isProcessing}>
                                    Annuler
                                </Button>
                                <Button onClick={() => handleProcessOrder(selectedOrder._id)} disabled={isProcessing} className="bg-gradient-to-r from-violet-500 to-purple-600 text-white hover:from-violet-600 hover:to-purple-700">
                                    {isProcessing ? 'Création...' : isUpgradeOrder ? 'Continuer et Activer' : 'Créer et Activer'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Confirmation Popup */}
                {confirmDialog.isOpen && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDialog(d => ({ ...d, isOpen: false }))} />
                        <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${confirmDialog.action === 'cancelled' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {confirmDialog.action === 'cancelled' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                                </div>
                                <h2 className="text-lg font-bold">{confirmDialog.title}</h2>
                            </div>
                            <p className="text-sm text-muted-foreground mb-6 mt-2">{confirmDialog.message}</p>
                            <div className="flex justify-end gap-3">
                                <Button variant="outline" onClick={() => setConfirmDialog(d => ({ ...d, isOpen: false }))}>
                                    Annuler
                                </Button>
                                <Button className={confirmDialog.action === 'cancelled' ? "bg-red-500 hover:bg-red-600 text-white" : "bg-blue-500 hover:bg-blue-600 text-white"}
                                    onClick={() => {
                                        if (confirmDialog.orderId) handleStatusChange(confirmDialog.orderId, confirmDialog.action);
                                        setConfirmDialog(d => ({ ...d, isOpen: false }));
                                    }}>
                                    Confirmer
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Add Order Modal — Multi-step */}
                {isAddModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && (setIsAddModalOpen(false), setOrderMode('choose'))} />
                        <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">

                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <ShoppingCart className="w-5 h-5 text-[#039C51]" />
                                    {orderMode === 'choose' ? 'Nouvelle Commande' : orderMode === 'new' ? 'Nouveau Client' : 'Mise à Jour Client'}
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => { setIsAddModalOpen(false); setOrderMode('choose'); }}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Step 1: Choose Mode */}
                            {orderMode === 'choose' && (
                                <div className="p-6 space-y-4">
                                    <p className="text-sm text-muted-foreground">Quel type de commande souhaitez-vous créer ?</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button onClick={() => setOrderMode('new')}
                                            className="group flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-border bg-card hover:border-[#039C51]/50 hover:bg-[#039C51]/5 transition-all duration-200 text-left">
                                            <div className="w-14 h-14 rounded-2xl bg-[#039C51]/10 flex items-center justify-center group-hover:bg-[#039C51]/20 transition-colors">
                                                <UserPlus className="w-7 h-7 text-[#039C51]" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-foreground text-[15px]">Nouveau Client</p>
                                                <p className="text-xs text-muted-foreground mt-1">Première commande, créer un nouveau compte et abonnement</p>
                                            </div>
                                        </button>
                                        <button onClick={() => setOrderMode('upgrade')}
                                            className="group flex flex-col items-center gap-4 p-6 rounded-xl border-2 border-border bg-card hover:border-purple-400/50 hover:bg-purple-400/5 transition-all duration-200 text-left">
                                            <div className="w-14 h-14 rounded-2xl bg-purple-400/10 flex items-center justify-center group-hover:bg-purple-400/20 transition-colors">
                                                <Boxes className="w-7 h-7 text-purple-400" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-bold text-foreground text-[15px]">Client Existant</p>
                                                <p className="text-xs text-muted-foreground mt-1">Ajouter des appareils GPS à un client déjà enregistré</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Step 2a: New Client Form */}
                            {orderMode === 'new' && (
                                <div className="flex flex-col flex-1 min-h-0">
                                    <div className="px-6 pt-6 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentOrderStep >= 1 ? 'bg-[#039C51] text-white shadow-[0_0_15px_rgba(3,156,81,0.3)]' : 'bg-muted text-muted-foreground'}`}>1</div>
                                            <div className={`h-1 w-8 rounded-full transition-colors ${currentOrderStep >= 2 ? 'bg-[#039C51]' : 'bg-muted'}`} />
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentOrderStep >= 2 ? 'bg-[#039C51] text-white shadow-[0_0_15px_rgba(3,156,81,0.3)]' : 'bg-muted text-muted-foreground'}`}>2</div>
                                            <div className={`h-1 w-8 rounded-full transition-colors ${currentOrderStep >= 3 ? 'bg-[#039C51]' : 'bg-muted'}`} />
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentOrderStep >= 3 ? 'bg-[#039C51] text-white shadow-[0_0_15px_rgba(3,156,81,0.3)]' : 'bg-muted text-muted-foreground'}`}>3</div>
                                        </div>
                                        <button type="button" onClick={() => { setOrderMode('choose'); setCurrentOrderStep(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                            Annuler <X className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="p-6 flex-1 min-h-0 overflow-y-auto">
                                        {currentOrderStep === 1 && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <h3 className="text-lg font-bold text-foreground">Informations du Client</h3>
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Nom complet *</label>
                                                        <Input required placeholder="Ex: Jean Dupont" value={newOrder.fullName} onChange={e => setNewOrder({ ...newOrder, fullName: e.target.value })} className="bg-background" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Téléphone *</label>
                                                        <Input required type="tel" placeholder="Ex: 55 123 456" value={newOrder.phone} onChange={e => setNewOrder({ ...newOrder, phone: e.target.value })} className="bg-background" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Email *</label>
                                                        <Input required type="email" placeholder="contact@email.com" value={newOrder.email} onChange={e => setNewOrder({ ...newOrder, email: e.target.value })} className="bg-background" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Société (Optionnel)</label>
                                                        <Input placeholder="Nom de l'entreprise" value={newOrder.company} onChange={e => setNewOrder({ ...newOrder, company: e.target.value })} className="bg-background" />
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {currentOrderStep === 2 && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <h3 className="text-lg font-bold text-foreground">Appareils GPS</h3>
                                                {renderGpsAllocation('new')}
                                            </div>
                                        )}
                                        {currentOrderStep === 3 && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <h3 className="text-lg font-bold text-foreground">Abonnement & Finalisation</h3>
                                                <div className="grid grid-cols-2 gap-5">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Plan *</label>
                                                        <select value={newOrder.plan} onChange={e => setNewOrder({ ...newOrder, plan: e.target.value })} className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm text-foreground">
                                                            <option value="starter">Starter</option>
                                                            <option value="pro">Pro</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-medium">Cycle de facturation *</label>
                                                        <select value={newOrder.billingCycle} onChange={e => setNewOrder({ ...newOrder, billingCycle: e.target.value })} className="w-full h-10 px-3 rounded-md bg-background border border-border text-sm text-foreground">
                                                            <option value="monthly">Mensuel</option>
                                                            <option value="biannual">6 Mois (-{pricing.biannual_discount || 10}%)</option>
                                                            <option value="annual">Annuel (-{pricing.annual_discount || 20}%)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                <div className="bg-muted/10 rounded-xl p-5 mt-4 border border-border">
                                                    <p className="text-sm font-bold text-foreground mb-4">Détails de la facturation initiale</p>
                                                    <div className="space-y-3 mb-4">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Appareils GPS ({newOrder.gpsCount}x)</span>
                                                            <span className="font-medium text-foreground">{Math.round(newOrder.gpsCount * (pricing.device_price || 110))} TND</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Frais d'installation</span>
                                                            <span className="font-medium text-foreground">{pricing.installation_fee || 40} TND</span>
                                                        </div>
                                                        {(pricing.deposit_amount || 0) > 0 && (
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Dépôt de garantie</span>
                                                                <span className="font-medium text-foreground">{pricing.deposit_amount} TND</span>
                                                            </div>
                                                        )}
                                                        {(pricing.advance_months || 0) > 0 && (
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Avance ({pricing.advance_months} mois)</span>
                                                                <span className="font-medium text-foreground">
                                                                    {(() => {
                                                                        const mp = pricing[`${newOrder.plan}_monthly`] || (newOrder.plan === 'starter' ? 29 : newOrder.plan === 'pro' ? 39 : 30);
                                                                        let rc = newOrder.gpsCount * mp;
                                                                        const biD = (pricing.biannual_discount || 10) / 100;
                                                                        const anD = (pricing.annual_discount || 20) / 100;
                                                                        if (newOrder.billingCycle === 'biannual') rc *= (1 - biD);
                                                                        if (newOrder.billingCycle === 'annual') rc *= (1 - anD);
                                                                        return Math.round(rc * (pricing.advance_months || 3));
                                                                    })()} TND
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-end pt-4 border-t border-border border-dashed">
                                                        <span className="text-sm font-medium text-foreground">Total exigé aujourd'hui</span>
                                                        <span className="text-2xl font-black text-[#039C51]">
                                                            {(() => {
                                                                const mp = pricing[`${newOrder.plan}_monthly`] || (newOrder.plan === 'starter' ? 29 : newOrder.plan === 'pro' ? 39 : 30);
                                                                let rc = newOrder.gpsCount * mp;
                                                                const biD = (pricing.biannual_discount || 10) / 100;
                                                                const anD = (pricing.annual_discount || 20) / 100;
                                                                if (newOrder.billingCycle === 'biannual') rc *= (1 - biD);
                                                                if (newOrder.billingCycle === 'annual') rc *= (1 - anD);
                                                                return Math.round((newOrder.gpsCount * (pricing.device_price || 110)) + (pricing.installation_fee || 40) + (pricing.deposit_amount || 0) + (rc * (pricing.advance_months || 3)));
                                                            })()} <span className="text-base font-medium">TND</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center p-5 border-t border-border bg-muted/10 rounded-b-2xl shrink-0">
                                        {currentOrderStep > 1 ? (
                                            <Button type="button" variant="outline" onClick={() => setCurrentOrderStep(s => s - 1)} disabled={isSubmitting}>
                                                Précédent
                                            </Button>
                                        ) : (
                                            <div />
                                        )}

                                        {currentOrderStep < 3 ? (
                                            <Button type="button" className="bg-foreground text-background hover:bg-foreground/90 px-8"
                                                onClick={() => {
                                                    // Basic validation before next
                                                    if (currentOrderStep === 1 && (!newOrder.fullName || !newOrder.phone || !newOrder.email)) {
                                                        toast.error("Veuillez remplir les champs obligatoires (*)");
                                                        return;
                                                    }
                                                    if (currentOrderStep === 2 && newOrder.gpsCount <= 0) {
                                                        toast.error("Veuillez ajouter au moins un GPS");
                                                        return;
                                                    }
                                                    setCurrentOrderStep(s => s + 1);
                                                }}>
                                                Suivant <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        ) : (
                                            <Button type="button" onClick={handleAddOrder as any} disabled={isSubmitting} className="bg-[#039C51] text-white hover:bg-[#039C51]/90 px-8 font-bold">
                                                {isSubmitting ? 'Création...' : 'Créer la commande'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Step 2b: Upgrade Client Form */}
                            {orderMode === 'upgrade' && (
                                <div className="flex flex-col flex-1 min-h-0">
                                    <div className="px-6 pt-6 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentOrderStep >= 1 ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-muted text-muted-foreground'}`}>1</div>
                                            <div className={`h-1 w-8 rounded-full transition-colors ${currentOrderStep >= 2 ? 'bg-purple-500' : 'bg-muted'}`} />
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentOrderStep >= 2 ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-muted text-muted-foreground'}`}>2</div>
                                            <div className={`h-1 w-8 rounded-full transition-colors ${currentOrderStep >= 3 ? 'bg-purple-500' : 'bg-muted'}`} />
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${currentOrderStep >= 3 ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-muted text-muted-foreground'}`}>3</div>
                                        </div>
                                        <button type="button" onClick={() => { setOrderMode('choose'); setCurrentOrderStep(1); }} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                            Annuler <X className="w-3 h-3" />
                                        </button>
                                    </div>

                                    <div className="p-6 flex-1 min-h-0 overflow-y-auto">
                                        {currentOrderStep === 1 && (
                                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-lg font-bold text-foreground">Sélection du Client</h3>
                                                </div>
                                                <div className="flex items-start gap-3 bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                                                    <PackagePlus className="w-5 h-5 text-purple-400 mt-0.5" />
                                                    <div>
                                                        <p className="font-semibold text-purple-300 text-sm">Ajout d'appareils (Upgrade)</p>
                                                        <p className="text-xs text-purple-300/80 mt-1">Ajoutez des GPS à un client existant. Son plan d'abonnement actuel sera conservé de manière transparente.</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-4 mt-6">
                                                    <div className="space-y-2">
                                                        <label className="text-sm font-semibold text-purple-400 flex items-center gap-2">
                                                            <Search className="w-4 h-4" /> Rechercher dans la base client
                                                        </label>
                                                        <select
                                                            className="w-full h-12 px-4 rounded-xl bg-background border-2 border-border text-sm text-foreground focus:ring-purple-500 focus:border-purple-500 transition-colors"
                                                            value={upgradeOrder.email}
                                                            onChange={(e) => {
                                                                const u = users.find(u => u.email === e.target.value);
                                                                if (u) {
                                                                    setUpgradeOrder(prev => ({
                                                                        ...prev, fullName: u.name, email: u.email, company: u.enterpriseName || '', phone: (u as any).phone || ''
                                                                    }));
                                                                }
                                                            }}
                                                        >
                                                            <option value="">-- Sélectionnez un opérateur enregistré --</option>
                                                            {users.filter(u => u.role === 'operator').map(u => (
                                                                <option key={u.id} value={u.email}>{u.name} ({u.email})</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                                                        <div className="space-y-1.5 min-w-0">
                                                            <label className="text-xs font-medium text-muted-foreground">Nom / Contact</label>
                                                            <Input required placeholder="Sélectionnez un client..." value={upgradeOrder.fullName} onChange={e => setUpgradeOrder({ ...upgradeOrder, fullName: e.target.value })} className="h-9 bg-background/50 border-0 shadow-none text-sm" />
                                                        </div>
                                                        <div className="space-y-1.5 min-w-0">
                                                            <label className="text-xs font-medium text-muted-foreground">Téléphone</label>
                                                            <Input required type="tel" placeholder="Sélectionnez un client..." value={upgradeOrder.phone} onChange={e => setUpgradeOrder({ ...upgradeOrder, phone: e.target.value })} className="h-9 bg-background/50 border-0 shadow-none text-sm" />
                                                        </div>
                                                        <div className="space-y-1.5 min-w-0 col-span-2">
                                                            <label className="text-xs font-medium text-muted-foreground">Société liée</label>
                                                            <Input placeholder="Sélectionnez un client..." value={upgradeOrder.company} onChange={e => setUpgradeOrder({ ...upgradeOrder, company: e.target.value })} className="h-9 bg-background/50 border-0 shadow-none text-sm" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {currentOrderStep === 2 && (
                                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <h3 className="text-lg font-bold text-foreground">Appareils GPS</h3>
                                                {renderGpsAllocation('upgrade')}

                                                <div className="space-y-2 mt-4">
                                                    <label className="text-sm font-medium">Notes d'installation (optionnel)</label>
                                                    <Input placeholder="Ex: 2 véhicules lourds + 1 voiture, prévoir des câbles longs" value={upgradeOrder.notes} onChange={e => setUpgradeOrder({ ...upgradeOrder, notes: e.target.value })} className="bg-background" />
                                                </div>
                                            </div>
                                        )}

                                        {currentOrderStep === 3 && (
                                            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                                                <h3 className="text-lg font-bold text-foreground">Validation & Facture</h3>
                                                <div className="bg-purple-500/5 rounded-xl p-5 mt-4 border border-purple-500/20">
                                                    <p className="text-sm font-bold text-foreground mb-4">Détails de la mise à jour</p>
                                                    <div className="space-y-3 mb-4">
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Appareils GPS ({upgradeOrder.gpsCount}x)</span>
                                                            <span className="font-medium text-foreground">{Math.round(upgradeOrder.gpsCount * (pricing.device_price || 110))} TND</span>
                                                        </div>
                                                        <div className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground">Frais d'installation</span>
                                                            <span className="font-medium text-foreground">{pricing.installation_fee || 40} TND</span>
                                                        </div>
                                                        {(pricing.deposit_amount || 0) > 0 && (
                                                            <div className="flex justify-between text-sm">
                                                                <span className="text-muted-foreground">Dépôt de garantie</span>
                                                                <span className="font-medium text-foreground">{pricing.deposit_amount} TND</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-end pt-4 border-t border-purple-500/20 border-dashed">
                                                        <div>
                                                            <span className="text-sm font-medium text-foreground block">Total exigé aujourd'hui</span>
                                                            <span className="text-xs text-muted-foreground mt-0.5 block">Abonnement existant inchangé</span>
                                                        </div>
                                                        <span className="text-2xl font-black text-purple-400">
                                                            {Math.round(upgradeOrder.gpsCount * (pricing.device_price || 110) + (pricing.installation_fee || 40) + (pricing.deposit_amount || 0))} <span className="text-base font-medium">TND</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex justify-between items-center p-5 border-t border-border bg-muted/10 rounded-b-2xl shrink-0">
                                        {currentOrderStep > 1 ? (
                                            <Button type="button" variant="outline" onClick={() => setCurrentOrderStep(s => s - 1)} disabled={isSubmitting}>
                                                Précédent
                                            </Button>
                                        ) : (
                                            <div />
                                        )}

                                        {currentOrderStep < 3 ? (
                                            <Button type="button" className="bg-foreground text-background hover:bg-foreground/90 px-8"
                                                onClick={() => {
                                                    if (currentOrderStep === 1 && (!upgradeOrder.email || !upgradeOrder.fullName)) {
                                                        toast.error("Veuillez sélectionner un client existant");
                                                        return;
                                                    }
                                                    if (currentOrderStep === 2 && upgradeOrder.gpsCount <= 0) {
                                                        toast.error("Veuillez ajouter au moins un GPS");
                                                        return;
                                                    }
                                                    setCurrentOrderStep(s => s + 1);
                                                }}>
                                                Suivant <ArrowRight className="w-4 h-4 ml-2" />
                                            </Button>
                                        ) : (
                                            <Button type="button" onClick={handleUpgradeOrder as any} disabled={isSubmitting} className="bg-purple-500 text-white hover:bg-purple-600 px-8 font-bold">
                                                {isSubmitting ? 'Création...' : 'Valider la commande'}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ Pricing Config Modal ═══════════════════════════ */}
                {isPricingModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !savingPricing && setIsPricingModalOpen(false)} />
                        <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-amber-500/5 to-orange-500/5 shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                                        <DollarSign className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold">Configuration des Tarifs</h2>
                                        <p className="text-xs text-muted-foreground">Modifier les prix appliqués aux nouvelles commandes</p>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => !savingPricing && setIsPricingModalOpen(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto flex-1 space-y-6">
                                {/* Subscription Section */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3 flex items-center gap-2">
                                        <DollarSign className="w-3.5 h-3.5" /> Abonnements (TND)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {pricingRows.filter(r => r.category === 'subscription' && r.key.endsWith('_monthly')).map(r => (
                                            <div key={r.key} className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">{r.label}</label>
                                                <Input
                                                    type="number" step="0.01" min="0"
                                                    value={pricingEdits[r.key] ?? r.value}
                                                    onChange={e => setPricingEdits(prev => ({ ...prev, [r.key]: parseFloat(e.target.value) || 0 }))}
                                                    className="bg-background h-9 text-sm font-semibold"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Hardware Section */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#039C51] mb-3 flex items-center gap-2">
                                        <Package className="w-3.5 h-3.5" /> Matériel & Frais (TND)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {pricingRows.filter(r => r.category === 'hardware').map(r => (
                                            <div key={r.key} className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">{r.label}</label>
                                                <Input
                                                    type="number" step="0.01" min="0"
                                                    value={pricingEdits[r.key] ?? r.value}
                                                    onChange={e => setPricingEdits(prev => ({ ...prev, [r.key]: parseFloat(e.target.value) || 0 }))}
                                                    className="bg-background h-9 text-sm font-semibold"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Discount Section */}
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-2">
                                        <Zap className="w-3.5 h-3.5" /> Réductions (%)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        {pricingRows.filter(r => r.category === 'discount').map(r => (
                                            <div key={r.key} className="space-y-1.5">
                                                <label className="text-xs font-medium text-muted-foreground">{r.label}</label>
                                                <Input
                                                    type="number" step="0.1" min="0" max="100"
                                                    value={pricingEdits[r.key] ?? r.value}
                                                    onChange={e => setPricingEdits(prev => ({ ...prev, [r.key]: parseFloat(e.target.value) || 0 }))}
                                                    className="bg-background h-9 text-sm font-semibold"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Preview */}
                                <div className="rounded-xl bg-muted/30 border border-border p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Aperçu — Nouvelle commande (1 GPS, Starter, Mensuel)</p>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <span className="text-muted-foreground">Matériel :</span>
                                        <span className="font-semibold text-right">{pricingEdits.device_price ?? pricing.device_price ?? 110} TND</span>
                                        <span className="text-muted-foreground">Installation :</span>
                                        <span className="font-semibold text-right">{pricingEdits.installation_fee ?? pricing.installation_fee ?? 40} TND</span>
                                        <span className="text-muted-foreground">Dépôt de garantie :</span>
                                        <span className="font-semibold text-right">{pricingEdits.deposit_amount ?? pricing.deposit_amount ?? 0} TND</span>
                                        <span className="text-muted-foreground">Abonnement ({pricingEdits.advance_months ?? pricing.advance_months ?? 3} mois) :</span>
                                        <span className="font-semibold text-right">{Math.round((pricingEdits.starter_monthly ?? pricing.starter_monthly ?? 29) * (pricingEdits.advance_months ?? pricing.advance_months ?? 3))} TND</span>
                                        <span className="font-bold text-foreground border-t border-border pt-1">Total :</span>
                                        <span className="font-black text-[#039C51] text-right border-t border-border pt-1">
                                            {Math.round(
                                                (pricingEdits.device_price ?? pricing.device_price ?? 110) +
                                                (pricingEdits.installation_fee ?? pricing.installation_fee ?? 40) +
                                                (pricingEdits.deposit_amount ?? pricing.deposit_amount ?? 0) +
                                                (pricingEdits.starter_monthly ?? pricing.starter_monthly ?? 29) * (pricingEdits.advance_months ?? pricing.advance_months ?? 3)
                                            )} TND
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-end gap-3 p-4 border-t border-border bg-muted/10 rounded-b-2xl shrink-0">
                                <Button variant="outline" onClick={() => setIsPricingModalOpen(false)} disabled={savingPricing}>
                                    Annuler
                                </Button>
                                <Button
                                    className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 gap-1.5"
                                    disabled={savingPricing}
                                    onClick={async () => {
                                        setSavingPricing(true);
                                        try {
                                            const updates = Object.entries(pricingEdits).map(([key, value]) => ({ key, value }));
                                            if (updates.length === 0) { setIsPricingModalOpen(false); return; }
                                            const result = await pricingApi.update(updates);
                                            setPricing(result.config);
                                            setPricingRows(result.rows);
                                            toast.success('✅ Tarifs mis à jour avec succès !');
                                            setIsPricingModalOpen(false);
                                        } catch (err: any) {
                                            toast.error('Erreur de mise à jour', { description: err.message });
                                        } finally {
                                            setSavingPricing(false);
                                        }
                                    }}
                                >
                                    <Save className="w-4 h-4" />
                                    {savingPricing ? 'Sauvegarde...' : 'Sauvegarder les tarifs'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
};

export default OrdersPage;
