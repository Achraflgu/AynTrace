import { useRef, useEffect, useCallback, useState } from 'react';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dashboardChatApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import {
    Bot, X, Send, Sparkles, BarChart3, AlertTriangle, Radio,
    Battery, Gauge, MapPin, ChevronDown, Minus, MessageSquarePlus, RotateCcw, User,
    Building2, CreditCard, LifeBuoy, ChevronLeft, ChevronRight, MoreHorizontal
} from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

interface ChatStore {
    isOpen: boolean;
    messages: Message[];
    sessionId: string | null;
    loading: boolean;
    hasGreeted: boolean;
    input: string;
    userEmail: string | null;
    init: (email: string) => void;
    setIsOpen: (isOpen: boolean) => void;
    setMessages: (updater: Message[] | ((prev: Message[]) => Message[])) => void;
    setSessionId: (id: string | null) => void;
    setLoading: (loading: boolean) => void;
    setHasGreeted: (hasGreeted: boolean) => void;
    setInput: (input: string) => void;
    reset: () => void;
}

const useChatStore = create<ChatStore>((set, get) => {
    return {
        isOpen: false,
        messages: [],
        sessionId: null,
        loading: false,
        input: '',
        hasGreeted: false,
        userEmail: null,
        init: (email) => {
            if (get().userEmail === email) return;
            let savedOpen = false;
            let savedMessages: Message[] = [];
            let savedSession: string | null = null;
            try {
                savedOpen = localStorage.getItem(`dashboard_chat_open_${email}`) === 'true';
                const rawMsg = localStorage.getItem(`dashboard_chat_history_${email}`);
                if (rawMsg) savedMessages = JSON.parse(rawMsg).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
                savedSession = localStorage.getItem(`dashboard_chat_session_${email}`);
            } catch(e) {}

            set({
                userEmail: email,
                isOpen: savedOpen,
                messages: savedMessages,
                sessionId: savedSession,
                hasGreeted: savedMessages.length > 0
            });
        },
        setIsOpen: (isOpen) => {
            const email = get().userEmail;
            if (email) localStorage.setItem(`dashboard_chat_open_${email}`, isOpen ? 'true' : 'false');
            set({ isOpen });
        },
        setMessages: (updater) => set((state) => {
            const next = typeof updater === 'function' ? updater(state.messages) : updater;
            if (state.userEmail) localStorage.setItem(`dashboard_chat_history_${state.userEmail}`, JSON.stringify(next));
            return { messages: next };
        }),
        setSessionId: (id) => {
            const email = get().userEmail;
            if (!email) return set({ sessionId: id });
            if (id) localStorage.setItem(`dashboard_chat_session_${email}`, id);
            else localStorage.removeItem(`dashboard_chat_session_${email}`);
            set({ sessionId: id });
        },
        setLoading: (loading) => set({ loading }),
        setHasGreeted: (hasGreeted) => set({ hasGreeted }),
        setInput: (input) => set({ input }),
        reset: () => {
            const email = get().userEmail;
            if (email) {
                localStorage.removeItem(`dashboard_chat_history_${email}`);
                localStorage.removeItem(`dashboard_chat_session_${email}`);
            }
            set({ messages: [], sessionId: null, hasGreeted: false, input: '' });
        }
    };
});

const AIChatWidget = () => {
    const { lang } = useI18n();
    const { user } = useAuthStore();
    
    const { 
        isOpen, setIsOpen, 
        messages, setMessages, 
        sessionId, setSessionId, 
        loading, setLoading, 
        hasGreeted, setHasGreeted,
        input, setInput,
        init, reset 
    } = useChatStore();

    useEffect(() => {
        if (user?.email) {
            init(user.email);
        }
    }, [user?.email, init]);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const [actionPage, setActionPage] = useState(0);

    const isFr = lang === 'fr';

    const isAdmin = user?.role === 'admin' || user?.role === 'supervisor';

    const quickActions = isFr
        ? [
            { label: 'Résumé', icon: BarChart3 },
            { label: 'Alertes', icon: AlertTriangle },
            { label: 'Appareils', icon: Radio },
            { label: 'Batteries', icon: Battery },
            { label: 'Vitesse', icon: Gauge },
            { label: 'Zones', icon: MapPin },
            ...(isAdmin ? [
                { label: 'Commandes', icon: MessageSquarePlus },
                { label: 'Utilisateurs', icon: User },
                { label: 'Entreprises', icon: Building2 },
                { label: 'Facturation', icon: CreditCard },
            ] : [
                { label: 'Statistiques', icon: BarChart3 },
                { label: 'Mon compte', icon: User },
                { label: 'Facturation', icon: CreditCard },
                { label: 'Support', icon: LifeBuoy },
            ]),
        ]
        : [
            { label: 'Summary', icon: BarChart3 },
            { label: 'Alerts', icon: AlertTriangle },
            { label: 'Devices', icon: Radio },
            { label: 'Battery', icon: Battery },
            { label: 'Speed', icon: Gauge },
            { label: 'Zones', icon: MapPin },
            ...(isAdmin ? [
                { label: 'Orders', icon: MessageSquarePlus },
                { label: 'Users', icon: User },
                { label: 'Enterprises', icon: Building2 },
                { label: 'Billing', icon: CreditCard },
            ] : [
                { label: 'Statistics', icon: BarChart3 },
                { label: 'My account', icon: User },
                { label: 'Billing', icon: CreditCard },
                { label: 'Support', icon: LifeBuoy },
            ]),
        ];

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Scroll to bottom INSTANTLY when chat is opened (to show last message)
    useEffect(() => {
        if (isOpen && messages.length > 0) {
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
            }, 50);
        }
    }, [isOpen]);

    // Welcome message on first open
    useEffect(() => {
        if (isOpen && !hasGreeted && messages.length === 0) {
            setHasGreeted(true);
            const welcome: Message = {
                role: 'assistant',
                content: isFr
                    ? `👋 Bonjour **${user?.name || ''}**! Je suis l'assistant IA AynTrace.\n\nJe peux répondre à vos questions sur votre fleet en temps réel. Essayez les raccourcis ci-dessous ou posez votre question!`
                    : `👋 Hi **${user?.name || ''}**! I'm the AynTrace AI assistant.\n\nI can answer questions about your fleet in real-time. Try the shortcuts below or ask away!`,
                timestamp: new Date(),
            };
            setMessages([welcome]);
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, hasGreeted, isFr, user, messages.length, setHasGreeted, setMessages]);

    const sendMessage = useCallback(async (text: string) => {
        // Grab current loading state directly from store to avoid stale closures
        const isCurrentlyLoading = useChatStore.getState().loading;
        if (!text.trim() || isCurrentlyLoading) return;

        const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
        useChatStore.getState().setMessages(prev => [...prev, userMsg]);
        useChatStore.getState().setInput('');
        useChatStore.getState().setLoading(true);

        try {
            const result = await dashboardChatApi.send(text, useChatStore.getState().sessionId, {
                role: user?.role || 'operator',
                name: user?.name || 'User',
                enterpriseId: (user as any)?.enterpriseId || '',
                enterpriseName: (user as any)?.enterpriseName || '',
            }, lang);

            useChatStore.getState().setSessionId(result.sessionId);

            const aiMsg: Message = {
                role: 'assistant',
                content: result.reply,
                timestamp: new Date(),
            };
            useChatStore.getState().setMessages(prev => [...prev, aiMsg]);
        } catch (err: any) {
            useChatStore.getState().setMessages(prev => [...prev, {
                role: 'assistant',
                content: isFr ? '❌ Erreur de connexion. Réessayez.' : '❌ Connection error. Try again.',
                timestamp: new Date(),
            }]);
        } finally {
            useChatStore.getState().setLoading(false);
        }
    }, [user, isFr, lang]);

    // Small safe markdown renderer for AI output.
    const renderMarkdown = (text: string) => {
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

        return escaped
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(?!\*)([^*\n]+?)\*/g, '<em class="not-italic font-semibold text-[#027A40] bg-[#039C51]/10 px-1.5 py-0.5 rounded-md">$1</em>')
            .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (_match, label, href) => {
                const target = href.startsWith('/') ? '_self' : '_blank';
                return `<a href="${href}" target="${target}" rel="noopener noreferrer">${label}</a>`;
            })
            .replace(/^\s{2,}- (.*)$/gm, '<span class="ml-4 inline-block"><span class="text-[#039C51]/70">-</span> $1</span>')
            .replace(/^- (.*)$/gm, '<span class="text-[#039C51]">•</span> $1')
            .replace(/^• (.*)$/gm, '<span class="text-[#039C51]">•</span> $1')
            .replace(/\n/g, '<br/>');
    };

    // AI Chat is a Pro/Enterprise feature for Operators.
    // Must be placed here *after* all hooks to avoid React "Rendered more hooks" errors.
    if (user?.role === 'operator') {
        const userPlan = (user as any)?.plan || 'starter';
        if (userPlan === 'starter') {
            return null;
        }
    }

    const roleString = user?.role === 'admin' 
        ? (isFr ? 'Assistant Administrateur' : 'Admin Assistant')
        : (isFr ? 'Assistant Opérateur' : 'Operator Assistant');

    const ACTIONS_PER_PAGE = 3;
    const totalPages = Math.ceil(quickActions.length / ACTIONS_PER_PAGE);
    const visibleActions = quickActions.slice(actionPage * ACTIONS_PER_PAGE, (actionPage + 1) * ACTIONS_PER_PAGE);

    return (
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-4 pointer-events-none">
            {/* Chat panel */}
            {isOpen && (
                <div className="pointer-events-auto w-[calc(100vw-3rem)] sm:w-[400px] h-[650px] max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 origin-bottom-right
                    bg-card/95 backdrop-blur-2xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-border/50 relative">
                    
                    {/* Abstract background glows */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#039C51] rounded-full mix-blend-screen filter blur-[80px] opacity-[0.05] pointer-events-none" />

                    {/* Header */}
                    <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-border/40 bg-card/60 backdrop-blur-md relative z-10 w-full">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] flex items-center justify-center shadow-lg shadow-[#039C51]/20">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#039C51] border-2 border-card" />
                            </div>
                            <div>
                                <h3 className="font-bold text-foreground text-[15px] leading-tight">AynTrace AI</h3>
                                <p className="text-xs text-muted-foreground mt-0.5 font-medium">{roleString}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={reset} title={isFr ? "Nouvelle conversation" : "New conversation"}
                                className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsOpen(false)} title={isFr ? "Fermer" : "Close"}
                                className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-5 relative z-10 scrollbar-thin scrollbar-thumb-muted">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3 max-w-[88%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${msg.role === 'user'
                                    ? 'bg-foreground text-background'
                                    : 'bg-gradient-to-br from-[#039C51] to-[#00C27A] text-white'
                                    }`}>
                                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                </div>
                                <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`px-4 py-3 text-[14px] leading-relaxed shadow-sm overflow-hidden break-words ${msg.role === 'user'
                                        ? 'bg-foreground text-background rounded-[20px] rounded-tr-[4px]'
                                        : 'bg-card border border-border text-foreground rounded-[20px] rounded-tl-[4px]'
                                        }`}>
                                        <div
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                            className="[&_strong]:font-bold [&_a]:font-semibold [&_a]:text-[#039C51] [&_a]:underline [&_a]:underline-offset-2 [&>p]:mb-2 last:[&>p]:mb-0 whitespace-pre-line"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground/50 px-1 font-semibold uppercase tracking-wider">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        ))}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex gap-3 max-w-[85%] self-start animate-in fade-in">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="px-5 py-3.5 rounded-[20px] rounded-tl-[4px] bg-card border border-border shadow-sm flex items-center gap-2.5">
                                    <div className="flex gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-[#039C51] animate-[bounce_1s_infinite]" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-[#039C51] animate-[bounce_1s_infinite]" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 rounded-full bg-[#039C51] animate-[bounce_1s_infinite]" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} className="h-2" />
                    </div>

                    {/* Quick actions - Simple Pagination */}
                    <div className="px-5 pb-2 pt-1 relative z-10 shrink-0 border-t border-border/30 bg-muted/10">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                                {visibleActions.map(({ label, icon: Icon }) => (
                                    <button
                                        key={label}
                                        onClick={() => sendMessage(label)}
                                        disabled={loading}
                                        className="flex items-center justify-center gap-1.5 px-1 py-2 rounded-xl text-[10px] sm:text-[11px] font-semibold transition-all duration-200
                                            bg-card text-muted-foreground border border-border shadow-[0_2px_10px_rgba(0,0,0,0.02)]
                                            hover:shadow-md hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]/40 hover:-translate-y-0.5
                                            disabled:opacity-50 disabled:cursor-not-allowed text-center"
                                    >
                                        <Icon className="w-3.5 h-3.5 text-[#039C51] shrink-0" />
                                        <span className="truncate">{label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {totalPages > 1 && (
                                <button
                                    onClick={() => setActionPage(p => (p + 1) % totalPages)}
                                    title={isFr ? "Voir plus" : "See more"}
                                    className="shrink-0 w-8 flex flex-col items-center justify-center rounded-xl bg-card border border-border shadow-sm text-muted-foreground hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]/40 transition-all duration-200 self-stretch"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 pt-2 bg-gradient-to-t from-card to-transparent relative z-10 shrink-0">
                        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="relative flex items-center">
                            <Input
                                ref={inputRef}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                placeholder={isFr ? 'Posez votre question...' : 'Ask me anything...'}
                                disabled={loading}
                                className="w-full pl-5 pr-14 py-6 rounded-full text-[14.5px] transition-all duration-300
                                    bg-muted/50 backdrop-blur-sm shadow-inner border-transparent focus:border-[#039C51]/50
                                    focus:ring-4 focus:ring-[#039C51]/10 focus:bg-background"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={loading || !input.trim()}
                                className={`absolute right-1.5 w-10 h-10 rounded-full transition-all duration-300 ${input.trim() && !loading ? 'bg-[#039C51] text-white shadow-md hover:bg-[#00D48A] scale-100' : 'bg-muted-foreground/20 text-muted-foreground scale-90'}`}
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </Button>
                        </form>
                    </div>

                    <style>{`
                        .no-scrollbar::-webkit-scrollbar { display: none; }
                        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                    `}</style>
                </div>
            )}

            {/* ── Floating Main Button (Expanded Pill Style) ──────────────── */}
            <button onClick={() => setIsOpen(!isOpen)}
                className={`pointer-events-auto relative group flex items-center justify-center rounded-full transition-all duration-&lsqb;400ms&rsqb; ease-&lsqb;cubic-bezier(0.25,1,0.5,1)&rsqb;
                    bg-card border border-border
                    shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)]
                    hover:shadow-[0_12px_40px_-10px_rgba(3,156,81,0.3)] hover:border-[#039C51]/40
                    hover:-translate-y-1 active:scale-[0.97] active:translate-y-0 z-50 overflow-hidden
                    ${isOpen ? 'w-14 h-14 px-0' : 'w-auto h-14 max-w-[260px] px-2'}`}>
                
                {/* Subtle gradient sweep background on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#039C51]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                <div className="relative z-10 flex items-center gap-3">
                    {isOpen ? (
                        <X className="w-6 h-6 text-foreground/80 transition-transform duration-300 rotate-90 scale-in" />
                    ) : (
                        <>
                            {/* Animated Bot Avatar */}
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] shadow-[0_0_15px_rgba(3,156,81,0.3)] shrink-0">
                                <Bot className="w-5 h-5 text-white" />
                                {/* Pinging indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#039C51] border-2 border-card rounded-full z-10" />
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#039C51] rounded-full animate-ping opacity-75" />
                            </div>
                            
                            {/* Text segment */}
                            <div className="flex flex-col text-left pr-3 whitespace-nowrap">
                                <span className="text-[13.5px] font-extrabold text-foreground leading-none tracking-wide">
                                    AynTrace AI
                                </span>
                                <span className="text-[9.5px] text-[#039C51] font-bold tracking-widest uppercase mt-1 flex items-center gap-1.5 opacity-90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#039C51] shadow-[0_0_8px_#039C51]" />
                                    {roleString}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </button>
        </div>
    );
};

export default AIChatWidget;
