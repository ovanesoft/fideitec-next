import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Users, Search, Plus, Filter, MoreVertical, 
  CheckCircle2, Clock, AlertCircle, Shield, 
  ChevronLeft, ChevronRight, Eye, Edit, X,
  Building2, Mail, Phone, FileText, Link2, Copy,
  ExternalLink, Settings, RefreshCw
} from 'lucide-react';

const Clients = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kycFilter, setKycFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalInfo, setPortalInfo] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  // Cargar clientes
  const loadClients = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page,
        limit: 20,
        ...(search && { search }),
        ...(kycFilter && { kyc_status: kycFilter })
      });

      const response = await api.get(`/clients?${params}`);
      if (response.data.success) {
        setClients(response.data.data.clients);
        setTotalPages(response.data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error('Error cargando clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas
  const loadStats = async () => {
    try {
      const response = await api.get('/clients/stats');
      if (response.data.success) {
        setStats(response.data.data.stats);
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  // Cargar info del portal
  const loadPortalInfo = async () => {
    try {
      const response = await api.get('/tenants/my/portal');
      if (response.data.success) {
        setPortalInfo(response.data.data.portal);
      }
    } catch (error) {
      console.error('Error cargando portal:', error);
    }
  };

  useEffect(() => {
    loadClients();
    loadStats();
    loadPortalInfo();
  }, [page, search, kycFilter]);

  // Toggle portal
  const togglePortal = async (enabled) => {
    try {
      const response = await api.put('/tenants/my/portal/toggle', { enabled });
      if (response.data.success) {
        setPortalInfo(prev => ({ ...prev, enabled: response.data.data.portal.enabled }));
      }
    } catch (error) {
      console.error('Error toggling portal:', error);
    }
  };

  // Regenerar token del portal
  const regenerateToken = async () => {
    if (!window.confirm('¿Estás seguro? Los links anteriores dejarán de funcionar.')) return;
    
    try {
      const response = await api.post('/tenants/my/portal/regenerate-token');
      if (response.data.success) {
        setPortalInfo(prev => ({
          ...prev,
          token: response.data.data.portal.token,
          url: response.data.data.portal.url
        }));
      }
    } catch (error) {
      console.error('Error regenerando token:', error);
    }
  };

  // Copiar link del portal
  const copyPortalLink = () => {
    navigator.clipboard.writeText(portalInfo?.url);
    // Podrías agregar un toast aquí
  };

  const getKYCBadge = (status) => {
    const badges = {
      pending: { color: 'bg-slate-100 text-slate-700', icon: Clock, label: 'Pendiente' },
      in_review: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'En revisión' },
      approved: { color: 'bg-green-100 text-green-700', icon: CheckCircle2, label: 'Aprobado' },
      rejected: { color: 'bg-red-100 text-red-700', icon: AlertCircle, label: 'Rechazado' }
    };
    return badges[status] || badges.pending;
  };

  const getAMLBadge = (status, riskLevel) => {
    if (status === 'blocked') {
      return { color: 'bg-red-100 text-red-700', label: 'Bloqueado' };
    }
    if (status === 'alert') {
      return { color: 'bg-orange-100 text-orange-700', label: 'Alerta' };
    }
    const riskColors = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-yellow-100 text-yellow-700',
      high: 'bg-orange-100 text-orange-700',
      critical: 'bg-red-100 text-red-700'
    };
    return { color: riskColors[riskLevel] || riskColors.low, label: riskLevel || 'Bajo' };
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="text-slate-500">Gestiona tus clientes e inversores</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowPortalModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Link2 className="w-4 h-4" />
            Portal de Clientes
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
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
                <p className="text-2xl font-bold text-slate-800">{stats.kyc_approved}</p>
                <p className="text-xs text-slate-500">KYC Aprobados</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.kyc_pending}</p>
                <p className="text-xs text-slate-500">KYC Pendientes</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.aml_alerts}</p>
                <p className="text-xs text-slate-500">Alertas AML</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{stats.pep_count}</p>
                <p className="text-xs text-slate-500">PEP</p>
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
              placeholder="Buscar por nombre, email o documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-4">
            <select
              value={kycFilter}
              onChange={(e) => setKycFilter(e.target.value)}
              className="input-field w-auto"
            >
              <option value="">Todos los estados KYC</option>
              <option value="pending">Pendiente</option>
              <option value="in_review">En revisión</option>
              <option value="approved">Aprobado</option>
              <option value="rejected">Rechazado</option>
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
        ) : clients.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-800 mb-2">No hay clientes</h3>
            <p className="text-slate-500 mb-4">
              Comienza agregando clientes manualmente o compartiendo el link del portal
            </p>
            <button 
              onClick={() => setShowAddModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Agregar cliente
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Documento
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      KYC
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      AML
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Origen
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Registro
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {clients.map((client) => {
                    const kycBadge = getKYCBadge(client.kyc_status);
                    const amlBadge = getAMLBadge(client.aml_status, client.aml_risk_level);
                    const KYCIcon = kycBadge.icon;
                    
                    return (
                      <tr key={client.id} className="hover:bg-slate-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-primary-600 font-medium">
                                {client.first_name?.[0]}{client.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">
                                {client.first_name} {client.last_name}
                                {client.is_pep && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                    PEP
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-slate-500">{client.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {client.document_type && client.document_number ? (
                            <span className="text-sm text-slate-600">
                              {client.document_type}: {client.document_number}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-400">Sin documento</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${kycBadge.color}`}>
                            <KYCIcon className="w-3 h-3" />
                            {kycBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${amlBadge.color}`}>
                            {amlBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-sm ${
                            client.registration_source === 'portal' 
                              ? 'text-blue-600' 
                              : 'text-slate-600'
                          }`}>
                            {client.registration_source === 'portal' ? 'Auto-registro' : 'Manual'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-slate-500">
                            {new Date(client.created_at).toLocaleDateString('es-AR')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => setSelectedClient(client)}
                              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
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

      {/* Portal Modal */}
      {showPortalModal && portalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowPortalModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 animate-fade-in">
            <button 
              onClick={() => setShowPortalModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                <Link2 className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Portal de Clientes</h2>
                <p className="text-sm text-slate-500">Comparte este link para que tus clientes se registren</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-800">Portal habilitado</p>
                  <p className="text-sm text-slate-500">Permite a los clientes auto-registrarse</p>
                </div>
                <button
                  onClick={() => togglePortal(!portalInfo.enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    portalInfo.enabled ? 'bg-primary-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      portalInfo.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Link */}
              <div>
                <label className="form-label">Link del portal</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={portalInfo.url}
                    readOnly
                    className="input-field flex-1 text-sm"
                  />
                  <button
                    onClick={copyPortalLink}
                    className="btn-secondary px-3"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <a
                    href={portalInfo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary px-3"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Regenerate */}
              <button
                onClick={regenerateToken}
                className="w-full flex items-center justify-center gap-2 p-3 text-sm text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerar link (invalida el anterior)
              </button>

              {/* Settings link */}
              <button
                className="w-full flex items-center justify-center gap-2 p-3 text-sm text-primary-600 hover:bg-primary-50 rounded-xl"
              >
                <Settings className="w-4 h-4" />
                Configurar portal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowAddModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 animate-fade-in">
            <button 
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-bold text-slate-800 mb-6">Nuevo Cliente</h2>
            
            <form className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Nombre</label>
                  <input type="text" className="input-field" placeholder="Juan" />
                </div>
                <div>
                  <label className="form-label">Apellido</label>
                  <input type="text" className="input-field" placeholder="Pérez" />
                </div>
              </div>
              
              <div>
                <label className="form-label">Email</label>
                <input type="email" className="input-field" placeholder="juan@email.com" />
              </div>

              <div>
                <label className="form-label">Teléfono</label>
                <input type="tel" className="input-field" placeholder="+54 11 1234 5678" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="form-label">Tipo Doc.</label>
                  <select className="input-field">
                    <option value="DNI">DNI</option>
                    <option value="CUIT">CUIT</option>
                    <option value="CUIL">CUIL</option>
                    <option value="PASSPORT">Pasaporte</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="form-label">Número de documento</label>
                  <input type="text" className="input-field" placeholder="12345678" />
                </div>
              </div>

              <div>
                <label className="form-label">Notas</label>
                <textarea className="input-field" rows="3" placeholder="Notas internas sobre el cliente..."></textarea>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary">
                  Crear Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Clients;

