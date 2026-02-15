import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { 
  Plus, Search, Loader2, ExternalLink, Copy, Check, 
  Eye, EyeOff, AlertCircle, Users, Settings, Link as LinkIcon,
  Truck, RefreshCw, X, Building2, Mail, Phone, FileText,
  Clock, CheckCircle2, XCircle, AlertTriangle
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Hook para debounce
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
};

const Suppliers = () => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const searchTerm = useDebounce(searchInput, 300);
  const [stats, setStats] = useState(null);
  
  // Modal de nuevo proveedor
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    email: '',
    company_name: '',
    first_name: '',
    last_name: '',
    phone: '',
    document_type: 'CUIT',
    document_number: '',
    category: ''
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // Modal de configuración del portal
  const [isPortalModalOpen, setIsPortalModalOpen] = useState(false);
  const [portalInfo, setPortalInfo] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal de detalle de proveedor
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Modal de link de invitación
  const [inviteLinkModalOpen, setInviteLinkModalOpen] = useState(false);
  const [currentInviteLink, setCurrentInviteLink] = useState('');
  const [currentInviteEmail, setCurrentInviteEmail] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 Fetching suppliers...');
      const response = await axios.get('/suppliers');
      console.log('📦 Suppliers response:', response.data);
      if (response.data.success) {
        setSuppliers(response.data.data.suppliers || []);
      } else {
        setError(response.data.message || 'Error desconocido');
      }
    } catch (err) {
      console.error('❌ Error fetching suppliers:', err);
      setError(err.response?.data?.message || 'Error al cargar proveedores');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/suppliers/stats');
      if (response.data.success) {
        setStats(response.data.data.stats);
      }
    } catch (err) {
      console.error('Error cargando estadísticas:', err);
    }
  };

  const fetchPortalInfo = async () => {
    try {
      const response = await axios.get('/tenants/my/supplier-portal');
      if (response.data.success) {
        setPortalInfo(response.data.data);
      }
    } catch (err) {
      console.error('Error cargando info del portal:', err);
    }
  };

  useEffect(() => {
    if (user?.tenantId) {
      console.log('📋 Usuario con tenant:', user.tenantId);
      fetchSuppliers();
      fetchStats();
      fetchPortalInfo();
    } else if (user) {
      console.log('⚠️ Usuario sin tenantId:', user);
    }
  }, [user?.tenantId]);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    setAddError(null);
    setAddLoading(true);

    try {
      const response = await axios.post('/suppliers', newSupplier);
      if (response.data.success) {
        toast.success('Proveedor creado exitosamente');
        
        // Mostrar modal con el link de invitación
        if (response.data.data.inviteUrl) {
          const inviteUrl = response.data.data.inviteUrl;
          console.log('🔗 Link de invitación:', inviteUrl);
          
          // Guardar el link y mostrar el modal
          setCurrentInviteLink(inviteUrl);
          setCurrentInviteEmail(newSupplier.email);
          setInviteLinkModalOpen(true);
          
          // Copiar automáticamente
          try {
            await navigator.clipboard.writeText(inviteUrl);
            setLinkCopied(true);
          } catch (clipErr) {
            console.error('Error copiando:', clipErr);
          }
        }

        setIsAddModalOpen(false);
        setNewSupplier({
          email: '',
          company_name: '',
          first_name: '',
          last_name: '',
          phone: '',
          document_type: 'CUIT',
          document_number: '',
          category: ''
        });
        fetchSuppliers();
        fetchStats();
      }
    } catch (err) {
      setAddError(err.response?.data?.message || 'Error al crear proveedor');
    } finally {
      setAddLoading(false);
    }
  };

  const handleResendInvite = async (supplierId, supplierEmail) => {
    try {
      const response = await axios.post(`/suppliers/${supplierId}/resend-invite`);
      if (response.data.success) {
        toast.success('Invitación reenviada');
        
        if (response.data.data.inviteUrl) {
          const inviteUrl = response.data.data.inviteUrl;
          console.log('🔗 Nuevo link de invitación:', inviteUrl);
          
          // Mostrar modal con el link
          setCurrentInviteLink(inviteUrl);
          setCurrentInviteEmail(supplierEmail || 'proveedor');
          setInviteLinkModalOpen(true);
          
          // Copiar automáticamente
          try {
            await navigator.clipboard.writeText(inviteUrl);
            setLinkCopied(true);
          } catch (clipErr) {
            console.error('Error copiando:', clipErr);
          }
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al reenviar invitación');
    }
  };
  
  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(currentInviteLink);
      setLinkCopied(true);
      toast.success('Link copiado al portapapeles');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      toast.error('Error al copiar el link');
    }
  };

  const handleTogglePortal = async () => {
    try {
      setPortalLoading(true);
      const response = await axios.put('/tenants/my/supplier-portal/toggle');
      if (response.data.success) {
        setPortalInfo(prev => ({
          ...prev,
          supplierPortalEnabled: response.data.data.supplierPortalEnabled
        }));
        toast.success(response.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar estado del portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCopyLink = () => {
    const portalUrl = `${window.location.origin}/supplier-portal/${portalInfo?.supplierPortalSlug}/login`;
    navigator.clipboard.writeText(portalUrl);
    setCopied(true);
    toast.success('Link copiado al portapapeles');
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = (status, passwordSet) => {
    if (!passwordSet) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
          <Clock className="w-3 h-3" />
          Pendiente Setup
        </span>
      );
    }
    
    const badges = {
      active: { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2, label: 'Activo' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock, label: 'Pendiente' },
      inactive: { bg: 'bg-slate-100', text: 'text-slate-700', icon: XCircle, label: 'Inactivo' },
      blocked: { bg: 'bg-red-100', text: 'text-red-700', icon: AlertTriangle, label: 'Bloqueado' }
    };
    
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.document_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Gestión de Proveedores</h1>
          <p className="text-slate-500 text-sm mt-1">Administra tus proveedores y accesos al portal</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsPortalModalOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <LinkIcon className="w-5 h-5" />
            <span className="hidden sm:inline">Portal</span>
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <Truck className="w-5 h-5 text-amber-600" />
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
                <p className="text-2xl font-bold text-slate-800">{stats.setup_complete}</p>
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
                <p className="text-2xl font-bold text-slate-800">{stats.pending_setup}</p>
                <p className="text-xs text-slate-500">Pendientes</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.blocked}</p>
                <p className="text-xs text-slate-500">Bloqueados</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email, documento..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-800 mb-2">
            {searchTerm ? 'No se encontraron proveedores' : 'Aún no tienes proveedores'}
          </h3>
          <p className="text-slate-500 mb-4">
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda' 
              : 'Agrega tu primer proveedor para comenzar'
            }
          </p>
          {!searchTerm && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary"
            >
              <Plus className="w-5 h-5 mr-2" />
              Agregar Proveedor
            </button>
          )}
        </div>
      ) : (
        /* Suppliers list */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Proveedor</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Contacto</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Documento</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Categoría</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Estado</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-semibold text-sm">
                          {(supplier.company_name || supplier.first_name || 'P')[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {supplier.company_name || `${supplier.first_name} ${supplier.last_name}`}
                          </p>
                          {supplier.trade_name && (
                            <p className="text-sm text-slate-500">{supplier.trade_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-800">{supplier.email}</p>
                      {supplier.phone && (
                        <p className="text-sm text-slate-500">{supplier.phone}</p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {supplier.document_number ? (
                        <span className="text-sm text-slate-800">
                          {supplier.document_type}: {supplier.document_number}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-800">
                        {supplier.category || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(supplier.status, supplier.password_set)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!supplier.password_set && (
                          <button
                            onClick={() => handleResendInvite(supplier.id, supplier.email)}
                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Generar link de invitación"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedSupplier(supplier);
                            setDetailModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Ver detalle"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Nuevo Proveedor */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setIsAddModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Nuevo Proveedor</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSupplier} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-600">{addError}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newSupplier.email}
                    onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })}
                    className="input-field"
                    placeholder="proveedor@empresa.com"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Razón Social
                  </label>
                  <input
                    type="text"
                    value={newSupplier.company_name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, company_name: e.target.value })}
                    className="input-field"
                    placeholder="Empresa S.A."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Nombre Contacto
                  </label>
                  <input
                    type="text"
                    value={newSupplier.first_name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, first_name: e.target.value })}
                    className="input-field"
                    placeholder="Juan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Apellido Contacto
                  </label>
                  <input
                    type="text"
                    value={newSupplier.last_name}
                    onChange={(e) => setNewSupplier({ ...newSupplier, last_name: e.target.value })}
                    className="input-field"
                    placeholder="Pérez"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={newSupplier.phone}
                    onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })}
                    className="input-field"
                    placeholder="+54 11 1234-5678"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={newSupplier.category}
                    onChange={(e) => setNewSupplier({ ...newSupplier, category: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Construcción">Construcción</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Materiales">Materiales</option>
                    <option value="Logística">Logística</option>
                    <option value="Tecnología">Tecnología</option>
                    <option value="Consultoría">Consultoría</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo de Documento
                  </label>
                  <select
                    value={newSupplier.document_type}
                    onChange={(e) => setNewSupplier({ ...newSupplier, document_type: e.target.value })}
                    className="input-field"
                  >
                    <option value="CUIT">CUIT</option>
                    <option value="CUIL">CUIL</option>
                    <option value="DNI">DNI</option>
                    <option value="RUT">RUT</option>
                    <option value="RFC">RFC</option>
                    <option value="OTHER">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Número de Documento
                  </label>
                  <input
                    type="text"
                    value={newSupplier.document_number}
                    onChange={(e) => setNewSupplier({ ...newSupplier, document_number: e.target.value })}
                    className="input-field"
                    placeholder="30-12345678-9"
                  />
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 mt-4">
                <p className="text-sm text-amber-800">
                  <strong>Nota:</strong> Se enviará un email de invitación al proveedor para que configure su contraseña y acceda al portal.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {addLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Crear e Invitar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Configuración del Portal */}
      {isPortalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setIsPortalModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Portal de Proveedores</h3>
              <button onClick={() => setIsPortalModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Estado del portal */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    portalInfo?.supplierPortalEnabled ? 'bg-green-100' : 'bg-slate-200'
                  }`}>
                    <Truck className={`w-5 h-5 ${
                      portalInfo?.supplierPortalEnabled ? 'text-green-600' : 'text-slate-400'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">
                      Portal {portalInfo?.supplierPortalEnabled ? 'Activo' : 'Inactivo'}
                    </p>
                    <p className="text-sm text-slate-500">
                      {portalInfo?.supplierPortalEnabled 
                        ? 'Los proveedores pueden acceder' 
                        : 'El acceso está deshabilitado'
                      }
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleTogglePortal}
                  disabled={portalLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    portalInfo?.supplierPortalEnabled ? 'bg-green-500' : 'bg-slate-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    portalInfo?.supplierPortalEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Link del portal */}
              {portalInfo?.supplierPortalSlug && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Link de acceso al portal
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${window.location.origin}/supplier-portal/${portalInfo.supplierPortalSlug}/login`}
                      className="input-field text-sm flex-1"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="btn-secondary px-3"
                      title="Copiar link"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Comparte este link con tus proveedores para que accedan a su portal
                  </p>
                </div>
              )}

              <div className="bg-amber-50 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  <strong>Importante:</strong> Los proveedores solo pueden registrarse mediante invitación. 
                  Créalos primero desde el botón "Nuevo Proveedor".
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Detalle de Proveedor */}
      {detailModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setDetailModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Detalle del Proveedor</h3>
              <button onClick={() => setDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                  {(selectedSupplier.company_name || selectedSupplier.first_name || 'P')[0].toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-800">
                    {selectedSupplier.company_name || `${selectedSupplier.first_name} ${selectedSupplier.last_name}`}
                  </h4>
                  <p className="text-slate-500">{selectedSupplier.email}</p>
                  <div className="mt-2">
                    {getStatusBadge(selectedSupplier.status, selectedSupplier.password_set)}
                  </div>
                </div>
              </div>

              {/* Info sections */}
              <div className="space-y-4">
                {selectedSupplier.phone && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <Phone className="w-5 h-5 text-slate-400" />
                    <span>{selectedSupplier.phone}</span>
                  </div>
                )}
                
                {selectedSupplier.document_number && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <span>{selectedSupplier.document_type}: {selectedSupplier.document_number}</span>
                  </div>
                )}

                {selectedSupplier.category && (
                  <div className="flex items-center gap-3 text-slate-600">
                    <Building2 className="w-5 h-5 text-slate-400" />
                    <span>Categoría: {selectedSupplier.category}</span>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <p className="text-sm text-slate-500">
                    Creado el {new Date(selectedSupplier.created_at).toLocaleDateString('es-AR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                  {selectedSupplier.last_login && (
                    <p className="text-sm text-slate-500 mt-1">
                      Último acceso: {new Date(selectedSupplier.last_login).toLocaleDateString('es-AR')}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              {!selectedSupplier.password_set && (
                <button
                  onClick={() => {
                    handleResendInvite(selectedSupplier.id, selectedSupplier.email);
                    setDetailModalOpen(false);
                  }}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  Generar Link de Invitación
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Link de Invitación */}
      {inviteLinkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => {
            setInviteLinkModalOpen(false);
            setLinkCopied(false);
          }} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in">
            {/* Header con gradiente */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-t-2xl px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Truck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Link de Invitación</h3>
                  <p className="text-white/80 text-sm">Para: {currentInviteEmail}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Mensaje de éxito */}
              <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">¡Link generado correctamente!</p>
                  <p className="text-sm text-green-600">El proveedor podrá configurar su contraseña con este link</p>
                </div>
              </div>

              {/* Link */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Link de invitación (válido por 7 días)
                </label>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-sm text-slate-700 break-all font-mono leading-relaxed">
                    {currentInviteLink}
                  </p>
                </div>
              </div>

              {/* Botones */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleCopyInviteLink}
                  className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${
                    linkCopied 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:shadow-lg'
                  }`}
                >
                  {linkCopied ? (
                    <>
                      <Check className="w-5 h-5" />
                      ¡Copiado al portapapeles!
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      Copiar Link
                    </>
                  )}
                </button>

                {/* Botón WhatsApp */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`¡Hola! Te invitamos a registrarte como proveedor. Accede a este link para configurar tu cuenta:\n\n${currentInviteLink}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  Enviar por WhatsApp
                </a>

                <button
                  onClick={() => {
                    setInviteLinkModalOpen(false);
                    setLinkCopied(false);
                  }}
                  className="w-full py-3 px-4 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-all"
                >
                  Cerrar
                </button>
              </div>

              {/* Nota */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>💡 Tip:</strong> Puedes generar un nuevo link en cualquier momento si el proveedor 
                  no ha completado el registro. El link anterior quedará inválido.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;

