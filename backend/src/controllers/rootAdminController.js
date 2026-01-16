const { query, getClient } = require('../config/database');

// ===========================================
// ROOT ADMIN CONTROLLER
// Dashboard de administración global (solo root)
// ===========================================

// Obtener estadísticas globales del sistema
const getDashboardStats = async (req, res) => {
  try {
    // Ejecutar todas las consultas en paralelo
    const [
      tenantsResult,
      usersResult,
      clientsResult,
      activeTenantsResult,
      recentLoginsResult,
      billingStatsResult
    ] = await Promise.all([
      // Total de tenants
      query('SELECT COUNT(*) as total FROM tenants WHERE slug != $1', ['root']),
      // Total de usuarios (excluyendo root)
      query('SELECT COUNT(*) as total FROM users WHERE role != $1', ['root']),
      // Total de clientes
      query('SELECT COUNT(*) as total FROM clients'),
      // Tenants activos
      query('SELECT COUNT(*) as total FROM tenants WHERE is_active = true AND slug != $1', ['root']),
      // Logins últimos 7 días
      query(`
        SELECT COUNT(DISTINCT user_id) as total 
        FROM audit_logs 
        WHERE action = 'LOGIN' AND created_at > NOW() - INTERVAL '7 days'
      `),
      // Estadísticas de billing
      query(`
        SELECT 
          billing_status,
          COUNT(*) as count
        FROM tenants 
        WHERE slug != 'root'
        GROUP BY billing_status
      `)
    ]);

    // Procesar billing stats
    const billingStats = {
      active: 0,
      trial: 0,
      past_due: 0,
      suspended: 0,
      cancelled: 0
    };
    
    billingStatsResult.rows.forEach(row => {
      if (row.billing_status && billingStats.hasOwnProperty(row.billing_status)) {
        billingStats[row.billing_status] = parseInt(row.count);
      }
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalTenants: parseInt(tenantsResult.rows[0].total),
          totalUsers: parseInt(usersResult.rows[0].total),
          totalClients: parseInt(clientsResult.rows[0].total),
          activeTenants: parseInt(activeTenantsResult.rows[0].total),
          recentLogins: parseInt(recentLoginsResult.rows[0].total),
          billing: billingStats
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo stats del dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
};

// Listar todos los tenants con información detallada
const listAllTenants = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status, 
      billingStatus,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortColumns = ['created_at', 'name', 'user_count', 'billing_status'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let whereConditions = ["t.slug != 'root'"];
    const params = [];
    let paramCount = 1;

    if (search) {
      whereConditions.push(`(t.name ILIKE $${paramCount} OR t.slug ILIKE $${paramCount} OR t.domain ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (status !== undefined) {
      whereConditions.push(`t.is_active = $${paramCount}`);
      params.push(status === 'active');
      paramCount++;
    }

    if (billingStatus) {
      whereConditions.push(`t.billing_status = $${paramCount}`);
      params.push(billingStatus);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query principal con conteos
    const result = await query(
      `SELECT 
        t.id, t.name, t.slug, t.domain, t.logo_url,
        t.plan, t.is_active, t.created_at, t.updated_at,
        t.billing_status, t.billing_cycle, t.trial_ends_at,
        t.last_payment_at, t.next_payment_at,
        (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
        (SELECT COUNT(*) FROM clients WHERE tenant_id = t.id) as client_count,
        u.email as created_by_email,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
       FROM tenants t
       LEFT JOIN users u ON t.created_by = u.id
       ${whereClause}
       ORDER BY ${sortColumn === 'user_count' ? 'user_count' : `t.${sortColumn}`} ${order}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );

    // Contar total
    const countResult = await query(
      `SELECT COUNT(*) FROM tenants t ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        tenants: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listando tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar organizaciones'
    });
  }
};

// Obtener detalles completos de un tenant
const getTenantDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Información del tenant
    const tenantResult = await query(
      `SELECT 
        t.*,
        u.email as created_by_email,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
       FROM tenants t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = tenantResult.rows[0];

    // Obtener estadísticas del tenant
    const [usersResult, clientsResult, recentActivityResult] = await Promise.all([
      query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active,
          COUNT(*) FILTER (WHERE role = 'admin') as admins
         FROM users WHERE tenant_id = $1`,
        [id]
      ),
      query(
        `SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE kyc_status = 'approved') as verified
         FROM clients WHERE tenant_id = $1`,
        [id]
      ),
      query(
        `SELECT action, created_at, user_id
         FROM audit_logs 
         WHERE tenant_id = $1 
         ORDER BY created_at DESC 
         LIMIT 10`,
        [id]
      )
    ]);

    res.json({
      success: true,
      data: {
        tenant,
        stats: {
          users: {
            total: parseInt(usersResult.rows[0].total),
            active: parseInt(usersResult.rows[0].active),
            admins: parseInt(usersResult.rows[0].admins)
          },
          clients: {
            total: parseInt(clientsResult.rows[0].total),
            verified: parseInt(clientsResult.rows[0].verified)
          }
        },
        recentActivity: recentActivityResult.rows
      }
    });

  } catch (error) {
    console.error('Error obteniendo detalles del tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles'
    });
  }
};

// Actualizar estado de billing de un tenant
const updateTenantBilling = async (req, res) => {
  try {
    const { id } = req.params;
    const { billingStatus, billingCycle, trialEndsAt, notes } = req.body;
    const adminUser = req.user;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (billingStatus) {
      updates.push(`billing_status = $${paramCount++}`);
      values.push(billingStatus);
    }
    if (billingCycle) {
      updates.push(`billing_cycle = $${paramCount++}`);
      values.push(billingCycle);
    }
    if (trialEndsAt !== undefined) {
      updates.push(`trial_ends_at = $${paramCount++}`);
      values.push(trialEndsAt);
    }
    if (notes !== undefined) {
      updates.push(`billing_notes = $${paramCount++}`);
      values.push(notes);
    }

    // Si se suspende, también desactivar el tenant
    if (billingStatus === 'suspended') {
      updates.push(`is_active = false`);
    }
    // Si se reactiva, activar el tenant
    if (billingStatus === 'active' && req.body.reactivate) {
      updates.push(`is_active = true`);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    values.push(id);

    const result = await query(
      `UPDATE tenants SET ${updates.join(', ')} 
       WHERE id = $${paramCount} AND slug != 'root'
       RETURNING id, name, billing_status, billing_cycle, trial_ends_at, is_active`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id, adminUser.id, 'TENANT_BILLING_UPDATED', 'tenants', id,
        null, JSON.stringify({ billingStatus, billingCycle, notes }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Billing actualizado',
      data: { tenant: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando billing:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar billing'
    });
  }
};

// Suspender/Reactivar tenant
const toggleTenantStatus = async (req, res) => {
  const client = await getClient();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUser = req.user;

    await client.query('BEGIN');

    // Obtener estado actual
    const currentResult = await client.query(
      'SELECT is_active, name, slug FROM tenants WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = currentResult.rows[0];

    // No permitir modificar el tenant root
    if (tenant.slug === 'root') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'No se puede modificar el tenant del sistema'
      });
    }

    const newStatus = !tenant.is_active;

    // Actualizar tenant
    await client.query(
      'UPDATE tenants SET is_active = $1 WHERE id = $2',
      [newStatus, id]
    );

    // Si se desactiva, revocar todos los tokens de usuarios del tenant
    if (!newStatus) {
      await client.query(
        `UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() 
         WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)`,
        [id]
      );
    }

    await client.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id, adminUser.id, 
        newStatus ? 'TENANT_REACTIVATED' : 'TENANT_SUSPENDED', 
        'tenants', id,
        JSON.stringify({ is_active: tenant.is_active }),
        JSON.stringify({ is_active: newStatus, reason }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: `Organización ${newStatus ? 'reactivada' : 'suspendida'}`,
      data: {
        id,
        name: tenant.name,
        isActive: newStatus
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error toggling tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al modificar organización'
    });
  } finally {
    client.release();
  }
};

// Eliminar tenant permanentemente
const deleteTenant = async (req, res) => {
  const client = await getClient();
  
  try {
    const { id } = req.params;
    const { confirmName } = req.body;
    const adminUser = req.user;

    // Obtener tenant
    const tenantResult = await client.query(
      'SELECT name, slug FROM tenants WHERE id = $1',
      [id]
    );

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = tenantResult.rows[0];

    // No permitir eliminar el tenant root
    if (tenant.slug === 'root') {
      return res.status(403).json({
        success: false,
        message: 'No se puede eliminar el tenant del sistema'
      });
    }

    // Verificar confirmación de nombre
    if (confirmName !== tenant.name) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de confirmación no coincide'
      });
    }

    await client.query('BEGIN');

    // Eliminar en orden por dependencias (CASCADE debería manejar esto, pero por seguridad)
    // 1. Revocar tokens
    await client.query(
      `DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1)`,
      [id]
    );
    await client.query(
      `DELETE FROM client_refresh_tokens WHERE client_id IN (SELECT id FROM clients WHERE tenant_id = $1)`,
      [id]
    );
    
    // 2. Los demás se eliminan por CASCADE definido en el schema
    await client.query('DELETE FROM tenants WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Log de auditoría (en tenant null porque ya no existe)
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        null, adminUser.id, 'TENANT_DELETED', 'tenants', id,
        JSON.stringify({ name: tenant.name, slug: tenant.slug }),
        null,
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: `Organización "${tenant.name}" eliminada permanentemente`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar organización'
    });
  } finally {
    client.release();
  }
};

// Listar todos los usuarios del sistema
const listAllUsers = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      tenantId,
      role,
      status,
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;
    const validSortColumns = ['created_at', 'email', 'last_login', 'role'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let whereConditions = ["u.role != 'root'"];
    const params = [];
    let paramCount = 1;

    if (search) {
      whereConditions.push(`(u.email ILIKE $${paramCount} OR u.first_name ILIKE $${paramCount} OR u.last_name ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }

    if (tenantId) {
      whereConditions.push(`u.tenant_id = $${paramCount}`);
      params.push(tenantId);
      paramCount++;
    }

    if (role) {
      whereConditions.push(`u.role = $${paramCount}`);
      params.push(role);
      paramCount++;
    }

    if (status !== undefined) {
      whereConditions.push(`u.is_active = $${paramCount}`);
      params.push(status === 'active');
      paramCount++;
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    const result = await query(
      `SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone,
        u.role, u.is_active, u.is_locked, u.email_verified,
        u.auth_provider, u.last_login, u.login_count, u.created_at,
        t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug,
        t.is_active as tenant_active
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       ${whereClause}
       ORDER BY u.${sortColumn} ${order}
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        users: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar usuarios'
    });
  }
};

// Actualizar usuario desde root admin
const updateUserAsRoot = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, role, isActive, isLocked } = req.body;
    const adminUser = req.user;

    // No permitir modificar usuario root
    const targetUser = await query(
      'SELECT role, email FROM users WHERE id = $1',
      [id]
    );

    if (targetUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (targetUser.rows[0].role === 'root') {
      return res.status(403).json({
        success: false,
        message: 'No se puede modificar el usuario root'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (role !== undefined && role !== 'root') {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }
    if (isLocked !== undefined) {
      updates.push(`is_locked = $${paramCount++}`);
      values.push(isLocked);
      if (!isLocked) {
        updates.push(`locked_until = NULL`);
        updates.push(`failed_login_attempts = 0`);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    values.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} 
       WHERE id = $${paramCount}
       RETURNING id, email, first_name, last_name, role, is_active, is_locked`,
      values
    );

    // Si se desactiva o bloquea, revocar tokens
    if (isActive === false || isLocked === true) {
      await query(
        'UPDATE refresh_tokens SET is_revoked = true, revoked_at = NOW() WHERE user_id = $1',
        [id]
      );
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        null, adminUser.id, 'USER_UPDATED_BY_ROOT', 'users', id,
        null, JSON.stringify(req.body),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Usuario actualizado',
      data: { user: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
};

// Eliminar usuario permanentemente
const deleteUser = async (req, res) => {
  const client = await getClient();
  
  try {
    const { id } = req.params;
    const adminUser = req.user;

    // Obtener usuario
    const userResult = await client.query(
      'SELECT email, role, tenant_id FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const user = userResult.rows[0];

    // No permitir eliminar usuario root
    if (user.role === 'root') {
      return res.status(403).json({
        success: false,
        message: 'No se puede eliminar el usuario root'
      });
    }

    await client.query('BEGIN');

    // Eliminar tokens
    await client.query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    
    // Eliminar usuario
    await client.query('DELETE FROM users WHERE id = $1', [id]);

    await client.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.tenant_id, adminUser.id, 'USER_DELETED', 'users', id,
        JSON.stringify({ email: user.email }),
        null,
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: `Usuario ${user.email} eliminado permanentemente`
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error eliminando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario'
    });
  } finally {
    client.release();
  }
};

// Ver logs de auditoría globales
const getAuditLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      tenantId,
      userId,
      action,
      startDate,
      endDate
    } = req.query;
    
    const offset = (page - 1) * limit;

    let whereConditions = [];
    const params = [];
    let paramCount = 1;

    if (tenantId) {
      whereConditions.push(`a.tenant_id = $${paramCount}`);
      params.push(tenantId);
      paramCount++;
    }

    if (userId) {
      whereConditions.push(`a.user_id = $${paramCount}`);
      params.push(userId);
      paramCount++;
    }

    if (action) {
      whereConditions.push(`a.action ILIKE $${paramCount}`);
      params.push(`%${action}%`);
      paramCount++;
    }

    if (startDate) {
      whereConditions.push(`a.created_at >= $${paramCount}`);
      params.push(startDate);
      paramCount++;
    }

    if (endDate) {
      whereConditions.push(`a.created_at <= $${paramCount}`);
      params.push(endDate);
      paramCount++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT 
        a.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        t.name as tenant_name
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN tenants t ON a.tenant_id = t.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM audit_logs a ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener logs de auditoría'
    });
  }
};

// Obtener resumen de actividad reciente
const getRecentActivity = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const result = await query(
      `SELECT 
        a.id, a.action, a.entity_type, a.created_at,
        u.email as user_email,
        u.first_name, u.last_name,
        t.name as tenant_name
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       LEFT JOIN tenants t ON a.tenant_id = t.id
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: { activities: result.rows }
    });

  } catch (error) {
    console.error('Error obteniendo actividad reciente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener actividad reciente'
    });
  }
};

module.exports = {
  getDashboardStats,
  listAllTenants,
  getTenantDetails,
  updateTenantBilling,
  toggleTenantStatus,
  deleteTenant,
  listAllUsers,
  updateUserAsRoot,
  deleteUser,
  getAuditLogs,
  getRecentActivity
};
