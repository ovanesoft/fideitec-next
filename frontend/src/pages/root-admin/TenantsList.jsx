import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  Building2, Search, Filter, MoreVertical, Users, 
  CheckCircle, XCircle, Clock, AlertCircle, Pause,
  Eye, Edit, Trash2, Power, CreditCard, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const TenantsList = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [billingFilter, setBillingFilter] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  useEffect(() => {
    fetchTenants();
  }, [pagination.page, search, statusFilter, billingFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(billingFilter && { billingStatus: billingFilter })
      });
      
      const response = await api.get(`/root-admin/tenants?${params}`);
      setTenants(response.data.data.tenants);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Error al cargar organizaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (tenant) => {
    try {
      await api.put(`/root-admin/tenants/${tenant.id}/toggle-status`);
      toast.success(`Organizacion ${tenant.is_active ? 'suspendida' : 'reactivada'}`);
      fetchTenants();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
    setActionMenuOpen(null);
  };

  const handleDelete = async () => {
    if (deleteConfirmName !== selectedTenant?.name) {
      toast.error('El nombre no coincide');
      return;
    }
    
    try {
      await api.delete(`/root-admin/tenants/${selectedTenant.id}`, {
        data: { confirmName: deleteConfirmName }
      });
      toast.success('Organizacion eliminada permanentemente');
      setShowDeleteModal(false);
      setSelectedTenant(null);
      setDeleteConfirmName('');
      fetchTenants();
    } catch (error) {
      toast.error('Error al eliminar organizacion');
    }
  };

  const viewTenantDetails = async (tenantId) => {
    try {
      const response = await api.get(`/root-admin/tenants/${tenantId}`);
      setSelectedTenant(response.data.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Error al cargar detalles');
    }
    setActionMenuOpen(null);
  };

  const getBillingBadge = (status) => {
    const badges = {
      active: { color: 'bg-green-500/20 text-green-400', icon: CheckCircle, label: 'Activo' },
      trial: { color: 'bg-blue-500/20 text-blue-400', icon: Clock, label: 'Trial' },
      past_due: { color: 'bg-yellow-500/20 text-yellow-400', icon: AlertCircle, label: 'Vencido' },
      suspended: { color: 'bg-red-500/20 text-red-400', icon: Pause, label: 'Suspendido' },
      cancelled: { color: 'bg-slate-500/20 text-slate-400', icon: XCircle, label: 'Cancelado' }
    };
    const badge = badges[status] || badges.trial;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Organizaciones</h2>
          <p className="text-slate-400">Gestiona todos los tenants del sistema</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, slug o dominio..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
          <select
            value={billingFilter}
            onChange={(e) => setBillingFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Todos los billing</option>
            <option value="active">Activo</option>
            <option value="trial">Trial</option>
            <option value="past_due">Vencido</option>
            <option value="suspended">Suspendido</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Building2 className="w-12 h-12 mb-4 opacity-50" />
            <p>No se encontraron organizaciones</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Organizacion
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Usuarios
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Billing
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Creado
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-white">{tenant.name}</p>
                        <p className="text-sm text-slate-400">{tenant.slug}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Users className="w-4 h-4" />
                        {tenant.user_count || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-slate-300">{tenant.plan || 'free'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getBillingBadge(tenant.billing_status)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        tenant.is_active 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tenant.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(tenant.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === tenant.id ? null : tenant.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-slate-400" />
                        </button>
                        
                        {actionMenuOpen === tenant.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setActionMenuOpen(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
                              <button
                                onClick={() => viewTenantDetails(tenant.id)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 w-full"
                              >
                                <Eye className="w-4 h-4" />
                                Ver detalles
                              </button>
                              <button
                                onClick={() => handleToggleStatus(tenant)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 w-full"
                              >
                                <Power className="w-4 h-4" />
                                {tenant.is_active ? 'Suspender' : 'Reactivar'}
                              </button>
                              <hr className="my-1 border-slate-600" />
                              <button
                                onClick={() => {
                                  setSelectedTenant(tenant);
                                  setShowDeleteModal(true);
                                  setActionMenuOpen(null);
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 w-full"
                              >
                                <Trash2 className="w-4 h-4" />
                                Eliminar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <span className="text-white px-3">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">Detalles de Organizacion</h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg"
              >
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-400">Nombre</label>
                  <p className="text-white font-medium">{selectedTenant.tenant?.name}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Slug</label>
                  <p className="text-white font-medium">{selectedTenant.tenant?.slug}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Plan</label>
                  <p className="text-white font-medium capitalize">{selectedTenant.tenant?.plan}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-400">Billing</label>
                  <p>{getBillingBadge(selectedTenant.tenant?.billing_status)}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-700/50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-white">{selectedTenant.stats?.users?.total || 0}</p>
                  <p className="text-sm text-slate-400">Usuarios totales</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-white">{selectedTenant.stats?.users?.active || 0}</p>
                  <p className="text-sm text-slate-400">Usuarios activos</p>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-xl">
                  <p className="text-2xl font-bold text-white">{selectedTenant.stats?.clients?.total || 0}</p>
                  <p className="text-sm text-slate-400">Clientes</p>
                </div>
              </div>

              {selectedTenant.tenant?.trial_ends_at && (
                <div className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-xl">
                  <p className="text-blue-400 font-medium">Trial termina:</p>
                  <p className="text-white">{new Date(selectedTenant.tenant.trial_ends_at).toLocaleString('es-AR')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md m-4 border border-red-500/50">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-red-400">Eliminar Organizacion</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                <p className="text-red-400 text-sm">
                  Esta accion es IRREVERSIBLE. Se eliminaran todos los datos de la organizacion incluyendo usuarios, clientes, fideicomisos y activos.
                </p>
              </div>
              <p className="text-slate-300">
                Para confirmar, escribe el nombre de la organizacion: <strong className="text-white">{selectedTenant.name}</strong>
              </p>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Nombre de la organizacion"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
              />
            </div>
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmName('');
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmName !== selectedTenant.name}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white transition-colors"
              >
                Eliminar Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantsList;
