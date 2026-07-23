import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X, Radio, ChevronRight, BookOpen } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import JoinPopup from '@/components/JoinPopup';
import { useTheme } from '@/lib/theme';
import { useI18n } from '@/lib/i18n';

interface DemoModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DemoModal = ({ isOpen, onClose }: DemoModalProps) => {
    const { login, logout } = useAuthStore();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const { t } = useI18n();
    const [phase, setPhase] = useState<'loading' | 'ready' | 'idle'>('idle');
    const [joinOpen, setJoinOpen] = useState(false);
    const hasStarted = useRef(false);

    const isDark = theme === 'dark';

    const startDemo = useCallback(async () => {
        if (hasStarted.current) return;
        hasStarted.current = true;
        setPhase('loading');

        await new Promise(r => setTimeout(r, 1200));

        const result = await login('demo@ayntrace.tn', 'demo');
        if (result.success) {
            setPhase('ready');
            return;
        }

        toast.error(t('demoModal.loginError'));
        setPhase('idle');
        hasStarted.current = false;
        onClose();
    }, [login, onClose, t]);

    useEffect(() => {
        if (isOpen && phase === 'idle') {
            startDemo();
        }
        if (!isOpen) {
            setPhase('idle');
            hasStarted.current = false;
        }
    }, [isOpen, phase, startDemo]);

    const handleClose = () => {
        logout();
        setPhase('idle');
        hasStarted.current = false;
        onClose();
    };

    return (
        <>
            <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) handleClose();
                }}
            >
                <DialogContent
                    className={`max-w-[1600px] w-[98vw] h-[96vh] backdrop-blur-xl rounded-2xl p-0 overflow-hidden flex flex-col gap-0 border-2 transition-colors duration-300 ${
                        isDark
                            ? 'bg-[#0B1829] border-orange-500/30 shadow-[0_0_80px_rgba(249,115,22,0.12)]'
                            : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,248,245,0.98))] border-[#039C51]/20 shadow-[0_25px_80px_rgba(20,41,69,0.18)]'
                    }`}
                >
                    <div
                        className={`h-14 shrink-0 flex items-center justify-between px-5 text-white relative z-50 shadow-lg transition-colors duration-300 ${
                            isDark
                                ? 'bg-gradient-to-r from-orange-600 to-orange-500'
                                : 'bg-gradient-to-r from-[#142945] via-[#173353] to-[#039C51]'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                <Radio className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <div className="font-bold text-sm tracking-wide">{t('demoModal.title')}</div>
                                <div className={`text-[11px] hidden sm:block ${isDark ? 'text-orange-100/80' : 'text-white/80'}`}>
                                    {t('demoModal.subtitle')}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                className="flex items-center justify-center focus:outline-none bg-white/10 text-white hover:bg-white/20 border border-white/20 font-semibold rounded-full px-4 text-xs h-8 gap-1.5 transition-colors shadow-sm"
                                onClick={() => {
                                    handleClose();
                                    navigate('/guide');
                                }}
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                {t('demoModal.guide')}
                            </button>
                            <button
                                className={`flex items-center gap-1.5 focus:outline-none font-bold rounded-full px-5 text-xs h-8 shadow-sm transition-colors ${
                                    isDark
                                        ? 'bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700'
                                        : 'bg-white text-[#142945] hover:bg-emerald-50 hover:text-[#039C51]'
                                }`}
                                onClick={() => setJoinOpen(true)}
                            >
                                {t('demoModal.join')}
                                <ChevronRight className="w-3.5 h-3.5 ml-1" />
                            </button>
                            <button
                                onClick={handleClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors ml-1"
                            >
                                <X className="w-4 h-4 text-white" />
                            </button>
                        </div>
                    </div>

                    <div
                        className={`flex-1 w-full relative transition-colors duration-300 ${
                            isDark
                                ? 'bg-[#0B1829]'
                                : 'bg-[radial-gradient(circle_at_top,rgba(3,156,81,0.08),transparent_45%),linear-gradient(180deg,#f8fbf9_0%,#eef5f1_100%)]'
                        }`}
                    >
                        {phase === 'loading' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                                <div className="relative mb-8">
                                    <div className="absolute -inset-6 border-2 border-dashed border-[#039C51]/20 rounded-full animate-[spin_8s_linear_infinite]" />
                                    <div className="absolute -inset-4 bg-[#039C51]/10 rounded-full animate-pulse" />
                                    <div className="absolute -inset-3 border-2 border-[#039C51]/30 rounded-full animate-[spin_3s_linear_infinite_reverse]" />
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-[#039C51] rounded-full shadow-[0_0_12px_#039C51] animate-[spin_3s_linear_infinite_reverse] origin-[50%_calc(50%+1.25rem)]" />

                                    <div className="w-20 h-20 rounded-2xl bg-[#039C51] flex items-center justify-center relative z-10 shadow-[0_0_40px_rgba(3,156,81,0.3)]">
                                        <Radio className="w-10 h-10 text-white" />
                                    </div>
                                </div>

                                <div className="text-center space-y-3">
                                    <h3 className={`text-2xl font-bold tracking-wide ${isDark ? 'text-white' : 'text-[#142945]'}`}>
                                        AynTrace
                                    </h3>
                                    <p className={`text-sm font-medium ${isDark ? 'text-white/50' : 'text-[#142945]/55'}`}>
                                        {t('demoModal.loading')}
                                    </p>
                                    <div className={`w-48 h-1 rounded-full mx-auto overflow-hidden mt-4 ${isDark ? 'bg-white/10' : 'bg-[#142945]/10'}`}>
                                        <div
                                            className="h-full bg-gradient-to-r from-[#039C51] to-[#039C51]/60 rounded-full animate-[loading_1.2s_ease-in-out_infinite]"
                                            style={{ width: '60%', animation: 'loading 1.2s ease-in-out infinite' }}
                                        />
                                    </div>
                                </div>

                                <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-[#039C51]/40 rounded-full animate-ping" />
                                <div
                                    className={`absolute top-1/3 right-1/3 w-1.5 h-1.5 rounded-full animate-ping ${isDark ? 'bg-orange-500/30' : 'bg-[#142945]/20'}`}
                                    style={{ animationDelay: '0.5s' }}
                                />
                                <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-[#039C51]/30 rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                            </div>
                        )}

                        {phase === 'ready' && (
                            <iframe
                                src="/dashboard"
                                className="w-full h-full border-0 absolute inset-0"
                                title="AynTrace Demo Dashboard"
                                style={{ opacity: 1, animation: 'fadeIn 0.6s ease-out' }}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <JoinPopup isOpen={joinOpen} onClose={() => setJoinOpen(false)} />

            <style>{`
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(80%); }
                    100% { transform: translateX(-100%); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </>
    );
};

export default DemoModal;
