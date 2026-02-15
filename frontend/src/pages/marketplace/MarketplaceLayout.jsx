import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Building2, Search, Shield, Menu, X, 
  ExternalLink, ChevronRight 
} from 'lucide-react';

const MarketplaceLayout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isHome = location.pathname === '/marketplace' || location.pathname === '/marketplace/';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/marketplace" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-gray-900">FIDEITEC</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full ml-1.5 font-medium">
                  Marketplace
                </span>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              <Link 
                to="/marketplace" 
                className={`text-sm font-medium transition-colors ${isHome ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Proyectos
              </Link>
              <Link 
                to="/marketplace/verify" 
                className={`text-sm font-medium transition-colors flex items-center gap-1 ${location.pathname.includes('/verify') ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              >
                <Shield className="w-4 h-4" />
                Verificar Certificado
              </Link>
              <div className="h-5 w-px bg-gray-300" />
              <a 
                href="/" 
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                fideitec.com
                <ExternalLink className="w-3 h-3" />
              </a>
              <Link 
                to="/login" 
                className="text-sm bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transition-all"
              >
                Iniciar Sesion
              </Link>
            </div>

            {/* Mobile menu button */}
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-2">
              <Link 
                to="/marketplace" 
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Proyectos
              </Link>
              <Link 
                to="/marketplace/verify" 
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Verificar Certificado
              </Link>
              <hr className="my-2" />
              <Link 
                to="/login" 
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                Iniciar Sesion
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-bold text-lg">FIDEITEC</span>
              </div>
              <p className="text-sm leading-relaxed max-w-md">
                Plataforma integral para la gestion y digitalizacion de fideicomisos inmobiliarios 
                con certificacion blockchain. Inversion transparente y segura.
              </p>
              <div className="flex items-center gap-2 mt-4 text-xs">
                <Shield className="w-4 h-4 text-green-400" />
                <span className="text-green-400">Certificados verificables en blockchain (Base)</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Marketplace</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/marketplace" className="hover:text-white transition-colors">Proyectos</Link></li>
                <li><Link to="/marketplace/verify" className="hover:text-white transition-colors">Verificar Certificado</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/privacy" className="hover:text-white transition-colors">Privacidad</Link></li>
                <li><Link to="/terms" className="hover:text-white transition-colors">Terminos</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-xs">
            <p>&copy; {new Date().getFullYear()} FIDEITEC. Todos los derechos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketplaceLayout;
