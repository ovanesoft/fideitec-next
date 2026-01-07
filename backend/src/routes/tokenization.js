/**
 * FIDEITEC - Rutas de Tokenización
 * 
 * API endpoints para gestión de tokens, órdenes y certificados
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { checkOperationLimit, registerOperation } = require('../middleware/operationLimit');
const tokenizationController = require('../controllers/tokenizationController');
const orderService = require('../services/orderService');
const certificateService = require('../services/certificateService');
const approvalService = require('../services/approvalService');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ===========================================
// ESTADO Y CONFIGURACIÓN
// ===========================================

/**
 * GET /api/tokenization/status
 * Verificar estado de configuración blockchain
 */
router.get('/status', tokenizationController.getBlockchainStatus);

/**
 * GET /api/tokenization/stats
 * Estadísticas de tokenización del tenant
 */
router.get('/stats', tokenizationController.getTokenizationStats);

// ===========================================
// CONTRATOS
// ===========================================

/**
 * GET /api/tokenization/contracts
 * Listar contratos del tenant
 */
router.get('/contracts', tokenizationController.listContracts);

/**
 * POST /api/tokenization/contracts/deploy
 * Registrar contrato (desplegado desde Thirdweb)
 * Body: { name, description, contract_address }
 */
router.post(
  '/contracts/deploy',
  requireRole(['admin', 'root']),
  tokenizationController.deployContract
);

// ===========================================
// ACTIVOS TOKENIZADOS
// ===========================================

/**
 * GET /api/tokenization/assets
 * Listar activos tokenizados
 * Query: ?status=active&asset_type=asset
 */
router.get('/assets', tokenizationController.listTokenizedAssets);

/**
 * GET /api/tokenization/assets/:id
 * Obtener detalle de un activo tokenizado
 */
router.get('/assets/:id', tokenizationController.getTokenizedAsset);

/**
 * POST /api/tokenization/assets/:id/activate
 * Activar un token (cambiar de draft a active)
 */
router.post(
  '/assets/:id/activate',
  requireRole(['admin', 'root', 'manager']),
  tokenizationController.activateToken
);

/**
 * POST /api/tokenization/assets
 * Tokenizar un activo
 * Body: {
 *   asset_type: 'asset' | 'asset_unit' | 'trust',
 *   asset_id | asset_unit_id | trust_id,
 *   contract_id,
 *   total_supply,
 *   token_price,
 *   token_name,
 *   token_symbol
 * }
 */
router.post(
  '/assets',
  requireRole(['admin', 'root', 'manager']),
  tokenizationController.tokenizeAsset
);

// ===========================================
// OPERACIONES DE TOKENS (Admin)
// ===========================================

/**
 * POST /api/tokenization/assets/:id/transfer
 * Transferir/Endosar tokens a un cliente (admin manual)
 * Body: { client_id, amount, reason?, reference_id? }
 * NOTA: Esta operación está sujeta a rate limiting (3/hora)
 */
router.post(
  '/assets/:id/transfer',
  checkOperationLimit,
  requireRole(['admin', 'root', 'manager']),
  tokenizationController.transferToClient
);

/**
 * POST /api/tokenization/assets/:id/return
 * Recibir tokens de vuelta de un cliente (admin manual)
 * Body: { client_id, amount, reason?, reference_id? }
 */
router.post(
  '/assets/:id/return',
  requireRole(['admin', 'root', 'manager']),
  tokenizationController.returnFromClient
);

/**
 * POST /api/tokenization/assets/:id/burn
 * Quemar tokens
 * Body: { amount, reason? }
 */
router.post(
  '/assets/:id/burn',
  requireRole(['admin', 'root']),
  tokenizationController.burnTokens
);

/**
 * POST /api/tokenization/assets/:id/mint
 * Emitir más tokens
 * Body: { amount, reason? }
 */
router.post(
  '/assets/:id/mint',
  requireRole(['admin', 'root']),
  tokenizationController.mintMoreTokens
);

// ===========================================
// ÓRDENES DE COMPRA/VENTA
// ===========================================

/**
 * GET /api/tokenization/orders
 * Listar órdenes del tenant
 * Query: ?status=pending&orderType=buy&clientId=uuid&page=1&limit=20
 */
router.get('/orders', async (req, res) => {
  try {
    const { status, orderType, clientId, page, limit } = req.query;
    const orders = await orderService.getOrders(req.user.tenant_id, {
      status, orderType, clientId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.json({ success: true, data: { orders } });
  } catch (error) {
    console.error('Error obteniendo órdenes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tokenization/orders/stats
 * Estadísticas de órdenes
 */
router.get('/orders/stats', async (req, res) => {
  try {
    const stats = await orderService.getOrderStats(req.user.tenant_id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error obteniendo stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tokenization/orders/:id
 * Obtener detalle de una orden
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.tenant_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('Error obteniendo orden:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/orders/buy
 * Crear orden de compra (queda pendiente de aprobación)
 * Body: { tokenizedAssetId, clientId, tokenAmount, paymentMethod, notes? }
 */
router.post('/orders/buy', checkOperationLimit, requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const { tokenizedAssetId, clientId, tokenAmount, paymentMethod, notes } = req.body;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Crear orden
    const order = await orderService.createBuyOrder({
      tenantId,
      tokenizedAssetId,
      clientId,
      tokenAmount: parseInt(tokenAmount),
      paymentMethod,
      notes,
      status: 'pending_approval' // Crear como pendiente
    });

    // Registrar operación para rate limiting
    await registerOperation(tenantId, userId, 'buy_order');

    // Registrar en auditoría
    await approvalService.logAuditEntry({
      tenantId,
      entityType: 'token_order',
      entityId: order.id,
      action: 'created',
      newStatus: 'pending_approval',
      requestedBy: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      operationDetails: {
        orderType: 'buy',
        tokenAmount: parseInt(tokenAmount),
        clientId
      }
    });

    res.status(201).json({
      success: true,
      message: '🔔 Orden de compra creada y pendiente de aprobación',
      data: order,
      operationsRemaining: req.operationsRemaining,
      requiresApproval: true
    });
  } catch (error) {
    console.error('Error creando orden de compra:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/orders/sell
 * Crear orden de venta (queda pendiente de aprobación)
 * Body: { tokenizedAssetId, clientId, tokenAmount, bankName, bankAccountNumber, etc. }
 */
router.post('/orders/sell', checkOperationLimit, requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const { 
      tokenizedAssetId, clientId, tokenAmount,
      bankName, bankAccountType, bankAccountNumber, bankCbuAlias, notes 
    } = req.body;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    const order = await orderService.createSellOrder({
      tenantId,
      tokenizedAssetId,
      clientId,
      tokenAmount: parseInt(tokenAmount),
      bankName, bankAccountType, bankAccountNumber, bankCbuAlias, notes,
      status: 'pending_approval' // Crear como pendiente
    });

    // Registrar operación para rate limiting
    await registerOperation(tenantId, userId, 'sell_order');

    // Registrar en auditoría
    await approvalService.logAuditEntry({
      tenantId,
      entityType: 'token_order',
      entityId: order.id,
      action: 'created',
      newStatus: 'pending_approval',
      requestedBy: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      operationDetails: {
        orderType: 'sell',
        tokenAmount: parseInt(tokenAmount),
        clientId
      }
    });

    res.status(201).json({
      success: true,
      message: '🔔 Orden de venta creada y pendiente de aprobación',
      data: order,
      operationsRemaining: req.operationsRemaining,
      requiresApproval: true
    });
  } catch (error) {
    console.error('Error creando orden de venta:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/orders/:id/confirm-payment
 * Confirmar recepción de pago
 * Body: { paymentReference, paymentProofUrl? }
 */
router.post('/orders/:id/confirm-payment', requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const { paymentReference, paymentProofUrl } = req.body;
    const order = await orderService.confirmPayment(
      req.params.id,
      { paymentReference, paymentProofUrl },
      req.user.id
    );
    res.json({
      success: true,
      message: 'Pago confirmado',
      data: order
    });
  } catch (error) {
    console.error('Error confirmando pago:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/orders/:id/complete
 * Completar orden (transferir tokens y generar certificado)
 */
router.post('/orders/:id/complete', requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.tenant_id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    let result;
    if (order.order_type === 'buy') {
      result = await orderService.completeBuyOrder(req.params.id, req.user.id);
    } else {
      const { paymentReference, paymentProofUrl } = req.body;
      result = await orderService.completeSellOrder(
        req.params.id,
        { paymentReference, paymentProofUrl },
        req.user.id
      );
    }

    res.json({
      success: true,
      message: 'Orden completada exitosamente',
      data: result
    });
  } catch (error) {
    console.error('Error completando orden:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/orders/:id/cancel
 * Cancelar orden
 * Body: { reason }
 */
router.post('/orders/:id/cancel', requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.params.id, reason, req.user.id);
    res.json({
      success: true,
      message: 'Orden cancelada',
      data: order
    });
  } catch (error) {
    console.error('Error cancelando orden:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ===========================================
// CERTIFICADOS
// ===========================================

/**
 * GET /api/tokenization/certificates
 * Listar certificados del tenant
 * Query: ?clientId=uuid&status=active
 */
router.get('/certificates', async (req, res) => {
  try {
    const { clientId, status } = req.query;
    let query = `SELECT * FROM v_token_certificates_detail WHERE tenant_id = $1`;
    const params = [req.user.tenant_id];
    
    if (clientId) {
      query += ` AND client_id = $2`;
      params.push(clientId);
    }
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    query += ` ORDER BY issued_at DESC`;

    const { query: dbQuery } = require('../config/database');
    const result = await dbQuery(query, params);
    
    res.json({ success: true, data: { certificates: result.rows } });
  } catch (error) {
    console.error('Error obteniendo certificados:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tokenization/certificates/:id
 * Obtener certificado por ID
 */
router.get('/certificates/:id', async (req, res) => {
  try {
    const { query: dbQuery } = require('../config/database');
    const result = await dbQuery(
      `SELECT * FROM v_token_certificates_detail WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificado no encontrado' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error obteniendo certificado:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tokenization/certificates/:id/html
 * Obtener HTML del certificado (para generar PDF)
 */
router.get('/certificates/:id/html', async (req, res) => {
  try {
    const html = await certificateService.generateCertificateHTML(req.params.id);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error generando HTML:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/certificates/:id/revoke
 * Revocar certificado
 * Body: { reason }
 */
router.post('/certificates/:id/revoke', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { reason } = req.body;
    const certificate = await certificateService.revokeCertificate(
      req.params.id, reason, req.user.id
    );
    res.json({
      success: true,
      message: 'Certificado revocado',
      data: certificate
    });
  } catch (error) {
    console.error('Error revocando certificado:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/certificates/:id/certify-blockchain
 * Anclar certificado en blockchain
 */
router.post('/certificates/:id/certify-blockchain', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { query: dbQuery } = require('../config/database');
    const blockchainService = require('../services/blockchainService');
    const { checkConfiguration, DEFAULT_NETWORK } = require('../config/blockchain');
    
    // Verificar configuración blockchain
    const config = checkConfiguration();
    if (!config.isConfigured) {
      return res.status(400).json({
        success: false,
        message: 'Blockchain no está configurada',
        errors: config.errors
      });
    }
    
    // Obtener certificado
    const certResult = await dbQuery(
      `SELECT * FROM token_certificates WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user.tenant_id]
    );
    
    if (certResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Certificado no encontrado' });
    }
    
    const certificate = certResult.rows[0];
    
    if (certificate.is_blockchain_certified) {
      return res.status(400).json({
        success: false,
        message: 'Este certificado ya está certificado en blockchain',
        txHash: certificate.blockchain_tx_hash
      });
    }
    
    if (!certificate.pdf_hash) {
      return res.status(400).json({
        success: false,
        message: 'El certificado no tiene hash generado'
      });
    }
    
    // Anclar en blockchain
    const result = await blockchainService.anchorCertificateHash({
      certificateHash: certificate.pdf_hash,
      certificateId: certificate.id,
      network: DEFAULT_NETWORK
    });
    
    // Actualizar certificado
    await certificateService.setCertificateBlockchainInfo(certificate.id, {
      blockchain: DEFAULT_NETWORK,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      timestamp: result.timestamp
    });
    
    res.json({
      success: true,
      message: 'Certificado anclado en blockchain exitosamente',
      data: {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        explorerLink: result.explorerLink
      }
    });
    
  } catch (error) {
    console.error('Error certificando en blockchain:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===========================================
// COMPRA INSTANTÁNEA (para demo/testing sin KYC)
// ===========================================

/**
 * POST /api/tokenization/instant-buy
 * Compra instantánea de tokens (AHORA REQUIERE APROBACIÓN)
 * 
 * Este endpoint crea la orden como PENDIENTE DE APROBACIÓN.
 * El flujo completo se ejecuta cuando el admin aprueba.
 * 
 * Flujo:
 * 1. Crea la orden como pending_approval
 * 2. Aparece en el dashboard como alerta
 * 3. Admin aprueba y ejecuta
 * 4. Se transfieren tokens, genera certificado, doble firma, blockchain
 * 
 * Body: { tokenizedAssetId, clientId, tokenAmount }
 */
router.post('/instant-buy', checkOperationLimit, async (req, res) => {
  const { getClient } = require('../config/database');
  
  const dbClient = await getClient();
  
  try {
    const { tokenizedAssetId, clientId, tokenAmount } = req.body;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    console.log('🛒 Creando orden de compra (pendiente de aprobación)...');

    // Validaciones
    if (!tokenizedAssetId || !clientId || !tokenAmount) {
      return res.status(400).json({
        success: false,
        message: 'tokenizedAssetId, clientId y tokenAmount son requeridos'
      });
    }

    await dbClient.query('BEGIN');

    // 1. Verificar activo tokenizado
    const assetResult = await dbClient.query(
      `SELECT ta.*, 
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name
       FROM tokenized_assets ta
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE ta.id = $1 AND ta.tenant_id = $2 AND ta.status = 'active'`,
      [tokenizedAssetId, tenantId]
    );

    if (assetResult.rows.length === 0) {
      throw new Error('Activo tokenizado no encontrado o inactivo');
    }
    const asset = assetResult.rows[0];

    if (asset.fideitec_balance < tokenAmount) {
      throw new Error(`Tokens insuficientes. Disponibles: ${asset.fideitec_balance}`);
    }

    // 2. Verificar cliente
    const clientResult = await dbClient.query(
      `SELECT * FROM clients WHERE id = $1 AND tenant_id = $2`,
      [clientId, tenantId]
    );
    if (clientResult.rows.length === 0) {
      throw new Error('Cliente no encontrado');
    }
    const client = clientResult.rows[0];

    console.log(`✅ Cliente: ${client.first_name} ${client.last_name}`);
    console.log(`✅ Activo: ${asset.token_name} (${asset.token_symbol})`);
    console.log(`✅ Cantidad: ${tokenAmount} tokens`);

    // 3. Calcular valores
    const pricePerToken = parseFloat(asset.token_price);
    const totalAmount = pricePerToken * tokenAmount;

    // 4. Crear orden como PENDIENTE DE APROBACIÓN
    const orderNumberResult = await dbClient.query(
      `SELECT generate_order_number($1, 'buy') as order_number`,
      [tenantId]
    );
    const orderNumber = orderNumberResult.rows[0].order_number;

    const orderResult = await dbClient.query(
      `INSERT INTO token_orders (
        tenant_id, tokenized_asset_id, client_id, order_type,
        order_number, token_amount, price_per_token, subtotal,
        fees, taxes, total_amount, currency, payment_method,
        status, requires_approval, created_by
      ) VALUES ($1, $2, $3, 'buy', $4, $5, $6, $7, 0, 0, $7, $8, 'instant', 
        'pending_approval', true, $9)
      RETURNING *`,
      [tenantId, tokenizedAssetId, clientId, orderNumber, tokenAmount, pricePerToken, 
       totalAmount, asset.currency || 'USD', userId]
    );
    const order = orderResult.rows[0];

    await dbClient.query('COMMIT');
    console.log(`✅ Orden creada como pendiente: ${orderNumber}`);

    // 5. Registrar operación para rate limiting
    await registerOperation(tenantId, userId, 'instant_buy');

    // 6. Registrar en auditoría
    await approvalService.logAuditEntry({
      tenantId,
      entityType: 'token_order',
      entityId: order.id,
      action: 'created',
      newStatus: 'pending_approval',
      requestedBy: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      operationDetails: {
        orderNumber,
        orderType: 'instant_buy',
        tokenAmount: parseInt(tokenAmount),
        totalAmount,
        clientId,
        clientName: `${client.first_name} ${client.last_name}`,
        assetName: asset.asset_name,
        tokenName: asset.token_name
      }
    });

    // 7. Respuesta
    res.status(201).json({
      success: true,
      message: '🔔 Orden creada y pendiente de aprobación. Un administrador debe aprobarla para ejecutar la operación.',
      requiresApproval: true,
      data: {
        order: {
          id: order.id,
          orderNumber: orderNumber,
          status: 'pending_approval',
          tokenAmount: tokenAmount,
          pricePerToken: pricePerToken,
          totalAmount: totalAmount,
          currency: asset.currency || 'USD',
          client: {
            name: `${client.first_name} ${client.last_name}`,
            document: client.document_number
          },
          asset: {
            name: asset.asset_name,
            tokenName: asset.token_name,
            tokenSymbol: asset.token_symbol
          }
        },
        operationsRemaining: req.operationsRemaining,
        nextStep: 'Un administrador debe aprobar esta operación desde el panel de aprobaciones.'
      }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('❌ Error creando orden:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  } finally {
    dbClient.release();
  }
});

/**
 * GET /api/tokenization/available-tokens
 * Lista tokens disponibles para comprar (sin autenticación especial)
 */
router.get('/available-tokens', async (req, res) => {
  try {
    const { query: dbQuery } = require('../config/database');
    const result = await dbQuery(
      `SELECT ta.id, ta.token_name, ta.token_symbol, ta.token_price, 
              ta.total_supply, ta.fideitec_balance as available,
              ta.currency, ta.status, ta.asset_type,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name
       FROM tokenized_assets ta
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE ta.tenant_id = $1 AND ta.status = 'active' AND ta.fideitec_balance > 0
       ORDER BY ta.created_at DESC`,
      [req.user.tenant_id]
    );
    
    res.json({
      success: true,
      data: { tokens: result.rows }
    });
  } catch (error) {
    console.error('Error obteniendo tokens disponibles:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===========================================
// VERIFICACIÓN PÚBLICA (sin auth)
// ===========================================

// Este endpoint no requiere autenticación
router.get('/verify/:code', async (req, res) => {
  try {
    const certificate = await certificateService.getCertificateByVerificationCode(req.params.code);
    
    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificado no encontrado',
        valid: false
      });
    }

    res.json({
      success: true,
      valid: certificate.status === 'active',
      data: {
        certificateNumber: certificate.certificate_number,
        status: certificate.status,
        beneficiaryName: certificate.beneficiary_name,
        tokenName: certificate.token_name,
        tokenAmount: certificate.token_amount,
        issuedAt: certificate.issued_at,
        isBlockchainCertified: certificate.is_blockchain_certified,
        blockchainTxHash: certificate.blockchain_tx_hash
      }
    });
  } catch (error) {
    console.error('Error verificando certificado:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===========================================
// CONSULTAS GENERALES
// ===========================================

/**
 * GET /api/tokenization/clients/:clientId/tokens
 * Obtener tokens de un cliente
 */
router.get('/clients/:clientId/tokens', tokenizationController.getClientTokens);

/**
 * GET /api/tokenization/clients/:clientId/certificates
 * Obtener certificados de un cliente
 */
router.get('/clients/:clientId/certificates', async (req, res) => {
  try {
    const certificates = await certificateService.getClientCertificates(
      req.params.clientId, req.user.tenant_id
    );
    res.json({ success: true, data: { certificates } });
  } catch (error) {
    console.error('Error obteniendo certificados:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tokenization/clients/:clientId/orders
 * Obtener órdenes de un cliente
 */
router.get('/clients/:clientId/orders', async (req, res) => {
  try {
    const orders = await orderService.getClientOrders(
      req.params.clientId, req.user.tenant_id
    );
    res.json({ success: true, data: { orders } });
  } catch (error) {
    console.error('Error obteniendo órdenes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/tokenization/transactions
 * Obtener historial de transacciones
 * Query: ?tokenizedAssetId=uuid&page=1&limit=50
 */
router.get('/transactions', tokenizationController.getTransactionHistory);

module.exports = router;

