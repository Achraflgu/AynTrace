import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChevronRight, BookOpen, Play, Sun, Moon, Languages, Menu, X } from 'lucide-react';
import DemoModal from '@/components/modals/DemoModal';
import JoinPopup from '@/components/JoinPopup';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

const PublicNavbar = () => {
    const [demoOpen, setDemoOpen] = useState(false);
    const [joinOpen, setJoinOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const { lang, setLang, t } = useI18n();
    const location = useLocation();

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const handleDemoLogin = () => {
        setMobileOpen(false);
        setDemoOpen(true);
    };

    const isDark = theme === 'dark';

    return (
        <>
            <nav className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b transition-colors duration-300 ${isDark ? 'bg-[#0B1829]/90 border-white/5' : 'bg-white/90 border-gray-100 shadow-sm'}`}>
                <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Link to="/" className="group flex items-center gap-2 sm:gap-3 hover:opacity-95 transition-all">
                            <div className="relative h-12 w-12 sm:h-20 sm:w-20 flex items-center justify-center">
                                <img
                                    src={isDark ? '/Dark.svg' : '/Light.svg'}
                                    alt="AynTrace logo"
                                    className="h-12 w-12 sm:h-20 sm:w-20 object-contain brightness-[1.1] contrast-[1.14] drop-shadow-[0_4px_12px_rgba(3,156,81,0.3)] transition-all duration-300 group-hover:scale-110 absolute"
                                />
                            </div>
                            <div className="leading-none">
                                <span className={`block text-lg sm:text-2xl font-black tracking-[0.08em] ${isDark ? 'text-white' : 'text-[#142945]'}`}>
                                    <span>Ayn</span><span className="text-[#039C51]">Trace</span>
                                </span>
                                <span className="text-[7px] sm:text-[9px] font-bold text-[#039C51]/70 tracking-[0.1em] block mt-0.5 hidden sm:block"><span className={isDark ? 'text-white' : 'text-[#142945]'}>{t('brand.sloganLead')} </span><span className="text-[#039C51]">{t('brand.sloganTail')}</span></span>
                            </div>
                        </Link>
                    </div>

                    {/* Desktop nav links */}
                    <div className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-medium">
                        <Link to="/" className={`${isDark ? 'text-white hover:text-[#039C51]' : 'text-[#142945] hover:text-[#039C51]'} transition-colors`}>
                            {t('nav.home')}
                        </Link>
                        <a href="/#traceurs" className={`${isDark ? 'text-white/70' : 'text-gray-600'} hover:text-[#039C51] transition-colors`}>
                            {t('nav.trackers')}
                        </a>
                        <a href="/#comment-ca-marche" className={`${isDark ? 'text-white/70' : 'text-gray-600'} hover:text-[#039C51] transition-colors`}>
                            {t('nav.howItWorks')}
                        </a>
                        <a href="/#tarifs" className={`${isDark ? 'text-white/70' : 'text-gray-600'} hover:text-[#039C51] transition-colors`}>
                            {t('nav.pricing')}
                        </a>
                        <button
                            onClick={handleDemoLogin}
                            className={`${isDark ? 'text-white/70' : 'text-gray-600'} hover:text-[#039C51] transition-colors flex items-center gap-1.5`}
                        >
                            <Play className="w-3.5 h-3.5" />
                            {t('nav.demo')}
                        </button>
                        <Link to="/guide" className={`${isDark ? 'text-white/70' : 'text-gray-600'} hover:text-[#039C51] transition-colors flex items-center gap-1.5`}>
                            <BookOpen className="w-3.5 h-3.5" />
                            {t('nav.guide')}
                        </Link>
                    </div>

                    {/* Desktop right-side buttons */}
                    <div className="hidden md:flex items-center gap-2">
                        <button
                            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border transition-all text-xs font-bold ${isDark ? 'bg-white/5 border-white/10 text-white/70 hover:text-[#039C51] hover:border-[#039C51]/30' : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-[#039C51] hover:border-[#039C51]/30 hover:bg-white'}`}
                            title={lang === 'fr' ? t('nav.switchToEnglish') : t('nav.switchToFrench')}
                        >
                            <Languages className="w-3.5 h-3.5" />
                            {lang === 'fr' ? 'EN' : 'FR'}
                        </button>

                        <button
                            onClick={toggleTheme}
                            aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                            className={`p-2 rounded-full border transition-all ${isDark ? 'bg-white/5 border-white/10 text-white/70 hover:text-[#039C51] hover:border-[#039C51]/30' : 'bg-gray-50 border-gray-200 text-gray-600 hover:text-[#039C51] hover:border-[#039C51]/30 hover:bg-white'}`}
                            title={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                        >
                            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>

                        <button
                            className={`hidden sm:flex items-center justify-center font-semibold rounded-full px-5 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#039C51]/50 ${isDark ? 'border border-[#039C51]/30 text-[#039C51] hover:bg-[#039C51]/10' : 'border border-[#039C51] text-[#039C51] hover:bg-[#039C51] hover:text-white shadow-sm'}`}
                            onClick={() => setJoinOpen(true)}
                        >
                            {t('nav.join')}
                        </button>
                        <Link to="/login">
                            <button className="flex items-center justify-center bg-[#039C51] text-white hover:bg-[#039C51]/90 font-bold rounded-full px-5 py-2 text-sm transition-all shadow-[0_0_15px_rgba(3,156,81,0.3)] hover:shadow-[0_0_20px_rgba(3,156,81,0.5)] focus:outline-none focus:ring-2 focus:ring-[#039C51]/50">
                                {t('nav.login')}
                                <ChevronRight className="w-4 h-4 ml-1" />
                            </button>
                        </Link>
                    </div>

                    {/* Mobile hamburger button */}
                    <div className="flex md:hidden items-center gap-2">
                        <button
                            onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')}
                            aria-label={lang === 'fr' ? t('nav.switchToEnglish') : t('nav.switchToFrench')}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-full border transition-all text-[10px] font-bold ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                        >
                            {lang === 'fr' ? 'EN' : 'FR'}
                        </button>
                        <button
                            onClick={toggleTheme}
                            aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
                            className={`p-1.5 rounded-full border transition-all ${isDark ? 'bg-white/5 border-white/10 text-white/70' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                        >
                            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={() => setMobileOpen(!mobileOpen)}
                            className={`p-2 rounded-lg transition-all ${isDark ? 'text-white hover:bg-white/10' : 'text-[#142945] hover:bg-gray-100'}`}
                            aria-label="Toggle mobile menu"
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown panel */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${mobileOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className={`px-4 pb-6 pt-2 space-y-1 border-t ${isDark ? 'bg-[#0B1829]/95 border-white/5' : 'bg-white/95 border-gray-100'}`}>
                        {[
                            { to: '/', label: t('nav.home'), isLink: true },
                            { href: '/#traceurs', label: t('nav.trackers') },
                            { href: '/#comment-ca-marche', label: t('nav.howItWorks') },
                            { href: '/#tarifs', label: t('nav.pricing') },
                        ].map((item, i) => (
                            item.isLink ? (
                                <Link
                                    key={i}
                                    to={item.to!}
                                    onClick={() => setMobileOpen(false)}
                                    className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'text-white/80 hover:bg-white/5 hover:text-[#039C51]' : 'text-[#142945] hover:bg-gray-50 hover:text-[#039C51]'}`}
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <a
                                    key={i}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'text-white/70 hover:bg-white/5 hover:text-[#039C51]' : 'text-gray-600 hover:bg-gray-50 hover:text-[#039C51]'}`}
                                >
                                    {item.label}
                                </a>
                            )
                        ))}
                        <button
                            onClick={handleDemoLogin}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors ${isDark ? 'text-white/70 hover:bg-white/5 hover:text-[#039C51]' : 'text-gray-600 hover:bg-gray-50 hover:text-[#039C51]'}`}
                        >
                            <Play className="w-3.5 h-3.5" />
                            {t('nav.demo')}
                        </button>
                        <Link
                            to="/guide"
                            onClick={() => setMobileOpen(false)}
                            className={`block px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${isDark ? 'text-white/70 hover:bg-white/5 hover:text-[#039C51]' : 'text-gray-600 hover:bg-gray-50 hover:text-[#039C51]'}`}
                        >
                            <span className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> {t('nav.guide')}</span>
                        </Link>

                        <div className="pt-4 space-y-3 border-t border-border/30 mt-2">
                            <button
                                className="w-full flex items-center justify-center font-bold rounded-xl px-5 py-3 text-sm transition-all border border-[#039C51]/30 text-[#039C51] hover:bg-[#039C51]/10"
                                onClick={() => { setMobileOpen(false); setJoinOpen(true); }}
                            >
                                {t('nav.join')}
                            </button>
                            <Link to="/login" onClick={() => setMobileOpen(false)}>
                                <button className="w-full flex items-center justify-center bg-[#039C51] text-white hover:bg-[#039C51]/90 font-bold rounded-xl px-5 py-3 text-sm transition-all shadow-lg">
                                    {t('nav.login')}
                                    <ChevronRight className="w-4 h-4 ml-1" />
                                </button>
                            </Link>
                        </div>
                    </div>
                </div>
            </nav>
            <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
            <JoinPopup isOpen={joinOpen} onClose={() => setJoinOpen(false)} />
        </>
    );
};

export default PublicNavbar;
