import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Token de verificación no proporcionado');
        return;
      }

      try {
        const response = await api.get(`/auth/verify-email/${token}`);
        setStatus('success');
        setMessage(response.data.message);
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Error al verificar email');
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center p-8">
      <div className="card max-w-md w-full text-center animate-slide-up">
        {status === 'loading' && (
          <>
            <Loader2 className="w-16 h-16 text-primary-500 mx-auto mb-6 animate-spin" />
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Verificando email...</h2>
            <p className="text-slate-600">Por favor espera mientras verificamos tu dirección de email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">¡Email verificado!</h2>
            <p className="text-slate-600 mb-8">{message}</p>
            <Link to="/login" className="btn-primary inline-block">
              Iniciar sesión
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">Error de verificación</h2>
            <p className="text-slate-600 mb-8">{message}</p>
            <div className="space-y-3">
              <Link to="/login" className="btn-primary inline-block w-full">
                Ir al login
              </Link>
              <p className="text-sm text-slate-500">
                ¿El enlace expiró?{' '}
                <Link to="/login" className="link">
                  Solicita uno nuevo
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

