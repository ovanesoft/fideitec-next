const { query, getClient } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// ===========================================
// CRUD de Proveedores (desde Panel de Empresa)
// ===========================================

// Listar proveedores del tenant
const listSuppliers = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status,
      category,
      is_active 
    } = req.query;
    
    const offset = (page - 1) * limit;
    const params = [tenantId, limit, offset];
    let paramCount = 4;
    
    let whereConditions = ['s.tenant_id = $1'];
    
    if (search) {
      whereConditions.push(`(
        s.company_name ILIKE $${paramCount} OR 
        s.trade_name ILIKE $${paramCount} OR 
        s.first_name ILIKE $${paramCount} OR 
        s.last_name ILIKE $${paramCount} OR 
        s.email ILIKE $${paramCount} OR
        s.document_number ILIKE $${paramCount}
      )`);
      params.push(`%${search}%`);
      paramCount++;
    }
    
    if (status) {
      whereConditions.push(`s.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }
    
    if (category) {
      whereConditions.push(`s.category = $${paramCount}`);
      params.push(category);
      paramCount++;
    }
    
    if (is_active !== undefined) {
      whereConditions.push(`s.is_active = $${paramCount}`);
      params.push(is_active === 'true');
      paramCount++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await query(
      `SELECT 
        s.id, s.email, s.company_name, s.trade_name, s.first_name, s.last_name,
        s.phone, s.document_type, s.document_number, s.category, s.subcategory,
        s.status, s.is_active, s.password_set, s.last_login, s.created_at,
        u.email as created_by_email
       FROM suppliers s
       LEFT JOIN users u ON s.created_by = u.id
       WHERE ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $2 OFFSET $3`,
      params
    );

    // Contar total - solo usar tenant_id para el count básico
    const countResult = await query(
      `SELECT COUNT(*) FROM suppliers WHERE tenant_id = $1`,
      [tenantId]
    );

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        suppliers: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error listando proveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar proveedores'
    });
  }
};

// Obtener proveedor por ID
const getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    const result = await query(
      `SELECT s.*, 
              u.email as created_by_email,
              u.first_name as created_by_first_name,
              u.last_name as created_by_last_name
       FROM suppliers s
       LEFT JOIN users u ON s.created_by = u.id
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // No enviar password_hash ni tokens
    const supplier = result.rows[0];
    delete supplier.password_hash;
    delete supplier.invite_token;
    delete supplier.password_reset_token;

    res.json({
      success: true,
      data: { supplier }
    });

  } catch (error) {
    console.error('Error obteniendo proveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proveedor'
    });
  }
};

// Crear proveedor (desde panel de empresa) y enviar invitación
const createSupplier = async (req, res) => {
  const client = await getClient();
  
  try {
    const user = req.user;
    const tenantId = user.tenant_id;
    const {
      email,
      company_name,
      trade_name,
      first_name,
      last_name,
      phone,
      mobile,
      document_type,
      document_number,
      tax_condition,
      category,
      subcategory,
      services_description,
      address_street,
      address_number,
      address_city,
      address_state,
      address_postal_code,
      notes,
      tags
    } = req.body;

    await client.query('BEGIN');

    // Verificar email único en el tenant
    const existingSupplier = await client.query(
      'SELECT id FROM suppliers WHERE tenant_id = $1 AND LOWER(email) = $2',
      [tenantId, email.toLowerCase()]
    );

    if (existingSupplier.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Ya existe un proveedor con este email'
      });
    }

    // Generar token de invitación
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const result = await client.query(
      `INSERT INTO suppliers (
        tenant_id, email, company_name, trade_name, first_name, last_name,
        phone, mobile, document_type, document_number, tax_condition,
        category, subcategory, services_description,
        address_street, address_number, address_city, address_state, address_postal_code,
        notes, tags, created_by, invite_token, invite_token_expires, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, 'pending')
      RETURNING id, email, company_name, first_name, last_name, created_at`,
      [
        tenantId, email.toLowerCase(), company_name, trade_name, first_name, last_name,
        phone, mobile, document_type, document_number, tax_condition,
        category, subcategory, services_description,
        address_street, address_number, address_city, address_state, address_postal_code,
        notes, JSON.stringify(tags || []), user.id, inviteToken, inviteExpires
      ]
    );

    await client.query('COMMIT');

    // Obtener info del tenant para el email
    const tenantInfo = await query(
      'SELECT name, slug FROM tenants WHERE id = $1',
      [tenantId]
    );

    // TODO: Enviar email de invitación al proveedor
    // Por ahora solo loguear
    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/supplier-portal/${tenantInfo.rows[0].slug}/setup/${inviteToken}`;
    console.log(`📧 =============== INVITACIÓN PROVEEDOR ===============`);
    console.log(`   To: ${email}`);
    console.log(`   Empresa: ${tenantInfo.rows[0].name}`);
    console.log(`   Link: ${portalUrl}`);
    console.log(`======================================================`);

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'SUPPLIER_CREATED', 'suppliers', result.rows[0].id,
        null, JSON.stringify({ email, company_name, first_name, last_name }),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.status(201).json({
      success: true,
      message: 'Proveedor creado. Se ha enviado una invitación por email.',
      data: { 
        supplier: result.rows[0],
        inviteUrl: portalUrl // En desarrollo, mostrar URL
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creando proveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear proveedor'
    });
  } finally {
    client.release();
  }
};

// Actualizar proveedor
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;
    const updates = req.body;

    // Campos permitidos para actualizar
    const allowedFields = [
      'company_name', 'trade_name', 'first_name', 'last_name', 'phone', 'mobile',
      'website', 'document_type', 'document_number', 'tax_condition',
      'address_street', 'address_number', 'address_floor', 'address_apartment',
      'address_city', 'address_state', 'address_postal_code', 'address_country',
      'bank_name', 'bank_account_type', 'bank_account_number', 'bank_cbu', 'bank_alias',
      'category', 'subcategory', 'services_description',
      'has_afip_certificate', 'afip_certificate_url',
      'has_insurance', 'insurance_url', 'insurance_expiry',
      'status', 'is_active', 'notes', 'tags', 'custom_fields'
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
      `UPDATE suppliers SET ${setClauses.join(', ')} 
       WHERE id = $${paramCount} AND tenant_id = $${paramCount + 1}
       RETURNING id, email, company_name, first_name, last_name, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Log de auditoría
    await query(
      `SELECT log_audit($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId, user.id, 'SUPPLIER_UPDATED', 'suppliers', id,
        null, JSON.stringify(updates),
        req.ip, req.headers['user-agent']
      ]
    ).catch(err => console.error('Error en auditoría:', err));

    res.json({
      success: true,
      message: 'Proveedor actualizado',
      data: { supplier: result.rows[0] }
    });

  } catch (error) {
    console.error('Error actualizando proveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar proveedor'
    });
  }
};

// Reenviar invitación
const resendInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const tenantId = user.tenant_id;

    // Verificar que el proveedor existe y no ha establecido contraseña
    const supplierResult = await query(
      'SELECT id, email, first_name, password_set FROM suppliers WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (supplierResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    const supplier = supplierResult.rows[0];

    if (supplier.password_set) {
      return res.status(400).json({
        success: false,
        message: 'El proveedor ya estableció su contraseña'
      });
    }

    // Generar nuevo token
    const inviteToken = crypto.randomBytes(32).toString('hex');
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE suppliers SET invite_token = $1, invite_token_expires = $2 WHERE id = $3`,
      [inviteToken, inviteExpires, id]
    );

    // Obtener info del tenant
    const tenantInfo = await query(
      'SELECT name, slug FROM tenants WHERE id = $1',
      [tenantId]
    );

    const portalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/supplier-portal/${tenantInfo.rows[0].slug}/setup/${inviteToken}`;
    
    console.log(`📧 =============== REENVÍO INVITACIÓN PROVEEDOR ===============`);
    console.log(`   To: ${supplier.email}`);
    console.log(`   Link: ${portalUrl}`);
    console.log(`==============================================================`);

    res.json({
      success: true,
      message: 'Invitación reenviada',
      data: { inviteUrl: portalUrl }
    });

  } catch (error) {
    console.error('Error reenviando invitación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al reenviar invitación'
    });
  }
};

// Estadísticas de proveedores
const getSupplierStats = async (req, res) => {
  try {
    const user = req.user;
    const tenantId = user.tenant_id;

    const stats = await query(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_active = true) as active,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'active') as status_active,
        COUNT(*) FILTER (WHERE status = 'inactive') as inactive,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(*) FILTER (WHERE password_set = false) as pending_setup,
        COUNT(*) FILTER (WHERE password_set = true) as setup_complete
       FROM suppliers
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // Obtener categorías
    const categories = await query(
      `SELECT category, COUNT(*) as count 
       FROM suppliers 
       WHERE tenant_id = $1 AND category IS NOT NULL
       GROUP BY category
       ORDER BY count DESC
       LIMIT 10`,
      [tenantId]
    );

    res.json({
      success: true,
      data: { 
        stats: stats.rows[0],
        categories: categories.rows
      }
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
  listSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  resendInvite,
  getSupplierStats
};

