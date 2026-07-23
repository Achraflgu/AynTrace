import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';

/**
 * Hook that returns true if the current user is a demo user (anonymous).
 * Demo users cannot create, edit, or delete resources.
 */
export const useIsDemo = (): boolean => {
    const { user } = useAuthStore();
    return user?.email === 'demo@ayntrace.tn';
};

/**
 * Shows a toast warning when a demo user tries to perform a restricted action.
 */
export const showDemoRestriction = () => {
    toast.warning('🔒 Action non disponible en mode démo', {
        description: 'Rejoignez AynTrace pour accéder à toutes les fonctionnalités.',
        duration: 4000,
    });
};

/**
 * Wraps a callback: if demo user, shows restriction toast instead.
 */
export const guardDemoAction = (isDemo: boolean, action: () => void) => {
    if (isDemo) {
        showDemoRestriction();
        return;
    }
    action();
};
