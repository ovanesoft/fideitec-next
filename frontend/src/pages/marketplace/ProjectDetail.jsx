import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  MapPin, Building2, Coins, Shield, ExternalLink, ChevronLeft,
  Maximize, BedDouble, Bath, Car, Layers, TrendingUp, Users,
  CheckCircle2, Clock, AlertCircle, ChevronRight, ShieldCheck,
  ArrowRight, Loader2, Calendar, DollarSign, Hash, Globe
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

const STAGE_ORDER = ['paperwork', 'acquisition', 'excavation', 'foundation', 'structure', 'rough_work', 'finishing', 'final_paperwork', 'delivery', 'completed'];

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: 'text-green-600 bg-green-50', label: 'Completada' },
  in_progress: { icon: Clock, color: 'text-blue-600 bg-blue-50', label: 'En progreso' },
  pending: { icon: AlertCircle, color: 'text-gray-400 bg-gray-50', label: 'Pendiente' },
  delayed: { icon: AlertCircle, color: 'text-amber-600 bg-amber-50', label: 'Demorada' }
};

const UNIT_STATUS_COLORS = {
  available: 'bg-green-100 text-green-700',
  reserved: 'bg-amber-100 text-amber-700',
  sold: 'bg-red-100 text-red-700',
  rented: 'bg-purple-100 text-purple-700'
};

const UNIT_STATUS_LABELS = {
  available: 'Disponible',
  reserved: 'Reservada',
  sold: 'Vendida',
  rented: 'Alquilada'
};

const formatCurrency = (value, currency = 'USD') => {
  if (!value) return '-';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(value);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const ProjectDetail = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/marketplace/projects/${id}`);
      if (response.data.success) {
        setData(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al cargar el proyecto');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Proyecto no encontrado</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <Link to="/marketplace" className="text-blue-600 hover:text-blue-700 font-medium">
          Volver al marketplace
        </Link>
      </div>
    );
  }

  const { project, units, stages, tokenization, developer } = data;
  const images = project.marketplace_images?.length > 0 
    ? project.marketplace_images 
    : project.photos?.length > 0 
      ? project.photos 
      : [];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link to="/marketplace" className="hover:text-blue-600 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" />
              Marketplace
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-gray-900 font-medium truncate">{project.title}</span>
          </div>
        </div>
      </div>

      {/* Image gallery */}
      <div className="bg-gray-100">
        <div className="max-w-7xl mx-auto">
          {images.length > 0 ? (
            <div className="relative">
              <div className="aspect-[21/9] overflow-hidden">
                <img 
                  src={images[activeImageIndex]} 
                  alt={project.title}
                  className="w-full h-full object-cover"
                />
              </div>
              {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-full">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${
                        i === activeImageIndex ? 'bg-white' : 'bg-white/40 hover:bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-[21/9] max-h-[400px] flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <Building2 className="w-24 h-24 text-gray-300" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main info */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & basic info */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {project.is_tokenizable && (
                  <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <Coins className="w-3 h-3" /> Tokenizado
                  </span>
                )}
                {project.blockchain_certifications > 0 && (
                  <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Certificado en Blockchain
                  </span>
                )}
                {project.marketplace_featured && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                    Destacado
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {project.title}
              </h1>

              {project.address_city && (
                <div className="flex items-center gap-1.5 text-gray-500 mb-4">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {project.address_city}
                    {project.address_state && `, ${project.address_state}`}
                    {project.address_country && ` - ${project.address_country}`}
                  </span>
                </div>
              )}

              {project.description && (
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {project.description}
                </p>
              )}
            </div>

            {/* Characteristics */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Caracteristicas</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {project.total_area_m2 && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Maximize className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Superficie</p>
                      <p className="font-semibold">{Math.round(project.total_area_m2)} m²</p>
                    </div>
                  </div>
                )}
                {project.rooms && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Ambientes</p>
                      <p className="font-semibold">{project.rooms}</p>
                    </div>
                  </div>
                )}
                {project.bedrooms && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <BedDouble className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Dormitorios</p>
                      <p className="font-semibold">{project.bedrooms}</p>
                    </div>
                  </div>
                )}
                {project.bathrooms && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Bath className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Baños</p>
                      <p className="font-semibold">{project.bathrooms}</p>
                    </div>
                  </div>
                )}
                {project.parking_spaces && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Car className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Cocheras</p>
                      <p className="font-semibold">{project.parking_spaces}</p>
                    </div>
                  </div>
                )}
                {project.floors && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500">Pisos</p>
                      <p className="font-semibold">{project.floors}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Project stages */}
            {stages && stages.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Avance de Obra</h2>
                <div className="flex items-center gap-2 mb-6">
                  <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"
                      style={{ width: `${project.project_progress_percentage || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-blue-600 min-w-[3rem] text-right">
                    {project.project_progress_percentage || 0}%
                  </span>
                </div>

                <div className="space-y-3">
                  {stages.map((stage, index) => {
                    const config = STATUS_CONFIG[stage.status] || STATUS_CONFIG.pending;
                    const Icon = config.icon;
                    return (
                      <div 
                        key={stage.stage}
                        className={`flex items-center gap-3 p-3 rounded-lg ${config.color}`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">
                              {STAGE_LABELS[stage.stage] || stage.stage}
                            </span>
                            <span className="text-xs font-semibold">
                              {stage.progress_percentage}%
                            </span>
                          </div>
                          {stage.status === 'in_progress' && (
                            <div className="h-1 bg-white/50 rounded-full mt-1.5 overflow-hidden">
                              <div 
                                className="h-full bg-blue-600 rounded-full"
                                style={{ width: `${stage.progress_percentage}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Units */}
            {units && units.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Unidades ({units.length})
                  </h2>
                  <div className="flex gap-2 text-xs">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">
                      {units.filter(u => u.status === 'available').length} disponibles
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <th className="px-4 py-3 text-left font-medium">Unidad</th>
                        <th className="px-4 py-3 text-left font-medium">Tipo</th>
                        <th className="px-4 py-3 text-left font-medium">Superficie</th>
                        <th className="px-4 py-3 text-left font-medium">Amb.</th>
                        <th className="px-4 py-3 text-left font-medium">Estado</th>
                        <th className="px-4 py-3 text-right font-medium">Precio</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {units.map(unit => (
                        <tr key={unit.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium text-gray-900">{unit.unit_code}</span>
                              {unit.unit_name && (
                                <p className="text-xs text-gray-500">{unit.unit_name}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 capitalize">{unit.unit_type}</td>
                          <td className="px-4 py-3 text-gray-600">
                            {unit.total_area_m2 ? `${unit.total_area_m2} m²` : '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{unit.rooms || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${UNIT_STATUS_COLORS[unit.status] || 'bg-gray-100 text-gray-600'}`}>
                              {UNIT_STATUS_LABELS[unit.status] || unit.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {unit.list_price ? formatCurrency(unit.list_price, unit.currency) : 'Consultar'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-6">
            {/* Price card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-24">
              {project.current_value && (
                <div className="mb-4">
                  <p className="text-sm text-gray-500 mb-1">Valor del proyecto</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {formatCurrency(project.current_value, project.currency)}
                  </p>
                </div>
              )}

              {/* Tokenization info */}
              {tokenization && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Coins className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-blue-900">Inversion Tokenizada</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Token</span>
                      <span className="font-semibold">{tokenization.token_name} ({tokenization.token_symbol})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Precio/token</span>
                      <span className="font-semibold">{formatCurrency(tokenization.token_price, tokenization.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Disponibles</span>
                      <span className="font-semibold text-green-600">{tokenization.tokens_available}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Inversores</span>
                      <span className="font-semibold">{tokenization.investor_count || 0}</span>
                    </div>
                    {tokenization.certified_count > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Certificados blockchain</span>
                        <span className="font-semibold text-green-600">{tokenization.certified_count}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Red</span>
                      <span className="font-semibold capitalize">{tokenization.blockchain}</span>
                    </div>
                  </div>

                  {/* Progress of token sale */}
                  {tokenization.total_supply > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">Vendidos</span>
                        <span className="font-semibold">
                          {Math.round((tokenization.tokens_sold / tokenization.total_supply) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-blue-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${(tokenization.tokens_sold / tokenization.total_supply) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CTA buttons */}
              <div className="space-y-3">
                <Link
                  to="/register"
                  className="block w-full text-center bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  {tokenization ? 'Invertir en este proyecto' : 'Contactar desarrolladora'}
                </Link>
                <Link
                  to="/login"
                  className="block w-full text-center border border-gray-300 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Ya tengo cuenta
                </Link>
              </div>

              {/* Blockchain verification badge */}
              {project.blockchain_certifications > 0 && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Verificado en Blockchain</p>
                      <p className="text-xs text-green-600">
                        {project.blockchain_certifications} certificado{project.blockchain_certifications > 1 && 's'} anclado{project.blockchain_certifications > 1 && 's'} en blockchain
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Developer card */}
            {developer && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Desarrolladora</h3>
                <div className="flex items-center gap-3 mb-4">
                  {developer.logo ? (
                    <img src={developer.logo} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-blue-600" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{developer.name}</p>
                    <p className="text-xs text-gray-500">{developer.published_projects} proyecto{developer.published_projects !== 1 && 's'}</p>
                  </div>
                </div>
                {developer.description && (
                  <p className="text-sm text-gray-600 mb-4">{developer.description}</p>
                )}
                <div className="space-y-2 text-sm">
                  {developer.website && (
                    <a href={developer.website} target="_blank" rel="noopener noreferrer" 
                       className="flex items-center gap-2 text-blue-600 hover:text-blue-700">
                      <Globe className="w-4 h-4" />
                      {developer.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {developer.email && (
                    <a href={`mailto:${developer.email}`} 
                       className="flex items-center gap-2 text-gray-600 hover:text-gray-700">
                      <span className="text-xs">✉</span>
                      {developer.email}
                    </a>
                  )}
                  {developer.phone && (
                    <a href={`tel:${developer.phone}`} 
                       className="flex items-center gap-2 text-gray-600 hover:text-gray-700">
                      <span className="text-xs">📞</span>
                      {developer.phone}
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Trust info */}
            {project.trust_name && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Fideicomiso</h3>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{project.trust_name}</p>
                    <p className="text-xs text-gray-500 capitalize">
                      {project.trust_type?.replace('_', ' ')} 
                      {project.trust_status && ` - ${project.trust_status}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
