/**
 * FIDEITEC - Rutas de Tokenización
 * 
 * API endpoints para gestión de tokens, órdenes y certificados
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const tokenizationController = require('../controllers/tokenizationController');
const orderService = require('../services/orderService');
const certificateService = require('../services/certificateService');

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
 */
router.post(
  '/assets/:id/transfer',
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
 * Crear orden de compra
 * Body: { tokenizedAssetId, clientId, tokenAmount, paymentMethod, notes? }
 */
router.post('/orders/buy', requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const { tokenizedAssetId, clientId, tokenAmount, paymentMethod, notes } = req.body;
    const order = await orderService.createBuyOrder({
      tenantId: req.user.tenant_id,
      tokenizedAssetId,
      clientId,
      tokenAmount: parseInt(tokenAmount),
      paymentMethod,
      notes
    });
    res.status(201).json({
      success: true,
      message: 'Orden de compra creada',
      data: order
    });
  } catch (error) {
    console.error('Error creando orden de compra:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/tokenization/orders/sell
 * Crear orden de venta
 * Body: { tokenizedAssetId, clientId, tokenAmount, bankName, bankAccountNumber, etc. }
 */
router.post('/orders/sell', requireRole(['admin', 'root', 'manager']), async (req, res) => {
  try {
    const { 
      tokenizedAssetId, clientId, tokenAmount,
      bankName, bankAccountType, bankAccountNumber, bankCbuAlias, notes 
    } = req.body;
    const order = await orderService.createSellOrder({
      tenantId: req.user.tenant_id,
      tokenizedAssetId,
      clientId,
      tokenAmount: parseInt(tokenAmount),
      bankName, bankAccountType, bankAccountNumber, bankCbuAlias, notes
    });
    res.status(201).json({
      success: true,
      message: 'Orden de venta creada',
      data: order
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

