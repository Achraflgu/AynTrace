import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore, useAuthStore } from '@/lib/store';
import { Device } from '@/lib/types';
import { toast } from 'sonner';
import { Radio, Link, Copy, CheckCircle2, ExternalLink } from 'lucide-react';
import { DEVICE_TYPES } from '@/lib/utils-geo';
import { devicesApi, fetchApi } from '@/lib/api';

// Device type options — shared from utils-geo DEVICE_TYPES
const deviceTypes = DEVICE_TYPES;

interface DeviceFormModalProps {
  open: boolean;
  onClose: () => void;
  device?: Device | null;
  initialEnterpriseId?: string;
}

const DeviceFormModal = ({ open, onClose, device, initialEnterpriseId }: DeviceFormModalProps) => {
  const { enterprises, fetchDevices, devices } = useAppStore();
  const { user } = useAuthStore();
  const isEditing = !!device;
  const isOperator = user?.role === 'operator';

  const [formData, setFormData] = useState({
    name: '',
    imei: '',
    serialNumber: '',
    subscriberNumber: '',
    deviceType: 'voiture' as Device['deviceType'],
    assignedTo: '',
    enterpriseId: '',
    dataSource: 'fake' as 'fake' | 'real',
    plateId: '',
    fuelType: '',
    brand: '',
  });

  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdDevice, setCreatedDevice] = useState<{ name: string; trackingToken: string; trackingUrl: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackerBaseUrl, setTrackerBaseUrl] = useState(window.location.origin);

  // Fetch tracker URL from server config every time dialog opens
  useEffect(() => {
    if (open) {
      fetch('/api/config')
        .then(res => res.json())
        .then(config => {
          if (config.trackerUrl) {
            setTrackerBaseUrl(config.trackerUrl);
          }
        })
        .catch(err => console.warn('Could not fetch tracker config:', err));
    }
  }, [open]);

  // Fetch next available IDs when enterprise changes (Creation Mode)
  useEffect(() => {
    if (open && !isEditing && formData.enterpriseId) {
      // Small delay to let UI settle
      const timeout = setTimeout(async () => {
        try {
          const ids = await fetchApi<any>(`/enterprises/${formData.enterpriseId}/next-ids`);
          if (ids && !ids.error) {
            setFormData(prev => ({
                ...prev,
                serialNumber: ids.serialNumber,
                imei: ids.imei,
                subscriberNumber: ids.subscriberNumber
            }));
          }
        } catch (err) {
          console.error('Failed to fetch next IDs:', err);
        }
      }, 100);

      return () => clearTimeout(timeout);
    }
  }, [formData.enterpriseId, isEditing, open]);

  useEffect(() => {
    if (open) {
      if (device) {
        setFormData({
          name: device.name,
          imei: device.imei,
          serialNumber: device.serialNumber,
          subscriberNumber: device.subscriberNumber || '',
          deviceType: device.deviceType,
          assignedTo: device.assignedTo || '',
          enterpriseId: device.enterpriseId,
          dataSource: device.dataSource || 'fake',
          plateId: device.plateId || '',
          fuelType: device.fuelType || '',
          brand: device.brand || '',
        });
      } else {
        setFormData({
          name: '',
          imei: '',
          serialNumber: '',
          subscriberNumber: '',
          deviceType: 'voiture',
          assignedTo: '',
          enterpriseId: initialEnterpriseId || '',
          dataSource: 'fake',
          plateId: '',
          fuelType: '',
          brand: '',
        });
      }
      setShowSuccessDialog(false);
      setCreatedDevice(null);
    }
  }, [open, device?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedImei = formData.imei.trim();
    if (!normalizedImei) {
      toast.error('IMEI requis');
      return;
    }

    const duplicateImei = devices.find(d => d.imei === normalizedImei && d.id !== device?.id);
    if (duplicateImei) {
      toast.error(`Cet IMEI est déjà utilisé par "${duplicateImei.name}"`);
      return;
    }

    const normalizedSerial = formData.serialNumber.trim();
    if (normalizedSerial) {
      const duplicateSerial = devices.find(d => d.serialNumber === normalizedSerial && d.id !== device?.id);
      if (duplicateSerial) {
        toast.error(`Ce N° Série est déjà utilisé par "${duplicateSerial.name}"`);
        return;
      }
    }

    const normalizedSubscriber = formData.subscriberNumber.trim();
    if (normalizedSubscriber) {
      if (!/^\d{8}$/.test(normalizedSubscriber)) {
        toast.error('Le N° Abonné/SIM doit contenir exactement 8 chiffres numériques');
        return;
      }
      const duplicateSubscriber = devices.find(d => d.subscriberNumber === normalizedSubscriber && d.id !== device?.id);
      if (duplicateSubscriber) {
        toast.error(`Ce N° Abonné/SIM est déjà utilisé par "${duplicateSubscriber.name}"`);
        return;
      }
    }

    const enterprise = enterprises.find(e => e.id === formData.enterpriseId);
    if (!enterprise && (!isEditing || !isOperator)) {
      toast.error('Veuillez sélectionner une entreprise');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditing && device) {
        // Update existing device via API
        await devicesApi.update(device.id, {
          ...formData,
          imei: normalizedImei,
          assignedTo: formData.assignedTo || undefined,
          enterpriseName: enterprise ? enterprise.name : device.enterpriseName,
        });
        toast.success('Appareil mis à jour avec succès');
        await fetchDevices();
        onClose();
      } else {
        // Create new device via API - Server handles ID generation
        const newDeviceData = {
          name: formData.name,
          imei: normalizedImei,
          deviceType: formData.deviceType,
          assignedTo: formData.assignedTo || undefined,
          enterpriseId: formData.enterpriseId,
          enterpriseName: enterprise?.name || '',
          dataSource: formData.dataSource,
          plateId: formData.plateId || undefined,
          fuelType: formData.fuelType || undefined,
          brand: formData.brand || undefined,
          serialNumber: formData.serialNumber,
          subscriberNumber: formData.subscriberNumber || undefined,
          status: 'offline',
          location: { lat: 36.8065, lng: 10.1815, address: 'Position initiale' },
          speed: 0,
          heading: 0,
          battery: 100,
          signal: 0,
          simulation: formData.dataSource === 'fake' ? {
            routeId: 'tunis-ariana',
            currentIndex: 0,
            direction: 1,
            isRunning: true
          } : undefined,
        };

        const result = await devicesApi.create(newDeviceData);
        await fetchDevices();

        if (formData.dataSource === 'real' && result.trackingToken) {
          // Show success dialog with tracking link
          const trackingUrl = `${trackerBaseUrl}/tracker/?token=${result.trackingToken}`;
          setCreatedDevice({
            name: formData.name,
            trackingToken: result.trackingToken,
            trackingUrl
          });
          setShowSuccessDialog(true);
        } else {
          toast.success('Appareil ajouté avec succès');
          onClose();
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTrackingLink = () => {
    if (createdDevice) {
      navigator.clipboard.writeText(createdDevice.trackingUrl);
      toast.success('Lien copié dans le presse-papier!');
    }
  };

  // Success dialog for real device with tracking link
  if (showSuccessDialog && createdDevice) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <div>
                <DialogTitle>Appareil créé!</DialogTitle>
                <DialogDescription>{createdDevice.name}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium">📱 Lien de suivi pour téléphone</p>
              <p className="text-xs text-muted-foreground">
                Ouvrez ce lien sur votre téléphone pour activer le suivi GPS en temps réel.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={createdDevice.trackingUrl}
                  className="font-mono text-xs bg-background"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={copyTrackingLink}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => window.open(createdDevice.trackingUrl, '_blank')}
                className="w-full"
                variant="hero"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Ouvrir le lien
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="w-full"
              >
                Fermer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const showPlate = ['voiture', 'camion', 'moto'].includes(formData.deviceType);
  const showBrand = ['voiture', 'camion', 'moto', 'mobilite'].includes(formData.deviceType);
  const showFuel = ['voiture', 'camion'].includes(formData.deviceType);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier l\'appareil' : 'Ajouter un appareil'}
          </DialogTitle>
          <DialogDescription className="hidden">
            Remplir les détails de l'appareil
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Enterprise Selection - First to generate IDs */}
            <div className="space-y-2">
              <Label>Entreprise *</Label>
              <Select
                value={formData.enterpriseId}
                onValueChange={(value) => setFormData({ ...formData, enterpriseId: value })}
                disabled={isEditing || isOperator} // Prevent changing enterprise on edit or if operator
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une entreprise" />
                </SelectTrigger>
                <SelectContent>
                  {enterprises.map((ent: any) => (
                    <SelectItem key={ent._id || ent.id} value={ent._id || ent.id}>
                      {ent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'appareil *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Tracker TL-001"
                required
              />
            </div>
          </div>

          {/* Auto-generated IDs - Read only */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="imei">IMEI</Label>
              <Input
                id="imei"
                value={formData.imei}
                onChange={(e) => setFormData({ ...formData, imei: e.target.value })}
                readOnly={isOperator}
                className={isOperator ? "bg-muted/50 font-mono text-xs" : "font-mono text-xs"}
                required
                placeholder="Génération en cours..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serialNumber">N° Série</Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                readOnly={isOperator}
                className={isOperator ? "bg-muted/50 font-mono text-xs" : "font-mono text-xs"}
                placeholder="Génération en cours..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="subscriberNumber">N° Abonné / SIM</Label>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                  formData.subscriberNumber.length === 8
                    ? 'bg-success/20 text-success'
                    : formData.subscriberNumber.length > 8
                    ? 'bg-destructive/20 text-destructive'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {formData.subscriberNumber.length}/8
                </span>
              </div>
              <Input
                id="subscriberNumber"
                value={formData.subscriberNumber}
                onChange={(e) => {
                  // Only digits, max 8 characters
                  const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                  setFormData({ ...formData, subscriberNumber: val });
                }}
                className={`font-mono text-xs ${
                  formData.subscriberNumber.length > 8 ? 'border-destructive' : ''
                }`}
                placeholder="8 chiffres ex: 50000001"
                maxLength={8}
                readOnly={isOperator}
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigné à (optionnel)</Label>
              <Input
                id="assignedTo"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                placeholder="Ex: Camion #1, Livreur Mohamed..."
                disabled={isOperator}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type d'appareil</Label>
              <Select
                value={formData.deviceType}
                onValueChange={(value: Device['deviceType']) =>
                  setFormData({ ...formData, deviceType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue>
                    {(() => {
                      const selected = deviceTypes.find(t => t.value === formData.deviceType);
                      if (selected) {
                        const Icon = selected.icon;
                        return (
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            <span>{selected.label}</span>
                          </div>
                        );
                      }
                      return 'Sélectionner...';
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Source de données</Label>
              <Select
                value={formData.dataSource}
                onValueChange={(value: 'fake' | 'real') =>
                  setFormData({ ...formData, dataSource: value })
                }
                disabled={isOperator}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fake">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-primary" />
                      <span>Simulé (Démonstration)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="real">
                    <div className="flex items-center gap-2">
                      <Link className="w-4 h-4 text-success" />
                      <span>Réel (GPS Téléphone)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Conditional Type-Specific Fields */}
          {(showPlate || showBrand || showFuel) && (
            <div className="border-t border-border/40 pt-3 mt-3 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                Détails du véhicule / appareil
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {showBrand && (
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marque / Modèle</Label>
                    <Input
                      id="brand"
                      value={formData.brand}
                      onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                      placeholder="Ex: Peugeot 208, Yamaha..."
                    />
                  </div>
                )}

                {showPlate && (
                  <div className="space-y-2">
                    <Label htmlFor="plateId">Matricule</Label>
                    <Input
                      id="plateId"
                      value={formData.plateId}
                      onChange={(e) => setFormData({ ...formData, plateId: e.target.value })}
                      placeholder="Ex: 123 TUN 4567"
                    />
                  </div>
                )}

                {showFuel && (
                  <div className="space-y-2">
                    <Label htmlFor="fuelType">Carburant</Label>
                    <Select
                      value={formData.fuelType}
                      onValueChange={(value) => setFormData({ ...formData, fuelType: value })}
                    >
                      <SelectTrigger id="fuelType">
                        <SelectValue placeholder="Sélectionner..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="essence">Essence</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="electrique">Électrique</SelectItem>
                        <SelectItem value="hybride">Hybride</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}

          {formData.dataSource === 'real' && (
            <p className="text-xs text-muted-foreground -mt-1">
              📱 Un lien sera généré pour connecter votre téléphone.
            </p>
          )}

          {/* Show tracking link for existing real devices */}
          {isEditing && device?.dataSource === 'real' && device?.trackingToken && (
            <div className="space-y-2">
              <Label>Lien de suivi actif</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${trackerBaseUrl}/tracker/?token=${device.trackingToken}`}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${trackerBaseUrl}/tracker/?token=${device.trackingToken}`);
                    toast.success('Lien copié!');
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="hero" disabled={isSubmitting}>
              {isSubmitting ? 'En cours...' : (isEditing ? 'Enregistrer' : 'Ajouter')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DeviceFormModal;
