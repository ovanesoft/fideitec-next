import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  CreditCard, Search, Building2, Clock, CheckCircle, 
  XCircle, AlertCircle, Pause, Edit, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const BillingManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [billingFilter, setBillingFilter] = useState('');
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchTenants();
  }, [pagination.page, search, billingFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: 'billing_status',
        ...(search && { search }),
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

  const handleUpdateBilling = async () => {
    try {
      await api.put(`/root-admin/tenants/${selectedTenant.id}/billing`, editForm);
      toast.success('Billing actualizado');
      setShowEditModal(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (error) {
      toast.error('Error al actualizar billing');
    }
  };

  const openEditModal = (tenant) => {
    setSelectedTenant(tenant);
    setEditForm({
      billingStatus: tenant.billing_status || 'trial',
      billingCycle: tenant.billing_cycle || 'monthly',
      trialEndsAt: tenant.trial_ends_at ? new Date(tenant.trial_ends_at).toISOString().slice(0, 16) : '',
      notes: tenant.billing_notes || '',
      reactivate: false
    });
    setShowEditModal(true);
  };

  const getBillingBadge = (status) => {
    const badges = {
      active: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle, label: 'Activo' },
      trial: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock, label: 'Trial' },
      past_due: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', icon: AlertCircle, label: 'Vencido' },
      suspended: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: Pause, label: 'Suspendido' },
      cancelled: { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: XCircle, label: 'Cancelado' }
    };
    const badge = badges[status] || badges.trial;
    const Icon = badge.icon;
    
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border ${badge.color}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const getTrialDaysRemaining = (trialEndsAt) => {
    if (!trialEndsAt) return null;
    const days = Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
    if (days < 0) return <span className="text-red-400">Expirado hace {Math.abs(days)} dias</span>;
    if (days === 0) return <span className="text-yellow-400">Expira hoy</span>;
    if (days <= 7) return <span className="text-yellow-400">{days} dias restantes</span>;
    return <span className="text-slate-400">{days} dias restantes</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestion de Billing</h2>
          <p className="text-slate-400">Administra el estado de facturacion de los tenants</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { status: 'active', label: 'Activos', color: 'green' },
          { status: 'trial', label: 'En Trial', color: 'blue' },
          { status: 'past_due', label: 'Vencidos', color: 'yellow' },
          { status: 'suspended', label: 'Suspendidos', color: 'red' },
          { status: 'cancelled', label: 'Cancelados', color: 'slate' }
        ].map(item => {
          const count = tenants.filter(t => t.billing_status === item.status).length;
          return (
            <button
              key={item.status}
              onClick={() => setBillingFilter(billingFilter === item.status ? '' : item.status)}
              className={`p-4 rounded-xl border transition-colors ${
                billingFilter === item.status
                  ? `bg-${item.color}-500/20 border-${item.color}-500/50`
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <p className={`text-2xl font-bold text-${item.color}-400`}>{count}</p>
              <p className="text-sm text-slate-400">{item.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar organizacion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
          </div>
          <select
            value={billingFilter}
            onChange={(e) => setBillingFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Todos los estados</option>
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
            <CreditCard className="w-12 h-12 mb-4 opacity-50" />
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
                    Plan
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Estado Billing
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Ciclo
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Trial / Vencimiento
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
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{tenant.name}</p>
                          <p className="text-sm text-slate-400">{tenant.user_count} usuarios</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-slate-300">{tenant.plan || 'free'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {getBillingBadge(tenant.billing_status)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="capitalize text-slate-300">{tenant.billing_cycle || 'monthly'}</span>
                    </td>
                    <td className="px-6 py-4">
                      {tenant.billing_status === 'trial' && tenant.trial_ends_at ? (
                        <div>
                          <p className="text-sm text-white">
                            {new Date(tenant.trial_ends_at).toLocaleDateString('es-AR')}
                          </p>
                          <p className="text-xs">{getTrialDaysRemaining(tenant.trial_ends_at)}</p>
                        </div>
                      ) : tenant.next_payment_at ? (
                        <div>
                          <p className="text-sm text-white">
                            {new Date(tenant.next_payment_at).toLocaleDateString('es-AR')}
                          </p>
                          <p className="text-xs text-slate-400">Proximo pago</p>
                        </div>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEditModal(tenant)}
                        className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <Edit className="w-5 h-5 text-slate-400 hover:text-white" />
                      </button>
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

      {/* Edit Billing Modal */}
      {showEditModal && selectedTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg m-4 border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-white">Editar Billing</h3>
              <p className="text-sm text-slate-400">{selectedTenant.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Estado de Billing</label>
                <select
                  value={editForm.billingStatus}
                  onChange={(e) => setEditForm({ ...editForm, billingStatus: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                >
                  <option value="trial">Trial</option>
                  <option value="active">Activo</option>
                  <option value="past_due">Vencido</option>
                  <option value="suspended">Suspendido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">Ciclo de Facturacion</label>
                <select
                  value={editForm.billingCycle}
                  onChange={(e) => setEditForm({ ...editForm, billingCycle: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                >
                  <option value="monthly">Mensual</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>

              {editForm.billingStatus === 'trial' && (
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fin del Trial</label>
                  <input
                    type="datetime-local"
                    value={editForm.trialEndsAt}
                    onChange={(e) => setEditForm({ ...editForm, trialEndsAt: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-red-500 resize-none"
                  placeholder="Notas internas sobre el billing..."
                />
              </div>

              {editForm.billingStatus === 'active' && !selectedTenant.is_active && (
                <label className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <input
                    type="checkbox"
                    checked={editForm.reactivate}
                    onChange={(e) => setEditForm({ ...editForm, reactivate: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-green-500 focus:ring-green-500"
                  />
                  <span className="text-green-400">Reactivar organizacion (estaba suspendida)</span>
                </label>
              )}

              {editForm.billingStatus === 'suspended' && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">
                    Al suspender, la organizacion sera desactivada y los usuarios no podran acceder.
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateBilling}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingManagement;
