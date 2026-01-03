import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import axios from '../../api/axios';
import { 
  LogOut, User, Building2, Mail, Calendar, 
  LayoutDashboard, X, Menu, FileText, Phone,
  Truck, MapPin, CreditCard, Settings
} from 'lucide-react';

const SupplierDashboard = () => {
  const { portalToken } = useParams();
  const { supplier, tenant, logoutSupplier } = useSupplierAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('/supplier-portal/me');
        if (response.data.success) {
          setProfile(response.data.data.supplier);
        }
      } catch (err) {
        console.error('Error cargando perfil:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await logoutSupplier(portalToken);
  };

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, current: true },
    { name: 'Mi Perfil', icon: User, current: false },
    { name: 'Documentos', icon: FileText, current: false },
    { name: 'Configuración', icon: Settings, current: false },
  ];

  const displayName = profile?.company_name || 
    (profile?.first_name ? `${profile.first_name} ${profile.last_name || ''}` : supplier?.companyName) || 
    supplier?.firstName || 'Proveedor';

  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sidebar Mobile Overlay */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'pointer-events-none'}`}>
        <div 
          className={`fixed inset-0 bg-slate-900/50 transition-opacity ${
            sidebarOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setSidebarOpen(false)}
        />
        
        <div className={`fixed inset-y-0 left-0 w-72 bg-white shadow-xl transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex flex-col">
              <span className="logo-text">FIDEITEC</span>
              <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-1 w-fit">
                Portal de Proveedores
              </span>
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
                    ? 'bg-amber-50 text-amber-700' 
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
          <div className="flex flex-col p-6 border-b">
            <span className="logo-text">FIDEITEC</span>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mt-2 w-fit">
              Portal de Proveedores
            </span>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href="#"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  item.current 
                    ? 'bg-amber-50 text-amber-700 font-medium' 
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </a>
            ))}
          </nav>

          {/* Tenant info */}
          <div className="p-4 border-t">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white">
              <div className="flex items-center gap-3 mb-3">
                <Building2 className="w-5 h-5" />
                <span className="font-medium text-sm">Tu empresa cliente</span>
              </div>
              <p className="text-lg font-bold">{profile?.tenant_name || tenant?.name}</p>
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
                <h1 className="text-xl font-semibold text-slate-800">Dashboard de Proveedor</h1>
                <p className="text-sm text-slate-500">Bienvenido de vuelta</p>
              </div>
            </div>

            {/* User dropdown */}
            <div className="relative">
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-semibold">
                  {initials}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-700">{displayName}</p>
                  <p className="text-xs text-slate-500">{supplier?.email || profile?.email}</p>
                </div>
              </button>

              {dropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-fade-in">
                    <div className="px-4 py-3 border-b border-slate-100">
                      <p className="text-sm font-medium text-slate-800">{displayName}</p>
                      <p className="text-xs text-slate-500">{supplier?.email || profile?.email}</p>
                      <span className="inline-flex mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Proveedor
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
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {/* Welcome card */}
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                  Proveedor Activo
                </span>
              </div>
              
              <h2 className="text-2xl font-bold mb-2">¡Hola, {profile?.first_name || supplier?.firstName}! 👋</h2>
              <p className="text-white/80 mb-6 max-w-xl">
                Bienvenido a tu portal de proveedor de {profile?.tenant_name || tenant?.name}. 
                Aquí puedes gestionar tu información y documentación.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                  <p className="text-white/70 text-sm">Estado</p>
                  <p className="font-semibold capitalize">{profile?.status || 'Activo'}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                  <p className="text-white/70 text-sm">Categoría</p>
                  <p className="font-semibold">{profile?.category || 'General'}</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3">
                  <p className="text-white/70 text-sm">Último acceso</p>
                  <p className="font-semibold">
                    {profile?.last_login 
                      ? new Date(profile.last_login).toLocaleDateString('es-AR')
                      : 'Hoy'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[
              { 
                label: 'Email', 
                value: profile?.email || supplier?.email, 
                icon: Mail, 
                color: 'bg-blue-500' 
              },
              { 
                label: 'Teléfono', 
                value: profile?.phone || 'No registrado', 
                icon: Phone, 
                color: 'bg-green-500' 
              },
              { 
                label: 'Documento', 
                value: profile?.document_number 
                  ? `${profile.document_type}: ${profile.document_number}` 
                  : 'No registrado', 
                icon: FileText, 
                color: 'bg-purple-500' 
              },
              { 
                label: 'Miembro desde', 
                value: profile?.created_at 
                  ? new Date(profile.created_at).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
                  : 'Reciente', 
                icon: Calendar, 
                color: 'bg-orange-500' 
              },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="text-lg font-semibold text-slate-800 truncate">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Profile details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Company/Personal Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Información del Proveedor
              </h3>
              <div className="space-y-3">
                {profile?.company_name && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Razón Social</span>
                    <span className="font-medium text-slate-800">{profile.company_name}</span>
                  </div>
                )}
                {profile?.trade_name && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Nombre Comercial</span>
                    <span className="font-medium text-slate-800">{profile.trade_name}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Contacto</span>
                  <span className="font-medium text-slate-800">
                    {profile?.first_name} {profile?.last_name}
                  </span>
                </div>
                {profile?.tax_condition && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-500">Condición Fiscal</span>
                    <span className="font-medium text-slate-800">{profile.tax_condition}</span>
                  </div>
                )}
                {profile?.services_description && (
                  <div className="pt-2">
                    <span className="text-slate-500 text-sm">Servicios</span>
                    <p className="mt-1 text-slate-800">{profile.services_description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Address & Bank Info */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-amber-500" />
                Dirección y Datos Bancarios
              </h3>
              <div className="space-y-3">
                {profile?.address_street && (
                  <div className="py-2 border-b border-slate-100">
                    <span className="text-slate-500 text-sm">Dirección</span>
                    <p className="font-medium text-slate-800 mt-1">
                      {profile.address_street} {profile.address_number}
                      {profile.address_floor && `, Piso ${profile.address_floor}`}
                      {profile.address_apartment && ` ${profile.address_apartment}`}
                    </p>
                    <p className="text-slate-600 text-sm">
                      {profile.address_city}, {profile.address_state} {profile.address_postal_code}
                    </p>
                  </div>
                )}
                {profile?.bank_name && (
                  <>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Banco</span>
                      <span className="font-medium text-slate-800">{profile.bank_name}</span>
                    </div>
                    {profile.bank_cbu && (
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">CBU</span>
                        <span className="font-mono text-sm text-slate-800">{profile.bank_cbu}</span>
                      </div>
                    )}
                    {profile.bank_alias && (
                      <div className="flex justify-between py-2">
                        <span className="text-slate-500">Alias</span>
                        <span className="font-medium text-slate-800">{profile.bank_alias}</span>
                      </div>
                    )}
                  </>
                )}
                {!profile?.address_street && !profile?.bank_name && (
                  <p className="text-slate-500 text-center py-4">
                    No hay información registrada aún
                  </p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SupplierDashboard;

