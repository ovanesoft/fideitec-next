import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import api from '../../api/axios';
import toast from 'react-hot-toast';
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
  Bell,
  Coins,
  Download,
  ExternalLink,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  TrendingUp,
  Wallet
} from 'lucide-react';

// Componente para copiar al portapapeles
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
    </button>
  );
};

// Formatear números
const formatNumber = (num) => {
  if (!num) return '0';
  return new Intl.NumberFormat('es-AR').format(num);
};

// Formatear moneda
const formatCurrency = (amount, currency = 'USD') => {
  if (!amount) return '$0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

const PortalDashboard = () => {
  const { portalToken } = useParams();
  const { client, tenant, logout, isAuthenticated, loading } = useClientAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard'); // 'dashboard', 'tokens', 'certificates', 'profile'
  const navigate = useNavigate();

  // Estados para tokens y certificados
  const [tokens, setTokens] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate(`/portal/${portalToken}/login`);
    }
  }, [isAuthenticated, loading, navigate, portalToken]);

  // Cargar tokens y certificados del cliente
  const loadClientData = useCallback(async () => {
    if (!client?.id) return;
    
    setLoadingData(true);
    try {
      const [tokensRes, certsRes] = await Promise.all([
        api.get(`/tokenization/clients/${client.id}/tokens`),
        api.get(`/tokenization/clients/${client.id}/certificates`)
      ]);
      
      const tokenData = tokensRes.data.data.tokens || [];
      setTokens(tokenData);
      setCertificates(certsRes.data.data.certificates || []);
      
      // Calcular valor total del portfolio
      const totalValue = tokenData.reduce((sum, t) => sum + (parseFloat(t.balance_value) || 0), 0);
      setTotalPortfolioValue(totalValue);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoadingData(false);
    }
  }, [client?.id]);

  useEffect(() => {
    if (isAuthenticated && client?.id) {
      loadClientData();
    }
  }, [isAuthenticated, client?.id, loadClientData]);

  // Descargar certificado PDF
  const handleDownloadCertificate = async (certId) => {
    try {
      const res = await api.get(`/tokenization/certificates/${certId}/html`, {
        responseType: 'text'
      });
      
      const printWindow = window.open('', '_blank');
      printWindow.document.write(res.data);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    } catch (error) {
      toast.error('Error al descargar certificado');
    }
  };

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
    { name: 'Dashboard', key: 'dashboard', icon: LayoutDashboard },
    { name: 'Mis Tokens', key: 'tokens', icon: Coins, badge: tokens.length > 0 ? tokens.length : null },
    { name: 'Certificados', key: 'certificates', icon: FileText, badge: certificates.length > 0 ? certificates.length : null },
    { name: 'Mi Perfil', key: 'profile', icon: User },
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
                <li key={item.key}>
                  <button
                    onClick={() => {
                      setActiveSection(item.key);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeSection === item.key
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
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
                <li key={item.key}>
                  <button
                    onClick={() => setActiveSection(item.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      activeSection === item.key
                        ? 'bg-primary-50 text-primary-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto bg-primary-100 text-primary-600 text-xs px-2 py-0.5 rounded-full">
                        {item.badge}
                      </span>
                    )}
                    {activeSection === item.key && !item.badge && <ChevronRight className="w-4 h-4 ml-auto" />}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Coins className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Mis Tokens</p>
                  <p className="text-2xl font-bold text-slate-800">{tokens.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Valor Portfolio</p>
                  <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalPortfolioValue)}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Certificados</p>
                  <p className="text-2xl font-bold text-slate-800">{certificates.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-amber-600" />
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

          {/* Contenido según sección activa */}
          {activeSection === 'dashboard' && (
            <>
              {/* Resumen de tokens */}
              {tokens.length > 0 && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 mb-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-blue-600" />
                    Mis Inversiones en Tokens
                  </h3>
                  <div className="space-y-3">
                    {tokens.slice(0, 3).map((token) => (
                      <div key={token.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Coins className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-800">{token.token_name}</p>
                            <p className="text-sm text-slate-500">{token.token_symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-800">{formatNumber(token.balance)} tokens</p>
                          <p className="text-sm text-green-600">{formatCurrency(token.balance_value, token.currency)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {tokens.length > 3 && (
                    <button 
                      onClick={() => setActiveSection('tokens')}
                      className="w-full mt-4 text-center text-primary-600 hover:text-primary-700 text-sm font-medium"
                    >
                      Ver todos ({tokens.length}) →
                    </button>
                  )}
                </div>
              )}

              {/* Info del cliente */}
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
            </>
          )}

          {/* Sección: Mis Tokens */}
          {activeSection === 'tokens' && (
            <div className="space-y-6">
              {loadingData ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : tokens.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border">
                  <Coins className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">Sin tokens aún</h3>
                  <p className="text-slate-500">Cuando adquieras tokens, aparecerán aquí</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {tokens.map((token) => (
                    <div key={token.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Coins className="w-7 h-7 text-white" />
                          </div>
                          <div>
                            <h4 className="text-lg font-semibold text-slate-800">{token.token_name}</h4>
                            <p className="text-sm text-slate-500 font-mono">{token.token_symbol}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-800">{formatNumber(token.balance)}</p>
                          <p className="text-sm text-slate-500">cuotas partes</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-slate-500">Valor por token</p>
                          <p className="font-medium text-slate-800">
                            {formatCurrency(token.balance > 0 ? token.balance_value / token.balance : 0, token.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Valor total</p>
                          <p className="font-semibold text-green-600">{formatCurrency(token.balance_value, token.currency)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Moneda</p>
                          <p className="font-medium text-slate-800">{token.currency}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500">Estado</p>
                          <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            Activo
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sección: Certificados */}
          {activeSection === 'certificates' && (
            <div className="space-y-6">
              {loadingData ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : certificates.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border">
                  <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-800 mb-2">Sin certificados</h3>
                  <p className="text-slate-500">Los certificados se generan al adquirir tokens</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {certificates.map((cert) => (
                    <div key={cert.id} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-xl ${cert.is_blockchain_certified ? 'bg-green-100' : 'bg-blue-100'}`}>
                            {cert.is_blockchain_certified ? (
                              <ShieldCheck className="w-6 h-6 text-green-600" />
                            ) : (
                              <FileText className="w-6 h-6 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-800">{cert.certificate_number}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(cert.issued_at).toLocaleDateString('es-AR', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                        {cert.is_blockchain_certified && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                            ✓ Blockchain
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-2 mb-4">
                        <div>
                          <p className="text-xs text-slate-500">Token</p>
                          <p className="font-medium text-slate-800">{cert.token_name}</p>
                        </div>
                        <div className="flex justify-between">
                          <div>
                            <p className="text-xs text-slate-500">Cantidad</p>
                            <p className="font-semibold text-slate-800">{formatNumber(cert.token_amount)} cuotas</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Valor</p>
                            <p className="font-semibold text-green-600">{formatCurrency(cert.total_value_at_issue, cert.currency)}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Código de verificación */}
                      <div className="bg-slate-50 rounded-lg p-3 mb-4">
                        <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                          <QrCode className="w-3 h-3" />
                          Código de verificación
                        </p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs font-mono text-slate-600 truncate">
                            {cert.verification_code?.slice(0, 24)}...
                          </code>
                          <CopyButton text={cert.verification_code} />
                        </div>
                      </div>
                      
                      {/* Acciones */}
                      <button
                        onClick={() => handleDownloadCertificate(cert.id)}
                        className="w-full px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Descargar PDF
                      </button>
                      
                      {cert.is_blockchain_certified && cert.blockchain_tx_hash && (
                        <a
                          href={`https://basescan.org/tx/${cert.blockchain_tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full mt-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm text-slate-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Ver en Blockchain
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sección: Perfil */}
          {activeSection === 'profile' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-6">Mi Perfil</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Nombre completo</p>
                  <p className="font-medium text-slate-800 text-lg">{client.firstName} {client.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Email</p>
                  <p className="font-medium text-slate-800 text-lg">{client.email}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Teléfono</p>
                  <p className="font-medium text-slate-800">{client.phone || 'No registrado'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Documento</p>
                  <p className="font-medium text-slate-800">
                    {client.documentType && client.documentNumber 
                      ? `${client.documentType}: ${client.documentNumber}` 
                      : 'No registrado'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Empresa</p>
                  <p className="font-medium text-slate-800">{tenant.name}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Estado de cuenta</p>
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    Activo
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Estado KYC</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${kycStatus.color}`}>
                    {kycStatus.label}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Nivel KYC</p>
                  <p className="font-medium text-slate-800">Nivel {client.kycLevel || 0}</p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default PortalDashboard;

