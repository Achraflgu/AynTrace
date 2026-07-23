import { useState } from 'react';
import { ChevronDown, ChevronUp, LayoutDashboard, Map, Smartphone, Bell, History, ArrowRight, Shield, Globe, BarChart3, Crosshair, Route, Building2, Play } from 'lucide-react';
import PublicNavbar from '@/components/layout/PublicNavbar';
import PublicFooter from '@/components/layout/PublicFooter';
import FloatingIcons from '@/components/FloatingIcons';
import JoinPopup from '@/components/JoinPopup';
import DemoModal from '@/components/modals/DemoModal';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';

const GuidePage = () => {
    const [activeStep, setActiveStep] = useState<number | null>(1);
    const [joinOpen, setJoinOpen] = useState(false);
    const [demoOpen, setDemoOpen] = useState(false);
    const { t } = useI18n();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const cardBg = isDark
        ? 'bg-[#0F1D2E]/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_20px_50px_rgba(3,156,81,0.15)] hover:bg-[#142438]/80 hover:-translate-y-2 hover:border-[#039C51]/30 transition-all duration-500 relative overflow-hidden group'
        : 'bg-white/40 backdrop-blur-2xl border-[1.5px] border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:bg-white/70 hover:shadow-[0_20px_40px_rgba(3,156,81,0.15)] hover:-translate-y-2 transition-all duration-500 ring-1 ring-white/50 relative overflow-hidden group';

    const glassPanel = isDark
        ? 'bg-[#0F1D2E]/80 backdrop-blur-xl border border-white/10'
        : 'bg-white/60 backdrop-blur-2xl border-[1.5px] border-white ring-1 ring-white/50 shadow-sm';

    const steps = [
        {
            id: 1,
            icon: LayoutDashboard,
            title: t('guidePage.step1Title'),
            desc: t('guidePage.step1Desc'),
            content: t('guidePage.step1Content'),
            color: 'text-[#039C51] bg-[#039C51]/10',
            demoRoute: '/dashboard',
        },
        {
            id: 2,
            icon: Map,
            title: t('guidePage.step2Title'),
            desc: t('guidePage.step2Desc'),
            content: t('guidePage.step2Content'),
            color: 'text-[#039C51] bg-[#039C51]/10',
            demoRoute: '/map',
        },
        {
            id: 3,
            icon: Smartphone,
            title: t('guidePage.step3Title'),
            desc: t('guidePage.step3Desc'),
            content: t('guidePage.step3Content'),
            color: 'text-[#039C51] bg-[#039C51]/10',
            demoRoute: '/devices',
        },
        {
            id: 4,
            icon: Bell,
            title: t('guidePage.step4Title'),
            desc: t('guidePage.step4Desc'),
            content: t('guidePage.step4Content'),
            color: 'text-red-500 bg-red-500/10',
            demoRoute: '/alerts',
        },
        {
            id: 5,
            icon: History,
            title: t('guidePage.step5Title'),
            desc: t('guidePage.step5Desc'),
            content: t('guidePage.step5Content'),
            color: 'text-orange-500 bg-orange-500/10',
            demoRoute: '/dashboard',
        }
    ];

    const features = [
        { icon: Shield, title: t('guidePage.feature1Title'), text: t('guidePage.feature1Text') },
        { icon: Globe, title: t('guidePage.feature2Title'), text: t('guidePage.feature2Text') },
        { icon: BarChart3, title: t('guidePage.feature3Title'), text: t('guidePage.feature3Text') },
        { icon: Crosshair, title: t('guidePage.feature4Title'), text: t('guidePage.feature4Text') },
        { icon: Route, title: t('guidePage.feature5Title'), text: t('guidePage.feature5Text') },
        { icon: Building2, title: t('guidePage.feature6Title'), text: t('guidePage.feature6Text') }
    ];

    return (
        <div className={`min-h-screen font-sans selection:bg-[#039C51]/30 transition-colors duration-500 relative overflow-hidden ${isDark ? 'bg-[#0B1829] text-white' : 'bg-slate-50 text-slate-900'}`}>
            <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${isDark ? '' : 'bg-slate-100/50'}`}>
                <div className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${isDark ? 'opacity-10 mix-blend-luminosity' : 'opacity-10 mix-blend-multiply grayscale-[50%]'}`} style={{ backgroundImage: "url('/images/tunisia_map_bg.png')" }} />
                <div className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full filter blur-[100px] animate-blob ${isDark ? 'mix-blend-multiply opacity-60 bg-[#039C51]/10' : 'mix-blend-screen opacity-100 bg-[#039C51]/20'}`} />
                <div className={`absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full filter blur-[100px] animate-blob animation-delay-2000 ${isDark ? 'mix-blend-multiply opacity-60 bg-blue-500/10' : 'mix-blend-multiply opacity-40 bg-[#3b82f6]/20'}`} />
                <div className={`absolute bottom-[-20%] left-[20%] w-[60vw] h-[60vw] rounded-full filter blur-[120px] animate-blob animation-delay-4000 ${isDark ? 'mix-blend-multiply opacity-60 bg-purple-500/10' : 'mix-blend-multiply opacity-40 bg-[#a855f7]/15'}`} />
                {!isDark && (
                    <div className="absolute inset-0 bg-[radial-gradient(#039C51_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.05]"></div>
                )}
            </div>

            <div className="relative z-0">
                <FloatingIcons />
            </div>

            <div className="relative z-10">
                <PublicNavbar />

                <main className="pt-32 pb-20 px-6">
                    <div className="max-w-3xl mx-auto space-y-12">
                        <div className="text-center space-y-4">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#039C51]/10 text-[#039C51] text-sm font-medium mb-4 shadow-[0_0_15px_rgba(3,156,81,0.1)]">
                                <span className="w-2 h-2 rounded-full bg-[#039C51] animate-pulse" />
                                {t('guidePage.badge')}
                            </div>
                            <h1 className="text-4xl md:text-5xl font-extrabold">
                                {t('guidePage.heading')} <span className="text-[#039C51]">{t('guidePage.headingAccent')}</span>
                            </h1>
                            <p className={`text-lg max-w-2xl mx-auto font-medium ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                                {t('guidePage.subtitle')}
                            </p>
                        </div>

                        <div className="flex justify-center gap-2 md:gap-4 mb-8">
                            {[1, 2, 3, 4, 5].map((step) => (
                                <div
                                    key={step}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 cursor-pointer ${activeStep === step || activeStep === null && step === 1
                                        ? 'bg-[#039C51] text-white shadow-[0_0_20px_rgba(3,156,81,0.5)] scale-110'
                                        : `${isDark ? 'bg-[#0F1D2E]/60 border border-white/10 text-white/50 hover:bg-white/10' : 'bg-white/50 backdrop-blur-md border border-white text-slate-500 hover:bg-white hover:shadow-md'} hover:text-[#039C51]`
                                        }`}
                                    onClick={() => setActiveStep(activeStep === step ? null : step)}
                                >
                                    {step}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {steps.map((step) => {
                                const isActive = activeStep === step.id;

                                return (
                                    <div
                                        key={step.id}
                                        className={`rounded-2xl overflow-hidden transition-all duration-500 ${isActive ? `${isDark ? 'bg-[#039C51]/10 border border-[#039C51]/30 shadow-[0_0_30px_rgba(3,156,81,0.1)]' : 'bg-white/80 border-[2px] border-[#039C51]/30 shadow-[0_10px_40px_rgba(3,156,81,0.15)] ring-2 ring-[#039C51]/10 backdrop-blur-xl'}` : `${glassPanel} hover:border-[#039C51]/30`
                                            }`}
                                    >
                                        <button
                                            className="w-full flex items-center justify-between p-4 md:p-6 text-left hover:bg-black/5 transition-colors"
                                            onClick={() => setActiveStep(isActive ? null : step.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${step.color} shadow-sm`}>
                                                    <step.icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-[#039C51] mb-1 uppercase tracking-wider">{t('guidePage.stepLabel')} {step.id}</div>
                                                    <h3 className="font-bold text-lg md:text-xl">{step.title}</h3>
                                                    <p className={`text-sm hidden md:block font-medium ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{step.desc}</p>
                                                </div>
                                            </div>
                                            {isActive ? (
                                                <ChevronUp className={`w-6 h-6 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                                            ) : (
                                                <ChevronDown className={`w-6 h-6 ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                                            )}
                                        </button>

                                        {isActive && (
                                            <div className="px-6 pb-6 pt-2 animate-in slide-in-from-top-2">
                                                <p className={`ml-16 font-medium leading-relaxed ${isDark ? 'text-white/70' : 'text-slate-600'}`}>{step.content}</p>
                                                <div className="ml-16 mt-6 flex items-center gap-3">
                                                    <Button
                                                        size="sm"
                                                        className="bg-[#039C51]/10 text-[#039C51] hover:bg-[#039C51] hover:text-white border border-[#039C51]/30 rounded-full px-5 text-sm font-bold gap-1.5 transition-all shadow-sm"
                                                        onClick={() => setDemoOpen(true)}
                                                    >
                                                        <Play className="w-4 h-4" />
                                                        {t('guide.seeInDemo')}
                                                    </Button>
                                                    <span className={`text-sm font-semibold ${isDark ? 'text-white/30' : 'text-slate-400'}`}>→ {step.demoRoute}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-24 mb-12 text-center">
                            <h2 className="text-3xl font-extrabold mb-4">{t('guidePage.whyTitle')}</h2>
                            <p className={`text-base font-medium ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{t('guidePage.whySubtitle')}</p>
                        </div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                            {features.map((feature, idx) => (
                                <div key={idx} className={`${cardBg} p-8 rounded-3xl`}>
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#039C51]/10 blur-[30px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className={`w-14 h-14 ${isDark ? 'bg-white/5' : 'bg-slate-50'} rounded-2xl flex items-center justify-center mb-6 text-[#039C51] group-hover:scale-110 group-hover:bg-[#039C51] group-hover:text-white transition-all duration-500 shadow-sm relative z-10`}>
                                        <feature.icon className="w-7 h-7" />
                                    </div>
                                    <h3 className="font-bold text-lg mb-2 relative z-10">{feature.title}</h3>
                                    <p className={`text-sm font-medium leading-relaxed ${isDark ? 'text-white/50' : 'text-slate-500'} relative z-10`}>{feature.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className={`mt-20 p-10 md:p-14 rounded-[3rem] ${isDark ? 'border border-white/5 bg-gradient-to-br from-[#142438]/90 to-[#0F1D2E]/90 shadow-[0_20px_50px_rgba(3,156,81,0.15)] ring-1 ring-[#039C51]/20' : 'border border-white bg-white/40 shadow-2xl'} backdrop-blur-2xl text-center relative overflow-hidden`}>
                            {!isDark && <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/0 rounded-[3rem] pointer-events-none" />}
                            {isDark && <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent rounded-[3rem] pointer-events-none" />}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#039C51]/10 rounded-full blur-[100px] pointer-events-none" />

                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-[#039C51]/10 flex items-center justify-center mx-auto mb-6 shadow-sm border border-[#039C51]/20">
                                    <span className="text-[#039C51] text-2xl font-bold">+</span>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-extrabold mb-4">{t('guide.tryDemo')}</h2>
                                <p className={`mb-8 max-w-md mx-auto font-medium text-lg ${isDark ? 'text-white/60' : 'text-slate-600'}`}>
                                    {t('guidePage.whySubtitle')}
                                </p>
                                <div className="flex flex-col sm:flex-row justify-center gap-4">
                                    <Button
                                        className="w-full sm:w-auto bg-[#039C51] text-white hover:bg-[#039C51]/90 font-bold rounded-full px-8 h-14 shadow-[0_0_20px_rgba(3,156,81,0.3)] hover:scale-105 transition-all text-base"
                                        onClick={() => setJoinOpen(true)}
                                    >
                                        {t('nav.join')}
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className={`w-full sm:w-auto bg-transparent ${isDark ? 'border-white/20 text-white hover:bg-white/10 hover:text-white' : 'border-[#039C51]/30 text-slate-800 hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]'} rounded-full px-8 h-14 font-bold gap-2 text-base shadow-sm`}
                                        onClick={() => setDemoOpen(true)}
                                    >
                                        <Play className="w-5 h-5" />
                                        {t('guide.tryDemo')}
                                    </Button>
                                </div>
                                <div className={`flex flex-col md:flex-row items-center justify-center gap-6 mt-10 font-bold ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                                    <a href="tel:+21671000000" className="hover:text-[#039C51] transition-colors flex items-center gap-2">+216 71 000 000</a>
                                    <a href="mailto:contact@ayntrace.tn" className="hover:text-[#039C51] transition-colors flex items-center gap-2">contact@ayntrace.tn</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
                <PublicFooter />
                <JoinPopup isOpen={joinOpen} onClose={() => setJoinOpen(false)} />
                <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
            </div>

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
            `}</style>
        </div>
    );
};

export default GuidePage;
