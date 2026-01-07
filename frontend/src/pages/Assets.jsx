import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import UnitDetailModal from '../components/UnitDetailModal';

// Hook para debounce
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};
import { 
  Building, Search, Plus, Filter, 
  CheckCircle2, Clock, AlertCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Eye, Edit, X,
  MapPin, Ruler, DollarSign, Coins, Calendar, Trash2,
  Copy, Home, Building2, Warehouse, Hotel, Car, TreePine,
  Factory, Briefcase, PiggyBank, Layers, BarChart3,
  RotateCcw, Archive
} from 'lucide-react';

// Categorías de activos
const ASSET_CATEGORIES = {
  real_estate: { label: 'Inmueble', icon: Building2, color: 'bg-blue-100 text-blue-700' },
  movable: { label: 'Mueble', icon: Car, color: 'bg-green-100 text-green-700' },
  company: { label: 'Empresa', icon: Factory, color: 'bg-purple-100 text-purple-700' },
  livestock: { label: 'Semoviente', icon: PiggyBank, color: 'bg-yellow-100 text-yellow-700' },
  crops: { label: 'Cosecha', icon: TreePine, color: 'bg-emerald-100 text-emerald-700' },
  project: { label: 'Proyecto', icon: Briefcase, color: 'bg-indigo-100 text-indigo-700' },
  financial: { label: 'Financiero', icon: DollarSign, color: 'bg-cyan-100 text-cyan-700' },
  other: { label: 'Otro', icon: Layers, color: 'bg-gray-100 text-gray-700' }
};

// Tipos de inmuebles
const REAL_ESTATE_TYPES = {
  land: 'Terreno',
  house: 'Casa',
  apartment: 'Departamento',
  office: 'Oficina',
  commercial: 'Local Comercial',
  warehouse: 'Depósito/Galpón',
  hotel: 'Hotel',
  club: 'Club',
  building_under_construction: 'Edificio en Construcción',
  parking: 'Cochera',
  farm: 'Campo/Finca',
  other: 'Otro'
};

// Estados
const STATUS_LABELS = {
  draft: { label: 'Borrador', color: 'bg-slate-100 text-slate-700' },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  active: { label: 'Activo', color: 'bg-green-100 text-green-700' },
  under_construction: { label: 'En Construcción', color: 'bg-blue-100 text-blue-700' },
  maintenance: { label: 'Mantenimiento', color: 'bg-orange-100 text-orange-700' },
  for_sale: { label: 'En Venta', color: 'bg-purple-100 text-purple-700' },
  sold: { label: 'Vendido', color: 'bg-gray-100 text-gray-700' },
  transferred: { label: 'Transferido', color: 'bg-gray-100 text-gray-700' },
  inactive: { label: 'Inactivo', color: 'bg-red-100 text-red-700' }
};

// Etapas de proyecto
const PROJECT_STAGES = {
  paperwork: { label: 'Papeleos', order: 1 },
  acquisition: { label: 'Adquisición', order: 2 },
  excavation: { label: 'Pozo/Excavación', order: 3 },
  foundation: { label: 'Cimientos', order: 4 },
  structure: { label: 'Estructura', order: 5 },
  rough_work: { label: 'Obra Gruesa', order: 6 },
  finishing: { label: 'Terminaciones', order: 7 },
  final_paperwork: { label: 'Papeles Finales', order: 8 },
  delivery: { label: 'Entrega', order: 9 },
  completed: { label: 'Completado', order: 10 }
};

// Colores para nivel de riesgo
const getRiskColor = (level) => {
  if (level <= 3) return 'bg-green-500';
  if (level <= 5) return 'bg-yellow-500';
  if (level <= 7) return 'bg-orange-500';
  return 'bg-red-500';
};

const getRiskLabel = (level) => {
  if (level <= 3) return 'Bajo';
  if (level <= 5) return 'Medio';
  if (level <= 7) return 'Alto';
  return 'Muy Alto';
};

const Assets = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showUnitDetailModal, setShowUnitDetailModal] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Papelera
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [trashUnits, setTrashUnits] = useState([]);
  const [loadingTrash, setLoadingTrash] = useState(false);
  
  // Debounce del search para no buscar en cada tecla
  const search = useDebounce(searchInput, 300);
  
  // Lista de fideicomisos
  const [trustsList, setTrustsList] = useState([]);

  // Formulario de activo
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    asset_category: 'real_estate',
    asset_type: 'apartment',
    trust_id: '',
    // Ubicación
    address_street: '',
    address_number: '',
    address_city: '',
    address_state: '',
    address_postal_code: '',
    address_country: 'ARG',
    // Medidas
    total_area_m2: '',
    covered_area_m2: '',
    rooms: '',
    bedrooms: '',
    bathrooms: '',
    parking_spaces: '',
    floors: '',
    // Riesgo
    risk_level: 5,
    risk_notes: '',
    // Valoración
    acquisition_value: '',
    acquisition_date: '',
    current_value: '',
    currency: 'USD',
    // Tokenización
    is_tokenizable: false,
    total_tokens: '',
    token_value: '',
    // Proyecto
    project_stage: '',
    project_start_date: '',
    project_estimated_end_date: '',
    // Tercerización
    is_outsourced: false,
    outsource_details: '',
    notes: ''
  });

  // Formulario de unidad (unit_code se genera automáticamente en el backend)
  const [unitForm, setUnitForm] = useState({
    unit_name: '',
    floor_number: '',
    unit_type: 'apartment',
    total_area_m2: '',
    covered_area_m2: '',
    rooms: '',
    bedrooms: '',
    bathrooms: '',
    has_balcony: false,
    has_terrace: false,
    orientation: '',
    list_price: '',
    rental_price: '',
    currency: 'USD',
    is_tokenizable: false,
    total_tokens: '',
    token_value: '',
    is_template: false,
    notes: ''
  });

  // Handlers memoizados para evitar re-renders
  const handleFormChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  const handleUnitChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    setUnitForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  }, []);

  // Cargar activos
  const loadAssets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(categoryFilter && { asset_category: categoryFilter })
      });

      const response = await api.get(`/assets?${params}`);
      if (response.data.success) {
        setAssets(response.data.data.assets);
        setTotalPages(response.data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error cargando activos:', error);
      toast.error('Error al cargar activos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      const response = await api.get('/assets/stats');
      if (response.data.success) {
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Cargar fideicomisos
  const loadTrusts = async () => {
    try {
      const response = await api.get('/trusts/select');
      if (response.data.success) {
        setTrustsList(response.data.data.trusts);
      }
    } catch (error) {
      console.error('Error cargando fideicomisos:', error);
    }
  };

  useEffect(() => {
    loadAssets();
    loadStats();
  }, [page, search, statusFilter, categoryFilter]);

  useEffect(() => {
    loadTrusts();
  }, []);

  // =============================================
  // PAPELERA
  // =============================================
  
  const loadTrashUnits = async () => {
    try {
      setLoadingTrash(true);
      const response = await api.get('/units/trash/list');
      if (response.data.success) {
        setTrashUnits(response.data.data.units);
      }
    } catch (error) {
      console.error('Error cargando papelera:', error);
      toast.error('Error al cargar papelera');
    } finally {
      setLoadingTrash(false);
    }
  };

  const handleRestoreUnit = async (unitId) => {
    try {
      const response = await api.post(`/units/${unitId}/restore`);
      if (response.data.success) {
        toast.success(response.data.message);
        loadTrashUnits();
        // Recargar el activo si está abierto
        if (selectedAsset) {
          loadAssetDetail(selectedAsset.id);
        }
      }
    } catch (error) {
      toast.error('Error al restaurar');
    }
  };

  const handlePermanentDelete = async (unitId, unitCode) => {
    if (!window.confirm(`¿Eliminar DEFINITIVAMENTE "${unitCode}"?\n\nEsta acción NO se puede deshacer.`)) {
      return;
    }
    
    try {
      const response = await api.delete(`/units/${unitId}/permanent`);
      if (response.data.success) {
        toast.success(response.data.message);
        loadTrashUnits();
      }
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  const openTrashModal = () => {
    setShowTrashModal(true);
    loadTrashUnits();
  };

  // Obtener detalle de activo
  const loadAssetDetail = async (id) => {
    try {
      const response = await api.get(`/assets/${id}`);
      if (response.data.success) {
        setSelectedAsset(response.data.data.asset);
        setShowDetailModal(true);
      }
    } catch (error) {
      toast.error('Error al cargar detalle');
    }
  };

  // Abrir modal de edición de activo
  const handleEditAsset = async (asset) => {
    try {
      const response = await api.get(`/assets/${asset.id}`);
      if (response.data.success) {
        const assetData = response.data.data.asset;
        setFormData({
          name: assetData.name || '',
          code: assetData.code || '',
          description: assetData.description || '',
          asset_category: assetData.asset_category || 'real_estate',
          asset_type: assetData.asset_type || '',
          trust_id: assetData.trust_id || '',
          status: assetData.status || 'draft',
          address_street: assetData.address_street || '',
          address_number: assetData.address_number || '',
          address_floor: assetData.address_floor || '',
          address_unit: assetData.address_unit || '',
          address_city: assetData.address_city || '',
          address_state: assetData.address_state || '',
          address_postal_code: assetData.address_postal_code || '',
          total_area_m2: assetData.total_area_m2 || '',
          covered_area_m2: assetData.covered_area_m2 || '',
          rooms: assetData.rooms || '',
          bedrooms: assetData.bedrooms || '',
          bathrooms: assetData.bathrooms || '',
          parking_spaces: assetData.parking_spaces || '',
          floors: assetData.floors || '',
          year_built: assetData.year_built || '',
          risk_level: assetData.risk_level || 5,
          acquisition_value: assetData.acquisition_value || '',
          acquisition_date: assetData.acquisition_date ? assetData.acquisition_date.split('T')[0] : '',
          current_value: assetData.current_value || '',
          valuation_date: assetData.valuation_date ? assetData.valuation_date.split('T')[0] : '',
          currency: assetData.currency || 'USD',
          is_tokenizable: assetData.is_tokenizable || false,
          total_tokens: assetData.total_tokens || '',
          token_value: assetData.token_value || '',
          project_stage: assetData.project_stage || '',
          notes: assetData.notes || ''
        });
        setSelectedAsset(assetData);
        setIsEditing(true);
        setShowAddModal(true);
      } else {
        toast.error(response.data.message || 'Error al cargar datos del activo');
      }
    } catch (error) {
      console.error('Error cargando activo para editar:', error);
      toast.error(error.response?.data?.message || 'Error al cargar datos para edición');
    }
  };

  // Crear o actualizar activo
  const handleCreateAsset = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.asset_category) {
      toast.error('Nombre y categoría son requeridos');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        total_area_m2: formData.total_area_m2 ? parseFloat(formData.total_area_m2) : null,
        covered_area_m2: formData.covered_area_m2 ? parseFloat(formData.covered_area_m2) : null,
        rooms: formData.rooms ? parseInt(formData.rooms) : null,
        bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
        parking_spaces: formData.parking_spaces ? parseInt(formData.parking_spaces) : null,
        floors: formData.floors ? parseInt(formData.floors) : null,
        risk_level: parseInt(formData.risk_level),
        acquisition_value: formData.acquisition_value ? parseFloat(formData.acquisition_value) : null,
        current_value: formData.current_value ? parseFloat(formData.current_value) : null,
        total_tokens: formData.total_tokens ? parseInt(formData.total_tokens) : 0,
        token_value: formData.token_value ? parseFloat(formData.token_value) : 0,
        trust_id: formData.trust_id || null
      };

      let response;
      if (isEditing && selectedAsset) {
        // Actualizar
        response = await api.put(`/assets/${selectedAsset.id}`, payload);
        if (response.data.success) {
          toast.success('Activo actualizado exitosamente');
        }
      } else {
        // Crear nuevo
        response = await api.post('/assets', payload);
        if (response.data.success) {
          toast.success('Activo creado exitosamente');
        }
      }
      
      if (response.data.success) {
        setShowAddModal(false);
        resetForm();
        setIsEditing(false);
        setSelectedAsset(null);
        loadAssets();
        loadStats();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || `Error al ${isEditing ? 'actualizar' : 'crear'} activo`);
    } finally {
      setSubmitting(false);
    }
  };

  // Crear unidad
  const handleCreateUnit = async (e) => {
    e.preventDefault();
    if (!selectedAsset) {
      toast.error('El código de unidad es requerido');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post(`/assets/${selectedAsset.id}/units`, {
        ...unitForm,
        floor_number: unitForm.floor_number ? parseInt(unitForm.floor_number) : null,
        total_area_m2: unitForm.total_area_m2 ? parseFloat(unitForm.total_area_m2) : null,
        covered_area_m2: unitForm.covered_area_m2 ? parseFloat(unitForm.covered_area_m2) : null,
        rooms: unitForm.rooms ? parseInt(unitForm.rooms) : null,
        bedrooms: unitForm.bedrooms ? parseInt(unitForm.bedrooms) : null,
        bathrooms: unitForm.bathrooms ? parseInt(unitForm.bathrooms) : null,
        list_price: unitForm.list_price ? parseFloat(unitForm.list_price) : null,
        rental_price: unitForm.rental_price ? parseFloat(unitForm.rental_price) : null,
        total_tokens: unitForm.total_tokens ? parseInt(unitForm.total_tokens) : 0,
        token_value: unitForm.token_value ? parseFloat(unitForm.token_value) : 0
      });
      
      if (response.data.success) {
        toast.success('Unidad creada exitosamente');
        setShowUnitModal(false);
        resetUnitForm();
        loadAssetDetail(selectedAsset.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear unidad');
    } finally {
      setSubmitting(false);
    }
  };

  // Clonar unidad (el código se genera automáticamente)
  const handleCloneUnit = async (unitId) => {
    const count = window.prompt('¿Cuántas copias desea crear?', '1');
    if (!count || isNaN(parseInt(count)) || parseInt(count) < 1) return;

    try {
      const response = await api.post(`/assets/${selectedAsset.id}/units/${unitId}/clone`, {
        count: parseInt(count)
      });
      
      if (response.data.success) {
        toast.success(`${response.data.data.units.length} unidad(es) clonada(s) con códigos automáticos`);
        loadAssetDetail(selectedAsset.id);
      }
    } catch (error) {
      toast.error('Error al clonar unidad');
    }
  };

  // Actualizar etapa del proyecto
  const handleUpdateStage = async (stage, updates) => {
    try {
      await api.put(`/assets/${selectedAsset.id}/stages/${stage}`, updates);
      toast.success('Etapa actualizada');
      loadAssetDetail(selectedAsset.id);
    } catch (error) {
      toast.error('Error al actualizar etapa');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      asset_category: 'real_estate',
      asset_type: 'apartment',
      trust_id: '',
      address_street: '',
      address_number: '',
      address_city: '',
      address_state: '',
      address_postal_code: '',
      address_country: 'ARG',
      total_area_m2: '',
      covered_area_m2: '',
      rooms: '',
      bedrooms: '',
      bathrooms: '',
      parking_spaces: '',
      floors: '',
      risk_level: 5,
      risk_notes: '',
      acquisition_value: '',
      acquisition_date: '',
      current_value: '',
      currency: 'USD',
      is_tokenizable: false,
      total_tokens: '',
      token_value: '',
      project_stage: '',
      project_start_date: '',
      project_estimated_end_date: '',
      is_outsourced: false,
      outsource_details: '',
      notes: ''
    });
  };

  const resetUnitForm = () => {
    setUnitForm({
      unit_name: '',
      floor_number: '',
      unit_type: 'apartment',
      total_area_m2: '',
      covered_area_m2: '',
      rooms: '',
      bedrooms: '',
      bathrooms: '',
      has_balcony: false,
      has_terrace: false,
      orientation: '',
      list_price: '',
      rental_price: '',
      currency: 'USD',
      is_tokenizable: false,
      total_tokens: '',
      token_value: '',
      is_template: false,
      notes: ''
    });
  };

  const formatCurrency = (value, currency = 'USD') => {
    if (!value) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activos</h1>
          <p className="text-slate-500">Gestiona los activos adquiridos y tercerizados</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={openTrashModal}
            className="btn-secondary flex items-center gap-2"
            title="Papelera"
          >
            <Trash2 className="w-4 h-4" />
            Papelera
            {trashUnits.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {trashUnits.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => {
              resetForm();
              setIsEditing(false);
              setSelectedAsset(null);
              setShowAddModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Activo
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                <p className="text-xs text-slate-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.active}</p>
                <p className="text-xs text-slate-500">Activos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.under_construction}</p>
                <p className="text-xs text-slate-500">En Construcción</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Coins className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.tokenizable}</p>
                <p className="text-xs text-slate-500">Tokenizables</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{parseFloat(stats.avg_risk_level || 0).toFixed(1)}</p>
                <p className="text-xs text-slate-500">Riesgo Prom.</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(stats.total_value)}</p>
                <p className="text-xs text-slate-500">Valor Total</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, código o ubicación..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">Todas las categorías</option>
              <option value="real_estate">Inmueble</option>
              <option value="movable">Mueble</option>
              <option value="company">Empresa</option>
              <option value="livestock">Semoviente</option>
              <option value="crops">Cosecha</option>
              <option value="project">Proyecto</option>
              <option value="financial">Financiero</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="active">Activo</option>
              <option value="under_construction">En Construcción</option>
              <option value="for_sale">En Venta</option>
              <option value="sold">Vendido</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-slate-500 mt-2">Cargando...</p>
          </div>
        ) : assets.length === 0 ? (
          <div className="p-8 text-center">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">No hay activos</h3>
            <p className="text-slate-500 mb-4">
              Comienza agregando tu primer activo
            </p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crear activo
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Activo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Categoría
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Estado
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Riesgo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Valor
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Tokens
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Progreso
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {assets.map((asset) => {
                    const categoryInfo = ASSET_CATEGORIES[asset.asset_category] || ASSET_CATEGORIES.other;
                    const CategoryIcon = categoryInfo.icon;
                    const statusInfo = STATUS_LABELS[asset.status] || STATUS_LABELS.draft;
                    
                    return (
                      <tr key={asset.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryInfo.color}`}>
                              <CategoryIcon className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{asset.name}</p>
                              <p className="text-sm text-slate-500">
                                {asset.address_city && `${asset.address_city}`}
                                {asset.code && ` · ${asset.code}`}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${categoryInfo.color}`}>
                              {categoryInfo.label}
                            </span>
                            {asset.asset_type && (
                              <p className="text-xs text-slate-500 mt-1">
                                {REAL_ESTATE_TYPES[asset.asset_type] || asset.asset_type}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getRiskColor(asset.risk_level)}`}></div>
                            <span className="text-sm font-medium">{asset.risk_level}/10</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-medium text-slate-800">
                            {formatCurrency(asset.current_value, asset.currency)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {asset.is_tokenizable ? (
                            <div className="text-sm">
                              <p className="text-slate-800">{asset.tokens_sold?.toLocaleString() || 0} / {asset.total_tokens?.toLocaleString() || 0}</p>
                              <p className="text-slate-500 text-xs">{formatCurrency(asset.token_value, asset.currency)}/tk</p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {asset.project_stage ? (
                            <div>
                              <div className="w-24 bg-slate-200 rounded-full h-2 mb-1">
                                <div 
                                  className="bg-primary-500 h-2 rounded-full" 
                                  style={{ width: `${asset.project_progress_percentage || 0}%` }}
                                />
                              </div>
                              <p className="text-xs text-slate-500">
                                {PROJECT_STAGES[asset.project_stage]?.label || asset.project_stage}
                              </p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => loadAssetDetail(asset.id)}
                              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleEditAsset(asset)}
                              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                              title="Editar activo"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <span className="text-sm text-slate-500">
                  Página {page} de {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Crear/Editar Activo */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => {
            setShowAddModal(false);
            setIsEditing(false);
            setSelectedAsset(null);
          }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => {
                setShowAddModal(false);
                setIsEditing(false);
                setSelectedAsset(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-slate-800 mb-6">
              {isEditing ? 'Editar Activo' : 'Nuevo Activo'}
            </h2>
            
            <form onSubmit={handleCreateAsset} className="space-y-6">
              {/* Info básica */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="form-label">Nombre *</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Nombre del activo"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Código</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="ACT-001"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Categoría *</label>
                  <select 
                    className="input-field"
                    value={formData.asset_category}
                    onChange={(e) => setFormData({...formData, asset_category: e.target.value})}
                  >
                    {Object.entries(ASSET_CATEGORIES).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select 
                    className="input-field"
                    value={formData.asset_type}
                    onChange={(e) => setFormData({...formData, asset_type: e.target.value})}
                  >
                    {Object.entries(REAL_ESTATE_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Fideicomiso</label>
                  <select 
                    className="input-field"
                    value={formData.trust_id}
                    onChange={(e) => setFormData({...formData, trust_id: e.target.value})}
                  >
                    <option value="">Sin fideicomiso</option>
                    {trustsList.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Descripción</label>
                <textarea 
                  className="input-field" 
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              {/* Ubicación */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Ubicación
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="form-label">Calle</label>
                    <input 
                      type="text" 
                      className="input-field"
                      value={formData.address_street}
                      onChange={(e) => setFormData({...formData, address_street: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Número</label>
                    <input 
                      type="text" 
                      className="input-field"
                      value={formData.address_number}
                      onChange={(e) => setFormData({...formData, address_number: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">CP</label>
                    <input 
                      type="text" 
                      className="input-field"
                      value={formData.address_postal_code}
                      onChange={(e) => setFormData({...formData, address_postal_code: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Ciudad</label>
                    <input 
                      type="text" 
                      className="input-field"
                      value={formData.address_city}
                      onChange={(e) => setFormData({...formData, address_city: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Provincia/Estado</label>
                    <input 
                      type="text" 
                      className="input-field"
                      value={formData.address_state}
                      onChange={(e) => setFormData({...formData, address_state: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Características */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                  <Ruler className="w-4 h-4" /> Características
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <label className="form-label">Superficie Total (m²)</label>
                    <input 
                      type="number" 
                      className="input-field"
                      step="0.01"
                      value={formData.total_area_m2}
                      onChange={(e) => setFormData({...formData, total_area_m2: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Sup. Cubierta (m²)</label>
                    <input 
                      type="number" 
                      className="input-field"
                      step="0.01"
                      value={formData.covered_area_m2}
                      onChange={(e) => setFormData({...formData, covered_area_m2: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Ambientes</label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={formData.rooms}
                      onChange={(e) => setFormData({...formData, rooms: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Dormitorios</label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={formData.bedrooms}
                      onChange={(e) => setFormData({...formData, bedrooms: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Baños</label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={formData.bathrooms}
                      onChange={(e) => setFormData({...formData, bathrooms: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Cocheras</label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={formData.parking_spaces}
                      onChange={(e) => setFormData({...formData, parking_spaces: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="form-label">Pisos (edificio)</label>
                    <input 
                      type="number" 
                      className="input-field"
                      value={formData.floors}
                      onChange={(e) => setFormData({...formData, floors: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Riesgo y Valoración */}
              <div className="grid grid-cols-2 gap-6 border-t pt-4">
                <div>
                  <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Nivel de Riesgo
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max="10"
                        className="flex-1"
                        value={formData.risk_level}
                        onChange={(e) => setFormData({...formData, risk_level: e.target.value})}
                      />
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-full ${getRiskColor(formData.risk_level)}`}></div>
                        <span className="font-bold text-lg">{formData.risk_level}</span>
                      </div>
                    </div>
                    <p className="text-sm text-slate-500">{getRiskLabel(formData.risk_level)}</p>
                    <textarea 
                      className="input-field" 
                      rows="2"
                      placeholder="Notas sobre el riesgo..."
                      value={formData.risk_notes}
                      onChange={(e) => setFormData({...formData, risk_notes: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Valoración
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Moneda</label>
                        <select 
                          className="input-field"
                          value={formData.currency}
                          onChange={(e) => setFormData({...formData, currency: e.target.value})}
                        >
                          <option value="USD">USD</option>
                          <option value="ARS">ARS</option>
                          <option value="EUR">EUR</option>
                        </select>
                      </div>
                      <div>
                        <label className="form-label">Fecha Adquisición</label>
                        <input 
                          type="date" 
                          className="input-field"
                          value={formData.acquisition_date}
                          onChange={(e) => setFormData({...formData, acquisition_date: e.target.value})}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="form-label">Valor de Adquisición</label>
                      <input 
                        type="number" 
                        className="input-field"
                        step="0.01"
                        value={formData.acquisition_value}
                        onChange={(e) => setFormData({...formData, acquisition_value: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="form-label">Valor Actual</label>
                      <input 
                        type="number" 
                        className="input-field"
                        step="0.01"
                        value={formData.current_value}
                        onChange={(e) => setFormData({...formData, current_value: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tokenización */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="asset_is_tokenizable"
                    checked={formData.is_tokenizable}
                    onChange={(e) => setFormData({...formData, is_tokenizable: e.target.checked})}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="asset_is_tokenizable" className="font-medium text-slate-800">
                    Habilitar tokenización
                  </label>
                </div>
                
                {formData.is_tokenizable && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Cantidad de Tokens</label>
                      <input 
                        type="number" 
                        className="input-field"
                        value={formData.total_tokens}
                        onChange={(e) => setFormData({...formData, total_tokens: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="form-label">Valor por Token</label>
                      <input 
                        type="number" 
                        className="input-field"
                        step="0.00000001"
                        value={formData.token_value}
                        onChange={(e) => setFormData({...formData, token_value: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Proyecto (para construcciones) */}
              {(formData.asset_type === 'building_under_construction' || formData.asset_category === 'project') && (
                <div className="border-t pt-4">
                  <h3 className="font-medium text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" /> Etapas del Proyecto
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Etapa Actual</label>
                      <select 
                        className="input-field"
                        value={formData.project_stage}
                        onChange={(e) => setFormData({...formData, project_stage: e.target.value})}
                      >
                        <option value="">Seleccionar...</option>
                        {Object.entries(PROJECT_STAGES).map(([key, { label }]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Inicio Proyecto</label>
                      <input 
                        type="date" 
                        className="input-field"
                        value={formData.project_start_date}
                        onChange={(e) => setFormData({...formData, project_start_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="form-label">Fin Estimado</label>
                      <input 
                        type="date" 
                        className="input-field"
                        value={formData.project_estimated_end_date}
                        onChange={(e) => setFormData({...formData, project_estimated_end_date: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tercerización */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="is_outsourced"
                    checked={formData.is_outsourced}
                    onChange={(e) => setFormData({...formData, is_outsourced: e.target.checked})}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="is_outsourced" className="font-medium text-slate-800">
                    Activo tercerizado
                  </label>
                </div>
                {formData.is_outsourced && (
                  <textarea 
                    className="input-field" 
                    rows="2"
                    placeholder="Detalles de la tercerización..."
                    value={formData.outsource_details}
                    onChange={(e) => setFormData({...formData, outsource_details: e.target.value})}
                  />
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setIsEditing(false);
                    setSelectedAsset(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting 
                    ? (isEditing ? 'Guardando...' : 'Creando...') 
                    : (isEditing ? 'Guardar Cambios' : 'Crear Activo')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle Activo */}
      {showDetailModal && selectedAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            {/* Header del detalle */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${ASSET_CATEGORIES[selectedAsset.asset_category]?.color || 'bg-gray-100'}`}>
                  {(() => {
                    const Icon = ASSET_CATEGORIES[selectedAsset.asset_category]?.icon || Layers;
                    return <Icon className="w-7 h-7" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedAsset.name}</h2>
                  <p className="text-slate-500">
                    {selectedAsset.code && `${selectedAsset.code} · `}
                    {selectedAsset.address_city}
                    {selectedAsset.trust_name && ` · ${selectedAsset.trust_name}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABELS[selectedAsset.status]?.color}`}>
                  {STATUS_LABELS[selectedAsset.status]?.label}
                </span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getRiskColor(selectedAsset.risk_level)}`}></div>
                  <span className="text-sm font-medium">Riesgo: {selectedAsset.risk_level}/10</span>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Valor Actual</p>
                <p className="font-semibold text-slate-800">{formatCurrency(selectedAsset.current_value, selectedAsset.currency)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Superficie</p>
                <p className="font-semibold text-slate-800">{selectedAsset.total_area_m2 || '-'} m²</p>
              </div>
              {selectedAsset.is_tokenizable && (
                <>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Tokens</p>
                    <p className="font-semibold text-slate-800">{selectedAsset.total_tokens?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Valor Token</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(selectedAsset.token_value, selectedAsset.currency)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Barra de progreso del proyecto */}
            {selectedAsset.stages && selectedAsset.stages.length > 0 && (
              <div className="border-t pt-6 mb-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Progreso del Proyecto</h3>
                <div className="relative">
                  <div className="flex justify-between mb-2">
                    {selectedAsset.stages.map((stage, idx) => {
                      const stageInfo = PROJECT_STAGES[stage.stage];
                      const isCompleted = stage.status === 'completed';
                      const isInProgress = stage.status === 'in_progress';
                      
                      return (
                        <div key={stage.id} className="flex flex-col items-center flex-1">
                          <button
                            onClick={() => {
                              const newStatus = stage.status === 'completed' ? 'pending' : 
                                               stage.status === 'in_progress' ? 'completed' : 'in_progress';
                              handleUpdateStage(stage.stage, { status: newStatus, progress_percentage: newStatus === 'completed' ? 100 : stage.progress_percentage });
                            }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                              isCompleted ? 'bg-green-500 text-white' :
                              isInProgress ? 'bg-primary-500 text-white animate-pulse' :
                              'bg-slate-200 text-slate-500 hover:bg-slate-300'
                            }`}
                          >
                            {isCompleted ? '✓' : idx + 1}
                          </button>
                          <p className={`text-xs mt-1 text-center ${isInProgress ? 'text-primary-600 font-medium' : 'text-slate-500'}`}>
                            {stageInfo?.label}
                          </p>
                          {isInProgress && (
                            <p className="text-xs text-primary-500">{stage.progress_percentage}%</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Línea de progreso */}
                  <div className="absolute top-4 left-4 right-4 h-0.5 bg-slate-200 -z-10">
                    <div 
                      className="h-full bg-green-500 transition-all"
                      style={{ 
                        width: `${(selectedAsset.stages.filter(s => s.status === 'completed').length / selectedAsset.stages.length) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                <div className="text-center mt-4">
                  <p className="text-2xl font-bold text-primary-600">{selectedAsset.project_progress_percentage || 0}%</p>
                  <p className="text-sm text-slate-500">Progreso Total</p>
                </div>
              </div>
            )}

            {/* Unidades del activo */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Unidades ({selectedAsset.units?.length || 0})
                </h3>
                <button 
                  onClick={() => setShowUnitModal(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Agregar Unidad
                </button>
              </div>

              {selectedAsset.units?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedAsset.units.map((unit) => (
                    <div key={unit.id} className="border rounded-xl p-4 hover:border-primary-300 transition-colors">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold text-slate-800">{unit.unit_code}</p>
                          {unit.unit_name && <p className="text-sm text-slate-500">{unit.unit_name}</p>}
                        </div>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          unit.status === 'available' ? 'bg-green-100 text-green-700' :
                          unit.status === 'reserved' ? 'bg-yellow-100 text-yellow-700' :
                          unit.status === 'sold' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {unit.status === 'available' ? 'Disponible' :
                           unit.status === 'reserved' ? 'Reservada' :
                           unit.status === 'sold' ? 'Vendida' : unit.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <span className="text-slate-500">Piso:</span>
                          <span className="ml-1 font-medium">{unit.floor_number || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">m²:</span>
                          <span className="ml-1 font-medium">{unit.total_area_m2 || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Amb:</span>
                          <span className="ml-1 font-medium">{unit.rooms || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500">Dorm:</span>
                          <span className="ml-1 font-medium">{unit.bedrooms || '-'}</span>
                        </div>
                      </div>

                      {/* Barra de progreso de construcción */}
                      {unit.overall_progress !== undefined && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-500">Progreso</span>
                            <span className="font-medium text-slate-700">{unit.overall_progress || 0}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${unit.overall_progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${unit.overall_progress || 0}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-3 border-t">
                        <p className="font-semibold text-slate-800">
                          {formatCurrency(unit.list_price, unit.currency)}
                        </p>
                        <div className="flex gap-1">
                          {unit.is_template && (
                            <button 
                              onClick={() => handleCloneUnit(unit.id)}
                              className="p-1.5 text-slate-400 hover:text-primary-600 rounded"
                              title="Clonar unidad"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedUnitId(unit.id);
                              setShowUnitDetailModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-primary-600 rounded"
                            title="Ver detalle / Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-xl">
                  <Home className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">No hay unidades registradas</p>
                  <p className="text-sm text-slate-400">Agrega departamentos, locales, cocheras, etc.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar Unidad */}
      {showUnitModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowUnitModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => setShowUnitModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-slate-800 mb-6">Nueva Unidad</h2>
            
            <form onSubmit={handleCreateUnit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Piso</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={unitForm.floor_number}
                    onChange={(e) => setUnitForm({...unitForm, floor_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Tipo</label>
                  <select 
                    className="input-field"
                    value={unitForm.unit_type}
                    onChange={(e) => setUnitForm({...unitForm, unit_type: e.target.value})}
                  >
                    <option value="apartment">Departamento</option>
                    <option value="office">Oficina</option>
                    <option value="commercial">Local</option>
                    <option value="parking">Cochera</option>
                    <option value="storage">Baulera</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Nombre/Descripción</label>
                <input 
                  type="text" 
                  className="input-field"
                  placeholder="Depto 2 ambientes con balcón"
                  value={unitForm.unit_name}
                  onChange={(e) => setUnitForm({...unitForm, unit_name: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="form-label">m² Totales</label>
                  <input 
                    type="number" 
                    className="input-field"
                    step="0.01"
                    value={unitForm.total_area_m2}
                    onChange={(e) => setUnitForm({...unitForm, total_area_m2: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">m² Cubiertos</label>
                  <input 
                    type="number" 
                    className="input-field"
                    step="0.01"
                    value={unitForm.covered_area_m2}
                    onChange={(e) => setUnitForm({...unitForm, covered_area_m2: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Ambientes</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={unitForm.rooms}
                    onChange={(e) => setUnitForm({...unitForm, rooms: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Dormitorios</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={unitForm.bedrooms}
                    onChange={(e) => setUnitForm({...unitForm, bedrooms: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Baños</label>
                  <input 
                    type="number" 
                    className="input-field"
                    value={unitForm.bathrooms}
                    onChange={(e) => setUnitForm({...unitForm, bathrooms: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Orientación</label>
                  <select 
                    className="input-field"
                    value={unitForm.orientation}
                    onChange={(e) => setUnitForm({...unitForm, orientation: e.target.value})}
                  >
                    <option value="">-</option>
                    <option value="N">Norte</option>
                    <option value="S">Sur</option>
                    <option value="E">Este</option>
                    <option value="O">Oeste</option>
                    <option value="NE">Noreste</option>
                    <option value="NO">Noroeste</option>
                    <option value="SE">Sureste</option>
                    <option value="SO">Suroeste</option>
                  </select>
                </div>
                <div className="flex items-end gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unitForm.has_balcony}
                      onChange={(e) => setUnitForm({...unitForm, has_balcony: e.target.checked})}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm">Balcón</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={unitForm.has_terrace}
                      onChange={(e) => setUnitForm({...unitForm, has_terrace: e.target.checked})}
                      className="w-4 h-4 text-primary-600 rounded"
                    />
                    <span className="text-sm">Terraza</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Moneda</label>
                  <select 
                    className="input-field"
                    value={unitForm.currency}
                    onChange={(e) => setUnitForm({...unitForm, currency: e.target.value})}
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Precio de Lista</label>
                  <input 
                    type="number" 
                    className="input-field"
                    step="0.01"
                    value={unitForm.list_price}
                    onChange={(e) => setUnitForm({...unitForm, list_price: e.target.value})}
                  />
                </div>
                <div>
                  <label className="form-label">Alquiler Mensual</label>
                  <input 
                    type="number" 
                    className="input-field"
                    step="0.01"
                    value={unitForm.rental_price}
                    onChange={(e) => setUnitForm({...unitForm, rental_price: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unitForm.is_template}
                    onChange={(e) => setUnitForm({...unitForm, is_template: e.target.checked})}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="text-sm">Usar como plantilla (para clonar)</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button 
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creando...' : 'Crear Unidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle de Unidad */}
      {showUnitDetailModal && selectedUnitId && (
        <UnitDetailModal
          unitId={selectedUnitId}
          assetId={selectedAsset?.id}
          onClose={() => {
            setShowUnitDetailModal(false);
            setSelectedUnitId(null);
          }}
          onUpdate={() => {
            // Recargar detalle del activo para actualizar la lista de unidades
            if (selectedAsset) {
              loadAssetDetail(selectedAsset.id);
            }
          }}
        />
      )}

      {/* Modal Papelera */}
      {showTrashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowTrashModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Papelera</h2>
                  <p className="text-sm text-slate-500">Departamentos eliminados (30 días para restaurar)</p>
                </div>
              </div>
              <button onClick={() => setShowTrashModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
              {loadingTrash ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-slate-500 mt-2">Cargando...</p>
                </div>
              ) : trashUnits.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600">Papelera vacía</h3>
                  <p className="text-slate-400">No hay departamentos eliminados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {trashUnits.map((unit) => (
                    <div key={unit.id} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm bg-slate-200 px-2 py-0.5 rounded">
                              {unit.unit_code}
                            </span>
                            <span className="font-medium text-slate-700">{unit.unit_name || 'Sin nombre'}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {unit.asset_name} • Eliminado por {unit.deleted_by_name || 'Usuario'}
                          </p>
                          <p className="text-xs text-red-500 mt-1">
                            Se eliminará definitivamente en {Math.max(0, Math.floor(unit.days_remaining))} días
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRestoreUnit(unit.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Restaurar"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(unit.id, unit.unit_code)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar definitivamente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Assets;

