const { query, getClient } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ===========================================
// CRUD de Clientes (desde Panel de Empresa)
// ===========================================

// Listar clientes del tenant
const listClients = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      kyc_status, 
      aml_status,
      is_active 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const params = [tenantId, limit, offset];
    let paramCount = 4;
    
    let whereConditions = ['c.tenant_id = $1'];
    
    if (search) {
      whereConditions.push(`(
        c.first_name ILIKE $${paramCount} OR 
        c.last_name ILIKE $${paramCount} OR 
        c.email ILIKE $${paramCount} OR
        c.document_number ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (kyc_status) {
      whereConditions.push(`c.kyc_status = $${paramCount}`);
      params.push(kyc_status);
      paramCount++;
    }
    
    if (aml_status) {
      whereConditions.push(`c.aml_status = $${paramCount}`);
      params.push(aml_status);
      paramCount++;
    }
    
    if (is_active !== undefined) {
      whereConditions.push(`c.is_active = $${paramCount}`);
      params.push(is_active === 'true');
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `SELECT 
        c.id, c.email, c.first_name, c.last_name, c.phone, c.mobile,
        c.document_type, c.document_number,
        c.kyc_status, c.kyc_level, c.aml_status, c.aml_risk_level, c.is_pep,
        c.is_active, c.email_verified, c.registration_source,
        c.last_login, c.created_at,
        u.email as registered_by_email
       FROM clients c
       LEFT JOIN users u ON c.registered_by = u.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    // Contar total
    const countParams = params.slice(0, 1).concat(params.slice(3));
    const countResult = await query(
      `SELECT COUNT(*) FROM clients c WHERE ${whereClause.replace(/\$2|\$3/g, (m) => `$${parseInt(m.slice(1)) - 2}`)}`,
      countParams
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        clients: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listando clientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar clientes'
    });
  }
};

// Obtener cliente por ID
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    const result = await query(
      `SELECT c.*, 
              u.email as registered_by_email,
              u.first_name as registered_by_first_name,
              u.last_name as registered_by_last_name,
              r.email as reviewed_by_email
       FROM clients c
       LEFT JOIN users u ON c.registered_by = u.id
       LEFT JOIN users r ON c.kyc_reviewed_by = r.id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // No enviar password_hash
    const client = result.rows[0];
    delete client.password_hash;

    res.json({
      success: true,
      data: { client }
    });

  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cliente'
    });
  }
};

// Crear cliente con invitación (registro manual desde panel de empresa)
const createClient = async (req, res) => {
  const dbClient = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const {
      email,
      first_name,
      last_name,
      phone,
      mobile,
      document_type,
      document_number,
      birth_date,
      nationality,
      address_street,
      address_number,
      address_city,
      address_state,
      address_postal_code,
      notes,
      tags
    } = req.body;

    await dbClient.query('BEGIN');

    // Verificar email único en el tenant
    const existingClient = await dbClient.query(
      'SELECT id FROM clients WHERE tenant_id = $1 AND LOWER(email) = $2',
      [tenantId, email.toLowerCase()]
    );

    if (existingClient.rows.length > 0) {
      await dbClient.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Ya existe un cliente con este email'
      });
    }

    // Generar token de invitación (el cliente establecerá su contraseña)
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const result = await dbClient.query(
      `INSERT INTO clients (
        tenant_id, email, first_name, last_name,
        phone, mobile, document_type, document_number, birth_date,
        nationality, address_street, address_number, address_city,
        address_state, address_postal_code, notes, tags,
        registration_source, registered_by, 
        invite_token, invite_token_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'manual', $18, $19, $20)
      RETURNING id, email, first_name, last_name, created_at`,
      [
        tenantId, email.toLowerCase(), first_name, last_name,
        phone || null, mobile || null, document_type || null, document_number || null, birth_date || null,
        nationality || 'ARG', address_street || null, address_number || null, address_city || null,
        address_state || null, address_postal_code || null, notes || null, JSON.stringify(tags || []),
        user.id, inviteToken, inviteExpires
      ]
    );

    await dbClient.query('COMMIT');

    // Obtener info del tenant para el link
    const tenantResult = await query(
      'SELECT slug FROM tenants WHERE id = $1',
      [tenantId]
    );
    const tenantSlug = tenantResult.rows[0]?.slug;

    // Construir URL de invitación
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.fideitec.com';
    const inviteUrl = `${FRONTEND_URL}/portal/${tenantSlug}/setup/${inviteToken}`;

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'CLIENT_CREATED', 'clients', result.rows[0].id,
        null, JSON.stringify({ email, first_name, last_name }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: { 
        client: result.rows[0],
        inviteUrl
      }
    });

  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Error creando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear cliente'
    });
  } finally {
    dbClient.release();
  }
};

// Reenviar invitación a cliente
const resendClientInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    // Generar nuevo token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await query(
      `UPDATE clients 
       SET invite_token = $1, invite_token_expires = $2
       WHERE id = $3 AND tenant_id = $4 AND password_hash IS NULL
       RETURNING id, email, first_name`,
      [inviteToken, inviteExpires, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado o ya tiene contraseña'
      });
    }

    // Obtener portal token
    const tenantResult = await query(
      'SELECT slug FROM tenants WHERE id = $1',
      [tenantId]
    );
    const tenantSlug = tenantResult.rows[0]?.slug;

    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.fideitec.com';
    const inviteUrl = `${FRONTEND_URL}/portal/${tenantSlug}/setup/${inviteToken}`;

    res.json({
      success: true,
      message: 'Invitación regenerada',
      data: {
        client: result.rows[0],
        inviteUrl
      }
    });

  } catch (error) {
    console.error('Error reenviando invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reenviar invitación'
    });
  }
};

// Actualizar cliente
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const updates = req.body;

    // Campos permitidos para actualizar
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'mobile',
      'document_type', 'document_number', 'document_country',
      'birth_date', 'birth_place', 'nationality', 'gender', 'marital_status',
      'address_street', 'address_number', 'address_floor', 'address_apartment',
      'address_city', 'address_state', 'address_postal_code', 'address_country',
      'occupation', 'employer', 'tax_id', 'tax_condition',
      'source_of_funds', 'source_of_funds_detail', 'expected_monthly_amount',
      'is_pep', 'pep_position', 'pep_relationship',
      'is_active', 'notes', 'tags', 'custom_fields'
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${paramCount}`);
        values.push(key === 'tags' || key === 'custom_fields' ? JSON.stringify(value) : value);
        paramCount++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No hay campos válidos para actualizar'
      });
    }

    values.push(id, tenantId);

    const result = await query(
      `UPDATE clients SET ${setClauses.join(', ')} 
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING id, email, first_name, last_name, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'CLIENT_UPDATED', 'clients', id,
        null, JSON.stringify(updates),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Cliente actualizado',
      data: { client: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar cliente'
    });
  }
};

// ===========================================
// KYC Management
// ===========================================

// Actualizar estado KYC
const updateClientKYC = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const { kyc_status, kyc_level, kyc_rejection_reason, kyc_expiry_date } = req.body;

    const result = await query(
      `UPDATE clients SET 
        kyc_status = COALESCE($1, kyc_status),
        kyc_level = COALESCE($2, kyc_level),
        kyc_rejection_reason = $3,
        kyc_expiry_date = $4,
        kyc_reviewed_at = NOW(),
        kyc_reviewed_by = $5
       WHERE id = $6 AND tenant_id = $7
       RETURNING id, email, kyc_status, kyc_level`,
      [kyc_status, kyc_level, kyc_rejection_reason, kyc_expiry_date, user.id, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'CLIENT_KYC_UPDATED', 'clients', id,
        null, JSON.stringify({ kyc_status, kyc_level }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Estado KYC actualizado',
      data: { client: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando KYC:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar KYC'
    });
  }
};

// Actualizar estado AML
const updateClientAML = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const { aml_status, aml_risk_level, aml_notes, aml_next_review } = req.body;

    const result = await query(
      `UPDATE clients SET 
        aml_status = COALESCE($1, aml_status),
        aml_risk_level = COALESCE($2, aml_risk_level),
        aml_notes = $3,
        aml_next_review = $4,
        aml_last_check = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING id, email, aml_status, aml_risk_level`,
      [aml_status, aml_risk_level, aml_notes, aml_next_review, id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Cliente no encontrado'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'CLIENT_AML_UPDATED', 'clients', id,
        null, JSON.stringify({ aml_status, aml_risk_level }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Estado AML actualizado',
      data: { client: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando AML:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar AML'
    });
  }
};

// ===========================================
// Estadísticas de clientes
// ===========================================

const getClientStats = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;

    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE kyc_status = 'pending') as kyc_pending,
        COUNT(*) FILTER (WHERE kyc_status = 'approved') as kyc_approved,
        COUNT(*) FILTER (WHERE kyc_status = 'rejected') as kyc_rejected,
        COUNT(*) FILTER (WHERE aml_status = 'alert') as aml_alerts,
        COUNT(*) FILTER (WHERE aml_risk_level = 'high' OR aml_risk_level = 'critical') as high_risk,
        COUNT(*) FILTER (WHERE is_pep = true) as pep_count,
        COUNT(*) FILTER (WHERE registration_source = 'portal') as self_registered,
        COUNT(*) FILTER (WHERE registration_source = 'manual') as manually_registered
       FROM clients
       WHERE tenant_id = $1`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { stats: stats.rows[0] }
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
  listClients,
  getClientById,
  createClient,
  updateClient,
  updateClientKYC,
  updateClientAML,
  getClientStats,
  resendClientInvite
};

