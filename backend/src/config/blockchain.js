/**
 * FIDEITEC - Configuración de Blockchain (ethers.js + Base)
 * 
 * Sistema simplificado para anclar certificados en blockchain.
 * No usa Thirdweb, solo ethers.js puro.
 */

const { ethers } = require('ethers');

// ===========================================
// Configuración de Redes
// ===========================================

const NETWORKS = {
  // Mainnet
  base: {
    name: 'Base Mainnet',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    isTestnet: false
  },
  polygon: {
    name: 'Polygon Mainnet',
    chainId: 137,
    rpcUrl: 'https://polygon-rpc.com',
    explorer: 'https://polygonscan.com',
    isTestnet: false
  },
  
  // Testnets
  'base-sepolia': {
    name: 'Base Sepolia (Testnet)',
    chainId: 84532,
    rpcUrl: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
    isTestnet: true
  },
  'polygon-amoy': {
    name: 'Polygon Amoy (Testnet)',
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorer: 'https://amoy.polygonscan.com',
    isTestnet: true
  }
};

// Red por defecto - Base Mainnet
const DEFAULT_NETWORK = process.env.BLOCKCHAIN_NETWORK || 'base';

// ===========================================
// Provider y Wallet
// ===========================================

let provider = null;
let adminWallet = null;

/**
 * Obtiene el provider de la red
 */
const getProvider = () => {
  if (provider) return provider;
  
  const network = NETWORKS[DEFAULT_NETWORK];
  if (!network) {
    throw new Error(`Red no soportada: ${DEFAULT_NETWORK}`);
  }
  
  provider = new ethers.JsonRpcProvider(network.rpcUrl);
  console.log(`✅ Provider conectado a ${network.name}`);
  
  return provider;
};

/**
 * Obtiene la wallet admin de Fideitec
 */
const getAdminWallet = () => {
  if (adminWallet) return adminWallet;
  
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('BLOCKCHAIN_PRIVATE_KEY no está configurada');
  }
  
  const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  adminWallet = new ethers.Wallet(formattedKey, getProvider());
  
  console.log(`✅ Wallet admin configurada: ${adminWallet.address}`);
  
  return adminWallet;
};

/**
 * Obtiene la dirección de la wallet admin
 */
const getAdminWalletAddress = () => {
  const wallet = getAdminWallet();
  return wallet.address;
};

/**
 * Obtiene el balance de la wallet admin
 */
const getAdminWalletBalance = async () => {
  try {
    const wallet = getAdminWallet();
    const balance = await wallet.provider.getBalance(wallet.address);
    const balanceInEth = ethers.formatEther(balance);
    
    return {
      wei: balance.toString(),
      eth: balanceInEth,
      formatted: `${parseFloat(balanceInEth).toFixed(6)} ETH`
    };
  } catch (error) {
    console.error('Error obteniendo balance:', error);
    return null;
  }
};

/**
 * Obtiene información de la red actual
 */
const getNetworkInfo = (network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) {
    throw new Error(`Red no soportada: ${network}`);
  }
  return networkConfig;
};

/**
 * Verifica si la configuración está completa
 */
const checkConfiguration = () => {
  const status = {
    privateKey: !!process.env.BLOCKCHAIN_PRIVATE_KEY,
    network: DEFAULT_NETWORK,
    networkInfo: NETWORKS[DEFAULT_NETWORK],
    isConfigured: false,
    errors: []
  };
  
  if (!status.privateKey) {
    status.errors.push('Falta BLOCKCHAIN_PRIVATE_KEY');
  }
  
  status.isConfigured = status.errors.length === 0;
  
  // Si está configurado, agregar dirección de wallet
  if (status.isConfigured) {
    try {
      status.walletAddress = getAdminWalletAddress();
    } catch (e) {
      status.errors.push('Error al cargar wallet: ' + e.message);
      status.isConfigured = false;
    }
  }
  
  return status;
};

/**
 * Formatea una dirección para display
 */
const formatAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Obtiene el link del explorador para una transacción
 */
const getExplorerTxLink = (txHash, network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) return '';
  return `${networkConfig.explorer}/tx/${txHash}`;
};

/**
 * Obtiene el link del explorador para una dirección
 */
const getExplorerAddressLink = (address, network = DEFAULT_NETWORK) => {
  const networkConfig = NETWORKS[network];
  if (!networkConfig) return '';
  return `${networkConfig.explorer}/address/${address}`;
};

module.exports = {
  getProvider,
  getAdminWallet,
  getAdminWalletAddress,
  getAdminWalletBalance,
  getNetworkInfo,
  checkConfiguration,
  formatAddress,
  getExplorerTxLink,
  getExplorerAddressLink,
  NETWORKS,
  DEFAULT_NETWORK
};
