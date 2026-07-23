import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/lib/store';
import { User } from '@/lib/types';
import { toast } from 'sonner';
import { CheckCircle2, Copy, Mail, Key, Building2, Shield, UserCircle, Eye, EyeOff, Crown, Zap } from 'lucide-react';

interface UserFormModalProps {
  open: boolean;
  onClose: () => void;
  user?: User | null;
}

interface CreatedCredentials {
  name: string;
  email: string;
  password: string;
  plan: string;
  enterpriseName: string;
  role: string;
}

const UserFormModal = ({ open, onClose, user }: UserFormModalProps) => {
  const { enterprises, addUser, updateUser } = useAppStore();
  const isEditing = !!user;

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'operator' as User['role'],
    plan: 'starter' as string,
    enterpriseId: '',
    password: '',
  });

  const [createdCreds, setCreatedCreds] = useState<CreatedCredentials | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    return pass;
  };

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        plan: (user as any).plan || 'starter',
        enterpriseId: user.enterpriseId || '',
        password: '',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'operator',
        plan: 'starter',
        enterpriseId: '',
        password: generatePassword(),
      });
    }
    // Reset credentials popup when modal reopens
    setCreatedCreds(null);
    setShowPassword(false);
    setCopiedField(null);
  }, [user, open]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copié dans le presse-papiers');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const enterprise = enterprises.find(e => e.id === formData.enterpriseId);

    try {
      if (isEditing && user) {
        await updateUser(user.id, {
          ...formData,
          enterpriseName: enterprise?.name,
        });
        toast.success('Utilisateur mis à jour avec succès');
        onClose();
      } else {
        const result: any = await addUser({
          ...formData,
          enterpriseName: enterprise?.name,
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${formData.name}`,
        });

        // Show credentials popup
        setCreatedCreds({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          plan: formData.plan,
          enterpriseName: enterprise?.name || '',
          role: formData.role,
        });
      }
    } catch (err: any) {
      console.error('Error saving user:', err);
      if (err instanceof Error && err.message.includes('users_email_unique')) {
        toast.error('Cette adresse email est déjà utilisée par un autre compte.');
      } else {
        toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement de l'utilisateur");
      }
    }
  };

  const handleCloseAll = () => {
    setCreatedCreds(null);
    onClose();
  };

  const planLabel = (p: string) => getPlanMeta(p).label;

  const roleLabel = (r: string) =>
    r === 'admin' ? 'Administrateur' : r === 'supervisor' ? 'Superviseur' : 'Opérateur';

  const getRoleIcon = (r: string) => (r === 'admin' ? Shield : UserCircle);

  const getPlanMeta = (p: string) => {
    if (p === 'pro') {
      return { label: 'Pro', icon: Crown };
    }

    if (p === 'enterprise') {
      return { label: 'Enterprise', icon: Crown };
    }

    return { label: 'Starter', icon: Zap };
  };

  // ── Credentials Success Popup ──────────────────────────────
  if (createdCreds) {
    const RoleIcon = getRoleIcon(createdCreds.role);
    const PlanIcon = getPlanMeta(createdCreds.plan).icon;

    return (
      <Dialog open={open} onOpenChange={handleCloseAll}>
        <DialogContent className="sm:max-w-lg">
          {/* Success Header */}
          <div className="text-center pt-2 pb-1">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold">Utilisateur créé avec succès !</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Un email de bienvenue a été envoyé à <strong className="text-foreground">{createdCreds.email}</strong>
            </p>
          </div>

          {/* Credentials Card */}
          <div className="rounded-xl bg-secondary/40 border border-border/50 p-4 space-y-3 mt-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />Identifiants de connexion
            </p>

            {/* Name */}
            <div className="flex items-center justify-between gap-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCircle className="w-3.5 h-3.5" />
                <span>Nom</span>
              </div>
              <span className="text-sm font-semibold">{createdCreds.name}</span>
            </div>

            {/* Email */}
            <div className="flex items-center justify-between gap-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-3.5 h-3.5" />
                <span>Email</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold font-mono">{createdCreds.email}</span>
                <button
                  onClick={() => copyToClipboard(createdCreds.email, 'email')}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                  title="Copier"
                >
                  <Copy className={`w-3.5 h-3.5 ${copiedField === 'email' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between gap-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Key className="w-3.5 h-3.5" />
                <span>Mot de passe</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-md tracking-wider">
                  {showPassword ? createdCreds.password : '••••••••'}
                </code>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                  title={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword
                    ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                    : <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  }
                </button>
                <button
                  onClick={() => copyToClipboard(createdCreds.password, 'password')}
                  className="p-1 rounded hover:bg-secondary transition-colors"
                  title="Copier"
                >
                  <Copy className={`w-3.5 h-3.5 ${copiedField === 'password' ? 'text-emerald-400' : 'text-muted-foreground'}`} />
                </button>
              </div>
            </div>

            {/* Plan & Enterprise */}
            <div className="flex items-center justify-between gap-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RoleIcon className="w-3.5 h-3.5" />
                <span>Rôle / Plan</span>
              </div>
              <span className="text-sm font-semibold flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <RoleIcon className="w-3.5 h-3.5" />
                  {roleLabel(createdCreds.role)}
                </span>
                <span className="text-muted-foreground/50">•</span>
                <span className="inline-flex items-center gap-1.5">
                  <PlanIcon className="w-3.5 h-3.5" />
                  {planLabel(createdCreds.plan)}
                </span>
              </span>
            </div>

            {createdCreds.enterpriseName && (
              <div className="flex items-center justify-between gap-3 py-2 border-t border-border/30">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Entreprise</span>
                </div>
                <span className="text-sm font-semibold">{createdCreds.enterpriseName}</span>
              </div>
            )}
          </div>

          {/* Email sent notice */}
          <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/15 px-4 py-3 flex items-start gap-3 mt-1">
            <Mail className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ces identifiants ont été automatiquement envoyés par email à l'utilisateur avec un lien de connexion et une recommandation de changer le mot de passe.
            </p>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                const text = `Email: ${createdCreds.email}\nMot de passe: ${createdCreds.password}`;
                navigator.clipboard.writeText(text);
                toast.success('Identifiants copiés !');
              }}
            >
              <Copy className="w-4 h-4 mr-2" />Copier tout
            </Button>
            <Button variant="hero" onClick={handleCloseAll}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ── Creation / Edit Form ───────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Ahmed Benali"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="utilisateur@email.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select
                value={formData.role}
                onValueChange={(value: User['role']) =>
                  setFormData({ ...formData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {([
                    { value: 'admin', label: 'Administrateur', icon: Shield },
                    { value: 'operator', label: 'Opérateur', icon: UserCircle },
                    { value: 'supervisor', label: 'Superviseur', icon: UserCircle },
                  ] as const).map(option => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <Icon className="w-4 h-4" />
                          {option.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {!isEditing ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mot de passe initial</Label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: generatePassword() })}
                    className="text-[10px] font-medium text-emerald-500 hover:text-emerald-400"
                  >
                    Générer aléatoire
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Mot de passe"
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {!isEditing && (
            <p className="text-[10px] text-muted-foreground -mt-2">
              Ce mot de passe sera envoyé à l'utilisateur par email
            </p>
          )}

          {formData.role === 'operator' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={formData.plan}
                  onValueChange={(value) => setFormData({ ...formData, plan: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {([
                      { value: 'starter', label: 'Starter', icon: Zap },
                      { value: 'pro', label: 'Pro', icon: Crown },
                    ] as const).map(option => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <Icon className="w-4 h-4" />
                            {option.label}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {formData.plan === 'starter' ? 'Accès: Dashboard, Carte, Appareils, Alertes'
                    : 'Accès: Tout Starter + Géofences, Support, Paramètres'}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Entreprise</Label>
                <Select
                  value={formData.enterpriseId}
                  onValueChange={(value) => setFormData({ ...formData, enterpriseId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une entreprise" />
                  </SelectTrigger>
                  <SelectContent>
                    {enterprises.map((ent) => (
                      <SelectItem key={ent.id} value={ent.id}>
                        {ent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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

export default UserFormModal;
