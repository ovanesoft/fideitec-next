const Privacy = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Política de Privacidad</h1>
        <p className="text-slate-500 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>

        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Información que Recopilamos</h2>
            <p>MyApp ("nosotros", "nuestro" o "la Aplicación") recopila la siguiente información cuando utilizas nuestros servicios:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li><strong>Información de registro:</strong> nombre, apellido, dirección de correo electrónico.</li>
              <li><strong>Información de autenticación:</strong> cuando inicias sesión con Google o Facebook, recibimos tu nombre, email y foto de perfil pública.</li>
              <li><strong>Información de uso:</strong> datos sobre cómo interactúas con la aplicación, incluyendo dirección IP, tipo de navegador y páginas visitadas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Uso de la Información</h2>
            <p>Utilizamos la información recopilada para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Crear y gestionar tu cuenta de usuario.</li>
              <li>Proporcionar, mantener y mejorar nuestros servicios.</li>
              <li>Comunicarnos contigo sobre actualizaciones, seguridad y soporte.</li>
              <li>Proteger contra actividades fraudulentas o no autorizadas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">3. Compartir Información</h2>
            <p>No vendemos, alquilamos ni compartimos tu información personal con terceros, excepto en las siguientes circunstancias:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Con tu consentimiento explícito.</li>
              <li>Para cumplir con obligaciones legales.</li>
              <li>Para proteger nuestros derechos y seguridad.</li>
              <li>Con proveedores de servicios que nos ayudan a operar la aplicación (bajo acuerdos de confidencialidad).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Datos de Facebook</h2>
            <p>Cuando inicias sesión con Facebook, accedemos únicamente a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Tu nombre público.</li>
              <li>Tu dirección de correo electrónico.</li>
              <li>Tu foto de perfil pública.</li>
            </ul>
            <p className="mt-2">No publicamos en tu nombre ni accedemos a tu lista de amigos. Puedes revocar el acceso en cualquier momento desde la configuración de tu cuenta de Facebook.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">5. Seguridad de los Datos</h2>
            <p>Implementamos medidas de seguridad técnicas y organizativas para proteger tu información, incluyendo:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Encriptación de datos en tránsito (HTTPS/TLS).</li>
              <li>Almacenamiento seguro de contraseñas mediante hash.</li>
              <li>Acceso restringido a datos personales.</li>
              <li>Monitoreo de actividades sospechosas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">6. Retención de Datos</h2>
            <p>Conservamos tu información mientras tu cuenta esté activa o según sea necesario para proporcionarte servicios. Puedes solicitar la eliminación de tu cuenta y datos asociados contactándonos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">7. Tus Derechos</h2>
            <p>Tienes derecho a:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar información inexacta.</li>
              <li>Solicitar la eliminación de tus datos.</li>
              <li>Oponerte al procesamiento de tus datos.</li>
              <li>Exportar tus datos en un formato portable.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">8. Cookies</h2>
            <p>Utilizamos cookies esenciales para el funcionamiento de la aplicación, incluyendo:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Cookies de sesión para mantener tu inicio de sesión.</li>
              <li>Cookies de seguridad para proteger tu cuenta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">9. Cambios a esta Política</h2>
            <p>Podemos actualizar esta política de privacidad ocasionalmente. Te notificaremos sobre cambios significativos publicando la nueva política en esta página y actualizando la fecha de "última actualización".</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">10. Contacto</h2>
            <p>Si tienes preguntas sobre esta política de privacidad, puedes contactarnos en:</p>
            <p className="mt-2"><strong>Email:</strong> privacy@myapp.com</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200">
          <a href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
};

export default Privacy;

