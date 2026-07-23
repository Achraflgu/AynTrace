import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

/** Allowed routes for suspended operators */
const SUSPENDED_ALLOWED = ['/billing', '/profile', '/support', '/settings'];

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const { isAuthenticated, user } = useAuthStore();
    const location = useLocation();
    const toasted = useRef(false);

    const isSuspended =
        user?.role === 'operator' &&
        (user as any)?.billingStatus === 'suspended';

    const isAllowedWhileSuspended = SUSPENDED_ALLOWED.some(
        p => location.pathname === p || location.pathname.startsWith(p + '/')
    );

    useEffect(() => {
        if (isSuspended && !isAllowedWhileSuspended && !toasted.current) {
            toasted.current = true;
            toast.error('Compte suspendu — paiement requis', {
                description: 'Votre accès est limité. Régularisez votre paiement pour continuer.',
                duration: 6000,
            });
        }
    }, [isSuspended, isAllowedWhileSuspended]);

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Suspended operator trying to access a blocked page
    if (isSuspended && !isAllowedWhileSuspended) {
        return <Navigate to="/billing" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
