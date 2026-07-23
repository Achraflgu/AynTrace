import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, useAuthStore } from '../../lib/store';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { Send, CheckCircle, Clock, User as UserIcon, Shield, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SupportChatProps {
    ticketId: string;
}

export const SupportChat: React.FC<SupportChatProps> = ({ ticketId }) => {
    const { user } = useAuthStore();
    const {
        supportTickets,
        supportMessages,
        fetchMessages,
        sendMessage,
        updateTicketStatus
    } = useAppStore();

    const [newMessage, setNewMessage] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const ticket = supportTickets.find(t => t.id === ticketId);
    const messages = supportMessages[ticketId] || [];

    useEffect(() => {
        fetchMessages(ticketId);
    }, [ticketId, fetchMessages]);

    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }
        }
    }, [messages]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        await sendMessage(ticketId, newMessage.trim());
        setNewMessage('');
    };

    const handleEndChat = async () => {
        setIsClosing(true);
        try {
            await updateTicketStatus(ticketId, 'closed');
            setShowConfirm(false);
            toast.success('✅ Discussion terminée avec succès');
        } catch (error) {
            console.error('[SupportChat] Error closing chat:', error);
            toast.error('Erreur lors de la fermeture');
        } finally {
            setIsClosing(false);
        }
    };

    if (!ticket) return null;

    const isClosed = ticket.status === 'closed';

    return (
        <div className="flex flex-col h-full bg-background overflow-hidden animate-in fade-in duration-300">
            {/* Header */}
            <div className="relative z-10 px-6 py-4 bg-card/50 border-b border-border/30 flex justify-between items-center backdrop-blur-md shadow-sm">
                <div>
                    <h3 className="text-base font-bold text-foreground">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            REPORTÉ PAR {ticket.userName}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                        <span className="text-[10px] text-muted-foreground font-medium">
                            {ticket.createdAt ? format(new Date(ticket.createdAt), 'dd MMMM yyyy', { locale: fr }) : '—'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge
                        variant={isClosed ? 'secondary' : 'default'}
                        className={cn(
                            "gap-1.5 px-3 py-1 border-0",
                            !isClosed && "bg-primary/20 text-primary"
                        )}
                    >
                        {!isClosed ? (
                            <><Clock className="w-3.5 h-3.5" /> Ouvert</>
                        ) : (
                            <><CheckCircle className="w-3.5 h-3.5" /> Résolu</>
                        )}
                    </Badge>

                    {user?.role === 'admin' && !isClosed && !showConfirm && (
                        <Button
                            variant="default"
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-white transition-all active:scale-95"
                            onClick={() => setShowConfirm(true)}
                        >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Terminer la discussion
                        </Button>
                    )}

                    {/* Inline confirm (replaces window.confirm) */}
                    {showConfirm && (
                        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-1.5 animate-in slide-in-from-right-2">
                            <span className="text-xs font-medium text-destructive">Confirmer ?</span>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs px-3"
                                disabled={isClosing}
                                onClick={handleEndChat}
                            >
                                {isClosing ? '...' : 'Oui, terminer'}
                            </Button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                className="text-muted-foreground hover:text-foreground ml-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages Area */}
            <ScrollArea ref={scrollRef} className="flex-1 px-6 py-8">
                <div className="space-y-6 max-w-4xl mx-auto">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-4">
                            <Clock className="w-12 h-12 opacity-10 animate-pulse" />
                            <p className="text-sm font-medium">Récupération de la discussion...</p>
                        </div>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.senderId === user?.id;
                            const isAdmin = msg.senderRole === 'admin';

                            return (
                                <div key={msg.id || idx} className={cn(
                                    "flex items-end gap-3",
                                    isMe ? "flex-row-reverse" : "flex-row"
                                )}>
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm",
                                        isAdmin ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"
                                    )}>
                                        {isAdmin ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                                    </div>

                                    <div className={cn(
                                        "flex flex-col max-w-[70%]",
                                        isMe ? "items-end" : "items-start"
                                    )}>
                                        <div className={cn(
                                            "rounded-2xl px-4 py-3 shadow-sm",
                                            isMe
                                                ? "bg-primary text-white rounded-br-none"
                                                : "bg-card border border-border/50 text-foreground rounded-bl-none"
                                        )}>
                                            {!isMe && (
                                                <p className={cn(
                                                    "text-[10px] font-bold uppercase tracking-tight mb-1",
                                                    isAdmin ? "text-primary" : "text-muted-foreground"
                                                )}>
                                                    {msg.senderName}
                                                </p>
                                            )}
                                            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                        </div>
                                        <span className="text-[10px] mt-1.5 text-muted-foreground font-medium px-1">
                                            {msg.createdAt ? format(new Date(msg.createdAt), 'HH:mm', { locale: fr }) : ''}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>

            {/* Input Area */}
            {!isClosed ? (
                <div className="p-4 bg-card/30 border-t border-border/30 backdrop-blur-sm">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto flex gap-3">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Tapez votre message ici..."
                            className="flex-1 bg-secondary/50 border-0 rounded-xl px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        />
                        <Button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="bg-primary hover:bg-primary/90 text-white h-[46px] w-[46px] p-0 flex items-center justify-center rounded-xl shadow-glow transition-transform active:scale-95"
                        >
                            <Send className="w-5 h-5" />
                        </Button>
                    </form>
                </div>
            ) : (
                <div className="p-6 bg-secondary/20 border-t border-border/20 text-center animate-in slide-in-from-bottom-2">
                    <p className="text-sm text-muted-foreground font-semibold flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4 text-primary" />
                        Ce ticket a été marqué comme résolu. La discussion est fermée.
                    </p>
                </div>
            )}
        </div>
    );
};
