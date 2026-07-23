import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Building2, Shield, Calendar, Clock, Save, Key, Edit2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { getRoleName, getRoleColor, formatDate } from '@/lib/utils-geo';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';
import { toast } from 'sonner';
import { PasswordStrengthIndicator } from '@/components/ui/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/password-validation';

const ProfilePage = () => {
  const { user, updateProfile } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isEditing, setIsEditing] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Security states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  if (!user) return null;

  const handleSaveProfile = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (trimmedEmail !== user?.email && !emailPassword) {
      toast.error('Mot de passe actuel requis', { description: "Vous devez saisir votre mot de passe pour changer d'adresse email." });
      return;
    }
    
    try {
      const updateData: any = { name: trimmedName };
      
      // Only send email and password if email has actually changed
      if (trimmedEmail !== user?.email) {
        updateData.email = trimmedEmail;
        updateData.currentPassword = emailPassword;
      }

      await (updateProfile as any)(updateData);
      toast.success('Profil mis à jour avec succès');
      setIsEditing(false);
      setEmailPassword('');
      setShowEmailPassword(false);
    } catch (error: any) {
      toast.error('Erreur', { description: error.message || 'Impossible de mettre à jour le profil' });
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Champs manquants', { description: 'Veuillez remplir tous les champs.' });
      return;
    }
    const validation = validatePassword(newPassword);
    if (!validation.isValid) {
      toast.error('Mot de passe faible', { description: 'Le nouveau mot de passe ne respecte pas tous les critères de sécurité.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Mots de passe différents', { description: 'Le nouveau mot de passe et la confirmation ne correspondent pas.' });
      return;
    }
    
    try {
      await (updateProfile as any)({ currentPassword, newPassword });
      toast.success('Mot de passe mis à jour avec succès');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error: any) {
      toast.error('Erreur', { description: error.message || 'Impossible de changer le mot de passe' });
    }
  };

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="px-6 py-4 border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <h1 className="text-xl font-bold">Mon Profil</h1>
          <p className="text-sm text-muted-foreground">
            Gérez vos informations personnelles
          </p>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Header Card */}
            <Card className="glass-card-elevated border-0 overflow-hidden">
              <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20" />
              <CardContent className="relative pt-0 pb-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-12">
                  <Avatar className="w-24 h-24 border-4 border-card shadow-xl">
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-center sm:text-left pb-2">
                    <h2 className="text-2xl font-bold">{user.name}</h2>
                    <p className="text-muted-foreground">{user.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                      <Badge className={getRoleColor(user.role)}>
                        <Shield className="w-3 h-3 mr-1" />
                        {getRoleName(user.role)}
                      </Badge>
                      {user.enterpriseName && (
                        <Badge variant="outline">
                          <Building2 className="w-3 h-3 mr-1" />
                          {user.enterpriseName}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant={isEditing ? "secondary" : "outline"}
                    onClick={() => setIsEditing(!isEditing)}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    {isEditing ? 'Annuler' : 'Modifier'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Edit Profile */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Informations personnelles</CardTitle>
                      <CardDescription>Vos informations de compte</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nom complet</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Votre nom"
                        disabled={!isEditing}
                        className={!isEditing ? 'bg-secondary/50 border-transparent shadow-none' : 'border-primary/30 focus-visible:ring-primary/30'}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.dz"
                        disabled={!isEditing}
                        className={!isEditing ? 'bg-secondary/50 border-transparent shadow-none' : 'border-primary/30 focus-visible:ring-primary/30'}
                      />
                    </div>

                    {isEditing && email !== user?.email && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 p-4 bg-muted/30 rounded-lg border border-border/50">
                        <Label htmlFor="email-password" className="text-destructive flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" /> Mot de passe requis
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">Veuillez confirmer votre mot de passe actuel pour changer d'adresse email.</p>
                        <div className="relative">
                          <Input
                            id="email-password"
                            type={showEmailPassword ? "text" : "password"}
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            placeholder="••••••••"
                            className="pr-10 border-destructive/30 focus-visible:ring-destructive/30"
                          />
                          <button
                            type="button"
                            onClick={() => setShowEmailPassword(!showEmailPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showEmailPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex justify-end pt-4 border-t border-border/40 mt-4">
                      <Button variant="hero" onClick={handleSaveProfile} className="gap-2">
                        <Save className="w-4 h-4" />
                        Enregistrer les modifications
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card className="glass-card border-0">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Informations du compte</CardTitle>
                      <CardDescription>Détails de votre compte</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date de création</p>
                      <p className="font-medium">{new Date(user.createdAt).toLocaleDateString('fr-FR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                    <Clock className="w-5 h-5 text-success" />
                    <div>
                      <p className="text-sm text-muted-foreground">Dernière connexion</p>
                      <p className="font-medium">{formatDate(user.lastLogin)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                    <Mail className="w-5 h-5 text-success" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Email vérifié</p>
                      <div className="flex items-center gap-1.5 text-success font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Oui
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Security */}
            <Card className="glass-card border-0">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <Key className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Sécurité</CardTitle>
                    <CardDescription>Gérez votre mot de passe et la sécurité du compte</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Mot de passe actuel</Label>
                    <div className="relative">
                      <Input
                        id="current-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">Nouveau mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <PasswordStrengthIndicator password={newPassword} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmer</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end mt-6 pt-4 border-t border-border/40">
                  <Button variant="default" onClick={handlePasswordChange} className="gap-2 bg-foreground text-background hover:bg-foreground/90">
                    <Key className="w-4 h-4" />
                    Changer le mot de passe
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePage;
