import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store';
import { ordersApi, pricingApi } from '@/lib/api';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShoppingCart, CheckCircle2, ArrowRight, ArrowLeft, X, Loader2, ClipboardList, Building2, Phone, Mail, Plus, Minus, RefreshCw, PackagePlus, Clock, Truck, Zap, XCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { DEVICE_TYPES } from '@/lib/utils-geo';
import type { Device } from '@/lib/types';

interface Props { open: boolean; onClose: () => void; }

/* ─── GPS Types ─────────────────────────────────────────────── */
type GpsType = Device['deviceType'];
interface GpsAllocation { type: GpsType; icon: any; label: string; count: number; }

const defaultAllocation: GpsAllocation[] = DEVICE_TYPES.map((type) => ({
  type: type.value as GpsType,
  icon: type.icon,
  label: type.label,
  count: 0,
}));

const getDeviceTypeIcon = (type: string) => DEVICE_TYPES.find(item => item.value === type)?.icon || PackagePlus;

const STEPS = ['Appareils GPS', 'Confirmation'];

/* ─── Status timeline ───────────────────────────────────────── */
const STATUS_TIMELINE = [
  { key: 'pending',    Icon: Clock,        label: 'Demande reçue',       desc: 'Votre commande est en cours de traitement.',             color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/30' },
  { key: 'confirmed',  Icon: CheckCircle2, label: 'Commande confirmée',  desc: 'Validée par notre équipe commerciale.',                   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30' },
  { key: 'installing', Icon: Truck,        label: 'En installation',     desc: 'Vos appareils sont en cours de livraison/installation.', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/30' },
  { key: 'active',     Icon: Zap,          label: 'Activé !',            desc: 'Vos nouveaux appareils sont actifs dans votre espace.',   color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
];

const statusIndex = (s: string) => Math.max(0, STATUS_TIMELINE.findIndex(t => t.key === s));

/* ═══════════════════════════════════════════════════════════════ */
export default function UpgradeOrderModal({ open, onClose }: Props) {
  const { user } = useAuthStore();

  /* ── mode: 'loading' | 'tracker' | 'form' ─────────────────── */
  const [mode,         setMode]        = useState<'loading' | 'tracker' | 'form'>('loading');
  const [trackerOrder, setTrackerOrder]= useState<any>(null);
  const [trackLoading, setTrackLoading]= useState(false);

  /* ── form state ────────────────────────────────────────────── */
  const [step,     setStep]    = useState(0);
  const [loading,  setLoading] = useState(false);
  const [gpsCount, setGpsCount]= useState(0);
  const [gpsAlloc, setGpsAlloc]= useState<GpsAllocation[]>(defaultAllocation.map(a => ({ ...a })));
  const [phone,    setPhone]   = useState((user as any)?.phone || '');
  const [notes,    setNotes]   = useState('');

  const [devicePrice, setDevicePrice] = useState(110);

  /* ── derived ───────────────────────────────────────────────── */
  const allocTotal = gpsAlloc.reduce((s, a) => s + a.count, 0);
  const remaining  = gpsCount - allocTotal;
  const isComplete = gpsCount > 0 && remaining === 0;
  const totalPrice = gpsCount * devicePrice;

  /* ── Fetch user's latest upgrade order from backend ─────────── */
  const fetchUserOrders = useCallback(async () => {
    if (!user?.email) { setMode('form'); return; }
    setMode('loading');
    try {
      const orders = await ordersApi.getMyOrders('client_upgrade');
      // Find the latest order that is still in-progress OR recently completed.
      // - cancelled → skip entirely (user can always create a new order)
      // - pending / confirmed / installing → show tracker, block new orders
      // - active (completed) → show tracker with option to start new order
      const active = orders.find((o: any) => {
        if (['cancelled'].includes(o.status)) return false;
        return true;
      });
      if (active) {
        setTrackerOrder(active);
        setMode('tracker');
      } else {
        setMode('form');
      }
    } catch {
      setMode('form');
    }
  }, [user?.email]);

  useEffect(() => {
    if (open) {
      fetchUserOrders();
      pricingApi.getAll().then(data => {
        if (data?.config?.device_price) {
          setDevicePrice(data.config.device_price);
        }
      }).catch(() => {});
    }
  }, [open, fetchUserOrders]);

  /* ── Refresh single order status ────────────────────────────── */
  const refreshStatus = async () => {
    if (!trackerOrder?.orderRef) return;
    setTrackLoading(true);
    try {
      const data = await ordersApi.track(trackerOrder.orderRef);
      if (data?.status) setTrackerOrder((prev: any) => ({ ...prev, ...data }));
    } catch { /* silent */ }
    finally { setTrackLoading(false); }
  };

  const updateAlloc = (type: GpsType, delta: number) =>
    setGpsAlloc(prev => prev.map(a => a.type === type ? { ...a, count: Math.max(0, a.count + delta) } : a));

  const resetForm = () => {
    setStep(0);
    setGpsCount(0); setGpsAlloc(defaultAllocation.map(a => ({ ...a })));
    setPhone((user as any)?.phone || ''); setNotes('');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const canNext = () => {
    if (step === 0) return isComplete;
    if (step === 1) return !!phone;
    return true;
  };

  /* ── Submit ─────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const gpsTypes = gpsAlloc.filter(a => a.count > 0).map(a => ({ type: a.type, count: a.count, label: a.label }));
      const order = await ordersApi.create({
        fullName:      user?.name || user?.email?.split('@')[0] || 'Client',
        email:         user?.email || '',
        phone:         phone || '',
        company:       (user as any)?.enterpriseName || user?.name || 'Entreprise',
        usageType:     'professional',
        gpsCount, gpsTypes,
        plan:          (user as any)?.plan || 'pro',
        billingCycle:  'monthly',
        totalDueToday: totalPrice,
        recurringCost: 0,
        paymentMethod: 'invoice',
        source:        'client_upgrade',
        notes:         notes || null,
        enterpriseId:  (user as any)?.enterpriseId || null,
        userId:        user?.id || null,
      });
      setTrackerOrder(order);
      setMode('tracker');
      toast.success('Commande envoyée ! Notre équipe vous contacte bientôt.');
    } catch (err: any) {
      toast.error('Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* ── Tracker helpers ────────────────────────────────────────── */
  const currentIdx   = trackerOrder ? statusIndex(trackerOrder.status || 'pending') : 0;
  const currentStage = STATUS_TIMELINE[currentIdx] || STATUS_TIMELINE[0];
  const { Icon: CurrentIcon } = currentStage;
  const isCancelled = trackerOrder?.status === 'cancelled';
  const isCompleted = trackerOrder?.status === 'active';

  /* Header gradient */
  const headerGrad = mode === 'tracker' && isCompleted
    ? 'bg-gradient-to-r from-emerald-600 to-emerald-500'
    : mode === 'tracker' && isCancelled
    ? 'bg-gradient-to-r from-red-700 to-red-600'
    : 'bg-gradient-to-r from-primary/90 to-primary';

  /* ═══════════════════════════════════════════════════════════ */
  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent
        className="w-[calc(100%-2rem)] sm:w-full max-w-2xl p-0 overflow-hidden border-border/60 bg-card shadow-2xl [&>button]:hidden max-h-[90vh] flex flex-col"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Commander des appareils GPS supplémentaires</DialogTitle>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className={`px-6 py-4 flex items-center justify-between shrink-0 ${headerGrad}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              {isCompleted ? <Zap className="w-5 h-5 text-white" /> :
               isCancelled ? <XCircle className="w-5 h-5 text-white" /> :
               mode === 'tracker' ? <ClipboardList className="w-5 h-5 text-white" /> :
               <PackagePlus className="w-5 h-5 text-white" />}
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                {isCompleted ? 'Appareils activés !' :
                 isCancelled ? 'Commande annulée' :
                 mode === 'tracker' ? 'Suivi de votre commande' :
                 'Ajouter des appareils GPS'}
              </h2>
              <p className="text-white/70 text-xs">
                {mode === 'tracker'
                  ? `Réf. ${trackerOrder?.orderRef} · ${user?.enterpriseName || user?.name}`
                  : `Mise à jour du parc · ${user?.enterpriseName || user?.name}`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Stepper (form only) ──────────────────────────── */}
        {mode === 'form' && (
          <div className="flex items-center gap-0 px-6 py-3 bg-secondary/10 border-b border-border/40 shrink-0">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center">
                <div className={`flex items-center gap-2 text-xs font-semibold whitespace-nowrap ${i === step ? 'text-primary' : i < step ? 'text-green-400' : 'text-muted-foreground'}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border shrink-0 ${
                    i === step ? 'bg-primary text-white border-primary' :
                    i < step  ? 'bg-green-500 text-white border-green-500' :
                    'border-border text-muted-foreground'}`}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  {s}
                </div>
                {i < STEPS.length - 1 && <div className={`w-8 h-px mx-3 shrink-0 ${i < step ? 'bg-green-500' : 'bg-border'}`} />}
              </div>
            ))}
            <div className="ml-auto flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1">
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-[11px] font-semibold">
                Abonnement {(user as any)?.plan ? ((user as any).plan.charAt(0).toUpperCase() + (user as any).plan.slice(1)) : 'actif'} en cours
              </span>
            </div>
          </div>
        )}

        {/* ── Body ────────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 min-h-0">

          {/* Loading */}
          {mode === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Vérification de vos commandes en cours...</p>
            </div>
          )}

          {/* ══ TRACKER ═══════════════════════════════════════════ */}
          {mode === 'tracker' && trackerOrder && (
            <div className="space-y-5 animate-in fade-in duration-300">

              {/* Status hero */}
              {!isCancelled && (
                <div className={`rounded-2xl border p-5 flex items-center gap-4 ${currentStage.bg}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${currentStage.bg}`}>
                    <CurrentIcon className={`w-7 h-7 ${currentStage.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold text-lg ${currentStage.color}`}>{currentStage.label}</p>
                      {trackLoading && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{currentStage.desc}</p>
                  </div>
                  {isCompleted && <span className="text-3xl">🎉</span>}
                </div>
              )}

              {/* Cancelled */}
              {isCancelled && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 flex items-center gap-4">
                  <AlertCircle className="w-10 h-10 text-red-400 shrink-0" />
                  <div>
                    <p className="font-bold text-red-400">Commande annulée</p>
                    <p className="text-sm text-muted-foreground">Contactez-nous pour plus d'informations ou créez une nouvelle commande.</p>
                  </div>
                </div>
              )}

              {/* Vertical timeline */}
              {!isCancelled && (
                <div className="space-y-4 pl-1">
                  {STATUS_TIMELINE.map(({ key, Icon, label, desc, color }, i) => {
                    const done = i < currentIdx;
                    const cur  = i === currentIdx;
                    return (
                      <div key={key} className={`flex items-start gap-4 transition-all duration-300 ${i > currentIdx ? 'opacity-35' : ''}`}>
                        <div className="flex flex-col items-center shrink-0 w-7">
                          <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                            done ? 'bg-primary border-primary shadow-[0_0_10px_rgba(3,156,81,0.4)]' :
                            cur  ? `bg-card border-primary shadow-[0_0_15px_rgba(3,156,81,0.25)]` :
                            'bg-card border-border'}`}>
                            {done
                              ? <CheckCircle2 className="w-4 h-4 text-white" />
                              : <Icon className={`w-3.5 h-3.5 ${cur ? color : 'text-muted-foreground'}`} />}
                          </div>
                          {i < STATUS_TIMELINE.length - 1 && (
                            <div className="w-[2px] h-8 bg-border mt-1.5 relative rounded-full">
                              <div
                                className="absolute top-0 left-0 w-full bg-primary transition-all duration-500 rounded-full"
                                style={{ height: done ? '100%' : cur ? '50%' : '0%' }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="pt-0.5 flex-1">
                          <p className={`font-semibold text-sm ${cur ? color : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {label}
                            {cur && <span className="ml-2 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">En cours</span>}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Order details card */}
              <div className="rounded-xl bg-secondary/30 border border-border/40 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-sm">
                  <ClipboardList className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Référence :</span>
                  <span className="font-bold text-primary font-mono">{trackerOrder.orderRef}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Email :</span>
                  <span className="font-medium text-xs">{trackerOrder.email}</span>
                </div>
                {trackerOrder.gpsCount && (
                  <div className="flex items-center gap-2 text-sm">
                    <PackagePlus className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Appareils :</span>
                    <span className="font-medium">{trackerOrder.gpsCount} GPS</span>
                  </div>
                )}
                {trackerOrder.gpsTypes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {trackerOrder.gpsTypes.map((t: any, i: number) => (
                      <span key={i} className="flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary rounded-full px-2.5 py-0.5 text-xs font-semibold">
                        {(() => { const Icon = getDeviceTypeIcon(t.type); return <Icon className="w-3.5 h-3.5" />; })()} {t.count} {t.label || t.type}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes if any */}
              {trackerOrder.notes && (
                <div className="rounded-xl bg-secondary/20 border border-border/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Votre note :</p>
                  <p className="text-sm italic">{trackerOrder.notes}</p>
                </div>
              )}

              {/* Contact */}
              <div className="rounded-xl bg-blue-500/8 border border-blue-500/15 p-3 flex items-center gap-3">
                <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Notre équipe vous contactera au <strong>+216 71 000 000</strong> pour coordonner l'installation.
                </p>
              </div>
            </div>
          )}

          {/* ══ FORM STEP 0 ════════════════════════════════════════ */}
          {mode === 'form' && step === 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-1">Combien de GPS souhaitez-vous ajouter ?</h3>
                <p className="text-xs text-muted-foreground">Choisissez le nombre total puis répartissez par type.</p>
              </div>

              <div className="bg-secondary/30 border border-border/50 rounded-2xl p-6 text-center">
                <label className="block text-sm font-medium text-muted-foreground mb-4">Nombre total de GPS à ajouter</label>
                <div className="flex items-center justify-center gap-6">
                  <button onClick={() => setGpsCount(c => Math.max(0, c - 1))}
                    className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all">
                    <Minus className="w-5 h-5" />
                  </button>
                  <input type="number" min="0" value={gpsCount || ''} onChange={e => setGpsCount(Math.max(0, parseInt(e.target.value) || 0))} placeholder="0"
                    className="text-5xl font-extrabold text-primary tabular-nums w-24 text-center bg-transparent border-none outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => setGpsCount(c => c + 1)}
                    className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary hover:bg-primary/20 transition-all shadow-[0_0_15px_rgba(3,156,81,0.15)]">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                {gpsCount > 0 && (
                  <div className="mt-5 pt-4 border-t border-border/40">
                    <p className="text-xs text-muted-foreground mb-1">Estimation matériel</p>
                    <p className="text-2xl font-extrabold">{totalPrice.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">TND</span></p>
                    <p className="text-xs text-muted-foreground mt-1">{gpsCount} × {devicePrice} TND — <span className="text-primary font-medium">abonnement inchangé</span></p>
                  </div>
                )}
              </div>

              {gpsCount > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-semibold">Répartition par type</label>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border transition-all ${
                      remaining === 0 ? 'bg-green-500/10 border-green-500/30 text-green-400' :
                      remaining < 0  ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                      'bg-orange-500/10 border-orange-500/30 text-orange-400'}`}>
                      {remaining === 0 ? '✓ Complet' : remaining > 0 ? `${remaining} restant${remaining > 1 ? 's' : ''}` : `${Math.abs(remaining)} en trop`}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {gpsAlloc.map(item => {
                      const Icon = item.icon;

                      return (
                        <div
                          key={item.type}
                          className={`rounded-xl border p-3 flex flex-col justify-between transition-all duration-200 ${
                            item.count > 0
                              ? 'bg-[#00E599]/5 border-[#00E599]/30 shadow-sm'
                              : 'bg-white border-[#142945]/10 hover:border-[#00E599]/25'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ring-1 ${
                                item.count > 0
                                  ? 'bg-[#00E599]/15 text-[#00E599] ring-[#00E599]/20'
                                  : 'bg-[#142945]/5 text-[#142945]/60 ring-[#142945]/10'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-semibold text-[#142945]/88">{item.label}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg p-1.5 border bg-[#F5F7FA] border-[#142945]/10">
                            <button
                              onClick={() => updateAlloc(item.type, -1)}
                              disabled={item.count === 0}
                              className="w-6 h-6 rounded-md bg-[#142945]/5 flex items-center justify-center text-[#142945]/60 hover:bg-[#142945]/12 disabled:opacity-30 transition-all border border-[#142945]/10"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min="0"
                              value={item.count || ''}
                              onChange={e => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setGpsAlloc(prev => prev.map(a => a.type === item.type ? { ...a, count: val } : a));
                              }}
                              placeholder="0"
                              className={`text-sm font-bold tabular-nums w-8 text-center bg-transparent border-none outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                item.count > 0 ? 'text-[#00E599]' : 'text-[#142945]/50'
                              }`}
                            />
                            <button
                              onClick={() => updateAlloc(item.type, 1)}
                              disabled={remaining <= 0}
                              className="w-6 h-6 rounded-md bg-[#00E599]/10 flex items-center justify-center text-[#00E599] hover:bg-[#00E599]/30 disabled:opacity-30 transition-all border border-[#00E599]/20"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {remaining !== 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      {remaining > 0 ? `Répartissez encore ${remaining} GPS.` : `${Math.abs(remaining)} GPS en trop.`}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ FORM STEP 1 ════════════════════════════════════════ */}
          {mode === 'form' && step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-1">Vérification & contact</h3>
                <p className="text-xs text-muted-foreground">Confirmez vos informations avant l'envoi.</p>
              </div>

              <div className="rounded-xl bg-secondary/30 border border-border/40 p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Votre compte</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-medium truncate">{user?.enterpriseName || '—'}</span></div>
                  <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground shrink-0" /><span className="truncate text-xs">{user?.email}</span></div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block text-muted-foreground">Téléphone de contact *</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+216 XX XXX XXX" className="pl-10" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block text-muted-foreground">Notes / Instructions (optionnel)</Label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Ex : livraison à l'entrepôt, installation le matin..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Résumé</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {gpsAlloc.filter(a => a.count > 0).map(a => (
                    <span key={a.type} className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary rounded-full px-3 py-1 text-xs font-semibold">
                      {(() => { const Icon = a.icon; return <Icon className="w-3.5 h-3.5" />; })()} {a.count} {a.label}
                    </span>
                  ))}
                </div>
                <div className="border-t border-primary/10 pt-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Matériel ({gpsCount} × {devicePrice} TND)</span>
                    <span className="font-bold">{totalPrice.toLocaleString()} TND</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Abonnement mensuel</span>
                    <span className="font-bold text-green-400">Inchangé</span>
                  </div>
                  <div className="flex justify-between font-bold text-base border-t border-primary/10 pt-2">
                    <span>Total matériel</span>
                    <span className="text-primary">{totalPrice.toLocaleString()} TND</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border/40 bg-secondary/10 flex items-center justify-between shrink-0">
          {mode === 'loading' && (
            <div className="w-full flex justify-center">
              <Button variant="outline" size="sm" onClick={handleClose}>Annuler</Button>
            </div>
          )}

          {mode === 'tracker' && (
            <div className="flex items-center justify-between w-full gap-3">
              <button onClick={refreshStatus} disabled={trackLoading}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-50">
                <RefreshCw className={`w-3 h-3 ${trackLoading ? 'animate-spin' : ''}`} />
                Actualiser le statut
              </button>
              <div className="flex items-center gap-2">
                {/* Allow new order only when current one is completed (active) or cancelled */}
                {(isCompleted || isCancelled) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTrackerOrder(null);
                      resetForm();
                      setMode('form');
                    }}
                    className="gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nouvelle commande
                  </Button>
                )}
                <Button variant={isCompleted ? 'hero' : 'outline'} size="sm" onClick={handleClose}>
                  {isCompleted ? <><Zap className="w-3.5 h-3.5 mr-1.5" />Voir mes appareils</> : 'Fermer'}
                </Button>
              </div>
            </div>
          )}

          {mode === 'form' && (
            <>
              <Button variant="outline" size="sm" onClick={() => step > 0 ? setStep(s => s - 1) : handleClose()}>
                {step > 0 ? <><ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Retour</> : 'Annuler'}
              </Button>
              {step < 1 ? (
                <Button variant="hero" size="sm" disabled={!canNext()} onClick={() => setStep(s => s + 1)}>
                  Suivant <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              ) : (
                <Button variant="hero" size="sm" disabled={!canNext() || loading} onClick={handleSubmit}>
                  {loading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Envoi...</> : <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" />Envoyer la commande</>}
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
