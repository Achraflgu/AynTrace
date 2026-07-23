import { useState, useEffect } from 'react';
import { X, User, Building2, ChevronRight, ChevronLeft, Phone, Mail, CreditCard, Check, Radio, Plus, Minus, Pencil, Banknote, ShieldCheck, AlertCircle, PackageCheck, Truck, RefreshCw, LogIn, Zap, Clock, Car, Bike, Dog, Package, LucideIcon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ordersApi, pricingApi } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import { DEVICE_TYPES } from '@/lib/utils-geo';
import type { Device } from '@/lib/types';

interface JoinPopupProps {
    isOpen: boolean;
    onClose: () => void;
}

const SESSION_KEY = 'ayntrace_join_session_v2';
const SUBMITTED_KEY = 'ayntrace_join_submitted_v2';
const TRACKING_KEY = 'ayntrace_user_order';

type GpsType = Device['deviceType'];
type PlanType = '' | 'starter' | 'pro' | 'enterprise';
type BillingCycle = 'monthly' | 'biannual' | 'annual';

interface GpsAllocation {
    type: GpsType;
    icon: LucideIcon;
    label: string;
    count: number;
}

interface FormData {
    usageType: '' | 'personnel' | 'professionnel';
    gpsCount: number;
    gpsAllocation: GpsAllocation[];
    plan: PlanType;
    billingCycle: BillingCycle;
    fullName: string;
    email: string;
    phone: string;
    company: string;
    paymentMethod: '' | 'now' | 'on_order';
    lastStep: number;
}

const defaultAllocation: GpsAllocation[] = DEVICE_TYPES.map((type) => ({
    type: type.value as GpsType,
    icon: type.icon,
    label: type.label,
    count: 0,
}));

const getDefaultForm = (): FormData => ({
    usageType: 'professionnel',
    gpsCount: 0,
    gpsAllocation: defaultAllocation.map(a => ({ ...a })),
    plan: '',
    billingCycle: 'monthly',
    fullName: '',
    email: '',
    phone: '',
    company: '',
    paymentMethod: '',
    lastStep: 2,
});

const PLANS = {
    starter: { name: 'Starter', price: 29, maxGps: Infinity, desc: 'Idéal pour le contrôle de base' },
    pro: { name: 'Pro', price: 39, maxGps: Infinity, desc: 'Pour les flottes exigeantes' },
    enterprise: { name: 'Enterprise', price: 0, maxGps: Infinity, desc: 'Pour les très grandes opérations', isCustom: true, soon: true },
};

// Pricing cycle mapping helper
const getCycleLabel = (cycle: BillingCycle) => {
    switch (cycle) {
        case 'biannual': return '6 Mois';
        case 'annual': return '12 Mois';
        default: return '1 Mois';
    }
};


const JoinPopup = ({ isOpen, onClose }: JoinPopupProps) => {
    const { theme } = useTheme();
    const [step, setStep] = useState(2);
    const [formData, setFormData] = useState<FormData>(getDefaultForm());
    const [isSubmittedState, setIsSubmittedState] = useState(false);
    const [trackingOrder, setTrackingOrder] = useState<any>(null);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCvv, setCardCvv] = useState('');
    const [emailError, setEmailError] = useState<string>('');
    const [isCheckingEmail, setIsCheckingEmail] = useState<boolean>(false);

    const verifyEmailUnique = async (emailVal: string) => {
        if (!emailVal || !emailVal.includes('@')) {
            setEmailError('');
            return true;
        }
        setIsCheckingEmail(true);
        try {
            const res = await fetch('/api/auth/check-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: emailVal })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.exists) {
                    setEmailError('Cette adresse email est déjà associée à un compte ou une commande en cours.');
                    return false;
                } else {
                    setEmailError('');
                    return true;
                }
            }
        } catch (err) {
            console.error('Error checking email uniqueness', err);
        } finally {
            setIsCheckingEmail(false);
        }
        return true;
    };

    const [prices, setPrices] = useState({
        starter: 29,
        pro: 39,
        device: 110,
        installation: 40,
        depositAmount: 0,
        advMonths: 3,
        discountBiannual: 0.1,
        discountAnnual: 0.2
    });
    const isDark = theme === 'dark';
    const shellClass = isDark
        ? 'bg-[#0F1219] border-white/10'
        : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,249,246,0.98))] border-[#039C51]/15 shadow-[0_25px_80px_rgba(20,41,69,0.16)]';
    const shellAltClass = isDark
        ? 'bg-[#0A0D14] border-white/10'
        : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,246,242,0.98))] border-[#039C51]/15 shadow-[0_25px_80px_rgba(20,41,69,0.16)]';
    const headerClass = isDark ? 'border-white/5 bg-[#0F1219]' : 'border-[#142945]/10 bg-white/80';
    const contentClass = isDark ? 'bg-[#0F1219]' : 'bg-[linear-gradient(180deg,#fbfdfb_0%,#eff6f2_100%)]';
    const panelClass = isDark ? 'bg-[#121620] border-white/5' : 'bg-white/90 border-[#142945]/10 shadow-[0_12px_32px_rgba(20,41,69,0.06)]';
    const panelStrongClass = isDark ? 'bg-gradient-to-br from-[#121620] to-[#0A0D14] border-white/10' : 'bg-gradient-to-br from-white to-[#f1f7f4] border-[#142945]/10 shadow-[0_20px_40px_rgba(20,41,69,0.08)]';
    const softButtonClass = isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-[#142945]/5 hover:bg-[#142945]/10';
    const inputClass = isDark
        ? 'w-full bg-[#121620] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]/50 focus:ring-1 focus:ring-[#00E599]/50 transition-all font-medium'
        : 'w-full bg-white border border-[#142945]/12 rounded-xl px-4 py-3 text-sm text-[#142945] placeholder:text-[#142945]/35 focus:outline-none focus:border-[#00E599]/50 focus:ring-1 focus:ring-[#00E599]/30 transition-all font-medium';
    const inputIconClass = isDark ? 'text-white/30' : 'text-[#142945]/35';
    const titleClass = isDark ? 'text-white' : 'text-[#142945]';
    const secondaryTextClass = isDark ? 'text-white/50' : 'text-[#142945]/55';
    const tertiaryTextClass = isDark ? 'text-white/40' : 'text-[#142945]/45';
    const labelClass = isDark ? 'text-white/70' : 'text-[#142945]/70';
    const closeButtonClass = isDark
        ? 'text-white/50 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-full'
        : 'text-[#142945]/50 hover:text-[#142945] transition-colors p-2 hover:bg-[#142945]/5 rounded-full';
    const featureTextClass = isDark ? 'text-white/70' : 'text-[#142945]/75';

    // Initial check on open
    useEffect(() => {
        if (isOpen) {
            // Load dynamic pricing
            pricingApi.getAll().then(data => {
                const c = data.config;
                setPrices({
                    starter: c.starter_monthly || 29,
                    pro: c.pro_monthly || 39,
                    device: c.device_price || 110,
                    installation: c.installation_fee || 40,
                    depositAmount: c.deposit_amount || 0,
                    advMonths: c.advance_months || 3,
                    discountBiannual: (c.biannual_discount || 10) / 100,
                    discountAnnual: (c.annual_discount || 20) / 100
                });
            }).catch(() => {});

            const trackingDataStr = localStorage.getItem(TRACKING_KEY);
            if (trackingDataStr) {
                try {
                    const parsed = JSON.parse(trackingDataStr);
                    setTrackingOrder(parsed);
                    // Dynamically fetch latest
                    ordersApi.track(parsed.ref).then(data => {
                        if (data && data.status) {
                            const updated = { ...parsed, ...data };
                            setTrackingOrder(updated);
                            localStorage.setItem(TRACKING_KEY, JSON.stringify(updated));
                        }
                    }).catch(() => { });
                } catch { /* ignore */ }
                return;
            }

            const hasSubmitted = localStorage.getItem(SUBMITTED_KEY) === 'true';
            if (hasSubmitted) {
                setIsSubmittedState(true);
                return;
            }
            setIsSubmittedState(false);
            try {
                const saved = localStorage.getItem(SESSION_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved) as FormData;
                    if (!parsed.plan) parsed.plan = '';
                    if (!parsed.billingCycle) parsed.billingCycle = 'monthly';

                    // Reconcile allocation with potential new defaults when reopening the form.
                    if (parsed.gpsAllocation) {
                        const newAlloc = defaultAllocation.map(defAlloc => {
                            const existing = parsed.gpsAllocation.find(a => a.type === defAlloc.type);
                            return existing ? { ...defAlloc, count: existing.count } : { ...defAlloc };
                        });
                        parsed.gpsAllocation = newAlloc;
                    } else {
                        parsed.gpsAllocation = defaultAllocation.map(a => ({ ...a }));
                    }

                    setFormData(parsed);
                    setStep(Math.max(2, parsed.lastStep || 2));
                }
            } catch { /* ignore */ }
        }
    }, [isOpen]);

    // Save session
    useEffect(() => {
        if (isOpen && !isSubmittedState && !trackingOrder && (formData.usageType || formData.fullName || formData.gpsCount > 0)) {
            localStorage.setItem(SESSION_KEY, JSON.stringify({ ...formData, lastStep: step }));
        }
    }, [formData, step, isOpen, isSubmittedState, trackingOrder]);

    const steps = [
        { num: 2, label: 'Vos Traceurs' },
        { num: 3, label: "L'Offre" },
        { num: 4, label: 'Contact' },
        { num: 5, label: 'Facture' },
        { num: 6, label: 'Paiement' },
    ];

    const allocatedTotal = formData.gpsAllocation.reduce((sum, a) => sum + a.count, 0);
    const remaining = formData.gpsCount - allocatedTotal;

    const updateAllocation = (type: GpsType, delta: number) => {
        setFormData(prev => ({
            ...prev,
            gpsAllocation: prev.gpsAllocation.map(a =>
                a.type === type ? { ...a, count: Math.max(0, a.count + delta) } : a
            ),
        }));
    };

    // Auto-select plan based on rules if unset or invalid. Enterprise is visual-only for now.
    useEffect(() => {
        if (step === 3) {
            if (formData.plan === 'enterprise') {
                setFormData(prev => ({ ...prev, plan: 'pro' }));
            } else if (formData.gpsCount > 5 && formData.plan === 'starter') {
                setFormData(prev => ({ ...prev, plan: 'pro' }));
            }
        }
    }, [step, formData.gpsCount, formData.plan]);

    const formatCardNumber = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 16);
        return digits.replace(/(.{4})/g, '$1 ').trim();
    };

    const formatExpiry = (val: string) => {
        const digits = val.replace(/\D/g, '').slice(0, 4);
        if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
        return digits;
    };

    const canProceed = () => {
        switch (step) {
            case 2: return formData.gpsCount > 0 && allocatedTotal === formData.gpsCount;
            case 3: return formData.plan !== '' && formData.plan !== 'enterprise';
            case 4: return !!(formData.fullName && formData.email && formData.phone);
            case 5: return true;
            case 6: {
                if (formData.paymentMethod === '') return false;
                if (formData.paymentMethod === 'now') {
                    // Online: require card details
                    return cardNumber.replace(/\s/g, '').length === 16 && cardExpiry.length === 5 && cardCvv.length === 3;
                }
                return true; // on_order (livraison) = ok
            }
            default: return false;
        }
    };

    const handleSubmit = async () => {
        // Send order to backend
        let createdRef = '';
        try {
            const gpsTypes = formData.gpsAllocation
                .filter(a => a.count > 0)
                .map(a => ({ type: a.type, count: a.count }));

            const res = await ordersApi.create({
                fullName: formData.fullName,
                email: formData.email,
                phone: formData.phone,
                company: formData.company || '',
                usageType: formData.usageType === 'personnel' ? 'personal' : 'professional',
                gpsCount: formData.gpsCount,
                gpsTypes,
                plan: formData.plan,
                billingCycle: formData.billingCycle,
                totalDueToday,
                recurringCost: recurringCostPerCycle,
                paymentMethod: formData.paymentMethod === 'now' ? 'online' : 'on_installation',
                source: 'popup',
            });

            createdRef = res.orderRef || (res.data && res.data.orderRef) || '';
        } catch (err) {
            console.warn('[JoinPopup] Order API error:', err);
        }

        localStorage.removeItem(SESSION_KEY);

        if (createdRef) {
            const newOrder = { ref: createdRef, email: formData.email, status: 'pending', createdAt: new Date() };
            localStorage.setItem(TRACKING_KEY, JSON.stringify(newOrder));
            setTrackingOrder(newOrder);
        } else {
            localStorage.setItem(SUBMITTED_KEY, 'true');
            setIsSubmittedState(true);
        }

        toast.success('Demande envoyée avec succès ! Notre équipe vous contactera sous 24h.', {
            description: formData.paymentMethod === 'now'
                ? 'Vous serez redirigé vers la page de paiement.'
                : 'Votre commande sera préparée et vous pourrez payer à la livraison.'
        });
    };

    const resetFlow = () => {
        localStorage.removeItem(SUBMITTED_KEY);
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(TRACKING_KEY);
        setFormData(getDefaultForm());
        setTrackingOrder(null);
        setStep(2);
        setIsSubmittedState(false);
    };

    const goToStep = (s: number) => setStep(s);

    // Pricing calculation helpers
    const getDiscountedMonthlyPrice = (plan: PlanType, cycle: BillingCycle) => {
        if (!plan || plan === 'enterprise') return 0;
        const basePrice = plan === 'starter' ? prices.starter : prices.pro;
        let discount = 0;
        if (cycle === 'biannual') discount = prices.discountBiannual;
        if (cycle === 'annual') discount = prices.discountAnnual;
        return basePrice * (1 - discount);
    };

    const baseMonthlyPrice = formData.plan === 'starter' ? prices.starter : formData.plan === 'pro' ? prices.pro : 0;
    const discountedMonthlyPrice = getDiscountedMonthlyPrice(formData.plan, formData.billingCycle);

    const initialHardwareCost = formData.gpsCount * prices.device;
    const advanceCost = formData.gpsCount * discountedMonthlyPrice * prices.advMonths;
    const totalDueToday = initialHardwareCost + prices.depositAmount + prices.installation + advanceCost;

    const recurringCostPerCycle = formData.gpsCount * discountedMonthlyPrice * (formData.billingCycle === 'annual' ? 12 : formData.billingCycle === 'biannual' ? 6 : 1);

    const renderSubmittedState = () => (
        <DialogContent className={`w-[calc(100%-2rem)] sm:w-full max-w-md p-0 overflow-hidden rounded-3xl shadow-2xl border-2 flex flex-col max-h-[90vh] [&>button]:hidden ${shellClass}`}>
            <DialogHeader className="sr-only">
                <DialogTitle>Demande Envoyée</DialogTitle>
                <DialogDescription>Votre demande d'abonnement a bien été transmise à notre équipe.</DialogDescription>
            </DialogHeader>
            <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${headerClass}`}>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#00E599] flex items-center justify-center">
                        <Check className="w-5 h-5" />
                    </div>
                    <span className={`font-bold ${titleClass}`}>Demande Envoyée</span>
                </div>
                <button onClick={onClose} className={closeButtonClass}>
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="p-8 text-center space-y-6 flex-1 overflow-y-auto">
                    <div className="w-24 h-24 mx-auto rounded-full bg-[#00E599]/10 border-2 border-[#00E599]/50 flex items-center justify-center relative">
                    <PackageCheck className="w-12 h-12 text-[#00E599]" />
                    <div className="absolute top-0 right-0 w-6 h-6 rounded-full bg-[#00E599] flex items-center justify-center shadow-[0_0_15px_rgba(0,229,153,0.5)] animate-pulse">
                        <Check className="w-4 h-4 text-white" />
                    </div>
                </div>
                <div>
                    <h3 className={`text-xl font-bold mb-2 ${titleClass}`}>Requête en cours de traitement</h3>
                    <p className={`text-sm leading-relaxed ${secondaryTextClass}`}>
                        Notre équipe a bien reçu votre demande. Un conseiller vous contactera très prochainement pour finaliser votre dossier.
                    </p>
                </div>
                <div className={`pt-6 border-t space-y-3 ${isDark ? 'border-white/5' : 'border-[#142945]/10'}`}>
                    <Button className="w-full bg-[#00E599] text-white hover:bg-[#00E599]/90 font-bold rounded-xl h-12" onClick={onClose}>
                        Fermer la fenêtre
                    </Button>
                    <button onClick={resetFlow} className={`text-xs transition-colors underline underline-offset-4 ${isDark ? 'text-white/40 hover:text-white' : 'text-[#142945]/45 hover:text-[#142945]'}`}>
                        Faire une nouvelle demande
                    </button>
                </div>
            </div>
        </DialogContent>
    );

    const renderTrackingState = () => {
        if (!trackingOrder) return null;

        const isCancelled = trackingOrder.status === 'cancelled';
        const currentStep = isCancelled ? -1 :
            trackingOrder.status === 'active' ? 4 :
                trackingOrder.status === 'installing' ? 3 :
                    trackingOrder.status === 'confirmed' ? 2 : 1;

        const trackingSteps = [
            { num: 1, label: 'En attente', desc: 'Réception de la demande' },
            { num: 2, label: 'Confirmée', desc: 'Validation par l\'équipe' },
            { num: 3, label: 'Installation', desc: 'Pose des équipements' },
            { num: 4, label: 'Activée', desc: 'Accès compte généré' }
        ];

        return (
            <DialogContent className={`w-[calc(100%-2rem)] sm:w-full max-w-xl p-0 overflow-hidden rounded-3xl shadow-2xl border-2 flex flex-col max-h-[90vh] [&>button]:hidden ${shellAltClass}`}>
                <DialogHeader className="sr-only">
                    <DialogTitle>Suivi de commande</DialogTitle>
                    <DialogDescription>Aperçu du statut actuel de votre demande de traceurs en temps réel.</DialogDescription>
                </DialogHeader>
                <div className={`flex items-center justify-between px-6 py-5 border-b shrink-0 ${headerClass}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 border border-[#00E599]/30 flex items-center justify-center">
                            <Radio className="w-5 h-5 text-[#00E599]" />
                        </div>
                        <div>
                            <span className={`font-bold block ${titleClass}`}>Suivi de commande</span>
                            <span className={`text-xs font-medium ${secondaryTextClass}`}>Réf: {trackingOrder.ref}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className={closeButtonClass}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-8 flex-1 overflow-y-auto">
                    <div className={`border rounded-2xl p-6 mb-8 text-center text-sm shadow-inner ${panelClass}`}>
                        <p className={isDark ? 'text-white/70' : 'text-[#142945]/75'}>
                            Vous avez déjà une demande d'abonnement en cours chez nous.<br />
                            <strong className={titleClass}>Vous recevrez toutes les informations sur votre email ({trackingOrder.email})</strong>.
                        </p>
                        <p className={`mt-3 text-xs flex items-center justify-center gap-1.5 ${tertiaryTextClass}`}>
                            <Phone className="w-3.5 h-3.5" /> En cas de besoin, appelez-nous au +216 71 000 000
                        </p>
                    </div>

                    {isCancelled ? (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <h3 className="text-lg font-bold text-red-500 mb-2">Commande Annulée</h3>
                            <p className="text-sm text-red-400/80">Votre demande a été annulée. Contactez-nous pour plus d'informations.</p>
                        </div>
                    ) : (
                        <div className="space-y-6 pl-2">
                            {trackingSteps.map((s, i) => (
                                <div key={s.num} className={`relative flex items-start gap-4 ${currentStep < s.num ? 'opacity-40' : 'opacity-100'}`}>
                                    <div className="flex flex-col items-center shrink-0 w-8">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs relative z-10 transition-colors duration-500 ${
                                            currentStep > s.num ? 'bg-[#00E599] text-white shadow-[0_0_15px_rgba(0,229,153,0.3)]' :
                                            currentStep === s.num ? `${isDark ? 'bg-[#121620]' : 'bg-white'} border-2 border-[#00E599] text-[#00E599] shadow-[0_0_20px_rgba(0,229,153,0.2)]` :
                                            `${isDark ? 'bg-[#121620] border-white/20 text-white/50' : 'bg-white border-[#142945]/15 text-[#142945]/45'} border-2`
                                        }`}>
                                            {currentStep > s.num ? <Check className="w-4 h-4" /> : s.num}
                                        </div>
                                        {i < trackingSteps.length - 1 && (
                                            <div className="w-[2px] h-10 bg-white/10 mt-1.5 relative rounded-full">
                                                <div 
                                                    className="absolute top-0 left-0 w-full bg-[#00E599] transition-all duration-500 rounded-full" 
                                                    style={{ height: currentStep > s.num ? '100%' : currentStep === s.num ? '50%' : '0%' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <div className="pt-1 flex-1">
                                        <h4 className={`text-base font-bold ${currentStep >= s.num ? titleClass : secondaryTextClass}`}>{s.label}</h4>
                                        <p className={`text-xs mt-0.5 ${tertiaryTextClass}`}>{s.desc}</p>
                                    </div>
                                    {currentStep === s.num && (
                                        <div className="text-[10px] bg-[#00E599]/10 text-[#00E599] px-3 py-1 rounded-full font-bold animate-pulse uppercase tracking-wider self-center shrink-0">
                                            En cours
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`border-t px-6 py-5 flex items-center justify-between shrink-0 ${headerClass}`}>
                    <button onClick={resetFlow} className={`text-xs transition-colors underline underline-offset-4 ${isDark ? 'text-white/40 hover:text-white' : 'text-[#142945]/45 hover:text-[#142945]'}`}>
                        Annuler mon suivi local
                    </button>
                    {trackingOrder.status === 'active' && (
                        <Button className="bg-[#00E599] text-white font-bold h-9 px-6 rounded-full" onClick={() => window.location.href = '/login'}>
                            Accéder à la plateforme
                        </Button>
                    )}
                </div>
            </DialogContent>
        );
    };

    if (trackingOrder) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                {renderTrackingState()}
            </Dialog>
        );
    }

    if (isSubmittedState) {
        return (
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                {renderSubmittedState()}
            </Dialog>
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`w-[calc(100%-2rem)] sm:w-full max-w-4xl p-0 overflow-hidden rounded-3xl shadow-2xl border-2 flex flex-col max-h-[90vh] gap-0 [&>button]:hidden ${shellClass}`}>
                <DialogHeader className="sr-only">
                    <DialogTitle>Rejoindre AynTrace</DialogTitle>
                </DialogHeader>

                {/* Custom Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${headerClass}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#00E599] flex items-center justify-center">
                            <Radio className="w-4 h-4 text-white" />
                        </div>
                        <span className={`font-bold ${titleClass}`}>Rejoindre AynTrace</span>
                    </div>
                    <button onClick={onClose} className={closeButtonClass}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className={`px-6 py-5 border-b shrink-0 overflow-x-auto scrollbar-none ${headerClass}`}>
                    <div className="flex items-center justify-between min-w-[600px] max-w-3xl mx-auto relative px-8">
                        <div className="absolute top-5 left-12 right-12 h-[2px] bg-white/10 z-0" />
                        <div
                            className="absolute top-5 left-12 h-[2px] bg-[#00E599] z-0 transition-all duration-500"
                            style={{ width: `${((step - 2) / 4) * (100 - 15)}%`, maxWidth: 'calc(100% - 3rem)' }}
                        />
                        {steps.map((s) => (
                            <div key={s.num} className="flex flex-col items-center gap-2 relative z-10 w-16">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${s.num < step ? 'bg-[#00E599] text-white' :
                                    s.num === step ? 'bg-[#00E599] text-white shadow-[0_0_15px_rgba(0,229,153,0.3)]' :
                                        isDark ? 'bg-[#1A1F2B] text-white/50 border border-white/10' : 'bg-white text-[#142945]/45 border border-[#142945]/12'
                                    }`}>
                                    {s.num < step ? <Check className="w-5 h-5" /> : s.num}
                                </div>
                                <span className={`text-[10px] whitespace-nowrap font-medium text-center ${s.num <= step ? (isDark ? 'text-white/90' : 'text-[#142945]/90') : tertiaryTextClass}`}>
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className={`flex-1 overflow-y-auto p-4 md:p-6 ${contentClass}`}>

                    {/* Step 2: GPS Count & Type Allocation */}
                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h2 className={`text-2xl font-bold mb-2 ${titleClass}`}>Combien de GPS allez-vous utiliser ?</h2>
                                <p className={`text-sm ${secondaryTextClass}`}>Choisissez le nombre total puis répartissez par type.</p>
                            </div>
                            <div className="max-w-xl mx-auto space-y-6">
                                {/* Total GPS Counter */}
                                <div className={`border rounded-2xl p-6 text-center shadow-inner ${panelClass}`}>
                                    <label className={`block text-sm font-medium mb-4 ${labelClass}`}>Nombre total de GPS</label>
                                    <div className="flex items-center justify-center gap-6">
                                        <button
                                            onClick={() => setFormData(prev => ({ ...prev, gpsCount: Math.max(0, prev.gpsCount - 1) }))}
                                            className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all ${isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-[#142945]/5 border-[#142945]/10 text-[#142945]/55'} hover:bg-[#00E599]/10 hover:text-[#00E599] hover:border-[#00E599]/30`}
                                        >
                                            <Minus className="w-5 h-5" />
                                        </button>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.gpsCount || ''}
                                            onChange={(e) => {
                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                setFormData(prev => ({ ...prev, gpsCount: val }));
                                            }}
                                            placeholder="0"
                                            className="text-5xl font-extrabold text-[#00E599] tabular-nums w-24 text-center bg-transparent border-none outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <button
                                            onClick={() => setFormData(prev => ({ ...prev, gpsCount: prev.gpsCount + 1 }))}
                                            className="w-12 h-12 rounded-full bg-[#00E599]/10 border border-[#00E599]/30 flex items-center justify-center text-[#00E599] hover:bg-[#00E599]/20 transition-all shadow-[0_0_15px_rgba(0,229,153,0.2)]"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Type Allocation */}
                                {formData.gpsCount > 0 && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <label className={`text-sm font-medium ${labelClass}`}>Répartition par type</label>
                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${remaining === 0 ? 'bg-[#00E599]/10 border-[#00E599]/50 text-[#00E599]' : remaining < 0 ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-orange-500/10 border-orange-500/50 text-orange-400'}`}>
                                                {remaining === 0 ? '✓ Complet' : remaining > 0 ? `${remaining} restant${remaining > 1 ? 's' : ''}` : `${Math.abs(remaining)} en trop`}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {formData.gpsAllocation.map((item) => (
                                                <div
                                                    key={item.type}
                                                    className={`rounded-2xl border p-3.5 flex flex-col justify-between gap-3 transition-all duration-200 ${item.count > 0
                                                        ? 'bg-[#00E599]/5 border-[#00E599]/30 shadow-sm'
                                                        : `${isDark ? 'bg-[#121620] border-white/5 hover:border-white/10' : 'bg-white/95 border-[#142945]/10 hover:border-[#00E599]/25 shadow-[0_10px_30px_rgba(20,41,69,0.05)]'}`
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        {(() => { const Icon = item.icon; return <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.count > 0 ? 'bg-[#00E599]/15 text-[#00E599]' : isDark ? 'bg-white/5 text-white/50' : 'bg-[#142945]/5 text-[#142945]/55'}`}><Icon className="w-4 h-4" /></div>; })()}
                                                        <span className={`text-sm font-semibold leading-tight ${isDark ? 'text-white/85' : 'text-[#142945]/90'}`}>{item.label}</span>
                                                    </div>
                                                    <div className={`flex items-center justify-between rounded-xl p-1.5 border ${isDark ? 'bg-black/20 border-white/5' : 'bg-[#F5F7FA] border-[#142945]/10'}`}>
                                                        <button
                                                            onClick={() => updateAllocation(item.type, -1)}
                                                            disabled={item.count === 0}
                                                            className={`w-7 h-7 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/20' : 'bg-white text-[#142945]/60 hover:bg-white/90 border border-[#142945]/10'}`}
                                                        >
                                                            <Minus className="w-3 h-3" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={item.count || ''}
                                                            onChange={(e) => {
                                                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    gpsAllocation: prev.gpsAllocation.map(a =>
                                                                        a.type === item.type ? { ...a, count: val } : a
                                                                    ),
                                                                }));
                                                            }}
                                                            placeholder="0"
                                                            className={`text-sm font-bold tabular-nums w-9 text-center bg-transparent border-none outline-none p-0 focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${item.count > 0 ? 'text-[#00E599]' : tertiaryTextClass}`}
                                                        />
                                                        <button
                                                            onClick={() => updateAllocation(item.type, 1)}
                                                            disabled={remaining <= 0}
                                                            className="w-7 h-7 rounded-lg bg-[#00E599]/10 flex items-center justify-center text-[#00E599] hover:bg-[#00E599]/25 disabled:opacity-30 transition-all"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Plan Selection (L'Offre) */}
                    {step === 3 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h2 className={`text-2xl font-bold mb-2 ${titleClass}`}>Choisissez votre offre</h2>
                                <p className={`text-sm ${secondaryTextClass}`}>Une offre transparente adaptée à vos {formData.gpsCount} traceurs.</p>
                            </div>

                            {/* Billing Cycle Selector - Fixed at Top */}
                            <div className="flex justify-center mb-8">
                                <div className={`p-1.5 rounded-2xl border flex items-center relative ${isDark ? 'bg-[#121620] border-white/10' : 'bg-white border-[#142945]/10'}`}>
                                    {(['monthly', 'biannual', 'annual'] as BillingCycle[]).map((cycle) => {
                                        const discountNum = cycle === 'biannual' ? Math.round(prices.discountBiannual * 100) : cycle === 'annual' ? Math.round(prices.discountAnnual * 100) : 0;
                                        return (
                                        <button
                                            key={cycle}
                                            onClick={() => setFormData(prev => ({ ...prev, billingCycle: cycle }))}
                                            className={`relative px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 z-10 ${formData.billingCycle === cycle ? 'text-white shadow-md' : isDark ? 'text-white/50 hover:text-white' : 'text-[#142945]/55 hover:text-[#142945]'}`}
                                        >
                                            {getCycleLabel(cycle)}
                                            {discountNum > 0 && (
                                                <span className={`absolute -top-2 -right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full ${formData.billingCycle === cycle ? 'bg-black text-[#00E599]' : 'bg-[#00E599] text-white'} shadow-sm`}>
                                                    -{discountNum}%
                                                </span>
                                            )}
                                        </button>
                                    )})}
                                    {/* Active background pill */}
                                    <div
                                        className="absolute bg-[#00E599] top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out z-0"
                                        style={{
                                            left: formData.billingCycle === 'monthly' ? '0.375rem' : formData.billingCycle === 'biannual' ? '33.3%' : '66.6%',
                                            width: '33.3%',
                                            transform: formData.billingCycle === 'monthly' ? 'none' : formData.billingCycle === 'biannual' ? 'translateX(0)' : 'translateX(-0.375rem)'
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                                {/* Starter Plan */}
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, plan: 'starter' }))}
                                    className={`relative text-left p-6 rounded-2xl border transition-all flex flex-col h-full ${formData.plan === 'starter' ? 'bg-[#00E599]/10 border-[#00E599] shadow-[0_0_20px_rgba(0,229,153,0.15)] ring-1 ring-[#00E599]' :
                                            isDark ? 'bg-[#121620] border-white/10 hover:border-white/20 hover:bg-white/5' : 'bg-white border-[#142945]/10 hover:border-[#142945]/20 hover:bg-[#f6faf8]'}`}
                                >
                                    {formData.plan === 'starter' && <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#00E599] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                    <h3 className={`text-xl font-bold mb-1 ${titleClass}`}>Starter</h3>
                                    <p className={`text-xs mb-6 ${secondaryTextClass}`}>{PLANS.starter.desc}</p>
                                    <div className="mb-6 flex-1 flex flex-col justify-end">
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-4xl font-black ${titleClass}`}>{getDiscountedMonthlyPrice('starter', formData.billingCycle).toFixed(0)}</span>
                                            <span className={`text-sm font-medium ${tertiaryTextClass}`}>TND/mois</span>
                                        </div>
                                        {formData.billingCycle !== 'monthly' && (
                                            <span className={`text-xs line-through mt-1 ${tertiaryTextClass}`}>{prices.starter} TND</span>
                                        )}
                                    </div>
                                    <div className={`space-y-3 pt-6 border-t ${isDark ? 'border-white/10' : 'border-[#142945]/10'}`}>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${isDark ? 'text-white/70' : 'text-[#142945]/75'}`}>Tableau de bord & Carte</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${isDark ? 'text-white/70' : 'text-[#142945]/75'}`}>Appareils GPS & Alertes</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${isDark ? 'text-white/70' : 'text-[#142945]/75'}`}>Paramètres système</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${isDark ? 'text-white/70' : 'text-[#142945]/75'}`}>Support standard</span></div>
                                    </div>
                                </button>

                                {/* Pro Plan */}
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, plan: 'pro' }))}
                                    className={`relative text-left p-6 rounded-2xl border transition-all flex flex-col h-full transform ${formData.plan === 'pro' ? 'bg-gradient-to-b from-[#00E599]/10 to-[#00E599]/5 border-[#00E599] shadow-[0_0_30px_rgba(0,229,153,0.2)] ring-1 ring-[#00E599] md:-translate-y-2' :
                                            isDark ? 'bg-[#121620] border-white/10 hover:border-white/20 hover:bg-white/5' : 'bg-white border-[#142945]/10 hover:border-[#142945]/20 hover:bg-[#f6faf8]'}`}
                                >
                                    <div className="absolute -top-3 inset-x-0 flex justify-center">
                                        <span className="bg-[#00E599] text-white text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full shadow-lg">Populaire</span>
                                    </div>
                                    {formData.plan === 'pro' && <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#00E599] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                    <h3 className={`text-xl font-bold mb-1 ${titleClass}`}>Pro</h3>
                                    <p className={`text-xs mb-6 ${secondaryTextClass}`}>{PLANS.pro.desc}</p>
                                    <div className="mb-6 flex-1 flex flex-col justify-end">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-5xl font-black text-[#00E599]">{getDiscountedMonthlyPrice('pro', formData.billingCycle).toFixed(0)}</span>
                                            <span className={`text-sm font-medium ${tertiaryTextClass}`}>TND/mois</span>
                                        </div>
                                        {formData.billingCycle !== 'monthly' && (
                                            <span className={`text-xs line-through mt-1 ${tertiaryTextClass}`}>{prices.pro} TND</span>
                                        )}
                                    </div>
                                    <div className={`space-y-3 pt-6 border-t ${isDark ? 'border-white/10' : 'border-[#142945]/10'}`}>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-[#142945]'}`}>Zones GPS (Geofences)</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-[#142945]'}`}>Assistant IA AynTrace</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-[#142945]'}`}>Historique 90 jours</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-[#142945]'}`}>Alertes par E-mail</span></div>
                                    </div>
                                </button>

                                {/* Enterprise Plan */}
                                <button
                                    type="button"
                                    disabled
                                    aria-disabled="true"
                                    className={`relative text-left p-6 rounded-2xl border transition-all flex flex-col h-full cursor-not-allowed opacity-70 ${isDark ? 'bg-[#121620] border-white/10' : 'bg-white border-[#142945]/10'}`}
                                >
                                    <div className="absolute top-4 right-4 rounded-full bg-amber-400/15 text-amber-500 border border-amber-400/30 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider">
                                        Bientôt
                                    </div>
                                    <h3 className={`text-xl font-bold mb-1 ${titleClass}`}>Enterprise</h3>
                                    <p className={`text-xs mb-6 ${secondaryTextClass}`}>{PLANS.enterprise.desc}</p>
                                    <div className="mb-6 flex-1 flex flex-col justify-end">
                                        <span className={`text-3xl font-black ${titleClass}`}>Sur devis</span>
                                        <span className={`mt-2 text-xs font-semibold ${tertiaryTextClass}`}>Visuel uniquement pour le moment</span>
                                    </div>
                                    <div className={`space-y-3 pt-6 border-t ${isDark ? 'border-white/10' : 'border-[#142945]/10'}`}>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${featureTextClass}`}>Contrat sur mesure</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${featureTextClass}`}>Marque blanche (API)</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${featureTextClass}`}>Serveur exclusif</span></div>
                                        <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#00E599]" /><span className={`text-xs ${featureTextClass}`}>Support dédié</span></div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Contact */}
                    {step === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h2 className={`text-2xl font-bold mb-2 ${titleClass}`}>Vos coordonnées</h2>
                                <p className={`text-sm ${secondaryTextClass}`}>Comment pouvons-nous vous contacter ?</p>
                            </div>
                            <div className="max-w-xl mx-auto space-y-5">
                                <div className="grid md:grid-cols-2 gap-5">
                                    <div>
                                        <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${labelClass}`}>Nom complet *</label>
                                        <input type="text" value={formData.fullName} onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))} placeholder="Votre nom" className={inputClass} />
                                    </div>
                                    <div>
                                        <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${labelClass}`}>Entreprise</label>
                                        <input type="text" value={formData.company} onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))} placeholder="Nom de l'entreprise" className={inputClass} />
                                    </div>
                                </div>
                                <div>
                                    <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${labelClass}`}>Email *</label>
                                    <div className="relative">
                                        <Mail className={`absolute top-[14px] left-4 w-4 h-4 ${inputIconClass}`} />
                                        <input 
                                            type="email" 
                                            value={formData.email} 
                                            onChange={(e) => {
                                                setFormData(prev => ({ ...prev, email: e.target.value }));
                                                if (emailError) setEmailError('');
                                            }} 
                                            onBlur={(e) => verifyEmailUnique(e.target.value)}
                                            placeholder="votre@email.com" 
                                            className={`${inputClass} pl-11 ${emailError ? 'border-destructive focus:border-destructive focus:ring-destructive/30' : ''}`} 
                                        />
                                    </div>
                                    {emailError && (
                                        <p className="text-destructive text-xs font-bold mt-1.5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {emailError}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className={`block text-xs font-semibold mb-2 uppercase tracking-wide ${labelClass}`}>Téléphone *</label>
                                    <div className="relative">
                                        <Phone className={`absolute top-[14px] left-4 w-4 h-4 ${inputIconClass}`} />
                                        <input type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+216 XX XXX XXX" className={`${inputClass} pl-11`} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Facture / Confirmation */}
                    {step === 5 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h2 className={`text-2xl font-bold mb-2 ${titleClass}`}>Devis Initial & Engagement</h2>
                                <p className={`text-sm ${secondaryTextClass}`}>Vérifiez les détails de l'installation et votre abonnement.</p>
                            </div>
                            <div className="max-w-2xl mx-auto grid md:grid-cols-5 gap-4">
                                {/* Left Column: Client Summary */}
                                <div className="md:col-span-2 space-y-4">
                                    <div className={`border rounded-2xl p-5 relative group ${panelClass}`}>
                                        <button onClick={() => goToStep(4)} className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${isDark ? 'bg-white/5 text-white/30 hover:text-[#00E599] hover:bg-[#00E599]/10' : 'bg-[#142945]/5 text-[#142945]/35 hover:text-[#00E599] hover:bg-[#00E599]/10'}`}>
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${softButtonClass}`}>
                                                <User className={`w-4 h-4 ${secondaryTextClass}`} />
                                            </div>
                                            <div>
                                                <h3 className={`text-[10px] font-bold uppercase tracking-widest leading-none mb-1 ${tertiaryTextClass}`}>Informations Client</h3>
                                                <p className={`text-xs font-semibold capitalize ${titleClass}`}>{formData.usageType}</p>
                                            </div>
                                        </div>
                                        <div className={`space-y-1.5 text-sm mt-4 border-t pt-4 ${isDark ? 'border-white/5' : 'border-[#142945]/10'}`}>
                                            <p className={`font-bold ${titleClass}`}>{formData.fullName}</p>
                                            <p className={`text-xs ${secondaryTextClass}`}>{formData.email}</p>
                                            <p className={`text-xs ${secondaryTextClass}`}>{formData.phone}</p>
                                            {formData.company && <p className="text-[#00E599] text-xs font-medium mt-1">{formData.company}</p>}
                                        </div>
                                    </div>

                                    {/* Selected Cycle info */}
                                    <div className={`border rounded-2xl p-4 flex items-start gap-3 relative group ${panelClass}`}>
                                        <button onClick={() => goToStep(3)} className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${isDark ? 'bg-white/5 text-white/30 hover:text-[#00E599] hover:bg-[#00E599]/10' : 'bg-[#142945]/5 text-[#142945]/35 hover:text-[#00E599] hover:bg-[#00E599]/10'}`}>
                                            <Pencil className="w-3 h-3" />
                                        </button>
                                        <RefreshCw className="w-5 h-5 text-[#00E599] mt-0.5 shrink-0" />
                                        <div>
                                            <h3 className={`text-xs font-bold ${titleClass}`}>Facturation {getCycleLabel(formData.billingCycle)}</h3>
                                            {formData.billingCycle !== 'monthly' && (
                                                <p className="text-[10px] text-[#00E599] font-medium mt-1 tracking-wide uppercase">
                                                    Vous économisez {formData.billingCycle === 'biannual' ? Math.round(prices.discountBiannual * 100) : Math.round(prices.discountAnnual * 100)}%
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Detailed Invoice */}
                                <div className={`md:col-span-3 border rounded-2xl p-6 relative shadow-xl overflow-hidden ${panelStrongClass}`}>
                                    <h3 className={`text-xs font-bold uppercase tracking-wider mb-5 flex items-center gap-2 ${tertiaryTextClass}`}>
                                        <Banknote className="w-4 h-4" /> Détail du Paiement Initial
                                    </h3>

                                    {formData.plan !== 'enterprise' ? (
                                        <>
                                            {/* Hardware Cost Line */}
                                            <div className="flex justify-between items-start mb-3 group relative">
                                                <button onClick={() => goToStep(2)} className={`absolute top-1 right-12 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${isDark ? 'bg-white/5 text-white/30 hover:text-[#00E599] hover:bg-[#00E599]/10' : 'bg-[#142945]/5 text-[#142945]/35 hover:text-[#00E599] hover:bg-[#00E599]/10'}`}>
                                                    <Pencil className="w-3 h-3" />
                                                </button>
                                                <div>
                                                    <p className={`text-sm font-semibold mb-0.5 flex items-center gap-1.5 ${titleClass}`}><Zap className={`w-3.5 h-3.5 ${secondaryTextClass}`} /> Traceurs GPS</p>
                                                    <p className={`text-[10px] ${tertiaryTextClass}`}>{formData.gpsCount}x Traçeurs GPS sans fil</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${titleClass}`}>{Math.round(initialHardwareCost)} TND</p>
                                                </div>
                                            </div>

                                            {/* Installation Line */}
                                            <div className="flex justify-between items-start mb-3 group relative">
                                                <div>
                                                    <p className={`text-sm font-semibold mb-0.5 flex items-center gap-1.5 ${titleClass}`}><PackageCheck className={`w-3.5 h-3.5 ${secondaryTextClass}`} /> Frais d'Installation</p>
                                                    <p className={`text-[10px] ${tertiaryTextClass}`}>Activation & Pose sur site (Frais Unique)</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`text-sm font-bold ${titleClass}`}>{prices.installation} TND</p>
                                                </div>
                                            </div>

                                            {/* Delivery Line */}
                                            <div className="flex justify-between items-start mb-3 group relative">
                                                <div>
                                                    <p className={`text-sm font-semibold mb-0.5 flex items-center gap-1.5 ${titleClass}`}><Truck className={`w-3.5 h-3.5 ${secondaryTextClass}`} /> Frais de Livraison</p>
                                                    <p className={`text-[10px] ${tertiaryTextClass}`}>Partout en Tunisie</p>
                                                </div>
                                                <div className="text-right flex items-center h-full pt-1">
                                                    <span className="bg-[#00E599]/10 text-[#00E599] text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#00E599]/20">Gratuit</span>
                                                </div>
                                            </div>

                                            {/* Security Deposit Line */}
                                            {prices.depositAmount > 0 && (
                                                <div className="flex justify-between items-start mb-3 group relative">
                                                    <div className="pr-4">
                                                        <p className={`text-sm font-semibold mb-0.5 flex items-center gap-1.5 ${titleClass}`}><ShieldCheck className={`w-3.5 h-3.5 ${secondaryTextClass}`} /> Dépôt de garantie</p>
                                                        <p className={`text-[10px] leading-relaxed ${tertiaryTextClass}`}>Frais de garantie</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className={`text-sm font-bold ${titleClass}`}>{prices.depositAmount} TND</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Advance Months Line */}
                                            {prices.advMonths > 0 && (
                                                <div className={`flex justify-between items-start pb-4 border-b mb-4 group relative ${isDark ? 'border-white/5' : 'border-[#142945]/10'}`}>
                                                    <button onClick={() => goToStep(3)} className={`absolute top-1 right-12 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${isDark ? 'bg-white/5 text-white/30 hover:text-[#00E599] hover:bg-[#00E599]/10' : 'bg-[#142945]/5 text-[#142945]/35 hover:text-[#00E599] hover:bg-[#00E599]/10'}`}>
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                    <div className="pr-4">
                                                        <p className={`text-sm font-semibold mb-0.5 flex items-center gap-1.5 ${titleClass}`}><Clock className={`w-3.5 h-3.5 ${secondaryTextClass}`} /> Avance sur abonnement</p>
                                                        <p className={`text-[10px] leading-relaxed ${tertiaryTextClass}`}>Couvre les {prices.advMonths} premiers mois d'abonnement au forfait {PLANS[formData.plan as keyof typeof PLANS]?.name}</p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className={`text-sm font-bold ${titleClass}`}>{Math.round(advanceCost)} TND</p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Total Due Today */}
                                            <div className={`flex justify-between items-end pt-2 pb-5 border-b border-dashed mb-5 ${isDark ? 'border-white/5' : 'border-[#142945]/10'}`}>
                                                <div>
                                                    <p className={`text-sm font-bold mb-0.5 ${titleClass}`}>Total à payer aujourd'hui</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="flex items-baseline gap-1">
                                                        <span className="text-4xl font-black text-[#00E599]">{Math.round(totalDueToday)}</span>
                                                        <span className={`text-sm font-bold ${secondaryTextClass}`}>TND</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Recurring Future Warning */}
                                            <div className="bg-[#00E599]/10 rounded-lg p-3 flex gap-3 items-start border border-[#00E599]/20">
                                                <RefreshCw className="w-4 h-4 text-[#00E599] shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-xs font-bold text-[#00E599] mb-1">Prélèvement Récurrent</p>
                                                    <p className={`text-[10px] ${featureTextClass}`}>
                                                        Dans {prices.advMonths} mois, votre abonnement sera renouvelé ({getCycleLabel(formData.billingCycle)}) au tarif de <strong className={titleClass}>{Math.round(recurringCostPerCycle)} TND / {formData.billingCycle === 'monthly' ? 'mois' : formData.billingCycle === 'biannual' ? '6 mois' : 'an'}</strong>.
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        // Enterprise Custom Flow
                                        <div className="text-center py-6">
                                            <Building2 className="w-12 h-12 text-[#00E599] mx-auto mb-4 opacity-50" />
                                            <h4 className={`text-lg font-bold mb-2 ${titleClass}`}>Offre Sur Mesure</h4>
                                            <p className={`text-xs leading-relaxed max-w-[200px] mx-auto ${secondaryTextClass}`}>
                                                Pour {formData.gpsCount} traceurs, un conseiller expert préparera un devis détaillé avec des tarifs préférentiels.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 6: Payment */}
                    {step === 6 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="text-center">
                                <h2 className={`text-2xl font-bold mb-2 ${titleClass}`}>Mode de paiement</h2>
                                <p className={`text-sm ${secondaryTextClass}`}>Comment souhaitez-vous régler vos initiales ?</p>
                            </div>
                            <div className="max-w-lg mx-auto space-y-4">
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'now' }))}
                                    className={`w-full flex items-center gap-5 p-6 rounded-2xl text-left transition-all relative overflow-hidden ${formData.paymentMethod === 'now' ? 'bg-[#00E599]/10 border-2 border-[#00E599] shadow-[0_0_25px_rgba(0,229,153,0.1)]' : isDark ? 'bg-[#121620] border-2 border-white/5 hover:border-[#00E599]/20 group' : 'bg-white border-2 border-[#142945]/10 hover:border-[#00E599]/20 group shadow-[0_10px_30px_rgba(20,41,69,0.06)]'}`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${formData.paymentMethod === 'now' ? 'bg-[#00E599] text-white shadow-lg' : isDark ? 'bg-white/5 text-white/50 group-hover:text-white' : 'bg-[#142945]/5 text-[#142945]/50 group-hover:text-[#142945]'}`}>
                                        <CreditCard className="w-7 h-7" />
                                    </div>
                                    <div className="flex-1 relative z-10">
                                        <p className={`text-base font-bold ${titleClass}`}>Payer en ligne</p>
                                        <p className={`text-xs mt-1.5 flex items-center gap-2 ${tertiaryTextClass}`}>
                                            <ShieldCheck className="w-3.5 h-3.5 text-[#00E599]" /> Paiement sécurisé (Visa, Mastercard)
                                        </p>
                                    </div>
                                    {formData.paymentMethod === 'now' && <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#00E599] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                </button>

                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, paymentMethod: 'on_order' }))}
                                    className={`w-full flex items-center gap-5 p-6 rounded-2xl text-left transition-all relative overflow-hidden ${formData.paymentMethod === 'on_order' ? 'bg-[#00E599]/10 border-2 border-[#00E599] shadow-[0_0_25px_rgba(0,229,153,0.1)]' : isDark ? 'bg-[#121620] border-2 border-white/5 hover:border-[#00E599]/20 group' : 'bg-white border-2 border-[#142945]/10 hover:border-[#00E599]/20 group shadow-[0_10px_30px_rgba(20,41,69,0.06)]'}`}
                                >
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors ${formData.paymentMethod === 'on_order' ? 'bg-[#00E599] text-white shadow-lg' : isDark ? 'bg-white/5 text-white/50 group-hover:text-white' : 'bg-[#142945]/5 text-[#142945]/50 group-hover:text-[#142945]'}`}>
                                        <Banknote className="w-7 h-7" />
                                    </div>
                                    <div className="flex-1 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <div className="flex flex-col">
                                                <p className={`text-base font-bold ${titleClass}`}>Payer à l'installation</p>
                                                {formData.plan !== 'enterprise' && (
                                                    <p className="text-[10px] text-[#00E599] font-bold tracking-wide uppercase mt-1">Montant à prévoir : {totalDueToday} TND</p>
                                                )}
                                            </div>
                                        </div>
                                        <p className={`text-xs mt-1.5 ${tertiaryTextClass}`}>Espèces ou chèque lors de notre intervention</p>
                                    </div>
                                    {formData.paymentMethod === 'on_order' && <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-[#00E599] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></div>}
                                </button>

                                {/* Card details for online payment */}
                                {formData.paymentMethod === 'now' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 mt-2">
                                        <div className="bg-gradient-to-br from-[#0B1829] to-[#142945] rounded-2xl p-5 text-white relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -mr-10 -mt-10 pointer-events-none" />
                                            <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">N° de Carte Bancaire</p>
                                            <input
                                                type="text" inputMode="numeric"
                                                placeholder="0000 0000 0000 0000"
                                                value={cardNumber}
                                                onChange={e => setCardNumber(formatCardNumber(e.target.value))}
                                                className="w-full bg-transparent text-white text-lg font-mono font-bold placeholder:text-white/25 outline-none border-none tracking-widest mb-4"
                                                maxLength={19}
                                            />
                                            <div className="flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] opacity-40 uppercase tracking-widest mb-1">Expiry</p>
                                                    <input type="text" inputMode="numeric" placeholder="MM/YY"
                                                        value={cardExpiry} onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                                                        className="bg-transparent text-white font-bold text-sm placeholder:text-white/25 outline-none border-none w-16"
                                                        maxLength={5} />
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] opacity-40 uppercase tracking-widest mb-1">CVV</p>
                                                    <input type="password" inputMode="numeric" placeholder="•••"
                                                        value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                                        className="bg-transparent text-white font-bold text-sm placeholder:text-white/25 outline-none border-none w-12 text-right"
                                                        maxLength={3} />
                                                </div>
                                                <span className="text-2xl opacity-60">💳</span>
                                            </div>
                                        </div>
                                        <p className={`text-[10px] text-center mt-2 flex items-center justify-center gap-1.5 ${tertiaryTextClass}`}>
                                            <ShieldCheck className="w-3 h-3 text-[#00E599]" />
                                            Paiement sécurisé — Visa / Mastercard
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 border-t shrink-0 flex items-center justify-between ${headerClass}`}>
                    <div className={`text-xs font-medium ${secondaryTextClass}`}>
                        ÉTAPE <span className={titleClass}>{step - 1}</span> SUR <span className={titleClass}>5</span>
                    </div>
                    <div className="flex gap-3">
                        {step > 2 && (
                            <Button variant="outline" className={`bg-transparent rounded-xl text-sm px-5 h-10 ${isDark ? 'border-white/10 text-white/70 hover:bg-white/5' : 'border-[#142945]/12 text-[#142945]/70 hover:bg-[#142945]/5'}`} onClick={() => setStep(step - 1)}>
                                <ChevronLeft className="w-4 h-4 mr-1" /> Retour
                            </Button>
                        )}
                        {step < 6 ? (
                            <Button 
                                className="bg-[#00E599] text-white hover:bg-[#00E599]/90 font-bold rounded-xl text-sm px-6 h-10 disabled:opacity-40" 
                                disabled={!canProceed() || isCheckingEmail} 
                                onClick={async () => {
                                    if (step === 4) {
                                        const isUnique = await verifyEmailUnique(formData.email);
                                        if (!isUnique) {
                                            toast.error("Veuillez corriger les erreurs dans le formulaire.");
                                            return;
                                        }
                                    }
                                    setStep(step + 1);
                                }}
                            >
                                {isCheckingEmail ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                                        Vérification...
                                    </>
                                ) : (
                                    <>
                                        Continuer <ChevronRight className="w-4 h-4 ml-1" />
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button className="bg-[#00E599] text-white hover:bg-[#00E599]/90 font-bold px-6 h-10 rounded-xl gap-2 transition-all shadow-[0_0_15px_rgba(0,229,153,0.2)]" disabled={!canProceed()} onClick={handleSubmit}>
                                Finaliser <Check className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default JoinPopup;


