import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Shield, Truck, Building2, ChevronRight, Zap, Globe, Lock, Phone, Mail, MapPinned, CheckCircle2, Cpu, Battery, Signal, Clock, Play, BookOpen, Loader2, Star, Plus, Minus, Check, Satellite, Navigation, Wifi, Car, Dog, Briefcase, Baby, Watch, Bike, Smartphone, User, Package, HelpCircle, Bot, ArrowRight } from 'lucide-react';
import FloatingIcons from '@/components/FloatingIcons';
import PublicNavbar from '@/components/layout/PublicNavbar';
import PublicFooter from '@/components/layout/PublicFooter';
import JoinPopup from '@/components/JoinPopup';
import DemoModal from '@/components/modals/DemoModal';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { pricingApi, statsApi } from '@/lib/api';
import { useTheme } from '@/lib/theme';

const productDetails = {
  'Traceurs Véhicules': {
    title: 'Traceurs Véhicules',
    badge: 'Standard',
    tagline: 'Alimentation continue pour flotte de transport',
    desc: 'Ce traceur est conçu pour un suivi permanent des véhicules professionnels sans jamais se soucier de la recharge. Branché directement sur l’alimentation électrique du véhicule ou via un adaptateur OBD, il assure une autonomie infinie.',
    specs: [
      { name: 'Alimentation', value: '12V - 36V DC branché en continu (OBD ou câble direct)' },
      { name: 'Autonomie', value: 'Illimitée (sur batterie du véhicule)' },
      { name: 'Réseau', value: '4G LTE / 2G GSM avec antenne interne à gain élevé' },
      { name: 'Fixation', value: 'Sous le tableau de bord ou port OBD-II' },
      { name: 'Étanchéité', value: 'IP54 (protection contre la poussière et les éclaboussures)' },
      { name: 'Fonctions Clés', value: 'Coupure moteur à distance, diagnostic de tension batterie, alertes d’allumage/remorquage.' }
    ],
    usages: ['Voitures de fonction', 'Camions & Logistique', 'Taxis & Loueurs de véhicules', 'Engins de Chantier']
  },
  'Traceurs Autonomes': {
    title: 'Traceurs Autonomes',
    badge: 'Best Seller',
    tagline: 'Fixation magnétique instantanée sans branchement',
    desc: 'Équipé d’aimants industriels ultra-puissants, ce traceur se fixe instantanément sur toute surface métallique (ferreuse). Étanche à l’eau et doté d’une autonomie record, il est parfait pour le suivi furtif et longue durée de conteneurs ou de véhicules.',
    specs: [
      { name: 'Alimentation', value: 'Batterie rechargeable interne Lithium-ion 10,000 mAh' },
      { name: 'Autonomie', value: 'Jusqu’à 30 jours (suivi en mouvement) ou 5 ans (veille)' },
      { name: 'Réseau', value: '4G LTE-M / NB-IoT / 2G' },
      { name: 'Fixation', value: 'Aimants néodyme industriels intégrés ultra-forts' },
      { name: 'Étanchéité', value: 'IP67 (100% étanche à l’eau, à la boue et à la poussière)' },
      { name: 'Fonctions Clés', value: 'Détecteur de décrochage (anti-sabotage), historique des trajets, alerte de batterie faible.' }
    ],
    usages: ['Châssis de véhicules', 'Remorques & Semi-remorques', 'Conteneurs maritimes', 'Marchandises de grande valeur']
  },
  'Traceurs Personnels': {
    title: 'Traceurs Personnels',
    badge: 'Sécurité',
    tagline: 'Protection ultra-légère pour les personnes et animaux',
    desc: 'Un traceur de taille ultra-réduite et très léger, facile à glisser dans une poche, un sac, ou à fixer sur un collier d’animal domestique. Il intègre un bouton d’alarme SOS d’urgence pour envoyer immédiatement sa position précise.',
    specs: [
      { name: 'Alimentation', value: 'Batterie interne rechargeable via micro-USB / magnétique' },
      { name: 'Autonomie', value: '3 à 7 jours selon l’intervalle de suivi' },
      { name: 'Réseau', value: 'GPS / WiFi / LBS / 2G' },
      { name: 'Fixation', value: 'Porte-clés, tour de cou, poche ou collier spécial animaux' },
      { name: 'Étanchéité', value: 'IP65 (résistant à la pluie et aux projections d’eau)' },
      { name: 'Fonctions Clés', value: 'Bouton d’urgence SOS, appel de sécurité, capteur de chute automatique.' }
    ],
    usages: ['Sécurité des enfants', 'Protection des seniors', 'Travailleurs isolés (DATI)', 'Animaux de compagnie (chiens, chats)']
  }
};

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [joinOpen, setJoinOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const { t } = useI18n();
  const { theme } = useTheme();
  const [prices, setPrices] = useState({ starter: 29, pro: 39 });
  const [publicStats, setPublicStats] = useState({ devices: 500, enterprises: 50, governorates: 24 });

  useEffect(() => {
    pricingApi.getAll().then(data => {
      setPrices({
        starter: data.config.starter_monthly || 29,
        pro: data.config.pro_monthly || 39,
      });
    }).catch(() => { });

    statsApi.getPublic().then(data => {
      setPublicStats({
        devices: data.devices > 0 ? data.devices : 500,
        enterprises: data.enterprises > 0 ? data.enterprises : 50,
        governorates: data.governorates || 24
      });
    }).catch(() => { });
  }, []);

  useEffect(() => {
    if (location.pathname === '/join') {
      setJoinOpen(true);
    } else if (location.pathname === '/demo') {
      setDemoOpen(true);
    }
  }, [location.pathname]);

  // Theme-aware helper classes
  const isDark = theme === 'dark';
  const logoSrc = isDark ? '/Dark.svg' : '/Light.svg';

  // Ultra-Premium Creative Glassmorphism & 3D Interactive Cards
  const cardBg = isDark
    ? 'bg-[#0F1D2E]/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_20px_50px_rgba(3,156,81,0.15)] hover:bg-[#142438]/80 hover:-translate-y-2 hover:border-[#039C51]/30 transition-all duration-500 relative overflow-hidden group'
    : 'bg-white/40 backdrop-blur-2xl border-[1.5px] border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:bg-white/70 hover:shadow-[0_20px_40px_rgba(3,156,81,0.15)] hover:-translate-y-2 transition-all duration-500 ring-1 ring-white/50 relative overflow-hidden group';

  const cardBgAlt = isDark
    ? 'bg-gradient-to-br from-[#142438]/90 to-[#0F1D2E]/90 backdrop-blur-2xl border border-[#039C51]/40 shadow-[0_20px_50px_rgba(3,156,81,0.2)] hover:shadow-[0_30px_60px_rgba(3,156,81,0.3)] hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group'
    : 'bg-gradient-to-br from-white/90 via-white/70 to-emerald-50/50 backdrop-blur-3xl border-[2px] border-white shadow-[0_20px_50px_rgba(3,156,81,0.12)] ring-2 ring-[#039C51]/20 hover:ring-[#039C51]/40 hover:shadow-[0_30px_60px_rgba(3,156,81,0.25)] hover:-translate-y-2 transition-all duration-500 relative overflow-hidden group';

  const subtitleColor = isDark ? 'text-white/50' : 'text-[#142945]/60 font-medium';
  const bodyColor = isDark ? 'text-white/60' : 'text-[#142945]/70';
  const bodyColorLight = isDark ? 'text-white/70' : 'text-[#142945]/75';
  const bodyColorMed = isDark ? 'text-white/80' : 'text-[#142945]/85';
  const bodyColorStrong = isDark ? 'text-white/90' : 'text-[#142945]';
  const mutedColor = isDark ? 'text-white/40' : 'text-[#142945]/40';
  const borderColor = isDark ? 'border-white/5' : 'border-white/60';
  const innerBg = isDark ? 'bg-white/5' : 'bg-white/60 shadow-inner';
  const footerBg = isDark ? '' : 'bg-white/40 backdrop-blur-xl border-t border-white';
  const sectionClass = 'py-20 sm:py-28 px-4 sm:px-6 relative';
  const sectionHeaderClass = 'text-center mb-12 sm:mb-16';
  const cardRadius = 'rounded-[2rem]';

  const handleDemoLogin = async () => {
    setDemoOpen(true);
  };
  const faqs = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') }
  ];

  return (
    <div className={`min-h-screen font-sans selection:bg-[#039C51]/30 relative transition-colors duration-500 overflow-hidden ${isDark ? 'bg-[#0B1829] text-white' : 'bg-slate-50 text-[#142945]'}`}>

      {/* Animated Background Layers & Map - Vibrant Watercolor mesh in light mode */}
      <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${isDark ? '' : 'bg-slate-100/50'}`}>
        {/* Tunisia Map Background */}
        <div className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${isDark ? 'opacity-10 mix-blend-luminosity' : 'opacity-10 mix-blend-multiply grayscale-[50%]'}`} style={{ backgroundImage: "url('/images/tunisia_map_bg.png')" }} />

        {/* Abstract Blobs / Ethereal Orbs */}
        <div className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full filter blur-[100px] animate-blob ${isDark ? 'mix-blend-multiply opacity-60 bg-[#039C51]/10' : 'mix-blend-screen opacity-100 bg-[#039C51]/20'}`} />
        <div className={`absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full filter blur-[100px] animate-blob animation-delay-2000 ${isDark ? 'mix-blend-multiply opacity-60 bg-blue-500/10' : 'mix-blend-multiply opacity-40 bg-[#3b82f6]/20'}`} />
        <div className={`absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full filter blur-[120px] animate-blob animation-delay-4000 ${isDark ? 'mix-blend-multiply opacity-60 bg-purple-500/10' : 'mix-blend-multiply opacity-40 bg-[#a855f7]/15'}`} />

        {/* Grid pattern for light mode only for tech feel */}
        {!isDark && (
          <div className="absolute inset-0 bg-[radial-gradient(#039C51_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.05]"></div>
        )}
      </div>

      {/* Shared floating icons */}
      <div className="relative z-0">
        <FloatingIcons />
      </div>

      <main className="relative z-10">
        <PublicNavbar />

        {/* Hero Section */}
        <section className="pt-24 sm:pt-36 pb-12 sm:pb-20 px-4 sm:px-6 relative flex flex-col justify-center items-center text-center">
          <div className="container mx-auto relative z-10 max-w-4xl space-y-6 sm:space-y-8">
            <div className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full border ${isDark ? 'border-[#039C51]/20 bg-[#039C51]/10 shadow-[0_0_15px_rgba(3,156,81,0.1)]' : 'border-[#039C51]/30 bg-white/80 backdrop-blur-md shadow-lg'} text-[#039C51] text-sm font-bold mb-4`}>
              <Zap className="w-4 h-4" />
              {t('hero.badge')}
            </div>

            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-tight tracking-tight drop-shadow-sm">
              {t('hero.title1')}<br />
              <span className="text-[#039C51] relative">
                {t('hero.title2')}
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 8" fill="none"><path d="M2 6 C50 2 150 2 198 6" stroke="#039C51" strokeWidth="4" strokeLinecap="round" opacity="0.3" /></svg>
              </span>
            </h1>

            <p className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed font-medium ${isDark ? 'text-white/70' : 'text-[#142945]/70'}`}>
              {t('hero.subtitle')}
            </p>

            {/* Use-case emoji badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 pt-2">
              {[
                { icon: Car, label: 'Véhicules' },
                { icon: User, label: 'Personnes' },
                { icon: Package, label: 'Objets' },
                { icon: Bike, label: 'Motos' },
                { icon: Truck, label: 'Camions' },
                { icon: Dog, label: 'Animaux' },
                { icon: Zap, label: 'Mobilité' },
              ].map((item, i) => (
                <div key={i} className={`flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 ${isDark ? 'bg-white/5 border-white/10 text-white/70 hover:border-[#039C51]/30' : 'bg-white/60 backdrop-blur-md border border-white text-[#142945] shadow-sm hover:border-[#039C51]/40 hover:bg-white'} rounded-full text-xs sm:text-sm font-semibold hover:text-[#039C51] hover:-translate-y-1 transition-all cursor-default relative overflow-hidden group`} style={{ animation: `homeFloat${i % 4} 8s ease-in-out ${i * 0.3}s infinite` }}>
                  {!isDark && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />}
                  <item.icon className="w-5 h-5 text-[#039C51] relative z-10" />
                  <span className="relative z-10">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
              <button
                className="flex items-center justify-center bg-[#039C51] text-white hover:bg-[#039C51]/90 font-bold rounded-full px-6 sm:px-8 h-12 sm:h-14 text-sm sm:text-base shadow-[0_0_30px_rgba(3,156,81,0.3)] hover:shadow-[0_0_40px_rgba(3,156,81,0.5)] transition-all focus:outline-none focus:ring-2 focus:ring-[#039C51]/50 w-full sm:w-auto"
                onClick={() => setJoinOpen(true)}
              >
                {t('hero.joinBtn')}
              </button>
              <button
                className={`flex items-center justify-center font-bold rounded-full px-6 sm:px-8 h-12 sm:h-14 text-sm sm:text-base gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#039C51]/50 border w-full sm:w-auto ${isDark ? 'border-white/20 text-white hover:bg-white/5 hover:border-white/30' : 'border-gray-900 text-gray-800 hover:bg-gray-200 hover:shadow-md hover:border-gray-300'}`}
                onClick={handleDemoLogin}
              >
                <Play className="w-5 h-5 fill-current" />
                {t('hero.demoBtn')}
              </button>
            </div>
          </div>
        </section>

        {/* Nos Produits */}
        <section id="produits" className={`${sectionClass} overflow-hidden`}>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Solutions de Tracking</h2>
              <p className={`text-base sm:text-lg md:text-xl font-medium max-w-2xl mx-auto ${subtitleColor}`}>Une gamme complète de traceurs intelligents pour chaque scénario d'utilisation.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {[
                {
                  title: 'Traceurs Véhicules',
                  desc: "Conçus exclusivement pour véhicules (voiture, camion...) fonctionnant branchés AVEC ADAPTATEUR pour un suivi continu.",
                  img: '/images/gps_tracker_vehicle.png',
                  badge: 'Standard',
                  isFeatured: false
                },
                {
                  title: 'Traceurs Autonomes',
                  desc: "Modèles magnétiques puissants à fixer sur les voitures ou tout support en fer, étanches (IP67) avec batterie très longue durée.",
                  img: '/images/gps_tracker_autonomous.png',
                  badge: 'Best Seller',
                  isFeatured: true
                },
                {
                  title: 'Traceurs Personnels',
                  desc: "Format mini de poche ou colliers GPS légers, parfaits pour la sécurité des personnes et le suivi des animaux.",
                  img: '/images/gps_tracker_personal.png',
                  badge: 'Sécurité',
                  isFeatured: false
                }
              ].map((product, idx) => (
                <div 
                  key={idx} 
                  className={`${product.isFeatured ? cardBgAlt : cardBg} group h-full p-2 ${cardRadius} transition-all duration-500 flex flex-col`}
                >
                  <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-black/5 shrink-0">
                    <img src={product.img} alt={product.title} loading="lazy" width={400} height={288} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-60" />
                    <div className="absolute top-5 left-5 bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {product.badge}
                    </div>
                  </div>
                  <div className="p-7 pb-8 text-center flex flex-col flex-1">
                    <h3 className={`text-2xl font-black mb-4 ${product.isFeatured && isDark ? 'text-[#039C51]' : (isDark ? 'text-white' : 'text-[#142945]')}`}>
                      {product.title}
                    </h3>
                    <p className={`text-base font-medium leading-relaxed min-h-[96px] ${isDark ? 'text-white/60' : 'text-[#142945]/70'}`}>
                      {product.desc}
                    </p>
                    <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-center">
                      <Button 
                        variant="ghost" 
                        className="font-bold text-[#039C51] hover:bg-[#039C51]/10 gap-2 rounded-xl group-hover:px-6 transition-all"
                        onClick={() => {
                          const details = productDetails[product.title as keyof typeof productDetails];
                          setSelectedProduct(details);
                        }}
                      >
                        En savoir plus <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Nos Traceurs GPS */}
        <section id="traceurs" className={sectionClass}>
          <div className="container mx-auto max-w-5xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-3xl md:text-4xl font-extrabold mb-3 ${isDark ? 'text-white' : 'text-[#142945]'}`}><span className="flex items-center justify-center gap-3"><Satellite className="w-8 h-8 text-[#039C51]" />{t('trackers.title')}</span></h2>
              <p className={`text-base font-medium ${subtitleColor}`}>{t('trackers.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Cpu, title: 'Haute précision', desc: 'GPS + GLONASS' },
                { icon: Battery, title: 'Longue autonomie', desc: "Jusqu'à 30 jours" },
                { icon: Signal, title: 'Connectivité', desc: 'SNC/2G/4G' },
                { icon: Shield, title: 'Résistant', desc: 'IP67 étanche' },
              ].map((item, idx) => (
                <div key={idx} className={`${cardBg} ${cardRadius} p-8 text-center min-h-[190px] flex flex-col items-center justify-center`}>
                  <div className="absolute top-0 right-0 w-24 h-24 bg-[#039C51]/10 blur-[30px] rounded-full pointer-events-none text-white" />
                  <div className={`w-16 h-16 mx-auto ${innerBg} rounded-2xl flex items-center justify-center mb-6 text-[#039C51] group-hover:bg-gradient-to-tr group-hover:from-[#039C51] group-hover:to-emerald-300 group-hover:text-white transition-all duration-500 shadow-inner group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(3,156,81,0.4)] relative z-10`}>
                    <item.icon className="w-8 h-8" />
                  </div>
                  <h3 className={`font-bold text-lg mb-2 relative z-10 ${isDark ? 'text-white' : 'text-[#142945]'}`}>{item.title}</h3>
                  <p className={`text-sm font-medium ${mutedColor} relative z-10`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" className={`${sectionClass} ${theme === 'dark' ? 'bg-[#0E111A]/60' : 'bg-white'} border-y ${borderColor}`}>
          <div className="container mx-auto max-w-5xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-3xl md:text-4xl font-extrabold mb-3 ${isDark ? 'text-white' : 'text-[#142945]'}`}><span className="flex items-center justify-center gap-3"><Zap className="w-8 h-8 text-[#039C51]" />{t('how.title')}</span></h2>
              <p className={`text-base font-medium ${subtitleColor}`}>{t('how.subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center relative">
              {/* Connecting line for desktop */}
              <div className={`hidden md:block absolute top-10 left-[12%] right-[12%] h-px ${isDark ? 'bg-white/10' : 'bg-[#039C51]/25'}`} />

              {[
                { step: '1', title: t('how.step1.title'), desc: t('how.step1.desc') },
                { step: '2', title: t('how.step2.title'), desc: t('how.step2.desc') },
                { step: '3', title: t('how.step3.title'), desc: t('how.step3.desc') },
                { step: '4', title: t('how.step4.title'), desc: t('how.step4.desc') },
              ].map((item, idx) => (
                <div key={item.step} className="relative z-10 group min-h-[230px] flex flex-col items-center">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#039C51] to-emerald-500 text-white rounded-3xl flex items-center justify-center font-black text-3xl mb-8 shadow-[0_10px_30px_rgba(3,156,81,0.28)] transition-all duration-300">
                    {item.step}
                  </div>
                  <h3 className="font-extrabold text-xl mb-3 min-h-[28px] flex items-center justify-center">{item.title}</h3>
                  <p className={`text-sm font-medium ${subtitleColor} leading-relaxed px-4 max-w-[230px] min-h-[64px]`}>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fonctionnalités de la plateforme */}
        <section className={`${sectionClass} overflow-hidden`}>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Une plateforme sur-mesure</h2>
              <p className={`text-base sm:text-lg md:text-xl font-medium max-w-2xl mx-auto ${subtitleColor}`}>Tout ce dont vous avez besoin pour piloter votre flotte avec précision.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {[
                { icon: MapPin, title: t('features.realtime'), desc: t('features.realtimeDesc') },
                { icon: Building2, title: t('features.multi'), desc: t('features.multiDesc') },
                { icon: Clock, title: t('features.history'), desc: t('features.historyDesc') },
                { icon: Shield, title: t('features.secure'), desc: t('features.secureDesc') },
                { icon: Globe, title: t('features.coverage'), desc: t('features.coverageDesc') },
                { icon: Lock, title: t('features.data'), desc: t('features.dataDesc') },
              ].map((feature, idx) => (
                <div key={idx} className={`${cardBg} group h-full min-h-[310px] p-6 sm:p-8 ${cardRadius} transition-all duration-500 flex flex-col`}>
                  <div className={`w-16 h-16 ${innerBg} rounded-2xl flex items-center justify-center mb-8 group-hover:bg-[#039C51] transition-all duration-500 group-hover:scale-110 shadow-sm relative z-10 text-white`}>
                    <feature.icon className="w-8 h-8 text-[#039C51] group-hover:text-white transition-colors duration-500" />
                  </div>
                  <h3 className={`font-black text-xl mb-4 ${isDark ? 'text-white' : 'text-[#142945]'}`}>{feature.title}</h3>
                  <p className={`text-base font-medium leading-relaxed ${subtitleColor}`}>{feature.desc}</p>
                </div>
              ))}

              <div className="md:col-span-2 lg:col-span-3 flex justify-center mt-12">
                <Button 
                  className="bg-[#039C51] text-white hover:bg-emerald-500 font-black rounded-2xl px-12 h-16 text-lg shadow-[0_20px_40px_rgba(3,156,81,0.2)] hover:-translate-y-1 transition-all flex items-center gap-2"
                  onClick={() => setJoinOpen(true)}
                >
                  Découvrir toutes les fonctions
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Explorez la plateforme sans inscription (Demo Highlight) */}
        <section className={`py-16 sm:py-24 px-4 sm:px-6 relative ${theme === 'dark' ? 'bg-[#0E111A]/80' : 'bg-white/30 backdrop-blur-3xl'} border-y ${borderColor}`}>
          {/* Light mode specific background decorations for this section */}
          {!isDark && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 w-full h-px bg-gradient-to-r from-transparent via-white to-transparent"></div>
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white to-transparent"></div>
              <div className="absolute -right-40 top-1/2 -translate-y-1/2 w-96 h-96 bg-[#039C51]/10 rounded-full blur-[80px] text-white"></div>
              <div className="absolute -left-40 top-1/2 -translate-y-1/2 w-96 h-96 bg-blue-400/10 rounded-full blur-[80px]"></div>
            </div>
          )}
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="max-w-3xl mx-auto text-center space-y-8">
              <div className="inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-[#039C51]/30 bg-[#039C51]/10 text-[#039C51] text-sm font-bold shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#039C51] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#039C51]"></span>
                </span>
                Mode Démo Live
              </div>
              <h2 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Explorez la plateforme <span className="text-[#039C51]">sans inscription</span>
              </h2>
              <div className={`space-y-4 font-medium text-lg ${bodyColor}`}>
                <p>
                  Plongez directement dans notre interface et découvrez comment AynTrace vous donne le contrôle total sur votre flotte. Aucune carte de crédit, aucun engagement.
                </p>
                <ul className="space-y-4 pt-4 text-left max-w-xl mx-auto">
                  {[
                    "Tableau de bord interactif complet",
                    "Cartographie détaillée avec trafic",
                    "Simulateur de mouvements fictifs",
                    "Recherche des alertes et rapports"
                  ].map((li, i) => (
                    <li key={i} className={`flex items-center gap-4 ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
                      <div className="w-6 h-6 rounded-full bg-[#039C51]/20 flex items-center justify-center shrink-0 text-white">
                        <CheckCircle2 className="w-4 h-4 text-[#039C51]" />
                      </div>
                      <span className="font-semibold">{li}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pt-8">
                <Button
                  className="bg-[#039C51] text-white hover:bg-[#039C51]/90 font-bold rounded-full px-10 h-14 shadow-xl hover:shadow-[0_0_30px_rgba(3,156,81,0.4)] transition-all"
                  onClick={handleDemoLogin}
                >
                  Lancer la simulation interactive
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Tarifs (Nos Formules) */}
        <section id="tarifs" className={`${sectionClass} overflow-hidden ${isDark ? 'bg-transparent' : 'bg-white'}`}>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-4xl md:text-5xl font-black mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Plans & Tarification</h2>
              <p className={`text-lg font-medium max-w-xl mx-auto ${subtitleColor}`}>Simplicité, transparence et performance pour tous les besoins.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {/* Minimalist Cards Approach */}
              {[
                {
                  name: "Starter",
                  price: prices.starter,
                  desc: "L'essentiel du tracking",
                  features: ["Tableau de bord", "Carte temps réel", "Appareils GPS", "Support Email"],
                  color: "#039C51",
                  btn: "Commencer"
                },
                {
                  name: "Pro",
                  price: prices.pro,
                  desc: "Puissance & IA",
                  popular: true,
                  features: ["Tout du Starter", "Assistant IA AynTrace", "Geofencing illimité", "Rapports PDF Auto"],
                  color: "#039C51",
                  btn: "Choisir Pro"
                },
                {
                  name: "Enterprise",
                  price: "Sur devis",
                  desc: "Solutions sur mesure",
                  features: ["Marque blanche", "API Accès complet", "Support Prioritaire 24/7", "Serveur dédié"],
                  color: "#142945",
                  btn: "Bientôt disponible",
                  soon: true
                }
              ].map((plan, i) => (
                <div key={i} className={`relative p-1 ${cardRadius} ${plan.popular ? 'bg-gradient-to-b from-[#039C51] to-transparent' : 'bg-transparent'}`}>
                  <div className={`${cardBg} h-full min-h-[520px] p-8 ${cardRadius} flex flex-col items-center text-center transition-all`}>
                    <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-[#142945]'}`}>{plan.name}</h3>
                    <p className={`text-sm font-bold mb-8 uppercase tracking-tighter ${subtitleColor}`}>{plan.desc}</p>

                    <div className="mb-10">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className={`text-6xl font-black ${plan.popular ? 'text-[#039C51]' : (isDark ? 'text-white' : 'text-[#142945]')}`}>
                          {plan.price}
                        </span>
                        {typeof plan.price === 'number' && (
                          <span className={`text-lg font-bold ${subtitleColor}`}>TND<span className="text-xs">/mois</span></span>
                        )}
                      </div>
                    </div>

                    <div className="w-full space-y-4 mb-12">
                      {plan.features.map((f, j) => (
                        <div key={j} className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#039C51]" />
                          <span className={`text-sm font-bold ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{f}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-auto w-full">
                      <Button
                        disabled={plan.soon}
                        className={`w-full h-14 rounded-2xl font-black text-base transition-all disabled:cursor-not-allowed disabled:opacity-60 ${plan.soon
                          ? (isDark ? 'bg-white/5 border border-white/10 text-white/50' : 'bg-slate-100 text-[#142945]/45')
                          : plan.popular
                          ? 'bg-[#039C51] text-white hover:shadow-[0_10px_30px_rgba(3,156,81,0.4)] hover:-translate-y-1'
                          : `${isDark ? 'bg-white/5 border border-white/10 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-[#142945]'}`
                          }`}
                        onClick={() => !plan.soon && setJoinOpen(true)}
                      >
                        {plan.btn}
                      </Button>
                      {plan.soon && (
                        <p className={`mt-3 text-xs font-bold ${subtitleColor}`}>
                          Ouverture prochaine.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ce que disent nos clients */}
        <section className={`${sectionClass} overflow-hidden ${theme === 'dark' ? 'bg-[#0B121F]' : 'bg-slate-50/50'}`}>
          {/* Creative background elements */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#039C51]/5 blur-[120px] rounded-full pointer-events-none text-white" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none text-white" />

          <div className="container mx-auto max-w-6xl relative z-10">
            <div className={sectionHeaderClass}>
              <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border ${isDark ? 'border-[#039C51]/20 bg-[#039C51]/5' : 'border-[#039C51]/20 bg-white'} text-[#039C51] text-xs font-bold uppercase tracking-widest mb-6`}>
                <Star className="w-3 h-3 fill-current" />
                <span>Témoignages</span>
              </div>
              <h2 className={`text-4xl md:text-5xl font-black mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Ce que disent nos clients</h2>
              <p className={`text-lg font-medium max-w-2xl mx-auto ${subtitleColor}`}>Rejoignez plus de 50 entreprises qui font confiance à AynTrace pour la gestion intelligente de leur flotte.</p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {[
                {
                  author: "Sami Ben Ali",
                  company: "Express Trans",
                  text: "Grâce à AynTrace, nous avons réduit nos coûts de carburant de 15% dès le premier trimestre. L'interface est intuitive et très réactive.",
                  role: "Directeur Logistique",
                  rating: "4.9"
                },
                {
                  author: "Amira Mansour",
                  company: "Mansour Services",
                  text: "La sécurité de nos techniciens est primordiale. Les alertes en temps réel et le geofencing nous permettent de dormir tranquilles.",
                  role: "Gérante",
                  rating: "4.8"
                },
                {
                  author: "Karim Trabelsi",
                  company: "SOTUPER",
                  text: "Le meilleur support technique que j'ai connu en Tunisie. Ils sont toujours disponibles et trouvent des solutions adaptées à nos besoins.",
                  role: "Chef de Parc",
                  rating: "5.0"
                }
              ].map((review, i) => (
                <div key={i} className={`${cardBg} h-full min-h-[360px] p-8 ${cardRadius} flex flex-col justify-between group transition-all duration-500 relative`}>
                  <div className="relative z-10">
                    <div className="mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-[#039C51]/10 flex items-center justify-center mb-6 text-white">
                        <span className="text-3xl text-[#039C51] opacity-50">"</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100 shadow-sm'}`}>
                          <Star className="w-4 h-4 text-[#039C51] fill-[#039C51]" />
                          <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-[#142945]'}`}>{review.rating}/5</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#039C51]">Avis vérifié</span>
                      </div>
                    </div>
                    <p className={`text-base ${bodyColorStrong} leading-relaxed font-semibold mb-10`}>
                      {review.text}
                    </p>
                  </div>
                  <div className="pt-6 border-t border-[#039C51]/10">
                    <div>
                      <p className={`font-black text-base ${isDark ? 'text-white' : 'text-[#142945]'}`}>{review.author}</p>
                      <p className="text-xs font-bold text-[#039C51] uppercase tracking-wider">{review.company} • {review.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Ribbon */}
        <section className={`py-14 sm:py-16 px-4 sm:px-6 ${borderColor} border-b ${isDark ? 'bg-[#039C51]/5' : 'bg-white/40 backdrop-blur-xl relative overflow-hidden'}`}>
          {!isDark && <div className="absolute inset-0 bg-gradient-to-r from-[#039C51]/[0.03] via-transparent to-[#039C51]/[0.03] text-white"></div>}
          <div className="container mx-auto max-w-5xl text-center">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
              {[
                { value: `${publicStats.devices}+`, label: 'Appareils déployés' },
                { value: `${publicStats.enterprises}+`, label: 'Entreprises clientes' },
                { value: `${publicStats.governorates}`, label: 'Gouvernorats couverts' },
                { value: '24/7', label: 'Support technique' },
              ].map((stat) => (
                <div key={stat.label} className="group cursor-default min-h-[110px] flex flex-col items-center justify-center">
                  <p className="text-4xl md:text-5xl font-black text-[#039C51] mb-2 group-hover:scale-110 transition-transform origin-center drop-shadow-sm">{stat.value}</p>
                  <p className={`text-xs md:text-sm font-bold uppercase tracking-widest ${subtitleColor}`}>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className={`${sectionClass}`}>
          {/* Decorative emojis for FAQ section */}
          <div className="absolute top-10 left-10 text-[#039C51] opacity-10 pointer-events-none" style={{ animation: 'homeFloat0 7s ease-in-out infinite' }}><HelpCircle className="w-16 h-16" /></div>
          <div className="absolute bottom-20 right-10 text-5xl opacity-[0.08] pointer-events-none" style={{ animation: 'homeFloat1 8s ease-in-out 1s infinite' }}>💡</div>
          <div className="absolute top-1/2 right-20 text-4xl opacity-[0.05] pointer-events-none" style={{ animation: 'homeFloat2 9s ease-in-out 2s infinite' }}>🤖</div>

          <div className="container mx-auto max-w-3xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-3xl md:text-4xl font-extrabold mb-4 ${isDark ? 'text-white' : 'text-[#142945]'}`}><span className="flex items-center justify-center gap-3"><HelpCircle className="w-8 h-8 text-[#039C51]" />{t('faq.title')}</span></h2>
              <p className={`text-base font-medium ${subtitleColor}`}>{t('faq.subtitle')}</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className={`${cardBg} rounded-2xl overflow-hidden transition-all duration-300`}>
                  <button
                    className={`w-full text-left px-8 py-6 font-bold text-lg flex items-center justify-between hover:bg-[#039C51]/5 transition-colors ${isDark ? 'text-white' : 'text-[#142945]'}`}
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  >
                    <span className={openFaq === i ? 'text-[#039C51]' : ''}>{faq.q}</span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${openFaq === i ? 'bg-[#039C51]/20' : innerBg}`}>
                      {openFaq === i ? <Minus className="w-5 h-5 text-[#039C51]" /> : <Plus className={`w-5 h-5 ${subtitleColor}`} />}
                    </div>
                  </button>
                  <div className={`px-8 overflow-hidden transition-all duration-300 ease-in-out ${openFaq === i ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className={`text-base font-medium ${bodyColorLight} leading-relaxed`}>
                      {faq.a}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Chatbot CTA after FAQ */}
            <div className={`mt-14 ${cardBg} border-2 border-[#039C51]/30 ${cardRadius} p-8 sm:p-10 text-center relative overflow-hidden group hover:border-[#039C51]/50 transition-colors`}>
              <div className="absolute inset-0 bg-gradient-to-r from-[#039C51]/10 via-transparent to-[#039C51]/10 opacity-50 text-white"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#039C51]/20 flex items-center justify-center group-hover:scale-110 transition-transform shadow-[0_0_20px_rgba(3,156,81,0.2)] text-white">
                    <span className="flex items-center justify-center"><Bot className="w-10 h-10 text-[#039C51]" /></span>
                  </div>
                </div>
                <h3 className={`text-2xl font-extrabold mb-3 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Besoin d'aide ? Notre assistant IA est là !</h3>
                <p className={`text-base font-medium mb-8 max-w-lg mx-auto ${subtitleColor}`}>
                  L'assistant AynTrace connaît tout sur la plateforme : tarifs, fonctionnalités, architecture, démo... Posez-lui n'importe quelle question.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {[
                    { emoji: '🛰️', label: "C'est quoi AynTrace ?" },
                    { emoji: '💰', label: 'Les tarifs' },
                    { emoji: '🏗️', label: 'Architecture' },
                    { emoji: '📖', label: 'Guide d\'utilisation' },
                  ].map((item, i) => (
                    <button key={i} className={`px-5 py-2.5 rounded-full ${isDark ? 'bg-white/5 border-white/10 text-[#039C51]' : 'bg-white border-[#039C51]/20 text-emerald-600'} border font-bold hover:bg-[#039C51]/10 hover:border-[#039C51]/50 hover:-translate-y-1 transition-all shadow-sm`}>
                      <span className="mr-2">{item.emoji}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
                <p className={`text-sm font-semibold mt-6 text-[#039C51] animate-pulse`}>💬 Cliquez sur le bouton vert en bas à droite pour discuter avec AynTrace AI</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contactez-nous */}
        <section id="contact" className={`${sectionClass} overflow-hidden ${isDark ? 'bg-[#0B121F]/50' : 'bg-slate-50/30'}`}>
          <div className="container mx-auto max-w-5xl relative z-10">
            <div className={sectionHeaderClass}>
              <h2 className={`text-4xl md:text-5xl font-black mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Parlons de votre projet</h2>
              <p className={`text-lg font-medium max-w-2xl mx-auto ${subtitleColor}`}>Nos experts sont à votre disposition pour auditer votre flotte et proposer la solution la plus adaptée.</p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {[
                { icon: Phone, title: 'Téléphone', value: '+216 71 000 000', href: 'tel:+21671000000' },
                { icon: Mail, title: 'Email', value: 'contact@ayntrace.tn', href: 'mailto:contact@ayntrace.tn' },
                { icon: MapPinned, title: 'Adresse', value: 'Tunis, Tunisie', href: '#' },
              ].map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  className={`${cardBg} h-full min-h-[260px] p-8 ${cardRadius} group relative overflow-hidden transition-all duration-500 hover:shadow-2xl border ${isDark ? 'border-white/5' : 'border-transparent'} hover:border-[#039C51]/20 flex flex-col items-center justify-center text-center`}
                >
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-[#039C51]/5 rounded-full group-hover:scale-150 transition-transform duration-700 text-white" />

                  <div className={`w-16 h-16 ${innerBg} rounded-2xl flex items-center justify-center mb-8 group-hover:bg-[#039C51] transition-all duration-500 shadow-sm relative z-10 text-white`}>
                    <item.icon className="w-8 h-8 text-[#039C51] group-hover:text-white transition-colors duration-500" />
                  </div>

                  <h3 className={`font-black text-xl mb-3 relative z-10 ${isDark ? 'text-white' : 'text-[#142945]'}`}>{item.title}</h3>
                  <p className={`text-base font-bold ${subtitleColor} relative z-10 group-hover:text-[#039C51] transition-colors`}>{item.value}</p>

                  <div className="mt-auto flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#039C51] opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                    <span>Nous contacter</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className={`${sectionClass} overflow-hidden`}>
          <div className="container mx-auto max-w-6xl relative">
            <div className={`relative z-10 overflow-hidden rounded-[2rem] sm:rounded-[3.5rem] ${isDark ? 'bg-[#0E111A]' : 'bg-white border-2 border-slate-100'} p-8 sm:p-12 md:p-20 text-center shadow-2xl`}>
              {/* Creative animated background for the inner CTA box */}
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#039C51]/10 blur-[120px] rounded-full -mr-64 -mt-64 animate-pulse text-white" />
              <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[120px] rounded-full -ml-64 -mb-64 animate-pulse text-white" />
              
              <div className="relative z-20 max-w-3xl mx-auto">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${isDark ? 'bg-white/10 text-emerald-400 border-white/10' : 'bg-[#039C51]/10 text-[#039C51] border-[#039C51]/20'} backdrop-blur-md border text-xs font-black uppercase tracking-[0.2em] mb-10`}>
                  <Globe className="w-4 h-4 animate-spin-slow" />
                  <span>Disponible partout en Tunisie</span>
                </div>
                
                <h2 className={`text-3xl sm:text-4xl md:text-6xl font-black mb-6 sm:mb-8 leading-tight ${isDark ? 'text-white' : 'text-[#142945]'}`}>
                  Prêt à transformer <span className="text-[#039C51]">votre gestion de flotte ?</span>
                </h2>
                
                <p className={`text-lg md:text-xl font-medium mb-12 leading-relaxed ${isDark ? 'text-white/70' : 'text-[#142945]/70'}`}>
                  Rejoignez les leaders du transport et de la logistique en Tunisie. Installation rapide, formation incluse et support technique local 24/7.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                  <Button
                    className="w-full sm:w-auto bg-[#039C51] text-white hover:bg-emerald-500 font-black rounded-2xl px-12 h-16 text-lg shadow-[0_20px_40px_rgba(3,156,81,0.3)] hover:-translate-y-1 transition-all"
                    onClick={() => setJoinOpen(true)}
                  >
                    Commencer maintenant
                  </Button>
                  <a href="tel:+21671000000" className="w-full sm:w-auto">
                    <Button variant="outline" className={`w-full sm:w-auto ${isDark ? 'border-white/20 text-white hover:bg-[#039C51]/10 hover:border-[#039C51] hover:text-[#039C51]' : 'border-slate-200 text-[#142945] hover:bg-slate-50 hover:border-[#039C51] hover:text-[#039C51]'} rounded-2xl px-10 h-16 font-black text-lg gap-3 backdrop-blur-sm transition-all duration-300`}>
                      <Phone className="w-5 h-5" />
                      Parlons-en au téléphone
                    </Button>
                  </a>
                </div>
                
                <div className="mt-16 flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                   <div className={`flex items-center gap-2 font-bold ${isDark ? 'text-white' : 'text-[#142945]'}`}><CheckCircle2 className="w-5 h-5 text-[#039C51]" /> Sans engagement</div>
                   <div className={`flex items-center gap-2 font-bold ${isDark ? 'text-white' : 'text-[#142945]'}`}><CheckCircle2 className="w-5 h-5 text-[#039C51]" /> Démo gratuite</div>
                   <div className={`flex items-center gap-2 font-bold ${isDark ? 'text-white' : 'text-[#142945]'}`}><CheckCircle2 className="w-5 h-5 text-[#039C51]" /> Support Tunisien</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <PublicFooter />

      </main>{/* end z-10 wrapper */}

      {/* Adding CSS animation variables to global scope via style tag */}
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 15s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        
        @keyframes homeFloat0 { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-10px) rotate(2deg); } }
        @keyframes homeFloat1 { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-8px) rotate(-2deg); } }
        @keyframes homeFloat2 { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-12px) rotate(3deg); } }
        @keyframes homeFloat3 { 0%, 100% { transform: translateY(0px) rotate(0deg); } 50% { transform: translateY(-9px) rotate(-1deg); } }
      `}</style>

      <JoinPopup isOpen={joinOpen} onClose={() => setJoinOpen(false)} />
      <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-md" 
            onClick={() => setSelectedProduct(null)}
          />
          
          <div className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] p-8 md:p-10 border transition-all duration-300 ${
            isDark 
              ? 'bg-[#0F1D2E]/95 border-white/10 text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95' 
              : 'bg-white/95 border-white text-slate-800 shadow-2xl animate-in zoom-in-95'
          }`}>
            <button 
              onClick={() => setSelectedProduct(null)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Minus className="w-6 h-6" />
            </button>

            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-[#039C51]/10 text-[#039C51] px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-[#039C51]/20">
                  {selectedProduct.badge}
                </span>
                <span className={`text-sm font-semibold ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                  Traceur AynTrace
                </span>
              </div>

              <div>
                <h3 className="text-3xl font-black mb-2">{selectedProduct.title}</h3>
                <p className="text-lg font-bold text-[#039C51]">{selectedProduct.tagline}</p>
              </div>

              <p className={`text-base font-medium leading-relaxed ${isDark ? 'text-white/70' : 'text-slate-600'}`}>
                {selectedProduct.desc}
              </p>

              <div>
                <h4 className="text-sm font-black uppercase tracking-wider mb-4 text-[#039C51]">Caractéristiques Techniques</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {selectedProduct.specs.map((spec: any, idx: number) => (
                    <div key={idx} className={`p-4 rounded-2xl border ${
                      isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'
                    }`}>
                      <div className="text-xs font-bold text-slate-400 mb-1">{spec.name}</div>
                      <div className="text-sm font-bold">{spec.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-black uppercase tracking-wider mb-3 text-[#039C51]">Cas d'Usage Recommandés</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.usages.map((usage: string, idx: number) => (
                    <span key={idx} className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                      isDark ? 'bg-[#0E1B2B] border-white/5 text-white/80' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      {usage}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row gap-4">
                <Button 
                  className="flex-1 h-14 bg-[#039C51] hover:bg-[#039C51]/90 text-white font-bold rounded-2xl shadow-lg transition-all"
                  onClick={() => {
                    setSelectedProduct(null);
                    setJoinOpen(true);
                  }}
                >
                  Commander ce traceur
                </Button>
                <Button 
                  variant="outline"
                  className={`h-14 px-8 font-bold rounded-2xl border ${
                    isDark 
                      ? 'border-white/10 text-white hover:bg-white/10 hover:text-white' 
                      : 'border-slate-200 text-slate-700 hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]'
                  }`}
                  onClick={() => {
                    setSelectedProduct(null);
                    setDemoOpen(true);
                  }}
                >
                  Essayer la Démo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div >
  );
};

export default Index;
