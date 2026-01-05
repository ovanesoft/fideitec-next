/**
 * FIDEITEC - Controlador de Tokenización
 * 
 * Sistema de tokenización con certificación en blockchain.
 * Los tokens se gestionan en base de datos y los certificados
 * se anclan en blockchain (Base) para verificación inmutable.
 * 
 * Endpoints para:
 * - Ver estado de configuración blockchain
 * - Gestionar activos tokenizados
 * - Crear/completar órdenes de compra/venta
 * - Generar certificados y anclarlos en blockchain
 */

const { query, getClient } = require('../config/database');
const { checkConfiguration, getNetworkInfo, getExplorerTxLink, DEFAULT_NETWORK, getAdminWalletAddress } = require('../config/blockchain');
const blockchainService = require('../services/blockchainService');

// ===========================================
// GESTIÓN DE CONTRATOS
// ===========================================

/**
 * Verificar estado de configuración blockchain
 */
const getBlockchainStatus = async (req, res) => {
  try {
    const config = checkConfiguration();
    const networkInfo = config.isConfigured ? getNetworkInfo(DEFAULT_NETWORK) : null;
    
    let walletBalance = null;
    let estimatedCost = null;
    
    if (config.isConfigured) {
      try {
        walletBalance = await blockchainService.getWalletBalance();
        estimatedCost = await blockchainService.estimateAnchorCost();
      } catch (err) {
        console.error('Error obteniendo balance/costo:', err);
      }
    }
    
    res.json({
      success: true,
      data: {
        isConfigured: config.isConfigured,
        network: config.network,
        walletAddress: config.walletAddress,
        networkInfo: networkInfo ? {
          name: networkInfo.name,
          chainId: networkInfo.chainId,
          explorer: networkInfo.explorer,
          isTestnet: networkInfo.isTestnet
        } : null,
        walletBalance,
        estimatedCostPerCertificate: estimatedCost,
        errors: config.errors,
        message: config.isConfigured 
          ? '✅ Blockchain configurada correctamente' 
          : '⚠️ Configure BLOCKCHAIN_PRIVATE_KEY en las variables de entorno'
      }
    });
  } catch (error) {
    console.error('Error en getBlockchainStatus:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar estado de blockchain'
    });
  }
};

/**
 * Registrar un contrato existente (desplegado desde Thirdweb Dashboard)
 */
const deployContract = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { name, description, contract_address } = req.body;
    
    // Solo admin puede registrar contratos
    if (user.role !== 'admin' && user.role !== 'root') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para registrar contratos'
      });
    }
    
    // Validar dirección del contrato
    if (!contract_address || !contract_address.startsWith('0x') || contract_address.length !== 42) {
      return res.status(400).json({
        success: false,
        message: 'Dirección de contrato inválida. Debe ser una dirección Ethereum válida (0x...)',
        instructions: 'Desplegá el contrato desde https://thirdweb.com/dashboard y pegá la dirección aquí'
      });
    }
    
    await dbClient.query('BEGIN');
    
    // Verificar que no exista ya
    const existing = await dbClient.query(
      `SELECT id FROM blockchain_contracts WHERE contract_address = $1`,
      [contract_address.toLowerCase()]
    );
    
    if (existing.rows.length > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Este contrato ya está registrado'
      });
    }
    
    // Guardar en base de datos
    const result = await dbClient.query(
      `INSERT INTO blockchain_contracts (
        tenant_id, name, description, contract_type, blockchain,
        contract_address, status, deployed_at, created_by
      ) VALUES ($1, $2, $3, 'ERC1155', $4, $5, 'active', CURRENT_TIMESTAMP, $6)
      RETURNING *`,
      [tenantId, name || 'Contrato Fideitec', description, DEFAULT_NETWORK, contract_address.toLowerCase(), user.id]
    );
    
    await dbClient.query('COMMIT');
    
    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'CONTRACT_REGISTERED', 'blockchain_contracts', result.rows[0].id,
        null, JSON.stringify({ contractAddress: contract_address }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));
    
    res.status(201).json({
      success: true,
      message: 'Contrato registrado exitosamente',
      data: {
        contract: result.rows[0],
        instructions: 'Ahora podés tokenizar activos usando este contrato'
      }
    });
    
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error registrando contrato:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar contrato'
    });
  } finally {
    dbClient.release();
  }
};

/**
 * Listar contratos del tenant
 */
const listContracts = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    
    const result = await query(
      `SELECT * FROM blockchain_contracts 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    
    res.json({
      success: true,
      data: { contracts: result.rows }
    });
  } catch (error) {
    console.error('Error listando contratos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar contratos'
    });
  }
};

// ===========================================
// TOKENIZACIÓN DE ACTIVOS
// ===========================================

/**
 * Tokenizar un activo (crear representación en blockchain)
 * 
 * Sistema simplificado: No requiere contrato ERC-1155.
 * Los tokens se gestionan en base de datos y los certificados se anclan en blockchain.
 */
const tokenizeAsset = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const {
      asset_type,        // 'asset', 'asset_unit', 'trust'
      asset_id,
      asset_unit_id,
      trust_id,
      contract_id,       // Opcional - se crea automáticamente si no existe
      total_supply,      // Cantidad de tokens a emitir
      token_price,       // Precio por token
      token_name,
      token_symbol,
      token_uri
    } = req.body;
    
    // Validaciones
    if (!asset_type || !['asset', 'asset_unit', 'trust'].includes(asset_type)) {
      return res.status(400).json({
        success: false,
        message: 'asset_type debe ser: asset, asset_unit o trust'
      });
    }
    
    if (!total_supply || total_supply < 1) {
      return res.status(400).json({
        success: false,
        message: 'total_supply debe ser mayor a 0'
      });
    }
    
    await dbClient.query('BEGIN');
    
    // Obtener o crear contrato por defecto para el tenant
    let contract;
    
    if (contract_id) {
      // Si se especifica un contrato, verificar que existe
      const contractResult = await dbClient.query(
        `SELECT * FROM blockchain_contracts WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
        [contract_id, tenantId]
      );
      
      if (contractResult.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          message: 'Contrato no encontrado o inactivo'
        });
      }
      contract = contractResult.rows[0];
    } else {
      // Buscar o crear contrato por defecto "FIDEITEC_CERTIFICATES"
      let contractResult = await dbClient.query(
        `SELECT * FROM blockchain_contracts 
         WHERE tenant_id = $1 AND name = 'FIDEITEC_CERTIFICATES' AND status = 'active'`,
        [tenantId]
      );
      
      if (contractResult.rows.length === 0) {
        // Crear contrato por defecto
        const { getAdminWalletAddress, DEFAULT_NETWORK } = require('../config/blockchain');
        let walletAddress;
        try {
          walletAddress = getAdminWalletAddress();
        } catch (e) {
          walletAddress = '0x0000000000000000000000000000000000000000';
        }
        
        contractResult = await dbClient.query(
          `INSERT INTO blockchain_contracts (
            tenant_id, name, description, contract_type, blockchain, 
            contract_address, status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)
          RETURNING *`,
          [
            tenantId,
            'FIDEITEC_CERTIFICATES',
            'Sistema de certificación de cuotas partes en blockchain',
            'ERC1155',
            DEFAULT_NETWORK,
            walletAddress,  // Usamos la wallet como "contrato" para certificación
            user.id
          ]
        );
        console.log('✅ Contrato FIDEITEC_CERTIFICATES creado automáticamente');
      }
      contract = contractResult.rows[0];
    }
    
    // Verificar que el activo existe
    let sourceAsset;
    if (asset_type === 'asset') {
      const assetResult = await dbClient.query(
        'SELECT * FROM assets WHERE id = $1 AND tenant_id = $2',
        [asset_id, tenantId]
      );
      if (assetResult.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Activo no encontrado' });
      }
      sourceAsset = assetResult.rows[0];
    } else if (asset_type === 'asset_unit') {
      const unitResult = await dbClient.query(
        'SELECT * FROM asset_units WHERE id = $1 AND tenant_id = $2',
        [asset_unit_id, tenantId]
      );
      if (unitResult.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Unidad no encontrada' });
      }
      sourceAsset = unitResult.rows[0];
    } else if (asset_type === 'trust') {
      const trustResult = await dbClient.query(
        'SELECT * FROM trusts WHERE id = $1 AND tenant_id = $2',
        [trust_id, tenantId]
      );
      if (trustResult.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Fideicomiso no encontrado' });
      }
      sourceAsset = trustResult.rows[0];
    }
    
    // Verificar que no esté ya tokenizado
    const existingToken = await dbClient.query(
      `SELECT id FROM tokenized_assets 
       WHERE tenant_id = $1 AND (
         (asset_type = 'asset' AND asset_id = $2) OR
         (asset_type = 'asset_unit' AND asset_unit_id = $3) OR
         (asset_type = 'trust' AND trust_id = $4)
       )`,
      [tenantId, asset_id, asset_unit_id, trust_id]
    );
    
    if (existingToken.rows.length > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Este activo ya está tokenizado'
      });
    }
    
    // Obtener siguiente token_id (usar contract.id, no contract_id del request)
    const nextTokenIdResult = await dbClient.query(
      'SELECT get_next_token_id($1) as next_id',
      [contract.id]
    );
    const tokenId = parseInt(nextTokenIdResult.rows[0].next_id);
    
    // Crear registro en base de datos
    const tokenizedAssetResult = await dbClient.query(
      `INSERT INTO tokenized_assets (
        tenant_id, contract_id, asset_type, asset_id, asset_unit_id, trust_id,
        blockchain, token_id, total_supply, fideitec_balance, token_price,
        token_name, token_symbol, token_uri, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, $12, $13, 'draft', $14)
      RETURNING *`,
      [
        tenantId, contract.id, asset_type, asset_id, asset_unit_id, trust_id,
        contract.blockchain, tokenId, total_supply, token_price || 0,
        token_name || sourceAsset.name || `Token ${tokenId}`,
        token_symbol || `FDT${tokenId}`,
        token_uri, user.id
      ]
    );
    
    const tokenizedAsset = tokenizedAssetResult.rows[0];
    
    // Crear holder de Fideitec
    await dbClient.query(
      `INSERT INTO token_holders (
        tenant_id, tokenized_asset_id, holder_type, balance
      ) VALUES ($1, $2, 'fideitec', $3)`,
      [tenantId, tokenizedAsset.id, total_supply]
    );
    
    // NOTA: El modelo Fideitec NO usa tokens ERC-1155 en blockchain.
    // Los tokens se gestionan en base de datos y el blockchain solo se usa
    // para CERTIFICAR transacciones (anclar hash de certificados PDF).
    // 
    // Por lo tanto, activamos el token directamente sin "mint" on-chain.
    
    await dbClient.query(
      `UPDATE tokenized_assets 
       SET status = 'active', 
           tokenization_date = CURRENT_TIMESTAMP,
           notes = 'Tokens gestionados en base de datos. Blockchain usado para certificación de compras.'
       WHERE id = $1`,
      [tokenizedAsset.id]
    );
    
    // Registrar transacción de emisión (solo en DB, no blockchain)
    const fideitecHolder = await dbClient.query(
      `SELECT id FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
      [tokenizedAsset.id]
    );
    
    await dbClient.query(
      `INSERT INTO token_transactions (
        tenant_id, tokenized_asset_id, transaction_type, to_holder_id,
        amount, status, initiated_by, notes
      ) VALUES ($1, $2, 'mint', $3, $4, 'confirmed', $5, 'Emisión inicial - Tokens bajo custodia de Fideitec')`,
      [tenantId, tokenizedAsset.id, fideitecHolder.rows[0].id, total_supply, user.id]
    );
    
    // Actualizar el activo original como tokenizado
    if (asset_type === 'asset') {
      await dbClient.query(
        `UPDATE assets SET is_tokenizable = true, total_tokens = $1, token_value = $2 WHERE id = $3`,
        [total_supply, token_price || 0, asset_id]
      );
    } else if (asset_type === 'asset_unit') {
      await dbClient.query(
        `UPDATE asset_units SET is_tokenizable = true, total_tokens = $1, token_value = $2 WHERE id = $3`,
        [total_supply, token_price || 0, asset_unit_id]
      );
    } else if (asset_type === 'trust') {
      await dbClient.query(
        `UPDATE trusts SET is_tokenizable = true, total_tokens = $1, token_value = $2 WHERE id = $3`,
        [total_supply, token_price || 0, trust_id]
      );
    }
    
    await dbClient.query('COMMIT');
    
    // Obtener datos completos
    const finalResult = await query(
      `SELECT * FROM v_tokenized_assets_summary WHERE id = $1`,
      [tokenizedAsset.id]
    );
    
    res.status(201).json({
      success: true,
      message: '✅ Activo tokenizado exitosamente. Listo para vender tokens a clientes.',
      data: {
        tokenizedAsset: finalResult.rows[0],
        mintTransaction: mintResult || null
      }
    });
    
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error tokenizando activo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al tokenizar activo'
    });
  } finally {
    dbClient.release();
  }
};

/**
 * Listar activos tokenizados
 */
const listTokenizedAssets = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { status, asset_type } = req.query;
    
    let whereConditions = ['tenant_id = $1'];
    const params = [tenantId];
    let paramCount = 2;
    
    if (status) {
      whereConditions.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }
    
    if (asset_type) {
      whereConditions.push(`asset_type = $${paramCount}`);
      params.push(asset_type);
      paramCount++;
    }
    
    const result = await query(
      `SELECT * FROM v_tokenized_assets_summary 
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY created_at DESC`,
      params
    );
    
    res.json({
      success: true,
      data: { tokenizedAssets: result.rows }
    });
    
  } catch (error) {
    console.error('Error listando activos tokenizados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar activos tokenizados'
    });
  }
};

/**
 * Obtener detalle de un activo tokenizado
 */
const getTokenizedAsset = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { id } = req.params;
    
    // Obtener activo
    const assetResult = await query(
      `SELECT * FROM v_tokenized_assets_summary WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    
    if (assetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Activo tokenizado no encontrado'
      });
    }
    
    // Obtener holders
    const holdersResult = await query(
      `SELECT * FROM v_token_holders_detail WHERE tokenized_asset_id = $1 AND balance > 0`,
      [id]
    );
    
    // Obtener transacciones recientes
    const transactionsResult = await query(
      `SELECT * FROM v_token_transactions_detail 
       WHERE tokenized_asset_id = $1 
       ORDER BY created_at DESC 
       LIMIT 20`,
      [id]
    );
    
    res.json({
      success: true,
      data: {
        tokenizedAsset: assetResult.rows[0],
        holders: holdersResult.rows,
        recentTransactions: transactionsResult.rows
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo activo tokenizado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener activo tokenizado'
    });
  }
};

// ===========================================
// OPERACIONES DE TOKENS
// ===========================================

/**
 * Endosar/Transferir tokens a un cliente
 */
const transferToClient = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { id } = req.params; // tokenized_asset_id
    const { client_id, amount, reason, reference_id } = req.body;
    
    if (!client_id || !amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'client_id y amount son requeridos'
      });
    }
    
    await dbClient.query('BEGIN');
    
    // Verificar activo tokenizado
    const assetResult = await dbClient.query(
      `SELECT ta.*, bc.contract_address 
       FROM tokenized_assets ta
       JOIN blockchain_contracts bc ON ta.contract_id = bc.id
       WHERE ta.id = $1 AND ta.tenant_id = $2 AND ta.status = 'active'`,
      [id, tenantId]
    );
    
    if (assetResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Activo tokenizado no encontrado o inactivo'
      });
    }
    
    const tokenizedAsset = assetResult.rows[0];
    
    // Verificar que hay suficientes tokens disponibles
    if (tokenizedAsset.fideitec_balance < amount) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Tokens insuficientes. Disponibles: ${tokenizedAsset.fideitec_balance}`
      });
    }
    
    // Verificar cliente
    const clientResult = await dbClient.query(
      'SELECT * FROM clients WHERE id = $1 AND tenant_id = $2',
      [client_id, tenantId]
    );
    
    if (clientResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }
    
    const client = clientResult.rows[0];
    
    // Obtener o crear wallet del cliente
    let clientWallet = await dbClient.query(
      `SELECT wallet_address FROM blockchain_wallets 
       WHERE client_id = $1 AND blockchain = $2 AND is_active = true`,
      [client_id, tokenizedAsset.blockchain]
    );
    
    let clientWalletAddress;
    if (clientWallet.rows.length === 0) {
      // Por ahora, usar una dirección placeholder
      // En producción, aquí se crearía una wallet embebida con Thirdweb
      clientWalletAddress = `0x${client_id.replace(/-/g, '').slice(0, 40)}`;
      
      await dbClient.query(
        `INSERT INTO blockchain_wallets (tenant_id, owner_type, client_id, wallet_address, blockchain, wallet_type)
         VALUES ($1, 'client', $2, $3, $4, 'custodial')`,
        [tenantId, client_id, clientWalletAddress, tokenizedAsset.blockchain]
      );
    } else {
      clientWalletAddress = clientWallet.rows[0].wallet_address;
    }
    
    // Obtener holders
    const fideitecHolder = await dbClient.query(
      `SELECT id FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
      [id]
    );
    
    // Crear o actualizar holder del cliente
    let clientHolder = await dbClient.query(
      `SELECT id, balance FROM token_holders 
       WHERE tokenized_asset_id = $1 AND client_id = $2`,
      [id, client_id]
    );
    
    let clientHolderId;
    if (clientHolder.rows.length === 0) {
      const newHolder = await dbClient.query(
        `INSERT INTO token_holders (tenant_id, tokenized_asset_id, holder_type, client_id, wallet_address, balance)
         VALUES ($1, $2, 'client', $3, $4, 0)
         RETURNING id`,
        [tenantId, id, client_id, clientWalletAddress]
      );
      clientHolderId = newHolder.rows[0].id;
    } else {
      clientHolderId = clientHolder.rows[0].id;
    }
    
    // Realizar transferencia en blockchain
    let transferResult;
    try {
      transferResult = await blockchainService.transferTokens({
        contractAddress: tokenizedAsset.contract_address,
        tokenId: tokenizedAsset.token_id,
        toAddress: clientWalletAddress,
        amount,
        network: tokenizedAsset.blockchain
      });
      
      // Registrar transacción
      await dbClient.query(
        `INSERT INTO token_transactions (
          tenant_id, tokenized_asset_id, transaction_type,
          from_holder_id, to_holder_id, from_address, to_address,
          amount, blockchain, tx_hash, block_number, status,
          reason, reference_id, initiated_by, confirmed_at
        ) VALUES ($1, $2, 'transfer', $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11, $12, $13, CURRENT_TIMESTAMP)`,
        [
          tenantId, id, fideitecHolder.rows[0].id, clientHolderId,
          transferResult.fromAddress, clientWalletAddress,
          amount, tokenizedAsset.blockchain, transferResult.txHash, transferResult.blockNumber,
          reason, reference_id, user.id
        ]
      );
      
    } catch (blockchainError) {
      await dbClient.query('ROLLBACK');
      console.error('Error en transferencia blockchain:', blockchainError);
      return res.status(500).json({
        success: false,
        message: `Error en blockchain: ${blockchainError.message}`
      });
    }
    
    await dbClient.query('COMMIT');
    
    // Obtener datos actualizados
    const updatedAsset = await query(
      `SELECT * FROM v_tokenized_assets_summary WHERE id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: `${amount} tokens transferidos a ${client.first_name} ${client.last_name}`,
      data: {
        tokenizedAsset: updatedAsset.rows[0],
        transaction: {
          txHash: transferResult.txHash,
          explorerLink: transferResult.explorerLink
        }
      }
    });
    
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error en transferencia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al transferir tokens'
    });
  } finally {
    dbClient.release();
  }
};

/**
 * Recibir tokens de vuelta de un cliente
 */
const returnFromClient = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { id } = req.params;
    const { client_id, amount, reason, reference_id } = req.body;
    
    if (!client_id || !amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'client_id y amount son requeridos'
      });
    }
    
    await dbClient.query('BEGIN');
    
    // Verificar activo y holder del cliente
    const holderResult = await dbClient.query(
      `SELECT th.*, ta.contract_id, bc.contract_address, ta.token_id, ta.blockchain
       FROM token_holders th
       JOIN tokenized_assets ta ON th.tokenized_asset_id = ta.id
       JOIN blockchain_contracts bc ON ta.contract_id = bc.id
       WHERE th.tokenized_asset_id = $1 AND th.client_id = $2 AND ta.tenant_id = $3`,
      [id, client_id, tenantId]
    );
    
    if (holderResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'El cliente no posee tokens de este activo'
      });
    }
    
    const clientHolder = holderResult.rows[0];
    
    if (clientHolder.balance < amount) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `El cliente solo tiene ${clientHolder.balance} tokens`
      });
    }
    
    // Obtener holder de Fideitec
    const fideitecHolder = await dbClient.query(
      `SELECT id, wallet_address FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
      [id]
    );
    
    // Nota: En un escenario real, el cliente debería firmar esta transacción
    // Por ahora, asumimos que Fideitec tiene custodia de las wallets
    
    // Registrar transacción de devolución
    await dbClient.query(
      `INSERT INTO token_transactions (
        tenant_id, tokenized_asset_id, transaction_type,
        from_holder_id, to_holder_id, from_address, to_address,
        amount, blockchain, status, reason, reference_id, initiated_by, confirmed_at
      ) VALUES ($1, $2, 'return', $3, $4, $5, $6, $7, $8, 'confirmed', $9, $10, $11, CURRENT_TIMESTAMP)`,
      [
        tenantId, id, clientHolder.id, fideitecHolder.rows[0].id,
        clientHolder.wallet_address, fideitecHolder.rows[0].wallet_address,
        amount, clientHolder.blockchain, reason, reference_id, user.id
      ]
    );
    
    await dbClient.query('COMMIT');
    
    // Obtener datos actualizados
    const updatedAsset = await query(
      `SELECT * FROM v_tokenized_assets_summary WHERE id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: `${amount} tokens devueltos a Fideitec`,
      data: {
        tokenizedAsset: updatedAsset.rows[0]
      }
    });
    
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error en devolución:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar devolución'
    });
  } finally {
    dbClient.release();
  }
};

/**
 * Quemar tokens
 */
const burnTokens = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { id } = req.params;
    const { amount, reason } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'amount es requerido y debe ser mayor a 0'
      });
    }
    
    await dbClient.query('BEGIN');
    
    // Verificar activo
    const assetResult = await dbClient.query(
      `SELECT ta.*, bc.contract_address 
       FROM tokenized_assets ta
       JOIN blockchain_contracts bc ON ta.contract_id = bc.id
       WHERE ta.id = $1 AND ta.tenant_id = $2 AND ta.status = 'active'`,
      [id, tenantId]
    );
    
    if (assetResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Activo tokenizado no encontrado'
      });
    }
    
    const tokenizedAsset = assetResult.rows[0];
    
    if (tokenizedAsset.fideitec_balance < amount) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Solo hay ${tokenizedAsset.fideitec_balance} tokens disponibles para quemar`
      });
    }
    
    // Quemar en blockchain
    let burnResult;
    try {
      burnResult = await blockchainService.burnTokens({
        contractAddress: tokenizedAsset.contract_address,
        tokenId: tokenizedAsset.token_id,
        amount,
        network: tokenizedAsset.blockchain
      });
      
      // Obtener holder de Fideitec
      const fideitecHolder = await dbClient.query(
        `SELECT id FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
        [id]
      );
      
      // Registrar transacción
      await dbClient.query(
        `INSERT INTO token_transactions (
          tenant_id, tokenized_asset_id, transaction_type,
          from_holder_id, amount, blockchain, tx_hash, block_number,
          status, reason, initiated_by, confirmed_at
        ) VALUES ($1, $2, 'burn', $3, $4, $5, $6, $7, 'confirmed', $8, $9, CURRENT_TIMESTAMP)`,
        [
          tenantId, id, fideitecHolder.rows[0].id,
          amount, tokenizedAsset.blockchain, burnResult.txHash, burnResult.blockNumber,
          reason, user.id
        ]
      );
      
    } catch (blockchainError) {
      await dbClient.query('ROLLBACK');
      console.error('Error quemando tokens:', blockchainError);
      return res.status(500).json({
        success: false,
        message: `Error en blockchain: ${blockchainError.message}`
      });
    }
    
    await dbClient.query('COMMIT');
    
    // Obtener datos actualizados
    const updatedAsset = await query(
      `SELECT * FROM v_tokenized_assets_summary WHERE id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: `${amount} tokens quemados exitosamente`,
      data: {
        tokenizedAsset: updatedAsset.rows[0],
        transaction: {
          txHash: burnResult.txHash,
          explorerLink: burnResult.explorerLink
        }
      }
    });
    
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error quemando tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Error al quemar tokens'
    });
  } finally {
    dbClient.release();
  }
};

/**
 * Emitir más tokens (mint adicional)
 */
const mintMoreTokens = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { id } = req.params;
    const { amount, reason } = req.body;
    
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'amount es requerido'
      });
    }
    
    await dbClient.query('BEGIN');
    
    // Verificar activo
    const assetResult = await dbClient.query(
      `SELECT ta.*, bc.contract_address 
       FROM tokenized_assets ta
       JOIN blockchain_contracts bc ON ta.contract_id = bc.id
       WHERE ta.id = $1 AND ta.tenant_id = $2`,
      [id, tenantId]
    );
    
    if (assetResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Activo tokenizado no encontrado'
      });
    }
    
    const tokenizedAsset = assetResult.rows[0];
    
    // Mint en blockchain
    let mintResult;
    try {
      mintResult = await blockchainService.mintTokens({
        contractAddress: tokenizedAsset.contract_address,
        tokenId: tokenizedAsset.token_id,
        amount,
        network: tokenizedAsset.blockchain
      });
      
      // Obtener holder de Fideitec
      const fideitecHolder = await dbClient.query(
        `SELECT id FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
        [id]
      );
      
      // Registrar transacción
      await dbClient.query(
        `INSERT INTO token_transactions (
          tenant_id, tokenized_asset_id, transaction_type,
          to_holder_id, to_address, amount, blockchain, tx_hash, block_number,
          status, reason, initiated_by, confirmed_at
        ) VALUES ($1, $2, 'mint', $3, $4, $5, $6, $7, $8, 'confirmed', $9, $10, CURRENT_TIMESTAMP)`,
        [
          tenantId, id, fideitecHolder.rows[0].id,
          mintResult.toAddress, amount, tokenizedAsset.blockchain,
          mintResult.txHash, mintResult.blockNumber, reason, user.id
        ]
      );
      
    } catch (blockchainError) {
      await dbClient.query('ROLLBACK');
      console.error('Error en mint:', blockchainError);
      return res.status(500).json({
        success: false,
        message: `Error en blockchain: ${blockchainError.message}`
      });
    }
    
    await dbClient.query('COMMIT');
    
    // Obtener datos actualizados
    const updatedAsset = await query(
      `SELECT * FROM v_tokenized_assets_summary WHERE id = $1`,
      [id]
    );
    
    res.json({
      success: true,
      message: `${amount} tokens emitidos exitosamente`,
      data: {
        tokenizedAsset: updatedAsset.rows[0],
        transaction: {
          txHash: mintResult.txHash,
          explorerLink: mintResult.explorerLink
        }
      }
    });
    
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error emitiendo tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Error al emitir tokens'
    });
  } finally {
    dbClient.release();
  }
};

// ===========================================
// CONSULTAS
// ===========================================

/**
 * Obtener tokens de un cliente
 */
const getClientTokens = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { clientId } = req.params;
    
    const result = await query(
      `SELECT * FROM v_token_holders_detail 
       WHERE tenant_id = $1 AND client_id = $2 AND balance > 0`,
      [tenantId, clientId]
    );
    
    res.json({
      success: true,
      data: { tokens: result.rows }
    });
    
  } catch (error) {
    console.error('Error obteniendo tokens del cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener tokens'
    });
  }
};

/**
 * Obtener historial de transacciones
 */
const getTransactionHistory = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { tokenizedAssetId } = req.query;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['tenant_id = $1'];
    const params = [tenantId, limit, offset];
    let paramCount = 4;
    
    if (tokenizedAssetId) {
      whereConditions.push(`tokenized_asset_id = $${paramCount}`);
      params.push(tokenizedAssetId);
      paramCount++;
    }
    
    const result = await query(
      `SELECT * FROM v_token_transactions_detail 
       WHERE ${whereConditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );
    
    res.json({
      success: true,
      data: {
        transactions: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit)
        }
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial'
    });
  }
};

/**
 * Estadísticas de tokenización
 */
const getTokenizationStats = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    
    const stats = await query(
      `SELECT 
        COUNT(*) as total_tokenized,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COALESCE(SUM(total_supply), 0) as total_tokens_issued,
        COALESCE(SUM(circulating_supply), 0) as tokens_in_circulation,
        COALESCE(SUM(burned_supply), 0) as tokens_burned,
        COALESCE(SUM(total_supply * token_price), 0) as total_value
       FROM tokenized_assets
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const byType = await query(
      `SELECT asset_type, COUNT(*) as count, COALESCE(SUM(total_supply), 0) as tokens
       FROM tokenized_assets
       WHERE tenant_id = $1
       GROUP BY asset_type`,
      [tenantId]
    );
    
    const recentTransactions = await query(
      `SELECT transaction_type, COUNT(*) as count
       FROM token_transactions
       WHERE tenant_id = $1 AND created_at > NOW() - INTERVAL '30 days'
       GROUP BY transaction_type`,
      [tenantId]
    );
    
    res.json({
      success: true,
      data: {
        stats: stats.rows[0],
        byType: byType.rows,
        recentActivity: recentTransactions.rows
      }
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

module.exports = {
  // Blockchain status
  getBlockchainStatus,
  
  // Contratos
  deployContract,
  listContracts,
  
  // Tokenización
  tokenizeAsset,
  listTokenizedAssets,
  getTokenizedAsset,
  
  // Operaciones de tokens
  transferToClient,
  returnFromClient,
  burnTokens,
  mintMoreTokens,
  
  // Consultas
  getClientTokens,
  getTransactionHistory,
  getTokenizationStats
};

