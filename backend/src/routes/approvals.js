/**
 * FIDEITEC - Rutas de Aprobaciones y Configuración de Billetera
 * 
 * Endpoints para:
 * - Configurar billetera del tenant
 * - Ver aprobaciones pendientes
 * - Aprobar/rechazar operaciones
 * - Ver historial de auditoría
 * - Verificar estado de rate limiting
 */

const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getOperationStats } = require('../middleware/operationLimit');
const approvalService = require('../services/approvalService');
const { query } = require('../config/database');

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// ===========================================
// CONFIGURACIÓN DE BILLETERA
// ===========================================

/**
 * GET /api/approvals/wallet-config
 * Obtener configuración de billetera del tenant
 */
router.get('/wallet-config', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const config = await approvalService.getTenantWalletConfig(req.user.tenant_id);
    
    res.json({
      success: true,
      data: config || {
        blockchain_enabled: false,
        blockchain_wallet_address: null,
        has_private_key: false
      }
    });
  } catch (error) {
    console.error('Error obteniendo config de billetera:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/approvals/toggle-dual-signature
 * Activar/desactivar doble firma
 * Body: { enabled: boolean }
 */
router.post('/toggle-dual-signature', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'El campo "enabled" debe ser true o false'
      });
    }

    const result = await approvalService.toggleDualSignature(
      req.user.tenant_id,
      enabled,
      req.user.id
    );

    res.json({
      success: true,
      message: enabled 
        ? '🔐 Doble firma activada. Los certificados ahora requieren firma del tenant + Fideitec.' 
        : '✅ Doble firma desactivada. Los certificados solo llevarán firma de Fideitec.',
      data: {
        dual_signature_enabled: result.dual_signature_enabled
      }
    });
  } catch (error) {
    console.error('Error toggling dual signature:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/approvals/wallet-config
 * Configurar billetera del tenant
 * Body: { walletAddress, privateKey? }
 */
router.post('/wallet-config', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { walletAddress, privateKey } = req.body;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'La dirección de billetera es requerida'
      });
    }

    const result = await approvalService.configureTenantWallet(
      req.user.tenant_id,
      req.user.id,
      { walletAddress, privateKey }
    );

    res.json({
      success: true,
      message: 'Billetera configurada correctamente',
      data: result
    });
  } catch (error) {
    console.error('Error configurando billetera:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ===========================================
// APROBACIONES PENDIENTES
// ===========================================

/**
 * GET /api/approvals/pending
 * Obtener aprobaciones pendientes del tenant
 */
router.get('/pending', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const pending = await approvalService.getPendingApprovals(req.user.tenant_id);
    
    res.json({
      success: true,
      data: {
        count: pending.length,
        approvals: pending
      }
    });
  } catch (error) {
    console.error('Error obteniendo pendientes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/approvals/pending/count
 * Obtener solo el conteo de aprobaciones pendientes (para badge)
 */
router.get('/pending/count', async (req, res) => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM token_orders 
       WHERE tenant_id = $1 AND status = 'pending_approval'`,
      [req.user.tenant_id]
    );
    
    res.json({
      success: true,
      count: parseInt(result.rows[0].count) || 0
    });
  } catch (error) {
    console.error('Error contando pendientes:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/approvals/:orderId/approve
 * Aprobar una operación
 * Body: { notes? }
 */
router.post('/:orderId/approve', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { notes } = req.body;

    const result = await approvalService.approveOperation(
      orderId,
      req.user.tenant_id,
      req.user.id,
      {
        notes,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.json(result);
  } catch (error) {
    console.error('Error aprobando operación:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/approvals/:orderId/reject
 * Rechazar una operación y notificar al cliente
 * Body: { reason, notes? }
 */
router.post('/:orderId/reject', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, notes } = req.body;
    const tenantId = req.user.tenant_id;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una razón para el rechazo'
      });
    }

    // Obtener datos de la orden y cliente antes de rechazar
    const orderResult = await query(
      `SELECT o.*, c.email as client_email, c.first_name as client_first_name,
              ta.token_name, ta.token_symbol
       FROM token_orders o
       JOIN clients c ON o.client_id = c.id
       JOIN tokenized_assets ta ON o.tokenized_asset_id = ta.id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [orderId, tenantId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    const result = await approvalService.rejectOperation(
      orderId,
      tenantId,
      req.user.id,
      {
        reason,
        notes,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    // Enviar email al cliente notificando el rechazo
    if (order.client_email) {
      try {
        const { sendTokenPurchaseRejectedEmail } = require('../utils/email');
        
        // Obtener portal URL del tenant
        const tenantResult = await query(
          `SELECT client_portal_token FROM tenants WHERE id = $1`,
          [tenantId]
        );
        const portalToken = tenantResult.rows[0]?.client_portal_token;
        const portalUrl = portalToken 
          ? `${process.env.FRONTEND_URL}/portal/${portalToken}/dashboard`
          : process.env.FRONTEND_URL;

        await sendTokenPurchaseRejectedEmail(
          order.client_email,
          order.client_first_name || 'Estimado/a cliente',
          {
            tokenAmount: order.token_amount,
            tokenName: order.token_name,
            tokenSymbol: order.token_symbol,
            reason,
            portalUrl
          }
        );
        console.log(`📧 Email de rechazo enviado a: ${order.client_email}`);
      } catch (emailError) {
        console.error('❌ Error enviando email de rechazo:', emailError.message);
      }
    }

    res.json({
      ...result,
      message: 'Operación rechazada. Se ha notificado al cliente.'
    });
  } catch (error) {
    console.error('Error rechazando operación:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ===========================================
// EJECUTAR OPERACIÓN APROBADA
// ===========================================

/**
 * POST /api/approvals/:orderId/execute
 * Ejecutar una operación aprobada (transferir tokens, generar certificado, blockchain, enviar email)
 */
router.post('/:orderId/execute', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Verificar que la orden está aprobada y obtener datos del cliente
    const orderResult = await query(
      `SELECT o.*, c.email as client_email, c.first_name as client_first_name,
              ta.token_name, ta.token_symbol
       FROM token_orders o
       JOIN clients c ON o.client_id = c.id
       JOIN tokenized_assets ta ON o.tokenized_asset_id = ta.id
       WHERE o.id = $1 AND o.tenant_id = $2`,
      [orderId, tenantId]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    if (order.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: `La orden tiene estado "${order.status}". Solo se pueden ejecutar órdenes aprobadas.`
      });
    }

    // Importar servicios necesarios
    const orderService = require('../services/orderService');
    const certificateService = require('../services/certificateService');
    const blockchainService = require('../services/blockchainService');
    const { sendTokenPurchaseCompletedEmail } = require('../utils/email');

    // Ejecutar según tipo de orden
    let result;
    if (order.order_type === 'buy') {
      result = await orderService.completeBuyOrder(orderId, userId);
    } else {
      result = await orderService.completeSellOrder(orderId, {}, userId);
    }

    // Anclar en blockchain con los timestamps
    let blockchainResult = null;
    if (result.certificate?.id) {
      try {
        console.log(`⛓️ Anclando certificado en blockchain...`);
        
        // Crear hash que incluye ambos timestamps
        const dataToAnchor = {
          certificateHash: result.certificate.pdf_hash || result.certificate.verification_code,
          certificateId: result.certificate.id,
          certificateNumber: result.certificate.certificate_number,
          // Incluir timestamps importantes
          clientRequestedAt: order.created_at, // Momento de intención del cliente
          approvedAt: order.approved_at,        // Momento de aprobación del tenant
          executedAt: new Date().toISOString()  // Momento de ejecución
        };
        
        blockchainResult = await blockchainService.anchorCertificateHash(dataToAnchor);
        console.log(`✅ Blockchain OK: ${blockchainResult.txHash}`);

        // Actualizar certificado con info de blockchain
        await certificateService.setCertificateBlockchainInfo(result.certificate.id, {
          blockchain: blockchainResult.network,
          txHash: blockchainResult.txHash,
          blockNumber: blockchainResult.blockNumber,
          timestamp: blockchainResult.timestamp
        });
      } catch (blockchainError) {
        console.error('❌ Error anclando en blockchain:', blockchainError.message);
      }

      // Aplicar doble firma
      try {
        const signResult = await approvalService.applyDualSignature(result.certificate.id, tenantId);
        result.dualSignature = signResult;
      } catch (signError) {
        console.warn('No se pudo aplicar doble firma:', signError.message);
        result.dualSignature = { success: false, error: signError.message };
      }
    }

    // Registrar en auditoría
    await approvalService.logAuditEntry({
      tenantId,
      entityType: 'token_order',
      entityId: orderId,
      action: 'executed',
      previousStatus: 'approved',
      newStatus: 'completed',
      decidedBy: userId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      operationDetails: {
        orderNumber: order.order_number,
        tokenAmount: order.token_amount,
        certificateId: result.certificate?.id,
        blockchainTxHash: blockchainResult?.txHash
      }
    });

    // Enviar email al cliente notificando que su compra fue completada
    if (order.order_type === 'buy' && order.client_email) {
      try {
        // Obtener portal URL del tenant
        const tenantResult = await query(
          `SELECT client_portal_token FROM tenants WHERE id = $1`,
          [tenantId]
        );
        const portalToken = tenantResult.rows[0]?.client_portal_token;
        const portalUrl = portalToken 
          ? `${process.env.FRONTEND_URL}/portal/${portalToken}/dashboard`
          : process.env.FRONTEND_URL;

        await sendTokenPurchaseCompletedEmail(
          order.client_email,
          order.client_first_name || 'Estimado/a cliente',
          {
            tokenAmount: order.token_amount,
            tokenName: order.token_name,
            tokenSymbol: order.token_symbol,
            totalAmount: order.total_amount,
            currency: order.currency,
            certificateNumber: result.certificate?.certificate_number,
            blockchainTxHash: blockchainResult?.txHash,
            explorerLink: blockchainResult?.explorerLink,
            portalUrl
          }
        );
        console.log(`📧 Email de compra completada enviado a: ${order.client_email}`);
      } catch (emailError) {
        console.error('❌ Error enviando email de compra completada:', emailError.message);
      }
    }

    res.json({
      success: true,
      message: 'Operación ejecutada exitosamente. Se ha notificado al cliente.',
      data: {
        ...result,
        blockchain: blockchainResult ? {
          txHash: blockchainResult.txHash,
          explorerLink: blockchainResult.explorerLink,
          network: blockchainResult.network
        } : null
      }
    });
  } catch (error) {
    console.error('Error ejecutando operación:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ===========================================
// RATE LIMITING
// ===========================================

/**
 * GET /api/approvals/rate-limit-status
 * Obtener estado de rate limiting del usuario actual
 */
router.get('/rate-limit-status', async (req, res) => {
  try {
    const stats = await getOperationStats(req.user.tenant_id, req.user.id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error obteniendo rate limit status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===========================================
// AUDITORÍA
// ===========================================

/**
 * GET /api/approvals/audit
 * Obtener historial de auditoría
 * Query: ?entityType=token_order&entityId=uuid&limit=50
 */
router.get('/audit', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { entityType, entityId, limit } = req.query;

    const history = await approvalService.getAuditHistory(req.user.tenant_id, {
      entityType,
      entityId,
      limit: parseInt(limit) || 50
    });

    res.json({
      success: true,
      data: { history }
    });
  } catch (error) {
    console.error('Error obteniendo auditoría:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ===========================================
// VERIFICACIÓN DE FIRMAS
// ===========================================

/**
 * GET /api/approvals/verify-signature/:certificateId
 * Verificar doble firma de un certificado
 */
router.get('/verify-signature/:certificateId', async (req, res) => {
  try {
    const verification = await approvalService.verifyDualSignature(req.params.certificateId);

    res.json({
      success: true,
      data: verification
    });
  } catch (error) {
    console.error('Error verificando firma:', error);
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

