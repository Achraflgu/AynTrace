import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usersApi, authApi } from '@/lib/api';
import { toast } from 'sonner';
import { Mail, RefreshCw, CheckCircle, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthIndicator } from '@/components/ui/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/password-validation';

interface EmailVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    onVerified: () => void;
    initialStep?: 'verify' | 'password';
    mode?: 'setup' | 'reset';
    autoSendCode?: boolean;
}

const EmailVerificationModal = ({ isOpen, onClose, email, onVerified, initialStep, mode = 'setup', autoSendCode = true }: EmailVerificationModalProps) => {
    const [step, setStep] = useState<'verify' | 'password'>('verify');

    // Update step when prop changes or modal opens
    useEffect(() => {
        if (isOpen && initialStep) {
            setStep(initialStep);
        } else if (isOpen) {
            setStep('verify');
        }
    }, [isOpen, initialStep]);
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [isSettingPassword, setIsSettingPassword] = useState(false);
    const [error, setError] = useState('');
    const [codeSent, setCodeSent] = useState(!autoSendCode);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Send verification code when modal opens
    useEffect(() => {
        if (isOpen && !codeSent && step === 'verify' && autoSendCode) {
            sendCode();
        }
    }, [isOpen]);

    const sendCode = async () => {
        setIsResending(true);
        setError('');
        try {
            if (mode === 'reset') {
                await authApi.forgotPassword({ email });
            } else {
                await usersApi.sendVerification(email);
            }
            setCodeSent(true);
            toast.success('Code envoyé!', {
                description: `Vérifiez votre boîte mail: ${email}`
            });
        } catch (err: any) {
            setError(err.message || 'Erreur lors de l\'envoi du code');
            toast.error('Erreur', { description: 'Impossible d\'envoyer le code' });
        } finally {
            setIsResending(false);
        }
    };

    const handleInputChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return; // Only allow digits

        const newCode = [...code];
        newCode[index] = value.slice(-1); // Take only last character
        setCode(newCode);
        setError('');

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newCode = [...code];
        for (let i = 0; i < pastedData.length; i++) {
            newCode[i] = pastedData[i];
        }
        setCode(newCode);
        if (pastedData.length === 6) {
            inputRefs.current[5]?.focus();
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length !== 6) {
            setError('Veuillez entrer le code complet à 6 chiffres');
            return;
        }

        setIsVerifying(true);
        setError('');
        try {
            if (mode === 'setup') {
                const result = await usersApi.verifyEmail(email, fullCode);
                if (result.verified) {
                    toast.success('Email vérifié!');
                    setStep('password');
                }
            } else {
                // Verify reset code without consuming it
                const result = await authApi.verifyResetCode({ email, code: fullCode });
                if (result.verified) {
                    setStep('password');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Code invalide');
            toast.error('Code invalide', { description: 'Veuillez réessayer' });
        } finally {
            setIsVerifying(false);
        }
    };

    const handleSetPassword = async () => {
        const validation = validatePassword(password);
        if (!validation.isValid) {
            setError('Le mot de passe ne respecte pas tous les critères de sécurité.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas');
            return;
        }

        setIsSettingPassword(true);
        setError('');
        try {
            if (mode === 'reset') {
                await authApi.resetPassword({ email, code: code.join(''), newPassword: password });
                toast.success('Mot de passe réinitialisé!', {
                    description: 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe'
                });
            } else {
                await authApi.setPassword({ email, password });
                toast.success('Mot de passe configuré!', {
                    description: 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe'
                });
            }
            onVerified();
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la configuration du mot de passe');
        } finally {
            setIsSettingPassword(false);
        }
    };

    const handleResend = () => {
        setCode(['', '', '', '', '', '']);
        sendCode();
        setStep('verify');
        setTimeout(() => {
            inputRefs.current[0]?.focus();
        }, 100);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                {step === 'verify' ? (
                    <>
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 bg-primary/10 rounded-full">
                                    <Mail className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle>
                                        {mode === 'reset' ? 'Code de sécurité' : "Vérification de l'email"}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Un code à 6 chiffres a été envoyé à
                                    </DialogDescription>
                                </div>
                            </div>
                            <p className="text-sm font-medium text-primary">{email}</p>
                        </DialogHeader>

                        <div className="space-y-6 py-4">
                            <div className="flex justify-center gap-2" onPaste={handlePaste}>
                                {code.map((digit, index) => (
                                    <Input
                                        key={index}
                                        ref={el => inputRefs.current[index] = el}
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleInputChange(index, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(index, e)}
                                        className="w-12 h-14 text-center text-2xl font-bold"
                                        disabled={isVerifying}
                                    />
                                ))}
                            </div>

                            {error && <p className="text-sm text-destructive text-center">{error}</p>}

                            <Button
                                onClick={handleVerify}
                                disabled={isVerifying || code.join('').length !== 6}
                                className="w-full"
                            >
                                {isVerifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                {isVerifying ? 'Vérification...' : 'Vérifier le code'}
                            </Button>

                            <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-2">Vous n'avez pas reçu le code?</p>
                                <Button variant="ghost" onClick={handleResend} disabled={isResending} className="text-primary">
                                    {isResending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    {isResending ? 'Envoi en cours...' : 'Renvoyer le code'}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-3 bg-primary/10 rounded-full">
                                    <KeyRound className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle>
                                        {mode === 'reset' ? 'Réinitialiser votre mot de passe' : 'Configurer votre mot de passe'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Choisissez un nouveau mot de passe sécurisé
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Nouveau mot de passe</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isSettingPassword}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <PasswordStrengthIndicator password={password} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
                                <div className="relative">
                                    <Input
                                        id="confirm-password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        disabled={isSettingPassword}
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

                            {error && <p className="text-sm text-destructive text-center">{error}</p>}

                            <Button onClick={handleSetPassword} disabled={isSettingPassword} className="w-full">
                                {isSettingPassword ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                {isSettingPassword ? 'Enregistrement...' : 'Enregistrer le mot de passe'}
                            </Button>

                            <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-2">Vous n'avez pas reçu le code?</p>
                                <Button variant="ghost" onClick={handleResend} disabled={isResending} className="text-primary">
                                    {isResending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                                    {isResending ? 'Envoi en cours...' : 'Renvoyer le code'}
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default EmailVerificationModal;
