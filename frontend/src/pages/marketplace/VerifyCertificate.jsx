import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Shield, Search, CheckCircle2, XCircle, Loader2, 
  ExternalLink, Hash, Calendar, User, FileText, 
  Coins, ShieldCheck, AlertTriangle, ArrowRight
} from 'lucide-react';
import api from '../../api/axios';

const EXPLORER_URLS = {
  'base': 'https://basescan.org/tx/',
  'base-sepolia': 'https://sepolia.basescan.org/tx/',
  'polygon': 'https://polygonscan.com/tx/',
  'mumbai': 'https://mumbai.polygonscan.com/tx/',
  'ethereum': 'https://etherscan.io/tx/'
};

const VerifyCertificate = () => {
  const { code: urlCode } = useParams();
  const [searchType, setSearchType] = useState('code');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Auto-verify if code is in URL (e.g., from QR code)
  useEffect(() => {
    if (urlCode) {
      setSearchValue(urlCode);
      setSearchType('code');
      verifyCode(urlCode);
    }
  }, [urlCode]);

  const verifyCode = async (code) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await api.get(`/marketplace/verify/${code}`);
      if (response.data.success) {
        setResult(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al verificar. Revisá el código ingresado.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint = searchType === 'code' 
        ? `/marketplace/verify/${searchValue.trim()}`
        : `/marketplace/verify-tx/${searchValue.trim()}`;

      const response = await api.get(endpoint);
      if (response.data.success) {
        setResult(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error al verificar. Revisá el código ingresado.');
    } finally {
      setLoading(false);
    }
  };

  const getExplorerUrl = (txHash, network) => {
    const base = EXPLORER_URLS[network] || EXPLORER_URLS['base'];
    return `${base}${txHash}`;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Verificacion de Certificados
        </h1>
        <p className="text-gray-500 max-w-lg mx-auto">
          Verificá la autenticidad de un certificado digital de FIDEITEC.
          Los certificados están anclados en blockchain para garantizar su inmutabilidad.
        </p>
      </div>

      {/* Search form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        {/* Toggle search type */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => { setSearchType('code'); setResult(null); setError(null); }}
            className={`flex-1 text-sm font-medium py-2 px-4 rounded-md transition-all ${
              searchType === 'code' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Código de Verificación
          </button>
          <button
            onClick={() => { setSearchType('tx'); setResult(null); setError(null); }}
            className={`flex-1 text-sm font-medium py-2 px-4 rounded-md transition-all ${
              searchType === 'tx' 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Hash de Transacción (Blockchain)
          </button>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchType === 'code' 
                ? 'Ingresá el código de verificación del certificado...'
                : 'Ingresá el hash de la transacción (0x...)'}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchValue.trim()}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            Verificar
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-800">Certificado no encontrado</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-6">
          {/* Success banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <h3 className="text-lg font-bold text-green-800">Certificado Verificado</h3>
                <p className="text-sm text-green-600">
                  Este certificado es autentico y fue emitido por FIDEITEC.
                </p>
              </div>
            </div>
          </div>

          {/* Certificate details */}
          {result.certificate && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Datos del Certificado
                </h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Numero de Certificado</p>
                      <p className="font-semibold text-gray-900 font-mono">{result.certificate.number}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Titulo</p>
                      <p className="font-medium text-gray-900">{result.certificate.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Beneficiario</p>
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        {result.certificate.beneficiary}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Activo</p>
                      <p className="font-medium text-gray-900">{result.certificate.assetName}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Tokens</p>
                      <p className="font-semibold text-gray-900 flex items-center gap-2">
                        <Coins className="w-4 h-4 text-blue-600" />
                        {result.certificate.tokenAmount} {result.certificate.tokenSymbol}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Valor al momento de emision</p>
                      <p className="font-medium text-gray-900">
                        {result.certificate.totalValue 
                          ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: result.certificate.currency || 'USD' }).format(result.certificate.totalValue)
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Fecha de Emision</p>
                      <p className="font-medium text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(result.certificate.issuedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-medium mb-1">Estado</p>
                      <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                        result.certificate.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : result.certificate.status === 'revoked'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {result.certificate.status === 'active' ? 'Activo' 
                          : result.certificate.status === 'revoked' ? 'Revocado' 
                          : result.certificate.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Blockchain verification */}
          {result.blockchain && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Verificacion en Blockchain
                </h2>
              </div>
              <div className="p-6">
                {result.blockchain.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-medium text-sm">
                        Datos verificados e inmutables en la blockchain
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-medium mb-1">Hash de Transaccion</p>
                        <p className="font-mono text-sm text-gray-900 break-all">
                          {result.blockchain.txHash || result.certificate?.blockchainTxHash}
                        </p>
                      </div>
                      {result.blockchain.blockNumber && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Numero de Bloque</p>
                          <p className="font-mono font-semibold text-gray-900">
                            #{result.blockchain.blockNumber}
                          </p>
                        </div>
                      )}
                      {result.blockchain.blockTimestamp && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Timestamp del Bloque</p>
                          <p className="text-sm text-gray-900">
                            {formatDate(result.blockchain.blockTimestamp)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Payload data */}
                    {result.blockchain.payload && result.blockchain.payload.type === 'FIDEITEC_CERTIFICATE' && (
                      <div className="bg-gray-50 rounded-lg p-4 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Datos anclados en blockchain:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">Certificado:</span>{' '}
                            <span className="font-mono">{result.blockchain.payload.certificateNumber}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Hash del documento:</span>{' '}
                            <span className="font-mono text-xs break-all">{result.blockchain.payload.hash}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Emisor:</span>{' '}
                            <span className="font-semibold">{result.blockchain.payload.issuer}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Timestamp:</span>{' '}
                            <span>{formatDate(result.blockchain.payload.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Explorer link */}
                    {(result.blockchain.explorerLink || result.certificate?.blockchainTxHash) && (
                      <a
                        href={result.blockchain.explorerLink || getExplorerUrl(result.certificate.blockchainTxHash, 'base')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
                      >
                        Ver en el explorador de blockchain
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-amber-700 bg-amber-50 p-4 rounded-lg">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm">
                      {result.blockchain.message || 'No se pudo verificar la transaccion en blockchain en este momento.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info section */}
      {!result && !error && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Hash className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Hash inmutable</h3>
            <p className="text-sm text-gray-500">
              Cada certificado tiene un hash SHA-256 unico que se ancla en la blockchain.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Verificacion publica</h3>
            <p className="text-sm text-gray-500">
              Cualquier persona puede verificar la autenticidad de un certificado sin necesidad de cuenta.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <ExternalLink className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Transparencia total</h3>
            <p className="text-sm text-gray-500">
              Los datos se pueden verificar directamente en el explorador de blockchain (Base).
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerifyCertificate;
