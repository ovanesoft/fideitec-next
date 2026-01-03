import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSupplierAuth } from '../../context/SupplierAuthContext';
import axios from '../../api/axios';
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, Truck, Shield, X } from 'lucide-react';

const SupplierSetup = () => {
  const { portalToken, inviteToken } = useParams();
  const navigate = useNavigate();
  const { setupPassword, error: authError, setError: setAuthError } = useSupplierAuth();

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [supplierInfo, setSupplierInfo] = useState(null);
  const [tenantName, setTenantName] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [redirectToLogin, setRedirectToLogin] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [success, setSuccess] = useState(false);

  // Verificar invitación al cargar
  useEffect(() => {
    const verifyInvitation = async () => {
      try {
        const response = await axios.get(`/supplier-portal/${portalToken}/setup/${inviteToken}`);
        if (response.data.success) {
          setSupplierInfo(response.data.data.supplier);
          setTenantName(response.data.data.tenant.name);
        }
      } catch (err) {
        const errorData = err.response?.data;
        if (errorData?.redirect === 'login') {
          setRedirectToLogin(true);
        }
        setInviteError(errorData?.message || 'Invitación no válida');
      } finally {
        setVerifying(false);
        setLoading(false);
      }
    };

    verifyInvitation();
  }, [portalToken, inviteToken]);

  // Validación de contraseña
  const passwordStrength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { score: 1, label: 'Débil', color: 'bg-red-500' };
    if (score <= 4) return { score: 2, label: 'Media', color: 'bg-yellow-500' };
    return { score: 3, label: 'Fuerte', color: 'bg-green-500' };
  }, [password]);

  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password.length < 8) {
      setLocalError('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    if (password !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }

    setIsSubmitting(true);

    const result = await setupPassword(portalToken, inviteToken, password);
    
    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        navigate(`/supplier-portal/${portalToken}/dashboard`);
      }, 2000);
    } else {
      setLocalError(result.message);
    }

    setIsSubmitting(false);
  };

  const displayError = localError || authError;

  // Loading state
  if (loading || verifying) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-slate-400">Verificando invitación...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (inviteError) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Invitación No Válida</h2>
          <p className="text-slate-600 mb-6">{inviteError}</p>
          {redirectToLogin ? (
            <Link
              to={`/supplier-portal/${portalToken}/login`}
              className="btn-primary inline-block"
            >
              Ir a Iniciar Sesión
            </Link>
          ) : (
            <p className="text-sm text-slate-500">
              Contacta a la empresa para solicitar una nueva invitación.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">¡Cuenta Configurada!</h2>
          <p className="text-slate-600 mb-4">
            Tu contraseña ha sido establecida correctamente.
          </p>
          <p className="text-sm text-slate-500">
            Redirigiendo a tu dashboard...
          </p>
          <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
        
        <div className="relative text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-6 shadow-lg">
            <Truck className="w-10 h-10 text-white" />
          </div>
          
          <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
            <span className="text-sm font-semibold text-white/80">Configuración de Cuenta</span>
          </div>
          
          <h1 className="logo-text-lg mb-4">FIDEITEC</h1>
          
          <p className="text-xl text-slate-300 mb-8 max-w-md">
            Bienvenido al portal de proveedores de <span className="font-semibold text-white">{tenantName}</span>
          </p>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 max-w-sm mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-green-400" />
              <span className="font-medium text-white">Tu cuenta está casi lista</span>
            </div>
            <p className="text-sm text-slate-300 text-left">
              Solo necesitas crear una contraseña segura para acceder a tu portal de proveedor.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Setup Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile branding */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl mb-4 shadow-lg">
              <Truck className="w-8 h-8 text-white" />
            </div>
            <h1 className="logo-text-lg">FIDEITEC</h1>
            <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 mt-2">
              <span className="text-xs font-semibold text-white/80">Configuración de Cuenta</span>
            </div>
          </div>

          <div className="card animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Configura tu Contraseña
              </h2>
              <p className="text-slate-500">
                Hola <span className="font-medium">{supplierInfo?.firstName}</span>, 
                crea una contraseña segura para tu cuenta
              </p>
            </div>

            {/* Info del proveedor */}
            <div className="bg-slate-50 rounded-xl p-4 mb-6">
              <p className="text-sm text-slate-600">
                <span className="font-medium">Email:</span> {supplierInfo?.email}
              </p>
              {supplierInfo?.companyName && (
                <p className="text-sm text-slate-600 mt-1">
                  <span className="font-medium">Empresa:</span> {supplierInfo.companyName}
                </p>
              )}
            </div>

            {displayError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{displayError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Nueva Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pr-12"
                    placeholder="Mínimo 8 caracteres"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                
                {/* Password strength indicator */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            passwordStrength.score >= level ? passwordStrength.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs ${
                      passwordStrength.score === 1 ? 'text-red-500' :
                      passwordStrength.score === 2 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      Seguridad: {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-2">
                  Confirmar Contraseña
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`input-field pr-12 ${
                      confirmPassword && (passwordsMatch ? 'border-green-500 focus:ring-green-500' : 'border-red-500 focus:ring-red-500')
                    }`}
                    placeholder="Repite tu contraseña"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword && !passwordsMatch && (
                  <p className="text-xs text-red-500 mt-1">Las contraseñas no coinciden</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Las contraseñas coinciden
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !passwordsMatch}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Configurando...
                  </>
                ) : (
                  'Crear Cuenta'
                )}
              </button>
            </form>

            <p className="text-center mt-6 text-xs text-slate-500">
              Al crear tu cuenta, aceptas nuestros{' '}
              <Link to="/terms" className="link">Términos de Servicio</Link> y{' '}
              <Link to="/privacy" className="link">Política de Privacidad</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierSetup;

