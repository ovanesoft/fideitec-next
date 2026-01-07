import { useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, User, Building2, Users, Settings, Bell, 
  ChevronDown, Menu, X, Shield, Mail,
  LayoutDashboard, Zap, UserCheck, Truck, Building, FileText, Coins, ShieldCheck
} from 'lucide-react';

const APP_VERSION = '1.17';

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const getRoleLabel = (role) => {
    const roles = {
      root: 'Super Admin',
      admin: 'Administrador',
      manager: 'Manager',
      user: 'Usuario'
    };
    return roles[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      root: 'bg-purple-100 text-purple-700',
      admin: 'bg-blue-100 text-blue-700',
      manager: 'bg-green-100 text-green-700',
      user: 'bg-slate-100 text-slate-700'
    };
    return colors[role] || colors.user;
  };

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { name: 'Fideicomisos', icon: FileText, href: '/trusts' },
    { name: 'Activos', icon: Building, href: '/assets' },
    { name: 'Tokenización', icon: Coins, href: '/tokenization' },
    { name: 'Aprobaciones', icon: ShieldCheck, href: '/approvals' },
    { name: 'Clientes', icon: UserCheck, href: '/clients' },
    { name: 'Proveedores', icon: Truck, href: '/suppliers' },
    { name: 'Configuración', icon: Settings, href: '#' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar Mobile */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-slate-900/50 transition-opacity ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setSidebarOpen(false)}
        />
        <div className={`fixed inset-y-0 left-0 w-72 bg-white shadow-xl transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="logo-text">FIDEITEC</span>
                <span className="text-[10px] text-slate-300 font-mono">v{APP_VERSION}</span>
              </div>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1 w-fit">Portal de Empresa</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.href !== '#') {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive 
                      ? 'bg-primary-50 text-primary-700' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-slate-200">
          <div className="flex flex-col p-6 border-b">
            <div className="flex items-baseline gap-2">
              <span className="logo-text">FIDEITEC</span>
              <span className="text-[10px] text-slate-300 font-mono">v{APP_VERSION}</span>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-2 w-fit">Portal de Empresa</span>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => item.href !== '#' && navigate(item.href)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive 
                      ? 'bg-primary-50 text-primary-700 font-medium' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </button>
              );
            })}
          </nav>

          {/* Upgrade/Info section */}
          <div className="p-4 border-t">
            <div className="bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5" />
                <span className="font-semibold">Pro Features</span>
              </div>
              <p className="text-sm text-white/80 mb-3">
                Accede a todas las funcionalidades premium
              </p>
              <button className="w-full bg-white/20 hover:bg-white/30 transition-colors rounded-lg py-2 text-sm font-medium">
                Ver planes
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-4 lg:px-8">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-slate-600 hover:text-slate-800"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-slate-800">
                  {user?.tenant_name || 'Mi Organización'}
                </h1>
                <p className="text-sm text-slate-500">
                  {user?.first_name ? `Hola, ${user.first_name}` : 'Bienvenido'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Notifications */}
              <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* User dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-slate-700">
                      {user?.first_name} {user?.last_name}
                    </p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400 hidden md:block" />
                </button>

                {dropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-medium text-slate-800">
                          {user?.first_name} {user?.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{user?.email}</p>
                        <span className={`inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user?.role)}`}>
                          {getRoleLabel(user?.role)}
                        </span>
                      </div>
                      <div className="py-1">
                        <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <User className="w-4 h-4" />
                          Mi perfil
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <Settings className="w-4 h-4" />
                          Configuración
                        </a>
                        <a href="#" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <Shield className="w-4 h-4" />
                          Seguridad
                        </a>
                      </div>
                      <div className="border-t border-slate-100 py-1">
                        <button 
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar sesión
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content - children will be rendered here */}
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;

