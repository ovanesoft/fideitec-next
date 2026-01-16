import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, Building2, Users, CreditCard, 
  FileText, Settings, LogOut, Menu, X, ChevronDown,
  Shield, AlertTriangle
} from 'lucide-react';

const RootAdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/root-admin' },
    { name: 'Organizaciones', icon: Building2, href: '/root-admin/tenants' },
    { name: 'Usuarios', icon: Users, href: '/root-admin/users' },
    { name: 'Billing', icon: CreditCard, href: '/root-admin/billing' },
    { name: 'Logs de Auditoria', icon: FileText, href: '/root-admin/audit-logs' },
  ];

  const isActive = (href) => {
    if (href === '/root-admin') {
      return location.pathname === '/root-admin';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Sidebar Mobile */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-black/60 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`fixed inset-y-0 left-0 w-72 bg-slate-800 shadow-xl transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-red-500" />
              <div>
                <span className="text-lg font-bold text-white">ROOT ADMIN</span>
                <span className="block text-xs text-red-400">God Mode</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.href);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive(item.href)
                    ? 'bg-red-500/20 text-red-400' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 bg-slate-800 border-r border-slate-700">
          <div className="flex items-center gap-3 p-6 border-b border-slate-700">
            <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <span className="text-lg font-bold text-white">ROOT ADMIN</span>
              <span className="block text-xs text-red-400">Control Total del Sistema</span>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <button
                key={item.name}
                onClick={() => navigate(item.href)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive(item.href)
                    ? 'bg-red-500/20 text-red-400 font-medium' 
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <span className="font-semibold text-red-400">Modo Administrador</span>
              </div>
              <p className="text-sm text-slate-400 mb-3">
                Tienes acceso total al sistema. Actua con precaucion.
              </p>
              <button 
                onClick={() => navigate('/dashboard')}
                className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-medium text-white transition-colors"
              >
                Volver al Dashboard
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-slate-800/80 backdrop-blur-md border-b border-slate-700">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-white">Panel de Administracion</h1>
                <p className="text-sm text-slate-400">Gestion global del sistema FIDEITEC</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-700 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-xl flex items-center justify-center text-white font-semibold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-white">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-red-400">Super Admin</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 py-2 z-50">
                      <div className="px-4 py-3 border-b border-slate-700">
                        <p className="text-sm font-medium text-white">
                          {user?.firstName} {user?.lastName}
                        </p>
                        <p className="text-xs text-slate-400">{user?.email}</p>
                      </div>
                      <div className="py-1">
                        <button 
                          onClick={() => { navigate('/dashboard'); setDropdownOpen(false); }}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 w-full"
                        >
                          <LayoutDashboard className="w-4 h-4" />
                          Dashboard Normal
                        </button>
                      </div>
                      <div className="border-t border-slate-700 py-1">
                        <button 
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 w-full"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar sesion
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default RootAdminLayout;
