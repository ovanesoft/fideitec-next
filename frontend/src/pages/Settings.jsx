import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, Building2, Shield, Mail, Phone, Globe, 
  Camera, Save, Loader2, CheckCircle, AlertCircle,
  Lock, Eye, EyeOff, Send
} from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Password change state
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Set active tab based on navigation state
  useEffect(() => {
    if (location.state?.section) {
      setActiveTab(location.state.section);
    }
  }, [location.state]);

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'organization', label: 'Organización', icon: Building2 },
    { id: 'security', label: 'Seguridad', icon: Shield },
  ];

  const getRoleLabel = (role) => {
    const roles = {
      root: 'Super Admin',
      admin: 'Administrador',
      manager: 'Manager',
      user: 'Usuario'
    };
    return roles[role] || role;
  };

  const handleResendVerification = async () => {
    setResendingVerification(true);
    try {
      await axios.post('/auth/resend-verification', { email: user?.email });
      toast.success('Email de verificación enviado. Revisa tu bandeja de entrada.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al enviar el email de verificación');
    } finally {
      setResendingVerification(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Las contraseñas nuevas no coinciden');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setSaving(true);
    try {
      await axios.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Contraseña actualizada correctamente');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
        <p className="text-slate-500 mt-1">Administra tu perfil, organización y seguridad</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-primary-700 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* User Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-purple-600 h-24 relative">
              <div className="absolute -bottom-10 left-6">
                <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-purple-500 rounded-2xl flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
              </div>
            </div>
            <div className="pt-14 pb-6 px-6">
              <h2 className="text-xl font-bold text-slate-800">
                {user?.firstName} {user?.lastName}
              </h2>
              <p className="text-slate-500">{user?.email}</p>
              <span className="inline-flex mt-2 px-3 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                {getRoleLabel(user?.role)}
              </span>
            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Información personal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombre</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{user?.firstName || '-'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Apellido</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{user?.lastName || '-'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{user?.email || '-'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Teléfono</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{user?.phone || 'Sin registrar'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Proveedor de autenticación</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800 capitalize">{user?.authProvider || 'local'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Miembro desde</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">
                    {user?.createdAt 
                      ? new Date(user.createdAt).toLocaleDateString('es-AR', { 
                          day: 'numeric', month: 'long', year: 'numeric' 
                        })
                      : '-'
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Organization Tab */}
      {activeTab === 'organization' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-6">Datos de la organización</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Nombre de la organización</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{user?.tenantName || 'Sin asignar'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Slug</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Globe className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{user?.tenantSlug || '-'}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tu rol en la organización</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{getRoleLabel(user?.role)}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1.5">ID de Tenant</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800 font-mono text-sm">{user?.tenantId || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Organization Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-800">Nota sobre la organización</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Los datos de la organización son administrados por el Super Admin. Si necesitas realizar cambios, 
                  contacta al administrador de tu organización.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Email Verification */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Verificación de email</h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-3">
                {user?.emailVerified ? (
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  </div>
                )}
                <div>
                  <p className="font-medium text-slate-800">
                    {user?.emailVerified ? 'Email verificado' : 'Email pendiente de verificación'}
                  </p>
                  <p className="text-sm text-slate-500">{user?.email}</p>
                </div>
              </div>
              {!user?.emailVerified && (
                <button
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm font-medium"
                >
                  {resendingVerification ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Reenviar verificación
                </button>
              )}
            </div>
          </div>

          {/* Change Password */}
          {user?.authProvider === 'local' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Cambiar contraseña</h3>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Contraseña actual</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Confirmar nueva contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
                      required
                      minLength={8}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Actualizar contraseña
                </button>
              </form>
            </div>
          )}

          {/* Session Info */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Información de sesión</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-600">Último acceso</span>
                <span className="text-sm font-medium text-slate-800">
                  {user?.lastLogin 
                    ? new Date(user.lastLogin).toLocaleDateString('es-AR', { 
                        day: 'numeric', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })
                    : 'Primera sesión'
                  }
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <span className="text-sm text-slate-600">Proveedor de autenticación</span>
                <span className="text-sm font-medium text-slate-800 capitalize">
                  {user?.authProvider || 'local'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
