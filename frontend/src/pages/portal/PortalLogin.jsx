import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import { Eye, EyeOff, AlertCircle, Loader2, Building2 } from 'lucide-react';

const PortalLogin = () => {
  const { portalToken } = useParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  
  const { login, googleLogin, getTenantInfo, error, isAuthenticated } = useClientAuth();
  const navigate = useNavigate();

  // Cargar información del tenant
  useEffect(() => {
    const loadTenant = async () => {
      const result = await getTenantInfo(portalToken);
      if (result.success) {
        setTenantInfo(result.tenant);
      } else {
        setLocalError(result.message);
      }
      setLoadingTenant(false);
    };
    
    loadTenant();
  }, [portalToken, getTenantInfo]);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate(`/portal/${portalToken}/dashboard`);
    }
  }, [isAuthenticated, navigate, portalToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsLoading(true);

    const result = await login(portalToken, email, password);
    
    if (result.success) {
      navigate(`/portal/${portalToken}/dashboard`);
    } else {
      setLocalError(result.message);
    }
    
    setIsLoading(false);
  };

  const displayError = localError || error;

  if (loadingTenant) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white/60">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (!tenantInfo) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Portal no disponible</h2>
          <p className="text-slate-600">
            {displayError || 'Este portal de clientes no existe o ha sido deshabilitado.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Floating shapes */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl animate-float-slow"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-float-medium"></div>
        
        <div className="relative z-10 text-center">
          <div className="mb-8">
            {tenantInfo.logo_url ? (
              <img 
                src={tenantInfo.logo_url} 
                alt={tenantInfo.name} 
                className="h-20 mx-auto mb-4"
              />
            ) : (
              <div className="w-20 h-20 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            )}
            <h1 className="text-4xl font-bold text-white mb-2">
              {tenantInfo.name}
            </h1>
            <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
              <span className="text-sm font-semibold text-white/80">Portal de Clientes</span>
            </div>
            <p className="text-xl text-white/60 max-w-md">
              Accede a tu cuenta para ver tus inversiones y documentos
            </p>
          </div>
          
          <div className="mt-12 grid grid-cols-3 gap-6">
            {['Inversiones', 'Documentos', 'Estado KYC'].map((feature, i) => (
              <div key={i} className="glass rounded-xl p-4 text-center" style={{ animationDelay: `${i * 0.1}s` }}>
                <span className="text-white/80 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            {tenantInfo.logo_url ? (
              <img 
                src={tenantInfo.logo_url} 
                alt={tenantInfo.name} 
                className="h-12 mx-auto mb-2"
              />
            ) : (
              <div className="w-16 h-16 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-2">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            )}
            <h1 className="text-2xl font-bold text-white">{tenantInfo.name}</h1>
            <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 mt-2">
              <span className="text-xs font-semibold text-white/80">Portal de Clientes</span>
            </div>
          </div>

          <div className="card animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Bienvenido</h2>
              <p className="text-slate-500 mt-2">Inicia sesión en tu cuenta de cliente</p>
            </div>

            {/* Error message */}
            {displayError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{displayError}</p>
              </div>
            )}

            {/* Google Login */}
            <div className="space-y-3 mb-6">
              <button 
                type="button"
                onClick={() => googleLogin(portalToken)}
                className="btn-social"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continuar con Google
              </button>
            </div>

            <div className="divider">
              <span className="text-slate-400 text-sm">o usa tu email</span>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="password" className="form-label mb-0">
                    Contraseña
                  </label>
                  <Link 
                    to={`/portal/${portalToken}/forgot-password`} 
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>

            {tenantInfo.settings?.allow_self_registration && (
              <p className="text-center mt-8 text-slate-500">
                ¿No tienes una cuenta?{' '}
                <Link to={`/portal/${portalToken}/register`} className="link">
                  Regístrate
                </Link>
              </p>
            )}

            {/* Legal Links */}
            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-center gap-4 text-sm">
              {tenantInfo.settings?.privacy_url ? (
                <a 
                  href={tenantInfo.settings.privacy_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-600"
                >
                  Política de Privacidad
                </a>
              ) : (
                <Link to="/privacy" className="text-slate-400 hover:text-slate-600">
                  Política de Privacidad
                </Link>
              )}
              <span className="text-slate-300">•</span>
              {tenantInfo.settings?.terms_url ? (
                <a 
                  href={tenantInfo.settings.terms_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-slate-600"
                >
                  Términos de Servicio
                </a>
              ) : (
                <Link to="/terms" className="text-slate-400 hover:text-slate-600">
                  Términos de Servicio
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalLogin;

