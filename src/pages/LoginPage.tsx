import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2, ArrowLeft, MapPin, Satellite, Car, Dog, Baby, Wifi, Bike, Shield, Navigation, User, Package } from 'lucide-react';
import EmailVerificationModal from '@/components/modals/EmailVerificationModal';
import { useI18n } from '@/lib/i18n';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [modalMode, setModalMode] = useState<'setup' | 'reset'>('setup');
  const [pendingEmail, setPendingEmail] = useState('');
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [view, setView] = useState<'login' | 'forgot_password'>('login');
  const [forgotEmail, setForgotPasswordEmail] = useState('');
  const [lockTimeLeft, setLockTimeLeft] = useState<number>(0);
  const { login, completeVerification, isAuthenticated } = useAuthStore();
  const { t } = useI18n();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const checkLock = () => {
      const lockUntil = localStorage.getItem('login_lock_until');
      if (lockUntil) {
        const remaining = parseInt(lockUntil, 10) - Date.now();
        if (remaining > 0) {
          setLockTimeLeft(Math.ceil(remaining / 1000));
        } else {
          localStorage.removeItem('login_lock_until');
          localStorage.removeItem('login_attempts');
          setLockTimeLeft(0);
        }
      }
    };

    checkLock();
    const interval = setInterval(() => {
      const lockUntil = localStorage.getItem('login_lock_until');
      if (lockUntil) {
        const remaining = parseInt(lockUntil, 10) - Date.now();
        if (remaining > 0) {
          setLockTimeLeft(Math.ceil(remaining / 1000));
        } else {
          localStorage.removeItem('login_lock_until');
          localStorage.removeItem('login_attempts');
          setLockTimeLeft(0);
          clearInterval(interval);
        }
      } else {
        setLockTimeLeft(0);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockTimeLeft > 0) return;
    setIsLoading(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        localStorage.removeItem('login_attempts');
        localStorage.removeItem('login_lock_until');

        if (result.needsVerification) {
          setPendingEmail(result.email || email);
          setNeedsPasswordSetup(!!result.needsPasswordSetup);
          setEmailVerified(!!result.emailVerified);
          setModalMode('setup');
          setShowVerificationModal(true);

          if (result.needsVerification && !result.emailVerified) {
            toast.info(t('login.verifyRequired'), {
              description: t('login.verifySent')
            });
          } else if (result.needsPasswordSetup) {
            toast.info(t('login.setupRequired'), {
              description: t('login.setupTempPassword')
            });
          }
        } else {
          toast.success(t('login.success'));
          navigate('/dashboard');
        }
      } else {
        const attempts = parseInt(localStorage.getItem('login_attempts') || '0', 10) + 1;
        localStorage.setItem('login_attempts', attempts.toString());
        if (attempts >= 5) {
          const lockUntil = Date.now() + 5 * 60 * 1000;
          localStorage.setItem('login_lock_until', lockUntil.toString());
          setLockTimeLeft(300);
          toast.error("Trop de tentatives de connexion. Votre compte a été verrouillé pour 5 minutes.");
        } else {
          toast.error(t('login.invalidCredentials'));
        }
      }
    } catch (error) {
      toast.error(t('login.genericError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationComplete = () => {
    setShowVerificationModal(false);
    // Require the user to sign in with their new credentials
    // (both initial setup and reset should return to the login view)
    setView('login');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setIsLoading(true);
    try {
      await authApi.forgotPassword({ email: forgotEmail });
      setPendingEmail(forgotEmail);
      setModalMode('reset');
      setEmailVerified(false);
      setShowVerificationModal(true);
      toast.success(t('login.codeSent'), {
        description: `${t('login.checkInbox')} ${forgotEmail}`
      });
    } catch (error: any) {
      toast.error(t('login.errorTitle'), { description: error.message || t('login.emailNotFound') });
    } finally {
      setIsLoading(false);
    }
  };

  const useCases = [
    { icon: Car, label: t('login.badgeVehicles') },
    { icon: User, label: t('login.badgePeople') },
    { icon: Dog, label: t('login.badgePets') },
    { icon: Baby, label: t('login.badgeChildren') },
    { icon: Package, label: t('login.badgeAssets') },
  ];

  return (
    <div className="min-h-screen flex relative">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#0B1829] to-[#0F1D2E] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[
            { Icon: MapPin, size: 28, x: '10%', y: '15%', delay: '0s', dur: '7s', op: 0.15 },
            { Icon: Satellite, size: 22, x: '80%', y: '10%', delay: '1.2s', dur: '9s', op: 0.12 },
            { Icon: Car, size: 24, x: '75%', y: '40%', delay: '0.5s', dur: '6s', op: 0.10 },
            { Icon: Dog, size: 18, x: '15%', y: '50%', delay: '2s', dur: '8s', op: 0.13 },
            { Icon: Baby, size: 16, x: '85%', y: '65%', delay: '3s', dur: '7.5s', op: 0.10 },
            { Icon: Shield, size: 20, x: '25%', y: '75%', delay: '1.5s', dur: '6.5s', op: 0.12 },
            { Icon: Navigation, size: 18, x: '60%', y: '25%', delay: '4s', dur: '8.5s', op: 0.10 },
            { Icon: Wifi, size: 22, x: '40%', y: '85%', delay: '0.8s', dur: '7s', op: 0.13 },
            { Icon: Bike, size: 20, x: '90%', y: '85%', delay: '2.5s', dur: '9s', op: 0.10 },
          ].map((item, i) => (
            <div key={i} className="absolute text-[#039C51] drop-shadow-[0_0_10px_rgba(3,156,81,0.3)]" style={{ left: item.x, top: item.y, opacity: item.op * 2, animation: `geoFloat${i % 4} ${item.dur} ease-in-out ${item.delay} infinite` }}>
              <item.Icon size={item.size} />
            </div>
          ))}
        </div>

        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-10" />

        <Link to="/" className="relative z-10 block group hover:opacity-90 transition-all mb-8">
          <div className="flex items-center gap-5">
            <img
              src="/Dark.svg"
              alt="AynTrace"
              className="w-32 h-32 object-contain brightness-[1.1] contrast-[1.14] drop-shadow-[0_10px_25px_rgba(3,156,81,0.4)] group-hover:drop-shadow-[0_0_35px_rgba(3,156,81,0.6)] transition-all duration-500 hover:scale-105"
            />
            <div className="flex flex-col">
              <span className="text-5xl font-black text-white tracking-tighter leading-none mb-1">
                <span>Ayn</span><span className="text-[#039C51]">Trace</span>
              </span>
              <span className="text-sm font-bold text-[#039C51]/80 tracking-[0.15em] ml-1 mt-1">{t('brand.sloganLead')} {t('brand.sloganTail')}</span>
            </div>
          </div>
        </Link>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            {t('login.heroTitleLine1')}<br />
            {t('login.heroTitleLine2')}<br />
            <span className="text-[#039C51]">{t('login.heroTitleLine3')}</span>
          </h1>
          <p className="text-white/70 text-lg max-w-md">
            {t('login.heroSubtitle')}
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            {useCases.map((item, i) => (
              <span key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-white/70">
                <item.icon className="w-4 h-4 text-[#039C51]" />
                {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-8">
          <div>
            <p className="text-3xl font-bold text-white">500+</p>
            <p className="text-white/50 text-sm">{t('login.statsDevices')}</p>
          </div>
          <div className="w-px h-12 bg-white/20" />
          <div>
            <p className="text-3xl font-bold text-white">50+</p>
            <p className="text-white/50 text-sm">{t('login.statsCompanies')}</p>
          </div>
          <div className="w-px h-12 bg-white/20" />
          <div>
            <p className="text-3xl font-bold text-white">99.9%</p>
            <p className="text-white/50 text-sm">{t('login.statsUptime')}</p>
          </div>
        </div>

        <style>{`
          @keyframes geoFloat0 { 0%, 100% { transform: translateY(0px) rotate(0deg); } 25% { transform: translateY(-18px) rotate(5deg); } 50% { transform: translateY(-8px) rotate(-3deg); } 75% { transform: translateY(-22px) rotate(7deg); } }
          @keyframes geoFloat1 { 0%, 100% { transform: translateY(0px) translateX(0px); } 33% { transform: translateY(-14px) translateX(8px); } 66% { transform: translateY(-24px) translateX(-6px); } }
          @keyframes geoFloat2 { 0%, 100% { transform: translateY(0px) scale(1); } 25% { transform: translateY(-16px) scale(1.15); } 50% { transform: translateY(-6px) scale(0.9); } 75% { transform: translateY(-20px) scale(1.08); } }
          @keyframes geoFloat3 { 0%, 100% { transform: translateY(0) translateX(0) rotate(0deg); } 20% { transform: translateY(-12px) translateX(-10px) rotate(-8deg); } 40% { transform: translateY(-20px) translateX(5px) rotate(4deg); } 60% { transform: translateY(-8px) translateX(12px) rotate(-3deg); } 80% { transform: translateY(-16px) translateX(-6px) rotate(6deg); } }
        `}</style>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="text-center lg:text-left relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -left-2 lg:-left-12 lg:-top-2 lg:flex text-muted-foreground hover:text-foreground hidden"
              onClick={() => {
                if (view === 'forgot_password') { setView('login'); return; }
                navigate('/');
              }}
              title={t('login.back')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="lg:hidden flex items-center justify-between mb-6">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground -ml-2"
                onClick={() => {
                  if (view === 'forgot_password') { setView('login'); return; }
                  navigate('/');
                }}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0D1117] border border-[#039C51]/30 flex items-center justify-center overflow-hidden">
                  <img src="/Dark.svg" alt="AynTrace" className="w-[40px] h-[40px] object-contain scale-[1.4]" />
                </div>
                <span className="text-xl font-bold"><span>Ayn</span><span className="text-[#039C51]">Trace</span></span>
              </div>

              <div className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-bold text-foreground">
              {view === 'login' ? t('login.signInTitle') : t('login.forgotTitle')}
            </h2>
            <p className="text-muted-foreground mt-2">
              {view === 'login' ? t('login.signInSubtitle') : t('login.forgotSubtitle')}
            </p>
          </div>

          {view === 'login' ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              {lockTimeLeft > 0 && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Shield className="w-4 h-4 text-destructive animate-pulse" />
                    <span>Compte temporairement verrouillé</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Trop de tentatives infructueuses. Veuillez patienter{' '}
                    <strong className="text-destructive font-mono">
                      {Math.floor(lockTimeLeft / 60)}:
                      {String(lockTimeLeft % 60).padStart(2, '0')}
                    </strong>{' '}
                    avant de réessayer.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  required
                  disabled={lockTimeLeft > 0}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('login.passwordLabel')}</Label>
                  <button type="button" onClick={() => setView('forgot_password')} className="text-xs text-primary hover:underline font-medium" disabled={lockTimeLeft > 0}>{t('auth.forgotPassword')}</button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('login.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 pr-12"
                    required
                    disabled={lockTimeLeft > 0}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={lockTimeLeft > 0}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading || lockTimeLeft > 0}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('login.signingIn')}
                  </>
                ) : (
                  t('login.signInButton')
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">{t('login.savedEmail')}</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="votre@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  className="h-12"
                  required
                />
              </div>

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t('login.sending')}
                  </>
                ) : (
                  t('login.sendCode')
                )}
              </Button>
            </form>
          )}
        </div>
      </div>

      <EmailVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        email={pendingEmail}
        onVerified={handleVerificationComplete}
        initialStep={emailVerified ? 'password' : 'verify'}
        mode={modalMode}
        autoSendCode={modalMode === 'setup'}
      />
    </div>
  );
};

export default LoginPage;
