import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Calendar, Users, TrendingUp, DollarSign, Activity, Truck, Loader2, Building, FileText, ChevronRight } from 'lucide-react';
import axios from '../api/axios';

const DashboardContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    clients: 0,
    suppliers: 0,
    trusts: 0,
    assets: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Obtener todas las estadísticas en paralelo
        const [clientsRes, suppliersRes, trustsRes, assetsRes] = await Promise.all([
          axios.get('/clients/stats').catch(() => ({ data: { success: false } })),
          axios.get('/suppliers/stats').catch(() => ({ data: { success: false } })),
          axios.get('/trusts/stats').catch(() => ({ data: { success: false } })),
          axios.get('/assets/stats').catch(() => ({ data: { success: false } }))
        ]);
        
        setStats({
          clients: clientsRes.data?.data?.stats?.total || 0,
          suppliers: suppliersRes.data?.data?.stats?.total || 0,
          trusts: trustsRes.data?.data?.stats?.total || 0,
          assets: assetsRes.data?.data?.stats?.total || 0
        });
      } catch (err) {
        console.error('Error cargando estadísticas:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user]);

  const statsCards = [
    { label: 'Fideicomisos', value: stats.trusts, icon: FileText, color: 'bg-purple-500' },
    { label: 'Activos', value: stats.assets, icon: Building, color: 'bg-emerald-500' },
    { label: 'Clientes', value: stats.clients, icon: Users, color: 'bg-blue-500' },
    { label: 'Proveedores', value: stats.suppliers, icon: Truck, color: 'bg-amber-500' },
  ];

  return (
    <div className="p-4 lg:p-8">
      {/* Welcome card */}
      <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-purple-700 rounded-3xl p-8 text-white mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative">
          <h2 className="text-2xl font-bold mb-2">¡Bienvenido de vuelta, {user?.firstName}! 👋</h2>
          <p className="text-white/80 mb-6 max-w-xl">
            Aquí tienes un resumen de tu actividad reciente. Tu organización está creciendo constantemente.
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/settings', { state: { section: 'profile' } })}
              className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 hover:bg-white/30 transition-colors cursor-pointer text-left group"
            >
              <p className="text-white/70 text-sm">Rol</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{user?.role === 'admin' ? 'Administrador' : user?.role}</p>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
            <button
              onClick={() => navigate('/settings', { state: { section: 'organization' } })}
              className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 hover:bg-white/30 transition-colors cursor-pointer text-left group"
            >
              <p className="text-white/70 text-sm">Organización</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{user?.tenantName || 'Mi Empresa'}</p>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
            <button
              onClick={() => navigate('/settings', { state: { section: 'security' } })}
              className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 hover:bg-white/30 transition-colors cursor-pointer text-left group"
            >
              <p className="text-white/70 text-sm">Email verificado</p>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{user?.emailVerified ? 'Sí ✓' : 'Pendiente'}</p>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {loading ? (
          <div className="col-span-4 flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          statsCards.map((stat, i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center text-white`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-800">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Información de la cuenta</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="font-medium text-slate-800">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Cuenta verificada</p>
                <p className="font-medium text-slate-800">
                  {user?.emailVerified ? 'Email verificado' : 'Pendiente de verificación'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Último acceso</p>
                <p className="font-medium text-slate-800">
                  {user?.lastLogin 
                    ? new Date(user.lastLogin).toLocaleDateString('es-AR', { 
                        day: 'numeric', 
                        month: 'long', 
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Primera sesión'
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Acciones rápidas</h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => navigate('/clients')}
              className="p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left cursor-pointer"
            >
              <Users className="w-6 h-6 text-primary-600 mb-2" />
              <p className="font-medium text-slate-800">Nuevo Cliente</p>
              <p className="text-xs text-slate-500">Agregar cliente</p>
            </button>
            <button 
              onClick={() => navigate('/suppliers')}
              className="p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left cursor-pointer"
            >
              <Activity className="w-6 h-6 text-primary-600 mb-2" />
              <p className="font-medium text-slate-800">Nuevo Proveedor</p>
              <p className="text-xs text-slate-500">Invitar proveedor</p>
            </button>
            <button 
              onClick={() => navigate('/trusts')}
              className="p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left cursor-pointer"
            >
              <DollarSign className="w-6 h-6 text-primary-600 mb-2" />
              <p className="font-medium text-slate-800">Fideicomiso</p>
              <p className="text-xs text-slate-500">Crear nuevo</p>
            </button>
            <button 
              onClick={() => navigate('/settings')}
              className="p-4 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left cursor-pointer"
            >
              <TrendingUp className="w-6 h-6 text-primary-600 mb-2" />
              <p className="font-medium text-slate-800">Configuración</p>
              <p className="text-xs text-slate-500">Ajustes de cuenta</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardContent;

