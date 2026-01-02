const Terms = () => {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8 md:p-12">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Términos y Condiciones de Servicio</h1>
        <p className="text-slate-500 mb-8">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>

        <div className="space-y-6 text-slate-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Aceptación de los Términos</h2>
            <p>Al acceder y utilizar MyApp ("la Aplicación", "el Servicio"), aceptas estar sujeto a estos Términos y Condiciones de Servicio. Si no estás de acuerdo con alguna parte de estos términos, no podrás acceder al servicio.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Descripción del Servicio</h2>
            <p>MyApp es una plataforma empresarial multi-tenant que permite a las organizaciones gestionar usuarios, equipos y recursos de manera eficiente. El servicio incluye:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Gestión de usuarios y roles.</li>
              <li>Autenticación segura (email/contraseña, Google, Facebook).</li>
              <li>Panel de administración.</li>
              <li>Funcionalidades colaborativas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">3. Registro y Cuenta</h2>
            <p>Para utilizar el servicio, debes:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Ser mayor de 18 años o tener la edad legal en tu jurisdicción.</li>
              <li>Proporcionar información veraz y actualizada.</li>
              <li>Mantener la seguridad de tu contraseña y cuenta.</li>
              <li>Notificarnos inmediatamente sobre cualquier uso no autorizado.</li>
            </ul>
            <p className="mt-2">Eres responsable de todas las actividades que ocurran bajo tu cuenta.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Uso Aceptable</h2>
            <p>Te comprometes a NO utilizar el servicio para:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Violar leyes o regulaciones aplicables.</li>
              <li>Infringir derechos de propiedad intelectual de terceros.</li>
              <li>Transmitir malware, virus u otro código malicioso.</li>
              <li>Intentar acceder sin autorización a sistemas o datos.</li>
              <li>Acosar, amenazar o discriminar a otros usuarios.</li>
              <li>Enviar spam o comunicaciones no solicitadas.</li>
              <li>Interferir con el funcionamiento normal del servicio.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">5. Propiedad Intelectual</h2>
            <p>El servicio y su contenido original, características y funcionalidad son propiedad de MyApp y están protegidos por leyes de propiedad intelectual. No puedes copiar, modificar, distribuir o crear obras derivadas sin autorización expresa.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">6. Contenido del Usuario</h2>
            <p>Eres responsable del contenido que subas o compartas a través del servicio. Al publicar contenido, nos otorgas una licencia no exclusiva para usar, almacenar y mostrar dicho contenido en el contexto del servicio.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">7. Privacidad</h2>
            <p>Tu privacidad es importante para nosotros. Nuestra <a href="/privacy" className="text-primary-600 hover:underline">Política de Privacidad</a> describe cómo recopilamos, usamos y protegemos tu información personal.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">8. Terminación</h2>
            <p>Podemos suspender o terminar tu acceso al servicio inmediatamente, sin previo aviso, por cualquier razón, incluyendo:</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>Violación de estos términos.</li>
              <li>Conducta que consideremos perjudicial para otros usuarios o el servicio.</li>
              <li>Solicitud de autoridades competentes.</li>
            </ul>
            <p className="mt-2">Puedes cancelar tu cuenta en cualquier momento desde la configuración de tu perfil.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">9. Limitación de Responsabilidad</h2>
            <p>El servicio se proporciona "tal cual" y "según disponibilidad". No garantizamos que el servicio sea ininterrumpido, seguro o libre de errores. En ningún caso seremos responsables por daños indirectos, incidentales, especiales o consecuentes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">10. Indemnización</h2>
            <p>Aceptas indemnizar y mantener indemne a MyApp, sus directores, empleados y agentes, de cualquier reclamo, daño, pérdida o gasto que surja de tu uso del servicio o violación de estos términos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">11. Modificaciones</h2>
            <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigencia inmediatamente después de su publicación. El uso continuado del servicio después de los cambios constituye tu aceptación de los nuevos términos.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">12. Ley Aplicable</h2>
            <p>Estos términos se regirán e interpretarán de acuerdo con las leyes de la República Argentina, sin consideración a sus disposiciones sobre conflictos de leyes.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-3">13. Contacto</h2>
            <p>Para preguntas sobre estos términos, contáctanos en:</p>
            <p className="mt-2"><strong>Email:</strong> legal@myapp.com</p>
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

export default Terms;

