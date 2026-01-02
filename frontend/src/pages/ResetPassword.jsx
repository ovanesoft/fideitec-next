import { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import api from '../api/axios';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('form'); // form, success, error
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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
      color: passed < 2 ? 'bg-red-500' : passed < 4 ? 'bg-yellow-500' : 'bg-green-500'
    };
  }, [formData.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (passwordStrength.score < 4) {
      setError('La contraseña no cumple con todos los requisitos');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });
      setStatus('success');
    } catch (err) {
      if (err.response?.status === 400) {
        setStatus('error');
        setError(err.response?.data?.message || 'Token inválido o expirado');
      } else {
        setError(err.response?.data?.message || 'Error al restablecer contraseña');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Enlace inválido</h2>
          <p className="text-slate-600 mb-8">
            El enlace de restablecimiento es inválido o ha expirado.
          </p>
          <Link to="/forgot-password" className="btn-primary inline-block">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">¡Contraseña actualizada!</h2>
          <p className="text-slate-600 mb-8">
            Tu contraseña ha sido restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Link to="/login" className="btn-primary inline-block">
            Iniciar sesión
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Error</h2>
          <p className="text-slate-600 mb-8">{error}</p>
          <Link to="/forgot-password" className="btn-primary inline-block">
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="card animate-slide-up">
          <Link 
            to="/login" 
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al login
          </Link>

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Nueva contraseña</h2>
            <p className="text-slate-500 mt-2">
              Ingresa tu nueva contraseña
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="form-label">Nueva contraseña</label>
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
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Actualizando...
                </>
              ) : (
                'Actualizar contraseña'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

