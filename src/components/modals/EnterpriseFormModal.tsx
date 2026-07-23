import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { Enterprise } from '@/lib/types';
import { toast } from 'sonner';
import { fetchApi } from '@/lib/api';

interface EnterpriseFormModalProps {
    open: boolean;
    onClose: () => void;
    enterprise?: Enterprise | null;
}

const EnterpriseFormModal = ({ open, onClose, enterprise }: EnterpriseFormModalProps) => {
    const { addEnterprise, updateEnterprise } = useAppStore();
    const isEditing = !!enterprise;

    const [formData, setFormData] = useState({
        name: '',
        contactEmail: '',
        phone: '',
        address: '',
        status: 'pending' as Enterprise['status'],
        serialPrefix: 'GT',
        imeiPrefix: '35907',
        subscriberPrefix: '500'
    });

    useEffect(() => {
        if (!open) return;

        if (enterprise) {
            setFormData({
                name: enterprise.name,
                contactEmail: enterprise.contactEmail,
                phone: enterprise.phone,
                address: enterprise.address,
                status: enterprise.status,
                serialPrefix: enterprise.serialPrefix || 'GT',
                imeiPrefix: enterprise.imeiPrefix || '35907',
                subscriberPrefix: enterprise.subscriberPrefix || '500',
            });
        } else {
            // Reset form first with defaults
            setFormData({
                name: '',
                contactEmail: '',
                phone: '',
                address: '',
                status: 'pending',
                serialPrefix: '',
                imeiPrefix: '35907',
                subscriberPrefix: '500',
            });

            // Then fetch suggested prefixes (with auth) — result overwrites only prefix fields
            fetchApi<{ imeiPrefix: string; subscriberPrefix: string }>('/enterprises/suggestions/next-prefixes')
                .then(data => {
                    if (data && !('error' in data)) {
                        setFormData(prev => ({
                            ...prev,
                            imeiPrefix: data.imeiPrefix || prev.imeiPrefix,
                            subscriberPrefix: data.subscriberPrefix || prev.subscriberPrefix,
                        }));
                    }
                })
                .catch(err => console.warn('Could not fetch prefix suggestions:', err));
        }
    }, [enterprise, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            if (isEditing && enterprise) {
                await updateEnterprise(enterprise.id, formData);
                toast.success('Entreprise mise à jour avec succès');
            } else {
                await addEnterprise(formData);
                toast.success('Entreprise créée avec succès');
            }
            onClose();
        } catch (err: any) {
            console.error('Error saving enterprise:', err);
            // check if error is from axios/fetch response
            const msg = err.response?.data?.error || err.message || "Échec de l'enregistrement";
            toast.error(msg);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? 'Modifier l\'entreprise' : 'Nouvelle entreprise'}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nom de l'entreprise</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => {
                                    const newName = e.target.value;
                                    if (!isEditing) {
                                        // Auto-generate serial prefix from initials (max 2-3 chars)
                                        const words = newName.trim().split(/\s+/);
                                        let newSerial = '';
                                        if (words.length >= 2) {
                                            newSerial = (words[0][0] + words[1][0]).toUpperCase();
                                        } else if (words.length === 1 && words[0].length >= 2) {
                                            newSerial = words[0].substring(0, 2).toUpperCase();
                                        }
                                        setFormData({ ...formData, name: newName, serialPrefix: newSerial || 'GT' });
                                    } else {
                                        setFormData({ ...formData, name: newName });
                                    }
                                }}
                                placeholder="Ex: TransLogistics SA"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactEmail">Email de contact</Label>
                            <Input
                                id="contactEmail"
                                type="email"
                                value={formData.contactEmail}
                                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                                placeholder="contact@entreprise.dz"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                            <Label htmlFor="phone">Téléphone</Label>
                            <Input
                                id="phone"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+213 21 45 67 89"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Adresse</Label>
                            <Input
                                id="address"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="Zone Industrielle, Alger"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Statut</Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value: Enterprise['status']) =>
                                setFormData({ ...formData, status: value })
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">En attente</SelectItem>
                                <SelectItem value="active">Actif</SelectItem>
                                <SelectItem value="suspended">Suspendu</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>


                    <div className="grid grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
                        <div className="col-span-3 pb-1">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configuration des identifiants</Label>
                            <p className="text-xs text-muted-foreground mt-0.5">Les appareils seront numérotés automatiquement selon ces préfixes.</p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="serialPrefix" className="text-xs">Préfixe Série</Label>
                            <Input
                                id="serialPrefix"
                                value={formData.serialPrefix}
                                onChange={(e) => {
                                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
                                    setFormData({ ...formData, serialPrefix: val });
                                }}
                                placeholder="Ex: TL"
                                className="h-8 text-xs font-medium"
                                maxLength={5}
                            />
                            <p className="text-[10px] text-muted-foreground font-mono">
                                Ex: {formData.serialPrefix || 'GT'}0001
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="imeiPrefix" className="text-xs">Préfixe IMEI</Label>
                            <Input
                                id="imeiPrefix"
                                value={formData.imeiPrefix}
                                onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                    setFormData({ ...formData, imeiPrefix: val });
                                }}
                                placeholder="Ex: 35907"
                                className="h-8 text-xs font-mono"
                                maxLength={8}
                            />
                            <p className="text-[10px] text-muted-foreground font-mono">
                                Ex: {formData.imeiPrefix || '35907'}001
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="subscriberPrefix" className="text-xs">Préf. Abonné</Label>
                            <Input
                                id="subscriberPrefix"
                                value={formData.subscriberPrefix}
                                onChange={(e) => {
                                    // Max 7 chars so total N° SIM stays 8 digits
                                    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 7);
                                    setFormData({ ...formData, subscriberPrefix: val });
                                }}
                                placeholder="Ex: 500"
                                className="h-8 text-xs font-mono"
                                maxLength={7}
                            />
                            <p className="text-[10px] text-muted-foreground font-mono">
                                Ex: {(() => {
                                    const p = formData.subscriberPrefix || '500';
                                    const pad = Math.max(1, 8 - p.length);
                                    return `${p}${'0'.repeat(pad - 1)}1`;
                                })()}
                                {' '}(8 chiffres)
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>
                            Annuler
                        </Button>
                        <Button type="submit" variant="hero">
                            {isEditing ? 'Enregistrer' : 'Créer'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default EnterpriseFormModal;
