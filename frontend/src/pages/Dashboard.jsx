import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, User, Building2, Users, Settings, Bell, 
  ChevronDown, Menu, X, Shield, Mail, Calendar,
  LayoutDashboard, Zap
} from 'lucide-react';

const Dashboard = () => {
  const { user, logout } = useAuth();
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
    { name: 'Dashboard', icon: LayoutDashboard, current: true },
    { name: 'Fideicomisos', icon: Building2, current: false },
    { name: 'Inversores', icon: Users, current: false },
    { name: 'Configuración', icon: Settings, current: false },
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
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="FIDEITEC" className="w-12 h-12 object-contain" />
              <span className="text-xl text-slate-800 font-script">FIDEITEC</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href="#"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  item.current 
                    ? 'bg-primary-50 text-primary-700' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </a>
            ))}
          </nav>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-slate-200">
          <div className="flex items-center gap-3 p-6 border-b">
            <img src="/logo.png" alt="FIDEITEC" className="w-14 h-14 object-contain" />
            <span className="text-xl text-slate-800 font-script">FIDEITEC</span>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href="#"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  item.current 
                    ? 'bg-primary-50 text-primary-700 font-medium' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </a>
            ))}
          </nav>

          <div className="p-4 border-t">
            <div className="bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl p-4 text-white">
              <Zap className="w-8 h-8 mb-3" />
              <h4 className="font-semibold mb-1">Upgrade a Pro</h4>
              <p className="text-sm text-white/70 mb-3">Accede a todas las funcionalidades</p>
              <button className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-medium transition-colors">
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
                <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
                <p className="text-sm text-slate-500">Bienvenido de vuelta, {user?.firstName}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              <div className="relative">
                <button 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-purple-500 rounded-xl flex items-center justify-center text-white font-semibold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium text-slate-700">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{user?.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
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
                          {user?.firstName} {user?.lastName}
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

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {/* Welcome card */}
          <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-purple-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
            <div className="relative">
              <h2 className="text-2xl font-bold mb-2">¡Hola, {user?.firstName}! 👋</h2>
              <p className="text-white/80 mb-6 max-w-xl">
                Has iniciado sesión correctamente en FIDEITEC. Desde aquí podrás gestionar tus fideicomisos, 
                usuarios e inversiones.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                  <p className="text-white/70 text-sm">Rol</p>
                  <p className="font-semibold">{getRoleLabel(user?.role)}</p>
                </div>
                {user?.tenantName && (
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                    <p className="text-white/70 text-sm">Organización</p>
                    <p className="font-semibold">{user?.tenantName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Usuarios', value: '0', icon: Users, color: 'bg-blue-500' },
              { label: 'Invitaciones', value: '0', icon: Mail, color: 'bg-green-500' },
              { label: 'Sesiones activas', value: '1', icon: Shield, color: 'bg-purple-500' },
              { label: 'Último acceso', value: 'Ahora', icon: Calendar, color: 'bg-orange-500' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* User Info Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">Información de la cuenta</h3>
            </div>
            <div className="p-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <dt className="text-sm text-slate-500">Nombre completo</dt>
                  <dd className="mt-1 text-slate-800 font-medium">{user?.firstName} {user?.lastName}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Email</dt>
                  <dd className="mt-1 text-slate-800 font-medium">{user?.email}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Proveedor de autenticación</dt>
                  <dd className="mt-1 text-slate-800 font-medium capitalize">{user?.authProvider || 'Email'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-slate-500">Email verificado</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      user?.emailVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {user?.emailVerified ? 'Verificado' : 'Pendiente'}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

