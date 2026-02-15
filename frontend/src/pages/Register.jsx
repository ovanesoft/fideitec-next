import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  
  const { register, googleLogin, error } = useAuth();
  const navigate = useNavigate();

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

    const result = await register({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      password: formData.password
    });
    
    if (result.success) {
      setSuccess(true);
    } else {
      setLocalError(result.message);
      if (result.errors) {
        const errors = {};
        result.errors.forEach(err => {
          errors[err.field] = err.message;
        });
        setFieldErrors(errors);
      }
    }
    
    setIsLoading(false);
  };

  const displayError = localError || error;

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
          <Link to="/login" className="btn-primary inline-block">
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
            <a href="https://fideitec.com" className="logo-text-lg mb-2 block hover:opacity-80 transition-opacity cursor-pointer">FIDEITEC</a>
            <div className="inline-block px-4 py-1 rounded-full bg-white/10 border border-white/20 mb-4">
              <span className="text-sm font-semibold text-white/80">Portal de Empresa</span>
            </div>
            <p className="text-xl text-white/60 max-w-md">
              Gestión Integral de Fideicomisos Inmobiliarios
            </p>
          </div>
          
          <div className="mt-12 space-y-4">
            {[
              'Gestión de fideicomisos',
              'Tokenización de activos',
              'Seguridad blockchain'
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
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <a href="https://fideitec.com" className="logo-text-lg block hover:opacity-80 transition-opacity cursor-pointer">FIDEITEC</a>
            <div className="inline-block px-3 py-1 rounded-full bg-white/10 border border-white/20 mt-2">
              <span className="text-xs font-semibold text-white/80">Portal de Empresa</span>
            </div>
          </div>

          <div className="card animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-800">Crear cuenta</h2>
              <p className="text-slate-500 mt-2">Comienza tu prueba gratuita hoy</p>
            </div>

            {/* Error message */}
            {displayError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-fade-in">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-red-600 text-sm">{displayError}</p>
              </div>
            )}

            {/* Social Register */}
            <div className="space-y-3 mb-6">
              <button 
                type="button"
                onClick={googleLogin}
                className="btn-social"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Registrarse con Google
              </button>
            </div>

            <div className="divider">
              <span className="text-slate-400 text-sm">o usa tu email</span>
            </div>

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
                  {fieldErrors.firstName && <p className="error-text">{fieldErrors.firstName}</p>}
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
                  {fieldErrors.lastName && <p className="error-text">{fieldErrors.lastName}</p>}
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
                  className={`input-field ${fieldErrors.email ? 'border-red-500' : ''}`}
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
                {fieldErrors.email && <p className="error-text">{fieldErrors.email}</p>}
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
                    className={`input-field pr-12 ${fieldErrors.password ? 'border-red-500' : ''}`}
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
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="error-text">Las contraseñas no coinciden</p>
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
              Al registrarte, aceptas nuestros{' '}
              <Link to="/terms" className="link">Términos de servicio</Link>
              {' '}y{' '}
              <Link to="/privacy" className="link">Política de privacidad</Link>
            </p>

            <p className="text-center mt-4 text-slate-500">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="link">Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;

