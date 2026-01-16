import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClientAuthProvider } from './context/ClientAuthContext';
import { SupplierAuthProvider } from './context/SupplierAuthContext';
import DashboardLayout from './components/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardContent from './pages/DashboardContent';
import Clients from './pages/Clients';
import Suppliers from './pages/Suppliers';
import Trusts from './pages/Trusts';
import Assets from './pages/Assets';
import Tokenization from './pages/Tokenization';
import Approvals from './pages/Approvals';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import DataDeletion from './pages/DataDeletion';
// Portal de Clientes
import PortalLogin from './pages/portal/PortalLogin';
import PortalRegister from './pages/portal/PortalRegister';
import PortalDashboard from './pages/portal/PortalDashboard';
import ClientSetup from './pages/client-portal/ClientSetup';
// Portal de Proveedores
import SupplierLogin from './pages/supplier-portal/SupplierLogin';
import SupplierSetup from './pages/supplier-portal/SupplierSetup';
import SupplierDashboard from './pages/supplier-portal/SupplierDashboard';
// Root Admin Dashboard
import RootAdminLayout from './pages/root-admin/RootAdminLayout';
import RootDashboard from './pages/root-admin/RootDashboard';
import TenantsList from './pages/root-admin/TenantsList';
import UsersList from './pages/root-admin/UsersList';
import BillingManagement from './pages/root-admin/BillingManagement';
import AuditLogs from './pages/root-admin/AuditLogs';

// Apply theme from localStorage (shared with landing page)
const useTheme = () => {
  useEffect(() => {
    const savedTheme = localStorage.getItem('fideitec-theme');
    if (savedTheme && savedTheme !== 'default') {
      document.body.className = `theme-${savedTheme}`;
    }
    
    // Listen for theme changes from other tabs/windows
    const handleStorage = (e) => {
      if (e.key === 'fideitec-theme') {
        document.body.className = e.newValue && e.newValue !== 'default' 
          ? `theme-${e.newValue}` 
          : '';
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
};

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pattern">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-white/70">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirige si ya está autenticado)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-pattern">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
          <p className="text-white/70">Cargando...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Root Admin Route Component (solo para usuarios root)
const RootAdminRoute = ({ children }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          <p className="text-slate-400">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'root') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes - Portal de Empresa */}
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <Register />
        </PublicRoute>
      } />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/data-deletion" element={<DataDeletion />} />

      {/* Protected Routes - Portal de Empresa con Layout compartido */}
      <Route element={
        <ProtectedRoute>
          <DashboardLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardContent />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/trusts" element={<Trusts />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/tokenization" element={<Tokenization />} />
        <Route path="/approvals" element={<Approvals />} />
      </Route>

      {/* Root Admin Routes - Solo para usuarios root */}
      <Route element={
        <RootAdminRoute>
          <RootAdminLayout />
        </RootAdminRoute>
      }>
        <Route path="/root-admin" element={<RootDashboard />} />
        <Route path="/root-admin/tenants" element={<TenantsList />} />
        <Route path="/root-admin/users" element={<UsersList />} />
        <Route path="/root-admin/billing" element={<BillingManagement />} />
        <Route path="/root-admin/audit-logs" element={<AuditLogs />} />
      </Route>

      {/* Redirect root to login or dashboard */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      
      {/* 404 */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

// Rutas del Portal de Clientes (separadas del portal de empresa)
function PortalRoutes() {
  return (
    <ClientAuthProvider>
      <Routes>
        <Route path="/:portalToken/login" element={<PortalLogin />} />
        <Route path="/:portalToken/register" element={<PortalRegister />} />
        <Route path="/:portalToken/setup/:inviteToken" element={<ClientSetup />} />
        <Route path="/:portalToken/dashboard" element={<PortalDashboard />} />
        <Route path="/:portalToken" element={<Navigate to="login" replace />} />
      </Routes>
    </ClientAuthProvider>
  );
}

// Rutas del Portal de Proveedores
function SupplierPortalRoutes() {
  return (
    <SupplierAuthProvider>
      <Routes>
        <Route path="/:portalToken/login" element={<SupplierLogin />} />
        <Route path="/:portalToken/setup/:inviteToken" element={<SupplierSetup />} />
        <Route path="/:portalToken/dashboard" element={<SupplierDashboard />} />
        <Route path="/:portalToken" element={<Navigate to="login" replace />} />
      </Routes>
    </SupplierAuthProvider>
  );
}

function App() {
  useTheme();
  
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            borderRadius: '12px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#f8fafc' }
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#f8fafc' }
          }
        }}
      />
      <Routes>
        {/* Portal de Clientes - rutas con /portal/* */}
        <Route path="/portal/*" element={<PortalRoutes />} />
        
        {/* Portal de Proveedores - rutas con /supplier-portal/* */}
        <Route path="/supplier-portal/*" element={<SupplierPortalRoutes />} />
        
        {/* Portal de Empresa - todas las demás rutas */}
        <Route path="/*" element={
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

