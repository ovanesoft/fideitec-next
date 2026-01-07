/**
 * FIDEITEC - Middleware de Rate Limiting para Operaciones de Tokens
 * 
 * Limita a 3 operaciones por usuario por hora para prevenir ataques de bots
 * y asegurar que cada operación sea revisada por el admin.
 */

const { query } = require('../config/database');

const DEFAULT_MAX_OPERATIONS = 3;
const WINDOW_HOURS = 1;

/**
 * Middleware que verifica el límite de operaciones por usuario
 */
const checkOperationLimit = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenant_id;

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    // Obtener configuración del tenant (puede tener límite personalizado)
    const tenantResult = await query(
      'SELECT max_operations_per_hour FROM tenants WHERE id = $1',
      [tenantId]
    );

    const maxOperations = tenantResult.rows[0]?.max_operations_per_hour || DEFAULT_MAX_OPERATIONS;

    // Contar operaciones en la última hora
    const countResult = await query(
      `SELECT COUNT(*) as count 
       FROM operation_rate_limits 
       WHERE tenant_id = $1 
         AND user_id = $2 
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [tenantId, userId]
    );

    const operationsThisHour = parseInt(countResult.rows[0].count) || 0;

    if (operationsThisHour >= maxOperations) {
      // Obtener tiempo hasta el próximo slot
      const oldestOpResult = await query(
        `SELECT created_at 
         FROM operation_rate_limits 
         WHERE tenant_id = $1 AND user_id = $2 
         ORDER BY created_at ASC 
         LIMIT 1`,
        [tenantId, userId]
      );

      let resetIn = '~60 minutos';
      if (oldestOpResult.rows.length > 0) {
        const oldestOp = new Date(oldestOpResult.rows[0].created_at);
        const resetTime = new Date(oldestOp.getTime() + 60 * 60 * 1000);
        const minutesLeft = Math.ceil((resetTime - new Date()) / (1000 * 60));
        resetIn = `${minutesLeft} minutos`;
      }

      console.warn(`⚠️ Rate limit alcanzado - Usuario: ${userId}, Tenant: ${tenantId}, Ops: ${operationsThisHour}/${maxOperations}`);

      return res.status(429).json({
        success: false,
        message: `Límite de operaciones alcanzado (${maxOperations} por hora). Intente en ${resetIn}.`,
        error: 'RATE_LIMIT_EXCEEDED',
        details: {
          operationsUsed: operationsThisHour,
          maxOperations: maxOperations,
          windowHours: WINDOW_HOURS,
          resetIn: resetIn
        }
      });
    }

    // Pasar info al request para mostrar en respuesta
    req.operationsRemaining = maxOperations - operationsThisHour - 1;
    req.maxOperations = maxOperations;

    next();
  } catch (error) {
    console.error('Error verificando límite de operaciones:', error);
    // En caso de error, permitir la operación pero loguear
    next();
  }
};

/**
 * Registrar una operación en el rate limiter
 * Llamar después de que la operación se cree exitosamente
 */
const registerOperation = async (tenantId, userId, operationType) => {
  try {
    await query(
      `INSERT INTO operation_rate_limits (tenant_id, user_id, operation_type)
       VALUES ($1, $2, $3)`,
      [tenantId, userId, operationType]
    );

    // Limpiar registros viejos (más de 2 horas)
    await query(
      `DELETE FROM operation_rate_limits WHERE created_at < NOW() - INTERVAL '2 hours'`
    );

    return true;
  } catch (error) {
    console.error('Error registrando operación:', error);
    return false;
  }
};

/**
 * Obtener estadísticas de uso del usuario
 */
const getOperationStats = async (tenantId, userId) => {
  try {
    const result = await query(
      `SELECT 
         COUNT(*) as operations_this_hour,
         MAX(created_at) as last_operation
       FROM operation_rate_limits 
       WHERE tenant_id = $1 
         AND user_id = $2 
         AND created_at > NOW() - INTERVAL '1 hour'`,
      [tenantId, userId]
    );

    const tenantResult = await query(
      'SELECT max_operations_per_hour FROM tenants WHERE id = $1',
      [tenantId]
    );

    const maxOperations = tenantResult.rows[0]?.max_operations_per_hour || DEFAULT_MAX_OPERATIONS;
    const operationsUsed = parseInt(result.rows[0].operations_this_hour) || 0;

    return {
      operationsUsed,
      operationsRemaining: Math.max(0, maxOperations - operationsUsed),
      maxOperations,
      lastOperation: result.rows[0].last_operation
    };
  } catch (error) {
    console.error('Error obteniendo stats de operaciones:', error);
    return null;
  }
};

module.exports = {
  checkOperationLimit,
  registerOperation,
  getOperationStats,
  DEFAULT_MAX_OPERATIONS
};

