import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen, CheckCircle2, Navigation, Settings, Smartphone } from 'lucide-react';

interface GuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const GuideModal = ({ isOpen, onClose }: GuideModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-background/95 backdrop-blur-xl border-border/50 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <BookOpen className="w-6 h-6 text-primary" />
                        Guide d'utilisation Rapide
                    </DialogTitle>
                    <DialogDescription>
                        Apprenez à utiliser AynTrace en quelques minutes.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-6 space-y-8">

                    {/* Step 1 */}
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Settings className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2">1. Installation et Configuration</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Une fois votre traceur reçu, notre équipe technique ou vous-même pouvez l'installer discrètement dans votre véhicule. Connectez-vous ensuite à votre espace client.
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Alimentation du traceur.</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Connexion au port OBD ou batterie.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Navigation className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2">2. Suivi en temps réel</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Accédez à l'onglet "Carte" (Map) depuis votre tableau de bord. Vous verrez l'ensemble de votre flotte actualisée toutes les 10 secondes.
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Statut du moteur (allumé/éteint).</li>
                                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success" /> Vitesse actuelle.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Smartphone className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold mb-2">3. Gestion des alertes</h3>
                            <p className="text-sm text-muted-foreground">
                                Configurez des zones géographiques (Geofencing) et recevez des notifications instantanées si vos véhicules sortent de la zone définie, ou en cas de dépassement de vitesse.
                            </p>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-xl border border-primary/20 bg-primary/5 mt-8">
                        <h4 className="font-semibold text-foreground mb-2">Besoin de plus d'aide ?</h4>
                        <p className="text-sm text-muted-foreground">
                            Notre équipe de support est disponible 24/7 pour vous assister. Utilisez le Chatbot en bas à droite ou contactez-nous par téléphone.
                        </p>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border/50">
                        <Button onClick={onClose}>J'ai compris</Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GuideModal;
