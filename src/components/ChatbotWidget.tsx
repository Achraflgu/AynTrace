import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, User, Bot, Sparkles, RotateCcw, Minus, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

const CHAT_SESSION_KEY = 'ayntrace_chat_session';
const CHAT_HISTORY_KEY = 'ayntrace_chat_history';
const CHAT_SEEN_KEY = 'ayntrace_chat_seen';
const API_BASE = '/api';

interface ChatMessage {
    id: string;
    text: string;
    sender: 'user' | 'bot';
    timestamp: number;
}

const i18nChat = {
    headerTitle: { fr: 'Assistant AynTrace', en: 'AynTrace Assistant' },
    headerSub: { fr: '• Agent pour les visiteurs', en: '• Agent for visitors' },
    welcomeMsg: {
        fr: "👋 Bonjour ! Je suis l'assistant IA AynTrace.\n\nPosez-moi vos questions sur notre plateforme GPS ou commandez directement ici !",
        en: "👋 Hello! I'm the AynTrace AI assistant.\n\nAsk me anything about our GPS platform or place an order right here!",
    },
    previewBubble: {
        fr: "👋 Besoin d'aide ? Je suis là pour vous !",
        en: "👋 Need help? I'm here for you!",
    },
    placeholder: { fr: 'Écrivez votre message...', en: 'Type your message...' },
    thinking: { fr: 'Réflexion...', en: 'Thinking...' },
    newChat: { fr: 'Nouvelle conversation', en: 'New conversation' },
    errorOffline: {
        fr: "⚠️ Service IA indisponible. Vérifiez que le serveur est en marche.",
        en: "⚠️ AI service unavailable. Please check the server is running.",
    },
    quickActions: {
        fr: [
            { label: "🛰️ C'est quoi ?", query: "C'est quoi AynTrace ?" },
            { label: '💰 Tarifs', query: 'Quels sont vos tarifs ?' },
            { label: '🛒 Commander', query: 'Je veux commander des GPS' },
            { label: '🚀 Démo', query: 'Comment essayer la démo ?' },
            { label: '📞 Contact', query: 'Comment vous contacter ?' },
            { label: '❓ FAQ', query: 'Quelles sont les questions fréquentes ?' },
            { label: '🛠️ Installation', query: "Comment se passe l'installation ?" },
            { label: '⚙️ Appareils', query: 'Quels types de trackers proposez-vous ?' },
            { label: '🌍 Couverture', query: 'Quelle est votre couverture réseau ?' },
        ],
        en: [
            { label: "🛰️ What is it?", query: "What is AynTrace?" },
            { label: '💰 Pricing', query: 'What are your prices?' },
            { label: '🛒 Order', query: 'I want to order GPS trackers' },
            { label: '🚀 Demo', query: 'How can I try the demo?' },
            { label: '📞 Contact', query: 'How to contact you?' },
            { label: '❓ FAQ', query: 'What are the frequently asked questions?' },
            { label: '🛠️ Setup', query: 'How does vehicle installation work?' },
            { label: '⚙️ Devices', query: 'What kind of GPS trackers do you offer?' },
            { label: '🌍 Coverage', query: 'What is your GPS tracking coverage?' },
        ],
    },
};

export const ChatbotWidget = () => {
    const { lang } = useI18n();
    const t = (key: keyof typeof i18nChat) => i18nChat[key][lang] as string;

    const [isOpen, setIsOpen] = useState(false);
    const [actionPage, setActionPage] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
        });
    }, []);

    // Init session, restore history, auto-show preview for first-time visitors
    useEffect(() => {
        let sid = localStorage.getItem(CHAT_SESSION_KEY);
        if (!sid) {
            sid = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            localStorage.setItem(CHAT_SESSION_KEY, sid);
        }
        setSessionId(sid);

        try {
            const saved = localStorage.getItem(CHAT_HISTORY_KEY);
            if (saved) {
                const parsed = JSON.parse(saved) as ChatMessage[];
                if (parsed.length > 0) { setMessages(parsed); return; }
            }
        } catch { /* ignore */ }

        setMessages([{
            id: 'welcome',
            text: i18nChat.welcomeMsg[lang],
            sender: 'bot',
            timestamp: Date.now(),
        }]);

        // First-time visitor: show preview bubble after 2s
        const hasSeen = localStorage.getItem(CHAT_SEEN_KEY);
        if (!hasSeen) {
            const timer = setTimeout(() => setShowPreview(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    // Update welcome when lang changes
    useEffect(() => {
        setMessages(prev => prev.map(m =>
            m.id === 'welcome' ? { ...m, text: i18nChat.welcomeMsg[lang] } : m
        ));
    }, [lang]);

    // Save history
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
        }
    }, [messages]);

    // Auto-scroll
    useEffect(() => {
        if (isOpen && !isMinimized) scrollToBottom('smooth');
    }, [messages, isLoading, isOpen, isMinimized, scrollToBottom]);

    // Focus input and jump to latest message on open
    useEffect(() => {
        if (!isOpen || isMinimized) return;
        const timer = setTimeout(() => {
            scrollToBottom('auto');
            inputRef.current?.focus();
        }, 80);
        return () => clearTimeout(timer);
    }, [isOpen, isMinimized, scrollToBottom]);

    // Open chat from preview bubble
    const openFromPreview = () => {
        setShowPreview(false);
        setIsOpen(true);
        setIsMinimized(false);
        setTimeout(() => scrollToBottom('auto'), 80);
        localStorage.setItem(CHAT_SEEN_KEY, 'true');
    };

    // ─── Send message ────────────────────────────────────────────────
    const handleSendMessage = useCallback(async (e?: React.FormEvent, overrideMsg?: string) => {
        e?.preventDefault();
        const userMessage = (overrideMsg || inputMessage).trim();
        if (!userMessage || isLoading) return;

        setInputMessage('');

        const userMsg: ChatMessage = {
            id: `u-${Date.now()}`,
            text: userMessage,
            sender: 'user',
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage, sessionId }),
            });

            const data = await response.json();
            const reply = data.reply || data.error || (lang === 'fr'
                ? "Désolé, je n'ai pas pu traiter votre message."
                : "Sorry, I couldn't process your message.");

            setMessages(prev => [...prev, {
                id: `b-${Date.now()}`,
                text: reply,
                sender: 'bot',
                timestamp: Date.now(),
            }]);
        } catch {
            setMessages(prev => [...prev, {
                id: `e-${Date.now()}`,
                text: t('errorOffline'),
                sender: 'bot',
                timestamp: Date.now(),
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [inputMessage, isLoading, sessionId, lang]);

    // Reset
    const handleReset = useCallback(() => {
        const newSid = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem(CHAT_SESSION_KEY, newSid);
        localStorage.removeItem(CHAT_HISTORY_KEY);
        setSessionId(newSid);
        setMessages([{
            id: `welcome-${Date.now()}`,
            text: i18nChat.welcomeMsg[lang],
            sender: 'bot',
            timestamp: Date.now(),
        }]);
    }, [lang]);

    const quickActions = i18nChat.quickActions[lang];
    const ACTIONS_PER_PAGE = 3;
    const totalPages = Math.ceil(quickActions.length / ACTIONS_PER_PAGE);
    const visibleActions = quickActions.slice(actionPage * ACTIONS_PER_PAGE, (actionPage + 1) * ACTIONS_PER_PAGE);

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

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none">
            {/* ── Chat Window ───────────────────────────────────────── */}
            {isOpen && !isMinimized && (
                <div className="pointer-events-auto w-[calc(100vw-3rem)] sm:w-[400px] h-[650px] max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300 origin-bottom-right
                    bg-white/95 dark:bg-[#0B1829]/95 backdrop-blur-2xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] border border-gray-200/50 dark:border-white/10 relative">

                    {/* Abstract background glows */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#039C51] rounded-full mix-blend-multiply filter blur-[80px] opacity-[0.15] dark:opacity-[0.07] pointer-events-none" />

                    {/* Header */}
                    <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-gray-100 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] flex items-center justify-center shadow-lg shadow-[#039C51]/20">
                                    <Bot className="w-5 h-5 text-white" />
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#039C51] border-2 border-white dark:border-[#0B1829]" />
                            </div>
                            <div>
                                <h3 className="font-bold text-[#0B1829] dark:text-white text-[15px] leading-tight">{t('headerTitle')}</h3>
                                <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{t('headerSub')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={handleReset} title={t('newChat')}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-white/60">
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button onClick={() => setIsOpen(false)}
                                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500 dark:text-white/60">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 px-5 py-4 overflow-y-auto flex flex-col gap-4 relative z-10 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-white/10">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-3 max-w-[88%] ${msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${msg.sender === 'user'
                                    ? 'bg-[#0B1829] dark:bg-white text-white dark:text-black'
                                    : 'bg-gradient-to-br from-[#039C51] to-[#00C27A] text-white'
                                    }`}>
                                    {msg.sender === 'user'
                                        ? <User className="w-4 h-4" />
                                        : <Sparkles className="w-4 h-4" />}
                                </div>
                                <div className={`px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line shadow-sm overflow-hidden break-words ${msg.sender === 'user'
                                    ? 'bg-[#0B1829] dark:bg-white text-white dark:text-[#0B1829] rounded-[20px] rounded-tr-[4px]'
                                    : 'bg-white dark:bg-[#151A28] border border-gray-100 dark:border-white/5 text-gray-800 dark:text-white/90 rounded-[20px] rounded-tl-[4px]'
                                    }`}>
                                    <div
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                                        className="[&_strong]:font-bold [&_a]:font-semibold [&_a]:text-[#039C51] [&_a]:underline [&_a]:underline-offset-2"
                                    />
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex gap-3 max-w-[85%] self-start animate-in fade-in">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                                <div className="px-5 py-3.5 rounded-[20px] rounded-tl-[4px] bg-white dark:bg-[#151A28] border border-gray-100 dark:border-white/5 shadow-sm flex items-center gap-2">
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

                    {/* Quick Actions — Simple Pagination */}
                    <div className="px-4 pb-2 pt-2 relative z-10 shrink-0 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#1A2133]/50">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 grid grid-cols-3 gap-2">
                                {visibleActions.map((a) => (
                                    <button
                                        key={a.label}
                                        onClick={() => handleSendMessage(undefined, a.query)}
                                        disabled={isLoading}
                                        className="flex items-center justify-center px-1.5 py-2 rounded-xl text-[10.5px] sm:text-[11.5px] font-semibold transition-all duration-200
                                            bg-white dark:bg-[#151A28] text-gray-700 dark:text-white/80 border border-gray-200/50 dark:border-white/10 shadow-[0_2px_10px_rgba(0,0,0,0.02)]
                                            hover:shadow-md hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]/40 hover:-translate-y-0.5
                                            disabled:opacity-50 disabled:cursor-not-allowed text-center truncate"
                                    >
                                        <span className="truncate w-full">{a.label}</span>
                                    </button>
                                ))}
                            </div>
                            
                            {totalPages > 1 && (
                                <button
                                    onClick={() => setActionPage(p => (p + 1) % totalPages)}
                                    title={lang === 'fr' ? "Voir plus" : "See more"}
                                    className="shrink-0 w-[38px] flex flex-col items-center justify-center rounded-xl bg-white dark:bg-[#151A28] border border-gray-200/50 dark:border-white/10 shadow-sm text-gray-500 dark:text-white/50 hover:bg-[#039C51]/10 hover:text-[#039C51] hover:border-[#039C51]/40 transition-all duration-200 self-stretch"
                                >
                                    <MoreHorizontal className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="p-4 pt-2 bg-gradient-to-t from-white via-white dark:from-[#0B1829] dark:via-[#0B1829] to-transparent relative z-10 shrink-0">
                        <form onSubmit={handleSendMessage} className="relative flex items-center">
                            <input ref={inputRef} value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                                placeholder={t('placeholder')}
                                disabled={isLoading}
                                className="w-full pl-5 pr-14 py-4 rounded-full text-[14.5px] transition-all duration-300
                                    bg-gray-100/80 dark:bg-[#1A2133]/80 backdrop-blur-sm
                                    text-[#0B1829] dark:text-white font-medium
                                    placeholder:text-gray-400 dark:placeholder:text-white/40
                                    border-transparent focus:border-[#039C51]/50
                                    focus:outline-none focus:ring-4 focus:ring-[#039C51]/10 focus:bg-white dark:focus:bg-[#151A28]
                                    disabled:opacity-50 shadow-inner" />
                            <Button type="submit" size="icon"
                                className={`absolute right-1.5 w-10 h-10 rounded-full transition-all duration-300 ${inputMessage.trim() && !isLoading ? 'bg-[#039C51] text-white shadow-md hover:bg-[#00D48A] scale-100' : 'bg-gray-300 dark:bg-white/10 text-gray-500 dark:text-white/40 scale-90'}`}
                                disabled={!inputMessage.trim() || isLoading}>
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

            {/* ── Minimized Bar ─────────────────────────────────────── */}
            {isOpen && isMinimized && (
                <button onClick={() => {
                    setIsMinimized(false);
                    setTimeout(() => scrollToBottom('auto'), 80);
                }}
                    className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-full shadow-[0_8px_30px_-8px_rgba(0,0,0,0.3)] transition-all duration-300
                        bg-white dark:bg-[#151A28] border border-gray-200 dark:border-white/10
                        hover:scale-105 hover:border-[#039C51]/40 animate-in slide-in-from-bottom-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] flex items-center justify-center shadow-inner">
                        <Bot className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[14.5px] font-bold text-gray-800 dark:text-white/90">{t('headerTitle')}</span>
                </button>
            )}

            {/* ── Welcome Preview Bubble ─────────────────────────────── */}
            {!isOpen && showPreview && (
                <div className="pointer-events-auto animate-in slide-in-from-right-8 fade-in shrink-0 duration-500 flex items-end gap-2 mb-2 origin-bottom-right">
                    <button onClick={openFromPreview}
                        className="group max-w-[280px] p-4 rounded-[24px] rounded-br-sm shadow-xl transition-all duration-300 text-left
                            bg-white dark:bg-[#151A28] border border-gray-100 dark:border-white/5
                            hover:shadow-2xl hover:border-[#039C51]/40 hover:-translate-y-1">
                        <p className="text-[14px] text-gray-700 dark:text-white/80 leading-relaxed">
                            {i18nChat.previewBubble[lang]}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] text-[#039C51] mt-2 font-bold uppercase tracking-wider group-hover:gap-2 transition-all">
                            {lang === 'fr' ? 'Cliquer pour discuter' : 'Click to chat'}
                            <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                    </button>
                    <button onClick={() => setShowPreview(false)}
                        className="w-7 h-7 rounded-full bg-white dark:bg-[#151A28] border border-gray-100 dark:border-white/10 shadow-md flex items-center justify-center
                            hover:bg-gray-100 dark:hover:bg-white/20 transition-colors mb-2 text-gray-400 hover:text-gray-700 dark:hover:text-white">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* ── Floating Main Button (Expanded Pill Style) ──────────────── */}
            <button onClick={() => {
                setShowPreview(false);
                const nextOpen = !isOpen;
                setIsOpen(nextOpen);
                setIsMinimized(false);
                if (nextOpen) setTimeout(() => scrollToBottom('auto'), 80);
                localStorage.setItem(CHAT_SEEN_KEY, 'true');
            }}
                className={`pointer-events-auto relative group flex items-center justify-center rounded-full transition-all duration-&lsqb;400ms&rsqb; ease-&lsqb;cubic-bezier(0.25,1,0.5,1)&rsqb;
                    bg-white dark:bg-[#151A28] border border-gray-200/80 dark:border-white/10
                    shadow-[0_8px_30px_-8px_rgba(0,0,0,0.15)] dark:shadow-[0_8px_30px_-8px_rgba(0,0,0,0.6)]
                    hover:shadow-[0_12px_40px_-10px_rgba(3,156,81,0.3)] hover:border-[#039C51]/40
                    hover:-translate-y-1 active:scale-[0.97] active:translate-y-0 z-50 overflow-hidden
                    ${isOpen && !isMinimized ? 'w-14 h-14 px-0' : 'w-auto h-14 max-w-[240px] px-2'}`}>

                {/* Subtle gradient sweep background on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#039C51]/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10 flex items-center gap-3">
                    {isOpen && !isMinimized ? (
                        <X className="w-6 h-6 text-gray-600 dark:text-white/80 transition-transform duration-300 rotate-90 scale-in" />
                    ) : (
                        <>
                            {/* Animated Bot Avatar Container */}
                            <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-[#039C51] to-[#00C27A] shadow-[0_0_15px_rgba(3,156,81,0.3)] shrink-0">
                                <Bot className="w-5 h-5 text-white" />
                                {/* Pinging online indicator */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#039C51] border-2 border-white dark:border-[#151A28] rounded-full z-10" />
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#039C51] rounded-full animate-ping opacity-75" />
                            </div>

                            {/* Text segment - visible only when closed */}
                            <div className="flex flex-col text-left pr-3 whitespace-nowrap">
                                <span className="text-[13.5px] font-extrabold text-[#0B1829] dark:text-white leading-none tracking-wide">
                                    {lang === 'fr' ? 'Assistant IA' : 'AI Assistant'}
                                </span>
                                <span className="text-[9.5px] text-[#039C51] font-bold tracking-widest uppercase mt-1 flex items-center gap-1.5 opacity-90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#039C51] inline-block shadow-[0_0_8px_#039C51]" />
                                    {lang === 'fr' ? 'En ligne' : 'Online'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </button>
        </div>
    );
};
