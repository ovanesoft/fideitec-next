import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
// Mail se usa solo en el icono central, no en inputs
import api from '../api/axios';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      // Siempre mostramos mensaje de éxito por seguridad
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
        <div className="card max-w-md w-full text-center animate-slide-up">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-4">Revisa tu email</h2>
          <p className="text-slate-600 mb-8">
            Si existe una cuenta asociada a <span className="font-semibold">{email}</span>, 
            recibirás un email con instrucciones para restablecer tu contraseña.
          </p>
          <Link to="/login" className="btn-secondary inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver al login
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
              <Mail className="w-8 h-8 text-primary-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">¿Olvidaste tu contraseña?</h2>
            <p className="text-slate-500 mt-2">
              Ingresa tu email y te enviaremos instrucciones para restablecerla.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="form-label">Email</label>
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

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar instrucciones'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

