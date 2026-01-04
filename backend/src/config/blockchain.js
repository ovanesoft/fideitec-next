/**
 * FIDEITEC - Configuración de Blockchain (Thirdweb v5 + Polygon)
 * 
 * Este módulo configura la conexión con Polygon usando Thirdweb SDK v5.
 * Soporta múltiples redes para fácil migración futura (Base, Ethereum, etc.)
 */

const { createThirdwebClient, getContract } = require('thirdweb');
const { privateKeyToAccount } = require('thirdweb/wallets');
const { polygon, polygonAmoy, base, baseSepolia } = require('thirdweb/chains');

// ===========================================
// Configuración de Redes
// ===========================================

const NETWORKS = {
  // Mainnet
  polygon: {
    chain: polygon,
    name: 'Polygon Mainnet',
    explorer: 'https://polygonscan.com',
    isTestnet: false
  },
  base: {
    chain: base,
    name: 'Base Mainnet',
    explorer: 'https://basescan.org',
    isTestnet: false
  },
  
  // Testnets
  'polygon-amoy': {
    chain: polygonAmoy,
    name: 'Polygon Amoy (Testnet)',
    explorer: 'https://amoy.polygonscan.com',
    isTestnet: true
  },
  'base-sepolia': {
    chain: baseSepolia,
    name: 'Base Sepolia (Testnet)',
    explorer: 'https://sepolia.basescan.org',
    isTestnet: true
  }
};

// Red por defecto (configurable por env)
const DEFAULT_NETWORK = process.env.BLOCKCHAIN_NETWORK || 'polygon';

// ===========================================
// Cliente de Thirdweb
// ===========================================

let thirdwebClient = null;
let adminAccount = null;

/**
 * Obtiene el cliente de Thirdweb
 * @returns {ThirdwebClient}
 */
const getClient = () => {
  if (thirdwebClient) {
    return thirdwebClient;
  }
  
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  if (!secretKey) {
    throw new Error('THIRDWEB_SECRET_KEY no está configurada en las variables de entorno');
  }
  
  thirdwebClient = createThirdwebClient({
    secretKey: secretKey
  });
  
  console.log('✅ Thirdweb Client inicializado');
  
  return thirdwebClient;
};

/**
 * Obtiene la cuenta admin (wallet de Fideitec)
 * @returns {Account}
 */
const getAdminAccount = () => {
  if (adminAccount) {
    return adminAccount;
  }
  
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BLOCKCHAIN_PRIVATE_KEY no está configurada');
  }
  
  adminAccount = privateKeyToAccount({
    client: getClient(),
    privateKey: privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
  });
  
  return adminAccount;
};

/**
 * Obtiene información de la red actual
 * @param {string} network 
 * @returns {object}
 */
const getNetworkInfo = (network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Red no soportada: ${network}. Usar: ${Object.keys(NETWORKS).join(', ')}`);
  }
  return {
    ...networkConfig,
    chainId: networkConfig.chain.id
  };
};

/**
 * Obtiene la chain para una red
 * @param {string} network 
 * @returns {Chain}
 */
const getChain = (network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Red no soportada: ${network}`);
  }
  return networkConfig.chain;
};

/**
 * Obtiene el contrato ERC1155 para tokenización
 * @param {string} contractAddress - Dirección del contrato
 * @param {string} network - Red
 * @returns {Contract}
 */
const getTokenContract = (contractAddress, network = DEFAULT_NETWORK) => {
  const client = getClient();
  const chain = getChain(network);
  
  return getContract({
    client,
    chain,
    address: contractAddress
  });
};

/**
 * Obtiene la dirección de la wallet admin
 * @returns {string}
 */
const getAdminWalletAddress = () => {
  const account = getAdminAccount();
  return account.address;
};

/**
 * Verifica si la configuración de blockchain está completa
 * @returns {object} Estado de la configuración
 */
const checkConfiguration = () => {
  const status = {
    thirdwebSecretKey: !!process.env.THIRDWEB_SECRET_KEY,
    privateKey: !!process.env.BLOCKCHAIN_PRIVATE_KEY,
    network: process.env.BLOCKCHAIN_NETWORK || DEFAULT_NETWORK,
    contractAddress: process.env.FIDEITEC_CONTRACT_ADDRESS || null,
    isConfigured: false,
    errors: []
  };
  
  if (!status.thirdwebSecretKey) {
    status.errors.push('Falta THIRDWEB_SECRET_KEY');
  }
  if (!status.privateKey) {
    status.errors.push('Falta BLOCKCHAIN_PRIVATE_KEY');
  }
  
  status.isConfigured = status.errors.length === 0;
  
  return status;
};

/**
 * Formatea una dirección de wallet para display
 * @param {string} address 
 * @returns {string}
 */
const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Obtiene el link del explorador para una transacción
 * @param {string} txHash 
 * @param {string} network 
 * @returns {string}
 */
const getExplorerTxLink = (txHash, network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) return '';
  return `${networkConfig.explorer}/tx/${txHash}`;
};

/**
 * Obtiene el link del explorador para una dirección
 * @param {string} address 
 * @param {string} network 
 * @returns {string}
 */
const getExplorerAddressLink = (address, network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) return '';
  return `${networkConfig.explorer}/address/${address}`;
};

module.exports = {
  getClient,
  getAdminAccount,
  getNetworkInfo,
  getChain,
  getTokenContract,
  getAdminWalletAddress,
  checkConfiguration,
  formatAddress,
  getExplorerTxLink,
  getExplorerAddressLink,
  NETWORKS,
  DEFAULT_NETWORK
};
