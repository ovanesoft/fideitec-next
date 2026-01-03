import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import { Eye, EyeOff, AlertCircle, Loader2, Truck } from 'lucide-react';

const SupplierLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  
  const { portalToken } = useParams();
  const { loginSupplier, loadTenantInfo, error, tenant } = useSupplierAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      if (portalToken) {
        await loadTenantInfo(portalToken);
      }
      setPageLoading(false);
    };
    init();
  }, [portalToken]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setIsLoading(true);

    const result = await loginSupplier(portalToken, email, password);
    
    if (result.success) {
      navigate(`/supplier-portal/${portalToken}/dashboard`);
    } else {
      setLocalError(result.message);
    }
    
    setIsLoading(false);
  };

  const displayError = localError || error;

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-6 shadow-lg">
            <Truck className="w-10 h-10 text-white" />
          </div>
          
          <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
            <span className="text-sm font-semibold text-white/80">Portal de Proveedores</span>
          </div>
          
          <h1 className="logo-text-lg mb-4">FIDEITEC</h1>
          
          {tenant && (
            <p className="text-xl text-slate-300 mb-8 max-w-md">
              Portal de proveedores de <span className="font-semibold text-white">{tenant.name}</span>
            </p>
          )}
          
          <div className="flex items-center gap-4 text-slate-400 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Portal Seguro
            </span>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-4 shadow-lg">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="logo-text-lg">FIDEITEC</h1>
            <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 mt-2">
              <span className="text-xs font-semibold text-white/80">Portal de Proveedores</span>
            </div>
            {tenant && (
              <p className="text-sm text-slate-400 mt-2">{tenant.name}</p>
            )}
          </div>

          <div className="card animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Iniciar Sesión
              </h2>
              <p className="text-slate-500">
                Accede a tu portal de proveedor
              </p>
            </div>

            {displayError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{displayError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
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
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Contraseña
                </label>
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
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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

            <p className="text-center mt-8 text-sm text-slate-500">
              ¿No tienes acceso? Contacta a la empresa que te invitó.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierLogin;

