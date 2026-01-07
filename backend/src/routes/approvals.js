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
 * Rechazar una operación
 * Body: { reason, notes? }
 */
router.post('/:orderId/reject', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar una razón para el rechazo'
      });
    }

    const result = await approvalService.rejectOperation(
      orderId,
      req.user.tenant_id,
      req.user.id,
      {
        reason,
        notes,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    );

    res.json(result);
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
 * Ejecutar una operación aprobada (transferir tokens, generar certificado, firmar)
 */
router.post('/:orderId/execute', requireRole(['admin', 'root']), async (req, res) => {
  try {
    const { orderId } = req.params;
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    // Verificar que la orden está aprobada
    const orderResult = await query(
      `SELECT * FROM token_orders WHERE id = $1 AND tenant_id = $2`,
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

    // Ejecutar según tipo de orden
    let result;
    if (order.order_type === 'buy') {
      result = await orderService.completeBuyOrder(orderId, userId);
    } else {
      result = await orderService.completeSellOrder(orderId, {}, userId);
    }

    // Aplicar doble firma si hay certificado
    if (result.certificate?.id) {
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
        certificateId: result.certificate?.id
      }
    });

    res.json({
      success: true,
      message: 'Operación ejecutada exitosamente',
      data: result
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

