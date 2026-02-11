import { Link } from 'react-router-dom';
import { Trash2, Mail, Clock, CheckCircle2 } from 'lucide-react';

const DataDeletion = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
            <Trash2 className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Eliminación de Datos</h1>
            <p className="text-slate-500">Instrucciones para solicitar la eliminación de tus datos</p>
          </div>
        </div>

        <div className="space-y-8 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Tu derecho a la eliminación de datos</h2>
            <p>
              En FIDEITEC respetamos tu privacidad y tu derecho a controlar tus datos personales. 
              Puedes solicitar la eliminación completa de tu cuenta y todos los datos asociados en cualquier momento.
            </p>
          </section>

          <section className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Cómo solicitar la eliminación
            </h2>
            <p className="mb-4">
              Para solicitar la eliminación de tus datos, envía un email a:
            </p>
            <a 
              href="mailto:soporte@fideitec.com?subject=Solicitud%20de%20eliminación%20de%20datos%20-%20FIDEITEC"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <Mail className="w-5 h-5" />
              soporte@fideitec.com
            </a>
            <p className="mt-4 text-sm text-slate-500">
              Asunto sugerido: "Solicitud de eliminación de datos - FIDEITEC"
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Información a incluir en tu solicitud</h2>
            <p className="mb-4">Para procesar tu solicitud de manera eficiente, incluye la siguiente información:</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>Email de tu cuenta:</strong> La dirección de correo electrónico asociada a tu cuenta de FIDEITEC.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>Nombre completo:</strong> Tu nombre tal como aparece en tu perfil.</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span><strong>Motivo (opcional):</strong> Nos ayuda a mejorar nuestro servicio.</span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Tiempo de procesamiento
            </h2>
            <p>
              Procesaremos tu solicitud dentro de los <strong>30 días hábiles</strong> siguientes a la recepción del email. 
              Recibirás una confirmación por correo electrónico una vez que la eliminación se haya completado.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Datos que serán eliminados</h2>
            <p className="mb-4">Al procesar tu solicitud, eliminaremos:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tu información de perfil (nombre, email, foto)</li>
              <li>Datos de autenticación y tokens de sesión</li>
              <li>Historial de actividad en la plataforma</li>
              <li>Cualquier contenido que hayas creado</li>
              <li>Asociaciones con organizaciones (si aplica)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">Datos de Facebook</h2>
            <p>
              Si iniciaste sesión con Facebook, también puedes gestionar los permisos de la aplicación 
              directamente desde la configuración de tu cuenta de Facebook en{' '}
              <a 
                href="https://www.facebook.com/settings?tab=applications" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Configuración de Apps y Sitios Web
              </a>.
            </p>
          </section>

          <section className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Importante</h2>
            <p className="text-yellow-700">
              La eliminación de datos es <strong>irreversible</strong>. Una vez procesada la solicitud, 
              no podremos recuperar tu cuenta ni la información asociada.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 flex flex-wrap gap-4">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Volver al inicio
          </Link>
          <span className="text-slate-300">|</span>
          <Link to="/privacy" className="text-slate-500 hover:text-slate-700">
            Política de Privacidad
          </Link>
          <Link to="/terms" className="text-slate-500 hover:text-slate-700">
            Términos de Servicio
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DataDeletion;

