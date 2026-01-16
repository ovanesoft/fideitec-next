import { useState, useEffect } from 'react';
import api from '../../api/axios';
import { 
  Users, Search, MoreVertical, Building2,
  CheckCircle, XCircle, Lock, Unlock, Shield,
  Eye, Edit, Trash2, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    fetchUsers();
    fetchTenants();
  }, [pagination.page, search, tenantFilter, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(search && { search }),
        ...(tenantFilter && { tenantId: tenantFilter }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter })
      });
      
      const response = await api.get(`/root-admin/users?${params}`);
      setUsers(response.data.data.users);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
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

  const handleUpdateUser = async () => {
    try {
      await api.put(`/root-admin/users/${selectedUser.id}`, editForm);
      toast.success('Usuario actualizado');
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error('Error al actualizar usuario');
    }
  };

  const handleToggleLock = async (user) => {
    try {
      await api.put(`/root-admin/users/${user.id}`, { isLocked: !user.is_locked });
      toast.success(`Usuario ${user.is_locked ? 'desbloqueado' : 'bloqueado'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
    setActionMenuOpen(null);
  };

  const handleToggleActive = async (user) => {
    try {
      await api.put(`/root-admin/users/${user.id}`, { isActive: !user.is_active });
      toast.success(`Usuario ${user.is_active ? 'desactivado' : 'activado'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
    setActionMenuOpen(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/root-admin/users/${selectedUser.id}`);
      toast.success('Usuario eliminado permanentemente');
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      toast.error('Error al eliminar usuario');
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      role: user.role,
      isActive: user.is_active,
      isLocked: user.is_locked
    });
    setShowEditModal(true);
    setActionMenuOpen(null);
  };

  const getRoleBadge = (role) => {
    const badges = {
      root: { color: 'bg-red-500/20 text-red-400', label: 'Root' },
      admin: { color: 'bg-purple-500/20 text-purple-400', label: 'Admin' },
      manager: { color: 'bg-blue-500/20 text-blue-400', label: 'Manager' },
      user: { color: 'bg-slate-500/20 text-slate-400', label: 'Usuario' }
    };
    const badge = badges[role] || badges.user;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Usuarios</h2>
          <p className="text-slate-400">Gestiona todos los usuarios del sistema</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por email o nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-red-500"
            />
          </div>
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Todas las organizaciones</option>
            {tenants.map(tenant => (
              <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
            ))}
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Todos los roles</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="user">Usuario</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
          >
            <option value="">Todos los estados</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <Users className="w-12 h-12 mb-4 opacity-50" />
            <p>No se encontraron usuarios</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Organizacion
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Ultimo Login
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl flex items-center justify-center text-white font-semibold">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-sm text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Building2 className="w-4 h-4" />
                        {user.tenant_name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          user.is_active 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {user.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                        {user.is_locked && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                            <Lock className="w-3 h-3" />
                            Bloqueado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {user.last_login 
                        ? new Date(user.last_login).toLocaleString('es-AR', { 
                            day: '2-digit', 
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Nunca'
                      }
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="relative">
                        <button
                          onClick={() => setActionMenuOpen(actionMenuOpen === user.id ? null : user.id)}
                          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-slate-400" />
                        </button>
                        
                        {actionMenuOpen === user.id && (
                          <>
                            <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setActionMenuOpen(null)}
                            />
                            <div className="absolute right-0 mt-2 w-48 bg-slate-700 rounded-lg shadow-xl border border-slate-600 py-1 z-50">
                              <button
                                onClick={() => openEditModal(user)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 w-full"
                              >
                                <Edit className="w-4 h-4" />
                                Editar
                              </button>
                              <button
                                onClick={() => handleToggleLock(user)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 w-full"
                              >
                                {user.is_locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                {user.is_locked ? 'Desbloquear' : 'Bloquear'}
                              </button>
                              <button
                                onClick={() => handleToggleActive(user)}
                                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 w-full"
                              >
                                {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                                {user.is_active ? 'Desactivar' : 'Activar'}
                              </button>
                              <hr className="my-1 border-slate-600" />
                              <button
                                onClick={() => {
                                  setSelectedUser(user);
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

      {/* Edit Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md m-4 border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-white">Editar Usuario</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre</label>
                <input
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Apellido</label>
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Rol</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-red-500"
                >
                  <option value="user">Usuario</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-slate-300">Activo</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.isLocked}
                    onChange={(e) => setEditForm({ ...editForm, isLocked: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-slate-300">Bloqueado</span>
                </label>
              </div>
            </div>
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateUser}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-800 rounded-2xl w-full max-w-md m-4 border border-red-500/50">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-xl font-semibold text-red-400">Eliminar Usuario</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-xl">
                <p className="text-red-400 text-sm">
                  Esta accion es IRREVERSIBLE. Se eliminaran todos los datos del usuario.
                </p>
              </div>
              <p className="text-slate-300">
                Estas seguro que deseas eliminar a <strong className="text-white">{selectedUser.email}</strong>?
              </p>
            </div>
            <div className="p-6 border-t border-slate-700 flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersList;
