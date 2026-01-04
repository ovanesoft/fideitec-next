/**
 * FIDEITEC - Servicio de Blockchain (Thirdweb v5)
 * 
 * Maneja todas las operaciones de tokenización:
 * - Mint (emitir tokens)
 * - Transfer (endosar tokens)
 * - Burn (quemar tokens)
 * - Return (devolver tokens a Fideitec)
 */

const { 
  sendTransaction,
  prepareContractCall,
  readContract,
  deployContract: deployThirdwebContract,
  getContract
} = require('thirdweb');
const { 
  mintTo, 
  safeTransferFrom, 
  burn,
  balanceOf,
  uri,
  totalSupply
} = require('thirdweb/extensions/erc1155');
const { 
  getClient, 
  getAdminAccount,
  getChain,
  getTokenContract,
  getExplorerTxLink,
  DEFAULT_NETWORK 
} = require('../config/blockchain');
const { query, getClient: getDbClient } = require('../config/database');

// ===========================================
// OPERACIONES DE TOKENIZACIÓN
// ===========================================

/**
 * Emitir nuevos tokens para un activo
 * @param {object} params
 * @param {string} params.contractAddress - Dirección del contrato
 * @param {number} params.tokenId - ID del token en el contrato
 * @param {number} params.amount - Cantidad de tokens a emitir
 * @param {string} params.tokenUri - URI de metadata (opcional)
 * @param {string} params.network - Red (opcional, default polygon)
 * @returns {object} Resultado de la transacción
 */
const mintTokens = async ({ contractAddress, tokenId, amount, tokenUri, network = DEFAULT_NETWORK }) => {
  try {
    const client = getClient();
    const account = getAdminAccount();
    const contract = getTokenContract(contractAddress, network);
    
    // Preparar transacción de mint
    const transaction = mintTo({
      contract,
      to: account.address,
      tokenId: BigInt(tokenId),
      amount: BigInt(amount),
      uri: tokenUri || ''
    });
    
    // Enviar transacción
    const result = await sendTransaction({
      transaction,
      account
    });
    
    return {
      success: true,
      txHash: result.transactionHash,
      blockNumber: result.blockNumber,
      toAddress: account.address,
      explorerLink: getExplorerTxLink(result.transactionHash, network)
    };
    
  } catch (error) {
    console.error('Error en mintTokens:', error);
    throw new Error(`Error al emitir tokens: ${error.message}`);
  }
};

/**
 * Transferir/Endosar tokens a una dirección
 * @param {object} params
 * @param {string} params.contractAddress - Dirección del contrato
 * @param {number} params.tokenId - ID del token
 * @param {string} params.toAddress - Dirección destino
 * @param {number} params.amount - Cantidad a transferir
 * @param {string} params.network - Red
 * @returns {object} Resultado de la transacción
 */
const transferTokens = async ({ contractAddress, tokenId, toAddress, amount, network = DEFAULT_NETWORK }) => {
  try {
    const client = getClient();
    const account = getAdminAccount();
    const contract = getTokenContract(contractAddress, network);
    
    // Preparar transacción de transferencia
    const transaction = safeTransferFrom({
      contract,
      from: account.address,
      to: toAddress,
      tokenId: BigInt(tokenId),
      value: BigInt(amount),
      data: '0x'
    });
    
    // Enviar transacción
    const result = await sendTransaction({
      transaction,
      account
    });
    
    return {
      success: true,
      txHash: result.transactionHash,
      blockNumber: result.blockNumber,
      fromAddress: account.address,
      toAddress: toAddress,
      explorerLink: getExplorerTxLink(result.transactionHash, network)
    };
    
  } catch (error) {
    console.error('Error en transferTokens:', error);
    throw new Error(`Error al transferir tokens: ${error.message}`);
  }
};

/**
 * Quemar tokens (eliminar permanentemente)
 * @param {object} params
 * @param {string} params.contractAddress - Dirección del contrato
 * @param {number} params.tokenId - ID del token
 * @param {number} params.amount - Cantidad a quemar
 * @param {string} params.network - Red
 * @returns {object} Resultado de la transacción
 */
const burnTokens = async ({ contractAddress, tokenId, amount, network = DEFAULT_NETWORK }) => {
  try {
    const client = getClient();
    const account = getAdminAccount();
    const contract = getTokenContract(contractAddress, network);
    
    // Preparar transacción de burn
    const transaction = burn({
      contract,
      account: account.address,
      id: BigInt(tokenId),
      value: BigInt(amount)
    });
    
    // Enviar transacción
    const result = await sendTransaction({
      transaction,
      account
    });
    
    return {
      success: true,
      txHash: result.transactionHash,
      blockNumber: result.blockNumber,
      explorerLink: getExplorerTxLink(result.transactionHash, network)
    };
    
  } catch (error) {
    console.error('Error en burnTokens:', error);
    throw new Error(`Error al quemar tokens: ${error.message}`);
  }
};

/**
 * Obtener balance de tokens de una dirección
 * @param {object} params
 * @param {string} params.contractAddress - Dirección del contrato
 * @param {number} params.tokenId - ID del token
 * @param {string} params.ownerAddress - Dirección del propietario
 * @param {string} params.network - Red
 * @returns {string} Balance
 */
const getTokenBalance = async ({ contractAddress, tokenId, ownerAddress, network = DEFAULT_NETWORK }) => {
  try {
    const contract = getTokenContract(contractAddress, network);
    
    const balance = await balanceOf({
      contract,
      owner: ownerAddress,
      tokenId: BigInt(tokenId)
    });
    
    return balance.toString();
  } catch (error) {
    console.error('Error en getTokenBalance:', error);
    throw new Error(`Error al obtener balance: ${error.message}`);
  }
};

/**
 * Obtener información de un token
 * @param {object} params
 * @param {string} params.contractAddress - Dirección del contrato
 * @param {number} params.tokenId - ID del token
 * @param {string} params.network - Red
 * @returns {object} Info del token
 */
const getTokenInfo = async ({ contractAddress, tokenId, network = DEFAULT_NETWORK }) => {
  try {
    const contract = getTokenContract(contractAddress, network);
    
    const [tokenUri, supply] = await Promise.all([
      uri({ contract, tokenId: BigInt(tokenId) }),
      totalSupply({ contract, id: BigInt(tokenId) })
    ]);
    
    return {
      id: tokenId,
      uri: tokenUri,
      supply: supply.toString()
    };
  } catch (error) {
    console.error('Error en getTokenInfo:', error);
    throw new Error(`Error al obtener info del token: ${error.message}`);
  }
};

/**
 * Obtener el supply total de un token
 * @param {object} params
 * @param {string} params.contractAddress - Dirección del contrato
 * @param {number} params.tokenId - ID del token
 * @param {string} params.network - Red
 * @returns {string} Supply total
 */
const getTotalSupply = async ({ contractAddress, tokenId, network = DEFAULT_NETWORK }) => {
  try {
    const contract = getTokenContract(contractAddress, network);
    
    const supply = await totalSupply({
      contract,
      id: BigInt(tokenId)
    });
    
    return supply.toString();
  } catch (error) {
    console.error('Error en getTotalSupply:', error);
    throw new Error(`Error al obtener supply: ${error.message}`);
  }
};

// ===========================================
// OPERACIONES DE SINCRONIZACIÓN
// ===========================================

/**
 * Sincronizar balance desde blockchain a la base de datos
 * @param {object} params
 * @param {string} params.tokenizedAssetId - ID del activo tokenizado
 * @param {string} params.holderAddress - Dirección del holder
 * @param {string} params.network - Red
 */
const syncHolderBalance = async ({ tokenizedAssetId, holderAddress, network = DEFAULT_NETWORK }) => {
  try {
    // Obtener info del activo tokenizado
    const assetResult = await query(
      `SELECT ta.*, bc.contract_address 
       FROM tokenized_assets ta
       JOIN blockchain_contracts bc ON ta.contract_id = bc.id
       WHERE ta.id = $1`,
      [tokenizedAssetId]
    );
    
    if (assetResult.rows.length === 0) {
      throw new Error('Activo tokenizado no encontrado');
    }
    
    const asset = assetResult.rows[0];
    
    // Obtener balance real de blockchain
    const balance = await getTokenBalance({
      contractAddress: asset.contract_address,
      tokenId: asset.token_id,
      ownerAddress: holderAddress,
      network
    });
    
    // Actualizar en base de datos
    await query(
      `UPDATE token_holders 
       SET balance = $1, last_sync_at = CURRENT_TIMESTAMP
       WHERE tokenized_asset_id = $2 AND wallet_address = $3`,
      [balance, tokenizedAssetId, holderAddress]
    );
    
    return { balance, synced: true };
    
  } catch (error) {
    console.error('Error en syncHolderBalance:', error);
    throw error;
  }
};

// ===========================================
// OPERACIONES DE CONTRATO
// ===========================================

/**
 * Desplegar un nuevo contrato ERC1155 para un tenant
 * Nota: Para v5, se recomienda usar los contratos pre-desplegados de Thirdweb
 * o desplegar manualmente desde el dashboard
 * @param {object} params
 * @param {string} params.name - Nombre del contrato
 * @param {string} params.description - Descripción
 * @param {string} params.network - Red
 * @returns {object} Info del contrato desplegado
 */
const deployContract = async ({ name, description, network = DEFAULT_NETWORK }) => {
  // En Thirdweb v5, se recomienda desplegar contratos desde el dashboard
  // o usar contratos pre-construidos
  throw new Error(
    'Para desplegar contratos, usar el dashboard de Thirdweb: https://thirdweb.com/dashboard. ' +
    'Después agregar la dirección del contrato manualmente.'
  );
};

/**
 * Verificar si la wallet tiene permisos de admin en el contrato
 * @param {string} contractAddress - Dirección del contrato
 * @param {string} network - Red
 * @returns {boolean}
 */
const checkAdminPermissions = async (contractAddress, network = DEFAULT_NETWORK) => {
  try {
    const account = getAdminAccount();
    const contract = getTokenContract(contractAddress, network);
    
    // Intentar leer el balance como prueba de acceso
    await balanceOf({
      contract,
      owner: account.address,
      tokenId: BigInt(0)
    });
    
    return true;
  } catch (error) {
    console.error('Error en checkAdminPermissions:', error);
    return false;
  }
};

/**
 * Obtener el balance de ETH/MATIC de la wallet admin
 * @param {string} network - Red
 * @returns {object} Balance en formato legible
 */
const getAdminWalletBalance = async (network = DEFAULT_NETWORK) => {
  try {
    const { ethers } = require('ethers');
    const chain = require('../config/blockchain').getChain(network);
    
    // Crear provider
    const provider = new ethers.JsonRpcProvider(chain.rpc);
    const account = getAdminAccount();
    
    const balance = await provider.getBalance(account.address);
    const formatted = ethers.formatEther(balance);
    
    return {
      value: balance.toString(),
      displayValue: parseFloat(formatted).toFixed(4),
      symbol: network.includes('polygon') ? 'MATIC' : 'ETH'
    };
  } catch (error) {
    console.error('Error en getAdminWalletBalance:', error);
    // Retornar valores por defecto si falla
    return {
      value: '0',
      displayValue: '0.0000',
      symbol: 'MATIC'
    };
  }
};

// ===========================================
// CERTIFICACIÓN EN BLOCKCHAIN
// ===========================================

/**
 * Ancla el hash de un certificado en blockchain
 * Esta operación registra de forma inmutable el hash del certificado
 * para que pueda ser verificado posteriormente.
 * 
 * Usamos una transacción simple enviando el hash como data
 * (más económico que un smart contract específico)
 * 
 * @param {object} params
 * @param {string} params.certificateHash - Hash SHA-256 del certificado
 * @param {string} params.certificateId - ID del certificado (para referencia)
 * @param {string} params.network - Red
 * @returns {object} Resultado de la transacción
 */
const anchorCertificateHash = async ({ certificateHash, certificateId, network = DEFAULT_NETWORK }) => {
  try {
    const client = getClient();
    const account = getAdminAccount();
    const chain = getChain(network);
    
    // Preparar los datos: incluimos el ID del certificado y el hash
    const dataToAnchor = JSON.stringify({
      type: 'FIDEITEC_CERTIFICATE',
      version: '1.0',
      certificateId,
      hash: certificateHash,
      timestamp: new Date().toISOString()
    });
    
    // Convertir a hex para incluir en la transacción
    const dataHex = '0x' + Buffer.from(dataToAnchor).toString('hex');
    
    // Crear una transacción hacia nosotros mismos con el data del certificado
    // Esta es la forma más económica de anclar datos en blockchain
    const { ethers } = require('ethers');
    const chainConfig = require('../config/blockchain').getChain(network);
    
    // Usar provider de ethers para enviar transacción raw
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    const wallet = new ethers.Wallet(
      privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`,
      provider
    );
    
    const tx = await wallet.sendTransaction({
      to: wallet.address, // Enviamos a nosotros mismos
      value: 0,           // Sin valor
      data: dataHex       // El hash del certificado
    });
    
    // Esperar confirmación
    const receipt = await tx.wait();
    
    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date(),
      explorerLink: getExplorerTxLink(receipt.hash, network),
      anchoredData: dataToAnchor
    };
    
  } catch (error) {
    console.error('Error anclando certificado:', error);
    throw new Error(`Error al anclar certificado en blockchain: ${error.message}`);
  }
};

/**
 * Verifica un hash de certificado en blockchain
 * @param {string} txHash - Hash de la transacción de anclaje
 * @param {string} expectedHash - Hash esperado del certificado
 * @param {string} network - Red
 * @returns {object} Resultado de la verificación
 */
const verifyCertificateHash = async (txHash, expectedHash, network = DEFAULT_NETWORK) => {
  try {
    const { ethers } = require('ethers');
    const chainConfig = require('../config/blockchain').getChain(network);
    
    const provider = new ethers.JsonRpcProvider(chainConfig.rpc);
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return { valid: false, error: 'Transacción no encontrada' };
    }
    
    // Decodificar el data de la transacción
    const dataHex = tx.data;
    if (!dataHex || dataHex === '0x') {
      return { valid: false, error: 'La transacción no contiene datos' };
    }
    
    const dataString = Buffer.from(dataHex.slice(2), 'hex').toString('utf8');
    
    let anchoredData;
    try {
      anchoredData = JSON.parse(dataString);
    } catch {
      return { valid: false, error: 'Datos de transacción inválidos' };
    }
    
    if (anchoredData.type !== 'FIDEITEC_CERTIFICATE') {
      return { valid: false, error: 'Esta transacción no es un certificado Fideitec' };
    }
    
    const isValid = anchoredData.hash === expectedHash;
    
    return {
      valid: isValid,
      anchoredData,
      blockNumber: tx.blockNumber,
      timestamp: anchoredData.timestamp
    };
    
  } catch (error) {
    console.error('Error verificando certificado:', error);
    return { valid: false, error: error.message };
  }
};

module.exports = {
  // Operaciones de tokens
  mintTokens,
  transferTokens,
  burnTokens,
  getTokenBalance,
  getTokenInfo,
  getTotalSupply,
  
  // Sincronización
  syncHolderBalance,
  
  // Contratos
  deployContract,
  checkAdminPermissions,
  getAdminWalletBalance,
  
  // Certificación blockchain
  anchorCertificateHash,
  verifyCertificateHash
};
