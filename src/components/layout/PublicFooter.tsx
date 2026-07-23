import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Globe } from 'lucide-react';
import DemoModal from '@/components/modals/DemoModal';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

const PublicFooter = () => {
    const [demoOpen, setDemoOpen] = useState(false);
    const { theme } = useTheme();
    const { t } = useI18n();

    const isDark = theme === 'dark';
    const logoSrc = isDark ? '/Dark.svg' : '/Light.svg';

    const borderColor = isDark ? 'border-white/5' : 'border-white/60';
    const mutedColor = isDark ? 'text-white/40' : 'text-[#142945]/40';
    const footerBg = isDark ? '' : 'bg-white/40 backdrop-blur-xl border-t border-white';

    return (
        <>
            <footer className={`py-16 px-6 ${borderColor} border-t text-sm font-medium ${mutedColor} ${footerBg} relative`}>
                {!isDark && <div className="absolute inset-0 bg-gradient-to-t from-white/80 to-transparent pointer-events-none -z-10"></div>}
                <div className="container mx-auto max-w-6xl grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 sm:gap-10 mb-12 relative z-10 text-left">
                    <div className="col-span-2 md:col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-4 mb-6">
                            <img
                                src={logoSrc}
                                alt="AynTrace logo"
                                className="h-20 w-20 shrink-0 object-contain brightness-[1.1] contrast-[1.14] drop-shadow-[0_8px_16px_rgba(3,156,81,0.3)] transition-transform duration-300 hover:scale-105"
                            />
                            <div>
                                <span className={`block text-2xl font-black tracking-[0.08em] ${isDark ? 'text-white' : 'text-[#142945]'}`}>
                                    <span>Ayn</span><span className="text-[#039C51]">Trace</span>
                                </span>
                                <span className="text-[11px] font-bold tracking-[0.15em] text-[#039C51]">
                                    <span className={isDark ? 'text-white' : 'text-[#142945]'}>{t('brand.sloganLead')} </span>
                                    <span className="text-[#039C51]">{t('brand.sloganTail')}</span>
                                </span>
                            </div>
                        </div>
                        <p className="max-w-sm mb-6 leading-relaxed">
                            Plateforme de géolocalisation GPS professionnelle pour contrôler vos véhicules, le personnel d'intervention, vos proches (enfants, animaux) et optimiser votre logistique complète.
                        </p>
                    </div>
                    <div>
                        <h4 className={`font-bold text-base mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Navigation</h4>
                        <ul className="space-y-3">
                            <li><Link to="/" className="hover:text-[#039C51] transition-colors">{t('nav.home') || 'Accueil'}</Link></li>
                            <li><a href="/#traceurs" className="hover:text-[#039C51] transition-colors">{t('nav.trackers') || 'Vos Traceurs'}</a></li>
                            <li><a href="/#comment-ca-marche" className="hover:text-[#039C51] transition-colors">{t('nav.how') || 'Comment ça marche'}</a></li>
                            <li><a href="/#tarifs" className="hover:text-[#039C51] transition-colors">{t('nav.pricing') || 'Tarifs'}</a></li>
                            <li><button onClick={() => setDemoOpen(true)} className="hover:text-[#039C51] transition-colors text-left">Simulation Démo</button></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className={`font-bold text-base mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Produits</h4>
                        <ul className="space-y-3">
                            <li><a href="/#traceurs" className="hover:text-[#039C51] transition-colors">Traceurs Véhicules fixes</a></li>
                            <li><a href="/#traceurs" className="hover:text-[#039C51] transition-colors">Traceurs sur Prise OBD</a></li>
                            <li><a href="/#traceurs" className="hover:text-[#039C51] transition-colors">Traceurs Autonomes</a></li>
                            <li><a href="/#traceurs" className="hover:text-[#039C51] transition-colors">Traceurs Personnels</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className={`font-bold text-base mb-6 ${isDark ? 'text-white' : 'text-[#142945]'}`}>Légal & Support</h4>
                        <ul className="space-y-3">
                            <li><Link to="/legal/mentions" className="hover:text-[#039C51] transition-colors">Mentions Légales</Link></li>
                            <li><Link to="/legal/confidentialite" className="hover:text-[#039C51] transition-colors">Politique de Confidentialité</Link></li>
                            <li><Link to="/legal/conditions" className="hover:text-[#039C51] transition-colors">Conditions d'Utilisation</Link></li>
                            <li><a href="tel:+21671000000" className="hover:text-[#039C51] transition-colors flex items-center gap-2"><Phone className="w-3 h-3" /> +216 71 000 000</a></li>
                        </ul>
                    </div>
                </div>

                <div className={`container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4 ${borderColor} border-t pt-8 relative z-10`}>
                    <span>{t('footer.rights')}</span>
                    <div className="flex items-center gap-4">
                        <span className="flex items-center gap-2">
                            <Globe className="w-4 h-4" /> {t('footer.location')}
                        </span>
                    </div>
                </div>
            </footer>
            <DemoModal isOpen={demoOpen} onClose={() => setDemoOpen(false)} />
        </>
    );
};

export default PublicFooter;
