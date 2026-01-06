/**
 * FIDEITEC - Servicio de Órdenes de Compra/Venta
 * 
 * Gestiona el flujo completo de compra y venta de tokens:
 * - Creación de órdenes
 * - Procesamiento de pagos
 * - Transferencia de tokens
 * - Emisión de certificados
 */

const { query, getClient } = require('../config/database');
const certificateService = require('./certificateService');

// ===========================================
// CREACIÓN DE ÓRDENES
// ===========================================

/**
 * Crea una orden de compra de tokens
 * @param {object} params - Parámetros de la orden
 * @returns {object} Orden creada
 */
const createBuyOrder = async (params) => {
  const dbClient = await getClient();
  
  try {
    const {
      tenantId,
      tokenizedAssetId,
      clientId,
      tokenAmount,
      paymentMethod,
      notes
    } = params;

    await dbClient.query('BEGIN');

    // Verificar que el activo existe y tiene tokens disponibles
    const assetResult = await dbClient.query(
      `SELECT * FROM tokenized_assets WHERE id = $1 AND tenant_id = $2 AND status = 'active'`,
      [tokenizedAssetId, tenantId]
    );

    if (assetResult.rows.length === 0) {
      throw new Error('Activo tokenizado no encontrado o inactivo');
    }

    const asset = assetResult.rows[0];

    if (asset.fideitec_balance < tokenAmount) {
      throw new Error(`Tokens insuficientes. Disponibles: ${asset.fideitec_balance}`);
    }

    // Calcular valores
    const pricePerToken = parseFloat(asset.token_price);
    const subtotal = pricePerToken * tokenAmount;
    const fees = 0; // Por ahora sin comisiones
    const taxes = 0;
    const totalAmount = subtotal + fees + taxes;

    // Generar número de orden
    const orderNumberResult = await dbClient.query(
      `SELECT generate_order_number($1, 'buy') as order_number`,
      [tenantId]
    );
    const orderNumber = orderNumberResult.rows[0].order_number;

    // Crear la orden
    const result = await dbClient.query(
      `INSERT INTO token_orders (
        tenant_id, tokenized_asset_id, client_id, order_type,
        order_number, token_amount, price_per_token, subtotal,
        fees, taxes, total_amount, currency, payment_method,
        status, notes
      ) VALUES ($1, $2, $3, 'buy', $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13)
      RETURNING *`,
      [
        tenantId, tokenizedAssetId, clientId, orderNumber,
        tokenAmount, pricePerToken, subtotal, fees, taxes, totalAmount,
        asset.currency || 'ARS', paymentMethod, notes
      ]
    );

    await dbClient.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando orden de compra:', error);
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Crea una orden de venta de tokens
 * @param {object} params - Parámetros de la orden
 * @returns {object} Orden creada
 */
const createSellOrder = async (params) => {
  const dbClient = await getClient();
  
  try {
    const {
      tenantId,
      tokenizedAssetId,
      clientId,
      tokenAmount,
      bankName,
      bankAccountType,
      bankAccountNumber,
      bankCbuAlias,
      notes
    } = params;

    await dbClient.query('BEGIN');

    // Verificar que el cliente tiene los tokens
    const holderResult = await dbClient.query(
      `SELECT th.*, ta.token_price, ta.currency 
       FROM token_holders th
       JOIN tokenized_assets ta ON th.tokenized_asset_id = ta.id
       WHERE th.tokenized_asset_id = $1 AND th.client_id = $2 AND th.balance > 0`,
      [tokenizedAssetId, clientId]
    );

    if (holderResult.rows.length === 0) {
      throw new Error('El cliente no posee tokens de este activo');
    }

    const holder = holderResult.rows[0];

    if (holder.balance < tokenAmount) {
      throw new Error(`Tokens insuficientes. El cliente tiene: ${holder.balance}`);
    }

    // Calcular valores
    const pricePerToken = parseFloat(holder.token_price);
    const subtotal = pricePerToken * tokenAmount;
    const fees = 0;
    const taxes = 0;
    const totalAmount = subtotal - fees - taxes;

    // Generar número de orden
    const orderNumberResult = await dbClient.query(
      `SELECT generate_order_number($1, 'sell') as order_number`,
      [tenantId]
    );
    const orderNumber = orderNumberResult.rows[0].order_number;

    // Crear la orden
    const result = await dbClient.query(
      `INSERT INTO token_orders (
        tenant_id, tokenized_asset_id, client_id, order_type,
        order_number, token_amount, price_per_token, subtotal,
        fees, taxes, total_amount, currency, payment_method,
        bank_name, bank_account_type, bank_account_number, bank_cbu_alias,
        status, notes
      ) VALUES ($1, $2, $3, 'sell', $4, $5, $6, $7, $8, $9, $10, $11, 'bank_transfer', $12, $13, $14, $15, 'pending', $16)
      RETURNING *`,
      [
        tenantId, tokenizedAssetId, clientId, orderNumber,
        tokenAmount, pricePerToken, subtotal, fees, taxes, totalAmount,
        holder.currency || 'ARS', bankName, bankAccountType, bankAccountNumber,
        bankCbuAlias, notes
      ]
    );

    await dbClient.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando orden de venta:', error);
    throw error;
  } finally {
    dbClient.release();
  }
};

// ===========================================
// PROCESAMIENTO DE ÓRDENES
// ===========================================

/**
 * Confirma la recepción del pago de una orden de compra
 * @param {string} orderId - ID de la orden
 * @param {object} paymentData - Datos del pago
 * @param {string} processedBy - ID del usuario que procesa
 * @returns {object} Orden actualizada
 */
const confirmPayment = async (orderId, paymentData, processedBy) => {
  const dbClient = await getClient();
  
  try {
    const { paymentReference, paymentProofUrl } = paymentData;

    await dbClient.query('BEGIN');

    // Verificar orden
    const orderResult = await dbClient.query(
      `SELECT * FROM token_orders WHERE id = $1 AND status IN ('pending', 'payment_pending')`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Orden no encontrada o no está pendiente de pago');
    }

    // Actualizar orden
    const result = await dbClient.query(
      `UPDATE token_orders 
       SET status = 'payment_received',
           payment_reference = $1,
           payment_proof_url = $2,
           payment_date = CURRENT_TIMESTAMP,
           payment_confirmed_at = CURRENT_TIMESTAMP,
           processed_by = $3
       WHERE id = $4
       RETURNING *`,
      [paymentReference, paymentProofUrl, processedBy, orderId]
    );

    await dbClient.query('COMMIT');

    return result.rows[0];

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error confirmando pago:', error);
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Completa una orden de compra: transfiere tokens y genera certificado
 * @param {string} orderId - ID de la orden
 * @param {string} processedBy - ID del usuario que procesa
 * @returns {object} Orden completada con certificado
 */
const completeBuyOrder = async (orderId, processedBy) => {
  const dbClient = await getClient();
  
  try {
    await dbClient.query('BEGIN');

    // Obtener orden con datos relacionados
    const orderResult = await dbClient.query(
      `SELECT o.*, ta.*, c.first_name, c.last_name, c.document_type, c.document_number,
              c.address_street, c.address_city, c.email,
              CASE 
                WHEN ta.asset_type = 'asset' THEN a.name
                WHEN ta.asset_type = 'asset_unit' THEN au.unit_name
                WHEN ta.asset_type = 'trust' THEN t.name
              END as asset_name
       FROM token_orders o
       JOIN tokenized_assets ta ON o.tokenized_asset_id = ta.id
       JOIN clients c ON o.client_id = c.id
       LEFT JOIN assets a ON ta.asset_id = a.id
       LEFT JOIN asset_units au ON ta.asset_unit_id = au.id
       LEFT JOIN trusts t ON ta.trust_id = t.id
       WHERE o.id = $1 AND o.status = 'payment_received'`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Orden no encontrada o el pago no ha sido confirmado');
    }

    const order = orderResult.rows[0];

    // Verificar tokens disponibles
    if (order.fideitec_balance < order.token_amount) {
      throw new Error('Ya no hay suficientes tokens disponibles');
    }

    // Obtener o crear holder del cliente
    let holderResult = await dbClient.query(
      `SELECT id FROM token_holders 
       WHERE tokenized_asset_id = $1 AND client_id = $2`,
      [order.tokenized_asset_id, order.client_id]
    );

    let clientHolderId;
    if (holderResult.rows.length === 0) {
      const newHolder = await dbClient.query(
        `INSERT INTO token_holders (tenant_id, tokenized_asset_id, holder_type, client_id, balance)
         VALUES ($1, $2, 'client', $3, 0)
         RETURNING id`,
        [order.tenant_id, order.tokenized_asset_id, order.client_id]
      );
      clientHolderId = newHolder.rows[0].id;
    } else {
      clientHolderId = holderResult.rows[0].id;
    }

    // Obtener holder de Fideitec
    const fideitecHolder = await dbClient.query(
      `SELECT id FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
      [order.tokenized_asset_id]
    );

    // Registrar transacción de transferencia
    const txResult = await dbClient.query(
      `INSERT INTO token_transactions (
        tenant_id, tokenized_asset_id, transaction_type,
        from_holder_id, to_holder_id, amount, blockchain,
        status, reason, reference_id, initiated_by, confirmed_at
      ) VALUES ($1, $2, 'transfer', $3, $4, $5, $6, 'confirmed', 
        'Compra de tokens - Orden ' || $7, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        order.tenant_id, order.tokenized_asset_id,
        fideitecHolder.rows[0].id, clientHolderId,
        order.token_amount, order.blockchain || 'internal',
        order.order_number, processedBy
      ]
    );

    // Actualizar balances manualmente (por si el trigger no existe)
    // Restar del holder de Fideitec
    await dbClient.query(
      `UPDATE token_holders SET balance = balance - $1 WHERE id = $2`,
      [order.token_amount, fideitecHolder.rows[0].id]
    );
    
    // Sumar al holder del cliente
    await dbClient.query(
      `UPDATE token_holders SET balance = balance + $1 WHERE id = $2`,
      [order.token_amount, clientHolderId]
    );
    
    // Actualizar el activo tokenizado
    await dbClient.query(
      `UPDATE tokenized_assets 
       SET fideitec_balance = fideitec_balance - $1,
           circulating_supply = circulating_supply + $1
       WHERE id = $2`,
      [order.token_amount, order.tokenized_asset_id]
    );

    // Generar certificado (pasamos dbClient para usar la misma transacción)
    const certificate = await certificateService.createCertificate({
      tenantId: order.tenant_id,
      tokenizedAssetId: order.tokenized_asset_id,
      clientId: order.client_id,
      tokenHolderId: clientHolderId,
      transactionId: txResult.rows[0].id,
      certificateType: 'ownership',
      tokenAmount: order.token_amount,
      tokenValueAtIssue: order.price_per_token,
      totalValueAtIssue: order.total_amount,
      currency: order.currency,
      title: `Certificado de Posesión - ${order.token_name}`,
      beneficiaryName: `${order.first_name} ${order.last_name}`,
      beneficiaryDocumentType: order.document_type,
      beneficiaryDocumentNumber: order.document_number,
      beneficiaryAddress: `${order.address_street || ''}, ${order.address_city || ''}`,
      createdBy: processedBy
    }, dbClient); // Pasamos el cliente de BD para usar la misma transacción

    // Actualizar orden como completada
    const updatedOrder = await dbClient.query(
      `UPDATE token_orders 
       SET status = 'completed',
           token_transaction_id = $1,
           certificate_id = $2,
           tokens_transferred_at = CURRENT_TIMESTAMP,
           completed_at = CURRENT_TIMESTAMP,
           processed_by = $3
       WHERE id = $4
       RETURNING *`,
      [txResult.rows[0].id, certificate.id, processedBy, orderId]
    );

    await dbClient.query('COMMIT');

    return {
      order: updatedOrder.rows[0],
      certificate,
      transaction: txResult.rows[0]
    };

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error completando orden:', error);
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Completa una orden de venta: devuelve tokens y paga al cliente
 * @param {string} orderId - ID de la orden
 * @param {object} paymentData - Datos del pago realizado
 * @param {string} processedBy - ID del usuario que procesa
 * @returns {object} Orden completada
 */
const completeSellOrder = async (orderId, paymentData, processedBy) => {
  const dbClient = await getClient();
  
  try {
    const { paymentReference, paymentProofUrl } = paymentData;

    await dbClient.query('BEGIN');

    // Obtener orden
    const orderResult = await dbClient.query(
      `SELECT o.*, c.first_name, c.last_name
       FROM token_orders o
       JOIN clients c ON o.client_id = c.id
       WHERE o.id = $1 AND o.order_type = 'sell' AND o.status IN ('pending', 'processing')`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new Error('Orden de venta no encontrada o no está pendiente');
    }

    const order = orderResult.rows[0];

    // Verificar que el cliente aún tiene los tokens
    const holderResult = await dbClient.query(
      `SELECT * FROM token_holders 
       WHERE tokenized_asset_id = $1 AND client_id = $2`,
      [order.tokenized_asset_id, order.client_id]
    );

    if (holderResult.rows.length === 0 || holderResult.rows[0].balance < order.token_amount) {
      throw new Error('El cliente ya no tiene suficientes tokens');
    }

    const clientHolder = holderResult.rows[0];

    // Obtener holder de Fideitec
    const fideitecHolder = await dbClient.query(
      `SELECT id FROM token_holders WHERE tokenized_asset_id = $1 AND holder_type = 'fideitec'`,
      [order.tokenized_asset_id]
    );

    // Registrar transacción de devolución
    const txResult = await dbClient.query(
      `INSERT INTO token_transactions (
        tenant_id, tokenized_asset_id, transaction_type,
        from_holder_id, to_holder_id, amount, blockchain,
        status, reason, reference_id, initiated_by, confirmed_at
      ) VALUES ($1, $2, 'return', $3, $4, $5, $6, 'confirmed', 
        'Venta de tokens - Orden ' || $7, $7, $8, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        order.tenant_id, order.tokenized_asset_id,
        clientHolder.id, fideitecHolder.rows[0].id,
        order.token_amount, 'internal',
        order.order_number, processedBy
      ]
    );

    // Revocar certificados anteriores del cliente para estos tokens
    await dbClient.query(
      `UPDATE token_certificates 
       SET status = 'superseded'
       WHERE client_id = $1 AND tokenized_asset_id = $2 AND status = 'active'`,
      [order.client_id, order.tokenized_asset_id]
    );

    // Actualizar orden como completada
    const updatedOrder = await dbClient.query(
      `UPDATE token_orders 
       SET status = 'completed',
           token_transaction_id = $1,
           payment_reference = $2,
           payment_proof_url = $3,
           payment_date = CURRENT_TIMESTAMP,
           tokens_transferred_at = CURRENT_TIMESTAMP,
           completed_at = CURRENT_TIMESTAMP,
           processed_by = $4
       WHERE id = $5
       RETURNING *`,
      [txResult.rows[0].id, paymentReference, paymentProofUrl, processedBy, orderId]
    );

    await dbClient.query('COMMIT');

    return {
      order: updatedOrder.rows[0],
      transaction: txResult.rows[0]
    };

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error completando orden de venta:', error);
    throw error;
  } finally {
    dbClient.release();
  }
};

/**
 * Cancela una orden
 * @param {string} orderId - ID de la orden
 * @param {string} reason - Razón de cancelación
 * @param {string} cancelledBy - ID del usuario que cancela
 * @returns {object} Orden cancelada
 */
const cancelOrder = async (orderId, reason, cancelledBy) => {
  const result = await query(
    `UPDATE token_orders 
     SET status = 'cancelled',
         cancel_reason = $1,
         cancelled_at = CURRENT_TIMESTAMP,
         processed_by = $2
     WHERE id = $3 AND status NOT IN ('completed', 'cancelled', 'refunded')
     RETURNING *`,
    [reason, cancelledBy, orderId]
  );

  if (result.rows.length === 0) {
    throw new Error('Orden no encontrada o no puede ser cancelada');
  }

  return result.rows[0];
};

// ===========================================
// CONSULTAS
// ===========================================

/**
 * Obtiene órdenes de un tenant con filtros
 */
const getOrders = async (tenantId, filters = {}) => {
  const { status, orderType, clientId, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  
  let whereConditions = ['tenant_id = $1'];
  const params = [tenantId];
  let paramCount = 2;

  if (status) {
    whereConditions.push(`status = $${paramCount}`);
    params.push(status);
    paramCount++;
  }

  if (orderType) {
    whereConditions.push(`order_type = $${paramCount}`);
    params.push(orderType);
    paramCount++;
  }

  if (clientId) {
    whereConditions.push(`client_id = $${paramCount}`);
    params.push(clientId);
    paramCount++;
  }

  params.push(limit, offset);

  const result = await query(
    `SELECT * FROM v_token_orders_detail 
     WHERE ${whereConditions.join(' AND ')}
     ORDER BY submitted_at DESC
     LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
    params
  );

  return result.rows;
};

/**
 * Obtiene una orden por ID
 */
const getOrderById = async (orderId, tenantId) => {
  const result = await query(
    `SELECT * FROM v_token_orders_detail WHERE id = $1 AND tenant_id = $2`,
    [orderId, tenantId]
  );
  return result.rows[0] || null;
};

/**
 * Obtiene órdenes de un cliente
 */
const getClientOrders = async (clientId, tenantId) => {
  const result = await query(
    `SELECT * FROM v_token_orders_detail 
     WHERE client_id = $1 AND tenant_id = $2
     ORDER BY submitted_at DESC`,
    [clientId, tenantId]
  );
  return result.rows;
};

/**
 * Obtiene estadísticas de órdenes
 */
const getOrderStats = async (tenantId) => {
  const result = await query(
    `SELECT 
       COUNT(*) FILTER (WHERE status = 'pending') as pending_orders,
       COUNT(*) FILTER (WHERE status = 'payment_received') as pending_processing,
       COUNT(*) FILTER (WHERE status = 'completed') as completed_orders,
       COUNT(*) FILTER (WHERE order_type = 'buy' AND status = 'completed') as total_buys,
       COUNT(*) FILTER (WHERE order_type = 'sell' AND status = 'completed') as total_sells,
       COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'buy' AND status = 'completed'), 0) as total_buy_volume,
       COALESCE(SUM(total_amount) FILTER (WHERE order_type = 'sell' AND status = 'completed'), 0) as total_sell_volume
     FROM token_orders
     WHERE tenant_id = $1`,
    [tenantId]
  );
  return result.rows[0];
};

module.exports = {
  // Creación
  createBuyOrder,
  createSellOrder,
  
  // Procesamiento
  confirmPayment,
  completeBuyOrder,
  completeSellOrder,
  cancelOrder,
  
  // Consultas
  getOrders,
  getOrderById,
  getClientOrders,
  getOrderStats
};

