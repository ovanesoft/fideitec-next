import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, Building2 } from 'lucide-react';

const PortalRegister = () => {
  const { portalToken } = useParams();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    documentType: 'DNI',
    documentNumber: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  
  const { register, getTenantInfo, error, isAuthenticated } = useClientAuth();
  const navigate = useNavigate();

  // Cargar información del tenant
  useEffect(() => {
    const loadTenant = async () => {
      const result = await getTenantInfo(portalToken);
      if (result.success) {
        setTenantInfo(result.tenant);
        // Verificar si permite auto-registro
        if (!result.tenant.settings?.allow_self_registration) {
          setLocalError('El auto-registro no está habilitado para este portal');
        }
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => ({ ...prev, [name]: null }));
  };

  // Validación de contraseña
  const passwordStrength = useMemo(() => {
    const { password } = formData;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /[0-9]/.test(password),
    };
    
    const passed = Object.values(checks).filter(Boolean).length;
    
    return {
      checks,
      score: passed,
      label: passed === 0 ? '' : passed < 2 ? 'Débil' : passed < 4 ? 'Media' : 'Fuerte',
      color: passed < 2 ? 'bg-red-500' : passed < 4 ? 'bg-yellow-500' : 'bg-green-500'
    };
  }, [formData.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setFieldErrors({});

    // Validaciones del lado del cliente
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Las contraseñas no coinciden');
      return;
    }

    if (passwordStrength.score < 4) {
      setLocalError('La contraseña no cumple con todos los requisitos');
      return;
    }

    setIsLoading(true);

    const result = await register(portalToken, {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      document_type: formData.documentType,
      document_number: formData.documentNumber,
      password: formData.password
    });
    
    if (result.success) {
      setSuccess(true);
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

  if (!tenantInfo || !tenantInfo.settings?.allow_self_registration) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Registro no disponible</h2>
          <p className="text-slate-600 mb-6">
            {displayError || 'El auto-registro no está habilitado. Contacta a la empresa para solicitar acceso.'}
          </p>
          <Link to={`/portal/${portalToken}/login`} className="btn-primary inline-block">
            Ir al Login
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">¡Registro exitoso!</h2>
          <p className="text-slate-600 mb-8">
            Hemos enviado un email de verificación a <span className="font-semibold">{formData.email}</span>. 
            Por favor revisa tu bandeja de entrada y verifica tu cuenta.
          </p>
          <Link to={`/portal/${portalToken}/login`} className="btn-primary inline-block">
            Ir al Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative overflow-hidden">
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
              Crea tu cuenta y accede a tus inversiones
            </p>
          </div>
          
          <div className="mt-12 space-y-4">
            {[
              'Seguimiento de inversiones',
              'Documentos digitales',
              'Verificación KYC segura'
            ].map((feature, i) => (
              <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary-400" />
                <span className="text-white/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-md py-8">
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
              <h2 className="text-2xl font-bold text-slate-800">Crear cuenta</h2>
              <p className="text-slate-500 mt-2">Regístrate como cliente de {tenantInfo.name}</p>
            </div>

            {/* Error message */}
            {displayError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{displayError}</p>
              </div>
            )}

            {/* Register Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="form-label">Nombre</label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.firstName ? 'border-red-500' : ''}`}
                    placeholder="Juan"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="form-label">Apellido</label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={handleChange}
                    className={`input-field ${fieldErrors.lastName ? 'border-red-500' : ''}`}
                    placeholder="Pérez"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="form-label">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="phone" className="form-label">Teléfono</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="+54 11 1234 5678"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="documentType" className="form-label">Tipo Doc.</label>
                  <select
                    id="documentType"
                    name="documentType"
                    value={formData.documentType}
                    onChange={handleChange}
                    className="input-field"
                  >
                    <option value="DNI">DNI</option>
                    <option value="CUIT">CUIT</option>
                    <option value="CUIL">CUIL</option>
                    <option value="PASSPORT">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label htmlFor="documentNumber" className="form-label">Número</label>
                  <input
                    id="documentNumber"
                    name="documentNumber"
                    type="text"
                    value={formData.documentNumber}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="12345678"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="form-label">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={handleChange}
                    className="input-field pr-12"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
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
                
                {/* Password strength indicator */}
                {formData.password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            passwordStrength.score >= level ? passwordStrength.color : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.length ? 'text-green-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className="w-3 h-3" /> Mínimo 8 caracteres
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.lowercase ? 'text-green-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className="w-3 h-3" /> Una minúscula
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.uppercase ? 'text-green-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className="w-3 h-3" /> Una mayúscula
                      </div>
                      <div className={`flex items-center gap-1 ${passwordStrength.checks.number ? 'text-green-600' : 'text-slate-400'}`}>
                        <CheckCircle2 className="w-3 h-3" /> Un número
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="form-label">Confirmar contraseña</label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="input-field pr-12"
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">Las contraseñas no coinciden</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || passwordStrength.score < 4}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  'Crear cuenta'
                )}
              </button>
            </form>

            <p className="text-center mt-6 text-slate-500 text-sm">
              Al registrarte, aceptas los términos y condiciones de {tenantInfo.name}
            </p>

            <p className="text-center mt-4 text-slate-500">
              ¿Ya tienes una cuenta?{' '}
              <Link to={`/portal/${portalToken}/login`} className="link">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalRegister;

