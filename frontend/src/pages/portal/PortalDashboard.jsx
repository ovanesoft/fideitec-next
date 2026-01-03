import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import { 
  LayoutDashboard, 
  FileText, 
  User, 
  LogOut, 
  Menu, 
  X,
  Building2,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronRight,
  Bell
} from 'lucide-react';

const PortalDashboard = () => {
  const { portalToken } = useParams();
  const { client, tenant, logout, isAuthenticated, loading } = useClientAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate(`/portal/${portalToken}/login`);
    }
  }, [isAuthenticated, loading, navigate, portalToken]);

  const handleLogout = async () => {
    await logout();
    navigate(`/portal/${portalToken}/login`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!client || !tenant) {
    return null;
  }

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, current: true },
    { name: 'Mis Inversiones', icon: FileText, current: false },
    { name: 'Mi Perfil', icon: User, current: false },
  ];

  // Estado KYC
  const getKYCStatusInfo = () => {
    switch (client.kycStatus) {
      case 'approved':
        return {
          color: 'bg-green-100 text-green-800',
          icon: CheckCircle2,
          iconColor: 'text-green-600',
          label: 'Verificado',
          message: 'Tu identidad ha sido verificada correctamente.'
        };
      case 'in_review':
        return {
          color: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          iconColor: 'text-yellow-600',
          label: 'En revisión',
          message: 'Tus documentos están siendo revisados. Te notificaremos cuando estén aprobados.'
        };
      case 'rejected':
        return {
          color: 'bg-red-100 text-red-800',
          icon: AlertCircle,
          iconColor: 'text-red-600',
          label: 'Rechazado',
          message: 'Tu verificación fue rechazada. Por favor, contacta a soporte.'
        };
      default:
        return {
          color: 'bg-slate-100 text-slate-800',
          icon: Shield,
          iconColor: 'text-slate-600',
          label: 'Pendiente',
          message: 'Completa tu verificación KYC para acceder a todas las funcionalidades.'
        };
    }
  };

  const kycStatus = getKYCStatusInfo();
  const KYCIcon = kycStatus.icon;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar Mobile */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        {/* Overlay */}
        <div 
          className={`fixed inset-0 bg-slate-900/80 backdrop-blur-sm transition-opacity duration-300 ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        
        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 w-72 bg-white transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              {tenant.logo_url ? (
                <img src={tenant.logo_url} alt={tenant.name} className="h-8" />
              ) : (
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
              )}
              <span className="text-lg font-semibold text-slate-800">{tenant.name}</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      item.current
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-1 bg-white border-r border-slate-200">
          <div className="flex items-center gap-3 p-6 border-b">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10" />
            ) : (
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
            )}
            <div>
              <span className="text-lg font-semibold text-slate-800">{tenant.name}</span>
              <p className="text-xs text-slate-500">Portal de Clientes</p>
            </div>
          </div>

          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      item.current
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                    {item.current && <ChevronRight className="w-4 h-4 ml-auto" />}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {client.firstName?.[0]}{client.lastName?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {client.firstName} {client.lastName}
                </p>
                <p className="text-xs text-slate-500 truncate">{client.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Cerrar sesión</span>
            </button>
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
                <h1 className="text-xl font-semibold text-slate-800">Bienvenido, {client.firstName}</h1>
                <p className="text-sm text-slate-500">Portal de {tenant.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative text-slate-600 hover:text-slate-800">
                <Bell className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                  2
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {/* KYC Alert */}
          {client.kycStatus !== 'approved' && (
            <div className={`mb-6 p-4 rounded-xl flex items-start gap-4 ${
              client.kycStatus === 'pending' ? 'bg-amber-50 border border-amber-200' :
              client.kycStatus === 'in_review' ? 'bg-blue-50 border border-blue-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <KYCIcon className={`w-6 h-6 flex-shrink-0 ${kycStatus.iconColor}`} />
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800">Verificación KYC {kycStatus.label}</h3>
                <p className="text-sm text-slate-600 mt-1">{kycStatus.message}</p>
                {client.kycStatus === 'pending' && (
                  <button className="mt-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                    Completar verificación →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Welcome card */}
          <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-purple-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative">
              <h2 className="text-3xl font-bold mb-2">
                ¡Hola, {client.firstName}!
              </h2>
              <p className="text-white/80 text-lg mb-6">
                Aquí puedes ver el estado de tus inversiones y documentos
              </p>
              
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-white/60 text-sm">Estado KYC</span>
                  <p className="font-semibold">{kycStatus.label}</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-white/60 text-sm">Nivel KYC</span>
                  <p className="font-semibold">Nivel {client.kycLevel || 0}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Inversiones</p>
                  <p className="text-2xl font-bold text-slate-800">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Documentos</p>
                  <p className="text-2xl font-bold text-slate-800">0</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Estado KYC</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${kycStatus.color}`}>
                    {kycStatus.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Client Info Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Mi Información</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Nombre completo</p>
                <p className="font-medium text-slate-800">{client.firstName} {client.lastName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium text-slate-800">{client.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Empresa</p>
                <p className="font-medium text-slate-800">{tenant.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Estado de cuenta</p>
                <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Activo
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PortalDashboard;

