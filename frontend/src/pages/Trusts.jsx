import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

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
  Building2, Search, Plus, Filter, 
  CheckCircle2, Clock, AlertCircle, FileText,
  ChevronLeft, ChevronRight, Eye, Edit, X,
  Users, DollarSign, Coins, Calendar, Trash2,
  UserPlus, ExternalLink
} from 'lucide-react';

// Etiquetas de tipos de fideicomiso
const TRUST_TYPES = {
  real_estate: { label: 'Inmobiliario', color: 'bg-blue-100 text-blue-700' },
  financial: { label: 'Financiero', color: 'bg-green-100 text-green-700' },
  administration: { label: 'Administración', color: 'bg-purple-100 text-purple-700' },
  guarantee: { label: 'Garantía', color: 'bg-yellow-100 text-yellow-700' },
  investment: { label: 'Inversión', color: 'bg-indigo-100 text-indigo-700' },
  mixed: { label: 'Mixto', color: 'bg-gray-100 text-gray-700' }
};

// Etiquetas de estados
const STATUS_LABELS = {
  draft: { label: 'Borrador', color: 'bg-slate-100 text-slate-700', icon: Clock },
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  active: { label: 'Activo', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  suspended: { label: 'Suspendido', color: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  terminated: { label: 'Terminado', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  liquidated: { label: 'Liquidado', color: 'bg-gray-100 text-gray-700', icon: CheckCircle2 }
};

// Etiquetas de roles de partes
const PARTY_ROLES = {
  fiduciary: { label: 'Fiduciario', description: 'Administrador del fideicomiso' },
  settlor: { label: 'Fiduciante', description: 'Aportante de bienes' },
  beneficiary: { label: 'Beneficiario', description: 'Receptor de beneficios' },
  trustee: { label: 'Fideicomisario', description: 'Titular de derechos' },
  guarantor: { label: 'Garante', description: 'Garantiza obligaciones' },
  auditor: { label: 'Auditor', description: 'Control y auditoría' },
  legal_advisor: { label: 'Asesor Legal', description: 'Asesoramiento jurídico' },
  other: { label: 'Otro', description: 'Otro rol' }
};

const Trusts = () => {
  const { user } = useAuth();
  const [trusts, setTrusts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPartyModal, setShowPartyModal] = useState(false);
  const [selectedTrust, setSelectedTrust] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Debounce del search para no buscar en cada tecla
  const search = useDebounce(searchInput, 300);
  
  // Listas para selectores
  const [clientsList, setClientsList] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);

  // Formulario de fideicomiso
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    trust_type: 'real_estate',
    constitution_date: '',
    start_date: '',
    end_date: '',
    contract_number: '',
    notary_name: '',
    notary_registry: '',
    initial_patrimony: '',
    currency: 'ARS',
    is_tokenizable: false,
    total_tokens: '',
    token_value: '',
    notes: ''
  });

  // Formulario de parte
  const [partyForm, setPartyForm] = useState({
    party_role: 'beneficiary',
    party_type: 'client',
    client_id: '',
    user_id: '',
    supplier_id: '',
    external_name: '',
    external_document_type: 'DNI',
    external_document_number: '',
    external_email: '',
    external_phone: '',
    participation_percentage: '',
    contribution_amount: '',
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

  const handlePartyChange = useCallback((e) => {
    const { name, value } = e.target;
    setPartyForm(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  // Cargar fideicomisos
  const loadTrusts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { trust_type: typeFilter })
      });

      const response = await api.get(`/trusts?${params}`);
      if (response.data.success) {
        setTrusts(response.data.data.trusts);
        setTotalPages(response.data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error cargando fideicomisos:', error);
      toast.error('Error al cargar fideicomisos');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      const response = await api.get('/trusts/stats');
      if (response.data.success) {
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Cargar listas para selectores
  const loadLists = async () => {
    try {
      // Cargar cada lista por separado para manejar errores individuales
      const clientsRes = await api.get('/clients?limit=100').catch(() => ({ data: { success: false } }));
      const usersRes = await api.get('/users/tenant').catch(() => ({ data: { success: false } }));
      const suppliersRes = await api.get('/suppliers?limit=100').catch(() => ({ data: { success: false } }));
      
      if (clientsRes.data.success) setClientsList(clientsRes.data.data.clients || []);
      if (usersRes.data.success) setUsersList(usersRes.data.data.users || []);
      if (suppliersRes.data.success) setSuppliersList(suppliersRes.data.data.suppliers || []);
    } catch (error) {
      console.error('Error cargando listas:', error);
    }
  };

  useEffect(() => {
    loadTrusts();
    loadStats();
  }, [page, search, statusFilter, typeFilter]);

  useEffect(() => {
    loadLists();
  }, []);

  // Obtener detalle de fideicomiso
  const loadTrustDetail = async (id) => {
    try {
      const response = await api.get(`/trusts/${id}`);
      if (response.data.success) {
        setSelectedTrust(response.data.data.trust);
        setShowDetailModal(true);
      }
    } catch (error) {
      toast.error('Error al cargar detalle');
    }
  };

  // Crear fideicomiso
  const handleCreateTrust = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error('El nombre es requerido');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/trusts', {
        ...formData,
        initial_patrimony: formData.initial_patrimony ? parseFloat(formData.initial_patrimony) : 0,
        total_tokens: formData.total_tokens ? parseInt(formData.total_tokens) : 0,
        token_value: formData.token_value ? parseFloat(formData.token_value) : 0
      });
      
      if (response.data.success) {
        toast.success('Fideicomiso creado exitosamente');
        setShowAddModal(false);
        resetForm();
        loadTrusts();
        loadStats();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear fideicomiso');
    } finally {
      setSubmitting(false);
    }
  };

  // Agregar parte al fideicomiso
  const handleAddParty = async (e) => {
    e.preventDefault();
    if (!selectedTrust) return;

    setSubmitting(true);
    try {
      const response = await api.post(`/trusts/${selectedTrust.id}/parties`, {
        ...partyForm,
        participation_percentage: partyForm.participation_percentage ? parseFloat(partyForm.participation_percentage) : 0,
        contribution_amount: partyForm.contribution_amount ? parseFloat(partyForm.contribution_amount) : 0
      });
      
      if (response.data.success) {
        toast.success('Parte agregada exitosamente');
        setShowPartyModal(false);
        resetPartyForm();
        loadTrustDetail(selectedTrust.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al agregar parte');
    } finally {
      setSubmitting(false);
    }
  };

  // Eliminar parte
  const handleRemoveParty = async (partyId) => {
    if (!window.confirm('¿Eliminar esta parte del fideicomiso?')) return;
    
    try {
      await api.delete(`/trusts/${selectedTrust.id}/parties/${partyId}`);
      toast.success('Parte eliminada');
      loadTrustDetail(selectedTrust.id);
    } catch (error) {
      toast.error('Error al eliminar parte');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      trust_type: 'real_estate',
      constitution_date: '',
      start_date: '',
      end_date: '',
      contract_number: '',
      notary_name: '',
      notary_registry: '',
      initial_patrimony: '',
      currency: 'ARS',
      is_tokenizable: false,
      total_tokens: '',
      token_value: '',
      notes: ''
    });
  };

  const resetPartyForm = () => {
    setPartyForm({
      party_role: 'beneficiary',
      party_type: 'client',
      client_id: '',
      user_id: '',
      supplier_id: '',
      external_name: '',
      external_document_type: 'DNI',
      external_document_number: '',
      external_email: '',
      external_phone: '',
      participation_percentage: '',
      contribution_amount: '',
      notes: ''
    });
  };

  const formatCurrency = (value, currency = 'ARS') => {
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
          <h1 className="text-2xl font-bold text-slate-800">Fideicomisos</h1>
          <p className="text-slate-500">Gestiona los contratos de fideicomiso</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuevo Fideicomiso
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
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
                <p className="text-2xl font-bold text-slate-800">{stats.pending}</p>
                <p className="text-xs text-slate-500">Pendientes</p>
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
          <div className="bg-white rounded-xl p-4 border border-slate-200 col-span-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{formatCurrency(stats.total_patrimony)}</p>
                <p className="text-xs text-slate-500">Patrimonio Total</p>
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
              placeholder="Buscar por nombre o código..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">Todos los estados</option>
              <option value="draft">Borrador</option>
              <option value="pending">Pendiente</option>
              <option value="active">Activo</option>
              <option value="suspended">Suspendido</option>
              <option value="terminated">Terminado</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">Todos los tipos</option>
              <option value="real_estate">Inmobiliario</option>
              <option value="financial">Financiero</option>
              <option value="administration">Administración</option>
              <option value="guarantee">Garantía</option>
              <option value="investment">Inversión</option>
              <option value="mixed">Mixto</option>
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
        ) : trusts.length === 0 ? (
          <div className="p-8 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">No hay fideicomisos</h3>
            <p className="text-slate-500 mb-4">
              Comienza creando tu primer fideicomiso
            </p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Crear fideicomiso
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Fideicomiso
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Tipo
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Estado
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Patrimonio
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Tokens
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Partes
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {trusts.map((trust) => {
                    const typeInfo = TRUST_TYPES[trust.trust_type] || TRUST_TYPES.mixed;
                    const statusInfo = STATUS_LABELS[trust.status] || STATUS_LABELS.draft;
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <tr key={trust.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-slate-800">{trust.name}</p>
                            {trust.code && (
                              <p className="text-sm text-slate-500">Código: {trust.code}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm font-medium text-slate-800">
                            {formatCurrency(trust.current_patrimony, trust.currency)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {trust.is_tokenizable ? (
                            <div className="text-sm">
                              <p className="text-slate-800">{trust.tokens_sold?.toLocaleString() || 0} / {trust.total_tokens?.toLocaleString() || 0}</p>
                              <p className="text-slate-500 text-xs">{formatCurrency(trust.token_value, trust.currency)}/token</p>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">No tokenizable</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4 text-slate-400" />
                            <span className="text-sm text-slate-600">{trust.party_count || 0}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => loadTrustDetail(trust.id)}
                              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                              title="Ver detalle"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
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

      {/* Modal Crear Fideicomiso */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-slate-800 mb-6">Nuevo Fideicomiso</h2>
            
            <form onSubmit={handleCreateTrust} className="space-y-6">
              {/* Información básica */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="form-label">Nombre *</label>
                  <input 
                    type="text" 
                    name="name"
                    className="input-field" 
                    placeholder="Nombre del fideicomiso"
                    value={formData.name}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Código</label>
                  <input 
                    type="text" 
                    name="code"
                    className="input-field" 
                    placeholder="FID-001"
                    value={formData.code}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Descripción</label>
                <textarea 
                  name="description"
                  className="input-field" 
                  rows="2"
                  placeholder="Descripción del fideicomiso..."
                  value={formData.description}
                  onChange={handleFormChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Tipo de Fideicomiso</label>
                  <select 
                    name="trust_type"
                    className="input-field"
                    value={formData.trust_type}
                    onChange={handleFormChange}
                  >
                    <option value="real_estate">Inmobiliario</option>
                    <option value="financial">Financiero</option>
                    <option value="administration">Administración</option>
                    <option value="guarantee">Garantía</option>
                    <option value="investment">Inversión</option>
                    <option value="mixed">Mixto</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Moneda</label>
                  <select 
                    name="currency"
                    className="input-field"
                    value={formData.currency}
                    onChange={handleFormChange}
                  >
                    <option value="ARS">ARS - Peso Argentino</option>
                    <option value="USD">USD - Dólar</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Fecha Constitución</label>
                  <input 
                    type="date" 
                    name="constitution_date"
                    className="input-field"
                    value={formData.constitution_date}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="form-label">Fecha Inicio</label>
                  <input 
                    type="date" 
                    name="start_date"
                    className="input-field"
                    value={formData.start_date}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="form-label">Fecha Fin Prevista</label>
                  <input 
                    type="date" 
                    name="end_date"
                    className="input-field"
                    value={formData.end_date}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              {/* Datos notariales */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Nº Contrato</label>
                  <input 
                    type="text" 
                    name="contract_number"
                    className="input-field"
                    placeholder="Escritura Nº"
                    value={formData.contract_number}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="form-label">Escribano</label>
                  <input 
                    type="text" 
                    name="notary_name"
                    className="input-field"
                    placeholder="Nombre del escribano"
                    value={formData.notary_name}
                    onChange={handleFormChange}
                  />
                </div>
                <div>
                  <label className="form-label">Registro</label>
                  <input 
                    type="text" 
                    name="notary_registry"
                    className="input-field"
                    placeholder="Nº de registro"
                    value={formData.notary_registry}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              {/* Patrimonio */}
              <div>
                <label className="form-label">Patrimonio Inicial</label>
                <input 
                  type="number" 
                  name="initial_patrimony"
                  className="input-field"
                  placeholder="0.00"
                  step="0.01"
                  value={formData.initial_patrimony}
                  onChange={handleFormChange}
                />
              </div>

              {/* Tokenización */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_tokenizable"
                    id="is_tokenizable"
                    checked={formData.is_tokenizable}
                    onChange={handleFormChange}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <label htmlFor="is_tokenizable" className="font-medium text-slate-800">
                    Habilitar tokenización
                  </label>
                </div>
                
                {formData.is_tokenizable && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Cantidad de Tokens</label>
                      <input 
                        type="number" 
                        name="total_tokens"
                        className="input-field"
                        placeholder="1000000"
                        value={formData.total_tokens}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div>
                      <label className="form-label">Valor por Token</label>
                      <input 
                        type="number" 
                        name="token_value"
                        className="input-field"
                        placeholder="1.00"
                        step="0.00000001"
                        value={formData.token_value}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div>
                <label className="form-label">Notas</label>
                <textarea 
                  name="notes"
                  className="input-field" 
                  rows="2"
                  placeholder="Notas adicionales..."
                  value={formData.notes}
                  onChange={handleFormChange}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Creando...' : 'Crear Fideicomiso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalle Fideicomiso */}
      {showDetailModal && selectedTrust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowDetailModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => setShowDetailModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{selectedTrust.name}</h2>
                {selectedTrust.code && <p className="text-slate-500">Código: {selectedTrust.code}</p>}
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${TRUST_TYPES[selectedTrust.trust_type]?.color || ''}`}>
                  {TRUST_TYPES[selectedTrust.trust_type]?.label || selectedTrust.trust_type}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_LABELS[selectedTrust.status]?.color || ''}`}>
                  {STATUS_LABELS[selectedTrust.status]?.label || selectedTrust.status}
                </span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Patrimonio</p>
                <p className="font-semibold text-slate-800">{formatCurrency(selectedTrust.current_patrimony, selectedTrust.currency)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500">Constitución</p>
                <p className="font-semibold text-slate-800">
                  {selectedTrust.constitution_date ? new Date(selectedTrust.constitution_date).toLocaleDateString('es-AR') : '-'}
                </p>
              </div>
              {selectedTrust.is_tokenizable && (
                <>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Tokens</p>
                    <p className="font-semibold text-slate-800">{selectedTrust.total_tokens?.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">Valor Token</p>
                    <p className="font-semibold text-slate-800">{formatCurrency(selectedTrust.token_value, selectedTrust.currency)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Partes del Fideicomiso */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Partes del Fideicomiso</h3>
                <button 
                  onClick={() => setShowPartyModal(true)}
                  className="btn-secondary text-sm flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Agregar Parte
                </button>
              </div>

              {selectedTrust.parties?.length > 0 ? (
                <div className="space-y-3">
                  {selectedTrust.parties.map((party) => (
                    <div key={party.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{party.party_name || party.external_name || 'Sin nombre'}</p>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className="px-2 py-0.5 bg-slate-200 rounded text-xs">
                              {PARTY_ROLES[party.party_role]?.label || party.party_role}
                            </span>
                            {party.participation_percentage > 0 && (
                              <span>{party.participation_percentage}%</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveParty(party.id)}
                        className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">No hay partes registradas</p>
              )}
            </div>

            {/* Activos vinculados */}
            {selectedTrust.assets?.length > 0 && (
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Activos Vinculados</h3>
                <div className="space-y-2">
                  {selectedTrust.assets.map((asset) => (
                    <div key={asset.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-800">{asset.name}</p>
                        <p className="text-sm text-slate-500">{asset.asset_type} - {asset.status}</p>
                      </div>
                      <span className="text-sm font-medium text-slate-700">
                        {formatCurrency(asset.current_value, asset.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Agregar Parte */}
      {showPartyModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowPartyModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => setShowPartyModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-slate-800 mb-6">Agregar Parte</h2>
            
            <form onSubmit={handleAddParty} className="space-y-4">
              <div>
                <label className="form-label">Rol en el Fideicomiso *</label>
                <select 
                  name="party_role"
                  className="input-field"
                  value={partyForm.party_role}
                  onChange={handlePartyChange}
                >
                  {Object.entries(PARTY_ROLES).map(([key, { label, description }]) => (
                    <option key={key} value={key}>{label} - {description}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Tipo de Entidad *</label>
                <select 
                  name="party_type"
                  className="input-field"
                  value={partyForm.party_type}
                  onChange={handlePartyChange}
                >
                  <option value="client">Cliente/Inversor</option>
                  <option value="user">Usuario del Sistema</option>
                  <option value="supplier">Proveedor</option>
                  <option value="external">Entidad Externa</option>
                </select>
              </div>

              {/* Selector según tipo */}
              {partyForm.party_type === 'client' && (
                <div>
                  <label className="form-label">Seleccionar Cliente</label>
                  <select 
                    name="client_id"
                    className="input-field"
                    value={partyForm.client_id}
                    onChange={handlePartyChange}
                  >
                    <option value="">Seleccionar...</option>
                    {clientsList.map(c => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name} - {c.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {partyForm.party_type === 'user' && (
                <div>
                  <label className="form-label">Seleccionar Usuario</label>
                  <select 
                    name="user_id"
                    className="input-field"
                    value={partyForm.user_id}
                    onChange={handlePartyChange}
                  >
                    <option value="">Seleccionar...</option>
                    {usersList.map(u => (
                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name} - {u.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {partyForm.party_type === 'supplier' && (
                <div>
                  <label className="form-label">Seleccionar Proveedor</label>
                  <select 
                    name="supplier_id"
                    className="input-field"
                    value={partyForm.supplier_id}
                    onChange={handlePartyChange}
                  >
                    <option value="">Seleccionar...</option>
                    {suppliersList.map(s => (
                      <option key={s.id} value={s.id}>{s.company_name || s.contact_name} - {s.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {partyForm.party_type === 'external' && (
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Nombre *</label>
                    <input 
                      type="text" 
                      name="external_name"
                      className="input-field"
                      placeholder="Nombre o Razón Social"
                      value={partyForm.external_name}
                      onChange={handlePartyChange}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Tipo Doc.</label>
                      <select 
                        name="external_document_type"
                        className="input-field"
                        value={partyForm.external_document_type}
                        onChange={handlePartyChange}
                      >
                        <option value="DNI">DNI</option>
                        <option value="CUIT">CUIT</option>
                        <option value="CUIL">CUIL</option>
                        <option value="PASSPORT">Pasaporte</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Número</label>
                      <input 
                        type="text" 
                        name="external_document_number"
                        className="input-field"
                        placeholder="Nº Documento"
                        value={partyForm.external_document_number}
                        onChange={handlePartyChange}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input 
                      type="email" 
                      name="external_email"
                      className="input-field"
                      placeholder="email@ejemplo.com"
                      value={partyForm.external_email}
                      onChange={handlePartyChange}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">% Participación</label>
                  <input 
                    type="number" 
                    name="participation_percentage"
                    className="input-field"
                    placeholder="0"
                    step="0.01"
                    min="0"
                    max="100"
                    value={partyForm.participation_percentage}
                    onChange={handlePartyChange}
                  />
                </div>
                <div>
                  <label className="form-label">Monto Aportado</label>
                  <input 
                    type="number" 
                    name="contribution_amount"
                    className="input-field"
                    placeholder="0.00"
                    step="0.01"
                    value={partyForm.contribution_amount}
                    onChange={handlePartyChange}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowPartyModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Agregando...' : 'Agregar Parte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trusts;

