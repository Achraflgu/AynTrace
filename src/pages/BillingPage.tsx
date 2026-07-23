import { useState, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import { billingApi, pricingApi } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    CreditCard, Crown, Zap, Check, X, ArrowRight, Sparkles,
    Shield, MapPin, Bot, Bell, Radio, Settings, MessageSquare,
    LayoutDashboard, Receipt, Clock, ChevronDown, ChevronUp,
    Hexagon, CalendarDays, Banknote, Building2, ArrowUpRight,
    FileText, Download, RefreshCw, Star, Lock, Mail
} from 'lucide-react';

interface Payment {
    _id: string;
    invoiceRef: string;
    plan: string;
    previousPlan: string;
    amount: number;
    billingCycle: string;
    status: string;
    method: string;
    dueDate: string;
    paidAt: string;
    description: string;
    createdAt: string;
}

const DEFAULT_PLAN_PRICING = {
    starter: { monthly: 29, biannual: 156, annual: 278 },
    pro: { monthly: 39, biannual: 210, annual: 374 },
};

const BillingPage = () => {
    const { user } = useAuthStore();
    const { lang } = useI18n();
    const isFr = lang === 'fr';

    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [planInfo, setPlanInfo] = useState<any>(null);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'biannual' | 'annual'>('monthly');
    const [paymentMethod, setPaymentMethod] = useState('');
    const [upgrading, setUpgrading] = useState(false);
    const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
    const [PLAN_PRICING, setPlanPricing] = useState(DEFAULT_PLAN_PRICING);
    const [discounts, setDiscounts] = useState({ biannual: 10, annual: 20 });
    // Multi-step payment modal state
    const [targetPlan, setTargetPlan] = useState<'starter' | 'pro'>('pro');
    const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'receipt'>('details');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [d17Phone, setD17Phone] = useState('');
    const [d17Otp, setD17Otp] = useState('');
    const [paymentReceipt, setPaymentReceipt] = useState<any>(null);
    const [isChangeScheduled, setIsChangeScheduled] = useState(false);
    const [scheduledEffectiveDate, setScheduledEffectiveDate] = useState<string | null>(null);
    // Auto-pay state: tracks whether we're silently processing a reactivation
    const [autoPayProcessing, setAutoPayProcessing] = useState(false);
    const [autoPayDone, setAutoPayDone] = useState(false);
    const autoPayTriggered = useRef(false); // guard: fire only once per page load

    const userPlan = (user as any)?.plan || 'starter';
    const isStarter = userPlan === 'starter';
    const isPro = userPlan === 'pro' || userPlan === 'enterprise';

    useEffect(() => {
        fetchPayments();
    }, []);

    // ── Auto-reactivation ─────────────────────────────────────────────────
    // When the billing page loads and detects a suspended account with a saved
    // card (auto-renewal active, not retired), silently process the payment
    // without requiring any button click from the user.
    useEffect(() => {
        if (!planInfo) return;
        const isSuspended   = planInfo.billingStatus === 'suspended';
        const hasCard       = !!planInfo.savedPaymentMethod;
        const isAutoRenew   = !planInfo.cancelAtPeriodEnd;
        const alreadyDone   = autoPayTriggered.current;

        if (isSuspended && hasCard && isAutoRenew && !alreadyDone && !autoPayProcessing) {
            autoPayTriggered.current = true; // guard: only trigger once per page load
            handleAutoReactivate();
        }
    }, [planInfo]);

    const handleAutoReactivate = async () => {
        if (!user?.id || !planInfo) return;
        setAutoPayProcessing(true);
        try {
            await new Promise(r => setTimeout(r, 1500)); // brief animation delay
            const result = await billingApi.requestUpgrade({
                userId: user.id,
                targetPlan: userPlan as 'starter' | 'pro',
                billingCycle: (planInfo.savedBillingCycle || 'monthly') as 'monthly' | 'biannual' | 'annual',
                method: planInfo.savedPaymentMethod,
            });
            if (result.success && result.immediate) {
                useAuthStore.setState({
                    user: {
                        ...useAuthStore.getState().user,
                        plan: result.newPlan,
                        billingStatus: 'active',
                        billingNextDue: result.billingNextDue,
                    } as any,
                });
                setAutoPayDone(true);
                toast.success(isFr ? '✅ Compte réactivé avec succès !' : '✅ Account reactivated successfully!');
                await fetchPayments();
            }
        } catch (err: any) {
            toast.error(isFr ? 'Renouvellement automatique échoué. Veuillez réessayer.' : 'Auto-renewal failed. Please try again.');
        } finally {
            setAutoPayProcessing(false);
        }
    };

    // Load dynamic pricing
    useEffect(() => {
        pricingApi.getAll().then(data => {
            const c = data.config;
            const sM = c.starter_monthly || 29;
            const pM = c.pro_monthly || 39;
            const bD = c.biannual_discount || 10;
            const aD = c.annual_discount || 20;

            setDiscounts({ biannual: bD, annual: aD });
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

    const fetchPayments = async () => {
        setLoading(true);
        try {
            if (user?.id) {
                const [payData, planData] = await Promise.all([
                    billingApi.getPayments(user.id),
                    billingApi.getCurrentPlan(user.id)
                ]);
                setPayments(payData);
                setPlanInfo(planData);
                
                // Keep local auth store in sync with real billing status
                if (planData && user && planData.billingStatus !== (user as any).billingStatus) {
                    useAuthStore.setState({ 
                        user: { 
                            ...user, 
                            billingStatus: planData.billingStatus, 
                            billingNextDue: planData.billingNextDue 
                        } as any 
                    });
                }
            }
        } catch (err) {
            console.error('Failed to fetch payments:', err);
        } finally {
            setLoading(false);
        }
    };

    const openUpgradeModal = (forceReactivate = false) => {
        setTargetPlan(userPlan === 'starter' ? 'pro' : userPlan as 'starter' | 'pro');
        setPaymentMethod(planInfo?.savedPaymentMethod || '');
        // ⚠️ CRITICAL: must use the saved billing cycle — not the default 'monthly'.
        // If we send a different cycle than what's saved, the server treats it as a
        // CYCLE CHANGE (scheduled) instead of a RENEWAL (immediate), so the suspended
        // user's payment never settles the overdue invoice.
        setBillingCycle((planInfo?.savedBillingCycle as any) || 'monthly');
        setPaymentStep('details');
        setCardNumber('');
        setCardExpiry('');
        setCardCvv('');
        setD17Phone('');
        setD17Otp('');
        setPaymentReceipt(null);
        setIsChangeScheduled(false);
        setScheduledEffectiveDate(null);
        setShowUpgradeModal(true);
    };

    const formatCardNumber = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 16);
        return digits.replace(/(.{4})/g, '$1 ').trim();
    };

    const formatExpiry = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
        return digits;
    };

    const canProceedWithPayment = () => {
        if (planInfo?.savedPaymentMethod && paymentMethod === planInfo.savedPaymentMethod) return true;
        if (!paymentMethod) return false;
        if (paymentMethod === 'mastercard') {
            return cardNumber.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length === 3;
        }
        if (paymentMethod === 'd17') {
            return d17Phone.length >= 8 && d17Otp.length === 6;
        }
        if (paymentMethod === 'bank_transfer') return true;
        return false;
    };

    const handleUpgrade = async () => {
        setPaymentStep('processing');
        setUpgrading(true);
        await new Promise(r => setTimeout(r, 2500));
        try {
            const result = await billingApi.requestUpgrade({
                userId: user!.id,
                targetPlan,
                billingCycle,
                method: paymentMethod,
            });
            if (result.success) {
                if (result.immediate) {
                    // Renewal / upgrade / reactivation: apply right now
                    useAuthStore.setState({
                        user: {
                            ...useAuthStore.getState().user,
                            plan: result.newPlan,
                            billingStatus: result.billingStatus || 'active',
                            billingNextDue: result.billingNextDue,
                        } as any,
                    });
                    setIsChangeScheduled(false);
                } else {
                    // Downgrade or Cycle Change: stays current plan until period end
                    setIsChangeScheduled(true);
                    setScheduledEffectiveDate(result.effectiveDate || null);
                }
                setPaymentReceipt(result.payment);
                setPaymentStep('receipt');
                fetchPayments();
            }
        } catch (err: any) {
            toast.error(err.message || 'Paiement échoué');
            setPaymentStep('details');
        } finally {
            setUpgrading(false);
        }
    };

    const handleCancelPlan = async () => {
        if (!confirm(isFr ? 'Êtes-vous sûr de vouloir annuler votre abonnement Pro ?' : 'Are you sure you want to cancel your Pro subscription?')) return;
        try {
            await billingApi.cancelPlan(user!.id);
            toast.success(isFr ? 'Abonnement pro sera annulé à la fin de la période' : 'Pro subscription will be cancelled at period end');
            fetchPayments();
        } catch (err: any) {
            toast.error(err.message || 'Cancel failed');
        }
    };

    const handleResumePlan = async () => {
        if (!planInfo?.savedPaymentMethod) {
            toast.error(isFr ? 'Veuillez ajouter un mode de paiement d\'abord' : 'Please add a payment method first');
            openUpgradeModal();
            return;
        }
        try {
            await billingApi.resumePlan(user!.id);
            toast.success(isFr ? 'Abonnement réactivé' : 'Subscription resumed');
            fetchPayments();
        } catch (err: any) {
            toast.error(err.message || 'Resume failed');
        }
    };

    const handleRemoveMethod = async () => {
        if (!confirm(isFr ? 'Supprimer ce mode de paiement ?' : 'Remove this payment method?')) return;
        try {
            await billingApi.removeMethod(user!.id);
            toast.success(isFr ? 'Mode de paiement supprimé' : 'Payment method removed');
            fetchPayments();
        } catch (err: any) {
            toast.error(err.message || 'Remove failed');
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
            paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-400', label: isFr ? 'Payé' : 'Paid' },
            pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', label: isFr ? 'En attente' : 'Pending' },
            overdue: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', label: isFr ? 'En retard' : 'Overdue' },
            refunded: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400', label: isFr ? 'Remboursé' : 'Refunded' },
            cancelled: { bg: 'bg-gray-500/10', text: 'text-gray-400', dot: 'bg-gray-400', label: isFr ? 'Annulé' : 'Cancelled' },
        };
        const s = styles[status] || styles.pending;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                {s.label}
            </span>
        );
    };

    const getMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            d17: 'D17',
            mastercard: 'Mastercard',
            bank_transfer: isFr ? 'Virement Bancaire' : 'Bank Transfer',
        };
        return labels[method] || method;
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    };

    // Feature comparison
    const features = [
        { name: isFr ? 'Tableau de bord' : 'Dashboard', icon: LayoutDashboard, starter: true, pro: true },
        { name: isFr ? 'Carte temps réel' : 'Real-Time Map', icon: MapPin, starter: true, pro: true },
        { name: isFr ? 'Appareils GPS' : 'GPS Devices', icon: Radio, starter: true, pro: true },
        { name: isFr ? 'Alertes' : 'Alerts', icon: Bell, starter: true, pro: true },
        { name: 'Support', icon: MessageSquare, starter: true, pro: true },
        { name: isFr ? 'Paramètres' : 'Settings', icon: Settings, starter: true, pro: true },
        { name: isFr ? 'Zones GPS (Geofences)' : 'GPS Zones (Geofences)', icon: Hexagon, starter: false, pro: true },
        { name: isFr ? 'Assist. IA AynTrace' : 'AI Assistant', icon: Bot, starter: false, pro: true },
        { name: isFr ? 'Historique 90j' : '90 Days History', icon: Clock, starter: false, pro: true },
        { name: isFr ? 'Rapports' : 'Reports', icon: FileText, starter: false, pro: true },
        { name: isFr ? 'Alertes par E-mail' : 'Email Alerts', icon: Mail, starter: false, pro: true },
    ];

    const paymentMethods = [
        { id: 'd17', name: 'D17', desc: isFr ? 'Paiement mobile D17' : 'D17 Mobile Payment', icon: '📱', color: 'from-blue-500 to-cyan-500' },
        { id: 'mastercard', name: 'Mastercard', desc: isFr ? 'Carte bancaire' : 'Bank Card', icon: '💳', color: 'from-orange-500 to-red-500' },
        { id: 'bank_transfer', name: isFr ? 'Virement' : 'Transfer', desc: isFr ? 'Virement bancaire' : 'Bank Transfer', icon: '🏦', color: 'from-emerald-500 to-teal-500' },
    ];

    const currentPricing = targetPlan === 'pro' ? PLAN_PRICING.pro : PLAN_PRICING.starter;
    const targetPrice = billingCycle === 'annual' ? currentPricing.annual : billingCycle === 'biannual' ? currentPricing.biannual : currentPricing.monthly;
    
    let monthlyEquiv = currentPricing.monthly;
    if (billingCycle === 'annual') monthlyEquiv = Math.round((currentPricing.annual / 12) * 10) / 10;
    if (billingCycle === 'biannual') monthlyEquiv = Math.round((currentPricing.biannual / 6) * 10) / 10;

    let savingsPercent = 0;
    if (billingCycle === 'annual') savingsPercent = Math.round((1 - currentPricing.annual / (currentPricing.monthly * 12)) * 100);
    if (billingCycle === 'biannual') savingsPercent = Math.round((1 - currentPricing.biannual / (currentPricing.monthly * 6)) * 100);

    return (
        <DashboardLayout>
            <div className="h-screen flex flex-col overflow-hidden">
                {/* Header */}
                <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-bold flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-[#039C51]" />
                                {isFr ? 'Facturation & Abonnement' : 'Billing & Subscription'}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {isFr ? 'Gérez votre plan et suivez vos paiements' : 'Manage your plan and track your payments'}
                            </p>
                        </div>
                        <Badge className={`px-3 py-1.5 text-sm font-bold ${isPro ? 'bg-gradient-to-r from-[#142945] to-[#1a3a5f] text-white border-0' : 'bg-[#039C51]/10 text-[#039C51] border-[#039C51]/20'}`}>
                            {isPro ? <Crown className="w-3.5 h-3.5 mr-1.5" /> : <Zap className="w-3.5 h-3.5 mr-1.5" />}
                            {userPlan.toUpperCase()}
                        </Badge>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-5xl mx-auto space-y-6">

                        {/* ── Suspended Banner ──────────────────────── */}
                        {planInfo?.billingStatus === 'suspended' && (
                            <div className="rounded-2xl border-2 border-[#142945]/30 dark:border-[#142945]/50 bg-gradient-to-br from-[#142945]/5 to-[#1a3a5f]/10 dark:from-[#142945]/30 dark:to-[#142945]/10 p-6 flex flex-col gap-4 animate-in fade-in duration-300">
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    {/* Icon */}
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                                        autoPayProcessing
                                            ? 'bg-[#039C51]/20'
                                            : 'bg-[#142945]/15 dark:bg-[#142945]/40'
                                    }`}>
                                        {autoPayProcessing
                                            ? <RefreshCw className="w-7 h-7 text-[#039C51] animate-spin" />
                                            : <Lock className="w-7 h-7 text-[#142945] dark:text-white" />}
                                    </div>

                                    {/* Text */}
                                    <div className="flex-1 text-center sm:text-left">
                                        <h3 className="font-bold text-[#142945] dark:text-white text-lg">
                                            {autoPayProcessing
                                                ? (isFr ? '🔄 Renouvellement en cours...' : '🔄 Processing renewal...')
                                                : (isFr ? '⛔ Compte suspendu' : '⛔ Account Suspended')}
                                        </h3>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            {autoPayProcessing
                                                ? (isFr
                                                    ? `Traitement du paiement automatique via ${planInfo?.savedPaymentMethod ? planInfo.savedPaymentMethod.charAt(0).toUpperCase() + planInfo.savedPaymentMethod.slice(1).replace('_', ' ') : ''}…`
                                                    : `Processing automatic payment via ${planInfo?.savedPaymentMethod ? planInfo.savedPaymentMethod.charAt(0).toUpperCase() + planInfo.savedPaymentMethod.slice(1).replace('_', ' ') : ''}…`)
                                                : (planInfo?.savedPaymentMethod && !planInfo?.cancelAtPeriodEnd)
                                                    ? (isFr
                                                        ? 'Votre accès est limité. Votre paiement automatique va être traité.'
                                                        : 'Your access is restricted. Your automatic payment is being processed.')
                                                    : (isFr
                                                        ? 'Votre accès est limité. Ajoutez un mode de paiement pour réactiver votre compte.'
                                                        : 'Your access is restricted. Add a payment method to reactivate your account.')}
                                        </p>
                                    </div>

                                    {/* Refresh — hidden while auto-paying */}
                                    {!autoPayProcessing && (
                                        <Button
                                            variant="outline"
                                            className="border-[#142945]/30 dark:border-white/20 text-[#142945] dark:text-white hover:bg-[#142945]/10 shrink-0"
                                            onClick={fetchPayments}
                                            disabled={loading}
                                        >
                                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                            {isFr ? 'Vérifier' : 'Refresh'}
                                        </Button>
                                    )}
                                </div>

                                {/* Auto-pay progress bar */}
                                {autoPayProcessing && (
                                    <div className="w-full h-1.5 bg-[#142945]/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-[#142945] to-[#039C51]"
                                            style={{ animation: 'progressBar 2s ease-in-out forwards' }}
                                        />
                                    </div>
                                )}

                                {/* Manual Pay button — ONLY when no saved card OR card is retired */}
                                {!autoPayProcessing && (!planInfo?.savedPaymentMethod || planInfo?.cancelAtPeriodEnd) && (
                                    <button
                                        id="btn-reactivate-now"
                                        onClick={() => openUpgradeModal(true)}
                                        className="w-full py-3.5 rounded-xl bg-[#142945] hover:bg-[#1a3a5f] dark:bg-white dark:hover:bg-white/90 text-white dark:text-[#142945] font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#142945]/20 transition-all active:scale-[0.98]"
                                    >
                                        <CreditCard className="w-4 h-4" />
                                        {isFr ? 'Régler & Réactiver mon compte' : 'Pay & Reactivate Account'}
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── Warning Banner ───────────────────────── */}
                        {planInfo?.billingStatus === 'warning' && (
                            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 flex items-center gap-4 animate-in fade-in duration-300">
                                <div className="w-12 h-12 rounded-xl bg-[#142945]/20 flex items-center justify-center shrink-0 animate-pulse">
                                    <Bell className="w-6 h-6 text-[#142945]" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-[#142945]">
                                        {isFr ? '⚠️ Paiement bientôt dû' : '⚠️ Payment Due Soon'}
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                        {isFr
                                            ? `Votre paiement arrive à échéance le ${planInfo?.billingNextDue ? new Date(planInfo.billingNextDue).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}. Veuillez régulariser pour éviter la suspension de votre compte.`
                                            : `Your payment is due on ${planInfo?.billingNextDue ? new Date(planInfo.billingNextDue).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}. Please settle to avoid account suspension.`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Current Plan Hero ────────────────────────── */}
                        <div className={`relative overflow-hidden rounded-2xl border ${isPro ? 'border-[#142945]/20 dark:border-[#142945]/60 bg-gradient-to-br from-[#142945]/5 dark:from-[#142945]/40 via-card to-[#1a3a5f]/5 dark:to-[#142945]/10' : 'border-[#039C51]/20 bg-gradient-to-br from-[#039C51]/5 via-card to-emerald-500/5'}`}>
                            <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-10 dark:opacity-20 blur-3xl" style={{ background: isPro ? 'radial-gradient(circle, #142945, transparent)' : 'radial-gradient(circle, #039C51, transparent)' }} />
                            <div className="relative p-8">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPro ? 'bg-gradient-to-br from-[#142945] to-[#1a3a5f] shadow-lg shadow-[#142945]/20 dark:shadow-[#142945]/50' : 'bg-gradient-to-br from-[#039C51] to-emerald-600'}`}>
                                                {isPro ? <Crown className="w-6 h-6 text-white" /> : <Zap className="w-6 h-6 text-white" />}
                                            </div>
                                            <div>
                                                <h2 className="text-2xl font-bold">
                                                    {isFr ? 'Plan' : 'Plan'} {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                                                </h2>
                                                <p className="text-sm text-muted-foreground">
                                                    {isPro
                                                        ? (isFr ? 'Toutes les fonctionnalités débloquées' : 'All features unlocked')
                                                        : (isFr ? 'Plan de base — mettez à niveau pour débloquer plus' : 'Basic plan — upgrade to unlock more')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-baseline gap-1 mt-4">
                                            <span className="text-4xl font-black">
                                                {isPro ? PLAN_PRICING.pro.monthly : PLAN_PRICING.starter.monthly}
                                            </span>
                                            <span className="text-lg text-muted-foreground font-medium">TND</span>
                                            <span className="text-sm text-muted-foreground">/{isFr ? 'mois' : 'mo'}</span>
                                        </div>

                                        {payments.length > 0 && payments[0].dueDate && (
                                            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                                                <CalendarDays className="w-3.5 h-3.5" />
                                                {isFr ? 'Prochaine échéance:' : 'Next due:'} {formatDate(payments[0].dueDate)}
                                            </p>
                                        )}
                                    </div>

                                    {isStarter ? (
                                        <Button
                                            onClick={openUpgradeModal}
                                            className="bg-[#142945] hover:bg-[#1a3a5f] dark:bg-white dark:hover:bg-white/90 text-white dark:text-[#142945] border-0 shadow-lg shadow-[#142945]/20 dark:shadow-[#142945]/50 transition-all gap-2 px-6 h-12 text-sm font-bold"
                                        >
                                            <Crown className="w-4 h-4" />
                                            {isFr ? 'Passer au Pro' : 'Upgrade to Pro'}
                                            <ArrowUpRight className="w-4 h-4" />
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={openUpgradeModal}
                                            variant="outline"
                                            className="border-[#142945]/30 text-[#142945] hover:bg-[#142945]/10 dark:border-white/20 dark:text-white dark:hover:bg-white/10 transition-all gap-2 px-6 h-12 text-sm font-bold"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            {isFr ? 'Modifier le cycle' : 'Change plan cycle'}
                                        </Button>
                                    )}
                                </div>

                                {/* Pending changes or cancellation banner */}
                                {planInfo && (planInfo.pendingPlan || planInfo.cancelAtPeriodEnd) && (
                                    <div className={`mt-4 p-3 rounded-lg border text-sm font-medium flex items-center gap-2 ${planInfo.pendingPlan ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                                        <Clock className="w-4 h-4" />
                                        {planInfo.pendingPlan
                                            ? (planInfo.pendingPlan === planInfo.plan
                                                ? (isFr 
                                                    ? `Votre cycle passera en ${planInfo.pendingBillingCycle === 'annual' ? 'Annuel' : planInfo.pendingBillingCycle === 'biannual' ? 'Semestriel' : 'Mensuel'} le ${formatDate(planInfo.nextDueDate)}`
                                                    : `Your cycle will change to ${planInfo.pendingBillingCycle} on ${formatDate(planInfo.nextDueDate)}`)
                                                : (isFr 
                                                    ? `Votre plan basculera vers le plan Starter le ${formatDate(planInfo.nextDueDate)}` 
                                                    : `Your plan will downgrade to Starter on ${formatDate(planInfo.nextDueDate)}`))
                                            : (isFr
                                                ? `Votre abonnement s'arrêtera le ${formatDate(planInfo.nextDueDate)}`
                                                : `Your subscription will end on ${formatDate(planInfo.nextDueDate)}`)}
                                    </div>
                                )}

                                {/* Active payment method & cancellation info */}
                                {planInfo && (planInfo.savedPaymentMethod || isPro) && (
                                    <div className="mt-6 pt-6 border-t border-border/50 flex flex-wrap items-center justify-between gap-4">
                                        {planInfo.savedPaymentMethod && (
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-card/60 flex items-center justify-center border border-border">
                                                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-muted-foreground">{isFr ? 'Mode de paiement actif' : 'Active payment method'}</p>
                                                    <p className="font-semibold text-sm">{getMethodLabel(planInfo.savedPaymentMethod)}</p>
                                                </div>
                                                <Button variant="ghost" size="sm" onClick={handleRemoveMethod} className="ml-2 text-destructive hover:bg-destructive/10">
                                                    {isFr ? 'Retirer (non-renouvellement)' : 'Remove (cancel renewal)'}
                                                </Button>
                                            </div>
                                        )}

                                        {isPro && (
                                            planInfo.cancelAtPeriodEnd ? (
                                                <Button variant="outline" size="sm" onClick={handleResumePlan} className="text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 ml-auto gap-2">
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                    {isFr ? 'Réactiver l\'abonnement' : 'Resume Subscription'}
                                                </Button>
                                            ) : (
                                                <Button variant="outline" size="sm" onClick={handleCancelPlan} className="text-destructive border-destructive/20 hover:bg-destructive/10 ml-auto">
                                                    {isFr ? 'Annuler l\'abonnement' : 'Cancel Subscription'}
                                                </Button>
                                            )
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Plan Comparison ──────────────────────────── */}
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="p-5 border-b border-border">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-[#142945]" />
                                    {isFr ? 'Comparaison des plans' : 'Plan Comparison'}
                                </h3>
                            </div>

                            {/* Table header */}
                            <div className="grid grid-cols-[1fr_140px_140px] px-5 py-3 bg-muted/30 border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                <span>{isFr ? 'Fonctionnalité' : 'Feature'}</span>
                                <span className="text-center">Starter</span>
                                <span className="text-center font-bold text-[#142945] dark:text-white">Pro</span>
                            </div>

                            {/* Pricing row */}
                            <div className="grid grid-cols-[1fr_140px_140px] px-5 py-3 border-b border-border/50 items-center">
                                <span className="text-sm font-semibold flex items-center gap-2">
                                    <Banknote className="w-4 h-4 text-muted-foreground" />
                                    {isFr ? 'Prix mensuel' : 'Monthly Price'}
                                </span>
                                <span className="text-center font-bold text-lg">{PLAN_PRICING.starter.monthly} <span className="text-xs text-muted-foreground font-normal">TND</span></span>
                                <span className="text-center font-bold text-lg text-[#142945] dark:text-white">{PLAN_PRICING.pro.monthly} <span className="text-xs text-muted-foreground font-normal">TND</span></span>
                            </div>

                            {/* Feature rows */}
                            {features.map((feature, i) => (
                                <div key={i} className={`grid grid-cols-[1fr_140px_140px] px-5 py-3 items-center ${i < features.length - 1 ? 'border-b border-border/30' : ''} ${!feature.starter && !isPro ? 'bg-[#142945]/[0.02]' : ''}`}>
                                    <span className="text-sm flex items-center gap-2.5">
                                        <feature.icon className={`w-4 h-4 ${feature.starter ? 'text-muted-foreground' : 'text-[#142945]'}`} />
                                        {feature.name}
                                        {!feature.starter && (
                                            <Badge className="text-[9px] px-1.5 py-0 bg-[#142945]/10 text-[#142945] border-[#142945]/20">PRO</Badge>
                                        )}
                                    </span>
                                    <span className="flex justify-center">
                                        {feature.starter
                                            ? <Check className="w-5 h-5 text-[#039C51]" />
                                            : <Lock className="w-4 h-4 text-muted-foreground/30" />}
                                    </span>
                                    <span className="flex justify-center">
                                        <Check className="w-5 h-5 text-[#142945]" />
                                    </span>
                                </div>
                            ))}

                            {/* CTA row */}
                            {isStarter && (
                                <div className="px-5 py-4 bg-gradient-to-r from-[#142945]/5 to-[#1a3a5f]/5 dark:from-[#142945]/20 dark:to-[#1a3a5f]/20 border-t border-[#142945]/10 dark:border-[#142945]/30">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-muted-foreground">
                                            {isFr ? `🚀 Passez au Pro pour seulement +${PLAN_PRICING.pro.monthly - PLAN_PRICING.starter.monthly} TND/mois` : `🚀 Upgrade to Pro for only +${PLAN_PRICING.pro.monthly - PLAN_PRICING.starter.monthly} TND/month`}
                                        </p>
                                        <Button size="sm" onClick={openUpgradeModal}
                                            className="bg-[#142945] hover:bg-[#1a3a5f] dark:bg-white dark:hover:bg-white/90 text-white dark:text-[#142945] border-0 shadow-md shadow-[#142945]/20 dark:shadow-[#142945]/50 gap-1.5 font-bold">
                                            <Crown className="w-3.5 h-3.5" />
                                            {isFr ? 'Passer au Pro' : 'Upgrade'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Payment History ─────────────────────────── */}
                        <div className="rounded-2xl border border-border bg-card overflow-hidden">
                            <div className="p-5 border-b border-border flex items-center justify-between">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Receipt className="w-4 h-4 text-[#039C51]" />
                                    {isFr ? 'Historique des paiements' : 'Payment History'}
                                </h3>
                                <Button variant="ghost" size="sm" onClick={fetchPayments} className="gap-1.5 text-xs">
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    {isFr ? 'Actualiser' : 'Refresh'}
                                </Button>
                            </div>

                            {loading ? (
                                <div className="p-12 flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="p-12 text-center">
                                    <Receipt className="w-12 h-12 mx-auto text-muted-foreground/20 mb-3" />
                                    <p className="text-sm font-medium text-muted-foreground">
                                        {isFr ? 'Aucun paiement enregistré' : 'No payments recorded'}
                                    </p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                        {isFr ? 'Vos factures apparaîtront ici' : 'Your invoices will appear here'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/40">
                                    {payments.map(payment => (
                                        <div key={payment._id} className="group">
                                            <button
                                                onClick={() => setExpandedPayment(expandedPayment === payment._id ? null : payment._id)}
                                                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-muted/20 transition-colors"
                                            >
                                                {/* Invoice icon */}
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                    payment.status === 'paid' ? 'bg-emerald-500/10' :
                                                    payment.status === 'overdue' ? 'bg-red-500/10' : 'bg-amber-500/10'
                                                }`}>
                                                    <FileText className={`w-5 h-5 ${
                                                        payment.status === 'paid' ? 'text-emerald-400' :
                                                        payment.status === 'overdue' ? 'text-red-400' : 'text-amber-400'
                                                    }`} />
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 text-left min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-sm font-semibold">{payment.invoiceRef}</span>
                                                        <Badge className="text-[9px] px-1.5 py-0 bg-muted/50 text-muted-foreground border-border">
                                                            {payment.plan.toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {formatDate(payment.createdAt)} • {getMethodLabel(payment.method)} • {payment.billingCycle === 'annual' ? (isFr ? 'Annuel' : 'Annual') : (isFr ? 'Mensuel' : 'Monthly')}
                                                    </p>
                                                </div>

                                                {/* Amount */}
                                                <div className="text-right shrink-0">
                                                    <span className="font-bold text-lg">{payment.amount}</span>
                                                    <span className="text-xs text-muted-foreground ml-1">TND</span>
                                                </div>

                                                {/* Status */}
                                                <div className="shrink-0">
                                                    {getStatusBadge(payment.status)}
                                                </div>

                                                {/* Expand */}
                                                <div className="shrink-0">
                                                    {expandedPayment === payment._id
                                                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                                </div>
                                            </button>

                                            {/* Expanded details */}
                                            {expandedPayment === payment._id && (
                                                <div className="px-5 pb-4 pt-0 bg-muted/10 animate-in slide-in-from-top-2">
                                                    <div className="ml-14 grid grid-cols-2 gap-4 text-xs">
                                                        <div>
                                                            <span className="text-muted-foreground">{isFr ? 'Description' : 'Description'}</span>
                                                            <p className="font-medium mt-0.5">{payment.description || '—'}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground">{isFr ? 'Échéance' : 'Due Date'}</span>
                                                            <p className="font-medium mt-0.5">{formatDate(payment.dueDate)}</p>
                                                        </div>
                                                        {payment.paidAt && (
                                                            <div>
                                                                <span className="text-muted-foreground">{isFr ? 'Payé le' : 'Paid On'}</span>
                                                                <p className="font-medium mt-0.5">{formatDate(payment.paidAt)}</p>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <span className="text-muted-foreground">{isFr ? 'Plan précédent' : 'Previous Plan'}</span>
                                                            <p className="font-medium mt-0.5">{payment.previousPlan || '—'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {showUpgradeModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => paymentStep !== 'processing' && setShowUpgradeModal(false)} />

                    {/* Modal */}
                    <div className="relative w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in">
                        {/* Header glow */}
                        <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-[#142945]/15 dark:from-[#142945]/40 to-transparent pointer-events-none" />

                        {/* ─── STEP 1: Plan summary + payment method + card details ─── */}
                        {paymentStep === 'details' && (
                            <div className="relative p-6 space-y-5">
                                {/* Close */}
                                <button onClick={() => setShowUpgradeModal(false)} className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors z-10">
                                    <X className="w-4 h-4" />
                                </button>

                                {/* Header */}
                                <div className="text-center pr-8">
                                    <div className={`w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br ${targetPlan === 'pro' ? 'from-[#142945] to-[#1a3a5f]' : 'from-[#039C51] to-emerald-600'} flex items-center justify-center mb-3 shadow-lg shadow-[#142945]/30`}>
                                        {targetPlan === 'pro' ? <Crown className="w-7 h-7 text-white" /> : <Zap className="w-7 h-7 text-white" />}
                                    </div>
                                    <h2 className="text-xl font-bold">
                                        {isPro ? (isFr ? 'Modifier votre abonnement' : 'Change subscription') : (isFr ? 'Modifier votre abonnement' : 'Change subscription')}
                                    </h2>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {isFr ? 'Paiement 100% sécurisé' : '100% secure payment'} 🔒
                                    </p>
                                </div>

                                {/* Plan Selection */}
                                <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted/30 border border-border overflow-hidden">
                                    <button onClick={() => setTargetPlan('starter')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${targetPlan === 'starter' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                        <Zap className="w-3.5 h-3.5" /> Starter
                                    </button>
                                    <button onClick={() => setTargetPlan('pro')}
                                        className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${targetPlan === 'pro' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                        <Crown className="w-3.5 h-3.5" /> Pro
                                    </button>
                                </div>

                                {/* Billing cycle */}
                                <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted/30 border border-border overflow-hidden">
                                    {(['monthly', 'biannual', 'annual'] as const).map(c => (
                                        <button key={c} onClick={() => setBillingCycle(c)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all relative ${billingCycle === c ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                            {c === 'monthly' ? (isFr ? 'Mensuel' : 'Monthly') : c === 'biannual' ? (isFr ? '6 Mois' : '6 Months') : (isFr ? '12 Mois' : '12 Months')}
                                            {c !== 'monthly' && <Badge className="absolute -top-1.5 right-0 text-[8px] px-1 py-0 h-3 bg-[#039C51] text-white border-0">-{c === 'biannual' ? discounts.biannual : discounts.annual}%</Badge>}
                                        </button>
                                    ))}
                                </div>

                                {/* Price */}
                                <div className="text-center bg-muted/20 rounded-xl py-3 border border-border/50">
                                    <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-4xl font-black text-[#142945] dark:text-white">{targetPrice}</span>
                                        <span className="text-base text-muted-foreground font-medium">TND</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {billingCycle === 'monthly' ? (isFr ? 'Facturation mensuelle' : 'Billed monthly')
                                            : `≈ ${monthlyEquiv} TND/${isFr ? 'mois' : 'mo'} — ${isFr ? 'Économisez' : 'Save'} ${billingCycle === 'biannual' ? (currentPricing.monthly * 6) - currentPricing.biannual : (currentPricing.monthly * 12) - currentPricing.annual} TND`}
                                    </p>
                                </div>

                                {/* Payment method selector */}
                                {planInfo?.savedPaymentMethod ? (
                                    <div className="space-y-2 animate-in fade-in">
                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            {isFr ? '💳 Mode de paiement actif' : '💳 Active Payment Method'}
                                        </p>
                                        <div className="p-4 rounded-xl border-2 border-[#039C51] bg-[#039C51]/5 shadow-md flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <span className="text-3xl">
                                                    {planInfo.savedPaymentMethod === 'mastercard' ? '💳' : planInfo.savedPaymentMethod === 'd17' ? '📱' : '🏦'}
                                                </span>
                                                <div className="text-left">
                                                    <span className="text-sm font-bold block capitalize">{planInfo.savedPaymentMethod === 'bank_transfer' ? 'Virement' : planInfo.savedPaymentMethod}</span>
                                                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                                                        {isFr ? 'Sera utilisé pour ce paiement' : 'Will be used for this payment'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="w-6 h-6 rounded-full bg-[#039C51] flex items-center justify-center">
                                                <Check className="w-3 h-3 text-white" />
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {isFr ? '💳 Mode de paiement' : '💳 Payment Method'}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {paymentMethods.map(pm => (
                                            <button key={pm.id} onClick={() => setPaymentMethod(pm.id)}
                                                className={`p-3 rounded-xl border-2 transition-all text-center ${paymentMethod === pm.id ? 'border-[#142945] bg-[#142945]/5 shadow-md' : 'border-border hover:border-[#142945]/30 bg-card'}`}>
                                                <span className="text-xl block mb-1">{pm.icon}</span>
                                                <span className="text-xs font-bold block">{pm.name}</span>
                                                <span className="text-[9px] text-muted-foreground block mt-0.5">{pm.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Mastercard card form ── */}
                                {paymentMethod === 'mastercard' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <div className="bg-gradient-to-br from-[#142945] to-[#1a3a5f] rounded-xl p-4 text-white relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-8 -mt-8" />
                                            <p className="text-[10px] uppercase tracking-widest opacity-60 mb-2">{isFr ? 'N° de Carte' : 'Card Number'}</p>
                                            <input
                                                type="text" inputMode="numeric"
                                                placeholder="0000 0000 0000 0000"
                                                value={cardNumber}
                                                onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                                                className="w-full bg-transparent text-white text-lg font-mono font-bold placeholder:text-white/30 outline-none border-none tracking-widest"
                                                maxLength={19}
                                            />
                                            <div className="flex justify-between items-end mt-3">
                                                <div>
                                                    <p className="text-[10px] opacity-50 uppercase tracking-widest">Expiry</p>
                                                    <input type="text" inputMode="numeric" placeholder="MM/YY"
                                                        value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                                                        className="bg-transparent text-white font-bold text-sm placeholder:text-white/30 outline-none border-none w-16"
                                                        maxLength={5} />
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] opacity-50 uppercase tracking-widest">CVV</p>
                                                    <input type="password" inputMode="numeric" placeholder="•••"
                                                        value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                                        className="bg-transparent text-white font-bold text-sm placeholder:text-white/30 outline-none border-none w-12 text-right"
                                                        maxLength={3} />
                                                </div>
                                                <span className="text-2xl opacity-70">💳</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── D17 mobile form ── */}
                                {paymentMethod === 'd17' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isFr ? '📱 Numéro D17' : '📱 D17 Phone Number'}</label>
                                            <input type="tel" inputMode="numeric" placeholder="+216 XX XXX XXX"
                                                value={d17Phone} onChange={e => setD17Phone(e.target.value.replace(/[^0-9+\s]/g, '').slice(0, 15))}
                                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-[#142945] transition-colors" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isFr ? '🔑 Code OTP D17 (6 chiffres)' : '🔑 D17 OTP Code (6 digits)'}</label>
                                            <input type="text" inputMode="numeric" placeholder="000000"
                                                value={d17Otp} onChange={e => setD17Otp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm font-mono font-bold tracking-[0.5em] text-center focus:outline-none focus:border-[#142945] transition-colors"
                                                maxLength={6} />
                                            <p className="text-[10px] text-muted-foreground text-center">{isFr ? 'Ouvrez l\'app D17 et validez le paiement de' : 'Open D17 app and confirm payment of'} <strong>{targetPrice} TND</strong></p>
                                        </div>
                                    </div>
                                )}

                                {/* ── Bank transfer info ── */}
                                {paymentMethod === 'bank_transfer' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 bg-muted/20 rounded-xl p-4 border border-border space-y-2">
                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">🏦 {isFr ? 'Informations de virement' : 'Bank Transfer Details'}</p>
                                        {[
                                            { label: 'Bénéficiaire', value: 'AynTrace SARL' },
                                            { label: 'IBAN', value: 'TN59 1234 5678 9012 3456 7890' },
                                            { label: 'BIC/SWIFT', value: 'BIATTNTT' },
                                            { label: 'Réf.', value: `PRO-${user?.id?.slice(0,8).toUpperCase()}` },
                                        ].map(row => (
                                            <div key={row.label} className="flex justify-between items-center text-xs">
                                                <span className="text-muted-foreground">{row.label}</span>
                                                <span className="font-mono font-bold text-foreground">{row.value}</span>
                                            </div>
                                        ))}
                                        <p className="text-[10px] text-amber-500 mt-2">⚠️ {isFr ? 'Votre compte sera activé à réception du virement (1-3 jours ouvrés)' : 'Account activates upon receipt (1-3 business days)'}</p>
                                    </div>
                                )}
                                </>
                            )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-1">
                                    <Button variant="outline" className="flex-1 h-11" onClick={() => setShowUpgradeModal(false)}>
                                        {isFr ? 'Annuler' : 'Cancel'}
                                    </Button>
                                    <Button
                                        onClick={handleUpgrade}
                                        disabled={!canProceedWithPayment()}
                                        className="flex-1 h-11 bg-[#142945] hover:bg-[#1a3a5f] dark:bg-white dark:hover:bg-white/90 text-white dark:text-[#142945] border-0 shadow-lg font-bold gap-2"
                                    >
                                        {targetPlan === 'pro' ? <Crown className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                                        {isFr ? (targetPlan === userPlan ? `Mettre à jour ${targetPrice} TND` : `Passer au ${targetPlan === 'pro' ? 'Pro' : 'Starter'} ${targetPrice} TND`) 
                                              : (targetPlan === userPlan ? `Update ${targetPrice} TND` : `Switch to ${targetPlan === 'pro' ? 'Pro' : 'Starter'} ${targetPrice} TND`)}
                                        <ArrowUpRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ─── STEP 2: Processing ─── */}
                        {paymentStep === 'processing' && (
                            <div className="relative p-10 flex flex-col items-center justify-center gap-6 min-h-[320px]">
                                {/* Animated pulse rings */}
                                <div className="relative">
                                    <div className="absolute inset-0 animate-ping rounded-full bg-[#142945]/20 scale-150" />
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#142945] to-[#1a3a5f] flex items-center justify-center shadow-2xl shadow-[#142945]/30 relative z-10">
                                        <RefreshCw className="w-9 h-9 text-white animate-spin" />
                                    </div>
                                </div>
                                <div className="text-center space-y-2">
                                    <h2 className="text-xl font-bold">{isFr ? 'Traitement en cours...' : 'Processing payment...'}</h2>
                                    <p className="text-sm text-muted-foreground">{isFr ? 'Vérification sécurisée de votre paiement' : 'Securely verifying your payment'}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Shield className="w-3.5 h-3.5 text-[#039C51]" />
                                    {isFr ? 'Connexion chiffrée SSL 256-bit' : 'SSL 256-bit encrypted connection'}
                                </div>
                                {/* Progress bar */}
                                <div className="w-full max-w-xs h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#142945] to-[#039C51] rounded-full animate-[progressBar_2.5s_ease-in-out_forwards]"
                                        style={{ animation: 'progressBar 2.5s ease-in-out forwards' }} />
                                </div>
                                <style>{`@keyframes progressBar { from { width: 0% } to { width: 100% } }`}</style>
                            </div>
                        )}

                        {/* ─── STEP 3: Receipt ─── */}
                        {paymentStep === 'receipt' && (
                            <div className="relative p-6 space-y-5">
                                {/* Success glow */}
                                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#039C51]/10 to-transparent pointer-events-none" />

                                {/* Checkmark / Calendar icon */}
                                <div className="text-center relative z-10">
                                    <div className="w-18 h-18 mx-auto relative mb-4">
                                        <div className={`w-16 h-16 mx-auto rounded-full ${isChangeScheduled ? 'bg-amber-500/15 border-2 border-amber-400/30' : 'bg-[#039C51]/15 border-2 border-[#039C51]/30'} flex items-center justify-center`}>
                                            {isChangeScheduled
                                                ? <CalendarDays className="w-8 h-8 text-amber-400" />
                                                : <Check className="w-8 h-8 text-[#039C51]" />}
                                        </div>
                                        <div className={`absolute -top-1 -right-1 w-6 h-6 rounded-full ${isChangeScheduled ? 'bg-amber-400' : 'bg-[#039C51]'} flex items-center justify-center shadow-lg animate-bounce`}>
                                            <Sparkles className="w-3.5 h-3.5 text-white" />
                                        </div>
                                    </div>
                                    <h2 className={`text-xl font-bold ${isChangeScheduled ? 'text-amber-400' : 'text-[#039C51]'}`}>
                                        {isChangeScheduled
                                            ? (userPlan === targetPlan ? (isFr ? '📅 Changement planifié' : '📅 Change Scheduled') : (isFr ? '📅 Rétrogradation planifiée' : '📅 Downgrade Scheduled'))
                                            : (isFr ? '🎉 Paiement confirmé !' : '🎉 Payment Confirmed!')}
                                    </h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        {isChangeScheduled
                                            ? (userPlan === targetPlan 
                                                ? (isFr 
                                                    ? `Votre nouveau cycle prendra effet le ${scheduledEffectiveDate ? new Date(scheduledEffectiveDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}.`
                                                    : `Your new cycle takes effect on ${scheduledEffectiveDate ? new Date(scheduledEffectiveDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}.`)
                                                : (isFr
                                                    ? `Votre plan Pro reste actif jusqu'au ${scheduledEffectiveDate ? new Date(scheduledEffectiveDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}. Le plan Starter prendra effet à cette date.`
                                                    : `Your Pro plan stays active until ${scheduledEffectiveDate ? new Date(scheduledEffectiveDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}. Starter takes effect on that date.`))
                                            : (isFr ? `Votre plan ${targetPlan === 'pro' ? 'Pro' : 'Starter'} est maintenant actif` : `Your ${targetPlan === 'pro' ? 'Pro' : 'Starter'} plan is now active`)}
                                    </p>
                                </div>

                                {/* Invoice details */}
                                <div className="bg-muted/20 rounded-xl border border-border p-4 space-y-2.5 relative z-10">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">{isFr ? 'Référence Facture' : 'Invoice Ref'}</span>
                                        <span className="font-mono font-black text-foreground">{paymentReceipt?.invoiceRef || 'INV-XXXXX'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">{isFr ? 'Plan souscrit' : 'Plan subscribed'}</span>
                                        <Badge className="bg-[#142945]/10 text-[#142945] border-[#142945]/20 dark:bg-white/10 dark:text-white dark:border-white/20">
                                            {targetPlan === 'pro' ? <Crown className="w-3 h-3 mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                                            {targetPlan === 'pro' ? 'Pro' : 'Starter'}
                                        </Badge>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">{isFr ? 'Montant payé' : 'Amount paid'}</span>
                                        <span className="font-black text-lg text-foreground">{paymentReceipt?.amount || targetPrice} TND</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground font-medium">{isFr ? 'Méthode' : 'Method'}</span>
                                        <span className="font-semibold capitalize">{getMethodLabel(paymentMethod)}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm pt-2 border-t border-border/50">
                                        <span className="text-muted-foreground font-medium">{isFr ? 'Statut' : 'Status'}</span>
                                        {isChangeScheduled ? (
                                            <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                                {isFr ? 'Planifié — prendra effet le ' : 'Scheduled — effective '}
                                                {scheduledEffectiveDate ? new Date(scheduledEffectiveDate).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' }) : ''}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 text-[#039C51] font-bold text-xs">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#039C51]" />
                                                {isFr ? 'Payé et actif' : 'Paid and active'}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <p className="text-[11px] text-muted-foreground text-center relative z-10">
                                    {isFr ? 'Un email de confirmation et la facture ont été envoyés.' : 'A confirmation email and receipt have been sent.'}
                                </p>

                                <div className="flex gap-3 relative z-10">
                                    <Button variant="outline" className="flex-1 h-11 gap-2" onClick={() => { setShowUpgradeModal(false); }}>
                                        <Download className="w-4 h-4" />
                                        {isFr ? 'Fermer' : 'Close'}
                                    </Button>
                                    <Button className="flex-1 h-11 bg-[#039C51] hover:bg-[#039C51]/90 text-white border-0 font-bold gap-2" onClick={() => { setShowUpgradeModal(false); fetchPayments(); }}>
                                        <Check className="w-4 h-4" />
                                        {isFr ? 'Parfait !' : 'Great!'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default BillingPage;
