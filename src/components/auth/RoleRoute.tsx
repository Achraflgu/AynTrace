import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';

type Role = 'admin' | 'supervisor' | 'operator';

interface RoleRouteProps {
    children: React.ReactNode;
    allowedRoles: Role[];
}

/**
 * Protects routes based on user role.
 * Redirects to /login if not authenticated.
 * Redirects to /dashboard if role is not allowed.
 */
const RoleRoute = ({ children, allowedRoles }: RoleRouteProps) => {
    const { isAuthenticated, user } = useAuthStore();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!user || !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default RoleRoute;
