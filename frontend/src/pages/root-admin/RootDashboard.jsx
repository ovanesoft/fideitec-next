import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { 
  Building2, Users, UserCheck, Activity, 
  TrendingUp, AlertCircle, Clock, CreditCard,
  CheckCircle, XCircle, Pause, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const RootDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get('/root-admin/stats'),
        api.get('/root-admin/activity?limit=10')
      ]);
      
      setStats(statsRes.data.data.stats);
      setActivities(activityRes.data.data.activities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Error al cargar datos del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getBillingStatusColor = (status) => {
    const colors = {
      active: 'text-green-400',
      trial: 'text-blue-400',
      past_due: 'text-yellow-400',
      suspended: 'text-red-400',
      cancelled: 'text-slate-400'
    };
    return colors[status] || 'text-slate-400';
  };

  const getBillingStatusIcon = (status) => {
    const icons = {
      active: CheckCircle,
      trial: Clock,
      past_due: AlertCircle,
      suspended: Pause,
      cancelled: XCircle
    };
    return icons[status] || AlertCircle;
  };

  const getActionLabel = (action) => {
    const labels = {
      'LOGIN': 'Inicio de sesion',
      'LOGOUT': 'Cierre de sesion',
      'USER_CREATED': 'Usuario creado',
      'USER_UPDATED': 'Usuario actualizado',
      'TENANT_CREATED': 'Organizacion creada',
      'TENANT_UPDATED': 'Organizacion actualizada',
      'TENANT_BILLING_UPDATED': 'Billing actualizado',
      'TENANT_SUSPENDED': 'Organizacion suspendida',
      'TENANT_REACTIVATED': 'Organizacion reactivada',
      'CLIENT_CREATED': 'Cliente creado',
      'TRUST_CREATED': 'Fideicomiso creado'
    };
    return labels[action] || action;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-12 h-12 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div 
          onClick={() => navigate('/root-admin/tenants')}
          className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-red-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Building2 className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{stats?.totalTenants || 0}</p>
              <p className="text-sm text-slate-400">Organizaciones</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-green-400">{stats?.activeTenants || 0} activas</span>
            <ArrowRight className="w-4 h-4 ml-auto text-slate-500" />
          </div>
        </div>

        <div 
          onClick={() => navigate('/root-admin/users')}
          className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-red-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-7 h-7 text-purple-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</p>
              <p className="text-sm text-slate-400">Usuarios</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-blue-400">{stats?.recentLogins || 0} activos esta semana</span>
            <ArrowRight className="w-4 h-4 ml-auto text-slate-500" />
          </div>
        </div>

        <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-500/20 rounded-xl flex items-center justify-center">
              <UserCheck className="w-7 h-7 text-green-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{stats?.totalClients || 0}</p>
              <p className="text-sm text-slate-400">Clientes</p>
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-400">
            En todos los tenants
          </div>
        </div>

        <div 
          onClick={() => navigate('/root-admin/billing')}
          className="bg-slate-800 rounded-2xl p-6 border border-slate-700 hover:border-red-500/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-yellow-400" />
            </div>
            <div>
              <p className="text-3xl font-bold text-white">{stats?.billing?.active || 0}</p>
              <p className="text-sm text-slate-400">Suscripciones Activas</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            {(stats?.billing?.past_due || 0) > 0 && (
              <span className="text-yellow-400">{stats.billing.past_due} vencidas</span>
            )}
            <ArrowRight className="w-4 h-4 ml-auto text-slate-500" />
          </div>
        </div>
      </div>

      {/* Billing Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-yellow-400" />
              Estado de Billing
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {Object.entries(stats?.billing || {}).map(([status, count]) => {
                const Icon = getBillingStatusIcon(status);
                const statusLabels = {
                  active: 'Activas',
                  trial: 'En Trial',
                  past_due: 'Vencidas',
                  suspended: 'Suspendidas',
                  cancelled: 'Canceladas'
                };
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${getBillingStatusColor(status)}`} />
                      <span className="text-slate-300">{statusLabels[status] || status}</span>
                    </div>
                    <span className={`text-lg font-semibold ${getBillingStatusColor(status)}`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Actividad Reciente
            </h3>
            <button 
              onClick={() => navigate('/root-admin/audit-logs')}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Ver todo
            </button>
          </div>
          <div className="divide-y divide-slate-700">
            {activities.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No hay actividad reciente
              </div>
            ) : (
              activities.slice(0, 5).map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">
                        {getActionLabel(activity.action)}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {activity.user_email || 'Sistema'} 
                        {activity.tenant_name && ` - ${activity.tenant_name}`}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(activity.created_at).toLocaleString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Acciones Rapidas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/root-admin/tenants')}
            className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Building2 className="w-6 h-6 text-blue-400" />
            <span className="text-white">Gestionar Tenants</span>
          </button>
          <button
            onClick={() => navigate('/root-admin/users')}
            className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Users className="w-6 h-6 text-purple-400" />
            <span className="text-white">Gestionar Usuarios</span>
          </button>
          <button
            onClick={() => navigate('/root-admin/billing')}
            className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <CreditCard className="w-6 h-6 text-yellow-400" />
            <span className="text-white">Revisar Billing</span>
          </button>
          <button
            onClick={() => navigate('/root-admin/audit-logs')}
            className="flex items-center gap-3 p-4 bg-slate-700/50 hover:bg-slate-700 rounded-xl transition-colors"
          >
            <Activity className="w-6 h-6 text-green-400" />
            <span className="text-white">Ver Logs</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RootDashboard;
