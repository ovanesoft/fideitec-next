/**
 * FIDEITEC - Servicio de Aprobaciones y Doble Firma
 * 
 * Maneja:
 * - Configuración de billetera por tenant
 * - Flujo de aprobación de operaciones
 * - Sistema de doble firma (tenant + Fideitec)
 * - Registro de auditoría
 */

const { query, getClient } = require('../config/database');
const crypto = require('crypto');
const { ethers } = require('ethers');

// ===========================================
// ENCRIPTACIÓN DE CLAVES
// ===========================================

const ALGORITHM = 'aes-256-gcm';

/**
 * Encriptar clave privada del tenant
 */
const encryptPrivateKey = (privateKey) => {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY no configurada en el servidor');
  }

  const key = Buffer.from(encryptionKey, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Formato: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Desencriptar clave privada del tenant
 */
const decryptPrivateKey = (encryptedData) => {
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('WALLET_ENCRYPTION_KEY no configurada en el servidor');
  }

  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const key = Buffer.from(encryptionKey, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// ===========================================
// CONFIGURACIÓN DE BILLETERA DEL TENANT
// ===========================================

/**
 * Configurar billetera blockchain del tenant
 */
const configureTenantWallet = async (tenantId, userId, { walletAddress, privateKey }) => {
  // Validar dirección
  if (!ethers.isAddress(walletAddress)) {
    throw new Error('Dirección de billetera inválida');
  }

  // Validar que la clave privada corresponde a la dirección
  if (privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('La clave privada no corresponde a la dirección proporcionada');
      }
    } catch (error) {
      throw new Error('Clave privada inválida: ' + error.message);
    }
  }

  // Encriptar la clave privada
  let encryptedKey = null;
  if (privateKey) {
    encryptedKey = encryptPrivateKey(privateKey);
  }

  // Actualizar tenant
  const result = await query(
    `UPDATE tenants SET 
       blockchain_enabled = true,
       blockchain_wallet_address = $1,
       blockchain_wallet_key_encrypted = $2,
       blockchain_configured_at = NOW(),
       blockchain_configured_by = $3
     WHERE id = $4
     RETURNING id, name, blockchain_wallet_address, blockchain_enabled`,
    [walletAddress, encryptedKey, userId, tenantId]
  );

  if (result.rows.length === 0) {
    throw new Error('Tenant no encontrado');
  }

  // Registrar en auditoría
  await logAuditEntry({
    tenantId,
    entityType: 'tenant_wallet',
    entityId: tenantId,
    action: 'wallet_configured',
    decidedBy: userId,
    operationDetails: {
      walletAddress,
      hasPrivateKey: !!privateKey
    }
  });

  return {
    success: true,
    walletAddress: result.rows[0].blockchain_wallet_address,
    configured: true
  };
};

/**
 * Obtener configuración de billetera del tenant
 */
const getTenantWalletConfig = async (tenantId) => {
  const result = await query(
    `SELECT 
       blockchain_enabled,
       blockchain_network,
       blockchain_wallet_address,
       blockchain_wallet_key_encrypted IS NOT NULL as has_private_key,
       blockchain_configured_at,
       u.first_name || ' ' || u.last_name as configured_by_name
     FROM tenants t
     LEFT JOIN users u ON t.blockchain_configured_by = u.id
     WHERE t.id = $1`,
    [tenantId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

/**
 * Obtener billetera del tenant para firmar
 */
const getTenantWallet = async (tenantId) => {
  const result = await query(
    `SELECT blockchain_wallet_address, blockchain_wallet_key_encrypted
     FROM tenants WHERE id = $1 AND blockchain_enabled = true`,
    [tenantId]
  );

  if (result.rows.length === 0 || !result.rows[0].blockchain_wallet_key_encrypted) {
    return null;
  }

  const privateKey = decryptPrivateKey(result.rows[0].blockchain_wallet_key_encrypted);
  return new ethers.Wallet(privateKey);
};

// ===========================================
// FLUJO DE APROBACIÓN
// ===========================================

/**
 * Crear operación pendiente de aprobación
 */
const createPendingOperation = async (orderId, tenantId, requestedBy, operationDetails) => {
  const dbClient = await getClient();
  
  try {
    await dbClient.query('BEGIN');

    // Actualizar orden a pending_approval
    await dbClient.query(
      `UPDATE token_orders 
       SET status = 'pending_approval',
           requires_approval = true
       WHERE id = $1`,
      [orderId]
    );

    // Registrar en auditoría
    await dbClient.query(
      `INSERT INTO approval_audit_log (
         tenant_id, entity_type, entity_id, action,
         previous_status, new_status, requested_by, requested_at,
         operation_details
       ) VALUES ($1, 'token_order', $2, 'created', 'draft', 'pending_approval', $3, NOW(), $4)`,
      [tenantId, orderId, requestedBy, JSON.stringify(operationDetails)]
    );

    await dbClient.query('COMMIT');
    
    return { success: true, status: 'pending_approval' };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Obtener aprobaciones pendientes del tenant
 */
const getPendingApprovals = async (tenantId) => {
  const result = await query(
    `SELECT * FROM v_pending_approvals WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows;
};

/**
 * Aprobar operación y firmar
 */
const approveOperation = async (orderId, tenantId, approvedBy, { notes, ipAddress, userAgent }) => {
  const dbClient = await getClient();
  
  try {
    await dbClient.query('BEGIN');

    // Verificar que la orden existe y está pendiente
    const orderResult = await dbClient.query(
      `SELECT * FROM token_orders WHERE id = $1 AND tenant_id = $2 AND status = 'pending_approval'`,
      [orderId, tenantId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Orden no encontrada o no está pendiente de aprobación');
    }

    const order = orderResult.rows[0];

    // Verificar que quien aprueba no es quien creó la orden (segregación de funciones)
    if (order.created_by === approvedBy) {
      throw new Error('No puede aprobar una operación que usted mismo creó');
    }

    // Actualizar orden
    await dbClient.query(
      `UPDATE token_orders 
       SET status = 'approved',
           approved_by = $1,
           approved_at = NOW()
       WHERE id = $2`,
      [approvedBy, orderId]
    );

    // Registrar en auditoría
    await dbClient.query(
      `INSERT INTO approval_audit_log (
         tenant_id, entity_type, entity_id, action,
         previous_status, new_status, requested_by, decided_by,
         requested_at, decided_at, notes, ip_address, user_agent,
         operation_details
       ) VALUES ($1, 'token_order', $2, 'approved', 'pending_approval', 'approved', 
         $3, $4, $5, NOW(), $6, $7, $8, $9)`,
      [
        tenantId, orderId, order.created_by, approvedBy,
        order.created_at, notes, ipAddress, userAgent,
        JSON.stringify({
          orderNumber: order.order_number,
          orderType: order.order_type,
          tokenAmount: order.token_amount,
          totalAmount: order.total_amount
        })
      ]
    );

    await dbClient.query('COMMIT');

    return {
      success: true,
      orderId,
      status: 'approved',
      message: 'Operación aprobada. Proceda con la ejecución.'
    };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Rechazar operación
 */
const rejectOperation = async (orderId, tenantId, rejectedBy, { reason, notes, ipAddress, userAgent }) => {
  const dbClient = await getClient();
  
  try {
    await dbClient.query('BEGIN');

    // Verificar que la orden existe y está pendiente
    const orderResult = await dbClient.query(
      `SELECT * FROM token_orders WHERE id = $1 AND tenant_id = $2 AND status = 'pending_approval'`,
      [orderId, tenantId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Orden no encontrada o no está pendiente de aprobación');
    }

    const order = orderResult.rows[0];

    // Actualizar orden
    await dbClient.query(
      `UPDATE token_orders 
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = NOW(),
           rejection_reason = $2
       WHERE id = $3`,
      [rejectedBy, reason, orderId]
    );

    // Registrar en auditoría
    await dbClient.query(
      `INSERT INTO approval_audit_log (
         tenant_id, entity_type, entity_id, action,
         previous_status, new_status, requested_by, decided_by,
         requested_at, decided_at, reason, notes, ip_address, user_agent,
         operation_details
       ) VALUES ($1, 'token_order', $2, 'rejected', 'pending_approval', 'rejected', 
         $3, $4, $5, NOW(), $6, $7, $8, $9, $10)`,
      [
        tenantId, orderId, order.created_by, rejectedBy,
        order.created_at, reason, notes, ipAddress, userAgent,
        JSON.stringify({
          orderNumber: order.order_number,
          orderType: order.order_type,
          tokenAmount: order.token_amount,
          totalAmount: order.total_amount
        })
      ]
    );

    await dbClient.query('COMMIT');

    return {
      success: true,
      orderId,
      status: 'rejected',
      message: 'Operación rechazada'
    };
  } catch (error) {
    await dbClient.query('ROLLBACK');
    throw error;
  } finally {
    dbClient.release();
  }
};

// ===========================================
// DOBLE FIRMA
// ===========================================

/**
 * Firmar mensaje con billetera del tenant
 */
const signWithTenantWallet = async (tenantId, message) => {
  const wallet = await getTenantWallet(tenantId);
  
  if (!wallet) {
    throw new Error('Billetera del tenant no configurada o sin clave privada');
  }

  const signature = await wallet.signMessage(message);
  
  return {
    signature,
    address: wallet.address
  };
};

/**
 * Firmar mensaje con billetera de Fideitec
 */
const signWithFideitecWallet = async (message) => {
  const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
  
  if (!privateKey) {
    throw new Error('Billetera de Fideitec no configurada');
  }

  const wallet = new ethers.Wallet(privateKey);
  const signature = await wallet.signMessage(message);
  
  return {
    signature,
    address: wallet.address
  };
};

/**
 * Aplicar doble firma a un certificado
 */
const applyDualSignature = async (certificateId, tenantId) => {
  // Obtener datos del certificado
  const certResult = await query(
    `SELECT * FROM token_certificates WHERE id = $1`,
    [certificateId]
  );

  if (certResult.rows.length === 0) {
    throw new Error('Certificado no encontrado');
  }

  const certificate = certResult.rows[0];
  
  // Crear mensaje a firmar (hash del certificado)
  const messageToSign = certificate.pdf_hash || crypto.createHash('sha256')
    .update(JSON.stringify({
      certificateNumber: certificate.certificate_number,
      beneficiaryName: certificate.beneficiary_name,
      tokenAmount: certificate.token_amount,
      issuedAt: certificate.issued_at
    }))
    .digest('hex');

  // Firma del tenant
  let tenantSignature = null;
  try {
    tenantSignature = await signWithTenantWallet(tenantId, messageToSign);
  } catch (error) {
    console.warn('No se pudo obtener firma del tenant:', error.message);
  }

  // Firma de Fideitec
  let fideitecSignature = null;
  try {
    fideitecSignature = await signWithFideitecWallet(messageToSign);
  } catch (error) {
    console.warn('No se pudo obtener firma de Fideitec:', error.message);
  }

  // Actualizar certificado con las firmas
  await query(
    `UPDATE token_certificates SET
       tenant_signature = $1,
       tenant_signature_address = $2,
       tenant_signed_at = $3,
       fideitec_signature = $4,
       fideitec_signature_address = $5,
       fideitec_signed_at = $6,
       dual_signature_verified = $7
     WHERE id = $8`,
    [
      tenantSignature?.signature,
      tenantSignature?.address,
      tenantSignature ? new Date() : null,
      fideitecSignature?.signature,
      fideitecSignature?.address,
      fideitecSignature ? new Date() : null,
      !!(tenantSignature && fideitecSignature),
      certificateId
    ]
  );

  return {
    success: true,
    tenantSigned: !!tenantSignature,
    fideitecSigned: !!fideitecSignature,
    dualSignatureVerified: !!(tenantSignature && fideitecSignature),
    signatures: {
      tenant: tenantSignature ? {
        address: tenantSignature.address,
        signature: tenantSignature.signature.substring(0, 20) + '...'
      } : null,
      fideitec: fideitecSignature ? {
        address: fideitecSignature.address,
        signature: fideitecSignature.signature.substring(0, 20) + '...'
      } : null
    }
  };
};

/**
 * Verificar doble firma de un certificado
 */
const verifyDualSignature = async (certificateId) => {
  const result = await query(
    `SELECT 
       pdf_hash,
       tenant_signature, tenant_signature_address,
       fideitec_signature, fideitec_signature_address,
       dual_signature_verified
     FROM token_certificates WHERE id = $1`,
    [certificateId]
  );

  if (result.rows.length === 0) {
    throw new Error('Certificado no encontrado');
  }

  const cert = result.rows[0];
  const verifications = {
    tenant: false,
    fideitec: false
  };

  // Verificar firma del tenant
  if (cert.tenant_signature && cert.tenant_signature_address && cert.pdf_hash) {
    try {
      const recoveredAddress = ethers.verifyMessage(cert.pdf_hash, cert.tenant_signature);
      verifications.tenant = recoveredAddress.toLowerCase() === cert.tenant_signature_address.toLowerCase();
    } catch (error) {
      verifications.tenant = false;
    }
  }

  // Verificar firma de Fideitec
  if (cert.fideitec_signature && cert.fideitec_signature_address && cert.pdf_hash) {
    try {
      const recoveredAddress = ethers.verifyMessage(cert.pdf_hash, cert.fideitec_signature);
      verifications.fideitec = recoveredAddress.toLowerCase() === cert.fideitec_signature_address.toLowerCase();
    } catch (error) {
      verifications.fideitec = false;
    }
  }

  return {
    isValid: verifications.tenant && verifications.fideitec,
    tenantSignatureValid: verifications.tenant,
    fideitecSignatureValid: verifications.fideitec,
    tenantAddress: cert.tenant_signature_address,
    fideitecAddress: cert.fideitec_signature_address
  };
};

// ===========================================
// AUDITORÍA
// ===========================================

/**
 * Registrar entrada de auditoría
 */
const logAuditEntry = async ({
  tenantId,
  entityType,
  entityId,
  action,
  previousStatus,
  newStatus,
  requestedBy,
  decidedBy,
  reason,
  notes,
  ipAddress,
  userAgent,
  operationDetails
}) => {
  try {
    await query(
      `INSERT INTO approval_audit_log (
         tenant_id, entity_type, entity_id, action,
         previous_status, new_status, requested_by, decided_by,
         reason, notes, ip_address, user_agent, operation_details
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        tenantId, entityType, entityId, action,
        previousStatus, newStatus, requestedBy, decidedBy,
        reason, notes, ipAddress, userAgent,
        JSON.stringify(operationDetails || {})
      ]
    );
  } catch (error) {
    console.error('Error registrando auditoría:', error);
  }
};

/**
 * Obtener historial de auditoría
 */
const getAuditHistory = async (tenantId, { entityType, entityId, limit = 50 }) => {
  let queryText = `
    SELECT 
      al.*,
      u1.first_name || ' ' || u1.last_name as requested_by_name,
      u2.first_name || ' ' || u2.last_name as decided_by_name
    FROM approval_audit_log al
    LEFT JOIN users u1 ON al.requested_by = u1.id
    LEFT JOIN users u2 ON al.decided_by = u2.id
    WHERE al.tenant_id = $1
  `;
  const params = [tenantId];

  if (entityType) {
    queryText += ` AND al.entity_type = $${params.length + 1}`;
    params.push(entityType);
  }

  if (entityId) {
    queryText += ` AND al.entity_id = $${params.length + 1}`;
    params.push(entityId);
  }

  queryText += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const result = await query(queryText, params);
  return result.rows;
};

module.exports = {
  // Billetera
  configureTenantWallet,
  getTenantWalletConfig,
  getTenantWallet,
  
  // Aprobación
  createPendingOperation,
  getPendingApprovals,
  approveOperation,
  rejectOperation,
  
  // Doble firma
  signWithTenantWallet,
  signWithFideitecWallet,
  applyDualSignature,
  verifyDualSignature,
  
  // Auditoría
  logAuditEntry,
  getAuditHistory,
  
  // Utilidades
  encryptPrivateKey,
  decryptPrivateKey
};

