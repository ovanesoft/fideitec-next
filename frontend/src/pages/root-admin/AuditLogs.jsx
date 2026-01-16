import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  FileText, Search, Filter, Calendar, User, Building2,
  ChevronLeft, ChevronRight, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    tenantId: '',
    action: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchLogs();
    fetchTenants();
  }, [pagination.page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.tenantId && { tenantId: filters.tenantId }),
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      });
      
      const response = await api.get(`/root-admin/audit-logs?${params}`);
      setLogs(response.data.data.logs);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Error al cargar logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.get('/root-admin/tenants?limit=100');
      setTenants(response.data.data.tenants);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      'LOGIN': { label: 'Inicio de sesion', color: 'text-green-400' },
      'LOGOUT': { label: 'Cierre de sesion', color: 'text-slate-400' },
      'LOGIN_FAILED': { label: 'Login fallido', color: 'text-red-400' },
      'USER_CREATED': { label: 'Usuario creado', color: 'text-blue-400' },
      'USER_UPDATED': { label: 'Usuario actualizado', color: 'text-blue-400' },
      'USER_DELETED': { label: 'Usuario eliminado', color: 'text-red-400' },
      'USER_UPDATED_BY_ROOT': { label: 'Usuario modificado (root)', color: 'text-purple-400' },
      'USER_DEACTIVATED': { label: 'Usuario desactivado', color: 'text-yellow-400' },
      'TENANT_CREATED': { label: 'Organizacion creada', color: 'text-green-400' },
      'TENANT_UPDATED': { label: 'Organizacion actualizada', color: 'text-blue-400' },
      'TENANT_DELETED': { label: 'Organizacion eliminada', color: 'text-red-400' },
      'TENANT_SUSPENDED': { label: 'Organizacion suspendida', color: 'text-red-400' },
      'TENANT_REACTIVATED': { label: 'Organizacion reactivada', color: 'text-green-400' },
      'TENANT_BILLING_UPDATED': { label: 'Billing actualizado', color: 'text-yellow-400' },
      'CLIENT_CREATED': { label: 'Cliente creado', color: 'text-blue-400' },
      'CLIENT_UPDATED': { label: 'Cliente actualizado', color: 'text-blue-400' },
      'CLIENT_DELETED': { label: 'Cliente eliminado', color: 'text-red-400' },
      'TRUST_CREATED': { label: 'Fideicomiso creado', color: 'text-green-400' },
      'TRUST_UPDATED': { label: 'Fideicomiso actualizado', color: 'text-blue-400' },
      'ASSET_CREATED': { label: 'Activo creado', color: 'text-green-400' },
      'PROFILE_UPDATED': { label: 'Perfil actualizado', color: 'text-blue-400' },
      'PASSWORD_CHANGED': { label: 'Contrasena cambiada', color: 'text-yellow-400' },
      'PASSWORD_RESET': { label: 'Contrasena reseteada', color: 'text-yellow-400' },
      'USER_INVITED': { label: 'Usuario invitado', color: 'text-blue-400' },
      'INVITATION_ACCEPTED': { label: 'Invitacion aceptada', color: 'text-green-400' },
      'CLIENT_PORTAL_TOGGLED': { label: 'Portal de clientes toggled', color: 'text-purple-400' },
      'SUPPLIER_PORTAL_TOGGLED': { label: 'Portal de proveedores toggled', color: 'text-purple-400' }
    };
    return labels[action] || { label: action, color: 'text-slate-400' };
  };

  const commonActions = [
    'LOGIN', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
    'TENANT_CREATED', 'TENANT_UPDATED', 'TENANT_SUSPENDED', 
    'TENANT_BILLING_UPDATED', 'CLIENT_CREATED', 'TRUST_CREATED'
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Logs de Auditoria</h2>
          <p className="text-slate-400">Registro de todas las acciones del sistema</p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Organizacion</label>
            <select
              value={filters.tenantId}
              onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Todas</option>
              {tenants.map(tenant => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Accion</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters({ ...filters, action: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
            >
              <option value="">Todas</option>
              {commonActions.map(action => (
                <option key={action} value={action}>{getActionLabel(action).label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Desde</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>
        {(filters.tenantId || filters.action || filters.startDate || filters.endDate) && (
          <button
            onClick={() => setFilters({ tenantId: '', action: '', startDate: '', endDate: '' })}
            className="mt-3 text-sm text-red-400 hover:text-red-300"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Logs List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText className="w-12 h-12 mb-4 opacity-50" />
            <p>No se encontraron logs</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {logs.map((log) => {
              const actionInfo = getActionLabel(log.action);
              return (
                <div key={log.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-medium ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                        {log.entity_type && (
                          <span className="text-xs text-slate-500 bg-slate-700 px-2 py-0.5 rounded">
                            {log.entity_type}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                        {log.user_email && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.user_first_name} {log.user_last_name} ({log.user_email})
                          </span>
                        )}
                        {log.tenant_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {log.tenant_name}
                          </span>
                        )}
                      </div>
                      {log.new_values && (
                        <div className="mt-2 p-2 bg-slate-700/50 rounded text-xs text-slate-400 font-mono overflow-x-auto">
                          {typeof log.new_values === 'string' 
                            ? log.new_values 
                            : JSON.stringify(log.new_values, null, 2).slice(0, 200)}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm text-white">
                        {new Date(log.created_at).toLocaleDateString('es-AR')}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(log.created_at).toLocaleTimeString('es-AR')}
                      </p>
                      {log.ip_address && (
                        <p className="text-xs text-slate-600 mt-1">{log.ip_address}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
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
    </div>
  );
};

export default AuditLogs;
