/**
 * FIDEITEC - Servicio de Blockchain (ethers.js)
 * 
 * Servicio simplificado para anclar certificados en blockchain.
 * Cada certificado se registra como una transacción con datos inmutables.
 */

const { ethers } = require('ethers');
const { 
  getAdminWallet, 
  getAdminWalletBalance,
  getExplorerTxLink,
  DEFAULT_NETWORK,
  getNetworkInfo
} = require('../config/blockchain');

// ===========================================
// ANCLAR CERTIFICADO EN BLOCKCHAIN
// ===========================================

/**
 * Ancla el hash de un certificado en blockchain
 * 
 * Crea una transacción que contiene:
 * - Hash SHA256 del certificado PDF
 * - ID del certificado
 * - Timestamp
 * 
 * @param {object} params
 * @param {string} params.certificateHash - Hash SHA256 del PDF
 * @param {string} params.certificateId - UUID del certificado
 * @param {string} params.certificateNumber - Número del certificado (ej: FDT-2024-00001)
 * @returns {object} Resultado con txHash, blockNumber, etc.
 */
const anchorCertificateHash = async ({ certificateHash, certificateId, certificateNumber }) => {
  try {
    const wallet = getAdminWallet();
    const network = getNetworkInfo(DEFAULT_NETWORK);
    
    console.log(`📝 Anclando certificado ${certificateNumber} en ${network.name}...`);
    
    // Crear el payload con los datos del certificado
    const payload = {
      type: 'FIDEITEC_CERTIFICATE',
      version: '1.0',
      certificateId,
      certificateNumber,
      hash: certificateHash,
      timestamp: new Date().toISOString(),
      issuer: 'FIDEITEC'
    };
    
    // Convertir a hex para incluir en la transacción
    const dataHex = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(payload)));
    
    // Enviar transacción con datos (a nuestra propia dirección, valor 0)
    const tx = await wallet.sendTransaction({
      to: wallet.address,  // Enviamos a nosotros mismos
      value: 0,            // Sin valor
      data: dataHex        // Los datos del certificado
    });
    
    console.log(`⏳ Transacción enviada: ${tx.hash}`);
    
    // Esperar confirmación
    const receipt = await tx.wait();
    
    console.log(`✅ Certificado anclado en bloque ${receipt.blockNumber}`);
    
    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date().toISOString(),
      network: DEFAULT_NETWORK,
      explorerLink: getExplorerTxLink(receipt.hash, DEFAULT_NETWORK),
      gasUsed: receipt.gasUsed.toString(),
      payload
    };
    
  } catch (error) {
    console.error('❌ Error anclando certificado:', error);
    throw new Error(`Error al anclar certificado en blockchain: ${error.message}`);
  }
};

/**
 * Verifica un certificado en blockchain
 * 
 * @param {string} txHash - Hash de la transacción
 * @returns {object} Datos del certificado anclado
 */
const verifyCertificate = async (txHash) => {
  try {
    const wallet = getAdminWallet();
    const provider = wallet.provider;
    
    // Obtener la transacción
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return { success: false, message: 'Transacción no encontrada' };
    }
    
    // Obtener el recibo para más detalles
    const receipt = await provider.getTransactionReceipt(txHash);
    
    // Decodificar los datos
    let payload = null;
    if (tx.data && tx.data !== '0x') {
      try {
        const dataString = ethers.toUtf8String(tx.data);
        payload = JSON.parse(dataString);
      } catch (e) {
        payload = { raw: tx.data };
      }
    }
    
    // Obtener el bloque para el timestamp
    const block = await provider.getBlock(receipt.blockNumber);
    
    return {
      success: true,
      verified: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      blockTimestamp: new Date(block.timestamp * 1000).toISOString(),
      from: tx.from,
      payload,
      explorerLink: getExplorerTxLink(txHash, DEFAULT_NETWORK)
    };
    
  } catch (error) {
    console.error('Error verificando certificado:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Obtiene el balance de la wallet admin
 */
const getWalletBalance = async () => {
  return await getAdminWalletBalance();
};

/**
 * Estima el costo de gas para anclar un certificado
 */
const estimateAnchorCost = async () => {
  try {
    const wallet = getAdminWallet();
    const provider = wallet.provider;
    
    // Payload de ejemplo
    const samplePayload = {
      type: 'FIDEITEC_CERTIFICATE',
      version: '1.0',
      certificateId: '00000000-0000-0000-0000-000000000000',
      certificateNumber: 'FDT-2024-00000',
      hash: '0'.repeat(64),
      timestamp: new Date().toISOString(),
      issuer: 'FIDEITEC'
    };
    
    const dataHex = ethers.hexlify(ethers.toUtf8Bytes(JSON.stringify(samplePayload)));
    
    // Estimar gas
    const gasEstimate = await provider.estimateGas({
      to: wallet.address,
      value: 0,
      data: dataHex
    });
    
    // Obtener precio del gas
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice;
    
    // Calcular costo
    const costWei = gasEstimate * gasPrice;
    const costEth = ethers.formatEther(costWei);
    
    return {
      gasEstimate: gasEstimate.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
      costEth: costEth,
      costUsd: (parseFloat(costEth) * 3000).toFixed(4) // Estimación con ETH a $3000
    };
    
  } catch (error) {
    console.error('Error estimando costo:', error);
    return null;
  }
};

// ===========================================
// FUNCIONES LEGACY (para compatibilidad)
// ===========================================

// Estas funciones existen para compatibilidad con código anterior
// pero el modelo actual no las usa

const mintTokens = async () => {
  throw new Error('Función no disponible - El sistema usa certificación en blockchain, no tokens ERC-1155');
};

const transferTokens = async () => {
  throw new Error('Función no disponible - El sistema usa certificación en blockchain, no tokens ERC-1155');
};

const burnTokens = async () => {
  throw new Error('Función no disponible - El sistema usa certificación en blockchain, no tokens ERC-1155');
};

const returnTokensToFideitec = async () => {
  throw new Error('Función no disponible - El sistema usa certificación en blockchain, no tokens ERC-1155');
};

const getTokenBalance = async () => {
  throw new Error('Función no disponible - El sistema usa certificación en blockchain, no tokens ERC-1155');
};

module.exports = {
  // Funciones principales
  anchorCertificateHash,
  verifyCertificate,
  getWalletBalance,
  estimateAnchorCost,
  
  // Alias para compatibilidad
  getAdminWalletBalance: getWalletBalance,
  
  // Funciones legacy (lanzarán error si se usan)
  mintTokens,
  transferTokens,
  burnTokens,
  returnTokensToFideitec,
  getTokenBalance
};
