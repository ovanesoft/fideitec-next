import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock,
  Wallet, Settings, History, RefreshCw, Eye, Play,
  User, Building2, DollarSign, Coins, FileText,
  Key, Lock, Unlock, Copy, Check, ExternalLink,
  Filter, Search, ChevronDown, ChevronUp,
  AlertCircle, Bell, Gauge
} from 'lucide-react';

// Formatear moneda
const formatCurrency = (amount, currency = 'USD') => {
  if (!amount) return '$0';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};

// Formatear dirección de wallet
const formatAddress = (address) => {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Copiar al portapapeles
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button onClick={handleCopy} className="p-1 hover:bg-gray-100 rounded">
      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
    </button>
  );
};

// Card de estadísticas
const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle }) => (
  <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-${color}-100`}>
        <Icon className={`w-6 h-6 text-${color}-600`} />
      </div>
    </div>
  </div>
);

const Approvals = () => {
  const { user } = useAuth();
  
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'wallet', 'audit', 'limits'
  
  // Aprobaciones
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  
  // Wallet
  const [walletConfig, setWalletConfig] = useState(null);
  const [showWalletForm, setShowWalletForm] = useState(false);
  const [walletFormData, setWalletFormData] = useState({
    walletAddress: '',
    privateKey: ''
  });
  const [savingWallet, setSavingWallet] = useState(false);
  const [togglingDualSig, setTogglingDualSig] = useState(false);
  
  // Auditoría
  const [auditHistory, setAuditHistory] = useState([]);
  
  // Rate limit
  const [rateLimitStatus, setRateLimitStatus] = useState(null);
  
  // Acción en proceso
  const [processingId, setProcessingId] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  // Cargar datos
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Cargar en paralelo
      const [pendingRes, walletRes, rateLimitRes] = await Promise.all([
        api.get('/approvals/pending'),
        api.get('/approvals/wallet-config'),
        api.get('/approvals/rate-limit-status')
      ]);
      
      setPendingApprovals(pendingRes.data.data?.approvals || []);
      setPendingCount(pendingRes.data.data?.count || 0);
      setWalletConfig(walletRes.data.data);
      setRateLimitStatus(rateLimitRes.data.data);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error cargando datos');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // Cargar auditoría cuando se cambia a ese tab
  const loadAuditHistory = async () => {
    try {
      const res = await api.get('/approvals/audit?limit=50');
      setAuditHistory(res.data.data?.history || []);
    } catch (error) {
      console.error('Error cargando auditoría:', error);
    }
  };
  
  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditHistory();
    }
  }, [activeTab]);

  // Aprobar operación
  const handleApprove = async (orderId) => {
    try {
      setProcessingId(orderId);
      await api.post(`/approvals/${orderId}/approve`, {
        notes: 'Aprobado desde panel de administración'
      });
      
      toast.success('✅ Operación aprobada. Proceda con la ejecución.');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al aprobar');
    } finally {
      setProcessingId(null);
    }
  };
  
  // Ejecutar operación aprobada
  const handleExecute = async (orderId) => {
    try {
      setProcessingId(orderId);
      const res = await api.post(`/approvals/${orderId}/execute`);
      
      if (res.data.success) {
        toast.success('🎉 Operación ejecutada exitosamente');
        
        // Mostrar info de la firma dual si existe
        if (res.data.data?.dualSignature?.dualSignatureVerified) {
          toast.success('🔐 Certificado firmado con doble firma (Tenant + Fideitec)');
        }
        
        loadData();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al ejecutar');
    } finally {
      setProcessingId(null);
    }
  };
  
  // Rechazar operación
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Debe proporcionar una razón para el rechazo');
      return;
    }
    
    try {
      setProcessingId(selectedOrder.id);
      await api.post(`/approvals/${selectedOrder.id}/reject`, {
        reason: rejectReason,
        notes: 'Rechazado desde panel de administración'
      });
      
      toast.success('Operación rechazada');
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al rechazar');
    } finally {
      setProcessingId(null);
    }
  };
  
  // Guardar configuración de wallet
  const handleSaveWallet = async (e) => {
    e.preventDefault();
    
    if (!walletFormData.walletAddress) {
      toast.error('La dirección de billetera es requerida');
      return;
    }
    
    try {
      setSavingWallet(true);
      await api.post('/approvals/wallet-config', walletFormData);
      
      toast.success('🔐 Billetera configurada correctamente');
      setShowWalletForm(false);
      setWalletFormData({ walletAddress: '', privateKey: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al configurar billetera');
    } finally {
      setSavingWallet(false);
    }
  };
  
  // Toggle doble firma
  const handleToggleDualSignature = async () => {
    const newValue = !walletConfig?.dual_signature_enabled;
    
    try {
      setTogglingDualSig(true);
      await api.post('/approvals/toggle-dual-signature', { enabled: newValue });
      
      toast.success(newValue 
        ? '🔐 Doble firma activada' 
        : '✅ Doble firma desactivada (solo firma Fideitec)');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al cambiar configuración');
    } finally {
      setTogglingDualSig(false);
    }
  };
  
  // Formatear fecha/hora
  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Calcular tiempo esperando
  const getWaitingTime = (hoursWaiting) => {
    if (!hoursWaiting) return '-';
    if (hoursWaiting < 1) return `${Math.round(hoursWaiting * 60)} min`;
    if (hoursWaiting < 24) return `${Math.round(hoursWaiting)} hrs`;
    return `${Math.round(hoursWaiting / 24)} días`;
  };

  // Tabs
  const tabs = [
    { id: 'pending', label: 'Pendientes', icon: Clock, badge: pendingCount },
    { id: 'wallet', label: 'Billetera', icon: Wallet },
    { id: 'limits', label: 'Rate Limit', icon: Gauge },
    { id: 'audit', label: 'Auditoría', icon: History }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <ShieldCheck className="w-8 h-8 text-blue-600" />
              Centro de Aprobaciones
            </h1>
            <p className="text-gray-500 mt-1">
              Gestiona aprobaciones, billetera blockchain y auditoría
            </p>
          </div>
          
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
        
        {/* Alerta de pendientes */}
        {pendingCount > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <Bell className="w-6 h-6 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                {pendingCount} {pendingCount === 1 ? 'operación pendiente' : 'operaciones pendientes'} de aprobación
              </p>
              <p className="text-sm text-amber-600">
                Revisa y aprueba las operaciones antes de que se ejecuten
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
              ${activeTab === tab.id 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.badge > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                ${activeTab === tab.id ? 'bg-white text-blue-600' : 'bg-red-500 text-white'}`}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenido según tab */}
      {activeTab === 'pending' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Operaciones Pendientes de Aprobación
          </h2>
          
          {loading ? (
            <div className="flex justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No hay operaciones pendientes</p>
              <p className="text-gray-400 text-sm">Todas las operaciones han sido procesadas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingApprovals.map(approval => (
                <div key={approval.id} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    {/* Info principal */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                          <Clock className="w-3 h-3 inline mr-1" />
                          Pendiente
                        </span>
                        <span className="text-gray-500 text-sm">
                          Hace {getWaitingTime(approval.hours_waiting)}
                        </span>
                      </div>
                      
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        Orden {approval.order_number}
                        <span className="ml-2 text-sm font-normal text-blue-600">
                          ({approval.order_type === 'buy' ? 'Compra' : 'Venta'})
                        </span>
                      </h3>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase">Cliente</p>
                          <p className="font-medium text-gray-900">{approval.client_name || '-'}</p>
                          <p className="text-xs text-gray-500">{approval.client_document}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase">Token</p>
                          <p className="font-medium text-gray-900">{approval.token_name}</p>
                          <p className="text-xs text-gray-500">{approval.token_symbol}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase">Cantidad</p>
                          <p className="font-medium text-gray-900">{approval.token_amount} tokens</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase">Total</p>
                          <p className="font-medium text-green-600">
                            {formatCurrency(approval.total_amount, approval.currency)}
                          </p>
                        </div>
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-3">
                        Solicitado por: {approval.requested_by_name} ({approval.requested_by_email})
                        <span className="mx-2">•</span>
                        {formatDateTime(approval.created_at)}
                      </p>
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex flex-col gap-2 ml-4">
                      {approval.status === 'pending_approval' && (
                        <>
                          <button
                            onClick={() => handleApprove(approval.id)}
                            disabled={processingId === approval.id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                          >
                            {processingId === approval.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                            Aprobar
                          </button>
                          <button
                            onClick={() => {
                              setSelectedOrder(approval);
                              setShowRejectModal(true);
                            }}
                            disabled={processingId === approval.id}
                            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Rechazar
                          </button>
                        </>
                      )}
                      
                      {approval.status === 'approved' && (
                        <button
                          onClick={() => handleExecute(approval.id)}
                          disabled={processingId === approval.id}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          {processingId === approval.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                          Ejecutar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'wallet' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Configuración de Firma Blockchain
          </h2>
          
          {/* Estado actual de firma */}
          <div className={`mb-6 p-6 rounded-xl border-2 ${
            walletConfig?.dual_signature_enabled 
              ? 'bg-purple-50 border-purple-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  walletConfig?.dual_signature_enabled 
                    ? 'bg-purple-100' 
                    : 'bg-green-100'
                }`}>
                  <ShieldCheck className={`w-8 h-8 ${
                    walletConfig?.dual_signature_enabled 
                      ? 'text-purple-600' 
                      : 'text-green-600'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${
                    walletConfig?.dual_signature_enabled 
                      ? 'text-purple-900' 
                      : 'text-green-900'
                  }`}>
                    {walletConfig?.dual_signature_enabled 
                      ? '🔐 Doble Firma Activa' 
                      : '✅ Firma Fideitec'}
                  </h3>
                  <p className={`text-sm ${
                    walletConfig?.dual_signature_enabled 
                      ? 'text-purple-700' 
                      : 'text-green-700'
                  }`}>
                    {walletConfig?.dual_signature_enabled 
                      ? 'Los certificados requieren firma del tenant + Fideitec' 
                      : 'Los certificados son firmados solo por Fideitec (gas incluido)'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleToggleDualSignature}
                disabled={togglingDualSig}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                  walletConfig?.dual_signature_enabled
                    ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                }`}
              >
                {togglingDualSig ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : walletConfig?.dual_signature_enabled ? (
                  <>
                    <Unlock className="w-4 h-4" />
                    Desactivar Doble Firma
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Activar Doble Firma
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Configuración de billetera del tenant (solo si doble firma está activa o quieren configurarla) */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-gray-600" />
              Billetera del Tenant
              {!walletConfig?.dual_signature_enabled && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
                  Solo necesaria si activas doble firma
                </span>
              )}
            </h3>
            
            {walletConfig?.blockchain_enabled ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-full bg-green-100">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-600">Billetera Configurada</p>
                    <p className="text-sm text-gray-500">
                      Red: {walletConfig.blockchain_network || 'Base'}
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-400 uppercase mb-1">Dirección</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono text-gray-900">
                        {walletConfig.blockchain_wallet_address}
                      </code>
                      <CopyButton text={walletConfig.blockchain_wallet_address} />
                      <a
                        href={`https://basescan.org/address/${walletConfig.blockchain_wallet_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      </a>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-400 uppercase mb-1">Clave Privada</p>
                      <div className="flex items-center gap-2">
                        {walletConfig.has_private_key ? (
                          <>
                            <Lock className="w-4 h-4 text-green-600" />
                            <span className="text-green-600 font-medium text-sm">Encriptada</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-4 h-4 text-amber-600" />
                            <span className="text-amber-600 font-medium text-sm">No configurada</span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-400 uppercase mb-1">Configurada</p>
                      <p className="text-gray-900 text-sm">
                        {formatDateTime(walletConfig.blockchain_configured_at)}
                      </p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowWalletForm(true)}
                  className="mt-4 flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4" />
                  Reconfigurar
                </button>
              </div>
            ) : (
              <div className="text-center py-6">
                <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">Billetera no configurada</p>
                <p className="text-gray-400 text-sm mb-4">
                  {walletConfig?.dual_signature_enabled 
                    ? 'Necesitas configurarla para que funcione la doble firma'
                    : 'Configúrala cuando actives la doble firma'}
                </p>
                <button
                  onClick={() => setShowWalletForm(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  <Key className="w-4 h-4" />
                  Configurar Billetera
                </button>
              </div>
            )}
          </div>
          
          {/* Info de cómo funciona */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              ¿Cómo funciona?
            </h3>
            <div className="space-y-3 text-sm text-blue-700">
              <div className="flex items-start gap-3">
                <span className="font-bold text-blue-600">1.</span>
                <p><strong>Cliente solicita compra:</strong> La orden queda pendiente de aprobación.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-blue-600">2.</span>
                <p><strong>Admin del tenant aprueba:</strong> Revisa y aprueba la operación.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-bold text-blue-600">3.</span>
                <p><strong>Ejecución y firma:</strong> Se genera el certificado y se firma en blockchain.</p>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white rounded-lg">
              <p className="text-sm text-gray-600">
                <strong>Modo actual:</strong>{' '}
                {walletConfig?.dual_signature_enabled ? (
                  <span className="text-purple-600">
                    Doble firma (Tenant + Fideitec) - El gas lo paga cada billetera
                  </span>
                ) : (
                  <span className="text-green-600">
                    Solo Fideitec - El gas lo paga Fideitec 🎁
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'limits' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Estado de Rate Limiting
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-6">
            <StatCard
              title="Operaciones usadas"
              value={rateLimitStatus?.operationsUsed || 0}
              subtitle={`de ${rateLimitStatus?.maxOperations || 3} por hora`}
              icon={Gauge}
              color="blue"
            />
            <StatCard
              title="Operaciones restantes"
              value={rateLimitStatus?.operationsRemaining || 3}
              subtitle="disponibles esta hora"
              icon={CheckCircle2}
              color="green"
            />
            <StatCard
              title="Límite máximo"
              value={`${rateLimitStatus?.maxOperations || 3}/hora`}
              subtitle="configurado para tu tenant"
              icon={AlertCircle}
              color="amber"
            />
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <h3 className="font-medium text-amber-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              ¿Por qué hay límites?
            </h3>
            <ul className="text-sm text-amber-700 space-y-2">
              <li>• <strong>Protección contra bots:</strong> Previene generación masiva automatizada de tokens</li>
              <li>• <strong>Control de fraude:</strong> Permite revisión manual de cada operación</li>
              <li>• <strong>Auditoría:</strong> Todas las operaciones quedan registradas</li>
              <li>• <strong>No hay límite de cantidad:</strong> Puedes comprar 100 tokens en 1 operación</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Historial de Auditoría
          </h2>
          
          {auditHistory.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600">No hay registros de auditoría</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acción</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditHistory.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium
                          ${entry.action === 'approved' ? 'bg-green-100 text-green-700' :
                            entry.action === 'rejected' ? 'bg-red-100 text-red-700' :
                            entry.action === 'created' ? 'bg-blue-100 text-blue-700' :
                            entry.action === 'executed' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {entry.entity_type}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {entry.decided_by_name || entry.requested_by_name || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-gray-400">{entry.previous_status}</span>
                        {entry.previous_status && entry.new_status && ' → '}
                        <span className="text-gray-900 font-medium">{entry.new_status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                        {entry.ip_address || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal de configuración de billetera */}
      {showWalletForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Wallet className="w-6 h-6 text-blue-600" />
                Configurar Billetera
              </h2>
            </div>
            
            <form onSubmit={handleSaveWallet} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dirección de Billetera (0x...)
                </label>
                <input
                  type="text"
                  value={walletFormData.walletAddress}
                  onChange={(e) => setWalletFormData(prev => ({ ...prev, walletAddress: e.target.value }))}
                  placeholder="0x..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Clave Privada (opcional)
                </label>
                <input
                  type="password"
                  value={walletFormData.privateKey}
                  onChange={(e) => setWalletFormData(prev => ({ ...prev, privateKey: e.target.value }))}
                  placeholder="Dejar vacío para solo verificación"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">
                  La clave se almacena encriptada con AES-256-GCM. Se requiere para la doble firma.
                </p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  <strong>Importante:</strong> Asegúrate de que la billetera tenga ETH en Base para pagar gas de transacciones.
                </p>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowWalletForm(false);
                    setWalletFormData({ walletAddress: '', privateKey: '' });
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWallet}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {savingWallet ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de rechazo */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <XCircle className="w-6 h-6 text-red-600" />
                Rechazar Operación
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">
                  <strong>Orden:</strong> {selectedOrder.order_number}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Cliente:</strong> {selectedOrder.client_name}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Monto:</strong> {selectedOrder.token_amount} tokens - {formatCurrency(selectedOrder.total_amount, selectedOrder.currency)}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Razón del rechazo *
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explique el motivo del rechazo..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  required
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason('');
                    setSelectedOrder(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReject}
                  disabled={processingId === selectedOrder.id || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {processingId === selectedOrder.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Confirmar Rechazo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Approvals;

