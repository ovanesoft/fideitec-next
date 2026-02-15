import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import { 
  Coins, Search, Plus, Filter, 
  CheckCircle2, Clock, AlertCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Eye, Send, Flame,
  ExternalLink, Wallet, ArrowRightLeft, History,
  Building2, Home, Briefcase, RefreshCw, Settings,
  TrendingUp, Users, Layers, Copy, Check, ArrowLeft,
  FileText, Download, ShoppingCart, DollarSign, 
  CreditCard, ShieldCheck, QrCode, Link2, Zap, HelpCircle, X
} from 'lucide-react';

// Estados de tokenización
const STATUS_LABELS = {
  draft: { label: 'Borrador', color: 'bg-slate-100 text-slate-700', icon: Clock },
  active: { label: 'Activo', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  paused: { label: 'Pausado', color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
  closed: { label: 'Cerrado', color: 'bg-gray-100 text-gray-700', icon: AlertTriangle }
};

// Tipos de activo
const ASSET_TYPE_ICONS = {
  asset: Building2,
  asset_unit: Home,
  trust: Briefcase
};

const ASSET_TYPE_LABELS = {
  asset: 'Activo',
  asset_unit: 'Unidad',
  trust: 'Fideicomiso'
};

// Tipos de transacción
const TX_TYPE_LABELS = {
  mint: { label: 'Emisión', color: 'bg-green-100 text-green-700', icon: Plus },
  transfer: { label: 'Endoso', color: 'bg-blue-100 text-blue-700', icon: Send },
  burn: { label: 'Quema', color: 'bg-red-100 text-red-700', icon: Flame },
  return: { label: 'Devolución', color: 'bg-purple-100 text-purple-700', icon: ArrowLeft }
};

// Componente para copiar al portapapeles
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

// Formatear dirección de wallet
const formatAddress = (address) => {
  if (!address) return '-';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Formatear números grandes
const formatNumber = (num) => {
  if (!num) return '0';
  return new Intl.NumberFormat('es-AR').format(num);
};

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

const Tokenization = () => {
  const { user } = useAuth();
  
  // Estados principales
  const [loading, setLoading] = useState(true);
  const [blockchainStatus, setBlockchainStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [tokenizedAssets, setTokenizedAssets] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  // Estados de UI
  const [activeTab, setActiveTab] = useState('assets'); // 'assets', 'orders', 'certificates', 'transactions'
  const [showTokenizeModal, setShowTokenizeModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showBuyOrderModal, setShowBuyOrderModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSellOrderModal, setShowSellOrderModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedCertificate, setSelectedCertificate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Datos de órdenes y certificados
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState(null);
  const [certificates, setCertificates] = useState([]);
  
  // Datos para tokenizar
  const [availableAssets, setAvailableAssets] = useState([]);
  const [availableUnits, setAvailableUnits] = useState([]);
  const [availableTrusts, setAvailableTrusts] = useState([]);
  const [clients, setClients] = useState([]);
  
  // Formularios
  const [tokenizeForm, setTokenizeForm] = useState({
    asset_type: 'asset',
    asset_id: '',
    asset_unit_id: '',
    trust_id: '',
    total_supply: 100,
    token_price: 0,
    token_name: '',
    token_symbol: ''
  });
  
  const [transferForm, setTransferForm] = useState({
    client_id: '',
    amount: 1,
    reason: '',
    reference_id: ''
  });
  
  // Formularios de órdenes
  const [buyOrderForm, setBuyOrderForm] = useState({
    tokenizedAssetId: '',
    clientId: '',
    tokenAmount: 1,
    paymentMethod: 'bank_transfer',
    notes: ''
  });
  
  const [sellOrderForm, setSellOrderForm] = useState({
    tokenizedAssetId: '',
    clientId: '',
    tokenAmount: 1,
    bankName: '',
    bankAccountType: 'savings',
    bankAccountNumber: '',
    bankCbuAlias: '',
    notes: ''
  });

  // ===========================================
  // CARGA DE DATOS
  // ===========================================

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [statusRes, statsRes, assetsRes, contractsRes, txRes, ordersRes, orderStatsRes, certsRes] = await Promise.all([
        api.get('/tokenization/status'),
        api.get('/tokenization/stats'),
        api.get('/tokenization/assets'),
        api.get('/tokenization/contracts'),
        api.get('/tokenization/transactions?limit=20'),
        api.get('/tokenization/orders?limit=50'),
        api.get('/tokenization/orders/stats'),
        api.get('/tokenization/certificates?status=active')
      ]);
      
      setBlockchainStatus(statusRes.data.data);
      setStats(statsRes.data.data.stats);
      setTokenizedAssets(assetsRes.data.data.tokenizedAssets || []);
      setContracts(contractsRes.data.data.contracts || []);
      setTransactions(txRes.data.data.transactions || []);
      setOrders(ordersRes.data.data.orders || []);
      setOrderStats(orderStatsRes.data.data);
      setCertificates(certsRes.data.data.certificates || []);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
      toast.error('Error al cargar datos de tokenización');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAvailableAssets = async () => {
    try {
      const [assetsRes, trustsRes, clientsRes] = await Promise.all([
        api.get('/assets?limit=100'),
        api.get('/trusts?limit=100'),
        api.get('/clients?limit=100')
      ]);
      
      setAvailableAssets(assetsRes.data.data.assets || []);
      setAvailableTrusts(trustsRes.data.data.trusts || []);
      setClients(clientsRes.data.data.clients || []);
      
      // Cargar unidades si hay activos
      if (assetsRes.data.data.assets?.length > 0) {
        const firstAsset = assetsRes.data.data.assets[0];
        const unitsRes = await api.get(`/assets/${firstAsset.id}/units`);
        setAvailableUnits(unitsRes.data.data.units || []);
      }
    } catch (error) {
      console.error('Error cargando recursos:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===========================================
  // HANDLERS
  // ===========================================

  const handleTokenize = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = {
        ...tokenizeForm,
        total_supply: parseInt(tokenizeForm.total_supply),
        token_price: parseFloat(tokenizeForm.token_price) || 0
      };
      
      // Limpiar campos no necesarios según el tipo
      if (payload.asset_type === 'asset') {
        delete payload.asset_unit_id;
        delete payload.trust_id;
      } else if (payload.asset_type === 'asset_unit') {
        delete payload.asset_id;
        delete payload.trust_id;
      } else if (payload.asset_type === 'trust') {
        delete payload.asset_id;
        delete payload.asset_unit_id;
      }
      
      const res = await api.post('/tokenization/assets', payload);
      
      toast.success(res.data.message || 'Activo tokenizado exitosamente');
      setShowTokenizeModal(false);
      loadData();
      
      // Resetear formulario
      setTokenizeForm({
        asset_type: 'asset',
        asset_id: '',
        asset_unit_id: '',
        trust_id: '',
        total_supply: 100,
        token_price: 0,
        token_name: '',
        token_symbol: ''
      });
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al tokenizar');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    if (!selectedAsset) return;
    
    setSubmitting(true);
    
    try {
      const res = await api.post(`/tokenization/assets/${selectedAsset.id}/transfer`, {
        ...transferForm,
        amount: parseInt(transferForm.amount)
      });
      
      toast.success(res.data.message || 'Tokens transferidos');
      setShowTransferModal(false);
      loadData();
      
      setTransferForm({
        client_id: '',
        amount: 1,
        reason: '',
        reference_id: ''
      });
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al transferir');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBurn = async (assetId, amount) => {
    if (!confirm(`¿Quemar ${amount} tokens? Esta acción es irreversible.`)) return;
    
    try {
      const res = await api.post(`/tokenization/assets/${assetId}/burn`, {
        amount: parseInt(amount),
        reason: 'Quema manual desde dashboard'
      });
      
      toast.success(res.data.message || 'Tokens quemados');
      loadData();
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al quemar tokens');
    }
  };

  const handleMintMore = async (assetId, amount) => {
    try {
      const res = await api.post(`/tokenization/assets/${assetId}/mint`, {
        amount: parseInt(amount),
        reason: 'Emisión adicional desde dashboard'
      });
      
      toast.success(res.data.message || 'Tokens emitidos');
      loadData();
      
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al emitir tokens');
    }
  };

  // Activar token (cambiar de draft a active)
  const handleActivate = async (assetId) => {
    try {
      const res = await api.post(`/tokenization/assets/${assetId}/activate`);
      toast.success(res.data.message || '¡Token activado! Ya está disponible para la venta.');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al activar token');
    }
  };

  // ===========================================
  // HANDLERS DE ÓRDENES
  // ===========================================

  const handleCreateBuyOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await api.post('/tokenization/orders/buy', buyOrderForm);
      toast.success(res.data.message || 'Orden de compra creada');
      setShowBuyOrderModal(false);
      loadData();
      setBuyOrderForm({
        tokenizedAssetId: '',
        clientId: '',
        tokenAmount: 1,
        paymentMethod: 'bank_transfer',
        notes: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear orden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSellOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const res = await api.post('/tokenization/orders/sell', sellOrderForm);
      toast.success(res.data.message || 'Orden de venta creada');
      setShowSellOrderModal(false);
      loadData();
      setSellOrderForm({
        tokenizedAssetId: '',
        clientId: '',
        tokenAmount: 1,
        bankName: '',
        bankAccountType: 'savings',
        bankAccountNumber: '',
        bankCbuAlias: '',
        notes: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al crear orden');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async (orderId) => {
    const reference = prompt('Ingrese la referencia del pago:');
    if (!reference) return;
    
    try {
      await api.post(`/tokenization/orders/${orderId}/confirm-payment`, {
        paymentReference: reference
      });
      toast.success('Pago confirmado');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al confirmar pago');
    }
  };

  const handleCompleteOrder = async (orderId) => {
    if (!confirm('¿Completar esta orden? Se transferirán los tokens y se generará el certificado.')) return;
    
    try {
      const res = await api.post(`/tokenization/orders/${orderId}/complete`);
      toast.success('Orden completada exitosamente');
      loadData();
      
      // Mostrar info del certificado generado
      if (res.data.data.certificate) {
        toast.success(`Certificado generado: ${res.data.data.certificate.certificate_number}`);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al completar orden');
    }
  };

  const handleCancelOrder = async (orderId) => {
    const reason = prompt('Razón de cancelación:');
    if (!reason) return;
    
    try {
      await api.post(`/tokenization/orders/${orderId}/cancel`, { reason });
      toast.success('Orden cancelada');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al cancelar orden');
    }
  };

  // ===========================================
  // HANDLERS DE CERTIFICADOS
  // ===========================================

  const handleViewCertificate = async (certId) => {
    try {
      const res = await api.get(`/tokenization/certificates/${certId}`);
      setSelectedCertificate(res.data.data);
      setShowCertificateModal(true);
    } catch (error) {
      toast.error('Error al cargar certificado');
    }
  };

  const handleDownloadCertificateHTML = async (certId) => {
    try {
      const res = await api.get(`/tokenization/certificates/${certId}/html`, {
        responseType: 'text'
      });
      
      // Abrir en nueva ventana para imprimir/guardar como PDF
      const printWindow = window.open('', '_blank');
      printWindow.document.write(res.data);
      printWindow.document.close();
      printWindow.focus();
      
      // Dar tiempo para que cargue y luego imprimir
      setTimeout(() => printWindow.print(), 500);
    } catch (error) {
      toast.error('Error al descargar certificado');
    }
  };

  const handleCertifyBlockchain = async (certId) => {
    if (!confirm('¿Anclar este certificado en blockchain? Esto tiene un pequeño costo de gas.')) return;
    
    try {
      const res = await api.post(`/tokenization/certificates/${certId}/certify-blockchain`);
      toast.success('Certificado anclado en blockchain');
      loadData();
      
      if (res.data.data.explorerLink) {
        window.open(res.data.data.explorerLink, '_blank');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error al certificar en blockchain');
    }
  };

  const openTokenizeModal = () => {
    loadAvailableAssets();
    setShowTokenizeModal(true);
  };

  const openTransferModal = (asset) => {
    setSelectedAsset(asset);
    loadAvailableAssets();
    setShowTransferModal(true);
  };

  const openDetailModal = async (asset) => {
    try {
      const res = await api.get(`/tokenization/assets/${asset.id}`);
      setSelectedAsset(res.data.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Error al cargar detalle');
    }
  };

  // ===========================================
  // RENDER: Estado de Blockchain
  // ===========================================

  const renderBlockchainStatus = () => {
    if (!blockchainStatus) return null;
    
    const { isConfigured, networkInfo, walletBalance, errors } = blockchainStatus;
    
    return (
      <div className={`rounded-lg p-4 mb-6 ${isConfigured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${isConfigured ? 'bg-green-100' : 'bg-yellow-100'}`}>
              {isConfigured ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-yellow-600" />
              )}
            </div>
            <div>
              <p className={`font-medium ${isConfigured ? 'text-green-800' : 'text-yellow-800'}`}>
                {isConfigured ? 'Blockchain Conectada' : 'Blockchain No Configurada'}
              </p>
              {networkInfo && (
                <p className="text-sm text-gray-600">
                  {networkInfo.name} {networkInfo.isTestnet && '(Testnet)'}
                </p>
              )}
            </div>
          </div>
          
          {walletBalance && (
            <div className="text-right">
              <p className="text-sm text-gray-500">Balance Wallet Admin</p>
              <p className="font-mono font-medium">
                {walletBalance.displayValue} {walletBalance.symbol}
              </p>
            </div>
          )}
        </div>
        
        {errors?.length > 0 && (
          <div className="mt-3 text-sm text-yellow-700">
            <p className="font-medium">Configuración pendiente:</p>
            <ul className="list-disc list-inside">
              {errors.map((err, i) => <li key={i}>{err}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  };

  // ===========================================
  // RENDER: Estadísticas
  // ===========================================

  const renderStats = () => {
    if (!stats) return null;
    
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Layers className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Activos Tokenizados</p>
              <p className="text-xl font-bold">{formatNumber(stats.total_tokenized)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Coins className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Tokens Emitidos</p>
              <p className="text-xl font-bold">{formatNumber(stats.total_tokens_issued)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">En Circulación</p>
              <p className="text-xl font-bold">{formatNumber(stats.tokens_in_circulation)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Valor Total</p>
              <p className="text-xl font-bold">{formatCurrency(stats.total_value)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ===========================================
  // RENDER: Lista de Activos Tokenizados
  // ===========================================

  const renderAssetsList = () => {
    if (tokenizedAssets.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-lg border">
          <Coins className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Sin activos tokenizados</h3>
          <p className="text-gray-500 mb-4">Comienza tokenizando tu primer activo</p>
          <button
            onClick={openTokenizeModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Tokenizar Activo
          </button>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Activo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Supply
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Precio/Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Estado
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tokenizedAssets.map((asset) => {
              const StatusIcon = STATUS_LABELS[asset.status]?.icon || Clock;
              const TypeIcon = ASSET_TYPE_ICONS[asset.asset_type] || Layers;
              
              return (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Coins className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{asset.token_name}</p>
                        <p className="text-sm text-gray-500 font-mono">{asset.token_symbol}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-900">{asset.source_name}</p>
                        <p className="text-xs text-gray-500">
                          {ASSET_TYPE_LABELS[asset.asset_type]} • {asset.source_code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="text-sm font-medium">{formatNumber(asset.total_supply)}</p>
                      <p className="text-xs text-gray-500">
                        {formatNumber(asset.fideitec_balance)} disponibles
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium">
                      {formatCurrency(asset.token_price, asset.currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Total: {formatCurrency(asset.total_value, asset.currency)}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${STATUS_LABELS[asset.status]?.color || 'bg-gray-100'}`}>
                      {STATUS_LABELS[asset.status]?.label || asset.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openDetailModal(asset)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {asset.status === 'draft' && (
                        <button
                          onClick={() => handleActivate(asset.id)}
                          className="p-2 hover:bg-green-100 rounded-lg text-green-600"
                          title="Activar token"
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      )}
                      {asset.status === 'active' && asset.fideitec_balance > 0 && (
                        <button
                          onClick={() => openTransferModal(asset)}
                          className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                          title="Transferir/Endosar"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ===========================================
  // RENDER: Lista de Órdenes
  // ===========================================

  const ORDER_STATUS_LABELS = {
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    payment_pending: { label: 'Pago Pendiente', color: 'bg-orange-100 text-orange-700' },
    payment_received: { label: 'Pago Recibido', color: 'bg-blue-100 text-blue-700' },
    processing: { label: 'Procesando', color: 'bg-purple-100 text-purple-700' },
    completed: { label: 'Completada', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-700' },
    refunded: { label: 'Reembolsada', color: 'bg-red-100 text-red-700' }
  };

  const renderOrders = () => {
    return (
      <div className="space-y-4">
        {/* Stats de órdenes */}
        {orderStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">{orderStats.pending_orders || 0}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">Por Procesar</p>
              <p className="text-2xl font-bold text-blue-600">{orderStats.pending_processing || 0}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">Volumen Compras</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(orderStats.total_buy_volume || 0, 'ARS')}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">Completadas</p>
              <p className="text-2xl font-bold">{orderStats.completed_orders || 0}</p>
            </div>
          </div>
        )}
        
        {/* Botones de acción */}
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => {
              loadAvailableAssets();
              setShowBuyOrderModal(true);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Nueva Compra
          </button>
          <button
            onClick={() => {
              loadAvailableAssets();
              setShowSellOrderModal(true);
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Nueva Venta
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Sin órdenes</h3>
            <p className="text-gray-500">Crea una orden de compra o venta</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orden</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-mono text-sm font-medium">{order.order_number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.submitted_at).toLocaleDateString('es-AR')}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        order.order_type === 'buy' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {order.order_type === 'buy' ? 'Compra' : 'Venta'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium">{order.client_full_name}</p>
                      <p className="text-xs text-gray-500">{order.client_email}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm">{order.token_name}</p>
                      <p className="text-xs text-gray-500 font-mono">{order.token_symbol}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium">{formatNumber(order.token_amount)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="text-sm font-medium">{formatCurrency(order.total_amount, order.currency)}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        ORDER_STATUS_LABELS[order.status]?.color || 'bg-gray-100'
                      }`}>
                        {ORDER_STATUS_LABELS[order.status]?.label || order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {order.status === 'pending' && (
                          <button
                            onClick={() => handleConfirmPayment(order.id)}
                            className="p-2 hover:bg-blue-100 rounded text-blue-600 text-xs"
                            title="Confirmar pago"
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        {order.status === 'payment_received' && (
                          <button
                            onClick={() => handleCompleteOrder(order.id)}
                            className="p-2 hover:bg-green-100 rounded text-green-600 text-xs"
                            title="Completar orden"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {['pending', 'payment_pending'].includes(order.status) && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="p-2 hover:bg-red-100 rounded text-red-600 text-xs"
                            title="Cancelar"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ===========================================
  // RENDER: Lista de Certificados
  // ===========================================

  const renderCertificates = () => {
    return (
      <div className="space-y-4">
        {certificates.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Sin certificados</h3>
            <p className="text-gray-500">Los certificados se generan al completar órdenes de compra</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${cert.is_blockchain_certified ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {cert.is_blockchain_certified ? (
                        <ShieldCheck className="w-5 h-5 text-green-600" />
                      ) : (
                        <FileText className="w-5 h-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="font-mono text-sm font-medium">{cert.certificate_number}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(cert.issued_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>
                  {cert.is_blockchain_certified && (
                    <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                      Blockchain ✓
                    </span>
                  )}
                </div>
                
                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium">{cert.beneficiary_name}</p>
                  <p className="text-xs text-gray-500">
                    {cert.token_amount} tokens de {cert.token_name}
                  </p>
                  <p className="text-sm font-bold">
                    {formatCurrency(cert.total_value_at_issue, cert.currency)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 pt-3 border-t">
                  <button
                    onClick={() => handleViewCertificate(cert.id)}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                    Ver
                  </button>
                  <button
                    onClick={() => handleDownloadCertificateHTML(cert.id)}
                    className="flex-1 px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded flex items-center justify-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                  {!cert.is_blockchain_certified && blockchainStatus?.isConfigured && (
                    <button
                      onClick={() => handleCertifyBlockchain(cert.id)}
                      className="px-3 py-1.5 text-sm bg-green-100 hover:bg-green-200 text-green-700 rounded flex items-center justify-center gap-1"
                      title="Certificar en Blockchain"
                    >
                      <Link2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ===========================================
  // RENDER: Historial de Transacciones
  // ===========================================

  const renderTransactions = () => {
    if (transactions.length === 0) {
      return (
        <div className="text-center py-12 bg-white rounded-lg border">
          <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Sin transacciones</h3>
          <p className="text-gray-500">Las transacciones aparecerán aquí</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Token
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cantidad
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                De / A
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                TX Hash
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => {
              const TxIcon = TX_TYPE_LABELS[tx.transaction_type]?.icon || ArrowRightLeft;
              
              return (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full ${TX_TYPE_LABELS[tx.transaction_type]?.color || 'bg-gray-100'}`}>
                      <TxIcon className="w-3 h-3" />
                      {TX_TYPE_LABELS[tx.transaction_type]?.label || tx.transaction_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium">{tx.token_name}</p>
                    <p className="text-xs text-gray-500">{tx.token_symbol}</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="text-sm font-medium">{formatNumber(tx.amount)}</p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(tx.amount_value, tx.currency)}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      {tx.from_address && (
                        <p className="font-mono text-xs text-gray-500">
                          De: {formatAddress(tx.from_address)}
                        </p>
                      )}
                      {tx.to_address && (
                        <p className="font-mono text-xs text-gray-500">
                          A: {formatAddress(tx.to_address)}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tx.tx_hash ? (
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-blue-600">
                          {formatAddress(tx.tx_hash)}
                        </span>
                        <CopyButton text={tx.tx_hash} />
                        <a
                          href={`https://basescan.org/tx/${tx.tx_hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tx.created_at).toLocaleString('es-AR')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ===========================================
  // RENDER: Modal Tokenizar
  // ===========================================

  const renderTokenizeModal = () => {
    if (!showTokenizeModal) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Tokenizar Activo</h2>
            <p className="text-sm text-gray-500">Crear tokens para representar un activo o fideicomiso</p>
          </div>
          
          <form onSubmit={handleTokenize} className="p-6 space-y-4">
            {/* Info de blockchain */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-800">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">Los certificados se anclarán en Base Mainnet</span>
              </div>
            </div>
            
            {/* Tipo de activo */}
            <div>
              <label className="block text-sm font-medium mb-1">Tipo de Activo *</label>
              <select
                value={tokenizeForm.asset_type}
                onChange={(e) => setTokenizeForm({...tokenizeForm, asset_type: e.target.value, asset_id: '', asset_unit_id: '', trust_id: ''})}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="asset">Activo</option>
                <option value="asset_unit">Unidad de Activo</option>
                <option value="trust">Fideicomiso</option>
              </select>
            </div>
            
            {/* Selector según tipo */}
            {tokenizeForm.asset_type === 'asset' && (
              <div>
                <label className="block text-sm font-medium mb-1">Activo *</label>
                <select
                  value={tokenizeForm.asset_id}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, asset_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar activo</option>
                  {availableAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.code || 'Sin código'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {tokenizeForm.asset_type === 'asset_unit' && (
              <div>
                <label className="block text-sm font-medium mb-1">Unidad *</label>
                <select
                  value={tokenizeForm.asset_unit_id}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, asset_unit_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar unidad</option>
                  {availableUnits.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.unit_name || u.unit_code}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {tokenizeForm.asset_type === 'trust' && (
              <div>
                <label className="block text-sm font-medium mb-1">Fideicomiso *</label>
                <select
                  value={tokenizeForm.trust_id}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, trust_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar fideicomiso</option>
                  {availableTrusts.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code || 'Sin código'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* Cantidad de tokens */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad de Tokens *</label>
                <input
                  type="number"
                  min="1"
                  value={tokenizeForm.total_supply}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, total_supply: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Precio por Token (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tokenizeForm.token_price}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, token_price: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Nombre y símbolo */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre del Token</label>
                <input
                  type="text"
                  value={tokenizeForm.token_name}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, token_name: e.target.value})}
                  placeholder="Ej: Token Edificio Central"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Símbolo</label>
                <input
                  type="text"
                  maxLength="10"
                  value={tokenizeForm.token_symbol}
                  onChange={(e) => setTokenizeForm({...tokenizeForm, token_symbol: e.target.value.toUpperCase()})}
                  placeholder="Ej: FDT001"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowTokenizeModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Procesando...' : 'Tokenizar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ===========================================
  // RENDER: Modal Transferir
  // ===========================================

  const renderTransferModal = () => {
    if (!showTransferModal || !selectedAsset) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-lg w-full">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold">Endosar Tokens</h2>
            <p className="text-sm text-gray-500">
              Transferir tokens de {selectedAsset.token_name} a un cliente
            </p>
          </div>
          
          <form onSubmit={handleTransfer} className="p-6 space-y-4">
            {/* Info del token */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Tokens disponibles</span>
                <span className="font-bold">{formatNumber(selectedAsset.fideitec_balance)}</span>
              </div>
            </div>
            
            {/* Cliente */}
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <select
                value={transferForm.client_id}
                onChange={(e) => setTransferForm({...transferForm, client_id: e.target.value})}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar cliente</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            
            {/* Cantidad */}
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad de Tokens *</label>
              <input
                type="number"
                min="1"
                max={selectedAsset.fideitec_balance}
                value={transferForm.amount}
                onChange={(e) => setTransferForm({...transferForm, amount: e.target.value})}
                required
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Valor: {formatCurrency(transferForm.amount * selectedAsset.token_price)}
              </p>
            </div>
            
            {/* Razón */}
            <div>
              <label className="block text-sm font-medium mb-1">Motivo</label>
              <input
                type="text"
                value={transferForm.reason}
                onChange={(e) => setTransferForm({...transferForm, reason: e.target.value})}
                placeholder="Ej: Inversión inicial"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Referencia */}
            <div>
              <label className="block text-sm font-medium mb-1">Referencia</label>
              <input
                type="text"
                value={transferForm.reference_id}
                onChange={(e) => setTransferForm({...transferForm, reference_id: e.target.value})}
                placeholder="Ej: OP-2024-001"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Botones */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !transferForm.client_id}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Procesando...' : 'Transferir'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ===========================================
  // RENDER: Modal Detalle
  // ===========================================

  const renderDetailModal = () => {
    if (!showDetailModal || !selectedAsset) return null;
    
    const { tokenizedAsset, holders, recentTransactions } = selectedAsset;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{tokenizedAsset?.token_name}</h2>
              <p className="text-sm text-gray-500 font-mono">{tokenizedAsset?.token_symbol}</p>
            </div>
            <button
              onClick={() => setShowDetailModal(false)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              ✕
            </button>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Supply Total</p>
                <p className="text-lg font-bold">{formatNumber(tokenizedAsset?.total_supply)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Disponibles (Fideitec)</p>
                <p className="text-lg font-bold text-green-700">{formatNumber(tokenizedAsset?.fideitec_balance)}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">En Circulación</p>
                <p className="text-lg font-bold text-blue-700">{formatNumber(tokenizedAsset?.circulating_supply)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">Quemados</p>
                <p className="text-lg font-bold text-red-700">{formatNumber(tokenizedAsset?.burned_supply)}</p>
              </div>
            </div>
            
            {/* Holders */}
            {holders?.length > 0 && (
              <div>
                <h3 className="font-medium mb-3">Poseedores de Tokens</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Poseedor</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Tipo</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Balance</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {holders.map(h => (
                        <tr key={h.id}>
                          <td className="px-4 py-2 text-sm">{h.holder_name}</td>
                          <td className="px-4 py-2 text-sm text-gray-500">{h.holder_type}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{formatNumber(h.balance)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(h.balance_value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Acciones rápidas */}
            {tokenizedAsset?.status === 'active' && tokenizedAsset?.fideitec_balance > 0 && (
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowDetailModal(false);
                    openTransferModal(tokenizedAsset);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Endosar
                </button>
                <button
                  onClick={() => {
                    const amount = prompt('¿Cuántos tokens emitir?');
                    if (amount) handleMintMore(tokenizedAsset.id, amount);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Emitir Más
                </button>
                <button
                  onClick={() => {
                    const amount = prompt(`¿Cuántos tokens quemar? (máx ${tokenizedAsset.fideitec_balance})`);
                    if (amount) handleBurn(tokenizedAsset.id, amount);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                >
                  <Flame className="w-4 h-4" />
                  Quemar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ===========================================
  // RENDER PRINCIPAL
  // ===========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tokenización</h1>
          <p className="text-gray-500">Gestiona tokens y certificados de activos en Base Mainnet</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHelpModal(true)}
            className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
            title="¿Cómo funciona la tokenización?"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            onClick={loadData}
            className="p-2 hover:bg-gray-100 rounded-lg"
            title="Actualizar"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          {blockchainStatus?.isConfigured && (
            <button
              onClick={openTokenizeModal}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Tokenizar
            </button>
          )}
        </div>
      </div>

      {/* Estado de Blockchain */}
      {renderBlockchainStatus()}
      
      {/* Estadísticas */}
      {renderStats()}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('assets')}
            className={`pb-3 px-1 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'assets'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Coins className="w-4 h-4 inline mr-2" />
            Activos
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-1 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShoppingCart className="w-4 h-4 inline mr-2" />
            Órdenes
            {orderStats?.pending_orders > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                {orderStats.pending_orders}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('certificates')}
            className={`pb-3 px-1 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'certificates'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Certificados
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`pb-3 px-1 border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'transactions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Historial
          </button>
        </nav>
      </div>

      {/* Contenido según tab */}
      {activeTab === 'assets' && renderAssetsList()}
      {activeTab === 'orders' && renderOrders()}
      {activeTab === 'certificates' && renderCertificates()}
      {activeTab === 'transactions' && renderTransactions()}

      {/* Modales */}
      {renderTokenizeModal()}
      {renderTransferModal()}
      {renderDetailModal()}
      
      {/* Modal Registrar Contrato eliminado - Sistema migrado a certificación directa en Base Mainnet */}

      {/* Modal Crear Orden de Compra */}
      {showBuyOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-green-600" />
                Nueva Orden de Compra
              </h2>
              <p className="text-sm text-gray-500">Cliente compra tokens, paga con dinero real</p>
            </div>
            
            <form onSubmit={handleCreateBuyOrder} className="p-6 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                <select
                  value={buyOrderForm.clientId}
                  onChange={(e) => setBuyOrderForm({...buyOrderForm, clientId: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Activo tokenizado */}
              <div>
                <label className="block text-sm font-medium mb-1">Token a Comprar *</label>
                <select
                  value={buyOrderForm.tokenizedAssetId}
                  onChange={(e) => setBuyOrderForm({...buyOrderForm, tokenizedAssetId: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Seleccionar token</option>
                  {tokenizedAssets.filter(a => a.fideitec_balance > 0).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.token_name} ({a.fideitec_balance} disponibles) - {formatCurrency(a.token_price)}/token
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Cantidad */}
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad de Tokens *</label>
                <input
                  type="number"
                  min="1"
                  value={buyOrderForm.tokenAmount}
                  onChange={(e) => setBuyOrderForm({...buyOrderForm, tokenAmount: parseInt(e.target.value) || 1})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
                {buyOrderForm.tokenizedAssetId && (
                  <p className="text-sm text-gray-500 mt-1">
                    Total estimado: {formatCurrency(
                      buyOrderForm.tokenAmount * (tokenizedAssets.find(a => a.id === buyOrderForm.tokenizedAssetId)?.token_price || 0)
                    )}
                  </p>
                )}
              </div>
              
              {/* Método de pago */}
              <div>
                <label className="block text-sm font-medium mb-1">Método de Pago</label>
                <select
                  value={buyOrderForm.paymentMethod}
                  onChange={(e) => setBuyOrderForm({...buyOrderForm, paymentMethod: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                >
                  <option value="bank_transfer">Transferencia Bancaria</option>
                  <option value="mercadopago">MercadoPago</option>
                  <option value="cash">Efectivo</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>
              
              {/* Notas */}
              <div>
                <label className="block text-sm font-medium mb-1">Notas</label>
                <textarea
                  value={buyOrderForm.notes}
                  onChange={(e) => setBuyOrderForm({...buyOrderForm, notes: e.target.value})}
                  rows={2}
                  placeholder="Notas adicionales..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              
              <div className="bg-green-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-green-800 mb-2">Flujo de compra:</p>
                <ol className="list-decimal list-inside text-green-700 space-y-1">
                  <li>Se crea la orden</li>
                  <li>Cliente realiza el pago</li>
                  <li>Se confirma recepción del pago</li>
                  <li>Se completa la orden (transfiere tokens + genera certificado)</li>
                </ol>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowBuyOrderModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !buyOrderForm.clientId || !buyOrderForm.tokenizedAssetId}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear Orden de Venta */}
      {showSellOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-orange-600" />
                Nueva Orden de Venta
              </h2>
              <p className="text-sm text-gray-500">Cliente vende tokens, recibe dinero real</p>
            </div>
            
            <form onSubmit={handleCreateSellOrder} className="p-6 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium mb-1">Cliente *</label>
                <select
                  value={sellOrderForm.clientId}
                  onChange={(e) => setSellOrderForm({...sellOrderForm, clientId: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Seleccionar cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.first_name} {c.last_name} ({c.email})
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Token a vender */}
              <div>
                <label className="block text-sm font-medium mb-1">Token a Vender *</label>
                <select
                  value={sellOrderForm.tokenizedAssetId}
                  onChange={(e) => setSellOrderForm({...sellOrderForm, tokenizedAssetId: e.target.value})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Seleccionar token</option>
                  {tokenizedAssets.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.token_name} - {formatCurrency(a.token_price)}/token
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Cantidad */}
              <div>
                <label className="block text-sm font-medium mb-1">Cantidad de Tokens *</label>
                <input
                  type="number"
                  min="1"
                  value={sellOrderForm.tokenAmount}
                  onChange={(e) => setSellOrderForm({...sellOrderForm, tokenAmount: parseInt(e.target.value) || 1})}
                  required
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              
              {/* Datos bancarios */}
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <p className="font-medium text-sm">Datos para el pago:</p>
                <div>
                  <label className="block text-xs font-medium mb-1">Banco</label>
                  <input
                    type="text"
                    value={sellOrderForm.bankName}
                    onChange={(e) => setSellOrderForm({...sellOrderForm, bankName: e.target.value})}
                    placeholder="Ej: Banco Galicia"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tipo de cuenta</label>
                    <select
                      value={sellOrderForm.bankAccountType}
                      onChange={(e) => setSellOrderForm({...sellOrderForm, bankAccountType: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    >
                      <option value="savings">Caja de ahorro</option>
                      <option value="checking">Cuenta corriente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">N° de cuenta</label>
                    <input
                      type="text"
                      value={sellOrderForm.bankAccountNumber}
                      onChange={(e) => setSellOrderForm({...sellOrderForm, bankAccountNumber: e.target.value})}
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">CBU / Alias</label>
                  <input
                    type="text"
                    value={sellOrderForm.bankCbuAlias}
                    onChange={(e) => setSellOrderForm({...sellOrderForm, bankCbuAlias: e.target.value})}
                    placeholder="CBU o Alias de cuenta"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSellOrderModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !sellOrderForm.clientId || !sellOrderForm.tokenizedAssetId}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {submitting ? 'Creando...' : 'Crear Orden'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ver Certificado */}
      {showCertificateModal && selectedCertificate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold">{selectedCertificate.certificate_number}</h2>
                <p className="text-sm text-gray-500">Certificado de Posesión de Tokens</p>
              </div>
              <button
                onClick={() => setShowCertificateModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Estado blockchain */}
              <div className={`p-4 rounded-lg ${
                selectedCertificate.is_blockchain_certified 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-center gap-3">
                  {selectedCertificate.is_blockchain_certified ? (
                    <>
                      <ShieldCheck className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-medium text-green-800">Certificado en Blockchain</p>
                        <p className="text-xs text-green-600 font-mono">
                          TX: {selectedCertificate.blockchain_tx_hash}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-6 h-6 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-700">Pendiente de certificación blockchain</p>
                        <p className="text-xs text-gray-500">
                          Este certificado aún no ha sido anclado en blockchain
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              
              {/* Información del certificado */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Beneficiario</h3>
                  <p className="font-medium">{selectedCertificate.beneficiary_name}</p>
                  <p className="text-sm text-gray-500">
                    {selectedCertificate.beneficiary_document_type}: {selectedCertificate.beneficiary_document_number}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Token</h3>
                  <p className="font-medium">{selectedCertificate.token_name}</p>
                  <p className="text-sm text-gray-500 font-mono">{selectedCertificate.token_symbol}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Cantidad</h3>
                  <p className="text-2xl font-bold">{formatNumber(selectedCertificate.token_amount)}</p>
                  <p className="text-sm text-gray-500">cuotas partes</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Valor Total</h3>
                  <p className="text-2xl font-bold">
                    {formatCurrency(selectedCertificate.total_value_at_issue, selectedCertificate.currency)}
                  </p>
                  <p className="text-sm text-gray-500">al momento de emisión</p>
                </div>
              </div>
              
              {/* Verificación */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  Código de Verificación
                </h3>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-white p-2 rounded border font-mono break-all">
                    {selectedCertificate.verification_code}
                  </code>
                  <CopyButton text={selectedCertificate.verification_code} />
                </div>
              </div>
              
              {/* Acciones */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => handleDownloadCertificateHTML(selectedCertificate.id)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Descargar PDF
                </button>
                {!selectedCertificate.is_blockchain_certified && blockchainStatus?.isConfigured && (
                  <button
                    onClick={() => {
                      setShowCertificateModal(false);
                      handleCertifyBlockchain(selectedCertificate.id);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Link2 className="w-4 h-4" />
                    Certificar en Blockchain
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Ayuda */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">¿Cómo funciona la Tokenización?</h2>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 text-gray-700">
              {/* Qué es */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">¿Qué es tokenizar?</h3>
                <p>
                  Tokenizar es dividir un bien (un inmueble, un fideicomiso, un terreno) en <strong>partes iguales digitales</strong> llamadas <strong>tokens</strong> o <strong>cuotas partes</strong>.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-3">
                  <p className="text-sm text-blue-800">
                    <strong>Ejemplo:</strong> Si tenés un departamento valuado en USD 100.000 y lo tokenizás en 1.000 tokens, cada token vale USD 100 y representa una fracción del departamento.
                  </p>
                </div>
              </div>

              {/* Pasos */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">El proceso paso a paso</h3>
                
                <div className="space-y-4">
                  {/* Paso 1 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Cargar el activo</h4>
                      <p className="text-sm mt-1">
                        Primero registrá el bien en el sistema desde el módulo de <strong>Activos</strong> o <strong>Fideicomisos</strong>. Completá los datos: nombre, descripción, ubicación, valor, etc.
                      </p>
                    </div>
                  </div>

                  {/* Paso 2 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Tokenizar</h4>
                      <p className="text-sm mt-1">
                        Desde este módulo, hacé clic en <strong>"Tokenizar"</strong> y elegí qué activo querés fraccionar, en cuántas partes (tokens), qué precio le ponés a cada parte, y un nombre y código identificatorio.
                      </p>
                      <p className="text-sm mt-1 text-gray-500">
                        En este momento, todos los tokens quedan en poder de tu empresa. Todavía no se vendió nada.
                      </p>
                    </div>
                  </div>

                  {/* Paso 3 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Vender tokens a clientes</h4>
                      <p className="text-sm mt-1">
                        Cuando un cliente quiere invertir, se crea una <strong>Orden de Compra</strong> desde la pestaña "Órdenes". El cliente elige la cantidad de tokens que quiere comprar y realiza el pago. Una vez que confirmás la recepción del pago, se completa la orden y los tokens pasan al balance del cliente.
                      </p>
                    </div>
                  </div>

                  {/* Paso 4 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Se genera el Certificado</h4>
                      <p className="text-sm mt-1">
                        Al completar una venta, el sistema genera automáticamente un <strong>Certificado de Posesión de Cuotas Partes</strong> con los datos del inversor, la cantidad de tokens, el valor y un código de verificación único. Se puede descargar en PDF.
                      </p>
                    </div>
                  </div>

                  {/* Paso 5 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">5</div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Registro en Blockchain</h4>
                      <p className="text-sm mt-1">
                        Cada certificado puede registrarse en <strong>blockchain</strong> (Base Mainnet). Esto graba una huella digital del certificado de forma permanente e inalterable en una red pública, para que cualquiera pueda verificar que es auténtico y no fue modificado.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dónde se guarda */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">¿Qué queda grabado y dónde?</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Información</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dónde se guarda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                      <tr>
                        <td className="px-4 py-2">Datos del activo</td>
                        <td className="px-4 py-2 text-gray-500">Base de datos FIDEITEC</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Tokens y balances</td>
                        <td className="px-4 py-2 text-gray-500">Base de datos FIDEITEC</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Órdenes de compra/venta</td>
                        <td className="px-4 py-2 text-gray-500">Base de datos FIDEITEC</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2">Certificados (PDF)</td>
                        <td className="px-4 py-2 text-gray-500">Base de datos FIDEITEC</td>
                      </tr>
                      <tr className="bg-green-50">
                        <td className="px-4 py-2 font-medium">Huella digital del certificado</td>
                        <td className="px-4 py-2 text-green-700 font-medium">Blockchain (público y permanente)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Resumen */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-2">En resumen</h3>
                <p className="text-sm">
                  Todo el proceso de gestión (quién tiene cuántos tokens, a qué precio, cuándo compró) se maneja dentro de FIDEITEC. Blockchain se usa como <strong>sello de autenticidad</strong> de cada certificado emitido, garantizando que no pueda ser alterado.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tokenization;

