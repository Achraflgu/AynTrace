import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAppStore, useAuthStore } from '@/lib/store';
import { SupportChat } from '@/components/support/SupportChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
    PlusCircle,
    MessageSquare,
    Clock,
    CheckCircle,
    Search,
    Filter,
    ChevronRight,
    HelpCircle,
    Send
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const SupportCenter: React.FC = () => {
    const { user } = useAuthStore();
    const {
        supportTickets,
        fetchTickets,
        activeTicketId,
        setActiveTicketId,
        createTicket
    } = useAppStore();

    const [isCreating, setIsCreating] = useState(false);
    const [newSubject, setNewSubject] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSubject.trim() || !newMessage.trim()) return;

        await createTicket(newSubject.trim(), newMessage.trim());
        setIsCreating(false);
        setNewSubject('');
        setNewMessage('');
    };

    const filteredTickets = supportTickets.filter(t => {
        const matchesSearch = t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.userName.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <DashboardLayout>
            <div className="h-screen flex flex-col overflow-hidden bg-background">
                {/* Header */}
                <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <HelpCircle className="w-6 h-6 text-primary" />
                                Support & Assistance
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                {user?.role === 'admin'
                                    ? 'Gestion des signalements et rapports utilisateurs'
                                    : 'Signalez un problème ou posez une question à l\'équipe'}
                            </p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 bg-secondary/50 border-0 h-9"
                                />
                            </div>
                            {user?.role !== 'admin' && (
                                <Button
                                    onClick={() => setIsCreating(true)}
                                    className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-glow"
                                    size="sm"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Nouveau rapport
                                </Button>
                            )}
                        </div>
                    </div>
                </header>

                {/* Main Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar: Ticket List */}
                    <div className="w-1/3 max-w-sm border-r border-border/50 flex flex-col bg-card/30">
                        <div className="p-4 border-b border-border/30">
                            <div className="flex gap-2">
                                {(['all', 'open', 'closed'] as const).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setStatusFilter(s)}
                                        className={cn(
                                            "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all border",
                                            statusFilter === s
                                                ? "bg-primary/10 border-primary/20 text-primary"
                                                : "bg-transparent border-transparent text-muted-foreground hover:bg-secondary/50"
                                        )}
                                    >
                                        {s === 'all' ? 'Tous' : s === 'open' ? 'Ouverts' : 'Résolus'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="divide-y divide-border/30">
                                {filteredTickets.length === 0 ? (
                                    <div className="p-12 text-center">
                                        <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                                        <p className="text-sm text-muted-foreground">Aucun rapport trouvé</p>
                                    </div>
                                ) : (
                                    filteredTickets.map(ticket => (
                                        <button
                                            key={ticket.id}
                                            onClick={() => {
                                                setActiveTicketId(ticket.id);
                                                setIsCreating(false);
                                            }}
                                            className={cn(
                                                "w-full p-5 text-left transition-all hover:bg-secondary/40 relative group",
                                                activeTicketId === ticket.id ? "bg-primary/5 active-sidebar-item" : ""
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge
                                                    variant={ticket.status === 'open' ? 'default' : 'secondary'}
                                                    className={cn(
                                                        "text-[10px] px-1.5 py-0",
                                                        ticket.status === 'open' ? "bg-primary/20 text-primary border-0" : ""
                                                    )}
                                                >
                                                    {ticket.status === 'open' ? 'OUVERT' : 'RÉSOLU'}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {format(new Date(ticket.lastMessageAt || ticket.createdAt), 'dd MMM HH:mm', { locale: fr })}
                                                </span>
                                            </div>
                                            <h3 className={cn(
                                                "text-sm font-semibold truncate mb-1",
                                                activeTicketId === ticket.id ? "text-primary" : "text-foreground"
                                            )}>
                                                {ticket.subject}
                                            </h3>
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs text-muted-foreground truncate line-clamp-1 italic flex-1">
                                                    {ticket.lastMessage || 'Initialisation...'}
                                                </p>
                                                <ChevronRight className={cn(
                                                    "w-3 h-3 text-muted-foreground transition-transform",
                                                    activeTicketId === ticket.id ? "translate-x-1 text-primary" : "group-hover:translate-x-1"
                                                )} />
                                            </div>

                                            {activeTicketId === ticket.id && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Chat or Form Area */}
                    <div className="flex-1 bg-background flex flex-col relative overflow-hidden">
                        {isCreating ? (
                            <div className="flex-1 flex items-center justify-center p-8 bg-secondary/10">
                                <Card className="w-full max-w-xl glass-card border-0 animate-slide-up">
                                    <CardHeader>
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <HelpCircle className="w-5 h-5 text-primary" />
                                            Nouveau Rapport
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handleCreate} className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sujet</label>
                                                <Input
                                                    required
                                                    value={newSubject}
                                                    onChange={(e) => setNewSubject(e.target.value)}
                                                    placeholder="ex: Problème de connexion GPS"
                                                    className="bg-secondary/30 border-0 focus:ring-primary/20"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message</label>
                                                <textarea
                                                    required
                                                    value={newMessage}
                                                    onChange={(e) => setNewMessage(e.target.value)}
                                                    placeholder="Décrivez votre problème précisément..."
                                                    className="w-full min-h-[160px] p-3 rounded-lg bg-secondary/30 border-0 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm resize-none"
                                                />
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    className="flex-1"
                                                    onClick={() => setIsCreating(false)}
                                                >
                                                    Annuler
                                                </Button>
                                                <Button
                                                    type="submit"
                                                    className="flex-1 bg-primary text-white shadow-glow"
                                                    disabled={!newSubject.trim() || !newMessage.trim()}
                                                >
                                                    <Send className="w-4 h-4 mr-2" />
                                                    Envoyer le rapport
                                                </Button>
                                            </div>
                                        </form>
                                    </CardContent>
                                </Card>
                            </div>
                        ) : activeTicketId ? (
                            <SupportChat ticketId={activeTicketId} />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6 animate-pulse-slow">
                                    <MessageSquare className="w-10 h-10 text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Centre de Support</h2>
                                <p className="text-muted-foreground max-w-sm mx-auto mb-8">
                                    {user?.role === 'admin'
                                        ? 'Sélectionnez un ticket pour répondre aux utilisateurs et résoudre leurs problèmes.'
                                        : 'Sélectionnez une discussion en cours ou créez un nouveau rapport.'}
                                </p>
                                {user?.role !== 'admin' && (
                                    <Button
                                        onClick={() => setIsCreating(true)}
                                        size="lg"
                                        className="bg-primary text-white h-14 px-8 rounded-2xl shadow-glow gap-3 text-lg font-semibold"
                                    >
                                        <PlusCircle className="w-6 h-6" />
                                        Ouvrir un ticket
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default SupportCenter;
