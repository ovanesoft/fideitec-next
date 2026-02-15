import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  User, Building2, Shield, Mail, Phone, Globe, 
  Camera, Save, Loader2, CheckCircle, AlertCircle,
  Lock, Eye, EyeOff, Send, Copy, Link, Pencil, Check, X,
  Store, ExternalLink
} from 'lucide-react';
import axios from '../api/axios';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Slug editing state
  const [editingSlug, setEditingSlug] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [slugSaving, setSlugSaving] = useState(false);
  const [copiedLink, setCopiedLink] = useState(null);

  // Marketplace state
  const [marketplaceData, setMarketplaceData] = useState({
    marketplace_enabled: false,
    marketplace_brand_name: '',
    marketplace_description: '',
    marketplace_logo_url: '',
    marketplace_website: '',
    marketplace_phone: '',
    marketplace_email: ''
  });
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceSaving, setMarketplaceSaving] = useState(false);

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

  // Load marketplace data
  useEffect(() => {
    const loadMarketplaceData = async () => {
      if (!user?.tenantId) return;
      try {
        const response = await axios.get(`/tenants/${user.tenantId}`);
        if (response.data.success) {
          const t = response.data.data.tenant || response.data.data;
          setMarketplaceData({
            marketplace_enabled: t.marketplace_enabled || false,
            marketplace_brand_name: t.marketplace_brand_name || '',
            marketplace_description: t.marketplace_description || '',
            marketplace_logo_url: t.marketplace_logo_url || '',
            marketplace_website: t.marketplace_website || '',
            marketplace_phone: t.marketplace_phone || '',
            marketplace_email: t.marketplace_email || ''
          });
        }
      } catch (err) {
        console.error('Error loading marketplace data:', err);
      } finally {
        setMarketplaceLoading(false);
      }
    };
    loadMarketplaceData();
  }, [user?.tenantId]);

  const handleSaveMarketplace = async () => {
    setMarketplaceSaving(true);
    try {
      await axios.put(`/tenants/${user.tenantId}`, marketplaceData);
      toast.success('Configuración de marketplace guardada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar configuración');
    } finally {
      setMarketplaceSaving(false);
    }
  };

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

  const handleStartEditSlug = () => {
    setNewSlug(user?.tenantSlug || '');
    setEditingSlug(true);
  };

  const handleSaveSlug = async () => {
    const sanitized = newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-');
    if (!sanitized || sanitized.length < 3) {
      toast.error('El slug debe tener al menos 3 caracteres (solo letras, números y guiones)');
      return;
    }
    setSlugSaving(true);
    try {
      await axios.put(`/tenants/${user?.tenantId}`, { slug: sanitized });
      toast.success('Slug actualizado. Los links del portal ahora usan el nuevo identificador.');
      setEditingSlug(false);
      // Recargar para reflejar el cambio
      window.location.reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al actualizar el slug');
    } finally {
      setSlugSaving(false);
    }
  };

  const handleCopyLink = (url, type) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(type);
    toast.success('Link copiado al portapapeles');
    setTimeout(() => setCopiedLink(null), 2000);
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
                <label className="block text-sm font-medium text-slate-600 mb-1.5">Tu rol en la organización</label>
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-800">{getRoleLabel(user?.role)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Slug / Identificador del portal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Identificador del portal</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Este identificador se usa en los links de los portales de clientes y proveedores
                </p>
              </div>
              {(user?.role === 'admin' || user?.role === 'root') && !editingSlug && (
                <button
                  onClick={handleStartEditSlug}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>

            {editingSlug ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-xl border border-primary-300 focus-within:ring-2 focus-within:ring-primary-500">
                      <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <input
                        type="text"
                        value={newSlug}
                        onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="flex-1 bg-transparent outline-none text-slate-800"
                        placeholder="mi-empresa"
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">
                      Solo letras minúsculas, números y guiones. Mínimo 3 caracteres.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveSlug}
                      disabled={slugSaving}
                      className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                    >
                      {slugSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setEditingSlug(false)}
                      className="p-2.5 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Al cambiar el identificador, los links actuales de los portales dejarán de funcionar y se actualizarán automáticamente con el nuevo valor.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
                <Globe className="w-4 h-4 text-slate-400" />
                <span className="text-slate-800 font-mono">{user?.tenantSlug || '-'}</span>
              </div>
            )}
          </div>

          {/* Portal Links */}
          {user?.tenantSlug && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Links de los portales</h3>
              <div className="space-y-4">
                {/* Client Portal */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Portal de Clientes</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 flex-1 overflow-hidden">
                      <Link className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">
                        {window.location.origin}/portal/{user.tenantSlug}/login
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(`${window.location.origin}/portal/${user.tenantSlug}/login`, 'client')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0"
                    >
                      {copiedLink === 'client' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
                {/* Supplier Portal */}
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1.5">Portal de Proveedores</label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 flex-1 overflow-hidden">
                      <Link className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <span className="text-sm text-slate-700 truncate">
                        {window.location.origin}/supplier-portal/{user.tenantSlug}/login
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyLink(`${window.location.origin}/supplier-portal/${user.tenantSlug}/login`, 'supplier')}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex-shrink-0"
                    >
                      {copiedLink === 'supplier' ? (
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-500" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Marketplace */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Store className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">Marketplace</h3>
                  <p className="text-sm text-slate-500">Publicá tus proyectos en el marketplace público de FIDEITEC</p>
                </div>
              </div>
              <a 
                href="/marketplace" 
                target="_blank"
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Ver marketplace <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {marketplaceLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Toggle habilitado */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="font-medium text-slate-800">Habilitar marketplace</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Permite publicar activos en el marketplace público
                    </p>
                  </div>
                  <button
                    onClick={() => setMarketplaceData(d => ({ ...d, marketplace_enabled: !d.marketplace_enabled }))}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      marketplaceData.marketplace_enabled ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                      marketplaceData.marketplace_enabled ? 'translate-x-5' : ''
                    }`} />
                  </button>
                </div>

                {marketplaceData.marketplace_enabled && (
                  <>
                    {/* Nombre de marca */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Nombre de marca (público)
                      </label>
                      <input
                        type="text"
                        placeholder={user?.tenantName || 'Nombre de tu empresa'}
                        value={marketplaceData.marketplace_brand_name}
                        onChange={(e) => setMarketplaceData(d => ({ ...d, marketplace_brand_name: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      <p className="text-xs text-slate-400 mt-1">Si se deja vacío, se usa el nombre de la organización</p>
                    </div>

                    {/* Descripción */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Descripción de la empresa
                      </label>
                      <textarea
                        rows="3"
                        placeholder="Breve descripción de tu empresa que verán los inversores..."
                        value={marketplaceData.marketplace_description}
                        onChange={(e) => setMarketplaceData(d => ({ ...d, marketplace_description: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    {/* Logo URL */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        URL del logo
                      </label>
                      <input
                        type="url"
                        placeholder="https://ejemplo.com/logo.png"
                        value={marketplaceData.marketplace_logo_url}
                        onChange={(e) => setMarketplaceData(d => ({ ...d, marketplace_logo_url: e.target.value }))}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>

                    {/* Contacto */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Sitio web
                        </label>
                        <input
                          type="url"
                          placeholder="https://..."
                          value={marketplaceData.marketplace_website}
                          onChange={(e) => setMarketplaceData(d => ({ ...d, marketplace_website: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Email de contacto
                        </label>
                        <input
                          type="email"
                          placeholder="info@empresa.com"
                          value={marketplaceData.marketplace_email}
                          onChange={(e) => setMarketplaceData(d => ({ ...d, marketplace_email: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          placeholder="+54 11 ..."
                          value={marketplaceData.marketplace_phone}
                          onChange={(e) => setMarketplaceData(d => ({ ...d, marketplace_phone: e.target.value }))}
                          className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Guardar */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveMarketplace}
                    disabled={marketplaceSaving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
                  >
                    {marketplaceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar marketplace
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Organization Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-800">Nota sobre la organización</h4>
                <p className="text-sm text-blue-700 mt-1">
                  El nombre de la organización es administrado por el Super Admin. Si necesitas cambiar el nombre, 
                  contacta al administrador.
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
