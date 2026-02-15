import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, MapPin, Building2, Coins, TrendingUp, Shield, ChevronDown,
  SlidersHorizontal, X, ArrowUpDown, Users, Layers, Filter,
  ChevronLeft, ChevronRight, Loader2, ShieldCheck, Hammer,
  Lock, FileCheck, Globe, Zap, ArrowRight, CheckCircle2, HelpCircle,
  ChevronUp, Hash, Eye, Scale, Wallet, BarChart3
} from 'lucide-react';
import api from '../../api/axios';

const STAGE_LABELS = {
  paperwork: 'Papeleos',
  acquisition: 'Adquisicion',
  excavation: 'Excavacion',
  foundation: 'Cimientos',
  structure: 'Estructura',
  rough_work: 'Obra Gruesa',
  finishing: 'Terminaciones',
  final_paperwork: 'Papeles Finales',
  delivery: 'Entrega',
  completed: 'Completado'
};

const CATEGORY_LABELS = {
  real_estate: 'Inmueble',
  movable: 'Mueble',
  company: 'Empresa',
  livestock: 'Semovientes',
  crops: 'Cosechas',
  project: 'Proyecto',
  financial: 'Financiero',
  other: 'Otro'
};

const CATEGORY_ICONS = {
  real_estate: Building2,
  project: Hammer,
  financial: TrendingUp
};

const formatCurrency = (value, currency = 'USD') => {
  if (!value) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
};

const ProjectCard = ({ project }) => {
  const images = project.marketplace_images?.length > 0 
    ? project.marketplace_images 
    : project.photos?.length > 0 
      ? project.photos 
      : [];

  const firstImage = images[0];
  const CategoryIcon = CATEGORY_ICONS[project.asset_category] || Building2;

  return (
    <Link 
      to={`/marketplace/project/${project.id}`}
      className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-blue-200 transition-all duration-300 flex flex-col"
    >
      {/* Image */}
      <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
        {firstImage ? (
          <img 
            src={firstImage} 
            alt={project.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CategoryIcon className="w-16 h-16 text-gray-300" />
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {project.marketplace_featured && (
            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
              DESTACADO
            </span>
          )}
          {project.is_tokenizable && (
            <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
              <Coins className="w-3 h-3" /> Tokenizado
            </span>
          )}
          {project.blockchain_certifications > 0 && (
            <span className="bg-green-600 text-white text-xs font-semibold px-2 py-1 rounded-md shadow-sm flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Blockchain
            </span>
          )}
        </div>

        {/* Category badge */}
        <div className="absolute bottom-3 right-3">
          <span className="bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-md">
            {CATEGORY_LABELS[project.asset_category] || project.asset_category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Developer */}
        <div className="flex items-center gap-2 mb-2">
          {project.developer_logo ? (
            <img src={project.developer_logo} alt="" className="w-5 h-5 rounded-full object-cover" />
          ) : (
            <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 className="w-3 h-3 text-blue-600" />
            </div>
          )}
          <span className="text-xs text-gray-500 font-medium truncate">{project.developer_name}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2 mb-2">
          {project.title}
        </h3>

        {/* Location */}
        {project.address_city && (
          <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {project.address_city}
              {project.address_state && `, ${project.address_state}`}
            </span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
          {project.total_area_m2 && (
            <span>{Math.round(project.total_area_m2)} m²</span>
          )}
          {project.rooms && (
            <span>{project.rooms} amb.</span>
          )}
          {project.total_units > 0 && (
            <span>{project.available_units}/{project.total_units} unidades</span>
          )}
        </div>

        {/* Progress bar for projects */}
        {project.project_stage && (
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500">
                {STAGE_LABELS[project.project_stage] || project.project_stage}
              </span>
              <span className="text-xs font-semibold text-blue-600">
                {project.project_progress_percentage || 0}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"
                style={{ width: `${project.project_progress_percentage || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Price & Token info */}
        <div className="border-t border-gray-100 pt-3 mt-2">
          {project.current_value ? (
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-gray-900">
                {formatCurrency(project.current_value, project.currency)}
              </span>
              {project.is_tokenizable && project.token_value > 0 && (
                <span className="text-xs text-blue-600 font-medium">
                  desde {formatCurrency(project.token_value, project.currency)}/token
                </span>
              )}
            </div>
          ) : project.is_tokenizable && project.token_value > 0 ? (
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600">
                {formatCurrency(project.token_value, project.currency)} por token
              </span>
              {project.tokens_for_sale > 0 && (
                <span className="text-xs text-gray-400 ml-auto">
                  {project.tokens_for_sale} disponibles
                </span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-400">Consultar precio</span>
          )}
        </div>
      </div>
    </Link>
  );
};

const MarketplaceHome = () => {
  const [projects, setProjects] = useState([]);
  const [featuredProjects, setFeaturedProjects] = useState([]);
  const [filters, setFilters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  // Filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [tokenizable, setTokenizable] = useState(false);
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  // Load filters on mount
  useEffect(() => {
    loadFilters();
    loadFeatured();
  }, []);

  // Load projects when filters change
  useEffect(() => {
    loadProjects();
  }, [page, category, city, tokenizable, sort]);

  const loadFilters = async () => {
    try {
      const response = await api.get('/marketplace/filters');
      if (response.data.success) {
        setFilters(response.data.data);
      }
    } catch (err) {
      console.error('Error loading filters:', err);
    }
  };

  const loadFeatured = async () => {
    try {
      const response = await api.get('/marketplace/featured?limit=3');
      if (response.data.success) {
        setFeaturedProjects(response.data.data.projects);
      }
    } catch (err) {
      console.error('Error loading featured:', err);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', 12);
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (city) params.set('city', city);
      if (tokenizable) params.set('tokenizable', 'true');
      params.set('sort', sort);

      const response = await api.get(`/marketplace/projects?${params.toString()}`);
      if (response.data.success) {
        setProjects(response.data.data.projects);
        setPagination(response.data.data.pagination);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadProjects();
  };

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setCity('');
    setTokenizable(false);
    setSort('newest');
    setPage(1);
  };

  const hasActiveFilters = search || category || city || tokenizable;

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Invertí en proyectos con
              <span className="block text-blue-200">certificación blockchain</span>
            </h1>
            <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
              Explorá proyectos inmobiliarios tokenizados, verificá certificados en blockchain
              y encontrá tu próxima inversión con total transparencia.
            </p>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
              <div className="flex bg-white rounded-xl shadow-2xl overflow-hidden">
                <div className="flex-1 flex items-center px-4">
                  <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Buscar por proyecto, ciudad o desarrolladora..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full px-3 py-4 text-gray-900 placeholder-gray-400 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 font-semibold hover:from-blue-700 hover:to-indigo-800 transition-all"
                >
                  Buscar
                </button>
              </div>
            </form>

            {/* Quick stats */}
            {filters?.stats && (
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-300" />
                  <span className="text-blue-100">
                    <strong className="text-white">{filters.stats.total_projects}</strong> proyectos
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-blue-300" />
                  <span className="text-blue-100">
                    <strong className="text-white">{filters.stats.tokenizable_projects}</strong> tokenizados
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-300" />
                  <span className="text-blue-100">
                    <strong className="text-white">{filters.stats.total_developers}</strong> desarrolladoras
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-300" />
                  <span className="text-blue-100">
                    <strong className="text-white">{filters.stats.available_units}</strong> unidades disponibles
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category filter */}
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setPage(1); }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas las categorías</option>
              {filters?.categories?.map(c => (
                <option key={c.asset_category} value={c.asset_category}>
                  {CATEGORY_LABELS[c.asset_category] || c.asset_category} ({c.count})
                </option>
              ))}
            </select>

            {/* City filter */}
            <select
              value={city}
              onChange={(e) => { setCity(e.target.value); setPage(1); }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todas las ciudades</option>
              {filters?.cities?.map(c => (
                <option key={`${c.address_city}-${c.address_state}`} value={c.address_city}>
                  {c.address_city}{c.address_state && `, ${c.address_state}`} ({c.count})
                </option>
              ))}
            </select>

            {/* Tokenizable toggle */}
            <button
              onClick={() => { setTokenizable(!tokenizable); setPage(1); }}
              className={`text-sm border rounded-lg px-3 py-2 flex items-center gap-1.5 transition-all ${
                tokenizable 
                  ? 'border-blue-500 bg-blue-50 text-blue-700' 
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              Tokenizados
            </button>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ml-auto"
            >
              <option value="newest">Mas recientes</option>
              <option value="featured">Destacados</option>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Results header */}
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-gray-500">
            {pagination.total > 0 ? (
              <>
                <strong className="text-gray-900">{pagination.total}</strong> proyecto{pagination.total !== 1 && 's'} encontrado{pagination.total !== 1 && 's'}
              </>
            ) : loading ? 'Cargando...' : 'No se encontraron proyectos'}
          </p>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No hay proyectos disponibles
            </h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              {hasActiveFilters 
                ? 'Probá ajustando los filtros para encontrar mas resultados.'
                : 'Aun no hay proyectos publicados en el marketplace. Volvé pronto.'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-700 font-medium text-sm"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Project grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-10">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page >= pagination.totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================ */}
      {/* SECCIONES INFORMATIVAS                       */}
      {/* ============================================ */}

      {/* Que es FIDEITEC */}
      <section className="bg-white border-t border-gray-200 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Inversión inmobiliaria accesible, transparente y segura
            </h2>
            <p className="text-gray-500 text-lg">
              FIDEITEC combina la solidez de los fideicomisos inmobiliarios con la transparencia
              de la tecnología blockchain para democratizar el acceso a inversiones de primer nivel.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 rounded-2xl bg-gradient-to-b from-blue-50 to-white border border-blue-100">
              <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Coins className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Tokenizacion de Cuotas Partes</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Cada proyecto se divide en tokens (cuotas partes digitales). Podés invertir desde
                montos accesibles y ser dueño de una fraccion proporcional de un fideicomiso inmobiliario real.
              </p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-gradient-to-b from-green-50 to-white border border-green-100">
              <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Certificacion Blockchain</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Cada operacion, cada certificado y cada firma digital se ancla en la blockchain Base (Ethereum L2),
                generando una prueba inmutable y verificable públicamente por cualquier persona.
              </p>
            </div>
            <div className="text-center p-6 rounded-2xl bg-gradient-to-b from-indigo-50 to-white border border-indigo-100">
              <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Scale className="w-7 h-7 text-indigo-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Fideicomiso como Respaldo Legal</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                A diferencia de las criptomonedas, cada token representa una participacion real en un
                fideicomiso inmobiliario legalmente constituido, con marco juridico argentino completo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Como funciona - Proceso paso a paso */}
      <section className="bg-gray-50 py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Como funciona
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Desde la busqueda del proyecto hasta la certificacion en blockchain, el proceso es simple y transparente.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: 1, icon: Search, title: 'Explorá', desc: 'Navegá los proyectos publicados en el marketplace. Filtrá por ciudad, tipo, precio o tokenización.' },
              { step: 2, icon: Eye, title: 'Analizá', desc: 'Revisá el detalle: avance de obra, unidades disponibles, fideicomiso asociado y datos de la desarrolladora.' },
              { step: 3, icon: Wallet, title: 'Invertí', desc: 'Elegí cuántos tokens querés comprar. Operás en pesos o dólares, sin necesidad de wallets cripto.' },
              { step: 4, icon: FileCheck, title: 'Certificá', desc: 'Recibís un certificado digital firmado con hash SHA-256 único, endosado a tu nombre.' },
              { step: 5, icon: ShieldCheck, title: 'Verificá', desc: 'Tu certificado se ancla en blockchain (Base). Cualquiera puede verificar su autenticidad.' }
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="relative text-center p-5">
                {/* Connector line */}
                {step < 5 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-gray-300 z-0" />
                )}
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg text-white font-bold text-lg">
                    {step}
                  </div>
                  <div className="w-10 h-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Diferenciadores - Comparativa */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                No es cripto.<br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">
                  Es inversión inmobiliaria real.
                </span>
              </h2>
              <p className="text-gray-600 mb-8 text-lg leading-relaxed">
                Los tokens de FIDEITEC no son criptomonedas especulativas. Representan una
                participacion real en un fideicomiso inmobiliario, con activos físicos como respaldo,
                marco legal argentino y documentacion certificada.
              </p>
              <div className="space-y-4">
                {[
                  { icon: Building2, text: 'Respaldado por inmuebles reales valuados y auditados' },
                  { icon: Scale, text: 'Fideicomiso constituido bajo ley argentina (Ley 24.441)' },
                  { icon: Hash, text: 'Hash SHA-256 de cada certificado anclado en blockchain' },
                  { icon: Globe, text: 'Verificación pública en el explorador de blockchain Base' },
                  { icon: Lock, text: 'Operás en pesos o dólares, sin wallets ni gas fees' },
                  { icon: BarChart3, text: 'Seguimiento de avance de obra en tiempo real' }
                ].map(({ icon: Icon, text }, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-gray-700">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparison table */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="font-bold text-gray-900 mb-4 text-center">Comparativa</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 text-gray-500 font-medium">Aspecto</th>
                        <th className="text-center py-3 px-2 text-gray-400 font-medium">Cripto</th>
                        <th className="text-center py-3 px-2 text-gray-400 font-medium">Portales<br/>inmobiliarios</th>
                        <th className="text-center py-3 px-2 font-bold text-blue-600">FIDEITEC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        ['Respaldo real', '❌', '✅', '✅'],
                        ['Inversión fraccionada', '✅', '❌', '✅'],
                        ['Certificación inmutable', '✅', '❌', '✅'],
                        ['Marco legal claro', '❌', '✅', '✅'],
                        ['Sin wallets / gas fees', '❌', '✅', '✅'],
                        ['Verificación pública', '✅', '❌', '✅'],
                        ['Avance de obra', '❌', '❌', '✅'],
                        ['Transparencia total', '⚠️', '⚠️', '✅']
                      ].map(([aspect, cripto, portales, fideitec], i) => (
                        <tr key={i} className="hover:bg-white transition-colors">
                          <td className="py-2.5 px-2 text-gray-700 font-medium">{aspect}</td>
                          <td className="py-2.5 px-2 text-center">{cripto}</td>
                          <td className="py-2.5 px-2 text-center">{portales}</td>
                          <td className="py-2.5 px-2 text-center font-semibold">{fideitec}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tecnología y Seguridad */}
      <section className="bg-gradient-to-br from-gray-900 via-blue-950 to-indigo-950 text-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Tecnología de vanguardia
            </h2>
            <p className="text-blue-200 text-lg max-w-2xl mx-auto">
              Infraestructura enterprise-grade con los más altos estándares de seguridad y disponibilidad.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Zap,
                title: 'Blockchain Base',
                desc: 'Red Ethereum Layer 2 de Coinbase. Transacciones rápidas, económicas y con la seguridad de Ethereum.',
                color: 'from-blue-500/20 to-blue-600/10 border-blue-500/30'
              },
              {
                icon: Lock,
                title: 'Seguridad Enterprise',
                desc: 'Cifrado end-to-end, autenticación JWT, protección XSS/CSRF, rate limiting y auditoría completa de acciones.',
                color: 'from-green-500/20 to-green-600/10 border-green-500/30'
              },
              {
                icon: Hash,
                title: 'Hash SHA-256',
                desc: 'Cada certificado PDF genera un hash criptográfico único que se registra en blockchain como prueba inmutable.',
                color: 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
              },
              {
                icon: Globe,
                title: 'Verificación Pública',
                desc: 'Cualquier persona puede verificar un certificado escaneando el QR o ingresando el código en nuestro verificador.',
                color: 'from-amber-500/20 to-amber-600/10 border-amber-500/30'
              }
            ].map(({ icon: Icon, title, desc, color }, i) => (
              <div key={i} className={`bg-gradient-to-b ${color} border rounded-xl p-6 backdrop-blur-sm`}>
                <Icon className="w-8 h-8 mb-4 text-white/80" />
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-blue-200/80 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Blockchain flow diagram */}
          <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8">
            <h3 className="text-center font-bold text-lg mb-6 text-blue-100">Flujo de certificación blockchain</h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-3 md:gap-2 text-sm">
              {[
                { label: 'Compra de tokens', sub: 'Operación registrada' },
                { label: 'Generación de certificado', sub: 'PDF firmado digitalmente' },
                { label: 'Hash SHA-256', sub: 'Huella digital única' },
                { label: 'Anclaje en Base', sub: 'Transacción on-chain' },
                { label: 'Verificable para siempre', sub: 'Prueba inmutable' }
              ].map(({ label, sub }, i) => (
                <div key={i} className="flex items-center gap-2 md:gap-2">
                  <div className="bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-center min-w-[140px]">
                    <p className="font-semibold text-white text-xs">{label}</p>
                    <p className="text-blue-300/70 text-[10px] mt-0.5">{sub}</p>
                  </div>
                  {i < 4 && <ArrowRight className="w-4 h-4 text-blue-400/50 hidden md:block flex-shrink-0" />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Servicios de la plataforma */}
      <section className="bg-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Servicios integrales
            </h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              FIDEITEC ofrece una plataforma completa para desarrolladoras, fiduciarios e inversores.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Building2, title: 'Gestión de Fideicomisos', desc: 'Administración completa de fideicomisos inmobiliarios con seguimiento en tiempo real de todas las operaciones y cumplimiento normativo automatizado.' },
              { icon: FileCheck, title: 'Digitalización de Cuotas Partes', desc: 'Gestión digital de cuotas partes con certificados firmados digitalmente y registro inmutable en blockchain para máxima trazabilidad.' },
              { icon: ShieldCheck, title: 'Certificación Blockchain', desc: 'Cada documento, firma y transacción se certifica en blockchain como prueba inmutable. Verificación pública de autenticidad.' },
              { icon: BarChart3, title: 'Analytics Avanzado', desc: 'Herramientas de análisis y reporting en tiempo real para monitorear el rendimiento de inversiones y tomar decisiones informadas.' },
              { icon: Scale, title: 'Compliance Legal', desc: 'Cumplimiento automático de normativas argentinas con validación KYC/AML integrada y generación automática de documentación legal.' },
              { icon: Users, title: 'Plataforma Multi-Rol', desc: 'Sistema diferenciado para administradores, operadores, inversores y auditores con permisos granulares y control total.' }
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="group p-6 rounded-xl border border-gray-200 hover:border-blue-200 hover:shadow-lg transition-all">
                <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <Icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* CTA Final */}
      <section className="bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white py-16 md:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Empezá a invertir hoy
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Registrate gratis, explorá los proyectos disponibles y comprá tus primeros tokens
            con certificación blockchain.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-white text-blue-700 font-bold px-8 py-4 rounded-xl hover:shadow-xl transition-all text-lg"
            >
              Crear cuenta gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/marketplace/verify"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-all"
            >
              <Shield className="w-5 h-5" />
              Verificar un certificado
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-6 mt-10 text-sm text-blue-200">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Sin costo de registro
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Sin wallets ni gas fees
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Marco legal argentino
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

// ============================================
// FAQ Component
// ============================================
const FaqSection = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      q: '¿Qué es la tokenización inmobiliaria?',
      a: 'Es la división de un activo inmobiliario en "cuotas partes" digitales llamadas tokens. Por ejemplo, un edificio de USD 5.000.000 puede dividirse en 1.000 tokens de USD 5.000 cada uno, permitiendo que más personas accedan a inversiones inmobiliarias de calidad desde montos accesibles.'
    },
    {
      q: '¿Los tokens de FIDEITEC son criptomonedas?',
      a: 'No. Los tokens de FIDEITEC representan una participación real en un fideicomiso inmobiliario legalmente constituido bajo ley argentina. No son especulativos, están respaldados por activos físicos, y operás en pesos o dólares sin necesidad de wallets cripto ni gas fees.'
    },
    {
      q: '¿Qué es la certificación blockchain?',
      a: 'Cada vez que se emite un certificado de propiedad de tokens, se genera un hash SHA-256 (huella digital única) del documento PDF y se ancla en la blockchain Base (Ethereum L2). Esto crea una prueba inmutable y verificable públicamente de que ese documento existió en ese momento exacto y no fue alterado.'
    },
    {
      q: '¿Cómo verifico un certificado?',
      a: 'Podés verificar cualquier certificado de FIDEITEC de dos formas: (1) escaneando el código QR que aparece en el certificado, o (2) ingresando el código de verificación o hash de transacción en nuestra página de verificación pública. Cualquier persona puede hacerlo sin necesidad de tener cuenta.'
    },
    {
      q: '¿Cuál es el marco legal?',
      a: 'Los fideicomisos se constituyen bajo la Ley 24.441 de Argentina. Cada fideicomiso tiene escritura notarial, registro ante organismos competentes y un fiduciario responsable. FIDEITEC actúa como plataforma tecnológica que digitaliza y certifica las operaciones, no como entidad financiera.'
    },
    {
      q: '¿Necesito experiencia en blockchain?',
      a: 'No. FIDEITEC abstrae toda la complejidad de blockchain. Vos comprás tokens como si compraras cualquier producto online, y nosotros nos encargamos de generar los certificados, anclarlos en blockchain y darte las herramientas para verificarlos.'
    },
    {
      q: '¿Puedo vender mis tokens?',
      a: 'Sí. Los tokens son transferibles dentro de la plataforma. Podés venderlos de vuelta al fideicomiso o transferirlos a otro inversor registrado, dependiendo de las condiciones del fideicomiso específico.'
    },
    {
      q: '¿Qué información veo como inversor?',
      a: 'Desde tu panel podés ver: tus tokens, certificados digitales con verificación blockchain, avance de obra en tiempo real, historial de transacciones, datos del fideicomiso, y documentación legal asociada.'
    }
  ];

  return (
    <section className="bg-gray-50 py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Preguntas frecuentes
          </h2>
          <p className="text-gray-500">
            Todo lo que necesitás saber sobre la inversión tokenizada en FIDEITEC.
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-gray-900 pr-4">{faq.q}</span>
                {openIndex === i ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {openIndex === i && (
                <div className="px-5 pb-5 -mt-1">
                  <p className="text-gray-600 text-sm leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MarketplaceHome;
