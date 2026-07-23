import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Scale, ShieldCheck, FileText, Phone, Mail, ArrowRight, ChevronRight, Globe } from 'lucide-react';
import PublicNavbar from '@/components/layout/PublicNavbar';
import PublicFooter from '@/components/layout/PublicFooter';
import FloatingIcons from '@/components/FloatingIcons';
import JoinPopup from '@/components/JoinPopup';
import DemoModal from '@/components/modals/DemoModal';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

const SECTIONS = [
  {
    id: 'mentions',
    title: 'Mentions Légales',
    icon: Scale,
    description: 'Informations obligatoires sur l\'éditeur et l\'hébergeur du site.'
  },
  {
    id: 'confidentialite',
    title: 'Politique de Confidentialité',
    icon: ShieldCheck,
    description: 'Comment nous collectons, utilisons et protégeons vos données de géolocalisation.'
  },
  {
    id: 'conditions',
    title: 'Conditions d\'Utilisation',
    icon: FileText,
    description: 'Règles et conditions régissant l\'utilisation de la plateforme AynTrace.'
  }
];

const LegalPage = () => {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { t } = useI18n();
  const [joinOpen, setJoinOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  const activeSection = SECTIONS.some(s => s.id === section) ? section : 'mentions';

  useEffect(() => {
    // Redirect /legal to /legal/mentions if path is empty
    if (!section) {
      navigate('/legal/mentions', { replace: true });
    }
  }, [section, navigate]);

  const isDark = theme === 'dark';

  const cardBg = isDark
    ? 'bg-[#0F1D2E]/60 backdrop-blur-xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.5)] hover:shadow-[0_20px_50px_rgba(3,156,81,0.15)] hover:bg-[#142438]/80 hover:border-[#039C51]/30 transition-all duration-500 relative overflow-hidden group'
    : 'bg-white/40 backdrop-blur-2xl border-[1.5px] border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:bg-white/70 hover:shadow-[0_20px_40px_rgba(3,156,81,0.15)] transition-all duration-500 ring-1 ring-white/50 relative overflow-hidden group';

  const glassPanel = isDark
    ? 'bg-[#0F1D2E]/80 backdrop-blur-xl border border-white/10'
    : 'bg-white/60 backdrop-blur-2xl border-[1.5px] border-white ring-1 ring-white/50 shadow-sm';

  const titleColor = isDark ? 'text-white' : 'text-[#142945]';
  const textColor = isDark ? 'text-white/70' : 'text-slate-600';
  const headingColor = isDark ? 'text-[#039C51]' : 'text-[#039C51]';

  const handleSectionChange = (id: string) => {
    navigate(`/legal/${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`min-h-screen font-sans selection:bg-[#039C51]/30 transition-colors duration-500 relative overflow-hidden ${isDark ? 'bg-[#0B1829] text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Background Decor */}
      <div className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${isDark ? '' : 'bg-slate-100/50'}`}>
        <div className={`absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700 ${isDark ? 'opacity-10 mix-blend-luminosity' : 'opacity-10 mix-blend-multiply grayscale-[50%]'}`} style={{ backgroundImage: "url('/images/tunisia_map_bg.png')" }} />
        <div className={`absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full filter blur-[100px] animate-blob ${isDark ? 'mix-blend-multiply opacity-60 bg-[#039C51]/10' : 'mix-blend-screen opacity-100 bg-[#039C51]/20'}`} />
        <div className={`absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] rounded-full filter blur-[100px] animate-blob animation-delay-2000 ${isDark ? 'mix-blend-multiply opacity-60 bg-blue-500/10' : 'mix-blend-multiply opacity-40 bg-[#3b82f6]/20'}`} />
        {!isDark && (
          <div className="absolute inset-0 bg-[radial-gradient(#039C51_1px,transparent_1px)] [background-size:40px_40px] opacity-[0.05]"></div>
        )}
      </div>

      <div className="relative z-0">
        <FloatingIcons />
      </div>

      <div className="relative z-10">
        <PublicNavbar />

        <main className="pt-32 pb-24 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            
            {/* Header / Hero */}
            <div className="text-center space-y-4 mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#039C51]/10 text-[#039C51] text-sm font-bold shadow-[0_0_15px_rgba(3,156,81,0.1)]">
                <Globe className="w-4 h-4 animate-spin-slow" />
                Légal & Réglementation
              </div>
              <h1 className="text-4xl md:text-5xl font-black">
                Centre de <span className="text-[#039C51]">Conformité</span>
              </h1>
              <p className={`text-lg max-w-2xl mx-auto font-medium ${textColor}`}>
                Retrouvez nos mentions légales, politiques de gestion des données et conditions d'accès à la plateforme AynTrace.
              </p>
            </div>

            {/* Main Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Sidebar Menu (Desktop) / Horizontal Tabs (Mobile) */}
              <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-24">
                
                {/* Desktop Sticky Sidebar */}
                <div className={`hidden lg:block p-6 rounded-3xl ${glassPanel} space-y-2`}>
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#039C51] px-3 mb-4">Documents Légaux</h3>
                  {SECTIONS.map((sec) => {
                    const Icon = sec.icon;
                    const isActive = activeSection === sec.id;
                    return (
                      <button
                        key={sec.id}
                        onClick={() => handleSectionChange(sec.id)}
                        className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all duration-300 ${
                          isActive
                            ? 'bg-[#039C51] text-white shadow-[0_10px_20px_rgba(3,156,81,0.25)] font-bold scale-[1.02]'
                            : `${isDark ? 'text-white/70 hover:bg-white/5 hover:text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'}`
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[#039C51]'}`} />
                        <div>
                          <div className="text-sm font-extrabold">{sec.title}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Tabs */}
                <div className="lg:hidden flex flex-col gap-2">
                  <div className={`flex flex-wrap p-2 rounded-2xl ${glassPanel} gap-1 justify-center`}>
                    {SECTIONS.map((sec) => {
                      const Icon = sec.icon;
                      const isActive = activeSection === sec.id;
                      return (
                        <button
                          key={sec.id}
                          onClick={() => handleSectionChange(sec.id)}
                          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${
                            isActive
                              ? 'bg-[#039C51] text-white shadow-md'
                              : `${isDark ? 'text-white/70 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'}`
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {sec.title}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Contact Card */}
                <div className={`p-8 rounded-3xl ${cardBg} text-center space-y-4`}>
                  <div className="w-12 h-12 rounded-2xl bg-[#039C51]/10 flex items-center justify-center mx-auto text-[#039C51]">
                    <Phone className="w-6 h-6" />
                  </div>
                  <h4 className={`font-black text-lg ${titleColor}`}>Besoin d'éclaircissements ?</h4>
                  <p className={`text-sm font-medium leading-relaxed ${textColor}`}>
                    Pour toute question relative à vos données ou à nos conditions, contactez notre délégué à la protection des données.
                  </p>
                  <div className="pt-2 space-y-2 text-sm font-bold">
                    <a href="tel:+21671000000" className="flex items-center justify-center gap-2 text-[#039C51] hover:underline">
                      <Phone className="w-4 h-4" /> +216 71 000 000
                    </a>
                    <a href="mailto:contact@ayntrace.tn" className="flex items-center justify-center gap-2 text-[#039C51] hover:underline">
                      <Mail className="w-4 h-4" /> contact@ayntrace.tn
                    </a>
                  </div>
                </div>
              </div>

              {/* Content Panel */}
              <div className="lg:col-span-8">
                <div className={`p-6 sm:p-10 md:p-12 rounded-3xl ${glassPanel} shadow-xl space-y-8 min-h-[600px]`}>
                  
                  {activeSection === 'mentions' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="border-b border-[#039C51]/10 pb-6">
                        <h2 className={`text-2xl sm:text-3xl font-black ${titleColor}`}>Mentions Légales</h2>
                        <p className={`text-sm font-semibold text-[#039C51] mt-1`}>Dernière mise à jour : Mai 2026</p>
                      </div>

                      <div className="space-y-6 text-base font-medium leading-relaxed">
                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            1. Présentation de la Plateforme
                          </h3>
                          <p className={textColor}>
                            La plateforme logicielle et le site internet <strong>AynTrace</strong> (ci-après « la Plateforme ») sont édités par la société <strong>AynTrace Technologies SARL</strong>, société de droit tunisien au capital de 10 000 TND.
                          </p>
                          <ul className={`list-disc pl-6 space-y-1 ${textColor}`}>
                            <li><strong>RNE / Registre National des Entreprises :</strong> TN-1234567-X</li>
                            <li><strong>Identifiant Unique :</strong> 1234567X/A/M/000</li>
                            <li><strong>Siège Social :</strong> Avenue Mohamed V, Tunis 1002, Tunisie</li>
                          </ul>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            2. Directeur de la Publication
                          </h3>
                          <p className={textColor}>
                            Le directeur de la publication et responsable légal de la plateforme est <strong>M. Achraf Lgu</strong>, en sa qualité de Gérant fondateur de AynTrace Technologies SARL.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            3. Hébergement des Données
                          </h3>
                          <p className={textColor}>
                            La sécurité de vos données est notre priorité absolue. L'hébergement de l'infrastructure applicative et des bases de données de la Plateforme est assuré en Europe de l'Ouest sur les serveurs hautement sécurisés d'<strong>Amazon Web Services (AWS)</strong>.
                          </p>
                          <p className={textColor}>
                            Les sauvegardes de données de géolocalisation et historiques sont également stockées de manière chiffrée sur des serveurs secondaires distants répondant aux normes ISO/IEC 27001.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            4. Propriété Intellectuelle
                          </h3>
                          <p className={textColor}>
                            La structure générale, les textes, images animées ou non, le savoir-faire, les designs, logos et codes sources composant la Plateforme sont la propriété exclusive de AynTrace Technologies SARL. 
                          </p>
                          <p className={textColor}>
                            Toute reproduction ou représentation totale ou partielle de ce site ou de ses composants, par quelque procédé que ce soit, sans l'autorisation expresse et écrite de l'éditeur est interdite et constituerait une contrefaçon sanctionnée par le Code de la Propriété Intellectuelle tunisien.
                          </p>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeSection === 'confidentialite' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="border-b border-[#039C51]/10 pb-6">
                        <h2 className={`text-2xl sm:text-3xl font-black ${titleColor}`}>Politique de Confidentialité</h2>
                        <p className={`text-sm font-semibold text-[#039C51] mt-1`}>Dernière mise à jour : Mai 2026</p>
                      </div>

                      <div className="space-y-6 text-base font-medium leading-relaxed">
                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            1. Données Collectées
                          </h3>
                          <p className={textColor}>
                            AynTrace collecte et traite des données nécessaires à la fourniture de son service de géolocalisation GPS. Les données collectées comprennent :
                          </p>
                          <ul className={`list-disc pl-6 space-y-1.5 ${textColor}`}>
                            <li><strong>Données de compte :</strong> Nom, adresse email, mot de passe chiffré, numéro de téléphone, et détails d'entreprise.</li>
                            <li><strong>Données de géolocalisation :</strong> Coordonnées de latitude et longitude en temps réel, vitesse, direction, et altitude des traceurs GPS liés à votre compte.</li>
                            <li><strong>Historique des trajets :</strong> Enregistrement des positions historiques pour générer les rapports d'itinéraires.</li>
                            <li><strong>Données système :</strong> État de la batterie des traceurs, qualité du réseau mobile, et statut d'allumage des véhicules.</li>
                          </ul>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            2. Finalité du Traitement
                          </h3>
                          <p className={textColor}>
                            Ces données sont collectées pour des finalités précises :
                          </p>
                          <ul className={`list-disc pl-6 space-y-1.5 ${textColor}`}>
                            <li>Affichage en temps réel de votre flotte ou de vos objets sur la carte.</li>
                            <li>Détection des alertes d'entrée/sortie de zones (Geofencing) et alertes d'excès de vitesse.</li>
                            <li>Génération d'analyses intelligentes par l'assistant IA AynTrace pour l'optimisation des trajets.</li>
                            <li>Gestion de la facturation et prévention de la fraude.</li>
                          </ul>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            3. Durée de Conservation
                          </h3>
                          <p className={textColor}>
                            Les données d'historique de géolocalisation (trajets) sont conservées par défaut pendant une période de <strong>12 mois</strong> afin de vous permettre de consulter vos rapports trimestriels et annuels. Passé ce délai, ces données sont purgées ou anonymisées définitivement de nos serveurs principaux.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            4. Protection des Données Personnelles (INPDP)
                          </h3>
                          <p className={textColor}>
                            AynTrace s'engage à respecter la loi organique tunisienne n° 2004-63 du 27 juillet 2004 relative à la protection des données à caractère personnel. Nous mettons en œuvre toutes les mesures techniques pour empêcher tout accès non autorisé à vos données.
                          </p>
                          <p className={textColor}>
                            Vous disposez d'un droit d'accès, de rectification et d'effacement de vos données personnelles. Vous pouvez exercer ce droit à tout moment en envoyant un courriel à l'adresse suivante : <strong>privacy@ayntrace.tn</strong>.
                          </p>
                        </section>
                      </div>
                    </div>
                  )}

                  {activeSection === 'conditions' && (
                    <div className="space-y-6 animate-in fade-in duration-300">
                      <div className="border-b border-[#039C51]/10 pb-6">
                        <h2 className={`text-2xl sm:text-3xl font-black ${titleColor}`}>Conditions d'Utilisation</h2>
                        <p className={`text-sm font-semibold text-[#039C51] mt-1`}>Dernière mise à jour : Mai 2026</p>
                      </div>

                      <div className="space-y-6 text-base font-medium leading-relaxed">
                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            1. Conditions d'Accès
                          </h3>
                          <p className={textColor}>
                            L'accès à la plateforme AynTrace nécessite la création d'un compte utilisateur et la souscription à l'une de nos formules (Starter ou Pro). L'accès aux fonctionnalités de géorepérage (Geofencing) et d'IA nécessite l'activation du Plan Pro ou Enterprise.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            2. Responsabilité de l'Utilisateur
                          </h3>
                          <p className={textColor}>
                            L'utilisateur est seul responsable du matériel de tracking GPS installé dans ses véhicules ou confié à ses employés. Il lui appartient de veiller au respect de la législation en vigueur relative à la géolocalisation des salariés :
                          </p>
                          <ul className={`list-disc pl-6 space-y-1.5 ${textColor}`}>
                            <li>Informer préalablement les salariés de la mise en place d'un système de géolocalisation.</li>
                            <li>Ne pas utiliser la géolocalisation pour surveiller un salarié en dehors de ses heures de travail.</li>
                            <li>Obtenir les autorisations administratives nécessaires auprès des autorités compétentes si requis.</li>
                          </ul>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            3. Facturation, Renouvellement et Suspension
                          </h3>
                          <p className={textColor}>
                            Les abonnements aux services AynTrace sont facturés d'avance. La date d'échéance de votre abonnement (`billing_next_due`) est indiquée sur votre tableau de bord.
                          </p>
                          <p className={textColor}>
                            Si aucun mode de paiement valide n'est enregistré à la date de renouvellement, l'abonnement passera en état suspendu. L'accès à la plateforme sera immédiatement bloqué jusqu'au règlement de la facture et à l'enregistrement d'une carte bancaire valide.
                          </p>
                        </section>

                        <section className="space-y-3">
                          <h3 className={`text-xl font-bold ${titleColor} flex items-center gap-2`}>
                            <span className="w-1.5 h-6 rounded-full bg-[#039C51]" />
                            4. Limitation de Garantie
                          </h3>
                          <p className={textColor}>
                            Le bon fonctionnement d'AynTrace dépend de facteurs externes : couverture du réseau cellulaire mobile (TT, Ooredoo, Orange) et réception des signaux satellites GPS. AynTrace s'engage sur une obligation de moyens, mais ne saurait garantir un fonctionnement ininterrompu dans les zones géographiques non couvertes ou en cas de force majeure.
                          </p>
                        </section>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

            {/* Bottom CTA Block */}
            <div className={`mt-20 p-10 md:p-14 rounded-[3rem] ${isDark ? 'border border-white/5 bg-gradient-to-br from-[#142438]/90 to-[#0F1D2E]/90 shadow-[0_20px_50px_rgba(3,156,81,0.15)] ring-1 ring-[#039C51]/20' : 'border border-white bg-white/40 shadow-2xl'} backdrop-blur-2xl text-center relative overflow-hidden`}>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#039C51]/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="relative z-10 space-y-6">
                <h2 className="text-3xl font-extrabold">Rejoignez AynTrace dès aujourd'hui</h2>
                <p className={`max-w-md mx-auto font-medium text-base ${textColor}`}>
                  Commencez à suivre vos actifs en temps réel avec la solution la plus performante de Tunisie.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4 pt-2">
                  <Button
                    className="w-full sm:w-auto bg-[#039C51] text-white hover:bg-emerald-500 font-bold rounded-full px-8 h-14 shadow-lg hover:scale-105 transition-all text-base"
                    onClick={() => setJoinOpen(true)}
                  >
                    {t('nav.join')}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    className={`w-full sm:w-auto bg-transparent ${isDark ? 'border-white/20 text-white hover:bg-white/10 hover:text-white' : 'border-[#039C51]/30 text-slate-800 hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]'} rounded-full px-8 h-14 font-bold text-base shadow-sm`}
                    onClick={() => setDemoOpen(true)}
                  >
                    Essayer la Démo
                  </Button>
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
        .animate-spin-slow {
          animation: spin 8s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LegalPage;
