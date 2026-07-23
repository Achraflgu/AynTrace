import { ReactNode } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore, useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Radio, ChevronRight, X, BookOpen, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIChatWidget from '@/components/dashboard/AIChatWidget';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const { isLoading } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const isDemoUser = user?.email === 'demo@ayntrace.tn';
  const isInIframe = window.self !== window.top;

  const handleExitDemo = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      {isDemoUser && !isInIframe && (
        <div className="fixed top-0 left-0 right-0 h-auto sm:h-14 bg-orange-500 z-[60] flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-2 sm:py-0 text-white shadow-md gap-2 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-600/50 flex items-center justify-center shrink-0">
              <Radio className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-xs sm:text-sm truncate">Mode Démonstration</div>
              <div className="text-[10px] sm:text-xs text-orange-100 hidden sm:block">Données fictives • Lecture seule • <Lock className="w-3 h-3 inline" /> Actions restreintes</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 self-end sm:self-auto">
            <button
              className="hidden sm:flex items-center justify-center focus:outline-none bg-white/10 text-white hover:bg-white/20 border border-white/20 font-semibold rounded-full px-3 sm:px-4 text-[10px] sm:text-xs h-7 sm:h-8 gap-1.5 transition-colors shadow-sm"
              onClick={() => {
                logout();
                navigate('/guide');
              }}
            >
              <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Guide
            </button>
            <button
              className="flex items-center gap-1 sm:gap-1.5 focus:outline-none bg-white text-orange-600 hover:bg-orange-50 hover:text-orange-700 border-none font-bold rounded-full px-3 sm:px-4 text-[10px] sm:text-xs h-7 sm:h-8 shadow-sm transition-colors"
              onClick={() => {
                logout();
                window.dispatchEvent(new CustomEvent('open-join-popup'));
              }}
            >
              <span className="hidden sm:inline">Rejoindre Nous</span>
              <span className="sm:hidden">Rejoindre</span>
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={handleExitDemo}
              aria-label="Quitter le mode démonstration"
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full hover:bg-orange-600 transition-colors"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </button>
          </div>
        </div>
      )}

      <div className={cn("transition-all duration-300", (isDemoUser && !isInIframe) ? "pt-[52px] sm:pt-14" : "")}>
        <Sidebar />
        <main className="ml-16 md:ml-64 min-h-screen transition-all duration-300">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-screen bg-background">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-[#039C51]" />
                <p className="text-sm text-muted-foreground font-medium animate-pulse">Initialisation des données...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
        {user?.role !== 'supervisor' && <AIChatWidget />}
      </div>
    </div>
  );
};

export default DashboardLayout;
