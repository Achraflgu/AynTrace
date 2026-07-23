import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import RoleRoute from "./components/auth/RoleRoute";
import PlanRoute from "./components/auth/PlanRoute";
import { useAppStore, useAuthStore } from "./lib/store";
import { ThemeProvider } from './lib/theme';
import { I18nProvider } from './lib/i18n';

// ── Lazy-loaded pages (code splitting) ──────────────────────
// Only the landing page is loaded eagerly for instant first paint.
// All other pages are loaded on-demand when navigated to.
const Index = lazy(() => import("./pages/Index"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const GuidePage = lazy(() => import("./pages/GuidePage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MapPage = lazy(() => import("./pages/MapPage"));
const DevicesPage = lazy(() => import("./pages/DevicesPage"));
const DeviceDetailPage = lazy(() => import("./pages/DeviceDetailPage"));
const EnterprisesPage = lazy(() => import("./pages/EnterprisesPage"));
const EnterpriseDetailPage = lazy(() => import("./pages/EnterpriseDetailPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const SupportCenter = lazy(() => import("./pages/SupportCenter"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const OrdersPage = lazy(() => import("./pages/OrdersPage"));
const GeofencesPage = lazy(() => import("./pages/GeofencesPage"));
const BillingPage = lazy(() => import("./pages/BillingPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy-load heavy components
const ChatbotWidget = lazy(() => import("@/components/ChatbotWidget").then(m => ({ default: m.ChatbotWidget })));

// ── Loading Fallback ────────────────────────────────────────
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-[#039C51]" />
      <p className="text-sm text-muted-foreground font-medium animate-pulse">Chargement...</p>
    </div>
  </div>
);

const queryClient = new QueryClient();

const AppContent = () => {
  const { initializeData, initializeWebSocket } = useAppStore();
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const showChatbot = location.pathname === '/' || location.pathname === '/guide';

  // Initialize data from PostgreSQL when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('[App] Initializing data from PostgreSQL...');
      initializeData();
      initializeWebSocket();
    }
  }, [isAuthenticated, initializeData, initializeWebSocket]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Index />} />
        <Route path="/join" element={<Index />} />
        <Route path="/demo" element={<Index />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/guide" element={<GuidePage />} />
        <Route path="/legal" element={<LegalPage />} />
        <Route path="/legal/:section" element={<LegalPage />} />

        {/* Protected routes - require authentication */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
        <Route path="/devices/:deviceKey" element={<ProtectedRoute><DeviceDetailPage /></ProtectedRoute>} />

        {/* Admin & Supervisor only - Enterprises */}
        <Route path="/enterprises" element={<RoleRoute allowedRoles={['admin', 'supervisor']}><EnterprisesPage /></RoleRoute>} />
        <Route path="/enterprises/:id" element={<RoleRoute allowedRoles={['admin', 'supervisor']}><EnterpriseDetailPage /></RoleRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
        <Route path="/geofences" element={<ProtectedRoute><RoleRoute allowedRoles={['admin', 'operator']}><PlanRoute requiredPlan="pro"><GeofencesPage /></PlanRoute></RoleRoute></ProtectedRoute>} />
        <Route path="/support" element={<ProtectedRoute><SupportCenter /></ProtectedRoute>} />
        <Route path="/billing" element={<RoleRoute allowedRoles={['operator']}><BillingPage /></RoleRoute>} />

        {/* Admin routes */}
        <Route path="/users" element={<RoleRoute allowedRoles={['admin']}><UsersPage /></RoleRoute>} />
        <Route path="/admin/logs" element={<RoleRoute allowedRoles={['admin']}><AuditLogsPage /></RoleRoute>} />
        <Route path="/admin/orders" element={<RoleRoute allowedRoles={['admin']}><OrdersPage /></RoleRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {showChatbot && (
        <Suspense fallback={null}>
          <ChatbotWidget />
        </Suspense>
      )}
    </Suspense>
  );
};

const App = () => (
  <ThemeProvider>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner position="top-center" richColors closeButton visibleToasts={2} duration={3000} offset="16px" />
          <BrowserRouter>
            <AppContent />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
