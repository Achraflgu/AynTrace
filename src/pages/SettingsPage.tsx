import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Bell, Shield, Palette, Save, Moon, Sun,
  Clock, Database, Languages, RotateCcw, BatteryLow,
  Wifi, Gauge, AlertOctagon, WifiOff, MapPin,
  Settings, Building2, Lock, BellOff, BellRing, ToggleLeft, Mail
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';
import { enterprisesApi, usersApi } from '@/lib/api';

const ALERT_KEYS = ['battery', 'speed', 'signal', 'sos', 'offline', 'geofence'] as const;
type AlertKey = typeof ALERT_KEYS[number];

const SettingsPage = () => {
  const { user } = useAuthStore();
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang } = useI18n();
  const isAdmin = user?.role === 'admin';
  const isFr = lang === 'fr';

  // ── System prefs (admin, localStorage) ────────────────────────────
  const defaultSystem = {
    refreshInterval: 25,
    retentionDays: 90,
    security2fa: false,
    securityAudit: true,
    securityTimeout: true,
  };
  const [systemSettings, setSystemSettings] = useState(defaultSystem);

  // ── Enterprise alert detection (operators, saved to DB) ────────────
  const defaultAlertSettings = {
    battery: { enabled: true, threshold: 30 },
    speed:   { enabled: true, threshold: 70 },
    signal:  { enabled: true, threshold: 55 },
    sos:     { enabled: true },
    offline: { enabled: true },
    geofence:{ enabled: true },
  };
  const [alertSettings, setAlertSettings] = useState(defaultAlertSettings);

  // ── Personal notification mute — both roles (localStorage) ─────────
  const defaultNotifPrefs: Record<AlertKey, boolean> = {
    battery: true, speed: true, signal: true,
    sos: true, offline: true, geofence: true,
  };
  const [notifPrefs, setNotifPrefs] = useState<Record<AlertKey, boolean>>(defaultNotifPrefs);

  // ── Email notifications (operator, saved to DB) ─────────
  const defaultEmailPrefs: Record<AlertKey, boolean> = {
    battery: false, speed: false, signal: false,
    sos: false, offline: false, geofence: false,
  };
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<Record<AlertKey, boolean>>(defaultEmailPrefs);

  const [isSaving, setIsSaving] = useState(false);

  // ── Derived master toggles ─────────────────────────────────────────
  const notifKey = isAdmin ? 'admin-notif-prefs' : `notif-prefs-${user?.id}`;
  const allNotifOn  = ALERT_KEYS.every(k => notifPrefs[k]);
  const allAlertOn  = ALERT_KEYS.every(k => (alertSettings as any)[k]?.enabled);

  const toggleAllNotif = (on: boolean) => {
    const next = ALERT_KEYS.reduce((acc, k) => ({ ...acc, [k]: on }), {} as Record<AlertKey, boolean>);
    setNotifPrefs(next);
  };

  const allEmailOn = ALERT_KEYS.every(k => emailPrefs[k]);
  const toggleAllEmail = (on: boolean) => {
    const next = ALERT_KEYS.reduce((acc, k) => ({ ...acc, [k]: on }), {} as Record<AlertKey, boolean>);
    setEmailPrefs(next);
  };

  const toggleAllAlerts = (on: boolean) => {
    setAlertSettings(prev => {
      const next = { ...prev };
      ALERT_KEYS.forEach(k => { (next as any)[k] = { ...(prev as any)[k], enabled: on }; });
      return next;
    });
  };

  useEffect(() => {
    const saved = localStorage.getItem('app-settings');
    if (saved) { try { setSystemSettings(JSON.parse(saved)); } catch (e) { } }

    // Load personal notification prefs for every role
    const n = localStorage.getItem(notifKey);
    if (n) { try { setNotifPrefs({ ...defaultNotifPrefs, ...JSON.parse(n) }); } catch (e) { } }

    // Operators: also load enterprise alert rules from DB
    if (user?.role === 'operator') {
      const eid = (user as any)?.enterpriseId;
      if (eid) {
        enterprisesApi.getById(eid).then((res: any) => {
          if (res.alertSettings) setAlertSettings({ ...defaultAlertSettings, ...res.alertSettings });
        }).catch(console.error);
      }
      
      const savedPrefs = (user as any)?.emailAlertPrefs;
      if (savedPrefs) {
         setEmailEnabled(savedPrefs.enabled ?? false);
         if (savedPrefs.types && Array.isArray(savedPrefs.types)) {
            const next = { ...defaultEmailPrefs };
            savedPrefs.types.forEach((t: AlertKey) => { if (t in next) next[t] = true; });
            setEmailPrefs(next);
         }
      }
    }
  }, [user, isAdmin]);

  const handleSave = () => {
    setIsSaving(true);
    // Always save system + notif prefs locally
    if (isAdmin) localStorage.setItem('app-settings', JSON.stringify(systemSettings));
    localStorage.setItem(notifKey, JSON.stringify(notifPrefs));

    if (user?.role === 'operator') {
      // Operators: persist alert detection rules + email notification prefs to DB
      const eid = (user as any)?.enterpriseId;
      const promises: Promise<any>[] = [];
      if (eid) promises.push(enterprisesApi.update(eid, { alertSettings }));
      
      const proPlan = user?.plan === 'pro' || user?.plan === 'enterprise';
      const types = Object.keys(emailPrefs).filter(k => emailPrefs[k as AlertKey]);
      if (proPlan) {
        promises.push(usersApi.updatePrefs({ enabled: emailEnabled, types }));
      }
      
      Promise.all(promises).then(() => {
        // Sync the auth store user so prefs persist across page reloads
        const newEmailAlertPrefs = { enabled: emailEnabled, types };
        useAuthStore.setState(prev => ({
          user: prev.user ? { ...prev.user, emailAlertPrefs: newEmailAlertPrefs } as any : prev.user
        }));
        setTimeout(() => { setIsSaving(false); toast.success(isFr ? 'Paramètres enregistrés avec succès' : 'Settings saved successfully'); }, 400);
      }).catch(err => { setIsSaving(false); toast.error('Error: ' + err.message); });
    } else {
      setTimeout(() => { setIsSaving(false); toast.success(isFr ? 'Paramètres enregistrés' : 'Settings saved'); }, 400);
    }
  };

  const handleReset = () => {
    setSystemSettings(defaultSystem);
    setAlertSettings(defaultAlertSettings);
    setNotifPrefs(defaultNotifPrefs);
    localStorage.removeItem('app-settings');
    localStorage.removeItem(notifKey);
    toast.info(isFr ? 'Réinitialisation effectuée' : 'Reset to defaults');
  };

  const updateAlert = (key: string, field: string, value: any) => {
    setAlertSettings(prev => ({ ...prev, [key]: { ...(prev as any)[key], [field]: value } }));
  };
  const updateSystem = (key: keyof typeof systemSettings, val: any) => {
    setSystemSettings(prev => ({ ...prev, [key]: val }));
  };

  // ── Alert type metadata ────────────────────────────────────────────
  const ALERT_TYPES = [
    { key: 'battery' as AlertKey,  icon: BatteryLow,  color: 'bg-orange-500/10 text-orange-400',    titleFr: 'Batterie faible',      titleEn: 'Low Battery',      descFr: 'Alerte sous le seuil de batterie',        descEn: 'Alert when battery drops below threshold',  thresholdLabel: isFr ? 'Seuil batterie' : 'Battery threshold', thresholdUnit: '%',    thresholdMin: 5,  thresholdMax: 50 },
    { key: 'speed'   as AlertKey,  icon: Gauge,        color: 'bg-red-500/10 text-red-400',          titleFr: 'Excès de vitesse',     titleEn: 'Speeding',         descFr: 'Alerte vitesse dépassée',                 descEn: 'Alert when speed exceeds threshold',        thresholdLabel: isFr ? 'Vitesse max'    : 'Max speed',        thresholdUnit: 'km/h', thresholdMin: 40, thresholdMax: 200 },
    { key: 'signal'  as AlertKey,  icon: Wifi,         color: 'bg-yellow-500/10 text-yellow-400',    titleFr: 'Signal réseau faible', titleEn: 'Weak Signal',      descFr: 'Alerte signal sous le seuil',             descEn: 'Alert when signal drops below threshold',  thresholdLabel: isFr ? 'Seuil signal'   : 'Signal threshold',  thresholdUnit: '%',    thresholdMin: 10, thresholdMax: 80 },
    { key: 'sos'     as AlertKey,  icon: AlertOctagon, color: 'bg-red-600/10 text-red-500',          titleFr: 'Urgence SOS',          titleEn: 'SOS Emergency',    descFr: 'Bouton SOS / panique physique',           descEn: 'Physical SOS / panic button events' },
    { key: 'offline' as AlertKey,  icon: WifiOff,      color: 'bg-gray-500/10 text-gray-400',        titleFr: 'Appareils hors ligne', titleEn: 'Offline Devices',  descFr: 'Alerte quand un appareil se déconnecte',  descEn: 'Alert when a device loses connection' },
    { key: 'geofence'as AlertKey,  icon: MapPin,       color: 'bg-emerald-500/10 text-emerald-400',  titleFr: 'Zones GPS',            titleEn: 'GPS Zones',        descFr: 'Alertes entrée / sortie de zone',         descEn: 'Zone entry and exit alerts' },
  ];

  // ── Section header with master toggle ─────────────────────────────
  const SectionHeader = ({ icon: Icon, title, desc, allOn, onToggleAll, badge }: {
    icon: any; title: string; desc: string; allOn: boolean; onToggleAll: (v: boolean) => void; badge?: React.ReactNode;
  }) => (
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Icon className="w-3.5 h-3.5" />
          {title}
          {badge}
        </h2>
        <div className="flex items-center gap-2 bg-secondary/40 border border-border/50 rounded-full px-3 py-1">
          {allOn
            ? <BellRing className="w-3 h-3 text-primary" />
            : <BellOff className="w-3 h-3 text-muted-foreground" />}
          <span className="text-xs font-medium text-muted-foreground">
            {allOn ? (isFr ? 'Tout activé' : 'All on') : (isFr ? 'Tout désactivé' : 'All off')}
          </span>
          <Switch checked={allOn} onCheckedChange={onToggleAll} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{desc}</p>
    </div>
  );

  // ── Operator alert detection row ───────────────────────────────────
  const AlertRow = ({ icon: Icon, color, titleFr, titleEn, descFr, descEn, alertKey, thresholdLabel, thresholdUnit, thresholdMin, thresholdMax }: any) => {
    const cfg = (alertSettings as any)[alertKey] || {};
    return (
      <div className={`rounded-xl border transition-all overflow-hidden ${cfg.enabled ? 'border-border bg-card' : 'border-border/40 bg-card/40 opacity-60'}`}>
        <div className="flex items-center gap-3 p-4">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{isFr ? titleFr : titleEn}</p>
            <p className="text-xs text-muted-foreground">{isFr ? descFr : descEn}</p>
          </div>
          <Switch checked={cfg.enabled ?? true} onCheckedChange={v => updateAlert(alertKey, 'enabled', v)} />
        </div>
        {cfg.enabled && thresholdLabel && (
          <div className="px-4 pb-4">
            <div className="bg-secondary/40 rounded-lg p-3 flex items-center gap-3">
              <Label className="text-xs text-muted-foreground shrink-0 w-28">{thresholdLabel}</Label>
              <input
                type="range" min={thresholdMin} max={thresholdMax} step={5}
                value={cfg.threshold}
                onChange={e => updateAlert(alertKey, 'threshold', parseInt(e.target.value))}
                className="flex-1 accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
              <div className="w-16 text-right">
                <span className="text-sm font-bold text-primary">{cfg.threshold}</span>
                <span className="text-xs text-muted-foreground ml-1">{thresholdUnit}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Personal notification row (both roles) ─────────────────────────
  const NotifRow = ({ alertKey, icon: Icon, color, titleFr, titleEn }: { alertKey: AlertKey; icon: any; color: string; titleFr: string; titleEn: string }) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${notifPrefs[alertKey] ? 'border-border bg-secondary/20' : 'border-border/30 bg-card/30 opacity-55'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="flex-1 text-sm font-medium">{isFr ? titleFr : titleEn}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {notifPrefs[alertKey] ? (isFr ? 'Notifié' : 'Notified') : (isFr ? 'Silencieux' : 'Muted')}
        </span>
        <Switch
          checked={notifPrefs[alertKey]}
          onCheckedChange={v => setNotifPrefs(prev => ({ ...prev, [alertKey]: v }))}
        />
      </div>
    </div>
  );

  // ── Email notification row (operator pro) ─────────────────────────
  const EmailRow = ({ alertKey, icon: Icon, color, titleFr, titleEn, isPro }: { alertKey: AlertKey; icon: any; color: string; titleFr: string; titleEn: string; isPro: boolean }) => (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${emailPrefs[alertKey] ? 'border-border bg-secondary/20' : 'border-border/30 bg-card/30 opacity-55'} ${!isPro && 'opacity-40 cursor-not-allowed grayscale'}`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="flex-1 text-sm font-medium">{isFr ? titleFr : titleEn}</p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {emailPrefs[alertKey] ? 'OUI' : 'NON'}
        </span>
        <Switch
          checked={emailPrefs[alertKey] && isPro}
          disabled={!isPro || !emailEnabled}
          onCheckedChange={v => setEmailPrefs(prev => ({ ...prev, [alertKey]: v }))}
        />
      </div>
    </div>
  );

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">

        {/* ── Header ──────────────────────────────────────────────── */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              {isFr ? 'Paramètres' : 'Settings'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isAdmin
                ? (isFr ? 'Administration de la plateforme AynTrace' : 'AynTrace platform administration')
                : (isFr ? 'Préférences de votre compte et de votre entreprise' : 'Account and enterprise preferences')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              {isFr ? 'Réinit.' : 'Reset'}
            </Button>
            <Button variant="hero" size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />
              {isSaving ? (isFr ? 'Enregistrement...' : 'Saving...') : (isFr ? 'Enregistrer' : 'Save')}
            </Button>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-6 bg-secondary/10">
          <div className="max-w-4xl mx-auto space-y-8 pb-12">

            {/* ══ 1. Appearance & Language ════════════════════════════ */}
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" />
                {isFr ? 'Apparence & Langue' : 'Appearance & Language'}
              </h2>
              <Card className="glass-card border-0">
                <CardContent className="p-4 space-y-3">
                  {/* Language */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-3">
                      <Languages className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-semibold">{isFr ? 'Langue' : 'Language'}</p>
                        <p className="text-xs text-muted-foreground">{isFr ? 'Langue de l\'interface' : 'Interface language'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => setLang('fr')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'fr' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                        🇫🇷 FR
                      </button>
                      <button onClick={() => setLang('en')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                        🇬🇧 EN
                      </button>
                    </div>
                  </div>

                  {/* Theme */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-3">
                      {theme === 'dark' ? <Moon className="w-4 h-4 text-primary" /> : <Sun className="w-4 h-4 text-yellow-500" />}
                      <div>
                        <p className="text-sm font-semibold">{isFr ? 'Thème' : 'Theme'}</p>
                        <p className="text-xs text-muted-foreground">
                          {theme === 'dark' ? (isFr ? 'Mode sombre activé' : 'Dark mode active') : (isFr ? 'Mode clair activé' : 'Light mode active')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => { if (theme !== 'light') toggleTheme(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${theme === 'light' ? 'bg-yellow-500 text-black' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                        <Sun className="w-3 h-3" /> {isFr ? 'Clair' : 'Light'}
                      </button>
                      <button onClick={() => { if (theme !== 'dark') toggleTheme(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${theme === 'dark' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}>
                        <Moon className="w-3 h-3" /> {isFr ? 'Sombre' : 'Dark'}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* ══ 2. Operator-only: Enterprise Alert Detection Rules ══ */}
            {user?.role === 'operator' && (
              <section>
                <SectionHeader
                  icon={ToggleLeft}
                  title={isFr ? 'Détection des alertes' : 'Alert Detection Rules'}
                  desc={isFr
                    ? 'Configurez les seuils de détection — seuls les appareils de votre entreprise sont concernés.'
                    : 'Configure detection thresholds — only your enterprise devices are affected.'}
                  allOn={allAlertOn}
                  onToggleAll={toggleAllAlerts}
                  badge={
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      {isFr ? 'Votre entreprise' : 'Your enterprise'}
                    </Badge>
                  }
                />
                <div className="space-y-3">
                  {ALERT_TYPES.map(({ key: alertKey, ...rest }) => (
                    <AlertRow key={alertKey} {...rest} alertKey={alertKey} />
                  ))}
                </div>
              </section>
            )}

            {/* ══ 3. Personal Notifications — both roles ══════════════ */}
            <section>
              <SectionHeader
                icon={Bell}
                title={isFr ? 'Notifications personnelles' : 'Personal Notifications'}
                desc={isFr
                  ? 'Choisissez quels types d\'alertes vous envoient une notification. Les alertes restent enregistrées pour les autres utilisateurs.'
                  : 'Choose which alert types notify you. Alerts are still recorded in the database for all users.'}
                allOn={allNotifOn}
                onToggleAll={toggleAllNotif}
                badge={isAdmin
                  ? <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20">Admin</Badge>
                  : undefined}
              />
              <Card className="glass-card border-0">
                <CardContent className="p-4 space-y-2">
                  {ALERT_TYPES.map(at => (
                    <NotifRow key={at.key} alertKey={at.key} icon={at.icon} color={at.color} titleFr={at.titleFr} titleEn={at.titleEn} />
                  ))}
                </CardContent>
              </Card>
            </section>

            {/* ══ Email Notifications (Operator Pro) ══════════════ */}
            {user?.role === 'operator' && (
            <section>
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" />
                    {isFr ? 'Notifications par E-mail' : 'Email Notifications'}
                    {user?.plan === 'starter' && (
                        <Badge variant="destructive" className="text-[10px] px-2 py-0.5 ml-2 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> PRO Option
                        </Badge>
                    )}
                  </h2>
                  <div className="flex items-center gap-2 bg-secondary/40 border border-border/50 rounded-full px-3 py-1">
                    <Switch 
                       checked={emailEnabled} 
                       disabled={user?.plan === 'starter'}
                       onCheckedChange={v => setEmailEnabled(v)} 
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {isFr
                    ? 'Recevez un e-mail à chaque déclenchement d\'alerte. Réservé aux abonnements Pro/Enterprise.'
                    : 'Receive an email on each triggered alert. Restricted to Pro/Enterprise plans.'}
                </p>
                {user?.plan === 'starter' && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
                       {isFr ? "Option bloquée. Veuillez passer au forfait PRO pour activer les alertes e-mail." : "Option blocked. Please upgrade to PRO plan to active email alerts."}
                    </div>
                )}
              </div>
              <Card className="glass-card border-0">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-end mb-2">
                     <span className="text-[10px] uppercase font-bold text-muted-foreground mr-2 cursor-pointer hover:text-primary transition-colors" onClick={() => user?.plan !== 'starter' && toggleAllEmail(!allEmailOn)}>
                       {allEmailOn ? (isFr ? 'Tout décocher' : 'Uncheck all') : (isFr ? 'Tout cocher' : 'Check all')}
                     </span>
                  </div>
                  {ALERT_TYPES.map(at => (
                    <EmailRow key={at.key} alertKey={at.key} icon={at.icon} color={at.color} titleFr={at.titleFr} titleEn={at.titleEn} isPro={user?.plan !== 'starter'} />
                  ))}
                </CardContent>
              </Card>
            </section>
            )}

            {/* ══ 4. Admin-only: Platform Config + Security ═══════════ */}
            {isAdmin && (
              <>
                <Separator />

                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" />
                    {isFr ? 'Configuration plateforme' : 'Platform Configuration'}
                    <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20">Admin</Badge>
                  </h2>
                  <Card className="glass-card border-0">
                    <CardContent className="p-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{isFr ? 'Rafraîchissement' : 'Refresh interval'}</p>
                            <p className="text-xs text-muted-foreground">{isFr ? 'Fréquence de mise à jour' : 'Update frequency'}</p>
                          </div>
                          <Input type="number" value={systemSettings.refreshInterval}
                            onChange={e => updateSystem('refreshInterval', parseInt(e.target.value))}
                            className="w-16 text-center h-8 text-sm bg-background"
                          />
                          <span className="text-xs text-muted-foreground">s</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30">
                          <Database className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{isFr ? 'Rétention données' : 'Data retention'}</p>
                            <p className="text-xs text-muted-foreground">{isFr ? 'Durée de conservation' : 'Storage duration'}</p>
                          </div>
                          <Input type="number" value={systemSettings.retentionDays}
                            onChange={e => updateSystem('retentionDays', parseInt(e.target.value))}
                            className="w-16 text-center h-8 text-sm bg-background"
                          />
                          <span className="text-xs text-muted-foreground">{isFr ? 'j' : 'd'}</span>
                        </div>
                      </div>
                      <div className="rounded-xl bg-secondary/20 p-3 border border-border/50">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">
                          {isFr ? 'Infos système' : 'System Info'}
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? 'Plateforme' : 'Platform'}</span><span className="font-medium">AynTrace Tunisie</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? 'Fuseau' : 'Timezone'}</span><span className="font-medium">Africa/Tunis (UTC+1)</span></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>

                <section>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5" />
                    {isFr ? 'Sécurité & Accès' : 'Security & Access'}
                    <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-primary/20">Admin</Badge>
                  </h2>
                  <Card className="glass-card border-0">
                    <CardContent className="p-4 space-y-3">
                      {[
                        { key: 'security2fa',     icon: Shield,   titleFr: 'Authentification 2FA',  titleEn: 'Two-factor Auth (2FA)',  descFr: 'Exiger 2FA pour tous les utilisateurs', descEn: 'Require 2FA for all users' },
                        { key: 'securityAudit',   icon: Database, titleFr: 'Journal d\'activité',   titleEn: 'Activity Audit Log',     descFr: 'Enregistrer toutes les actions',        descEn: 'Record all user actions' },
                        { key: 'securityTimeout', icon: Clock,    titleFr: 'Expiration de session', titleEn: 'Session Timeout',        descFr: 'Déconnexion auto après inactivité',     descEn: 'Auto logout after inactivity' },
                      ].map(({ key, icon: Icon, titleFr, titleEn, descFr, descEn }) => (
                        <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30">
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-semibold">{isFr ? titleFr : titleEn}</p>
                              <p className="text-xs text-muted-foreground">{isFr ? descFr : descEn}</p>
                            </div>
                          </div>
                          <Switch
                            checked={(systemSettings as any)[key]}
                            onCheckedChange={v => updateSystem(key as any, v)}
                          />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </section>
              </>
            )}

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
