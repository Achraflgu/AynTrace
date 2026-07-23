import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';
import { toast } from 'sonner';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

interface PlanRouteProps {
    children: React.ReactNode;
    requiredPlan: 'pro' | 'enterprise';
}

const PlanRoute: React.FC<PlanRouteProps> = ({ children, requiredPlan }) => {
    const { user, isAuthenticated } = useAuthStore();
    const location = useLocation();
    const { lang } = useI18n();

    useEffect(() => {
        if (isAuthenticated && user?.role === 'operator') {
            const userPlan = (user as any).plan || 'starter';
            if (requiredPlan === 'pro' && userPlan === 'starter') {
                toast.error(
                    lang === 'fr' 
                        ? 'Accès refusé. Cette fonctionnalité nécessite le plan Pro.' 
                        : 'Access denied. This feature requires the Pro plan.',
                    { duration: 4000 }
                );
            }
        }
    }, [user, isAuthenticated, requiredPlan, lang]);

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Admins and supervisors bypass plan restrictions
    if (user?.role === 'admin' || user?.role === 'supervisor') {
        return <>{children}</>;
    }

    // Operator checking
    const userPlan = (user as any)?.plan || 'starter';
    
    // If required is pro, accept pro or enterprise. If starter, reject.
    if (requiredPlan === 'pro' && userPlan === 'starter') {
        return <Navigate to="/dashboard" replace />;
    }

    // Default allow
    return <>{children}</>;
};

export default PlanRoute;
