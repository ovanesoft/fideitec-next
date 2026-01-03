const { query, getClient } = require('../config/database');
const crypto = require('crypto');
const { sendInvitationEmail } = require('../utils/email');

// Crear nuevo tenant (solo root)
const createTenant = async (req, res) => {
  const client = await getClient();
  
  try {
    const { name, slug, domain } = req.body;
    const createdBy = req.user.id;

    await client.query('BEGIN');

    // Verificar que el slug no exista
    const existingTenant = await client.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [slug.toLowerCase()]
    );

    if (existingTenant.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'El slug ya está en uso'
      });
    }

    // Crear tenant
    const result = await client.query(
      `INSERT INTO tenants (name, slug, domain, created_by, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, slug, domain, is_active, created_at`,
      [name, slug.toLowerCase(), domain, createdBy]
    );

    const tenant = result.rows[0];

    await client.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenant.id, createdBy, 'TENANT_CREATED', 'tenants', tenant.id,
        null, JSON.stringify({ name, slug }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Organización creada exitosamente',
      data: { tenant }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear organización'
    });
  } finally {
    client.release();
  }
};

// Listar tenants (solo root)
const listTenants = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [limit, offset];

    if (search) {
      whereClause = `WHERE name ILIKE $3 OR slug ILIKE $3`;
      params.push(`%${search}%`);
    }

    const result = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
              u.email as created_by_email
       FROM tenants t
       LEFT JOIN users u ON t.created_by = u.id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await query(
      `SELECT COUNT(*) FROM tenants ${whereClause}`,
      search ? [`%${search}%`] : []
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

// Obtener tenant por ID
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Verificar acceso
    if (user.role !== 'root' && user.tenant_id !== id) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a esta organización'
      });
    }

    const result = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
              u.email as created_by_email
       FROM tenants t
       LEFT JOIN users u ON t.created_by = u.id
       WHERE t.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    res.json({
      success: true,
      data: { tenant: result.rows[0] }
    });

  } catch (error) {
    console.error('Error obteniendo tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener organización'
    });
  }
};

// Actualizar tenant
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, domain, settings, is_active } = req.body;
    const user = req.user;

    // Verificar acceso
    if (user.role !== 'root' && (user.tenant_id !== id || user.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta organización'
      });
    }

    // Solo root puede activar/desactivar
    if (is_active !== undefined && user.role !== 'root') {
      return res.status(403).json({
        success: false,
        message: 'Solo el administrador puede activar/desactivar organizaciones'
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (domain !== undefined) {
      updates.push(`domain = $${paramCount++}`);
      values.push(domain);
    }
    if (settings !== undefined) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(settings));
    }
    if (is_active !== undefined && user.role === 'root') {
      updates.push(`is_active = $${paramCount++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar'
      });
    }

    values.push(id);
    
    const result = await query(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
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
        id, user.id, 'TENANT_UPDATED', 'tenants', id,
        null, JSON.stringify(req.body),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Organización actualizada',
      data: { tenant: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando tenant:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar organización'
    });
  }
};

// Invitar usuario al tenant
const inviteUser = async (req, res) => {
  const client = await getClient();
  
  try {
    const { email, role } = req.body;
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar que el usuario pueda invitar
    if (user.role !== 'root' && user.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para invitar usuarios'
      });
    }

    // Solo admin y root pueden invitar admins
    if (role === 'admin' && user.role !== 'root' && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para invitar administradores'
      });
    }

    await client.query('BEGIN');

    // Verificar que el tenant existe
    const tenantResult = await client.query(
      'SELECT id, name FROM tenants WHERE id = $1 AND is_active = true',
      [tenantId]
    );

    if (tenantResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = tenantResult.rows[0];

    // Verificar si el email ya está registrado en el tenant
    const existingUser = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = $1 AND tenant_id = $2',
      [email.toLowerCase(), tenantId]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Este usuario ya pertenece a la organización'
      });
    }

    // Verificar si ya existe una invitación pendiente
    const existingInvite = await client.query(
      `SELECT id FROM user_invitations 
       WHERE LOWER(email) = $1 AND tenant_id = $2 AND status = 'pending' AND expires_at > NOW()`,
      [email.toLowerCase(), tenantId]
    );

    if (existingInvite.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Ya existe una invitación pendiente para este email'
      });
    }

    // Generar token de invitación
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    // Crear invitación
    const inviteResult = await client.query(
      `INSERT INTO user_invitations (tenant_id, email, role, token, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, role, expires_at`,
      [tenantId, email.toLowerCase(), role, token, user.id, expiresAt]
    );

    await client.query('COMMIT');

    // Enviar email de invitación
    const inviterName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
    
    try {
      await sendInvitationEmail(email, inviterName, tenant.name, token, role);
    } catch (emailError) {
      console.error('Error enviando email de invitación:', emailError);
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'USER_INVITED', 'user_invitations', inviteResult.rows[0].id,
        null, JSON.stringify({ email, role }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Invitación enviada exitosamente',
      data: {
        invitation: {
          id: inviteResult.rows[0].id,
          email: inviteResult.rows[0].email,
          role: inviteResult.rows[0].role,
          expiresAt: inviteResult.rows[0].expires_at
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error invitando usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar invitación'
    });
  } finally {
    client.release();
  }
};

// Aceptar invitación
const acceptInvitation = async (req, res) => {
  const client = await getClient();
  
  try {
    const { token, password, firstName, lastName } = req.body;

    await client.query('BEGIN');

    // Buscar invitación válida
    const inviteResult = await client.query(
      `SELECT i.*, t.name as tenant_name 
       FROM user_invitations i
       JOIN tenants t ON i.tenant_id = t.id
       WHERE i.token = $1 AND i.status = 'pending' AND i.expires_at > NOW() AND t.is_active = true`,
      [token]
    );

    if (inviteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invitación inválida o expirada'
      });
    }

    const invitation = inviteResult.rows[0];

    // Verificar si el usuario ya existe
    const existingUser = await client.query(
      'SELECT id, tenant_id FROM users WHERE LOWER(email) = $1',
      [invitation.email]
    );

    let userId;

    if (existingUser.rows.length > 0) {
      // Usuario existe, actualizar su tenant
      const existingUserData = existingUser.rows[0];
      
      if (existingUserData.tenant_id) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          message: 'Ya perteneces a una organización'
        });
      }

      await client.query(
        `UPDATE users SET tenant_id = $1, role = $2 WHERE id = $3`,
        [invitation.tenant_id, invitation.role, existingUserData.id]
      );

      userId = existingUserData.id;
    } else {
      // Crear nuevo usuario
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await client.query(
        `INSERT INTO users (
          email, password_hash, first_name, last_name,
          tenant_id, role, auth_provider, email_verified, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, 'local', true, true)
        RETURNING id`,
        [invitation.email, passwordHash, firstName, lastName, invitation.tenant_id, invitation.role]
      );

      userId = userResult.rows[0].id;
    }

    // Marcar invitación como aceptada
    await client.query(
      `UPDATE user_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [invitation.id]
    );

    await client.query('COMMIT');

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        invitation.tenant_id, userId, 'INVITATION_ACCEPTED', 'users', userId,
        null, JSON.stringify({ email: invitation.email }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Invitación aceptada. Ya puedes iniciar sesión.',
      data: {
        tenantName: invitation.tenant_name
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error aceptando invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al aceptar invitación'
    });
  } finally {
    client.release();
  }
};

// Listar invitaciones del tenant
const listInvitations = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso
    if (user.role !== 'root' && user.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a esta organización'
      });
    }

    const result = await query(
      `SELECT i.*, u.email as invited_by_email,
              u.first_name as invited_by_first_name, u.last_name as invited_by_last_name
       FROM user_invitations i
       JOIN users u ON i.invited_by = u.id
       WHERE i.tenant_id = $1
       ORDER BY i.created_at DESC`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { invitations: result.rows }
    });

  } catch (error) {
    console.error('Error listando invitaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar invitaciones'
    });
  }
};

// Cancelar invitación
const cancelInvitation = async (req, res) => {
  try {
    const { invitationId } = req.params;
    const user = req.user;

    const result = await query(
      `UPDATE user_invitations 
       SET status = 'cancelled' 
       WHERE id = $1 AND status = 'pending'
       AND (
         tenant_id = $2 
         OR EXISTS (SELECT 1 FROM users WHERE id = $3 AND role = 'root')
       )
       RETURNING id, tenant_id`,
      [invitationId, user.tenant_id, user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitación no encontrada o ya procesada'
      });
    }

    res.json({
      success: true,
      message: 'Invitación cancelada'
    });

  } catch (error) {
    console.error('Error cancelando invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cancelar invitación'
    });
  }
};

// Listar usuarios del tenant
const listTenantUsers = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso
    if (user.role !== 'root' && user.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a esta organización'
      });
    }

    const result = await query(
      `SELECT id, email, first_name, last_name, role, is_active,
              auth_provider, last_login, created_at
       FROM users
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { users: result.rows }
    });

  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar usuarios'
    });
  }
};

// ===========================================
// Portal de Clientes
// ===========================================

// Obtener información del portal de clientes
const getClientPortalInfo = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso
    if (user.role !== 'root' && user.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a esta organización'
      });
    }

    const result = await query(
      `SELECT client_portal_token, client_portal_enabled, client_portal_settings
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = result.rows[0];
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/${tenant.client_portal_token}`;

    res.json({
      success: true,
      data: {
        portal: {
          enabled: tenant.client_portal_enabled,
          token: tenant.client_portal_token,
          url: portalUrl,
          settings: tenant.client_portal_settings
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo info del portal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del portal'
    });
  }
};

// Habilitar/deshabilitar portal de clientes
const toggleClientPortal = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;
    const { enabled } = req.body;

    // Verificar acceso (solo admin del tenant o root)
    if (user.role !== 'root' && (user.tenant_id !== tenantId || !['admin'].includes(user.role))) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta configuración'
      });
    }

    const result = await query(
      `UPDATE tenants 
       SET client_portal_enabled = $1
       WHERE id = $2
       RETURNING client_portal_enabled, client_portal_token`,
      [enabled, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = result.rows[0];
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/${tenant.client_portal_token}`;

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'CLIENT_PORTAL_TOGGLED', 'tenants', tenantId,
        null, JSON.stringify({ enabled }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: `Portal de clientes ${enabled ? 'habilitado' : 'deshabilitado'}`,
      data: {
        portal: {
          enabled: tenant.client_portal_enabled,
          url: portalUrl
        }
      }
    });

  } catch (error) {
    console.error('Error toggling portal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al modificar el portal'
    });
  }
};

// Regenerar token del portal
const regeneratePortalToken = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso (solo admin del tenant o root)
    if (user.role !== 'root' && (user.tenant_id !== tenantId || !['admin'].includes(user.role))) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta configuración'
      });
    }

    const newToken = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `UPDATE tenants 
       SET client_portal_token = $1
       WHERE id = $2
       RETURNING client_portal_token, client_portal_enabled`,
      [newToken, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = result.rows[0];
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/portal/${tenant.client_portal_token}`;

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'PORTAL_TOKEN_REGENERATED', 'tenants', tenantId,
        null, JSON.stringify({ action: 'regenerate' }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Token regenerado. Los links anteriores ya no funcionarán.',
      data: {
        portal: {
          token: tenant.client_portal_token,
          url: portalUrl
        }
      }
    });

  } catch (error) {
    console.error('Error regenerando token:', error);
    res.status(500).json({
      success: false,
      message: 'Error al regenerar token'
    });
  }
};

// Actualizar configuración del portal
const updatePortalSettings = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;
    const { settings } = req.body;

    // Verificar acceso (solo admin del tenant o root)
    if (user.role !== 'root' && (user.tenant_id !== tenantId || !['admin'].includes(user.role))) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta configuración'
      });
    }

    // Validar settings permitidos
    const allowedSettings = [
      'allow_self_registration',
      'require_kyc',
      'auto_approve_kyc_level_1',
      'welcome_message',
      'terms_url',
      'privacy_url'
    ];

    const filteredSettings = {};
    for (const [key, value] of Object.entries(settings || {})) {
      if (allowedSettings.includes(key)) {
        filteredSettings[key] = value;
      }
    }

    const result = await query(
      `UPDATE tenants 
       SET client_portal_settings = client_portal_settings || $1::jsonb
       WHERE id = $2
       RETURNING client_portal_settings`,
      [JSON.stringify(filteredSettings), tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Configuración actualizada',
      data: {
        settings: result.rows[0].client_portal_settings
      }
    });

  } catch (error) {
    console.error('Error actualizando settings del portal:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración'
    });
  }
};

// ===========================================
// Portal de Proveedores
// ===========================================

// Obtener información del portal de proveedores
const getSupplierPortalInfo = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso
    if (user.role !== 'root' && user.tenant_id !== tenantId) {
      return res.status(403).json({
        success: false,
        message: 'No tiene acceso a esta organización'
      });
    }

    const result = await query(
      `SELECT supplier_portal_token, supplier_portal_enabled
       FROM tenants WHERE id = $1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = result.rows[0];
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/supplier-portal/${tenant.supplier_portal_token}`;

    res.json({
      success: true,
      data: {
        supplierPortalEnabled: tenant.supplier_portal_enabled,
        supplierPortalToken: tenant.supplier_portal_token,
        supplierPortalUrl: portalUrl
      }
    });

  } catch (error) {
    console.error('Error obteniendo info del portal de proveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del portal'
    });
  }
};

// Habilitar/deshabilitar portal de proveedores
const toggleSupplierPortal = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso (solo admin del tenant o root)
    if (user.role !== 'root' && (user.tenant_id !== tenantId || !['admin'].includes(user.role))) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta configuración'
      });
    }

    // Obtener estado actual
    const currentResult = await query(
      'SELECT supplier_portal_enabled FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (currentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const newEnabled = !currentResult.rows[0].supplier_portal_enabled;

    const result = await query(
      `UPDATE tenants 
       SET supplier_portal_enabled = $1
       WHERE id = $2
       RETURNING supplier_portal_enabled, supplier_portal_token`,
      [newEnabled, tenantId]
    );

    const tenant = result.rows[0];
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/supplier-portal/${tenant.supplier_portal_token}`;

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'SUPPLIER_PORTAL_TOGGLED', 'tenants', tenantId,
        null, JSON.stringify({ enabled: newEnabled }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: `Portal de proveedores ${newEnabled ? 'habilitado' : 'deshabilitado'}`,
      data: {
        supplierPortalEnabled: tenant.supplier_portal_enabled,
        supplierPortalUrl: portalUrl
      }
    });

  } catch (error) {
    console.error('Error toggling portal de proveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al modificar el portal'
    });
  }
};

// Regenerar token del portal de proveedores
const regenerateSupplierPortalToken = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = req.params.id || user.tenant_id;

    // Verificar acceso (solo admin del tenant o root)
    if (user.role !== 'root' && (user.tenant_id !== tenantId || !['admin'].includes(user.role))) {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para modificar esta configuración'
      });
    }

    const newToken = crypto.randomBytes(32).toString('hex');

    const result = await query(
      `UPDATE tenants 
       SET supplier_portal_token = $1
       WHERE id = $2
       RETURNING supplier_portal_token, supplier_portal_enabled`,
      [newToken, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Organización no encontrada'
      });
    }

    const tenant = result.rows[0];
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/supplier-portal/${tenant.supplier_portal_token}`;

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'SUPPLIER_PORTAL_TOKEN_REGENERATED', 'tenants', tenantId,
        null, JSON.stringify({ action: 'regenerate' }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Token regenerado. Los links anteriores ya no funcionarán.',
      data: {
        supplierPortalToken: tenant.supplier_portal_token,
        supplierPortalUrl: portalUrl
      }
    });

  } catch (error) {
    console.error('Error regenerando token de proveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al regenerar token'
    });
  }
};

module.exports = {
  createTenant,
  listTenants,
  getTenantById,
  updateTenant,
  inviteUser,
  acceptInvitation,
  listInvitations,
  cancelInvitation,
  listTenantUsers,
  // Portal de clientes
  getClientPortalInfo,
  toggleClientPortal,
  regeneratePortalToken,
  updatePortalSettings,
  // Portal de proveedores
  getSupplierPortalInfo,
  toggleSupplierPortal,
  regenerateSupplierPortalToken
};

